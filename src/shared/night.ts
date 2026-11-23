/**
 * Night look for maps (world maps especially): a moonlit blue grade for the atlas, objects and
 * characters, with town and station windows, doors, lanterns and platform lamps lit warm, plus a soft
 * additive glow layer around towns and stations. Pure image functions shared by the PNG renderer and
 * the Godot / Pixi exporters (which bake `*_night.png` copies so the game can toggle day / night).
 */
import { LINE_EXTRA_ROW, lineExtraCoord, ATLAS_COLUMNS } from "./autotile.js";
import { OBJECT_BY_KIND, objectImage, objectNightMask } from "./objects.js";
import { WINDOW_HEX } from "./overworldObjects.js";
import { createImage, type RgbaImage } from "./raster.js";
import type { LoadedSheet, RenderAssets } from "./render.js";
import type { MapDoc } from "./types.js";

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;
const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return key((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

/** Colours that read as glass, open doors and lamps: they glow at night instead of darkening. */
export const LIT_COLORS: ReadonlySet<number> = new Set(
  [
    WINDOW_HEX, // world-map town windows
    "#9cc0d8", // brick-city windows
    "#2d4157", // station house + train glass
    "#3a2618", // doors on the world-map houses
    "#24160e", // mosque / shrine doorways
    "#e0402e", // Chinese lanterns
    "#ffb04a",
    "#ffe27a", // spire tips, locomotive headlight
  ].map(hex),
);
/** Extra lamp colour lit only on station platform tiles (the platform sign / lamp post). */
const PLATFORM_LAMPS: ReadonlySet<number> = new Set(["#2c6aa8", "#f0c43c"].map(hex));

export interface NightOptions {
  /** 0 = day, 1 = full night (default 1). */
  strength?: number;
}

/** Moonlit grade for one colour. */
function grade(r: number, g: number, b: number, k: number): [number, number, number] {
  const l = 0.3 * r + 0.55 * g + 0.15 * b;
  const nr = 0.22 * r + 0.08 * l + 6;
  const ng = 0.28 * g + 0.1 * l + 12;
  const nb = 0.42 * b + 0.12 * l + 34;
  return [r + (nr - r) * k, g + (ng - g) * k, b + (nb - b) * k];
}

/**
 * Night copy of an image. `lit` pixels become warm light; `litRect` limits extra lamp colours to
 * regions (e.g. station tiles in the atlas). A small glow spills from lit pixels onto opaque neighbours.
 */
export function nightImage(img: RgbaImage, opts: NightOptions & { lit?: ReadonlySet<number>; extraLit?: { set: ReadonlySet<number>; rects: Array<[number, number, number, number]> }; litMask?: Uint8Array } = {}): RgbaImage {
  const k = Math.max(0, Math.min(1, opts.strength ?? 1));
  if (opts.litMask) return nightImageMasked(img, opts.litMask, k);
  const lit = opts.lit ?? LIT_COLORS;
  const out = createImage(img.width, img.height);
  const glow = new Float32Array(img.width * img.height);
  const inExtra = (x: number, y: number) => opts.extraLit?.rects.some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x < rx + rw && y < ry + rh) ?? false;
  const litAt: number[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!, a = img.data[i + 3]!;
      out.data[i + 3] = a;
      if (a === 0) continue;
      const kk = key(r, g, b);
      if (k > 0 && (lit.has(kk) || (opts.extraLit?.set.has(kk) && inExtra(x, y)))) {
        litAt.push(x, y);
        // warm window light: brighter at the top of a window, amber lower down
        const above = y > 0 && img.data[i - img.width * 4 + 3]! > 0 && lit.has(key(img.data[i - img.width * 4]!, img.data[i - img.width * 4 + 1]!, img.data[i - img.width * 4 + 2]!));
        const [wr, wg, wb] = above ? [255, 176, 72] : [255, 214, 110];
        out.data[i] = Math.round(r + (wr - r) * k);
        out.data[i + 1] = Math.round(g + (wg - g) * k);
        out.data[i + 2] = Math.round(b + (wb - b) * k);
        continue;
      }
      const [nr, ng, nb] = grade(r, g, b, k);
      out.data[i] = Math.round(nr);
      out.data[i + 1] = Math.round(ng);
      out.data[i + 2] = Math.round(nb);
    }
  }
  // glow: a 2 px warm spill around lit pixels (opaque pixels only, so sprites keep their outline)
  for (let j = 0; j < litAt.length; j += 2) {
    const lx = litAt[j]!, ly = litAt[j + 1]!;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = lx + dx, y = ly + dy;
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const d = Math.hypot(dx, dy);
      if (d === 0 || d > 2.5) continue;
      glow[y * img.width + x] = Math.max(glow[y * img.width + x]!, (1 - d / 2.8) * 0.55 * k);
    }
  }
  for (let p = 0; p < glow.length; p++) {
    const gl = glow[p]!;
    if (!gl) continue;
    const i = p * 4;
    if (out.data[i + 3] === 0) continue;
    const x = p % img.width, y = Math.floor(p / img.width);
    if (lit.has(key(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)) || (opts.extraLit && inExtra(x, y) && opts.extraLit.set.has(key(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!)))) continue;
    out.data[i] = Math.min(255, Math.round(out.data[i]! + 200 * gl));
    out.data[i + 1] = Math.min(255, Math.round(out.data[i + 1]! + 140 * gl));
    out.data[i + 2] = Math.min(255, Math.round(out.data[i + 2]! + 40 * gl));
  }
  return out;
}

