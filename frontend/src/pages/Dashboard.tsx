import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { usePins, useUpdatePin, useDeletePin } from '../features/pins/api'
import { useSummary, money } from '../features/dashboard/api'
import { STATUS_LABEL } from '../features/loads/api'
import { TYPE_ICON } from '../features/activities/api'

const TYPE_ICON_PIN: Record<string, string> = { load: '◧', contact: '☰', carrier: '⛟', shipper: '▣' }

function fmtRemind(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const overdue = d.getTime() < Date.now()
  return `${overdue ? '⏰ overdue · ' : '⏰ '}${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
}

export function Dashboard() {
  const { me } = useAuth()
  const { data: s } = useSummary()
  const { data: pins } = usePins()
  const updatePin = useUpdatePin()
  const delPin = useDeletePin()
  if (!me) return null

  const maxStatusValue = Math.max(1, ...(s?.value_by_status ?? []).map((v) => Number(v.value)))

  return (
    <section>
      <h1 className="page-h">Welcome back, {me.user.full_name.split(' ')[0]}</h1>

      <div className="cards">
        <div className="card"><div className="k">Loaded $</div><div className="v">{money(s?.loaded_dollars)}</div></div>
        <div className="card"><div className="k">Total margin</div><div className="v" style={{ color: 'var(--good)' }}>{money(s?.total_margin)}</div></div>
        <div className="card"><div className="k">Avg margin / load</div><div className="v">{money(s?.avg_margin)}</div></div>
        <div className="card"><div className="k">Open loads</div><div className="v">{s?.open_loads ?? '—'}</div></div>
        <div className="card"><div className="k">My open tasks</div><div className="v">{s?.open_tasks ?? '—'}</div></div>
      </div>

      <div className="two-col" style={{ marginBottom: 22 }}>
        <div className="panel">
          <h2>Pipeline value by status</h2>
          <div className="panel-pad">
            {s?.value_by_status.map((v) => (
              <div key={v.status} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                  <span>{STATUS_LABEL[v.status] ?? v.status} <span className="muted">· {v.count}</span></span>
                  <span>{money(v.value)}</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(Number(v.value) / maxStatusValue) * 100}%`, height: '100%', background: 'var(--brand)' }} />
                </div>
              </div>
            ))}
            {s && s.value_by_status.length === 0 && <span className="muted">No loads yet.</span>}
          </div>
        </div>

        <div className="panel">
          <h2>Recent activity</h2>
          <div className="panel-pad">
            {s?.recent_activity.map((a) => (
              <div key={a.id} className="tl-item">
                <span className="tl-ico">{TYPE_ICON[a.type] ?? '•'}</span>
                <div className="tl-body">
                  {a.subject && <div className="tl-subject" style={{ fontSize: 13 }}>{a.subject}</div>}
                  <div className="tl-meta">{a.type} · {new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
            {s && s.recent_activity.length === 0 && <span className="muted">No activity yet.</span>}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: '8px 0 12px' }}>📌 Pinned</h2>
      {pins && pins.length === 0 && (
        <div className="panel panel-pad">
          <span className="muted">Nothing pinned. Open a record and hit <strong>☆ Pin</strong> to keep it here with a note or reminder.</span>
        </div>
      )}
      <div className="cardgrid">
        {pins?.map((p) => {
          const remind = fmtRemind(p.remind_at)
          return (
            <div className="contact-card" key={p.id}>
              <div className="cc-head">
                <div>
                  <div className="cc-name">
                    <span style={{ marginRight: 6 }}>{TYPE_ICON_PIN[p.entity_type] ?? '📌'}</span>
                    {p.link ? <Link to={p.link}>{p.label ?? `${p.entity_type} ${p.entity_id}`}</Link> : (p.label ?? 'Removed')}
                  </div>
                  {p.sublabel && <div className="cc-title">{p.sublabel}</div>}
                </div>
                <button className="iconbtn" title="Unpin" onClick={() => delPin.mutate(p.id)}>✕</button>
              </div>
              <textarea className="ti" rows={2} placeholder="Add a note…" defaultValue={p.note ?? ''}
                onBlur={(e) => { if (e.target.value !== (p.note ?? '')) updatePin.mutate({ id: p.id, note: e.target.value }) }} />
              <input className="ti" type="datetime-local" defaultValue={p.remind_at ? p.remind_at.slice(0, 16) : ''}
                onChange={(e) => updatePin.mutate({ id: p.id, remind_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              {remind && <div className="cc-title" style={{ color: 'var(--warn)' }}>{remind}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
