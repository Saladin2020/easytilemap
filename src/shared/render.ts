/**
 * Software renderer for a map (Node PNG export and the web editor share it): ground autotiles, decor,
 * floor objects, then objects + characters sorted by their base line, plus optional overlays.
 */
import { resolveGround, decorCoord, MARKER_ROW } from "./autotile.js";
import { DEFAULT_GROUND_ROW, facingRow, feetPx, stillColumn, type SheetLayout } from "./characters.js";
import { collisionGrid } from "./map.js";
import { OBJECT_BY_KIND } from "./objects.js";
import { blit, createImage, fillRect, type RgbaImage } from "./raster.js";
import type { MapDoc } from "./types.js";

export interface LoadedSheet {
  img: RgbaImage;
  layout: SheetLayout;
  groundRow?: number;
}

export interface RenderAssets {
  atlas: RgbaImage;
  object: (kind: string) => RgbaImage | undefined;
  /** Character sheets by the map's `sheet` string. */
  sheets?: Map<string, LoadedSheet>;
}

export interface RenderOptions {
  scale?: number;
  grid?: boolean;
  collision?: boolean;
  spawns?: boolean;
  characters?: boolean;
  /** Crop in px (before scaling). */
  crop?: { x: number; y: number; w: number; h: number };
  /** Hide whole layers in the editor. */
  hide?: Partial<Record<"ground" | "decor" | "objects", boolean>>;
}

export interface Drawable {
  kind: "object" | "character";
  index: number;
  /** Sort key: base line in px. */
  base: number;
  draw: (dst: RgbaImage) => void;
}

/** Objects + characters in draw order (by base line, objects before characters on ties). */
export function drawables(doc: MapDoc, assets: RenderAssets, opts: { characters?: boolean } = {}): { floor: Drawable[]; sorted: Drawable[] } {
  const ts = doc.tileSize;
  const floor: Drawable[] = [];
  const sorted: Drawable[] = [];
  doc.objects.forEach((o, index) => {
    const k = OBJECT_BY_KIND.get(o.kind);
    const img = assets.object(o.kind);
    if (!k || !img) return;
    const d: Drawable = { kind: "object", index, base: (o.y + k.h) * ts, draw: (dst) => blit(dst, img, o.x * ts, o.y * ts, { flipX: o.flipX }) };
    (k.floor ? floor : sorted).push(d);
  });
  if (opts.characters !== false) {
    doc.characters.forEach((ch, index) => {
      const sheet = assets.sheets?.get(ch.sheet);
      if (!sheet) return;
      const fs = sheet.layout.frameSize;
      const { row, flipX } = facingRow(sheet.layout, ch.facing ?? "front");
      const col = stillColumn(sheet.layout, ch);
      const feet = feetPx(ch, ts);
      const ground = ch.groundRow ?? sheet.groundRow ?? DEFAULT_GROUND_ROW;
      sorted.push({
        kind: "character",
        index,
        base: feet.y + 0.5,
        draw: (dst) => blit(dst, sheet.img, feet.x - fs / 2, feet.y - ground, { sx: col * fs, sy: row * fs, sw: fs, sh: fs, flipX }),
      });
    });
  }
  sorted.sort((a, b) => a.base - b.base || (a.kind === b.kind ? a.index - b.index : a.kind === "object" ? -1 : 1));
  return { floor, sorted };
}

/** Draw the map at 1× into a new image. */
export function renderMapRaw(doc: MapDoc, assets: RenderAssets, opts: RenderOptions = {}): RgbaImage {
  const ts = doc.tileSize;
  const out = createImage(doc.width * ts, doc.height * ts);
  const atlas = assets.atlas;
  if (!opts.hide?.ground) {
    const cells = resolveGround(doc);
    cells.forEach((row, y) =>
      row.forEach((cell, x) => blit(out, atlas, x * ts, y * ts, { sx: cell.atlas.col * ts, sy: cell.atlas.row * ts, sw: ts, sh: ts })),
    );
  }
  if (!opts.hide?.decor) {
    doc.layers.decor.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const at = decorCoord(row[x]!);
        if (at) blit(out, atlas, x * ts, y * ts, { sx: at.col * ts, sy: at.row * ts, sw: ts, sh: ts });
      }
    });
  }
  if (!opts.hide?.objects) {
    const { floor, sorted } = drawables(doc, assets, { characters: opts.characters });
    floor.forEach((d) => d.draw(out));
    sorted.forEach((d) => d.draw(out));
  }
  if (opts.collision) {
    const g = collisionGrid(doc);
    g.forEach((row, y) => row.forEach((b, x) => b && blit(out, atlas, x * ts, y * ts, { sx: 0, sy: MARKER_ROW * ts, sw: ts, sh: ts })));
  }
  if (opts.spawns) {
    for (const s of doc.spawns) blit(out, atlas, s.x * ts, s.y * ts, { sx: ts, sy: MARKER_ROW * ts, sw: ts, sh: ts });
  }
  if (opts.grid) {
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        if (x % ts !== 0 && y % ts !== 0) continue;
        const i = (y * out.width + x) * 4;
        out.data[i] = Math.round(out.data[i]! * 0.8);
        out.data[i + 1] = Math.round(out.data[i + 1]! * 0.8);
        out.data[i + 2] = Math.round(out.data[i + 2]! * 0.8);
      }
    }
  }
  return out;
}

export function cropImage(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const out = createImage(w, h);
  blit(out, img, -x, -y);
  return out;
}

export function scaleImage(img: RgbaImage, s: number): RgbaImage {
  if (s === 1) return img;
  const out = createImage(img.width * s, img.height * s);
  for (let y = 0; y < out.height; y++) {
    const sy = Math.floor(y / s);
    for (let x = 0; x < out.width; x++) {
      const si = (sy * img.width + Math.floor(x / s)) * 4;
      const di = (y * out.width + x) * 4;
      out.data[di] = img.data[si]!;
      out.data[di + 1] = img.data[si + 1]!;
      out.data[di + 2] = img.data[si + 2]!;
      out.data[di + 3] = img.data[si + 3]!;
    }
  }
  return out;
}

export function renderMap(doc: MapDoc, assets: RenderAssets, opts: RenderOptions = {}): RgbaImage {
  let img = renderMapRaw(doc, assets, opts);
  if (opts.crop) img = cropImage(img, opts.crop.x, opts.crop.y, opts.crop.w, opts.crop.h);
  const s = Math.max(1, Math.min(8, Math.round(opts.scale ?? 1)));
  return scaleImage(img, s);
}

export { fillRect };
