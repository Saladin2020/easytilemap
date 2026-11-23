/**
 * Object catalog for the sample tileset: stilt houses, temple, mosque, Tadika school, Malay kampung
 * houses, Chinese-Thai shrine, market and halal stalls, kolek boats, trees, banana plants… plus the
 * brick-town street set (rowhouses, apartment with fire escape, garage, corner shop, street trees, poles).
 * Each object is a procedurally painted PNG (CC0) with a footprint (solid tiles) used for collision.
 */
import { CITY_OBJECT_KINDS, CITY_PAINTERS } from "./cityObjects.js";
import { OVERWORLD_OBJECT_KINDS, OVERWORLD_PAINTERS } from "./overworldObjects.js";
import { c, litMask, markLit, noise, Pix, type Rgba, type View } from "./pixel.js";
import type { RgbaImage } from "./raster.js";
import { TILE_SIZE } from "./types.js";

export type ObjectCategory = "building" | "nature" | "prop" | "floor" | "town";

export interface ObjectKind {
  kind: string;
  name: string;
  nameTh: string;
  category: ObjectCategory;
  /** Image size in tiles. */
  w: number;
  h: number;
  /** Blocking tiles relative to the image's top-left (null = walk-through). */
  solid: { x: number; y: number; w: number; h: number } | null;
  /** Floor objects (bridges, boats) are drawn under characters and force their tiles open. */
  floor?: boolean;
}

export const OBJECT_KINDS: readonly ObjectKind[] = [
  { kind: "house_wood", name: "Teak stilt house", nameTh: "บ้านไม้ใต้ถุนสูง", category: "building", w: 5, h: 5, solid: { x: 0, y: 2, w: 5, h: 3 } },
  { kind: "house_small", name: "Small wooden house", nameTh: "บ้านไม้หลังเล็ก", category: "building", w: 4, h: 4, solid: { x: 0, y: 2, w: 4, h: 2 } },
  { kind: "temple", name: "Temple hall (ubosot)", nameTh: "โบสถ์", category: "building", w: 6, h: 7, solid: { x: 0, y: 3, w: 6, h: 4 } },
  { kind: "sala", name: "Sala pavilion", nameTh: "ศาลา", category: "building", w: 3, h: 3, solid: { x: 0, y: 2, w: 3, h: 1 } },
  { kind: "market_stall", name: "Market stall", nameTh: "แผงตลาด", category: "building", w: 3, h: 3, solid: { x: 0, y: 2, w: 3, h: 1 } },
  { kind: "spirit_house", name: "Spirit house", nameTh: "ศาลพระภูมิ", category: "prop", w: 1, h: 2, solid: { x: 0, y: 1, w: 1, h: 1 } },
  { kind: "tree_mango", name: "Mango tree", nameTh: "ต้นมะม่วง", category: "nature", w: 2, h: 3, solid: { x: 0, y: 2, w: 2, h: 1 } },
  { kind: "palm", name: "Coconut palm", nameTh: "ต้นมะพร้าว", category: "nature", w: 2, h: 3, solid: { x: 0, y: 2, w: 1, h: 1 } },
  { kind: "banana", name: "Banana plant", nameTh: "ต้นกล้วย", category: "nature", w: 2, h: 2, solid: { x: 0, y: 1, w: 2, h: 1 } },
  { kind: "bamboo", name: "Bamboo clump", nameTh: "กอไผ่", category: "nature", w: 1, h: 2, solid: { x: 0, y: 1, w: 1, h: 1 } },
  { kind: "haystack", name: "Rice straw stack", nameTh: "กองฟาง", category: "prop", w: 2, h: 2, solid: { x: 0, y: 1, w: 2, h: 1 } },
  { kind: "water_jar", name: "Water jar (ong)", nameTh: "โอ่งน้ำ", category: "prop", w: 1, h: 1, solid: { x: 0, y: 0, w: 1, h: 1 } },
  { kind: "lantern_post", name: "Lantern post", nameTh: "เสาโคมไฟ", category: "prop", w: 1, h: 2, solid: { x: 0, y: 1, w: 1, h: 1 } },
  // Muslim kampung + Chinese-Thai (multicultural village)
  { kind: "mosque", name: "Wooden mosque (Talo Mano style)", nameTh: "มัสยิด", category: "building", w: 7, h: 7, solid: { x: 0, y: 3, w: 7, h: 4 } },
  { kind: "tadika", name: "Tadika / madrasah school", nameTh: "โรงเรียนตาดีกา", category: "building", w: 5, h: 4, solid: { x: 0, y: 2, w: 5, h: 2 } },
  { kind: "kampung_house", name: "Malay raised house", nameTh: "บ้านมลายู", category: "building", w: 5, h: 5, solid: { x: 0, y: 2, w: 5, h: 3 } },
  { kind: "halal_stall", name: "Halal food stall", nameTh: "แผงอาหารฮาลาล", category: "building", w: 3, h: 3, solid: { x: 0, y: 2, w: 3, h: 1 } },
  { kind: "chinese_shrine", name: "Chinese-Thai shrine", nameTh: "ศาลเจ้า", category: "building", w: 3, h: 3, solid: { x: 0, y: 1, w: 3, h: 2 } },
  { kind: "fish_rack", name: "Fish drying rack", nameTh: "ราวตากปลา", category: "prop", w: 2, h: 1, solid: { x: 0, y: 0, w: 2, h: 1 } },
  { kind: "kolek", name: "Kolek boat", nameTh: "เรือกอและ", category: "floor", w: 3, h: 1, solid: null, floor: true },
  { kind: "boat", name: "Long-tail boat", nameTh: "เรือหางยาว", category: "floor", w: 2, h: 1, solid: null, floor: true },
  { kind: "bridge_h", name: "Plank bridge (east–west)", nameTh: "สะพานไม้ (แนวนอน)", category: "floor", w: 3, h: 1, solid: null, floor: true },
  { kind: "bridge_v", name: "Plank bridge (north–south)", nameTh: "สะพานไม้ (แนวตั้ง)", category: "floor", w: 1, h: 3, solid: null, floor: true },
  // brick town (city street set, see cityObjects.ts)
  ...CITY_OBJECT_KINDS,
  // overworld town markers (world map scale, see overworldObjects.ts)
  ...OVERWORLD_OBJECT_KINDS,
];

