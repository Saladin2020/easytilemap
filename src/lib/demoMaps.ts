/**
 * The bundled demo map `thai_village_topdown`, built from edit ops so it stays readable and
 * reproducible (`npm run build:samples` writes samples/maps/thai_village_topdown.json).
 *
 * Spawn names match the `@camera` events of Easy Dialogue's village_delivery.ezd
 * (market, temple, farm, elder_house), and the cast uses the same ids (town_kid, town_vendor, …).
 */
import { cellHash } from "../shared/autotile.js";
import { applyOps, collisionGrid, createMap, type MapOp } from "../shared/map.js";
import type { MapDoc } from "../shared/types.js";

const sheet = (id: string) => `characters/${id}.png`;

export function buildThaiVillage(): MapDoc {
  const W = 40;
  const H = 28;
  const base = createMap({ id: "thai_village_topdown", name: "หมู่บ้านริมคลอง · Thai village (top-down)", width: W, height: H });
  const ops: MapOp[] = [
    // canal + paddies east of it
    { op: "fill", layer: "ground", code: "water", x: 27, y: 0, w: 3, h: H },
    { op: "fill", layer: "ground", code: "paddy", x: 32, y: 1, w: 7, h: 8 },
    { op: "fill", layer: "ground", code: "paddy", x: 32, y: 12, w: 7, h: 7 },
    { op: "fill", layer: "ground", code: "paddy", x: 32, y: 21, w: 7, h: 6 },
    // paths: main east–west road, north–south lane, dike paths between the fields
    { op: "fill", layer: "ground", code: "dirt", x: 0, y: 13, w: 27, h: 2 },
    { op: "fill", layer: "ground", code: "dirt", x: 30, y: 13, w: 2, h: 2 },
    { op: "fill", layer: "ground", code: "dirt", x: 30, y: 9, w: 10, h: 3 },
    { op: "fill", layer: "ground", code: "dirt", x: 30, y: 19, w: 10, h: 2 },
    { op: "fill", layer: "ground", code: "dirt", x: 30, y: 11, w: 2, h: 8 },
    { op: "fill", layer: "ground", code: "dirt", x: 12, y: 0, w: 2, h: H },
    // temple compound (stone courtyard) + its approach
    { op: "fill", layer: "ground", code: "stone", x: 2, y: 1, w: 9, h: 10 },
    { op: "fill", layer: "ground", code: "dirt", x: 11, y: 9, w: 1, h: 2 },
    // yards in front of the houses
    { op: "fill", layer: "ground", code: "dirt", x: 3, y: 22, w: 3, h: 2 },
    { op: "fill", layer: "ground", code: "dirt", x: 17, y: 24, w: 3, h: 2 },
    { op: "line", layer: "ground", code: "dirt", from: [18, 15], to: [18, 18] },
    { op: "line", layer: "ground", code: "dirt", from: [4, 15], to: [4, 16] },
    // buildings
    { op: "place", kind: "temple", x: 3, y: 1, name: "Temple" },
    { op: "place", kind: "sala", x: 8, y: 6, name: "Sala" },
    { op: "place", kind: "spirit_house", x: 2, y: 8 },
    { op: "place", kind: "market_stall", x: 15, y: 10, name: "StallMango" },
    { op: "place", kind: "market_stall", x: 19, y: 10, name: "StallVeg" },
    { op: "place", kind: "market_stall", x: 23, y: 10, name: "StallSweets" },
    { op: "place", kind: "house_wood", x: 1, y: 17, name: "HouseTon" },
    { op: "place", kind: "house_small", x: 8, y: 18, name: "HouseMee" },
    { op: "place", kind: "house_wood", x: 16, y: 19, name: "HouseElder" },
    { op: "place", kind: "house_small", x: 22, y: 20 },
    // bridges, boat
    { op: "place", kind: "bridge_h", x: 27, y: 13 },
    { op: "place", kind: "bridge_h", x: 27, y: 14 },
    { op: "place", kind: "bridge_h", x: 27, y: 9 },
    { op: "place", kind: "boat", x: 27, y: 21 },
    // nature
    ...([
      [15, 1], [20, 2], [24, 4], [17, 6], [22, 15], [7, 25], [24, 25], [0, 10], [14, 22],
    ] as const).map(([x, y]) => ({ op: "place" as const, kind: "tree_mango", x, y })),
    ...([
      [25, 0], [25, 7], [25, 16], [25, 23], [30, 0], [30, 23],
    ] as const).map(([x, y]) => ({ op: "place" as const, kind: "palm", x, y })),
    ...([
      [6, 17], [11, 21], [20, 21], [1, 24], [26, 19], [15, 16],
    ] as const).map(([x, y]) => ({ op: "place" as const, kind: "banana", x, y })),
    ...([[0, 1], [0, 3], [0, 5], [11, 2], [11, 4]] as const).map(([x, y]) => ({ op: "place" as const, kind: "bamboo", x, y })),
    { op: "place", kind: "haystack", x: 36, y: 9 },
    { op: "place", kind: "haystack", x: 30, y: 25 },
    { op: "place", kind: "water_jar", x: 6, y: 21 },
    { op: "place", kind: "water_jar", x: 21, y: 23 },
    { op: "place", kind: "water_jar", x: 12 - 1, y: 20 },
    { op: "place", kind: "lantern_post", x: 14, y: 11 },
    { op: "place", kind: "lantern_post", x: 26, y: 11 },
    { op: "place", kind: "lantern_post", x: 11, y: 11 },
    // decor
    { op: "line", layer: "decor", code: "fence", from: [6, 23], to: [7, 23] },
    { op: "line", layer: "decor", code: "fence", from: [20, 26], to: [22, 26] },
    { op: "paint", layer: "decor", code: "lotus", cells: [[28, 2], [27, 5], [29, 17], [28, 25], [27, 26], [29, 7]] },
    { op: "paint", layer: "decor", code: "stump", cells: [[9, 15], [37, 26]] },
    // spawn points (names = Easy Dialogue @camera targets)
    { op: "spawn", name: "player", x: 13, y: 15, facing: "front" },
    { op: "spawn", name: "market", x: 17, y: 13, facing: "back" },
    { op: "spawn", name: "temple", x: 6, y: 9, facing: "back" },
    { op: "spawn", name: "farm", x: 34, y: 10, facing: "right" },
    { op: "spawn", name: "elder_house", x: 18, y: 25, facing: "back" },
    // cast (Easy Sprite top-down sheets)
    { op: "character", sheet: sheet("town_kid"), name: "ton", x: 13, y: 15, facing: "front" },
    { op: "character", sheet: sheet("town_vendor"), name: "pa_daeng", x: 16, y: 13, facing: "front" },
    { op: "character", sheet: sheet("town_monk"), name: "luang_phi", x: 5, y: 10, facing: "right", anim: "walk", patrol: { path: [[3, 10], [9, 10]], speed: 16 } },
    { op: "character", sheet: sheet("town_farmer"), name: "lung_mee", x: 35, y: 5, facing: "front" },
    { op: "character", sheet: sheet("town_student"), name: "phi_fon", x: 21, y: 14, facing: "left", anim: "walk", patrol: { path: [[24, 14], [15, 14], [15, 15], [24, 15]], speed: 22 } },
    { op: "character", sheet: sheet("town_elder"), name: "ta_poem", x: 19, y: 24, facing: "front" },
  ];
  let doc = applyOps(base, ops);
  // scatter flowers / tufts / rocks on open grass, reeds on canal banks, pebbles on paths
  const blocked = collisionGrid(doc);
  const extra: Array<[number, number, string]> = [];
  const g = doc.layers.ground;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (doc.layers.decor[y]![x] !== "." || blocked[y]![x]) continue;
      const t = g[y]![x];
      const r = cellHash(x, y, 99);
      const nearWater = [[1, 0], [-1, 0]].some(([dx]) => g[y]![x + dx!] === "w");
      if (t === "g" && nearWater && r < 0.5) extra.push([x, y, "n"]);
      else if (t === "g" && r < 0.06) extra.push([x, y, "f"]);
      else if (t === "g" && r < 0.11) extra.push([x, y, "t"]);
      else if (t === "g" && r < 0.125) extra.push([x, y, "r"]);
      else if (t === "d" && r < 0.07) extra.push([x, y, "e"]);
    }
  }
  const occupied = new Set(doc.characters.map((c) => `${Math.floor(c.x)},${Math.floor(c.y)}`).concat(doc.spawns.map((s) => `${s.x},${s.y}`)));
  doc = applyOps(doc, [{ op: "paint", layer: "decor", code: "f", cells: [] }]);
  for (const [x, y, code] of extra) {
    if (occupied.has(`${x},${y}`)) continue;
    doc = applyOps(doc, [{ op: "paint", layer: "decor", code, cells: [[x, y]] }]);
  }
  return doc;
}

export const DEMO_MAPS: Record<string, () => MapDoc> = {
  thai_village_topdown: buildThaiVillage,
};
