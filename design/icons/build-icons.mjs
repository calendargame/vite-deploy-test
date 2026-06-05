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

const lightSvg = readFileSync(join(here, 'icon-piday-trace.svg'), 'utf8')
// The MASKABLE (Android adaptive) variant re-renders the glyph at a REDUCED scale so it stays
// inside the 40% maskable safe circle (a pure-circle mask would otherwise clip the big glyph).
// The master's larger scale is kept for the visible icons (iOS apple-touch / "any" / favicon),
// where the full tile or a generous squircle mask shows the glyph bigger in the home-screen bubble.
const maskableSvg = lightSvg.replace(/scale\([\d.]+\)/, 'scale(1.9)')
// Dark home-screen icon is DISABLED — iOS doesn't reliably honor a dark-variant apple-touch-icon
// (it often needs a remove + re-add, or ignores it entirely), so we ship the single light icon.
// The dark master SVG is kept. To re-enable: uncomment the 3 dark lines here + re-run this script,
// and uncomment the dark <link> in index.html.
// const darkSvg = readFileSync(join(here, 'icon-piday-trace-dark.svg'))

// Render the SVG to a crisp 1024px base raster once, then downscale to each target.
const base = (svg) => sharp(svg, { density: 384 }).resize(1024, 1024).png().toBuffer()
const write = async (buf, size, file) =>
  sharp(buf).resize(size, size).png({ compressionLevel: 9 }).toFile(join(outDir, file))

const visibleBase = await base(Buffer.from(lightSvg)) // big glyph: any / apple-touch / favicon
const maskableBase = await base(Buffer.from(maskableSvg)) // reduced glyph: safe inside the mask circle
// const darkBase = await base(Buffer.from(darkSvg))   // dark icon disabled (see note above)

await Promise.all([
  // Web app manifest icons (any) — from the big-glyph master.
  write(visibleBase, 64, 'pwa-64x64.png'),
  write(visibleBase, 192, 'pwa-192x192.png'),
  write(visibleBase, 512, 'pwa-512x512.png'),
  // Maskable (Android adaptive) — reduced glyph so a circle mask can't clip it.
  write(maskableBase, 512, 'maskable-icon-512x512.png'),
  // iOS home-screen icon (180). Light only — the dark variant is disabled (see note above).
  write(visibleBase, 180, 'apple-touch-icon.png'),
  // write(darkBase, 180, 'apple-touch-icon-dark.png'),   // dark icon disabled
  // Favicon: a scalable SVG (modern browsers) + a PNG fallback.
  write(visibleBase, 32, 'favicon-32x32.png'),
])
copyFileSync(join(here, 'icon-piday-trace.svg'), join(outDir, 'favicon.svg'))

console.log('PWA icons written to public/:')
for (const f of [
  'pwa-64x64.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'maskable-icon-512x512.png',
  'apple-touch-icon.png',
  'favicon-32x32.png',
  'favicon.svg',
])
  console.log('  ' + f)
