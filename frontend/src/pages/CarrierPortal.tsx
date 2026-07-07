import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

// Carrier-facing mobile web app (v1). No login — the private per-carrier link
// is the credential (broker generates/revokes it from the carrier profile).

interface Meta { carrier_name: string; org_name: string; accent_color: string | null }
interface PLoad {
  id: number; reference: string | null
  origin_city: string | null; origin_state: string | null
  dest_city: string | null; dest_state: string | null
  pickup_date: string | null; delivery_date: string | null
  equipment: string | null; commodity: string | null
  weight: number | null; total_miles: number | null
}
interface PMyLoad extends PLoad { status: string; carrier_rate: string | null }

const lane = (l: PLoad) =>
  `${[l.origin_city, l.origin_state].filter(Boolean).join(', ')} → ${[l.dest_city, l.dest_state].filter(Boolean).join(', ')}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD')
const usd = (v: string | null) => (v ? Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—')

export function CarrierPortal() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const q = (path: string) => `${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`

  const [meta, setMeta] = useState<Meta | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'available' | 'mine'>('available')
  const [available, setAvailable] = useState<PLoad[]>([])
  const [mine, setMine] = useState<PMyLoad[]>([])
  const [offering, setOffering] = useState<number | null>(null)
  const [rate, setRate] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [sharing, setSharing] = useState<number | null>(null)
  const watchRef = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadFor = useRef<number | null>(null)

  const refresh = () => {
    api.get<PLoad[]>(q('/api/portal/loads/available')).then(setAvailable).catch(() => {})
    api.get<PMyLoad[]>(q('/api/portal/loads/mine')).then(setMine).catch(() => {})
  }

  useEffect(() => {
    if (!token) { setErr('This portal link is missing its token.'); return }
    api.get<Meta>(q('/api/portal/meta'))
      .then((m) => { setMeta(m); refresh() })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not open the portal.'))
    const t = setInterval(refresh, 20000)
    return () => clearInterval(t)
  }, [token])  // eslint-disable-line react-hooks/exhaustive-deps

  async function submitOffer(loadId: number) {
    try {
      await api.post(q(`/api/portal/loads/${loadId}/offer`), { rate, notes: null })
      setNote('✓ Offer sent — the broker sees it live.')
      setOffering(null); setRate(''); refresh()
    } catch (e) {
      setNote(e instanceof ApiError ? e.message : 'Offer failed — try again.')
    }
  }

  function toggleShare(loadId: number) {
    if (sharing === loadId) {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null; setSharing(null)
      setNote('Location sharing stopped.')
      return
    }
    if (!navigator.geolocation) { setNote('Location not supported on this device.'); return }
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    let last = 0
    watchRef.current = navigator.geolocation.watchPosition((pos) => {
      const now = Date.now()
      if (now - last < 60000) return  // throttle to ~1 ping/min
      last = now
      api.post(q(`/api/portal/loads/${loadId}/ping`), {
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
      }).catch(() => {})
    }, () => setNote('Location permission denied.'), { enableHighAccuracy: true })
    setSharing(loadId)
    setNote('📍 Sharing your location with dispatch while this page is open.')
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const loadId = uploadFor.current
    if (!file || loadId == null) return
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'pod')
    try {
      await api.upload(q(`/api/portal/loads/${loadId}/documents`), form)
      setNote('✓ Paperwork uploaded — dispatch has it.')
    } catch (err2) {
      setNote(err2 instanceof ApiError ? err2.message : 'Upload failed — try again.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const accent = meta?.accent_color || '#8b5cf6'

  if (err) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 420, textAlign: 'center', color: '#111' }}>
          <div style={{ fontSize: 30 }}>🔒</div>
          <p>{err}</p>
          <p style={{ fontSize: 13, color: '#666' }}>Ask your broker for a fresh portal link.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', color: '#111', paddingBottom: 40 }}>
      <header style={{ background: accent, color: '#fff', padding: '14px 16px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{meta?.org_name ?? '…'} · Carrier Portal</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{meta?.carrier_name}</div>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 12px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={() => setTab('available')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 0, fontWeight: 700, cursor: 'pointer',
              background: tab === 'available' ? accent : '#e4e4e4', color: tab === 'available' ? '#fff' : '#333' }}>
            Load board ({available.length})
          </button>
          <button onClick={() => setTab('mine')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 0, fontWeight: 700, cursor: 'pointer',
              background: tab === 'mine' ? accent : '#e4e4e4', color: tab === 'mine' ? '#fff' : '#333' }}>
            My loads ({mine.length})
          </button>
        </div>

        {note && (
          <div style={{ background: '#fff', border: `1px solid ${accent}`, borderRadius: 9, padding: '10px 12px', marginBottom: 12, fontSize: 14 }}>
            {note} <button style={{ float: 'right', border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setNote(null)}>✕</button>
          </div>
        )}

        {tab === 'available' && (
          <>
            {available.length === 0 && <p style={{ textAlign: 'center', color: '#777' }}>No open loads right now — check back soon.</p>}
            {available.map((l) => (
              <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 15 }}>{lane(l)}</strong>
                  <span style={{ fontSize: 12, color: '#666' }}>{l.reference}</span>
                </div>
                <div style={{ fontSize: 13, color: '#555', margin: '6px 0' }}>
                  PU {day(l.pickup_date)} · {l.equipment ?? 'Any equip'} · {l.total_miles ? `${l.total_miles} mi` : '— mi'}
                  {l.weight ? ` · ${l.weight.toLocaleString()} lbs` : ''}{l.commodity ? ` · ${l.commodity}` : ''}
                </div>
                {offering === l.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" inputMode="decimal" placeholder="Your all-in rate $" value={rate} autoFocus
                      onChange={(e) => setRate(e.target.value)}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #bbb', borderRadius: 8, fontSize: 15 }} />
                    <button onClick={() => submitOffer(l.id)} disabled={!rate}
                      style={{ padding: '10px 16px', background: accent, color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                      Send
                    </button>
                    <button onClick={() => { setOffering(null); setRate('') }}
                      style={{ padding: '10px 12px', background: '#eee', border: 0, borderRadius: 8, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setOffering(l.id); setRate('') }}
                    style={{ width: '100%', padding: '10px 0', background: accent, color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    Make an offer
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'mine' && (
          <>
            {mine.length === 0 && <p style={{ textAlign: 'center', color: '#777' }}>No active loads with this broker yet.</p>}
            {mine.map((l) => (
              <div key={l.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 15 }}>{lane(l)}</strong>
                  <span style={{ background: '#eef', color: '#446', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
                    {l.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#555', margin: '6px 0' }}>
                  {l.reference} · PU {day(l.pickup_date)} · DEL {day(l.delivery_date)} ·
                  <strong style={{ color: '#111' }}> {usd(l.carrier_rate)}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleShare(l.id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 0, fontWeight: 700, cursor: 'pointer',
                      background: sharing === l.id ? '#1a7f37' : '#e8f4ec', color: sharing === l.id ? '#fff' : '#1a7f37' }}>
                    {sharing === l.id ? '📍 Sharing location…' : '📍 Share location'}
                  </button>
                  <button onClick={() => { uploadFor.current = l.id; fileRef.current?.click() }}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 0, fontWeight: 700, cursor: 'pointer',
                      background: '#eef0ff', color: '#3a45b0' }}>
                    📄 Upload POD/BOL
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={onPickFile} />
      <p style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>Powered by AuraSphere</p>
    </div>
  )
}
