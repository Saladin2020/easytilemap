"""Headless Chrome check of a PixiJS overworld export (same flow as the Godot test_overworld.gd):
walk onto a town gate with the arrow keys → the town's Easy Scene side view loads → walk in it → walk off
the exit end back to the gate → station Enter → train menu → ride (hidden in tunnels) → arrive → N night →
enter the town at night (night street when exported with --night) → N inside the town swaps day / night.

  python3 scripts/check-pixi-overworld.py <pixi-export-dir> [shots-prefix] [--video DIR]

ALLOW_PLACEHOLDER_TOWNS=1 accepts placeholder streets (export made without --town-scenes).
Copies nothing into the export: serve it with ./pixi.min.js present (or network for the CDN fallback).
Prints RESULT {...} and exits 1 when a check fails.
"""
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

args = [a for a in sys.argv[1:]]
video = None
if "--video" in args:
    i = args.index("--video")
    video = args[i + 1]
    del args[i : i + 2]
DIR = args[0]
PREFIX = args[1] if len(args) > 1 else "/tmp/ow-pixi"
PORT = int(os.environ.get("PORT", "8979"))
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
DIRS = {(1, 0): "ArrowRight", (-1, 0): "ArrowLeft", (0, 1): "ArrowDown", (0, -1): "ArrowUp"}


