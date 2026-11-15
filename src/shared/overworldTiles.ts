/**
 * Overworld (world map) tiles for the sample atlas (CC0, procedural): forest, mountains and farm
 * fields as blob-47 terrains over grass, and the line set: railway track (straights, curves,
 * junctions, buffer stops), level crossings, rail and road bridges over water and station platforms.
 * Textures repeat with a period that divides 16, so neighbouring tiles join.
 */
import { E, L_E, L_N, L_S, L_W, N, NE, NW, S, SE, SW, W } from "./autotile.js";
import { c, noise, shade, type Rgba, type View } from "./pixel.js";
import { TILE_SIZE } from "./types.js";

const T = TILE_SIZE;

export const OW_PALETTE = {
  canopy: [c("#24561f"), c("#2f6b27"), c("#3d8231"), c("#58a043"), c("#7cc05a")],
  canopyAlt: [c("#1d4a26"), c("#285d2f"), c("#36763a"), c("#4d914a"), c("#6fae5c")],
  forestFloor: c("#1a3a17"),
  treeShadow: c("#2c5a22"),
  rock: [c("#6f6151"), c("#857563"), c("#9c8b76"), c("#b8a68e")],
  rockDark: c("#4f4438"),
  foothill: [c("#6e7a3e"), c("#7d8746"), c("#5f6c36")],
  snow: [c("#e9eef2"), c("#c9d3dc")],
  soil: [c("#7a5534"), c("#8c6440"), c("#6a482b")],
  crop: [c("#7fb043"), c("#99c652"), c("#5d8f33")],
  ripe: [c("#d6b24a"), c("#e6c862"), c("#b8923a")],
  hedge: c("#3b6a2a"),
  hedgeHi: c("#5a8f3a"),
  ballast: [c("#8d8a84"), c("#a29f98"), c("#77746e")],
  tie: c("#6b4a2c"),
  tieHi: c("#8a6440"),
  rail: c("#d2d6dc"),
  railShadow: c("#4d5058"),
  plank: [c("#b8834c"), c("#a2703f"), c("#c99560")],
  plankDark: c("#6e4a2a"),
  beam: c("#4f3520"),
  concrete: [c("#c9c4b8"), c("#bdb8ac")],
  safety: c("#f0c43c"),
  red: c("#c8402e"),
  white: c("#f4f0e6"),
  ink: c("#2a1d13"),
} as const;

type GrassFn = (x: number, y: number) => Rgba;

/** Lattice of crown / peak centres (period 16, staggered rows). */
const CENTRES: Array<[number, number]> = [
  [-4, 0], [4, 0], [12, 0], [20, 0],
  [0, 8], [8, 8], [16, 8],
  [-4, 16], [4, 16], [12, 16], [20, 16],
  [0, -8], [8, -8], [16, -8], [0, 24], [8, 24], [16, 24],
];

/** A centre belongs to every tile it touches: it exists only when each of those tiles has the terrain. */
function centrePresent(mask: number, cx: number, cy: number): boolean {
  const needW = cx <= 0;
  const needE = cx >= 16;
  const needN = cy <= 0;
  const needS = cy >= 16;
  if (needW && !(mask & W)) return false;
  if (needE && !(mask & E)) return false;
  if (needN && !(mask & N)) return false;
  if (needS && !(mask & S)) return false;
  if (needW && needN && cx < 0 && !(mask & NW)) return false;
  if (needE && needN && cx > 16 && !(mask & NE)) return false;
  if (needW && needS && cx < 0 && !(mask & SW)) return false;
  if (needE && needS && cx > 16 && !(mask & SE)) return false;
  return true;
}

/**
 * Edge bump for variant sets: extra band depth along an open side, 0 near both tile corners so any
 * variant joins any other. 1 = the edge bulges out (a tree / spur pokes out), 2 = a small bay.
 */
function edgeBump(variant: number, along: number): number {
  if (variant === 1) return along >= 5 && along <= 10 ? -1 : 0;
  if (variant === 2) return along >= 4 && along <= 11 ? (along >= 6 && along <= 9 ? 2 : 1) : 0;
  return 0;
}

