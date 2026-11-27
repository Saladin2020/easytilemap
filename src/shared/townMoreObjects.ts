/**
 * DSK-6 top-down (3/4) town set, original procedural pixel art (CC0): parked vehicles drawn nose-right
 * (headlight on the right; mirror with scale.x = -1 to drive left), civic buildings and offices, a
 * Chinese shophouse and a modern house, and ตลาดนัดมือสอง (second-hand flea market) clothes stalls + rack.
 * Buildings follow the city set: a roof seen from above, then the street-facing wall with its door.
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

const INK = c("#221a16");
const GLASS = [c("#2d4157"), c("#4c6c8a"), c("#9cc0d8")] as const;
const TYRE = c("#24262b");
const HEAD = c("#fff4c2");
const TAIL = c("#e2493c");
const SHIRTS = ["#d8453a", "#3f7fd0", "#f2c94c", "#5fb36b", "#f4f1e8", "#9b59b6", "#f08aa6", "#2fa3a0"].map((h) => c(h));
const darker = (k: Rgba, f = 0.75): Rgba => [Math.round(k[0] * f), Math.round(k[1] * f), Math.round(k[2] * f), 255];
const lighter = (k: Rgba, f = 0.35): Rgba => [Math.round(k[0] + (255 - k[0]) * f), Math.round(k[1] + (255 - k[1]) * f), Math.round(k[2] + (255 - k[2]) * f), 255];

function wheel(v: View, x: number, y: number, r = 3): void {
  v.ellipse(x, y, r, r, TYRE);
  v.ellipse(x, y, r - 1.6, r - 1.6, c("#9aa1aa"));
}

/** 3/4 car body: roof seen from above (top band), side with windows, nose on the right. */
function carBody(v: View, w: number, h: number, body: Rgba, opts: { cabin?: [number, number]; bed?: boolean; topSign?: Rgba } = {}): void {
  const base = h - 4;
  v.shadow(w / 2, base + 1, w / 2 - 1, 2.5);
  const [c0, c1] = opts.cabin ?? [Math.round(w * 0.22), Math.round(w * 0.78)];
  // lower body
  v.rect(1, base - 10, w - 2, 8, body);
  v.hline(1, w - 2, base - 10, lighter(body));
  v.rect(1, base - 3, w - 2, 1, darker(body));
  // roof + glass cabin (3/4: roof top visible)
  v.rect(c0, base - 20, c1 - c0, 4, lighter(body, 0.2));
  v.rect(c0 - 1, base - 16, c1 - c0 + 3, 6, GLASS[1]);
  v.rect(c0, base - 16, c1 - c0, 1, GLASS[2]);
  v.vline(Math.round((c0 + c1) / 2), base - 16, base - 11, body);
  if (opts.bed) v.rect(c1 + 2, base - 13, w - c1 - 4, 3, darker(body, 0.6));
  if (opts.topSign) { v.rect(Math.round((c0 + c1) / 2) - 4, base - 23, 8, 3, opts.topSign); v.hline(Math.round((c0 + c1) / 2) - 4, Math.round((c0 + c1) / 2) + 3, base - 23, lighter(opts.topSign)); }
  v.set(w - 2, base - 8, HEAD); v.set(w - 2, base - 7, HEAD); // headlight (nose right)
  v.set(1, base - 8, TAIL); v.set(1, base - 7, TAIL);
  wheel(v, 6, base - 2);
  wheel(v, w - 7, base - 2);
  v.outline(INK);
}

const drawSedan = (v: View) => carBody(v, 32, 32, c("#e9ecef"));
const drawTaxi = (v: View) => carBody(v, 32, 32, c("#ea7aa6"), { topSign: c("#f2c94c") });
const drawPickup = (v: View) => carBody(v, 32, 32, c("#3f6fb5"), { cabin: [6, 16], bed: true });