async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"), args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        ctx_args = {"viewport": {"width": 1500, "height": 900}}
        if video:
            ctx_args["record_video_dir"] = video
            ctx_args["record_video_size"] = {"width": 1440, "height": 810}
            ctx_args["viewport"] = {"width": 1440, "height": 810}
        ctx = await b.new_context(**ctx_args)
        pg = await ctx.new_page()
        errs, missing = [], []
        pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("response", lambda r: missing.append(r.url) if r.status == 404 else None)
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html")
        await pg.wait_for_function("window.__ready === true", timeout=60000)
        await pg.wait_for_timeout(600)
        st = lambda: pg.evaluate("window.__ow.state()")
        data = await pg.evaluate("({towns: __ow.data.towns, trains: __ow.data.trains.map(t => ({from: t.from, to: t.to, tunnel: t.path.some(([x, y]) => __ow.data.tunnels.some(([a, b]) => a === x && b === y))})), blocked: __ow.data.blocked, start: __ow.data.start, demo: __ow.data.demo})")
        towns = {t["id"]: t for t in data["towns"]}
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-map.png")
        s0 = await st()
        out["start_mode"] = s0["mode"]

        # 0. party followers + minimap / world map
        await pg.evaluate("async () => { if (__ow.data.player) { await __ow.addFollower(__ow.data.player); await __ow.addFollower(__ow.data.player); } }")
        mm = await pg.evaluate("() => { const c = new PIXI.Container(); const m = __ow.minimap(c, { cell: 2 }); const w = __ow.worldMap(c, { cell: 4 }); return { mini: m.children.length, world: w.children.length, towns: __ow.data.towns.length, grid: __ow.minimapGrid().join('').split('T').length - 1 }; }")
        out["minimap"] = mm["mini"] >= 3 and mm["world"] >= 3 + mm["towns"] and mm["grid"] == mm["towns"]

        # 1. walk off the start gate and back onto it with real key presses
        ex, ey = s0["tile"]
        free = [(dx, dy) for (dx, dy) in DIRS if data["blocked"][ey + dy][ex + dx] == "."]
        dx, dy = free[0]
        await pg.keyboard.press(DIRS[(dx, dy)])
        await pg.wait_for_function("!__ow.state().tile.every((v, i) => v === %s[i])" % json.dumps([ex, ey]), timeout=5000)
        await pg.wait_for_timeout(250)
        sst = await st()
        out["stepped"] = sst["tile"] == [ex + dx, ey + dy]
        out["followers_trail"] = sst["followers"] == [[ex, ey], [ex, ey]]
        await pg.keyboard.press(DIRS[(-dx, -dy)])
        await pg.wait_for_function("__ow.state().mode === 'town'", timeout=20000)
        await pg.wait_for_timeout(700)
        s1 = await st()
        out["entered"] = s1["town"]
        out["town_loaded"] = s1["townLoaded"]
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-town.png")

        # 2. walk inside the street
        x0 = s1["townX"]
        await pg.keyboard.down("ArrowRight")
        await pg.wait_for_timeout(1500)
        await pg.keyboard.up("ArrowRight")
        s2 = await st()
        out["walked_in_town"] = s2["townX"] > x0 + 40
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-town-walk.png")

        # 3. walk back out of the left end → back on the gate on the world map
        await pg.keyboard.down("ArrowLeft")
        await pg.wait_for_function("__ow.state().mode !== 'town'", timeout=20000)
        await pg.keyboard.up("ArrowLeft")
        await pg.wait_for_function("__ow.state().mode === 'overworld'", timeout=10000)
        s3 = await st()
        out["back_on_entrance"] = s3["tile"] == towns[s1["town"]]["entrance"] and s3["town"] == ""

        # 4. station → Enter → menu → ride (a tunnel line when there is one)
        trains = data["trains"]
        pick = next((t for t in trains if t["tunnel"]), None) or (trains[0] if trains else None)
        out["tunnel_route"] = bool(pick and pick["tunnel"])
        if pick:
            stn = towns[pick["from"]]["station"]
            await pg.evaluate(f"__ow.teleport({stn[0]}, {stn[1]})")
            await pg.wait_for_timeout(200)
            await pg.keyboard.press("Enter")
            await pg.wait_for_function("__ow.state().mode === 'menu'", timeout=5000)
            menu = (await st())["menu"]
            out["menu"] = menu
            for _ in range(menu.index(pick["to"])):
                await pg.keyboard.press("ArrowRight")
            await pg.locator("canvas").screenshot(path=f"{PREFIX}-menu.png")
            await pg.keyboard.press("Enter")
            await pg.wait_for_function("__ow.state().mode === 'train'", timeout=10000)
            await pg.wait_for_timeout(800)
            out["train_cars"] = (await st())["trainCars"]
            await pg.locator("canvas").screenshot(path=f"{PREFIX}-train.png")
            await pg.wait_for_function("__ow.state().mode === 'overworld'", timeout=90000)
            s4 = await st()
            out["arrived"] = s4["tile"] == towns[pick["to"]]["station"]
            out["hidden_in_tunnel"] = s4["hiddenInTunnel"]

        # 5. night toggle
        day = await pg.locator("canvas").screenshot(path=f"{PREFIX}-day.png")
        await pg.keyboard.press("n")
        await pg.wait_for_function("__ow.state().night === true", timeout=10000)
        await pg.wait_for_timeout(400)
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-night.png")
        lum = await pg.evaluate("""async () => {
          const l = async (u) => { const im = new Image(); im.src = u; await im.decode(); const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, im.width, im.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i+1] + d[i+2]; return s / (d.length / 4) / 3; };
          return [await l(__day), await l(__night)];
        }""".replace("__day", json.dumps("data:image/png;base64," + __import__("base64").b64encode(day).decode())).replace("__night", json.dumps("data:image/png;base64," + __import__("base64").b64encode(open(f"{PREFIX}-night.png", "rb").read()).decode())))
        out["night_darker"] = lum[1] < lum[0] * 0.8
        out["luma_day_night"] = [round(v, 1) for v in lum]

        # 6. a town at night: entering shows its night street (when exported with --night), N swaps it in place
        tid = s1["town"]
        has_night = await pg.evaluate("(id) => Boolean(__ow.data.townScenes?.[__ow.data.towns.find((t) => t.id === id).scene]?.night)", tid)
        out["town_night_export"] = has_night
        await pg.evaluate("(id) => __ow.enterTown(id)", tid)
        await pg.wait_for_function("__ow.state().mode === 'town'", timeout=20000)
        await pg.wait_for_timeout(600)
        sn = await st()
        out["town_night_on_enter"] = sn["townNight"]
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-town-night.png")
        await pg.keyboard.down("ArrowRight")
        await pg.wait_for_timeout(600)
        await pg.keyboard.up("ArrowRight")
        xa = (await st())["townX"]
        await pg.keyboard.press("n")
        await pg.wait_for_function("__ow.state().night === false", timeout=10000)
        await pg.wait_for_timeout(500)
        sd = await st()
        out["town_day_after_n"] = not sd["townNight"] and sd["mode"] == "town"
        out["town_x_kept"] = abs(sd["townX"] - xa) < 1
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-town-day-toggle.png")
        await pg.keyboard.press("n")
        await pg.wait_for_function("__ow.state().night === true", timeout=10000)
        await pg.wait_for_timeout(500)
        out["town_night_after_n"] = (await st())["townNight"]
        await pg.keyboard.press("Escape")
        await pg.wait_for_function("__ow.state().mode === 'overworld'", timeout=20000)
        await pg.keyboard.press("n")
        await pg.wait_for_function("__ow.state().night === false", timeout=10000)
        out["day_restored"] = True

        # 7. town life (maps exported with --airports): fly between airports, planes fly over, flood slows walking
        aps = await pg.evaluate("__ow.state().airports")
        out["airports"] = aps
        if len(aps) >= 2:
            await pg.evaluate("(id) => { const a = __ow.data.airports.find((x) => x.id === id); __ow.teleport(a.tile[0], a.tile[1]); }", aps[0])
            await pg.evaluate("(to) => __ow.fly(to)", aps[1])
            await pg.wait_for_function("__ow.state().mode === 'flight'", timeout=10000)
            await pg.wait_for_function("__ow.state().flight && __ow.state().flight.phase === 'cruise' && __ow.state().flight.alt > 0.9", timeout=20000)
            out["flight_alt"] = (await st())["flight"]["alt"]
            await pg.locator("canvas").screenshot(path=f"{PREFIX}-flight.png")
            await pg.wait_for_function("__ow.state().mode === 'overworld'", timeout=60000)
            dest = await pg.evaluate("(id) => __ow.data.airports.find((x) => x.id === id).tile", aps[1])
            out["flight_landed"] = (await st())["tile"] == dest
            out["flyover"] = await pg.evaluate("async () => { await __ow.flyover(); return __ow.state().flyovers; }") >= 1
            await pg.locator("canvas").screenshot(path=f"{PREFIX}-flyover.png")
        fl = await pg.evaluate("""() => {
          __ow.setFlood(0.7);
          const d = __ow.data; let cell = null;
          for (let y = 1; y < d.height - 1 && !cell; y++) for (let x = 1; x < d.width - 1 && !cell; x++)
            if (__ow.floodDepthAt(x, y) >= 2 && d.blocked[y][x] === '.' && d.blocked[y][x + 1] === '.' && __ow.floodDepthAt(x + 1, y) >= 2) cell = [x, y];
          return { cells: __ow.state().floodedCells, cell };
        }""")
        out["flood_cells"] = fl["cells"]
        if fl["cell"]:
            x, y = fl["cell"]
            await pg.evaluate(f"__ow.teleport({x}, {y})")
            t0 = await pg.evaluate("performance.now()")
            await pg.evaluate("__ow.step(1, 0)")
            await pg.wait_for_function(f"__ow.state().tile[0] === {x + 1} && !__ow.state().paused", timeout=5000)
            out["flood_step_ms"] = round(await pg.evaluate("performance.now()") - t0)
            out["flood_depth_here"] = (await st())["floodDepth"]
            await pg.locator("canvas").screenshot(path=f"{PREFIX}-flood.png")
        await pg.evaluate("__ow.setFlood(0)")
        out["flood_cleared"] = (await st())["floodedCells"] == 0
        out["paused_blocks_steps"] = await pg.evaluate("() => { __ow.setPaused(true); const moved = __ow.step(1, 0); const p = __ow.state().paused; __ow.setPaused(false); return p && !moved; }")

        optional_404 = all(u.endswith("/pixi.min.js") for u in missing)
        real = [e for e in errs if "GL Driver Message" not in e and not (optional_404 and "404" in e)]
        out["errors"] = real
        out["missing"] = [u for u in missing if not u.endswith("/pixi.min.js")]
        await ctx.close()
        await b.close()
    placeholder_ok = os.environ.get("ALLOW_PLACEHOLDER_TOWNS") == "1"
    ok = (
        out["start_mode"] == "overworld" and out["stepped"] and out["entered"] and (out["town_loaded"] or placeholder_ok) and out["walked_in_town"]
        and out["back_on_entrance"] and out.get("arrived", True) and out.get("train_cars", 3) == 3
        and (out["hidden_in_tunnel"] or not out["tunnel_route"]) and out["night_darker"] and not out["errors"] and not out["missing"]
        and out["town_x_kept"] and out["town_day_after_n"]
        and (not out["town_night_export"] or (out["town_night_on_enter"] and out["town_night_after_n"]))
        and (len(out["airports"]) < 2 or (out["flight_landed"] and out["flyover"] and out["flight_alt"] > 0.5))
        and out["flood_cleared"] and out["paused_blocks_steps"]
        and (out["flood_cells"] > 0 or not out.get("flood_step_ms"))
    )
    print("RESULT " + json.dumps(out, ensure_ascii=False) + (" OK" if ok else " FAIL"))
    return ok


try:
    ok = asyncio.run(main())
finally:
    srv.terminate()
sys.exit(0 if ok else 1)
