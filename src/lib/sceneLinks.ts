import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Scene ids in an Easy Scene workspace (scenes/*.json), a scenes folder, or a folder of exports (<id>-godot/, <id>-pixi/). */
export function sceneIdsIn(dir: string): Set<string> {
  const abs = path.resolve(dir);
  if (!existsSync(abs)) throw new Error(`No such folder ${dir}`);
  const ids = new Set<string>();
  const scan = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith(".json") && !e.name.endsWith(".scene.json")) ids.add(e.name.replace(/\.json$/, ""));
      if (e.isDirectory()) {
        const id = e.name.replace(/-(godot|pixi|png)$/, "");
        if (["tscn", "scene.json", "pixi.json"].some((x) => existsSync(path.join(d, e.name, `${id}.${x}`)))) ids.add(id);
      }
    }
  };
  scan(abs);
  if (existsSync(path.join(abs, "scenes"))) scan(path.join(abs, "scenes"));
  return ids;
}
