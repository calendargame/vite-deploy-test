// PostCSS config — runs Tailwind (which reads tailwind.config.js) then
// autoprefixer, as part of the Vite build. Replaces the in-browser compilation
// the Tailwind Play CDN used to do. Vite picks this up automatically.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
