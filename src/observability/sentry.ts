// Real-user error reporting (Current Work C1) — Sentry, PRODUCTION + STAGING ONLY.
//
// Why this shape:
//  • ErrorBoundary (whole-app) + ModeErrorBoundary (per-mode) already CATCH crashes and show a
//    graceful recover card. This adds the missing half — telling us a crash happened on devices we
//    can't test (the book will send readers on a huge range of old/weak phones). The boundaries call
//    captureError() from componentDidCatch.
//  • LAZY-LOADED: the heavy SDK lives in ./sentryClient, pulled in via a dynamic import() as its OWN
//    chunk, so it never blocks first paint (most important on the weak devices we want to support). A
//    tiny eager pair of window handlers + a bounded queue buffer any errors that fire BEFORE the SDK
//    finishes loading (e.g. an early incompatibility crash on a slow device — exactly what we most
//    want to hear about), then flush once it is ready. The SDK installs its own global handlers, so
//    ours are removed on load to avoid double-reporting.
//  • PRIVACY-FIRST + LEAN: errors only — see ./sentryClient (no Session Replay, no Tracing,
//    sendDefaultPii:false) and the __SENTRY_* tree-shake flags in vite.config.js.
//  • PRODUCTION/STAGING ONLY: initObservability() is called from main.tsx behind import.meta.env.PROD,
//    so `vite dev` never reports. Deployed staging (test.calendargame.app) reports tagged
//    environment:'staging' (set in ./sentryClient), so we can verify it + catch bugs before prod.
type Reporter = (error: unknown, context?: Record<string, unknown>) => void

// Bound the pre-load buffer so a crash loop before the SDK arrives can't grow memory without limit.
const MAX_BUFFERED = 20

let report: Reporter | null = null
let started = false
const buffer: Array<{ error: unknown; context?: Record<string, unknown> }> = []

// Temporary, ultra-light handlers that buffer uncaught errors/rejections fired before the SDK loads;
// removed once the real SDK (with its own handlers) is ready.
function bufferUncaughtError(e: ErrorEvent) {
  captureError(e.error ?? e.message)
}
function bufferUnhandledRejection(e: PromiseRejectionEvent) {
  captureError(e.reason)
}

// Report a caught error. Safe to call anywhere (incl. dev + tests): before the SDK loads it buffers
// (bounded); if the SDK never loads (dev/tests/offline) it is a harmless no-op beyond that small
// buffer. The error boundaries call this from componentDidCatch.
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (report) report(error, context)
  else if (buffer.length < MAX_BUFFERED) buffer.push({ error, context })
}

// Start error reporting: install the temporary buffering handlers, then lazy-load + init the SDK.
// Idempotent. Call ONLY in production/staging (gated by import.meta.env.PROD in main.tsx).
export function initObservability() {
  if (started) return
  started = true

  window.addEventListener('error', bufferUncaughtError)
  window.addEventListener('unhandledrejection', bufferUnhandledRejection)

  const stopBuffering = () => {
    window.removeEventListener('error', bufferUncaughtError)
    window.removeEventListener('unhandledrejection', bufferUnhandledRejection)
  }

  import('./sentryClient')
    .then((sentry) => {
      sentry.startSentry()
      report = sentry.report
      // The SDK now owns the global error/rejection handlers → drop ours so nothing double-reports.
      stopBuffering()
      for (const item of buffer) sentry.report(item.error, item.context)
      buffer.length = 0
    })
    .catch(() => {
      // SDK blocked or offline — keep the app fully working; just stop buffering forever.
      stopBuffering()
      buffer.length = 0
    })
}
