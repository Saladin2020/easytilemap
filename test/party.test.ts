import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { type Cell, facingToward, followerTiles, minimapGrid, pushTrail } from "../src/shared/party.js";

describe("party followers + minimap", () => {
  it("followers walk the leader's trail, newest first, without repeats", () => {
    const t: Cell[] = [];
    for (const c of [[0, 0], [1, 0], [1, 0], [2, 0], [2, 1]] as Cell[]) pushTrail(t, c, 8);
    expect(followerTiles(t, [2, 2], 4)).toEqual([[2, 1], [2, 0], [1, 0], [0, 0]]);
    expect(followerTiles(t, [2, 2], 2, 2)).toEqual([[2, 0], [0, 0]]);
    expect(followerTiles([], [5, 5], 2)).toEqual([[5, 5], [5, 5]]);
    for (let i = 0; i < 20; i++) pushTrail(t, [i, 9], 8);
    expect(t.length).toBe(8);
    expect([facingToward([1, 1], [1, 0]), facingToward([1, 1], [2, 1]), facingToward([1, 1], [1, 1], "left")]).toEqual(["back", "right", "left"]);
  });

  it("minimap marks blocked tiles, rails, stations and town gates", () => {
    const g = minimapGrid({ blocked: ["..#..", ".....", "....."], towns: [{ entrance: [0, 2], station: [1, 1] }], trains: [{ path: [[1, 1], [2, 1], [3, 1]] }] });
    expect(g).toEqual(["..#..", ".S==.", "T...."]);
  });

  it("the Pixi runtime uses the same rules", async () => {
    // the overworld module imports the tilemap loader only; its exported helpers are pure
    const js = await import(pathToFileURL(path.resolve("runtime/pixi/easytilemap-overworld.js")).href);
    const t: Cell[] = [];
    for (const c of [[0, 0], [1, 0], [1, 0], [2, 0], [2, 1]] as Cell[]) js.pushTrail(t, c, 8);
    expect(js.followerTiles(t, [2, 2], 4)).toEqual([[2, 1], [2, 0], [1, 0], [0, 0]]);
    expect(js.minimapGrid({ blocked: ["..#..", ".....", "....."], towns: [{ entrance: [0, 2], station: [1, 1] }], trains: [{ path: [[1, 1], [2, 1], [3, 1]] }] })).toEqual(["..#..", ".S==.", "T...."]);
    expect(js.facingToward([1, 1], [1, 0])).toBe("back");
  });
});
