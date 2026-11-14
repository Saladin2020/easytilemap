// Easy Tilemap — PixiJS v8 loader (no dependencies besides the PIXI global you pass in). MIT.
//
//   import { loadTilemap } from "./easytilemap-pixi.js";
//   const map = await loadTilemap(PIXI, "./thai_village_topdown.tilemap.json");
//   app.stage.addChild(map.view);
//   app.ticker.add((t) => map.update(t.deltaMS / 1000));
//
// map.view      Container: ground + decor + floor objects + y-sorted world (objects and characters)
// map.world     the y-sorted Container (add your own sprites; set zIndex = feet y)
// map.isBlocked(px, py)   collision query in map pixels (water, solid objects, painted collision)
// map.spawn(name)         { x, y, facing } in px (tile centre) or undefined
// map.characters          Map name → { sprite, face(dir), walk(on) }
// map.control(name, keys) arrow keys / WASD walk that character with collision; returns a controller
// map.follow(sprite, viewW, viewH)  keep the camera on a sprite (clamped to the map)

const DIRS = ["front", "right", "back", "left"];

function facingToward(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "back" : "front";
}

export async function loadTilemap(PIXI, url, opts = {}) {
  const base = new URL(url, location.href);
  const json = await (await fetch(base)).json();
  const rel = (p) => new URL(p, base).href;
  const nearest = (tex) => {
    tex.source.scaleMode = "nearest";
    return tex;
  };
  const ts = json.tileSize;
  const atlas = nearest(await PIXI.Assets.load(rel(json.atlas.image)));
  const tileTex = new Map();
  const tile = (index) => {
    let t = tileTex.get(index);
    if (!t) {
      const col = index % json.atlas.columns;
      const row = Math.floor(index / json.atlas.columns);
      t = new PIXI.Texture({ source: atlas.source, frame: new PIXI.Rectangle(col * ts, row * ts, ts, ts) });
      tileTex.set(index, t);
    }
    return t;
  };

  const view = new PIXI.Container();
  view.label = json.id;
  const ground = new PIXI.Container();
  const decor = new PIXI.Container();
  const floor = new PIXI.Container();
  const world = new PIXI.Container();
  world.sortableChildren = true;
  view.addChild(ground, decor, floor, world);

  for (let y = 0; y < json.height; y++) {
    for (let x = 0; x < json.width; x++) {
      const g = json.ground[y * json.width + x];
      const s = new PIXI.Sprite(tile(g));
      s.position.set(x * ts, y * ts);
      ground.addChild(s);
      const d = json.decor[y * json.width + x];
      if (d >= 0) {
        const ds = new PIXI.Sprite(tile(d));
        ds.position.set(x * ts, y * ts);
        decor.addChild(ds);
      }
    }
  }

  const objTex = new Map();
  for (const o of json.objects) {
    if (!objTex.has(o.image)) objTex.set(o.image, nearest(await PIXI.Assets.load(rel(o.image))));
    const s = new PIXI.Sprite(objTex.get(o.image));
    s.label = o.name ?? o.kind;
    if (o.flipX) {
      s.scale.x = -1;
      s.position.set(o.x + o.w, o.y);
    } else s.position.set(o.x, o.y);
    if (o.floor) floor.addChild(s);
    else {
      s.zIndex = o.base;
      world.addChild(s);
    }
  }

  const characters = new Map();
  const actors = [];
  for (const c of json.characters) {
    const sheet = nearest(await PIXI.Assets.load(rel(c.image)));
    const fs = c.layout.frameSize;
    const frame = (col, row) => new PIXI.Texture({ source: sheet.source, frame: new PIXI.Rectangle(col * fs, row * fs, fs, fs) });
    const rows = {};
    for (const dir of DIRS) {
      let row = c.layout.directions.indexOf(dir);
      let flip = false;
      if (row < 0 && dir === "left") {
        row = c.layout.directions.indexOf("right");
        flip = true;
      }
      if (row < 0) row = 0;
      rows[dir] = { idle: [frame(c.idleColumn, row)], walk: c.walkColumns.map((col) => frame(col, row)), flip };
    }
    const sprite = new PIXI.AnimatedSprite(rows[c.facing].idle);
    sprite.label = c.name;
    sprite.anchor.set(0.5, c.groundRow / fs);
    sprite.animationSpeed = 0.1;
    sprite.position.set(c.x, c.y);
    sprite.zIndex = c.y;
    world.addChild(sprite);
    const actor = { c, sprite, dir: c.facing, walking: c.anim === "walk", patrolIndex: 0 };
    const apply = () => {
      const r = rows[actor.dir];
      sprite.textures = actor.walking ? r.walk : r.idle;
      sprite.scale.x = r.flip ? -1 : 1;
      if (actor.walking) sprite.play();
      else sprite.gotoAndStop(0);
    };
    actor.face = (dir) => {
      if (dir !== actor.dir) {
        actor.dir = dir;
        apply();
      }
    };
    actor.walk = (on) => {
      if (on !== actor.walking) {
        actor.walking = on;
        apply();
      }
    };
    apply();
    characters.set(c.name, actor);
    actors.push(actor);
  }

  const isBlocked = (px, py) => {
    const tx = Math.floor(px / ts);
    const ty = Math.floor(py / ts);
    if (tx < 0 || ty < 0 || tx >= json.width || ty >= json.height) return true;
    return json.collision[ty][tx] === "#";
  };

  const controllers = [];
  const keys = new Set();
  let keysBound = false;
  const bindKeys = (target = window) => {
    if (keysBound) return;
    keysBound = true;
    target.addEventListener("keydown", (e) => {
      keys.add(e.key.toLowerCase());
      if (e.key.startsWith("Arrow")) e.preventDefault();
    });
    target.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  };

  const map = {
    json,
    view,
    world,
    characters,
    isBlocked,
    keys,
    spawn: (name) => json.spawns.find((s) => s.name === name),
    camera: { x: 0, y: 0 },
    setCamera(x, y, vw = json.viewport.width, vh = json.viewport.height) {
      const mw = json.width * ts;
      const mh = json.height * ts;
      const cx = Math.max(0, Math.min(Math.max(0, mw - vw), Math.round(x - vw / 2)));
      const cy = Math.max(0, Math.min(Math.max(0, mh - vh), Math.round(y - vh / 2)));
      map.camera = { x: cx, y: cy };
      view.position.set(-cx, -cy);
    },
    follow(sprite, vw, vh) {
      map._follow = { sprite, vw, vh };
    },
    /** Walk a character with arrow keys / WASD (speed px/s) and collision on its feet. */
    control(name, { speed = 60, target = window } = {}) {
      const actor = characters.get(name);
      if (!actor) throw new Error(`No character "${name}"`);
      actor.c.patrol = null;
      bindKeys(target);
      const ctl = { actor, speed, moved: 0 };
      controllers.push(ctl);
      return ctl;
    },
    update(dt) {
      for (const a of actors) {
        const p = a.c.patrol;
        if (!p || p.path.length < 2 || !(p.speed > 0)) continue;
        const [tx, ty] = p.path[a.patrolIndex];
        const dx = tx - a.sprite.x;
        const dy = ty - a.sprite.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        if (dist <= step) {
          a.sprite.position.set(tx, ty);
          a.patrolIndex = (a.patrolIndex + 1) % p.path.length;
        } else {
          a.sprite.position.set(a.sprite.x + (dx / dist) * step, a.sprite.y + (dy / dist) * step);
          a.face(facingToward(dx, dy));
        }
        a.walk(true);
        a.sprite.zIndex = a.sprite.y;
      }
      for (const ctl of controllers) {
        const k = keys;
        const dx = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
        const dy = (k.has("arrowdown") || k.has("s") ? 1 : 0) - (k.has("arrowup") || k.has("w") ? 1 : 0);
        const s = ctl.actor.sprite;
        if (!dx && !dy) {
          ctl.actor.walk(false);
          continue;
        }
        const len = Math.hypot(dx, dy);
        const step = ctl.speed * dt;
        const nx = s.x + (dx / len) * step;
        const ny = s.y + (dy / len) * step;
        // feet box: 8px wide, 3px tall
        const free = (x, y) => !isBlocked(x - 4, y - 2) && !isBlocked(x + 3, y - 2) && !isBlocked(x - 4, y) && !isBlocked(x + 3, y);
        if (free(nx, s.y)) s.x = nx;
        if (free(s.x, ny)) s.y = ny;
        ctl.moved += step;
        ctl.actor.face(facingToward(dx, dy));
        ctl.actor.walk(true);
        s.zIndex = s.y;
      }
      if (map._follow) map.setCamera(map._follow.sprite.x, map._follow.sprite.y - 8, map._follow.vw, map._follow.vh);
    },
  };
  return map;
}