export const OBJECT_BY_KIND = new Map(OBJECT_KINDS.map((o) => [o.kind, o]));

const INK = c("#2a1d13");
const TEAK = [c("#8a5a32"), c("#9c6a3c"), c("#b07c48"), c("#6e4526")] as const;
const ROOF_RED = [c("#9a3a2a"), c("#b24a32"), c("#c8603c"), c("#7a2c22")] as const;
const LEAF = [c("#2f6a2c"), c("#3f8236"), c("#56a044"), c("#78bf55")] as const;

function planks(v: View, x: number, y: number, w: number, h: number, vertical = false): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const k = vertical ? xx : yy;
      const seam = vertical ? xx % 4 === 3 : yy % 3 === 2;
      const n = noise(x + xx, y + yy, 61);
      v.set(x + xx, y + yy, seam ? TEAK[3] : n < 0.3 ? TEAK[0] : n < 0.85 ? TEAK[1] : TEAK[2]);
      if (!seam && k % 7 === 0 && n > 0.93) v.set(x + xx, y + yy, TEAK[3]);
    }
  }
}

/** Gable roof seen from the front-top: tiled rows + ridge + Thai kalae / chofa horns. */
function roof(v: View, x0: number, x1: number, y0: number, y1: number, pal: readonly Rgba[], horns = true): void {
  for (let y = y0; y <= y1; y++) {
    const inset = Math.round(((y1 - y) / Math.max(1, y1 - y0)) * 3);
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const row = (y - y0) % 3;
      const n = noise(x, y, 71);
      v.set(x, y, row === 2 ? pal[3]! : n < 0.2 ? pal[0]! : n < 0.85 ? pal[1]! : pal[2]!);
    }
  }
  v.hline(x0 + 3, x1 - 3, y0, pal[2]!);
  v.hline(x0, x1, y1, c("#5a2018"));
  if (horns) {
    v.line(x0 + 3, y0, x0 + 1, y0 - 3, c("#d9a441"));
    v.line(x1 - 3, y0, x1 - 1, y0 - 3, c("#d9a441"));
  }
}

