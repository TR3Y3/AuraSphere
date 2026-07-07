import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useBoardMeta, useLoads, STATUS_LABEL, money, type LoadListParams } from './api'
import { LoadsBoard } from './LoadsBoard'
import { LoadForm } from './LoadForm'
import { exportCsv } from '../../lib/csv'

export function LoadsPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState({ search: '', equipment: '', origin_state: '', dest_state: '', posted: '' })

  const { data: meta } = useBoardMeta()
  const listKey: LoadListParams = {
    owner_id: mine ? me?.user.id : undefined,
    search: filters.search || undefined,
    equipment: filters.equipment || undefined,
    origin_state: filters.origin_state || undefined,
    dest_state: filters.dest_state || undefined,
    posted_to_dat: filters.posted === '' ? undefined : filters.posted === 'yes',
    page_size: 1000,
  }
  const { data, isLoading } = useLoads(listKey)
  // Quotes live on the Quotes page — the Loads board/list is booked freight only.
  const pipeline = (meta?.pipeline ?? []).filter((s) => s !== 'quote')
  const items = (data?.items ?? []).filter((l) => l.status !== 'quote')

  return (
    <section>
      <h1 className="page-h">Loads</h1>
      <div className="toolbar">
        <div className="seg">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My loads
        </label>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New load'}
        </button>
      </div>

      <div className="toolbar" style={{ gap: 8 }}>
        <input className="ti" style={{ maxWidth: 220 }} placeholder="Search ref / commodity"
          value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input className="ti" style={{ maxWidth: 150 }} placeholder="Equipment"
          value={filters.equipment} onChange={(e) => setFilters({ ...filters, equipment: e.target.value })} />
        <input className="ti" style={{ maxWidth: 90 }} placeholder="Orig ST" maxLength={2}
          value={filters.origin_state} onChange={(e) => setFilters({ ...filters, origin_state: e.target.value.toUpperCase() })} />
        <input className="ti" style={{ maxWidth: 90 }} placeholder="Dest ST" maxLength={2}
          value={filters.dest_state} onChange={(e) => setFilters({ ...filters, dest_state: e.target.value.toUpperCase() })} />
        <select className="ti" style={{ maxWidth: 140 }} value={filters.posted}
          onChange={(e) => setFilters({ ...filters, posted: e.target.value })}>
          <option value="">DAT: any</option>
          <option value="yes">Posted to DAT</option>
          <option value="no">Not posted</option>
        </select>
        {(filters.search || filters.equipment || filters.origin_state || filters.dest_state || filters.posted) && (
          <button className="btn subtle" onClick={() => setFilters({ search: '', equipment: '', origin_state: '', dest_state: '', posted: '' })}>Clear</button>
        )}
        <button className="btn subtle" style={{ marginLeft: 'auto' }} title="Export the current view to CSV"
          onClick={() => exportCsv('loads.csv', items.map((l) => ({
            reference: l.reference, status: l.status, pickup: l.pickup_date?.slice(0, 10),
            shipper: l.shipper?.name, carrier: l.carrier?.name,
            origin: [l.origin_city, l.origin_state].filter(Boolean).join(' '),
            destination: [l.dest_city, l.dest_state].filter(Boolean).join(' '),
            equipment: l.equipment, miles: l.total_miles,
            customer_rate: l.customer_rate, carrier_rate: l.carrier_rate, margin: l.margin,
          })))}>⇩ CSV</button>
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <LoadForm mode="load" onDone={(l) => { setCreating(false); if (l) navigate(`/loads/${l.id}`) }} />
        </div>
      )}

      {isLoading && <p className="muted">Loading loads…</p>}

      {data && view === 'board' && pipeline.length > 0 && (
        <LoadsBoard pipeline={pipeline} loads={items} listKey={listKey} />
      )}

      {data && view === 'list' && (
        <div className="panel">
          <table>
            <thead><tr><th>Ref</th><th>Status</th><th>Pickup</th><th>Shipper</th><th>Carrier</th><th>Lane</th><th>Customer</th><th>Margin</th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="row-link" onClick={() => navigate(`/loads/${l.id}`)}>
                  <td><strong>{l.reference}</strong></td>
                  <td><span className="badge b-brand">{STATUS_LABEL[l.status] ?? l.status}</span></td>
                  <td>{l.pickup_date ? l.pickup_date.slice(0, 10) : '—'}</td>
                  <td>{l.shipper?.name ?? '—'}</td>
                  <td>{l.carrier?.name ?? <span className="muted">—</span>}</td>
                  <td>{[l.origin_city, l.dest_city].filter(Boolean).join(' → ') || '—'}</td>
                  <td>{money(l.customer_rate)}</td>
                  <td className="dc-amt">{l.margin != null ? money(l.margin) : '—'}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="muted" style={{ padding: 22 }}>No booked loads yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
