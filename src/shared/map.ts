/**
 * Map documents: create, validate/normalize (with path + cell diagnostics), collision and edit ops.
 * Pure: shared by the CLI, API, MCP server, exporters and the web editor.
 */
import { OBJECT_BY_KIND, OBJECT_KINDS } from "./objects.js";
import {
  CHARACTER_ANIMS,
  CODE_TERRAIN,
  DECOR_CODES,
  DECOR_NAMES,
  DEFAULT_VIEWPORT,
  FACINGS,
  FORMAT,
  MAX_MAP_SIZE,
  TERRAIN_CODE,
  TILE_SIZE,
  type CharacterAnim,
  type Diagnostic,
  type Facing,
  type LayerName,
  type MapCharacter,
  type MapDoc,
  type MapObject,
  type Spawn,
  type Terrain,
  type ValidateResult,
} from "./types.js";

export const SAFE_ID = /^[a-z0-9_-]+$/;

export function blankRows(width: number, height: number, ch: string): string[] {
  return Array.from({ length: height }, () => ch.repeat(width));
}

export function createMap(opts: { id: string; name?: string; width?: number; height?: number; fill?: Terrain; tileset?: string }): MapDoc {
  const width = clampSize(opts.width ?? 40);
  const height = clampSize(opts.height ?? 28);
  return {
    format: FORMAT,
    id: opts.id,
    name: opts.name ?? opts.id,
    tileSize: TILE_SIZE,
    width,
    height,
    tileset: opts.tileset ?? "thai_village",
    viewport: { ...DEFAULT_VIEWPORT },
    layers: {
      ground: blankRows(width, height, TERRAIN_CODE[opts.fill ?? "grass"]),
      decor: blankRows(width, height, "."),
      collision: blankRows(width, height, "."),
    },
    objects: [],
    spawns: [],
    characters: [],
  };
}

function clampSize(n: number): number {
  return Math.max(1, Math.min(MAX_MAP_SIZE, Math.round(n)));
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length]![b.length]!;
}

export function suggest(word: string, options: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const o of options) {
    const dd = editDistance(word, o);
    if (dd < bestD) {
      bestD = dd;
      best = o;
    }
  }
  return best && bestD <= Math.max(2, Math.floor(word.length / 3)) ? best : undefined;
}

function normalizeLayer(
  rows: unknown,
  name: LayerName,
  width: number,
  height: number,
  allowed: (ch: string) => boolean,
  fill: string,
  diags: Diagnostic[],
): string[] {
  const out: string[] = [];
  const src = Array.isArray(rows) ? rows : [];
  if (rows !== undefined && !Array.isArray(rows)) diags.push({ severity: "error", message: `layers.${name} must be an array of strings`, path: `layers.${name}` });
  if (Array.isArray(rows) && rows.length && rows.length !== height) {
    diags.push({ severity: "warning", message: `layers.${name} has ${rows.length} rows, map height is ${height} — padded/cropped`, path: `layers.${name}` });
  }
  let reported = 0;
  for (let y = 0; y < height; y++) {
    const raw = typeof src[y] === "string" ? (src[y] as string) : "";
    if (src[y] !== undefined && typeof src[y] !== "string") diags.push({ severity: "error", message: `layers.${name}[${y}] must be a string`, path: `layers.${name}[${y}]` });
    if (raw.length && raw.length !== width && reported < 3) {
      reported++;
      diags.push({ severity: "warning", message: `layers.${name}[${y}] has ${raw.length} cells, map width is ${width} — padded/cropped`, path: `layers.${name}[${y}]`, y });
    }
    let row = "";
    for (let x = 0; x < width; x++) {
      const ch = raw[x] ?? fill;
      if (allowed(ch)) row += ch;
      else {
        row += fill;
        diags.push({ severity: "error", message: `Unknown ${name} code "${ch}" at ${x},${y}`, path: `layers.${name}[${y}]`, x, y });
      }
    }
    out.push(row);
  }
  return out;
}