/** Inside test for the blob region (band `e` on open sides, rounded outer corners, notched inner corners). */
function region(mask: number, e0: number, variant = 0): (x: number, y: number) => boolean {
  const f = (px: number, py: number): boolean => {
    if (px < 0) return Boolean(mask & W) && f(0, py);
    if (px > T - 1) return Boolean(mask & E) && f(T - 1, py);
    if (py < 0) return Boolean(mask & N) && f(px, 0);
    if (py > T - 1) return Boolean(mask & S) && f(px, T - 1);
    const n = mask & N, s = mask & S, w = mask & W, ea = mask & E;
    const e = e0;
    if (!n && py < e + edgeBump(variant, px)) return false;
    if (!s && py > T - 1 - e - edgeBump(variant, T - 1 - px)) return false;
    if (!w && px < e + edgeBump(variant, T - 1 - py)) return false;
    if (!ea && px > T - 1 - e - edgeBump(variant, py)) return false;
    const r = e + 2;
    const cut = (dx: number, dy: number) => dx + dy < r + 1;
    if (!n && !w && cut(px, py)) return false;
    if (!n && !ea && cut(T - 1 - px, py)) return false;
    if (!s && !w && cut(px, T - 1 - py)) return false;
    if (!s && !ea && cut(T - 1 - px, T - 1 - py)) return false;
    const inner = (dx: number, dy: number) => dx < e && dy < e;
    if (n && w && !(mask & NW) && inner(px, py)) return false;
    if (n && ea && !(mask & NE) && inner(T - 1 - px, py)) return false;
    if (s && w && !(mask & SW) && inner(px, T - 1 - py)) return false;
    if (s && ea && !(mask & SE) && inner(T - 1 - px, T - 1 - py)) return false;
    return true;
  };
  return f;
}

// ---------------------------------------------------------------- forest

/**
 * Forest: round tree crowns on a staggered lattice; lower crowns overlap upper ones (¾ view).
 * The lattice is shared by every variant so tiles always join; variants only change what lies fully
 * inside the tile: variant 1 turns the middle crown into a dark conifer and pushes the open edges out
 * with a bush, variant 2 opens a small grass glade in the middle and bites a bay into open edges.
 */
export function paintForestTile(v: View, mask: number, alt: boolean, grass: GrassFn, variant = 0): void {
  const P = OW_PALETTE;
  const R = 5.3;
  const crowns = CENTRES.filter(([cx, cy]) => centrePresent(mask, cx, cy) && !(variant === 2 && cx === 8 && cy === 8)).sort((a, b) => a[1] - b[1]);
  const inside = region(mask, 3, variant);
  const conifer = (x: number, y: number): Rgba | null => {
    // tall dark conifer centred on (8, 8): lit west flank, shaded east flank
    if (variant !== 1) return null;
    const top = 1.5;
    const base = 13.5;
    const py = y + 0.5;
    if (py < top || py > base) return null;
    const t = (py - top) / (base - top);
    const halfW = 0.6 + t * 5;
    const dx = x + 0.5 - 8;
    if (Math.abs(dx) > halfW) return null;
    const tier = Math.floor(t * 3.2) !== Math.floor((t + 0.07) * 3.2);
    if (Math.abs(dx) > halfW - 1 || tier) return c("#173d1c");
    return dx < 0 ? c("#2f6a35") : c("#22502a");
  };
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let hit: [number, number] | null = null;
      for (const cr of crowns) if (Math.hypot(x + 0.5 - cr[0], y + 0.5 - cr[1]) <= R) hit = cr;
      if (hit) {
        const [cx, cy] = hit;
        const dx = (x + 0.5 - cx) / R;
        const dy = (y + 0.5 - cy) / R;
        const d = Math.hypot(dx, dy);
        const darker = alt && noise(cx + 32, cy + 32, 951) < 0.5;
        const pal = darker ? P.canopyAlt : P.canopy;
        let col: Rgba;
        if (d > 0.86 && dy > -0.2) col = pal[0]!;
        else if (dx + dy < -0.75) col = pal[4]!;
        else if (dx + dy < -0.25) col = pal[3]!;
        else if (dx + dy > 0.7) col = pal[1]!;
        else col = pal[2]!;
        const n = noise(x, y, 957);
        if (n < 0.07 && d < 0.8) col = pal[n < 0.035 ? 3 : 1]!;
        // the conifer stands in front of the crowns above it, behind the ones below
        const cf = hit[1] <= 8 ? conifer(x, y) : null;
        v.set(x, y, cf ?? col);
        continue;
      }
      const cf = conifer(x, y);
      if (cf) {
        v.set(x, y, cf);
        continue;
      }
      if (variant === 2 && Math.hypot(x + 0.5 - 8, y + 0.5 - 8) <= 4.6) {
        // glade: sunlit grass with a few flowers
        const n = noise(x, y, 961);
        v.set(x, y, n < 0.06 ? c("#f2d45a") : n < 0.1 ? c("#f4f0e6") : grass(x, y));
        continue;
      }
      // between crowns: dark floor inside the forest, a soft shadow on the grass outside
      const shadowed = crowns.some(([cx, cy]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy - 1.5) <= R + 0.6);
      if (inside(x, y)) v.set(x, y, P.forestFloor);
      else v.set(x, y, shadowed ? P.treeShadow : grass(x, y));
    }
  }
  if (variant === 1) {
    // small bushes pushing out over open edges (fully inside the tile)
    const bush = (bx: number, by: number) => v.ellipse(bx, by, 2.2, 1.8, (_x, _y, dx, dy) => (dx + dy < -0.5 ? P.canopy[3]! : dx + dy > 0.5 ? P.canopy[0]! : P.canopy[2]!));
    if (!(mask & N)) bush(8, 2.5);
    if (!(mask & S)) bush(8, 13.5);
    if (!(mask & W)) bush(2.5, 8);
    if (!(mask & E)) bush(13.5, 8);
  }
}

