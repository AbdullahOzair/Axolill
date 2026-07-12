/**
 * Generates the Axonill logo derivatives from public/brand/Symbol_Logo.png.
 *
 * Dependency-free: PNG decode/encode via Node's built-in zlib only.
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/brand/mark.png      square, trimmed mark (source for the UI)
 *   app/icon.png               128x128 favicon (Next auto-detects)
 *   app/apple-icon.png         180x180
 *   public/brand/og-image.png  1200x630 social card (mark on brand navy)
 *
 * NOTE: the source mark is only ~95x133 real pixels, so we never upscale beyond
 * what's necessary — see the plan's "resolution ceiling".
 */
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

/* ------------------------------ PNG decoding ------------------------------ */

function decodePng(file) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const colorType = b[25];
  if (colorType !== 6) throw new Error(`${file}: expected RGBA (color type 6)`);

  const chunks = [];
  let p = 8;
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString("ascii", p + 4, p + 8);
    if (type === "IDAT") chunks.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const bpp = 4;
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);

  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[pos + x];
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const ul = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = cur; break;
        case 1: v = cur + a; break;
        case 2: v = cur + up; break;
        case 3: v = cur + ((a + up) >> 1); break;
        case 4: {
          const pa = Math.abs(up - ul);
          const pb = Math.abs(a - ul);
          const pc = Math.abs(a + up - 2 * ul);
          v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? up : ul);
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      px[y * stride + x] = v & 255;
    }
    pos += stride;
  }
  return { w, h, px };
}

/* ------------------------------ PNG encoding ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng({ w, h, px }, file) {
  const stride = w * 4;
  // filter byte 0 (None) per scanline
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out);
  console.log(`  ${file.padEnd(30)} ${w}x${h}  ${(out.length / 1024).toFixed(1)}kB`);
}

/* ------------------------------- operations ------------------------------- */

const at = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return [img.px[i], img.px[i + 1], img.px[i + 2], img.px[i + 3]];
};

function blank(w, h, rgba = [0, 0, 0, 0]) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = rgba[0];
    px[i * 4 + 1] = rgba[1];
    px[i * 4 + 2] = rgba[2];
    px[i * 4 + 3] = rgba[3];
  }
  return { w, h, px };
}

/** Tight bounding box of non-transparent pixels. */
function bbox(img, threshold = 12) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px[(y * img.w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(img, x0, y0, w, h) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = at(img, x0 + x, y0 + y);
      const i = (y * w + x) * 4;
      out.px[i] = r; out.px[i + 1] = g; out.px[i + 2] = b; out.px[i + 3] = a;
    }
  }
  return out;
}

/**
 * Bilinear resize. Works on premultiplied alpha so transparent pixels don't
 * bleed their (meaningless) colour into the edges — otherwise you get a dark
 * halo around the mark.
 */
function resize(img, nw, nh) {
  const out = blank(nw, nh);
  const sx = img.w / nw;
  const sy = img.h / nh;

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(img.w - 1, (x + 0.5) * sx - 0.5);
      const fy = Math.min(img.h - 1, (y + 0.5) * sy - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const y0 = Math.max(0, Math.floor(fy));
      const x1 = Math.min(img.w - 1, x0 + 1);
      const y1 = Math.min(img.h - 1, y0 + 1);
      const dx = fx - x0;
      const dy = fy - y0;

      let r = 0, g = 0, b = 0, a = 0;
      const corners = [
        [x0, y0, (1 - dx) * (1 - dy)],
        [x1, y0, dx * (1 - dy)],
        [x0, y1, (1 - dx) * dy],
        [x1, y1, dx * dy],
      ];
      for (const [cx, cy, wgt] of corners) {
        const [pr, pg, pb, pa] = at(img, cx, cy);
        const alpha = pa / 255;
        r += pr * alpha * wgt;
        g += pg * alpha * wgt;
        b += pb * alpha * wgt;
        a += pa * wgt;
      }

      const i = (y * nw + x) * 4;
      const alpha = a / 255;
      // un-premultiply
      out.px[i] = alpha > 0 ? Math.round(Math.min(255, r / alpha)) : 0;
      out.px[i + 1] = alpha > 0 ? Math.round(Math.min(255, g / alpha)) : 0;
      out.px[i + 2] = alpha > 0 ? Math.round(Math.min(255, b / alpha)) : 0;
      out.px[i + 3] = Math.round(a);
    }
  }
  return out;
}

/** Centre `src` on a `w`x`h` canvas. */
function centreOn(src, w, h, bg = [0, 0, 0, 0]) {
  const out = blank(w, h, bg);
  const ox = Math.round((w - src.w) / 2);
  const oy = Math.round((h - src.h) / 2);

  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= w || dy >= h) continue;
      const [sr, sg, sb, sa] = at(src, x, y);
      const i = (dy * w + dx) * 4;
      const a = sa / 255;
      // source-over composite
      out.px[i] = Math.round(sr * a + out.px[i] * (1 - a));
      out.px[i + 1] = Math.round(sg * a + out.px[i + 1] * (1 - a));
      out.px[i + 2] = Math.round(sb * a + out.px[i + 2] * (1 - a));
      out.px[i + 3] = Math.round(sa + out.px[i + 3] * (1 - a));
    }
  }
  return out;
}

/* --------------------------------- build ---------------------------------- */

const SOURCE = "public/brand/Symbol_Logo.png";
console.log(`Reading ${SOURCE}`);

const src = decodePng(SOURCE);
const box = bbox(src);
console.log(`  mark bbox: ${box.w}x${box.h} at (${box.x0},${box.y0})`);

// 1. Trim to the mark, then centre on a square with ~8% breathing room.
const trimmed = crop(src, box.x0, box.y0, box.w, box.h);
const side = Math.round(Math.max(box.w, box.h) * 1.08);
const mark = centreOn(trimmed, side, side);

console.log("\nWriting:");
encodePng(mark, "public/brand/mark.png");

// 2. Favicon. 128px, not 512 — upscaling a ~133px source 4x would look blurry.
encodePng(resize(mark, 128, 128), "app/icon.png");
encodePng(resize(mark, 180, 180), "app/apple-icon.png");

// 3. OG card: mark on brand navy (#0F172A), kept near native size so it stays sharp.
const NAVY = [0x0f, 0x17, 0x2a, 255];
const og = centreOn(resize(mark, 260, 260), 1200, 630, NAVY);
encodePng(og, "public/brand/og-image.png");

console.log("\nDone.");
