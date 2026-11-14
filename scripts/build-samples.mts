/** Regenerate samples/maps/*.json from the demo builders (src/lib/demoMaps.ts). */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { DEMO_MAPS } from "../src/lib/demoMaps.js";
import { validateMap } from "../src/shared/map.js";
import { serializeMap } from "../src/lib/workspace.js";

for (const [id, build] of Object.entries(DEMO_MAPS)) {
  const res = validateMap(build());
  if (!res.doc) throw new Error(`${id}: ${res.errors.map((e) => e.message).join("; ")}`);
  const f = path.join("samples", "maps", `${id}.json`);
  await writeFile(f, serializeMap(res.doc));
  console.log(`wrote ${f} (${res.warnings.length} warnings)`);
}
