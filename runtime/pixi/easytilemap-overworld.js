// Easy Tilemap — PixiJS v8 overworld game (world map → side-view towns → train), MIT.
// Same rules as the Godot export (overworld_game.gd):
//   arrow keys / WASD   walk the world map one tile at a time (water, mountains, tunnels block)
//   town gate           step on it to enter the town's Easy Scene street (towns/<scene>/*.pixi.json)
//   street end / Esc    walk off an exit end of the street to come back out at the gate
//   station + Enter     pick a destination (◀ ▶), Enter rides the train, Esc cancels
//   N                   day / night (baked night textures, lit windows, glow); in a town it swaps the street
//                       to its night export (towns/<scene>/<scene>_night.pixi.json) when there is one
//
//   import { loadTilemap } from "./easytilemap-pixi.js";
//   import { startOverworld } from "./easytilemap-overworld.js";
//   const game = await startOverworld(PIXI, app, { tilemap: "./world.tilemap.json", data: "./overworld/overworld.json", hud: el });
//   game.state() · game.step(dx, dy) · game.teleport(x, y) · game.enterTown(id) · game.leaveTown()
//   game.rideTrain(toId) · game.setNight(on) · game.on(event, fn)   (events: town_entered, town_left, train_arrived, night)
import { loadTilemap } from "./easytilemap-pixi.js";

const STEP_TIME = 0.16;
const TRAIN_SPEED = 120;
const CAR_GAP = 15;
const TOWN_SPEED = 72;
const NIGHT_TINT = 0x9ea8e6;

