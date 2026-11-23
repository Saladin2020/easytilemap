import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportMap } from "../src/lib/export.js";
import { loadAssets, saveMap } from "../src/lib/workspace.js";
import { renderMap } from "../src/shared/render.js";
import { L_E, L_N, L_S, L_W, RAIL_ROW, TUNNEL_ROW, VARIANT_ROW, railCoord, resolveGroundCell, terrainBaseRow, terrainVariant, tunnelCoord } from "../src/shared/autotile.js";
import { validateMap } from "../src/shared/map.js";
import { railPath, routeComponents, travelGraph } from "../src/shared/overworld.js";
import { generateOverworld } from "../src/shared/overworldGen.js";
import { TOWN_OBJECT, townEntrance } from "../src/shared/overworldObjects.js";
import { OBJECT_KINDS } from "../src/shared/objects.js";
import type { MapDoc } from "../src/shared/types.js";
import { tempWorkspace } from "./helpers.js";

let root: string;
let cleanup: () => Promise<void>;
beforeAll(async () => ({ root, cleanup } = await tempWorkspace()));
afterAll(() => cleanup?.());

const gen = (seed: number) => generateOverworld({ seed, id: `ow${seed}`, name: `World ${seed}` });
const clone = (d: MapDoc): MapDoc => JSON.parse(JSON.stringify(d));
const setCell = (d: MapDoc, x: number, y: number, c: string) => {
  const row = d.layers.ground[y]!;
  d.layers.ground[y] = row.slice(0, x) + c + row.slice(x + 1);
};

describe("overworld generator", () => {
  it("is deterministic per seed and differs between seeds", () => {
    expect(JSON.stringify(gen(7))).toBe(JSON.stringify(gen(7)));
    expect(JSON.stringify(gen(7).layers.ground)).not.toBe(JSON.stringify(gen(8).layers.ground));
  });

  it.each([7, 42, 2026])("seed %i validates clean with towns, clusters, roads and rail", (seed) => {
    const { doc, errors } = validateMap(gen(seed));
    expect(errors).toEqual([]);
    const ow = doc!.overworld!;
    expect(ow.regions.length).toBeGreaterThanOrEqual(3);
    expect(ow.towns.length).toBeGreaterThanOrEqual(6);
    for (const r of ow.regions) expect(ow.towns.some((t) => t.region === r.id)).toBe(true);
    const kinds = new Set(ow.towns.map((t) => t.kind));
    expect(kinds.has("malay_kampung")).toBe(true);
    expect(kinds.has("brick_city") || kinds.has("thai_town")).toBe(true);
    for (const t of ow.towns) {
      expect(t.name.th).toBeTruthy();
      expect(t.name.en).toBeTruthy();
      expect(t.scene).toMatch(/^[a-z0-9_-]+$/);
    }
    expect(ow.routes.some((r) => r.kind === "rail")).toBe(true);
    expect(ow.routes.some((r) => r.kind === "road")).toBe(true);
    expect(routeComponents(ow).length).toBe(1);
    const ground = doc!.layers.ground.join("");
    for (const c of ["F", "M", "C", "T", "Z", "w", "b"]) expect(ground).toContain(c);
  });

  it("puts each town marker object over its entrance and each station on a platform tile", () => {
    const doc = gen(42);
    for (const t of doc.overworld!.towns) {
      const o = doc.objects.find((x) => x.name === t.object);
      expect(o, t.id).toBeTruthy();
      expect(TOWN_OBJECT[t.kind]).toBeTruthy();
      expect(townEntrance(o!, OBJECT_KINDS.find((k) => k.kind === o!.kind)!)).toEqual(t.entrance);
      if (t.station) expect(doc.layers.ground[t.station[1]]![t.station[0]]).toBe("Z");
    }
  });

  it("rail paths connect every rail route's stations", () => {
    const doc = gen(2026);
    const ow = doc.overworld!;
    for (const r of ow.routes.filter((x) => x.kind === "rail")) {
      const a = ow.towns.find((t) => t.id === r.from)!.station!;
      const b = ow.towns.find((t) => t.id === r.to)!.station!;
      expect(railPath(doc, a, b), r.id).not.toBeNull();
    }
  });
});

