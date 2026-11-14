/**
 * Exports: PNG render, Godot 4.3+ project (TileMapLayer + TileSet .tres with blob terrains,
 * AnimatedSprite2D characters, StaticBody2D collision, Marker2D spawns) and a PixiJS v8 bundle.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  BLOB_MASKS,
  DECOR_ROW,
  GRASS_VARIANTS,
  OVERLAY_TERRAINS,
  PEERING_BITS,
  blobCoord,
  decorCoord,
  resolveGround,
  shoreCoord,
} from "../shared/autotile.js";
import { characterLabel, DEFAULT_GROUND_ROW, facingRow, feetPx, frameColumn, walkColumns } from "../shared/characters.js";
import { collisionGrid, collisionRects } from "../shared/map.js";
import { OBJECT_BY_KIND } from "../shared/objects.js";
import { renderMap } from "../shared/render.js";
import { DECOR_CODES, TERRAINS, type Facing, type MapDoc } from "../shared/types.js";
import { encodePng } from "./png.js";
import { assertSafeId, dirs, loadAssets, loadMap, resolveInside, RUNTIME_DIR, type LoadedAssets } from "./workspace.js";

export const EXPORT_PRESETS = ["png", "godot", "pixi", "all"] as const;
export type ExportPreset = (typeof EXPORT_PRESETS)[number];

export interface ExportOptions {
  id: string;
  preset?: ExportPreset;
  /** Output folder (workspace-relative unless trustedPaths). */
  out?: string;
  scale?: number;
  /** CLI: paths are the user's own, skip the workspace sandbox. */
  trustedPaths?: boolean;
  /** Use this doc instead of loading maps/<id>.json. */
  doc?: MapDoc;
}

export interface ExportResult {
  dirs: string[];
  files: string[];
  warnings: string[];
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
const pascal = (s: string) => s.replace(/(^|[_-])([a-z0-9])/g, (_m, _a, b: string) => b.toUpperCase());
const slug = (s: string) => s.replace(/[^A-Za-z0-9_]+/g, "_");

const TERRAIN_COLORS: Record<string, string> = {
  grass: "Color(0.36, 0.61, 0.25, 1)",
  dirt: "Color(0.71, 0.52, 0.32, 1)",
  paddy: "Color(0.55, 0.75, 0.4, 1)",
  water: "Color(0.23, 0.53, 0.66, 1)",
  stone: "Color(0.76, 0.73, 0.66, 1)",
  sand: "Color(0.91, 0.83, 0.63, 1)",
};

class Writer {
  files: string[] = [];
  constructor(readonly dir: string) {}
  async text(rel: string, body: string) {
    const f = path.join(this.dir, rel);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
    this.files.push(f);
  }
  async bin(rel: string, body: Buffer) {
    const f = path.join(this.dir, rel);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
    this.files.push(f);
  }
  async copy(rel: string, src: string) {
    const f = path.join(this.dir, rel);
    await mkdir(path.dirname(f), { recursive: true });
    await copyFile(src, f);
    this.files.push(f);
  }
}

// ---------------------------------------------------------------- Godot

export interface GodotCell {
  x: number;
  y: number;
  col: number;
  row: number;
}

/** TileMapLayer `tile_map_data` bytes (format 0: u16 version, then 12 bytes per cell, little-endian). */
export function encodeTileMapData(cells: readonly GodotCell[]): Uint8Array {
  const buf = new Uint8Array(2 + cells.length * 12);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, 0, true);
  cells.forEach((c, i) => {
    const o = 2 + i * 12;
    dv.setInt16(o, c.x, true);
    dv.setInt16(o + 2, c.y, true);
    dv.setUint16(o + 4, 0, true);
    dv.setUint16(o + 6, c.col, true);
    dv.setUint16(o + 8, c.row, true);
    dv.setUint16(o + 10, 0, true);
  });
  return buf;
}

export function decodeTileMapData(bytes: Uint8Array): GodotCell[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: GodotCell[] = [];
  for (let o = 2; o + 12 <= bytes.length; o += 12) out.push({ x: dv.getInt16(o, true), y: dv.getInt16(o + 2, true), col: dv.getUint16(o + 6, true), row: dv.getUint16(o + 8, true) });
  return out;
}

