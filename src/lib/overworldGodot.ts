/**
 * Godot 4.3+ overworld game for maps with `overworld` data: overworld_main.tscn runs
 * overworld_game.gd (tile-step player, town entrances, train rides), town_runner.gd (Easy Scene side
 * view with a side-view player and a way back), the travel data in overworld/overworld.json, the train
 * sprite, a Thai-capable font, Easy Scene town exports copied under towns/<scene>/ and a headless test.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { characterLabel, DEFAULT_GROUND_ROW, walkColumns } from "../shared/characters.js";
import { collisionGrid } from "../shared/map.js";
import { trainSheet } from "../shared/overworldObjects.js";
import { nightAtlas, nightGlow, nightImage } from "../shared/night.js";
import { travelGraph } from "../shared/overworld.js";
import type { MapDoc } from "../shared/types.js";
import { encodePng } from "./png.js";
import { loadSheet, RUNTIME_DIR, type LoadedAssets } from "./workspace.js";

export interface OverworldGodotOptions {
  /** Folder with Easy Scene Godot exports: `<scene>-godot/` or `<scene>/` per town scene id. */
  townScenes?: string;
  /** Easy Sprite side-view sheet for the player inside towns. */
  townPlayer?: string;
  /** Town shown by capture.gd's walk-in demo (default: picked automatically). */
  demoTown?: string;
  /** Start at night (N toggles in game either way). */
  night?: boolean;
}

/** Tunnel cells (the train is hidden while it is inside one). */
export function tunnelCells(doc: MapDoc): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  doc.layers.ground.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "U") out.push([x, y]);
  });
  return out;
}

/**
 * Bake the night copies a game swaps in: atlas, object images, the additive glow layer.
 * Paths are relative to the export root; `prefix` is "res://" for Godot, "" for Pixi.
 */
export async function writeNightAssets(doc: MapDoc, assets: LoadedAssets, sink: FileSink, prefix: string, start = false) {
  const atlasRel = `tilesets/${doc.tileset}_night.png`;
  await sink.bin(atlasRel, encodePng(nightAtlas(assets.atlas)));
  const objects: Record<string, string> = {};
  for (const o of doc.objects) {
    const day = `${prefix}objects/${o.kind}.png`;
    if (day in objects) continue;
    const img = assets.objects.get(o.kind);
    if (!img) continue;
    const rel = `objects/${o.kind}_night.png`;
    await sink.bin(rel, encodePng(nightImage(img)));
    objects[day] = `${prefix}${rel}`;
  }
  await sink.bin("overworld/night_glow.png", encodePng(nightGlow(doc)));
  return { start, atlas: `${prefix}${atlasRel}`, objects, glow: `${prefix}overworld/night_glow.png`, playerTint: [0.62, 0.66, 0.9] };
}

export interface FileSink {
  text(rel: string, body: string): Promise<void>;
  bin(rel: string, body: Buffer): Promise<void>;
  copy(rel: string, src: string): Promise<void>;
}

const TEXT_EXT = new Set([".tscn", ".tres", ".gd", ".gdshader", ".cfg"]);

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    if (name === ".godot" || name.startsWith(".")) continue;
    const f = path.join(dir, name);
    if ((await stat(f)).isDirectory()) out.push(...(await walk(f, base)));
    else out.push(path.relative(base, f));
  }
  return out;
}

/** Copy one Easy Scene Godot export into towns/<scene>/, re-rooting its res:// paths. */
async function copyTownScene(sink: FileSink, srcDir: string, scene: string): Promise<void> {
  for (const rel of await walk(srcDir)) {
    if (rel === "project.godot" || rel.endsWith(".import")) continue;
    const dst = `towns/${scene}/${rel.split(path.sep).join("/")}`;
    const src = path.join(srcDir, rel);
    if (TEXT_EXT.has(path.extname(rel))) await sink.text(dst, (await readFile(src, "utf8")).replaceAll("res://", `res://towns/${scene}/`));
    else await sink.copy(dst, src);
  }
}

function findSceneExport(dir: string, scene: string): string | null {
  for (const cand of [path.join(dir, `${scene}-godot`), path.join(dir, scene)]) {
    if (existsSync(path.join(cand, `${scene}.tscn`))) return cand;
  }
  return null;
}

/** Pick the walk-in demo: the last 9 tiles of a road route into a town (a kampung when there is one). */
export function pickDemo(doc: MapDoc, prefer?: string) {
  const ow = doc.overworld!;
  const roads = ow.routes.filter((r) => r.kind === "road" && r.path && r.path.length >= 6);
  const kindRank = (id: string) => {
    const t = ow.towns.find((x) => x.id === id);
    return id === prefer ? -1 : t?.kind === "malay_kampung" ? 0 : t?.kind === "thai_town" ? 1 : t?.kind === "chinese_town" ? 2 : 3;
  };
  const cands = roads.flatMap((r) => [
    { town: r.to, path: r.path!.slice(-9) },
    { town: r.from, path: [...r.path!].reverse().slice(-9) },
  ]);
  cands.sort((a, b) => kindRank(a.town) - kindRank(b.town) || b.path.length - a.path.length);
  const walkDemo = cands[0] ?? null;
  const g = travelGraph(doc)!;
  // the train demo: a line through a tunnel when there is one, not too long to film
  const inTunnel = (t: { path: Array<[number, number]> }) => t.path.some(([x, y]) => doc.layers.ground[y]?.[x] === "U");
  const byLen = [...g.trains].sort((a, b) => b.path.length - a.path.length);
  const train = byLen.find((t) => inTunnel(t) && t.path.length <= 80) ?? byLen.find((t) => t.path.length <= 70) ?? g.trains[0] ?? null;
  return { walk: walkDemo, train: train ? { from: train.from, to: train.to } : null };
}

