// Generates responsive WebP copies of every image in public/assets and a
// manifest the <Img> component reads. Originals are never modified; they stay
// as the <img> fallback. Run with `npm run images` after adding an asset.
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/assets';
const OUT = join(SRC, 'opt');
const WIDTHS = [640, 1024, 1600, 2400];
const MANIFEST = 'src/generated/images.json';

await mkdir(OUT, { recursive: true });
await mkdir('src/generated', { recursive: true });

const manifest = {};
const files = (await readdir(SRC)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();

for (const file of files) {
  const { name } = parse(file);
  const meta = await sharp(join(SRC, file)).metadata();
  const widths = WIDTHS.filter((w) => w < meta.width);
  widths.push(Math.min(meta.width, 2400));
  const unique = [...new Set(widths)];
  for (const w of unique) {
    await sharp(join(SRC, file))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(OUT, `${name}-${w}.webp`));
  }
  manifest[file] = { w: meta.width, h: meta.height, widths: unique };
  console.log(`${file}: ${meta.width}x${meta.height} -> ${unique.join(', ')}`);
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${MANIFEST}`);
