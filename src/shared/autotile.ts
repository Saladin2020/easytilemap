/**
 * Blob-47 autotiling ("match corners and sides") for terrains painted over grass, plus the atlas layout.
 * Pure functions shared by the renderer, the exporters, the tests and the web editor.
 *
 * Neighbour bits: N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128. A diagonal bit only counts when both
 * sides next to it are set, which leaves exactly 47 distinct masks.
 */
import { CODE_TERRAIN, DECOR_CODES, TERRAINS, type MapDoc, type Terrain } from "./types.js";

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
 * - rows 1–6 dirt, 7–12 paddy, 13–18 water, 19–24 stone: 47 blob tiles each (index → col i%8,
 *   row base + ⌊i/8⌋) and slot 47 = a second full-centre variant
 * - row 25: decor tiles in DECOR_CODES order
 * - row 26: col 0 collision marker (editor/debug), col 1 spawn marker
 */
export const ATLAS_COLUMNS = 8;
export const BLOB_ROWS = 6;
export const OVERLAY_TERRAINS = TERRAINS.filter((t) => t !== "grass") as Exclude<Terrain, "grass">[];
export const DECOR_ROW = 1 + OVERLAY_TERRAINS.length * BLOB_ROWS;
export const MARKER_ROW = DECOR_ROW + 1;
export const ATLAS_ROWS = MARKER_ROW + 1;
export const GRASS_VARIANTS = 8;

export interface AtlasCoord {
  col: number;
  row: number;
}

export function terrainBaseRow(t: Exclude<Terrain, "grass">): number {
  return 1 + OVERLAY_TERRAINS.indexOf(t) * BLOB_ROWS;
}

export function blobCoord(t: Exclude<Terrain, "grass">, index: number): AtlasCoord {
  return { col: index % ATLAS_COLUMNS, row: terrainBaseRow(t) + Math.floor(index / ATLAS_COLUMNS) };
}

export function decorCoord(code: string): AtlasCoord | null {
  const i = (DECOR_CODES as readonly string[]).indexOf(code);
  return i < 0 ? null : { col: i, row: DECOR_ROW };
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
  const t = terrainAt(ground, x, y);
  let m = 0;
  const same = (dx: number, dy: number) => terrainAt(ground, x + dx, y + dy) === t;
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

/** Atlas tile for one ground cell. */
export function resolveGroundCell(ground: readonly string[], x: number, y: number): ResolvedCell {
  const terrain = terrainAt(ground, x, y);
  if (terrain === "grass") return { terrain, mask: 255, atlas: { col: grassVariant(x, y), row: 0 } };
  const mask = neighbourMask(ground, x, y);
  let index = blobIndex(mask);
  // Full centre tiles alternate with the spare variant in slot 47 for a less repetitive look.
  if (mask === 255 && cellHash(x, y, 3) < 0.35) index = 47;
  return { terrain, mask, atlas: blobCoord(terrain, index) };
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