/** Validate a map from JSON / MCP / the editor. Returns a normalized copy plus diagnostics. */
export function validateMap(input: unknown, opts: { id?: string } = {}): ValidateResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const diags: Diagnostic[] = [];
  const push = () => {
    for (const d of diags.splice(0)) (d.severity === "error" ? errors : warnings).push(d);
  };
  if (!input || typeof input !== "object") return { doc: null, errors: [{ severity: "error", message: "Map must be a JSON object" }], warnings };
  const m = input as Partial<MapDoc> & Record<string, unknown>;
  if (m.format !== undefined && m.format !== FORMAT) diags.push({ severity: "error", message: `format must be "${FORMAT}" (got ${JSON.stringify(m.format)})`, path: "format" });
  const id = opts.id ?? (typeof m.id === "string" ? m.id : "");
  if (!SAFE_ID.test(id)) diags.push({ severity: "error", message: `id ${JSON.stringify(id)} must match ${SAFE_ID}`, path: "id" });
  const firstRow = Array.isArray(m.layers?.ground) && typeof m.layers.ground[0] === "string" ? m.layers.ground[0].length : 0;
  const width = finite(m.width) ? clampSize(m.width) : firstRow || 40;
  const height = finite(m.height) ? clampSize(m.height) : Array.isArray(m.layers?.ground) ? m.layers.ground.length || 28 : 28;
  if (finite(m.width) && (m.width < 1 || m.width > MAX_MAP_SIZE)) diags.push({ severity: "error", message: `width must be 1..${MAX_MAP_SIZE}`, path: "width" });
  if (finite(m.height) && (m.height < 1 || m.height > MAX_MAP_SIZE)) diags.push({ severity: "error", message: `height must be 1..${MAX_MAP_SIZE}`, path: "height" });
  if (m.tileSize !== undefined && m.tileSize !== TILE_SIZE) diags.push({ severity: "warning", message: `tileSize ${String(m.tileSize)} is not supported yet — using ${TILE_SIZE}`, path: "tileSize" });

  const layers = (m.layers ?? {}) as Partial<MapDoc["layers"]>;
  const ground = normalizeLayer(layers.ground, "ground", width, height, (ch) => ch in CODE_TERRAIN, "g", diags);
  const decor = normalizeLayer(layers.decor, "decor", width, height, (ch) => ch === "." || (DECOR_CODES as readonly string[]).includes(ch), ".", diags);
  const collision = normalizeLayer(layers.collision, "collision", width, height, (ch) => ch === "." || ch === "#" || ch === "o", ".", diags);

  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const objects: MapObject[] = [];
  (Array.isArray(m.objects) ? m.objects : []).forEach((raw, i) => {
    const o = raw as Partial<MapObject> | null;
    const p = `objects[${i}]`;
    if (!o || typeof o.kind !== "string") return diags.push({ severity: "error", message: `${p} needs a kind`, path: p });
    const kind = OBJECT_BY_KIND.get(o.kind);
    if (!kind) {
      const s = suggest(o.kind, OBJECT_KINDS.map((k) => k.kind));
      return diags.push({ severity: "error", message: `${p}: unknown object kind "${o.kind}"${s ? ` — did you mean "${s}"?` : ""}`, path: p });
    }
    if (!finite(o.x) || !finite(o.y)) return diags.push({ severity: "error", message: `${p} (${o.kind}) needs numeric x and y (tiles)`, path: p });
    const obj: MapObject = { kind: o.kind, x: Math.round(o.x), y: Math.round(o.y) };
    if (typeof o.name === "string" && o.name.trim()) obj.name = o.name.trim();
    if (o.flipX) obj.flipX = true;
    if (!inMap(obj.x, obj.y) || !inMap(obj.x + kind.w - 1, obj.y + kind.h - 1)) diags.push({ severity: "warning", message: `${p} (${o.kind}) sticks out of the map`, path: p, x: obj.x, y: obj.y });
    objects.push(obj);
  });

  const spawns: Spawn[] = [];
  const spawnNames = new Set<string>();
  (Array.isArray(m.spawns) ? m.spawns : []).forEach((raw, i) => {
    const s = raw as Partial<Spawn> | null;
    const p = `spawns[${i}]`;
    if (!s || typeof s.name !== "string" || !/^[A-Za-z0-9_-]+$/.test(s.name)) return diags.push({ severity: "error", message: `${p} needs a name (A-Z a-z 0-9 _ -)`, path: p });
    if (!finite(s.x) || !finite(s.y)) return diags.push({ severity: "error", message: `${p} "${s.name}" needs numeric x and y`, path: p });
    if (spawnNames.has(s.name)) diags.push({ severity: "error", message: `${p}: duplicate spawn name "${s.name}"`, path: p });
    spawnNames.add(s.name);
    const sp: Spawn = { name: s.name, x: Math.round(s.x), y: Math.round(s.y) };
    if (s.facing !== undefined) {
      if ((FACINGS as readonly string[]).includes(s.facing)) sp.facing = s.facing;
      else diags.push({ severity: "warning", message: `${p}: unknown facing "${String(s.facing)}" (${FACINGS.join(" | ")})`, path: p });
    }
    if (!inMap(sp.x, sp.y)) diags.push({ severity: "warning", message: `${p} "${s.name}" is outside the map`, path: p, x: sp.x, y: sp.y });
    spawns.push(sp);
  });

  const { characters, warnings: cw } = normalizeCharacters(Array.isArray(m.characters) ? m.characters : []);
  cw.forEach((w) => diags.push({ severity: "warning", message: w, path: "characters" }));

  const name = typeof m.name === "string" && m.name.trim() ? m.name.trim() : id || "map";
  const vp = m.viewport && finite(m.viewport.width) && finite(m.viewport.height) ? { width: Math.round(m.viewport.width), height: Math.round(m.viewport.height) } : { ...DEFAULT_VIEWPORT };
  const doc: MapDoc = {
    format: FORMAT,
    id,
    name,
    tileSize: TILE_SIZE,
    width,
    height,
    tileset: typeof m.tileset === "string" && m.tileset ? m.tileset : "thai_village",
    viewport: vp,
    layers: { ground, decor, collision },
    objects,
    spawns,
    characters,
  };

  // semantic warnings
  const blocked = collisionGrid(doc);
  for (const s of spawns) {
    if (inMap(s.x, s.y) && blocked[s.y]![s.x]) diags.push({ severity: "warning", message: `Spawn "${s.name}" is on a blocked tile (${s.x},${s.y})`, path: "spawns", x: s.x, y: s.y });
  }
  characters.forEach((ch, i) => {
    const tx = Math.floor(ch.x);
    const ty = Math.floor(ch.y);
    if (!inMap(tx, ty)) diags.push({ severity: "warning", message: `characters[${i}] is outside the map`, path: `characters[${i}]` });
    else if (blocked[ty]![tx]) diags.push({ severity: "warning", message: `characters[${i}]${ch.name ? ` "${ch.name}"` : ""} stands on a blocked tile (${tx},${ty})`, path: `characters[${i}]`, x: tx, y: ty });
  });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (decor[y]![x] === "l" && ground[y]![x] !== "w") diags.push({ severity: "warning", message: `Lotus at ${x},${y} is not on water`, path: `layers.decor[${y}]`, x, y });
    }
  }
  push();
  const hasErrors = errors.length > 0;
  return { doc: hasErrors ? null : doc, errors, warnings };
}

