import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useContacts } from '../contacts/api'
import { useCarrier, useDeleteCarrier } from './api'
import { CarrierForm } from './CarrierForm'
import { CapacityPanel } from './CapacityPanel'
import { VettingPanel } from './VettingPanel'
import { useLanes, useVetting } from './ops'
import { AlertBadge, KpiStrip, Panel, Rating, RecordHeader, Tabs } from '../../components/shell'
import { PinButton } from '../pins/PinButton'
import { Timeline } from '../activities/Timeline'
import { Copyable } from '../../components/Copy'

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
  const { data: lanesData } = useLanes(carrierId)
  const { data: vetting } = useVetting(carrierId)
  const del = useDeleteCarrier()

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !c) return <div className="notice err">Carrier not found.</div>

  const issues = c.compliance_issues ?? []

  const overview = (
    <div className="two-col">
      <Panel title="Company information">
        <div className="kv">
          <div className="k">MC #</div><div><Copyable value={c.mc_number} /></div>
          <div className="k">DOT #</div><div><Copyable value={c.dot_number} /></div>
          <div className="k">HQ</div><div>{c.hq_city ? `${c.hq_city}, ${c.hq_state ?? ''}` : '—'}</div>
          <div className="k">Phone</div><div><Copyable value={c.phone}>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : null}</Copyable></div>
          <div className="k">Email</div><div><Copyable value={c.email}>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}</Copyable></div>
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
      {issues.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {issues.map((i) => <AlertBadge key={i}>{i}</AlertBadge>)}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}><span className="badge b-good">✓ Compliant</span></div>
      )}
      <div className="kv">
        <div className="k">Status</div>
        <div><span className={`badge ${c.status === 'active' ? 'b-good' : 'b-muted'}`}>{c.status}</span></div>
        <div className="k">Auto liability</div><div>{money(c.auto_liability)}</div>
        <div className="k">Cargo coverage</div><div>{money(c.cargo_coverage)}</div>
      </div>
    </Panel>
  )

  const lanes = (
    <div className="two-col">
      <Panel title="Lane history" pad={false}>
        <table>
          <thead><tr><th>Lane</th><th>Equip</th><th>Loads</th><th>Last rate</th></tr></thead>
          <tbody>
            {lanesData?.map((ln, i) => (
              <tr key={i}>
                <td><strong>{ln.origin}</strong> → {ln.destination}</td>
                <td>{ln.equipment || '—'}</td>
                <td>{ln.shipments}</td>
                <td>{money(ln.last_rate)}</td>
              </tr>
            ))}
            {lanesData && lanesData.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 16 }}>No loads run with this carrier yet.</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
      <CapacityPanel carrierId={c.id} />
    </div>
  )

  return (
    <section>
      <p style={{ marginBottom: 14 }}><Link to="/carriers" className="muted">← Carriers</Link></p>

      <RecordHeader
        status={c.status}
        statusClass={`st-${c.status}`}
        title={c.name}
        subtitle={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Rating value={c.rating ? Number(c.rating) : null} />
            {c.hq_city ? `· ${c.hq_city}, ${c.hq_state ?? ''}` : ''}
            {issues.length > 0
              ? <AlertBadge>{issues.length === 1 ? issues[0] : `${issues.length} compliance issues`}</AlertBadge>
              : <span className="badge b-good">✓ Compliant</span>}
            {vetting && (
              <span className={`badge ${vetting.result === 'clear' ? 'b-good' : vetting.result === 'review' ? 'b-warn' : 'b-danger'}`}>
                {vetting.result === 'clear' ? '✓ Vetted' : vetting.result === 'review' ? '⚠ Vetting: review' : '✕ Vetting: failed'}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <PinButton entityType="carrier" entityId={c.id} />
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
            { key: 'vetting', label: 'Vetting', content: <VettingPanel carrierId={c.id} /> },
            { key: 'lanes', label: 'Lanes', content: lanes },
            { key: 'activity', label: 'Activity', content: <Timeline scope={{ related_carrier_id: c.id }} /> },
          ]}
        />
      )}
    </section>
  )
}
