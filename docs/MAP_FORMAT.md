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
| `v` | sidewalk | ทางเท้า | yes |
| `a` | asphalt road | ถนนลาดยาง | yes |
| `F` | forest (world map) | ป่า | yes |
| `M` | mountains (world map) | ภูเขา | **no** |
| `C` | farm field (world map) | ไร่นา | yes |
| `T` | railway track | ทางรถไฟ | yes |
| `X` | level crossing (rail × road) | จุดตัดทางรถไฟ | yes |
| `H` | railway bridge (over water) | สะพานรถไฟ | yes |
| `J` | road bridge (over water) | สะพานถนน | yes |
| `Z` | railway station platform | ชานชาลาสถานี | yes |
| `U` | railway tunnel (through mountains) | อุโมงค์รถไฟ | **no** (the train runs through it) |

Grass is the base: every other terrain is a **blob-47** overlay on grass. Each cell looks at its 8
neighbours (`N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128`, a diagonal only counts when both adjacent sides
match), giving 47 distinct tiles per terrain. Off-map neighbours count as the same terrain, so terrain
touching the map edge runs off seamlessly. Centre tiles (mask 255) and grass get deterministic random
variants per cell. Two different non-grass terrains side by side get a thin grass seam between them, except beach sand and
water: sand treats water as its own kind, and water cells touching sand use a separate **shore** blob block
(wet sand rim instead of grass), so a beach runs straight into the sea.

The city pair works the same way: a **sidewalk** treats road as its own kind (the paving runs up to the curb),
and a **road** cell touching sidewalk (including diagonally) uses the separate **curb** blob block: open edges show
a lit curb stone, its shadow and a gutter, and the curb turns with a rounded corner where the sidewalk turns. A
road next to grass keeps the plain set (worn asphalt edge). Paint a 4-way crossing as two road strips over a
sidewalk fill; the intersection cells pick the inner rounded curb corners automatically.

Forest, mountains and fields are blob-47 overlays like the others (forest: staggered tree crowns; mountains:
peaks with snow variants; fields: crop rows with hedges and ripe variants). They sit in atlas rows 58–75, under
the older rows, so old maps and atlases keep their layout (`loadAtlas` extends a shorter saved atlas).

Forest and mountains also have two **variant blob sets** each, appended in rows 80–103 (forest: 80–85 dark
conifer stands, 86–91 glades with flowers; mountains: 92–97 tall snowy summits, 98–103 low knolls with pines).
Each cell picks plain / variant 1 / variant 2 from a per-cell hash weighted by low-frequency value noise, so
forests and ranges get patches and clearings instead of a repeating stamp; the variant painters keep the
edge corners identical so variants join each other and the plain set seamlessly (the open edges get a small
seeded bump for edge variety). Same map → same tiles. The Godot TileSet registers the variants as extra
terrain tiles (probability 0.4 / 0.2), so Godot's terrain painter mixes them too.

**Tunnels** (`U`) are rail through mountains: inside a range they draw as mountain (with variants); a tunnel
cell with track (`T X H Z`) on one side is a **portal** — dressed-stone arch, dark mouth, keystone, the track
running in — from row 79 (cols 0–3: mouth opening N, E, S, W). Tunnel cells block walking; the train hides
inside them in the Godot and Pixi games. `check` warns when a tunnel cell does not carry track straight through
(rail-ish neighbours on two opposite sides). `generate overworld` routes the railway through mountains in
straight tunnels instead of going around, with mountain flanks beside each portal.

**Line terrains** (`T X H J Z U`) are not blobs: each cell looks only at its 4 sides (`N=1 E=2 S=4 W=8`) and
picks one of 16 rail tiles (straights, curves, T-junctions, crossings, buffer stops; atlas row 76–77) or the
east–west / north–south variant of a crossing, bridge or platform (row 78). Rail joins rail, crossings,
rail bridges and platforms; dirt joins crossings and road bridges; water and sand treat bridges as water, so a
river flows on under them. A crossing is drawn across the rail axis, so a road meets it from the other two sides.

