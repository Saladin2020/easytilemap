#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Command } from "commander";
import open from "open";
import { createApp, defaultWebRoot } from "./server/app.js";
import { resolveToken } from "./shared/requestGuard.js";
import { parseCharacterArg } from "./shared/characters.js";
import { applyOps, asciiMap, createMap, mapStats, validateMap, type MapOp } from "./shared/map.js";
import { OBJECT_KINDS } from "./shared/objects.js";
import { renderMap } from "./shared/render.js";
import { checkSceneLinks, routeComponents } from "./shared/overworld.js";
import { generateOverworld } from "./shared/overworldGen.js";
import { sceneIdsIn } from "./lib/sceneLinks.js";
import { readdirSync } from "node:fs";
import { DECOR_CODES, DECOR_LABELS, FACINGS, LAYER_NAMES, TERRAINS, TERRAIN_CODE, TERRAIN_LABELS, type Diagnostic, type Facing, type LayerName, type MapDoc, type Terrain, type ValidateResult } from "./shared/types.js";
import { EXPORT_PRESETS, exportMap, type ExportPreset } from "./lib/export.js";
import { encodePng } from "./lib/png.js";
import {
  dirs,
  initWorkspace,
  listMaps,
  loadAssets,
  mapPath,
  readMapFile,
  resolveWorkspace,
  saveMap,
  serializeMap,
  workspaceSummary,
  writeSampleTileset,
} from "./lib/workspace.js";

const program = new Command();

function workspaceOf(cli?: string): string {
  const v = cli?.trim() || process.env.EASYTILEMAP_HOME?.trim() || process.env.EASYTILEMAP_WORKSPACE?.trim() || process.cwd();
  return resolveWorkspace(v);
}

/** A map argument is either a path to a .json file or a map id in the workspace. */
function mapFile(arg: string, root: string): string {
  if (arg.endsWith(".json") || arg.includes("/") || arg.includes("\\")) {
    const abs = path.resolve(arg);
    if (!existsSync(abs)) throw new Error(`No such file ${arg}`);
    return abs;
  }
  const f = mapPath(root, arg);
  if (!existsSync(f)) throw new Error(`Map "${arg}" not found in ${dirs(root).maps} (try: easytilemap list)`);
  return f;
}

async function loadDoc(arg: string, root: string): Promise<{ file: string; doc: MapDoc; res: ValidateResult }> {
  const file = mapFile(arg, root);
  const res = await readMapFile(file);
  if (!res.doc) {
    printDiagnostics(file, res);
    process.exit(1);
  }
  return { file, doc: res.doc, res };
}

function printDiagnostics(file: string, res: ValidateResult) {
  const show = (d: Diagnostic) => console.error(`${file}${d.path ? `:${d.path}` : ""}${d.x !== undefined ? ` (${d.x},${d.y})` : ""} ${d.severity}: ${d.message}`);
  res.errors.forEach(show);
  res.warnings.forEach(show);
}

const fail = (e: unknown) => {
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
};
const nums = (s: string, n: number, label: string) => {
  const v = s.split(",").map((x) => Number(x.trim()));
  if (v.length !== n || v.some((x) => !Number.isFinite(x))) throw new Error(`${label} needs ${n} comma-separated numbers (got "${s}")`);
  return v;
};

async function saveDoc(file: string, doc: MapDoc) {
  const res = validateMap(doc, { id: doc.id });
  if (!res.doc) {
    printDiagnostics(file, res);
    process.exit(1);
  }
  await writeFile(file, serializeMap(res.doc));
  res.warnings.forEach((w) => console.error(`warning: ${w.message}`));
  return res.doc;
}

program.name("easytilemap").description("Paint top-down 16px tile maps (autotile terrain, objects, Easy Sprite characters); export to Godot / PixiJS").version("0.1.0");

program
  .command("init")
  .description("Create maps/ tilesets/ characters/ exports/ with the Thai village demo")
  .option("--force", "Overwrite samples, tileset PNGs and config")
  .option("--workspace <path>", "Workspace directory")
  .action(async (o: { force?: boolean; workspace?: string }) => {
    const root = await initWorkspace(workspaceOf(o.workspace), { force: o.force });
    console.log(`Initialized Easy Tilemap workspace at ${root}`);
    console.log("  maps/        easytilemap/1 JSON (thai_village_topdown demo)");
    console.log("  tilesets/    thai_village.png atlas (blob-47 terrains) + objects/*.png — repaint freely");
    console.log("  characters/  Easy Sprite top-down sheets (Thai town cast)");
    console.log("  exports/     PNG / Godot / PixiJS exports");
  });

