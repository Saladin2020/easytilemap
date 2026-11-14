import { useEffect, useMemo, useRef, useState } from "react";
import { applyOps, objectAt, type MapOp } from "../../../src/shared/map";
import { OBJECT_BY_KIND } from "../../../src/shared/objects";
import { renderMapRaw, type RenderAssets } from "../../../src/shared/render";
import type { RgbaImage } from "../../../src/shared/raster";
import type { LayerName, MapDoc } from "../../../src/shared/types";
import { putRgba } from "../draw";

export type Tool =
  | { kind: "paint"; layer: LayerName; code: string }
  | { kind: "object"; object: string }
  | { kind: "select" }
  | { kind: "spawn"; name: string }
  | { kind: "character"; sheet: string };

export type Selection = { type: "object" | "character" | "spawn"; index: number } | null;

export interface View {
  grid: boolean;
  collision: boolean;
  spawns: boolean;
  hide: { ground?: boolean; decor?: boolean; objects?: boolean };
}

interface Props {
  doc: MapDoc;
  assets: RenderAssets | null;
  tool: Tool;
  brush: number;
  zoom: number;
  view: View;
  selected: Selection;
  onChange: (doc: MapDoc) => void;
  onSelect: (s: Selection) => void;
  onHover: (cell: { x: number; y: number } | null) => void;
}

function outline(img: RgbaImage, x: number, y: number, w: number, h: number, rgb: [number, number, number]): void {
  const put = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
    const i = (py * img.width + px) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
  };
  for (let i = 0; i < w; i++) {
    put(x + i, y);
    put(x + i, y + h - 1);
  }
  for (let i = 0; i < h; i++) {
    put(x, y + i);
    put(x + w - 1, y + i);
  }
}

