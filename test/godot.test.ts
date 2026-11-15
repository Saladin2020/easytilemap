/**
 * Optional Godot check: GODOT=/path/to/godot npx vitest run test/godot.test.ts
 * Exports the demo, imports it headless, and runs test_map.gd, which counts the scene's tiles/nodes.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportMap } from "../src/lib/export.js";
import { loadMap } from "../src/lib/workspace.js";
import { collisionGrid, collisionRects } from "../src/shared/map.js";
import { TERRAINS } from "../src/shared/types.js";
import { saveMap } from "../src/lib/workspace.js";
import { generateOverworld } from "../src/shared/overworldGen.js";
import { tempWorkspace } from "./helpers.js";

const GODOT = process.env.GODOT;
let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  if (GODOT) ({ root, cleanup } = await tempWorkspace());
});
afterAll(() => cleanup?.());

describe.skipIf(!GODOT)("Godot export", () => {
  it.each(["thai_village_topdown", "city_crossing"])("%s imports headless and the scene matches the map", async (id) => {
    const out = path.join(root, "exports", `godot-check-${id}`);
    await exportMap(root, { id, preset: "godot", out });
    // Godot 4.3 has no --import flag; one editor pass imports the assets (it may crash on quit — ignored).
    spawnSync(GODOT!, ["--headless", "--editor", "--quit", "--path", out], { encoding: "utf8", timeout: 180_000 });
    const run = spawnSync(GODOT!, ["--headless", "--path", out, "--script", "res://test_map.gd"], { encoding: "utf8", timeout: 120_000 });
    expect(run.stdout).toMatch(/^OK$/m);
    const result = JSON.parse(run.stdout.match(/^RESULT\| (.*)$/m)![1]!);
    const doc = await loadMap(root, id);
    expect(result.ground).toBe(doc.width * doc.height);
    expect(result.decor).toBe(doc.layers.decor.join("").replace(/\./g, "").length);
    expect(result.characters).toBe(doc.characters.length);
    expect(result.spawns).toBe(doc.spawns.length);
    expect(result.collision_shapes).toBe(collisionRects(collisionGrid(doc)).length);
    expect(result.terrains).toBe(TERRAINS.length);
    expect(result.y_sort).toBe(true);
  }, 400_000);

  it("overworld: walks into a town, back out, rides the train through a tunnel and toggles night (headless)", async () => {
    const doc = generateOverworld({ seed: 7, id: "ow_godot", name: "Overworld", player: "characters/town_kopiah_boy.png" });
    expect((await saveMap(root, doc, { force: true })).saved).toBe(true);
    const out = path.join(root, "exports", "godot-check-overworld");
    await exportMap(root, { id: doc.id, preset: "godot", out });
    spawnSync(GODOT!, ["--headless", "--editor", "--quit", "--path", out], { encoding: "utf8", timeout: 180_000 });
    const run = spawnSync(GODOT!, ["--headless", "--fixed-fps", "60", "--path", out, "--script", "res://overworld/test_overworld.gd"], { encoding: "utf8", timeout: 180_000 });
    expect(run.stdout).toMatch(/^OK$/m);
    const result = JSON.parse(run.stdout.match(/^RESULT\| (.*)$/m)![1]!);
    expect(result.towns).toBe(doc.overworld!.towns.length);
    expect(result.entered).toBeTruthy();
    expect(result.camera_town).toBe(true);
    expect(result.back_on_entrance).toBe(true);
    expect(result.rode).toBe(true);
    expect(result.arrived).toBe(true);
    expect(result.player_sprite).toBe(true);
    expect(result.tunnel_route).toBe(true);
    expect(result.hidden_in_tunnel).toBe(true);
    expect(result.night_atlas).toBe(true);
    expect(result.night_glow).toBe(true);
    expect(result.night_objects).toBeGreaterThan(0);
    expect(result.day_restored).toBe(true);
    // N inside a town: day / night follows the overworld, the player keeps its place and its tint follows
    expect(result.town_player_tinted).toBe(true);
    expect(result.town_day_after_n).toBe(true);
    expect(result.town_x_kept).toBe(true);
    expect(result.town_player_untinted).toBe(true);
  }, 600_000);
});
