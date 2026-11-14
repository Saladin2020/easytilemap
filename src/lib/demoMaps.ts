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
  return scatterDecor(applyOps(base, ops));
}

/** Scatter flowers / tufts / rocks on open grass, reeds on water banks, pebbles on paths. */
function scatterDecor(input: MapDoc): MapDoc {
  let doc = input;
  const W = doc.width;
  const H = doc.height;
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

/**
 * `multicultural_village`: a southern Thai coastal town where a Buddhist temple, a Chinese-Thai shrine and
 * a wooden kampung mosque share one main road, with a Tadika school, Malay raised houses, a halal stall
 * and a beach where kolek boats are pulled up next to the fish racks.
 */
export function buildMulticulturalVillage(): MapDoc {
  const W = 44;
  const H = 30;
  const base = createMap({ id: "multicultural_village", name: "หมู่บ้านพหุวัฒนธรรม · Multicultural village (top-down)", width: W, height: H });
  const ops: MapOp[] = [
    // sea + beach along the south edge, a stream from the hills into the sea
    { op: "fill", layer: "ground", code: "water", x: 0, y: 26, w: W, h: 4 },
    { op: "fill", layer: "ground", code: "sand", x: 0, y: 23, w: W, h: 3 },
    { op: "fill", layer: "ground", code: "sand", x: 6, y: 22, w: 12, h: 1 },
    { op: "fill", layer: "ground", code: "water", x: 19, y: 16, w: 2, h: 7 },
    { op: "fill", layer: "ground", code: "water", x: 19, y: 23, w: 2, h: 3 },
    // roads: main street, lanes to the temple, the mosque and the beach
    { op: "fill", layer: "ground", code: "dirt", x: 0, y: 13, w: W, h: 2 },
    { op: "fill", layer: "ground", code: "dirt", x: 12, y: 0, w: 2, h: 13 },
    { op: "fill", layer: "ground", code: "dirt", x: 29, y: 9, w: 2, h: 4 },
    { op: "fill", layer: "ground", code: "dirt", x: 8, y: 15, w: 2, h: 7 },
    { op: "fill", layer: "ground", code: "dirt", x: 36, y: 15, w: 2, h: 8 },
    // courtyards: temple, shrine, mosque
    { op: "fill", layer: "ground", code: "stone", x: 1, y: 0, w: 10, h: 11 },
    { op: "fill", layer: "ground", code: "stone", x: 15, y: 5, w: 5, h: 6 },
    { op: "fill", layer: "ground", code: "stone", x: 24, y: 0, w: 11, h: 9 },
    { op: "fill", layer: "ground", code: "paddy", x: 37, y: 1, w: 6, h: 6 },
    // Buddhist temple
    { op: "place", kind: "temple", x: 3, y: 1, name: "Temple" },
    { op: "place", kind: "sala", x: 8, y: 6, name: "Sala" },
    { op: "place", kind: "spirit_house", x: 2, y: 8 },
    // Chinese-Thai shrine
    { op: "place", kind: "chinese_shrine", x: 16, y: 6, name: "Shrine" },
    // mosque + Tadika
    { op: "place", kind: "mosque", x: 26, y: 1, name: "Mosque" },
    { op: "place", kind: "tadika", x: 32, y: 8, name: "Tadika" },
    // market street: the stalls stand side by side
    { op: "place", kind: "market_stall", x: 15, y: 15, name: "StallFruit" },
    { op: "place", kind: "halal_stall", x: 22, y: 15, name: "StallHalal" },
    { op: "place", kind: "market_stall", x: 25, y: 15, name: "StallSweets" },
    { op: "place", kind: "halal_stall", x: 28, y: 15, name: "StallRoti" },
    // homes: Thai stilt houses and Malay kampung houses as neighbours
    { op: "place", kind: "house_wood", x: 1, y: 16, name: "HouseTon" },
    { op: "place", kind: "house_small", x: 11, y: 17, name: "HouseMee" },
    { op: "place", kind: "kampung_house", x: 30, y: 18, name: "HouseMakYah" },
    { op: "place", kind: "kampung_house", x: 39, y: 15, name: "HouseImam" },
    { op: "place", kind: "kampung_house", x: 22, y: 9 - 1, name: "HouseFatimah" },
    // stream bridges
    { op: "place", kind: "bridge_v", x: 19, y: 15 - 1 },
    { op: "place", kind: "bridge_v", x: 20, y: 15 - 1 },
    // beach: kolek boats, fish racks
    { op: "place", kind: "kolek", x: 3, y: 26, name: "KolekRed" },
    { op: "place", kind: "kolek", x: 25, y: 27 },
    { op: "place", kind: "kolek", x: 33, y: 26 },
    { op: "place", kind: "boat", x: 13, y: 27 },
    { op: "place", kind: "fish_rack", x: 23, y: 23 },
    { op: "place", kind: "fish_rack", x: 26, y: 23 },
    { op: "place", kind: "fish_rack", x: 40, y: 24 },
    // nature
    ...([
      [0, 21], [15, 22], [28, 22], [34, 22], [42, 21], [5, 22], [39, 10],
    ] as const).map(([x, y]) => ({ op: "place" as const, kind: "palm", x, y })),
    ...([[15, 0], [20, 1], [36, 9]] as const).map(([x, y]) => ({ op: "place" as const, kind: "tree_mango", x, y })),
    ...([[6, 17], [13, 21], [41, 19]] as const).map(([x, y]) => ({ op: "place" as const, kind: "banana", x, y })),
    ...([[0, 1], [0, 3], [0, 5], [11, 2], [11, 4]] as const).map(([x, y]) => ({ op: "place" as const, kind: "bamboo", x, y })),
    { op: "place", kind: "water_jar", x: 34, y: 22 - 1 },
    { op: "place", kind: "water_jar", x: 25, y: 7 },
    { op: "place", kind: "lantern_post", x: 14, y: 11 },
    { op: "place", kind: "lantern_post", x: 23, y: 11 },
    { op: "place", kind: "lantern_post", x: 33, y: 11 },
    // decor
    { op: "line", layer: "decor", code: "fence", from: [1, 21], to: [4, 21] },
    { op: "paint", layer: "decor", code: "stump", cells: [[42, 12], [7, 12]] },
    // spawn points: one per community + the beach
    { op: "spawn", name: "player", x: 21, y: 13, facing: "front" },
    { op: "spawn", name: "temple", x: 6, y: 9, facing: "back" },
    { op: "spawn", name: "shrine", x: 17, y: 10, facing: "back" },
    { op: "spawn", name: "mosque", x: 29, y: 9, facing: "back" },
    { op: "spawn", name: "tadika", x: 34, y: 12, facing: "back" },
    { op: "spawn", name: "market", x: 23, y: 14, facing: "back" },
    { op: "spawn", name: "beach", x: 24, y: 25, facing: "front" },
    // cast: Thai town cast + Muslim neighbours (Easy Sprite top-down sheets)
    { op: "character", sheet: sheet("town_kid"), name: "ton", x: 21, y: 13, facing: "front" },
    { op: "character", sheet: sheet("town_kopiah_boy"), name: "adam", x: 22, y: 13, facing: "left" },
    { op: "character", sheet: sheet("town_monk"), name: "luang_phi", x: 5, y: 10, facing: "right", anim: "walk", patrol: { path: [[3, 10], [9, 10]], speed: 16 } },
    { op: "character", sheet: sheet("town_pak_cik"), name: "pak_cik_ismail", x: 30, y: 9, facing: "front" },
    { op: "character", sheet: sheet("town_hijab_teacher"), name: "kak_fatimah", x: 35, y: 12, facing: "front" },
    { op: "character", sheet: sheet("town_tadika_girl"), name: "aisyah", x: 33, y: 13, facing: "right", anim: "walk", patrol: { path: [[31, 13], [37, 13]], speed: 18 } },
    { op: "character", sheet: sheet("town_roti_seller"), name: "bang_roti", x: 29, y: 18, facing: "front" },
    { op: "character", sheet: sheet("town_vendor"), name: "pa_daeng", x: 16, y: 18, facing: "front" },
    { op: "character", sheet: sheet("town_fisher"), name: "pak_hamid", x: 24, y: 24, facing: "front" },
    { op: "character", sheet: sheet("town_elder"), name: "ta_poem", x: 4, y: 21 + 1, facing: "right" },
  ];
  return scatterDecor(applyOps(base, ops));
}

export const DEMO_MAPS: Record<string, () => MapDoc> = {
  thai_village_topdown: buildThaiVillage,
  multicultural_village: buildMulticulturalVillage,
};