/** Night copy from an explicit mask (1 = lit): the same warm light and 2 px spill, no colour guesses. */
function nightImageMasked(img: RgbaImage, mask: Uint8Array, k: number): RgbaImage {
  const out = createImage(img.width, img.height);
  const glow = new Float32Array(img.width * img.height);
  const w = img.width;
  for (let p = 0; p < w * img.height; p++) {
    const i = p * 4;
    const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!, a = img.data[i + 3]!;
    out.data[i + 3] = a;
    if (a === 0) continue;
    if (k > 0 && mask[p]) {
      const above = p >= w && img.data[i - w * 4 + 3]! > 0 && mask[p - w];
      const [wr, wg, wb] = above ? [255, 176, 72] : [255, 214, 110];
      out.data[i] = Math.round(r + (wr - r) * k);
      out.data[i + 1] = Math.round(g + (wg - g) * k);
      out.data[i + 2] = Math.round(b + (wb - b) * k);
      const x = p % w, y = (p / w) | 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        const d = Math.hypot(dx, dy);
        if (xx < 0 || yy < 0 || xx >= w || yy >= img.height || d === 0 || d > 2.5) continue;
        glow[yy * w + xx] = Math.max(glow[yy * w + xx]!, (1 - d / 2.8) * 0.55 * k);
      }
      continue;
    }
    const [nr, ng, nb] = grade(r, g, b, k);
    out.data[i] = Math.round(nr);
    out.data[i + 1] = Math.round(ng);
    out.data[i + 2] = Math.round(nb);
  }
  for (let p = 0; p < glow.length; p++) {
    const gl = glow[p]!;
    if (!gl || mask[p] || out.data[p * 4 + 3] === 0) continue;
    const i = p * 4;
    out.data[i] = Math.min(255, Math.round(out.data[i]! + 200 * gl));
    out.data[i + 1] = Math.min(255, Math.round(out.data[i + 1]! + 140 * gl));
    out.data[i + 2] = Math.min(255, Math.round(out.data[i + 2]! + 40 * gl));
  }
  return out;
}

const sameImage = (a: RgbaImage, b: RgbaImage) => {
  if (a === b) return true;
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
};

/**
 * Night copy of one object image. Pole lamps (NIGHT_MASKED_KINDS) still identical to the sample art use their
 * explicit mask; everything else (and repainted poles) keeps the colour-based lighting.
 */
export function nightObject(kind: string, img: RgbaImage): RgbaImage {
  const mask = objectNightMask(kind);
  if (mask && sameImage(img, objectImage(kind))) return nightImage(img, { litMask: mask });
  return nightImage(img);
}

/** Night atlas: everything graded; station platform tiles keep their lamps and safety lines lit. */
export function nightAtlas(atlas: RgbaImage, tileSize = 16): RgbaImage {
  const rects: Array<[number, number, number, number]> = [];
  for (const ew of [true, false]) {
    const at = lineExtraCoord("station", ew);
    if ((at.row + 1) * tileSize <= atlas.height && at.col < ATLAS_COLUMNS) rects.push([at.col * tileSize, LINE_EXTRA_ROW * tileSize, tileSize, tileSize]);
  }
  return nightImage(atlas, { lit: new Set<number>(), extraLit: { set: PLATFORM_LAMPS, rects } });
}