function drawTuktuk(v: View): void {
  const base = 28;
  v.shadow(16, base + 1, 14, 2.5);
  v.rect(3, base - 20, 24, 3, c("#1f5fa8")); // canopy roof
  v.hline(3, 26, base - 20, c("#4d8bd6"));
  for (const x of [4, 25]) v.vline(x, base - 17, base - 9, c("#2a2d33"));
  v.rect(4, base - 12, 12, 2, c("#d8453a")); // rear bench
  v.rect(3, base - 10, 26, 7, c("#1f5fa8"));
  v.hline(3, 28, base - 10, c("#4d8bd6"));
  for (let x = 4; x < 28; x += 4) v.set(x, base - 6, c("#f2c94c")); // trim
  v.rect(24, base - 15, 4, 5, GLASS[1]); // windscreen
  v.set(29, base - 8, HEAD); v.set(29, base - 7, HEAD);
  v.set(3, base - 7, TAIL);
  wheel(v, 7, base - 2); wheel(v, 25, base - 2, 2.6);
  v.outline(INK);
}

function drawMotorbike(v: View): void {
  const base = 14;
  v.shadow(16, base + 1, 12, 1.5);
  wheel(v, 7, base - 3, 3); wheel(v, 25, base - 3, 3);
  v.rect(9, base - 7, 13, 3, c("#2fa3a0"));
  v.rect(10, base - 9, 7, 2, c("#2a2b30")); // seat
  v.line(21, base - 6, 24, base - 11, c("#5b6068"));
  v.rect(22, base - 12, 4, 1, c("#2a2b30")); // handlebar
  v.set(27, base - 8, HEAD);
  v.set(6, base - 7, TAIL);
  v.outline(INK);
}

function drawSongthaew(v: View): void {
  const w = 48, base = 28, red = c("#c23a33");
  v.shadow(24, base + 1, 22, 2.5);
  v.rect(3, base - 22, 30, 3, c("#e9e4d8")); // canopy roof
  v.hline(3, 32, base - 22, c("#fffaf0"));
  v.rect(2, base - 19, 32, 9, red);
  for (let x = 5; x < 31; x += 6) v.rect(x, base - 18, 4, 4, GLASS[0]); // open side windows
  v.rect(34, base - 18, 11, 8, red); // cab
  v.rect(36, base - 17, 7, 4, GLASS[1]);
  v.rect(1, base - 10, w - 3, 7, red);
  v.hline(1, w - 3, base - 10, lighter(red));
  v.rect(1, base - 6, 33, 1, c("#f2c94c"));
  v.set(w - 2, base - 8, HEAD); v.set(w - 2, base - 7, HEAD);
  v.set(1, base - 8, TAIL);
  wheel(v, 9, base - 2); wheel(v, 39, base - 2);
  v.outline(INK);
}

function drawBus(v: View): void {
  const w = 64, base = 28, body = c("#f0efe8"), band = c("#e8862a");
  v.shadow(32, base + 1, 30, 2.5);
  v.rect(2, base - 24, w - 5, 3, c("#d9d8d0"));
  v.rect(1, base - 21, w - 3, 18, body);
  for (let x = 5; x < w - 12; x += 8) v.rect(x, base - 19, 6, 6, GLASS[1]);
  v.rect(w - 9, base - 19, 6, 10, GLASS[1]); // windscreen + door
  v.rect(1, base - 11, w - 10, 2, band);
  v.rect(1, base - 8, w - 3, 2, c("#3f6fb5"));
  v.set(w - 3, base - 6, HEAD); v.set(w - 3, base - 5, HEAD);
  v.set(1, base - 6, TAIL); v.set(1, base - 5, TAIL);
  wheel(v, 11, base - 2); wheel(v, w - 14, base - 2);
  v.outline(INK);
}

