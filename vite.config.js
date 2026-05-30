import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // This test app is served from https://calendargame.github.io/vite-deploy-test/,
  // so its files must load from that sub-path instead of the domain root.
  base: '/vite-deploy-test/',
  plugins: [react()],
})