// ---------------------------------------------------------------- mountains

/**
 * Mountains: rocky peaks (lit west face, shaded east face) over a brown foothill; `alt` adds snow caps.
 * Variants share the peak lattice; variant 1 raises the middle peak into a tall snowy summit with scree,
 * variant 2 splits it into two low rocky knolls with pines, and both vary the foothill edge.
 */
export function paintMountainTile(v: View, mask: number, alt: boolean, grass: GrassFn, variant = 0): void {
  const P = OW_PALETTE;
  const H0 = 13;
  const HW0 = 8.5;
  type Peak = [number, number, number, number, boolean];
  const peaks: Peak[] = [];
  for (const [cx, cy] of CENTRES) {
    if (!centrePresent(mask, cx, cy)) continue;
    if (cx === 8 && cy === 8 && variant === 1) peaks.push([8, 8, 15, 8.5, true]);
    else if (cx === 8 && cy === 8 && variant === 2) {
      peaks.push([4.5, 9, 8, 4.2, false], [11.5, 9.5, 9, 4.4, false]);
    } else peaks.push([cx, cy, H0, HW0, false]);
  }
  peaks.sort((a, b) => a[1] - b[1]);
  const inside = region(mask, 2, variant);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      let col: Rgba | null = null;
      for (const [cx, cy, H, HW, summit] of peaks) {
        const base = cy + 5;
        const top = base - H;
        const py = y + 0.5;
        if (py < top || py > base) continue;
        const t = (py - top) / H;
        const half = HW * t;
        const dx = x + 0.5 - cx;
        if (Math.abs(dx) > half) continue;
        const snowy = summit || (alt && noise(cx + 40, cy + 40, 971) < 0.6);
        if (Math.abs(dx) > half - 1 && t > 0.15) col = P.rockDark;
        else if (snowy && t < 0.35) col = dx < 0 ? P.snow[0] : P.snow[1];
        else if (dx < -0.5) col = t > 0.8 ? P.rock[1] : noise(x, y, 977) < 0.12 ? P.rock[2] : P.rock[3];
        else if (dx > 0.5) col = noise(x, y, 979) < 0.15 ? P.rockDark : P.rock[0];
        else col = P.rock[2];
      }
      if (col) v.set(x, y, col);
      else if (inside(x, y)) {
        const n = noise(x, y, 983);
        // variant 1: scree dots on the foothill; variant 2: dark pines between the knolls
        if (variant === 1 && noise(x, y, 985) < 0.08) v.set(x, y, P.rock[1]!);
        else if (variant === 2 && noise(x, y, 987) < 0.07) v.set(x, y, c("#2c5a22"));
        else v.set(x, y, shade(n, P.foothill, [3, 2, 2]));
      }
      else {
        const touches = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
        v.set(x, y, touches ? P.foothill[2] : grass(x, y));
      }
    }
  }
}

// ---------------------------------------------------------------- farm fields

