/**
 * Overworld (world map) data: regions (town clusters), towns linked to Easy Scene side-view scenes,
 * and road / rail routes as a graph. Normalization + validation (reachability on foot, entrances on
 * walkable tiles, stations on platform tiles, routes that follow their tiles, scene links that
 * resolve), plus the travel graph used by the exporters. Pure; shared by CLI, MCP, editor, exports.
 */
import { CODE_TERRAIN, CULTURES, ROUTE_KINDS, TOWN_KINDS, type Diagnostic, type LocalName, type MapDoc, type OverworldData, type OverworldRegion, type OverworldRoute, type OverworldTown, type Terrain } from "./types.js";

const SAFE = /^[a-z0-9_-]+$/;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const cell = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1]);

/** Tiles a road route may run on, and a rail route. */
export const ROAD_TERRAINS = new Set<Terrain>(["dirt", "crossing", "road_bridge", "road", "sidewalk", "stone"]);
export const RAIL_TERRAINS = new Set<Terrain>(["rail", "crossing", "rail_bridge", "station", "tunnel"]);

function localName(raw: unknown, path: string, diags: Diagnostic[]): LocalName {
  const n = (raw ?? {}) as Partial<LocalName>;
  const out: LocalName = { th: typeof n.th === "string" ? n.th.trim() : "", en: typeof n.en === "string" ? n.en.trim() : "" };
  if (typeof n.ms === "string" && n.ms.trim()) out.ms = n.ms.trim();
  if (!out.th) diags.push({ severity: "error", message: `${path}.th (Thai name) is required`, path });
  if (!out.en) diags.push({ severity: "error", message: `${path}.en (English name) is required`, path });
  if (!out.ms) diags.push({ severity: "warning", message: `${path}.ms (Malay name) is missing`, path });
  return out;
}

