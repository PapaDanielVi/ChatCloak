#!/usr/bin/env node
'use strict';

/**
 * Standalone zero-dependency PNG generator for ChatCloak extension icons.
 * Renders anti-aliased 16x16, 48x48, and 128x128 RGBA PNG files in ./icons/.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 48, 128];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function sdRoundedRect(px, py, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(px - cx) - (halfW - r);
  const qy = Math.abs(py - cy) - (halfH - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function shieldOutlineDistance(nx, ny) {
  // Normalized coordinates in [0, 1] space
  const pts = [
    [0.5, 0.16],
    [0.78, 0.27],
    [0.78, 0.49],
    [0.73, 0.66],
    [0.63, 0.77],
    [0.5, 0.84],
    [0.37, 0.77],
    [0.27, 0.66],
    [0.22, 0.49],
    [0.22, 0.27],
    [0.5, 0.16]
  ];
  let minD = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(nx, ny, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < minD) minD = d;
  }
  return minD;
}

function eyeOutlineDistance(nx, ny) {
  // Two symmetric arcs approximated by segments
  const steps = 16;
  let minD = Infinity;
  for (let sign of [-1, 1]) {
    let prevX = 0.33;
    let prevY = 0.5;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = 0.33 + t * 0.34;
      const arch = Math.sin(t * Math.PI) * 0.125 * sign;
      const y = 0.5 + arch;
      const d = distToSegment(nx, ny, prevX, prevY, x, y);
      if (d < minD) minD = d;
      prevX = x;
      prevY = y;
    }
  }
  return minD;
}

function blendPixel(buf, idx, r, g, b, alpha) {
  if (alpha <= 0) return;
  const a = Math.min(1, alpha);
  const inv = 1 - a;
  buf[idx] = Math.round(r * a + buf[idx] * inv);
  buf[idx + 1] = Math.round(g * a + buf[idx + 1] * inv);
  buf[idx + 2] = Math.round(b * a + buf[idx + 2] * inv);
  buf[idx + 3] = Math.min(255, Math.round(255 * (a + (buf[idx + 3] / 255) * inv)));
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  const samples = 4; // 4x4 supersampling for crisp edges at 16px, 48px, and 128px

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const nx = (x + (sx + 0.5) / samples) / size;
          const ny = (y + (sy + 0.5) / samples) / size;

          const bgDist = sdRoundedRect(nx, ny, 0.5, 0.5, 0.465, 0.465, 0.21);
          if (bgDist > 0.015) continue;

          // Base dark slate gradient
          const gradT = (nx + ny) * 0.5;
          let r = 15 + gradT * 4;
          let g = 23 + gradT * 6;
          let b = 42 + gradT * 12;
          let a = bgDist < 0 ? 1 : Math.max(0, 1 - bgDist / 0.015);

          // Subtle border
          if (bgDist > -0.022 && bgDist <= 0.004) {
            r = 45;
            g = 62;
            b = 85;
          }

          // Shield stroke (teal gradient)
          const shieldD = shieldOutlineDistance(nx, ny);
          const shieldHalfWidth = size <= 20 ? 0.042 : 0.032;
          if (shieldD < shieldHalfWidth) {
            r = Math.round(45 - gradT * 32);
            g = Math.round(212 - gradT * 64);
            b = Math.round(191 - gradT * 55);
          }

          // Eye outline
          const eyeD = eyeOutlineDistance(nx, ny);
          const eyeHalfWidth = size <= 20 ? 0.03 : 0.024;
          if (eyeD < eyeHalfWidth) {
            r = 226;
            g = 232;
            b = 240;
          }

          // Pupil dot
          const pupilD = Math.hypot(nx - 0.5, ny - 0.5);
          if (pupilD < 0.06) {
            r = 45;
            g = 212;
            b = 191;
          }

          // Diagonal cloak slash cutout + teal slash
          const slashD = distToSegment(nx, ny, 0.34, 0.65, 0.66, 0.35);
          if (slashD < 0.046) {
            r = 15;
            g = 23;
            b = 42;
          }
          if (slashD < (size <= 20 ? 0.028 : 0.022)) {
            r = 45;
            g = 212;
            b = 191;
          }

          accR += r * a;
          accG += g * a;
          accB += b * a;
          accA += a;
        }
      }

      const n = samples * samples;
      const idx = (y * size + x) * 4;
      if (accA > 0) {
        rgba[idx] = Math.round(accR / accA);
        rgba[idx + 1] = Math.round(accG / accA);
        rgba[idx + 2] = Math.round(accB / accA);
        rgba[idx + 3] = Math.round((accA / n) * 255);
      }
    }
  }

  return rgba;
}

for (const size of SIZES) {
  const rgba = renderIcon(size);
  const png = encodePNG(size, size, rgba);
  const outPath = path.join(__dirname, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${outPath} (${png.length} bytes)`);
}
