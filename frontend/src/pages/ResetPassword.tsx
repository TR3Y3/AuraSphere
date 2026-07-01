import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, type Me } from '../lib/api'
import { useAuth } from '../auth/AuthContext'

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setErr('This reset link is missing its token.'); return }
    setBusy(true); setErr(null)
    try {
      await api.post<Me>('/api/auth/reset-password', { token, password })
      await refresh()
      navigate('/', { replace: true })
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
          <div><b>AuraSphere</b><small>Set a new password</small></div>
        </div>
        {err && <div className="notice err">{err}</div>}
        <div className="field">
          <label className="cl">New password</label>
          <input className="ti" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" minLength={8} />
        </div>
        <button className="btn" type="submit" disabled={busy || password.length < 8}>
          {busy ? 'Saving…' : 'Set password & sign in'}
        </button>
        <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}