describe("line terrains (rail)", () => {
  it("rail auto-joins with a 4-bit mask: straights, curves, junctions", () => {
    const g = ["ggggg", "gTTTg", "gTggg", "gTggg", "ggggg"];
    const corner = resolveGroundCell(g, 1, 1);
    expect(corner.mask).toBe(L_E | L_S);
    expect(corner.atlas).toEqual(railCoord(L_E | L_S));
    expect(resolveGroundCell(g, 2, 1).mask).toBe(L_E | L_W);
    expect(resolveGroundCell(g, 1, 2).mask).toBe(L_N | L_S);
    const t = ["gTg", "TTT", "ggg"];
    expect(resolveGroundCell(t, 1, 1).mask).toBe(L_N | L_E | L_W);
    expect(railCoord(L_E | L_W).row).toBeGreaterThanOrEqual(RAIL_ROW);
  });
});

describe("overworld validation", () => {
  it("rejects a town without an English name and entrances on water", () => {
    const d = clone(gen(7));
    const t = d.overworld!.towns[0]!;
    (t.name as { en?: string }).en = "";
    const { errors } = validateMap(d);
    expect(errors.some((e) => /name/.test(e.message))).toBe(true);
    const d2 = clone(gen(7));
    const t2 = d2.overworld!.towns[1]!;
    setCell(d2, t2.entrance[0], t2.entrance[1], "w");
    expect(validateMap(d2).errors.some((e) => /entrance/i.test(e.message))).toBe(true);
  });

  it("rejects duplicate town ids and routes to unknown towns", () => {
    const d = clone(gen(7));
    d.overworld!.towns[1]!.id = d.overworld!.towns[0]!.id;
    expect(validateMap(d).errors.length).toBeGreaterThan(0);
    const d2 = clone(gen(7));
    d2.overworld!.routes[0]!.to = "nowhere";
    expect(validateMap(d2).errors.some((e) => /nowhere/.test(e.message))).toBe(true);
  });

  it("flags a station that is not on a platform tile", () => {
    const d = clone(gen(7));
    const t = d.overworld!.towns.find((x) => x.station)!;
    setCell(d, t.station![0], t.station![1], "g");
    expect(validateMap(d).errors.some((e) => /station/i.test(e.message))).toBe(true);
  });

  it("travel graph lists towns (station null when absent) and train pairs with paths", () => {
    const g = travelGraph(gen(7))!;
    expect(g.format).toBe("easytilemap.overworld/1");
    for (const t of g.towns) expect(t).toHaveProperty("station");
    expect(g.trains.length).toBeGreaterThan(0);
    for (const tr of g.trains) expect(tr.path.length).toBeGreaterThan(1);
  });
});

describe("overworld Godot export", () => {
  it("writes the overworld runtime, travel data and main scene", async () => {
    const doc = gen(7);
    expect((await saveMap(root, doc, { force: true })).saved).toBe(true);
    const out = path.join(root, "exports", "ow-godot");
    const res = await exportMap(root, { id: doc.id, preset: "godot", out });
    for (const f of ["overworld/overworld.json", "overworld/overworld_game.gd", "overworld/town_runner.gd", "overworld/test_overworld.gd", "overworld_main.tscn", "project.godot"]) {
      expect(existsSync(path.join(out, f)), f).toBe(true);
    }
    expect(readFileSync(path.join(out, "project.godot"), "utf8")).toContain("overworld_main.tscn");
    const data = JSON.parse(readFileSync(path.join(out, "overworld/overworld.json"), "utf8"));
    expect(data.towns.length).toBe(doc.overworld!.towns.length);
    expect(data.blocked.length).toBe(doc.height);
    expect(res.warnings.some((w) => /town-scenes/i.test(w))).toBe(true);
    // no --town-player: the bundled Easy Sprite side-view kopiah boy walks the towns
    expect(res.warnings.some((w) => /side-view sheet/i.test(w))).toBe(false);
    expect(existsSync(path.join(out, "characters", "side_player.png"))).toBe(true);
    expect(data.sidePlayer?.image).toBe("res://characters/side_player.png");
  });
});

