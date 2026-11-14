"""Headless Chrome check of a PixiJS export: no console errors, map renders, the player walks and collides.

  python3 scripts/check-pixi.py <pixi-export-dir> [shots-prefix]

Serves the folder on 127.0.0.1:8978, holds arrow keys via the page and reads window.__tm.state().
"""
import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

DIR = sys.argv[1]
PREFIX = sys.argv[2] if len(sys.argv) > 2 else "/tmp/tilemap-pixi"
PORT = 8978
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=DIR, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)


async def hold(pg, key, ms):
    await pg.keyboard.down(key)
    await pg.wait_for_timeout(ms)
    await pg.keyboard.up(key)
    await pg.wait_for_timeout(100)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"), args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width": 1500, "height": 900})
        errs = []
        pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        missing = []
        pg.on("response", lambda r: missing.append(r.url) if r.status == 404 else None)
        await pg.goto(f"http://127.0.0.1:{PORT}/index.html")
        await pg.wait_for_function("window.__ready === true", timeout=30000)
        await pg.wait_for_timeout(800)
        state = lambda: pg.evaluate("window.__tm.state()")
        start = await state()
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-start.png")
        await hold(pg, "ArrowRight", 900)
        right = await state()
        await hold(pg, "ArrowUp", 1500)  # walk north into the market stall row → collision stops the player
        up = await state()
        await pg.locator("canvas").screenshot(path=f"{PREFIX}-walk.png")
        # the page tries ./pixi.min.js first and falls back to the CDN: that 404 is expected
        optional_404 = all(u.endswith("/pixi.min.js") for u in missing)
        real = [e for e in errs if "GL Driver Message" not in e and not (optional_404 and "404" in e)]
        out = {"start": start, "afterRight": right, "afterUp": up, "errors": real}
        moved = right["player"] and right["player"]["x"] > start["player"]["x"] + 20
        blocked = up["player"] and up["player"]["y"] > 12 * 16  # stall solid row is y=12 → feet stay below 192
        out["moved"] = bool(moved)
        out["collided"] = bool(blocked)
        print(json.dumps(out, ensure_ascii=False, indent=1))
        await b.close()
        if real or not moved or not blocked:
            sys.exit(1)


try:
    asyncio.run(main())
finally:
    srv.terminate()