/** Normalize `overworld` (structure only); semantic checks need the final map, see checkOverworld(). */
export function normalizeOverworld(raw: unknown, diags: Diagnostic[]): OverworldData | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") {
    diags.push({ severity: "error", message: "overworld must be an object", path: "overworld" });
    return undefined;
  }
  const o = raw as Partial<OverworldData>;
  const regions: OverworldRegion[] = [];
  const regionIds = new Set<string>();
  (Array.isArray(o.regions) ? o.regions : []).forEach((r, i) => {
    const p = `overworld.regions[${i}]`;
    if (!r || typeof r.id !== "string" || !SAFE.test(r.id)) return diags.push({ severity: "error", message: `${p} needs an id matching ${SAFE}`, path: p });
    if (regionIds.has(r.id)) diags.push({ severity: "error", message: `${p}: duplicate region id "${r.id}"`, path: p });
    regionIds.add(r.id);
    const reg: OverworldRegion = { id: r.id, name: localName(r.name, `${p}.name`, diags) };
    if (r.culture !== undefined) {
      if ((CULTURES as readonly string[]).includes(r.culture)) reg.culture = r.culture;
      else diags.push({ severity: "warning", message: `${p}: unknown culture "${String(r.culture)}" (${CULTURES.join(" | ")})`, path: p });
    }
    if (typeof r.color === "string" && /^#[0-9a-fA-F]{6}$/.test(r.color)) reg.color = r.color;
    regions.push(reg);
  });
  const towns: OverworldTown[] = [];
  const townIds = new Set<string>();
  (Array.isArray(o.towns) ? o.towns : []).forEach((t, i) => {
    const p = `overworld.towns[${i}]`;
    if (!t || typeof t.id !== "string" || !SAFE.test(t.id)) return diags.push({ severity: "error", message: `${p} needs an id matching ${SAFE}`, path: p });
    if (townIds.has(t.id)) diags.push({ severity: "error", message: `${p}: duplicate town id "${t.id}"`, path: p });
    townIds.add(t.id);
    if (!(TOWN_KINDS as readonly string[]).includes(t.kind)) diags.push({ severity: "error", message: `${p} "${t.id}": kind must be one of ${TOWN_KINDS.join(", ")}`, path: p });
    if (typeof t.region !== "string" || !regionIds.has(t.region)) diags.push({ severity: "error", message: `${p} "${t.id}": region "${String(t.region)}" is not in overworld.regions`, path: p });
    if (!cell(t.entrance)) return diags.push({ severity: "error", message: `${p} "${t.id}" needs entrance [x, y] (tiles)`, path: p });
    if (typeof t.scene !== "string" || !SAFE.test(t.scene)) diags.push({ severity: "error", message: `${p} "${t.id}": scene must be an Easy Scene id matching ${SAFE}`, path: p });
    const town: OverworldTown = {
      id: t.id,
      name: localName(t.name, `${p}.name`, diags),
      region: String(t.region),
      kind: t.kind,
      entrance: [Math.round(t.entrance[0]), Math.round(t.entrance[1])],
      scene: String(t.scene ?? ""),
    };
    if (typeof t.object === "string" && t.object.trim()) town.object = t.object.trim();
    if (t.station !== undefined) {
      if (cell(t.station)) town.station = [Math.round(t.station[0]), Math.round(t.station[1])];
      else diags.push({ severity: "error", message: `${p} "${t.id}": station must be [x, y]`, path: p });
    }
    if (finite(t.seed)) town.seed = Math.round(t.seed);
    towns.push(town);
  });
  const routes: OverworldRoute[] = [];
  const routeIds = new Set<string>();
  (Array.isArray(o.routes) ? o.routes : []).forEach((r, i) => {
    const p = `overworld.routes[${i}]`;
    if (!r || typeof r.id !== "string" || !SAFE.test(r.id)) return diags.push({ severity: "error", message: `${p} needs an id matching ${SAFE}`, path: p });
    if (routeIds.has(r.id)) diags.push({ severity: "error", message: `${p}: duplicate route id "${r.id}"`, path: p });
    routeIds.add(r.id);
    if (!(ROUTE_KINDS as readonly string[]).includes(r.kind)) return diags.push({ severity: "error", message: `${p} "${r.id}": kind must be road or rail`, path: p });
    for (const end of ["from", "to"] as const) {
      if (typeof r[end] !== "string" || !townIds.has(r[end])) diags.push({ severity: "error", message: `${p} "${r.id}": ${end} "${String(r[end])}" is not a town id`, path: p });
    }
    const route: OverworldRoute = { id: r.id, kind: r.kind, from: String(r.from), to: String(r.to) };
    if (r.path !== undefined) {
      if (Array.isArray(r.path) && r.path.every(cell)) route.path = r.path.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]);
      else diags.push({ severity: "error", message: `${p} "${r.id}": path must be [[x, y], …]`, path: p });
    }
    routes.push(route);
  });
  const out: OverworldData = { regions, towns, routes };
  if (typeof o.start === "string") {
    if (townIds.has(o.start)) out.start = o.start;
    else diags.push({ severity: "error", message: `overworld.start "${o.start}" is not a town id`, path: "overworld.start" });
  }
  const g = o.generator;
  if (g && finite(g.seed)) out.generator = { seed: Math.round(g.seed), clusters: finite(g.clusters) ? Math.round(g.clusters) : 0, version: finite(g.version) ? Math.round(g.version) : 1 };
  return out;
}

/** 4-connected flood fill of walkable tiles from (x, y). */
export function reachable(blocked: boolean[][], x: number, y: number): boolean[][] {
  const h = blocked.length;
  const w = blocked[0]?.length ?? 0;
  const seen = blocked.map((r) => r.map(() => false));
  if (y < 0 || y >= h || x < 0 || x >= w || blocked[y]![x]) return seen;
  const q: Array<[number, number]> = [[x, y]];
  seen[y]![x] = true;
  while (q.length) {
    const [cx, cy] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny]![nx] || blocked[ny]![nx]) continue;
      seen[ny]![nx] = true;
      q.push([nx, ny]);
    }
  }
  return seen;
}