/** Farm field: crop rows on ploughed soil with a hedge rim; `alt` = ripe (golden) crop. */
export function paintFieldTile(v: View, mask: number, alt: boolean, grass: GrassFn): void {
  const P = OW_PALETTE;
  const inside = region(mask, 1);
  const crop = alt ? P.ripe : P.crop;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      if (!inside(x, y)) {
        const touches = inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1);
        v.set(x, y, touches ? P.hedge : grass(x, y));
        continue;
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) {
        v.set(x, y, noise(x, y, 991) < 0.5 ? P.hedgeHi : P.hedge);
        continue;
      }
      const row = y % 4;
      let col: Rgba;
      if (row === 0) col = noise(x, y, 993) < 0.25 ? crop[1]! : crop[0]!;
      else if (row === 1) col = (x + y) % 3 === 0 ? crop[2]! : crop[0]!;
      else if (row === 2) col = P.soil[1]!;
      else col = noise(x, y, 997) < 0.3 ? P.soil[2]! : P.soil[0]!;
      v.set(x, y, col);
    }
  }
}

// ---------------------------------------------------------------- rail

interface TrackGeom {
  /** Signed distance from the track centre line. */
  across: number;
  /** Distance along the track (px). */
  along: number;
}

type Segment = (x: number, y: number) => TrackGeom | null;

const straightNS: Segment = (x, y) => ({ across: x + 0.5 - 8, along: y + 0.5 });
const straightEW: Segment = (x, y) => ({ across: y + 0.5 - 8, along: x + 0.5 });
const half = (dir: number): Segment => (x, y) => {
  const px = x + 0.5;
  const py = y + 0.5;
  if (dir === L_N && py <= 8.5) return { across: px - 8, along: py };
  if (dir === L_S && py >= 7.5) return { across: px - 8, along: py };
  if (dir === L_W && px <= 8.5) return { across: py - 8, along: px };
  if (dir === L_E && px >= 7.5) return { across: py - 8, along: px };
  return null;
};
/** Quarter curve joining two adjacent sides: centre on the shared corner, radius 8. */
const curve = (a: number, b: number): Segment => {
  const m = a | b;
  const cx = m & L_E ? 16 : 0;
  const cy = m & L_S ? 16 : 0;
  return (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const r = Math.hypot(dx, dy);
    if (r > 13) return null;
    const ang = Math.atan2(Math.abs(dy), Math.abs(dx)); // 0..π/2
    return { across: r - 8, along: (ang / (Math.PI / 2)) * 12 };
  };
};

export function railSegments(mask4: number): Segment[] {
  const bits = [L_N, L_E, L_S, L_W].filter((b) => mask4 & b);
  if (bits.length === 0) return [straightEW];
  if (bits.length === 2) {
    if (mask4 === (L_N | L_S)) return [straightNS];
    if (mask4 === (L_E | L_W)) return [straightEW];
    return [curve(bits[0]!, bits[1]!)];
  }
  const segs: Segment[] = [];
  if ((mask4 & (L_N | L_S)) === (L_N | L_S)) segs.push(straightNS);
  if ((mask4 & (L_E | L_W)) === (L_E | L_W)) segs.push(straightEW);
  for (const b of bits) {
    const opposite = { [L_N]: L_S, [L_S]: L_N, [L_E]: L_W, [L_W]: L_E }[b]!;
    if (!(mask4 & opposite) || bits.length === 1) segs.push(half(b));
  }
  // a T junction: also curve the branch into both through directions so it reads as a switch
  if (bits.length === 3) {
    const branch = bits.find((b) => !(mask4 & ({ [L_N]: L_S, [L_S]: L_N, [L_E]: L_W, [L_W]: L_E }[b]!)))!;
    for (const b of bits) if (b !== branch && ({ [L_N]: L_S, [L_S]: L_N, [L_E]: L_W, [L_W]: L_E }[b]!) !== branch) segs.push(curve(branch, b));
  }
  return segs;
}

/** Paint ballast, sleepers and rails for a set of track segments over whatever is already there. */
function drawTrack(v: View, segs: Segment[], opts: { ballast?: boolean; ties?: boolean } = {}): void {
  const P = OW_PALETTE;
  const layer = (x: number, y: number) => {
    let best = 0; // 0 none, 1 ballast, 2 tie, 3 rail shadow, 4 rail
    for (const s of segs) {
      const g = s(x, y);
      if (!g) continue;
      const a = Math.abs(g.across);
      if (a <= 4.6 && opts.ballast !== false) best = Math.max(best, 1);
      if (a <= 4.2 && opts.ties !== false && ((g.along % 4) + 4) % 4 < 1.6) best = Math.max(best, 2);
      if (Math.abs(a - 2.5) < 0.55) best = Math.max(best, g.across > 0 ? 3 : 4);
    }
    return best;
  };
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const l = layer(x, y);
      if (l === 1) v.set(x, y, shade(noise(x, y, 1001), P.ballast, [3, 2, 2]));
      else if (l === 2) v.set(x, y, noise(x, y, 1003) < 0.25 ? P.tieHi : P.tie);
      else if (l === 3) v.set(x, y, P.railShadow);
      else if (l === 4) v.set(x, y, P.rail);
    }
  }
  // buffer stop on a dead end
}

