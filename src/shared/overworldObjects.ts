/**
 * Overworld town markers for the sample tileset (CC0, procedural, ¾ top-down at world-map scale):
 * a walled Thai town (เวียง) with a white chedi, a brick city, a Malay-Muslim kampung with a small
 * domed mosque (silhouette only: no writing, no figures), a Chinese-Thai market town with shophouses
 * and a shrine, a rural village, and a railway station house. Each town's gate faces south on its
 * centre column; the entrance tile is the walkable tile just below the gate (see townEntrance()).
 */
import { c, noise, Pix, shade, type Rgba, type View } from "./pixel.js";
import type { RgbaImage } from "./raster.js";
import type { ObjectKind } from "./objects.js";
import { TILE_SIZE, type TownKind } from "./types.js";

export const OVERWORLD_OBJECT_KINDS: readonly ObjectKind[] = [
  { kind: "ow_walled_town", name: "Walled Thai town (world map)", nameTh: "เมืองมีกำแพง (แผนที่โลก)", category: "town", w: 5, h: 4, solid: { x: 0, y: 0, w: 5, h: 4 } },
  { kind: "ow_brick_city", name: "Brick city (world map)", nameTh: "เมืองตึกอิฐ (แผนที่โลก)", category: "town", w: 5, h: 4, solid: { x: 0, y: 0, w: 5, h: 4 } },
  { kind: "ow_kampung", name: "Malay kampung with mosque (world map)", nameTh: "กัมปงมลายู มีมัสยิด (แผนที่โลก)", category: "town", w: 4, h: 3, solid: { x: 0, y: 0, w: 4, h: 3 } },
  { kind: "ow_chinatown", name: "Chinese-Thai market town (world map)", nameTh: "ตลาดจีน ศาลเจ้า (แผนที่โลก)", category: "town", w: 4, h: 3, solid: { x: 0, y: 0, w: 4, h: 3 } },
  { kind: "ow_village", name: "Rural village (world map)", nameTh: "หมู่บ้านชนบท (แผนที่โลก)", category: "town", w: 3, h: 2, solid: { x: 0, y: 0, w: 3, h: 2 } },
  { kind: "ow_station", name: "Railway station house (world map)", nameTh: "อาคารสถานีรถไฟ (แผนที่โลก)", category: "town", w: 2, h: 2, solid: { x: 0, y: 0, w: 2, h: 2 } },
];

/** Town marker object for each town kind. */
export const TOWN_OBJECT: Record<TownKind, string> = {
  thai_town: "ow_walled_town",
  brick_city: "ow_brick_city",
  malay_kampung: "ow_kampung",
  chinese_town: "ow_chinatown",
  rural_village: "ow_village",
};

/** Walkable tile in front of the town's south gate (centre column, one row below the image). */
export function townEntrance(o: { x: number; y: number }, k: { w: number; h: number }): [number, number] {
  return [o.x + Math.floor(k.w / 2), o.y + k.h];
}

const T = TILE_SIZE;
const INK = c("#2a1d13");
/** Window glass on the world-map town markers; night.ts lights this exact colour. */
export const WINDOW_HEX = "#4b3b2e";
const WINDOW = c(WINDOW_HEX);
const GOLD = c("#e2b54a");
const GOLD_HI = c("#ffe27a");
const ROOF_RED = [c("#9a3a2a"), c("#b24a32"), c("#d0643c"), c("#6e2a1e")] as const;
const ROOF_GREEN = [c("#2f6a4c"), c("#3b7d5a"), c("#5aa674"), c("#24523a")] as const;
const ROOF_BROWN = [c("#6a4426"), c("#7d5230"), c("#98683e"), c("#4c3019")] as const;
const ROOF_TEAL = [c("#1f6a6a"), c("#2a8282"), c("#4aa6a0"), c("#174f50")] as const;
const BRICK = [c("#a2432c"), c("#b85a3c"), c("#83331f"), c("#6b2c20")] as const;
const LATERITE = [c("#b8723e"), c("#cc8650"), c("#94582c"), c("#e0a06a")] as const;
const LEAF = [c("#2f6a2c"), c("#3f8236"), c("#56a044"), c("#78bf55")] as const;

