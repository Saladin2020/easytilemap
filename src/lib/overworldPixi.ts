/**
 * PixiJS v8 overworld game for maps with `overworld` data — the same game as the Godot export:
 * runtime/pixi/easytilemap-overworld.js (tile-step player, town gates → Easy Scene Pixi side views
 * under towns/<scene>/, exits back out, station train menu, tunnels, day/night) reading
 * overworld/overworld.json. Only written for overworld maps; plain maps export exactly as before.
 */
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { walkColumns } from "../shared/characters.js";
import { collisionGrid } from "../shared/map.js";
import { trainSheet } from "../shared/overworldObjects.js";
import { travelGraph } from "../shared/overworld.js";
import type { MapDoc } from "../shared/types.js";
import { pickDemo, tunnelCells, writeNightAssets, type FileSink, type OverworldGodotOptions } from "./overworldGodot.js";
import { encodePng } from "./png.js";
import { loadSheet, RUNTIME_DIR, type LoadedAssets } from "./workspace.js";

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    if (name.startsWith(".")) continue;
    const f = path.join(dir, name);
    if ((await stat(f)).isDirectory()) out.push(...(await walk(f, base)));
    else out.push(path.relative(base, f));
  }
  return out;
}

/** `<scene>-pixi/` or `<scene>/` holding `<scene>.pixi.json` (an Easy Scene `export --preset pixi`). */
export function findScenePixi(dir: string, scene: string): string | null {
  for (const cand of [path.join(dir, `${scene}-pixi`), path.join(dir, scene)]) {
    if (existsSync(path.join(cand, `${scene}.pixi.json`)) && existsSync(path.join(cand, "load-scene.js"))) return cand;
  }
  return null;
}

export interface PixiCharacter {
  name: string;
  image: string;
  layout: { frameSize: number; directions: string[]; frames: string[] };
  groundRow: number;
}

export async function writeOverworldPixi(doc: MapDoc, sink: FileSink, assets: LoadedAssets, characters: PixiCharacter[], opts: OverworldGodotOptions): Promise<{ warnings: string[]; player: string }> {
  const warnings: string[] = [];
  const graph = travelGraph(doc)!;
  const pick = characters.find((c) => c.name === "player") ?? characters.find((_, i) => !doc.characters[i]?.patrol) ?? null;
  const player = pick
    ? {
        name: pick.name,
        image: pick.image,
        frameSize: pick.layout.frameSize,
        rows: Object.fromEntries(pick.layout.directions.map((d, i) => [d, i])),
        idle: Math.max(0, pick.layout.frames.indexOf("idle")),
        walk: walkColumns(pick.layout as never),
        groundRow: pick.groundRow,
      }
    : null;
  if (!player) warnings.push("overworld: no player character (add one named \"player\" with an Easy Sprite top-down sheet) — a marker is used");
  let sidePlayer: Record<string, unknown> | null = null;
  if (opts.townPlayer) {
    const file = path.resolve(opts.townPlayer);
    if (!existsSync(file)) warnings.push(`overworld: town player sheet not found: ${opts.townPlayer}`);
    else {
      const s = await loadSheet(file);
      await sink.copy("characters/side_player.png", file);
      sidePlayer = {
        image: "characters/side_player.png",
        frameSize: s.layout.frameSize,
        rows: Object.fromEntries(s.layout.directions.map((d, i) => [d, i])),
        idle: Math.max(0, s.layout.frames.indexOf("idle")),
        walk: walkColumns(s.layout),
        groundRow: s.groundRow ?? 47,
      };
    }
  } else warnings.push("overworld: no --town-player side-view sheet — towns use a marker for the player");
  const townScenes: Record<string, { json: string; loader: string; night?: string } | null> = {};
  for (const t of doc.overworld!.towns) {
    if (t.scene in townScenes) continue;
    const src = opts.townScenes ? findScenePixi(path.resolve(opts.townScenes), t.scene) : null;
    if (src) {
      for (const rel of await walk(src)) await sink.copy(`towns/${t.scene}/${rel.split(path.sep).join("/")}`, path.join(src, rel));
      townScenes[t.scene] = {
        json: `towns/${t.scene}/${t.scene}.pixi.json`,
        loader: `towns/${t.scene}/load-scene.js`,
        // Easy Scene `export --night` writes <scene>_night.pixi.json next to the day scene
        ...(existsSync(path.join(src, `${t.scene}_night.pixi.json`)) ? { night: `towns/${t.scene}/${t.scene}_night.pixi.json` } : {}),
      };
    } else {
      townScenes[t.scene] = null;
      warnings.push(`overworld: Easy Scene Pixi export for "${t.scene}" not found${opts.townScenes ? ` in ${opts.townScenes}` : " (pass --town-scenes)"} — a placeholder street is used`);
    }
  }
  const night = await writeNightAssets(doc, assets, sink, "", Boolean(opts.night));
  const data = {
    ...graph,
    format: "easytilemap.overworld-pixi/1",
    tileSize: doc.tileSize,
    width: doc.width,
    height: doc.height,
    viewport: doc.viewport,
    blocked: collisionGrid(doc).map((r) => r.map((b) => (b ? "#" : ".")).join("")),
    player,
    sidePlayer,
    townScenes,
    train: "overworld/train.png",
    tunnels: tunnelCells(doc),
    night,
    demo: pickDemo(doc, opts.demoTown),
  };
  await sink.text("overworld/overworld.json", `${JSON.stringify(data, null, 1)}\n`);
  await sink.bin("overworld/train.png", encodePng(trainSheet()));
  await sink.copy("easytilemap-overworld.js", path.join(RUNTIME_DIR, "pixi", "easytilemap-overworld.js"));
  await sink.copy("fonts/Kanit-Regular.ttf", path.join(RUNTIME_DIR, "fonts", "Kanit-Regular.ttf"));
  await sink.copy("fonts/OFL.txt", path.join(RUNTIME_DIR, "fonts", "OFL.txt"));
  return { warnings, player: player?.name ?? "" };
}

