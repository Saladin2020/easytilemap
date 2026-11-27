/**
 * DSK-6 top-down (3/4) town set, original procedural pixel art (CC0): parked vehicles drawn nose-right
 * (headlight on the right; mirror with scale.x = -1 to drive left), civic buildings and offices, a
 * Chinese shophouse and a modern house, and ตลาดนัดมือสอง (second-hand flea market) clothes stalls + rack.
 * Buildings follow the city set: a roof seen from above, then the street-facing wall with its door.
 * DSK-8 repaint: 4–5 tone hue-shifted ramps, textured roofs / walls (tiles, tar, render stains, brick, boards),
 * framed windows with sills and glare, awnings, AC units, tanks, plants, lit signs, and an outline in a darker
 * shade of each object's own colour (same footprints, solids and kinds as DSK-6).
 */
import { c, markLit, noise, type Rgba, type View } from "./pixel.js";
import type { ObjectKind } from "./objects.js";

const V = (kind: string, name: string, nameTh: string, w: number, h: number): ObjectKind => ({ kind, name, nameTh, category: "prop", w, h, solid: { x: 0, y: h - 1, w, h: 1 } });
const B = (kind: string, name: string, nameTh: string, w: number, h: number, roof: number): ObjectKind => ({ kind, name, nameTh, category: "building", w, h, solid: { x: 0, y: roof, w, h: h - roof } });

export const TOWN_MORE_OBJECT_KINDS: readonly ObjectKind[] = [
  V("car_sedan", "Car (parked, facing right)", "รถเก๋ง", 2, 2),
  V("car_taxi", "Taxi (facing right)", "แท็กซี่", 2, 2),
  V("car_pickup", "Pickup truck (facing right)", "รถกระบะ", 2, 2),
  V("tuktuk", "Tuk-tuk (facing right)", "ตุ๊กตุ๊ก", 2, 2),
  V("motorbike", "Motorbike (facing right)", "มอเตอร์ไซค์", 2, 1),
  V("songthaew", "Songthaew (facing right)", "รถสองแถว", 3, 2),
  V("bus_city", "City bus (facing right)", "รถเมล์", 4, 2),
  V("truck_cargo", "Cargo truck (facing right)", "รถบรรทุก", 4, 2),
  B("hospital", "Hospital", "โรงพยาบาล", 7, 7, 3),
  B("police_station", "Police station", "สถานีตำรวจ", 5, 5, 2),
  B("post_office", "Post office", "ที่ทำการไปรษณีย์", 4, 5, 2),
  B("bank", "Bank", "ธนาคาร", 4, 5, 2),
  B("district_office", "District office", "ที่ว่าการอำเภอ", 6, 6, 3),
  B("company_office", "Company office tower", "อาคารสำนักงานบริษัท", 4, 7, 2),
  B("shophouse_chinese", "Chinese shophouse", "ตึกแถวจีน", 4, 5, 2),
  B("house_modern", "Modern house", "บ้านสมัยใหม่", 4, 4, 2),
  { kind: "flea_stall_clothes", name: "Flea-market clothes stall", nameTh: "แผงเสื้อผ้ามือสอง", category: "building", w: 3, h: 3, solid: { x: 0, y: 2, w: 3, h: 1 } },
  { kind: "flea_stall_junk", name: "Flea-market bric-a-brac stall", nameTh: "แผงของเก่ามือสอง", category: "building", w: 3, h: 3, solid: { x: 0, y: 2, w: 3, h: 1 } },
  { kind: "clothes_rack", name: "Clothes rack", nameTh: "ราวแขวนเสื้อ", category: "prop", w: 2, h: 2, solid: { x: 0, y: 1, w: 2, h: 1 } },
];

