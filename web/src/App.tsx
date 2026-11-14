import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blobCoord, decorCoord, MARKER_ROW } from "../../src/shared/autotile";
import type { LoadedSheet, RenderAssets } from "../../src/shared/render";
import type { RgbaImage } from "../../src/shared/raster";
import { createMap } from "../../src/shared/map";
import { OBJECT_KINDS, type ObjectCategory } from "../../src/shared/objects";
import {
  DECOR_CODES,
  DECOR_LABELS,
  FACINGS,
  TERRAINS,
  TERRAIN_CODE,
  TERRAIN_LABELS,
  type Diagnostic,
  type Facing,
  type LayerName,
  type MapDoc,
} from "../../src/shared/types";
import { characterMeta, characterUrl, exportMap, fetchMap, fetchWorkspace, objectUrl, saveMap, tilesetUrl, validate, type WorkspaceSummary } from "./api";
import { loadRgba } from "./draw";
import { MapEditor, type Selection, type Tool, type View } from "./components/MapEditor";

const LS_MAP = "easytilemap.map";
const PRESETS = [
  { id: "png", label: "PNG" },
  { id: "godot", label: "Godot" },
  { id: "pixi", label: "Pixi" },
  { id: "all", label: "All" },
] as const;
const CATEGORY_LABEL: Record<ObjectCategory, string> = { building: "Buildings · อาคาร", nature: "Nature · ต้นไม้", prop: "Props · ของประดับ", floor: "Bridges & boats · สะพาน" };
const ATLAS_W = 128;
const ATLAS_H = 432;

function readLs(k: string): string {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
}
function writeLs(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    // private mode
  }
}

function AtlasIcon({ tileset, col, row }: { tileset: string; col: number; row: number }) {
  const s = 1.5;
  return (
    <span
      className="tile-icon"
      aria-hidden
      style={{ backgroundImage: `url(${tilesetUrl(tileset)})`, backgroundSize: `${ATLAS_W * s}px ${ATLAS_H * s}px`, backgroundPosition: `${-col * 16 * s}px ${-row * 16 * s}px` }}
    />
  );
}

/** Icon atlas cell for a palette entry: the full-centre blob tile (index 46 = mask 255) or grass/decor. */
function iconFor(layer: LayerName, code: string): { col: number; row: number } | null {
  if (layer === "ground") {
    if (code === "g") return { col: 0, row: 0 };
    const t = TERRAINS.find((x) => TERRAIN_CODE[x] === code);
    return t && t !== "grass" ? blobCoord(t, 46) : null;
  }
  if (layer === "decor") return decorCoord(code);
  if (code === "#") return { col: 0, row: MARKER_ROW };
  return null;
}

type Toast = { msg: string; kind: "" | "ok" | "err"; id: number };

