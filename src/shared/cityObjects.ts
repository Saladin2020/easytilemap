/**
 * Brick-town object set for the sample tileset (CC0, procedural): brick rowhouses / apartment with a
 * fire escape / garage / corner shop seen top-down in 3/4 (flat tar roof + the street-facing wall),
 * a roof-only block filler, big street trees whose canopy overhangs the road, shrubs, lamp and
 * utility poles, and a red postbox.
 */
import { c, markLit, noise, shade, type Rgba, type View } from "./pixel.js";
import type { ObjectKind } from "./objects.js";

export const CITY_OBJECT_KINDS: readonly ObjectKind[] = [
  { kind: "brick_rowhouse", name: "Brick rowhouse (red)", nameTh: "ตึกแถวอิฐแดง", category: "building", w: 4, h: 5, solid: { x: 0, y: 2, w: 4, h: 3 } },
  { kind: "brick_rowhouse_brown", name: "Brick rowhouse (brown)", nameTh: "ตึกแถวอิฐน้ำตาล", category: "building", w: 4, h: 5, solid: { x: 0, y: 2, w: 4, h: 3 } },
  { kind: "brick_apartment", name: "Brick apartment + fire escape", nameTh: "อพาร์ตเมนต์อิฐ บันไดหนีไฟ", category: "building", w: 6, h: 7, solid: { x: 0, y: 3, w: 6, h: 4 } },
  { kind: "brick_garage", name: "Brick garage", nameTh: "โรงรถอิฐ", category: "building", w: 3, h: 4, solid: { x: 0, y: 2, w: 3, h: 2 } },
  { kind: "brick_shop_corner", name: "Corner shop (teal awning)", nameTh: "ร้านหัวมุม กันสาดเขียว", category: "building", w: 5, h: 5, solid: { x: 0, y: 2, w: 5, h: 3 } },
  { kind: "brick_roof", name: "Flat roof (block filler)", nameTh: "หลังคาดาดฟ้า", category: "building", w: 4, h: 4, solid: { x: 0, y: 0, w: 4, h: 4 } },
  { kind: "street_tree_large", name: "Large street tree", nameTh: "ต้นไม้ริมถนนใหญ่", category: "nature", w: 4, h: 4, solid: { x: 1, y: 3, w: 2, h: 1 } },
  { kind: "shrub", name: "Shrub", nameTh: "พุ่มไม้", category: "nature", w: 1, h: 1, solid: { x: 0, y: 0, w: 1, h: 1 } },
  { kind: "lamp_pole", name: "Street lamp", nameTh: "เสาไฟถนน", category: "prop", w: 1, h: 3, solid: { x: 0, y: 2, w: 1, h: 1 } },
  { kind: "utility_pole", name: "Utility pole", nameTh: "เสาไฟฟ้า", category: "prop", w: 1, h: 4, solid: { x: 0, y: 3, w: 1, h: 1 } },
  { kind: "postbox_red", name: "Red postbox", nameTh: "ตู้ไปรษณีย์แดง", category: "prop", w: 1, h: 2, solid: { x: 0, y: 1, w: 1, h: 1 } },
];

const INK = c("#221a16");
type Brick = { base: Rgba; light: Rgba; dark: Rgba; mortar: Rgba };
const BRICK: Record<"red" | "brown" | "tan", Brick> = {
  red: { base: c("#a2432c"), light: c("#b85a3c"), dark: c("#83331f"), mortar: c("#6b2c20") },
  brown: { base: c("#7e4a33"), light: c("#94593e"), dark: c("#653a27"), mortar: c("#4f2e20") },
  tan: { base: c("#c08a5a"), light: c("#d29e6c"), dark: c("#a6744a"), mortar: c("#8a6040") },
};
const STONE = [c("#d8d0bf"), c("#bdb4a2"), c("#9a917f")] as const;
const TAR = [c("#4a4b52"), c("#55565d"), c("#404148"), c("#62636a")] as const;
const GLASS = [c("#2d4157"), c("#4c6c8a"), c("#9cc0d8")] as const;
const LEAF = [c("#2c5f2a"), c("#3c7a33"), c("#529641"), c("#76b553"), c("#9bcf6a")] as const;
const IRON = c("#26282d");