/** Tiny gabled roof block seen from above-front: ridge on top, lit left slope, eave shadow. */
function miniRoof(v: View, x: number, y: number, w: number, h: number, pal: readonly Rgba[], wall?: Rgba): void {
  const roofH = Math.max(3, Math.round(h * 0.62));
  for (let yy = 0; yy < roofH; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const n = noise(x + xx, y + yy, 1101);
      let col = yy === 0 ? pal[2]! : yy % 2 === 0 ? pal[1]! : n < 0.3 ? pal[0]! : pal[1]!;
      if (xx === 0 || xx === w - 1) col = pal[3]!;
      v.set(x + xx, y + yy, col);
    }
  }
  v.hline(x, x + w - 1, y + roofH - 1, pal[3]!);
  if (wall) {
    v.rect(x + 1, y + roofH, w - 2, h - roofH, wall);
    if (w >= 5) v.rect(x + Math.floor(w / 2) - 1, y + roofH + 1, 2, Math.max(1, h - roofH - 1), c("#3a2618"));
    // small shuttered windows either side of the door (they light up at night, see night.ts)
    if (w >= 8 && h - roofH >= 3) {
      v.set(x + 2, y + roofH + 1, WINDOW);
      v.set(x + w - 3, y + roofH + 1, WINDOW);
    }
  }
}

function palm(v: View, x: number, y: number): void {
  v.vline(x, y, y + 7, c("#7a5434"));
  v.vline(x + 1, y + 2, y + 7, c("#5e3b20"));
  for (const [dx, dy] of [[-4, 1], [4, 1], [-3, -1], [3, -1], [0, -2]] as const) v.line(x, y, x + dx, y + dy, LEAF[dx < 0 ? 2 : 1]!);
  v.set(x, y + 1, c("#c99a3a"));
}

function tree(v: View, x: number, y: number, r = 3): void {
  v.shadow(x, y + r, r, 1.2);
  v.ellipse(x, y, r, r, (_x, _y, dx, dy) => (dx + dy < -0.6 ? LEAF[3]! : dx + dy > 0.6 ? LEAF[0]! : LEAF[1]!));
}

/** Fortified wall ring: lit top walk, darker outer face, crenels, corner bastions; gate gap in the south. */
function wallRing(v: View, x0: number, y0: number, x1: number, y1: number, gateX: number, pal: readonly Rgba[]): void {
  const top = pal[1]!;
  const face = pal[2]!;
  const hi = pal[3]!;
  const band = (x: number, y: number, w: number, h: number) => v.rect(x, y, w, h, top);
  band(x0, y0, x1 - x0 + 1, 3); // north
  band(x0, y0, 3, y1 - y0 + 1); // west
  band(x1 - 2, y0, 3, y1 - y0 + 1); // east
  band(x0, y1 - 4, x1 - x0 + 1, 3); // south walk
  v.rect(x0, y1 - 1, x1 - x0 + 1, 2, face); // south outer face
  for (let x = x0; x <= x1; x += 3) v.set(x, y0, hi);
  for (let x = x0; x <= x1; x += 3) v.set(x, y1 - 4, hi);
  // corner bastions
  for (const [bx, by] of [[x0, y0], [x1 - 4, y0], [x0, y1 - 6], [x1 - 4, y1 - 6]] as const) {
    v.rect(bx, by, 5, 5, top);
    v.rect(bx, by + 4, 5, 2, face);
    v.set(bx + 1, by + 1, hi);
    v.set(bx + 3, by + 1, hi);
  }
  // gate: tower over a dark arch with wooden doors, opening onto the entrance tile
  v.rect(gateX - 6, y1 - 9, 12, 10, face);
  v.rect(gateX - 6, y1 - 10, 12, 3, top);
  miniRoof(v, gateX - 7, y1 - 15, 14, 6, ROOF_RED);
  v.rect(gateX - 3, y1 - 5, 6, 6, c("#24160e"));
  v.vline(gateX - 3, y1 - 5, y1, c("#7a4e2a"));
  v.vline(gateX + 2, y1 - 5, y1, c("#7a4e2a"));
}

function chedi(v: View, cx: number, base: number): void {
  // white bell-shaped stupa on a stepped base with a gold spire (architecture only)
  const white = c("#f2ede2");
  const shadow = c("#cfc6b4");
  v.rect(cx - 5, base - 2, 11, 2, shadow);
  v.rect(cx - 4, base - 4, 9, 2, white);
  v.ellipse(cx + 0.5, base - 7, 4, 3.5, (_x, _y, dx) => (dx > 0.35 ? shadow : white));
  v.rect(cx - 1, base - 12, 3, 3, white);
  v.vline(cx, base - 18, base - 12, GOLD);
  v.vline(cx + 1, base - 15, base - 12, c("#b8923a"));
  v.set(cx, base - 19, GOLD_HI);
}

