/** Map document — `easytilemap/1`. Shared by the CLI, API, MCP server, web editor and exporters. */

export const FORMAT = "easytilemap/1" as const;
export const TILE_SIZE = 16;

/** Ground terrains. `grass` is the base; the others autotile (blob-47) over it. */
export const TERRAINS = ["grass", "dirt", "paddy", "water", "stone", "sand"] as const;
export type Terrain = (typeof TERRAINS)[number];
export const TERRAIN_CODE: Record<Terrain, string> = { grass: "g", dirt: "d", paddy: "p", water: "w", stone: "s", sand: "b" };
export const CODE_TERRAIN: Record<string, Terrain> = { g: "grass", d: "dirt", p: "paddy", w: "water", s: "stone", b: "sand" };
export const TERRAIN_LABELS: Record<Terrain, { en: string; th: string }> = {
  grass: { en: "Grass", th: "หญ้า" },
  dirt: { en: "Dirt path", th: "ทางดิน" },
  paddy: { en: "Rice paddy", th: "นาข้าว" },
  water: { en: "Canal water", th: "คลอง" },
  stone: { en: "Temple stone", th: "ลานหิน" },
  sand: { en: "Beach sand", th: "หาดทราย" },
};

/** Decor tiles (one 16px tile each, drawn over the ground). `.` = empty. */
export const DECOR_CODES = ["f", "t", "r", "l", "e", "u", "n", "k"] as const;
export type DecorCode = (typeof DECOR_CODES)[number];
export const DECOR_LABELS: Record<DecorCode, { en: string; th: string }> = {
  f: { en: "Flowers", th: "ดอกไม้" },
  t: { en: "Grass tuft", th: "กอหญ้า" },
  r: { en: "Rocks", th: "ก้อนหิน" },
  l: { en: "Lotus", th: "บัว" },
  e: { en: "Pebbles", th: "กรวด" },
  u: { en: "Stump", th: "ตอไม้" },
  n: { en: "Reeds", th: "ต้นกก" },
  k: { en: "Fence", th: "รั้วไม้" },
};

/** Collision layer: `#` blocked, `o` forced open (overrides water / objects), `.` automatic. */
export const COLLISION_CODES = ["#", "o", "."] as const;
export type CollisionCode = (typeof COLLISION_CODES)[number];

export const LAYER_NAMES = ["ground", "decor", "collision"] as const;
export type LayerName = (typeof LAYER_NAMES)[number];

export interface MapLayers {
  /** One terrain code per cell (g d p w s). */
  ground: string[];
  /** Decor codes or `.`. */
  decor: string[];
  /** `#` / `o` / `.`. */
  collision: string[];
}

export interface MapObject {
  /** Object kind from the tileset catalog (`house_wood`, `temple`, …). */
  kind: string;
  /** Top-left of the object image, in tiles. */
  x: number;
  y: number;
  /** Optional node name in exports. */
  name?: string;
  flipX?: boolean;
}

export const FACINGS = ["front", "right", "back", "left"] as const;
export type Facing = (typeof FACINGS)[number];
export const CHARACTER_ANIMS = ["idle", "walk"] as const;
export type CharacterAnim = (typeof CHARACTER_ANIMS)[number];

export interface Spawn {
  name: string;
  /** Tile coordinates. */
  x: number;
  y: number;
  facing?: Facing;
}

/**
 * Easy Sprite top-down character (native sheet, 48×48 frames, rows front/right/back/left).
 * Same idea as Easy Scene's `characters[]`, but positions are tiles (feet = bottom-centre of the tile).
 */
export interface MapCharacter {
  sheet: string;
  name?: string;
  x: number;
  y: number;
  facing?: Facing;
  anim?: CharacterAnim;
  frame?: string | number;
  /** Lowest opaque row of the frame (detected from the sheet when omitted; Easy Sprite top-down = 45). */
  groundRow?: number;
  /** Walk a loop of tile waypoints (px/s speed, default 24). */
  patrol?: { path: Array<[number, number]>; speed?: number };
}

export interface MapDoc {
  format: typeof FORMAT;
  id: string;
  name: string;
  tileSize: number;
  width: number;
  height: number;
  tileset: string;
  viewport: { width: number; height: number };
  layers: MapLayers;
  objects: MapObject[];
  spawns: Spawn[];
  characters: MapCharacter[];
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  /** JSON-ish path, e.g. `objects[3]` or `layers.ground[4]`. */
  path?: string;
  /** Tile coordinate when the problem is at a cell. */
  x?: number;
  y?: number;
}

export interface ValidateResult {
  doc: MapDoc | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export const DEFAULT_VIEWPORT = { width: 480, height: 270 } as const;
export const MAX_MAP_SIZE = 256;
