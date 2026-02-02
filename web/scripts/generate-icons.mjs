/**
 * Generate PNG icons from the Minimal Bolt SVG
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal Bolt SVG - the selected icon
const minimalBoltSvg = `
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="minimalBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#14b8a6" />
      <stop offset="100%" stop-color="#0d9488" />
    </linearGradient>
  </defs>
  <!-- Background - circle for a badge feel -->
  <circle cx="64" cy="64" r="60" fill="url(#minimalBg)" />
  <!-- White ring -->
  <circle cx="64" cy="64" r="52" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.2" />
  <!-- Bold lightning bolt -->
  <path d="M72 20L40 68h20L48 108l40-52H68l4-36z" fill="white" />
</svg>
`;

// Square version for favicon (fills the canvas better)
const minimalBoltSvgSquare = `
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="minimalBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="50%" stop-color="#14b8a6" />
      <stop offset="100%" stop-color="#0d9488" />
    </linearGradient>
  </defs>
  <!-- Background - rounded square -->
  <rect width="128" height="128" rx="24" fill="url(#minimalBg)" />
  <!-- White ring approximation -->
  <rect x="8" y="8" width="112" height="112" rx="20" fill="none" stroke="white" stroke-width="3" stroke-opacity="0.2" />
  <!-- Bold lightning bolt -->
  <path d="M72 20L40 68h20L48 108l40-52H68l4-36z" fill="white" />
</svg>
`;

const extensionSizes = [16, 32, 48, 128];
const webSizes = [16, 32, 180, 192, 512]; // favicon, apple-touch-icon, PWA icons

async function generateIcons() {
  const extensionIconsDir = join(__dirname, '../../extension/public/icons');
  const webPublicDir = join(__dirname, '../public');

  // Ensure directories exist
  mkdirSync(extensionIconsDir, { recursive: true });
  mkdirSync(webPublicDir, { recursive: true });

  console.log('Generating extension icons...');

  // Generate extension icons (circular badge style)
  for (const size of extensionSizes) {
    const outputPath = join(extensionIconsDir, `icon-${size}.png`);
    await sharp(Buffer.from(minimalBoltSvg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}.png`);
  }

  console.log('\nGenerating web icons...');

  // Generate favicon.ico (16x16 PNG, browsers handle it)
  const favicon16 = join(webPublicDir, 'favicon.ico');
  await sharp(Buffer.from(minimalBoltSvgSquare))
    .resize(32, 32)
    .png()
    .toFile(favicon16.replace('.ico', '.png'));

  // Also create as proper favicon.ico (32x32 PNG works as ICO in most browsers)
  await sharp(Buffer.from(minimalBoltSvgSquare))
    .resize(32, 32)
    .png()
    .toFile(join(webPublicDir, 'favicon.png'));
  console.log('  Created: favicon.png');

  // Apple touch icon
  await sharp(Buffer.from(minimalBoltSvgSquare))
    .resize(180, 180)
    .png()
    .toFile(join(webPublicDir, 'apple-touch-icon.png'));
  console.log('  Created: apple-touch-icon.png');

  // PWA icons
  for (const size of [192, 512]) {
    const outputPath = join(webPublicDir, `icon-${size}.png`);
    await sharp(Buffer.from(minimalBoltSvgSquare))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}.png`);
  }

  // Also save the SVG for reference
  writeFileSync(join(webPublicDir, 'logo.svg'), minimalBoltSvgSquare.trim());
  console.log('  Created: logo.svg');

  console.log('\nDone! Icons generated successfully.');
}

generateIcons().catch(console.error);
