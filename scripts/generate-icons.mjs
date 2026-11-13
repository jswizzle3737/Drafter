import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ICONS_DIR = path.resolve(process.cwd(), 'packages/extension/icons');

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.24;
  const half = size / 2;
  const boxHalf = size * 0.455;

  // Emerald gradient matching Drafter badge (#34d399 -> #10b981)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x + 0.5;
      const cy = y + 0.5;

      // Signed distance to rounded rect
      const dx = Math.abs(cx - half) - (boxHalf - radius);
      const dy = Math.abs(cy - half) - (boxHalf - radius);
      const outsideDist = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
      const insideDist = Math.min(Math.max(dx, dy), 0);
      const sdf = outsideDist + insideDist - radius;

      const aa = Math.max(0, Math.min(1, 0.5 - sdf));
      if (aa <= 0) {
        rgba[idx + 3] = 0;
        continue;
      }

      const t = (cx + cy) / (2 * size);
      let r = Math.round(74 + (16 - 74) * t);
      let g = Math.round(222 + (185 - 222) * t);
      let b = Math.round(166 + (129 - 166) * t);

      // Pen/nib glyph in dark slate (#0f172a)
      const u = cx / size;
      const v = cy / size;
      const dShaft1 = distToSegment(u, v, 0.34, 0.62, 0.64, 0.32);
      const dShaft2 = distToSegment(u, v, 0.38, 0.66, 0.68, 0.36);
      const dTip1 = distToSegment(u, v, 0.3, 0.7, 0.34, 0.62);
      const dTip2 = distToSegment(u, v, 0.3, 0.7, 0.38, 0.66);
      const dBase = distToSegment(u, v, 0.3, 0.76, 0.72, 0.76);
      const strokeDist = Math.min(dShaft1, dShaft2, dTip1, dTip2, dBase);
      const strokeMask = Math.max(
        0,
        Math.min(1, (0.042 - strokeDist) * size * 0.9)
      );

      if (strokeMask > 0) {
        r = Math.round(r * (1 - strokeMask) + 15 * strokeMask);
        g = Math.round(g * (1 - strokeMask) + 23 * strokeMask);
        b = Math.round(b * (1 - strokeMask) + 42 * strokeMask);
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = Math.round(aa * 255);
    }
  }

  return encodePng(size, size, rgba);
}

fs.mkdirSync(ICONS_DIR, { recursive: true });
for (const size of [16, 48, 128]) {
  const png = renderIcon(size);
  const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}
