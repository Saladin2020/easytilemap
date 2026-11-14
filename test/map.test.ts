import { describe, expect, it } from "vitest";
import { parseCharacterArg } from "../src/shared/characters.js";
import { applyOps, asciiMap, collisionGrid, collisionRects, createMap, validateMap } from "../src/shared/map.js";

describe("validateMap", () => {
  it("accepts a blank map and normalizes it", () => {
    const res = validateMap(createMap({ id: "blank", width: 10, height: 6 }));
    expect(res.errors).toEqual([]);
    expect(res.doc?.layers.ground).toHaveLength(6);
  });

  it("reports unknown codes with the cell, and object kinds with a suggestion", () => {
    const res = validateMap({ id: "bad", width: 3, height: 2, layers: { ground: ["gxg", "ggg"] }, objects: [{ kind: "templ", x: 0, y: 0 }], spawns: [{ name: "a", x: 1, y: 1 }, { name: "a", x: 2, y: 1 }] });
    expect(res.doc).toBeNull();
    const ground = res.errors.find((e) => e.path === "layers.ground[0]");
    expect(ground).toMatchObject({ x: 1, y: 0 });
    expect(res.errors.some((e) => /did you mean "temple"/.test(e.message))).toBe(true);
    expect(res.errors.some((e) => /duplicate spawn name "a"/.test(e.message))).toBe(true);
  });

  it("warns about spawns on blocked tiles and lotus off water", () => {
    let doc = createMap({ id: "w", width: 6, height: 4 });
    doc = applyOps(doc, [
      { op: "fill", layer: "ground", code: "w", x: 0, y: 0, w: 2, h: 2 },
      { op: "spawn", name: "wet", x: 0, y: 0 },
      { op: "paint", layer: "decor", code: "lotus", cells: [[5, 3]] },
    ]);
    const res = validateMap(doc);
    expect(res.errors).toEqual([]);
    expect(res.warnings.map((w) => w.message).join("\n")).toMatch(/Spawn "wet" is on a blocked tile[\s\S]*Lotus at 5,3/);
  });

  it("rejects a bad id and format", () => {
    const res = validateMap({ ...createMap({ id: "x" }), id: "Bad Id", format: "easyscene/1" });
    expect(res.errors.map((e) => e.path)).toEqual(expect.arrayContaining(["id", "format"]));
  });
});

describe("collision", () => {
  it("blocks water and solid footprints, opens bridges and painted o", () => {
    let doc = createMap({ id: "c", width: 10, height: 8 });
    doc = applyOps(doc, [
      { op: "fill", layer: "ground", code: "water", x: 4, y: 0, w: 3, h: 8 },
      { op: "place", kind: "bridge_h", x: 4, y: 3 },
      { op: "place", kind: "tree_mango", x: 0, y: 0 },
      { op: "paint", layer: "collision", code: "open", cells: [[5, 6]] },
      { op: "paint", layer: "collision", code: "block", cells: [[9, 7]] },
    ]);
    const g = collisionGrid(doc);
    expect(g[0]![4]).toBe(true);
    expect(g[3]![5]).toBe(false); // bridge
    expect(g[6]![5]).toBe(false); // painted open
    expect(g[7]![9]).toBe(true);
    expect(g[2]![0]).toBe(true); // tree trunk row (solid y=2)
    expect(g[0]![0]).toBe(false); // canopy is walk-behind
    const rects = collisionRects(g);
    const cells = rects.reduce((n, r) => n + r.w * r.h, 0);
    expect(cells).toBe(g.flat().filter(Boolean).length);
  });
});

describe("ops", () => {
  it("paints lines with width, places, spawns, resizes; ASCII shows them", () => {
    let doc = createMap({ id: "o", width: 8, height: 5 });
    doc = applyOps(doc, [
      { op: "line", layer: "ground", code: "dirt", from: [0, 2], to: [7, 2], width: 1 },
      { op: "place", kind: "water_jar", x: 1, y: 0 },
      { op: "spawn", name: "p", x: 6, y: 4 },
      { op: "character", sheet: "characters/town_kid.png", x: 3, y: 3, name: "kid" },
    ]);
    expect(doc.layers.ground[2]).toBe("dddddddd");
    const art = asciiMap(doc).split("\n");
    expect(art[0]![1]).toBe("O");
    expect(art[4]![6]).toBe("S");
    expect(art[3]![3]).toBe("@");
    const big = applyOps(doc, [{ op: "resize", width: 10, height: 6, fill: "paddy" }]);
    expect(big.layers.ground[5]).toBe("pppppppppp");
    expect(() => applyOps(doc, [{ op: "place", kind: "pagoda", x: 0, y: 0 }])).toThrow(/Unknown object kind/);
    expect(() => applyOps(doc, [{ op: "fill", layer: "ground", code: "lava", x: 0, y: 0, w: 1, h: 1 }])).toThrow(/Unknown ground code/);
  });

  it("parses --character path:x:y:facing:anim", () => {
    expect(parseCharacterArg("characters/kid.png:3.5:4:left:walk")).toEqual({ sheet: "characters/kid.png", x: 3.5, y: 4, facing: "left", anim: "walk" });
    expect(parseCharacterArg("C:\\sprites\\a.png:1:2")).toMatchObject({ sheet: "C:\\sprites\\a.png", x: 1, y: 2 });
    expect(() => parseCharacterArg("a.png:1:2:up")).toThrow(/facing/);
  });
});
