import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ATLAS_ROWS,
  BLOB_MASKS,
  CITY_DECOR_ROW,
  CURB_ROW,
  DECOR_ROW,
  E,
  MARKER_ROW,
  N,
  S,
  SHORE_ROW,
  W,
  blobCoord,
  blobIndex,
  curbCoord,
  decorCoord,
  neighbourMask,
  resolveGround,
  resolveGroundCell,
  terrainBaseRow,
} from "../src/shared/autotile.js";
import { applyOps, createMap, validateMap } from "../src/shared/map.js";
import { OBJECT_BY_KIND, objectImage } from "../src/shared/objects.js";
import { CITY_PALETTE } from "../src/shared/cityTiles.js";
import { generateAtlas } from "../src/shared/tileset.js";
import { DECOR_CODES, DECOR_NAMES, TERRAINS } from "../src/shared/types.js";
import { buildCityCrossing } from "../src/lib/demoMaps.js";
import { buildTileSetTres, exportMap } from "../src/lib/export.js";
import { pkgRoot } from "../src/lib/workspace.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup());

const atlas = generateAtlas();
const T = 16;
function tileOpaque(col: number, row: number): boolean {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (atlas.data[((row * T + y) * atlas.width + col * T + x) * 4 + 3] !== 255) return false;
  return true;
}
function tileHash(col: number, row: number): string {
  const out: number[] = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) out.push(atlas.data[((row * T + y) * atlas.width + col * T + x) * 4]!);
  return out.join(",");
}