export function groundCells(doc: MapDoc): GodotCell[] {
  return resolveGround(doc).flatMap((row, y) => row.map((c, x) => ({ x, y, col: c.atlas.col, row: c.atlas.row })));
}

export function decorCells(doc: MapDoc): GodotCell[] {
  const out: GodotCell[] = [];
  doc.layers.decor.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const at = decorCoord(row[x]!);
      if (at) out.push({ x, y, col: at.col, row: at.row });
    }
  });
  return out;
}

/** TileSet with one terrain set (match corners and sides): grass = 0, dirt/paddy/water/stone/sand = 1..5. */
export function buildTileSetTres(texturePath: string, tileSize = 16): string {
  const lines: string[] = [];
  const terrainId = (t: string) => (TERRAINS as readonly string[]).indexOf(t);
  const tile = (col: number, row: number, terrain: number | null, bits?: (bit: number) => number, probability?: number) => {
    const key = `${col}:${row}/0`;
    lines.push(`${key} = 0`);
    if (probability !== undefined) lines.push(`${key}/probability = ${probability}`);
    if (terrain === null) return;
    lines.push(`${key}/terrain_set = 0`, `${key}/terrain = ${terrain}`);
    for (const [name, bit] of PEERING_BITS) lines.push(`${key}/terrains_peering_bit/${name} = ${bits ? bits(bit) : terrain}`);
  };
  for (let v = 0; v < GRASS_VARIANTS; v++) tile(v, 0, 0, () => 0, v < 4 ? 1 : 0.15);
  for (const t of OVERLAY_TERRAINS) {
    const id = terrainId(t);
    BLOB_MASKS.forEach((mask, i) => {
      const at = blobCoord(t, i);
      tile(at.col, at.row, id, (bit) => (mask & bit ? id : 0));
    });
    const spare = blobCoord(t, 47);
    tile(spare.col, spare.row, id, () => id, 0.5);
  }
  // shore: water tiles whose open sides are beach sand
  const water = terrainId("water");
  const sand = terrainId("sand");
  BLOB_MASKS.forEach((mask, i) => {
    const at = shoreCoord(i);
    tile(at.col, at.row, water, (bit) => (mask & bit ? water : sand), 0.01);
  });
  const shoreSpare = shoreCoord(47);
  tile(shoreSpare.col, shoreSpare.row, water, () => water, 0.01);
  DECOR_CODES.forEach((_, i) => tile(i, DECOR_ROW, null));
  const terrains = TERRAINS.map((t, i) => `terrain_set_0/terrain_${i}/name = "${t}"\nterrain_set_0/terrain_${i}/color = ${TERRAIN_COLORS[t]}`).join("\n");
  return `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" path="${texturePath}" id="1_tiles"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_main"]
texture = ExtResource("1_tiles")
texture_region_size = Vector2i(${tileSize}, ${tileSize})
${lines.join("\n")}

[resource]
tile_size = Vector2i(${tileSize}, ${tileSize})
terrain_set_0/mode = 0
${terrains}
sources/0 = SubResource("TileSetAtlasSource_main")
`;
}

const PATROL_GD = `extends AnimatedSprite2D
## Easy Tilemap patrol: walks a loop of waypoints (map px, feet position) and plays walk_<dir>.

@export var path: PackedVector2Array = PackedVector2Array()
@export var speed := 24.0
var _i := 0

func _face(d: Vector2) -> String:
	if absf(d.x) >= absf(d.y):
		return "left" if d.x < 0.0 else "right"
	return "back" if d.y < 0.0 else "front"

func _process(delta: float) -> void:
	if path.size() < 2 or speed <= 0.0:
		return
	var target := path[_i]
	var to := target - position
	var step := speed * delta
	if to.length() <= step:
		position = target
		_i = (_i + 1) % path.size()
		return
	position += to.normalized() * step
	var anim := "walk_" + _face(to)
	if animation != anim and sprite_frames.has_animation(anim):
		play(anim)
`;

