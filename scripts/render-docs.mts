/**
 * Render the README images into docs/assets (demo maps, collision overlay, camera crop, tileset atlas, object lineup).
 * Usage: npx tsx scripts/render-docs.mts [outDir]
 * (ui-editor.png, godot.png and pixi.png are screenshots: scripts/capture-ui.py, screenshot.gd, scripts/check-pixi.py.)
 */
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initWorkspace, loadAssets, loadMap } from "../src/lib/workspace.js";
import { writePng } from "../src/lib/png.js";
import { OBJECT_KINDS, objectImage } from "../src/shared/objects.js";
import { blit, createImage, fillRect } from "../src/shared/raster.js";
import { renderMap, scaleImage } from "../src/shared/render.js";
import { generateAtlas } from "../src/shared/tileset.js";

const out = path.resolve(process.argv[2] ?? "docs/assets");
await mkdir(out, { recursive: true });
const ws = await mkdtemp(path.join(os.tmpdir(), "easytilemap-docs-"));
await initWorkspace(ws);
const doc = await loadMap(ws, "thai_village_topdown");
const assets = await loadAssets(ws, doc);
const save = async (name: string, img: Parameters<typeof writePng>[1]) => {
  await writePng(path.join(out, name), img);
  console.log(`wrote ${name} · ${img.width}×${img.height}`);
};

await save("map-thai-village.png", renderMap(doc, assets, { scale: 2 }));
await save("map-collision.png", renderMap(doc, assets, { scale: 2, collision: true, spawns: true, grid: true }));
await save("map-camera.png", renderMap(doc, assets, { scale: 3, crop: { x: 160, y: 60, w: 480, h: 270 } }));
await save("tileset-atlas.png", scaleImage(generateAtlas(), 3));
const village = await loadMap(ws, "multicultural_village");
await save("map-multicultural-village.png", renderMap(village, await loadAssets(ws, village), { scale: 2 }));

// three rows: Thai village buildings, the multicultural (Muslim kampung + Chinese-Thai) set, then nature / props / bridges
const MULTI = new Set(["mosque", "tadika", "kampung_house", "halal_stall", "chinese_shrine", "fish_rack", "kolek"]);
const thai = OBJECT_KINDS.filter((o) => !MULTI.has(o.kind));
const rows = [thai.slice(0, 6), OBJECT_KINDS.filter((o) => MULTI.has(o.kind)), thai.slice(6)];
const rowH = rows.map((r) => Math.max(...r.map((o) => objectImage(o.kind).height)) + 8);
const rowW = rows.map((r) => r.reduce((w, o) => w + objectImage(o.kind).width + 6, 6));
const strip = createImage(Math.max(...rowW), rowH.reduce((a, b) => a + b, 4));
fillRect(strip, 0, 0, strip.width, strip.height, [106, 172, 74, 255]);
rows.forEach((r, i) => {
  let x = 6;
  const base = rowH.slice(0, i + 1).reduce((a, b) => a + b, 0) - 2;
  for (const o of r) {
    const im = objectImage(o.kind);
    blit(strip, im, x, base - im.height);
    x += im.width + 6;
  }
});
await save("objects-lineup.png", scaleImage(strip, 3));
await rm(ws, { recursive: true, force: true });
