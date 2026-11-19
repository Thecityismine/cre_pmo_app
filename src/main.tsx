import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: 480, color: '#f1f5f9', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: '#f87171', fontSize: '1.25rem', marginBottom: '0.75rem' }}>App failed to start</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {(this.state.error as Error).message}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
              If this is a production deployment, make sure all <code style={{ color: '#93c5fd' }}>VITE_FIREBASE_*</code> environment variables are set in Vercel → Settings → Environment Variables.
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