describe("city street tiles (sidewalk / road / curb)", () => {
  it("appends rows without moving the village atlas layout", () => {
    expect([SHORE_ROW, DECOR_ROW, MARKER_ROW]).toEqual([31, 37, 38]);
    expect(terrainBaseRow("sidewalk")).toBe(39);
    expect(terrainBaseRow("road")).toBe(45);
    expect(CURB_ROW).toBe(51);
    expect(CITY_DECOR_ROW).toBe(57);
    expect(ATLAS_ROWS).toBe(104); // + overworld rows 58..78, tunnel portals 79, forest / mountain variants 80..103 appended below
    expect(atlas.height).toBe(ATLAS_ROWS * T);
    expect(TERRAINS.slice(0, 6)).toEqual(["grass", "dirt", "paddy", "water", "stone", "sand"]);
  });

  it("covers all 47 blob masks + the spare for sidewalk, road and curb with distinct opaque tiles", () => {
    for (const set of ["sidewalk", "road", "curb"] as const) {
      const seen = new Set<string>();
      for (let i = 0; i < 48; i++) {
        const at = set === "curb" ? curbCoord(i) : blobCoord(set, i);
        expect(tileOpaque(at.col, at.row), `${set} #${i}`).toBe(true);
        seen.add(tileHash(at.col, at.row));
      }
      expect(seen.size, set).toBe(48);
    }
  });

  it("straight runs join seamlessly: the same band (asphalt / gutter / curb / paving / grass) on both sides of every seam", () => {
    const P = CITY_PALETTE;
    const groups: Array<[string, readonly (readonly number[])[]]> = [
      ["asphalt", [...P.asphalt, P.aggregate, P.tar]],
      ["paving", [...P.slab, P.joint, P.crack, P.stain]],
      ["curbTop", [P.curbTop]],
      ["curbFace", [P.curbFace]],
      ["shadow", [P.curbShadow]],
      ["gutter", [P.gutter]],
      ["edge", [P.edgeWorn]],
    ];
    const band = (col: number, row: number, x: number, y: number) => {
      const k = ((row * T + y) * atlas.width + col * T + x) * 4;
      const px = [atlas.data[k]!, atlas.data[k + 1]!, atlas.data[k + 2]!];
      for (const [name, cols] of groups) if (cols.some((c) => c[0] === px[0] && c[1] === px[1] && c[2] === px[2])) return name;
      return "grass";
    };
    const sets = [
      (i: number) => blobCoord("sidewalk", i),
      (i: number) => blobCoord("road", i),
      (i: number) => curbCoord(i),
    ];
    for (const at of sets) {
      const ew = at(blobIndex(E | W));
      const ns = at(blobIndex(N | S));
      for (let i = 0; i < T; i++) {
        expect(band(ew.col, ew.row, T - 1, i), `E/W seam row ${i}`).toBe(band(ew.col, ew.row, 0, i));
        expect(band(ns.col, ns.row, i, T - 1), `N/S seam col ${i}`).toBe(band(ns.col, ns.row, i, 0));
      }
      // a straight edge tile meets the full tile with the same band where both are interior
      const full = at(blobIndex(255));
      expect(["asphalt", "paving"]).toContain(band(full.col, full.row, 8, 8));
      expect(band(full.col, full.row, 8, 8)).toBe(band(full.col, full.row, 0, 8));
    }
  });

  it("a road next to a sidewalk picks the curb tiles; sidewalks run under the curb", () => {
    const doc = applyOps(createMap({ id: "c", width: 8, height: 8 }), [
      { op: "fill", layer: "ground", code: "sidewalk", x: 0, y: 0, w: 8, h: 8 },
      { op: "fill", layer: "ground", code: "road", x: 0, y: 3, w: 8, h: 2 },
      { op: "fill", layer: "ground", code: "road", x: 3, y: 0, w: 2, h: 8 },
    ]);
    const g = doc.layers.ground;
    const kerb = resolveGroundCell(g, 6, 3);
    expect(kerb.terrain).toBe("road");
    expect(kerb.atlas.row).toBeGreaterThanOrEqual(CURB_ROW);
    expect(kerb.mask & N).toBe(0);
    expect(kerb.mask & (E | W | S)).toBe(E | W | S);
    // the intersection cell is open only on its sidewalk diagonal → inner (rounded) curb corner
    const corner = resolveGroundCell(g, 3, 3);
    expect(corner.mask & (N | E | S | W)).toBe(N | E | S | W);
    expect(corner.mask).not.toBe(255);
    expect(corner.atlas.row).toBeGreaterThanOrEqual(CURB_ROW);
    // the sidewalk sees road as its own terrain (full paving up to the curb)
    expect(neighbourMask(g, 6, 2)).toBe(255);
    // a lone road in grass uses the plain road set
    const lone = applyOps(createMap({ id: "r", width: 5, height: 5 }), [{ op: "fill", layer: "ground", code: "road", x: 1, y: 2, w: 3, h: 1 }]);
    const cell = resolveGroundCell(lone.layers.ground, 2, 2);
    expect(cell.atlas.row).toBeGreaterThanOrEqual(terrainBaseRow("road"));
    expect(cell.atlas.row).toBeLessThan(CURB_ROW);
    expect(resolveGround(doc).flat().every((c) => c.atlas.row < ATLAS_ROWS)).toBe(true);
  });

  it("street decor has names, codes and atlas cells in the city decor row", () => {
    for (const name of ["lane_ew", "lane_ns", "crosswalk_ew", "crosswalk_ns", "manhole", "grate", "puddle", "leaves"] as const) {
      const code = (DECOR_NAMES as Record<string, string>)[name]!;
      expect(DECOR_CODES).toContain(code);
      const at = decorCoord(code)!;
      expect(at.row).toBe(CITY_DECOR_ROW);
      let opaque = 0;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (atlas.data[((at.row * T + y) * atlas.width + at.col * T + x) * 4 + 3]! > 0) opaque++;
      expect(opaque, name).toBeGreaterThan(8);
    }
    // the village decor codes keep their cells
    expect(decorCoord(DECOR_CODES[0]!)).toEqual({ col: 0, row: DECOR_ROW });
  });

  it("lane dashes and zebra bars repeat with a period that divides 16 (continuous across tiles)", () => {
    const lane = decorCoord("h")!;
    const alphaAt = (col: number, row: number, x: number, y: number) => atlas.data[((row * T + y) * atlas.width + col * T + x) * 4 + 3]!;
    // dash: 12 on, 4 off, centred → gap of 2 px at each tile edge
    expect(alphaAt(lane.col, lane.row, 0, 7)).toBe(0);
    expect(alphaAt(lane.col, lane.row, 8, 7)).toBe(255);
    const zebra = decorCoord("z")!;
    for (let y = 0; y < T; y++) expect(alphaAt(zebra.col, zebra.row, 8, y) > 0, `row ${y}`).toBe(y % 8 >= 2 && y % 8 < 6);
  });
});