const CAMERA_PAN_GD = `extends Camera2D
## Easy Tilemap preview camera: arrow keys pan across the map. Replace with your player camera.

@export var speed := 160.0

func _process(delta: float) -> void:
	var dir := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if dir == Vector2.ZERO:
		return
	var half := get_viewport_rect().size * 0.5 / zoom
	position.x = clamp(position.x + dir.x * speed * delta, limit_left + half.x, limit_right - half.x)
	position.y = clamp(position.y + dir.y * speed * delta, limit_top + half.y, limit_bottom - half.y)
`;

function testMapGd(mainScene: string): string {
  return `extends SceneTree
## Headless check: godot --headless --path . --script res://test_map.gd
## Screenshot:    xvfb-run godot --rendering-driver opengl3 --path . --script res://screenshot.gd -- out=/tmp/map.png
## Prints counts and a few resolved cells as JSON, then OK.

func _init() -> void:
	var packed: PackedScene = load("${mainScene}")
	if packed == null:
		print("FAIL load")
		quit(1)
		return
	var root := packed.instantiate()
	var ground: TileMapLayer = root.get_node("Ground")
	var decor: TileMapLayer = root.get_node("Decor")
	var ts: TileSet = ground.tile_set
	var cells := {}
	for c in [Vector2i(0, 0), Vector2i(28, 5), Vector2i(12, 13), Vector2i(4, 4), Vector2i(34, 3)]:
		cells["%d,%d" % [c.x, c.y]] = [ground.get_cell_atlas_coords(c).x, ground.get_cell_atlas_coords(c).y]
	var src: TileSetAtlasSource = ts.get_source(0)
	var probe: TileData = src.get_tile_data(Vector2i(0, ${blobCoord("water", 0).row}), 0)
	var shapes := 0
	for n in root.get_node("Collision").get_children():
		if n is CollisionShape2D:
			shapes += 1
	var anims := 0
	var chars := 0
	var objects := 0
	for n in root.get_node("World").get_children():
		if n is AnimatedSprite2D:
			chars += 1
			anims = max(anims, n.sprite_frames.get_animation_names().size())
		elif n is Sprite2D:
			objects += 1
	var out := {
		"ground": ground.get_used_cells().size(),
		"decor": decor.get_used_cells().size(),
		"cells": cells,
		"terrain_sets": ts.get_terrain_sets_count(),
		"terrains": ts.get_terrains_count(0),
		"probe_terrain": probe.terrain,
		"probe_right": probe.get_terrain_peering_bit(TileSet.CELL_NEIGHBOR_RIGHT_SIDE),
		"objects": objects,
		"floor": root.get_node("Floor").get_child_count(),
		"characters": chars,
		"animations": anims,
		"collision_shapes": shapes,
		"spawns": root.get_node("Spawns").get_child_count(),
		"y_sort": root.get_node("World").y_sort_enabled,
	}
	print("RESULT| " + JSON.stringify(out))
	print("OK")
	root.free()
	quit(0)
`;
}

const SCREENSHOT_GD = `extends SceneTree
## Save a PNG of the main scene after 30 frames (needs a display, e.g. xvfb-run):
##   godot --rendering-driver opengl3 --path . --script res://screenshot.gd -- out=/tmp/map.png
var frames := 0
var out := "user://screenshot.png"

func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("out="):
			out = a.substr(4)
	root.add_child(load(ProjectSettings.get_setting("application/run/main_scene")).instantiate())

func _process(_delta: float) -> bool:
	frames += 1
	if frames == 30:
		root.get_viewport().get_texture().get_image().save_png(out)
		print("saved ", out)
		quit()
	return false
`;

function godotProject(doc: MapDoc, mainScene: string): string {
  return `; Generated by Easy Tilemap — Godot 4.3+ (TileMapLayer + terrains)
config_version=5

[application]

config/name="${doc.name.replace(/"/g, "'")}"
run/main_scene="${mainScene}"
config/features=PackedStringArray("4.3")

[display]

window/size/viewport_width=${doc.viewport.width}
window/size/viewport_height=${doc.viewport.height}
window/size/window_width_override=${doc.viewport.width * 3}
window/size/window_height_override=${doc.viewport.height * 3}
window/stretch/mode="viewport"

[rendering]

textures/canvas_textures/default_texture_filter=0
2d/snap/snap_2d_transforms_to_pixel=true
`;
}