function drawWalledTown(v: View): void {
  // 80×64
  v.shadow(40, 61, 38, 4);
  for (let y = 4; y < 58; y++) for (let x = 3; x < 77; x++) v.set(x, y, shade(noise(x, y, 1111), [c("#c9b48c"), c("#bba57c"), c("#d4c19a")], [3, 2, 1]));
  // houses inside: red and green Thai gables
  const houses: Array<[number, number, number, number, readonly Rgba[]]> = [
    [8, 26, 12, 10, ROOF_RED], [22, 30, 10, 9, ROOF_GREEN], [50, 28, 12, 10, ROOF_RED], [63, 24, 9, 9, ROOF_GREEN],
    [9, 40, 10, 9, ROOF_GREEN], [58, 40, 12, 9, ROOF_RED], [24, 42, 9, 8, ROOF_RED], [46, 43, 9, 8, ROOF_GREEN],
  ];
  for (const [x, y, w, h, pal] of houses) {
    v.rect(x + 1, y + h, w, 1, c("#14100a", 70));
    miniRoof(v, x, y, w, h, pal, c("#efe2c4"));
    v.set(x + 1, y - 1, GOLD);
    v.set(x + w - 2, y - 1, GOLD);
  }
  tree(v, 42, 24, 3);
  tree(v, 70, 50, 2.5);
  // chedi in the middle-back, temple hall in front of it
  chedi(v, 38, 24);
  miniRoof(v, 32, 26, 14, 10, ROOF_RED, c("#f4ede0"));
  v.hline(33, 44, 25, GOLD);
  wallRing(v, 1, 2, 78, 63, 40, LATERITE);
  v.outline(INK);
}

function drawBrickCity(v: View): void {
  // 80×64: brick blocks with tar roofs, a clock tower, chimneys, a central street opening south
  v.shadow(40, 61, 38, 4);
  for (let y = 6; y < 62; y++) for (let x = 2; x < 78; x++) v.set(x, y, shade(noise(x, y, 1121), [c("#9a968c"), c("#8c887e")], [3, 1]));
  // street N–S through the centre to the gate
  v.rect(35, 30, 10, 34, c("#4a4b52"));
  for (let y = 32; y < 62; y += 6) v.rect(39, y, 2, 3, c("#e8d27a"));
  const block = (x: number, y: number, w: number, h: number, b: readonly Rgba[]) => {
    v.rect(x, y, w, h - 5, c("#55565d"));
    v.rect(x, y, w, 2, c("#d8d0bf"));
    for (let yy = h - 5; yy < h; yy++) for (let xx = 0; xx < w; xx++) v.set(x + xx, y + yy, yy === h - 5 ? b[3]! : (xx + (yy % 2) * 2) % 4 === 3 ? b[3]! : b[noise(x + xx, y + yy, 1123) < 0.25 ? 2 : 0]!);
    for (let xx = 2; xx < w - 2; xx += 4) v.rect(x + xx, y + h - 4, 2, 2, c("#9cc0d8"));
  };
  block(4, 8, 28, 20, BRICK);
  block(48, 10, 28, 18, [c("#7e4a33"), c("#94593e"), c("#653a27"), c("#4f2e20")]);
  block(4, 32, 28, 22, [c("#c08a5a"), c("#d29e6c"), c("#a6744a"), c("#8a6040")]);
  block(48, 32, 28, 22, BRICK);
  // clock tower
  v.rect(36, 6, 8, 22, c("#b85a3c"));
  v.rect(36, 6, 8, 2, c("#d8d0bf"));
  v.ellipse(40, 13, 3, 3, c("#f4f0e6"));
  v.set(40, 12, INK);
  v.set(41, 13, INK);
  v.poly([[35, 6], [45, 6], [40, 0]], c("#2c4a6a"));
  // chimneys + smoke
  for (const [x, y] of [[10, 6], [66, 8]] as const) {
    v.rect(x, y, 3, 5, c("#83331f"));
    v.ellipse(x + 2, y - 3, 2.5, 2, c("#e4e0d6", 200));
  }
  tree(v, 30, 58, 2.5);
  tree(v, 50, 58, 2.5);
  v.outline(INK);
}

