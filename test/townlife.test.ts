/** Town life (DSK-5): airports next to towns, flights, flood lowland grid; exported into overworld.json. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportMap } from "../src/lib/export.js";
import { saveMap } from "../src/lib/workspace.js";
import { collisionGrid } from "../src/shared/map.js";
import { AIRPORT_H, AIRPORT_W, airportSites, floodReach, lowlandGrid, travelGraph } from "../src/shared/overworld.js";
import { airportImage, planeSheet } from "../src/shared/overworldObjects.js";
import { generateOverworld } from "../src/shared/overworldGen.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup?.());

const doc = generateOverworld({ seed: 7, id: "ow_tl", name: "Overworld", player: "characters/town_kopiah_boy.png" });

describe("airports", () => {
  it("places a free 6×3 airport near each requested town, gate on its bottom row, deterministic", () => {
    const blocked = collisionGrid(doc);
    const ids = doc.overworld!.towns.slice(0, 2).map((t) => t.id);
    const a = airportSites(doc, ids, blocked);
    expect(a.map((x) => x.town)).toEqual(ids);
    for (const ap of a) {
      expect([ap.rect.w, ap.rect.h]).toEqual([AIRPORT_W, AIRPORT_H]);
      for (let y = ap.rect.y; y < ap.rect.y + ap.rect.h; y++) for (let x = ap.rect.x; x < ap.rect.x + ap.rect.w; x++) {
        expect(blocked[y]![x], `${ap.id} ${x},${y}`).toBe(false);
        expect("gdbp").toContain(doc.layers.ground[y]![x]);
      }
      expect(ap.tile[1]).toBe(ap.rect.y + AIRPORT_H - 1);
      expect(ap.name.th.startsWith("ท่าอากาศยาน")).toBe(true);
      const t = doc.overworld!.towns.find((x) => x.id === ap.town)!;
      expect(Math.abs(ap.tile[0] - t.entrance[0]) + Math.abs(ap.tile[1] - t.entrance[1])).toBeLessThan(30);
    }
    expect(airportSites(doc, ids, blocked)).toEqual(a);
    // the two footprints never touch
    const [p, q] = a;
    expect(p!.rect.x + p!.rect.w < q!.rect.x || q!.rect.x + q!.rect.w < p!.rect.x || p!.rect.y + p!.rect.h < q!.rect.y || q!.rect.y + q!.rect.h < p!.rect.y).toBe(true);
  });

  it("travelGraph lists airports and flights both ways only when asked", () => {
    expect(travelGraph(doc)!).not.toHaveProperty("airports");
    const g = travelGraph(doc, { airports: doc.overworld!.towns.slice(0, 2).map((t) => t.id), blocked: collisionGrid(doc) })!;
    expect(g.airports!.length).toBe(2);
    expect(g.flights!.length).toBe(2);
  });

  it("plane sheet + airport art are opaque pixel sprites of the right size", () => {
    const p = planeSheet();
    expect([p.width, p.height]).toEqual([64, 32]);
    const a = airportImage();
    expect([a.width, a.height]).toEqual([96, 48]);
    let opaque = 0;
    for (let i = 3; i < p.data.length / 2; i += 4) if (p.data[i]) opaque++;
    expect(opaque).toBeGreaterThan(150);
  });
});

describe("plane facing (DSK-6)", () => {
  it("the top-down plane is drawn nose-right, so rotation 0 means flying +x", () => {
    const p = planeSheet();
    // cockpit glass (#2d4157) sits in the nose; the orange tail at the other end
    let glass = 0, tail = 0, ng = 0, nt = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * p.width + x) * 4;
      const [r, g, b] = [p.data[i]!, p.data[i + 1]!, p.data[i + 2]!];
      if (r === 0x2d && g === 0x41 && b === 0x57) { glass += x; ng++; }
      if (r === 0xe0 && g === 0x6e && b === 0x1c) { tail += x; nt++; }
    }
    expect(ng).toBeGreaterThan(0);
    expect(nt).toBeGreaterThan(0);
    expect(glass / ng).toBeGreaterThan(16);
    expect(tail / nt).toBeLessThan(16);
  });

  it("the Pixi runtime points flights and both flyover directions along their travel", async () => {
    const src = await readFile(path.join(__dirname, "..", "runtime", "pixi", "easytilemap-overworld.js"), "utf8");
    // flyovers: rotation 0 moving right, PI moving left (never a bare scale flip)
    expect(src).toMatch(/placePlane\(m, m\.x, m\.y, 1, m\.dir > 0 \? 0 : Math\.PI\)/);
    expect(src).toMatch(/m\.x \+= m\.dir \* /);
    // cruise heading follows the A → B vector
    expect(src).toMatch(/ang = Math\.atan2\(rb\.y - ra\.y, rb\.x0 - ra\.x1\)/);
  });
});

describe("flood lowland", () => {
  it("water is 0, cells rise with distance from water, paddy sits lower", () => {
    const g = lowlandGrid(doc);
    expect(g.length).toBe(doc.height);
    for (let y = 0; y < doc.height; y++) for (let x = 0; x < doc.width; x++) {
      const code = doc.layers.ground[y]![x];
      const h = Number(g[y]![x]);
      if (code === "w") expect(h).toBe(0);
      else expect(h).toBeGreaterThanOrEqual(1);
    }
  });

  it("floodReach follows the easynpc stages (dry below .15, deeper levels reach higher ground)", () => {
    expect(floodReach(0)).toBe(0);
    expect(floodReach(0.1)).toBe(0);
    expect(floodReach(0.15)).toBe(1);
    expect(floodReach(0.35)).toBe(3);
    expect(floodReach(0.85)).toBeGreaterThan(floodReach(0.6));
    expect(floodReach(1)).toBeLessThanOrEqual(9);
  });
});

describe("pixi export", () => {
  it("--airports writes airports, flights, plane + airport sprites and the lowland grid", async () => {
    expect((await saveMap(root, doc, { force: true })).saved).toBe(true);
    const out = path.join(root, "exports", "tl-pixi");
    const ids = doc.overworld!.towns.slice(0, 2).map((t) => t.id);
    const res = await exportMap(root, { id: doc.id, preset: "pixi", out, overworld: { airports: ids } });
    const data = JSON.parse(await readFile(path.join(out, "overworld", "overworld.json"), "utf8"));
    expect(data.airports.map((a: { town: string }) => a.town)).toEqual(ids);
    expect(data.flights.length).toBe(2);
    expect(data.plane).toBe("overworld/plane.png");
    expect(data.lowland.length).toBe(doc.height);
    for (const f of ["overworld/plane.png", "overworld/airport.png"]) expect(res.files.some((x) => x.split(path.sep).join("/").endsWith(f)), f).toBe(true);
    const rt = await readFile(path.join(out, "easytilemap-overworld.js"), "utf8");
    for (const fn of ["function fly(", "function setFlood(", "function setPaused(", "function flyover(", "onStation", "onAirport"]) expect(rt).toContain(fn);
  });

  it("without --airports the export has no plane files (older maps unchanged apart from the lowland grid)", async () => {
    const out = path.join(root, "exports", "tl-pixi-plain");
    const res = await exportMap(root, { id: doc.id, preset: "pixi", out });
    const data = JSON.parse(await readFile(path.join(out, "overworld", "overworld.json"), "utf8"));
    expect(data.airports).toBeUndefined();
    expect(res.files.some((x) => x.endsWith("plane.png"))).toBe(false);
  });
});
