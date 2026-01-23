#!/usr/bin/env node
/**
 * Generate placeholder extension icons
 * These are simple cyan squares with "FN" text overlay
 * Replace with proper branded icons before Chrome Web Store submission
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generation for solid color icons
// This creates valid PNG files without external dependencies

function createPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = createIHDRChunk(width, height);

  // IDAT chunk (image data)
  const idat = createIDATChunk(width, height, r, g, b);

  // IEND chunk
  const iend = createIENDChunk();

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDRChunk(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;  // bit depth
  data[9] = 2;  // color type (RGB)
  data[10] = 0; // compression
  data[11] = 0; // filter
  data[12] = 0; // interlace

  return createChunk('IHDR', data);
}

function createIDATChunk(width, height, r, g, b) {
  const zlib = require('zlib');

  // Create raw image data (filter byte + RGB for each pixel)
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // filter type: none

    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;

      // Create a simple gradient/icon effect
      const centerX = width / 2;
      const centerY = height / 2;
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const maxDist = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
      const factor = 1 - (dist / maxDist) * 0.3;

      // Lightning bolt shape approximation
      const inBolt = isInLightningBolt(x, y, width, height);

      if (inBolt) {
        // White for the bolt
        raw[pixelStart] = 255;
        raw[pixelStart + 1] = 255;
        raw[pixelStart + 2] = 255;
      } else {
        // Cyan background with gradient
        raw[pixelStart] = Math.round(r * factor);
        raw[pixelStart + 1] = Math.round(g * factor);
        raw[pixelStart + 2] = Math.round(b * factor);
      }
    }
  }

  const compressed = zlib.deflateSync(raw);
  return createChunk('IDAT', compressed);
}

function isInLightningBolt(x, y, width, height) {
  // Normalize coordinates to 0-1 range
  const nx = x / width;
  const ny = y / height;

  // Simple lightning bolt shape
  // Top triangle pointing down-right
  if (ny < 0.55) {
    const expectedX = 0.3 + (ny - 0.15) * 0.8;
    const leftEdge = expectedX - 0.15;
    const rightEdge = expectedX + 0.05;
    if (nx >= leftEdge && nx <= rightEdge && ny >= 0.15) {
      return true;
    }
  }

  // Bottom triangle pointing down-left
  if (ny >= 0.45 && ny <= 0.85) {
    const expectedX = 0.7 - (ny - 0.45) * 0.8;
    const leftEdge = expectedX - 0.05;
    const rightEdge = expectedX + 0.15;
    if (nx >= leftEdge && nx <= rightEdge) {
      return true;
    }
  }

  return false;
}

function createIENDChunk() {
  return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crc = crc32(Buffer.concat([typeBuffer, data]));

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

let crcTable = null;
function getCRCTable() {
  if (crcTable) return crcTable;

  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xEDB88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    crcTable[n] = c;
  }
  return crcTable;
}

// Generate icons
const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Cyan color from Tailwind (primary-500 equivalent)
const cyan = { r: 6, g: 182, b: 212 };

sizes.forEach(size => {
  const png = createPNG(size, size, cyan.r, cyan.g, cyan.b);
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, png);
  console.log(`Created ${filename}`);
});

console.log('\nPlaceholder icons generated successfully!');
console.log('Note: Replace these with properly designed icons before Chrome Web Store submission.');
