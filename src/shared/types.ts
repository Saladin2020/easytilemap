/** Map document — `easytilemap/1`. Shared by the CLI, API, MCP server, web editor and exporters. */

export const FORMAT = "easytilemap/1" as const;
export const TILE_SIZE = 16;

/**
 * Ground terrains. `grass` is the base; the blob terrains autotile (blob-47) over it. The overworld
 * line terrains (rail, level crossing, rail / road bridge, station) join along their 4 sides instead
 * (see LINE_TERRAINS and autotile.ts).
 */
export const TERRAINS = [
  "grass", "dirt", "paddy", "water", "stone", "sand", "sidewalk", "road",
  // overworld (world map) set
  "forest", "mountain", "field",
  "rail", "crossing", "rail_bridge", "road_bridge", "station",
  // appended later: never reorder (codes and terrain ids are part of saved maps and Godot TileSets)
  "tunnel",
] as const;
export type Terrain = (typeof TERRAINS)[number];
export const TERRAIN_CODE: Record<Terrain, string> = {
  grass: "g", dirt: "d", paddy: "p", water: "w", stone: "s", sand: "b", sidewalk: "v", road: "a",
  forest: "F", mountain: "M", field: "C",
  rail: "T", crossing: "X", rail_bridge: "H", road_bridge: "J", station: "Z",
  tunnel: "U",
};
export const CODE_TERRAIN: Record<string, Terrain> = Object.fromEntries(Object.entries(TERRAIN_CODE).map(([t, c]) => [c, t as Terrain]));
/** Line terrains: rails, crossings, bridges, stations and tunnels, autotiled from their N/E/S/W neighbours. */
export const LINE_TERRAINS = ["rail", "crossing", "rail_bridge", "road_bridge", "station", "tunnel"] as const satisfies readonly Terrain[];
export type LineTerrain = (typeof LINE_TERRAINS)[number];
/** Terrains that block walking (water, mountains, rail tunnels: only the train goes through). Bridges and everything else are walkable. */
export const BLOCKING_CODES = new Set(["w", "M", "U"]);
export const TERRAIN_LABELS: Record<Terrain, { en: string; th: string }> = {
  grass: { en: "Grass", th: "หญ้า" },
  dirt: { en: "Dirt path", th: "ทางดิน" },
  paddy: { en: "Rice paddy", th: "นาข้าว" },
  water: { en: "Canal water", th: "คลอง" },
  stone: { en: "Temple stone", th: "ลานหิน" },
  sand: { en: "Beach sand", th: "หาดทราย" },
  sidewalk: { en: "Sidewalk paving", th: "ทางเท้า" },
  road: { en: "Asphalt road", th: "ถนนลาดยาง" },
  forest: { en: "Forest", th: "ป่า" },
  mountain: { en: "Mountains", th: "ภูเขา" },
  field: { en: "Farm field", th: "ไร่นา" },
  rail: { en: "Railway track", th: "ทางรถไฟ" },
  crossing: { en: "Level crossing (rail × road)", th: "จุดตัดทางรถไฟ" },
  rail_bridge: { en: "Railway bridge", th: "สะพานรถไฟ" },
  road_bridge: { en: "Road bridge", th: "สะพานถนน" },
  station: { en: "Railway station platform", th: "ชานชาลาสถานี" },
  tunnel: { en: "Railway tunnel (through mountains)", th: "อุโมงค์รถไฟ" },
};

/** Decor tiles (one 16px tile each, drawn over the ground). `.` = empty. */
export const DECOR_CODES = ["f", "t", "r", "l", "e", "u", "n", "k", "h", "j", "z", "x", "m", "q", "c", "y"] as const;
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
  // city street (draw over road / sidewalk)
  h: { en: "Lane dashes E–W", th: "เส้นแบ่งช่องทาง (แนวนอน)" },
  j: { en: "Lane dashes N–S", th: "เส้นแบ่งช่องทาง (แนวตั้ง)" },
  z: { en: "Crosswalk (E–W road)", th: "ทางม้าลาย (ถนนแนวนอน)" },
  x: { en: "Crosswalk (N–S road)", th: "ทางม้าลาย (ถนนแนวตั้ง)" },
  m: { en: "Manhole", th: "ฝาท่อ" },
  q: { en: "Storm drain grate", th: "ตะแกรงระบายน้ำ" },
  c: { en: "Puddle", th: "แอ่งน้ำ" },
  y: { en: "Fallen leaves", th: "ใบไม้ร่วง" },
};

/** Decor names accepted by edit ops (`code: "crosswalk_ew"` = `z`). */
export const DECOR_NAMES: Record<string, DecorCode> = {
  flowers: "f", tuft: "t", rocks: "r", lotus: "l", pebbles: "e", stump: "u", reeds: "n", fence: "k",
  lane_ew: "h", lane_ns: "j", crosswalk_ew: "z", crosswalk_ns: "x", manhole: "m", grate: "q", puddle: "c", leaves: "y",
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
  /** Optional world-map data: regions, towns (with Easy Scene side-view links) and road / rail routes. */
  overworld?: OverworldData;
}

// ---------------------------------------------------------------- overworld

/** A name in Thai, English and (optionally) Malay. */
export interface LocalName {
  th: string;
  en: string;
  ms?: string;
}

export const TOWN_KINDS = ["thai_town", "malay_kampung", "chinese_town", "rural_village", "brick_city"] as const;
export type TownKind = (typeof TOWN_KINDS)[number];
export const CULTURES = ["thai", "malay", "chinese", "rural", "mixed"] as const;
export type Culture = (typeof CULTURES)[number];
export const ROUTE_KINDS = ["road", "rail"] as const;
export type RouteKind = (typeof ROUTE_KINDS)[number];

export interface OverworldRegion {
  id: string;
  name: LocalName;
  culture?: Culture;
  /** Map-overlay colour (#rrggbb). */
  color?: string;
}

export interface OverworldTown {
  id: string;
  name: LocalName;
  /** Region (cluster) id. */
  region: string;
  kind: TownKind;
  /** Name of the town marker object in `objects[]` (optional). */
  object?: string;
  /** Walkable tile the player steps on to enter the town. */
  entrance: [number, number];
  /** Easy Scene side-view scene id loaded on entering. */
  scene: string;
  /** Station platform tile (`Z`) when the town is on the railway. */
  station?: [number, number];
  /** Seed for the generated Easy Scene street (optional). */
  seed?: number;
}

export interface OverworldRoute {
  id: string;
  kind: RouteKind;
  from: string;
  to: string;
  /** Tile path (4-connected), entrance → entrance for roads, station → station for rail. */
  path?: Array<[number, number]>;
}

export interface OverworldData {
  regions: OverworldRegion[];
  towns: OverworldTown[];
  routes: OverworldRoute[];
  /** Town id the player starts at (default: the first town). */
  start?: string;
  /** Generator settings, so the map can be re-made. */
  generator?: { seed: number; clusters: number; version: number };
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
