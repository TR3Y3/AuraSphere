import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useActivities, useUpdateActivity } from './api'

function when(iso: string | null | undefined): string {
  if (!iso) return 'no due date'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function relatedLink(a: { related_load_id?: number | null; related_carrier_id?: number | null; related_company_id?: number | null; related_contact_id?: number | null }) {
  if (a.related_load_id) return { to: `/loads/${a.related_load_id}`, label: 'Load' }
  if (a.related_carrier_id) return { to: `/carriers/${a.related_carrier_id}`, label: 'Carrier' }
  if (a.related_company_id) return { to: `/companies/${a.related_company_id}`, label: 'Shipper' }
  if (a.related_contact_id) return { to: `/contacts/${a.related_contact_id}`, label: 'Contact' }
  return null
}

export function MyTasksPage() {
  const { me } = useAuth()
  const { data, isLoading } = useActivities({ open_tasks: true, owner_id: me?.user.id })
  const update = useUpdateActivity()

  return (
    <section>
      <h1 className="page-h">My open tasks</h1>
      {isLoading && <p className="muted">Loading…</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Task</th><th>Due</th><th>Linked</th><th className="t-actions" /></tr></thead>
          <tbody>
            {data?.items.map((a) => {
              const overdue = a.due_at && new Date(a.due_at) < new Date()
              const link = relatedLink(a)
              return (
                <tr key={a.id}>
                  <td><strong>{a.subject || '(untitled task)'}</strong>{a.body && <div className="sub">{a.body}</div>}</td>
                  <td className={overdue ? 'tl-overdue' : ''}>{overdue ? '⏰ ' : ''}{when(a.due_at)}</td>
                  <td>{link ? <Link to={link.to}>{link.label} →</Link> : '—'}</td>
                  <td className="t-actions"><button className="btn sm" onClick={() => update.mutate({ id: a.id, completed: true })}>✓ Done</button></td>
                </tr>
              )
            })}
            {data && data.items.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>No open tasks. Log one from any record's Activity tab.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
