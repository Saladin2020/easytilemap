/**
 * Procedural "Thai village" sample tileset (CC0): grass, dirt path, rice paddy, canal water and temple
 * stone with blob-47 transitions over grass, decor tiles and editor markers, plus the city street set
 * (sidewalk, asphalt road, curb tiles and street decor, see cityTiles.ts). Deterministic and pure, so
 * the CLI, tests and the browser all produce the identical atlas.
 */
import {
  ATLAS_COLUMNS,
  ATLAS_ROWS,
  BLOB_MASKS,
  DECOR_ROW,
  E,
  GRASS_VARIANTS,
  MARKER_ROW,
  N,
  NE,
  NW,
  OVERLAY_TERRAINS,
  S,
  SE,
  SW,
  W,
  blobCoord,
  curbCoord,
  decorCoord,
  CURB_ROW,
  CITY_DECOR_ROW,
  shoreCoord,
  SHORE_ROW,
} from "./autotile.js";
import { paintCityDecor, paintRoadTile, paintSidewalkTile } from "./cityTiles.js";
import { c, noise, Pix, shade, type Rgba, type View } from "./pixel.js";
import type { RgbaImage } from "./raster.js";
import { DECOR_CODES, TILE_SIZE, type Terrain } from "./types.js";

const T = TILE_SIZE;

export const PALETTE = {
  grass: [c("#4b8a36"), c("#5b9c41"), c("#6aac4a"), c("#7fbf57")],
  grassDark: c("#3c7029"),
  grassBlade: c("#93d066"),
  dirt: [c("#a7774a"), c("#b58552"), c("#c3935e"), c("#94683f")],
  dirtRim: c("#7d5634"),
  dirtPebble: c("#dcb37c"),
  mud: [c("#7e9a86"), c("#73907c"), c("#8aa792")],
  rice: c("#9ad84f"),
  riceHi: c("#c6ef72"),
  riceLo: c("#4a7a3a"),
  dike: c("#9b7449"),
  dikeHi: c("#c09662"),
  water: [c("#3a86a8"), c("#357c9e"), c("#4292b3")],
  waterDeep: c("#2e6f90"),
  waterLight: c("#5fabc8"),
  foam: c("#cdeef0"),
  sparkle: c("#a6dcea"),
  bank: c("#356125"),
  stone: [c("#c3bba9"), c("#b4ac99"), c("#cfc8b5")],
  mortar: c("#8e8676"),
  stoneRim: c("#6f6759"),
  ink: c("#2a1d13"),
  sand: [c("#e8d3a0"), c("#dcc490"), c("#f0deb0")],
  sandWet: c("#c8ae7a"),
  sandShell: c("#fbf3e2"),
  sandRim: c("#c9b07c"),
} as const;

// ---------------------------------------------------------------- base textures (period 16)

export function grassPx(x: number, y: number, variant = 0): Rgba {
  const n = noise(x, y, 101 + (variant % 4));
  let col = shade(n, PALETTE.grass, [1, 4, 3, 1]);
  const b = noise(x, y, 7 + (variant % 4));
  if (b < 0.05) col = PALETTE.grassBlade;
  else if (b > 0.965) col = PALETTE.grassDark;
  return col;
}

type VillageTerrain = Exclude<Terrain, "grass" | "sidewalk" | "road">;
const CITY_TERRAINS = new Set<Terrain>(["sidewalk", "road"]);

function terrainPx(t: VillageTerrain, x: number, y: number, alt: boolean): Rgba {
  const s = alt ? 50 : 0;
  switch (t) {
    case "dirt": {
      const n = noise(x, y, 201 + s);
      if (noise(x, y, 233 + s) < 0.035) return PALETTE.dirtPebble;
      if (noise(x, y, 239 + s) < 0.03) return PALETTE.dirt[3];
      return shade(n, PALETTE.dirt.slice(0, 3), [3, 5, 2]);
    }
    case "paddy": {
      // rows of rice seedlings on muddy water
      const row = (y + 1) % 4;
      const col = (x + (Math.floor(y / 4) % 2) * 2) % 4;
      if (row === 0 && (col === 1 || col === 2)) return col === 1 ? PALETTE.rice : PALETTE.riceHi;
      if (row === 1 && (col === 1 || col === 2)) return PALETTE.riceLo;
      if (row === 3 && col === 1 && noise(x, y, 301 + s) < 0.6) return PALETTE.rice;
      return shade(noise(x, y, 311 + s), PALETTE.mud, [3, 2, 2]);
    }
    case "water": {
      const n = noise(x, y, 401 + s);
      if (noise(Math.floor(x / 3), y, 433 + s) < 0.06 && y % 5 === (alt ? 2 : 1)) return PALETTE.sparkle;
      return shade(n, PALETTE.water, [4, 3, 2]);
    }
    case "sand": {
      if (noise(x, y, 611 + s) < 0.025) return PALETTE.sandShell;
      if (noise(x, y, 617 + s) < 0.04) return PALETTE.sandWet;
      return shade(noise(x, y, 601 + s), PALETTE.sand, [3, 2, 2]);
    }
    case "stone": {
      const off = Math.floor(y / 8) % 2 ? 4 : 0;
      if (y % 8 === 0 || (x + off) % 8 === 0) return PALETTE.mortar;
      return shade(noise(Math.floor((x + off) / 8), Math.floor(y / 8), 501 + s), PALETTE.stone) === PALETTE.stone[0]
        ? shade(noise(x, y, 509 + s), [PALETTE.stone[0], PALETTE.stone[0], PALETTE.stone[2]])
        : shade(noise(x, y, 511 + s), [PALETTE.stone[1], PALETTE.stone[1], PALETTE.stone[0]]);
    }
  }
}

