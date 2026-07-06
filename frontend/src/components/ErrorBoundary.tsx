import { Component, type ReactNode } from 'react'

// Last line of defense: a render error anywhere below shows a friendly
// recover screen instead of a white page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Unhandled UI error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="login-wrap">
        <div className="login" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>😵</div>
          <h2 style={{ border: 0, padding: 0, marginBottom: 8 }}>Something went wrong</h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
            The error's been logged. Reloading usually fixes it.
          </p>
          <button className="btn" style={{ justifyContent: 'center', width: '100%' }}
            onClick={() => window.location.reload()}>
            Reload AuraSphere
          </button>
        </div>
      </div>
    )
  }
}