interface GodotChar {
  index: number;
  label: string;
  res: string;
}

export function buildGodotTscn(doc: MapDoc, assets: LoadedAssets, files: { tileset: string; objects: Map<string, string>; characters: GodotChar[]; patrol: string; camera: string }): string {
  const ext: string[] = [];
  const subs: string[] = [];
  const nodes: string[] = [];
  let extId = 0;
  const extByPath = new Map<string, string>();
  const addExt = (type: string, res: string) => {
    const known = extByPath.get(res);
    if (known) return known;
    const id = `${++extId}_${slug(path.basename(res, path.extname(res))).slice(0, 24)}`;
    ext.push(`[ext_resource type="${type}" path="${res}" id="${id}"]`);
    extByPath.set(res, id);
    return id;
  };
  const ts = doc.tileSize;
  nodes.push(`[node name="${pascal(doc.id)}" type="Node2D"]`);
  const tsId = addExt("TileSet", files.tileset);
  nodes.push(`[node name="Ground" type="TileMapLayer" parent="."]
tile_map_data = PackedByteArray(${Array.from(encodeTileMapData(groundCells(doc))).join(", ")})
tile_set = ExtResource("${tsId}")`);
  nodes.push(`[node name="Decor" type="TileMapLayer" parent="."]
tile_map_data = PackedByteArray(${Array.from(encodeTileMapData(decorCells(doc))).join(", ")})
tile_set = ExtResource("${tsId}")`);

  const objNode = (i: number, parent: string) => {
    const o = doc.objects[i]!;
    const k = OBJECT_BY_KIND.get(o.kind)!;
    const tex = addExt("Texture2D", files.objects.get(o.kind)!);
    const h = k.h * ts;
    return `[node name="O${i}_${slug(o.name ?? o.kind)}" type="Sprite2D" parent="${parent}"]
position = Vector2(${o.x * ts}, ${o.y * ts + h})
texture = ExtResource("${tex}")
centered = false
offset = Vector2(0, ${-h})${o.flipX ? "\nflip_h = true" : ""}`;
  };
  nodes.push(`[node name="Floor" type="Node2D" parent="."]`);
  doc.objects.forEach((o, i) => {
    if (OBJECT_BY_KIND.get(o.kind)?.floor) nodes.push(objNode(i, "Floor"));
  });
  nodes.push(`[node name="World" type="Node2D" parent="."]\ny_sort_enabled = true`);
  doc.objects.forEach((o, i) => {
    const k = OBJECT_BY_KIND.get(o.kind);
    if (k && !k.floor) nodes.push(objNode(i, "World"));
  });

  // characters: one SpriteFrames per sheet (idle_<dir>, walk_<dir>)
  const framesBySheet = new Map<string, string>();
  const patrolId = doc.characters.some((c) => c.patrol) ? addExt("Script", files.patrol) : null;
  for (const gc of files.characters) {
    const ch = doc.characters[gc.index]!;
    const sheet = assets.sheets?.get(ch.sheet);
    if (!sheet) continue;
    const layout = sheet.layout;
    const fs = layout.frameSize;
    const idleCol = ch.frame !== undefined ? frameColumn(layout, ch.frame, 0) : Math.max(0, layout.frames.indexOf("idle"));
    const key = `${gc.res}#${idleCol}`;
    let framesId = framesBySheet.get(key);
    if (!framesId) {
      const tex = addExt("Texture2D", gc.res);
      const k = `${slug(path.basename(gc.res, ".png")).slice(0, 24)}_${idleCol}`;
      const atlas = new Map<string, string>();
      const atlasTex = (col: number, row: number) => {
        const id = `AtlasTexture_${k}_${col}_${row}`;
        if (!atlas.has(id)) {
          subs.push(`[sub_resource type="AtlasTexture" id="${id}"]\natlas = ExtResource("${tex}")\nregion = Rect2(${col * fs}, ${row * fs}, ${fs}, ${fs})`);
          atlas.set(id, id);
        }
        return id;
      };
      const walk = walkColumns(layout);
      const anims: string[] = [];
      for (const dir of ["front", "right", "back", "left"] as Facing[]) {
        const { row } = facingRow(layout, dir);
        for (const [anim, cols, speed] of [["idle", [idleCol], 1], ["walk", walk, 6]] as const) {
          const frames = cols.map((c) => `{\n"duration": 1.0,\n"texture": SubResource("${atlasTex(c, row)}")\n}`).join(", ");
          anims.push(`{\n"frames": [${frames}],\n"loop": true,\n"name": &"${anim}_${dir}",\n"speed": ${speed}.0\n}`);
        }
      }
      framesId = `SpriteFrames_${k}`;
      subs.push(`[sub_resource type="SpriteFrames" id="${framesId}"]\nanimations = [${anims.join(", ")}]`);
      framesBySheet.set(key, framesId);
    }
    const feet = feetPx(ch, ts);
    const facing = ch.facing ?? "front";
    const flip = facingRow(layout, facing).flipX;
    const anim = `${ch.anim ?? "idle"}_${facing}`;
    const ground = ch.groundRow ?? sheet.groundRow ?? DEFAULT_GROUND_ROW;
    const lines = [
      `[node name="C${gc.index}_${gc.label}" type="AnimatedSprite2D" parent="World"]`,
      ...(ch.patrol && patrolId ? [`script = ExtResource("${patrolId}")`] : []),
      `position = Vector2(${feet.x}, ${feet.y})`,
      `sprite_frames = SubResource("${framesId}")`,
      `animation = &"${anim}"`,
      `autoplay = "${anim}"`,
      `centered = false`,
      `offset = Vector2(${-fs / 2}, ${-ground})`,
      ...(flip ? ["flip_h = true"] : []),
    ];
    if (ch.patrol && patrolId) {
      const pts = ch.patrol.path.map(([x, y]) => feetPx({ x, y }, ts)).map((p) => `${p.x}, ${p.y}`).join(", ");
      lines.push(`path = PackedVector2Array(${pts})`, `speed = ${num(ch.patrol.speed ?? 24)}`);
    }
    nodes.push(lines.join("\n"));
  }

  // collision: merged rects of blocked cells
  const rects = collisionRects(collisionGrid(doc));
  nodes.push(`[node name="Collision" type="StaticBody2D" parent="."]`);
  const shapeIds = new Map<string, string>();
  rects.forEach((r, i) => {
    const size = `${r.w * ts}x${r.h * ts}`;
    let sid = shapeIds.get(size);
    if (!sid) {
      sid = `RectangleShape2D_${size}`;
      subs.push(`[sub_resource type="RectangleShape2D" id="${sid}"]\nsize = Vector2(${r.w * ts}, ${r.h * ts})`);
      shapeIds.set(size, sid);
    }
    nodes.push(`[node name="Box${i}" type="CollisionShape2D" parent="Collision"]
position = Vector2(${num((r.x + r.w / 2) * ts)}, ${num((r.y + r.h / 2) * ts)})
shape = SubResource("${sid}")`);
  });

  nodes.push(`[node name="Spawns" type="Node2D" parent="."]`);
  for (const s of doc.spawns) {
    nodes.push(`[node name="${slug(s.name)}" type="Marker2D" parent="Spawns"]
position = Vector2(${s.x * ts + ts / 2}, ${s.y * ts + ts / 2})
metadata/facing = "${s.facing ?? "front"}"`);
  }

  const camId = addExt("Script", files.camera);
  const start = doc.spawns.find((s) => s.name === "player") ?? doc.spawns[0];
  const mw = doc.width * ts;
  const mh = doc.height * ts;
  const cx = start ? Math.min(Math.max(start.x * ts, doc.viewport.width / 2), mw - doc.viewport.width / 2) : doc.viewport.width / 2;
  const cy = start ? Math.min(Math.max(start.y * ts, doc.viewport.height / 2), mh - doc.viewport.height / 2) : doc.viewport.height / 2;
  nodes.push(`[node name="Camera2D" type="Camera2D" parent="."]
script = ExtResource("${camId}")
position = Vector2(${Math.round(cx)}, ${Math.round(cy)})
limit_left = 0
limit_top = 0
limit_right = ${mw}
limit_bottom = ${mh}`);
  return [`[gd_scene load_steps=${ext.length + subs.length + 1} format=3]`, ext.join("\n"), ...subs, ...nodes].filter(Boolean).join("\n\n") + "\n";
}

