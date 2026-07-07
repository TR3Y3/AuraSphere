import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

interface SignView {
  org_name: string
  load_reference: string | null
  carrier_name: string | null
  html: string
  signed: boolean
  signed_at: string | null
  expired: boolean
}

// Public carrier-facing page (no login — the single-use link is the credential).
// The future carrier app deep-links here for in-app signing.
export function SignRateCon() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [view, setView] = useState<SignView | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setErr('This signing link is missing its token.'); return }
    api.get<SignView>(`/api/sign/${token}`).then(setView)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not load the rate confirmation.'))
  }, [token])

  async function sign(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      setView(await api.post<SignView>(`/api/sign/${token}`, { signer_name: name }))
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Signing failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', padding: '28px 14px' }}>
      <div style={{ maxWidth: 780, margin: '0 auto' }}>
        {err && !view && <div className="notice err" style={{ background: '#fee', color: '#b00' }}>{err}</div>}
        {view && (
          <>
            <div style={{ background: '#fff', borderRadius: 10, padding: 22, boxShadow: '0 2px 14px rgba(0,0,0,0.1)' }}
              dangerouslySetInnerHTML={{ __html: view.html }} />

            <div style={{ background: '#fff', borderRadius: 10, padding: 22, marginTop: 14, boxShadow: '0 2px 14px rgba(0,0,0,0.1)', color: '#111' }}>
              {view.signed ? (
                <div style={{ color: '#1a7f37', fontWeight: 600 }}>
                  ✓ Signed{view.signed_at ? ` on ${new Date(view.signed_at).toLocaleString()}` : ''}. You're covered on this load — safe travels.
                </div>
              ) : view.expired ? (
                <div style={{ color: '#b35900', fontWeight: 600 }}>
                  ⏳ This offer has expired. Contact {view.org_name} for a new rate confirmation.
                </div>
              ) : (
                <form onSubmit={sign}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Sign this rate confirmation</div>
                  <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
                    Typing your full name and clicking Sign constitutes your electronic signature
                    and acceptance of the rate shown for load {view.load_reference ?? ''}.
                  </p>
                  {err && <div style={{ color: '#b00', marginBottom: 8 }}>{err}</div>}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
                      style={{ flex: '1 1 220px', padding: '10px 12px', border: '1px solid #bbb', borderRadius: 8, fontSize: 15 }} />
                    <button type="submit" disabled={busy || name.trim().length < 2}
                      style={{ padding: '10px 22px', background: '#1a7f37', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                      {busy ? 'Signing…' : '✍ Sign & accept'}
                    </button>
                  </div>
                </form>
              )}
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 14 }}>
              Powered by AuraSphere · sent by {view.org_name}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
