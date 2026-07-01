import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit} noValidate>
        <div className="brand" style={{ border: 0, padding: '0 0 16px' }}>
          <span className="logo-mark">A</span>
          <div><b>AuraSphere</b><small>Reset password</small></div>
        </div>
        {sent ? (
          <>
            <div className="notice" style={{ background: 'rgba(63,185,80,0.14)', color: 'var(--good)' }}>
              If an account exists for <strong>{email}</strong>, a reset link is on its way.
            </div>
            <Link className="btn ghost" to="/login" style={{ marginTop: 12, justifyContent: 'center' }}>Back to sign in</Link>
          </>
        ) : (
          <>
            {err && <div className="notice err">{err}</div>}
            <div className="field">
              <label className="cl">Work email</label>
              <input className="ti" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <button className="btn" type="submit" disabled={busy || !email}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
              Remembered it? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </form>
    </div>
  )
}