function window(v: View, x: number, y: number): void {
  v.rect(x, y, 4, 4, c("#2b1b10"));
  v.rect(x - 1, y, 1, 4, TEAK[2]);
  v.rect(x + 4, y, 1, 4, TEAK[2]);
  v.set(x + 1, y + 1, c("#f2c46a"));
}

function drawHouseWood(v: View): void {
  // 80×80: roof 2 rows, walls, stilts + shadow area, stairs
  v.shadow(40, 74, 38, 6);
  for (const px of [6, 22, 40, 58, 72]) v.rect(px, 58, 3, 16, c("#5e3b20"));
  v.rect(4, 60, 72, 2, c("#3a2618", 140));
  planks(v, 4, 30, 72, 28, true);
  v.hline(4, 75, 57, TEAK[3]);
  window(v, 14, 38);
  window(v, 58, 38);
  v.rect(34, 36, 12, 21, c("#5a3a22"));
  v.rect(35, 37, 10, 20, c("#2b1b10"));
  for (let i = 0; i < 5; i++) v.rect(34, 58 + i * 4, 12, 2, TEAK[2]);
  roof(v, 0, 79, 6, 30, ROOF_RED);
  v.outline(INK);
}

function drawHouseSmall(v: View): void {
  v.shadow(32, 60, 30, 5);
  for (const px of [6, 30, 54]) v.rect(px, 50, 3, 10, c("#5e3b20"));
  planks(v, 4, 26, 56, 24, true);
  window(v, 12, 32);
  v.rect(38, 30, 10, 20, c("#2b1b10"));
  v.rect(37, 30, 1, 20, TEAK[2]);
  roof(v, 0, 63, 6, 26, [c("#5d6d3a"), c("#6e8044"), c("#86994f"), c("#48552c")]);
  v.outline(INK);
}

function drawTemple(v: View): void {
  // 96×112: three-tier roof, white walls, gold doors, steps
  v.shadow(48, 106, 46, 6);
  v.rect(6, 62, 84, 38, c("#efe8da"));
  v.rect(6, 62, 84, 3, c("#d8cdb6"));
  for (const px of [10, 28, 62, 80]) v.rect(px, 64, 6, 36, c("#e2d7c2"));
  v.rect(40, 68, 16, 32, c("#c9962e"));
  v.rect(42, 70, 12, 30, c("#e2b54a"));
  v.vline(48, 70, 99, c("#9a6b1e"));
  for (const wx of [18, 70]) {
    v.rect(wx, 72, 6, 12, c("#c9962e"));
    v.rect(wx + 1, 73, 4, 10, c("#7a2c22"));
  }
  v.rect(30, 100, 36, 4, c("#cfc8b5"));
  v.rect(34, 104, 28, 4, c("#b4ac99"));
  const tiers: Array<[number, number, number, number]> = [
    [0, 95, 40, 62],
    [8, 87, 24, 42],
    [18, 77, 10, 26],
  ];
  const red = [c("#b23a24"), c("#c84a2c"), c("#e0663a"), c("#8a2a1c")];
  const green = [c("#2f6a4c"), c("#3b7d5a"), c("#4f9a6e"), c("#24523a")];
  tiers.forEach(([a, b, t, bot], i) => {
    roof(v, a, b, t, bot, i % 2 ? green : red, true);
    v.hline(a + 2, b - 2, bot - 1, c("#e2b54a"));
  });
  // chofa finial and gold gable
  v.poly([[48, 2], [52, 10], [44, 10]], c("#e2b54a"));
  v.vline(48, 0, 4, c("#e2b54a"));
  v.outline(INK);
}

function drawSala(v: View): void {
  v.shadow(24, 44, 22, 4);
  v.rect(3, 34, 42, 8, TEAK[1]);
  v.hline(3, 44, 34, TEAK[2]);
  for (const px of [5, 22, 40]) v.rect(px, 20, 3, 16, TEAK[0]);
  roof(v, 0, 47, 4, 22, ROOF_RED);
  v.outline(INK);
}

