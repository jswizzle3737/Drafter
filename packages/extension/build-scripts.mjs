import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const ROOT_NODE_MODULES = path.resolve(__dirname, '../../node_modules');

fs.mkdirSync(DIST, { recursive: true });

await Promise.all([
  build({
    entryPoints: [path.join(__dirname, 'src/background/background.ts')],
    outfile: path.join(DIST, 'background.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
  }),
  build({
    entryPoints: [path.join(__dirname, 'src/content/content.ts')],
    outfile: path.join(DIST, 'content.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
  }),
]);

// Copy manifest.json
fs.copyFileSync(
  path.join(__dirname, 'manifest.json'),
  path.join(DIST, 'manifest.json')
);

// Copy icons/
const iconsSrc = path.join(__dirname, 'icons');
const iconsDst = path.join(DIST, 'icons');
fs.mkdirSync(iconsDst, { recursive: true });
for (const file of fs.readdirSync(iconsSrc)) {
  fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDst, file));
}

// Copy bundled pdf.worker.min.mjs
const workerCandidates = [
  path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
  path.join(ROOT_NODE_MODULES, 'pdfjs-dist/build/pdf.worker.min.mjs'),
];
const workerSrc = workerCandidates.find((p) => fs.existsSync(p));
if (!workerSrc) {
  throw new Error('Could not locate pdf.worker.min.mjs in node_modules');
}
fs.copyFileSync(workerSrc, path.join(DIST, 'pdf.worker.min.mjs'));

console.log(
  '[extension] Built background.js, content.js, and bundled pdf.worker.min.mjs'
);
