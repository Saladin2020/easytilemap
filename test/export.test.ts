import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BLOB_MASKS } from "../src/shared/autotile.js";
import { buildTileSetTres, decodeTileMapData, encodeTileMapData, exportMap, groundCells } from "../src/lib/export.js";
import { loadAssets, loadMap } from "../src/lib/workspace.js";
import { renderMap } from "../src/shared/render.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup());

describe("Godot tile_map_data", () => {
  it("round-trips cells through the format-0 byte layout", () => {
    const cells = [
      { x: 0, y: 0, col: 3, row: 1 },
      { x: -2, y: 7, col: 7, row: 26 },
    ];
    const bytes = encodeTileMapData(cells);
    expect(bytes.length).toBe(2 + 12 * cells.length);
    expect(decodeTileMapData(bytes)).toEqual(cells);
  });

  it("covers every ground cell of the demo", async () => {
    const doc = await loadMap(root, "thai_village_topdown");
    expect(groundCells(doc)).toHaveLength(doc.width * doc.height);
  });

  it("declares 5 terrains and peering bits for all 47 blob tiles per terrain", () => {
    const tres = buildTileSetTres("res://tilesets/thai_village.png");
    expect(tres).toMatch(/terrain_set_0\/mode = 0/);
    for (let i = 0; i < 5; i++) expect(tres).toContain(`terrain_set_0/terrain_${i}/name`);
    const waterTiles = tres.match(/\/terrain = 3\n/g) ?? [];
    expect(waterTiles.length).toBeGreaterThanOrEqual(BLOB_MASKS.length);
  });
});

describe("render + export", () => {
  it("renders the demo with characters drawn over the ground", async () => {
    const doc = await loadMap(root, "thai_village_topdown");
    const assets = await loadAssets(root, doc);
    expect(assets.warnings).toEqual([]);
    const withChars = renderMap(doc, assets);
    const without = renderMap(doc, assets, { characters: false });
    expect(withChars.width).toBe(doc.width * 16);
    expect(withChars.height).toBe(doc.height * 16);
    expect(Buffer.compare(Buffer.from(withChars.data), Buffer.from(without.data))).not.toBe(0);
    const crop = renderMap(doc, assets, { crop: { x: 0, y: 0, w: 480, h: 270 }, scale: 2 });
    expect([crop.width, crop.height]).toEqual([960, 540]);
  });

  it("exports Godot and Pixi projects with every asset they reference", async () => {
    const res = await exportMap(root, { id: "thai_village_topdown", preset: "all" });
    expect(res.warnings).toEqual([]);
    const godot = res.dirs.find((d) => d.endsWith("-godot"))!;
    const scene = await readFile(path.join(godot, "thai_village_topdown.tscn"), "utf8");
    expect(scene).toMatch(/type="TileMapLayer"/);
    expect(scene).toMatch(/type="AnimatedSprite2D"/);
    expect(scene).toMatch(/type="StaticBody2D"/);
    expect(scene).toMatch(/type="Marker2D"/);
    expect(scene).toMatch(/y_sort_enabled = true/);
    for (const m of scene.matchAll(/path="res:\/\/([^"]+)"/g)) await readFile(path.join(godot, m[1]!));

    const pixi = res.dirs.find((d) => d.endsWith("-pixi"))!;
    const bundle = JSON.parse(await readFile(path.join(pixi, "thai_village_topdown.tilemap.json"), "utf8"));
    expect(bundle.format).toBe("easytilemap.pixi/1");
    expect(bundle.characters).toHaveLength(6);
    await readFile(path.join(pixi, "easytilemap-pixi.js"));
    await readFile(path.join(pixi, "index.html"));
    for (const f of res.files) await readFile(f);
  });

  it("refuses an output folder outside the workspace", async () => {
    await expect(exportMap(root, { id: "thai_village_topdown", preset: "png", out: "../../escape" })).rejects.toThrow();
  });
});