/** Semantic checks on a normalized map. `blocked` is the map's collision grid. */
export function checkOverworld(doc: MapDoc, blocked: boolean[][], diags: Diagnostic[]): void {
  const ow = doc.overworld;
  if (!ow) return;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < doc.width && y < doc.height;
  const terrainAt = (x: number, y: number) => CODE_TERRAIN[doc.layers.ground[y]?.[x] ?? ""];
  const objectNames = new Set(doc.objects.map((o) => o.name).filter(Boolean));
  if (!ow.towns.length) diags.push({ severity: "warning", message: "overworld has no towns", path: "overworld.towns" });
  ow.towns.forEach((t, i) => {
    const p = `overworld.towns[${i}]`;
    const [ex, ey] = t.entrance;
    if (!inMap(ex, ey)) diags.push({ severity: "error", message: `Town "${t.id}" entrance ${ex},${ey} is outside the map`, path: p, x: ex, y: ey });
    else if (blocked[ey]![ex]) diags.push({ severity: "error", message: `Town "${t.id}" entrance ${ex},${ey} is on a blocked tile`, path: p, x: ex, y: ey });
    if (t.object && !objectNames.has(t.object)) diags.push({ severity: "warning", message: `Town "${t.id}": no object named "${t.object}"`, path: p });
    if (t.station) {
      const [sx, sy] = t.station;
      if (!inMap(sx, sy) || terrainAt(sx, sy) !== "station") diags.push({ severity: "error", message: `Town "${t.id}" station ${sx},${sy} is not on a station platform tile (Z)`, path: p, x: sx, y: sy });
    }
  });
  // tunnels carry track straight through: two rail neighbours, opposite each other
  let tunnelWarnings = 0;
  for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) {
    if (terrainAt(x, y) !== "tunnel") continue;
    const r = (xx: number, yy: number) => inMap(xx, yy) && RAIL_TERRAINS.has(terrainAt(xx, yy)!);
    const ew = r(x - 1, y) && r(x + 1, y);
    const ns = r(x, y - 1) && r(x, y + 1);
    if (!ew && !ns && tunnelWarnings++ < 3) diags.push({ severity: "warning", message: `Tunnel at ${x},${y} does not carry track straight through (needs rail on two opposite sides)`, path: "layers.ground", x, y });
  }
  // every town reachable on foot from the start town
  const start = ow.towns.find((t) => t.id === ow.start) ?? ow.towns[0];
  if (start && inMap(...start.entrance)) {
    const seen = reachable(blocked, start.entrance[0], start.entrance[1]);
    for (const t of ow.towns) {
      const [x, y] = t.entrance;
      if (t !== start && inMap(x, y) && !blocked[y]![x] && !seen[y]![x]) diags.push({ severity: "error", message: `Town "${t.id}" cannot be reached on foot from "${start.id}"`, path: "overworld.towns", x, y });
    }
  }
  // routes follow their tiles
  const townById = new Map(ow.towns.map((t) => [t.id, t]));
  ow.routes.forEach((r, i) => {
    const p = `overworld.routes[${i}]`;
    const a = townById.get(r.from);
    const b = townById.get(r.to);
    if (r.kind === "rail") for (const t of [a, b]) if (t && !t.station) diags.push({ severity: "error", message: `Rail route "${r.id}": town "${t.id}" has no station`, path: p });
    if (!r.path) return;
    const allowed = r.kind === "rail" ? RAIL_TERRAINS : ROAD_TERRAINS;
    let bad = 0;
    r.path.forEach(([x, y], k) => {
      if (k > 0) {
        const [px, py] = r.path![k - 1]!;
        if (Math.abs(px - x) + Math.abs(py - y) !== 1 && bad++ < 2) diags.push({ severity: "error", message: `Route "${r.id}" path breaks between ${px},${py} and ${x},${y}`, path: p, x, y });
      }
      const t = inMap(x, y) ? terrainAt(x, y) : undefined;
      const endpoint = k === 0 || k === r.path!.length - 1;
      if ((!t || !allowed.has(t)) && !(r.kind === "road" && endpoint) && bad++ < 3) diags.push({ severity: "error", message: `Route "${r.id}" (${r.kind}) runs over ${t ?? "nothing"} at ${x},${y}`, path: p, x, y });
    });
    const first = r.path[0];
    const last = r.path[r.path.length - 1];
    const near = (c: [number, number] | undefined, t: OverworldTown | undefined) => {
      if (!c || !t) return true;
      const target = r.kind === "rail" ? t.station : t.entrance;
      return !target || Math.abs(c[0] - target[0]) + Math.abs(c[1] - target[1]) <= 1;
    };
    if (!near(first, a) || !near(last, b)) diags.push({ severity: "warning", message: `Route "${r.id}" path does not start / end at its towns' ${r.kind === "rail" ? "stations" : "entrances"}`, path: p });
  });
  // the route graph should join every town
  const comps = routeComponents(ow);
  if (ow.towns.length > 1 && comps.length > 1) diags.push({ severity: "warning", message: `Route graph has ${comps.length} separate groups: ${comps.map((c) => c.join("+")).join(" | ")}`, path: "overworld.routes" });
}

