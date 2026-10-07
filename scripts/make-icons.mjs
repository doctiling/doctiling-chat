// Generates the chat's own icons (PNG, no dependencies): a brand-primary tile
// with a white speech bubble. Colors are read from @doctiling/brand so the
// icon cannot drift from the palette. Run: npm run icons (output is committed).
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(path.join(root, 'node_modules/@doctiling/brand/src/tokens.ts'), 'utf8');
const light = tokens.slice(tokens.indexOf('lightColors'), tokens.indexOf('darkColors'));
const hex = (name) => {
  const m = new RegExp(`${name}:\\s*'#([0-9A-Fa-f]{6})'`).exec(light);
  if (!m) throw new Error(`token ${name} not found in @doctiling/brand`);
  return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
};
const PRIMARY = hex('primary');
const BUBBLE = hex('primaryForeground');
const DOT = hex('accent');

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Geometry in unit space (0..1): rounded tile, bubble, three dots.
const inRoundedRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const inTriangle = (px, py, [ax, ay], [bx, by], [cx, cy]) => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

function icon(size, { maskable }) {
  // Maskable icons keep the artwork inside the 80% safe zone and fill the whole square.
  const pad = maskable ? 0.12 : 0.0;
  const tileRadius = maskable ? 0 : 0.22;
  return png(size, (px, py) => {
    const x = (px + 0.5) / size;
    const y = (py + 0.5) / size;
    if (!maskable && !inRoundedRect(x, y, 0, 0, 1, 1, tileRadius)) return [0, 0, 0, 0];
    const bx0 = 0.18 + pad * 0.6;
    const bx1 = 0.82 - pad * 0.6;
    const by0 = 0.24 + pad * 0.6;
    const by1 = 0.66 - pad * 0.4;
    const bubble = inRoundedRect(x, y, bx0, by0, bx1, by1, 0.12) || inTriangle(x, y, [bx0 + 0.1, by1 - 0.02], [bx0 + 0.28, by1 - 0.02], [bx0 + 0.08, by1 + 0.14]);
    if (bubble) {
      const cy = (by0 + by1) / 2;
      const r = 0.045;
      for (const cx of [0.37, 0.5, 0.63]) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return [...DOT, 255];
      }
      return [...BUBBLE, 255];
    }
    return [...PRIMARY, 255];
  });
}

const out = path.join(root, 'public', 'icons');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'icon-192.png'), icon(192, { maskable: false }));
writeFileSync(path.join(out, 'icon-512.png'), icon(512, { maskable: false }));
writeFileSync(path.join(out, 'maskable-192.png'), icon(192, { maskable: true }));
writeFileSync(path.join(out, 'maskable-512.png'), icon(512, { maskable: true }));
writeFileSync(path.join(out, 'apple-touch-icon.png'), icon(180, { maskable: true }));
console.info('icons: written to public/icons (192, 512, maskable 192/512, apple-touch 180)');
