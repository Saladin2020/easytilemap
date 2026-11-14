import { describe, expect, it } from "vitest";
import { ATLAS_COLUMNS, ATLAS_ROWS, BLOB_MASKS, E, N, NE, S, W, blobIndex, normalizeMask, resolveGround, resolveGroundCell, terrainBaseRow } from "../src/shared/autotile.js";
import { generateAtlas } from "../src/shared/tileset.js";
import { createMap, applyOps } from "../src/shared/map.js";

describe("blob-47 autotile", () => {
  it("has exactly 47 normalized masks", () => {
    expect(BLOB_MASKS).toHaveLength(47);
    expect(BLOB_MASKS[0]).toBe(0);
    expect(BLOB_MASKS.at(-1)).toBe(255);
  });

  it("drops diagonals whose sides are not both set", () => {
    expect(normalizeMask(NE)).toBe(0);
    expect(normalizeMask(N | NE)).toBe(N);
    expect(normalizeMask(N | NE | E)).toBe(N | NE | E);
    expect(blobIndex(N | NE)).toBe(blobIndex(N));
  });

  it("resolves a water pond: centre full, edges open towards grass", () => {
    const doc = applyOps(createMap({ id: "t", width: 7, height: 7 }), [{ op: "fill", layer: "ground", code: "water", x: 1, y: 1, w: 5, h: 5 }]);
    const centre = resolveGroundCell(doc.layers.ground, 3, 3);
    expect(centre.terrain).toBe("water");
    expect(centre.mask).toBe(255);
    const top = resolveGroundCell(doc.layers.ground, 3, 1);
    expect(top.mask & N).toBe(0);
    expect(top.mask & (E | S | W)).toBe(E | S | W);
    const corner = resolveGroundCell(doc.layers.ground, 1, 1);
    expect(corner.mask).toBe(normalizeMask(E | S | 8 /* SE */));
    expect(corner.atlas.row).toBeGreaterThanOrEqual(terrainBaseRow("water"));
    const grass = resolveGroundCell(doc.layers.ground, 0, 0);
    expect(grass.terrain).toBe("grass");
    expect(grass.atlas.row).toBe(0);
  });

  it("treats the map edge as the same terrain (seamless borders)", () => {
    const doc = applyOps(createMap({ id: "t", width: 4, height: 4 }), [{ op: "fill", layer: "ground", code: "dirt", x: 0, y: 0, w: 4, h: 1 }]);
    const cell = resolveGroundCell(doc.layers.ground, 0, 0);
    expect(cell.mask & (N | W | E)).toBe(N | W | E);
    expect(cell.mask & S).toBe(0);
    expect(resolveGround(doc)).toHaveLength(4);
  });

  it("generates a deterministic 128×432 atlas", () => {
    const a = generateAtlas();
    expect(a.width).toBe(ATLAS_COLUMNS * 16);
    expect(a.height).toBe(ATLAS_ROWS * 16);
    // every terrain tile is fully opaque (no holes between grass and terrain)
    for (let i = 3; i < 16 * 16 * 4 * 8 * 25; i += 4) {
      if (a.data[i] !== 255) throw new Error(`transparent pixel at ${(i - 3) / 4}`);
    }
  });
});
