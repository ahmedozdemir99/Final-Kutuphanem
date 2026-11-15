import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const svg = await readFile(resolve(root, 'public/final-kutuphanem-icon.svg'));
for (const [filename, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon.png', 1024],
  ['apple-touch-icon.png', 180],
]) {
  const image = await sharp(svg, { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(root, 'public', filename), image);
  console.log(`PWA icon generated: ${filename} (${size}x${size})`);
}
