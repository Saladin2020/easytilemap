/**
 * Blob-47 autotiling ("match corners and sides") for terrains painted over grass, plus the atlas layout.
 * Pure functions shared by the renderer, the exporters, the tests and the web editor.
 *
 * Neighbour bits: N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128. A diagonal bit only counts when both
 * sides next to it are set, which leaves exactly 47 distinct masks.
 */
import { CODE_TERRAIN, DECOR_CODES, LINE_TERRAINS, TERRAINS, type LineTerrain, type MapDoc, type Terrain } from "./types.js";

export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/** Drop diagonal bits whose two neighbouring sides are not both set. */
export function normalizeMask(m: number): number {
  let out = m & (N | E | S | W);
  if (m & NE && m & N && m & E) out |= NE;
  if (m & SE && m & S && m & E) out |= SE;
  if (m & SW && m & S && m & W) out |= SW;
  if (m & NW && m & N && m & W) out |= NW;
  return out;
}

/** The 47 normalized masks in ascending order; position = blob index. */
export const BLOB_MASKS: readonly number[] = (() => {
  const set = new Set<number>();
  for (let m = 0; m < 256; m++) set.add(normalizeMask(m));
  return [...set].sort((a, b) => a - b);
})();
const BLOB_INDEX = new Map(BLOB_MASKS.map((m, i) => [m, i]));

export function blobIndex(mask: number): number {
  return BLOB_INDEX.get(normalizeMask(mask))!;
}

// ---------------------------------------------------------------- atlas layout

/**
 * Atlas (8 columns of 16px tiles):
 * - row 0: grass variants 0–7
 * - rows 1–6 dirt, 7–12 paddy, 13–18 water, 19–24 stone, 25–30 sand: 47 blob tiles each
 *   (index → col i%8, row base + ⌊i/8⌋) and slot 47 = a second full-centre variant
 * - rows 31–36 shore: water blob tiles whose open edges show beach sand instead of grass, used for
 *   water cells next to sand (so a beach meets the sea without a grass seam)
 * - row 37: decor tiles 0–7 (village) in DECOR_CODES order
 * - row 38: col 0 collision marker (editor/debug), col 1 spawn marker
 * - rows 39–44 sidewalk, 45–50 road: blob tiles over grass (city set, appended so older rows never move)
 * - rows 51–56 curb: road blob tiles whose open edges show sidewalk paving and a curb, used for road
 *   cells next to sidewalk (rounded curb corners at intersections)
 * - row 57: decor tiles 8–15 (city street) in DECOR_CODES order
 * - rows 58–63 forest, 64–69 mountain, 70–75 farm field: blob tiles over grass (overworld set)
 * - rows 76–77 rail: 16 tiles, index = N=1 · E=2 · S=4 · W=8 mask of rail neighbours (straights,
 *   curves, T junctions, the 4-way junction and buffer-stop ends)
 * - row 78: level crossing (rail E–W, rail N–S), rail bridge (E–W, N–S), road bridge (E–W, N–S),
 *   station platform (E–W, N–S)
 * - row 79: rail tunnel portals, cols 0–3 = the mouth opens to the N, E, S, W (the track runs in from
 *   that side; the rest of the tile is mountain)
 * - rows 80–91 forest, 92–103 mountain: two more full blob-47 sets each (variant 1, variant 2), picked in
 *   large patches by value noise so forests and ranges do not repeat one tile (rows only ever get appended)
 */
export const ATLAS_COLUMNS = 8;
export const BLOB_ROWS = 6;
/** Blob-47 terrains (everything except grass and the line terrains). */
export type BlobTerrain = Exclude<Terrain, "grass" | LineTerrain>;
export const OVERLAY_TERRAINS = TERRAINS.filter((t) => t !== "grass" && !(LINE_TERRAINS as readonly string[]).includes(t)) as BlobTerrain[];
/** Terrains of the original village atlas, laid out first. */
const VILLAGE_OVERLAYS = ["dirt", "paddy", "water", "stone", "sand"] as const;
export const SHORE_ROW = 1 + VILLAGE_OVERLAYS.length * BLOB_ROWS;
export const DECOR_ROW = SHORE_ROW + BLOB_ROWS;
export const MARKER_ROW = DECOR_ROW + 1;
export const CITY_ROW = MARKER_ROW + 1;
export const CURB_ROW = CITY_ROW + 2 * BLOB_ROWS;
export const CITY_DECOR_ROW = CURB_ROW + BLOB_ROWS;
export const OVERWORLD_ROW = CITY_DECOR_ROW + 1;
export const RAIL_ROW = OVERWORLD_ROW + 3 * BLOB_ROWS;
export const LINE_EXTRA_ROW = RAIL_ROW + 2;
export const TUNNEL_ROW = LINE_EXTRA_ROW + 1;
/** Extra blob-47 sets (variants 1 and 2) for terrains that cover large areas. */
export const VARIANT_TERRAINS = ["forest", "mountain"] as const;
export type VariantTerrain = (typeof VARIANT_TERRAINS)[number];
export const TERRAIN_VARIANTS = 3;
export const VARIANT_ROW = TUNNEL_ROW + 1;
export const ATLAS_ROWS = VARIANT_ROW + VARIANT_TERRAINS.length * (TERRAIN_VARIANTS - 1) * BLOB_ROWS;
export const GRASS_VARIANTS = 8;