function drawTruck(v: View): void {
  const w = 64, base = 28;
  v.shadow(32, base + 1, 30, 2.5);
  v.rect(1, base - 24, 44, 18, c("#9aa2a8")); // box
  v.hline(1, 44, base - 24, c("#c2c9ce"));
  v.rect(4, base - 17, 38, 4, c("#2e8b57"));
  v.rect(46, base - 18, 15, 12, c("#2e8b57")); // cab, nose right
  v.rect(50, base - 16, 9, 5, GLASS[1]);
  v.rect(1, base - 6, w - 3, 3, c("#3a3d43"));
  v.set(w - 3, base - 9, HEAD); v.set(w - 3, base - 8, HEAD);
  v.set(1, base - 8, TAIL);
  wheel(v, 9, base - 2); wheel(v, 19, base - 2); wheel(v, 53, base - 2);
  v.outline(INK);
}

/** 3/4 building: flat roof (height `roofH`) + facade; returns the wall's top y. */
function block(v: View, W: number, H: number, roofH: number, roof: Rgba, wall: Rgba): number {
  for (let y = 0; y < roofH; y++) for (let x = 0; x < W; x++) v.set(x, y, noise(x, y, 611) > 0.88 ? darker(roof, 0.9) : roof);
  v.rect(0, 0, W, 2, lighter(roof)); v.rect(0, 0, 2, roofH, lighter(roof)); v.rect(W - 2, 0, 2, roofH, darker(roof, 0.9));
  v.rect(0, roofH, W, 2, darker(roof, 0.7));
  v.rect(0, roofH + 2, W, H - roofH - 2, wall);
  v.rect(0, H - 3, W, 3, darker(wall, 0.7)); // plinth
  return roofH + 2;
}

function windowsRow(v: View, W: number, y: number, h = 7, step = 12, x0 = 5, lit = true): void {
  for (let x = x0; x + 8 <= W - 3; x += step) {
    v.rect(x, y, 8, h, GLASS[0]);
    if (lit && noise(x, y, 613) > 0.55) markLit(v, () => v.rect(x + 1, y + 1, 6, h - 2, c("#f6d98a")));
    else v.rect(x + 1, y + 1, 6, 2, GLASS[1]);
  }
}

function door(v: View, x: number, y: number, w: number, h: number, col = GLASS[1]): void {
  v.rect(x - 1, y - 1, w + 2, h + 1, c("#3a3d43"));
  v.rect(x, y, w, h, col);
  v.vline(x + (w >> 1), y, y + h - 1, c("#3a3d43"));
}

/** Sign plate with abstract dot "lettering" (readable names live in nameTh / side-view signs). */
function signPlate(v: View, x: number, y: number, w: number, bg: Rgba, fg = c("#ffffff")): void {
  v.rect(x, y, w, 6, bg);
  v.hline(x, x + w - 1, y, lighter(bg));
  for (let i = x + 3; i < x + w - 3; i += 2) if (noise(i, y, 617) > 0.3) v.set(i, y + 3, fg);
}

function drawHospital(v: View): void {
  const W = 112, H = 112, top = block(v, W, H, 44, c("#dfe3e6"), c("#f4f6f7"));
  // rooftop: green-plus helipad-style roof sign box (not a red cross)
  v.rect(44, 10, 24, 20, c("#ffffff"));
  v.rect(53, 13, 6, 14, c("#2e9d5b")); v.rect(49, 17, 14, 6, c("#2e9d5b"));
  for (const y of [top + 4, top + 18, top + 32]) windowsRow(v, W, y, 8, 12);
  v.rect(0, top + 46, W, 4, c("#2e9d5b")); // green band
  signPlate(v, 34, top + 50, 44, c("#2e9d5b"));
  door(v, 46, H - 15, 20, 12);
  v.rect(80, H - 14, 24, 8, c("#2e9d5b")); // emergency bay bar
  v.rect(90, H - 13, 4, 6, c("#ffffff")); v.rect(88, H - 11, 8, 2, c("#ffffff"));
  v.outline(INK);
}

