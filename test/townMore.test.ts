/** DSK-6 top-down town set: vehicles face right, buildings / stalls are on the tile grid, Thai names. */
import { describe, expect, it } from "vitest";
import { OBJECT_BY_KIND, OBJECT_KINDS, objectImage } from "../src/shared/objects.js";
import { TOWN_MORE_OBJECT_KINDS, VEHICLE_KINDS } from "../src/shared/townMoreObjects.js";

describe("DSK-6 top-down objects", () => {
  it("registers every kind after the older ones (old indexes unchanged) with Thai-script names", () => {
    const n = TOWN_MORE_OBJECT_KINDS.length;
    expect(OBJECT_KINDS.slice(-n).map((o) => o.kind)).toEqual(TOWN_MORE_OBJECT_KINDS.map((o) => o.kind));
    for (const o of TOWN_MORE_OBJECT_KINDS) {
      expect(OBJECT_BY_KIND.get(o.kind), o.kind).toBe(o);
      expect(o.nameTh, o.kind).toMatch(/^[\u0E00-\u0E7F ]+$/);
    }
    for (const k of ["hospital", "police_station", "post_office", "bank", "district_office", "company_office", "flea_stall_clothes", "clothes_rack", "tuktuk", "songthaew", "bus_city"]) expect(OBJECT_BY_KIND.has(k), k).toBe(true);
  });

  it("paints each kind at its tile size, solid area inside the image", () => {
    for (const o of TOWN_MORE_OBJECT_KINDS) {
      const img = objectImage(o.kind);
      expect([img.width, img.height], o.kind).toEqual([o.w * 16, o.h * 16]);
      if (o.solid) expect(o.solid.x + o.solid.w <= o.w && o.solid.y + o.solid.h <= o.h, o.kind).toBe(true);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) opaque++;
      expect(opaque, o.kind).toBeGreaterThan(img.width * img.height * 0.2);
    }
  });

  it("vehicles are drawn nose-right: headlight in the right half, tail light in the left", () => {
    expect(VEHICLE_KINDS.size).toBe(8);
    for (const k of VEHICLE_KINDS) {
      const img = objectImage(k);
      let hx = 0, hn = 0, tx = 0, tn = 0;
      for (let i = 0; i < img.width * img.height; i++) {
        const [r, g, b] = [img.data[i * 4]!, img.data[i * 4 + 1]!, img.data[i * 4 + 2]!];
        const x = i % img.width;
        if (r === 0xff && g === 0xf4 && b === 0xc2) { hx += x; hn++; }
        if (r === 0xe2 && g === 0x49 && b === 0x3c) { tx += x; tn++; }
      }
      expect(hn, k).toBeGreaterThan(0);
      expect(tn, k).toBeGreaterThan(0);
      expect(hx / hn, k).toBeGreaterThan(img.width / 2);
      expect(tx / tn, k).toBeLessThan(img.width / 2);
    }
  });
});