export function normalizeCharacters(list: readonly unknown[]): { characters: MapCharacter[]; warnings: string[] } {
  const characters: MapCharacter[] = [];
  const warnings: string[] = [];
  list.forEach((raw, i) => {
    const c = raw as Partial<MapCharacter> | null;
    if (!c || typeof c.sheet !== "string" || !c.sheet.trim()) return warnings.push(`characters[${i}] has no sheet path — skipped`);
    if (!finite(c.x) || !finite(c.y)) return warnings.push(`characters[${i}] needs numeric x and y (tiles) — skipped`);
    const out: MapCharacter = { sheet: c.sheet.trim(), x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 };
    if (typeof c.name === "string" && c.name.trim()) out.name = c.name.trim();
    if (c.facing !== undefined) {
      if ((FACINGS as readonly string[]).includes(c.facing)) out.facing = c.facing;
      else warnings.push(`characters[${i}]: unknown facing "${String(c.facing)}" (${FACINGS.join(" | ")})`);
    }
    if (c.anim !== undefined) {
      if ((CHARACTER_ANIMS as readonly string[]).includes(c.anim)) out.anim = c.anim;
      else warnings.push(`characters[${i}]: unknown anim "${String(c.anim)}" (idle | walk)`);
    }
    if ((typeof c.frame === "string" && c.frame.trim()) || (finite(c.frame) && c.frame >= 0)) out.frame = typeof c.frame === "string" ? c.frame.trim() : Math.round(c.frame as number);
    if (finite(c.groundRow) && c.groundRow >= 0) out.groundRow = Math.round(c.groundRow);
    if (c.patrol && Array.isArray(c.patrol.path)) {
      const path = c.patrol.path.filter((p): p is [number, number] => Array.isArray(p) && finite(p[0]) && finite(p[1])).map(([x, y]) => [x, y] as [number, number]);
      if (path.length >= 2) out.patrol = { path, ...(finite(c.patrol.speed) && c.patrol.speed >= 0 ? { speed: c.patrol.speed } : {}) };
      else warnings.push(`characters[${i}]: patrol needs at least 2 waypoints`);
    }
    characters.push(out);
  });
  return { characters, warnings };
}