describe("rail tunnels", () => {
  it("routes the railway through mountains in tunnels on several seeds, and the maps still validate", () => {
    let withTunnel = 0;
    for (const seed of [1, 2, 3, 7, 42]) {
      const doc = gen(seed);
      const v = validateMap(doc);
      expect(v.errors, `seed ${seed}`).toEqual([]);
      expect(v.warnings.filter((w) => /Tunnel/.test(w.message)), `seed ${seed}`).toEqual([]);
      const cells = doc.layers.ground.join("").split("").filter((c) => c === "U").length;
      if (cells > 0) withTunnel++;
      // every tunnel cell is on a train path and blocks walking
      const g = travelGraph(doc)!;
      const onPath = new Set(g.trains.flatMap((t) => t.path.map(([x, y]) => `${x},${y}`)));
      doc.layers.ground.forEach((row, y) => [...row].forEach((c, x) => c === "U" && expect(onPath.has(`${x},${y}`), `${seed}: ${x},${y}`).toBe(true)));
    }
    expect(withTunnel).toBeGreaterThanOrEqual(4);
  });

  it("draws portal tiles at the mouths and mountain inside", () => {
    const g = ["MMMMMM", "TUUUUT", "MMMMMM"];
    const west = resolveGroundCell(g, 1, 1);
    const east = resolveGroundCell(g, 4, 1);
    const inside = resolveGroundCell(g, 2, 1);
    expect(west.atlas.row).toBe(TUNNEL_ROW);
    expect(east.atlas.row).toBe(TUNNEL_ROW);
    expect(west.atlas.col).not.toBe(east.atlas.col);
    expect(west.atlas).toEqual(tunnelCoord(L_W));
    expect(inside.atlas.row).not.toBe(TUNNEL_ROW);
  });

  it("warns when a tunnel does not carry track straight through", () => {
    const doc = clone(gen(7));
    const at = doc.layers.ground.findIndex((r) => r.includes("U"));
    expect(at).toBeGreaterThanOrEqual(0);
    const x = doc.layers.ground[at]!.indexOf("U");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) setCell(doc, x + dx, at + dy, "M");
    expect(validateMap(doc).warnings.some((w) => /Tunnel at/.test(w.message))).toBe(true);
  });
});

describe("forest / mountain variety", () => {
  it("is deterministic per cell and mixes all variants without long identical runs", () => {
    for (const t of ["forest", "mountain"] as const) {
      const counts = [0, 0, 0];
      for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {
        const v = terrainVariant(t, x, y);
        expect(v).toBe(terrainVariant(t, x, y));
        counts[v]!++;
      }
      for (const c of counts) expect(c, `${t} ${counts}`).toBeGreaterThan(96 * 64 * 0.03);
    }
    const g = Array.from({ length: 12 }, () => "F".repeat(12));
    const rows = new Set<number>();
    for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) rows.add(resolveGroundCell(g, x, y).atlas.row);
    expect(rows.size).toBeGreaterThan(1);
    // the plain forest blob rows and at least one appended variant set (rows ≥ VARIANT_ROW) are both used
    expect([...rows].some((r) => r >= terrainBaseRow("forest") && r < terrainBaseRow("forest") + 6)).toBe(true);
    expect([...rows].some((r) => r >= VARIANT_ROW)).toBe(true);
  });
});

describe("night", () => {
  it("renders darker with warm lit windows, and plain maps render the same by day", async () => {
    const doc = gen(7);
    const assets = await loadAssets(root, doc);
    const crop = { x: 0, y: 0, w: doc.width * 16, h: doc.height * 16 };
    const day = renderMap(doc, assets, { scale: 1, crop });
    const night = renderMap(doc, assets, { scale: 1, crop, night: true });
    const lum = (img: { data: ArrayLike<number> }) => {
      let s = 0;
      for (let i = 0; i < img.data.length; i += 4) s += img.data[i]! + img.data[i + 1]! + img.data[i + 2]!;
      return s / (img.data.length / 4);
    };
    expect(lum(night)).toBeLessThan(lum(day) * 0.75);
    // warm (lit) pixels: red ≫ blue, bright — near towns at night only
    let warm = 0;
    for (let i = 0; i < night.data.length; i += 4) if (night.data[i]! > 200 && night.data[i + 1]! > 140 && night.data[i + 2]! < 120) warm++;
    expect(warm).toBeGreaterThan(50);
  });
});

