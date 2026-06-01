/** @type {import('tailwindcss').Config} */
// Tailwind v3 build config (Stage C — Tailwind-in-build, replacing the dev-only
// Play CDN). Pinned to v3.4 so the compiled output is visually byte-identical to
// what the CDN served — this step changes the BUILD, not the look. (The v3 -> v4
// upgrade is a separate, later step.)
//
// `content` MUST list every place a Tailwind class can appear, or the production
// purge will drop classes the app needs at runtime. We scan index.html (the
// shell still has utility classes) and the entire src tree (main.jsx + every
// component). This includes classes built via template strings, so we keep the
// scan broad.
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  // Theme switching is driven by a [data-theme="..."] attribute on <html> (set by
  // the inline script in index.html), NOT Tailwind's dark: variant — so no
  // darkMode config is needed; the custom CSS handles per-theme overrides.
  theme: {
    extend: {},
  },
  plugins: [],
}
