import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

type State = 'working' | 'ok' | 'error'

export function Verify() {
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [state, setState] = useState<State>('working')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // tokens are single-use — never POST twice
    ran.current = true
    const token = params.get('token')
    if (!token) {
      setState('error')
      setMessage('This verification link is missing its token.')
      return
    }
    api
      .post('/api/auth/verify', { token })
      .then(async () => {
        await refresh()
        setState('ok')
      })
      .catch((err) => {
        setState('error')
        setMessage(err instanceof ApiError ? err.message : 'Verification failed')
      })
  }, [params, refresh])

  return (
    <div className="login-wrap">
      <div className="login">
        <div className="brand" style={{ border: 0, padding: '0 0 16px' }}>
          <span className="logo-mark">A</span>
          <div><b>AuraSphere</b><small>Email verification</small></div>
        </div>
        {state === 'working' && <p className="muted">Verifying your email…</p>}
        {state === 'ok' && (
          <>
            <div className="notice" style={{ background: 'rgba(63,185,80,0.14)', color: 'var(--good)' }}>
              ✓ Your email is verified.
            </div>
            <Link className="btn" to="/" style={{ marginTop: 12, justifyContent: 'center' }}>Go to dashboard</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <div className="notice err">{message}</div>
            <Link className="btn ghost" to="/" style={{ marginTop: 12, justifyContent: 'center' }}>Back to app</Link>
          </>
        )}
      </div>
    </div>
  )
}
