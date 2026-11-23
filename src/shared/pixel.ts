/** Tiny pixel-painting helpers for the procedural sample art (pure; runs in Node and the browser). */
import { createImage, hexToRgb, type RgbaImage } from "./raster.js";

export type Rgba = [number, number, number, number];

const cache = new Map<string, Rgba>();
export function c(hex: string, a = 255): Rgba {
  const k = `${hex}/${a}`;
  let v = cache.get(k);
  if (!v) {
    v = [...hexToRgb(hex), a] as Rgba;
    cache.set(k, v);
  }
  return v;
}

/** Deterministic hash noise in [0,1) for local pixel coordinates. */
export function noise(x: number, y: number, seed = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Explicit night masks, recorded while painting: pixels drawn inside `markLit` light up at night (lamp bulbs,
 * lanterns). Painting itself is unchanged, so day images stay byte-identical.
 */
const NIGHT_LIT = new WeakMap<RgbaImage, Uint8Array>();
let litTarget: RgbaImage | null = null;

/** Paint `draw` on `v` and mark every pixel it sets as lit at night. */
export function markLit(v: View, draw: () => void): void {
  if (!NIGHT_LIT.has(v.img)) NIGHT_LIT.set(v.img, new Uint8Array(v.img.width * v.img.height));
  const prev = litTarget;
  litTarget = v.img;
  try {
    draw();
  } finally {
    litTarget = prev;
  }
}

/** The night mask recorded for an image (1 = lit), or undefined when nothing was marked. */
export function litMask(img: RgbaImage): Uint8Array | undefined {
  return NIGHT_LIT.get(img);
}

export class Pix {
  readonly img: RgbaImage;
  constructor(
    public readonly w: number,
    public readonly h: number,
  ) {
    this.img = createImage(w, h);
  }

  static from(img: RgbaImage, ox = 0, oy = 0, w = img.width, h = img.height): View {
    return new View(img, ox, oy, w, h);
  }

  view(ox = 0, oy = 0, w = this.w, h = this.h): View {
    return new View(this.img, ox, oy, w, h);
  }
}

/** A window onto an image (lets the tileset painter draw each tile with local coordinates). */
export class View {
  constructor(
    readonly img: RgbaImage,
    readonly ox: number,
    readonly oy: number,
    readonly w: number,
    readonly h: number,
  ) {}

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, col: Rgba): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = ((this.oy + y) * this.img.width + this.ox + x) * 4;
    if (litTarget === this.img) NIGHT_LIT.get(this.img)![i >> 2] = 1;
    const d = this.img.data;
    const a = col[3];
    if (a >= 255 || d[i + 3] === 0) {
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = a >= 255 ? 255 : Math.max(a, d[i + 3]!);
      return;
    }
    const t = a / 255;
    d[i] = Math.round(d[i]! * (1 - t) + col[0] * t);
    d[i + 1] = Math.round(d[i + 1]! * (1 - t) + col[1] * t);
    d[i + 2] = Math.round(d[i + 2]! * (1 - t) + col[2] * t);
  }

  alpha(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.img.data[((this.oy + y) * this.img.width + this.ox + x) * 4 + 3]!;
  }

  get(x: number, y: number): Rgba {
    const i = ((this.oy + y) * this.img.width + this.ox + x) * 4;
    const d = this.img.data;
    return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
  }

  rect(x: number, y: number, w: number, h: number, col: Rgba): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, col);
  }

  hline(x0: number, x1: number, y: number, col: Rgba): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, col);
  }

  vline(x: number, y0: number, y1: number, col: Rgba): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, col);
  }

  line(x0: number, y0: number, x1: number, y1: number, col: Rgba): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, col: Rgba | ((x: number, y: number, dx: number, dy: number) => Rgba | null)): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const v = typeof col === "function" ? col(x, y, dx, dy) : col;
        if (v) this.set(x, y, v);
      }
    }
  }

  /** Fill a convex polygon (scanline, pixel centres). */
  poly(points: Array<[number, number]>, col: Rgba | ((x: number, y: number) => Rgba | null)): void {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i]!;
        const [bx, by] = points[(i + 1) % points.length]!;
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]! - 0.5); x <= Math.floor(xs[k + 1]! - 0.5); x++) {
          const v = typeof col === "function" ? col(x, y) : col;
          if (v) this.set(x, y, v);
        }
      }
    }
  }

  /** Dark 1px outline around every opaque shape (the classic pixel-art finish). */
  outline(ink: Rgba, minAlpha = 200): void {
    const marks: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) >= 1) continue;
        if (this.alpha(x - 1, y) >= minAlpha || this.alpha(x + 1, y) >= minAlpha || this.alpha(x, y - 1) >= minAlpha || this.alpha(x, y + 1) >= minAlpha) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.set(x, y, ink);
  }

  /** Soft drop shadow ellipse drawn only under transparent pixels. */
  shadow(cx: number, cy: number, rx: number, ry: number, a = 70): void {
    const col = c("#14100a", a);
    this.ellipse(cx, cy, rx, ry, (x, y) => (this.alpha(x, y) === 0 ? col : null));
  }
}

/** Pick one of several shades by a noise value. */
export function shade(n: number, cols: readonly Rgba[], weights?: readonly number[]): Rgba {
  if (!weights) return cols[Math.min(cols.length - 1, Math.floor(n * cols.length))]!;
  let acc = 0;
  const total = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cols.length; i++) {
    acc += weights[i]! / total;
    if (n < acc) return cols[i]!;
  }
  return cols[cols.length - 1]!;
}
