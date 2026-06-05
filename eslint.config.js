import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Accessibility linting for JSX (alt text, aria, roles, labels, etc.).
      // The plugin's published peer range lags (it lists eslint <=9), but it loads
      // and lints correctly on our eslint 10 — verified, and pinned via an explicit
      // package.json `overrides` so this is a documented choice, not a blind --force.
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // No dead code: unused vars/imports are now an ERROR. The mode-untangle landed and
      // the fused App engine (the old home of the deferred unused locals) is deleted, so the
      // codebase is unused-var-clean and this rule can hold the line going forward.
      // `ignoreRestSiblings` permits the intentional "strip fields via rest" destructure
      // (e.g. `const {btns, isLive, ...date}=e` in gameReducer's stripEntryMeta); the `^_`
      // pattern still marks any other deliberate discard.
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // React-Compiler hook rules now run at their RECOMMENDED severities (the Stage-D deferral is
      // over: the React Compiler is enabled in vite.config and every violation was fixed at the
      // source). The compiler-correctness rules — refs, purity, immutability, set-state-in-effect,
      // static-components, preserve-manual-memoization, etc. — are ERRORS via
      // reactHooks.configs.flat.recommended (extended above), so a regression that makes a
      // component un-optimizable (and risks a subtle miscompile) now blocks CI. We deliberately do
      // NOT override exhaustive-deps to error: React keeps it `warn` because it's a heuristic with
      // known false-positives — more so with the compiler stabilizing functions the linter can't
      // see — so the handful of genuinely-intentional dep exclusions carry justified inline
      // disables instead. No per-rule overrides are needed here; the recommended config supplies them.
    },
  },
  // TypeScript (.ts/.tsx): the typescript-eslint parser (so ESLint can read TS syntax at all)
  // + its recommended, non-type-aware ruleset. Its no-unused-vars supersedes the core rule for
  // TS (it understands type-only usage), so we turn the core one off here and mirror our error
  // severity + ignoreRestSiblings on the TS version.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    // main.tsx is the app entry (renders the root) — it legitimately defines
    // components without exporting them, which the react-refresh rule flags. That
    // rule is for HMR of component MODULES, not the entry file, so silence it here.
    // (As the mode-untangle moves components into their own files, this shrinks.)
    files: ['src/main.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // MUST be last: turns off any ESLint rules that would conflict with Prettier's
  // formatting, so the two tools never fight (ESLint = correctness, Prettier = style).
  prettier,
])