describe("brick-town objects", () => {
  it("catalogs the buildings, trees and street furniture at their tile sizes", () => {
    for (const [kind, w, h] of [
      ["brick_rowhouse", 4, 5], ["brick_rowhouse_brown", 4, 5], ["brick_apartment", 6, 7], ["brick_garage", 3, 4],
      ["brick_shop_corner", 5, 5], ["brick_roof", 4, 4], ["street_tree_large", 4, 4], ["shrub", 1, 1],
      ["lamp_pole", 1, 3], ["utility_pole", 1, 4], ["postbox_red", 1, 2],
    ] as const) {
      const o = OBJECT_BY_KIND.get(kind);
      expect(o, kind).toBeDefined();
      expect([o!.w, o!.h]).toEqual([w, h]);
      const img = objectImage(kind);
      expect([img.width, img.height]).toEqual([w * 16, h * 16]);
      const s = o!.solid!;
      expect(s.x + s.w <= w && s.y + s.h <= h, kind).toBe(true);
    }
    // buildings are solid along their street-facing wall; the tree only at its trunk (canopy overhangs)
    expect(OBJECT_BY_KIND.get("brick_rowhouse")!.solid).toEqual({ x: 0, y: 2, w: 4, h: 3 });
    expect(OBJECT_BY_KIND.get("street_tree_large")!.solid).toEqual({ x: 1, y: 3, w: 2, h: 1 });
  });
});

describe("city_crossing sample", () => {
  it("the committed sample matches the generator and validates cleanly", async () => {
    const file = JSON.parse(await readFile(path.join(pkgRoot, "samples/maps/city_crossing.json"), "utf8"));
    const res = validateMap(file);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.doc).toEqual(validateMap(buildCityCrossing()).doc);
  });

  it("is a 4-way intersection with curbs, crossings, brick blocks and trees", () => {
    const doc = validateMap(buildCityCrossing()).doc!;
    const g = doc.layers.ground;
    expect(g[14]!.split("").every((ch) => ch === "a")).toBe(true);
    expect(g.every((row) => row[19] === "a")).toBe(true);
    const cells = resolveGround(doc);
    expect(cells.flat().some((c) => c.atlas.row >= CURB_ROW && c.atlas.row < CURB_ROW + 6)).toBe(true);
    const decor = doc.layers.decor.join("");
    for (const code of ["h", "j", "z", "x", "m", "q", "c", "y"]) expect(decor, code).toContain(code);
    const kinds = new Set(doc.objects.map((o) => o.kind));
    for (const k of ["brick_rowhouse", "brick_apartment", "brick_garage", "brick_shop_corner", "street_tree_large", "lamp_pole", "utility_pole", "postbox_red"]) expect(kinds.has(k), k).toBe(true);
    // a street tree's canopy overlaps the road while its trunk stands on the sidewalk
    const tree = doc.objects.find((o) => o.kind === "street_tree_large" && o.y === 14)!;
    expect(g[tree.y + 3]![tree.x + 1]).toBe("v");
    expect(g[tree.y]![tree.x + 1]).toBe("a");
  });

  it("exports to Godot with sidewalk / road terrains and curb peering bits", async () => {
    const tres = buildTileSetTres("res://t.png");
    expect(tres).toContain('terrain_6/name = "sidewalk"');
    expect(tres).toContain('terrain_7/name = "road"');
    // a curb tile open to the north peers sidewalk (6) on its top side
    const at = curbCoord(blobIndex(E | S | W | 8 | 32));
    const block = tres.split("\n").filter((l) => l.startsWith(`${at.col}:${at.row}/0/`)).join("\n");
    expect(block).toContain("terrain = 7");
    expect(block).toContain("terrains_peering_bit/top_side = 6");
    expect(block).toContain("terrains_peering_bit/bottom_side = 7");
    expect(tres).toContain(`0:${CITY_DECOR_ROW}/0 = 0`);
    const res = await exportMap(root, { id: "city_crossing", preset: "all" });
    expect(res.warnings).toEqual([]);
    const godot = res.dirs.find((d) => d.endsWith("-godot"))!;
    const scene = await readFile(path.join(godot, "city_crossing.tscn"), "utf8");
    for (const m of scene.matchAll(/path="res:\/\/([^"]+)"/g)) await readFile(path.join(godot, m[1]!));
    expect(scene).toMatch(/brick_apartment/);
    for (const f of res.files) await readFile(f);
  });
});