// ---------------------------------------------------------------- collision

/**
 * Blocked cells: water, solid object footprints, painted `#`; floor objects (bridges, boats) and
 * painted `o` force a cell open. Row-major booleans.
 */
export function collisionGrid(doc: Pick<MapDoc, "width" | "height" | "layers" | "objects">): boolean[][] {
  const g: boolean[][] = Array.from({ length: doc.height }, (_, y) => Array.from({ length: doc.width }, (_, x) => doc.layers.ground[y]?.[x] === "w"));
  const mark = (x: number, y: number, v: boolean) => {
    if (y >= 0 && y < doc.height && x >= 0 && x < doc.width) g[y]![x] = v;
  };
  for (const o of doc.objects) {
    const k = OBJECT_BY_KIND.get(o.kind);
    if (!k?.solid) continue;
    for (let y = 0; y < k.solid.h; y++) for (let x = 0; x < k.solid.w; x++) mark(o.x + k.solid.x + x, o.y + k.solid.y + y, true);
  }
  for (const o of doc.objects) {
    const k = OBJECT_BY_KIND.get(o.kind);
    if (!k?.floor || o.kind === "boat") continue;
    for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) mark(o.x + x, o.y + y, false);
  }
  doc.layers.collision.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#") mark(x, y, true);
      else if (row[x] === "o") mark(x, y, false);
    }
  });
  return g;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Merge blocked cells into rectangles (horizontal runs, then stacked vertically when identical). Tile units. */
export function collisionRects(grid: boolean[][]): Rect[] {
  const runs: Rect[] = [];
  grid.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const hit = x < row.length && row[x];
      if (hit && start < 0) start = x;
      if (!hit && start >= 0) {
        runs.push({ x: start, y, w: x - start, h: 1 });
        start = -1;
      }
    }
  });
  const out: Rect[] = [];
  const open = new Map<string, Rect>();
  for (const r of runs) {
    const key = `${r.x}:${r.w}`;
    const prev = open.get(key);
    if (prev && prev.y + prev.h === r.y) prev.h++;
    else {
      const n = { ...r };
      out.push(n);
      open.set(key, n);
    }
  }
  return out;
}

// ---------------------------------------------------------------- edit ops (CLI / MCP / editor)

