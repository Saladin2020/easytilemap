import { describe, expect, it } from "vitest";
import { NIGHT_MASKED_KINDS, objectImage, objectNightMask } from "../src/shared/objects.js";
import { nightImage, nightObject } from "../src/shared/night.js";
import type { RgbaImage } from "../src/shared/raster.js";

const warm = (img: RgbaImage, p: number) => img.data[p * 4]! >= 240 && img.data[p * 4 + 2]! <= 130;
const litPixels = (mask: Uint8Array) => [...mask.keys()].filter((p) => mask[p]);

describe("pole lamps: explicit night masks", () => {
  it("lamp_pole lights exactly its bulb (8×2), lantern_post its two lanterns, utility_pole nothing", () => {
    expect([...NIGHT_MASKED_KINDS].sort()).toEqual(["lamp_pole", "lantern_post", "utility_pole"]);
    const bulb = litPixels(objectNightMask("lamp_pole")!);
    expect(bulb.length).toBe(16);
    const w = objectImage("lamp_pole").width;
    expect(bulb.every((p) => p % w >= 4 && p % w < 12 && ((p / w) | 0) >= 7 && ((p / w) | 0) < 9)).toBe(true);
    expect(litPixels(objectNightMask("lantern_post")!).length).toBeGreaterThan(20);
    expect(litPixels(objectNightMask("utility_pole")!)).toEqual([]);
    expect(objectNightMask("brick_rowhouse")).toBeUndefined(); // buildings keep their window colours
  });

  it("the masked pixels glow warm at night; before, the bulb and lanterns stayed dark", () => {
    for (const kind of ["lamp_pole", "lantern_post"]) {
      const img = objectImage(kind);
      const mask = objectNightMask(kind)!;
      const night = nightObject(kind, img);
      const lit = litPixels(mask).filter((p) => img.data[p * 4 + 3]);
      expect(lit.length).toBeGreaterThan(0);
      expect(lit.every((p) => warm(night, p)), kind).toBe(true);
      const colourOnly = nightImage(img); // the old colour-based pass
      expect(lit.filter((p) => warm(colourOnly, p)).length, kind).toBe(0);
    }
  });

  it("utility poles stay fully moonlit (no stray lights)", () => {
    const img = objectImage("utility_pole");
    const night = nightObject("utility_pole", img);
    for (let p = 0; p < img.width * img.height; p++) if (img.data[p * 4 + 3]) expect(warm(night, p)).toBe(false);
  });

  it("repainted poles fall back to the colour rules", () => {
    const img = objectImage("lamp_pole");
    const repainted: RgbaImage = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
    repainted.data[0] = 1; repainted.data[3] = 255; // one changed pixel
    const fallback = nightObject("lamp_pole", repainted);
    const viaColours = nightImage(repainted);
    expect(Buffer.from(fallback.data).equals(Buffer.from(viaColours.data))).toBe(true);
  });
});