async function exportGodot(doc: MapDoc, assets: LoadedAssets, dir: string): Promise<string[]> {
  const w = new Writer(dir);
  const base = doc.id;
  const atlasRel = `tilesets/${doc.tileset}.png`;
  await w.bin(atlasRel, encodePng(assets.atlas));
  await w.text(`${base}_tileset.tres`, buildTileSetTres(`res://${atlasRel}`, doc.tileSize));
  const objects = new Map<string, string>();
  for (const o of doc.objects) {
    if (objects.has(o.kind)) continue;
    const img = assets.objects.get(o.kind);
    if (!img) continue;
    await w.bin(`objects/${o.kind}.png`, encodePng(img));
    objects.set(o.kind, `res://objects/${o.kind}.png`);
  }
  const characters: GodotChar[] = [];
  const copied = new Map<string, string>();
  for (const [index, ch] of doc.characters.entries()) {
    const file = assets.sheetFiles.get(ch.sheet);
    if (!file) continue;
    let res = copied.get(file);
    if (!res) {
      const name = path.basename(file);
      await w.copy(`characters/${name}`, file);
      res = `res://characters/${name}`;
      copied.set(file, res);
    }
    characters.push({ index, label: characterLabel(ch, index), res });
  }
  await w.text("character_patrol.gd", PATROL_GD);
  await w.text("camera_pan.gd", CAMERA_PAN_GD);
  const main = `res://${base}.tscn`;
  await w.text(`${base}.tscn`, buildGodotTscn(doc, assets, { tileset: `res://${base}_tileset.tres`, objects, characters, patrol: "res://character_patrol.gd", camera: "res://camera_pan.gd" }));
  await w.text("project.godot", godotProject(doc, main));
  await w.text("test_map.gd", testMapGd(main));
  await w.text("screenshot.gd", SCREENSHOT_GD);
  await w.text(
    "README.txt",
    `Easy Tilemap — Godot 4.3+ export of "${doc.name}" (${doc.id})

Open this folder as a Godot project and press F5 (arrow keys pan the preview camera).

${base}.tscn
  Ground   TileMapLayer — ${base}_tileset.tres, terrain set 0 "match corners and sides":
           grass(0) dirt(1) paddy(2) water(3) stone(4) sand(5). Paint more with the Terrains tab.
  Decor    TileMapLayer (flowers, rocks, lotus, reeds, fence…)
  Floor    bridges / boats (Sprite2D, under characters)
  World    y_sort_enabled: objects (Sprite2D, origin at their base) + characters
           (AnimatedSprite2D idle_<dir> / walk_<dir>; character_patrol.gd walks waypoints)
  Collision StaticBody2D, merged rectangles (water, solid objects, painted collision)
  Spawns   Marker2D per spawn point (metadata/facing)
  Camera2D camera_pan.gd

Headless check: godot --headless --path . --script res://test_map.gd
Screenshot:     xvfb-run godot --rendering-driver opengl3 --path . --script res://screenshot.gd -- out=/tmp/map.png
Textures use Nearest filtering. Sample art is CC0, generated by Easy Tilemap (MIT).
`,
  );
  return w.files;
}

