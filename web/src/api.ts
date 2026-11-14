import type { MapDoc, Diagnostic } from "../../src/shared/types";
import type { ObjectKind } from "../../src/shared/objects";
import type { SheetLayout } from "../../src/shared/characters";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !(data as { errors?: unknown }).errors) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface MapSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  objects: number;
  characters: number;
  errors: number;
  warnings: number;
}
export interface WorkspaceSummary {
  root: string;
  config: { name: string; tileset: string; viewport: { width: number; height: number } };
  maps: MapSummary[];
  characters: string[];
  objects: ObjectKind[];
}
export interface MapResponse {
  doc: MapDoc | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
}

export const fetchWorkspace = () => fetch("/api/workspace").then((r) => json<WorkspaceSummary>(r));
export const fetchMap = (id: string) => fetch(`/api/maps/${encodeURIComponent(id)}`).then((r) => json<MapResponse>(r));
export const saveMap = (doc: MapDoc) => post(`/api/maps/${encodeURIComponent(doc.id)}`, { doc }).then((r) => json<MapResponse & { ok: boolean; file: string }>(r));
export const validate = (doc: MapDoc) => post("/api/validate", { doc }).then((r) => json<MapResponse>(r));
export const exportMap = (id: string, preset: string) => post("/api/export", { id, preset }).then((r) => json<{ dirs: string[]; files: string[]; warnings: string[] }>(r));
export const tilesetUrl = (id: string) => `/api/tilesets/${encodeURIComponent(id)}.png`;
export const objectUrl = (kind: string) => `/api/objects/${encodeURIComponent(kind)}.png`;
export const characterUrl = (p: string) => `/api/character?path=${encodeURIComponent(p)}`;
export const characterMeta = (p: string) => fetch(`/api/character-meta?path=${encodeURIComponent(p)}`).then((r) => json<{ layout: SheetLayout; groundRow?: number }>(r));
