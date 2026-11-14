import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SHORE_ROW, resolveGroundCell, terrainBaseRow } from "../src/shared/autotile.js";
import { applyOps, createMap, validateMap } from "../src/shared/map.js";
import { OBJECT_KINDS, objectImage } from "../src/shared/objects.js";
import { buildMulticulturalVillage } from "../src/lib/demoMaps.js";
import { buildTileSetTres, exportMap } from "../src/lib/export.js";
import { pkgRoot } from "../src/lib/workspace.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup());

describe("multicultural village (Buddhist + Muslim + Chinese-Thai)", () => {
  it("catalogs the kampung buildings, beach props and kolek boats at their tile sizes", () => {
    const kinds = new Map(OBJECT_KINDS.map((o) => [o.kind, o]));
    for (const [kind, w, h] of [
      ["mosque", 7, 7], ["tadika", 5, 4], ["kampung_house", 5, 5], ["halal_stall", 3, 3],
      ["chinese_shrine", 3, 3], ["fish_rack", 2, 1], ["kolek", 3, 1],
    ] as const) {
      const o = kinds.get(kind);
      expect(o, kind).toBeDefined();
      expect([o!.w, o!.h]).toEqual([w, h]);
      const img = objectImage(kind);
      expect([img.width, img.height]).toEqual([w * 16, h * 16]);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! > 0) opaque++;
      expect(opaque / (img.width * img.height), kind).toBeGreaterThan(0.2);
    }
    expect(kinds.get("kolek")!.floor).toBe(true);
  });

  it("beach sand meets the sea with shore water tiles (no grass seam)", () => {
    const doc = applyOps(createMap({ id: "b", width: 6, height: 6 }), [
      { op: "fill", layer: "ground", code: "sand", x: 0, y: 2, w: 6, h: 2 },
      { op: "fill", layer: "ground", code: "water", x: 0, y: 4, w: 6, h: 2 },
    ]);
    const sand = resolveGroundCell(doc.layers.ground, 2, 3);
    expect(sand.terrain).toBe("sand");
    expect(sand.atlas.row).toBeGreaterThanOrEqual(terrainBaseRow("sand"));
    const shore = resolveGroundCell(doc.layers.ground, 2, 4);
    expect(shore.terrain).toBe("water");
    expect(shore.atlas.row).toBeGreaterThanOrEqual(SHORE_ROW);
    const openSea = resolveGroundCell(doc.layers.ground, 2, 5);
    expect(openSea.atlas.row).toBeLessThan(SHORE_ROW);
  });

  it("the committed sample matches the generator, validates cleanly and has every community", async () => {
    const file = JSON.parse(await readFile(path.join(pkgRoot, "samples/maps/multicultural_village.json"), "utf8"));
    const res = validateMap(file);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    const doc = validateMap(buildMulticulturalVillage()).doc!;
    expect(res.doc).toEqual(doc);
    const kinds = new Set(doc.objects.map((o) => o.kind));
    for (const k of ["temple", "chinese_shrine", "mosque", "tadika", "kampung_house", "halal_stall", "kolek"]) expect(kinds.has(k), k).toBe(true);
    expect(doc.spawns.map((s) => s.name)).toEqual(expect.arrayContaining(["temple", "shrine", "mosque", "market", "beach"]));
  });

  it("exports to Godot with sand/shore terrain peering and the new objects", async () => {
    const tres = buildTileSetTres("res://t.png");
    expect(tres).toContain('terrain_5/name = "sand"');
    expect(tres).toContain(`0:${SHORE_ROW}/0`);
    const res = await exportMap(root, { id: "multicultural_village", preset: "all" });
    expect(res.warnings).toEqual([]);
    const godot = res.dirs.find((d) => d.endsWith("-godot"))!;
    const scene = await readFile(path.join(godot, "multicultural_village.tscn"), "utf8");
    for (const m of scene.matchAll(/path="res:\/\/([^"]+)"/g)) await readFile(path.join(godot, m[1]!));
    expect(scene).toMatch(/mosque/);
    for (const f of res.files) await readFile(f);
  });
});
