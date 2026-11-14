"""Headless Chrome screenshot of the web editor (README image) + console error check.

  python3 scripts/capture-ui.py [url] [out.png]

Needs Playwright for Python and Chrome (CHROME_PATH or /usr/bin/google-chrome).
Paints a few dirt cells and selects the temple so the screenshot shows the tools in use (not saved).
"""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8808/"
OUT = sys.argv[2] if len(sys.argv) > 2 else "docs/assets/ui-editor.png"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"))
        pg = await b.new_page(viewport={"width": 1720, "height": 1120}, device_scale_factor=1)
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.wait_for_selector(".map-canvas")
        await pg.wait_for_timeout(1500)
        canvas = pg.locator(".map-canvas")
        box = await canvas.bounding_box()
        tile = box["width"] / 40
        # paint a short dirt path with the default Dirt brush
        await pg.mouse.move(box["x"] + tile * 20.5, box["y"] + tile * 3.5)
        await pg.mouse.down()
        for i in range(5):
            await pg.mouse.move(box["x"] + tile * (20.5 + i), box["y"] + tile * 3.5)
            await pg.wait_for_timeout(40)
        await pg.mouse.up()
        # select the temple
        await pg.get_by_role("button", name="Select").click()
        await canvas.click(position={"x": tile * 5.5, "y": tile * 5.5})
        await pg.wait_for_timeout(600)
        await pg.mouse.move(box["x"] + tile * 22.5, box["y"] + tile * 6.5)
        await pg.screenshot(path=OUT)
        print("saved", OUT)
        print("console errors:", errs)
        await b.close()


asyncio.run(main())
