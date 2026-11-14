import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildThaiVillage } from "../src/lib/demoMaps.js";
import { pkgRoot } from "../src/lib/workspace.js";
import { validateMap } from "../src/shared/map.js";

describe("samples", () => {
  it("the committed demo map matches the generator and validates cleanly", async () => {
    const file = JSON.parse(await readFile(path.join(pkgRoot, "samples/maps/thai_village_topdown.json"), "utf8"));
    const res = validateMap(file);
    expect(res.errors).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.doc).toEqual(validateMap(buildThaiVillage()).doc);
  });

  it("spawns match Easy Dialogue @camera targets and the cast matches its portraits", async () => {
    const doc = validateMap(buildThaiVillage()).doc!;
    expect(doc.spawns.map((s) => s.name)).toEqual(expect.arrayContaining(["player", "market", "temple", "elder_house"]));
    const sheets = doc.characters.map((c) => path.basename(c.sheet, ".png")).sort();
    expect(sheets).toEqual(["town_elder", "town_farmer", "town_kid", "town_monk", "town_student", "town_vendor"]);
  });

  it("character sheets are Easy Sprite native top-down (4 facing rows)", async () => {
    for (const id of ["town_kid", "town_monk"]) {
      const meta = JSON.parse(await readFile(path.join(pkgRoot, `samples/characters/${id}.json`), "utf8"));
      expect(meta.format).toBe("easysprite.native");
      expect(meta.directions).toEqual(["front", "right", "back", "left"]);
    }
  });
});
