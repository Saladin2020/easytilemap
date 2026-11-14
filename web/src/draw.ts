import type { RgbaImage } from "../../src/shared/raster";

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Pixels of an image as a shared-renderer RgbaImage. */
export async function loadRgba(url: string): Promise<RgbaImage> {
  const img = await loadImage(url);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, data: d.data };
}

export function putRgba(canvas: HTMLCanvasElement, img: RgbaImage): void {
  if (canvas.width !== img.width) canvas.width = img.width;
  if (canvas.height !== img.height) canvas.height = img.height;
  const g = canvas.getContext("2d")!;
  const id = g.createImageData(img.width, img.height);
  id.data.set(img.data);
  g.putImageData(id, 0, 0);
}