export function MapEditor({ doc, assets, tool, brush, zoom, view, selected, onChange, onSelect, onHover }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ mode: "paint" | "move" | "rect"; last?: string; start?: { x: number; y: number }; origin?: { x: number; y: number } } | null>(null);
  const ts = doc.tileSize;

  const base = useMemo(() => (assets ? renderMapRaw(doc, assets, { grid: view.grid, collision: view.collision, spawns: view.spawns, hide: view.hide }) : null), [doc, assets, view]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !base) return;
    const img: RgbaImage = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data) };
    if (selected) {
      if (selected.type === "object") {
        const o = doc.objects[selected.index];
        const k = o && OBJECT_BY_KIND.get(o.kind);
        if (o && k) outline(img, o.x * ts, o.y * ts, k.w * ts, k.h * ts, [244, 174, 61]);
      } else if (selected.type === "character") {
        const ch = doc.characters[selected.index];
        if (ch) outline(img, Math.floor(ch.x) * ts, Math.floor(ch.y) * ts - ts * 2, ts, ts * 3, [143, 199, 232]);
      } else {
        const s = doc.spawns[selected.index];
        if (s) outline(img, s.x * ts, s.y * ts, ts, ts, [121, 196, 138]);
      }
    }
    if (hover) {
      if (rectStart) {
        const x0 = Math.min(rectStart.x, hover.x);
        const y0 = Math.min(rectStart.y, hover.y);
        outline(img, x0 * ts, y0 * ts, (Math.abs(hover.x - rectStart.x) + 1) * ts, (Math.abs(hover.y - rectStart.y) + 1) * ts, [255, 255, 255]);
      } else if (tool.kind === "object") {
        const k = OBJECT_BY_KIND.get(tool.object);
        if (k) outline(img, hover.x * ts, hover.y * ts, k.w * ts, k.h * ts, [255, 255, 255]);
      } else {
        const b = tool.kind === "paint" ? brush : 1;
        const h = Math.floor((b - 1) / 2);
        outline(img, (hover.x - h) * ts, (hover.y - h) * ts, b * ts, b * ts, [255, 255, 255]);
      }
    }
    putRgba(c, img);
  }, [base, hover, selected, tool, brush, rectStart, doc, ts]);

  const cellOf = (e: React.PointerEvent): { x: number; y: number } => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * doc.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * doc.height);
    return { x: Math.max(0, Math.min(doc.width - 1, x)), y: Math.max(0, Math.min(doc.height - 1, y)) };
  };

  const paintAt = (d: MapDoc, cell: { x: number; y: number }): MapDoc => {
    if (tool.kind !== "paint") return d;
    const h = Math.floor((brush - 1) / 2);
    const cells: Array<[number, number]> = [];
    for (let dy = 0; dy < brush; dy++) for (let dx = 0; dx < brush; dx++) cells.push([cell.x - h + dx, cell.y - h + dy]);
    return applyOps(d, [{ op: "paint", layer: tool.layer, code: tool.code, cells }]);
  };

  const hit = (cell: { x: number; y: number }): Selection => {
    const c = doc.characters.findIndex((ch) => Math.floor(ch.x) === cell.x && (Math.floor(ch.y) === cell.y || Math.floor(ch.y) - 1 === cell.y));
    if (c >= 0) return { type: "character", index: c };
    const s = doc.spawns.findIndex((sp) => sp.x === cell.x && sp.y === cell.y);
    if (s >= 0) return { type: "spawn", index: s };
    const o = objectAt(doc, cell.x, cell.y);
    return o >= 0 ? { type: "object", index: o } : null;
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const cell = cellOf(e);
    if (e.button === 2 || tool.kind === "select") {
      const s = hit(cell);
      onSelect(s);
      if (s && e.button !== 2) {
        const pos = s.type === "object" ? doc.objects[s.index]! : s.type === "spawn" ? doc.spawns[s.index]! : doc.characters[s.index]!;
        drag.current = { mode: "move", start: cell, origin: { x: pos.x, y: pos.y } };
      }
      return;
    }
    if (tool.kind === "paint") {
      if (e.shiftKey) {
        setRectStart(cell);
        drag.current = { mode: "rect", start: cell };
        return;
      }
      drag.current = { mode: "paint", last: `${cell.x},${cell.y}` };
      onChange(paintAt(doc, cell));
      return;
    }
    let op: MapOp | null = null;
    if (tool.kind === "object") op = { op: "place", kind: tool.object, x: cell.x, y: cell.y };
    else if (tool.kind === "spawn") op = { op: "spawn", name: tool.name || "spawn", x: cell.x, y: cell.y };
    else if (tool.kind === "character") {
      const base = tool.sheet.split("/").pop()!.replace(/\.png$/, "");
      let name = base;
      for (let i = 2; doc.characters.some((c) => c.name === name); i++) name = `${base}_${i}`;
      op = { op: "character", sheet: tool.sheet, x: cell.x, y: cell.y, name, facing: "front" };
    }
    if (op) {
      const next = applyOps(doc, [op]);
      onChange(next);
      if (op.op === "place") onSelect({ type: "object", index: next.objects.length - 1 });
      if (op.op === "character") onSelect({ type: "character", index: next.characters.length - 1 });
      if (op.op === "spawn") onSelect({ type: "spawn", index: next.spawns.findIndex((s) => s.name === (op as { name: string }).name) });
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const cell = cellOf(e);
    if (!hover || hover.x !== cell.x || hover.y !== cell.y) {
      setHover(cell);
      onHover(cell);
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === "paint") {
      const k = `${cell.x},${cell.y}`;
      if (k === d.last) return;
      d.last = k;
      onChange(paintAt(doc, cell));
    } else if (d.mode === "move" && selected && d.start && d.origin) {
      const nx = d.origin.x + cell.x - d.start.x;
      const ny = d.origin.y + cell.y - d.start.y;
      if (selected.type === "object") onChange({ ...doc, objects: doc.objects.map((o, i) => (i === selected.index ? { ...o, x: nx, y: ny } : o)) });
      else if (selected.type === "spawn") onChange({ ...doc, spawns: doc.spawns.map((s, i) => (i === selected.index ? { ...s, x: nx, y: ny } : s)) });
      else onChange({ ...doc, characters: doc.characters.map((c, i) => (i === selected.index ? { ...c, x: nx, y: ny } : c)) });
    }
  };

  const onUp = () => {
    const d = drag.current;
    if (d?.mode === "rect" && d.start && hover && tool.kind === "paint") {
      const x = Math.min(d.start.x, hover.x);
      const y = Math.min(d.start.y, hover.y);
      onChange(applyOps(doc, [{ op: "fill", layer: tool.layer, code: tool.code, x, y, w: Math.abs(hover.x - d.start.x) + 1, h: Math.abs(hover.y - d.start.y) + 1 }]));
    }
    setRectStart(null);
    drag.current = null;
  };

  return (
    <div className="stage-wrap map-stage">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        style={{ width: doc.width * ts * zoom, height: doc.height * ts * zoom }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => {
          setHover(null);
          onHover(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      {!assets && <div className="loader center-loader" aria-label="Loading tiles"><span /><span /><span /></div>}
    </div>
  );
}