program
  .command("info")
  .description("Workspace summary")
  .option("--workspace <path>")
  .option("--json")
  .action(async (o: { workspace?: string; json?: boolean }) => {
    const s = await workspaceSummary(workspaceOf(o.workspace));
    if (o.json) return console.log(JSON.stringify(s, null, 2));
    console.log(`Easy Tilemap workspace ${s.root}`);
    console.log(`  tileset ${s.config.tileset} · ${s.config.tileSize}px · viewport ${s.config.viewport.width}x${s.config.viewport.height}`);
    console.log(`  maps: ${s.maps.map((m) => m.id).join(", ") || "(none)"}`);
    console.log(`  characters: ${s.characters.join(", ") || "(none)"}`);
    console.log(`  terrains: ${TERRAINS.map((t) => `${TERRAIN_CODE[t]}=${t}`).join(" ")} · decor: ${DECOR_CODES.join(" ")} · objects: ${OBJECT_KINDS.length}`);
  });

program
  .command("list")
  .description("List maps with size, counts and validation status")
  .option("--workspace <path>")
  .option("--json")
  .action(async (o: { workspace?: string; json?: boolean }) => {
    const list = await listMaps(workspaceOf(o.workspace));
    if (o.json) return console.log(JSON.stringify(list, null, 2));
    for (const m of list) console.log(`${m.id.padEnd(24)} ${m.width}×${m.height} · ${m.objects} objects · ${m.characters} characters · ${m.spawns} spawns · ${m.errors ? `${m.errors} errors` : "ok"}${m.warnings ? ` · ${m.warnings} warnings` : ""}  ${m.name}`);
    if (!list.length) console.log("(no maps — run easytilemap init)");
  });

program
  .command("catalog")
  .description("Terrain / decor codes and object kinds")
  .option("--json")
  .action((o: { json?: boolean }) => {
    if (o.json) return console.log(JSON.stringify({ terrains: TERRAIN_CODE, decor: DECOR_LABELS, objects: OBJECT_KINDS }, null, 2));
    console.log("terrains (ground layer):");
    for (const t of TERRAINS) console.log(`  ${TERRAIN_CODE[t]}  ${t.padEnd(7)} ${TERRAIN_LABELS[t].th}`);
    console.log("decor:");
    for (const c of DECOR_CODES) console.log(`  ${c}  ${DECOR_LABELS[c].en.padEnd(11)} ${DECOR_LABELS[c].th}`);
    console.log("collision: # blocked · o forced open · . auto (water + solid objects block)");
    console.log("objects:");
    for (const k of OBJECT_KINDS) console.log(`  ${k.kind.padEnd(14)} ${k.w}×${k.h} tiles ${k.category.padEnd(8)} ${k.nameTh} · ${k.name}`);
  });

