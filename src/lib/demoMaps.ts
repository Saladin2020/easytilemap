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

/**
 * `city_crossing`: a brick-town 4-way intersection. Asphalt roads (lane dashes, zebra crossings, a
 * manhole, drain grates, puddles) meet at the centre, framed by 2-tile sidewalks with rounded curb
 * corners; brick rowhouses, an apartment with a fire escape, a garage and a corner shop line the
 * blocks, big street trees overhang the road, and the south-west block is a small green.
 */
export function buildCityCrossing(): MapDoc {
  const W = 40;
  const H = 30;
  const base = createMap({ id: "city_crossing", name: "สี่แยกเมืองอิฐ · Brick-town crossing (top-down)", width: W, height: H });
  const RX = 18; // north–south road: columns 18..20, lane on 19
  const RY = 13; // east–west road: rows 13..15, lane on 14
  const place = (kind: string, x: number, y: number, name?: string): MapOp => ({ op: "place", kind, x, y, ...(name ? { name } : {}) });
  const cells = (list: ReadonlyArray<readonly [number, number]>) => list.map(([x, y]) => [x, y] as [number, number]);
  const laneEW: Array<[number, number]> = [];
  for (let x = 0; x < W; x++) if (x < RX - 3 || x > RX + 5) laneEW.push([x, RY + 1]);
  const laneNS: Array<[number, number]> = [];
  for (let y = 0; y < H; y++) if (y < RY - 3 || y > RY + 5) laneNS.push([RX + 1, y]);
  const ops: MapOp[] = [
    // pavement everywhere, then the roads and the green
    { op: "fill", layer: "ground", code: "sidewalk", x: 0, y: 0, w: W, h: H },
    { op: "fill", layer: "ground", code: "road", x: 0, y: RY, w: W, h: 3 },
    { op: "fill", layer: "ground", code: "road", x: RX, y: 0, w: 3, h: H },
    { op: "fill", layer: "ground", code: "grass", x: 0, y: 19, w: 16, h: 11 },
    // road markings: lane dashes stop short of the zebra crossings
    { op: "paint", layer: "decor", code: "lane_ew", cells: laneEW },
    { op: "paint", layer: "decor", code: "lane_ns", cells: laneNS },
    { op: "fill", layer: "decor", code: "crosswalk_ew", x: RX - 2, y: RY, w: 2, h: 3 },
    { op: "fill", layer: "decor", code: "crosswalk_ew", x: RX + 3, y: RY, w: 2, h: 3 },
    { op: "fill", layer: "decor", code: "crosswalk_ns", x: RX, y: RY - 2, w: 3, h: 2 },
    { op: "fill", layer: "decor", code: "crosswalk_ns", x: RX, y: RY + 3, w: 3, h: 2 },
    { op: "paint", layer: "decor", code: "manhole", cells: cells([[8, RY], [RX + 2, 22], [31, RY + 2]]) },
    { op: "paint", layer: "decor", code: "grate", cells: cells([[4, RY], [27, RY], [RX, 6], [RX + 2, 25]]) },
    { op: "paint", layer: "decor", code: "puddle", cells: cells([[12, RY + 2], [26, RY], [RX, 21], [36, RY + 2]]) },
    // north-west block: rowhouses + apartment facing the main road, flat roofs behind
    place("brick_roof", 0, 2),
    place("brick_roof", 4, 2),
    place("brick_roof", 8, 0),
    place("brick_rowhouse", 0, 6, "Rowhouse1"),
    place("brick_rowhouse_brown", 4, 6, "Rowhouse2"),
    place("brick_apartment", 8, 4, "Apartment"),
    // north-east block: corner shop on the crossing, rowhouses, a garage
    place("brick_roof", 23, 2),
    place("brick_roof", 28, 2),
    place("brick_roof", 35, 2),
    place("brick_shop_corner", 23, 6, "CornerShop"),
    place("brick_rowhouse", 28, 6, "Rowhouse3"),
    place("brick_garage", 32, 7, "Garage"),
    place("brick_rowhouse_brown", 35, 6, "Rowhouse4"),
    // south-east block: roofs at the back, fronts on the south street
    place("brick_roof", 23, 19),
    place("brick_roof", 31, 19),
    place("brick_rowhouse_brown", 23, 23, "Rowhouse5"),
    place("brick_rowhouse", 27, 23, "Rowhouse6"),
    place("brick_apartment", 31, 21, "Apartment2"),
    place("brick_garage", 37, 24),
    // street trees: trunks on the south kerb, canopies over the road
    place("street_tree_large", 1, 14),
    place("street_tree_large", 8, 14),
    place("street_tree_large", 24, 14),
    place("street_tree_large", 33, 14),
    place("street_tree_large", 21, 26),
    place("street_tree_large", 6, 22),
    place("street_tree_large", 11, 25),
    // poles, lamps, postbox, shrubs
    place("lamp_pole", 14, 10),
    place("lamp_pole", 22, 10),
    place("lamp_pole", 14, 14),
    place("lamp_pole", 26, 26),
    place("utility_pole", 6, 9),
    place("utility_pole", 30, 13),
    place("postbox_red", 21, 11),
    ...cells([[0, 19], [2, 19], [13, 19], [15, 19], [0, 27], [15, 27], [23, 18], [25, 18], [37, 18], [39, 18], [14, 4], [15, 4]]).map(([x, y]) => place("shrub", x, y)),
    // leaves under the trees
    { op: "paint", layer: "decor", code: "leaves", cells: cells([[2, 16], [5, 17], [9, 16], [11, 17], [25, 16], [28, 17], [34, 16], [37, 17], [3, RY + 2], [26, RY + 2], [21, 28]]) },
    // spawn points
    { op: "spawn", name: "player", x: 17, y: 12, facing: "front" },
    { op: "spawn", name: "shop", x: 25, y: 11, facing: "back" },
    { op: "spawn", name: "apartment", x: 10, y: 11, facing: "back" },
    { op: "spawn", name: "park", x: 8, y: 23, facing: "front" },
    { op: "spawn", name: "south_street", x: 27, y: 28, facing: "back" },
    // cast
    { op: "character", sheet: sheet("town_student"), name: "phi_fon", x: 17, y: 12, facing: "front" },
    { op: "character", sheet: sheet("town_vendor"), name: "pa_daeng", x: 25, y: 11, facing: "front" },
    { op: "character", sheet: sheet("town_kid"), name: "ton", x: 3, y: 11, facing: "right", anim: "walk", patrol: { path: [[1, 11], [13, 11]], speed: 22 } },
    { op: "character", sheet: sheet("town_elder"), name: "ta_poem", x: 8, y: 24, facing: "front" },
    { op: "character", sheet: sheet("town_hijab_teacher"), name: "kak_fatimah", x: 36, y: 17, facing: "left", anim: "walk", patrol: { path: [[38, 17], [23, 17]], speed: 18 } },
  ];
  return scatterDecor(applyOps(base, ops));
}

export const DEMO_MAPS: Record<string, () => MapDoc> = {
  thai_village_topdown: buildThaiVillage,
  multicultural_village: buildMulticulturalVillage,
  city_crossing: buildCityCrossing,
};
