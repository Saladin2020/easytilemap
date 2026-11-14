/**
 * Easy Sprite top-down characters on a tile map: sheet layout, frame lookup, feet anchoring and the
 * CLI arg form. Mirrors Easy Scene's characters helpers, with 4 facings and tile positions.
 */
import type { RgbaImage } from "./raster.js";
import { CHARACTER_ANIMS, FACINGS, TILE_SIZE, type CharacterAnim, type Facing, type MapCharacter } from "./types.js";

/** Easy Sprite's locked 30-frame grid (column order of every native sheet). */
export const EASYSPRITE_FRAMES = [
  "idle", "walk0", "walk1", "walk2", "run0", "run1", "run2", "run3", "jump0", "jump1",
  "wave0", "wave1", "carry0", "carry1", "farm0", "farm1", "cheer0", "cheer1", "attack0", "attack1",
  "hurt0", "hurt1", "fall0", "fall1", "sleep0", "sleep1", "tired0", "tired1", "sit", "crouch",
] as const;

export const FRAME_SIZE = 48;
/** Easy Sprite top-down sheets stand on row 45. */
export const DEFAULT_GROUND_ROW = 45;

export interface SheetLayout {
  frameSize: number;
  frames: string[];
  directions: string[];
  view?: string;
}

export function defaultLayout(img?: { width: number; height: number }): SheetLayout {
  const rows = img ? Math.max(1, Math.floor(img.height / FRAME_SIZE)) : 4;
  const directions = rows >= 4 ? ["front", "right", "back", "left"] : ["right", "left", "front"].slice(0, rows);
  return { frameSize: FRAME_SIZE, frames: [...EASYSPRITE_FRAMES], directions, view: rows >= 4 ? "topdown" : "side" };
}

/** Read an `easysprite.native` export JSON. Undefined when unusable. */
export function layoutFromMeta(meta: unknown): SheetLayout | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  const frames = Array.isArray(m.frames) && m.frames.every((f) => typeof f === "string") ? (m.frames as string[]) : undefined;
  const directions = Array.isArray(m.directions) && m.directions.every((f) => typeof f === "string") ? (m.directions as string[]) : undefined;
  if (!frames?.length || !directions?.length) return undefined;
  const frameSize = typeof m.frameSize === "number" && m.frameSize > 0 ? m.frameSize : FRAME_SIZE;
  return { frameSize, frames, directions, ...(typeof m.view === "string" ? { view: m.view } : {}) };
}

export function detectGroundRow(img: RgbaImage, frameSize = FRAME_SIZE, col = 0, row = 0): number | undefined {
  const x0 = col * frameSize;
  const y0 = row * frameSize;
  if (x0 + frameSize > img.width || y0 + frameSize > img.height) return undefined;
  for (let y = frameSize - 1; y >= 0; y--) {
    for (let x = 0; x < frameSize; x++) if (img.data[((y0 + y) * img.width + x0 + x) * 4 + 3]! > 0) return y;
  }
  return undefined;
}

export function frameColumn(layout: SheetLayout, frame: string | number | undefined, fallback = 0): number {
  if (typeof frame === "number" && Number.isInteger(frame) && frame >= 0) return frame;
  if (typeof frame === "string") {
    if (/^\d+$/.test(frame)) return Number(frame);
    const i = layout.frames.indexOf(frame);
    if (i >= 0) return i;
  }
  return fallback;
}

export function walkColumns(layout: SheetLayout): number[] {
  const idx = ["walk0", "walk1", "walk2", "walk1"].map((f) => layout.frames.indexOf(f));
  return idx.every((i) => i >= 0) ? idx : [1, 2, 3, 2];
}

/** Row for a facing; a missing `left` row is drawn as the mirrored `right` row. */
export function facingRow(layout: SheetLayout, facing: Facing): { row: number; flipX: boolean } {
  const i = layout.directions.indexOf(facing);
  if (i >= 0) return { row: i, flipX: false };
  if (facing === "left") {
    const r = layout.directions.indexOf("right");
    if (r >= 0) return { row: r, flipX: true };
  }
  return { row: 0, flipX: false };
}

export function stillColumn(layout: SheetLayout, ch: Pick<MapCharacter, "frame" | "anim">): number {
  if (ch.frame !== undefined) return frameColumn(layout, ch.frame, 0);
  return ch.anim === "walk" ? frameColumn(layout, "walk0", 1) : frameColumn(layout, "idle", 0);
}

/** Pixel position of a character's feet: bottom-centre of its tile (x, y may be fractional). */
export function feetPx(ch: Pick<MapCharacter, "x" | "y">, tileSize = TILE_SIZE): { x: number; y: number } {
  return { x: Math.round(ch.x * tileSize + tileSize / 2), y: Math.round(ch.y * tileSize + tileSize - 1) };
}

/** Facing that walks from a to b (dominant axis). */
export function facingToward(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
}

/**
 * CLI form `path[:x[:y[:facing[:anim]]]]` (tiles). Empty fields keep defaults (`kid.png:3:4::walk`).
 * A Windows drive letter stays part of the path.
 */
export function parseCharacterArg(arg: string): MapCharacter {
  let parts = arg.split(":");
  if (parts.length > 1 && /^[a-zA-Z]$/.test(parts[0]!) && /^[\\/]/.test(parts[1] ?? "")) parts = [`${parts[0]}:${parts[1]}`, ...parts.slice(2)];
  const [sheet = "", x, y, facing, anim] = parts;
  if (!sheet) throw new Error(`--character needs a sheet path: ${arg}`);
  const num = (v: string | undefined, label: string) => {
    if (!v) return 0;
    if (!/^-?\d+(\.\d+)?$/.test(v)) throw new Error(`--character ${label} must be a number: ${arg}`);
    return Number(v);
  };
  const out: MapCharacter = { sheet, x: num(x, "x"), y: num(y, "y") };
  if (facing) {
    if (!(FACINGS as readonly string[]).includes(facing)) throw new Error(`--character facing must be ${FACINGS.join("|")}: ${arg}`);
    out.facing = facing as Facing;
  }
  if (anim) {
    if (!(CHARACTER_ANIMS as readonly string[]).includes(anim)) throw new Error(`--character anim must be idle|walk: ${arg}`);
    out.anim = anim as CharacterAnim;
  }
  return out;
}

export function characterLabel(ch: Pick<MapCharacter, "name" | "sheet">, index: number): string {
  const raw = ch.name ?? ch.sheet.split(/[\\/]/).pop()!.replace(/\.png$/i, "");
  return raw.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || `character_${index}`;
}
