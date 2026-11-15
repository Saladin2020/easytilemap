import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultLayout, detectGroundRow, layoutFromMeta } from "../shared/characters.js";
import { mapStats, SAFE_ID, validateMap } from "../shared/map.js";
import { OBJECT_KINDS, objectImage } from "../shared/objects.js";
import type { LoadedSheet, RenderAssets } from "../shared/render.js";
import { generateAtlas, SAMPLE_TILESET_ID, tilesetMeta } from "../shared/tileset.js";
import type { RgbaImage } from "../shared/raster.js";
import type { MapDoc, ValidateResult } from "../shared/types.js";
import { encodePng, readPng } from "./png.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** Package root, whether running from src/lib (tsx), dist/ (built) or a test. */
export const pkgRoot = [path.resolve(here, "../.."), path.resolve(here, "..")].find((p) => existsSync(path.join(p, "samples"))) ?? path.resolve(here, "../..");
export const RUNTIME_DIR = path.join(pkgRoot, "runtime");

export const CONFIG_NAME = "easytilemap.config.json";

export interface EasyTilemapConfig {
  name: string;
  tileSize: number;
  viewport: { width: number; height: number };
  tileset: string;
}

export const DEFAULT_CONFIG: EasyTilemapConfig = {
  name: "Easy Tilemap Workspace",
  tileSize: 16,
  viewport: { width: 480, height: 270 },
  tileset: SAMPLE_TILESET_ID,
};

export function assertSafeId(id: unknown, label = "map id"): string {
  if (typeof id !== "string" || !SAFE_ID.test(id)) throw new Error(`Invalid ${label} ${JSON.stringify(id)} (use a-z, 0-9, _ or -)`);
  return id;
}

export function resolveWorkspace(dir = process.cwd()): string {
  return path.resolve(dir);
}

export const dirs = (root: string) => ({
  maps: path.join(root, "maps"),
  tilesets: path.join(root, "tilesets"),
  objects: path.join(root, "tilesets", "objects"),
  characters: path.join(root, "characters"),
  exports: path.join(root, "exports"),
});

export function allowedRoots(root: string): string[] {
  const extra = (process.env.EASYTILEMAP_ALLOWED_DIRS ?? "").split(path.delimiter).map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(p));
  return [path.resolve(root), ...extra];
}

/** Resolve a user path (relative to the workspace) and refuse anything outside the allowed roots. */
export function resolveInside(root: string, p: string): string {
  const abs = path.resolve(root, p);
  const ok = allowedRoots(root).some((r) => abs === r || abs.startsWith(r + path.sep));
  if (!ok) throw new Error(`Path ${p} is outside the workspace (allow it with EASYTILEMAP_ALLOWED_DIRS)`);
  return abs;
}