function drawKampung(v: View): void {
  // 64×48: raised Malay houses, coconut palms and a small domed mosque with a minaret
  v.shadow(32, 46, 30, 3);
  for (let y = 10; y < 46; y++) for (let x = 3; x < 61; x++) if (noise(x, y, 1131) < 0.9) v.set(x, y, shade(noise(x, y, 1133), [c("#d8c49a"), c("#cbb68c")], [3, 1]));
  // mosque: cream hall, green dome, slim minaret with a small dome cap (silhouette only)
  const cream = c("#f1e8d2");
  const creamDk = c("#d6caae");
  const green = c("#2a8a5c");
  const greenHi = c("#5ac08a");
  v.rect(24, 16, 20, 14, cream);
  v.rect(24, 28, 20, 2, creamDk);
  v.rect(32, 22, 4, 8, c("#24160e"));
  v.ellipse(34, 21, 2, 1.6, (_x, _y, _dx, dy) => (dy < 0 ? c("#24160e") : null));
  for (const wx of [26, 39]) v.rect(wx, 21, 3, 4, green);
  v.ellipse(34, 14, 6, 5, (_x, _y, dx, dy) => (dy > 0.45 ? null : dx < -0.25 && dy < -0.2 ? greenHi : green));
  v.vline(34, 6, 9, GOLD);
  v.set(34, 5, GOLD_HI);
  // minaret
  v.rect(47, 6, 4, 24, cream);
  v.vline(50, 6, 29, creamDk);
  v.rect(46, 12, 6, 1, creamDk);
  v.ellipse(49, 5, 2.5, 2.5, (_x, _y, _dx, dy) => (dy > 0.3 ? null : green));
  v.set(49, 1, GOLD);
  // raised houses (brown / teal roofs on stilts)
  const house = (x: number, y: number, pal: readonly Rgba[]) => {
    v.rect(x + 1, y + 10, 1, 3, c("#5e3b20"));
    v.rect(x + 9, y + 10, 1, 3, c("#5e3b20"));
    miniRoof(v, x, y, 11, 10, pal, c("#b07c48"));
  };
  house(4, 18, ROOF_BROWN);
  house(10, 31, ROOF_TEAL);
  house(46, 32, ROOF_BROWN);
  palm(v, 8, 10);
  palm(v, 58, 18);
  palm(v, 21, 34);
  // path to the south entrance
  v.rect(30, 32, 6, 16, c("#b58552"));
  v.outline(INK);
}

function drawChinatown(v: View): void {
  // 64×48: two rows of shophouses with curved ridge ends, red lanterns, a shrine with green tiles
  v.shadow(32, 46, 30, 3);
  for (let y = 6; y < 46; y++) for (let x = 2; x < 62; x++) v.set(x, y, shade(noise(x, y, 1141), [c("#c9c4b8"), c("#bdb8ac")], [3, 1]));
  const tileRoof = [c("#b24a32"), c("#c8603c"), c("#e07a4a"), c("#7a2c22")] as const;
  const shophouses = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const sx = x + i * 9;
      miniRoof(v, sx, y, 9, 11, tileRoof, i % 2 ? c("#e6d8b8") : c("#d8c8a0"));
      v.set(sx, y - 1, tileRoof[2]!);
      v.set(sx + 8, y - 1, tileRoof[2]!);
      v.rect(sx + 2, y + 8, 5, 1, i % 3 === 0 ? c("#2c6aa8") : c("#c8402e"));
    }
  };
  shophouses(3, 6, 3);
  shophouses(34, 6, 3);
  shophouses(3, 26, 3);
  shophouses(34, 26, 3);
  // shrine at the back centre: red pillars, green glazed roof with curled ends
  v.rect(27, 10, 10, 9, c("#c8402e"));
  v.rect(30, 13, 4, 6, c("#24160e"));
  miniRoof(v, 25, 4, 14, 8, ROOF_GREEN);
  v.set(24, 3, GOLD);
  v.set(39, 3, GOLD);
  v.set(32, 3, GOLD_HI);
  // lantern string across the street
  v.line(4, 24, 60, 24, c("#3a2618"));
  for (let x = 7; x < 60; x += 6) {
    v.rect(x, 25, 2, 2, c("#e0402e"));
    v.set(x, 25, c("#ffb04a"));
  }
  v.rect(28, 36, 8, 12, c("#9a968c"));
  v.outline(INK);
}

