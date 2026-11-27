<!-- easy-suite:header:start -->
<p align="center">
  <a href="#easy-suite"><img src="docs/brand/banner-tilemap.png" width="100%" alt="Easy Tilemap: Top-down 16px tile maps with autotiling" /></a>
</p>

<p align="center">
  <b>Easy Tilemap</b> · แผนที่มุมบน ออโต้ไทล์ หมู่บ้านไทย · Top-down 16px tile maps with autotiling<br />
  <sub>Part of <a href="#easy-suite"><b>Easy Suite</b></a>: Thai-friendly pixel-art game dev tools for Godot 4.3+ and PixiJS v8</sub>
</p>

<p align="center">
  <a href="https://github.com/Saladin2020/easytilemap/actions/workflows/ci.yml"><img src="https://github.com/Saladin2020/easytilemap/actions/workflows/ci.yml/badge.svg" alt="CI" /></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e2014?style=flat-square" alt="MIT license" /></a> <img src="https://img.shields.io/badge/Godot-4.3%2B-478cbf?style=flat-square&logo=godotengine&logoColor=white" alt="Godot 4.3+" /> <a href="#export"><img src="https://img.shields.io/badge/PixiJS-v8-e72264?style=flat-square" alt="PixiJS v8" /></a> <a href="docs/MCP.md"><img src="https://img.shields.io/badge/MCP-server-c45c26?style=flat-square" alt="MCP server" /></a> <img src="https://img.shields.io/badge/Thai-ready-f4ae3d?style=flat-square" alt="Thai-ready" />
</p>

<p align="center">
  <a href="https://github.com/Saladin2020/easysprite"><img src="docs/brand/logo-sprite-96.png" width="32" alt="Easy Sprite" title="Easy Sprite" /></a>
  <a href="https://github.com/Saladin2020/easyscene"><img src="docs/brand/logo-scene-96.png" width="32" alt="Easy Scene" title="Easy Scene" /></a>
  <a href="https://github.com/Saladin2020/easytilemap"><img src="docs/brand/logo-tilemap-96.png" width="40" alt="Easy Tilemap" title="Easy Tilemap (this repo)" /></a>
  <a href="https://github.com/Saladin2020/easydialogue"><img src="docs/brand/logo-dialogue-96.png" width="32" alt="Easy Dialogue" title="Easy Dialogue" /></a>
  <a href="https://github.com/Saladin2020/easyquest"><img src="docs/brand/logo-quest-96.png" width="32" alt="Easy Quest" title="Easy Quest" /></a>
  <a href="https://github.com/Saladin2020/easyui"><img src="docs/brand/logo-ui-96.png" width="32" alt="Easy UI" title="Easy UI" /></a>
  <a href="https://github.com/Saladin2020/easysfx"><img src="docs/brand/logo-sfx-96.png" width="32" alt="Easy SFX" title="Easy SFX" /></a>
  <a href="https://github.com/Saladin2020/easyfx"><img src="docs/brand/logo-fx-96.png" width="32" alt="Easy FX" title="Easy FX" /></a>
  <a href="https://github.com/Saladin2020/easymusic"><img src="docs/brand/logo-music-96.png" width="32" alt="Easy Music" title="Easy Music" /></a>
  <a href="https://github.com/Saladin2020/easyanim"><img src="docs/brand/logo-anim-96.png" width="32" alt="Easy Anim" title="Easy Anim" /></a>
  <a href="https://github.com/Saladin2020/easyitems"><img src="docs/brand/logo-items-96.png" width="32" alt="Easy Items" title="Easy Items" /></a>
  <a href="https://github.com/Saladin2020/easysave"><img src="docs/brand/logo-save-96.png" width="32" alt="Easy Save" title="Easy Save" /></a>
  <a href="https://github.com/Saladin2020/easykit"><img src="docs/brand/logo-kit-96.png" width="32" alt="Easy Kit" title="Easy Kit" /></a>
  <a href="https://github.com/Saladin2020/easybattle"><img src="docs/brand/logo-battle-96.png" width="32" alt="Easy Battle" title="Easy Battle" /></a>
  <a href="https://github.com/Saladin2020/easyfont"><img src="docs/brand/logo-font-96.png" width="32" alt="Easy Font" title="Easy Font" /></a>
  <a href="https://github.com/Saladin2020/easynpc"><img src="docs/brand/logo-npc-96.png" width="32" alt="Easy NPC" title="Easy NPC" /></a>
  <a href="https://github.com/Saladin2020/easyportrait"><img src="docs/brand/logo-portrait-96.png" width="32" alt="Easy Portrait" title="Easy Portrait" /></a>
  <a href="https://github.com/Saladin2020/easyship"><img src="docs/brand/logo-ship-96.png" width="32" alt="Easy Ship" title="Easy Ship" /></a>