/** Bundle JSON consumed by runtime/pixi/easytilemap-pixi.js. */
export function buildPixiBundle(doc: MapDoc, assets: LoadedAssets, paths: { atlas: string; objects: Map<string, string>; sheets: Map<string, string> }) {
  const ts = doc.tileSize;
  const ground = resolveGround(doc).flatMap((row) => row.map((c) => c.atlas.row * ATLAS_COLUMNS + c.atlas.col));
  const decor = doc.layers.decor.flatMap((row) => row.split("").map((ch) => {
    const at = decorCoord(ch);
    return at ? at.row * ATLAS_COLUMNS + at.col : -1;
  }));
  const blocked = collisionGrid(doc);
  return {
    format: "easytilemap.pixi/1",
    id: doc.id,
    name: doc.name,
    tileSize: ts,
    width: doc.width,
    height: doc.height,
    viewport: doc.viewport,
    atlas: { image: paths.atlas, columns: ATLAS_COLUMNS, rows: ATLAS_ROWS },
    ground,
    decor,
    collision: blocked.map((r) => r.map((b) => (b ? "#" : ".")).join("")),
    objects: doc.objects.flatMap((o) => {
      const k = OBJECT_BY_KIND.get(o.kind);
      const image = paths.objects.get(o.kind);
      if (!k || !image) return [];
      return [{ kind: o.kind, name: o.name, image, x: o.x * ts, y: o.y * ts, w: k.w * ts, h: k.h * ts, base: (o.y + k.h) * ts, floor: Boolean(k.floor), flipX: Boolean(o.flipX) }];
    }),
    characters: doc.characters.flatMap((ch, i) => {
      const sheet = assets.sheets?.get(ch.sheet);
      const image = paths.sheets.get(ch.sheet);
      if (!sheet || !image) return [];
      const feet = feetPx(ch, ts);
      return [{
        name: ch.name ?? characterLabel(ch, i),
        image,
        layout: sheet.layout,
        groundRow: ch.groundRow ?? sheet.groundRow ?? DEFAULT_GROUND_ROW,
        idleColumn: ch.frame !== undefined ? frameColumn(sheet.layout, ch.frame, 0) : Math.max(0, sheet.layout.frames.indexOf("idle")),
        walkColumns: walkColumns(sheet.layout),
        x: feet.x,
        y: feet.y,
        facing: ch.facing ?? "front",
        anim: ch.anim ?? "idle",
        patrol: ch.patrol ? { speed: ch.patrol.speed ?? 24, path: ch.patrol.path.map(([x, y]) => { const p = feetPx({ x, y }, ts); return [p.x, p.y]; }) } : null,
      }];
    }),
    spawns: doc.spawns.map((s) => ({ name: s.name, x: s.x * ts + ts / 2, y: s.y * ts + ts / 2, facing: s.facing ?? "front" })),
  };
}