export function overworldHtml(doc: MapDoc): string {
  const vw = doc.viewport.width;
  const vh = doc.viewport.height;
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${doc.name.replace(/</g, "&lt;")} — Easy Tilemap overworld (PixiJS v8)</title>
  <link rel="icon" href="data:,">
  <style>
    @font-face { font-family: Kanit; src: url("./fonts/Kanit-Regular.ttf"); }
    html, body { margin: 0; min-height: 100vh; background: #140e0a; color: #f7ebd3; font-family: Kanit, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    #game { position: relative; width: min(1440px, 96vw); aspect-ratio: ${vw} / ${vh}; }
    canvas { image-rendering: pixelated; width: 100%; height: 100%; display: block; }
    #hud { position: absolute; inset: 0; pointer-events: none; font-size: clamp(11px, 1.6vw, 22px); text-shadow: 0 2px 0 #000, 0 0 4px #000; }
    .ow-top { position: absolute; left: 1.2%; top: 1.5%; white-space: pre-line; }
    .ow-hint { position: absolute; left: 0; right: 0; bottom: 3%; text-align: center; }
    p { opacity: .7; font-size: 13px; margin: 10px; }
  </style>
</head>
<body>
  <div id="game"><div id="hud"><div class="ow-top"></div><div class="ow-hint"></div></div></div>
  <p>Arrow keys / WASD: walk · town gate: enter · Esc / street end: leave · station + Enter: train · N: day / night</p>
  <script>
    window.__pixiReady = new Promise((ok, fail) => {
      const tryLoad = (src, next) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = next; document.head.appendChild(s); };
      tryLoad("./pixi.min.js", () => tryLoad("https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js", () => fail(new Error("PixiJS not found"))));
    });
  </script>
  <script type="module">
    import { startOverworld } from "./easytilemap-overworld.js";
    await window.__pixiReady;
    await document.fonts.load("16px Kanit").catch(() => {});
    const app = new PIXI.Application();
    await app.init({ width: ${vw}, height: ${vh}, resolution: 3, antialias: false, background: "#2a4a6a", roundPixels: true });
    app.canvas.style.width = "";
    app.canvas.style.height = "";
    document.getElementById("game").prepend(app.canvas);
    const game = await startOverworld(PIXI, app, { tilemap: "./${doc.id}.tilemap.json", data: "./overworld/overworld.json", hud: document.getElementById("hud") });
    window.__ow = game;
    window.__tm = { map: game.map, state: () => game.state() };
    window.__ready = true;
  </script>
</body>
</html>
`;
}