function drawVillage(v: View): void {
  // 48×32: thatched huts, a haystack, banana plants and a fence
  v.shadow(24, 30, 22, 2.5);
  const thatch = [c("#b8923a"), c("#cfa84c"), c("#e2c26a"), c("#8a6a2a")] as const;
  miniRoof(v, 4, 6, 12, 11, thatch, c("#9c6a3c"));
  miniRoof(v, 30, 4, 13, 12, thatch, c("#a87a46"));
  miniRoof(v, 17, 16, 10, 9, thatch, c("#9c6a3c"));
  v.ellipse(39, 23, 4, 3, (_x, _y, dx, dy) => (dx + dy < -0.4 ? c("#f0d070") : c("#c9a03e")));
  tree(v, 8, 23, 2.5);
  palm(v, 44, 12);
  for (let x = 2; x < 46; x += 3) v.set(x, 29, c("#8a5d33"));
  v.hline(2, 45, 28, c("#a2703f"));
  v.rect(21, 25, 6, 7, c("#b58552"));
  v.outline(INK);
}

function drawStation(v: View): void {
  // 32×32: cream station house, red gabled roof, clock and a blue name board (no text)
  v.shadow(16, 30, 15, 2);
  miniRoof(v, 1, 3, 30, 18, ROOF_RED, c("#f0e2b8"));
  v.rect(4, 15, 4, 4, c("#2d4157"));
  v.rect(24, 15, 4, 4, c("#2d4157"));
  v.rect(13, 14, 6, 7, c("#5a3a22"));
  v.ellipse(16, 8, 2.5, 2.5, c("#f4f0e6"));
  v.set(16, 7, INK);
  v.set(17, 8, INK);
  v.rect(8, 22, 16, 3, c("#2c6aa8"));
  v.hline(9, 22, 23, c("#f4f0e6"));
  v.rect(0, 26, 32, 4, c("#c9c4b8"));
  v.hline(0, 31, 26, c("#f0c43c"));
  v.outline(INK);
}

export const OVERWORLD_PAINTERS: Record<string, (v: View) => void> = {
  ow_walled_town: drawWalledTown,
  ow_brick_city: drawBrickCity,
  ow_kampung: drawKampung,
  ow_chinatown: drawChinatown,
  ow_village: drawVillage,
  ow_station: drawStation,
};

/**
 * Small top-down train for exports (64×16): locomotive E–W, carriage E–W, locomotive N–S, carriage N–S.
 * The E–W locomotive faces east; mirror it for westbound.
 */
export function trainSheet(): RgbaImage {
  const p = new Pix(4 * T, T);
  const body = c("#c8402e");
  const bodyHi = c("#e0603e");
  const roof = c("#f4f0e6");
  const roofSh = c("#cfc8b5");
  const glass = c("#2d4157");
  const ew = (v: View, loco: boolean) => {
    v.rect(0, 3, 16, 10, body);
    v.rect(1, 4, 14, 6, loco ? c("#8a2a1c") : roof);
    v.hline(1, 14, 4, loco ? body : roofSh);
    v.hline(0, 15, 12, c("#7a2c22"));
    if (loco) {
      v.rect(12, 4, 3, 8, bodyHi);
      v.rect(13, 5, 2, 6, glass);
      v.rect(5, 6, 3, 3, c("#3a3b42"));
      v.set(15, 7, c("#ffe27a"));
    } else for (let x = 2; x < 14; x += 3) v.rect(x, 10, 2, 2, glass);
    v.outline(INK);
  };
  const ns = (v: View, loco: boolean) => {
    v.rect(3, 0, 10, 16, body);
    v.rect(4, 1, 6, 14, loco ? c("#8a2a1c") : roof);
    v.vline(12, 0, 15, c("#7a2c22"));
    if (loco) {
      v.rect(4, 12, 8, 3, bodyHi);
      v.rect(5, 13, 6, 2, glass);
      v.set(7, 15, c("#ffe27a"));
    } else for (let y = 2; y < 14; y += 3) v.rect(10, y, 2, 2, glass);
    v.outline(INK);
  };
  ew(p.view(0, 0, T, T), true);
  ew(p.view(T, 0, T, T), false);
  ns(p.view(2 * T, 0, T, T), true);
  ns(p.view(3 * T, 0, T, T), false);
  return p.img;
}

