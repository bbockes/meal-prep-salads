/**
 * Resize recipe PNG masters and write WebP for web delivery.
 *
 * Usage:
 *   npm run optimize-images
 *
 * Reads `images/<slug>.png` (output of generate-recipe-images.mjs). Writes
 * `public/images/<slug>.webp` and `images/<slug>.webp` (max 512px on long edge, quality ~84).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
/** PNG masters from `npm run generate-images`. */
const SOURCE_IMAGES = path.join(ROOT, 'images');
const PUBLIC_IMAGES = path.join(ROOT, 'public', 'images');

/** Enough for ~2× card strip width (see .recipe-card in globals.css); smaller than detail-photo size. */
const MAX_EDGE = 512;
const WEBP_QUALITY = 84;

async function main() {
  if (!fs.existsSync(SOURCE_IMAGES)) {
    console.error(`Missing directory: ${SOURCE_IMAGES}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(SOURCE_IMAGES, { withFileTypes: true });
  const pngFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png')).map((e) => e.name);

  if (pngFiles.length === 0) {
    console.log(`No PNG files in ${SOURCE_IMAGES}`);
    return;
  }

  if (!fs.existsSync(PUBLIC_IMAGES)) fs.mkdirSync(PUBLIC_IMAGES, { recursive: true });

  let ok = 0;
  for (const name of pngFiles) {
    const inputPath = path.join(SOURCE_IMAGES, name);
    const base = name.replace(/\.png$/i, '');
    const outPublic = path.join(PUBLIC_IMAGES, `${base}.webp`);
    const outRoot = path.join(SOURCE_IMAGES, `${base}.webp`);

    const buf = await sharp(inputPath)
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    await fs.promises.writeFile(outPublic, buf);
    await fs.promises.writeFile(outRoot, buf);

    console.log(`  ${name} → ${base}.webp`);
    ok += 1;
  }

  console.log(`Done. Wrote ${ok} WebP file(s) to public/images and images/.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
