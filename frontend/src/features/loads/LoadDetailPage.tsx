import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertBadge, KpiStrip, Panel, RecordHeader, Tabs } from '../../components/shell'
import { PinButton } from '../pins/PinButton'
import { useCarrier } from '../carriers/api'
import { Copy } from '../../components/Copy'
import { useBoardMeta, useLoad, useUpdateLoad, useDeleteLoad, useDuplicateLoad, useDatPost, STATUS_LABEL, money, marginPct, LOW_MARGIN_PCT } from './api'
import { LoadForm } from './LoadForm'
import { QuoteDesk } from './QuoteDesk'
import { DocumentsPanel } from './documents'
import { MarketRatePanel } from './marketrate'
import { TrackingPanel } from './tracking'
import { Timeline } from '../activities/Timeline'

// Forward-progression actions, in pipeline order. Only those ahead of the
// load's current status are shown; the first one is the primary next step.
const FORWARD: { status: string; label: string }[] = [
  { status: 'tendered', label: 'Tender' },
  { status: 'covered', label: 'Cover' },
  { status: 'dispatched', label: 'Dispatch' },
  { status: 'delivered', label: 'Mark Delivered' },
]
const PIPELINE_ORDER = ['quote', 'tendered', 'offered', 'covered', 'dispatched', 'in_transit', 'delivered', 'invoiced']
const TERMINAL = ['lost', 'tonu']

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
  const dup = useDuplicateLoad()
  const datPost = useDatPost(loadId ?? 0)

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !l) return <div className="notice err">Load not found.</div>

  const route = [l.origin_city, l.dest_city].filter(Boolean).join(' → ')
  const isQuote = l.status === 'quote'
  const isTerminal = TERMINAL.includes(l.status)
  const mPct = marginPct(l.margin, l.customer_rate)
  // Quotes aren't measured on margin until they're tendered/booked.
  const lowMargin = !isQuote && !isTerminal && mPct != null && mPct < LOW_MARGIN_PCT

  const curIdx = PIPELINE_ORDER.indexOf(l.status)
  const forward = FORWARD.filter((a) => PIPELINE_ORDER.indexOf(a.status) > curIdx)

  function rebook() {
    dup.mutate(l!.id, { onSuccess: (clone) => navigate(`/loads/${clone.id}`) })
  }

  return (
    <section>
      <p style={{ marginBottom: 14 }}><Link to="/loads" className="muted">← Loads</Link></p>

      <RecordHeader
        status={STATUS_LABEL[l.status] ?? l.status}
        statusClass={`st-${l.status}`}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{l.reference ?? `Load ${l.id}`}<Copy value={l.reference} /></span>}
        subtitle={<>{l.shipper?.name ?? 'No shipper'}{route ? ` · ${route}` : ''}</>}
        actions={
          <>
            <select className="ti" style={{ width: 'auto' }} value={l.status}
              onChange={(e) => update.mutate({ status: e.target.value })}>
              {meta?.statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
            </select>
            <PinButton entityType="load" entityId={l.id} />
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>{editing ? '✕ Cancel' : '✎ Edit'}</button>
          </>
        }
      />

      <div className="action-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, margin: '12px 0' }}>
        {/* Forward progression — the immediate next step is the primary button. */}
        {forward.map((a, i) => (
          <button key={a.status} className={`btn ${i === 0 ? '' : 'ghost'}`}
            onClick={() => update.mutate({ status: a.status })} disabled={update.isPending}>
            {a.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button className={`btn ${l.posted_to_dat ? 'ghost' : ''}`} onClick={() => datPost.mutate(!l.posted_to_dat)}
          disabled={datPost.isPending}
          title={l.posted_to_dat ? 'Remove this load from the DAT load board' : 'Post this load to the DAT load board'}>
          {datPost.isPending ? '…' : l.posted_to_dat ? '✓ Posted to DAT' : '📡 Post to DAT'}
        </button>

        <button className="btn ghost" onClick={rebook} disabled={dup.isPending}
          title="Re-book: copy this load's lane & shipper into a new quote (drops the carrier) — e.g. to re-run the same lane.">
          {dup.isPending ? 'Copying…' : '⎘ Duplicate'}
        </button>

        {/* Secondary / destructive actions, de-emphasized and off to the side. */}
        {!isTerminal && (
          <>
            <button className="btn subtle" onClick={() => update.mutate({ status: 'lost' })} disabled={update.isPending}>
              Mark lost
            </button>
            <button className="btn subtle" onClick={() => update.mutate({ status: 'tonu' })} disabled={update.isPending}
              title="Truck Ordered Not Used — marks the load TONU and keeps the assigned carrier on record.">
              TONU
            </button>
          </>
        )}
        <button className="btn subtle" title="Delete load"
          onClick={() => { if (confirm(`Delete ${l.reference}? This can't be undone.`)) { del.mutate(l.id); navigate('/loads') } }}>
          🗑
        </button>
      </div>

      <KpiStrip items={[
        { label: 'Customer rate', value: money(l.customer_rate) },
        { label: 'Carrier rate', value: money(l.carrier_rate) },
        { label: 'Margin', value: l.margin != null ? money(l.margin) : '—' },
        {
          label: 'Margin %',
          value: mPct != null
            ? <span style={{ color: lowMargin ? 'var(--danger, #f87171)' : undefined }}>
                {mPct.toFixed(1)}%{lowMargin ? ' ⚠' : ''}
              </span>
            : '—',
        },
        { label: 'Miles', value: l.total_miles ?? '—' },
      ]} />
      {lowMargin && (
        <div className="notice err" style={{ marginTop: 8 }}>
          ⚠ Low margin — {mPct!.toFixed(1)}% is below the {LOW_MARGIN_PCT}% target.
        </div>
      )}

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
          <div style={{ gridColumn: '1 / -1' }}><MarketRatePanel load={l} /></div>
        </div>
          ) },
          { key: 'tracking', label: 'Tracking', content: <TrackingPanel load={l} /> },
          { key: 'quote', label: 'Quote Desk', content: <QuoteDesk load={l} /> },
          { key: 'documents', label: 'Documents', content: <DocumentsPanel loadId={l.id} /> },
          { key: 'activity', label: 'Activity', content: <Timeline scope={{ related_load_id: l.id }} /> },
        ]} />
      )}
    </section>
  )
}