const GLASS = [c("#22324a"), c("#2d4157"), c("#4c6c8a"), c("#9cc0d8"), c("#e4f2fa")] as const;
const HEAD = c("#fff4c2");
const TAIL = c("#e2493c");
const STEEL = [c("#2a2d35"), c("#4a4f5a"), c("#7a818c"), c("#aab1ba"), c("#dfe4e8")] as const;
const TYRE = [c("#16171b"), c("#24262b"), c("#3a3c44")] as const;
const STONE = [c("#8a8070"), c("#a89e8a"), c("#c4baa4"), c("#dcd2bc"), c("#f0e8d6")] as const;
const TEAK = [c("#3a2216"), c("#5a3620"), c("#7c4e2c"), c("#a0683a"), c("#c48a52")] as const;
const LEAF = [c("#2c5f2a"), c("#3c7a33"), c("#529641"), c("#76b553"), c("#9bcf6a")] as const;
const WARM = c("#f6d98a");
const SHIRTS = ["#d8453a", "#3f7fd0", "#f2c94c", "#5fb36b", "#f4f1e8", "#9b59b6", "#f08aa6", "#2fa3a0"].map((h) => c(h));
const mixc = (a: Rgba, b: Rgba, t: number): Rgba => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
const darker = (k: Rgba, f = 0.75): Rgba => [Math.round(k[0] * f), Math.round(k[1] * f), Math.round(k[2] * f), 255];
const lighter = (k: Rgba, f = 0.35): Rgba => [Math.round(k[0] + (255 - k[0]) * f), Math.round(k[1] + (255 - k[1]) * f), Math.round(k[2] + (255 - k[2]) * f), 255];
/** 5-tone hue-shifted ramp: shadows lean cool violet, lights lean warm cream (like the side-view set). */
function tones(hex: string): readonly Rgba[] {
  const b = c(hex), cool = c("#24183a"), warm = c("#fff6dc");
  return [mixc(b, cool, 0.55), mixc(b, cool, 0.28), b, mixc(b, warm, 0.28), mixc(b, warm, 0.58)];
}
/** Selective outline: every transparent pixel touching the shape takes a dark shade of the colour it touches. */
function selOut(v: View, f = 0.42): void {
  const marks: Array<[number, number, Rgba]> = [];
  for (let y = 0; y < v.h; y++) for (let x = 0; x < v.w; x++) {
    if (v.alpha(x, y) >= 1) continue;
    const hit = ([[x, y + 1], [x + 1, y], [x - 1, y], [x, y - 1]] as const).find(([nx, ny]) => v.alpha(nx, ny) >= 200);
    if (!hit) continue;
    const k = v.get(hit[0], hit[1]);
    marks.push([x, y, [Math.round(k[0] * f * 0.85), Math.round(k[1] * f * 0.9), Math.min(255, Math.round(k[2] * f + 12)), 255]]);
  }
  for (const [x, y, k] of marks) v.set(x, y, k);
}
/** Shaded horizontal band: lit top row, body, darker lower rows. */
function band(v: View, x0: number, x1: number, y0: number, y1: number, R: readonly Rgba[]): void {
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    const k = y === y0 ? R[4]! : t < 0.45 ? R[3]! : t < 0.8 ? R[2]! : R[1]!;
    v.hline(x0, x1, y, k);
  }
  v.vline(x0, y0 + 1, y1, mixc(v.get(x0, y0 + 1), c("#ffffff"), 0.15));
}
function glassStrip(v: View, x0: number, x1: number, y0: number, y1: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let k = y === y0 ? GLASS[0]! : (y - y0) < (y1 - y0) / 2 ? GLASS[2]! : GLASS[1]!;
    const d = (x + (y - y0) + 64) % 9;
    if (y > y0 && (d === 2 || d === 3)) k = GLASS[3]!;
    v.set(x, y, k);
  }
}
function tyre(v: View, x: number, y: number, r = 3): void {
  v.ellipse(x, y, r + 0.2, r + 0.2, TYRE[1]);
  v.ellipse(x, y, r - 1.2, r - 1.2, STEEL[3]);
  v.set(x, y, STEEL[1]); v.set(x - 1, y - 1, STEEL[4]);
  v.set(x - r + 1, y - 1, TYRE[2]);
}
function lamps(v: View, hx: number, tx: number, y: number): void {
  v.set(hx, y, HEAD); v.set(hx, y + 1, HEAD);
  v.set(tx, y, TAIL); v.set(tx, y + 1, TAIL);
}

/** 3/4 car: roof seen from above, glass cabin with glare, shaded body with beltline, bumpers, rims. */
function carBody(v: View, w: number, h: number, R: readonly Rgba[], opts: { cabin?: [number, number]; bed?: boolean; topSign?: Rgba } = {}): void {
  const base = h - 4;
  v.shadow(w / 2, base + 1, w / 2 - 1, 2.5);
  const [c0, c1] = opts.cabin ?? [Math.round(w * 0.22), Math.round(w * 0.78)];
  // roof + cabin
  for (let y = base - 20; y < base - 16; y++) v.hline(c0 + (y === base - 20 ? 1 : 0), c1 - 1, y, y === base - 20 ? R[4]! : y === base - 17 ? R[2]! : R[3]!);
  glassStrip(v, c0 - 1, c1 + 1, base - 16, base - 11);
  v.vline(Math.round((c0 + c1) / 2), base - 16, base - 11, R[2]!);
  v.vline(c0 - 1, base - 15, base - 11, R[2]!);
  // body
  band(v, 1, w - 2, base - 10, base - 3, R);
  v.hline(2, w - 3, base - 7, R[4]!); v.hline(2, w - 3, base - 6, R[1]!); // beltline crease
  if (opts.bed) { v.rect(c1 + 2, base - 13, w - c1 - 4, 3, R[1]!); v.rect(c1 + 3, base - 15, 5, 3, TEAK[3]!); v.hline(c1 + 3, c1 + 7, base - 15, TEAK[4]!); }
  if (opts.topSign) { const m = Math.round((c0 + c1) / 2); v.rect(m - 4, base - 23, 8, 3, opts.topSign); markLit(v, () => v.hline(m - 3, m + 2, base - 22, lighter(opts.topSign!, 0.6))); }
  v.hline(1, 3, base - 4, STEEL[3]!); v.hline(w - 4, w - 2, base - 4, STEEL[3]!); // bumpers
  for (const x of [6, w - 7]) v.ellipse(x, base - 3, 4.2, 3.2, (xx, yy) => (yy < base - 2 && v.alpha(xx, yy) > 0 ? darker(R[1]!, 0.55) : null)); // wheel wells
  lamps(v, w - 2, 1, base - 9);
  tyre(v, 6, base - 2); tyre(v, w - 7, base - 2);
  selOut(v);
}

const drawSedan = (v: View) => carBody(v, 32, 32, tones("#d8dce2"));
const drawTaxi = (v: View) => carBody(v, 32, 32, tones("#ea6a9c"), { topSign: c("#f2c94c") });
const drawPickup = (v: View) => carBody(v, 32, 32, tones("#3f6fb5"), { cabin: [6, 16], bed: true });