async function exportPixi(doc: MapDoc, assets: LoadedAssets, dir: string): Promise<string[]> {
  const w = new Writer(dir);
  const atlas = `tilesets/${doc.tileset}.png`;
  await w.bin(atlas, encodePng(assets.atlas));
  const objects = new Map<string, string>();
  for (const o of doc.objects) {
    if (objects.has(o.kind) || !assets.objects.get(o.kind)) continue;
    await w.bin(`objects/${o.kind}.png`, encodePng(assets.objects.get(o.kind)!));
    objects.set(o.kind, `objects/${o.kind}.png`);
  }
  const sheets = new Map<string, string>();
  for (const ch of doc.characters) {
    const file = assets.sheetFiles.get(ch.sheet);
    if (!file || sheets.has(ch.sheet)) continue;
    await w.copy(`characters/${path.basename(file)}`, file);
    sheets.set(ch.sheet, `characters/${path.basename(file)}`);
  }
  const bundle = buildPixiBundle(doc, assets, { atlas, objects, sheets });
  await w.text(`${doc.id}.tilemap.json`, `${JSON.stringify(bundle)}\n`);
  await w.copy("easytilemap-pixi.js", path.join(RUNTIME_DIR, "pixi", "easytilemap-pixi.js"));
  const player = doc.characters.find((c) => c.name === "ton") ?? doc.characters.find((c) => !c.patrol);
  const playerName = player ? (player.name ?? characterLabel(player, doc.characters.indexOf(player))) : "";
  await w.text("index.html", pixiHtml(doc, playerName));
  await w.text(
    "README.txt",
    `Easy Tilemap — PixiJS v8 export of "${doc.name}" (${doc.id})

Serve this folder over HTTP:  npx serve .   or   python3 -m http.server
Open index.html. Arrow keys / WASD walk ${playerName || "the camera"} (collision on).

Files
  ${doc.id}.tilemap.json   resolved ground/decor atlas indices, objects, characters, collision, spawns
  easytilemap-pixi.js      loadTilemap(PIXI, url) → { view, world, update(dt), isBlocked, spawn, control, follow }
  tilesets/ objects/ characters/

index.html loads ./pixi.min.js when present, else PixiJS v8 from jsDelivr. Sample art CC0, code MIT.
`,
  );
  return w.files;
}

