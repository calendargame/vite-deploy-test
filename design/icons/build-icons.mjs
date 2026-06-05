// Rasterize the chosen app-icon SVG masters into the PWA PNG set in public/.
// Reproducible: re-run with `node design/icons/build-icons.mjs` after editing a master.
//
//   icon-piday-trace.svg       (light master)  -> the standard/light icons + favicon
//   icon-piday-trace-dark.svg  (dark master)   -> the dark apple-touch-icon (iOS dark mode)
//
// The masters are finished, full-bleed 512x512 designs (the glyph already sits inside the
// 40% maskable safe circle), so each output is a straight high-quality downscale — no extra
// padding or background compositing. sharp renders the SVG at high density first (crisp), then
// resizes. Outputs are referenced by the web manifest (vite.config) and index.html.
import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

const lightSvg = readFileSync(join(here, 'icon-piday-trace.svg'))
const darkSvg = readFileSync(join(here, 'icon-piday-trace-dark.svg'))

// Render the SVG to a crisp 1024px base raster once, then downscale to each target.
const base = (svg) => sharp(svg, { density: 384 }).resize(1024, 1024).png().toBuffer()
const write = async (buf, size, file) =>
  sharp(buf).resize(size, size).png({ compressionLevel: 9 }).toFile(join(outDir, file))

const lightBase = await base(lightSvg)
const darkBase = await base(darkSvg)

await Promise.all([
  // Web app manifest icons (any) + maskable — all from the light master.
  write(lightBase, 64, 'pwa-64x64.png'),
  write(lightBase, 192, 'pwa-192x192.png'),
  write(lightBase, 512, 'pwa-512x512.png'),
  write(lightBase, 512, 'maskable-icon-512x512.png'),
  // iOS home-screen icon (180), light + dark (the dark one is served via a prefers-color-scheme link).
  write(lightBase, 180, 'apple-touch-icon.png'),
  write(darkBase, 180, 'apple-touch-icon-dark.png'),
  // Favicon: a scalable SVG (modern browsers) + a PNG fallback.
  write(lightBase, 32, 'favicon-32x32.png'),
])
copyFileSync(join(here, 'icon-piday-trace.svg'), join(outDir, 'favicon.svg'))

console.log('PWA icons written to public/:')
for (const f of [
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon.png',
  'apple-touch-icon-dark.png',
  'favicon-32x32.png',
  'favicon.svg',
])
  console.log('  ' + f)