export function paintRailTile(v: View, mask4: number, grass: GrassFn): void {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) v.set(x, y, grass(x, y));
  drawTrack(v, railSegments(mask4));
  const bits = [L_N, L_E, L_S, L_W].filter((b) => mask4 & b);
  if (bits.length === 1) {
    const P = OW_PALETTE;
    // red-and-white buffer stop at the tile centre, facing the open end
    if (bits[0] === L_N || bits[0] === L_S) {
      const y = bits[0] === L_N ? 9 : 6;
      v.rect(4, y, 8, 2, P.red);
      v.set(6, y, P.white);
      v.set(9, y, P.white);
    } else {
      const x = bits[0] === L_W ? 9 : 6;
      v.rect(x, 4, 2, 8, P.red);
      v.set(x, 6, P.white);
      v.set(x, 9, P.white);
    }
  }
}

/** Level crossing: the dirt road runs across the rails, with timber infill and red-white posts. */
export function paintCrossingTile(v: View, railEW: boolean, dirtTile: (v: View, mask: number) => void): void {
  const P = OW_PALETTE;
  dirtTile(v, railEW ? N | S : E | W);
  // timber infill between and around the rails
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const across = railEW ? y + 0.5 - 8 : x + 0.5 - 8;
    const along = railEW ? x : y;
    const onRoad = along >= 3 && along <= 12;
    if (onRoad && Math.abs(across) <= 3.6) v.set(x, y, (railEW ? x : y) % 4 === 3 ? P.plankDark : P.plank[(railEW ? y : x) % 3 === 0 ? 2 : 0]!);
  }
  drawTrack(v, [railEW ? straightEW : straightNS], { ballast: false, ties: false });
  // ballast + ties continue outside the road band
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const across = railEW ? y + 0.5 - 8 : x + 0.5 - 8;
    const along = railEW ? x : y;
    if (along >= 3 && along <= 12) continue;
    const a = Math.abs(across);
    if (Math.abs(a - 2.5) < 0.55) v.set(x, y, across > 0 ? P.railShadow : P.rail);
    else if (a <= 4.2 && along % 4 < 1.6) v.set(x, y, P.tie);
    else if (a <= 4.6) v.set(x, y, shade(noise(x, y, 1001), P.ballast, [3, 2, 2]));
  }
  // crossing posts at two opposite corners
  const post = (px: number, py: number) => {
    v.vline(px, py - 2, py + 1, P.white);
    v.set(px, py - 1, P.red);
    v.set(px, py + 1, P.red);
    v.set(px + 1, py + 2, c("#14100a", 90));
  };
  if (railEW) {
    post(2, 3);
    post(13, 13);
  } else {
    post(2, 2);
    post(13, 12);
  }
}

/** Water under a bridge (full centre water tile). */
function waterUnder(v: View, water: (v: View) => void): void {
  water(v);
}

export function paintRailBridgeTile(v: View, ew: boolean, water: (v: View) => void): void {
  const P = OW_PALETTE;
  waterUnder(v, water);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const across = ew ? y + 0.5 - 8 : x + 0.5 - 8;
    const along = ew ? x : y;
    if (across > 5 && across <= 7) v.set(x, y, c("#163a52", 140)); // shadow on the water
    if (Math.abs(across) <= 5) v.set(x, y, Math.abs(across) > 4 ? P.beam : along % 8 === 0 ? P.beam : P.plankDark);
  }
  // pier caps every 8 px on both sides
  for (let i = 0; i < 16; i += 8) {
    if (ew) {
      v.rect(i, 2, 2, 1, P.rockDark);
      v.rect(i, 13, 2, 1, P.rockDark);
    } else {
      v.rect(2, i, 1, 2, P.rockDark);
      v.rect(13, i, 1, 2, P.rockDark);
    }
  }
  drawTrack(v, [ew ? straightEW : straightNS], { ballast: false });
}