function drawTuktuk(v: View): void {
  const base = 28, B = tones("#2f6cc8");
  v.shadow(16, base + 1, 14, 2.5);
  for (let y = base - 21; y < base - 17; y++) v.hline(3, 26, y, y === base - 21 ? B[4]! : B[3]!); // canopy roof from above
  for (let x = 3; x <= 26; x++) v.set(x, base - 17, x % 4 < 2 ? c("#f2c94c") : c("#f4f1e8")); // fringe
  for (const x of [4, 25]) v.vline(x, base - 16, base - 9, STEEL[2]!);
  v.rect(5, base - 16, 19, 6, c("#2a2238"));
  v.rect(6, base - 13, 11, 3, c("#c23a33")); v.hline(6, 16, base - 13, c("#e86a50")); // bench
  glassStrip(v, 22, 26, base - 16, base - 11);
  band(v, 3, 28, base - 10, base - 3, B);
  v.hline(4, 27, base - 6, c("#f2c94c"));
  lamps(v, 29, 3, base - 9);
  tyre(v, 7, base - 2); tyre(v, 25, base - 2, 2.6);
  selOut(v);
}

function drawMotorbike(v: View): void {
  const base = 14, T = tones("#23a092");
  v.shadow(16, base + 1, 12, 1.5);
  v.line(21, base - 6, 24, base - 11, STEEL[2]!);
  band(v, 8, 22, base - 8, base - 5, T);
  v.rect(10, base - 10, 8, 2, TYRE[2]); v.hline(10, 17, base - 10, STEEL[2]!); // seat
  v.rect(21, base - 12, 5, 1, TYRE[1]); // handlebar
  v.hline(4, 10, base - 4, STEEL[3]!); // exhaust
  v.set(27, base - 9, HEAD); v.set(27, base - 8, HEAD);
  v.set(6, base - 8, TAIL); v.set(6, base - 7, TAIL);
  tyre(v, 7, base - 3, 3); tyre(v, 25, base - 3, 3);
  selOut(v);
}

function drawSongthaew(v: View): void {
  const w = 48, base = 28, R = tones("#c4302c");
  v.shadow(24, base + 1, 22, 2.5);
  for (let y = base - 23; y < base - 19; y++) v.hline(3, 32, y, y === base - 23 ? R[4]! : R[3]!); // roof from above
  for (let x = 4; x < 32; x += 6) v.set(x, base - 23, STEEL[4]!); // roof rack
  v.rect(2, base - 19, 32, 9, R[2]!);
  for (let x = 4; x < 32; x += 6) { v.rect(x, base - 18, 5, 5, c("#2a2034")); v.set(x + 1, base - 15, c("#a0683a")); v.vline(x + 2, base - 18, base - 14, STEEL[3]!); } // open windows + bars
  v.rect(34, base - 18, 11, 8, R[2]!); v.hline(34, 44, base - 18, R[4]!);
  glassStrip(v, 36, 43, base - 17, base - 13);
  band(v, 1, w - 3, base - 10, base - 3, R);
  v.hline(1, 33, base - 6, c("#f2c94c")); v.hline(1, 33, base - 5, c("#b8701a"));
  v.hline(1, 3, base - 4, STEEL[3]!); v.hline(w - 5, w - 3, base - 4, STEEL[3]!);
  lamps(v, w - 2, 1, base - 9);
  tyre(v, 9, base - 2); tyre(v, 39, base - 2);
  selOut(v);
}

function drawBus(v: View): void {
  const w = 64, base = 28, U = tones("#eeece4"), O = tones("#ec7a1e");
  v.shadow(32, base + 1, 30, 2.5);
  for (let y = base - 25; y < base - 21; y++) v.hline(2, w - 4, y, y === base - 25 ? U[4]! : U[2]!); // roof from above
  v.rect(18, base - 25, 22, 3, STEEL[3]!); v.hline(18, 39, base - 25, STEEL[4]!); // AC pod
  band(v, 1, w - 3, base - 21, base - 12, U);
  for (let x = 4; x < w - 14; x += 8) glassStrip(v, x, x + 5, base - 19, base - 14);
  glassStrip(v, w - 10, w - 4, base - 20, base - 8); // windscreen + door
  band(v, 1, w - 3, base - 11, base - 3, O);
  v.hline(1, w - 11, base - 11, O[4]!);
  markLit(v, () => v.hline(w - 9, w - 5, base - 21, c("#ffb866"))); // route board
  lamps(v, w - 3, 1, base - 7);
  tyre(v, 11, base - 2); tyre(v, w - 14, base - 2);
  selOut(v);
}

function drawTruck(v: View): void {
  const w = 64, base = 28, G = tones("#3a8c4e"), BX = tones("#a8b0ba");
  v.shadow(32, base + 1, 30, 2.5);
  for (let y = base - 25; y < base - 6; y++) for (let x = 1; x <= 44; x++) { const k = (x - 1) % 4; v.set(x, y, y === base - 25 ? BX[4]! : y < base - 21 ? BX[3]! : k === 0 ? BX[4]! : k === 3 ? BX[1]! : BX[2]!); } // ribbed box
  v.rect(2, base - 14, 42, 3, G[2]!); v.hline(2, 43, base - 14, G[4]!);
  for (let y = base - 19; y < base - 6; y++) v.hline(46, 61, y, y === base - 19 ? G[4]! : y < base - 14 ? G[3]! : G[2]!); // cab
  glassStrip(v, 51, 60, base - 17, base - 13);
  v.vline(45, base - 26, base - 12, STEEL[4]!); // exhaust stack
  v.rect(1, base - 6, w - 3, 3, STEEL[0]!); v.hline(1, w - 3, base - 6, STEEL[2]!);
  lamps(v, w - 3, 1, base - 9);
  tyre(v, 9, base - 2); tyre(v, 19, base - 2); tyre(v, 53, base - 2);
  selOut(v);
}