function drawMarketStall(v: View): void {
  v.shadow(24, 44, 22, 4);
  v.rect(4, 18, 2, 24, TEAK[3]);
  v.rect(42, 18, 2, 24, TEAK[3]);
  v.rect(3, 28, 42, 12, TEAK[1]);
  v.hline(3, 44, 28, TEAK[2]);
  const goods = [c("#f2c94c"), c("#e5806c"), c("#79c48a"), c("#f4ae3d"), c("#c84040")];
  for (let i = 0; i < 9; i++) v.ellipse(8 + i * 4, 26, 2, 2, goods[i % goods.length]!);
  v.rect(10, 31, 8, 5, c("#c9a46a"));
  v.rect(28, 31, 9, 5, c("#c9a46a"));
  for (let x = 0; x < 48; x++) {
    const stripe = Math.floor(x / 6) % 2 ? c("#f4ecdc") : c("#c8402e");
    for (let y = 4; y < 18; y++) if (!(y > 15 && (x % 6 === 0 || x % 6 === 5))) v.set(x, y, stripe);
  }
  v.hline(0, 47, 17, c("#8a2a1c"));
  v.outline(INK);
}

function drawSpiritHouse(v: View): void {
  v.shadow(8, 30, 6, 2);
  v.rect(7, 18, 3, 12, c("#efe8da"));
  v.rect(3, 15, 11, 4, c("#d9a441"));
  v.rect(4, 8, 9, 8, c("#e2b54a"));
  v.rect(7, 11, 3, 5, c("#7a2c22"));
  v.poly([[8.5, 1], [15, 9], [2, 9]], c("#c84a2c"));
  v.set(8, 1, c("#ffe27a"));
  v.outline(INK);
}

function canopy(v: View, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  v.ellipse(cx, cy, rx, ry, (x, y, dx, dy) => {
    const n = noise(x, y, seed);
    const light = -dx * 0.5 - dy * 0.8 + (n - 0.5) * 0.8;
    return light > 0.55 ? LEAF[3] : light > 0.05 ? LEAF[2] : light > -0.5 ? LEAF[1] : LEAF[0];
  });
}

function drawMango(v: View): void {
  v.shadow(16, 44, 12, 3);
  v.rect(14, 30, 5, 15, c("#6e4526"));
  v.vline(14, 30, 44, c("#8a5a32"));
  canopy(v, 16, 18, 15, 14, 3);
  canopy(v, 10, 22, 7, 6, 5);
  canopy(v, 22, 22, 7, 6, 9);
  for (const [x, y] of [[9, 25], [20, 27], [24, 18]] as const) {
    v.set(x, y, c("#f2c94c"));
    v.set(x, y + 1, c("#e09a2c"));
  }
  v.outline(INK);
}

function drawPalm(v: View): void {
  v.shadow(9, 45, 9, 2.5);
  for (let y = 14; y < 45; y++) {
    const x = Math.round(8 + Math.sin(y / 9) * 2);
    v.rect(x, y, 3, 1, y % 3 === 0 ? c("#7a5a3a") : c("#9a7650"));
  }
  const fronds: Array<[number, number]> = [[-12, 4], [-10, -6], [-2, -10], [8, -9], [12, 2], [6, 9], [-6, 9]];
  for (const [dx, dy] of fronds) {
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = 10 + dx * t;
      const y = 13 + dy * t + t * t * 5;
      v.set(x, y, LEAF[2]);
      v.set(x, y + 1, LEAF[1]);
      if (i % 2 === 0) v.set(x + Math.sign(dy || 1), y + 2, LEAF[0]);
    }
  }
  v.ellipse(10, 14, 3, 2, c("#6e8a3a"));
  v.set(9, 16, c("#8a6a2c"));
  v.set(12, 16, c("#8a6a2c"));
  v.outline(INK);
}

function drawBanana(v: View): void {
  v.shadow(16, 29, 12, 2.5);
  for (const sx of [12, 17, 21]) v.rect(sx, 16, 2, 13, c("#7fa83f"));
  const leaves: Array<[number, number, number, number]> = [[2, 6, 14, 14], [16, 3, 29, 12], [8, 1, 18, 10], [18, 12, 30, 18], [1, 13, 12, 20]];
  for (const [x0, y0, x1, y1] of leaves) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    v.ellipse(cx, cy, (x1 - x0) / 2, (y1 - y0) / 2.4, (x, y, dx, dy) => (Math.abs(dy) < 0.15 ? c("#cfe68a") : dy < 0 ? c("#9ccf55") : c("#78ad3e")));
  }
  v.set(16, 20, c("#7a3a52"));
  v.rect(15, 21, 3, 3, c("#8a4a62"));
  v.outline(INK);
}