export type MapOp =
  | { op: "fill"; layer: LayerName; code: string; x: number; y: number; w: number; h: number }
  | { op: "paint"; layer: LayerName; code: string; cells: Array<[number, number]> }
  | { op: "line"; layer: LayerName; code: string; from: [number, number]; to: [number, number]; width?: number }
  | { op: "path"; layer: LayerName; code: string; points: Array<[number, number]>; width?: number }
  | { op: "place"; kind: string; x: number; y: number; name?: string; flipX?: boolean }
  | { op: "remove_object"; index?: number; x?: number; y?: number }
  | { op: "spawn"; name: string; x: number; y: number; facing?: Facing }
  | { op: "remove_spawn"; name: string }
  | { op: "character"; sheet: string; x: number; y: number; name?: string; facing?: Facing; anim?: CharacterAnim; patrol?: { path: Array<[number, number]>; speed?: number } }
  | { op: "remove_character"; name?: string; index?: number }
  | { op: "resize"; width: number; height: number; fill?: Terrain };

export const TERRAIN_ALIASES: Record<string, string> = Object.fromEntries(Object.entries(TERRAIN_CODE).map(([t, code]) => [t, code]));

/** Accept terrain names (`water`) as well as codes (`w`) for the ground layer; `erase` clears decor/collision. */
export function layerCode(layer: LayerName, code: string): string {
  if (layer === "ground") return TERRAIN_ALIASES[code] ?? code;
  if (code === "erase" || code === "none" || code === "") return ".";
  if (layer === "collision" && (code === "block" || code === "solid")) return "#";
  if (layer === "collision" && code === "open") return "o";
  if (layer === "decor") {
    return (DECOR_NAMES as Record<string, string>)[code] ?? code;
  }
  return code;
}

function setCell(rows: string[], x: number, y: number, ch: string): void {
  const row = rows[y];
  if (row === undefined || x < 0 || x >= row.length) return;
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

function lineCells(from: [number, number], to: [number, number], width = 1): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const [x0, y0] = from;
  const [x1, y1] = to;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const half = Math.floor((width - 1) / 2);
  for (let i = 0; i <= n; i++) {
    const cx = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
    const cy = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
    for (let dy = -half; dy < width - half; dy++) for (let dx = -half; dx < width - half; dx++) out.push([cx + dx, cy + dy]);
  }
  return out;
}

/** Apply edit ops to a copy of the map. Unknown codes / kinds throw with a helpful message. */
export function applyOps(doc: MapDoc, ops: readonly MapOp[]): MapDoc {
  const d: MapDoc = structuredClone(doc);
  const check = (layer: LayerName, code: string) => {
    const ok =
      layer === "ground" ? code in CODE_TERRAIN : layer === "decor" ? code === "." || (DECOR_CODES as readonly string[]).includes(code) : code === "." || code === "#" || code === "o";
    if (!ok) throw new Error(`Unknown ${layer} code "${code}"`);
  };
  for (const op of ops) {
    switch (op.op) {
      case "fill": {
        const code = layerCode(op.layer, op.code);
        check(op.layer, code);
        for (let y = op.y; y < op.y + op.h; y++) for (let x = op.x; x < op.x + op.w; x++) setCell(d.layers[op.layer], x, y, code);
        break;
      }
      case "paint": {
        const code = layerCode(op.layer, op.code);
        check(op.layer, code);
        for (const [x, y] of op.cells) setCell(d.layers[op.layer], x, y, code);
        break;
      }
      case "line":
      case "path": {
        const code = layerCode(op.layer, op.code);
        check(op.layer, code);
        const pts = op.op === "line" ? [op.from, op.to] : op.points;
        for (let i = 0; i + 1 < pts.length; i++) for (const [x, y] of lineCells(pts[i]!, pts[i + 1]!, op.width ?? 1)) setCell(d.layers[op.layer], x, y, code);
        break;
      }
      case "place": {
        if (!OBJECT_BY_KIND.has(op.kind)) {
          const s = suggest(op.kind, OBJECT_KINDS.map((k) => k.kind));
          throw new Error(`Unknown object kind "${op.kind}"${s ? ` — did you mean "${s}"?` : ""}`);
        }
        d.objects.push({ kind: op.kind, x: Math.round(op.x), y: Math.round(op.y), ...(op.name ? { name: op.name } : {}), ...(op.flipX ? { flipX: true } : {}) });
        break;
      }
      case "remove_object": {
        if (op.index !== undefined) d.objects.splice(op.index, 1);
        else if (op.x !== undefined && op.y !== undefined) {
          const i = objectAt(d, op.x, op.y);
          if (i >= 0) d.objects.splice(i, 1);
        }
        break;
      }
      case "spawn":
        d.spawns = d.spawns.filter((s) => s.name !== op.name);
        d.spawns.push({ name: op.name, x: Math.round(op.x), y: Math.round(op.y), ...(op.facing ? { facing: op.facing } : {}) });
        break;
      case "remove_spawn":
        d.spawns = d.spawns.filter((s) => s.name !== op.name);
        break;
      case "character": {
        const { characters } = normalizeCharacters([{ sheet: op.sheet, x: op.x, y: op.y, name: op.name, facing: op.facing, anim: op.anim, patrol: op.patrol }]);
        if (op.name) d.characters = d.characters.filter((c) => c.name !== op.name);
        d.characters.push(...characters);
        break;
      }
      case "remove_character":
        d.characters = d.characters.filter((c, i) => (op.name ? c.name !== op.name : i !== op.index));
        break;
      case "resize": {
        const w = clampSize(op.width);
        const h = clampSize(op.height);
        const fillG = TERRAIN_CODE[op.fill ?? "grass"];
        const fit = (rows: string[], ch: string) => Array.from({ length: h }, (_, y) => (rows[y] ?? "").slice(0, w).padEnd(w, ch));
        d.layers = { ground: fit(d.layers.ground, fillG), decor: fit(d.layers.decor, "."), collision: fit(d.layers.collision, ".") };
        d.width = w;
        d.height = h;
        break;
      }
      default:
        throw new Error(`Unknown op ${JSON.stringify((op as { op?: unknown }).op)}`);
    }
  }
  return d;
}

