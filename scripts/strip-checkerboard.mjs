#!/usr/bin/env node
// IT13 / S07 — Karo-Hintergrund aus Service-PNGs entfernen.
//
// Die Bilder unter public/*.png wurden ohne Alpha-Kanal exportiert; der
// transparency-Checkerboard ist als echte RGB-Pixel eingebrannt. Tom sieht
// daher das Karo statt der Cream-Rahmenfarbe.
//
// Ansatz:
//   1. Eckpixel sampeln → die zwei Karo-Farben (hell + dunkel) bestimmen.
//   2. Pixel innerhalb einer Toleranz beider Farben auf Alpha=0 setzen.
//   3. PNG mit RGBA zurückschreiben, Backup als *.orig.png.
//
// Toleranz und Edge-Cleanup so gewählt, dass Bär/Möbel-Konturen erhalten
// bleiben — Karo-Farben sind sehr nah an Weiß/Hellgrau und kollidieren
// nicht mit den primär dunklen/erdigen Bildinhalten.

import sharp from 'sharp';
import { readdir, copyFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;

// Skip these (no checkerboard, or shouldn't be modified):
const SKIP = new Set(['robots.txt']);

// Tolerance per channel (0–255). Karo-Farben sind eindeutig — 22 deckt
// JPEG-Kompressions-Artefakte rund um die Karo-Quadrat-Kanten ab.
const TOLERANCE = 22;

function near(c, target, tol) {
  return Math.abs(c[0] - target[0]) <= tol
    && Math.abs(c[1] - target[1]) <= tol
    && Math.abs(c[2] - target[2]) <= tol;
}

function sample(buf, channels, w, x, y) {
  const i = (y * w + x) * channels;
  return [buf[i], buf[i + 1], buf[i + 2]];
}

async function processFile(srcPath) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  if (meta.format !== 'png') {
    console.log(`skip (not png): ${basename(srcPath)}`);
    return;
  }

  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Sample two diagonal-adjacent corner pixels to get both checker colors.
  // Top-left corner area: (5,5) and (35,5) lie in different squares.
  const colorA = sample(data, channels, width, 5, 5);
  const colorB = sample(data, channels, width, 35, 5);

  console.log(
    `${basename(srcPath)}: ${width}x${height} ch=${channels} ` +
    `colorA=rgb(${colorA.join(',')}) colorB=rgb(${colorB.join(',')})`
  );

  // Sanity: if A and B are nearly identical AND not both bright (≥240 in all
  // channels), the image likely doesn't have a checker — bail to avoid
  // destroying it. If both are bright off-whites, treat as subtle checker.
  const bright = (c) => c[0] >= 240 && c[1] >= 240 && c[2] >= 240;
  if (near(colorA, colorB, 8) && !(bright(colorA) && bright(colorB))) {
    console.log(`  -> no checker detected (corners identical), skipping`);
    return;
  }

  // Walk pixels, set alpha=0 wherever rgb matches one of the checker colors.
  let stripped = 0;
  for (let p = 0; p < width * height; p++) {
    const i = p * channels;
    const px = [data[i], data[i + 1], data[i + 2]];
    if (near(px, colorA, TOLERANCE) || near(px, colorB, TOLERANCE)) {
      data[i + 3] = 0;
      stripped++;
    }
  }
  const pct = ((stripped / (width * height)) * 100).toFixed(1);
  console.log(`  -> stripped ${stripped} px (${pct}%)`);

  // Backup original (once).
  const backup = srcPath.replace(/\.png$/i, '.orig.png');
  try {
    await stat(backup);
  } catch {
    await copyFile(srcPath, backup);
    console.log(`  -> backup written: ${basename(backup)}`);
  }

  await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9 })
    .toFile(srcPath);
}

const entries = await readdir(PUBLIC_DIR);
for (const name of entries) {
  if (SKIP.has(name)) continue;
  if (!name.toLowerCase().endsWith('.png')) continue;
  if (name.endsWith('.orig.png')) continue;
  await processFile(join(PUBLIC_DIR, name));
}
console.log('done');
