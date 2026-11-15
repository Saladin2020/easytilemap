/** MCP smoke test: start the server over stdio and over HTTP like a client would and call tools. */
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ws = mkdtempSync(path.join(os.tmpdir(), "easytilemap-smoke-"));
execFileSync("npx", ["tsx", "src/cli.ts", "init", "--workspace", ws], { stdio: "ignore" });
const fail = (m) => {
  console.error("FAIL", m);
  process.exitCode = 1;
};
const body = (r) => JSON.parse(r.content?.[0]?.text ?? "{}");

async function exercise(client, label) {
  const tools = (await client.listTools()).tools.map((t) => t.name);
  console.log(`[${label}] tools (${tools.length}):`, tools.join(", "));
  if (tools.length !== 9) fail(`${label}: expected 9 tools`);
  const info = body(await client.callTool({ name: "workspace_info", arguments: {} }));
  if (!info.maps?.length) fail(`${label}: workspace_info`);
  console.log(`[${label}] maps:`, info.maps?.map((m) => m.id).join(", "), "· characters", info.characters?.length, "· objects", info.objects?.length);
  const got = body(await client.callTool({ name: "get_map", arguments: { id: "thai_village_topdown" } }));
  console.log(`[${label}] errors=${got.errors?.length} stats=${JSON.stringify(got.stats)}`);
  if (got.errors?.length !== 0 || got.stats?.characters !== 6) fail(`${label}: get_map`);
  const id = `smoke_${label}`;
  await client.callTool({ name: "write_map", arguments: { id, width: 12, height: 8 } });
  const ed = body(await client.callTool({ name: "edit_map", arguments: { id, ops: [{ op: "fill", layer: "ground", code: "water", x: 4, y: 2, w: 4, h: 4 }, { op: "place", kind: "palm", x: 0, y: 0 }] } }));
  console.log(`[${label}] edit_map saved=${ed.saved}\n${ed.ascii}`);
  if (!ed.saved) fail(`${label}: edit_map`);
  const prev = await client.callTool({ name: "render_map", arguments: { id: "thai_village_topdown", collision: true } });
  const img = prev.content?.find((c) => c.type === "image");
  console.log(`[${label}] render image bytes:`, img ? Buffer.from(img.data, "base64").length : 0);
  if (!img) fail(`${label}: render`);
  const gen = body(await client.callTool({ name: "generate_overworld", arguments: { seed: 7, id: `world_${label}`, force: true } }));
  console.log(`[${label}] generate_overworld saved=${gen.saved} towns=${gen.towns?.length} routes=${gen.routes?.length} tunnels=${gen.tunnelTiles}`);
  if (!gen.saved || !(gen.tunnelTiles > 0)) fail(`${label}: generate_overworld`);
  const chk = body(await client.callTool({ name: "check_map", arguments: { id: `world_${label}` } }));
  console.log(`[${label}] check_map ok=${chk.ok} warnings=${chk.warnings?.length}`);
  if (!chk.ok) fail(`${label}: check_map`);
  const links = body(await client.callTool({ name: "check_map", arguments: { id: `world_${label}`, scenes: "maps" } }));
  console.log(`[${label}] check_map scenes=maps → ${links.errors?.length} missing town scenes (expected ${gen.towns?.length})`);
  if (links.errors?.length !== gen.towns?.length) fail(`${label}: check_map scenes`);
  const ex = body(await client.callTool({ name: "export_map", arguments: { id: `world_${label}`, preset: "pixi", night: true } }));
  console.log(`[${label}] export overworld pixi: files=${ex.files} warnings=${ex.warnings?.length}`);
  if (!(ex.files > 10)) fail(`${label}: export overworld`);
}

// stdio
{
  const client = new Client({ name: "smoke", version: "0.0.1" });
  await client.connect(new StdioClientTransport({ command: "npx", args: ["tsx", "src/mcp/server.ts", "--workspace", ws], cwd: process.cwd(), env: { ...process.env }, stderr: "ignore" }));
  await exercise(client, "stdio");
  const exp = body(await client.callTool({ name: "export_map", arguments: { id: "thai_village_topdown", preset: "all" } }));
  console.log("[stdio] export all:", exp.dirs?.map((d) => path.relative(ws, d)).join(", "), "files", exp.files);
  if (!exp.files) fail("stdio: export");
  await client.close();
}

// HTTP (Streamable HTTP on a spare port)
{
  const port = 18809 + Math.floor(Math.random() * 500);
  const proc = spawn("npx", ["tsx", "src/mcp/server.ts", "--http", "--port", String(port), "--workspace", ws], { stdio: ["ignore", "ignore", "pipe"] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("MCP HTTP did not start")), 20000);
    proc.stderr.on("data", (d) => {
      if (/listening|http:\/\//i.test(String(d))) {
        clearTimeout(t);
        resolve();
      }
    });
  });
  const client = new Client({ name: "smoke-http", version: "0.0.1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  await exercise(client, "http");
  await client.close();
  proc.kill();
}

rmSync(ws, { recursive: true, force: true });
console.log(process.exitCode ? "MCP smoke FAILED" : "MCP smoke OK");
process.exit(process.exitCode ?? 0);