/**
 * Top-down passenger plane facing right (frame 0, 32 × 32) and its ground shadow (frame 1). The runtime scales the
 * plane up as it climbs and moves the shadow away from it.
 */
export function planeSheet(): RgbaImage {
  const p = new Pix(2 * 32, 32);
  const body = c("#f4f0e6");
  const bodySh = c("#cfc8b5");
  const stripe = c("#2c4590");
  const tail = c("#e06e1c");
  const wing = c("#b9c0c8");
  const wingSh = c("#87919f");
  const glass = c("#2d4157");
  const draw = (v: View, col: (k: Rgba) => Rgba) => {
    // wings (swept back)
    for (let i = 0; i < 12; i++) {
      v.hline(13 - Math.floor(i * 0.45), 18 - Math.floor(i * 0.45), 15 - i, col(i > 9 ? wingSh : wing));
      v.hline(13 - Math.floor(i * 0.45), 18 - Math.floor(i * 0.45), 16 + i, col(i > 9 ? wingSh : wing));
    }
    // engines
    v.rect(15, 9, 4, 2, col(wingSh));
    v.rect(15, 21, 4, 2, col(wingSh));
    // tailplane
    for (let i = 0; i < 5; i++) {
      v.hline(3 - Math.floor(i * 0.4), 6 - Math.floor(i * 0.4), 15 - i, col(wing));
      v.hline(3 - Math.floor(i * 0.4), 6 - Math.floor(i * 0.4), 16 + i, col(wing));
    }
    // fuselage
    for (let x = 1; x < 30; x++) {
      const half = x > 26 ? 29 - x : x < 4 ? 1 : 2;
      for (let y = 16 - half; y < 16 + half; y++) v.set(x, y, col(y < 15 ? body : bodySh));
      if (x > 6 && x < 26) v.set(x, 15, col(stripe));
    }
    v.rect(1, 14, 3, 4, col(tail));
    v.set(27, 15, col(glass));
    v.set(27, 16, col(glass));
  };
  draw(p.view(0, 0, 32, 32), (k) => k);
  p.view(0, 0, 32, 32).outline(INK);
  draw(p.view(32, 0, 32, 32), () => c("#000000", 90));
  return p.img;
}

/** Top-down airport (6 × 3 tiles = 96 × 48): runway with markings on top, terminal with a control tower below. */
export function airportImage(): RgbaImage {
  const p = new Pix(96, 48);
  const v = p.view();
  const asphalt = [c("#4a4a52"), c("#56565e"), c("#3e3e46")] as const;
  for (let y = 2; y < 22; y++) for (let x = 0; x < 96; x++) v.set(x, y, shade(noise(x, y, 77), asphalt));
  v.hline(0, 95, 2, c("#6a6a72"));
  v.hline(0, 95, 21, c("#2e2e36"));
  for (let x = 6; x < 90; x += 10) v.hline(x, x + 5, 11, c("#f4f0e6"));
  for (const tx of [2, 89]) for (let y = 5; y < 19; y += 3) v.hline(tx, tx + 4, y, c("#f4f0e6"));
  // taxiway to the apron
  for (let y = 22; y < 30; y++) v.rect(40, y, 8, 1, shade(noise(40, y, 9), asphalt));
  // apron + terminal
  v.rect(4, 30, 88, 16, c("#b4aa9a"));
  v.rect(10, 30, 50, 12, c("#d8dde4"));
  v.rect(10, 30, 50, 3, c("#4064b4"));
  for (let x = 12; x < 58; x += 4) v.rect(x, 35, 2, 4, c("#4f7896"));
  // control tower
  v.rect(66, 32, 8, 10, c("#cfc8b5"));
  v.rect(64, 30, 12, 5, c("#4f7896"));
  v.rect(64, 29, 12, 1, c("#87919f"));
  // gate (the walkable door on the bottom row, tile x = 1)
  v.rect(20, 42, 8, 4, c("#6a3e22"));
  v.rect(21, 43, 6, 3, c("#2d4157"));
  // windsock
  v.vline(84, 36, 44, c("#87919f"));
  v.rect(85, 36, 4, 2, c("#e06e1c"));
  v.outline(INK);
  return p.img;
}