function pixiHtml(doc: MapDoc, player: string): string {
  const vw = doc.viewport.width;
  const vh = doc.viewport.height;
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${doc.name.replace(/</g, "&lt;")} — Easy Tilemap (PixiJS v8)</title>
  <link rel="icon" href="data:,">
  <style>
    html, body { margin: 0; min-height: 100vh; background: #140e0a; color: #f7ebd3; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    canvas { image-rendering: pixelated; width: min(1440px, 96vw); aspect-ratio: ${vw} / ${vh}; height: auto; }
    p { opacity: .7; font-size: 13px; margin: 10px; }
  </style>
</head>
<body>
  <p>Arrow keys / WASD: walk${player ? ` (${player})` : ""} · collision from the map</p>
  <script>
    window.__pixiReady = new Promise((ok, fail) => {
      const tryLoad = (src, next) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = next; document.head.appendChild(s); };
      tryLoad("./pixi.min.js", () => tryLoad("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js", () => fail(new Error("PixiJS not found"))));
    });
  </script>
  <script type="module">
    import { loadTilemap } from "./easytilemap-pixi.js";
    await window.__pixiReady;
    const app = new PIXI.Application();
    await app.init({ width: ${vw}, height: ${vh}, resolution: 3, antialias: false, background: "#3a6a2a", roundPixels: true });
    app.canvas.style.width = "";
    document.body.prepend(app.canvas);
    const map = await loadTilemap(PIXI, "./${doc.id}.tilemap.json");
    app.stage.addChild(map.view);
    const player = ${player ? `map.characters.get(${JSON.stringify(player)})` : "null"};
    const ctl = player ? map.control(${JSON.stringify(player)}, { speed: 64 }) : null;
    if (player) map.follow(player.sprite, ${vw}, ${vh});
    else { const s = map.spawn("player") ?? { x: 0, y: 0 }; map.setCamera(s.x, s.y); }
    app.ticker.add((t) => map.update(Math.min(0.05, t.deltaMS / 1000)));
    map.update(0);
    window.__tm = { map, state: () => ({ player: player ? { x: player.sprite.x, y: player.sprite.y, dir: player.dir } : null, camera: map.camera, sprites: map.world.children.length }) };
    window.__ready = true;
  </script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- entry

export async function exportMap(root: string, opts: ExportOptions): Promise<ExportResult> {
  const preset = opts.preset ?? "all";
  if (!(EXPORT_PRESETS as readonly string[]).includes(preset)) throw new Error(`Unknown preset ${preset} (${EXPORT_PRESETS.join(", ")})`);
  const doc = opts.doc ?? (await loadMap(root, assertSafeId(opts.id)));
  const assets = await loadAssets(root, doc, { trusted: opts.trustedPaths });
  const outBase = (p: string) => {
    if (opts.out) {
      const abs = opts.trustedPaths ? path.resolve(root, opts.out) : resolveInside(root, opts.out);
      return preset === "all" ? path.join(abs, `${doc.id}-${p}`) : abs;
    }
    return path.join(dirs(root).exports, `${doc.id}-${p}`);
  };
  const res: ExportResult = { dirs: [], files: [], warnings: [...assets.warnings] };
  const run = async (p: Exclude<ExportPreset, "all">) => {
    const dir = outBase(p);
    await mkdir(dir, { recursive: true });
    res.dirs.push(dir);
    if (p === "png") {
      const f = path.join(dir, `${doc.id}.png`);
      await writeFile(f, encodePng(renderMap(doc, assets, { scale: opts.scale ?? 2 })));
      res.files.push(f);
    } else if (p === "godot") res.files.push(...(await exportGodot(doc, assets, dir)));
    else res.files.push(...(await exportPixi(doc, assets, dir)));
  };
  if (preset === "all") for (const p of ["png", "godot", "pixi"] as const) await run(p);
  else await run(preset);
  if (!existsSync(res.dirs[0]!)) throw new Error("export failed");
  return res;
}