function drawBamboo(v: View): void {
  v.shadow(8, 29, 7, 2);
  for (const [x, top] of [[3, 4], [7, 1], [11, 6]] as const) {
    for (let y = top; y < 30; y++) v.set(x, y, y % 6 === 0 ? c("#5d8a2c") : c("#9cc75a"));
    for (let y = top; y < 30; y++) v.set(x + 1, y, c("#78a83f"));
  }
  for (const [x, y, d] of [[2, 6, -1], [9, 3, 1], [13, 9, 1], [4, 14, -1], [10, 16, 1]] as const) {
    for (let i = 0; i < 4; i++) v.set(x + d * i, y + Math.floor(i / 2), c("#5fa043"));
  }
  v.outline(INK);
}

function drawHaystack(v: View): void {
  v.shadow(16, 28, 14, 3);
  v.ellipse(16, 18, 13, 11, (x, y, dx, dy) => {
    const n = noise(x, y, 41);
    if ((y + Math.floor(x / 3)) % 4 === 0) return c("#b8902e");
    return dy < -0.4 ? c("#f2d66a") : n < 0.5 ? c("#e0bc4c") : c("#d4ac3e");
  });
  v.vline(16, 4, 8, c("#6e4526"));
  v.outline(INK);
}

function drawWaterJar(v: View): void {
  v.shadow(8, 14, 6, 2);
  v.ellipse(8, 9, 6, 5.5, (x, y, dx, dy) => (dx < -0.3 && dy < -0.1 ? c("#c07a4a") : dy > 0.5 ? c("#5e3418") : c("#8a4a26")));
  v.ellipse(8, 4, 4, 1.5, c("#3a5f78"));
  v.hline(5, 11, 3, c("#6e3a1c"));
  v.set(5, 9, c("#e2b54a"));
  v.set(10, 8, c("#e2b54a"));
  v.outline(INK);
}

function drawLanternPost(v: View): void {
  v.shadow(8, 30, 5, 1.5);
  v.rect(7, 8, 2, 22, c("#5e3b20"));
  v.rect(3, 6, 10, 2, c("#5e3b20"));
  // lanterns: lit at night by their mask
  markLit(v, () => {
    v.ellipse(4, 11, 2.5, 3, c("#e04a32"));
    v.ellipse(12, 11, 2.5, 3, c("#e04a32"));
    v.set(4, 10, c("#ffd27a"));
    v.set(12, 10, c("#ffd27a"));
  });
  v.outline(INK);
}

function drawBoat(v: View): void {
  v.poly([[0, 6], [31, 5], [27, 13], [4, 13]], c("#8a5a32"));
  v.poly([[2, 7], [29, 6.5], [26, 10], [5, 10]], c("#b07c48"));
  v.rect(10, 7, 2, 4, c("#6e4526"));
  v.rect(20, 7, 2, 4, c("#6e4526"));
  v.set(1, 5, c("#e04a32"));
  v.set(2, 4, c("#f2c94c"));
  v.outline(INK);
}

function drawBridge(v: View, horizontal: boolean): void {
  const w = horizontal ? 48 : 16;
  const h = horizontal ? 16 : 48;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = horizontal ? x : y;
      const seam = k % 4 === 3;
      const edge = horizontal ? y < 2 || y > 13 : x < 2 || x > 13;
      const n = noise(x, y, 81);
      v.set(x, y, edge ? TEAK[3] : seam ? c("#5e3b20") : n < 0.5 ? TEAK[1] : TEAK[2]);
    }
  }
  if (horizontal) {
    v.hline(0, 47, 1, c("#c99560"));
  } else {
    v.vline(1, 0, 47, c("#c99560"));
  }
}

// ---------------------------------------------------------------- Muslim kampung / multicultural

const CHENGAL = [c("#7c4a28"), c("#9c6436"), c("#bc8248"), c("#5a321c")] as const;
const TILE_ROOF = [c("#a4482a"), c("#b8562a"), c("#d4743a"), c("#7a3420")] as const;
const M_GREEN = c("#1a6a48");
const M_GREEN_HI = c("#4aa874");
const GOLD = c("#e8b440");

