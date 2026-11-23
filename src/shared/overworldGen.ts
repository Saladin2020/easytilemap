/**
 * Seeded overworld generator: `generateOverworld({ seed })` → a world map with a coast, a river,
 * mountains, forests and farm fields, town clusters (regions) of Thai, Malay-Muslim, Chinese-Thai and
 * rural towns, a railway joining the cluster hubs (stations, bridges, level crossings) and dirt roads
 * joining every town. Pure and deterministic: the same options always give the same map.
 */
import { blankRows } from "./map.js";
import { OBJECT_BY_KIND } from "./objects.js";
import { TOWN_OBJECT, townEntrance } from "./overworldObjects.js";
import { DEFAULT_VIEWPORT, FORMAT, TILE_SIZE, type Culture, type LocalName, type MapCharacter, type MapDoc, type MapObject, type OverworldRegion, type OverworldRoute, type OverworldTown, type Spawn, type TownKind } from "./types.js";

export const OVERWORLD_GEN_VERSION = 1;

export interface OverworldGenOptions {
  seed: number;
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  /** Number of town clusters (regions), 2–8 (default 4). */
  clusters?: number;
  /** Easy Sprite top-down sheet for the player (workspace-relative). */
  player?: string;
}

/** mulberry32 */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

function fbm(x: number, y: number, seed: number): number {
  return (valueNoise(x, y, seed) * 4 + valueNoise(x * 2, y * 2, seed + 1) * 2 + valueNoise(x * 4, y * 4, seed + 2)) / 7;
}

// ---------------------------------------------------------------- names

type NameEntry = LocalName;
/**
 * Town names per kind. Thai settlements (thai_town, rural_village, brick_city) are Thai names: `th` in Thai
 * script, `en` the RTGS romanisation and `ms` the same romanisation (a Thai place keeps its Thai name in every
 * language). Only malay_kampung towns get Malay names. Chinese-Thai market towns keep their Hokkien / Teochew
 * names (`ms` = `en`).
 */
const NAMES: Record<TownKind, NameEntry[]> = {
  thai_town: [
    { th: "เวียงทอง", en: "Wiang Thong", ms: "Wiang Thong" },
    { th: "เวียงคำ", en: "Wiang Kham", ms: "Wiang Kham" },
    { th: "เมืองแก้ว", en: "Mueang Kaeo", ms: "Mueang Kaeo" },
    { th: "เมืองสุวรรณ", en: "Mueang Suwan", ms: "Mueang Suwan" },
    { th: "ท่าน้ำทอง", en: "Tha Nam Thong", ms: "Tha Nam Thong" },
  ],
  brick_city: [
    { th: "นครอิฐแดง", en: "Nakhon It Daeng", ms: "Nakhon It Daeng" },
    { th: "นครหลวงใหม่", en: "Nakhon Luang Mai", ms: "Nakhon Luang Mai" },
  ],
  malay_kampung: [
    { th: "กำปงบุหงา", en: "Kampung Bunga", ms: "Kampung Bunga" },
    { th: "กำปงปันไต", en: "Kampung Pantai", ms: "Kampung Pantai" },
    { th: "กำปงบารู", en: "Kampung Baru", ms: "Kampung Baru" },
    { th: "กำปงสิเระ", en: "Kampung Sireh", ms: "Kampung Sireh" },
    { th: "กัวลาเมระห์", en: "Kuala Merah", ms: "Kuala Merah" },
  ],
  chinese_town: [
    { th: "ตลาดซินเฮง", en: "Talat Sin Heng", ms: "Talat Sin Heng" },
    { th: "ตลาดเก่าฮกเกี้ยน", en: "Old Hokkien Market", ms: "Old Hokkien Market" },
    { th: "ปากน้ำเต็กเซ้ง", en: "Paknam Tek Seng", ms: "Paknam Tek Seng" },
    { th: "ตลาดท่าเรือจีน", en: "Chinese Pier Market", ms: "Chinese Pier Market" },
  ],
  rural_village: [
    { th: "บ้านนาดี", en: "Ban Na Di", ms: "Ban Na Di" },
    { th: "บ้านหนองบัว", en: "Ban Nong Bua", ms: "Ban Nong Bua" },
    { th: "บ้านโคกสูง", en: "Ban Khok Sung", ms: "Ban Khok Sung" },
    { th: "บ้านห้วยใส", en: "Ban Huai Sai", ms: "Ban Huai Sai" },
    { th: "บ้านดอนแก้ว", en: "Ban Don Kaeo", ms: "Ban Don Kaeo" },
    { th: "บ้านป่าหวาย", en: "Ban Pa Wai", ms: "Ban Pa Wai" },
    { th: "บ้านทุ่งรวงทอง", en: "Ban Thung Ruang Thong", ms: "Ban Thung Ruang Thong" },
  ],
};