</p>
<!-- easy-suite:header:end -->

# Easy Tilemap

**แผนที่มุมบน · ออโต้ไทล์ · หมู่บ้านไทย · ตัวละคร Easy Sprite**  
Paint top-down 16px pixel-art maps with blob-47 autotile terrain (grass, dirt road, rice paddy, canal, temple
stone, beach sand, city sidewalk and asphalt road with curbs), a procedural Thai village + brick-town tileset and
object set, collision, spawn points and walking
[Easy Sprite](https://github.com/Saladin2020/easysprite) top-down characters — then export to **Godot 4.3+**
(TileMapLayer + terrain TileSet) or **PixiJS v8**. The fourth sibling of Easy Sprite (characters),
[Easy Scene](https://github.com/Saladin2020/easyscene) (side-view levels) and
[Easy Dialogue](https://github.com/Saladin2020/easydialogue) (dialogue).

[![node](https://img.shields.io/badge/node-%3E%3D20-3f7d52?style=flat-square)](https://nodejs.org)

> Easy Tilemap **paints · checks · renders · exports**. All tiles and objects are drawn procedurally in code
> — no AI generation in-app, no downloaded art.

<p align="center">
  <img src="docs/assets/ui-editor.png" width="900" alt="Easy Tilemap editor: terrain palette, the Thai village map with characters, object palette and inspector" />
</p>

<p align="center">
  <img src="docs/assets/map-thai-village.png" width="900" alt="The thai_village_topdown demo: temple courtyard, market stalls, canal with bridges, paddies, stilt houses and six characters" />
</p>

<p align="center">
  <img src="docs/assets/map-multicultural-village.png" width="900" alt="The multicultural_village demo: Buddhist temple, Chinese-Thai shrine and a wooden kampung mosque on one street, Tadika school, Malay raised houses, halal stalls and a beach with kolek boats" />
</p>

**Multicultural village · หมู่บ้านพหุวัฒนธรรม** — `multicultural_village` is a southern Thai coastal town where
Buddhist, Muslim and Chinese-Thai neighbours share one main road: the temple (วัด) and its sala, a Chinese-Thai
shrine (ศาลเจ้า), a Talo Mano-style wooden mosque (มัสยิด) with its minaret, a Tadika school (ตาดีกา), Malay
raised houses (บ้านมลายู) next to Thai stilt houses, fruit and halal stalls side by side, and a beach (หาดทราย)
where kolek boats (เรือกอและ) rest beside fish-drying racks. The cast mixes the Thai town characters with Muslim
neighbours from Easy Sprite (hijab teacher, kopiah boy, Pak Cik in jubah, Tadika girl, roti seller, fisherman in
kain pelekat). Spawns: `temple`, `shrine`, `mosque`, `tadika`, `market`, `beach`.

<p align="center">
  <img src="docs/assets/map-city-crossing.png" width="900" alt="The city_crossing demo: a brick-town 4-way intersection with asphalt roads, lane dashes, zebra crossings, curbed sidewalks, brick rowhouses, an apartment with a fire escape, a corner shop with a teal awning and big street trees overhanging the road" />
</p>

**Brick town · สี่แยกเมืองอิฐ** — `city_crossing` is a 4-way intersection in a brick neighbourhood. Two new
blob-47 terrains, `v` **sidewalk** (concrete slabs) and `a` **road** (asphalt), autotile like the rest; where road
meets sidewalk the road switches to a dedicated **curb** block (lit curb stone, shadow and gutter, rounded corners
where the sidewalk turns), and sidewalks treat road as their own kind so paving runs right up to the curb. Street
decor: lane dashes `h` / `j`, zebra crossings `z` (on an east–west road) / `x` (on a north–south road), manhole `m`,
drain grate `q`, puddle `c`, fallen leaves `y`. Objects: brick rowhouses (red, brown), an apartment with a fire
escape and water tank, a garage, a corner shop with a striped teal awning, a flat-roof block filler, large street
trees whose canopy overhangs the road (only the trunk blocks), shrubs, street lamps, utility poles and a red
postbox. Spawns: `player`, `shop`, `apartment`, `park`, `south_street`.

<p align="center">
  <img src="docs/assets/objects-city.png" width="900" alt="Brick-town objects: rowhouses, apartment with fire escape, garage, corner shop, flat roof, street tree, shrub, lamp, utility pole, postbox" />
</p>

---

## What you get

| Terrain | Objects | Characters | Export |
| --- | --- | --- | --- |
| 8 terrains on a character grid, **blob-47** autotile transitions (47 tiles per terrain, corner-aware), beach sand with dedicated shore-water tiles, sidewalk + asphalt road with a dedicated curb block, 8 grass variants + random terrain centres, 16 decor codes (flowers, lotus, reeds, fence, lane dashes, zebra crossings, manhole, grate, puddle, leaves…), collision layer (`#` block / `o` open) | 34 kinds: stilt houses, temple (ubosot), sala, market stall, spirit house, wooden mosque, Tadika school, Malay kampung house, halal stall, Chinese-Thai shrine, fish rack, kolek, mango tree, palm, banana, bamboo, haystack, water jar, lantern post, long-tail boat, bridges, plus brick town: rowhouses, apartment with fire escape, garage, corner shop, flat roof, large street tree, shrub, street lamp, utility pole, red postbox — each with a solid footprint, y-sorted by base line | Easy Sprite **native top-down** sheets (front/right/back/left rows, idle + walk), placed by feet tile, facing + optional patrol path | Godot 4.3+ project (TileMapLayer ground + decor, `TileSet .tres` with terrain set + peering bits, AnimatedSprite2D characters with patrol, StaticBody2D collision, Marker2D spawns, Camera2D), PixiJS v8 loader + playable demo, PNG |

* **Collision you don't have to paint.** Water, object footprints and floor objects (bridges open the canal)
  are derived; the collision layer only overrides.
* **Same renderer everywhere.** The editor canvas, CLI, MCP previews and tests all use one TypeScript
  renderer; the Godot and Pixi exports reuse the same resolved atlas indices.
* **Agent friendly.** CLI with `--json` / `--ascii`, edit ops (`fill`, `paint`, `line`, `place`, `spawn`,
  `character`…), an HTTP API and an MCP server (stdio + HTTP) with 7 tools.

<p align="center">
  <img src="docs/assets/map-collision.png" width="440" alt="Collision overlay, spawns and grid" />
  <img src="docs/assets/godot.png" width="440" alt="The Godot 4.3 export running (y-sorted characters, TileMapLayer)" />
</p>

<p align="center">
  <img src="docs/assets/objects-lineup.png" width="700" alt="The 16 procedural Thai village objects" />
</p>

## Quick start

```bash
npm install
npx tsx src/cli.ts init --workspace ./my-map      # demo map, thai_village tileset + objects, top-down cast
npx tsx src/cli.ts serve --workspace ./my-map     # editor → http://127.0.0.1:8808/
```

**Workspaces from an older version** keep working as they are: renders, exports and the editor fill atlas
rows added since (city, overworld, tunnels…) from the built-in sample in memory. To get those rows as real
pixels you can repaint, plus the new objects and samples, run `upgrade` (plain `init` does the same):

```bash
npx tsx src/cli.ts upgrade --workspace ./my-map --dry-run   # what would change
npx tsx src/cli.ts upgrade --workspace ./my-map             # append new atlas rows, add missing files
```

It appends the missing rows to `tilesets/thai_village.png` and keeps every existing (repainted) row, updates
`thai_village.json`, adds missing object PNGs, sample maps and characters, and backs the old atlas / JSON up to
`tilesets/_backup/` first. Maps and characters you have are never overwritten, and running it twice changes
nothing. `init --force` is different: it overwrites the atlas, objects, config and demo maps with fresh copies.

Dev mode: `npm run dev` (API on 8808) + `npx vite --config web/vite.config.ts` (UI on 5176).

The editor: **Paint** (ground / decor / collision, brush 1–5, Shift+drag fills a rectangle), **Select**
(drag objects, spawns and characters; right-click selects with any tool; Delete removes), **Spawn**, object
and character palettes, inspector (name, facing, animation, flip, patrol), grid / collision / spawns overlays,
`Ctrl+S` save, `Ctrl+Z` undo, live diagnostics and export buttons.

## Map format in 20 lines

```json
{
  "format": "easytilemap/1",
  "id": "pond",
  "name": "บ่อบัว",
  "tileSize": 16, "width": 8, "height": 5, "tileset": "thai_village",
  "layers": {
    "ground":    ["gggggggg", "ggwwwwgg", "ggwwwwgg", "dddddddd", "gggggggg"],
    "decor":     ["f.......", "...l....", "........", "........", ".......t"],
    "collision": ["........", "........", "........", "........", "#......."]
  },
  "objects":    [{ "kind": "palm", "x": 6, "y": 0 }, { "kind": "bridge_v", "x": 3, "y": 1 }],
  "spawns":     [{ "name": "player", "x": 1, "y": 3, "facing": "right" }],
  "characters": [{ "sheet": "characters/town_kid.png", "name": "ton", "x": 1.5, "y": 3, "facing": "right",
                   "anim": "walk", "patrol": { "path": [[1, 3], [6, 3]], "speed": 24 } }]
}
```

Ground codes `g` grass · `d` dirt · `p` paddy · `w` water · `s` stone · `b` beach sand · `v` sidewalk · `a` road.
Decor `f t r l e u n k` (village) and `h j z x m q c y` (street), `.` empty.
Full reference: **[docs/MAP_FORMAT.md](docs/MAP_FORMAT.md)**.

## CLI

```bash
easytilemap check thai_village_topdown --ascii          # errors with layer/cell + "did you mean"; exit 1 on errors (--strict, --json)
easytilemap new riverside --width 32 --height 20 --name "ริมคลอง"
easytilemap paint riverside --layer ground --code water --rect 10,0,3,20
easytilemap paint riverside --layer ground --code dirt --line 0,12,31,12 --width 2
easytilemap place riverside --object bridge_h --at 10,12
easytilemap spawn riverside --name player --at 4,12 --facing right
easytilemap character riverside --sheet characters/town_monk.png --at 6,8 --patrol "6,8;14,8"
easytilemap edit riverside --ops '[{"op":"place","kind":"sala","x":20,"y":4}]'
easytilemap render thai_village_topdown --scale 3 --crop 160,60,480,270 --out camera.png   # --grid --collision --spawns
easytilemap export thai_village_topdown --preset all     # png | godot | pixi | all
easytilemap catalog · list · info · tileset · serve [--port 8808]

# world map (overworld): town clusters + roads + railway, towns open side-view Easy Scene streets
easytilemap generate overworld --seed 7 --id world --name "Overworld"   # --width 96 --height 64 --clusters 4 --player <sheet>
easytilemap towns world                                                   # regions, towns, routes (--json)
easyscene towns --from-overworld maps/world.json --export godot --night --out ../town-exports   # (Easy Scene) one street per town (+ night streets)
easytilemap check world --scenes ../easyscene/scenes                      # every town's scene exists
easytilemap export world --preset godot --town-scenes ../town-exports   # --town-player <side-view sheet>
easytilemap export world --preset pixi  --town-scenes ../town-exports   # same game in the browser
easytilemap render world --night --out world_night.png                    # lit windows, moonlit grade (export --night: start at night)
```

(`npx tsx src/cli.ts …` from a checkout, `node dist/cli.js …` after `npm run build`.)

Town names: Thai towns, villages and the brick city have Thai names in every language (`th` บ้านหนองบัว,
`en` / `ms` Ban Nong Bua), kampungs have Malay names and Chinese-Thai market towns their Hokkien / Teochew
names. The HUD (Kanit font, Thai script) shows `th · en` (plus `ms` for a kampung whose Malay name differs).
Inside towns the player is Adam, the Easy Sprite side-view kopiah boy in `characters/side/side_kopiah_boy.png`
(bundled under `samples/side/`); pass `--town-player` for your own side-view sheet.

## Export

| Preset | Output (`exports/<id>-<preset>/`) |
| --- | --- |
| `png` | `<id>.png` at `--scale` (default 2) |
| `godot` | Godot 4.3+ project: `<id>.tscn` (Ground + Decor `TileMapLayer`, floor sprites, y-sorted `World` with object `Sprite2D`s and character `AnimatedSprite2D`s, `Collision` StaticBody2D with merged rectangles, `Spawns` Marker2Ds, Camera2D), `<id>_tileset.tres` (terrain set "match corners and sides" with 8 terrains + peering bits for every blob, shore and curb tile, so Godot's terrain painter keeps working), `character_patrol.gd`, `camera_pan.gd`, `test_map.gd`, `screenshot.gd`, 480×270 viewport, nearest filter |
| `pixi` | `<id>.tilemap.json` (resolved atlas indices, objects, characters, collision, spawns), atlas + object + sheet PNGs, `easytilemap-pixi.js`, playable `index.html` (arrow keys / WASD walk "ton" around with collision) |

**PixiJS v8**

```js
import { loadTilemap } from "./easytilemap-pixi.js";
const map = await loadTilemap(PIXI, "./thai_village_topdown.tilemap.json");
app.stage.addChild(map.view);
map.control("ton", { speed: 64 });                  // arrow keys / WASD, collides with map.isBlocked(px, py)
map.follow(map.characters.get("ton").sprite, 480, 270);
app.ticker.add((t) => map.update(t.deltaMS / 1000)); // patrols + camera
map.spawn("temple");                                  // { x, y, facing } in px
```

Drop `pixi.min.js` next to `index.html` to run offline; otherwise it loads PixiJS 8 from jsDelivr.

**Godot 4.3+** — open the exported folder and press F5 (arrow keys pan the camera), or copy the `.tscn`,
`.tres`, `tilesets/`, `objects/`, `characters/` and scripts into your project. Characters are
`AnimatedSprite2D` with `idle_<dir>` / `walk_<dir>` animations; spawns are `Marker2D` with
`metadata/facing`. Headless check: `godot --headless --path . --script res://test_map.gd`.

**Overworld (Godot)** — a map with an `overworld` block exports a playable world map as the main scene
(`overworld_main.tscn` + `overworld/overworld_game.gd`): arrow keys walk tile by tile (water and mountains
block), stepping on a town's entrance fades into its Easy Scene street (`towns/<scene>/`, side-view player,
camera follow), walking off a street end or Esc returns you to the gate, and on a station platform Enter
opens the train menu and rides the rail line to another station. The HUD shows Thai / English / Malay names
(Kanit font). Headless test: `godot --headless --fixed-fps 60 --path . --script res://overworld/test_overworld.gd`;
GIF frames: `xvfb-run godot --rendering-driver opengl3 --fixed-fps 60 --path . --script res://overworld/capture.gd -- mode=walk|train out=/tmp/frames`.
Railway tunnels hide the train while it is inside the mountain. **N** toggles day / night (baked night
atlas, lit windows, street lamps and lantern posts lit by explicit night masks recorded while their art is
painted (utility poles have none, repainted poles fall back to the window colours), an additive glow layer; `export --night` starts at night). Towns follow it: entering a
town at night shows its night street and N swaps day / night inside the town (player keeps its place, tinted
at night) when the town was exported with Easy Scene `--night` (`<scene>_night.tscn`, linked as
`townScenes[scene].night`); otherwise the day street is kept and only the player is tinted. Towns without an
exported scene use a placeholder street.

**Overworld (PixiJS v8)** — the `pixi` export of an overworld map is the same game in the browser:
`index.html` runs `easytilemap-overworld.js` on top of `easytilemap-pixi.js` with the same rules (tile-step
walk, town gates load the town's Easy Scene **Pixi** export from `towns/<scene>/` through its `load-scene.js`,
street exits back to the gate, station Enter → train menu → ride, tunnels, N for night, also inside towns via
`<scene>_night.pixi.json`) and a DOM HUD with
Thai / English / Malay names in Kanit. Pass `--town-scenes` a folder with `<scene>-pixi/` exports
(`easyscene towns --from-overworld … --export pixi`). `window.__ow` exposes `state()`, `step()`, `enterTown()`,
`leaveTown()`, `rideTrain()`, `setNight()` and events for tests. Plain (non-overworld) maps export exactly as
before. Browser test: `python3 scripts/check-pixi-overworld.py <export-dir>` (with `pixi.min.js` next to
`index.html`) or `PIXI_JS=/path/pixi.min.js EASYSCENE=../easyscene npx vitest run test/pixi-overworld.test.ts`.

### Party followers, minimap and world map (overworld games)

Party members walk the leader's trail one tile behind each other (`followers` in `overworld.json`, `opts.followers`,
or `await game.addFollower(spec)` with the same spec shape as `player`); they hide in towns, trains and tunnels.
`game.minimap(parent, { x, y, cell: 2 })` and `game.worldMap(parent, { cell: 4, lang })` draw land, blocked tiles,
rails, stations and town gates with live party dots. Godot: `add_follower(spec)`, `make_minimap(cell, labels)`.
Rules live in `src/shared/party.ts` and are tested against both runtimes.

## Easy Sprite and Easy Dialogue

* **Characters** are Easy Sprite native sheets exported with the top-down view
  (`easysprite-cli export --preset native`): 48×48 frames, rows front/right/back/left, feet on row 45. The
  sheet's `.json` gives the frame layout; without one Easy Tilemap assumes the native layout and detects the
  feet row. Side-view sheets load with a warning. The sample cast (`town_kid`, `town_vendor`, `town_monk`,
  `town_farmer`, `town_student`, `town_elder`) is the same Thai town cast Easy Dialogue uses for portraits; `multicultural_village` adds Muslim neighbours
  (`town_hijab_teacher`, `town_kopiah_boy`, `town_pak_cik`, `town_tadika_girl`, `town_roti_seller`, `town_fisher`).
* **Spawns** in the demo (`player`, `market`, `temple`, `farm`, `elder_house`) are the targets of
  `@camera …` events in Easy Dialogue's `village_delivery.ezd`: on `event_fired("camera", ["temple"])`, move
  the camera to the `temple` Marker2D (Godot) or `map.spawn("temple")` (Pixi).

## MCP

`npm run mcp` (stdio) or `npm run mcp:http` (`http://127.0.0.1:8809/mcp`). Tools: `workspace_info`,
`list_maps`, `get_map`, `write_map`, `edit_map`, `render_map`, `export_map`, `generate_overworld`, `check_map`, `upgrade_workspace`.
See **[docs/MCP.md](docs/MCP.md)**.

## Security

The server binds to `127.0.0.1` by default and rejects cross-origin writes and non-loopback `Host` headers.
`--host 0.0.0.0` requires the token printed at startup (or `EASYTILEMAP_TOKEN`). API and MCP paths stay
inside the workspace plus `EASYTILEMAP_ALLOWED_DIRS`.

## Development

```bash
npm run typecheck && npm test && npm run build && npm run smoke
GODOT=/path/to/godot npx vitest run test/godot.test.ts      # import the export headless, compare node/tile counts
npm run docs:images                                         # README images from the samples
python3 scripts/check-pixi.py exports/thai_village_topdown-pixi   # headless Chrome: walk + collide, no console errors
python3 scripts/check-pixi-overworld.py exports/world-pixi          # overworld: town in/out, train, tunnel, night
python3 scripts/compat-check.py --old /tmp/easytilemap-master samples/maps/*.json   # old maps: check/render/export unchanged
python3 scripts/capture-ui.py                              # editor screenshot (server on :8808)
npx tsx scripts/build-samples.mts                          # regenerate samples/maps from src/lib/demoMaps.ts
```

Ports: API / editor 8808 · MCP HTTP 8809 · Vite 5176.

<!-- easy-suite:table:start -->
## Easy Suite

<img src="docs/brand/logo-suite-96.png" width="48" align="right" alt="Easy Suite" />

Eighteen small, local-first tools that share one look (teak, lantern gold, Kanit, 16/48px pixels), one
workflow (CLI · web editor · MCP server) and the same targets (**Godot 4.3+** and **PixiJS v8**).
ชุดเครื่องมือทำเกมพิกเซลสไตล์ไทย ใช้ร่วมกันได้ทั้งชุด · **Easy Kit** builds a whole playable game from the others and
**Easy Ship** packages it for the web, desktop and Android.  
The samples share one multicultural southern Thai village: Buddhist temple, wooden kampung mosque and
Chinese-Thai shrine on the same street. หมู่บ้านพหุวัฒนธรรม วัด มัสยิด ศาลเจ้า อยู่ร่วมกันในเมืองเดียว

| | Tool | What it does | Repo |
|:-:|---|---|---|
| <img src="docs/brand/logo-sprite-96.png" width="40" alt="" /> | [**Easy Sprite**](https://github.com/Saladin2020/easysprite) | Compose modular 48px chibi characters (top-down + side-view) and export sheets. | [`easysprite`](https://github.com/Saladin2020/easysprite) |
| <img src="docs/brand/logo-scene-96.png" width="40" alt="" /> | [**Easy Scene**](https://github.com/Saladin2020/easyscene) | Side-view levels: parallax layers, 16px autotiles, Thai town props. | [`easyscene`](https://github.com/Saladin2020/easyscene) |
| <img src="docs/brand/logo-tilemap-96.png" width="40" alt="" /> | **Easy Tilemap** ← you are here | Top-down 16px maps: blob-47 autotiles, objects, collision, spawns. | [`easytilemap`](https://github.com/Saladin2020/easytilemap) |
| <img src="docs/brand/logo-dialogue-96.png" width="40" alt="" /> | [**Easy Dialogue**](https://github.com/Saladin2020/easydialogue) | Branching `.ezd` dialogue with Thai-safe text, portraits and choices. | [`easydialogue`](https://github.com/Saladin2020/easydialogue) |
| <img src="docs/brand/logo-quest-96.png" width="40" alt="" /> | [**Easy Quest**](https://github.com/Saladin2020/easyquest) | Text `.ezq` quests: steps, flags, items, rewards, linked to dialogue. | [`easyquest`](https://github.com/Saladin2020/easyquest) |
| <img src="docs/brand/logo-ui-96.png" width="40" alt="" /> | [**Easy UI**](https://github.com/Saladin2020/easyui) | Nine-slice pixel UI kit: panels, bars, inventory, menus, 30 icons. | [`easyui`](https://github.com/Saladin2020/easyui) |
| <img src="docs/brand/logo-sfx-96.png" width="40" alt="" /> | [**Easy SFX**](https://github.com/Saladin2020/easysfx) | Deterministic 8-bit SFX and 4-channel chiptune loops, typing blips. | [`easysfx`](https://github.com/Saladin2020/easysfx) |
| <img src="docs/brand/logo-fx-96.png" width="40" alt="" /> | [**Easy FX**](https://github.com/Saladin2020/easyfx) | Pixel particles: sparks, fire, rain, lanterns, Raya pelita; sheets + Godot particles. | [`easyfx`](https://github.com/Saladin2020/easyfx) |
| <img src="docs/brand/logo-music-96.png" width="40" alt="" /> | [**Easy Music**](https://github.com/Saladin2020/easymusic) | Seeded Thai loop music: ranat, khong wong, saw, khim, pi, kompang; seamless WAV/OGG loops. | [`easymusic`](https://github.com/Saladin2020/easymusic) |
| <img src="docs/brand/logo-anim-96.png" width="40" alt="" /> | [**Easy Anim**](https://github.com/Saladin2020/easyanim) | Cutscene timelines: actors, camera, dialogue, FX and music cues; Godot + Pixi runners. | [`easyanim`](https://github.com/Saladin2020/easyanim) |
| <img src="docs/brand/logo-items-96.png" width="40" alt="" /> | [**Easy Items**](https://github.com/Saladin2020/easyitems) | Item database, shops, inventory, loot tables and crafting; 44 starter items with pixel icons. | [`easyitems`](https://github.com/Saladin2020/easyitems) |
| <img src="docs/brand/logo-save-96.png" width="40" alt="" /> | [**Easy Save**](https://github.com/Saladin2020/easysave) | Versioned save slots with migrations and checksums; Thai / English / Malay string tables. | [`easysave`](https://github.com/Saladin2020/easysave) |
| <img src="docs/brand/logo-kit-96.png" width="40" alt="" /> | [**Easy Kit**](https://github.com/Saladin2020/easykit) | One command drives the Easy tools into a playable Godot 4.3+ and PixiJS game (portraits, schedules, battles, Thai pixel font) and ships it with Easy Ship; unified MCP server and `doctor`. | [`easykit`](https://github.com/Saladin2020/easykit) |
| <img src="docs/brand/logo-battle-96.png" width="40" alt="" /> | [**Easy Battle**](https://github.com/Saladin2020/easybattle) | Turn-based battles: party, bestiary, skills, statuses, bosses; seeded simulator; Godot + Pixi runtimes. | [`easybattle`](https://github.com/Saladin2020/easybattle) |
| <img src="docs/brand/logo-font-96.png" width="40" alt="" /> | [**Easy Font**](https://github.com/Saladin2020/easyfont) | Pixel bitmap fonts for Thai, Latin and Malay: stacking vowels and tones, BMFont / TTF for Godot + Pixi. | [`easyfont`](https://github.com/Saladin2020/easyfont) |
| <img src="docs/brand/logo-npc-96.png" width="40" alt="" /> | [**Easy NPC**](https://github.com/Saladin2020/easynpc) | NPC daily schedules with A* on Easy Tilemap maps, day / night, affinity, dialogue and quest hooks. | [`easynpc`](https://github.com/Saladin2020/easynpc) |
| <img src="docs/brand/logo-portrait-96.png" width="40" alt="" /> | [**Easy Portrait**](https://github.com/Saladin2020/easyportrait) | 64×64 dialogue portraits with 9 emotions, blink and talk frames, from Easy Sprite characters. | [`easyportrait`](https://github.com/Saladin2020/easyportrait) |
| <img src="docs/brand/logo-ship-96.png" width="40" alt="" /> | [**Easy Ship**](https://github.com/Saladin2020/easyship) | Toolchain doctor, web / Windows / Linux / Android builds, itch.io zips and butler plans; dry run by default. | [`easyship`](https://github.com/Saladin2020/easyship) |

### Works with

- **Easy Sprite** top-down sheets are the walking characters.
- Spawn names are the targets of **Easy Dialogue** `@camera` events and **Easy Quest** `enter` / `talk` triggers.
- **Easy SFX** and **Easy UI** layer sound and HUD over the exported map.
<!-- easy-suite:table:end -->

## Credits

Tileset, objects and icons are drawn procedurally and released as CC0. Sample cast composed with Easy Sprite.
See [CREDITS.md](CREDITS.md). Code: MIT © Salahuddin Benno.

## Town life: airports, flights, flood, station / airport hooks (DSK-5, Pixi runtime)

- `export <map> --preset pixi --airports <townId,townId>` puts a 6 × 3 airport (runway, terminal, tower; gate on the
  bottom row) on the nearest free grass / dirt / sand / paddy next to each town (`airportSites`, deterministic), and
  writes `airports`, `flights` (every pair), `overworld/plane.png` and `overworld/airport.png` into the export.
- On an airport gate press **Enter**: pick a destination; the plane rolls down the runway, lifts off (it grows and its
  shadow moves away), flies across the map with the camera following, lands and taxis; `flight_departed` /
  `flight_landed` events. `game.flyover()` (and every ~14–24 s on its own) sends a plane over the view.
- **Flood**: every export carries `lowland` (0 = water, then distance from water, paddy one lower). `game.setFlood(0..1)`
  covers low walkable cells (`floodReach(level)`, same stages as Easy NPC: puddles .15, ankle .35, knee .6, waist .85)
  with water, a foam edge and glints; walking through it is slower (`floodWalk(depth)`: .8 / .65 / .5) and the
  player leaves a ripple. `game.floodDepthAt(x, y)`.
- `opts.onStation(townId, game)` / `opts.onAirport(airport, game)` replace the Enter menus so a game can walk the player
  into a station hall / terminal first (buy a ticket, wait on the platform) and then call `game.rideTrain(to)` /
  `game.fly(to)`; `game.setPaused(on)` freezes the map while such an overlay is open.
  Side-view streets: `game.townScene()` (the Easy Scene loader result: `shops`, `setShopOpen`, `counterFronts`),
  `game.townNpcLayer()` (put game NPCs here: behind stall / counter fronts, kept across day / night swaps),
  `game.setTownSpeed(f)` (e.g. Easy NPC `floodEffects(level).walk`). The street player stands in front of counter fronts.
- The Godot overworld export is unchanged (no airports / flood yet).
