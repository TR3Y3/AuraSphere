import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { usePipelines, useDeal, useDeleteDeal } from './api'
import { DealForm } from './DealForm'

function money(amount: string | null): string {
  if (!amount) return '—'
  const n = Number(amount)
  return Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function DealDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dealId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: deal, isLoading, error } = useDeal(dealId)
  const { data: pipelines } = usePipelines()
  const del = useDeleteDeal()

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !deal) return <div className="notice err">Deal not found.</div>

  const pipeline = pipelines?.find((p) => p.id === deal.pipeline_id)
  const stageName = pipeline?.stages.find((s) => s.id === deal.stage_id)?.name ?? '—'

  return (
    <section>
      <p style={{ marginBottom: 14 }}>
        <Link to="/deals" className="muted">← Deals</Link>
      </p>

      <div className="profile">
        <div className="panel panel-pad">
          <div className="head">
            <div className="avatar">{deal.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{deal.name}</div>
              <div className="muted">
                <span className="badge b-brand">{stageName}</span>
                {deal.amount && <span style={{ marginLeft: 8 }}>{money(deal.amount)}</span>}
              </div>
            </div>
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? '✕ Cancel' : '✎ Edit'}
            </button>
            <button
              className="btn danger"
              onClick={() => { if (confirm(`Delete ${deal.name}?`)) { del.mutate(deal.id); navigate('/deals') } }}
            >
              Delete
            </button>
          </div>
        </div>

        {editing && pipeline ? (
          <div className="panel panel-pad">
            <DealForm pipeline={pipeline} existing={deal} onDone={() => setEditing(false)} />
          </div>
        ) : (
          <div className="panel panel-pad">
            <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>Details</h2>
            <div className="kv">
              <div className="k">Stage</div><div>{stageName}</div>
              <div className="k">Amount</div><div>{money(deal.amount)}</div>
              <div className="k">Company</div>
              <div>{deal.company ? <Link to={`/companies/${deal.company.id}`}>{deal.company.name}</Link> : '—'}</div>
              <div className="k">Primary contact</div>
              <div>
                {deal.primary_contact
                  ? <Link to={`/contacts/${deal.primary_contact.id}`}>{deal.primary_contact.first_name} {deal.primary_contact.last_name ?? ''}</Link>
                  : '—'}
              </div>
              <div className="k">Expected close</div>
              <div>{deal.expected_close_date ? deal.expected_close_date.slice(0, 10) : '—'}</div>
              <div className="k">Closed</div>
              <div>{deal.closed_at ? deal.closed_at.slice(0, 10) : '—'}</div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
