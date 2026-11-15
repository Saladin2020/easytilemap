"""Backward-compatibility check: old maps load, check, render and export the same with this checkout as with
an older one (e.g. `git archive master`).

  python3 scripts/compat-check.py --old /tmp/easytilemap-master [--report out.json] <map.json | workspace/maps/x.json> ...

Every map runs in a throwaway copy of its own workspace (or a fresh `init` workspace made by the OLD checkout for
samples / loose maps), once per checkout: `check --json`, `render --scale 1`, `export --preset all`.
Allowed differences, all append-only:
  tilesets/<ts>.png      new atlas rows appended below; the old rows are pixel-identical
  *_tileset.tres         only added lines (new terrains / tiles); no old line changed or removed
  *.tilemap.json         only atlas.rows grows; ground / decor indices, objects, collision identical
  renders / <id>.png     identical, except pixels the old checkout left transparent because an old workspace atlas
                         was missing rows the map needs (old bug: holes in decor); those are now drawn. Every
                         pixel the old checkout drew opaque must stay identical.
Everything else ( .tscn scenes, scripts, object and character PNGs) must be byte-identical, and the
set of exported files must be the same. Exit 1 on any other difference.
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile
from PIL import Image
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--old", required=True)
ap.add_argument("--new", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ap.add_argument("--report")
ap.add_argument("maps", nargs="+")
a = ap.parse_args()
tmp = tempfile.mkdtemp(prefix="etm-compat-")
IGNORE = shutil.ignore_patterns("exports", "*.mp4", "*.mov", "render", "work", "node_modules", ".git", "stills", "audio")


def cli(repo, *args):
    r = subprocess.run(["npx", "tsx", "src/cli.ts", *args], cwd=repo, capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout, r.stderr


def workspace_for(map_file, side, name):
    dst = os.path.join(tmp, side, name)
    src_ws = os.path.dirname(os.path.dirname(os.path.abspath(map_file)))
    mid = os.path.splitext(os.path.basename(map_file))[0]
    if os.path.basename(src_ws) == "samples" or not (os.path.exists(os.path.join(src_ws, "easytilemap.config.json")) or os.path.isdir(os.path.join(src_ws, "tilesets"))):
        cli(a.old, "init", "--workspace", dst)
        os.makedirs(os.path.join(dst, "maps"), exist_ok=True)
        shutil.copy(map_file, os.path.join(dst, "maps", f"{mid}.json"))
    else:
        shutil.copytree(src_ws, dst, ignore=IGNORE, symlinks=True)
    return dst, mid


def sha(p):
    return hashlib.sha256(open(p, "rb").read()).hexdigest()


def files(d):
    out = {}
    for r, _, fs in os.walk(d):
        for f in fs:
            p = os.path.join(r, f)
            out[os.path.relpath(p, d)] = p
    return out


def cmp_png_prefix(old, new):
    A = np.array(Image.open(old).convert("RGBA"))
    B = np.array(Image.open(new).convert("RGBA"))
    if A.shape[1] != B.shape[1] or B.shape[0] < A.shape[0]:
        return False, f"size {A.shape[:2]} -> {B.shape[:2]}"
    return bool((A == B[: A.shape[0]]).all()), f"{A.shape[0] // 16} old rows pixel-identical, {(B.shape[0] - A.shape[0]) // 16} rows appended"


def cmp_render(old, new):
    if not (os.path.exists(old) and os.path.exists(new)):
        return False, "missing render"
    A = np.array(Image.open(old).convert("RGBA")).astype(int)
    B = np.array(Image.open(new).convert("RGBA")).astype(int)
    if A.shape != B.shape:
        return False, f"size {A.shape[:2]} -> {B.shape[:2]}"
    d = (A != B).any(2)
    if not d.any():
        return True, "pixel-identical"
    opaque_changed = int((A[d][:, 3] == 255).sum())
    if opaque_changed:
        return False, f"{int(d.sum())} px differ ({opaque_changed} the old checkout drew opaque)"
    return True, f"fix: {int(d.sum())} px the old checkout left transparent (holes from an old atlas) are now drawn; all opaque px identical"


def cmp_tres(old, new):
    o = open(old).read().splitlines()
    n = open(new).read().splitlines()
    i = 0
    for line in n:
        if i < len(o) and line == o[i]:
            i += 1
    return i == len(o), f"+{len(n) - len(o)} lines added, 0 old lines changed" if i == len(o) else f"{len(o) - i} old lines changed/removed"


def cmp_bundle(old, new):
    A = json.load(open(old))
    B = json.load(open(new))
    ra, rb = A.get("atlas", {}).pop("rows", None), B.get("atlas", {}).pop("rows", None)
    return A == B, f"atlas.rows {ra} -> {rb}, everything else identical" if A == B else "bundle content differs"


results, bad = [], 0
for m in a.maps:
    name = os.path.relpath(os.path.abspath(m), "/").replace("/", "__").removesuffix(".json")
    entry = {"map": m, "checks": {}}
    outs = {}
    for side, repo in (("old", a.old), ("new", a.new)):
        ws, mid = workspace_for(m, side, name)
        rc, so, se = cli(repo, "check", mid, "--json", "--workspace", ws)
        try:
            chk = json.loads(so)
        except Exception:
            chk = {"raw": so + se}
        png = os.path.join(tmp, side, f"{name}.png")
        cli(repo, "render", mid, "--scale", "1", "--out", png, "--workspace", ws)
        exp = os.path.join(tmp, side, f"{name}-exports")
        erc, eo, ee = cli(repo, "export", mid, "--preset", "all", "--out", exp, "--workspace", ws, "--json")
        warns = json.loads(eo).get("warnings", []) if erc == 0 else [ee.strip()]
        outs[side] = {"check": {"rc": rc, "errors": chk.get("errors"), "warnings": chk.get("warnings")}, "png": png, "exp": exp, "export_rc": erc, "export_warnings": warns}
    o, n = outs["old"], outs["new"]
    entry["checks"]["check"] = {"ok": o["check"] == n["check"] and o["check"]["errors"] is not None, "errors": len(o["check"]["errors"] or []), "warnings": len(o["check"]["warnings"] or [])}
    rok, rwhy = cmp_render(o["png"], n["png"])
    entry["checks"]["render"] = {"ok": rok, "detail": rwhy}
    entry["checks"]["export_rc"] = {"ok": o["export_rc"] == n["export_rc"] == 0 and o["export_warnings"] == n["export_warnings"]}
    fo, fn = files(o["exp"]), files(n["exp"])
    only_old, only_new = sorted(set(fo) - set(fn)), sorted(set(fn) - set(fo))
    identical, appended, diffs = 0, [], []
    for rel in sorted(set(fo) & set(fn)):
        if sha(fo[rel]) == sha(fn[rel]):
            identical += 1
            continue
        if rel.endswith(".png") and "/tilesets/" in "/" + rel:
            ok, why = cmp_png_prefix(fo[rel], fn[rel])
        elif rel.endswith("_tileset.tres"):
            ok, why = cmp_tres(fo[rel], fn[rel])
        elif rel.endswith(".png") and rel.split("/")[0].endswith("-png"):
            ok, why = cmp_render(fo[rel], fn[rel])
        elif rel.endswith(".tilemap.json"):
            ok, why = cmp_bundle(fo[rel], fn[rel])
        else:
            ok, why = False, "content differs"
        (appended if ok else diffs).append(f"{rel}: {why}")
    entry["checks"]["export_files"] = {"ok": not only_old and not only_new and not diffs, "files": len(fo), "identical": identical, "append_only": appended, "differs": diffs, "only_old": only_old, "only_new": only_new}
    entry["ok"] = all(c["ok"] for c in entry["checks"].values())
    bad += 0 if entry["ok"] else 1
    results.append(entry)
    c = entry["checks"]
    print(f"{'OK ' if entry['ok'] else 'BAD'} {m}\n    check same={c['check']['ok']} ({c['check']['errors']} errors, {c['check']['warnings']} warnings) · render {c['render']['detail']} · export ok={c['export_rc']['ok']} · "
          f"{c['export_files']['files']} files: {c['export_files']['identical']} identical, {len(c['export_files']['append_only'])} append-only, {len(c['export_files']['differs'])} differ, "
          f"+{len(c['export_files']['only_new'])}/-{len(c['export_files']['only_old'])} files")
    for x in c["export_files"]["append_only"]:
        print(f"      append-only {x}")
    for x in c["export_files"]["differs"] + [f"only new: {f}" for f in c["export_files"]["only_new"]] + [f"only old: {f}" for f in c["export_files"]["only_old"]]:
        print(f"      DIFF {x}")
if a.report:
    json.dump(results, open(a.report, "w"), indent=1)
print(f"{len(results) - bad}/{len(results)} maps backward compatible")
shutil.rmtree(tmp, ignore_errors=True)
sys.exit(1 if bad else 0)
