import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useCompanies, useDeleteCompany } from './api'
import { exportCsv } from '../../lib/csv'
import { useUsers } from '../users/api'
import { CompanyForm } from './CompanyForm'

const PAGE_SIZE = 10

export function CompaniesPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [repId, setRepId] = useState('')
  const [mine, setMine] = useState(false)
  const { data: users } = useUsers()
  const repOf = (id: number | null | undefined) => users?.find((u) => u.id === id)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const { data, isLoading, error } = useCompanies({
    search: search || undefined,
    industry: industry || undefined,
    owner_id: mine ? me?.user.id : repId ? Number(repId) : undefined,
    page,
    page_size: PAGE_SIZE,
    sort: 'created_at',
    order: 'desc',
  })
  const del = useDeleteCompany()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <section>
      <h1 className="page-h">Shippers</h1>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, domain, industry…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <input className="ti" style={{ maxWidth: 170 }} placeholder="Industry"
          value={industry} onChange={(e) => { setIndustry(e.target.value); setPage(1) }} />
        <select className="ti" style={{ maxWidth: 190 }} value={repId}
          onChange={(e) => { setRepId(e.target.value); setMine(false); setPage(1) }}>
          <option value="">Rep: all</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>{u.sales_code ? `${u.sales_code} · ` : ''}{u.full_name}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setRepId(''); setPage(1) }} />
          My records
        </label>
        <button className="btn subtle" style={{ marginLeft: 'auto' }} title="Export the current view to CSV"
          onClick={() => exportCsv('shippers.csv', (data?.items ?? []).map((c) => ({
            name: c.name, domain: c.domain, industry: c.industry, phone: c.phone, website: c.website,
          })))}>⇩ CSV</button>
        <button className="btn" onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New shipper'}
        </button>
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <CompanyForm onDone={() => setCreating(false)} />
        </div>
      )}

      {error && <div className="notice err">Failed to load companies.</div>}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Industry</th>
              <th>Rep</th>
              <th className="t-actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>Loading…</td></tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/companies/${c.id}`)}>
                <td><strong>{c.name}</strong></td>
                <td>{c.domain || '—'}</td>
                <td>{c.industry || '—'}</td>
                <td>
                  {(() => {
                    const o = repOf(c.owner_id)
                    const s2 = repOf(c.secondary_owner_id)
                    return (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {o ? (
                          <span>{o.sales_code && <span className="badge b-brand" style={{ marginRight: 5 }}>{o.sales_code}</span>}{o.full_name.split(' ')[0]}</span>
                        ) : <span className="muted">—</span>}
                        {s2 && <span className="muted" title={`Backup: ${s2.full_name}`} style={{ fontSize: 12 }}>+{s2.sales_code ?? s2.full_name.split(' ')[0]}</span>}
                      </span>
                    )
                  })()}
                </td>
                <td className="t-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn danger sm"
                    onClick={() => { if (confirm(`Delete ${c.name}?`)) del.mutate(c.id) }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>No shippers yet.</td></tr>
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
