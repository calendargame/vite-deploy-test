import { Component } from 'react'

// Top-level safety net. Catches any error thrown while React renders the app and shows a
// recover card instead of a blank screen. (Covers render errors; async / event-handler errors
// are a separate concern for later.) Inline styles so the fallback still renders even if the
// app's CSS / Tailwind failed to load.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Record it for debugging — never swallow it silently.
    console.error('Calendar Game crashed:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#0d1117',
          color: '#f5f3ff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">
            😵
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 20px', lineHeight: 1.5 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 22px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
