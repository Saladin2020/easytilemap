/**
 * Optional browser check of the PixiJS overworld game (parity with the Godot test_overworld.gd):
 *   PIXI_JS=/path/to/pixi.min.js [CHROME_PATH=/usr/bin/google-chrome] [EASYSCENE=/path/to/easyscene] npx vitest run test/pixi-overworld.test.ts
 * Needs python3 + Playwright. With EASYSCENE the towns are real Easy Scene Pixi exports, otherwise placeholder streets.
 */
import { spawnSync } from "node:child_process";
import { copyFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportMap } from "../src/lib/export.js";
import { saveMap } from "../src/lib/workspace.js";
import { generateOverworld } from "../src/shared/overworldGen.js";
import { tempWorkspace } from "./helpers.js";

const PIXI_JS = process.env.PIXI_JS;
const ES = process.env.EASYSCENE;
let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => {
  if (PIXI_JS) ({ root, cleanup } = await tempWorkspace());
});
afterAll(() => cleanup?.());

describe.skipIf(!PIXI_JS || !existsSync(PIXI_JS))("PixiJS overworld (headless Chrome)", () => {
  it("enters a town side view, walks back out, rides a train through a tunnel, toggles night (in towns too)", async () => {
    const doc = generateOverworld({ seed: 7, id: "ow_pixi", name: "Overworld", player: "characters/town_kopiah_boy.png" });
    expect((await saveMap(root, doc, { force: true })).saved).toBe(true);
    let townScenes: string | undefined;
    if (ES) {
      const sw = path.join(root, "scenes-ws");
      const r = spawnSync("npx", ["tsx", "src/cli.ts", "towns", "--from-overworld", path.join(root, "maps", "ow_pixi.json"), "--workspace", sw, "--export", "pixi", "--night", "--out", path.join(sw, "exports")], { cwd: ES, encoding: "utf8", timeout: 300_000 });
      expect(r.status, r.stderr).toBe(0);
      townScenes = path.join(sw, "exports");
    }
    const out = path.join(root, "exports", "pixi-overworld");
    const res = await exportMap(root, { id: doc.id, preset: "pixi", out, overworld: { townScenes } });
    const data = JSON.parse(await readFile(path.join(out, "overworld", "overworld.json"), "utf8"));
    expect(data.format).toBe("easytilemap.overworld-pixi/1");
    expect(data.tunnels.length).toBeGreaterThan(0);
    expect(res.files.some((f) => f.endsWith("easytilemap-overworld.js"))).toBe(true);
    await copyFile(PIXI_JS!, path.join(out, "pixi.min.js"));
    const run = spawnSync("python3", [path.resolve("scripts/check-pixi-overworld.py"), out, path.join(root, "shot")], {
      encoding: "utf8",
      timeout: 300_000,
      env: { ...process.env, ALLOW_PLACEHOLDER_TOWNS: ES ? "0" : "1", PORT: "8981" },
    });
    const line = run.stdout.match(/^RESULT (.*) (OK|FAIL)$/m);
    expect(line, run.stdout + run.stderr).toBeTruthy();
    const r = JSON.parse(line![1]!);
    expect(line![2]).toBe("OK");
    expect(r.entered).toBeTruthy();
    if (ES) expect(r.town_loaded).toBe(true);
    expect(r.back_on_entrance).toBe(true);
    expect(r.arrived).toBe(true);
    expect(r.hidden_in_tunnel).toBe(true);
    expect(r.night_darker).toBe(true);
    // towns follow the overworld's night: night street on entry, N swaps it in place
    expect(r.town_day_after_n).toBe(true);
    expect(r.town_x_kept).toBe(true);
    if (ES) {
      expect(r.town_night_export).toBe(true);
      expect(r.town_night_on_enter).toBe(true);
      expect(r.town_night_after_n).toBe(true);
    }
    expect(r.errors).toEqual([]);
  }, 600_000);
});