/** Crescent: a disc minus an offset disc. */
function crescent(v: View, cx: number, cy: number, r: number, col: Rgba): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y > r * r + 0.5) continue;
    if ((x - r * 0.5) ** 2 + (y + r * 0.25) ** 2 <= (r * 0.78) ** 2) continue;
    v.set(cx + x, cy + y, col);
  }
}

function drawMosque(v: View): void {
  // 112×112: raised chengal prayer hall, two-tier tile roof, minaret with a small dome and crescent
  v.shadow(58, 106, 54, 6);
  // minaret (left)
  for (let y = 26; y < 100; y++) for (let x = 4; x < 20; x++) v.set(x, y, x % 4 === 3 ? CHENGAL[3] : x < 8 ? CHENGAL[2] : CHENGAL[1]);
  v.rect(9, 40, 6, 9, c("#24160e"));
  v.rect(9, 64, 6, 9, c("#24160e"));
  roof(v, 1, 22, 20, 28, TILE_ROOF, false);
  v.rect(7, 16, 10, 4, c("#e2dccc"));
  v.ellipse(12, 12, 6, 6, (x, y, dx, dy) => (dy > 0.3 ? null : dx < -0.2 && dy < -0.2 ? M_GREEN_HI : M_GREEN));
  v.vline(12, 2, 6, GOLD);
  crescent(v, 12, 2, 2, GOLD);
  // prayer hall
  for (const px of [26, 48, 70, 92, 106]) v.rect(px, 92, 3, 12, CHENGAL[3]);
  planks(v, 24, 62, 86, 30, true);
  v.hline(24, 109, 91, CHENGAL[3]);
  for (let x = 24; x < 110; x++) for (let y = 62; y < 66; y++) if ((x + y) % 4 === 0) v.set(x, y, c("#2a1a12"));
  for (const wx of [30, 44, 82, 96]) {
    v.rect(wx, 70, 7, 14, CHENGAL[3]);
    v.rect(wx + 1, 71, 5, 12, M_GREEN);
    for (let y = 73; y < 83; y += 3) v.hline(wx + 1, wx + 5, y, c("#125038"));
  }
  // arched door + stairs
  v.rect(60, 70, 14, 22, c("#1e140e"));
  v.ellipse(67, 70, 7, 5, (x, y, dx, dy) => (dy < 0 ? c("#1e140e") : null));
  v.vline(60, 66, 91, CHENGAL[2]);
  v.vline(73, 66, 91, CHENGAL[2]);
  for (let i = 0; i < 4; i++) v.rect(58, 93 + i * 4, 18, 2, CHENGAL[2]);
  // roofs
  roof(v, 20, 111, 44, 64, TILE_ROOF, false);
  roof(v, 34, 97, 24, 44, TILE_ROOF, false);
  v.vline(40, 18, 24, GOLD);
  v.vline(91, 18, 24, GOLD);
  // sign board
  v.rect(56, 46, 22, 8, M_GREEN);
  v.hline(56, 77, 46, GOLD);
  for (let x = 59; x < 75; x += 3) v.rect(x, 49, 2, 2, c("#f6d470"));
  v.outline(INK);
}

function drawTadika(v: View): void {
  // 80×64: Tadika (ตาดีกา) / madrasah: a one-storey wooden classroom, green roof, sign, flag pole
  v.shadow(40, 60, 38, 4);
  for (const px of [6, 38, 70]) v.rect(px, 50, 3, 10, CHENGAL[3]);
  planks(v, 4, 28, 72, 22, true);
  v.hline(4, 75, 49, CHENGAL[3]);
  for (const wx of [10, 26, 50, 62]) {
    v.rect(wx, 33, 8, 9, c("#2b1b10"));
    v.rect(wx + 1, 34, 6, 7, c("#f0e6c8"));
    v.vline(wx + 4, 34, 40, c("#2b1b10"));
  }
  v.rect(38, 32, 9, 17, c("#2b1b10"));
  roof(v, 0, 79, 8, 28, [c("#1a6a48"), c("#2a8a5c"), c("#4aa874"), c("#125038")], false);
  v.rect(26, 12, 28, 8, c("#f4ecdc"));
  v.hline(26, 53, 12, GOLD);
  for (let x = 29; x < 51; x += 4) v.rect(x, 15, 3, 2, M_GREEN);
  crescent(v, 40, 4, 2, GOLD);
  v.outline(INK);
}

