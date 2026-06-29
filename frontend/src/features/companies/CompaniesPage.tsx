import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useCompanies, useDeleteCompany } from './api'
import { CompanyForm } from './CompanyForm'

const PAGE_SIZE = 10

export function CompaniesPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const { data, isLoading, error } = useCompanies({
    search: search || undefined,
    owner_id: mine ? me?.user.id : undefined,
    page,
    page_size: PAGE_SIZE,
    sort: 'created_at',
    order: 'desc',
  })
  const del = useDeleteCompany()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name, domain, industry…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1) }} />
          My records
        </label>
        <button className="btn" onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New company'}
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
              <th className="t-actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>Loading…</td></tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/companies/${c.id}`)}>
                <td><strong>{c.name}</strong></td>
                <td>{c.domain || '—'}</td>
                <td>{c.industry || '—'}</td>
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
              <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>No companies yet.</td></tr>
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