export interface AtlasCoord {
  col: number;
  row: number;
}

const BASE_ROW: Record<BlobTerrain, number> = {
  dirt: 1, paddy: 1 + BLOB_ROWS, water: 1 + 2 * BLOB_ROWS, stone: 1 + 3 * BLOB_ROWS, sand: 1 + 4 * BLOB_ROWS,
  sidewalk: CITY_ROW, road: CITY_ROW + BLOB_ROWS,
  forest: OVERWORLD_ROW, mountain: OVERWORLD_ROW + BLOB_ROWS, field: OVERWORLD_ROW + 2 * BLOB_ROWS,
};

export function terrainBaseRow(t: BlobTerrain): number {
  return BASE_ROW[t];
}

export function isLineTerrain(t: Terrain): t is LineTerrain {
  return (LINE_TERRAINS as readonly string[]).includes(t);
}

/** 4-side masks for line terrains. */
export const L_N = 1;
export const L_E = 2;
export const L_S = 4;
export const L_W = 8;

/** Rail tile for a 4-bit mask of rail neighbours (0–15). */
export function railCoord(mask4: number): AtlasCoord {
  return { col: mask4 % ATLAS_COLUMNS, row: RAIL_ROW + Math.floor(mask4 / ATLAS_COLUMNS) };
}

/** Crossing / bridge / station tile; `ew` = the track or deck runs east–west. */
export function lineExtraCoord(t: Exclude<LineTerrain, "rail" | "tunnel">, ew: boolean): AtlasCoord {
  const base = { crossing: 0, rail_bridge: 2, road_bridge: 4, station: 6 }[t];
  return { col: base + (ew ? 0 : 1), row: LINE_EXTRA_ROW };
}

/** Blob tile; `variant` 1–2 picks one of the extra sets of a VARIANT_TERRAINS terrain (0 = the base set). */
export function blobCoord(t: BlobTerrain, index: number, variant = 0): AtlasCoord {
  const vi = (VARIANT_TERRAINS as readonly string[]).indexOf(t);
  const base = variant > 0 && vi >= 0 ? VARIANT_ROW + (vi * (TERRAIN_VARIANTS - 1) + variant - 1) * BLOB_ROWS : terrainBaseRow(t);
  return { col: index % ATLAS_COLUMNS, row: base + Math.floor(index / ATLAS_COLUMNS) };
}

/** Tunnel portal whose mouth opens toward `side` (L_N / L_E / L_S / L_W). */
export function tunnelCoord(side: number): AtlasCoord {
  return { col: [L_N, L_E, L_S, L_W].indexOf(side), row: TUNNEL_ROW };
}

/** Smooth value noise in [0, 1) on a `scale`-cell lattice (deterministic). */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const sx = fx - x0;
  const sy = fy - y0;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);
  const h = (a: number, b: number) => cellHash(a, b, seed);
  const top = h(x0, y0) * (1 - u) + h(x0 + 1, y0) * u;
  const bot = h(x0, y0 + 1) * (1 - u) + h(x0 + 1, y0 + 1) * u;
  return top * (1 - v) + bot * v;
}

/**
 * Which blob set (0–2) a forest / mountain cell uses. Each cell rolls its own dice (so no grid of
 * identical tiles shows), weighted by large-scale value noise (so the mix drifts across the map):
 * forest = broadleaf (0), conifer stands (1, more in the "highland" patches), glades (2, in the
 * lowland patches); mountains = plain range (0), snowy summits (1, only in the high patches), low rocky
 * knolls with pines (2, toward the foothills).
 */