function drawKampungHouse(v: View): void {
  // 80×80: rumah Melayu: stilts, pale green walls with white trim, sun-ray gable, stairs + foot-wash jar
  v.shadow(40, 74, 38, 6);
  for (const px of [6, 22, 40, 58, 72]) v.rect(px, 58, 3, 16, c("#5e3b20"));
  for (let y = 30; y < 58; y++) for (let x = 4; x < 76; x++) v.set(x, y, x % 4 === 3 ? c("#4a7e66") : x % 4 === 0 ? c("#b8dcc2") : c("#90c2a4"));
  v.hline(4, 75, 57, c("#f2eee2"));
  v.hline(4, 75, 30, c("#f2eee2"));
  for (const wx of [12, 56]) {
    v.rect(wx, 36, 10, 9, c("#f2eee2"));
    v.rect(wx + 1, 37, 8, 7, c("#2b1b10"));
    v.vline(wx + 5, 37, 43, c("#f2eee2"));
    for (let x = wx; x < wx + 10; x += 2) v.set(x, 47, c("#f2eee2"));
  }
  v.rect(34, 36, 12, 21, c("#f2eee2"));
  v.rect(35, 37, 10, 20, c("#8a5a32"));
  for (let i = 0; i < 5; i++) v.rect(34, 58 + i * 4, 12, 2, TEAK[2]);
  roof(v, 0, 79, 6, 30, [c("#9a3a2a"), c("#b24a32"), c("#c8603c"), c("#7a2c22")], false);
  // sun-ray gable board in the roof centre
  v.poly([[40, 8], [52, 26], [28, 26]], (x, y) => (Math.floor(Math.atan2(26 - y, x - 40) * 6) % 2 ? c("#b8dcc2") : c("#90c2a4")));
  v.line(28, 26, 40, 8, c("#f2eee2"));
  v.line(52, 26, 40, 8, c("#f2eee2"));
  v.line(40, 8, 37, 4, c("#f2eee2"));
  v.line(40, 8, 43, 4, c("#f2eee2"));
  v.ellipse(52, 72, 3, 3, c("#8a4a26"));
  v.ellipse(52, 70, 2, 1, c("#3a5f78"));
  v.outline(INK);
}

function drawHalalStall(v: View): void {
  v.shadow(24, 44, 22, 4);
  v.rect(4, 18, 2, 24, TEAK[3]);
  v.rect(42, 18, 2, 24, TEAK[3]);
  v.rect(3, 28, 42, 12, TEAK[1]);
  v.hline(3, 44, 28, TEAK[2]);
  for (const px of [10, 20]) { v.ellipse(px, 26, 4, 2, c("#c0c8d0")); v.hline(px - 3, px + 3, 25, px === 10 ? c("#e0a224") : c("#cc3a34")); }
  v.ellipse(32, 26, 4, 2, c("#f2eee2"));
  v.ellipse(32, 25, 3, 1, c("#5a7ad0"));
  for (let x = 0; x < 48; x++) {
    const stripe = Math.floor(x / 6) % 2 ? c("#f4ecdc") : M_GREEN;
    for (let y = 4; y < 18; y++) if (!(y > 15 && (x % 6 === 0 || x % 6 === 5))) v.set(x, y, stripe);
  }
  v.hline(0, 47, 17, c("#125038"));
  v.rect(14, 30, 20, 9, M_GREEN);
  crescent(v, 21, 34, 4, c("#ffffff"));
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) v.set(26 + dx, 33 + dy, c("#f6d470"));
  v.outline(INK);
}

