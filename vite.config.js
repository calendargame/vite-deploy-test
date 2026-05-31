import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The original app shipped as <script type="text/babel" data-presets="env,react">, i.e. Babel
// transpiled it to older-style JS where `let`/`const` hoist like `var` (a value can be referenced
// just before its declaration). Vite's modern compiler enforces the strict rule and throws on
// those spots. To behave IDENTICALLY to the live site without editing app source, run main.jsx
// through Babel's block-scoping transform first (let/const -> var), restoring that hoisting. This
// just reproduces the original toolchain; the use-before-declare quirks it papers over are noted
// for a deliberate cleanup in a later step.
function babelBlockScoping() {
  return {
    name: 'babel-block-scoping',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/')
      if (!file.endsWith('/src/main.jsx')) return null
      const { transformAsync } = await import('@babel/core')
      const result = await transformAsync(code, {
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ['jsx'] },
        plugins: ['@babel/plugin-transform-block-scoping'],
        sourceMaps: true,
        filename: id,
      })
      return result ? { code: result.code, map: result.map } : null
    },
  }
}

export default defineConfig(({ command }) => ({
  // Published build is served from the /vite-deploy-test/ sub-path; local dev stays at root.
  base: command === 'build' ? '/vite-deploy-test/' : '/',
  plugins: [babelBlockScoping(), react()],
}))
