/**
 * Generates the PWA app icons from public/logo.svg.
 *
 * Run manually after changing the logo or the icon composition:
 *   npx tsx scripts/generate-pwa-icons.ts
 *
 * Outputs are committed to public/icons/, so there is no build-time step.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LOGO = path.join(process.cwd(), 'public', 'logo.svg');
const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

/** Light-theme background, so the icon reads as a badge resting on paper. */
const PAPER = '#F7F6F3';
/** logo.svg viewBox. The artwork inside it is smaller, measured below. */
const VIEW_W = 900;
/** Degrees. Negative is counter-clockwise. */
const TILT = -6;

interface Target {
  file: string;
  size: number;
  /** Tag width as a fraction of the icon width. */
  fraction: number;
}

const TARGETS: Target[] = [
  // purpose: any. iOS applies only a gentle squircle, so the tag can fill more.
  { file: 'icon-192.png', size: 192, fraction: 0.78 },
  { file: 'icon-512.png', size: 512, fraction: 0.78 },
  // purpose: maskable. Android may crop to any shape and only guarantees a
  // centred circle of 80% of the width, so the tag must stay smaller.
  { file: 'maskable-192.png', size: 192, fraction: 0.62 },
  { file: 'maskable-512.png', size: 512, fraction: 0.62 },
  { file: 'apple-touch-icon.png', size: 180, fraction: 0.78 },
  // 1024 variants: on high density Android devices, the splash screen icon is
  // drawn at more device pixels than 512, so Chrome upscales the 512 asset.
  { file: 'icon-1024.png', size: 1024, fraction: 0.78 },
  { file: 'maskable-1024.png', size: 1024, fraction: 0.62 },
];

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * logo.svg has padding inside its viewBox, so the artwork's real bounding box
 * has to be measured rather than assumed. Measured by rasterising at a known
 * scale and trimming the transparent margin.
 */
async function measureArtwork(svg: Buffer): Promise<BBox> {
  const PROBE_WIDTH = 1800;
  const scale = PROBE_WIDTH / VIEW_W;
  const flat = await sharp(svg, { density: 72 }).resize({ width: PROBE_WIDTH }).png().toBuffer();
  const { info } = await sharp(flat).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  // trim() always populates these offsets; sharp's types mark them optional
  // only because they are absent when trim is not requested.
  const trimOffsetLeft = info.trimOffsetLeft ?? 0;
  const trimOffsetTop = info.trimOffsetTop ?? 0;
  return {
    x: -trimOffsetLeft / scale,
    y: -trimOffsetTop / scale,
    width: info.width / scale,
    height: info.height / scale,
  };
}

function buildSvg(inner: string, box: BBox, size: number, fraction: number): string {
  const scale = (size * fraction) / box.width;
  const centreX = box.x + box.width / 2;
  const centreY = box.y + box.height / 2;
  const blur = ((size / 512) * 5).toFixed(2);
  const offsetY = ((size / 512) * 7).toFixed(2);

  // The shadow uses feGaussianBlur/feOffset/feFlood/feComposite/feMerge because
  // librsvg (which sharp renders SVG with) does not reliably support
  // feDropShadow. That failure is silent: you get no shadow, not an error.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <filter id="tagShadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${blur}"/>
      <feOffset dx="0" dy="${offsetY}" result="offsetblur"/>
      <feFlood flood-color="#3C281E" flood-opacity="0.28"/>
      <feComposite in2="offsetblur" operator="in" result="shadow"/>
      <feMerge>
        <feMergeNode in="shadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${size}" height="${size}" fill="${PAPER}"/>
  <g filter="url(#tagShadow)" transform="translate(${size / 2} ${size / 2}) rotate(${TILT}) scale(${scale.toFixed(6)}) translate(${(-centreX).toFixed(3)} ${(-centreY).toFixed(3)})">${inner}</g>
</svg>`;
}

async function main(): Promise<void> {
  const svg = readFileSync(LOGO);
  const box = await measureArtwork(svg);

  const match = svg.toString().match(/<\/metadata>([\s\S]*)<\/svg>/);
  if (!match) {
    throw new Error('Could not extract drawable content from public/logo.svg');
  }
  // The white plate behind the letter cut-outs becomes the paper tone so the
  // wordmark reads as die-cut from the background.
  const inner = match[1].replace('fill:#ffffff', `fill:${PAPER}`);

  mkdirSync(OUT_DIR, { recursive: true });

  // Report the Android safe-zone result so a future change to TILT or the
  // fractions cannot silently push the artwork outside the guaranteed area.
  for (const fraction of [0.62, 0.78]) {
    const width = fraction;
    const height = width / (box.width / box.height);
    const cornerRadius = Math.hypot(width / 2, height / 2);
    const verdict = cornerRadius <= 0.4 ? 'inside safe zone' : 'outside safe zone (fine for purpose: any)';
    console.log(
      `tag at ${(fraction * 100).toFixed(0)}%: corners at ${(cornerRadius * 100).toFixed(1)}% of size, ${verdict}`
    );
  }

  for (const { file, size, fraction } of TARGETS) {
    await sharp(Buffer.from(buildSvg(inner, box, size, fraction)), { density: 72 })
      .flatten({ background: PAPER })
      .png({ compressionLevel: 9 })
      .toFile(path.join(OUT_DIR, file));
    console.log(`wrote public/icons/${file}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