**decor** — `.` or: `f` flowers · `t` grass tuft · `r` rocks · `l` lotus (on water) · `e` pebbles ·
`u` stump · `n` reeds · `k` fence · street: `h` lane dashes (east–west) · `j` lane dashes (north–south) ·
`z` zebra crossing on an east–west road (stripes run with the traffic) · `x` zebra crossing on a north–south
road · `m` manhole · `q` drain grate (sits on the tile's north edge, put it on the road's north gutter row) ·
`c` puddle · `y` fallen leaves. Names work in ops too (`lane_ew`, `lane_ns`, `crosswalk_ew`, `crosswalk_ns`,
`manhole`, `grate`, `puddle`, `leaves`). Lane dashes and zebra stripes repeat with a period that divides 16, so
runs of them join across tiles. Decor is drawn on its own TileMapLayer and never blocks.

**collision** — `.` automatic · `#` force blocked · `o` force open.

The final collision grid is derived in this order: water → solid footprints of objects → floor objects
(bridges) open their cells → painted `#` / `o`.

## Overworld (world map)

An optional `overworld` block turns a map into a JRPG-style world map: towns grouped into regions, joined by
roads and rail; entering a town opens its Easy Scene side-view street.

```jsonc
"overworld": {
  "regions": [{ "id": "southern_coast", "name": { "th": "ชายฝั่ง", "en": "East Coast", "ms": "Pantai Timur" }, "culture": "malay", "color": "#2a8a5c" }],
  "towns": [{
    "id": "kampung_bunga", "region": "southern_coast", "kind": "malay_kampung",
    "name": { "th": "กำปงบุหงา", "en": "Kampung Bunga", "ms": "Kampung Bunga" },
    "object": "town_kampung_bunga",   // name of the ow_* marker object
    "entrance": [68, 12],             // walkable tile in front of the gate; stepping on it enters the town
    "scene": "town_kampung_bunga",    // Easy Scene id of the side view
    "station": [72, 11],              // optional: a `Z` platform tile
    "seed": 1234                       // optional: seed for `easyscene towns`
  }],
  "routes": [{ "id": "rail_1", "kind": "rail", "from": "kampung_bunga", "to": "nakhon_it_daeng", "path": [[72,11],[73,11]] }],
  "start": "nakhon_it_daeng"
}
```

* Town `kind`: `thai_town` · `malay_kampung` · `chinese_town` · `rural_village` · `brick_city`; region
  `culture`: `thai` · `malay` · `chinese` · `rural` · `mixed`. Names need `th` and `en`; `ms` is optional
  (warning when a `malay_kampung` has none).
* Route `kind`: `road` · `rail`. `path` is optional; when present it must be 4-connected, start/end next
  to the towns, and run on road tiles (`d X J`, or `s v a`) or rail tiles (`T X H Z`).
* Checks (`easytilemap check`): unique ids, known regions / towns / kinds, entrances inside the map and
  walkable, stations on `Z`, every town reachable on foot from `start`, route paths valid; a route graph split
  into several groups is a warning. `check --scenes <dir>` also checks every `scene` exists.
* Marker objects (category `town`): `ow_walled_town` 5×4 · `ow_brick_city` 5×4 · `ow_kampung` 4×3 (wooden
  mosque silhouette, no writing) · `ow_chinatown` 4×3 · `ow_village` 3×2 · `ow_station` 2×2. They block their
  footprint; the gate is the south-centre column and the entrance is the tile under it.
* `easytilemap generate overworld --seed N` builds a whole map: coast and beaches, mountains, forests, a river,
  4 town clusters with Thai / Malay / Chinese-Thai / rural names, stations, a rail network (bridges, curves,
  level crossings), roads per cluster and between hubs, fields near towns, and `player` / `town_*` /
  `station_*` spawns. Same seed → same map. Rail lines that meet a mountain range go through it in tunnels.
* **Night**: `render --night` / `render_map {night: true}` and the `png` export of an overworld map
  (`<id>_night.png`) draw a moonlit grade with lit town and station windows (warm 1–2 px glows), platform
  lamps and soft light pools around towns. The Godot and Pixi games bake the same night atlas / object
  images / glow layer and toggle them with **N** (`export --night` starts at night).

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

## Backward compatibility

Tile codes, terrain order and atlas rows are append-only: new terrains are added after the old ones
(`F M C T X H J Z U` after `g d p w s b v a`) and new atlas rows below the old ones (village 0–36, decor 37,
markers 38, city 39–57, overworld 58–78, tunnel portals 79, variants 80–103). A map from before keeps the
same tiles, and an atlas a workspace saved earlier (any height) keeps its rows; missing rows come from the
generated sample. `test/compat.test.ts` checks the sample maps against fingerprints from master, and
`python3 scripts/compat-check.py --old <old checkout> <maps…>` compares check / render / export of any maps
between two checkouts.