describe("overworld Pixi export", () => {
  it("writes the overworld game page, travel data with tunnels and night assets, and copies town scenes", async () => {
    const doc = gen(7);
    expect((await saveMap(root, doc, { force: true })).saved).toBe(true);
    // a fake Easy Scene pixi export for one town scene
    const scene = doc.overworld!.towns[0]!.scene;
    const scenes = path.join(root, "scene-exports");
    mkdirSync(path.join(scenes, `${scene}-pixi`), { recursive: true });
    writeFileSync(path.join(scenes, `${scene}-pixi`, `${scene}.pixi.json`), "{}");
    writeFileSync(path.join(scenes, `${scene}-pixi`, "load-scene.js"), "export async function loadEasyScene() {}");
    const out = path.join(root, "exports", "ow-pixi");
    const res = await exportMap(root, { id: doc.id, preset: "pixi", out, overworld: { townScenes: scenes } });
    for (const f of ["index.html", "easytilemap-overworld.js", "easytilemap-pixi.js", "overworld/overworld.json", "overworld/train.png", "overworld/night_glow.png", `tilesets/${doc.tileset}_night.png`, `towns/${scene}/${scene}.pixi.json`, `towns/${scene}/load-scene.js`, "fonts/Kanit-Regular.ttf"]) {
      expect(existsSync(path.join(out, f)), f).toBe(true);
    }
    const data = JSON.parse(readFileSync(path.join(out, "overworld/overworld.json"), "utf8"));
    expect(data.format).toBe("easytilemap.overworld-pixi/1");
    expect(data.tunnels.length).toBe(doc.layers.ground.join("").split("U").length - 1);
    expect(data.townScenes[scene]).toEqual({ json: `towns/${scene}/${scene}.pixi.json`, loader: `towns/${scene}/load-scene.js` });
    expect(Object.values(data.townScenes).filter((v) => v === null).length).toBe(Object.keys(data.townScenes).length - 1);
    expect(data.night.atlas).toBe(`tilesets/${doc.tileset}_night.png`);
    expect(readFileSync(path.join(out, "index.html"), "utf8")).toContain("startOverworld");
    expect(res.warnings.some((w) => /placeholder street/.test(w))).toBe(true);
    // a town exported with Easy Scene --night: its night street is linked for N / entering at night
    writeFileSync(path.join(scenes, `${scene}-pixi`, `${scene}_night.pixi.json`), "{}");
    const out2 = path.join(root, "exports", "ow-pixi-night");
    await exportMap(root, { id: doc.id, preset: "pixi", out: out2, overworld: { townScenes: scenes } });
    const data2 = JSON.parse(readFileSync(path.join(out2, "overworld/overworld.json"), "utf8"));
    expect(data2.townScenes[scene]).toEqual({ json: `towns/${scene}/${scene}.pixi.json`, loader: `towns/${scene}/load-scene.js`, night: `towns/${scene}/${scene}_night.pixi.json` });
    expect(existsSync(path.join(out2, `towns/${scene}/${scene}_night.pixi.json`))).toBe(true);
    // godot: <scene>_night.tscn is copied with res:// rewritten and linked as townScenes[scene].night
    mkdirSync(path.join(scenes, `${scene}-godot`), { recursive: true });
    writeFileSync(path.join(scenes, `${scene}-godot`, `${scene}.tscn`), '[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://assets/a.png" id="1"]\n');
    writeFileSync(path.join(scenes, `${scene}-godot`, `${scene}_night.tscn`), '[gd_scene format=3]\n[ext_resource type="Texture2D" path="res://night/assets/a.png" id="1"]\n');
    const gout = path.join(root, "exports", "ow-godot-night");
    await exportMap(root, { id: doc.id, preset: "godot", out: gout, overworld: { townScenes: scenes } });
    const gdata = JSON.parse(readFileSync(path.join(gout, "overworld/overworld.json"), "utf8"));
    expect(gdata.townScenes[scene].night).toBe(`res://towns/${scene}/${scene}_night.tscn`);
    expect(readFileSync(path.join(gout, `towns/${scene}/${scene}_night.tscn`), "utf8")).toContain(`res://towns/${scene}/night/assets/a.png`);
    // png preset adds the night render for overworld maps
    const png = await exportMap(root, { id: doc.id, preset: "png", out: path.join(root, "exports", "ow-png") });
    expect(png.files.some((f) => f.endsWith(`${doc.id}_night.png`))).toBe(true);
  });
});

describe("town names", () => {
  const THAI = /[\u0E00-\u0E7F]/;
  it.each([7, 11, 42, 2026])("seed %i: Thai towns and villages are Thai names in every field; Malay names only for kampungs", (seed) => {
    for (const t of gen(seed).overworld!.towns) {
      expect(t.name.th, t.id).toMatch(THAI);
      if (t.kind !== "malay_kampung") expect(t.name.ms, t.id).toBe(t.name.en);
      if (t.kind === "thai_town" || t.kind === "rural_village" || t.kind === "brick_city") {
        // e.g. บ้านหนองบัว · Ban Nong Bua · Ban Nong Bua — never "Kampung Nong Bua"
        expect(t.name.ms, t.id).toBe(t.name.en);
        expect(`${t.name.en} ${t.name.ms}`, t.id).not.toMatch(/\b(Kampung|Bandar|Kuala|Pekan)\b/);
      }
      if (t.kind === "rural_village") expect(t.name.th, t.id).toMatch(/^บ้าน/);
      if (t.kind === "malay_kampung") expect(t.name.ms, t.id).toMatch(/^(Kampung|Kuala) /);
    }
  });
});