function drawPolice(v: View): void {
  const W = 80, H = 80, top = block(v, W, H, 30, c("#3b4f7a"), c("#ece4cf"));
  v.rect(0, top, W, 5, c("#24375e"));
  signPlate(v, 18, top + 7, 44, c("#24375e"));
  windowsRow(v, W, top + 16, 9, 14, 4);
  door(v, 32, H - 17, 16, 14);
  v.vline(72, 4, 28, c("#bfc4cc")); // flagpole on the roof, plain red-white-blue stripes
  for (const [i, k] of ["#d8453a", "#f4f1e8", "#2a4b9b", "#f4f1e8", "#d8453a"].entries()) v.hline(64, 71, 5 + i, c(k));
  markLit(v, () => { v.rect(6, top + 1, 3, 3, c("#5aa0ff")); v.rect(W - 9, top + 1, 3, 3, c("#ff5a5a")); });
  v.outline(INK);
}

function drawPostOffice(v: View): void {
  const W = 64, H = 80, top = block(v, W, H, 30, c("#b4312c"), c("#f4f1e8"));
  v.rect(0, top, W, 4, c("#d8453a"));
  signPlate(v, 8, top + 6, 48, c("#d8453a"));
  windowsRow(v, W, top + 16, 9, 18, 6);
  door(v, 24, H - 17, 16, 14);
  v.rect(50, H - 16, 8, 13, c("#d8453a")); v.rect(51, H - 13, 6, 1, c("#2a1414")); // postbox
  v.outline(INK);
}

function drawBank(v: View): void {
  const W = 64, H = 80, top = block(v, W, H, 30, c("#5d6a78"), c("#e8edf2"));
  signPlate(v, 6, top + 2, 52, c("#1f5fa8"), c("#f2c94c"));
  for (const x of [4, 16, 44, 56]) v.rect(x, top + 10, 4, H - top - 13, c("#ffffff")); // columns
  door(v, 24, H - 20, 16, 17);
  v.rect(48, H - 18, 6, 9, c("#3a3d43")); markLit(v, () => v.rect(49, H - 17, 4, 3, c("#7fd0ff"))); // ATM
  v.outline(INK);
}

function drawDistrictOffice(v: View): void {
  const W = 96, H = 96, roof = c("#a5462e");
  // hipped tile roof seen from above
  for (let y = 0; y < 46; y++) for (let x = 0; x < W; x++) {
    const inset = Math.max(0, 10 - y);
    if (x < inset || x >= W - inset) continue;
    v.set(x, y, y % 4 === 3 ? darker(roof) : noise(x >> 2, y >> 2, 621) > 0.8 ? lighter(roof, 0.15) : roof);
  }
  v.rect(0, 46, W, 2, darker(roof, 0.6));
  v.rect(0, 48, W, H - 48, c("#f2ead4"));
  v.rect(0, H - 3, W, 3, c("#b9ab88"));
  signPlate(v, 26, 52, 44, c("#6b4a2e"), c("#f2c94c"));
  windowsRow(v, W, 62, 10, 14, 6);
  v.rect(38, 60, 20, 33, c("#e2d6b6")); // porch
  door(v, 42, H - 22, 12, 19, c("#7a4a2a"));
  v.outline(INK);
}

function drawCompanyOffice(v: View): void {
  const W = 64, H = 112, top = block(v, W, H, 26, c("#6a7682"), c("#46627e"));
  for (let y = top + 2; y < H - 20; y += 7) windowsRow(v, W, y, 5, 10, 4);
  signPlate(v, 12, H - 20, 40, c("#2a2d33"));
  door(v, 22, H - 14, 20, 11);
  v.outline(INK);
}

function drawShophouseChinese(v: View): void {
  const W = 64, H = 80, roof = c("#8b3a2a");
  for (let y = 0; y < 28; y++) for (let x = 0; x < W; x++) v.set(x, y, x % 4 === 0 ? darker(roof) : roof); // barrel tiles
  v.rect(0, 28, W, 2, darker(roof, 0.6));
  v.rect(0, 30, W, H - 30, c("#e9d9a8"));
  for (const x of [8, 26, 44]) { v.rect(x, 34, 12, 12, c("#2f6f5a")); v.rect(x + 2, 36, 8, 8, GLASS[0]); }
  signPlate(v, 6, 50, 52, c("#b8282a"), c("#f2c94c"));
  for (const x of [6, 56]) markLit(v, () => { v.ellipse(x, 60, 2.5, 3, c("#e2493c")); v.set(x, 57, c("#f2c94c")); }); // lanterns
  v.rect(10, 58, 44, 19, c("#5a3d29")); // folding wooden shutters (five-foot way)
  for (let x = 12; x < 54; x += 4) v.vline(x, 59, 76, c("#7a5236"));
  v.rect(0, H - 3, W, 3, c("#b9ab88"));
  v.outline(INK);
}

