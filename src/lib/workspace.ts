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

/**
 * Write the sample atlas + object PNGs (so users can repaint them) and copy the demo map + cast.
 * Without `force` this never overwrites anything: on an existing workspace it is `upgradeWorkspace`
 * (missing files are added and an old, shorter atlas gets the new rows appended, keeping repainted rows).
 * `force` overwrites the samples, tileset PNGs and config with fresh copies (repainted art and edited demo maps are lost).
 */
export async function initWorkspace(dir = process.cwd(), opts: { force?: boolean } = {}): Promise<string> {
  const root = resolveWorkspace(dir);
  if (!opts.force) {
    await upgradeWorkspace(root);
    return root;
  }
  const d = dirs(root);
  for (const p of Object.values(d)) await mkdir(p, { recursive: true });
  await writeFile(path.join(root, CONFIG_NAME), `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  await writeSampleTileset(d.tilesets, true);
  const samples = path.join(pkgRoot, "samples");
  for (const [sub, dest] of [["maps", d.maps], ["characters", d.characters], ["side", path.join(d.characters, "side")]] as const) {
    const src = path.join(samples, sub);
    if (!existsSync(src)) continue;
    await mkdir(dest, { recursive: true });
    for (const f of await readdir(src)) await copyFile(path.join(src, f), path.join(dest, f));
  }
  return root;
}

export interface UpgradeReport {
  root: string;
  /** Workspace atlas extended with the rows added since it was written (repainted rows kept). */
  atlas?: { file: string; fromRows: number; toRows: number; backup?: string };
  /** tilesets/<id>.json rewritten for the current layout. */
  tilesetMeta?: { file: string; fromRows?: number; toRows: number; backup?: string };
  /** Files that did not exist and were written (objects, sample maps and characters, config, atlas). */
  added: string[];
  /** Things left alone, with the reason (custom atlas size, …). */
  notes: string[];
  dryRun: boolean;
}

/**
 * Bring a workspace made by an older Easy Tilemap up to date without touching the user's work:
 * - tilesets/thai_village.png shorter than the current atlas (written before the city / overworld rows were
 *   appended): the missing rows are appended from the generated sample, every existing row is kept as is,
 *   and the old file is backed up to tilesets/_backup/ first. Rendering and exports already fill those rows in
 *   memory; this makes them real pixels you can repaint.
 * - tilesets/thai_village.json describing fewer rows / objects: rewritten (old copy backed up).
 * - missing object PNGs, sample maps, sample characters and the config: written.
 * Maps, characters, repainted rows and objects that exist are never overwritten. Idempotent.
 */
export async function upgradeWorkspace(dir = process.cwd(), opts: { dryRun?: boolean } = {}): Promise<UpgradeReport> {
  const root = resolveWorkspace(dir);
  const dry = Boolean(opts.dryRun);
  const rep: UpgradeReport = { root, added: [], notes: [], dryRun: dry };
  const d = dirs(root);
  const rel = (f: string) => path.relative(root, f) || f;
  const now = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`; // local time
  const backup = async (f: string): Promise<string> => {
    const to = path.join(d.tilesets, "_backup", `${path.basename(f).replace(/(\.[a-z]+)$/i, `.${stamp}$1`)}`);
    if (!dry) {
      await mkdir(path.dirname(to), { recursive: true });
      await copyFile(f, to);
    }
    return rel(to);
  };
  if (!dry) for (const p of Object.values(d)) await mkdir(p, { recursive: true });
  const cfg = path.join(root, CONFIG_NAME);
  if (!existsSync(cfg)) {
    if (!dry) await writeFile(cfg, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    rep.added.push(rel(cfg));
  }
  // atlas
  const full = generateAtlas();
  const png = path.join(d.tilesets, `${SAMPLE_TILESET_ID}.png`);
  if (!existsSync(png)) {
    if (!dry) await writeFile(png, encodePng(full));
    rep.added.push(rel(png));
  } else {
    const img = await readPng(png);
    if (img.width !== full.width) rep.notes.push(`${rel(png)} is ${img.width} px wide (the sample atlas is ${full.width}): custom atlas, left as is`);
    else if (img.height % 16 !== 0) rep.notes.push(`${rel(png)} height ${img.height} is not a multiple of 16: left as is`);
    else if (img.height < full.height) {
      const out = { width: full.width, height: full.height, data: new Uint8Array(full.data) } as RgbaImage;
      out.data.set(img.data.subarray(0, img.width * img.height * 4), 0);
      const b = await backup(png);
      if (!dry) await writeFile(png, encodePng(out));
      rep.atlas = { file: rel(png), fromRows: img.height / 16, toRows: full.height / 16, backup: b };
    }
  }
  // tileset meta
  const metaFile = path.join(d.tilesets, `${SAMPLE_TILESET_ID}.json`);
  const meta = { ...tilesetMeta(), objects: OBJECT_KINDS };
  const metaText = `${JSON.stringify(meta, null, 2)}\n`;
  if (!existsSync(metaFile)) {
    if (!dry) await writeFile(metaFile, metaText);
    rep.added.push(rel(metaFile));
  } else {
    let old: { rows?: number; objects?: Array<{ kind?: string }> } | undefined;
    try {
      old = JSON.parse(await readFile(metaFile, "utf8"));
    } catch {
      rep.notes.push(`${rel(metaFile)} is not valid JSON: left as is`);
    }
    if (old) {
      const kinds = new Set((old.objects ?? []).map((o) => o.kind));
      const stale = (typeof old.rows === "number" && old.rows < meta.rows) || OBJECT_KINDS.some((o) => !kinds.has(o.kind));
      if (stale) {
        const b = await backup(metaFile);
        if (!dry) await writeFile(metaFile, metaText);
        rep.tilesetMeta = { file: rel(metaFile), ...(typeof old.rows === "number" ? { fromRows: old.rows } : {}), toRows: meta.rows, backup: b };
      }
    }
  }
  // objects
  for (const o of OBJECT_KINDS) {
    const f = path.join(d.objects, `${o.kind}.png`);
    if (existsSync(f)) continue;
    if (!dry) await writeFile(f, encodePng(objectImage(o.kind)));
    rep.added.push(rel(f));
  }
  // sample maps + cast
  const samples = path.join(pkgRoot, "samples");
  for (const [sub, dest] of [["maps", d.maps], ["characters", d.characters], ["side", path.join(d.characters, "side")]] as const) {
    const src = path.join(samples, sub);
    if (!existsSync(src)) continue;
    if (!dry) await mkdir(dest, { recursive: true });
    for (const f of (await readdir(src)).sort()) {
      const to = path.join(dest, f);
      if (existsSync(to)) continue;
      if (!dry) await copyFile(path.join(src, f), to);
      rep.added.push(rel(to));
    }
  }
  return rep;
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