export function terrainVariant(t: VariantTerrain, x: number, y: number): number {
  const seed = t === "forest" ? 31 : 37;
  const n = valueNoise(x, y, 7, seed) * 0.75 + valueNoise(x, y, 3, seed + 1) * 0.25;
  const r = cellHash(x, y, seed + 5);
  const p1 = t === "forest" ? 0.06 + 0.4 * n : 0.04 + 0.5 * Math.max(0, n - 0.45);
  const p2 = t === "forest" ? 0.12 * (1 - n) : 0.28 * (1 - n);
  return r < p1 ? 1 : r < p1 + p2 ? 2 : 0;
}

/** Water-on-sand blob tile (same index rules as blobCoord). */
export function shoreCoord(index: number): AtlasCoord {
  return { col: index % ATLAS_COLUMNS, row: SHORE_ROW + Math.floor(index / ATLAS_COLUMNS) };
}

/** Road-on-sidewalk blob tile: open edges show a curb and paving (same index rules as blobCoord). */
export function curbCoord(index: number): AtlasCoord {
  return { col: index % ATLAS_COLUMNS, row: CURB_ROW + Math.floor(index / ATLAS_COLUMNS) };
}

export function decorCoord(code: string): AtlasCoord | null {
  const i = (DECOR_CODES as readonly string[]).indexOf(code);
  if (i < 0) return null;
  return i < ATLAS_COLUMNS ? { col: i, row: DECOR_ROW } : { col: i - ATLAS_COLUMNS, row: CITY_DECOR_ROW + Math.floor((i - ATLAS_COLUMNS) / ATLAS_COLUMNS) };
}

/** Deterministic per-cell hash in [0, 1). */
export function cellHash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Grass variant for a cell: mostly plain (0–3), a few with clover / tiny flowers (4–7). */
export function grassVariant(x: number, y: number): number {
  const r = cellHash(x, y, 7);
  if (r < 0.82) return Math.floor(cellHash(x, y, 11) * 4);
  return 4 + Math.floor(cellHash(x, y, 13) * 4);
}

function terrainAt(ground: readonly string[], x: number, y: number): Terrain {
  // Off-map counts as the same terrain as the nearest edge cell, so edges stay seamless.
  const yy = Math.max(0, Math.min(ground.length - 1, y));
  const row = ground[yy] ?? "";
  const xx = Math.max(0, Math.min(row.length - 1, x));
  return CODE_TERRAIN[row[xx] ?? "g"] ?? "grass";
}

/** 8-neighbour mask of cells with the same terrain as (x, y). */
export function neighbourMask(ground: readonly string[], x: number, y: number): number {
  // a tunnel reads as mountain from both sides (the range runs on over the track)
  const raw = terrainAt(ground, x, y);
  const t: Terrain = raw === "tunnel" ? "mountain" : raw;
  let m = 0;
  // Beach sand runs right up to the waterline: for a sand cell, water counts as "same".
  const same = (dx: number, dy: number) => {
    const rn = terrainAt(ground, x + dx, y + dy);
    const n: Terrain = rn === "tunnel" ? "mountain" : rn;
    // Sidewalk runs under the curb: for a sidewalk cell, road counts as "same" (the road tile draws the curb).
    // Overworld: a dirt road runs into level crossings and road bridges; water runs under bridges.
    return (
      n === t ||
      (t === "sand" && n === "water") ||
      (t === "sidewalk" && n === "road") ||
      (t === "dirt" && (n === "crossing" || n === "road_bridge")) ||
      ((t === "water" || t === "sand") && (n === "rail_bridge" || n === "road_bridge"))
    );
  };
  if (same(0, -1)) m |= N;
  if (same(1, -1)) m |= NE;
  if (same(1, 0)) m |= E;
  if (same(1, 1)) m |= SE;
  if (same(0, 1)) m |= S;
  if (same(-1, 1)) m |= SW;
  if (same(-1, 0)) m |= W;
  if (same(-1, -1)) m |= NW;
  return normalizeMask(m);
}

export interface ResolvedCell {
  terrain: Terrain;
  mask: number;
  atlas: AtlasCoord;
}

function touches(ground: readonly string[], x: number, y: number, t: Terrain): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && terrainAt(ground, x + dx, y + dy) === t) return true;
  return false;
}

const RAILISH = new Set<Terrain>(["rail", "crossing", "rail_bridge", "station", "tunnel"]);
const ROADISH = new Set<Terrain>(["dirt", "crossing", "road_bridge", "road", "sidewalk", "stone"]);

