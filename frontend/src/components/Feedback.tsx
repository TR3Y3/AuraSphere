import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

export function FeedbackButton() {
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending'); setErr(null)
    try {
      await api.post('/api/feedback', { message, page: loc.pathname })
      setState('done'); setMessage('')
      setTimeout(() => { setOpen(false); setState('idle') }, 1400)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not send'); setState('idle')
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button className="iconbtn" aria-label="Send feedback" title="Send feedback" onClick={() => setOpen(true)}>💬</button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Send feedback" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ border: 0, padding: 0, margin: 0, flex: 1 }}>Send feedback</h2>
              <button className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            </div>
            {state === 'done' ? (
              <div className="notice" style={{ background: 'rgba(63,185,80,0.14)', color: 'var(--good)' }}>
                ✓ Thanks! Your feedback was sent.
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                  Found a bug or have an idea? We read every note.
                </p>
                <textarea className="ti" rows={5} value={message} required autoFocus
                  placeholder="What's working, what's broken, what you'd want next…"
                  onChange={(e) => setMessage(e.target.value)} />
                {err && <div className="notice err" style={{ marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="submit" className="btn" disabled={state === 'sending' || !message.trim()}>
                    {state === 'sending' ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