export function App() {
  const [ws, setWs] = useState<WorkspaceSummary | null>(null);
  const [doc, setDoc] = useState<MapDoc | null>(null);
  const [diags, setDiags] = useState<{ errors: Diagnostic[]; warnings: Diagnostic[] }>({ errors: [], warnings: [] });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "export" | "new">("");
  const [layer, setLayer] = useState<LayerName>("ground");
  const [tool, setTool] = useState<Tool>({ kind: "paint", layer: "ground", code: "d" });
  const [brush, setBrush] = useState(1);
  const [zoom, setZoom] = useState(2);
  const [view, setView] = useState<View>({ grid: false, collision: false, spawns: true, hide: {} });
  const [selected, setSelected] = useState<Selection>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [atlas, setAtlas] = useState<RgbaImage | null>(null);
  const [objects, setObjects] = useState<Map<string, RgbaImage> | null>(null);
  const [sheets, setSheets] = useState<Map<string, LoadedSheet>>(new Map());
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("godot");
  const [spawnName, setSpawnName] = useState("player");
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exported, setExported] = useState<{ dirs: string[]; files: string[] } | null>(null);
  const history = useRef<MapDoc[]>([]);

  const notify = useCallback((msg: string, kind: Toast["kind"] = "") => setToast({ msg, kind, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openMap = useCallback(async (id: string) => {
    const r = await fetchMap(id);
    if (!r.doc) {
      setDiags({ errors: r.errors, warnings: r.warnings });
      notify(`${id} has errors`, "err");
      return;
    }
    setDoc(r.doc);
    setDiags({ errors: r.errors, warnings: r.warnings });
    setDirty(false);
    setSelected(null);
    history.current = [];
    writeLs(LS_MAP, id);
  }, [notify]);

  useEffect(() => {
    fetchWorkspace()
      .then(async (w) => {
        setWs(w);
        const want = readLs(LS_MAP);
        const id = w.maps.find((m) => m.id === want)?.id ?? w.maps[0]?.id;
        if (id) await openMap(id);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [openMap]);

  // tiles + objects
  useEffect(() => {
    if (!doc) return;
    let live = true;
    void loadRgba(tilesetUrl(doc.tileset)).then((img) => live && setAtlas(img));
    return () => {
      live = false;
    };
  }, [doc?.tileset]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void Promise.all(OBJECT_KINDS.map(async (k) => [k.kind, await loadRgba(objectUrl(k.kind))] as const)).then((list) => setObjects(new Map(list)));
  }, []);
  // character sheets used by the map
  const sheetKey = doc ? [...new Set(doc.characters.map((c) => c.sheet))].sort().join("|") : "";
  useEffect(() => {
    if (!sheetKey) return;
    const missing = sheetKey.split("|").filter((s) => !sheets.has(s));
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (s) => {
        try {
          const [img, meta] = await Promise.all([loadRgba(characterUrl(s)), characterMeta(s)]);
          return [s, { img, layout: meta.layout, groundRow: meta.groundRow }] as const;
        } catch {
          return null;
        }
      }),
    ).then((list) => setSheets((prev) => new Map([...prev, ...(list.filter(Boolean) as Array<readonly [string, LoadedSheet]>)])));
  }, [sheetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const assets: RenderAssets | null = useMemo(() => (atlas && objects ? { atlas, object: (k) => objects.get(k), sheets } : null), [atlas, objects, sheets]);

  const update = useCallback((next: MapDoc) => {
    setDoc((prev) => {
      if (prev) {
        history.current.push(prev);
        if (history.current.length > 80) history.current.shift();
      }
      return next;
    });
    setDirty(true);
  }, []);

  // live validation (debounced)
  useEffect(() => {
    if (!doc || !dirty) return;
    const t = setTimeout(() => void validate(doc).then((r) => setDiags({ errors: r.errors, warnings: r.warnings })).catch(() => undefined), 400);
    return () => clearTimeout(t);
  }, [doc, dirty]);

  const onSave = useCallback(async () => {
    if (!doc) return;
    setBusy("save");
    try {
      const r = await saveMap(doc);
      setDiags({ errors: r.errors, warnings: r.warnings });
      if (r.ok) {
        setDirty(false);
        notify(`Saved ${doc.id}`, "ok");
        setWs(await fetchWorkspace());
      } else notify(`Not saved: ${r.errors[0]?.message ?? "errors"}`, "err");
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy("");
    }
  }, [doc, notify]);

  const removeSelected = useCallback(() => {
    if (!doc || !selected) return;
    const key = selected.type === "object" ? "objects" : selected.type === "spawn" ? "spawns" : "characters";
    update({ ...doc, [key]: (doc[key] as unknown[]).filter((_, i) => i !== selected.index) } as MapDoc);
    setSelected(null);
  }, [doc, selected, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        const prev = history.current.pop();
        if (prev) {
          setDoc(prev);
          setDirty(true);
        }
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selected) {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, removeSelected, selected]);

  const onNew = async () => {
    const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `map_${Date.now() % 10000}`;
    setBusy("new");
    try {
      const r = await saveMap(createMap({ id, name: newName || id, width: 32, height: 20 }));
      if (!r.ok) throw new Error(r.errors[0]?.message ?? "Could not create");
      setWs(await fetchWorkspace());
      await openMap(id);
      setNewName("");
      notify(`Created ${id}`, "ok");
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy("");
    }
  };

  const onExport = async () => {
    if (!doc) return;
    if (dirty) await onSave();
    setBusy("export");
    try {
      const r = await exportMap(doc.id, preset);
      setExported(r);
      notify(`Exported ${r.files.length} files`, "ok");
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy("");
    }
  };

  if (!ws || !doc) {
    return (
      <div className="splash">
        <div className="splash-card">
          <span className="brand-mark" aria-hidden />
          <h1 className="brand">
            Easy <span>Tilemap</span>
          </h1>
          {loadError ? (
            <>
              <p className="splash-msg err">{loadError}</p>
              <p className="hint">Is the API running? Start it with <code>npm run serve</code> and reload.</p>
            </>
          ) : ws && !ws.maps.length ? (
            <p className="splash-msg">No maps yet. Run <code>npm run init</code> to seed the Thai village demo.</p>
          ) : (
            <>
              <p className="splash-msg">Laying the paddy fields…</p>
              <div className="loader" aria-label="Loading workspace"><span /><span /><span /></div>
            </>
          )}
        </div>
      </div>
    );
  }

  const palette: Array<{ code: string; label: string; th: string }> =
    layer === "ground"
      ? TERRAINS.map((t) => ({ code: TERRAIN_CODE[t], label: TERRAIN_LABELS[t].en, th: TERRAIN_LABELS[t].th }))
      : layer === "decor"
        ? [{ code: ".", label: "Erase", th: "ลบ" }, ...DECOR_CODES.map((c) => ({ code: c, label: DECOR_LABELS[c].en, th: DECOR_LABELS[c].th }))]
        : [
            { code: "#", label: "Block", th: "กั้น" },
            { code: "o", label: "Force open", th: "เดินได้" },
            { code: ".", label: "Auto", th: "อัตโนมัติ" },
          ];
  const sel = selected;
  const selObj = sel?.type === "object" ? doc.objects[sel.index] : undefined;
  const selChar = sel?.type === "character" ? doc.characters[sel.index] : undefined;
  const selSpawn = sel?.type === "spawn" ? doc.spawns[sel.index] : undefined;
  const patch = <K extends "objects" | "characters" | "spawns">(key: K, p: Partial<MapDoc[K][number]>) => {
    if (!sel) return;
    update({ ...doc, [key]: (doc[key] as Array<MapDoc[K][number]>).map((it, i) => (i === sel.index ? { ...it, ...p } : it)) } as MapDoc);
  };
  const toolHint =
    tool.kind === "paint"
      ? "Drag to paint · Shift+drag fills a rectangle · terrains autotile over grass"
      : tool.kind === "object"
        ? "Click to place the object (top-left tile)"
        : tool.kind === "spawn"
          ? `Click to put spawn “${tool.name}”`
          : tool.kind === "character"
            ? "Click to place the character's feet"
            : "Click to select · drag to move · Delete removes · right-click selects with any tool";
  const kindName = (k: string) => OBJECT_KINDS.find((o) => o.kind === k)?.name ?? k;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1 className="brand">
              Easy <span>Tilemap</span>
            </h1>
            <p className="brand-th">แผนที่มุมบน · หมู่บ้านริมคลอง</p>
            <div className="sub">
              <span className="tag tag-sky">top-down</span>
              <span className="tag">{doc.tileSize}px · blob-47</span>
              <span className="tag">{doc.width}×{doc.height}</span>
              <span className="tag tag-leaf">Easy Sprite cast</span>
            </div>
          </div>
        </div>
        <div className="toolbar">
          <div className="tool-group">
            <label className="field-label" htmlFor="map-pick">Map</label>
            <div className="row nowrap">
              <select id="map-pick" value={doc.id} onChange={(e) => void openMap(e.target.value)}>
                {ws.maps.map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </select>
              <button type="button" className={`save-btn${dirty ? " is-dirty" : ""}`} disabled={busy === "save"} title="Save (Ctrl/⌘+S)" onClick={() => void onSave()}>
                <span className="dot" aria-hidden />
                {busy === "save" ? "Saving…" : dirty ? "Save" : "Saved"}
              </button>
            </div>
          </div>
          <form className="tool-group" onSubmit={(e) => { e.preventDefault(); void onNew(); }}>
            <label className="field-label" htmlFor="new-map">New map</label>
            <div className="row nowrap">
              <input id="new-map" value={newName} placeholder="riverside market" onChange={(e) => setNewName(e.target.value)} />
              <button type="submit" disabled={busy === "new"}>+ New</button>
            </div>
          </form>
          <div className="tool-group export-group">
            <span className="field-label">Export</span>
            <div className="row nowrap">
              <div className="segmented" role="radiogroup" aria-label="Export preset">
                {PRESETS.map((p) => (
                  <button type="button" key={p.id} role="radio" aria-checked={preset === p.id} className={preset === p.id ? "active" : ""} onClick={() => setPreset(p.id)}>{p.label}</button>
                ))}
              </div>
              <button type="button" className="primary" disabled={busy === "export"} onClick={() => void onExport()}>{busy === "export" ? "Exporting…" : "Export"}</button>
            </div>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="panel panel-layers">
          <h2><span className="step">1</span>Paint <small>layers</small></h2>
          <div className="segmented full" role="radiogroup" aria-label="Layer">
            {(["ground", "decor", "collision"] as const).map((l) => (
              <button type="button" key={l} role="radio" aria-checked={layer === l} className={layer === l ? "active" : ""}
                onClick={() => { setLayer(l); setTool({ kind: "paint", layer: l, code: l === "ground" ? "d" : l === "decor" ? "f" : "#" }); }}>
                {l}
              </button>
            ))}
          </div>
          <div className="palette">
            {palette.map((p) => {
              const ic = iconFor(layer, p.code);
              const active = tool.kind === "paint" && tool.layer === layer && tool.code === p.code;
              return (
                <button type="button" key={p.code} className={`palette-btn${active ? " active" : ""}`} onClick={() => setTool({ kind: "paint", layer, code: p.code })} title={`${p.label} (${p.code})`}>
                  {ic ? <AtlasIcon tileset={doc.tileset} col={ic.col} row={ic.row} /> : <span className="tile-icon tile-icon-empty" aria-hidden />}
                  <span className="palette-name">{p.label}<small>{p.th}</small></span>
                  <code>{p.code}</code>
                </button>
              );
            })}
          </div>
          <div className="field">
            <span className="field-label">Brush</span>
            <div className="segmented small" role="radiogroup" aria-label="Brush size">
              {[1, 2, 3, 5].map((b) => (
                <button type="button" key={b} role="radio" aria-checked={brush === b} className={brush === b ? "active" : ""} onClick={() => setBrush(b)}>{b}×{b}</button>
              ))}
            </div>
          </div>
          <h3 className="sub-head">View</h3>
          <div className="view-toggles">
            {([["grid", "Grid"], ["collision", "Collision"], ["spawns", "Spawns"]] as const).map(([k, label]) => (
              <label className="switch" key={k}>
                <input type="checkbox" checked={view[k]} onChange={(e) => setView({ ...view, [k]: e.target.checked })} />
                <span className="track" aria-hidden />
                {label}
              </label>
            ))}
            {(["ground", "decor", "objects"] as const).map((k) => (
              <label className="switch" key={k}>
                <input type="checkbox" checked={!view.hide[k]} onChange={(e) => setView({ ...view, hide: { ...view.hide, [k]: !e.target.checked } })} />
                <span className="track" aria-hidden />
                {k}
              </label>
            ))}
          </div>
          <div className="field section">
            <label className="field-label" htmlFor="map-name">Map name</label>
            <input id="map-name" value={doc.name} onChange={(e) => update({ ...doc, name: e.target.value })} />
          </div>
          <dl className="stats">
            <div><dt>Grid</dt><dd>{doc.width}×{doc.height}</dd></div>
            <div><dt>Pixels</dt><dd>{doc.width * doc.tileSize}×{doc.height * doc.tileSize}</dd></div>
            <div><dt>Objects</dt><dd>{doc.objects.length}</dd></div>
            <div><dt>Cast</dt><dd>{doc.characters.length}</dd></div>
          </dl>
        </aside>

        <main className="center">
          <section className="panel">
            <h2>
              <span className="step">2</span>Map <small>{doc.id}</small>
              {dirty && <span className="badge-dirty">unsaved</span>}
            </h2>
            <div className="tool-row">
              <div className="segmented tools" role="toolbar" aria-label="Tools">
                <button type="button" className={tool.kind === "paint" ? "active" : ""} onClick={() => setTool({ kind: "paint", layer, code: palette[0]!.code })}><span className="glyph" aria-hidden>✎</span>Paint</button>
                <button type="button" className={tool.kind === "select" ? "active" : ""} onClick={() => setTool({ kind: "select" })}><span className="glyph" aria-hidden>⤧</span>Select</button>
                <button type="button" className={tool.kind === "spawn" ? "active" : ""} onClick={() => setTool({ kind: "spawn", name: spawnName })}><span className="glyph" aria-hidden>⚑</span>Spawn</button>
              </div>
              {tool.kind === "spawn" && (
                <input className="spawn-name" aria-label="Spawn name" value={spawnName} onChange={(e) => { setSpawnName(e.target.value); setTool({ kind: "spawn", name: e.target.value }); }} />
              )}
              <div className="view-opts">
                <div className="segmented small" role="radiogroup" aria-label="Zoom">
                  {[1, 2, 3].map((z) => (
                    <button type="button" key={z} role="radio" aria-checked={zoom === z} className={zoom === z ? "active" : ""} onClick={() => setZoom(z)}>{z}×</button>
                  ))}
                </div>
              </div>
            </div>
            <MapEditor doc={doc} assets={assets} tool={tool} brush={brush} zoom={zoom} view={view} selected={selected} onChange={update} onSelect={setSelected} onHover={setHover} />
            <div className="statusbar">
              <span>{toolHint}</span>
              <span className="mono">{hover ? `tile ${hover.x},${hover.y} · ${doc.layers.ground[hover.y]?.[hover.x]}${doc.layers.decor[hover.y]?.[hover.x] !== "." ? `+${doc.layers.decor[hover.y]?.[hover.x]}` : ""}` : `${doc.width}×${doc.height} tiles`}</span>
            </div>
            {(diags.errors.length > 0 || diags.warnings.length > 0) && (
              <ul className="diag-list">
                {[...diags.errors, ...diags.warnings].slice(0, 8).map((d, i) => (
                  <li key={i} className={d.severity}>{d.severity === "error" ? "✕" : "!"} {d.message}</li>
                ))}
              </ul>
            )}
            {exported && (
              <details className="export-list" open>
                <summary>Last export · {exported.files.length} files <span className="mono">{exported.dirs.join(", ")}</span></summary>
                <ul>{exported.files.slice(0, 40).map((f) => <li key={f}>{f}</li>)}</ul>
              </details>
            )}
          </section>
        </main>

        <aside className="panel panel-props">
          <h2><span className="step">3</span>Objects <small>{OBJECT_KINDS.length} kinds</small></h2>
          {(Object.keys(CATEGORY_LABEL) as ObjectCategory[]).map((cat) => (
            <details key={cat} className="prop-group" open={cat !== "prop"}>
              <summary>{CATEGORY_LABEL[cat]} <span className="count">{OBJECT_KINDS.filter((k) => k.category === cat).length}</span></summary>
              <div className="prop-grid">
                {OBJECT_KINDS.filter((k) => k.category === cat).map((k) => (
                  <button type="button" key={k.kind} className={`prop-btn${tool.kind === "object" && tool.object === k.kind ? " active" : ""}`} title={`${k.kind} · ${k.w}×${k.h} tiles`} onClick={() => setTool({ kind: "object", object: k.kind })}>
                    <span className="prop-img"><img src={objectUrl(k.kind)} alt="" /></span>
                    <span className="prop-name">{k.nameTh}</span>
                  </button>
                ))}
              </div>
            </details>
          ))}
          <h3 className="sub-head">Characters <span className="count">{doc.characters.length}</span></h3>
          <div className="char-picker">
            {ws.characters.map((s) => (
              <button type="button" key={s} className={`char-btn${tool.kind === "character" && tool.sheet === s ? " active" : ""}`} title={`Place ${s}`} onClick={() => setTool({ kind: "character", sheet: s })}>
                <span className="char-face" style={{ backgroundImage: `url(${characterUrl(s)})` }} />
                <span>{s.split("/").pop()!.replace(/\.png$/, "").replace(/^town_/, "")}</span>
              </button>
            ))}
          </div>
          <div className="prop-list" role="listbox" aria-label="Placed characters and spawns">
            {doc.characters.map((c, i) => (
              <button type="button" role="option" aria-selected={sel?.type === "character" && sel.index === i} key={`c${i}`} className={`item${sel?.type === "character" && sel.index === i ? " active" : ""}`} onClick={() => { setSelected({ type: "character", index: i }); setTool({ kind: "select" }); }}>
                <span className="mini-thumb char-face" style={{ backgroundImage: `url(${characterUrl(c.sheet)})` }} />
                <span className="grow">{c.name ?? c.sheet}</span>
                <span className="mono coords">{c.x},{c.y}{c.patrol ? " ↻" : ""}</span>
              </button>
            ))}
            {doc.spawns.map((s, i) => (
              <button type="button" role="option" aria-selected={sel?.type === "spawn" && sel.index === i} key={`s${i}`} className={`item${sel?.type === "spawn" && sel.index === i ? " active" : ""}`} onClick={() => { setSelected({ type: "spawn", index: i }); setTool({ kind: "select" }); }}>
                <span className="mini-thumb spawn-glyph">⚑</span>
                <span className="grow">{s.name}</span>
                <span className="mono coords">{s.x},{s.y}</span>
              </button>
            ))}
          </div>
          {sel && (selObj || selChar || selSpawn) && (
            <div className="inspector">
              <header>
                <span className="band">{sel.type}</span>
                <span className="grow">{selObj ? kindName(selObj.kind) : selChar ? selChar.name ?? selChar.sheet : selSpawn!.name}</span>
                <span className="mono coords">{(selObj ?? selChar ?? selSpawn)!.x},{(selObj ?? selChar ?? selSpawn)!.y}</span>
              </header>
              <div className="inspector-grid">
                {selObj && <button type="button" className={selObj.flipX ? "active" : ""} onClick={() => patch("objects", { flipX: !selObj.flipX })}>⇋ Flip</button>}
                {selChar && (
                  <>
                    <select aria-label="Facing" value={selChar.facing ?? "front"} onChange={(e) => patch("characters", { facing: e.target.value as Facing })}>
                      {FACINGS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select aria-label="Animation" value={selChar.anim ?? "idle"} onChange={(e) => patch("characters", { anim: e.target.value as "idle" | "walk" })}>
                      <option value="idle">idle</option>
                      <option value="walk">walk</option>
                    </select>
                    <input aria-label="Name" value={selChar.name ?? ""} onChange={(e) => patch("characters", { name: e.target.value })} />
                  </>
                )}
                {selSpawn && (
                  <>
                    <input aria-label="Spawn name" value={selSpawn.name} onChange={(e) => patch("spawns", { name: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} />
                    <select aria-label="Facing" value={selSpawn.facing ?? "front"} onChange={(e) => patch("spawns", { facing: e.target.value as Facing })}>
                      {FACINGS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </>
                )}
                <button type="button" className="danger" onClick={removeSelected}>Delete</button>
              </div>
            </div>
          )}
          <p className="hint foot">Sample tiles and objects are generated by code (CC0). Repaint <code>tilesets/*.png</code> to restyle.</p>
        </aside>
      </div>

      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span className="toast-msg">{toast.msg}</span>
          <button type="button" className="icon" aria-label="Dismiss" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
