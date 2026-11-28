/** Types for the Pixi overworld runtime (plain JS). */
export type TownBoundsJson = {
  walk?: { minX: number; maxX: number };
  road?: { minX: number; maxX: number };
  tileSize: number;
  size?: { width: number };
  tilemap: { width: number; codes: string[] };
  collision?: { solid?: Array<{ x: number; y: number; w: number; h: number }> };
};

export function townWalkRange(j: TownBoundsJson): { minX: number; maxX: number };
export function townRoadRange(j: TownBoundsJson): { minX: number; maxX: number };
export function townSurfaceY(j: TownBoundsJson, px: number): number;
export function floodReach(level: number): number;
export function floodWalk(depth: number): number;
export function pushTrail(trail: unknown, prev: unknown, max: number): unknown;
export function followerTiles(trail: unknown, leader: unknown, n: number, spacing?: number): unknown;
export function facingToward(from: unknown, to: unknown, fallback?: string): string;
export function minimapGrid(d: unknown): unknown;
export const MINIMAP_COLORS: Record<string, number>;
export function startOverworld(PIXI: unknown, app: unknown, opts: unknown): Promise<unknown>;
