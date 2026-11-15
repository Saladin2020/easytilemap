/**
 * Backward compatibility: the sample maps load, check, render and export as they did before the overworld
 * work (fingerprints in fixtures/compat-master.json, written by scripts/compat-golden.mts from master).
 * Allowed: append-only growth of the atlas (new rows below), the .tres (new terrains / tiles) and atlas.rows.
 * The full old-vs-new comparison over studio workspaces is scripts/compat-check.py.
 */
import { createHash } from "node:crypto";
import { copyFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportMap } from "../src/lib/export.js";
import { loadAssets, loadAtlas, loadMap, readMap } from "../src/lib/workspace.js";
import { readPng } from "../src/lib/png.js";
import * as autotile from "../src/shared/autotile.js";
import { renderMap } from "../src/shared/render.js";
import { TERRAIN_CODE, TERRAINS } from "../src/shared/types.js";
import { tempWorkspace } from "./helpers.js";

const golden = JSON.parse(await readFile(new URL("./fixtures/compat-master.json", import.meta.url), "utf8"));
const sha = (b: Uint8Array | Uint8ClampedArray | string) => createHash("sha256").update(b).digest("hex");
const OLD_ROWS: number = golden.rows.ATLAS_ROWS;
const OLD_TERRAINS: number = golden.terrains.length;

/** The .tres minus what the new rows / terrains added: must equal the old file byte for byte. */
function oldPartOfTres(tres: string): string {
  return tres
    .split("\n")
    .filter((l) => {
      const tile = l.match(/^(\d+):(\d+)\//);
      if (tile) return Number(tile[2]) < OLD_ROWS;
      const terr = l.match(/^terrain_set_0\/terrain_(\d+)\//);
      if (terr) return Number(terr[1]) < OLD_TERRAINS;
      return true;
    })
    .join("\n");
}

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup?.());

describe("backward compatibility with maps from before the overworld work", () => {
  it("keeps every old terrain, tile code and atlas row where it was (append-only)", () => {
    expect(TERRAINS.slice(0, OLD_TERRAINS)).toEqual(golden.terrains);
    for (const [t, c] of Object.entries(golden.terrainCodes)) expect(TERRAIN_CODE[t as keyof typeof TERRAIN_CODE]).toBe(c);
    for (const [k, v] of Object.entries(golden.rows)) if (k !== "ATLAS_ROWS") expect((autotile as Record<string, unknown>)[k], k).toBe(v);
    expect(autotile.ATLAS_ROWS).toBeGreaterThanOrEqual(OLD_ROWS);
  });

  it.each(Object.keys(golden.maps))("%s: check, render and export match the old checkout", async (id) => {
    const g = golden.maps[id];
    const r = await readMap(root, id);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    const doc = await loadMap(root, id);
    const assets = await loadAssets(root, doc);
    const img = renderMap(doc, assets, { scale: 1 });
    expect({ width: img.width, height: img.height, sha: sha(img.data) }).toEqual(g.render);
    // the first OLD_ROWS atlas rows are the old atlas, pixel for pixel
    expect(sha(assets.atlas.data.subarray(0, assets.atlas.width * OLD_ROWS * 16 * 4))).toBe(g.atlasTop);

    const dir = path.join(root, "exports", `compat-${id}`);
    await exportMap(root, { id, preset: "all", out: dir });
    const gd = path.join(dir, `${id}-godot`);
    const px = path.join(dir, `${id}-pixi`);
    expect(sha(await readFile(path.join(gd, `${id}.tscn`)))).toBe(g.tscn);
    expect(sha(oldPartOfTres(await readFile(path.join(gd, `${id}_tileset.tres`), "utf8")))).toBe(g.tres);
    const bundle = JSON.parse(await readFile(path.join(px, `${id}.tilemap.json`), "utf8"));
    expect(bundle.atlas.rows).toBe(autotile.ATLAS_ROWS);
    delete bundle.atlas.rows;
    expect(sha(JSON.stringify(bundle))).toBe(g.bundle);
    const files = async (d: string) => (await readdir(d, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => path.relative(d, path.join(e.parentPath, e.name))).sort();
    // same files: no overworld game, night PNG or scene.json for plain maps
    expect(await files(gd)).toEqual(g.godotFiles);
    expect(await files(px)).toEqual(g.pixiFiles);
    expect(await files(path.join(dir, `${id}-png`))).toEqual(g.pngFiles);
  }, 60_000);

  it("an old workspace atlas (27 rows, from an early studio project) keeps its rows and gains the new ones", async () => {
    const f = path.join(root, "tilesets", "thai_village.png");
    await copyFile(new URL("./fixtures/old_atlas_27rows.png", import.meta.url), f);
    const old = await readPng(f);
    const atlas = await loadAtlas(root);
    expect(atlas.width).toBe(old.width);
    expect(atlas.height).toBe(autotile.ATLAS_ROWS * 16);
    expect(Buffer.from(atlas.data.subarray(0, old.data.length)).equals(Buffer.from(old.data))).toBe(true);
  });
});