export function paintRoadBridgeTile(v: View, ew: boolean, water: (v: View) => void): void {
  const P = OW_PALETTE;
  waterUnder(v, water);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const across = ew ? y + 0.5 - 8 : x + 0.5 - 8;
    const along = ew ? x : y;
    if (across > 5 && across <= 7) v.set(x, y, c("#163a52", 140));
    if (Math.abs(across) <= 5) {
      if (Math.abs(across) > 4) v.set(x, y, P.beam); // hand rails
      else v.set(x, y, along % 3 === 2 ? P.plankDark : P.plank[noise(along, 0, 1011) < 0.3 ? 2 : noise(along, 1, 1013) < 0.5 ? 0 : 1]!);
    }
  }
  for (let i = 1; i < 16; i += 5) {
    if (ew) {
      v.set(i, 3, P.ink);
      v.set(i, 12, P.ink);
    } else {
      v.set(3, i, P.ink);
      v.set(12, i, P.ink);
    }
  }
}

/** Station platform: straight track between two concrete platforms with yellow safety lines. */
export function paintStationTile(v: View, ew: boolean, grass: GrassFn): void {
  const P = OW_PALETTE;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) v.set(x, y, grass(x, y));
  drawTrack(v, [ew ? straightEW : straightNS]);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const across = ew ? y + 0.5 - 8 : x + 0.5 - 8;
    const along = ew ? x : y;
    const a = Math.abs(across);
    if (a >= 5) {
      if (a < 6) v.set(x, y, P.safety);
      else v.set(x, y, along % 8 === 7 ? c("#9e998e") : P.concrete[noise(x, y, 1021) < 0.3 ? 1 : 0]!);
    }
  }
  // a little red bench + sign post on the far platform
  if (ew) {
    v.rect(3, 1, 4, 2, P.red);
    v.vline(11, 0, 3, P.ink);
    v.rect(10, 0, 3, 1, c("#2c6aa8"));
  } else {
    v.rect(13, 3, 2, 4, P.red);
    v.hline(12, 15, 11, P.ink);
    v.rect(15, 10, 1, 3, c("#2c6aa8"));
  }
}

// ---------------------------------------------------------------- tunnel portals

/**
 * Tunnel portal: mountain all round, a dressed-stone portal with a dark arch where the track runs in
 * from `side` (L_N / L_E / L_S / L_W).
 */
export function paintTunnelTile(v: View, side: number, grass: GrassFn): void {
  const P = OW_PALETTE;
  const open = { [L_N]: N | NE | NW, [L_E]: E | NE | SE, [L_S]: S | SE | SW, [L_W]: W | NW | SW }[side]!;
  paintMountainTile(v, 255 & ~open, false, grass);
  // track from the open side to the arch
  drawTrack(v, [half(side)]);
  const geom = (x: number, y: number) => {
    const px = x + 0.5;
    const py = y + 0.5;
    if (side === L_N) return { along: py, across: px - 8 };
    if (side === L_S) return { along: T - py, across: px - 8 };
    if (side === L_W) return { along: px, across: py - 8 };
    return { along: T - px, across: py - 8 };
  };
  const stone = [c("#9a958c"), c("#b4aea2"), c("#7f7a72"), c("#5f5a54")] as const;
  // portal face: a dressed-stone frame 13 px wide set into the rock, a round-topped dark mouth
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const { along, across } = geom(x, y);
    const a = Math.abs(across);
    if (along < 4 || along > 12) continue;
    const mouth = a <= 3.6 && along >= 5;
    if (mouth) {
      v.set(x, y, along < 6.5 ? c("#241e19") : along < 9 ? c("#15110e") : c("#0b0907"));
    } else if (a <= 6.5) {
      const course = Math.floor(along / 2);
      const joint = (Math.floor(a) + course) % 3 === 0;
      if (along < 5 && a > 3.6) v.set(x, y, stone[1]); // lintel lit top
      else if (a > 5.8) v.set(x, y, stone[3]); // frame edge shadow
      else v.set(x, y, joint ? stone[2] : along < 6 ? stone[1] : stone[0]);
    }
  }
  // keystone over the mouth
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const { along, across } = geom(x, y);
    if (Math.abs(across) <= 1 && along >= 4 && along < 5) v.set(x, y, c("#d8d2c4"));
  }
}