/** Topmost object whose image covers tile (x, y), or -1. */
export function objectAt(doc: Pick<MapDoc, "objects">, x: number, y: number): number {
  for (let i = doc.objects.length - 1; i >= 0; i--) {
    const o = doc.objects[i]!;
    const k = OBJECT_BY_KIND.get(o.kind);
    if (k && x >= o.x && x < o.x + k.w && y >= o.y && y < o.y + k.h) return i;
  }
  return -1;
}

/** ASCII overview for agents: ground codes with objects (`O`), spawns (`S`), characters (`@`) and blocked cells. */
export function asciiMap(doc: MapDoc): string {
  const grid = doc.layers.ground.map((r) => r.split(""));
  for (const o of doc.objects) {
    const k = OBJECT_BY_KIND.get(o.kind);
    if (!k) continue;
    for (let y = 0; y < k.h; y++) for (let x = 0; x < k.w; x++) if (grid[o.y + y]?.[o.x + x] !== undefined) grid[o.y + y]![o.x + x] = k.floor ? "=" : "O";
  }
  for (const s of doc.spawns) if (grid[s.y]?.[s.x] !== undefined) grid[s.y]![s.x] = "S";
  for (const c of doc.characters) {
    const x = Math.floor(c.x);
    const y = Math.floor(c.y);
    if (grid[y]?.[x] !== undefined) grid[y]![x] = "@";
  }
  return grid.map((r) => r.join("")).join("\n");
}

export function mapStats(doc: MapDoc) {
  const counts: Record<string, number> = {};
  for (const row of doc.layers.ground) for (const ch of row) counts[CODE_TERRAIN[ch] ?? ch] = (counts[CODE_TERRAIN[ch] ?? ch] ?? 0) + 1;
  const blocked = collisionGrid(doc).flat().filter(Boolean).length;
  const decor = doc.layers.decor.join("").replace(/\./g, "").length;
  return { size: `${doc.width}×${doc.height}`, pixels: `${doc.width * doc.tileSize}×${doc.height * doc.tileSize}`, terrain: counts, decor, objects: doc.objects.length, spawns: doc.spawns.length, characters: doc.characters.length, blocked };
}
