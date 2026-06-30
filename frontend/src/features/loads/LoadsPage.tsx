import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useBoardMeta, useLoads, STATUS_LABEL, money, type LoadListParams } from './api'
import { LoadsBoard } from './LoadsBoard'
import { LoadForm } from './LoadForm'

export function LoadsPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)

  const { data: meta } = useBoardMeta()
  const listKey: LoadListParams = { owner_id: mine ? me?.user.id : undefined, page_size: 1000 }
  const { data, isLoading } = useLoads(listKey)
  const pipeline = meta?.pipeline ?? []

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

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <LoadForm mode="load" onDone={(l) => { setCreating(false); if (l) navigate(`/loads/${l.id}`) }} />
        </div>
      )}

      {isLoading && <p className="muted">Loading loads…</p>}

      {data && view === 'board' && pipeline.length > 0 && (
        <LoadsBoard pipeline={pipeline} loads={data.items} listKey={listKey} />
      )}

      {data && view === 'list' && (
        <div className="panel">
          <table>
            <thead><tr><th>Ref</th><th>Status</th><th>Shipper</th><th>Lane</th><th>Customer</th><th>Margin</th></tr></thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id} className="row-link" onClick={() => navigate(`/loads/${l.id}`)}>
                  <td><strong>{l.reference}</strong></td>
                  <td><span className="badge b-brand">{STATUS_LABEL[l.status] ?? l.status}</span></td>
                  <td>{l.shipper?.name ?? '—'}</td>
                  <td>{[l.origin_city, l.dest_city].filter(Boolean).join(' → ') || '—'}</td>
                  <td>{money(l.customer_rate)}</td>
                  <td className="dc-amt">{l.margin != null ? money(l.margin) : '—'}</td>
                </tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>No loads yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