// ---------------- buildings (roof from above, then the facade) ----------------
/** Flat roof: speckled membrane, lit parapet coping on the left/top, shaded right, drip shadow at the eave. */
function flatRoof(v: View, W: number, roofH: number, R: readonly Rgba[], seed: number): void {
  for (let y = 0; y < roofH; y++) for (let x = 0; x < W; x++) { const n = noise(x, y, seed); v.set(x, y, n > 0.9 ? R[3]! : n < 0.12 ? R[1]! : R[2]!); }
  v.rect(0, 0, W, 2, R[4]!); v.rect(0, 0, 2, roofH, R[4]!); v.rect(W - 2, 0, 2, roofH, R[1]!);
  v.hline(2, W - 3, 2, R[1]!);
  v.rect(0, roofH, W, 1, R[3]!); v.rect(0, roofH + 1, W, 2, R[0]!);
}
/** Tiled roof from above: tile rows with lit lips + vertical seams, a ridge, hip ends. */
function tileRoofTop(v: View, W: number, roofH: number, R: readonly Rgba[], seed: number, hip = 8): void {
  for (let y = 0; y < roofH; y++) {
    const inset = Math.max(0, hip - y);
    for (let x = inset; x < W - inset; x++) {
      const ry = y % 4, col = (x + (Math.floor(y / 4) % 2) * 2) % 4;
      let k = ry === 0 ? R[3]! : ry === 3 ? R[1]! : R[2]!;
      if (col === 0 && ry !== 0) k = R[1]!;
      if (noise(x >> 1, y >> 2, seed) > 0.9) k = R[4]!;
      if (x === inset) k = R[4]!; else if (x === W - inset - 1) k = R[0]!;
      v.set(x, y, k);
    }
  }
  v.hline(hip, W - hip - 1, 0, R[4]!);
  v.rect(0, roofH, W, 1, TEAK[3]!); v.rect(0, roofH + 1, W, 2, c("#2a1e24", 200));
}
/** Render wall with soft patches and rain streaks under the eave and ledges. */
function renderWall(v: View, x0: number, y0: number, w: number, h: number, R: readonly Rgba[], seed: number, streaks: number[] = []): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const n = noise(x >> 2, y >> 2, seed); v.set(x, y, n > 0.9 && (x + y) % 2 === 0 ? R[3]! : n < 0.06 && (x + y) % 2 === 0 ? R[1]! : R[2]!); }
  for (const sy of [y0, ...streaks]) for (let x = x0 + 1; x < x0 + w - 1; x++) if (noise(x, sy, seed + 3) > 0.7) { const len = 2 + Math.floor(noise(x, sy, seed + 4) * 7); for (let k = 0; k < len; k++) v.set(x, sy + k, R[1]!); }
  v.hline(x0, x0 + w - 1, y0, darker(R[1]!, 0.8)); // eave shadow
  v.hline(x0, x0 + w - 1, y0 + 1, R[1]!);
}
function brickWall(v: View, x0: number, y0: number, w: number, h: number, R: readonly Rgba[], mortar: Rgba): void {
  for (let y = 0; y < h; y++) { const course = Math.floor(y / 3); for (let x = 0; x < w; x++) { if (y % 3 === 2 || (x + (course % 2) * 2) % 5 === 4) { v.set(x0 + x, y0 + y, mortar); continue; } const n = noise(Math.floor((x + (course % 2) * 2) / 5), course, 401 + x0); v.set(x0 + x, y0 + y, n < 0.2 ? R[1]! : n > 0.85 ? R[3]! : R[2]!); } }
}
function ledge(v: View, x0: number, x1: number, y: number, R: readonly Rgba[] = STONE): void {
  v.hline(x0, x1, y, R[4]!); v.hline(x0, x1, y + 1, R[2]!);
  for (let x = x0; x <= x1; x++) v.set(x, y + 2, mixc(v.get(x, y + 2), c("#1a1630"), 0.3));
}
/** Framed window: lintel, frame, glass with glare (lit at night when `lit`), sill + shadow, optional curtains. */
function win(v: View, x: number, y: number, w: number, h: number, frame: readonly Rgba[] = STONE, o: { lit?: boolean; curtain?: Rgba } = {}): void {
  v.rect(x - 1, y - 2, w + 2, 1, frame[3]!); v.hline(x - 1, x + w, y - 2, frame[4]!);
  v.rect(x - 1, y - 1, w + 2, h + 2, frame[2]!);
  const paint = () => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) v.set(x + xx, y + yy, yy === 0 ? GLASS[0]! : (xx + yy) % 7 === 2 ? GLASS[3]! : yy < h / 2 ? GLASS[2]! : GLASS[1]!);
    if (o.lit) v.rect(x + 1, y + 1, w - 2, h - 2, WARM);
  };
  if (o.lit) markLit(v, paint); else paint();
  if (o.curtain) { v.vline(x, y + 1, y + h - 1, o.curtain); v.vline(x + w - 1, y + 1, y + h - 1, darker(o.curtain, 0.85)); }
  if (w > 6) v.vline(x + (w >> 1), y, y + h - 1, frame[3]!);
  v.hline(x - 1, x + w, y + h + 1, frame[4]!);
  v.hline(x - 1, x + w, y + h + 2, c("#2a1e24", 110));
}
function windowsRow(v: View, W: number, y: number, h: number, step: number, x0: number, frame: readonly Rgba[] = STONE, skip?: (x: number) => boolean): void {
  for (let x = x0; x + 8 <= W - 3; x += step) if (!skip?.(x)) win(v, x, y, 8, h, frame, { lit: noise(x, y, 613) > 0.55, curtain: noise(x, y, 614) > 0.6 ? c("#e9dfc7") : undefined });
}
function door(v: View, x: number, y: number, w: number, h: number, col: Rgba, frame: readonly Rgba[] = STONE): void {
  v.rect(x - 1, y - 2, w + 2, h + 2, frame[2]!); v.hline(x - 1, x + w, y - 2, frame[4]!);
  for (let yy = 0; yy < h; yy++) v.hline(x, x + w - 1, y + yy, yy < 2 ? lighter(col, 0.2) : col);
  v.vline(x + (w >> 1), y, y + h - 1, darker(col, 0.6));
  v.rect(x + 1, y + 2, 2, h - 4, lighter(col, 0.25));
  v.set(x + (w >> 1) - 2, y + (h >> 1), c("#e8c45a"));
}
/** Sign band: bevelled board with dot lettering (real Thai names live in nameTh / the side-view signs); glows at night. */
function signPlate(v: View, x: number, y: number, w: number, bg: Rgba, fg = c("#ffffff")): void {
  const R = [darker(bg, 0.55), darker(bg, 0.8), bg, lighter(bg, 0.25), lighter(bg, 0.5)];
  v.rect(x - 1, y - 1, w + 2, 8, STEEL[1]!);
  v.rect(x, y, w, 6, R[2]!); v.hline(x, x + w - 1, y, R[4]!); v.hline(x, x + w - 1, y + 5, R[0]!);
  markLit(v, () => { for (let i = x + 3; i < x + w - 3; i += 2) if (noise(i, y, 617) > 0.3) { v.set(i, y + 2, fg); if (noise(i, y, 618) > 0.5) v.set(i, y + 3, fg); } });
}
function awning(v: View, x0: number, w: number, y: number, a: Rgba, b: Rgba = c("#f4f1e8")): void {
  for (let yy = 0; yy < 5; yy++) for (let x = x0; x < x0 + w; x++) { const k = Math.floor((x - x0) / 4) % 2 ? b : a; v.set(x, y + yy, yy === 0 ? lighter(k, 0.3) : yy === 4 ? darker(k, 0.8) : k); }
  for (let x = x0; x < x0 + w; x++) if ((x - x0) % 4 === 1 || (x - x0) % 4 === 2) v.set(x, y + 5, darker(Math.floor((x - x0) / 4) % 2 ? b : a, 0.85));
  for (let x = x0; x < x0 + w; x++) v.set(x, y + 6, mixc(v.get(x, y + 6), c("#1a1630"), 0.35));
}
function acUnit(v: View, x: number, y: number): void {
  v.rect(x, y, 10, 7, STEEL[3]!); v.hline(x, x + 9, y, STEEL[4]!); v.vline(x + 9, y + 1, y + 6, STEEL[2]!);
  v.ellipse(x + 4, y + 3.5, 2.4, 2.4, STEEL[1]!); v.set(x + 4, y + 3, STEEL[3]!);
  v.hline(x, x + 9, y + 7, c("#2a2b2f", 120));
}
function waterTank(v: View, cx: number, cy: number, r = 5): void {
  v.ellipse(cx + 1, cy + 2, r, r * 0.7, c("#14100a", 70));
  v.ellipse(cx, cy, r, r * 0.8, (x, _y, dx) => (dx < -0.35 ? STEEL[4]! : dx > 0.45 ? STEEL[1]! : x % 3 === 0 ? STEEL[2]! : STEEL[3]!));
}
function plant(v: View, cx: number, by: number, pot: Rgba = c("#b8562a")): void {
  v.rect(cx - 2, by - 3, 5, 3, pot); v.hline(cx - 2, cx + 2, by - 3, lighter(pot, 0.3));
  v.ellipse(cx, by - 6, 3.5, 3, (x, y) => (noise(x, y, 77) > 0.7 ? LEAF[4]! : y < by - 6 ? LEAF[3]! : LEAF[1]!));
}
function plinth(v: View, W: number, H: number): void {
  v.rect(0, H - 3, W, 3, STONE[2]!); v.hline(0, W - 1, H - 3, STONE[4]!); v.hline(0, W - 1, H - 1, STONE[0]!);
}

