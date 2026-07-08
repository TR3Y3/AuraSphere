import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '6rem', margin: 0, color: 'var(--danger)' }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', margin: '12px 0 8px', color: '#666' }}>Page Not Found</h2>
      <p style={{ fontSize: '1rem', color: '#999', margin: '0 0 24px', maxWidth: '500px' }}>
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
        ← Back to Dashboard
      </Link>
    </div>
  )
}
