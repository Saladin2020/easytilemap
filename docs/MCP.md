# Easy Tilemap MCP

MCP tools so an AI agent (Cursor, Claude Desktop, Grok bot, the Indie Studio team, …) can **create, paint,
check, preview and export** top-down tile maps without opening the web UI. The agent sends edit ops; Easy
Tilemap validates them (cell-level errors), renders a PNG preview and exports Godot / Pixi projects.
It never generates art: tiles and objects are the procedural `thai_village` set.

## Transports

| Mode | When to use | Start |
|---|---|---|
| **stdio** (default) | Cursor, Claude Desktop, local agents | `npm run mcp` or `npx tsx src/mcp/server.ts --workspace <dir>` |
| **Streamable HTTP** | Remote / HTTP MCP clients | `npm run mcp:http` → `http://127.0.0.1:8809/mcp` · any port: `npx tsx src/mcp/server.ts --http --port 18809` |

Workspace root: `EASYTILEMAP_WORKSPACE` or `--workspace <path>` (default: cwd). Create one with
`npx tsx src/cli.ts init --workspace <dir>`.
HTTP on a non-loopback `--host` requires `Authorization: Bearer <token>` (printed once at startup, or fixed via `EASYTILEMAP_TOKEN`).
Files outside the workspace (e.g. Easy Sprite sheets used as characters) must be listed in `EASYTILEMAP_ALLOWED_DIRS`.

Cursor `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "easytilemap": {
      "command": "npx",
      "args": ["tsx", "/path/to/easytilemap/src/mcp/server.ts"],
      "env": { "EASYTILEMAP_WORKSPACE": "/path/to/my-game-maps" }
    }
  }
}
```

## Tools (9)

| Tool | What it does |
|---|---|
| `workspace_info` | maps (with error counts), character sheets, terrain / decor codes, the object catalog (size, solid footprint, floor), export presets and a format cheat sheet. Call first. |
| `list_maps` | maps with size, object / character / spawn counts and validation status |
| `get_map` | errors + warnings, stats, ASCII overview (`O` object, `=` bridge/boat, `S` spawn, `@` character), objects, spawns, characters; `includeJson` for the full document |
| `write_map` | validate and save a whole `easytilemap/1` document, or create a blank `width`×`height` map; refuses to save with errors; `dryRun` only validates |
| `edit_map` | apply ops in order and save: `fill` (rect), `paint` (cells), `line` / `path` (with width) on `ground` / `decor` / `collision`, `place` / `remove_object`, `spawn` / `remove_spawn`, `character` / `remove_character`, `resize`; returns the new ASCII |
| `render_map` | PNG (scale 1–4, optional `crop`, `collision` / `grid` / `spawns` overlays, `night`) returned inline and saved in `exports/previews/` |
| `export_map` | `png` · `godot` · `pixi` · `all` into `exports/<id>-<preset>/`; overworld maps: `townScenes` (folder of Easy Scene `<scene>-godot/` / `<scene>-pixi/` exports), `townPlayer` (side-view sheet; default: the bundled Easy Sprite kopiah boy), `night` |
| `generate_overworld` | seeded world map: town clusters (Thai / Malay kampung / Chinese-Thai / rural), roads, railway with stations and tunnels; returns regions, towns (entrance, station, scene id), routes, tunnel tile count. Same seed → same map; `force` overwrites |
| `check_map` | validation errors / warnings / stats; `scenes` (workspace folder: Easy Scene workspace, scenes folder or exports) also checks every overworld town links to an existing scene; `strict` |
| `upgrade_workspace` | bring an older workspace up to date without overwriting work: append new atlas rows (repainted rows kept, backup in `tilesets/_backup/`), add missing objects / sample maps / characters; `dryRun`; idempotent |

## Recommended flow

```text
workspace_info → write_map {id, width, height} → edit_map (terrain first: fill/line, then place objects,
spawn, character) → get_map (read the ASCII + warnings) → render_map (look at it) → export_map
```

World map: `generate_overworld {seed}` → Easy Scene MCP `towns_from_overworld {map: "maps/<id>.json", export:
"godot,pixi"}` → `check_map {id, scenes}` → `export_map {id, preset: "godot" | "pixi", townScenes, townPlayer}`.

Example `edit_map` arguments:

```json
{
  "id": "riverside",
  "ops": [
    { "op": "fill", "layer": "ground", "code": "water", "x": 10, "y": 0, "w": 3, "h": 20 },
    { "op": "line", "layer": "ground", "code": "dirt", "from": [0, 12], "to": [31, 12], "width": 2 },
    { "op": "place", "kind": "bridge_h", "x": 10, "y": 12 },
    { "op": "place", "kind": "house_wood", "x": 2, "y": 5, "name": "บ้านต้น" },
    { "op": "spawn", "name": "player", "x": 4, "y": 12, "facing": "right" },
    { "op": "character", "sheet": "characters/town_kid.png", "name": "ton", "x": 4, "y": 12, "facing": "right" }
  ]
}
```

City streets: fill `sidewalk`, then `road` strips on top (curbs and rounded corners come automatically), then
decor `lane_ew` / `lane_ns`, `crosswalk_ew` / `crosswalk_ns`, `manhole`, `grate`, `puddle`, `leaves`, and objects
such as `brick_rowhouse`, `brick_apartment`, `brick_shop_corner`, `street_tree_large`, `lamp_pole` (see the
`city_crossing` sample).

Layer codes accept names too (`water`, `flowers`, `block`, `open`, `erase`). Bad ops come back as an error
result (`Unknown object kind "castle"`); validation problems as
`{ "severity": "error", "path": "layers.ground[3]", "x": 12, "y": 3, "message": "Unknown ground code \"x\" at 12,3" }`.