/** Grass shows this many px inside the tile on an open side. */
const EDGE: Record<VillageTerrain, number> = { dirt: 2, paddy: 1, water: 2, stone: 1, sand: 2 };

function jit(along: number, side: number, t: string): number {
  return noise(along, side, t.length * 17) < 0.45 ? 1 : 0;
}

/** True when local pixel (px, py) belongs to the terrain (else grass shows). Handles 1px outside the tile. */
function insideTerrain(t: VillageTerrain, mask: number, px: number, py: number): boolean {
  if (px < 0) return Boolean(mask & W) && insideTerrain(t, mask, 0, py);
  if (px > T - 1) return Boolean(mask & E) && insideTerrain(t, mask, T - 1, py);
  if (py < 0) return Boolean(mask & N) && insideTerrain(t, mask, px, 0);
  if (py > T - 1) return Boolean(mask & S) && insideTerrain(t, mask, px, T - 1);
  const e = EDGE[t];
  const eN = e + jit(px, 1, t);
  const eS = e + jit(px, 2, t);
  const eW = e + jit(py, 3, t);
  const eE = e + jit(py, 4, t);
  const n = mask & N;
  const s = mask & S;
  const w = mask & W;
  const ea = mask & E;
  if (!n && py < eN) return false;
  if (!s && py > T - 1 - eS) return false;
  if (!w && px < eW) return false;
  if (!ea && px > T - 1 - eE) return false;
  const r = e + 2; // outer corner rounding radius
  const cut = (dx: number, dy: number) => dx + dy < r + 1;
  if (!n && !w && cut(px, py)) return false;
  if (!n && !ea && cut(T - 1 - px, py)) return false;
  if (!s && !w && cut(px, T - 1 - py)) return false;
  if (!s && !ea && cut(T - 1 - px, T - 1 - py)) return false;
  // inner corners: both sides connect but the diagonal does not
  const inner = (dx: number, dy: number) => dx < e + 1 && dy < e + 1 && dx + dy < e + 1;
  if (n && w && !(mask & NW) && inner(px, py)) return false;
  if (n && ea && !(mask & NE) && inner(T - 1 - px, py)) return false;
  if (s && w && !(mask & SW) && inner(px, T - 1 - py)) return false;
  if (s && ea && !(mask & SE) && inner(T - 1 - px, T - 1 - py)) return false;
  return true;
}

function paintBlobTile(v: View, t: VillageTerrain, mask: number, alt: boolean, shore = false): void {
  const ins = (x: number, y: number) => insideTerrain(t, mask, x, y);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const inside = ins(x, y);
      const near1 = !ins(x - 1, y) || !ins(x + 1, y) || !ins(x, y - 1) || !ins(x, y + 1);
      const near2 = !ins(x - 2, y) || !ins(x + 2, y) || !ins(x, y - 2) || !ins(x, y + 2);
      if (!inside) {
        const touches = ins(x - 1, y) || ins(x + 1, y) || ins(x, y - 1) || ins(x, y + 1);
        let col = shore ? terrainPx("sand", x, y, false) : grassPx(x, y, 0);
        if (shore) {
          if (touches) col = PALETTE.sandWet;
        } else if (touches && (t === "water" || t === "paddy")) col = PALETTE.bank;
        else if (touches && t === "dirt" && noise(x, y, 77) < 0.5) col = PALETTE.grassDark;
        v.set(x, y, col);
        continue;
      }
      let col = terrainPx(t, x, y, alt);
      if (t === "water") {
        if (near1) col = PALETTE.foam;
        else if (near2) col = PALETTE.waterLight;
        else if (!ins(x, y - 3)) col = PALETTE.waterDeep; // shade under the north bank
      } else if (t === "paddy") {
        if (near1) col = PALETTE.dikeHi;
        else if (near2) col = PALETTE.dike;
      } else if (t === "dirt") {
        if (near1) col = PALETTE.dirtRim;
      } else if (t === "stone") {
        if (near1) col = PALETTE.stoneRim;
      } else if (t === "sand") {
        if (near1) col = PALETTE.sandRim;
      }
      v.set(x, y, col);
    }
  }
}