function brickWall(v: View, x0: number, y0: number, w: number, h: number, b: Brick): void {
  for (let y = 0; y < h; y++) {
    const course = Math.floor(y / 3);
    for (let x = 0; x < w; x++) {
      const px = x0 + x;
      const py = y0 + y;
      if (y % 3 === 2 || (x + (course % 2) * 2) % 5 === 4) {
        v.set(px, py, b.mortar);
        continue;
      }
      const n = noise(Math.floor((x + (course % 2) * 2) / 5), course, 401 + x0);
      v.set(px, py, n < 0.2 ? b.dark : n > 0.85 ? b.light : b.base);
    }
  }
}

/** Flat tar roof with a stone-capped parapet. */
function tarRoof(v: View, x0: number, y0: number, w: number, h: number): void {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) v.set(x0 + x, y0 + y, shade(noise(x, y, 411), TAR, [5, 2, 2, 1]));
  for (let x = 0; x < w; x++) {
    v.set(x0 + x, y0, STONE[0]);
    v.set(x0 + x, y0 + 1, STONE[1]);
    v.set(x0 + x, y0 + 2, TAR[2]);
  }
  for (let y = 0; y < h; y++) {
    v.set(x0, y0 + y, STONE[0]);
    v.set(x0 + 1, y0 + y, STONE[1]);
    v.set(x0 + w - 1, y0 + y, STONE[1]);
    v.set(x0 + w - 2, y0 + y, STONE[0]);
  }
}

function cornice(v: View, x0: number, y: number, w: number): void {
  v.hline(x0, x0 + w - 1, y, STONE[0]);
  v.hline(x0, x0 + w - 1, y + 1, STONE[1]);
  for (let x = x0; x < x0 + w; x++) v.set(x, y + 2, x % 3 === 0 ? STONE[2] : STONE[1]);
  v.hline(x0, x0 + w - 1, y + 3, c("#5a4a40"));
}

function chimney(v: View, x: number, y: number, b: Brick): void {
  brickWall(v, x, y + 3, 8, 7, b);
  v.rect(x, y, 8, 3, STONE[1]);
  v.rect(x + 2, y + 1, 4, 1, IRON);
  v.hline(x, x + 7, y, STONE[0]);
}

function skylight(v: View, x: number, y: number, w: number, h: number): void {
  v.rect(x, y, w, h, STONE[2]);
  v.rect(x + 1, y + 1, w - 2, h - 2, GLASS[0]);
  v.line(x + 2, y + h - 3, x + Math.min(w - 3, h), y + 1, GLASS[2]);
  v.vline(x + (w >> 1), y + 1, y + h - 2, STONE[2]);
}

function acUnit(v: View, x: number, y: number): void {
  v.rect(x, y, 10, 7, c("#c4c6c8"));
  v.hline(x, x + 9, y, c("#e2e4e6"));
  v.ellipse(x + 5, y + 3.5, 2.6, 2.6, c("#6d7177"));
  v.set(x + 5, y + 3, c("#c4c6c8"));
  v.hline(x, x + 9, y + 7, c("#2a2b2f", 120));
}

function sashWindow(v: View, x: number, y: number, w: number, h: number, curtain?: Rgba): void {
  v.rect(x - 1, y - 2, w + 2, 2, STONE[1]); // lintel
  v.set(x + (w >> 1), y - 2, STONE[0]);
  v.rect(x, y, w, h, c("#efe9dc")); // frame
  v.rect(x + 1, y + 1, w - 2, h - 2, GLASS[1]);
  v.rect(x + 1, y + 1, w - 2, 2, GLASS[0]);
  v.hline(x + 1, x + w - 2, y + (h >> 1), c("#efe9dc"));
  v.set(x + 2, y + (h >> 1) + 2, GLASS[2]);
  v.set(x + 3, y + (h >> 1) + 1, GLASS[2]);
  if (curtain) {
    v.rect(x + 1, y + 1, 2, h - 2, curtain);
    v.rect(x + w - 3, y + 1, 2, h - 2, curtain);
  }
  v.rect(x - 1, y + h, w + 2, 1, STONE[0]); // sill
  v.hline(x - 1, x + w, y + h + 1, c("#3a2a24", 110));
}

