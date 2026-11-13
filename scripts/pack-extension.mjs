import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'packages/extension/dist');
const RELEASE_DIR = path.join(ROOT, 'release');
const OUT_FILE = path.join(RELEASE_DIR, 'drafter-chrome-extension-v1.0.0.zip');

if (!fs.existsSync(DIST_DIR)) {
  throw new Error(
    `Extension dist folder not found at ${DIST_DIR}. Run npm run build:extension first.`
  );
}

function collectFiles(dir, base = dir, acc = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, base, acc);
    } else if (entry.isFile()) {
      const rel = path.relative(base, full).split(path.sep).join('/');
      acc[rel] = new Uint8Array(fs.readFileSync(full));
    }
  }
  return acc;
}

const files = collectFiles(DIST_DIR);
const zipped = zipSync(files, { level: 9 });
fs.mkdirSync(RELEASE_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, zipped);

const kb = (zipped.byteLength / 1024).toFixed(1);
console.log(`Packed extension archive: ${OUT_FILE} (${kb} KB)`);