/** Connected groups of town ids in the road + rail graph. */
export function routeComponents(ow: Pick<OverworldData, "towns" | "routes">): string[][] {
  const parent = new Map(ow.towns.map((t) => [t.id, t.id]));
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  for (const r of ow.routes) if (parent.has(r.from) && parent.has(r.to)) parent.set(find(r.from), find(r.to));
  const groups = new Map<string, string[]>();
  for (const t of ow.towns) {
    const k = find(t.id);
    groups.set(k, [...(groups.get(k) ?? []), t.id]);
  }
  return [...groups.values()];
}

/** Scene links: every town's scene must be one of `sceneIds` (e.g. an Easy Scene workspace's scenes/). */
export function checkSceneLinks(doc: MapDoc, sceneIds: ReadonlySet<string>): Diagnostic[] {
  const out: Diagnostic[] = [];
  doc.overworld?.towns.forEach((t, i) => {
    if (!sceneIds.has(t.scene)) out.push({ severity: "error", message: `Town "${t.id}" links to Easy Scene "${t.scene}", which does not exist (run: easyscene towns --from-overworld <map>)`, path: `overworld.towns[${i}]` });
  });
  return out;
}

/** Shortest rail path (tile list) between two station tiles over rail tiles, or null. */
export function railPath(doc: Pick<MapDoc, "layers" | "width" | "height">, from: [number, number], to: [number, number]): Array<[number, number]> | null {
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < doc.width && y < doc.height && RAIL_TERRAINS.has(CODE_TERRAIN[doc.layers.ground[y]![x]!]!);
  if (!ok(...from) || !ok(...to)) return null;
  const key = (x: number, y: number) => y * doc.width + x;
  const prev = new Map<number, number>([[key(...from), -1]]);
  const q: Array<[number, number]> = [from];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i]!;
    if (x === to[0] && y === to[1]) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!ok(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(...to))) return null;
  const out: Array<[number, number]> = [];
  for (let k = key(...to); k !== -1; k = prev.get(k)!) out.push([k % doc.width, Math.floor(k / doc.width)]);
  return out.reverse();
}

/** Travel graph for exporters: towns with px positions, train lines between stations with their tile paths. */
export function travelGraph(doc: MapDoc) {
  const ow = doc.overworld;
  if (!ow) return null;
  const ts = doc.tileSize;
  const stations = ow.towns.filter((t) => t.station);
  const trains: Array<{ from: string; to: string; path: Array<[number, number]> }> = [];
  for (const a of stations) for (const b of stations) {
    if (a === b) continue;
    const p = railPath(doc, a.station!, b.station!);
    if (p) trains.push({ from: a.id, to: b.id, path: p });
  }
  return {
    format: "easytilemap.overworld/1",
    map: doc.id,
    tileSize: ts,
    start: ow.start ?? ow.towns[0]?.id ?? null,
    regions: ow.regions,
    towns: ow.towns.map((t) => ({ ...t, station: t.station ?? null, entrancePx: [t.entrance[0] * ts + ts / 2, t.entrance[1] * ts + ts / 2], stationPx: t.station ? [t.station[0] * ts + ts / 2, t.station[1] * ts + ts / 2] : null })),
    routes: ow.routes.map(({ path: _p, ...r }) => r),
    trains,
  };
}