export async function writeOverworldGodot(
  doc: MapDoc,
  assets: LoadedAssets,
  sink: FileSink,
  files: { mapScene: string; characters: Map<number, string> },
  opts: OverworldGodotOptions,
): Promise<{ main: string; warnings: string[] }> {
  const warnings: string[] = [];
  const graph = travelGraph(doc)!;
  // player: the character named "player", else the first one without a patrol
  const pi = doc.characters.findIndex((c) => c.name === "player");
  const idx = pi >= 0 ? pi : doc.characters.findIndex((c) => !c.patrol);
  let player: Record<string, unknown> | null = null;
  if (idx >= 0 && files.characters.has(idx)) {
    const ch = doc.characters[idx]!;
    const sheet = assets.sheets?.get(ch.sheet);
    if (sheet) {
      player = {
        image: files.characters.get(idx),
        frameSize: sheet.layout.frameSize,
        rows: Object.fromEntries(sheet.layout.directions.map((d, i) => [d, i])),
        idle: Math.max(0, sheet.layout.frames.indexOf("idle")),
        walk: walkColumns(sheet.layout),
        groundRow: ch.groundRow ?? sheet.groundRow ?? DEFAULT_GROUND_ROW,
        node: `C${idx}_${characterLabel(ch, idx)}`,
      };
    }
  }
  if (!player) warnings.push("overworld: no player character (add one named \"player\" with an Easy Sprite top-down sheet) — a marker is used");
  let sidePlayer: Record<string, unknown> | null = null;
  if (opts.townPlayer) {
    const file = path.resolve(opts.townPlayer);
    if (!existsSync(file)) warnings.push(`overworld: town player sheet not found: ${opts.townPlayer}`);
    else {
      const s = await loadSheet(file);
      await sink.copy("characters/side_player.png", file);
      sidePlayer = {
        image: "res://characters/side_player.png",
        frameSize: s.layout.frameSize,
        rows: Object.fromEntries(s.layout.directions.map((d, i) => [d, i])),
        idle: Math.max(0, s.layout.frames.indexOf("idle")),
        walk: walkColumns(s.layout),
        groundRow: s.groundRow ?? 47,
      };
    }
  } else warnings.push("overworld: no --town-player side-view sheet — towns use a marker for the player");
  const townScenes: Record<string, { tscn: string; json: string; night?: string } | null> = {};
  for (const t of doc.overworld!.towns) {
    if (t.scene in townScenes) continue;
    const src = opts.townScenes ? findSceneExport(path.resolve(opts.townScenes), t.scene) : null;
    if (src) {
      await copyTownScene(sink, src, t.scene);
      townScenes[t.scene] = {
        tscn: `res://towns/${t.scene}/${t.scene}.tscn`,
        json: `res://towns/${t.scene}/${t.scene}.scene.json`,
        // Easy Scene `export --night` writes <scene>_night.tscn next to the day scene
        ...(existsSync(path.join(src, `${t.scene}_night.tscn`)) ? { night: `res://towns/${t.scene}/${t.scene}_night.tscn` } : {}),
      };
    } else {
      townScenes[t.scene] = null;
      warnings.push(`overworld: Easy Scene export for "${t.scene}" not found${opts.townScenes ? ` in ${opts.townScenes}` : " (pass --town-scenes)"} — a placeholder street is used`);
    }
  }
  const blocked = collisionGrid(doc).map((r) => r.map((b) => (b ? "#" : ".")).join(""));
  const night = await writeNightAssets(doc, assets, sink, "res://", Boolean(opts.night));
  const data = {
    ...graph,
    width: doc.width,
    height: doc.height,
    viewport: doc.viewport,
    blocked,
    mapScene: files.mapScene,
    player,
    sidePlayer,
    townScenes,
    train: "res://overworld/train.png",
    tunnels: tunnelCells(doc),
    night,
    demo: pickDemo(doc, opts.demoTown),
  };
  await sink.text("overworld/overworld.json", `${JSON.stringify(data, null, 1)}\n`);
  await sink.bin("overworld/train.png", encodePng(trainSheet()));
  for (const f of ["overworld_game.gd", "town_runner.gd", "test_overworld.gd", "capture.gd"]) await sink.copy(`overworld/${f}`, path.join(RUNTIME_DIR, "godot", f));
  await sink.copy("fonts/Kanit-Regular.ttf", path.join(RUNTIME_DIR, "fonts", "Kanit-Regular.ttf"));
  await sink.copy("fonts/OFL.txt", path.join(RUNTIME_DIR, "fonts", "OFL.txt"));
  await sink.text(
    "overworld_main.tscn",
    `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://overworld/overworld_game.gd" id="1_game"]

[node name="Overworld" type="Node2D"]
script = ExtResource("1_game")
`,
  );
  return { main: "res://overworld_main.tscn", warnings };
}
