import { describe, expect, it } from "vitest";
import { townRoadRange, townSurfaceY, townWalkRange } from "../runtime/pixi/easytilemap-overworld.js";

/** Kampung-like: solid street to x=1232, thin pier deck 1200–1296, open water after that. */
const kampung = {
  tileSize: 16,
  size: { width: 1456 },
  tilemap: {
    width: 91,
    height: 17,
    codes: Array.from({ length: 17 }, (_, y) => (y >= 14 ? "#".repeat(77) + ".".repeat(14) : ".".repeat(91))),
  },
  collision: { solid: [{ x: 0, y: 224, w: 1232, h: 16 }, { x: 0, y: 240, w: 1232, h: 16 }, { x: 0, y: 256, w: 1232, h: 16 }, { x: 1200, y: 224, w: 96, h: 6 }] },
};

const landlocked = {
  tileSize: 16,
  size: { width: 480 },
  tilemap: { width: 30, height: 8, codes: Array.from({ length: 8 }, (_, y) => (y >= 5 ? "#".repeat(30) : ".".repeat(30))) },
  collision: { solid: [{ x: 0, y: 80, w: 480, h: 48 }] },
};

describe("town walk / road ranges", () => {
  it("lets the player walk to the end of the pier but keeps the road on land", () => {
    expect(townWalkRange(kampung)).toEqual({ minX: 0, maxX: 1296 });
    expect(townRoadRange(kampung)).toEqual({ minX: 0, maxX: 1200 });
    expect(townSurfaceY(kampung, 100)).toBe(224);
    expect(townSurfaceY(kampung, 1248)).toBe(224); // on the deck
    expect(townSurfaceY(kampung, 1360)).toBe(17 * 16); // in the water, no deck
  });

  it("prefers exported walk/road when present", () => {
    const j = { ...kampung, walk: { minX: 0, maxX: 1300 }, road: { minX: 0, maxX: 1100 } };
    expect(townWalkRange(j)).toEqual({ minX: 0, maxX: 1300 });
    expect(townRoadRange(j)).toEqual({ minX: 0, maxX: 1100 });
  });

  it("a landlocked street is walkable and drivable to both edges", () => {
    expect(townWalkRange(landlocked)).toEqual({ minX: 0, maxX: 480 });
    expect(townRoadRange(landlocked)).toEqual({ minX: 0, maxX: 480 });
  });
});