const REGION_NAMES: Record<Culture, NameEntry[]> = {
  thai: [{ th: "ที่ราบภาคกลาง", en: "Central Plains", ms: "Dataran Tengah" }, { th: "ลุ่มน้ำทอง", en: "Golden Basin", ms: "Lembangan Emas" }],
  malay: [{ th: "ชายฝั่งตะวันออก", en: "East Coast", ms: "Pantai Timur" }, { th: "อ่าวกอและ", en: "Kolek Bay", ms: "Teluk Kolek" }],
  chinese: [{ th: "ย่านปากแม่น้ำ", en: "River Mouth Quarter", ms: "Kawasan Kuala" }, { th: "ย่านตลาดเก่า", en: "Old Market Quarter", ms: "Kawasan Pasar Lama" }],
  rural: [{ th: "ที่ราบสูง", en: "Highlands", ms: "Tanah Tinggi" }, { th: "ทุ่งนาตะวันตก", en: "Western Paddies", ms: "Sawah Barat" }],
  mixed: [{ th: "หุบเขาสายรุ้ง", en: "Rainbow Valley", ms: "Lembah Pelangi" }, { th: "สามแยกมิตรภาพ", en: "Friendship Junction", ms: "Simpang Muhibah" }],
};
const REGION_COLORS: Record<Culture, string> = { thai: "#e2b54a", malay: "#2a8a5c", chinese: "#c8402e", rural: "#8a6a2a", mixed: "#5a7ac8" };

/** Town kinds per culture: [hub, …others]. */
const CULTURE_TOWNS: Record<Culture, TownKind[]> = {
  thai: ["thai_town", "rural_village", "thai_town"],
  malay: ["malay_kampung", "malay_kampung", "rural_village"],
  chinese: ["chinese_town", "rural_village", "chinese_town"],
  rural: ["rural_village", "rural_village", "thai_town"],
  mixed: ["thai_town", "malay_kampung", "chinese_town"],
};

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// ---------------------------------------------------------------- A* with direction state

interface PathRules {
  /** Cost to enter (x, y) moving in direction d (0 E, 1 S, 2 W, 3 N); Infinity = blocked. */
  cost: (x: number, y: number, d: number) => number;
  /** Cells that may only be crossed straight (bridges, crossings). */
  straightOnly: (x: number, y: number) => boolean;
  turn: number;
  /** Allowed first move directions (default all). */
  startDirs?: number[];
  /** Allowed directions for the final move into the goal (default all). */
  endDirs?: number[];
}

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