function drawHospital(v: View): void {
  const W = 112, H = 112, M = tones("#a8d8c4"), WALL = tones("#eef2f2");
  flatRoof(v, W, 44, tones("#cfd6da"), 611);
  v.rect(44, 10, 24, 20, c("#ffffff")); v.hline(44, 67, 10, STONE[4]!); // roof sign box with a green plus (not a red cross)
  v.rect(53, 13, 6, 14, c("#2e9d5b")); v.rect(49, 17, 14, 6, c("#2e9d5b"));
  waterTank(v, 16, 16, 6); acUnit(v, 80, 12); acUnit(v, 92, 12); acUnit(v, 80, 26);
  renderWall(v, 0, 47, W, H - 50, WALL, 51, [64, 78]);
  for (const y of [51, 65, 79]) windowsRow(v, W, y, 8, 12, 5, M);
  ledge(v, 0, W - 1, 61, M); ledge(v, 0, W - 1, 75, M);
  v.rect(0, 93, W, 4, M[2]!); v.hline(0, W - 1, 93, M[4]!);
  signPlate(v, 34, 97, 44, c("#2e9d5b"));
  door(v, 46, H - 12, 20, 9, GLASS[2]!, M);
  v.rect(80, H - 14, 24, 8, M[2]!); v.hline(80, 103, H - 14, M[4]!);
  v.rect(90, H - 13, 4, 6, c("#ffffff")); v.rect(88, H - 11, 8, 2, c("#ffffff"));
  plant(v, 6, H - 3); plant(v, 40, H - 3);
  plinth(v, W, H);
  selOut(v);
}