function frontDoor(v: View, x: number, y: number, w: number, h: number, col: Rgba): void {
  v.rect(x - 1, y - 4, w + 2, h + 4, STONE[1]);
  v.ellipse(x + w / 2, y - 1, w / 2 - 0.5, 3, GLASS[1]); // fanlight
  v.rect(x, y, w, h, col);
  v.vline(x + (w >> 1), y + 1, y + h - 1, c("#000000", 60));
  v.rect(x + 1, y + 2, (w >> 1) - 2, 4, c("#ffffff", 40));
  v.set(x + w - 3, y + (h >> 1), c("#e8c45a"));
}

/** Stoop: stone steps fanning out from the door, iron rails at the sides. */
function stoop(v: View, cx: number, y: number, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const hw = 6 + i * 1.5;
    const yy = y + i * 2;
    v.rect(Math.round(cx - hw), yy, Math.round(hw * 2), 1, STONE[0]);
    v.rect(Math.round(cx - hw), yy + 1, Math.round(hw * 2), 1, STONE[2]);
  }
  const last = 6 + (steps - 1) * 1.5;
  v.line(Math.round(cx - 7), y - 3, Math.round(cx - last - 1), y + steps * 2 - 1, IRON);
  v.line(Math.round(cx + 6), y - 3, Math.round(cx + last), y + steps * 2 - 1, IRON);
}

function plinth(v: View, x0: number, y: number, w: number, h: number): void {
  v.rect(x0, y, w, h, STONE[1]);
  v.hline(x0, x0 + w - 1, y, STONE[0]);
}

function downpipe(v: View, x: number, y0: number, y1: number): void {
  v.vline(x, y0, y1, c("#3b3e44"));
  v.vline(x + 1, y0, y1, c("#5a5e66"));
}

function rowhouse(v: View, b: Brick, door: Rgba, curtain: Rgba): void {
  // roof (y 0..31) + cornice (32..35) + facade (36..79)
  tarRoof(v, 0, 0, 64, 32);
  chimney(v, 6, 3, b);
  skylight(v, 38, 9, 12, 8);
  acUnit(v, 18, 19);
  v.rect(52, 22, 5, 4, TAR[3]); // roof hatch
  cornice(v, 0, 32, 64);
  brickWall(v, 0, 36, 64, 44, b);
  sashWindow(v, 7, 41, 11, 12, curtain);
  sashWindow(v, 27, 41, 10, 12, curtain);
  sashWindow(v, 46, 41, 11, 12);
  sashWindow(v, 7, 59, 11, 12);
  sashWindow(v, 46, 59, 11, 12, curtain);
  plinth(v, 0, 76, 64, 4);
  frontDoor(v, 27, 60, 10, 14, door);
  stoop(v, 32, 74, 3);
  downpipe(v, 61, 34, 76);
  v.outline(INK);
}

function drawRowhouseRed(v: View): void {
  rowhouse(v, BRICK.red, c("#2f4f3e"), c("#e9dfc7"));
}
function drawRowhouseBrown(v: View): void {
  rowhouse(v, BRICK.brown, c("#7b2a2a"), c("#d7b98a"));
}

