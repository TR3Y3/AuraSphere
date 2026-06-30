import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useContacts } from '../contacts/api'
import { useCarrier, useDeleteCarrier } from './api'
import { CarrierForm } from './CarrierForm'
import { AlertBadge, KpiStrip, Panel, Rating, RecordHeader, Tabs } from '../../components/shell'

function money(v: string | null | undefined): string {
  if (!v) return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function CarrierDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const carrierId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: c, isLoading, error } = useCarrier(carrierId)
  const { data: contacts } = useContacts({ carrier_id: carrierId, page_size: 100 })
  const del = useDeleteCarrier()

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !c) return <div className="notice err">Carrier not found.</div>

  const noInsurance = !c.auto_liability && !c.cargo_coverage

  const overview = (
    <div className="two-col">
      <Panel title="Company information">
        <div className="kv">
          <div className="k">MC #</div><div>{c.mc_number || '—'}</div>
          <div className="k">DOT #</div><div>{c.dot_number || '—'}</div>
          <div className="k">HQ</div><div>{c.hq_city ? `${c.hq_city}, ${c.hq_state ?? ''}` : '—'}</div>
          <div className="k">Phone</div><div>{c.phone || '—'}</div>
          <div className="k">Email</div><div>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</div>
          <div className="k">Equipment</div><div>{c.equipment_types || '—'}</div>
        </div>
      </Panel>
      <Panel title="Contacts">
        {contacts && contacts.items.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {contacts.items.map((ct) => (
              <li key={ct.id}>
                <Link to={`/contacts/${ct.id}`}>{ct.first_name} {ct.last_name ?? ''}</Link>
                {ct.title ? ` — ${ct.title}` : ''}
              </li>
            ))}
          </ul>
        ) : <span className="muted">No contacts at this carrier yet.</span>}
      </Panel>
    </div>
  )

  const compliance = (
    <Panel title="Compliance & insurance">
      {noInsurance && <div style={{ marginBottom: 12 }}><AlertBadge>No insurance on file</AlertBadge></div>}
      <div className="kv">
        <div className="k">Status</div>
        <div><span className={`badge ${c.status === 'active' ? 'b-good' : 'b-muted'}`}>{c.status}</span></div>
        <div className="k">Auto liability</div><div>{money(c.auto_liability)}</div>
        <div className="k">Cargo coverage</div><div>{money(c.cargo_coverage)}</div>
      </div>
    </Panel>
  )

  const lanes = (
    <Panel title="Lane history">
      <span className="muted">Lane &amp; rate history arrives in F3 (carrier ops).</span>
    </Panel>
  )

  return (
    <section>
      <p style={{ marginBottom: 14 }}><Link to="/carriers" className="muted">← Carriers</Link></p>

      <RecordHeader
        status={c.status}
        statusClass={`st-${c.status}`}
        title={c.name}
        subtitle={<><Rating value={c.rating ? Number(c.rating) : null} />{c.hq_city ? ` · ${c.hq_city}, ${c.hq_state ?? ''}` : ''}</>}
        actions={
          <>
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>{editing ? '✕ Cancel' : '✎ Edit'}</button>
            <button className="btn danger" onClick={() => { if (confirm(`Delete ${c.name}?`)) { del.mutate(c.id); navigate('/carriers') } }}>Delete</button>
          </>
        }
      />

      <KpiStrip
        items={[
          { label: 'On-time', value: c.on_time_pct != null ? `${c.on_time_pct}%` : '—' },
          { label: 'Tracking', value: c.tracking_pct != null ? `${c.tracking_pct}%` : '—' },
          { label: 'Bounce', value: c.bounce_pct != null ? `${c.bounce_pct}%` : '—' },
          { label: 'Rating', value: c.rating ? Number(c.rating).toFixed(1) : '—' },
        ]}
      />

      {editing ? (
        <Panel><CarrierForm existing={c} onDone={() => setEditing(false)} /></Panel>
      ) : (
        <Tabs
          tabs={[
            { key: 'overview', label: 'Overview', content: overview },
            { key: 'compliance', label: 'Compliance', content: compliance },
            { key: 'lanes', label: 'Lanes', content: lanes },
          ]}
        />
      )}
    </section>
  )
}