/** Write the sample atlas + object PNGs (so users can repaint them) and copy the demo map + cast. */
export async function initWorkspace(dir = process.cwd(), opts: { force?: boolean } = {}): Promise<string> {
  const root = resolveWorkspace(dir);
  const d = dirs(root);
  for (const p of Object.values(d)) await mkdir(p, { recursive: true });
  const cfg = path.join(root, CONFIG_NAME);
  if (!existsSync(cfg) || opts.force) await writeFile(cfg, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  await writeSampleTileset(d.tilesets, opts.force);
  const samples = path.join(pkgRoot, "samples");
  for (const [sub, dest] of [["maps", d.maps], ["characters", d.characters]] as const) {
    const src = path.join(samples, sub);
    if (!existsSync(src)) continue;
    for (const f of await readdir(src)) {
      const to = path.join(dest, f);
      if (!existsSync(to) || opts.force) await copyFile(path.join(src, f), to);
    }
  }
  return root;
}

export async function writeSampleTileset(dir: string, force = false): Promise<string[]> {
  const written: string[] = [];
  await mkdir(path.join(dir, "objects"), { recursive: true });
  const png = path.join(dir, `${SAMPLE_TILESET_ID}.png`);
  if (!existsSync(png) || force) {
    await writeFile(png, encodePng(generateAtlas()));
    written.push(png);
  }
  const meta = path.join(dir, `${SAMPLE_TILESET_ID}.json`);
  if (!existsSync(meta) || force) {
    await writeFile(meta, `${JSON.stringify({ ...tilesetMeta(), objects: OBJECT_KINDS }, null, 2)}\n`);
    written.push(meta);
  }
  for (const o of OBJECT_KINDS) {
    const f = path.join(dir, "objects", `${o.kind}.png`);
    if (!existsSync(f) || force) {
      await writeFile(f, encodePng(objectImage(o.kind)));
      written.push(f);
    }
  }
  return written;
}

export async function loadConfig(root: string): Promise<EasyTilemapConfig> {
  const f = path.join(root, CONFIG_NAME);
  if (!existsSync(f)) return DEFAULT_CONFIG;
  const parsed = JSON.parse(await readFile(f, "utf8")) as Partial<EasyTilemapConfig>;
  return { ...DEFAULT_CONFIG, ...parsed, viewport: { ...DEFAULT_CONFIG.viewport, ...parsed.viewport } };
}

export function mapPath(root: string, id: string): string {
  return path.join(dirs(root).maps, `${assertSafeId(id)}.json`);
}

export interface MapSummary {
  id: string;
  name: string;
  file: string;
  width: number;
  height: number;
  objects: number;
  characters: number;
  spawns: number;
  errors: number;
  warnings: number;
  modified: string;
}

export async function listMaps(root: string): Promise<MapSummary[]> {
  const d = dirs(root).maps;
  if (!existsSync(d)) return [];
  const out: MapSummary[] = [];
  for (const f of (await readdir(d)).sort()) {
    if (!f.endsWith(".json")) continue;
    const id = f.slice(0, -5);
    if (!SAFE_ID.test(id)) continue;
    const file = path.join(d, f);
    let res: ValidateResult;
    try {
      res = validateMap(JSON.parse(await readFile(file, "utf8")), { id });
    } catch (e) {
      res = { doc: null, errors: [{ severity: "error", message: `Bad JSON: ${(e as Error).message}` }], warnings: [] };
    }
    const doc = res.doc;
    out.push({
      id,
      name: doc?.name ?? id,
      file,
      width: doc?.width ?? 0,
      height: doc?.height ?? 0,
      objects: doc?.objects.length ?? 0,
      characters: doc?.characters.length ?? 0,
      spawns: doc?.spawns.length ?? 0,
      errors: res.errors.length,
      warnings: res.warnings.length,
      modified: (await stat(file)).mtime.toISOString(),
    });
  }
  return out;
}

export async function readMapFile(file: string, id?: string): Promise<ValidateResult & { raw: unknown }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    return { raw: null, doc: null, errors: [{ severity: "error", message: `${path.basename(file)}: bad JSON — ${(e as Error).message}` }], warnings: [] };
  }
  return { raw, ...validateMap(raw, { id: id ?? (typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : path.basename(file, ".json")) }) };
}

export async function readMap(root: string, id: string): Promise<ValidateResult & { raw: unknown }> {
  const file = mapPath(root, id);
  if (!existsSync(file)) throw new Error(`Map "${id}" not found (list them with: easytilemap list)`);
  return readMapFile(file, id);
}

export async function loadMap(root: string, id: string): Promise<MapDoc> {
  const res = await readMap(root, id);
  if (!res.doc) throw new Error(`Map "${id}" has ${res.errors.length} error(s):\n${res.errors.slice(0, 5).map((e) => `  ${e.path ?? ""} ${e.message}`).join("\n")}`);
  return res.doc;
}

/** Validate then save. Refuses to save a map with errors unless `force`. */
export async function saveMap(root: string, input: unknown, opts: { id?: string; dryRun?: boolean; force?: boolean } = {}): Promise<{ file: string; saved: boolean } & ValidateResult> {
  const res = validateMap(input, { id: opts.id });
  const id = assertSafeId(opts.id ?? (input as { id?: unknown })?.id);
  const file = mapPath(root, id);
  if (opts.dryRun || (!res.doc && !opts.force) || !res.doc) return { file, saved: false, ...res };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serializeMap(res.doc));
  return { file, saved: true, ...res };
}