function drawPolice(v: View): void {
  const W = 80, H = 80, N = tones("#2a3c6c"), WALL = tones("#ece4cf");
  tileRoofTop(v, W, 30, tones("#8a2a30"), 631, 8);
  v.vline(72, 2, 26, STEEL[3]!); // roof flagpole, plain stripes
  for (const [i, k] of ["#d8453a", "#f4f1e8", "#2a4b9b", "#f4f1e8", "#d8453a"].entries()) v.hline(64, 71, 3 + i, c(k));
  renderWall(v, 0, 33, W, H - 36, WALL, 33, [52]);
  v.rect(0, 33, W, 5, N[2]!); v.hline(0, W - 1, 33, N[3]!);
  signPlate(v, 18, 40, 44, N[1]!);
  windowsRow(v, W, 51, 9, 14, 4, tones("#8a2a30"), (x) => x > 26 && x < 50);
  door(v, 32, H - 17, 16, 14, TEAK[2]!, tones("#8a2a30"));
  markLit(v, () => { v.rect(6, 34, 3, 3, c("#5aa0ff")); v.rect(W - 9, 34, 3, 3, c("#ff5a5a")); });
  plant(v, 26, H - 3, c("#9a9a96")); plant(v, 54, H - 3, c("#9a9a96"));
  plinth(v, W, H);
  selOut(v);
}

function drawPostOffice(v: View): void {
  const W = 64, H = 80, R = tones("#c4302c");
  flatRoof(v, W, 30, tones("#b4312c"), 641);
  acUnit(v, 44, 10); v.rect(8, 8, 12, 9, STONE[2]!); v.hline(8, 19, 8, STONE[4]!); // roof hatch
  renderWall(v, 0, 33, W, 22, tones("#f2ead6"), 43);
  brickWall(v, 0, 55, W, H - 58, tones("#b4503a"), c("#d8c4a8"));
  v.rect(0, 33, W, 4, R[2]!); v.hline(0, W - 1, 33, R[4]!);
  signPlate(v, 8, 39, 48, R[2]!);
  win(v, 6, 47, 10, 7); win(v, 48, 47, 10, 7);
  awning(v, 2, W - 4, 56, R[2]!);
  door(v, 24, H - 17, 16, 14, GLASS[2]!);
  v.rect(50, H - 17, 8, 14, R[2]!); v.hline(50, 57, H - 17, R[4]!); v.rect(51, H - 14, 6, 1, c("#2a1414")); // postbox
  plinth(v, W, H);
  selOut(v);
}

function drawBank(v: View): void {
  const W = 64, H = 80, S = tones("#c8c0b4"), BR = tones("#5a3c9a");
  flatRoof(v, W, 30, tones("#7a8490"), 651);
  acUnit(v, 8, 10); acUnit(v, 22, 10); waterTank(v, 50, 14, 5);
  renderWall(v, 0, 33, W, H - 36, S, 53);
  for (let y = 36; y < H - 3; y += 5) v.hline(0, W - 1, y, S[1]!); // stone courses
  v.rect(0, 33, W, 9, BR[2]!); v.hline(0, W - 1, 33, BR[4]!); v.hline(0, W - 1, 41, BR[0]!);
  signPlate(v, 6, 35, 52, BR[1]!, c("#f2e6ff"));
  for (const x of [4, 16, 44, 56]) { v.rect(x, 44, 4, H - 47, S[3]!); v.vline(x, 44, H - 4, S[4]!); v.vline(x + 3, 44, H - 4, S[1]!); } // columns
  door(v, 24, H - 20, 16, 17, GLASS[2]!, S);
  v.rect(48, H - 18, 6, 9, STEEL[1]!); markLit(v, () => v.rect(49, H - 17, 4, 3, c("#7fd0ff"))); // ATM
  plinth(v, W, H);
  selOut(v);
}

function drawDistrictOffice(v: View): void {
  const W = 96, H = 96;
  tileRoofTop(v, W, 46, tones("#b0442c"), 621, 10);
  renderWall(v, 0, 49, W, H - 52, tones("#f2ead4"), 61, [62]);
  signPlate(v, 26, 53, 44, TEAK[1]!, c("#f2c94c"));
  windowsRow(v, W, 64, 10, 14, 6, TEAK, (x) => x > 30 && x < 62);
  v.rect(36, 60, 24, 33, STONE[3]!); v.hline(36, 59, 60, STONE[4]!); // porch
  for (const x of [37, 57]) { v.rect(x, 61, 2, H - 64, c("#ffffff")); v.vline(x + 1, 61, H - 4, STONE[2]!); }
  door(v, 42, H - 22, 12, 19, TEAK[2]!, TEAK);
  plant(v, 32, H - 3); plant(v, 64, H - 3);
  plinth(v, W, H);
  selOut(v);
}