function drawHouseModern(v: View): void {
  const W = 64, H = 64, top = block(v, W, H, 26, c("#7d858c"), c("#f2f2ee"));
  v.rect(0, top, 26, H - top - 3, c("#c9b48f")); // wood cladding
  for (let y = top + 2; y < H - 3; y += 3) v.hline(0, 25, y, c("#b39c76"));
  v.rect(30, top + 4, 28, 12, GLASS[0]); markLit(v, () => v.rect(32, top + 6, 10, 8, c("#f6d98a")));
  door(v, 8, H - 18, 10, 15, c("#6b4a2e"));
  v.rect(44, H - 10, 14, 7, c("#5fb36b")); // planter
  v.outline(INK);
}

function stallFrame(v: View, canopy: Rgba): void {
  v.shadow(24, 44, 22, 4);
  for (const x of [3, 43]) v.rect(x, 14, 2, 28, c("#6b6f76"));
  for (let y = 6; y < 16; y++) for (let x = 1; x < 47; x++) v.set(x, y, Math.floor(x / 6) % 2 ? canopy : c("#f4f1e8"));
  v.hline(1, 46, 6, lighter(canopy));
  v.rect(4, 32, 40, 10, c("#4a5a8a")); // table with cloth
  v.hline(4, 43, 32, c("#6c7db0"));
}

function drawFleaClothes(v: View): void {
  stallFrame(v, c("#2f6fb5"));
  v.hline(6, 41, 17, c("#bfc4cc")); // hanging rail with shirts
  for (let i = 0; i < 6; i++) {
    const x = 7 + i * 6, k = SHIRTS[i % SHIRTS.length]!;
    v.rect(x, 18, 5, 7, k); v.set(x - 1, 19, k); v.set(x + 5, 19, k); v.set(x + 2, 18, darker(k));
  }
  for (let i = 0; i < 5; i++) v.rect(7 + i * 7, 29, 6, 3, SHIRTS[(i + 3) % SHIRTS.length]!); // folded piles
  v.rect(34, 34, 8, 4, c("#f2c94c")); v.hline(35, 40, 36, c("#b8282a")); // price card
  v.outline(INK);
}

function drawFleaJunk(v: View): void {
  stallFrame(v, c("#3c8a4a"));
  v.rect(8, 26, 8, 6, c("#6b5a48")); v.ellipse(12, 29, 2, 2, c("#c9c3b5")); // radio
  v.ellipse(23, 29, 3.5, 3, c("#b8bcc2")); v.set(26, 27, c("#3a3d43")); // kettle
  v.rect(29, 28, 6, 4, c("#a84c3a")); v.rect(36, 28, 6, 4, c("#3f7fd0")); // books
  v.rect(10, 20, 10, 5, c("#4a3626")); v.rect(24, 20, 9, 5, c("#2a2b30")); // shoes / bag hung on the rail
  v.outline(INK);
}

function drawClothesRack(v: View): void {
  v.shadow(16, 30, 13, 2);
  for (const x of [3, 28]) v.vline(x, 6, 29, c("#8d939b"));
  v.hline(3, 28, 6, c("#bfc4cc"));
  v.hline(1, 6, 29, c("#6b6f76")); v.hline(25, 30, 29, c("#6b6f76"));
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 6, k = SHIRTS[(i * 3) % SHIRTS.length]!;
    v.rect(x, 8, 5, 10, k); v.set(x - 1, 9, k); v.set(x + 5, 9, k);
  }
  v.outline(INK);
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