function drawApartment(v: View): void {
  const b = BRICK.red;
  tarRoof(v, 0, 0, 96, 44);
  // water tank on legs
  v.rect(14, 18, 2, 10, IRON);
  v.rect(28, 18, 2, 10, IRON);
  v.ellipse(22, 14, 10, 9, (x, _y, dx) => (dx < -0.4 ? c("#9a6a42") : dx > 0.5 ? c("#5e3f26") : x % 3 === 0 ? c("#6e4a2e") : c("#82583a")));
  v.poly([[11, 8], [22, 0], [33, 8]], c("#4a4b52"));
  skylight(v, 46, 10, 14, 9);
  acUnit(v, 66, 8);
  acUnit(v, 66, 22);
  chimney(v, 82, 4, b);
  v.rect(46, 28, 6, 5, TAR[3]);
  cornice(v, 0, 44, 96);
  brickWall(v, 0, 48, 96, 64, b);
  const cols = [7, 29, 52, 74];
  for (const y of [52, 67, 82]) cols.forEach((x, i) => sashWindow(v, x, y, 13, 11, i === 1 ? c("#e9dfc7") : undefined));
  sashWindow(v, 7, 97, 13, 11);
  frontDoor(v, 31, 97, 12, 13, c("#2b3b55"));
  stoop(v, 37, 108, 2);
  plinth(v, 0, 108, 30, 4);
  plinth(v, 46, 108, 50, 4);
  // fire escape over the right two window columns: platforms + rails + zig-zag ladders
  const fx0 = 48;
  const fx1 = 92;
  for (const py of [64, 79, 94]) {
    v.rect(fx0, py, fx1 - fx0 + 1, 2, IRON);
    v.hline(fx0, fx1, py - 5, IRON);
    for (let x = fx0; x <= fx1; x += 3) v.vline(x, py - 5, py, IRON);
  }
  v.line(fx0 + 4, 79, fx0 + 16, 66, IRON);
  v.line(fx0 + 5, 79, fx0 + 17, 66, c("#3c4048"));
  v.line(fx1 - 4, 94, fx1 - 16, 81, IRON);
  v.line(fx1 - 5, 94, fx1 - 17, 81, c("#3c4048"));
  v.vline(fx1 - 2, 96, 104, IRON); // drop ladder
  v.vline(fx1 - 6, 96, 104, IRON);
  for (let y = 98; y <= 104; y += 2) v.hline(fx1 - 6, fx1 - 2, y, IRON);
  downpipe(v, 93, 46, 108);
  v.outline(INK);
}

function drawGarage(v: View): void {
  const b = BRICK.brown;
  tarRoof(v, 0, 0, 48, 24);
  acUnit(v, 30, 8);
  cornice(v, 0, 24, 48);
  brickWall(v, 0, 28, 48, 36, b);
  v.rect(6, 36, 36, 2, STONE[1]); // lintel
  v.rect(7, 38, 34, 24, c("#c9ccd0"));
  for (let y = 40; y < 62; y += 3) v.hline(7, 40, y, c("#8e9399"));
  v.hline(7, 40, 38, c("#e3e5e8"));
  v.rect(21, 56, 6, 2, c("#5d6168"));
  v.vline(42, 30, 62, c("#3b3e44"));
  v.outline(INK);
}

function drawShopCorner(v: View): void {
  const b = BRICK.tan;
  tarRoof(v, 0, 0, 80, 28);
  skylight(v, 8, 8, 12, 8);
  acUnit(v, 52, 10);
  cornice(v, 0, 28, 80);
  brickWall(v, 0, 32, 80, 48, b);
  for (const x of [6, 25, 44, 63]) sashWindow(v, x, 36, 11, 10, x === 25 ? c("#f0e2c0") : undefined);
  // sign band with abstract lettering
  v.rect(0, 50, 80, 6, c("#1f4f4a"));
  v.hline(0, 79, 50, c("#2d6e66"));
  for (let x = 14; x < 66; x += 3) if (noise(x, 1, 431) > 0.25) v.rect(x, 52, 2, 2, c("#f1e6c8"));
  // striped teal / cream awning with scalloped valance
  for (let y = 56; y < 63; y++) for (let x = 0; x < 80; x++) v.set(x, y, Math.floor(x / 5) % 2 ? c("#e9e1cc") : y < 58 ? c("#3fa297") : c("#2f8a80"));
  for (let x = 0; x < 80; x++) if (x % 5 !== 0 && x % 5 !== 4) v.set(x, 63, Math.floor(x / 5) % 2 ? c("#cfc6ae") : c("#24706a"));
  v.hline(0, 79, 56, c("#bfe6dc"));
  // shop window + door
  v.rect(4, 64, 52, 12, c("#2b4c48"));
  v.rect(5, 65, 50, 10, GLASS[1]);
  v.rect(5, 72, 50, 3, c("#d9a457")); // goods on display
  for (let x = 7; x < 55; x += 6) v.rect(x, 70, 3, 2, x % 12 ? c("#c74c3c") : c("#f0d26a"));
  v.line(8, 74, 14, 66, GLASS[2]);
  v.rect(62, 64, 12, 12, c("#2b4c48"));
  v.rect(63, 65, 10, 6, GLASS[1]);
  v.set(71, 72, c("#e8c45a"));
  plinth(v, 0, 76, 80, 4);
  v.outline(INK);
}