function paintGrass(v: View, variant: number): void {
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) v.set(x, y, grassPx(x, y, variant));
  if (variant < 4) return;
  const seed = variant * 31;
  const flower = [c("#f4f0e0"), c("#f2c94c"), c("#c98bd6"), c("#f08a7a")][variant - 4]!;
  for (let i = 0; i < 3; i++) {
    const fx = 2 + Math.floor(noise(i, 1, seed) * 12);
    const fy = 2 + Math.floor(noise(i, 2, seed) * 12);
    if (variant === 5) {
      // clover patch
      v.set(fx, fy, PALETTE.grass[3]);
      v.set(fx + 1, fy, PALETTE.grass[3]);
      v.set(fx, fy + 1, PALETTE.grassDark);
    } else v.set(fx, fy, flower);
  }
}

// ---------------------------------------------------------------- decor

function paintDecor(v: View, code: string): void {
  const ink = PALETTE.ink;
  switch (code) {
    case "f": {
      const pts: Array<[number, number, Rgba]> = [[4, 5, c("#f05a5a")], [10, 4, c("#f4f0e0")], [7, 10, c("#f2c94c")], [12, 11, c("#c98bd6")]];
      for (const [x, y, col] of pts) {
        v.set(x, y + 2, c("#3c7029"));
        v.set(x - 1, y + 1, c("#4f8f38"));
        v.set(x, y - 1, col);
        v.set(x - 1, y, col);
        v.set(x + 1, y, col);
        v.set(x, y + 1, col);
        v.set(x, y, c("#ffe27a"));
      }
      break;
    }
    case "t":
      for (const [bx, by] of [[4, 11], [8, 12], [11, 10]] as const) {
        for (let i = 0; i < 4; i++) {
          v.set(bx - 2 + Math.floor(i / 2), by - i, c("#3c7029"));
          v.set(bx + Math.floor(i / 3), by - i - 1, c("#7fbf57"));
          v.set(bx + 2 - Math.floor(i / 2), by - i, c("#5b9c41"));
        }
      }
      break;
    case "r": {
      v.ellipse(6, 9, 4, 3, (x, y, dx, dy) => (dy < -0.3 && dx < 0.2 ? c("#c9c3b6") : c("#9a948a")));
      v.ellipse(11.5, 11, 2.5, 2, (x, y, dx, dy) => (dy < -0.2 ? c("#b9b3a6") : c("#8a847a")));
      v.outline(ink);
      break;
    }
    case "l": {
      v.ellipse(5, 6, 3.5, 2.5, c("#4f9a48"));
      v.line(5, 6, 7, 4, c("#3f7d3a"));
      v.ellipse(11, 11, 3.5, 2.5, c("#5aa652"));
      v.line(11, 11, 13, 9, c("#3f7d3a"));
      v.ellipse(10, 5, 2, 2, c("#f3a6c0"));
      v.set(10, 4, c("#ffd6e2"));
      v.set(10, 5, c("#ffe27a"));
      v.outline(c("#244a2e"));
      break;
    }
    case "e":
      for (let i = 0; i < 7; i++) {
        const x = 2 + Math.floor(noise(i, 3, 9) * 12);
        const y = 2 + Math.floor(noise(i, 4, 9) * 12);
        v.set(x, y, c("#d9d1c0"));
        v.set(x + 1, y, c("#a69d8c"));
      }
      break;
    case "u": {
      v.ellipse(8, 11, 5, 3, c("#6b4a2c"));
      v.ellipse(8, 9, 5, 3, (x, y, dx, dy) => (dx * dx + dy * dy < 0.25 ? c("#a07a4e") : c("#c49a66")));
      v.set(8, 9, c("#7d5634"));
      v.outline(ink);
      break;
    }
    case "n":
      for (const [x, h] of [[4, 10], [7, 13], [10, 11], [12, 8]] as const) {
        v.vline(x, 15 - h, 15, c("#5d8f3c"));
        v.vline(x, 15 - h, 15 - h + 2, c("#7a4e2a"));
        v.set(x + 1, 15 - Math.floor(h / 2), c("#88b85a"));
      }
      break;
    case "k": {
      const wood = c("#a2703f");
      const hi = c("#c99560");
      v.rect(0, 6, 16, 2, wood);
      v.hline(0, 15, 6, hi);
      v.rect(0, 10, 16, 2, wood);
      v.hline(0, 15, 10, hi);
      v.rect(2, 3, 3, 11, c("#8a5d33"));
      v.rect(11, 3, 3, 11, c("#8a5d33"));
      v.vline(2, 3, 13, hi);
      v.vline(11, 3, 13, hi);
      v.outline(ink);
      break;
    }
  }
}

