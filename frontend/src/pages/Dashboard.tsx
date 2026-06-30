import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCompanies } from '../features/companies/api'
import { useCarriers } from '../features/carriers/api'
import { useContacts } from '../features/contacts/api'
import { useLoads } from '../features/loads/api'
import { usePins, useUpdatePin, useDeletePin } from '../features/pins/api'

const TYPE_ICON: Record<string, string> = { load: '◧', contact: '☰', carrier: '⛟', shipper: '▣' }

function fmtRemind(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const overdue = d.getTime() < Date.now()
  return `${overdue ? '⏰ overdue · ' : '⏰ '}${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
}

export function Dashboard() {
  const { me } = useAuth()
  const shippers = useCompanies({ page_size: 1 })
  const carriers = useCarriers({ page_size: 1 })
  const contacts = useContacts({ page_size: 1 })
  const loads = useLoads({ page_size: 1 })
  const { data: pins } = usePins()
  const updatePin = useUpdatePin()
  const delPin = useDeletePin()
  if (!me) return null

  const stat = (q: { data?: { total: number } }) => (q.data ? q.data.total : '—')

  return (
    <section>
      <h1 className="page-h">Welcome back, {me.user.full_name.split(' ')[0]}</h1>

      <div className="cards">
        <div className="card"><div className="k">Loads</div><div className="v">{stat(loads)}</div></div>
        <div className="card"><div className="k">Carriers</div><div className="v">{stat(carriers)}</div></div>
        <div className="card"><div className="k">Shippers</div><div className="v">{stat(shippers)}</div></div>
        <div className="card"><div className="k">Contacts</div><div className="v">{stat(contacts)}</div></div>
      </div>

      <h2 style={{ fontSize: 15, margin: '8px 0 12px' }}>📌 Pinned</h2>
      {pins && pins.length === 0 && (
        <div className="panel panel-pad">
          <span className="muted">
            Nothing pinned yet. Open a load, carrier, shipper, or contact and hit <strong>☆ Pin</strong> to
            keep it here — add a note or a reminder for call-backs.
          </span>
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
                    <span style={{ marginRight: 6 }}>{TYPE_ICON[p.entity_type] ?? '📌'}</span>
                    {p.link ? <Link to={p.link}>{p.label ?? `${p.entity_type} ${p.entity_id}`}</Link> : (p.label ?? 'Removed')}
                  </div>
                  {p.sublabel && <div className="cc-title">{p.sublabel}</div>}
                </div>
                <button className="iconbtn" title="Unpin" onClick={() => delPin.mutate(p.id)}>✕</button>
              </div>
              <textarea className="ti" rows={2} placeholder="Add a note…" defaultValue={p.note ?? ''}
                onBlur={(e) => { if (e.target.value !== (p.note ?? '')) updatePin.mutate({ id: p.id, note: e.target.value }) }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="ti" type="datetime-local" style={{ flex: 1 }}
                  defaultValue={p.remind_at ? p.remind_at.slice(0, 16) : ''}
                  onChange={(e) => updatePin.mutate({ id: p.id, remind_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              {remind && <div className="cc-title" style={{ color: 'var(--warn)' }}>{remind}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
