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
});
