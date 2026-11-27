/**
 * Party followers and minimap model for the overworld game. Pure, shared by the Pixi runtime
 * (easytilemap-overworld.js) and the Godot game (overworld_game.gd), which implement the same rules:
 *
 *  - the leader's previous tiles go into a trail (newest first, no duplicates in a row, capped);
 *    follower i stands on trail[(i + 1) × spacing − 1] (or the oldest tile while the trail is short);
 *  - entering a town / riding a train / teleporting resets the trail so followers bunch behind the leader;
 *  - the minimap is one character per tile: "." walkable, "#" blocked, "=" rail, "T" town gate, "S" station.
 */
export type Cell = [number, number];

export function pushTrail(trail: Cell[], prev: Cell, max: number): Cell[] {
  const head = trail[0];
  if (head && head[0] === prev[0] && head[1] === prev[1]) return trail;
  trail.unshift([prev[0], prev[1]]);
  if (trail.length > max) trail.length = max;
  return trail;
}

export function followerTiles(trail: Cell[], leader: Cell, n: number, spacing = 1): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const c = trail[(i + 1) * spacing - 1] ?? trail[trail.length - 1] ?? leader;
    out.push([c[0], c[1]]);
  }
  return out;
}

export function facingToward(from: Cell, to: Cell, fallback = "front"): string {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "front" : "back";
}

export interface MinimapSource {
  blocked: string[];
  towns: Array<{ entrance: Cell; station?: Cell }>;
  trains?: Array<{ path?: Cell[] }>;
}

export function minimapGrid(d: MinimapSource): string[] {
  const g: string[][] = d.blocked.map((row) => row.split("").map((c) => (c === "#" ? "#" : ".")));
  const set = (c: Cell | undefined, ch: string) => {
    if (c && g[c[1]] && g[c[1]]![c[0]] !== undefined) g[c[1]]![c[0]] = ch;
  };
  for (const t of d.trains ?? []) for (const c of t.path ?? []) set(c, "=");
  for (const t of d.towns) {
    set(t.station, "S");
    set(t.entrance, "T");
  }
  return g.map((r) => r.join(""));
}

export const MINIMAP_COLORS: Record<string, string> = { ".": "#7fbf6a", "#": "#3e5a74", "=": "#a07a52", T: "#f4ae3d", S: "#e8604a" };