function drawCompanyOffice(v: View): void {
  const W = 64, H = 112, CW = tones("#3e6286");
  flatRoof(v, W, 26, tones("#6a7682"), 661);
  v.rect(18, 6, 28, 12, STONE[2]!); v.hline(18, 45, 6, STONE[4]!); for (let x = 20; x < 44; x += 3) v.vline(x, 8, 16, STONE[1]!); // plant room
  v.vline(52, 2, 14, STEEL[4]!); v.set(52, 1, c("#e2493c"));
  // curtain wall: mullions, spandrels, sky reflection streaks, random lit floors
  for (let y = 29; y < H - 22; y++) for (let x = 0; x < W; x++) {
    const col = x % 8, row = (y - 29) % 7;
    let k: Rgba = col === 0 ? STEEL[3]! : row === 0 ? STEEL[2]! : row < 3 ? CW[3]! : CW[2]!;
    const d = (x + (y - 29) * 0.6) % 40;
    if (col !== 0 && row !== 0 && d > 6 && d < 11) k = lighter(k, 0.35);
    if (col === 7 && row !== 0) k = CW[1]!;
    v.set(x, y, k);
  }
  markLit(v, () => { for (let y = 29; y < H - 22; y++) for (let x = 0; x < W; x++) if (x % 8 && (y - 29) % 7 > 1 && noise(x >> 3, Math.floor((y - 29) / 7), 662) > 0.78) v.set(x, y, mixc(WARM, v.get(x, y), 0.55)); });
  v.rect(0, 27, W, 2, STEEL[1]!);
  renderWall(v, 0, H - 22, W, 19, tones("#c8c0b4"), 63);
  signPlate(v, 12, H - 20, 40, c("#1e2c54"));
  v.rect(10, H - 13, 44, 2, STEEL[3]!); v.hline(10, 53, H - 13, STEEL[4]!); // lobby canopy
  door(v, 22, H - 11, 20, 8, GLASS[2]!, STEEL);
  plant(v, 6, H - 3, c("#9a9a96")); plant(v, 58, H - 3, c("#9a9a96"));
  plinth(v, W, H);
  selOut(v);
}

function drawShophouseChinese(v: View): void {
  const W = 64, H = 80, R = tones("#9a3a2a"), CR = tones("#e9d9a8"), SH = tones("#3f8a62");
  for (let y = 0; y < 28; y++) for (let x = 0; x < W; x++) { const k = x % 4; v.set(x, y, y % 6 === 0 ? R[1]! : k === 0 ? R[1]! : k === 1 ? R[4]! : k === 2 ? R[3]! : R[2]!); } // barrel tiles
  v.hline(0, W - 1, 0, R[4]!);
  v.rect(0, 28, W, 2, R[0]!);
  renderWall(v, 0, 30, W, H - 33, CR, 71, [48]);
  for (const x of [0, W - 4]) { v.rect(x, 30, 4, H - 33, CR[3]!); v.vline(x, 30, H - 4, CR[4]!); v.vline(x + 3, 30, H - 4, CR[1]!); } // pilasters
  for (const x of [10, 27, 44]) { v.rect(x - 3, 34, 3, 12, SH[2]!); v.rect(x + 10, 34, 3, 12, SH[2]!); for (let y = 35; y < 46; y += 2) { v.hline(x - 3, x - 1, y, SH[1]!); v.hline(x + 10, x + 12, y, SH[1]!); } win(v, x, 35, 10, 10, CR, { lit: x === 27 }); } // shuttered windows
  ledge(v, 0, W - 1, 48, CR);
  signPlate(v, 6, 51, 52, c("#b8282a"), c("#f2c94c"));
  for (const x of [6, 57]) markLit(v, () => { v.ellipse(x, 62, 2.5, 3, c("#e2493c")); v.set(x - 1, 61, c("#ff8a6a")); v.set(x, 58, c("#f2c94c")); }); // lanterns
  v.rect(10, 59, 44, 18, TEAK[2]!); for (let x = 12; x < 54; x += 4) { v.vline(x, 60, 76, TEAK[3]!); v.vline(x + 1, 60, 76, TEAK[1]!); } // folding shutters
  v.rect(22, 63, 20, 10, c("#3a2c30")); for (let x = 23; x < 41; x += 3) v.rect(x, 64, 2, 8, SHIRTS[(x >> 1) % SHIRTS.length]!); // fabric bolts through the open leaf
  plinth(v, W, H);
  selOut(v);
}

function drawHouseModern(v: View): void {
  const W = 64, H = 64, WALL = tones("#f2f2ee");
  flatRoof(v, W, 26, tones("#7d858c"), 681);
  waterTank(v, 12, 12, 5); v.rect(30, 6, 22, 12, c("#2a3a5a")); for (let x = 31; x < 52; x += 4) v.vline(x, 7, 16, c("#4c6c8a")); v.hline(30, 51, 6, c("#8fb0d0")); // solar panel
  renderWall(v, 26, 29, W - 26, H - 32, WALL, 83);
  for (let y = 29; y < H - 3; y++) for (let x = 0; x < 26; x++) v.set(x, y, x % 3 === 0 ? TEAK[2]! : y % 9 === 0 ? TEAK[3]! : TEAK[4]!); // timber cladding
  win(v, 32, 33, 26, 11, STEEL, { lit: true });
  for (let x = 30; x < 61; x += 3) v.vline(x, 44, 47, STEEL[3]!); v.hline(30, 60, 44, STEEL[4]!); // balcony rail
  door(v, 8, H - 18, 10, 15, TEAK[2]!, STEEL);
  markLit(v, () => v.rect(20, H - 19, 2, 2, WARM));
  v.rect(44, H - 10, 14, 7, STONE[2]!); v.hline(44, 57, H - 10, STONE[4]!); for (const x of [47, 51, 55]) plant(v, x, H - 7, STONE[2]!); // planter
  plinth(v, W, H);
  selOut(v);
}

