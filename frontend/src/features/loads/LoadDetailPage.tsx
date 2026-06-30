import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertBadge, KpiStrip, Panel, RecordHeader, Tabs } from '../../components/shell'
import { PinButton } from '../pins/PinButton'
import { useCarrier } from '../carriers/api'
import { useBoardMeta, useLoad, useUpdateLoad, useDeleteLoad, STATUS_LABEL, money } from './api'
import { LoadForm } from './LoadForm'
import { QuoteDesk } from './QuoteDesk'
import { Timeline } from '../activities/Timeline'

export function LoadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const loadId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: l, isLoading, error } = useLoad(loadId)
  const { data: meta } = useBoardMeta()
  const { data: assignedCarrier } = useCarrier(l?.carrier_id ?? undefined)
  const update = useUpdateLoad(loadId ?? 0)
  const del = useDeleteLoad()

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !l) return <div className="notice err">Load not found.</div>

  const route = [l.origin_city, l.dest_city].filter(Boolean).join(' → ')

  return (
    <section>
      <p style={{ marginBottom: 14 }}><Link to="/loads" className="muted">← Loads</Link></p>

      <RecordHeader
        status={STATUS_LABEL[l.status] ?? l.status}
        statusClass={`st-${l.status}`}
        title={l.reference ?? `Load ${l.id}`}
        subtitle={<>{l.shipper?.name ?? 'No shipper'}{route ? ` · ${route}` : ''}</>}
        actions={
          <>
            <select className="ti" style={{ width: 'auto' }} value={l.status}
              onChange={(e) => update.mutate({ status: e.target.value })}>
              {meta?.statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
            </select>
            <PinButton entityType="load" entityId={l.id} />
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>{editing ? '✕ Cancel' : '✎ Edit'}</button>
            <button className="btn danger" onClick={() => { if (confirm(`Delete ${l.reference}?`)) { del.mutate(l.id); navigate('/loads') } }}>Delete</button>
          </>
        }
      />

      <KpiStrip items={[
        { label: 'Customer rate', value: money(l.customer_rate) },
        { label: 'Carrier rate', value: money(l.carrier_rate) },
        { label: 'Margin', value: l.margin != null ? money(l.margin) : '—' },
        { label: 'Miles', value: l.total_miles ?? '—' },
      ]} />

      {editing ? (
        <Panel><LoadForm existing={l} onDone={() => setEditing(false)} /></Panel>
      ) : (
        <Tabs tabs={[
          { key: 'overview', label: 'Overview', content: (
        <div className="two-col">
          <Panel title="Route & stops">
            <div className="kv">
              <div className="k">Pickup (P1)</div>
              <div>{l.origin_city ? `${l.origin_city}, ${l.origin_state ?? ''}` : '—'}{l.pickup_date ? ` · ${l.pickup_date.slice(0, 10)}` : ''}</div>
              <div className="k">Delivery (D1)</div>
              <div>{l.dest_city ? `${l.dest_city}, ${l.dest_state ?? ''}` : '—'}{l.delivery_date ? ` · ${l.delivery_date.slice(0, 10)}` : ''}</div>
              <div className="k">Equipment</div><div>{l.equipment || '—'}</div>
              <div className="k">Commodity</div><div>{l.commodity || '—'}</div>
              <div className="k">Weight</div><div>{l.weight ? `${l.weight.toLocaleString()} lbs` : '—'}</div>
            </div>
          </Panel>

          <Panel title="Carrier & customer">
            {assignedCarrier && (assignedCarrier.compliance_issues?.length ?? 0) > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {assignedCarrier.compliance_issues!.map((i) => <AlertBadge key={i}>{i}</AlertBadge>)}
              </div>
            )}
            <div className="kv">
              <div className="k">Shipper</div>
              <div>{l.shipper ? <Link to={`/companies/${l.shipper.id}`}>{l.shipper.name}</Link> : '—'}</div>
              <div className="k">Carrier</div>
              <div>{l.carrier ? <Link to={`/carriers/${l.carrier.id}`}>{l.carrier.name}</Link> : <span className="muted">Unassigned</span>}</div>
              <div className="k">Contact</div>
              <div>{l.primary_contact ? <Link to={`/contacts/${l.primary_contact.id}`}>{l.primary_contact.first_name} {l.primary_contact.last_name ?? ''}</Link> : '—'}</div>
            </div>
          </Panel>
        </div>
          ) },
          { key: 'quote', label: 'Quote Desk', content: <QuoteDesk load={l} /> },
          { key: 'activity', label: 'Activity', content: <Timeline scope={{ related_load_id: l.id }} /> },
        ]} />
      )}
    </section>
  )
}
