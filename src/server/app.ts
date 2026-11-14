import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { serveStatic } from "@hono/node-server/serve-static";
import { DEV_UI_ORIGINS, checkRequest } from "../shared/requestGuard.js";
import { validateMap } from "../shared/map.js";
import { OBJECT_BY_KIND } from "../shared/objects.js";
import { renderMap } from "../shared/render.js";
import { exportMap, type ExportPreset } from "../lib/export.js";
import { encodePng } from "../lib/png.js";
import { assertSafeId, dirs, loadAssets, loadAtlas, loadObjectImages, loadSheet, readMap, resolveInside, saveMap, listMaps, workspaceSummary } from "../lib/workspace.js";
import type { MapDoc } from "../shared/types.js";

export interface CreateAppOptions {
  workspaceRoot: string;
  webRoot?: string;
  dev?: boolean;
  host?: string;
  token?: string;
}

const TOKEN_COOKIE = "easytilemap_token";
const fail = (e: unknown) => (e instanceof Error ? e.message : String(e));
const png = (buf: Buffer) => new Uint8Array(buf);

function tokenPage(): string {
  return `<!doctype html><meta charset="utf-8"><title>Easy Tilemap</title>
<body style="font-family:system-ui;background:#1a1410;color:#f3e7d3;padding:2rem">
<h1>Easy Tilemap token required</h1>
<p>Paste the token printed in the terminal that started Easy Tilemap.</p>
<form method="get"><input name="token" autocomplete="off" style="width:22rem"> <button>Open</button></form>
</body>`;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();
  const { workspaceRoot: root, webRoot, dev, host = "127.0.0.1", token } = options;
  const guard = { bindHost: host, token, extraOrigins: dev ? DEV_UI_ORIGINS : [] };

  app.use("*", async (c, next) => {
    const queryToken = c.req.query("token");
    const provided = c.req.header("x-easytilemap-token") ?? queryToken ?? getCookie(c, TOKEN_COOKIE);
    const denied = checkRequest(guard, { method: c.req.method, host: c.req.header("host"), origin: c.req.header("origin"), token: provided });
    if (denied) {
      if (denied.status === 401 && c.req.method === "GET" && !c.req.path.startsWith("/api/")) return c.html(tokenPage(), 401);
      return c.json({ error: denied.error }, denied.status);
    }
    if (token && queryToken) setCookie(c, TOKEN_COOKIE, queryToken, { httpOnly: true, sameSite: "Strict", path: "/", maxAge: 60 * 60 * 24 * 365 });
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true, workspaceRoot: root }));
  app.get("/api/workspace", async (c) => c.json(await workspaceSummary(root)));
  app.get("/api/maps", async (c) => c.json({ maps: await listMaps(root) }));

  app.get("/api/maps/:id", async (c) => {
    try {
      const r = await readMap(root, c.req.param("id"));
      return c.json({ doc: r.doc, errors: r.errors, warnings: r.warnings });
    } catch (e) {
      return c.json({ error: fail(e) }, 404);
    }
  });

  app.post("/api/maps/:id", async (c) => {
    try {
      const body = (await c.req.json()) as { doc: MapDoc };
      const res = await saveMap(root, body.doc, { id: assertSafeId(c.req.param("id")) });
      return c.json({ ok: res.saved, file: res.file, doc: res.doc, errors: res.errors, warnings: res.warnings }, res.saved ? 200 : 400);
    } catch (e) {
      return c.json({ error: fail(e) }, 400);
    }
  });

  app.post("/api/validate", async (c) => {
    const body = (await c.req.json()) as { doc: unknown };
    const res = validateMap(body.doc);
    return c.json(res);
  });

  app.get("/api/tilesets/:file", async (c) => {
    try {
      const name = c.req.param("file").replace(/\.png$/, "");
      assertSafeId(name, "tileset id");
      return c.body(png(encodePng(await loadAtlas(root, name))), 200, { "Content-Type": "image/png", "Cache-Control": "no-cache" });
    } catch (e) {
      return c.json({ error: fail(e) }, 404);
    }
  });

  app.get("/api/objects/:file", async (c) => {
    try {
      const kind = c.req.param("file").replace(/\.png$/, "");
      if (!OBJECT_BY_KIND.has(kind)) throw new Error(`Unknown object ${kind}`);
      const imgs = await loadObjectImages(root);
      return c.body(png(encodePng(imgs.get(kind)!)), 200, { "Content-Type": "image/png", "Cache-Control": "no-cache" });
    } catch (e) {
      return c.json({ error: fail(e) }, 404);
    }
  });

  app.get("/api/character", async (c) => {
    try {
      const file = resolveInside(root, c.req.query("path") ?? "");
      if (!file.endsWith(".png") || !existsSync(file)) throw new Error("Sheet not found");
      return c.body(png(await readFile(file)), 200, { "Content-Type": "image/png" });
    } catch (e) {
      return c.json({ error: fail(e) }, 404);
    }
  });

  app.get("/api/character-meta", async (c) => {
    try {
      const file = resolveInside(root, c.req.query("path") ?? "");
      if (!file.endsWith(".png") || !existsSync(file)) throw new Error("Sheet not found");
      const s = await loadSheet(file);
      return c.json({ layout: s.layout, groundRow: s.groundRow, width: s.img.width, height: s.img.height });
    } catch (e) {
      return c.json({ error: fail(e) }, 404);
    }
  });

  app.post("/api/render", async (c) => {
    try {
      const body = (await c.req.json()) as { id?: string; doc?: unknown; scale?: number; collision?: boolean; grid?: boolean; spawns?: boolean };
      const doc = body.doc ? validateMap(body.doc).doc : (await readMap(root, assertSafeId(body.id))).doc;
      if (!doc) return c.json({ error: "Map has errors" }, 400);
      const assets = await loadAssets(root, doc);
      return c.body(png(encodePng(renderMap(doc, assets, { scale: body.scale ?? 2, collision: body.collision, grid: body.grid, spawns: body.spawns }))), 200, { "Content-Type": "image/png" });
    } catch (e) {
      return c.json({ error: fail(e) }, 400);
    }
  });

  app.post("/api/export", async (c) => {
    try {
      const body = (await c.req.json()) as { id: string; preset?: ExportPreset; out?: string };
      const res = await exportMap(root, { id: assertSafeId(body.id), preset: body.preset, out: body.out || undefined });
      return c.json({ ok: true, dirs: res.dirs, files: res.files.map((f) => path.relative(root, f)), warnings: res.warnings });
    } catch (e) {
      return c.json({ error: fail(e) }, 400);
    }
  });

  if (!dev && webRoot) {
    app.use("/*", serveStatic({ root: webRoot }));
    app.get("*", async (c) => {
      try {
        return c.html((await readFile(path.join(webRoot, "index.html"))).toString("utf8"));
      } catch {
        return c.text("Web UI not built yet. Run npm run build:web or start with --dev.", 503);
      }
    });
  } else if (dev) {
    app.get("/", (c) =>
      c.html(`<!doctype html><meta charset="utf-8"><title>Easy Tilemap (dev)</title>
<body style="font-family:system-ui;background:#1a1410;color:#f3e7d3;padding:2rem">
<h1>Easy Tilemap API is running</h1><p>Workspace: <code>${root}</code></p>
<p>Open the Vite UI at <a href="http://127.0.0.1:5176" style="color:#f0c36a">http://127.0.0.1:5176</a></p></body>`),
    );
  }
  return app;
}

export function defaultWebRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../web/dist"), path.resolve(here, "../../web/dist")];
  return candidates.find((p) => existsSync(path.join(p, "index.html"))) ?? candidates[1]!;
}

export { dirs };