function findPath(w: number, h: number, from: [number, number], to: [number, number], rules: PathRules): Array<[number, number]> | null {
  const N = w * h * 4;
  const g = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const heap: Array<[number, number]> = [];
  const push = (f: number, s: number) => {
    heap.push([f, s]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]![0] <= heap[i]![0]) break;
      [heap[p], heap[i]] = [heap[i]!, heap[p]!];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  const hfn = (x: number, y: number) => Math.abs(x - to[0]) + Math.abs(y - to[1]);
  const startDirs = rules.startDirs ?? [0, 1, 2, 3];
  // virtual start: move out of `from`
  for (const d of startDirs) {
    const nx = from[0] + DX[d]!;
    const ny = from[1] + DY[d]!;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const isGoal = nx === to[0] && ny === to[1];
    if (isGoal && rules.endDirs && !rules.endDirs.includes(d)) continue;
    const c = isGoal ? 1 : rules.cost(nx, ny, d);
    if (!Number.isFinite(c)) continue;
    const s = (ny * w + nx) * 4 + d;
    if (c < g[s]!) {
      g[s] = c;
      prev[s] = -2;
      push(c + hfn(nx, ny), s);
    }
  }
  let goal = -1;
  while (heap.length) {
    const [, s] = pop();
    const d = s & 3;
    const cellI = s >> 2;
    const x = cellI % w;
    const y = Math.floor(cellI / w);
    if (x === to[0] && y === to[1]) {
      goal = s;
      break;
    }
    const straight = rules.straightOnly(x, y);
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue;
      if (straight && nd !== d) continue;
      const nx = x + DX[nd]!;
      const ny = y + DY[nd]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const isGoal = nx === to[0] && ny === to[1];
      if (isGoal && rules.endDirs && !rules.endDirs.includes(nd)) continue;
      if (rules.straightOnly(nx, ny) && nd !== d && !straight) {
        // entering a straight-only cell is fine in any direction; leaving must keep it
      }
      const c = isGoal ? 1 : rules.cost(nx, ny, nd);
      if (!Number.isFinite(c)) continue;
      const ns = (ny * w + nx) * 4 + nd;
      const ng = g[s]! + c + (nd !== d ? rules.turn : 0);
      if (ng < g[ns]!) {
        g[ns] = ng;
        prev[ns] = s;
        push(ng + hfn(nx, ny), ns);
      }
    }
  }
  if (goal < 0) return null;
  const out: Array<[number, number]> = [];
  for (let s = goal; s >= 0; s = prev[s]!) {
    const ci = s >> 2;
    out.push([ci % w, Math.floor(ci / w)]);
    if (prev[s] === -2) break;
  }
  out.push(from);
  return out.reverse();
}

// ---------------------------------------------------------------- generator

interface Placed {
  town: OverworldTown;
  obj: MapObject;
  rect: { x: number; y: number; w: number; h: number };
  hub: boolean;
  cluster: number;
}