export async function startOverworld(PIXI, app, opts) {
  const base = new URL(opts.data, location.href);
  const rel = (p) => new URL(p, base.href.replace(/overworld\/[^/]*$/, "")).href;
  const data = await (await fetch(base)).json();
  const map = await loadTilemap(PIXI, opts.tilemap);
  const ts = data.tileSize;
  const vw = data.viewport.width;
  const vh = data.viewport.height;
  const nearest = (t) => {
    t.source.scaleMode = "nearest";
    return t;
  };
  const load = async (p) => nearest(await PIXI.Assets.load(rel(p)));
  const listeners = {};
  const emit = (ev, v) => (listeners[ev] ?? []).forEach((f) => f(v));

  const stage = new PIXI.Container();
  app.stage.addChild(stage);
  stage.addChild(map.view);
  const fade = new PIXI.Graphics().rect(0, 0, vw, vh).fill(0x000000);
  fade.alpha = 0;
  app.stage.addChild(fade);

  const key = (x, y) => `${x},${y}`;
  const townById = new Map(data.towns.map((t) => [t.id, t]));
  const entrance = new Map(data.towns.map((t) => [key(...t.entrance), t.id]));
  const station = new Map(data.towns.filter((t) => t.station).map((t) => [key(...t.station), t.id]));
  const tunnels = new Set((data.tunnels ?? []).map(([x, y]) => key(x, y)));
  const blocked = (x, y) => y < 0 || x < 0 || y >= data.blocked.length || x >= data.blocked[0].length || data.blocked[y][x] === "#";

  // ---------------------------------------------------------------- player
  const frames = async (spec, dirs) => {
    const sheet = await load(spec.image);
    const fs = spec.frameSize;
    const out = {};
    for (const d of dirs) {
      let rd = d;
      let flip = false;
      if (!(d in spec.rows)) {
        if (d === "left" && "right" in spec.rows) {
          rd = "right";
          flip = true;
        } else continue;
      }
      const row = spec.rows[rd];
      const f = (col) => new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(col * fs, row * fs, fs, fs) });
      out[d] = { idle: [f(spec.idle)], walk: spec.walk.map(f), flip };
    }
    return out;
  };
  let player;
  let playerFrames = null;
  if (data.player) {
    const placed = map.characters.get(data.player.name);
    if (placed) placed.sprite.destroy();
    playerFrames = await frames(data.player, ["front", "right", "back", "left"]);
    player = new PIXI.AnimatedSprite(playerFrames.front.idle);
    player.anchor.set(0.5, data.player.groundRow / data.player.frameSize);
    player.animationSpeed = 8 / 60;
  } else {
    player = new PIXI.Graphics().rect(-5, -12, 10, 12).fill(0xe04a32);
  }
  map.world.addChild(player);
  let facing = "front";
  let anim = "idle";
  const setAnim = (a, f = facing) => {
    if (!playerFrames) return;
    const r = playerFrames[f] ?? playerFrames.front;
    if (a === anim && f === facing && player.playing === (a === "walk")) return;
    facing = f;
    anim = a;
    player.textures = r[a];
    player.scale.x = r.flip ? -1 : 1;
    if (a === "walk") player.play();
    else player.gotoAndStop(0);
  };
  const feet = (x, y) => [x * ts + ts / 2, y * ts + ts - 1];

  // ---------------------------------------------------------------- HUD (DOM: crisp Thai text)
  const hud = opts.hud ?? null;
  // only kampungs have Malay names; Thai and Chinese-Thai towns keep their own name in every language
  // (older maps may still carry a translated "ms" for those: not shown)
  const title = (t) => `${t.name.th} · ${t.name.en}${t.name.ms && t.name.ms !== t.name.en && t.kind === "malay_kampung" ? ` · ${t.name.ms}` : ""}`;
  const region = (id) => {
    const r = data.regions.find((x) => x.id === id);
    return r ? `${r.name.th} · ${r.name.en}` : id;
  };
  const setHud = (top, hint = "") => {
    if (!hud) return;
    hud.querySelector(".ow-top").textContent = top;
    hud.querySelector(".ow-hint").textContent = hint;
  };

  // ---------------------------------------------------------------- state
  const s = {
    mode: "overworld", // overworld | menu | town | train | fading
    tile: [0, 0],
    town: "",
    night: false,
    move: null,
    path: [],
    menu: [],
    menuIndex: 0,
    keys: new Set(),
    townDir: 0,
    hiddenInTunnel: false,
    townScene: null,
  };
  const startTown = townById.get(data.start) ?? data.towns[0];
  const place = () => {
    const [px, py] = feet(...s.tile);
    player.position.set(px, py);
    player.zIndex = py;
    setAnim("idle");
  };
  s.tile = [...startTown.entrance];
  place();
  setHud(`${title(startTown)}\n${region(startTown.region)}`);

  const fadeTo = (a, time = 0.3) =>
    new Promise((ok) => {
      const from = fade.alpha;
      let t = 0;
      const tick = (tk) => {
        t += tk.deltaMS / 1000;
        fade.alpha = from + (a - from) * Math.min(1, t / time);
        if (t >= time) {
          app.ticker.remove(tick);
          ok();
        }
      };
      app.ticker.add(tick);
    });

  function step(dx, dy) {
    if (s.mode !== "overworld" || s.move) return false;
    const f = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "front" : "back";
    const nx = s.tile[0] + dx;
    const ny = s.tile[1] + dy;
    if (blocked(nx, ny)) {
      setAnim("idle", f);
      return false;
    }
    const [fx, fy] = feet(...s.tile);
    const [tx, ty] = feet(nx, ny);
    s.move = { fx, fy, tx, ty, t: 0, to: [nx, ny] };
    setAnim("walk", f);
    return true;
  }
  function arrived() {
    const k = key(...s.tile);
    if (entrance.has(k)) enterTown(entrance.get(k));
    else if (station.has(k)) {
      const t = townById.get(station.get(k));
      setHud(`${title(t)}\n${region(t.region)}`, `สถานี ${t.name.th} · ${t.name.en} station — Enter: ride the train`);
    } else if (s.mode === "overworld") setHud(hud ? hud.querySelector(".ow-top").textContent : "", "");
  }
  function teleport(x, y, f = "front") {
    s.tile = [x, y];
    s.move = null;
    facing = f;
    place();
  }

  // ---------------------------------------------------------------- towns (Easy Scene Pixi exports)
  async function enterTown(id) {
    const t = townById.get(id);
    if (!t || s.mode === "fading") return;
    s.mode = "fading";
    s.path = [];
    await fadeTo(1);
    map.view.visible = false;
    const info = data.townScenes?.[t.scene] ?? null;
    let scene = null;
    if (info) {
      try {
        scene = await loadStreet(info, s.night);
      } catch (e) {
        console.warn(`town ${t.scene}: ${e}`);
      }
    }
    s.townScene = makeTown(t, scene);
    await s.townScene.ready;
    stage.addChild(s.townScene.root);
    s.town = id;
    setHud(`${title(t)}\n${region(t.region)}`, "◀ ▶ walk · Esc: back to the map");
    s.mode = "town";
    emit("town_entered", id);
    await fadeTo(0);
  }

  // the town's street: its night export (Easy Scene --night, <scene>_night.pixi.json) at night when there is one
  async function loadStreet(info, night) {
    const mod = await import(rel(info.loader));
    return mod.loadEasyScene(PIXI, rel(night && info.night ? info.night : info.json));
  }

  /** N inside a town: reload the street as day / night, keeping the player where it is. */
  async function swapStreet(on) {
    const town = s.townScene;
    const info = data.townScenes?.[townById.get(s.town)?.scene] ?? null;
    if (!town?.scene || !info?.night) return;
    const want = on ? info.night : info.json;
    if (town.sceneJson === want) return;
    const next = await loadStreet(info, on);
    if (s.townScene !== town || town.exiting || s.night !== on) {
      next.root.destroy({ children: true });
      return;
    }
    const old = town.scene;
    town.root.addChildAt(next.root, 0);
    (next.charLayers?.main ?? next.world).addChild(town.holder);
    town.scene = next;
    town.sceneJson = want;
    town.root.removeChild(old.root);
    old.root.destroy({ children: true });
    next.setCamera(town.camX ?? 0);
  }

  function makeTown(t, scene) {
    const root = new PIXI.Container();
    let width = 960;
    let surface = () => vh - 3 * ts;
    let exitL = true;
    let exitR = true;
    if (scene) {
      root.addChild(scene.root);
      const j = scene.json;
      width = j.size.width;
      const codes = j.tilemap.codes;
      const tsz = j.tileSize;
      surface = (px) => {
        const col = Math.max(0, Math.min(j.tilemap.width - 1, Math.floor(px / tsz)));
        for (let y = 0; y < codes.length; y++) {
          const c = codes[y][col];
          if (c === "#") return y * tsz;
          if (c === "/" || c === "\\") return y * tsz + tsz / 2;
        }
        return codes.length * tsz;
      };
      if (Array.isArray(j.exits) && j.exits.length) {
        exitL = j.exits.some((e) => e.side === "left");
        exitR = j.exits.some((e) => e.side === "right");
      }
    } else {
      root.addChild(new PIXI.Graphics().rect(0, 0, width, vh).fill(0x6aa0d8).rect(0, vh - 3 * ts, width, 3 * ts).fill(0x8a6440));
    }
    const holder = new PIXI.Container();
    if (scene) (scene.charLayers?.main ?? scene.world).addChild(holder);
    else root.addChild(holder);
    const info = data.townScenes?.[t.scene] ?? null;
    const town = { root, x: 24, dir: "right", width, scene, holder, sprite: null, exitL, exitR, exiting: false };
    town.sceneJson = scene && info ? (s.night && info.night ? info.night : info.json) : null;
    town.ready = (async () => {
      if (data.sidePlayer) {
        const fr = await frames(data.sidePlayer, ["right", "left"]);
        const sp = new PIXI.AnimatedSprite(fr.right.idle);
        sp.anchor.set(0.5, (data.sidePlayer.groundRow + 1) / data.sidePlayer.frameSize);
        sp.animationSpeed = 8 / 60;
        town.frames = fr;
        town.sprite = sp;
      } else town.sprite = new PIXI.Graphics().rect(-6, -30, 12, 30).fill(0xe04a32);
      if (s.night) town.sprite.tint = NIGHT_TINT;
      holder.addChild(town.sprite);
    })();
    town.anim = (a) => {
      if (!town.frames) return;
      const r = town.frames[town.dir] ?? town.frames.right;
      if (town.sprite.textures !== r[a]) {
        town.sprite.textures = r[a];
        town.sprite.scale.x = r.flip ? -1 : 1;
        if (a === "walk") town.sprite.play();
        else town.sprite.gotoAndStop(0);
      }
    };
    town.update = (dt) => {
      if (town.exiting) return;
      const k = s.keys;
      let d = s.townDir || (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      if (d) {
        town.dir = d > 0 ? "right" : "left";
        town.x += d * TOWN_SPEED * dt;
        town.anim("walk");
      } else town.anim("idle");
      if (!exitL) town.x = Math.max(8, town.x);
      if (!exitR) town.x = Math.min(width - 8, town.x);
      town.sprite.position.set(Math.round(town.x), surface(town.x));
      const camX = Math.max(0, Math.min(width - vw, town.x - vw / 2));
      town.camX = camX;
      if (town.scene) {
        town.scene.setCamera(camX);
        town.scene.update(dt);
      } else root.x = -camX;
      if ((exitL && town.x < 4) || (exitR && town.x > width - 4)) leaveTown();
    };
    return town;
  }

  async function leaveTown() {
    if (s.mode !== "town") return;
    const id = s.town;
    s.townScene.exiting = true;
    s.townDir = 0;
    s.mode = "fading";
    await fadeTo(1);
    s.townScene.root.destroy({ children: true });
    s.townScene = null;
    map.view.visible = true;
    const t = townById.get(id);
    teleport(...t.entrance, "front");
    s.town = "";
    setHud(`${title(t)}\n${region(t.region)}`);
    s.mode = "overworld";
    emit("town_left", id);
    await fadeTo(0);
  }

  // ---------------------------------------------------------------- train
  const trainsFrom = (id) => data.trains.filter((tr) => tr.from === id).map((tr) => tr.to);
  let trainTex = null;
  const train = { cars: [], path: [], dist: 0, to: "" };
  function openMenu() {
    const here = station.get(key(...s.tile));
    s.menu = here ? trainsFrom(here) : [];
    if (!s.menu.length) {
      setHud(hud ? hud.querySelector(".ow-top").textContent : "", "No trains from here");
      return false;
    }
    s.menuIndex = 0;
    s.mode = "menu";
    showMenu();
    return true;
  }
  const showMenu = () => setHud(hud ? hud.querySelector(".ow-top").textContent : "", `รถไฟไป · Train to: ◀ ${title(townById.get(s.menu[s.menuIndex]))} ▶   Enter: ride · Esc: cancel`);
  async function rideTrain(to) {
    const here = station.get(key(...s.tile));
    const route = data.trains.find((tr) => tr.from === here && tr.to === to);
    if (!route) return false;
    s.mode = "fading";
    await fadeTo(1);
    if (!trainTex) {
      const src = (await load(data.train)).source;
      trainTex = [0, 16, 32, 48].map((x) => new PIXI.Texture({ source: src, frame: new PIXI.Rectangle(x, 0, 16, 16) }));
    }
    train.path = route.path.map(([x, y]) => [x * ts + ts / 2, y * ts + ts / 2]);
    train.dist = 0;
    train.to = to;
    player.visible = false;
    for (let i = 0; i < 3; i++) {
      const c = new PIXI.Sprite(trainTex[0]);
      c.anchor.set(0.5);
      c.zIndex = 1e6;
      if (s.night) c.tint = NIGHT_TINT;
      map.world.addChild(c);
      train.cars.push(c);
    }
    advanceTrain(0);
    setHud(`รถไฟ → ${title(townById.get(to))}`);
    s.mode = "train";
    await fadeTo(0, 0.25);
    return true;
  }
  const sample = (d) => {
    const p = train.path;
    if (p.length < 2) return [p[0] ?? [0, 0], [1, 0]];
    d = Math.max(0, Math.min(ts * (p.length - 1), d));
    const i = Math.min(Math.floor(d / ts), p.length - 2);
    const f = (d - i * ts) / ts;
    const a = p[i];
    const b = p[i + 1];
    return [[a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]];
  };
  function advanceTrain(dt) {
    train.dist += TRAIN_SPEED * dt;
    train.cars.forEach((c, i) => {
      const [[x, y], [dx, dy]] = sample(train.dist - i * CAR_GAP);
      c.position.set(x, y);
      const loco = i === 0;
      const ew = Math.abs(dx) >= Math.abs(dy);
      c.texture = trainTex[ew ? (loco ? 0 : 1) : loco ? 2 : 3];
      c.scale.set(ew && dx < 0 ? -1 : 1, !ew && dy < 0 ? -1 : 1);
      c.visible = !tunnels.has(key(Math.floor(x / ts), Math.floor(y / ts)));
      if (!c.visible) s.hiddenInTunnel = true;
    });
    if (s.mode === "train" && train.dist >= ts * (train.path.length - 1)) finishTrain();
  }
  async function finishTrain() {
    s.mode = "fading";
    await fadeTo(1);
    train.cars.forEach((c) => c.destroy());
    train.cars = [];
    const t = townById.get(train.to);
    player.visible = true;
    teleport(...t.station, "front");
    setHud(`${title(t)}\n${region(t.region)}`);
    s.mode = "overworld";
    emit("train_arrived", train.to);
    await fadeTo(0);
  }

  // ---------------------------------------------------------------- night
  const day = { ground: null, objects: new Map() };
  let glow = null;
  let nightAtlas = null;
  async function setNight(on) {
    const nd = data.night;
    if (!nd || on === s.night) return false;
    s.night = on;
    nightAtlas ??= await load(nd.atlas);
    const layers = [map.view.children[0], map.view.children[1]];
    for (const layer of layers) {
      for (const sp of layer.children) {
        if (on) {
          if (!sp._dayTex) sp._dayTex = sp.texture;
          sp.texture = new PIXI.Texture({ source: nightAtlas.source, frame: sp._dayTex.frame.clone() });
        } else if (sp._dayTex) sp.texture = sp._dayTex;
      }
    }
    const objs = map.json.objects;
    const sprites = [...map.view.children[2].children, ...map.world.children];
    for (const sp of sprites) {
      const o = objs.find((x) => (x.name ?? x.kind) === sp.label);
      if (!o) continue;
      const nightImg = nd.objects[o.image];
      if (!nightImg) continue;
      if (on) {
        sp._dayTex ??= sp.texture;
        sp.texture = await load(nightImg);
      } else if (sp._dayTex) sp.texture = sp._dayTex;
    }
    if (!glow && nd.glow) {
      glow = new PIXI.Sprite(await load(nd.glow));
      glow.blendMode = "add";
      map.view.addChild(glow);
    }
    if (glow) glow.visible = on;
    const tint = on ? NIGHT_TINT : 0xffffff;
    player.tint = tint;
    train.cars.forEach((c) => (c.tint = tint));
    if (s.townScene?.sprite) s.townScene.sprite.tint = tint;
    if (s.mode === "town") await swapStreet(on);
    emit("night", on);
    return true;
  }

  // ---------------------------------------------------------------- input + loop
  const target = opts.keyTarget ?? window;
  target.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k.startsWith("arrow")) e.preventDefault();
    if (e.repeat && (k === "enter" || k === "escape" || k === "n")) return;
    s.keys.add(k);
    if (k === "n" && s.mode !== "fading") setNight(!s.night);
    else if (s.mode === "overworld" && !s.move && k === "enter" && station.has(key(...s.tile))) openMenu();
    else if (s.mode === "menu") {
      if (k === "arrowleft" || k === "arrowup") s.menuIndex = (s.menuIndex - 1 + s.menu.length) % s.menu.length, showMenu();
      else if (k === "arrowright" || k === "arrowdown") s.menuIndex = (s.menuIndex + 1) % s.menu.length, showMenu();
      else if (k === "enter") rideTrain(s.menu[s.menuIndex]);
      else if (k === "escape") s.mode = "overworld", setHud(hud ? hud.querySelector(".ow-top").textContent : "", "");
    } else if (s.mode === "town" && k === "escape") leaveTown();
  });
  target.addEventListener("keyup", (e) => s.keys.delete(e.key.toLowerCase()));

  const heldDir = () => {
    const k = s.keys;
    if (k.has("arrowright") || k.has("d")) return [1, 0];
    if (k.has("arrowleft") || k.has("a")) return [-1, 0];
    if (k.has("arrowdown") || k.has("s")) return [0, 1];
    if (k.has("arrowup") || k.has("w")) return [0, -1];
    return null;
  };
  const camera = (x, y) => map.setCamera(x, y, vw, vh);
  app.ticker.add((tk) => {
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    map.update(dt);
    if (s.mode === "overworld") {
      if (s.move) {
        const m = s.move;
        m.t += dt / STEP_TIME;
        const f = Math.min(1, m.t);
        player.position.set(m.fx + (m.tx - m.fx) * f, m.fy + (m.ty - m.fy) * f);
        player.zIndex = player.y;
        if (f >= 1) {
          s.tile = m.to;
          s.move = null;
          arrived();
        }
      } else {
        while (s.path.length && s.path[0][0] === s.tile[0] && s.path[0][1] === s.tile[1]) s.path.shift();
        const d = s.path.length ? [Math.sign(s.path[0][0] - s.tile[0]), Math.sign(s.path[0][1] - s.tile[1])] : heldDir();
        if (d) step(d[0], d[1]);
        else setAnim("idle");
      }
    } else if (s.mode === "train") advanceTrain(dt);
    else if (s.mode === "town" && s.townScene) s.townScene.update(dt);
    if (s.mode === "train" && train.cars.length) camera(train.cars[0].x, train.cars[0].y);
    else if (s.mode !== "town") camera(player.x, player.y - 8);
  });
  camera(player.x, player.y - 8);

  const game = {
    data,
    map,
    state: () => ({
      mode: s.mode,
      tile: [...s.tile],
      town: s.town,
      night: s.night,
      townX: s.townScene ? s.townScene.x : null,
      townWidth: s.townScene ? s.townScene.width : null,
      townLoaded: Boolean(s.townScene?.scene),
      townNight: s.townScene?.scene?.json?.lighting === "night",
      trainCars: train.cars.length,
      hiddenInTunnel: s.hiddenInTunnel,
      menu: s.mode === "menu" ? [...s.menu] : [],
    }),
    step,
    teleport,
    walkPath: (cells) => (s.path = cells.map((c) => [...c])),
    enterTown,
    leaveTown,
    setTownDir: (d) => (s.townDir = d),
    openMenu,
    rideTrain,
    trainsFrom,
    setNight,
    on: (ev, fn) => ((listeners[ev] ??= []).push(fn), game),
  };
  if (data.night?.start) await setNight(true);
  return game;
}
