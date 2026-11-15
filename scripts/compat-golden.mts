/**
 * Write test/fixtures/compat-master.json: fingerprints of the sample maps as exported by an OLDER checkout.
 * Run it from that checkout (only uses APIs that existed before the overworld work):
 *   git archive master | tar -x -C /tmp/etm-old && cd /tmp/etm-old && npm i
 *   npx tsx /path/to/easytilemap/scripts/compat-golden.mts /path/to/easytilemap/test/fixtures/compat-master.json
 * test/compat.test.ts re-computes them with this checkout.
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cwd = process.cwd();
const imp = (p: string) => import(path.join(cwd, p));
const { exportMap } = await imp("src/lib/export.ts");
const { initWorkspace, loadMap, loadAssets } = await imp("src/lib/workspace.ts");
const { renderMap } = await imp("src/shared/render.ts");
const autotile = await imp("src/shared/autotile.ts");
const types = await imp("src/shared/types.ts");

const sha = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const root = await mkdtemp(path.join(os.tmpdir(), "etm-golden-"));
await initWorkspace(root);
const out: Record<string, unknown> = {
  terrains: types.TERRAINS,
  terrainCodes: types.TERRAIN_CODE,
  rows: Object.fromEntries(Object.entries(autotile).filter(([k, v]) => /_ROW$|^ATLAS_ROWS$/.test(k) && typeof v === "number")),
  maps: {},
};
const ids = (await readdir(path.join(root, "maps"))).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
for (const id of ids) {
  const doc = await loadMap(root, id);
  const assets = await loadAssets(root, doc);
  const img = renderMap(doc, assets, { scale: 1 });
  const dir = path.join(root, "exports", `golden-${id}`);
  await exportMap(root, { id, preset: "all", out: dir });
  const g = path.join(dir, `${id}-godot`);
  const p = path.join(dir, `${id}-pixi`);
  const bundle = JSON.parse(await readFile(path.join(p, `${id}.tilemap.json`), "utf8"));
  const rows = bundle.atlas.rows;
  delete bundle.atlas.rows;
  const files = async (d: string): Promise<string[]> => (await readdir(d, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).map((e) => path.relative(d, path.join(e.parentPath, e.name))).sort();
  (out.maps as Record<string, unknown>)[id] = {
    render: { width: img.width, height: img.height, sha: sha(img.data) },
    tscn: sha(await readFile(path.join(g, `${id}.tscn`))),
    tres: sha(await readFile(path.join(g, `${id}_tileset.tres`))),
    bundle: sha(JSON.stringify(bundle)),
    atlasRows: rows,
    atlasTop: sha(assets.atlas.data),
    godotFiles: await files(g),
    pixiFiles: await files(p),
    pngFiles: await files(path.join(dir, `${id}-png`)),
  };
}
await writeFile(process.argv[2]!, `${JSON.stringify(out, null, 1)}\n`);
console.log(`wrote ${process.argv[2]} · ${ids.length} maps`);
