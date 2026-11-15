#!/usr/bin/env node
/**
 * Easy Tilemap MCP server (stdio by default; optional Streamable HTTP).
 *
 *   npx tsx src/mcp/server.ts
 *   npx tsx src/mcp/server.ts --http --port 8809
 *
 * Env: EASYTILEMAP_WORKSPACE  absolute path to the workspace (default: cwd)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { z } from "zod";
import { checkRequest, resolveToken } from "../shared/requestGuard.js";
import { applyOps, asciiMap, createMap, mapStats, type MapOp } from "../shared/map.js";
import { OBJECT_KINDS } from "../shared/objects.js";
import { renderMap } from "../shared/render.js";
import { DECOR_LABELS, FACINGS, LAYER_NAMES, TERRAINS, TERRAIN_CODE } from "../shared/types.js";
import { EXPORT_PRESETS, exportMap } from "../lib/export.js";
import { encodePng } from "../lib/png.js";
import { sceneIdsIn } from "../lib/sceneLinks.js";
import { checkSceneLinks } from "../shared/overworld.js";
import { generateOverworld } from "../shared/overworldGen.js";
import { dirs, loadAssets, mapPath, readMap, resolveInside, resolveWorkspace, saveMap, listMaps, workspaceSummary } from "../lib/workspace.js";

export const MCP_TOOL_NAMES = ["workspace_info", "list_maps", "get_map", "write_map", "edit_map", "render_map", "export_map", "generate_overworld", "check_map"] as const;

const IdSchema = z.string().regex(/^[a-z0-9_-]+$/, "Use a-z, 0-9, _ or -");

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function err(message: string) {
  return { isError: true as const, content: [{ type: "text" as const, text: message }] };
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const FORMAT_CHEATSHEET = `easytilemap/1: { id, name, width, height (tiles, 16px), layers: { ground: string[] (one char per cell: ${TERRAINS.map((t) => `${TERRAIN_CODE[t]}=${t}`).join(" ")}),
decor: string[] (. or ${Object.entries(DECOR_LABELS).map(([k, v]) => `${k}=${v.en.toLowerCase()}`).join(" ")}), collision: string[] (# block, o force open, . auto: water + solid objects block) },
objects: [{ kind, x, y (top-left tile), name?, flipX? }], spawns: [{ name, x, y, facing? }],
characters: [{ sheet: "characters/town_kid.png", x, y (feet tile), name?, facing: ${FACINGS.join("|")}, anim: idle|walk, patrol?: { path: [[x,y],…], speed } }] }
Ground terrains autotile (blob-47) over grass automatically — just paint codes.`;

const Pair = z.tuple([z.number(), z.number()]);
const LayerSchema = z.enum(LAYER_NAMES);
const OpSchema = z.union([
  z.object({ op: z.literal("fill"), layer: LayerSchema, code: z.string(), x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) }),
  z.object({ op: z.literal("paint"), layer: LayerSchema, code: z.string(), cells: z.array(Pair) }),
  z.object({ op: z.literal("line"), layer: LayerSchema, code: z.string(), from: Pair, to: Pair, width: z.number().int().min(1).max(8).optional() }),
  z.object({ op: z.literal("path"), layer: LayerSchema, code: z.string(), points: z.array(Pair).min(2), width: z.number().int().min(1).max(8).optional() }),
  z.object({ op: z.literal("place"), kind: z.string(), x: z.number().int(), y: z.number().int(), name: z.string().optional(), flipX: z.boolean().optional() }),
  z.object({ op: z.literal("remove_object"), index: z.number().int().optional(), x: z.number().int().optional(), y: z.number().int().optional() }),
  z.object({ op: z.literal("spawn"), name: z.string(), x: z.number().int(), y: z.number().int(), facing: z.enum(FACINGS).optional() }),
  z.object({ op: z.literal("remove_spawn"), name: z.string() }),
  z.object({
    op: z.literal("character"),
    sheet: z.string(),
    x: z.number(),
    y: z.number(),
    name: z.string().optional(),
    facing: z.enum(FACINGS).optional(),
    anim: z.enum(["idle", "walk"]).optional(),
    patrol: z.object({ path: z.array(Pair).min(2), speed: z.number().min(0).optional() }).optional(),
  }),
  z.object({ op: z.literal("remove_character"), name: z.string().optional(), index: z.number().int().optional() }),
  z.object({ op: z.literal("resize"), width: z.number().int().min(1).max(256), height: z.number().int().min(1).max(256), fill: z.enum(TERRAINS).optional() }),
]);

function parseArgs(argv: string[]) {
  const out = { http: false, port: 8809, host: "127.0.0.1", workspace: process.env.EASYTILEMAP_WORKSPACE ?? process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--http") out.http = true;
    else if (a === "--port") out.port = Number(argv[++i] ?? out.port);
    else if (a === "--host") out.host = argv[++i] ?? out.host;
    else if (a === "--workspace") out.workspace = argv[++i] ?? out.workspace;
  }
  return out;
}

export function createEasyTilemapMcp(workspaceRoot: string): McpServer {
  const root = resolveWorkspace(workspaceRoot);
  const server = new McpServer({ name: "easytilemap", version: "0.1.0" });

  server.registerTool(
    "workspace_info",
    {
      title: "Workspace info",
      description: "Summarize the Easy Tilemap workspace (maps, character sheets, terrain/decor codes, object kinds, export presets) and the easytilemap/1 format. Call this first.",
      inputSchema: {},
    },
    async () => {
      const s = await workspaceSummary(root);
      return text({
        name: "easytilemap",
        root: s.root,
        config: s.config,
        maps: s.maps.map((m) => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, errors: m.errors })),
        characters: s.characters,
        terrains: TERRAIN_CODE,
        decor: DECOR_LABELS,
        objects: OBJECT_KINDS.map((k) => ({ kind: k.kind, name: k.name, th: k.nameTh, size: `${k.w}x${k.h}`, solid: k.solid, floor: Boolean(k.floor) })),
        exportPresets: EXPORT_PRESETS,
        format: FORMAT_CHEATSHEET,
      });
    },
  );

  server.registerTool(
    "list_maps",
    { title: "List maps", description: "List maps with size, object/character/spawn counts and validation status.", inputSchema: {} },
    async () => text({ maps: await listMaps(root) }),
  );

  server.registerTool(
    "get_map",
    {
      title: "Get map",
      description: "Read a map: validation errors/warnings, stats, an ASCII overview (O object, = bridge/boat, S spawn, @ character) and optionally the full JSON.",
      inputSchema: { id: IdSchema, includeJson: z.boolean().optional().describe("Default false") },
    },
    async ({ id, includeJson }) => {
      try {
        const r = await readMap(root, id);
        return text({ id, errors: r.errors, warnings: r.warnings, ...(r.doc ? { stats: mapStats(r.doc), ascii: asciiMap(r.doc), objects: r.doc.objects, spawns: r.doc.spawns, characters: r.doc.characters } : {}), ...(includeJson ? { json: r.doc ?? r.raw } : {}) });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "write_map",
    {
      title: "Write map",
      description: `Validate and save a whole map (maps/<id>.json), or create a blank one with width/height. Refuses to save with errors; dryRun only validates.\n${FORMAT_CHEATSHEET}`,
      inputSchema: {
        id: IdSchema,
        map: z.record(z.string(), z.unknown()).optional().describe("Full easytilemap/1 document"),
        width: z.number().int().min(1).max(256).optional().describe("Blank map width (when no map is given)"),
        height: z.number().int().min(1).max(256).optional(),
        name: z.string().optional(),
        dryRun: z.boolean().optional(),
      },
    },
    async ({ id, map, width, height, name, dryRun }) => {
      try {
        const input = map ? { ...map, id } : createMap({ id, name, width, height });
        const res = await saveMap(root, input, { id, dryRun });
        return text({ saved: res.saved, file: res.file, errors: res.errors, warnings: res.warnings, ...(res.doc ? { stats: mapStats(res.doc) } : {}) });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "edit_map",
    {
      title: "Edit map",
      description:
        "Apply edit ops in order and save: fill (rect), paint (cells), line/path (with width) on a layer (ground codes or terrain names; decor codes or names; collision # / o / erase), place / remove_object, spawn / remove_spawn, character / remove_character (Easy Sprite top-down sheet), resize. Returns the new ASCII overview.",
      inputSchema: { id: IdSchema, ops: z.array(OpSchema).min(1), dryRun: z.boolean().optional() },
    },
    async ({ id, ops, dryRun }) => {
      try {
        const r = await readMap(root, id);
        if (!r.doc) return err(`Map has errors:\n${r.errors.map((e) => e.message).join("\n")}`);
        const next = applyOps(r.doc, ops as MapOp[]);
        const res = await saveMap(root, next, { id, dryRun });
        return text({ saved: res.saved, errors: res.errors, warnings: res.warnings, ...(res.doc ? { stats: mapStats(res.doc), ascii: asciiMap(res.doc) } : {}) });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "render_map",
    {
      title: "Render map",
      description: "Render a PNG of a map (optionally a camera crop and overlays), saved under exports/previews/, and return it as an image.",
      inputSchema: {
        id: IdSchema,
        scale: z.number().int().min(1).max(4).optional().describe("Default 1"),
        collision: z.boolean().optional(),
        grid: z.boolean().optional(),
        spawns: z.boolean().optional(),
        crop: z.object({ x: z.number().int(), y: z.number().int(), w: z.number().int().min(1), h: z.number().int().min(1) }).optional().describe("Map pixels"),
        night: z.boolean().optional().describe("Night render: moonlit grade, lit town and station windows"),
      },
    },
    async ({ id, scale, collision, grid, spawns, crop, night }) => {
      try {
        const r = await readMap(root, id);
        if (!r.doc) return err(`Map has errors:\n${r.errors.map((e) => e.message).join("\n")}`);
        const assets = await loadAssets(root, r.doc);
        const buf = encodePng(renderMap(r.doc, assets, { scale: scale ?? 1, collision, grid, spawns, crop, night }));
        const out = path.join(dirs(root).exports, "previews", `${id}.png`);
        await mkdir(path.dirname(out), { recursive: true });
        await writeFile(out, buf);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ file: out, warnings: assets.warnings }, null, 2) },
            { type: "image" as const, data: buf.toString("base64"), mimeType: "image/png" },
          ],
        };
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "export_map",
    {
      title: "Export map",
      description:
        "Export to png, godot (Godot 4.3+ project: TileMapLayer + terrain TileSet, AnimatedSprite2D characters, StaticBody2D collision, Marker2D spawns), pixi (PixiJS v8 bundle + loader + playable demo) or all. Overworld maps also get the playable game (town side views, trains, tunnels, day/night) in godot and pixi, and a _night.png in png.",
      inputSchema: {
        id: IdSchema,
        preset: z.enum(EXPORT_PRESETS).optional().describe("Default all"),
        out: z.string().optional().describe("Workspace-relative output folder"),
        townScenes: z.string().optional().describe("Overworld: workspace-relative folder of Easy Scene exports (<scene>-godot/, <scene>-pixi/) used as the towns' side views"),
        townPlayer: z.string().optional().describe("Overworld: workspace-relative Easy Sprite side-view sheet for the player inside towns"),
        night: z.boolean().optional().describe("Start overworld games at night; png preset also writes <id>_night.png"),
      },
    },
    async ({ id, preset, out, townScenes, townPlayer, night }) => {
      try {
        if (!existsSync(mapPath(root, id))) return err(`Map "${id}" not found`);
        const inside = (p?: string) => (p ? resolveInside(root, p) : undefined);
        const res = await exportMap(root, { id, preset, out, overworld: { townScenes: inside(townScenes), townPlayer: inside(townPlayer), night } });
        return text({ dirs: res.dirs, files: res.files.length, warnings: res.warnings });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "generate_overworld",
    {
      title: "Generate overworld",
      description:
        "Generate a seeded JRPG world map (maps/<id>.json): town clusters (regions) of Thai, Malay-kampung, Chinese-Thai and rural towns joined by roads and a railway with stations; the rail tunnels through mountains. Same seed → same map. Then run Easy Scene `towns --from-overworld` for the side-view streets.",
      inputSchema: {
        seed: z.number().int().describe("Any integer"),
        id: IdSchema.optional().describe("Default overworld_<seed>"),
        name: z.string().optional(),
        width: z.number().int().min(48).max(256).optional().describe("Tiles, default 96"),
        height: z.number().int().min(36).max(256).optional().describe("Tiles, default 64"),
        clusters: z.number().int().min(2).max(8).optional().describe("Town clusters, default 4"),
        player: z.string().optional().describe("Top-down player sheet (default characters/town_kopiah_boy.png when present)"),
        force: z.boolean().optional().describe("Overwrite an existing map"),
      },
    },
    async ({ seed, id, name, width, height, clusters, player, force }) => {
      try {
        const mapId = id ?? `overworld_${seed >>> 0}`;
        if (existsSync(mapPath(root, mapId)) && !force) return err(`Map "${mapId}" exists (pass force: true)`);
        const defaultPlayer = "characters/town_kopiah_boy.png";
        const doc = generateOverworld({ seed, id: mapId, name, width, height, clusters, player: player ?? (existsSync(path.join(root, defaultPlayer)) ? defaultPlayer : undefined) });
        const res = await saveMap(root, doc, { force: true });
        const ow = doc.overworld!;
        const tunnels = doc.layers.ground.join("").split("").filter((c) => c === "U").length;
        return text({
          saved: res.saved,
          file: res.file,
          errors: res.errors,
          warnings: res.warnings,
          size: `${doc.width}x${doc.height}`,
          regions: ow.regions.map((r) => ({ id: r.id, name: r.name })),
          towns: ow.towns.map((t) => ({ id: t.id, kind: t.kind, region: t.region, name: t.name, scene: t.scene, entrance: t.entrance, station: t.station ?? null })),
          routes: ow.routes.map(({ path: p, ...r }) => ({ ...r, length: p?.length ?? 0 })),
          tunnelTiles: tunnels,
        });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  server.registerTool(
    "check_map",
    {
      title: "Check map",
      description: "Validate a map (errors / warnings / stats). For overworld maps pass scenes (workspace-relative Easy Scene workspace, scenes folder or exports folder) to also check that every town links to an existing side-view scene.",
      inputSchema: { id: IdSchema, scenes: z.string().optional(), strict: z.boolean().optional().describe("Warnings count as errors") },
    },
    async ({ id, scenes, strict }) => {
      try {
        const r = await readMap(root, id);
        const errors = [...r.errors];
        let sceneLinks: { towns: number; scenes: number } | null = null;
        if (scenes && r.doc?.overworld) {
          const ids = sceneIdsIn(resolveInside(root, scenes));
          errors.push(...checkSceneLinks(r.doc, ids));
          sceneLinks = { towns: r.doc.overworld.towns.length, scenes: ids.size };
        }
        const ok = !errors.length && !(strict && r.warnings.length);
        return text({ id, ok, errors, warnings: r.warnings, sceneLinks, ...(r.doc ? { stats: mapStats(r.doc) } : {}) });
      } catch (e) {
        return err(msg(e));
      }
    },
  );

  return server;
}

async function startMcp(opts: ReturnType<typeof parseArgs>) {
  const workspace = resolveWorkspace(opts.workspace);
  if (opts.http) return startHttp(workspace, opts.host, opts.port);
  await createEasyTilemapMcp(workspace).connect(new StdioServerTransport());
}

async function startHttp(workspace: string, host: string, port: number) {
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
  const sessions = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();
  const token = resolveToken(host);
  if (token) console.error(`Non-loopback host: send "Authorization: Bearer <token>" — token printed once: ${token}`);
  const httpServer = createServer(async (req, res) => {
    const auth = req.headers.authorization;
    const denied = checkRequest(
      { bindHost: host, token },
      { method: req.method ?? "GET", host: req.headers.host, origin: req.headers.origin, token: auth?.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-easytilemap-token"] as string | undefined) },
    );
    if (denied) {
      res.writeHead(denied.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: denied.error }));
      return;
    }
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    if (url.pathname !== "/mcp") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name: "easytilemap", transport: "streamable-http", endpoint: `http://${host}:${port}/mcp`, workspace }));
      return;
    }
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (req.method === "POST") {
        let transport = sessionId ? sessions.get(sessionId) : undefined;
        if (!transport) {
          const mcp = createEasyTilemapMcp(workspace);
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id: string) => {
              sessions.set(id, transport!);
            },
          });
          transport.onclose = () => {
            const id = transport!.sessionId;
            if (id) sessions.delete(id);
          };
          await mcp.connect(transport);
        }
        await transport.handleRequest(req, res);
        return;
      }
      if (req.method === "GET" || req.method === "DELETE") {
        const transport = sessionId ? sessions.get(sessionId) : undefined;
        if (!transport) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid or missing mcp-session-id" }));
          return;
        }
        await transport.handleRequest(req, res);
        return;
      }
      res.writeHead(405).end();
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg(e) }));
      }
    }
  });
  httpServer.listen(port, host, () => {
    console.error(`Easy Tilemap MCP (HTTP) http://${host}:${port}/mcp`);
    console.error(`Workspace ${workspace}`);
  });
}

function entryIndex(): number {
  return process.argv.findIndex((arg) => /(?:^|[/\\])mcp[/\\]server\.(?:ts|js|mjs)$/i.test(arg));
}

if (entryIndex() >= 0) {
  await startMcp(parseArgs(process.argv.slice(entryIndex() + 1)));
}
