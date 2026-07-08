import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type BoardOption } from '../../lib/api'
import { money } from '../loads/api'

// Org-wide Options board — every carrier option across every active load.
// Quotes = customer-facing pricing. Options = carrier-side coverage
// opportunities. Ops lives here: scan, sort, click through to the load.

const LIGHT: Record<string, { dot: string; label: string }> = {
  green: { dot: '#3fb950', label: 'Vetted & bookable' },
  orange: { dot: '#e3933c', label: 'Needs review before booking' },
  red: { dot: '#f85149', label: 'Not approved' },
  grey: { dot: '#8b949e', label: 'Not in your carrier list yet' },
}

const STATUS_BADGE: Record<string, string> = {
  available: 'b-good', countered: 'b-brand', not_available: 'b-muted',
  declined: 'b-muted', accepted: 'b-good',
}

function useBoardOptions(view: 'active' | 'inactive', search: string) {
  return useQuery({
    queryKey: ['options-board', view, search],
    queryFn: () => api.get<BoardOption[]>('/api/options', { view, search: search || undefined }),
    refetchInterval: 15000, // near-live: the board is trustworthy all day
  })
}

function day(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// "1h 23m" until expiry; red under 15 minutes; "expired" past it.
function Countdown({ expiresAt, expired }: { expiresAt: string; expired: boolean }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])
  if (expired) return <span className="badge b-muted">expired</span>
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return <span className="badge b-muted">expired</span>
  const mins = Math.floor(ms / 60000)
  const label = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
  const urgent = mins < 15
  return (
    <span className={`badge ${urgent ? 'b-danger' : 'b-warn'}`}
      title={`Expires ${new Date(expiresAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}>
      ⏳ {label}
    </span>
  )
}

export function OptionsBoardPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'active' | 'inactive'>('active')
  const [search, setSearch] = useState('')
  const { data: rows, isLoading } = useBoardOptions(view, search)

  return (
    <section>
      <h1 className="page-h">Options</h1>
      <p className="muted" style={{ marginTop: -10, marginBottom: 14, fontSize: 13 }}>
        Every carrier option across your active loads. Options expire 2 hours after they're
        logged — confirm the rate and re-add if a carrier is still interested.
      </p>

      <div className="toolbar">
        <div className="seg">
          <button className={view === 'active' ? 'on' : ''} onClick={() => setView('active')}>Active</button>
          <button className={view === 'inactive' ? 'on' : ''} onClick={() => setView('inactive')}>Inactive / Expired</button>
        </div>
        <input className="ti grow" type="search" placeholder="Search lane, carrier, MC#, load ref…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>● updates every 15s</span>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th></th><th>Load</th><th>Lane</th><th>PU / DEL</th><th>Carrier</th>
              <th>Rate</th><th>Margin</th><th>Status</th><th>{view === 'active' ? 'Expires' : 'Logged'}</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((o) => {
              const light = LIGHT[o.carrier_light ?? 'grey'] ?? LIGHT.grey
              return (
                <tr key={o.id} className="row-link" onClick={() => navigate(`/loads/${o.load_id}`)}
                  title="Open the load to cover or keep negotiating">
                  <td style={{ width: 26 }} title={light.label}>
                    <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: light.dot }} />
                  </td>
                  <td>
                    <strong>{o.load_reference ?? `Load ${o.load_id}`}</strong>
                    <div className="sub">{o.load_status.replace('_', ' ')}{o.equipment ? ` · ${o.equipment}` : ''}</div>
                  </td>
                  <td>
                    {[o.origin_city, o.origin_state].filter(Boolean).join(', ') || '—'}
                    {' → '}
                    {[o.dest_city, o.dest_state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td>{day(o.pickup_date)} / {day(o.delivery_date)}</td>
                  <td>
                    <strong>{o.carrier_name ?? '—'}</strong>
                    {o.source === 'carrier_app' && <span className="badge b-brand" style={{ marginLeft: 6, fontSize: 10 }}>app</span>}
                    <div className="sub">
                      {o.mc_number ?? ''}
                      {o.carrier_phone ? <> · <a href={`tel:${o.carrier_phone}`} onClick={(e) => e.stopPropagation()}>{o.carrier_phone}</a></> : null}
                      {o.carrier_email ? <> · <a href={`mailto:${o.carrier_email}`} onClick={(e) => e.stopPropagation()}>✉</a></> : null}
                    </div>
                  </td>
                  <td>
                    {money(o.rate)}
                    {o.counter_rate != null && <span className="muted"> → {money(o.counter_rate)}</span>}
                  </td>
                  <td className="dc-amt">{o.margin != null ? money(o.margin) : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] ?? 'b-muted'}`}>{o.status.replace('_', ' ')}</span></td>
                  <td>
                    {view === 'active'
                      ? <Countdown expiresAt={o.expires_at} expired={o.is_expired} />
                      : <span className="muted" style={{ fontSize: 12 }}>
                          {o.is_expired && ['available', 'countered'].includes(o.status)
                            ? 'expired · ' : ''}{day(o.created_at)}
                        </span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {o.notes ?? ''}
                  </td>
                </tr>
              )
            })}
            {!isLoading && rows && rows.length === 0 && (
              <tr><td colSpan={10} className="muted" style={{ padding: 18 }}>
                {view === 'active'
                  ? 'No live carrier options right now. Options land here from the Quote Desk on any load — and from the carrier app.'
                  : 'Nothing here yet — expired, declined, and covered options collect here.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
