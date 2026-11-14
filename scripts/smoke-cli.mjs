/** CLI smoke test: init a temp workspace, paint, place, check, render and export through the real CLI. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ws = mkdtempSync(path.join(os.tmpdir(), "easytilemap-cli-"));
const cli = (...args) => execFileSync("npx", ["tsx", "src/cli.ts", ...args, "--workspace", ws], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let failed = false;
const ok = (cond, label) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failed = true;
};

cli("init");
ok(existsSync(path.join(ws, "maps", "thai_village_topdown.json")), "init copies the demo map");
ok(existsSync(path.join(ws, "tilesets", "thai_village.png")) && existsSync(path.join(ws, "characters", "town_kid.png")), "init writes the atlas and the top-down cast");
const check = JSON.parse(cli("check", "thai_village_topdown", "--json"));
ok(check.errors.length === 0 && check.warnings.length === 0, "check: demo is clean");

cli("new", "pond", "--width", "14", "--height", "9");
cli("paint", "pond", "--layer", "ground", "--code", "water", "--rect", "4,2,6,5");
cli("paint", "pond", "--layer", "ground", "--code", "dirt", "--line", "0,7,13,7", "--width", "2");
cli("place", "pond", "--object", "sala", "--at", "10,1");
cli("character", "pond", "--sheet", "characters/town_monk.png", "--at", "2,7", "--name", "monk", "--patrol", "2,7;8,7");
const ascii = cli("check", "pond", "--ascii");
ok(/@/.test(ascii) && /O/.test(ascii), "paint/place/character → ASCII shows object and character");

writeFileSync(path.join(ws, "maps", "broken.json"), JSON.stringify({ format: "easytilemap/1", id: "broken", width: 2, height: 1, layers: { ground: ["gq"] }, objects: [{ kind: "templ", x: 0, y: 0 }] }));
let out = "";
try {
  cli("check", "broken");
} catch (e) {
  out = String(e.stdout) + String(e.stderr);
}
ok(/layers\.ground\[0\]/.test(out) && /did you mean "temple"/.test(out), "check reports the cell and a suggestion");

const png = path.join(ws, "crop.png");
cli("render", "thai_village_topdown", "--scale", "2", "--crop", "0,0,480,270", "--out", png);
const b = readFileSync(png);
ok(b.readUInt32BE(16) === 960 && b.readUInt32BE(20) === 540, "render --crop 480×270 --scale 2 → 960×540 PNG");

cli("export", "thai_village_topdown", "--preset", "all");
for (const f of ["exports/thai_village_topdown-png/thai_village_topdown.png", "exports/thai_village_topdown-godot/project.godot", "exports/thai_village_topdown-pixi/index.html"]) {
  ok(existsSync(path.join(ws, f)), `export → ${f}`);
}

rmSync(ws, { recursive: true, force: true });
console.log(failed ? "CLI smoke FAILED" : "CLI smoke OK");
process.exit(failed ? 1 : 0);
