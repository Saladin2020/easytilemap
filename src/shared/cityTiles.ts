/**
 * City street tiles for the sample atlas (CC0, procedural): sidewalk paving and asphalt road as blob-47
 * terrains, the curb set (road meeting sidewalk, with rounded curb corners) and the street decor
 * (lane dashes, zebra crossings, manhole, storm drain grate, puddle, fallen leaves).
 * Everything is drawn in local tile coordinates with period-16 textures, so neighbouring tiles join.
 */
import { E, N, NE, NW, S, SE, SW, W } from "./autotile.js";
import { c, noise, shade, type Rgba, type View } from "./pixel.js";
import { TILE_SIZE } from "./types.js";

const T = TILE_SIZE;

export const CITY_PALETTE = {
  slab: [c("#c9c4b8"), c("#bfbaae"), c("#d3cec2")],
  joint: c("#9e998e"),
  crack: c("#8c877c"),
  stain: c("#b3ad9f"),
  curbTop: c("#e4e0d6"),
  curbFace: c("#8a877f"),
  curbShadow: c("#2c2d33"),
  asphalt: [c("#3c3f46"), c("#43464e"), c("#363940")],
  aggregate: c("#575a62"),
  tar: c("#2e3036"),
  gutter: c("#33353b"),
  edgeWorn: c("#55585e"),
  wet: c("#141c26", 95),
  sheen: c("#5d6e82"),
  skyGlint: c("#9fb8cc"),
  paint: c("#ecebe2"),
  paintWorn: c("#c4c3ba"),
  lane: c("#e8d27a"),
  laneWorn: c("#bfae66"),
  iron: [c("#25272c"), c("#34373d"), c("#4a4e56")],
  puddle: [c("#4c6278"), c("#5a7590"), c("#7f9cb6")],
  leaf: [c("#c9772e"), c("#e2a23c"), c("#a4552a"), c("#8aa043")],
} as const;

type Ins = (x: number, y: number) => boolean;

/**
 * Inside-test for a blob tile with open-edge band `e`, outer corners rounded with radius `ro` and
 * inner corners cut as a quarter circle of radius `e` (so they meet the straight edges exactly).
 * Handles 1–3 px outside the tile like the village terrains.
 */
function blobInside(mask: number, e: number, ro: number): Ins {
  const f = (px: number, py: number): boolean => {
    if (px < 0) return Boolean(mask & W) && f(0, py);
    if (px > T - 1) return Boolean(mask & E) && f(T - 1, py);
    if (py < 0) return Boolean(mask & N) && f(px, 0);
    if (py > T - 1) return Boolean(mask & S) && f(px, T - 1);
    const n = mask & N, s = mask & S, w = mask & W, ea = mask & E;
    if (!n && py < e) return false;
    if (!s && py > T - 1 - e) return false;
    if (!w && px < e) return false;
    if (!ea && px > T - 1 - e) return false;
    const outer = (dx: number, dy: number) => {
      const cx = e + ro - 0.5;
      return dx < cx && dy < cx && Math.hypot(dx - cx, dy - cx) > ro;
    };
    if (!n && !w && outer(px, py)) return false;
    if (!n && !ea && outer(T - 1 - px, py)) return false;
    if (!s && !w && outer(px, T - 1 - py)) return false;
    if (!s && !ea && outer(T - 1 - px, T - 1 - py)) return false;
    const inner = (dx: number, dy: number) => Math.hypot(dx + 0.5, dy + 0.5) < e + 0.35;
    if (n && w && !(mask & NW) && inner(px, py)) return false;
    if (n && ea && !(mask & NE) && inner(T - 1 - px, py)) return false;
    if (s && w && !(mask & SW) && inner(px, T - 1 - py)) return false;
    if (s && ea && !(mask & SE) && inner(T - 1 - px, T - 1 - py)) return false;
    return true;
  };
  return f;
}

/** Distance (1..k) to the nearest pixel where `pred` is false, or k+1 when none within k (4-neighbour rings). */
function ring(pred: Ins, x: number, y: number, k: number): number {
  for (let d = 1; d <= k; d++) {
    if (!pred(x - d, y) || !pred(x + d, y) || !pred(x, y - d) || !pred(x, y + d)) return d;
    if (d > 1 && (!pred(x - d + 1, y - 1) || !pred(x + d - 1, y - 1) || !pred(x - d + 1, y + 1) || !pred(x + d - 1, y + 1))) return d;
  }
  return k + 1;
}

/** Concrete paving: 8 px square slabs with joints, a few cracks and stains (period 16). */
export function slabPx(x: number, y: number, alt = false): Rgba {
  const P = CITY_PALETTE;
  const lx = ((x % 16) + 16) % 16;
  const ly = ((y % 16) + 16) % 16;
  if (lx % 8 === 7 || ly % 8 === 7) return P.joint;
  const slab = (lx >> 3) + (ly >> 3) * 2;
  const n = noise(lx, ly, 801 + (alt ? 9 : 0));
  if (alt && slab === 1 && Math.abs(lx - 8 - (ly - 0) * 0.6 - 1) < 0.6) return P.crack;
  if (alt && slab === 2 && Math.hypot(lx - 3, ly - 11) < 2.4) return P.stain;
  if (noise(lx, ly, 809) < 0.03) return P.crack;
  // each slab a hair lighter at its top-left (the shared light)
  const lit = (lx % 8) + (ly % 8) < 3;
  return lit ? P.slab[2] : shade(n, [P.slab[0], P.slab[1]], [3, 2]);
}