/** Characters at night: graded more lightly so the player stays readable. */
export function nightSheet(img: RgbaImage): RgbaImage {
  return nightImage(img, { strength: 0.6, lit: new Set<number>() });
}

const atlasCache = new WeakMap<RgbaImage, RgbaImage>();
const objectCache = new WeakMap<RgbaImage, RgbaImage>();
const sheetCache = new WeakMap<RgbaImage, RgbaImage>();
const memo = (cache: WeakMap<RgbaImage, RgbaImage>, img: RgbaImage, f: (i: RgbaImage) => RgbaImage) => {
  let out = cache.get(img);
  if (!out) {
    out = f(img);
    cache.set(img, out);
  }
  return out;
};

/** Wrap render assets so every image is its night copy (cached per source image). */
export function nightAssets(assets: RenderAssets): RenderAssets {
  const sheets = assets.sheets ? new Map<string, LoadedSheet>([...assets.sheets].map(([k, s]) => [k, { ...s, img: memo(sheetCache, s.img, nightSheet) }])) : undefined;
  return {
    atlas: memo(atlasCache, assets.atlas, (a) => nightAtlas(a)),
    object: (kind) => {
      const img = assets.object(kind);
      return img ? memo(objectCache, img, (i) => nightObject(kind, i)) : undefined;
    },
    ...(sheets ? { sheets } : {}),
  };
}

/**
 * Additive glow layer (map-sized, 1×): warm pools of light around world-map towns and station
 * platforms, and a faint one around every other building. Draw it with additive blending.
 */
export function nightGlow(doc: MapDoc): RgbaImage {
  const ts = doc.tileSize;
  const out = createImage(doc.width * ts, doc.height * ts);
  const acc = new Float32Array(out.width * out.height);
  const pool = (cx: number, cy: number, r: number, power: number) => {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(out.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(out.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.25) / r;
      if (d >= 1) continue;
      acc[y * out.width + x] = acc[y * out.width + x]! + power * (1 - d) * (1 - d);
    }
  };
  for (const o of doc.objects) {
    const k = OBJECT_BY_KIND.get(o.kind);
    if (!k) continue;
    const cx = (o.x + k.w / 2) * ts;
    const cy = (o.y + k.h * 0.6) * ts;
    if (k.category === "town") pool(cx, cy, Math.max(k.w, k.h) * ts * 0.95, o.kind === "ow_station" ? 0.5 : 0.7);
    else if (k.category === "building") pool(cx, cy, Math.max(k.w, k.h) * ts * 0.6, 0.25);
  }
  doc.layers.ground.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "Z") pool((x + 0.5) * ts, (y + 0.5) * ts, ts * 1.4, 0.3);
  });
  for (let p = 0; p < acc.length; p++) {
    const v = Math.min(1, acc[p]!);
    if (v <= 0.004) continue;
    const i = p * 4;
    out.data[i] = 255;
    out.data[i + 1] = 178;
    out.data[i + 2] = 86;
    out.data[i + 3] = Math.round(v * 120);
  }
  return out;
}

/** Add a glow layer onto an image (additive, alpha = strength). */
export function addGlow(dst: RgbaImage, glow: RgbaImage, ox = 0, oy = 0): void {
  for (let y = 0; y < dst.height; y++) {
    const gy = y + oy;
    if (gy < 0 || gy >= glow.height) continue;
    for (let x = 0; x < dst.width; x++) {
      const gx = x + ox;
      if (gx < 0 || gx >= glow.width) continue;
      const gi = (gy * glow.width + gx) * 4;
      const a = glow.data[gi + 3]! / 255;
      if (!a) continue;
      const di = (y * dst.width + x) * 4;
      dst.data[di] = Math.min(255, Math.round(dst.data[di]! + glow.data[gi]! * a));
      dst.data[di + 1] = Math.min(255, Math.round(dst.data[di + 1]! + glow.data[gi + 1]! * a));
      dst.data[di + 2] = Math.min(255, Math.round(dst.data[di + 2]! + glow.data[gi + 2]! * a));
    }
  }
}
