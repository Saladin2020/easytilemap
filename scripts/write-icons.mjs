/**
 * Bake favicon / PWA icons: a tiny pixel top-down tile map (grass, canal, bridge, path, trees).
 * Usage: node scripts/write-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "web", "public");

// 16×16 master, one char per pixel: a top-down tile map (grass, canal with a bridge, dirt path, a tree)
const PAL = {
  ".": [0, 0, 0, 0],
  k: [20, 14, 10, 255],
  g: [93, 156, 64, 255],
  G: [124, 190, 82, 255],
  d: [181, 133, 82, 255],
  D: [148, 104, 60, 255],
  w: [59, 135, 168, 255],
  W: [150, 214, 232, 255],
  b: [122, 82, 48, 255],
  B: [192, 138, 82, 255],
  t: [52, 112, 48, 255],
  T: [86, 160, 70, 255],
  r: [120, 72, 40, 255],
};
const ART = [
  "kkkkkkkkkkkkkkkk",
  "kgGgggtTtgggwwgk",
  "kggggtTTTtggwWgk",
  "kgGggtTTTtgGwwgk",
  "kggggggrgggbBBbk",
  "kgggggggggbBBBBk",
  "kddddddddddbBBbk",
  "kdDddddDdddbBBbk",
  "kddddDddddddwwgk",
  "kggddgggGgggwWgk",
  "kgGddggggggGwwgk",
  "kggddgGggggggwgk",
  "kggddggggtTtgwwk",
  "kGgddgggtTTTtwWk",
  "kggddggggtrtgwwk",
  "kkkkkkkkkkkkkkkk",
];

function render(size) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 16;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = PAL[ART[Math.floor(y / scale)][Math.floor(x / scale)]];
      png.data.set(c, (y * size + x) * 4);
    }
  }
  return PNG.sync.write(png);
}

function svg() {
  let rects = "";
  ART.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = PAL[ch];
      if (c[3]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${c[0]},${c[1]},${c[2]})"/>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects}</svg>\n`;
}

/** ICO container holding one PNG image (valid since Windows Vista). */
function ico(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = size >= 256 ? 0 : size;
  header[7] = size >= 256 ? 0 : size;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "favicon.svg"), svg());
await writeFile(path.join(outDir, "favicon-32.png"), render(32));
await writeFile(path.join(outDir, "favicon.ico"), ico(render(32), 32));
await writeFile(path.join(outDir, "apple-touch-icon.png"), render(180));
await writeFile(path.join(outDir, "icon-192.png"), render(192));
await writeFile(path.join(outDir, "icon-512.png"), render(512));
await mkdir(path.join(root, "docs", "assets"), { recursive: true });
await writeFile(path.join(root, "docs", "assets", "icon-512.png"), render(512));
console.log(`Icons written to ${outDir}`);