export function generateOverworld(opts: OverworldGenOptions): MapDoc {
  const seed = Math.round(opts.seed) >>> 0;
  const W = Math.max(48, Math.min(256, Math.round(opts.width ?? 96)));
  const H = Math.max(36, Math.min(256, Math.round(opts.height ?? 64)));
  const K = Math.max(2, Math.min(8, Math.round(opts.clusters ?? 4)));
  const r = rng(seed ^ 0x9e3779b9);
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)]!;
  const G: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "g"));
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? G[y]![x]! : "");
  const set = (x: number, y: number, ch: string) => {
    if (x >= 0 && y >= 0 && x < W && y < H) G[y]![x] = ch;
  };

  // coast on the east, a bay, beaches
  const coastX = (y: number) => Math.round(W * (0.8 + 0.1 * (fbm(y / 11, 3.7, seed + 11) - 0.5) * 2) - 6 * Math.exp(-(((y - H * (0.35 + 0.3 * hash2(1, 1, seed))) / (H * 0.12)) ** 2)));
  for (let y = 0; y < H; y++) {
    const cx = coastX(y);
    for (let x = 0; x < W; x++) {
      if (x >= cx) set(x, y, "w");
      else if (x >= cx - 1 - Math.round(fbm(x / 5, y / 5, seed + 12) * 2.2)) set(x, y, "b");
    }
  }
  // mountains (more in the west) and forests
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) !== "g") continue;
    const h = fbm(x / 13, y / 13, seed + 21) + (1 - x / W) * 0.22 - 0.08;
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (h > 0.69 || (edge < 2 && h > 0.6)) set(x, y, "M");
    else if (fbm(x / 8, y / 8, seed + 31) > 0.57) set(x, y, "F");
  }
  // a river from the western hills to the sea: 2 tiles wide, bends every few tiles
  {
    let x = Math.round(W * (0.08 + r() * 0.1));
    let y = Math.round(H * (0.3 + r() * 0.4));
    let run = 0;
    let guard = 0;
    while (at(x, y) !== "w" && x < W && guard++ < W * 4) {
      set(x, y, "w");
      set(x, y + 1, "w");
      run++;
      const drift = fbm(x / 14, y / 9, seed + 43) - 0.5;
      if (run >= 3 && Math.abs(drift) > 0.06) {
        const dir = drift > 0 ? 1 : -1;
        const len = 1 + Math.floor(Math.abs(drift) * 10);
        for (let i = 0; i < len; i++) {
          const ny = y + dir;
          if (ny < 3 || ny > H - 5) break;
          y = ny;
          set(x, y, "w");
          set(x, y + 1, "w");
        }
        run = 0;
      }
      x++;
    }
  }

  // clusters
  const land = (x: number, y: number) => at(x, y) === "g" || at(x, y) === "F";
  const centres: Array<[number, number]> = [];
  for (let k = 0; k < K; k++) {
    let best: [number, number] | null = null;
    let bestD = -1;
    for (let i = 0; i < 60; i++) {
      const x = 8 + Math.floor(r() * (W - 16));
      const y = 7 + Math.floor(r() * (H - 14));
      if (!land(x, y)) continue;
      let water = false;
      for (let dy = -3; dy <= 3 && !water; dy++) for (let dx = -3; dx <= 3; dx++) if (at(x + dx, y + dy) === "w" || at(x + dx, y + dy) === "b") water = true;
      if (water) continue;
      const d = centres.length ? Math.min(...centres.map(([cx, cy]) => Math.hypot(cx - x, cy - y))) : 99;
      if (d > bestD) {
        bestD = d;
        best = [x, y];
      }
    }
    if (best) centres.push(best);
  }
  // cultures: the cluster nearest the coast is the Malay-Muslim coast, the most central one the capital
  const coastDist = centres.map(([x, y]) => coastX(y) - x);
  const order: Culture[] = new Array(centres.length).fill("rural");
  const byCoast = centres.map((_, i) => i).sort((a, b) => coastDist[a]! - coastDist[b]!);
  const byCentre = centres.map((_, i) => i).sort((a, b) => Math.hypot(centres[a]![0] - W / 2, centres[a]![1] - H / 2) - Math.hypot(centres[b]![0] - W / 2, centres[b]![1] - H / 2));
  const capital = byCentre.find((i) => i !== byCoast[0]) ?? byCentre[0]!;
  order[byCoast[0]!] = "malay";
  order[capital] = "thai";
  const rest: Culture[] = ["chinese", "rural", "mixed", "thai", "malay", "chinese"];
  let ri = 0;
  centres.forEach((_, i) => {
    if (i !== byCoast[0] && i !== capital) order[i] = rest[ri++ % rest.length]!;
  });

  const regions: OverworldRegion[] = [];
  const usedRegionNames = new Set<string>();
  centres.forEach((_, i) => {
    const culture = order[i]!;
    const name = REGION_NAMES[culture].find((n) => !usedRegionNames.has(n.en)) ?? { ...REGION_NAMES[culture][0]!, en: `${REGION_NAMES[culture][0]!.en} ${i + 1}` };
    usedRegionNames.add(name.en);
    regions.push({ id: slug(name.en), name, culture, color: REGION_COLORS[culture] });
  });

  // towns
  const placed: Placed[] = [];
  const objects: MapObject[] = [];
  const blockedRect: Array<{ x: number; y: number; w: number; h: number }> = [];
  const usedNames = new Set<string>();
  const overlaps = (a: { x: number; y: number; w: number; h: number }, m: number) =>
    blockedRect.some((b) => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y);
  const areaOk = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) return false;
      const c = at(xx, yy);
      if (c === "w" || c === "b") return false;
    }
    return true;
  };
  const clear = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (at(xx, yy) === "M" || at(xx, yy) === "F") set(xx, yy, "g");
  };
  centres.forEach(([cx, cy], ci) => {
    const culture = order[ci]!;
    let kinds = [...CULTURE_TOWNS[culture]];
    if (ci === capital) kinds = ["brick_city", "thai_town", "rural_village"];
    if (r() < 0.4) kinds = kinds.slice(0, 2);
    kinds.forEach((kind, ti) => {
      const k = OBJECT_BY_KIND.get(TOWN_OBJECT[kind])!;
      for (let attempt = 0; attempt < 80; attempt++) {
        const rad = ti === 0 ? r() * 2 : 5 + r() * (6 + attempt / 10);
        const ang = r() * Math.PI * 2;
        const ox = Math.round(cx + Math.cos(ang) * rad - k.w / 2);
        const oy = Math.round(cy + Math.sin(ang) * rad - k.h / 2);
        const rect = { x: ox, y: oy, w: k.w, h: k.h + 1 };
        // the hub also needs room for a station east or west of it
        if (!areaOk(ox - 1, oy - 1, k.w + 2, k.h + 3) || overlaps(rect, 3)) continue;
        const name = NAMES[kind].find((n) => !usedNames.has(n.en)) ?? { th: `${NAMES[kind][0]!.th} ${placed.length + 1}`, en: `${NAMES[kind][0]!.en} ${placed.length + 1}`, ms: `${NAMES[kind][0]!.ms} ${placed.length + 1}` };
        usedNames.add(name.en);
        const id = slug(name.en);
        const obj: MapObject = { kind: k.kind, x: ox, y: oy, name: `town_${id}` };
        const entrance = townEntrance(obj, k);
        const town: OverworldTown = { id, name, region: regions[ci]!.id, kind, object: obj.name, entrance, scene: `town_${id}`, seed: Math.floor(r() * 1e6) };
        clear(ox - 2, oy - 2, k.w + 4, k.h + 4);
        blockedRect.push({ x: ox, y: oy, w: k.w, h: k.h });
        objects.push(obj);
        placed.push({ town, obj, rect: { x: ox, y: oy, w: k.w, h: k.h }, hub: ti === 0, cluster: ci });
        break;
      }
    });
  });

  // stations next to each cluster hub (platform east or west of the town, house just north of it)
  const isBlockedRect = (x: number, y: number) => blockedRect.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  for (const p of placed.filter((q) => q.hub)) {
    const sy = p.rect.y + p.rect.h - 1;
    for (const sx of [p.rect.x + p.rect.w + 2, p.rect.x - 3]) {
      const cells: Array<[number, number]> = [[sx - 1, sy], [sx, sy], [sx + 1, sy], [sx, sy - 1], [sx, sy - 2], [sx + 1, sy - 1], [sx + 1, sy - 2], [sx, sy + 1]];
      if (cells.some(([x, y]) => !areaOk(x, y, 1, 1) || isBlockedRect(x, y))) continue;
      for (const [x, y] of cells) if (at(x, y) === "M" || at(x, y) === "F") set(x, y, "g");
      set(sx, sy, "Z");
      p.town.station = [sx, sy];
      objects.push({ kind: "ow_station", x: sx, y: sy - 2, name: `station_${p.town.id}` });
      blockedRect.push({ x: sx, y: sy - 2, w: 2, h: 2 });
      break;
    }
  }

  // railway: minimum spanning tree over the stations
  const routes: OverworldRoute[] = [];
  const stations = placed.filter((p) => p.town.station);
  const mst = <T>(items: T[], pos: (t: T) => [number, number]): Array<[T, T]> => {
    if (items.length < 2) return [];
    const inT = new Set([0]);
    const edges: Array<[T, T]> = [];
    while (inT.size < items.length) {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (const i of inT) for (let j = 0; j < items.length; j++) {
        if (inT.has(j)) continue;
        const [ax, ay] = pos(items[i]!);
        const [bx, by] = pos(items[j]!);
        const d = Math.hypot(ax - bx, ay - by);
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
      if (!best) break;
      inT.add(best[1]);
      edges.push([items[best[0]]!, items[best[1]]!]);
    }
    return edges;
  };
  const isRail = (c: string) => c === "T" || c === "H" || c === "Z" || c === "X" || c === "U";
  const railStraight = (x: number, y: number, d: number) => {
    // an existing straight rail running across direction d
    if (at(x, y) !== "T") return false;
    const ew = isRail(at(x - 1, y)) && isRail(at(x + 1, y)) && !isRail(at(x, y - 1)) && !isRail(at(x, y + 1));
    const ns = isRail(at(x, y - 1)) && isRail(at(x, y + 1)) && !isRail(at(x - 1, y)) && !isRail(at(x + 1, y));
    return d % 2 === 0 ? ns : ew;
  };
  for (const [a, b] of mst(stations, (p) => p.town.station!)) {
    const path = findPath(W, H, a.town.station!, b.town.station!, {
      cost: (x, y) => {
        const c = at(x, y);
        if (isBlockedRect(x, y) || c === "Z" || c === "b") return Infinity;
        if (c === "T" || c === "H" || c === "U") return 0.6;
        // straight tunnels under the ranges: dearer than open track, far cheaper than a long detour
        if (c === "M") return 2.6;
        if (c === "w") return 5;
        if (c === "F") return 2.2;
        return 1;
      },
      straightOnly: (x, y) => at(x, y) === "w" || at(x, y) === "H" || at(x, y) === "M" || at(x, y) === "U",
      turn: 4,
      startDirs: [0, 2],
      endDirs: [0, 2],
    });
    if (!path) continue;
    for (const [x, y] of path) {
      const c = at(x, y);
      if (c === "w") set(x, y, "H");
      else if (c === "M" || c === "U") set(x, y, "U");
      else if (c !== "Z" && c !== "H") set(x, y, "T");
    }
    // portals: bank the range up on both flanks of each mouth so the portal sits in the rock face
    for (let i = 0; i < path.length; i++) {
      const [x, y] = path[i]!;
      if (at(x, y) !== "U") continue;
      const nb = [path[i - 1], path[i + 1]].filter(Boolean) as Array<[number, number]>;
      if (!nb.some(([nx, ny]) => at(nx, ny) !== "U")) continue;
      const ew = nb.every(([nx, ny]) => ny === y);
      const flanks: Array<[number, number]> = ew ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]];
      for (const [fx, fy] of flanks) if (["g", "F", "C", "p"].includes(at(fx, fy)) && !isBlockedRect(fx, fy)) set(fx, fy, "M");
    }
    routes.push({ id: `rail_${a.town.id}_${b.town.id}`, kind: "rail", from: a.town.id, to: b.town.id, path });
  }

  // roads: inside each cluster, then between hubs (so every town is reachable on foot)
  const roadCost = (allowMountains: boolean) => (x: number, y: number, d: number) => {
    const c = at(x, y);
    if (isBlockedRect(x, y) || c === "Z" || c === "H") return Infinity;
    if (c === "M") return allowMountains ? 25 : Infinity;
    if (c === "U") return Infinity;
    if (c === "T") return railStraight(x, y, d) ? 4 : Infinity;
    if (c === "X") return d % 2 === (isRail(at(x - 1, y)) ? 1 : 0) ? 0.4 : Infinity;
    if (c === "d" || c === "J") return 0.35;
    if (c === "w") return 7;
    const besideRail = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((n) => n === "T" || n === "H");
    if (c === "F") return 2.2 + (besideRail ? 1 : 0);
    if (c === "b" || c === "C") return 1.5 + (besideRail ? 1 : 0);
    return besideRail ? 2 : 1;
  };
  const roadStraight = (x: number, y: number) => ["w", "J", "T", "X"].includes(at(x, y));
  const lay = (path: Array<[number, number]>) => {
    for (const [x, y] of path) {
      const c = at(x, y);
      if (c === "w") set(x, y, "J");
      else if (c === "T") set(x, y, "X");
      else if (c === "M" || c === "g" || c === "F" || c === "b" || c === "C") set(x, y, "d");
    }
  };
  const road = (a: Placed, b: Placed, from: [number, number], to: [number, number], id: string) => {
    const path = findPath(W, H, from, to, { cost: roadCost(false), straightOnly: roadStraight, turn: 0.4 }) ?? findPath(W, H, from, to, { cost: roadCost(true), straightOnly: roadStraight, turn: 0.4 });
    if (!path) return false;
    lay(path);
    routes.push({ id, kind: "road", from: a.town.id, to: b.town.id, path });
    return true;
  };
  for (let ci = 0; ci < centres.length; ci++) {
    const members = placed.filter((p) => p.cluster === ci);
    for (const [a, b] of mst(members, (p) => p.town.entrance)) road(a, b, a.town.entrance, b.town.entrance, `road_${a.town.id}_${b.town.id}`);
    // hub → station platform (the tile under the platform)
    const hub = members.find((p) => p.hub);
    if (hub?.town.station) {
      const [sx, sy] = hub.town.station;
      const path = findPath(W, H, hub.town.entrance, [sx, sy + 1], { cost: roadCost(false), straightOnly: roadStraight, turn: 0.4 });
      if (path) lay(path);
    }
  }
  const hubs = placed.filter((p) => p.hub);
  for (const [a, b] of mst(hubs, (p) => p.town.entrance)) road(a, b, a.town.entrance, b.town.entrance, `road_${a.town.id}_${b.town.id}`);
  // entrances are always road
  for (const p of placed) if (at(...p.town.entrance) !== "X") set(...p.town.entrance, "d");

  // farm fields and paddies around towns
  for (const p of placed) {
    const cx = p.rect.x + p.rect.w / 2;
    const cy = p.rect.y + p.rect.h / 2;
    const paddy = p.town.kind === "rural_village" || p.town.kind === "thai_town";
    for (let y = Math.floor(cy - 9); y <= cy + 9; y++) for (let x = Math.floor(cx - 10); x <= cx + 10; x++) {
      const d = Math.hypot((x - cx) / 1.2, y - cy);
      if (d < 4.5 || d > 9 || at(x, y) !== "g" || isBlockedRect(x, y)) continue;
      let nearRoad = false;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (["d", "Z", "T", "X"].includes(at(x + dx, y + dy))) nearRoad = true;
      if (nearRoad) continue;
      const n = fbm(x / 4, y / 4, seed + 51);
      if (n > 0.52) set(x, y, paddy && fbm(x / 6, y / 6, seed + 53) > 0.5 ? "p" : "C");
    }
  }

  const ground = G.map((row) => row.join(""));
  // decor: grass tufts, flowers, rocks near mountains
  const decor = blankRows(W, H, ".").map((row, y) =>
    row
      .split("")
      .map((_, x) => {
        if (at(x, y) !== "g") return ".";
        const n = hash2(x, y, seed + 61);
        const nearM = ["M"].includes(at(x + 1, y)) || at(x - 1, y) === "M" || at(x, y + 1) === "M" || at(x, y - 1) === "M";
        if (nearM && n < 0.12) return "r";
        if (n < 0.035) return "t";
        if (n < 0.05) return "f";
        return ".";
      })
      .join(""),
  );

  const towns = placed.map((p) => p.town);
  const startTown = placed.find((p) => p.town.kind === "brick_city") ?? placed[0];
  const spawns: Spawn[] = [];
  if (startTown) spawns.push({ name: "player", x: startTown.town.entrance[0], y: startTown.town.entrance[1], facing: "front" });
  for (const t of towns) spawns.push({ name: `town_${t.id}`, x: t.entrance[0], y: t.entrance[1], facing: "front" });
  for (const t of towns) if (t.station) spawns.push({ name: `station_${t.id}`, x: t.station[0], y: t.station[1], facing: "front" });
  const characters: MapCharacter[] = [];
  if (opts.player && startTown) characters.push({ sheet: opts.player, name: "player", x: startTown.town.entrance[0], y: startTown.town.entrance[1], facing: "front", anim: "idle" });

  const id = opts.id ?? `overworld_${seed}`;
  return {
    format: FORMAT,
    id,
    name: opts.name ?? `แผนที่โลก · Overworld (seed ${seed})`,
    tileSize: TILE_SIZE,
    width: W,
    height: H,
    tileset: "thai_village",
    viewport: { ...DEFAULT_VIEWPORT },
    layers: { ground, decor, collision: blankRows(W, H, ".") },
    objects,
    spawns,
    characters,
    overworld: {
      regions,
      towns,
      routes,
      ...(startTown ? { start: startTown.town.id } : {}),
      generator: { seed, clusters: K, version: OVERWORLD_GEN_VERSION },
    },
  };
}