/** Asphalt; `alt` adds a hairline tar-sealed crack (the spare variant). */
export function asphaltPx(x: number, y: number, alt = false): Rgba {
  const P = CITY_PALETTE;
  const lx = ((x % 16) + 16) % 16;
  const ly = ((y % 16) + 16) % 16;
  if (alt && Math.abs(ly - 4 - Math.round(Math.sin(lx * 0.9) * 1.2) - lx * 0.35) < 0.5 && lx > 2 && lx < 13) return P.tar;
  const g = noise(lx, ly, 833);
  if (g < 0.05) return P.aggregate;
  if (g > 0.95) return P.tar;
  return shade(noise(lx, ly, 821), P.asphalt, [4, 3, 2]);
}

/** Sidewalk over grass: paving with a light kerb rim and rounded outer corners. */
export function paintSidewalkTile(v: View, mask: number, alt: boolean, grass: (x: number, y: number) => Rgba, grassEdge: Rgba): void {
  const ins = blobInside(mask, 1, 3);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (!ins(x, y)) {
      const touches = ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1);
      v.set(x, y, touches ? grassEdge : grass(x, y));
      continue;
    }
    const d = ring(ins, x, y, 2);
    v.set(x, y, d === 1 ? CITY_PALETTE.curbTop : d === 2 ? CITY_PALETTE.curbFace : slabPx(x, y, alt));
  }
}

/**
 * Road tile. `curb`: open edges show sidewalk paving, a lit curb top and the curb's shadow on the road
 * (used next to sidewalk); otherwise open edges show grass with a worn asphalt edge.
 */
export function paintRoadTile(v: View, mask: number, alt: boolean, curb: boolean, grass: (x: number, y: number) => Rgba, grassEdge: Rgba): void {
  const P = CITY_PALETTE;
  const e = curb ? 4 : 2;
  const ins = blobInside(mask, e, curb ? 4 : 2);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (ins(x, y)) {
      const d = ring(ins, x, y, 2);
      if (curb) v.set(x, y, d === 1 ? P.curbShadow : d === 2 ? P.gutter : asphaltPx(x, y, alt));
      else v.set(x, y, d === 1 ? P.edgeWorn : asphaltPx(x, y, alt));
      continue;
    }
    if (!curb) {
      const touches = ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1);
      v.set(x, y, touches ? grassEdge : grass(x, y));
      continue;
    }
    // outside the road: distance to the road decides curb face / curb top / paving
    const out = (px: number, py: number) => !ins(px, py);
    const d = ring(out, x, y, 2);
    v.set(x, y, d === 1 ? P.curbFace : d === 2 ? P.curbTop : slabPx(x, y, false));
  }
}

/** City decor tiles (transparent background; drawn over road / sidewalk). */
export function paintCityDecor(v: View, code: string): void {
  const P = CITY_PALETTE;
  const worn = (x: number, y: number, base: Rgba, wornCol: Rgba) => (noise(x, y, 871) < 0.18 ? wornCol : base);
  switch (code) {
    case "h": // lane dashes along an east–west road (12 on, 4 off → period 16)
      for (let x = 2; x < 14; x++) for (const y of [7, 8]) v.set(x, y, worn(x, y, P.lane, P.laneWorn));
      break;
    case "j":
      for (let y = 2; y < 14; y++) for (const x of [7, 8]) v.set(x, y, worn(x, y, P.lane, P.laneWorn));
      break;
    case "z": // zebra on an east–west road: bars run with the traffic, stacked across the road (period 8)
      for (let y = 0; y < T; y++) if (y % 8 >= 2 && y % 8 < 6) for (let x = 2; x < 14; x++) v.set(x, y, worn(x, y, P.paint, P.paintWorn));
      break;
    case "x":
      for (let x = 0; x < T; x++) if (x % 8 >= 2 && x % 8 < 6) for (let y = 2; y < 14; y++) v.set(x, y, worn(x, y, P.paint, P.paintWorn));
      break;
    case "m": // round cast-iron manhole with a cross-hatch
      v.ellipse(8, 8, 5.5, 5.5, (x, y, dx, dy) => {
        const r = Math.hypot(dx, dy);
        if (r > 0.82) return P.iron[0];
        if (dx < -0.2 && dy < -0.2 && r > 0.6) return P.iron[2];
        return (x + y) % 3 === 0 ? P.iron[0] : P.iron[1];
      });
      v.set(6, 6, P.iron[2]);
      break;
    case "q": // storm drain grate at the gutter (north edge of the tile)
      v.rect(3, 1, 10, 5, P.iron[0]);
      for (let x = 4; x < 12; x += 2) v.vline(x, 2, 4, P.iron[2]);
      v.hline(3, 12, 1, P.iron[1]);
      break;
    case "c": // rain puddle reflecting the sky, in a darker wet patch
      v.ellipse(8, 8.5, 7.8, 5.6, P.wet);
      v.ellipse(5, 6, 3.5, 2.6, P.wet);
      v.ellipse(8, 9, 6, 3.6, (x, y, dx, dy) => (dy < -0.4 && dx < 0.3 ? P.puddle[2] : Math.hypot(dx, dy) > 0.8 ? P.puddle[0] : P.puddle[1]));
      v.ellipse(5, 6, 2.5, 1.6, P.puddle[1]);
      v.hline(6, 8, 7, P.skyGlint);
      break;
    case "y": // fallen leaves
      for (let i = 0; i < 9; i++) {
        const x = 1 + Math.floor(noise(i, 1, 881) * 13);
        const y = 1 + Math.floor(noise(i, 2, 881) * 13);
        const col = P.leaf[i % P.leaf.length]!;
        v.set(x, y, col);
        v.set(x + 1, y, col);
        if (i % 2) v.set(x, y + 1, P.leaf[2]);
      }
      break;
  }
}