/** Pretty JSON with one string per row (diff-friendly). */
export function serializeMap(doc: MapDoc): string {
  return `${JSON.stringify(doc, (_k, v) => v, 2).replace(/\[\n\s+(-?\d+(?:\.\d+)?),\n\s+(-?\d+(?:\.\d+)?)\n\s+\]/g, "[$1, $2]")}\n`;
}

// ---------------------------------------------------------------- assets

/** Atlas: the workspace's tilesets/<id>.png when present (repainted art), else the generated sample. */
export async function loadAtlas(root: string, tileset = SAMPLE_TILESET_ID): Promise<RgbaImage> {
  const f = path.join(dirs(root).tilesets, `${tileset}.png`);
  if (existsSync(f)) {
    const img = await readPng(f);
    // An atlas written before newer rows were appended (city, overworld): keep the repainted rows and
    // take the missing ones from the generated sample, so new terrains still draw.
    const full = generateAtlas();
    if (img.width === full.width && img.height < full.height) {
      const out = { width: full.width, height: full.height, data: new Uint8Array(full.data) } as RgbaImage;
      out.data.set(img.data.subarray(0, img.width * img.height * 4), 0);
      return out;
    }
    return img;
  }
  if (tileset !== SAMPLE_TILESET_ID) throw new Error(`Tileset "${tileset}" not found in ${dirs(root).tilesets}`);
  return generateAtlas();
}

export async function loadObjectImages(root: string): Promise<Map<string, RgbaImage>> {
  const out = new Map<string, RgbaImage>();
  for (const o of OBJECT_KINDS) {
    const f = path.join(dirs(root).objects, `${o.kind}.png`);
    out.set(o.kind, existsSync(f) ? await readPng(f) : objectImage(o.kind));
  }
  return out;
}

/** Load an Easy Sprite sheet + sibling JSON layout; groundRow detected from the idle frame. */
export async function loadSheet(file: string): Promise<LoadedSheet> {
  const img = await readPng(file);
  let layout = defaultLayout(img);
  const meta = file.replace(/\.png$/i, ".json");
  if (existsSync(meta)) {
    try {
      layout = layoutFromMeta(JSON.parse(await readFile(meta, "utf8"))) ?? layout;
    } catch {
      // keep defaults
    }
  }
  const groundRow = detectGroundRow(img, layout.frameSize, Math.max(0, layout.frames.indexOf("idle")), 0);
  return { img, layout, ...(groundRow !== undefined ? { groundRow } : {}) };
}

export interface LoadedAssets extends RenderAssets {
  objects: Map<string, RgbaImage>;
  sheetFiles: Map<string, string>;
  warnings: string[];
}

export async function loadAssets(root: string, doc: MapDoc, opts: { trusted?: boolean } = {}): Promise<LoadedAssets> {
  const atlas = await loadAtlas(root, doc.tileset);
  const objects = await loadObjectImages(root);
  const sheets = new Map<string, LoadedSheet>();
  const sheetFiles = new Map<string, string>();
  const warnings: string[] = [];
  for (const ch of doc.characters) {
    if (sheets.has(ch.sheet)) continue;
    try {
      const file = opts.trusted ? path.resolve(root, ch.sheet) : resolveInside(root, ch.sheet);
      if (!existsSync(file)) {
        warnings.push(`Character sheet not found: ${ch.sheet}`);
        continue;
      }
      const s = await loadSheet(file);
      if (s.layout.directions.length < 4) warnings.push(`${ch.sheet} is a ${s.layout.view ?? "side"}-view sheet; top-down maps expect 4 rows (front/right/back/left)`);
      sheets.set(ch.sheet, s);
      sheetFiles.set(ch.sheet, file);
    } catch (e) {
      warnings.push((e as Error).message);
    }
  }
  return { atlas, objects, object: (k) => objects.get(k), sheets, sheetFiles, warnings };
}

export async function listCharacters(root: string): Promise<string[]> {
  const d = dirs(root).characters;
  if (!existsSync(d)) return [];
  return (await readdir(d)).filter((f) => f.endsWith(".png")).sort().map((f) => `characters/${f}`);
}

export async function workspaceSummary(root: string) {
  const maps = await listMaps(root);
  return {
    root,
    config: await loadConfig(root),
    ...dirs(root),
    maps,
    characters: await listCharacters(root),
    objects: OBJECT_KINDS,
  };
}

export { mapStats };