/** N=1 E=2 S=4 W=8 mask of neighbours in `set`. Off-map neighbours never connect. */
export function lineMask(ground: readonly string[], x: number, y: number, set: ReadonlySet<Terrain> = RAILISH): number {
  const at = (xx: number, yy: number) => (yy < 0 || yy >= ground.length || xx < 0 || xx >= (ground[yy]?.length ?? 0) ? null : CODE_TERRAIN[ground[yy]![xx]!] ?? null);
  let m = 0;
  const t = (xx: number, yy: number) => {
    const v = at(xx, yy);
    return v !== null && set.has(v);
  };
  if (t(x, y - 1)) m |= L_N;
  if (t(x + 1, y)) m |= L_E;
  if (t(x, y + 1)) m |= L_S;
  if (t(x - 1, y)) m |= L_W;
  return m;
}

/** Which way a crossing / bridge / station runs: true = east–west. */
export function lineAxisEW(ground: readonly string[], x: number, y: number, t: LineTerrain): boolean {
  const rail = lineMask(ground, x, y, RAILISH);
  const road = lineMask(ground, x, y, ROADISH);
  const water = lineMask(ground, x, y, new Set<Terrain>(["water", "rail_bridge", "road_bridge"]));
  const ew = (m: number) => Boolean(m & (L_E | L_W));
  const ns = (m: number) => Boolean(m & (L_N | L_S));
  if (t === "road_bridge") {
    if (ew(road) !== ns(road)) return ew(road);
    return ns(water) && !ew(water) ? true : !ns(water) && ew(water) ? false : true;
  }
  if (ew(rail) !== ns(rail)) return ew(rail);
  if (t === "crossing" && ew(road) !== ns(road)) return ns(road);
  return true;
}

/** Atlas tile for one ground cell. */
export function resolveGroundCell(ground: readonly string[], x: number, y: number): ResolvedCell {
  const terrain = terrainAt(ground, x, y);
  if (terrain === "grass") return { terrain, mask: 255, atlas: { col: grassVariant(x, y), row: 0 } };
  if (terrain === "rail") {
    const m = lineMask(ground, x, y);
    return { terrain, mask: m, atlas: railCoord(m) };
  }
  if (terrain === "tunnel") {
    // a portal where open track runs in; inside the range the tunnel is drawn as mountain
    const open = tunnelMouth(ground, x, y);
    if (open) return { terrain, mask: lineMask(ground, x, y), atlas: tunnelCoord(open) };
    const mask = neighbourMask(ground, x, y);
    let index = blobIndex(mask);
    if (mask === 255 && cellHash(x, y, 3) < 0.35) index = 47;
    return { terrain, mask, atlas: blobCoord("mountain", index, terrainVariant("mountain", x, y)) };
  }
  if (isLineTerrain(terrain)) return { terrain, mask: lineMask(ground, x, y), atlas: lineExtraCoord(terrain, lineAxisEW(ground, x, y, terrain)) };
  const mask = neighbourMask(ground, x, y);
  let index = blobIndex(mask);
  // Full centre tiles alternate with the spare variant in slot 47 for a less repetitive look.
  if (mask === 255 && cellHash(x, y, 3) < 0.35) index = 47;
  if (terrain === "forest" || terrain === "mountain") return { terrain, mask, atlas: blobCoord(terrain, index, terrainVariant(terrain, x, y)) };
  if (terrain === "water" && touches(ground, x, y, "sand")) return { terrain, mask, atlas: shoreCoord(index) };
  if (terrain === "road" && touches(ground, x, y, "sidewalk")) return { terrain, mask, atlas: curbCoord(index) };
  return { terrain, mask, atlas: blobCoord(terrain, index) };
}

/** Side (L_N / L_E / L_S / L_W) where open track meets a tunnel cell, or 0 inside the tunnel. */
export function tunnelMouth(ground: readonly string[], x: number, y: number): number {
  const open = new Set<Terrain>(["rail", "crossing", "rail_bridge", "station"]);
  const m = lineMask(ground, x, y, open);
  for (const b of [L_E, L_W, L_N, L_S]) if (m & b) return b;
  return 0;
}

/** Every ground cell resolved, row-major. */
export function resolveGround(doc: Pick<MapDoc, "width" | "height" | "layers">): ResolvedCell[][] {
  const out: ResolvedCell[][] = [];
  for (let y = 0; y < doc.height; y++) {
    const row: ResolvedCell[] = [];
    for (let x = 0; x < doc.width; x++) row.push(resolveGroundCell(doc.layers.ground, x, y));
    out.push(row);
  }
  return out;
}

/** Godot terrain peering bits for a blob mask: which neighbours carry the tile's terrain. */
export const PEERING_BITS: Array<[string, number]> = [
  ["top_side", N],
  ["top_right_corner", NE],
  ["right_side", E],
  ["bottom_right_corner", SE],
  ["bottom_side", S],
  ["bottom_left_corner", SW],
  ["left_side", W],
  ["top_left_corner", NW],
];