program
  .command("new")
  .description("Create a blank map")
  .argument("<id>")
  .option("--name <name>")
  .option("--width <n>", "Tiles", "40")
  .option("--height <n>", "Tiles", "28")
  .option("--fill <terrain>", TERRAINS.join(" | "), "grass")
  .option("--force", "Overwrite an existing map")
  .option("--workspace <path>")
  .action(async (id: string, o: { name?: string; width: string; height: string; fill: string; force?: boolean; workspace?: string }) => {
    try {
      const root = workspaceOf(o.workspace);
      if (!(TERRAINS as readonly string[]).includes(o.fill)) throw new Error(`--fill must be one of ${TERRAINS.join(", ")}`);
      if (existsSync(mapPath(root, id)) && !o.force) throw new Error(`Map "${id}" exists (use --force)`);
      const res = await saveMap(root, createMap({ id, name: o.name, width: Number(o.width), height: Number(o.height), fill: o.fill as Terrain }));
      console.log(`created ${res.file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("check")
  .description("Validate a map (id or path). Exit code 1 on errors")
  .argument("<map>")
  .option("--workspace <path>")
  .option("--json")
  .option("--ascii", "Print an ASCII overview")
  .option("--strict", "Treat warnings as errors")
  .option("--scenes <dir>", "Overworld: check town scene links against an Easy Scene workspace (scenes/*.json) or a folder of scene exports")
  .action(async (arg: string, o: { workspace?: string; json?: boolean; ascii?: boolean; strict?: boolean; scenes?: string }) => {
    try {
      const file = mapFile(arg, workspaceOf(o.workspace));
      const res = await readMapFile(file);
      if (o.scenes && res.doc?.overworld) {
        const ids = sceneIdsIn(o.scenes);
        for (const d of checkSceneLinks(res.doc, ids)) res.errors.push(d);
        if (!res.errors.length && !o.json) console.log(`scene links ok · ${res.doc.overworld.towns.length} towns → ${ids.size} scenes in ${o.scenes}`);
      }
      if (o.json) console.log(JSON.stringify({ file, errors: res.errors, warnings: res.warnings, stats: res.doc ? mapStats(res.doc) : null }, null, 2));
      else {
        printDiagnostics(path.relative(process.cwd(), file) || file, res);
        if (res.doc) {
          const s = mapStats(res.doc);
          console.log(`ok  ${s.size} tiles · ${s.objects} objects · ${s.characters} characters · ${s.spawns} spawns · ${s.blocked} blocked · ${res.warnings.length} warnings`);
          if (o.ascii) console.log(asciiMap(res.doc));
        }
      }
      if (res.errors.length || (o.strict && res.warnings.length)) process.exit(1);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("generate")
  .description("Generate a map. overworld: seeded world map with town clusters, roads and a railway")
  .argument("<kind>", "overworld")
  .option("--seed <n>", "Any integer; the same seed gives the same map", "1")
  .option("--id <id>", "Map id (default overworld_<seed>)")
  .option("--name <name>")
  .option("--width <n>", "Tiles", "96")
  .option("--height <n>", "Tiles", "64")
  .option("--clusters <n>", "Town clusters (regions) 2–8", "4")
  .option("--player <sheet>", "Easy Sprite top-down sheet for the player (default characters/town_kopiah_boy.png when present)")
  .option("--force", "Overwrite an existing map")
  .option("--workspace <path>")
  .option("--json", "Print towns / routes as JSON")
  .action(async (kind: string, o: { seed: string; id?: string; name?: string; width: string; height: string; clusters: string; player?: string; force?: boolean; workspace?: string; json?: boolean }) => {
    try {
      if (kind !== "overworld") throw new Error(`Unknown generator "${kind}" (overworld)`);
      const root = workspaceOf(o.workspace);
      const seed = Number(o.seed);
      if (!Number.isFinite(seed)) throw new Error("--seed must be a number");
      const id = o.id ?? `overworld_${Math.round(seed) >>> 0}`;
      if (existsSync(mapPath(root, id)) && !o.force) throw new Error(`Map "${id}" exists (use --force)`);
      const defaultPlayer = "characters/town_kopiah_boy.png";
      const player = o.player ?? (existsSync(path.join(root, defaultPlayer)) ? defaultPlayer : undefined);
      const doc = generateOverworld({ seed, id, name: o.name, width: Number(o.width), height: Number(o.height), clusters: Number(o.clusters), player });
      const res = await saveMap(root, doc, { force: true });
      if (!res.saved) {
        printDiagnostics(id, res);
        process.exit(1);
      }
      const ow = doc.overworld!;
      if (o.json) return console.log(JSON.stringify({ file: res.file, overworld: { ...ow, routes: ow.routes.map(({ path: p, ...r }) => ({ ...r, length: p?.length ?? 0 })) } }, null, 2));
      console.log(`generated ${res.file} · ${doc.width}×${doc.height} · seed ${seed}`);
      printTowns(doc);
      res.warnings.forEach((w) => console.error(`warning: ${w.message}`));
    } catch (e) {
      fail(e);
    }
  });

function printTowns(doc: MapDoc) {
  const ow = doc.overworld;
  if (!ow) return console.log("(no overworld data)");
  for (const r of ow.regions) {
    console.log(`  region ${r.id} · ${r.name.th} · ${r.name.en}${r.name.ms ? ` · ${r.name.ms}` : ""} (${r.culture ?? "?"})`);
    for (const t of ow.towns.filter((x) => x.region === r.id)) {
      console.log(`    ${t.id.padEnd(22)} ${t.kind.padEnd(14)} entrance ${t.entrance.join(",").padEnd(7)} scene ${t.scene}${t.station ? ` · station ${t.station.join(",")}` : ""}  ${t.name.th} · ${t.name.en}`);
    }
  }
  const rail = ow.routes.filter((r) => r.kind === "rail");
  const road = ow.routes.filter((r) => r.kind === "road");
  console.log(`  routes: ${road.length} road · ${rail.length} rail · start ${ow.start ?? ow.towns[0]?.id ?? "-"} · ${routeComponents(ow).length} connected group(s)`);
  for (const r of rail) console.log(`    rail ${r.from} → ${r.to} (${r.path?.length ?? "?"} tiles)`);
}

program
  .command("towns")
  .description("Overworld: list regions, towns (entrance, scene link, station) and routes")
  .argument("<map>")
  .option("--workspace <path>")
  .option("--json")
  .action(async (arg: string, o: { workspace?: string; json?: boolean }) => {
    try {
      const { doc } = await loadDoc(arg, workspaceOf(o.workspace));
      if (o.json) return console.log(JSON.stringify(doc.overworld ?? null, null, 2));
      printTowns(doc);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("paint")
  .description("Paint a layer: --rect x,y,w,h | --line x1,y1,x2,y2 | --cell x,y (repeatable)")
  .argument("<map>")
  .requiredOption("--code <code>", "Terrain name/code for ground (water, w…), decor code/name, collision # | o | erase")
  .option("--layer <layer>", LAYER_NAMES.join(" | "), "ground")
  .option("--rect <x,y,w,h>")
  .option("--line <x1,y1,x2,y2>")
  .option("--width <n>", "Line width in tiles", "1")
  .option("--cell <x,y>", "Single cell (repeatable)", (v: string, prev: string[] = []) => [...prev, v])
  .option("--workspace <path>")
  .action(async (arg: string, o: { code: string; layer: string; rect?: string; line?: string; width: string; cell?: string[]; workspace?: string }) => {
    try {
      const { file, doc } = await loadDoc(arg, workspaceOf(o.workspace));
      if (!(LAYER_NAMES as readonly string[]).includes(o.layer)) throw new Error(`--layer must be ${LAYER_NAMES.join(" | ")}`);
      const layer = o.layer as LayerName;
      const ops: MapOp[] = [];
      if (o.rect) {
        const [x, y, w, h] = nums(o.rect, 4, "--rect");
        ops.push({ op: "fill", layer, code: o.code, x: x!, y: y!, w: w!, h: h! });
      }
      if (o.line) {
        const [x1, y1, x2, y2] = nums(o.line, 4, "--line");
        ops.push({ op: "line", layer, code: o.code, from: [x1!, y1!], to: [x2!, y2!], width: Number(o.width) });
      }
      if (o.cell?.length) ops.push({ op: "paint", layer, code: o.code, cells: o.cell.map((c) => nums(c, 2, "--cell") as [number, number]) });
      if (!ops.length) throw new Error("Give --rect, --line or --cell");
      await saveDoc(file, applyOps(doc, ops));
      console.log(`painted ${layer} "${o.code}" → ${file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("place")
  .description("Place an object (see: easytilemap catalog)")
  .argument("<map>")
  .requiredOption("--object <kind>")
  .requiredOption("--at <x,y>", "Top-left tile of the object image")
  .option("--name <name>")
  .option("--flip", "Mirror horizontally")
  .option("--workspace <path>")
  .action(async (arg: string, o: { object: string; at: string; name?: string; flip?: boolean; workspace?: string }) => {
    try {
      const { file, doc } = await loadDoc(arg, workspaceOf(o.workspace));
      const [x, y] = nums(o.at, 2, "--at");
      await saveDoc(file, applyOps(doc, [{ op: "place", kind: o.object, x: x!, y: y!, name: o.name, flipX: o.flip }]));
      console.log(`placed ${o.object} at ${x},${y} → ${file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("spawn")
  .description("Add or move a spawn point")
  .argument("<map>")
  .requiredOption("--name <name>")
  .requiredOption("--at <x,y>")
  .option("--facing <dir>", FACINGS.join(" | "))
  .option("--remove", "Remove the spawn")
  .option("--workspace <path>")
  .action(async (arg: string, o: { name: string; at: string; facing?: string; remove?: boolean; workspace?: string }) => {
    try {
      const { file, doc } = await loadDoc(arg, workspaceOf(o.workspace));
      const [x, y] = nums(o.at, 2, "--at");
      const op: MapOp = o.remove ? { op: "remove_spawn", name: o.name } : { op: "spawn", name: o.name, x: x!, y: y!, facing: o.facing as Facing | undefined };
      await saveDoc(file, applyOps(doc, [op]));
      console.log(`${o.remove ? "removed" : "spawn"} ${o.name}${o.remove ? "" : ` at ${x},${y}`} → ${file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("character")
  .description("Add an Easy Sprite top-down character: --sheet path --at x,y [--facing --anim --name --patrol x,y;x,y]")
  .argument("<map>")
  .requiredOption("--sheet <png>", "Easy Sprite native sheet (workspace-relative, e.g. characters/town_kid.png)")
  .requiredOption("--at <x,y>", "Feet tile (fractions allowed)")
  .option("--name <name>")
  .option("--facing <dir>", FACINGS.join(" | "))
  .option("--anim <anim>", "idle | walk")
  .option("--patrol <points>", "Waypoints x,y;x,y;…")
  .option("--speed <px>", "Patrol speed px/s", "24")
  .option("--workspace <path>")
  .action(async (arg: string, o: { sheet: string; at: string; name?: string; facing?: string; anim?: string; patrol?: string; speed: string; workspace?: string }) => {
    try {
      const { file, doc } = await loadDoc(arg, workspaceOf(o.workspace));
      const [x, y] = nums(o.at, 2, "--at");
      const patrol = o.patrol ? { path: o.patrol.split(";").map((p) => nums(p, 2, "--patrol") as [number, number]), speed: Number(o.speed) } : undefined;
      await saveDoc(file, applyOps(doc, [{ op: "character", sheet: o.sheet, x: x!, y: y!, name: o.name, facing: o.facing as Facing | undefined, anim: o.anim as "idle" | "walk" | undefined, patrol }]));
      console.log(`character ${o.name ?? o.sheet} at ${x},${y} → ${file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("edit")
  .description("Apply a JSON array of edit ops (same as the MCP edit_map tool) from --ops or a file")
  .argument("<map>")
  .option("--ops <json>")
  .option("--file <ops.json>")
  .option("--workspace <path>")
  .action(async (arg: string, o: { ops?: string; file?: string; workspace?: string }) => {
    try {
      const { file, doc } = await loadDoc(arg, workspaceOf(o.workspace));
      const ops = JSON.parse(o.ops ?? (o.file ? await readFile(o.file, "utf8") : "[]")) as MapOp[];
      await saveDoc(file, applyOps(doc, ops));
      console.log(`applied ${ops.length} ops → ${file}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("render")
  .description("Render a map to PNG")
  .argument("<map>")
  .requiredOption("--out <png>")
  .option("--scale <n>", "Pixel scale", "2")
  .option("--grid", "Tile grid")
  .option("--collision", "Blocked-cell overlay")
  .option("--spawns", "Spawn markers")
  .option("--no-characters", "Hide characters")
  .option("--character <spec>", "Extra Easy Sprite character path[:x[:y[:facing[:anim]]]] (repeatable)", (v: string, prev: string[] = []) => [...prev, v])
  .option("--crop <x,y,w,h>", "Crop in map pixels (e.g. a 480×270 camera view)")
  .option("--night", "Night look: moonlit grade, lit windows / lamps, glow around towns")
  .option("--workspace <path>")
  .action(async (arg: string, o: { out: string; scale: string; grid?: boolean; collision?: boolean; spawns?: boolean; characters: boolean; character?: string[]; crop?: string; night?: boolean; workspace?: string }) => {
    try {
      const root = workspaceOf(o.workspace);
      const { doc: loaded } = await loadDoc(arg, root);
      const doc = o.character?.length ? { ...loaded, characters: [...loaded.characters, ...o.character.map(parseCharacterArg)] } : loaded;
      const assets = await loadAssets(root, doc, { trusted: true });
      assets.warnings.forEach((w) => console.error(`warning: ${w}`));
      const crop = o.crop ? (([x, y, w, h]) => ({ x: x!, y: y!, w: w!, h: h! }))(nums(o.crop, 4, "--crop")) : undefined;
      const img = renderMap(doc, assets, { scale: Number(o.scale), grid: o.grid, collision: o.collision, spawns: o.spawns, characters: o.characters, crop, night: o.night });
      await mkdir(path.dirname(path.resolve(o.out)), { recursive: true });
      await writeFile(o.out, encodePng(img));
      console.log(`wrote ${o.out} · ${img.width}×${img.height}`);
    } catch (e) {
      fail(e);
    }
  });

program
  .command("export")
  .description("Export a map: png | godot | pixi | all")
  .argument("<id>")
  .option("--preset <preset>", EXPORT_PRESETS.join(" | "), "all")
  .option("--out <dir>", "Output folder (default exports/<id>-<preset>)")
  .option("--scale <n>", "PNG scale", "2")
  .option("--town-scenes <dir>", "Overworld: folder of Easy Scene exports (<scene>-godot/ for Godot, <scene>-pixi/ for Pixi) to copy in as the towns' side views")
  .option("--town-player <sheet>", "Overworld: Easy Sprite side-view sheet for the player inside towns")
  .option("--demo-town <id>", "Overworld (Godot): town used by overworld/capture.gd's walk-in demo")
  .option("--night", "Also write <id>_night.png (png preset; always on for overworld maps) and start overworld games at night")
  .option("--workspace <path>")
  .option("--json")
  .action(async (id: string, o: { preset: string; out?: string; scale: string; townScenes?: string; townPlayer?: string; demoTown?: string; night?: boolean; workspace?: string; json?: boolean }) => {
    try {
      const res = await exportMap(workspaceOf(o.workspace), {
        id,
        preset: o.preset as ExportPreset,
        out: o.out,
        scale: Number(o.scale),
        trustedPaths: true,
        overworld: { townScenes: o.townScenes, townPlayer: o.townPlayer, demoTown: o.demoTown, night: Boolean(o.night) },
      });
      if (o.json) return console.log(JSON.stringify(res, null, 2));
      for (const d of res.dirs) console.log(`exported ${d}`);
      console.log(`  ${res.files.length} files`);
      res.warnings.forEach((w) => console.log(`  warning: ${w}`));
    } catch (e) {
      fail(e);
    }
  });

program
  .command("tileset")
  .description("Write the sample atlas + object PNGs (to repaint them)")
  .option("--out <dir>", "Folder (default: workspace tilesets/)")
  .option("--force", "Overwrite")
  .option("--workspace <path>")
  .action(async (o: { out?: string; force?: boolean; workspace?: string }) => {
    const dir = o.out ? path.resolve(o.out) : dirs(workspaceOf(o.workspace)).tilesets;
    const files = await writeSampleTileset(dir, o.force);
    console.log(`${files.length} files → ${dir}${files.length ? "" : " (all present; --force to overwrite)"}`);
  });

program
  .command("serve")
  .description("Web editor + API (default http://127.0.0.1:8808)")
  .option("--port <port>", "Port", "8808")
  .option("--host <host>", "Interface (non-loopback requires the printed token)", "127.0.0.1")
  .option("--dev", "API only; use the Vite UI on :5176")
  .option("--open", "Open the browser")
  .option("--workspace <path>")
  .action(async (o: { port: string; host: string; dev?: boolean; open?: boolean; workspace?: string }) => {
    const root = workspaceOf(o.workspace);
    if (!existsSync(dirs(root).maps)) await initWorkspace(root);
    const token = resolveToken(o.host);
    const app = createApp({ workspaceRoot: root, webRoot: defaultWebRoot(), dev: o.dev, host: o.host, token });
    const port = Number(o.port);
    serve({ fetch: app.fetch, port, hostname: o.host }, () => {
      const url = `http://${o.host === "0.0.0.0" ? "127.0.0.1" : o.host}:${port}/`;
      console.log(`Easy Tilemap ${o.dev ? "API (dev)" : "editor"} → ${url}`);
      console.log(`Workspace ${root}`);
      if (token) console.log(`Token (needed off-loopback): ${url}?token=${token}`);
      if (o.dev) console.log("Run the UI with: npx vite --config web/vite.config.ts");
      if (o.open) void open(o.dev ? "http://127.0.0.1:5176" : url);
    });
  });

program.parseAsync(process.argv).catch(fail);