function drawChineseShrine(v: View): void {
  v.shadow(24, 44, 22, 4);
  v.rect(4, 22, 40, 20, c("#a4262c"));
  for (const px of [6, 38]) v.rect(px, 20, 4, 22, c("#cc3a34"));
  v.rect(18, 26, 12, 16, c("#2a1410"));
  v.rect(17, 24, 14, 3, c("#e8b440"));
  for (let y = 8; y < 22; y++) {
    const half = Math.round(16 + ((y - 8) / 13) * 8);
    v.hline(24 - half, 23 + half, y, (y - 8) % 3 === 0 ? c("#125038") : c("#2a8a5c"));
  }
  v.set(0, 20, c("#f6c840"));
  v.set(47, 20, c("#f6c840"));
  v.hline(14, 33, 7, c("#f6c840"));
  for (const lx of [12, 35]) { v.ellipse(lx, 26, 2.5, 3, c("#e04a32")); v.set(lx, 25, c("#ffd27a")); }
  v.rect(22, 36, 4, 4, c("#e8b440"));
  v.outline(INK);
}

function drawFishRack(v: View): void {
  v.shadow(16, 14, 14, 2);
  v.rect(2, 2, 2, 13, c("#a4a23c"));
  v.rect(28, 2, 2, 13, c("#a4a23c"));
  v.rect(2, 3, 28, 2, c("#c8c45a"));
  v.rect(4, 5, 24, 7, c("#8a8a7a", 120));
  for (let i = 0; i < 6; i++) { v.rect(5 + i * 4, 6, 2, 5, c("#c8c2b2")); v.set(5 + i * 4, 6, c("#f2eee2")); }
  v.outline(INK);
}

function drawKolek(v: View): void {
  // 48×16: painted kolek, high curled bow (right) and stern (left)
  v.poly([[0, 3], [8, 7], [40, 7], [47, 2], [44, 13], [4, 13]], c("#2a8a5c"));
  v.poly([[2, 5], [8, 8], [40, 8], [45, 4], [43, 10], [5, 10]], c("#cc3a34"));
  v.hline(6, 42, 9, c("#f6c840"));
  for (let x = 8; x < 40; x += 4) v.set(x, 11, c("#f2eee2"));
  v.rect(18, 7, 10, 2, c("#3a6a8a"));
  v.set(0, 2, c("#f6c840"));
  v.set(47, 1, c("#f6c840"));
  v.outline(INK);
}

const PAINTERS: Record<string, (v: View) => void> = {
  mosque: drawMosque,
  tadika: drawTadika,
  kampung_house: drawKampungHouse,
  halal_stall: drawHalalStall,
  chinese_shrine: drawChineseShrine,
  fish_rack: drawFishRack,
  kolek: drawKolek,
  house_wood: drawHouseWood,
  house_small: drawHouseSmall,
  temple: drawTemple,
  sala: drawSala,
  market_stall: drawMarketStall,
  spirit_house: drawSpiritHouse,
  tree_mango: drawMango,
  palm: drawPalm,
  banana: drawBanana,
  bamboo: drawBamboo,
  haystack: drawHaystack,
  water_jar: drawWaterJar,
  lantern_post: drawLanternPost,
  boat: drawBoat,
  bridge_h: (v) => drawBridge(v, true),
  bridge_v: (v) => drawBridge(v, false),
  ...CITY_PAINTERS,
  ...OVERWORLD_PAINTERS,
};

const imageCache = new Map<string, RgbaImage>();

/**
 * Pole lamps whose night look comes only from the explicit mask painted with `markLit` (never from colour
 * guesses): the street lamp and lantern post light their bulbs / lanterns, the utility pole has no lamp.
 */
export const NIGHT_MASKED_KINDS: ReadonlySet<string> = new Set(["lamp_pole", "lantern_post", "utility_pole"]);

/** Explicit night mask (1 = lit) of a sample object kind, all-clear when nothing on it lights up. */
export function objectNightMask(kind: string): Uint8Array | undefined {
  if (!NIGHT_MASKED_KINDS.has(kind) || !PAINTERS[kind]) return undefined;
  const img = objectImage(kind);
  return litMask(img) ?? new Uint8Array(img.width * img.height);
}

/** Procedural PNG for one sample object kind (cached). */
export function objectImage(kind: string): RgbaImage {
  const hit = imageCache.get(kind);
  if (hit) return hit;
  const meta = OBJECT_BY_KIND.get(kind);
  const paint = PAINTERS[kind];
  if (!meta || !paint) throw new Error(`Unknown object kind "${kind}"`);
  const p = new Pix(meta.w * TILE_SIZE, meta.h * TILE_SIZE);
  paint(p.view());
  imageCache.set(kind, p.img);
  return p.img;
}