function paintMarkers(collision: View, spawn: View): void {
  collision.rect(0, 0, T, T, c("#e5484d", 90));
  for (let i = 2; i < 14; i++) {
    collision.set(i, i, c("#ffd2d2"));
    collision.set(15 - i, i, c("#ffd2d2"));
  }
  spawn.vline(5, 2, 14, c("#2a1d13"));
  spawn.poly([[6, 2], [13, 4.5], [6, 7]], c("#f4ae3d"));
  spawn.ellipse(5.5, 14, 3, 1.3, c("#14100a", 90));
}

let atlasCache: RgbaImage | null = null;

/** The 128×928 sample atlas (cached). */
export function generateAtlas(): RgbaImage {
  if (atlasCache) return atlasCache;
  const p = new Pix(ATLAS_COLUMNS * T, ATLAS_ROWS * T);
  const tile = (col: number, row: number) => p.view(col * T, row * T, T, T);
  for (let v = 0; v < GRASS_VARIANTS; v++) paintGrass(tile(v, 0), v);
  for (const t of OVERLAY_TERRAINS) {
    if (CITY_TERRAINS.has(t)) continue;
    const vt = t as VillageTerrain;
    BLOB_MASKS.forEach((mask, i) => {
      const at = blobCoord(vt, i);
      paintBlobTile(tile(at.col, at.row), vt, mask, false);
    });
    const spare = blobCoord(vt, 47);
    paintBlobTile(tile(spare.col, spare.row), vt, 255, true);
  }
  // city: sidewalk + road over grass, then the curb set (road next to sidewalk); slot 47 = cracked slab / wet asphalt
  const g0 = (x: number, y: number) => grassPx(x, y, 0);
  for (let i = 0; i < 48; i++) {
    const mask = i < 47 ? BLOB_MASKS[i]! : 255;
    const sw = blobCoord("sidewalk", i);
    paintSidewalkTile(tile(sw.col, sw.row), mask, i === 47, g0, PALETTE.grassDark);
    const rd = blobCoord("road", i);
    paintRoadTile(tile(rd.col, rd.row), mask, i === 47, false, g0, PALETTE.grassDark);
    const cb = curbCoord(i);
    paintRoadTile(tile(cb.col, cb.row), mask, i === 47, true, g0, PALETTE.grassDark);
  }
  BLOB_MASKS.forEach((mask, i) => {
    const at = shoreCoord(i);
    paintBlobTile(tile(at.col, at.row), "water", mask, false, true);
  });
  const shoreSpare = shoreCoord(47);
  paintBlobTile(tile(shoreSpare.col, shoreSpare.row), "water", 255, true, true);
  DECOR_CODES.forEach((code, i) => {
    const at = decorCoord(code)!;
    if (i < ATLAS_COLUMNS) paintDecor(tile(at.col, at.row), code);
    else paintCityDecor(tile(at.col, at.row), code);
  });
  paintMarkers(tile(0, MARKER_ROW), tile(1, MARKER_ROW));
  atlasCache = p.img;
  return p.img;
}

export const SAMPLE_TILESET_ID = "thai_village";

/** Tileset metadata written next to the atlas PNG (`tilesets/<id>.json`). */
export function tilesetMeta() {
  return {
    format: "easytilemap.tileset/1",
    id: SAMPLE_TILESET_ID,
    name: "Thai village + city street (sample, CC0)",
    image: `${SAMPLE_TILESET_ID}.png`,
    tileSize: T,
    columns: ATLAS_COLUMNS,
    rows: ATLAS_ROWS,
    autotile: "blob47",
    layout: {
      grass: { row: 0, variants: GRASS_VARIANTS },
      terrains: Object.fromEntries(OVERLAY_TERRAINS.map((t) => [t, { firstRow: blobCoord(t, 0).row, tiles: 48 }])),
      shore: { firstRow: SHORE_ROW, tiles: 48, note: "water next to sand: open edges show sand" },
      curb: { firstRow: CURB_ROW, tiles: 48, note: "road next to sidewalk: open edges show a curb and paving" },
      decor: { row: DECOR_ROW, codes: [...DECOR_CODES.slice(0, ATLAS_COLUMNS)] },
      cityDecor: { row: CITY_DECOR_ROW, codes: [...DECOR_CODES.slice(ATLAS_COLUMNS)] },
      markers: { row: MARKER_ROW, collision: 0, spawn: 1 },
    },
    license: "CC0-1.0",
  };
}
