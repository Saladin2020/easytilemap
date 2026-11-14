# `easytilemap/1` map format

One JSON file per map in `maps/<id>.json`. Coordinates are **tiles** (16px) from the top-left; `x` grows
right, `y` grows down.

```json
{
  "format": "easytilemap/1",
  "id": "thai_village_topdown",
  "name": "หมู่บ้านริมคลอง · Thai village (top-down)",
  "tileSize": 16,
  "width": 40,
  "height": 28,
  "tileset": "thai_village",
  "viewport": { "width": 480, "height": 270 },
  "layers": { "ground": ["…40 chars…", "…"], "decor": ["…"], "collision": ["…"] },
  "objects": [],
  "spawns": [],
  "characters": []
}
```

| Field | Rules |
| --- | --- |
| `id` | `[a-z0-9_-]+`, must match the file name |
| `width` / `height` | 1–256 tiles |
| `tileset` | `thai_village` (the procedural sample; a `tilesets/<id>.png` in the workspace with the same layout overrides it) |
| `viewport` | game camera size in px (Godot project window, Pixi demo, editor camera frame) |

## Layers

Each layer is `height` strings of `width` characters. Missing `decor` / `collision` layers are filled with `.`.

**ground** — every cell must be a terrain code:

| Code | Terrain | Thai | Walkable |
| --- | --- | --- | --- |
| `g` | grass | หญ้า | yes |
| `d` | dirt path | ทางดิน | yes |
| `p` | rice paddy | นาข้าว | yes |
| `w` | canal water | น้ำ / คลอง | **no** |
| `s` | temple stone | ลานหิน | yes |
| `b` | beach sand | หาดทราย | yes |

Grass is the base: every other terrain is a **blob-47** overlay on grass. Each cell looks at its 8
neighbours (`N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128`, a diagonal only counts when both adjacent sides
match), giving 47 distinct tiles per terrain. Off-map neighbours count as the same terrain, so terrain
touching the map edge runs off seamlessly. Centre tiles (mask 255) and grass get deterministic random
variants per cell. Two different non-grass terrains side by side get a thin grass seam between them, except beach sand and
water: sand treats water as its own kind, and water cells touching sand use a separate **shore** blob block
(wet sand rim instead of grass), so a beach runs straight into the sea.

**decor** — `.` or: `f` flowers · `t` grass tuft · `r` rocks · `l` lotus (on water) · `e` pebbles ·
`u` stump · `n` reeds · `k` fence. Decor is drawn on its own TileMapLayer and never blocks.

**collision** — `.` automatic · `#` force blocked · `o` force open.

The final collision grid is derived in this order: water → solid footprints of objects → floor objects
(bridges) open their cells → painted `#` / `o`.

## Objects

```json
{ "kind": "house_wood", "x": 2, "y": 14, "name": "บ้านลุงมี", "flipX": false }
```

`x`, `y` is the **top-left tile of the image**. Sizes (tiles) and solid footprints come from the catalog
(`easytilemap catalog`): buildings `house_wood` 5×5, `house_small` 4×4, `temple` 6×7, `sala` 3×3,
`market_stall` 3×3, `spirit_house` 1×2; nature `tree_mango` 2×3, `palm` 2×3, `banana` 2×2, `bamboo` 1×2;
props `haystack` 2×2, `water_jar` 1×1, `lantern_post` 1×2; floors `boat` 2×1, `bridge_h` 3×1, `bridge_v` 1×3.
Objects and characters are drawn **y-sorted by their base line**; floor objects are drawn under everything.

## Spawns

```json
{ "name": "temple", "x": 6, "y": 9, "facing": "back" }
```

Named points (unique names) for the player start, camera targets or NPC homes. Exported as Godot `Marker2D`
(`metadata/facing`) and `map.spawn(name)` in Pixi.

## Characters

```json
{ "sheet": "characters/town_monk.png", "name": "luang_phi", "x": 3, "y": 10, "facing": "right",
  "anim": "walk", "patrol": { "path": [[3, 10], [9, 10]], "speed": 16 } }
```

| Field | Meaning |
| --- | --- |
| `sheet` | Easy Sprite native top-down sheet, workspace-relative (outside paths need `EASYTILEMAP_ALLOWED_DIRS`) |
| `x`, `y` | **feet** tile (fractions allowed); feet pixel = `x·16+8, y·16+15` |
| `facing` | `front` · `right` · `back` · `left` (left falls back to mirrored right when the sheet has 2 rows) |
| `anim` | `idle` · `walk` |
| `patrol` | optional waypoints (tiles) and speed (px/s); Godot `character_patrol.gd` and Pixi walk them in a loop |

## Diagnostics

`easytilemap check` / `get_map` / `POST /api/validate` return `{ severity, message, path, x, y }`:

```text
maps/bad.json:layers.ground[0] (3,0) error: Unknown ground code "x" at 3,0
maps/bad.json:objects[0] error: objects[0]: unknown object kind "templ" — did you mean "temple"?
maps/bad.json:spawns (1,1) warning: Spawn "player" is on a blocked tile (1,1)
maps/bad.json:layers.decor[0] (3,0) warning: Lotus at 3,0 is not on water
```

Maps with errors are never saved by the API / MCP (`dryRun` only validates).
