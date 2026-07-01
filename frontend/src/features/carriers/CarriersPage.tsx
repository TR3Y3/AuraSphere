import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCarriers, useDeleteCarrier } from './api'
import { CarrierForm } from './CarrierForm'
import { Rating } from '../../components/shell'

const PAGE_SIZE = 10

export function CarriersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState({ status: '', hq_state: '', equipment: '', min_rating: '' })
  const setFilter = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setPage(1) }

  const { data, isLoading, error } = useCarriers({
    search: search || undefined,
    status: f.status || undefined,
    hq_state: f.hq_state || undefined,
    equipment: f.equipment || undefined,
    min_rating: f.min_rating ? Number(f.min_rating) : undefined,
    page,
    page_size: PAGE_SIZE,
  })
  const del = useDeleteCarrier()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <section>
      <h1 className="page-h">Carriers</h1>
      <div className="toolbar">
        <input type="search" placeholder="Search name, MC#, DOT#…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New carrier'}
        </button>
      </div>

      <div className="toolbar" style={{ gap: 8 }}>
        <select className="ti" style={{ maxWidth: 140 }} value={f.status} onChange={(e) => setFilter({ status: e.target.value })}>
          <option value="">Status: any</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
        <input className="ti" style={{ maxWidth: 90 }} placeholder="HQ ST" maxLength={2}
          value={f.hq_state} onChange={(e) => setFilter({ hq_state: e.target.value.toUpperCase() })} />
        <input className="ti" style={{ maxWidth: 150 }} placeholder="Equipment"
          value={f.equipment} onChange={(e) => setFilter({ equipment: e.target.value })} />
        <select className="ti" style={{ maxWidth: 150 }} value={f.min_rating} onChange={(e) => setFilter({ min_rating: e.target.value })}>
          <option value="">Rating: any</option>
          <option value="4">4★ & up</option>
          <option value="3">3★ & up</option>
          <option value="2">2★ & up</option>
        </select>
        {(f.status || f.hq_state || f.equipment || f.min_rating) && (
          <button className="btn subtle" onClick={() => setFilter({ status: '', hq_state: '', equipment: '', min_rating: '' })}>Clear</button>
        )}
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <CarrierForm onDone={() => setCreating(false)} />
        </div>
      )}

      {error && <div className="notice err">Failed to load carriers.</div>}

      <div className="panel">
        <table>
          <thead>
            <tr><th>Carrier</th><th>MC #</th><th>HQ</th><th>Rating</th><th>Status</th><th className="t-actions" /></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>Loading…</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/carriers/${c.id}`)}>
                <td><strong>{c.name}</strong></td>
                <td>{c.mc_number || '—'}</td>
                <td>{c.hq_city ? `${c.hq_city}, ${c.hq_state ?? ''}` : '—'}</td>
                <td><Rating value={c.rating ? Number(c.rating) : null} /></td>
                <td>
                  <span className={`badge ${c.status === 'active' ? 'b-good' : 'b-muted'}`}>{c.status}</span>
                  {(c.compliance_issues?.length ?? 0) > 0 && (
                    <span title={c.compliance_issues!.join('; ')} style={{ marginLeft: 6, color: 'var(--danger)' }}>⚠</span>
                  )}
                </td>
                <td className="t-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn danger sm" onClick={() => { if (confirm(`Delete ${c.name}?`)) del.mutate(c.id) }}>Delete</button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>No carriers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="pager">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span>Page {page} of {totalPages} · {data.total} total</span>
          <button className="btn ghost sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </section>
  )
}
