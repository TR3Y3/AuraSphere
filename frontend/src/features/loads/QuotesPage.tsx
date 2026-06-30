import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLoads, STATUS_LABEL, money } from './api'
import { LoadForm } from './LoadForm'

// Quotes = loads still in the early, pre-coverage statuses. New quotes are
// created via the quick LoadForm (quote mode) and land in `quote` status.
export function QuotesPage() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useLoads({ statuses: 'quote,tendered,offered', page_size: 500 })

  return (
    <section>
      <h1 className="page-h">Quotes</h1>
      <div className="toolbar">
        <span className="muted">Open quotes awaiting coverage</span>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New quote'}
        </button>
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <LoadForm mode="quote" onDone={(l) => { setCreating(false); if (l) navigate(`/loads/${l.id}`) }} />
        </div>
      )}

      {isLoading && <p className="muted">Loading quotes…</p>}

      {data && (
        <div className="panel">
          <table>
            <thead><tr><th>Ref</th><th>Status</th><th>Shipper</th><th>Lane</th><th>Customer rate</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="row-link" onClick={() => navigate(`/loads/${l.id}`)}>
                  <td><strong>{l.reference}</strong></td>
                  <td><span className="badge b-brand">{STATUS_LABEL[l.status] ?? l.status}</span></td>
                  <td>{l.shipper?.name ?? '—'}</td>
                  <td>{[l.origin_city, l.dest_city].filter(Boolean).join(' → ') || '—'}</td>
                  <td>{money(l.customer_rate)}</td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>No open quotes.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