function stallFrame(v: View, canopy: readonly Rgba[]): void {
  v.shadow(24, 44, 22, 4);
  for (const x of [3, 43]) { v.rect(x, 14, 2, 28, STEEL[2]!); v.vline(x, 14, 41, STEEL[3]!); }
  for (let y = 4; y < 16; y++) for (let x = 1; x < 47; x++) { const k = Math.floor(x / 6) % 2 ? canopy : [c("#c8c0b0"), c("#dcd6c8"), c("#f4f1e8"), c("#fffcf2"), c("#ffffff")]; v.set(x, y, y === 4 ? k[4]! : y < 8 ? k[3]! : y < 13 ? k[2]! : k[1]!); }
  for (let x = 1; x < 47; x++) if (x % 6 > 0 && x % 6 < 5) v.set(x, 16, (Math.floor(x / 6) % 2 ? canopy : [c("#c8c0b0")])[0]!); // scallops
  for (let x = 1; x < 47; x++) v.set(x, 17, c("#1a1630", 90));
  v.rect(4, 32, 40, 10, c("#4a5a8a")); v.hline(4, 43, 32, c("#6c7db0")); for (let x = 6; x < 43; x += 5) v.vline(x, 34, 41, c("#3a4870")); // draped table
  markLit(v, () => { v.set(14, 18, WARM); v.set(34, 18, WARM); });
}

function drawFleaClothes(v: View): void {
  stallFrame(v, tones("#2f6fb5"));
  v.hline(6, 41, 19, STEEL[4]!);
  for (let i = 0; i < 6; i++) {
    const x = 7 + i * 6, k = SHIRTS[i % SHIRTS.length]!;
    v.rect(x, 20, 5, 7, k); v.set(x - 1, 21, k); v.set(x + 5, 21, darker(k)); v.vline(x, 21, 26, lighter(k, 0.3)); v.vline(x + 4, 21, 26, darker(k, 0.8)); v.set(x + 2, 20, darker(k, 0.6));
  }
  for (let i = 0; i < 5; i++) { const k = SHIRTS[(i + 3) % SHIRTS.length]!; v.rect(7 + i * 7, 29, 6, 3, k); v.hline(7 + i * 7, 12 + i * 7, 29, lighter(k, 0.4)); v.hline(7 + i * 7, 12 + i * 7, 30, darker(k, 0.85)); } // folded piles
  v.rect(34, 34, 8, 4, c("#f2c94c")); v.hline(35, 40, 36, c("#b8282a")); // price card
  selOut(v);
}

function drawFleaJunk(v: View): void {
  stallFrame(v, tones("#3c8a4a"));
  v.rect(8, 25, 8, 6, TEAK[2]!); v.hline(8, 15, 25, TEAK[4]!); v.ellipse(11, 28, 2, 2, STONE[3]!); v.set(14, 27, STEEL[1]!); // radio
  v.ellipse(23, 28, 3.5, 3, (_x, _y, dx) => (dx < -0.3 ? STEEL[4]! : dx > 0.4 ? STEEL[1]! : STEEL[3]!)); v.set(26, 26, STEEL[0]!); // kettle
  v.rect(29, 27, 6, 5, c("#a84c3a")); v.rect(36, 27, 6, 5, c("#3f7fd0")); v.hline(29, 34, 27, c("#d07060")); v.hline(36, 41, 27, c("#70a0e0")); // books
  v.rect(10, 20, 10, 4, TEAK[1]!); v.rect(24, 20, 9, 4, TYRE[2]); v.hline(24, 32, 20, STEEL[2]!); // shoes / bag
  selOut(v);
}

function drawClothesRack(v: View): void {
  v.shadow(16, 30, 13, 2);
  for (const x of [3, 28]) { v.vline(x, 6, 29, STEEL[3]!); v.vline(x + 1, 7, 29, STEEL[1]!); }
  v.hline(3, 28, 6, STEEL[4]!);
  v.hline(1, 6, 29, STEEL[2]!); v.hline(25, 30, 29, STEEL[2]!);
  for (const x of [1, 6, 25, 30]) v.set(x, 30, TYRE[1]);
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 6, k = SHIRTS[(i * 3) % SHIRTS.length]!;
    v.rect(x, 8, 5, 10, k); v.set(x - 1, 9, k); v.set(x + 5, 9, darker(k)); v.vline(x, 9, 17, lighter(k, 0.3)); v.vline(x + 4, 9, 17, darker(k, 0.8)); v.set(x + 2, 7, STEEL[4]!);
  }
  selOut(v);
}

export const TOWN_MORE_PAINTERS: Record<string, (v: View) => void> = {
  car_sedan: drawSedan,
  car_taxi: drawTaxi,
  car_pickup: drawPickup,
  tuktuk: drawTuktuk,
  motorbike: drawMotorbike,
  songthaew: drawSongthaew,
  bus_city: drawBus,
  truck_cargo: drawTruck,
  hospital: drawHospital,
  police_station: drawPolice,
  post_office: drawPostOffice,
  bank: drawBank,
  district_office: drawDistrictOffice,
  company_office: drawCompanyOffice,
  shophouse_chinese: drawShophouseChinese,
  house_modern: drawHouseModern,
  flea_stall_clothes: drawFleaClothes,
  flea_stall_junk: drawFleaJunk,
  clothes_rack: drawClothesRack,
};

/** Every DSK-6 vehicle is drawn nose-right: mirror (scale.x = -1) when it drives left. */
export const VEHICLE_KINDS: ReadonlySet<string> = new Set(["car_sedan", "car_taxi", "car_pickup", "tuktuk", "motorbike", "songthaew", "bus_city", "truck_cargo"]);
