import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { access } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MCP_TOOL_NAMES, createEasyTilemapMcp } from "../src/mcp/server.js";
import { createApp } from "../src/server/app.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
let client: Client;
beforeAll(async () => {
  ({ root, cleanup } = await tempWorkspace());
  const server = createEasyTilemapMcp(root);
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  client = new Client({ name: "test", version: "0.0.1" });
  await client.connect(b);
});
afterAll(async () => {
  await client.close();
  await cleanup();
});

const body = (res: unknown) => JSON.parse(((res as { content: Array<{ text: string }> }).content[0]!).text);

describe("MCP server", () => {
  it("lists the seven tools", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([...MCP_TOOL_NAMES].sort());
    expect(tools).toHaveLength(7);
  });

  it("creates, edits, renders and exports a map end to end", async () => {
    const info = body(await client.callTool({ name: "workspace_info", arguments: {} }));
    expect(info.maps.map((m: { id: string }) => m.id)).toContain("thai_village_topdown");
    expect(info.characters.length).toBeGreaterThanOrEqual(6);

    const made = body(await client.callTool({ name: "write_map", arguments: { id: "mcp_pond", width: 16, height: 10 } }));
    expect(made.saved).toBe(true);
    const edited = body(
      await client.callTool({
        name: "edit_map",
        arguments: {
          id: "mcp_pond",
          ops: [
            { op: "fill", layer: "ground", code: "water", x: 5, y: 2, w: 5, h: 5 },
            { op: "line", layer: "ground", code: "dirt", from: [0, 8], to: [15, 8] },
            { op: "place", kind: "sala", x: 11, y: 2 },
            { op: "spawn", name: "player", x: 2, y: 8 },
            { op: "character", sheet: "characters/town_kid.png", x: 3, y: 8, name: "ton", facing: "right" },
          ],
        },
      }),
    );
    expect(edited.saved).toBe(true);
    expect(edited.ascii.split("\n")[8]).toMatch(/S@/);

    const bad = await client.callTool({ name: "edit_map", arguments: { id: "mcp_pond", ops: [{ op: "place", kind: "castle", x: 0, y: 0 }] } });
    expect((bad as { isError?: boolean }).isError).toBe(true);

    const got = body(await client.callTool({ name: "get_map", arguments: { id: "mcp_pond" } }));
    expect(got.errors).toEqual([]);
    expect(got.stats.objects).toBe(1);

    const preview = await client.callTool({ name: "render_map", arguments: { id: "mcp_pond", collision: true } });
    const content = preview.content as Array<{ type: string; mimeType?: string }>;
    expect(content.some((c) => c.type === "image" && c.mimeType === "image/png")).toBe(true);

    const exported = body(await client.callTool({ name: "export_map", arguments: { id: "mcp_pond", preset: "godot" } }));
    for (const d of exported.dirs) await access(d);
    const escape = await client.callTool({ name: "export_map", arguments: { id: "mcp_pond", preset: "png", out: "../../outside" } });
    expect((escape as { isError?: boolean }).isError).toBe(true);
  });
});

describe("HTTP API", () => {
  it("serves maps, validation, renders and blocks cross-origin writes", async () => {
    const app = createApp({ workspaceRoot: root, webRoot: "/nonexistent" });
    const h = { host: "127.0.0.1:8808" };
    expect((await app.request("/api/health", { headers: h })).status).toBe(200);
    const list = await (await app.request("/api/maps", { headers: h })).json();
    expect(JSON.stringify(list)).toMatch(/thai_village_topdown/);
    const atlas = await app.request("/api/tilesets/thai_village.png", { headers: h });
    expect(atlas.headers.get("content-type")).toMatch(/png/);
    const v = await app.request("/api/validate", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ doc: { id: "x", width: 2, height: 1, layers: { ground: ["gz"] } } }) });
    const vj = (await v.json()) as { errors: { x: number }[] };
    expect(vj.errors[0]!.x).toBe(1);
    const cross = await app.request("/api/maps/x", { method: "POST", headers: { ...h, origin: "https://evil.example", "content-type": "application/json" }, body: "{}" });
    expect(cross.status).toBe(403);
    const sneaky = await app.request("/api/character?path=../../etc/passwd", { headers: h });
    expect(sneaky.status).toBeGreaterThanOrEqual(400);
  });
});
