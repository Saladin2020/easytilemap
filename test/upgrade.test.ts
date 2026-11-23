/**
 * Old workspaces (atlas written before the city / overworld rows were appended) upgrade without losing work:
 * `upgrade` / plain `init` append the new atlas rows (repainted rows kept, old file backed up), add the
 * overworld objects and the side-view sample player, never overwrite maps or characters, and are idempotent.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodePng, readPng } from "../src/lib/png.js";
import { dirs, initWorkspace, loadAtlas, upgradeWorkspace } from "../src/lib/workspace.js";
import { generateAtlas } from "../src/shared/tileset.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup?.());

const OLD_ROWS = 58; // the atlas height at 6d7d3b8 (village + city, before the overworld rows)

async function makeOld(): Promise<void> {
  const d = dirs(root);
  const full = generateAtlas();
  const old = { width: full.width, height: OLD_ROWS * 16, data: new Uint8Array(full.data.subarray(0, full.width * OLD_ROWS * 16 * 4)) };
  old.data.set([255, 0, 255, 255], 0); // a "repainted" pixel
  writeFileSync(path.join(d.tilesets, "thai_village.png"), encodePng(old));
  const meta = JSON.parse(readFileSync(path.join(d.tilesets, "thai_village.json"), "utf8"));
  meta.rows = OLD_ROWS;
  meta.objects = meta.objects.filter((o: { kind: string }) => !o.kind.startsWith("ow_"));
  writeFileSync(path.join(d.tilesets, "thai_village.json"), JSON.stringify(meta));
  for (const f of readdirSync(d.objects)) if (f.startsWith("ow_")) rmSync(path.join(d.objects, f));
  rmSync(path.join(d.characters, "side"), { recursive: true, force: true });
  const mapFile = path.join(d.maps, "thai_village_topdown.json");
  const m = JSON.parse(readFileSync(mapFile, "utf8"));
  m.name = "My edited village";
  writeFileSync(mapFile, JSON.stringify(m, null, 2));
}

describe("upgrading an old workspace", () => {
  it("dry run reports the old atlas and touches nothing", async () => {
    await makeOld();
    const before = readFileSync(path.join(dirs(root).tilesets, "thai_village.png"));
    const rep = await upgradeWorkspace(root, { dryRun: true });
    expect(rep.atlas).toMatchObject({ fromRows: OLD_ROWS, toRows: generateAtlas().height / 16 });
    expect(rep.added.some((f) => f.endsWith("ow_walled_town.png"))).toBe(true);
    expect(readFileSync(path.join(dirs(root).tilesets, "thai_village.png")).equals(before)).toBe(true);
    expect(existsSync(path.join(dirs(root).tilesets, "_backup"))).toBe(false);
  });

  it("appends the new rows, keeps repainted rows and edited maps, backs up, and is idempotent", async () => {
    const d = dirs(root);
    const renderedBefore = await loadAtlas(root); // in memory the missing rows were already filled
    const rep = await upgradeWorkspace(root);
    const img = await readPng(path.join(d.tilesets, "thai_village.png"));
    expect(img.height).toBe(generateAtlas().height);
    expect([...img.data.subarray(0, 4)]).toEqual([255, 0, 255, 255]);
    expect(Buffer.from(img.data).equals(Buffer.from(renderedBefore.data))).toBe(true);
    expect(existsSync(path.join(root, rep.atlas!.backup!))).toBe(true);
    expect((await readPng(path.join(root, rep.atlas!.backup!))).height).toBe(OLD_ROWS * 16);
    expect(JSON.parse(await readFile(path.join(d.tilesets, "thai_village.json"), "utf8")).rows).toBe(generateAtlas().height / 16);
    expect(existsSync(path.join(d.objects, "ow_station.png"))).toBe(true);
    expect(existsSync(path.join(d.characters, "side", "side_kopiah_boy.png"))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(d.maps, "thai_village_topdown.json"), "utf8")).name).toBe("My edited village");
    const again = await upgradeWorkspace(root);
    expect(again.atlas).toBeUndefined();
    expect(again.tilesetMeta).toBeUndefined();
    expect(again.added).toEqual([]);
  });

  it("plain init on an old workspace upgrades it the same way (no --force needed)", async () => {
    await makeOld();
    await initWorkspace(root);
    expect((await readPng(path.join(dirs(root).tilesets, "thai_village.png"))).height).toBe(generateAtlas().height);
    expect(JSON.parse(readFileSync(path.join(dirs(root).maps, "thai_village_topdown.json"), "utf8")).name).toBe("My edited village");
  });
});