function drawRoofOnly(v: View): void {
  tarRoof(v, 0, 0, 64, 64);
  v.hline(0, 63, 62, STONE[1]);
  v.hline(0, 63, 63, STONE[2]);
  skylight(v, 10, 12, 14, 10);
  acUnit(v, 40, 14);
  acUnit(v, 40, 36);
  v.rect(12, 40, 6, 6, TAR[3]);
  v.ellipse(26, 48, 3, 3, c("#7a7d84"));
  v.outline(INK);
}

function canopy(v: View, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  v.ellipse(cx, cy, rx, ry, (x, y, dx, dy) => {
    const n = noise(x >> 1, y >> 1, seed);
    const light = -dx * 0.55 - dy * 0.75 + (n - 0.5) * 0.9;
    return light > 0.75 ? LEAF[4] : light > 0.3 ? LEAF[3] : light > -0.15 ? LEAF[2] : light > -0.6 ? LEAF[1] : LEAF[0];
  });
}

function drawStreetTree(v: View): void {
  v.shadow(32, 59, 22, 4, 80);
  v.rect(29, 40, 6, 20, c("#5b3b26"));
  v.vline(29, 40, 59, c("#7a5236"));
  v.line(31, 44, 22, 36, c("#5b3b26"));
  v.line(33, 44, 42, 35, c("#5b3b26"));
  canopy(v, 32, 26, 30, 22, 441);
  canopy(v, 16, 30, 13, 11, 443);
  canopy(v, 48, 30, 13, 11, 447);
  canopy(v, 26, 14, 14, 11, 449);
  canopy(v, 42, 15, 13, 10, 451);
  v.outline(INK);
}

function drawShrub(v: View): void {
  v.shadow(8, 14, 7, 2);
  canopy(v, 8, 9, 7, 6, 461);
  v.set(5, 6, c("#c95a7a"));
  v.set(10, 8, c("#c95a7a"));
  v.outline(INK);
}

function drawLampPole(v: View): void {
  v.shadow(8, 46, 4, 1.5);
  v.rect(6, 42, 5, 4, c("#2c3036"));
  v.rect(7, 8, 2, 36, c("#3a3f46"));
  v.vline(7, 8, 42, c("#555b64"));
  v.rect(3, 4, 10, 3, c("#2c3036"));
  markLit(v, () => v.rect(4, 7, 8, 2, c("#ffe9a6"))); // bulb: lit at night by its mask
  v.hline(4, 11, 4, c("#4a5059"));
  v.outline(INK);
}

function drawUtilityPole(v: View): void {
  v.shadow(8, 62, 4, 1.5);
  v.rect(7, 4, 3, 58, c("#6b4a32"));
  v.vline(7, 4, 61, c("#8a6444"));
  for (const y of [8, 16]) {
    v.rect(0, y, 16, 2, c("#5a3d29"));
    for (const x of [1, 5, 11, 14]) v.set(x, y - 1, c("#cfd8de"));
  }
  v.rect(10, 22, 5, 8, c("#8d939b"));
  v.hline(10, 14, 22, c("#b9bfc6"));
  v.outline(INK);
}

function drawPostbox(v: View): void {
  v.shadow(8, 30, 6, 1.5);
  v.rect(3, 10, 10, 19, c("#b8282a"));
  v.ellipse(8, 10, 5.5, 4, c("#c93633"));
  v.rect(3, 26, 10, 3, c("#2a2a2e"));
  v.rect(5, 13, 6, 1, c("#2a1414"));
  v.vline(4, 9, 25, c("#e05a52"));
  v.rect(6, 17, 4, 3, c("#efe2b8"));
  v.outline(INK);
}

export const CITY_PAINTERS: Record<string, (v: View) => void> = {
  brick_rowhouse: drawRowhouseRed,
  brick_rowhouse_brown: drawRowhouseBrown,
  brick_apartment: drawApartment,
  brick_garage: drawGarage,
  brick_shop_corner: drawShopCorner,
  brick_roof: drawRoofOnly,
  street_tree_large: drawStreetTree,
  shrub: drawShrub,
  lamp_pole: drawLampPole,
  utility_pole: drawUtilityPole,
  postbox_red: drawPostbox,
};
