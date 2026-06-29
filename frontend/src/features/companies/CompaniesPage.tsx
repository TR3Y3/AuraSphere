import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useCompanies, useDeleteCompany } from './api'
import { CompanyForm } from './CompanyForm'

const PAGE_SIZE = 10

export function CompaniesPage() {
  const { me } = useAuth()
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Companies</h2>
        <button onClick={() => setCreating((v) => !v)} style={{ marginLeft: 'auto' }}>
          {creating ? 'Cancel' : 'New company'}
        </button>
      </div>

      {creating && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <CompanyForm onDone={() => setCreating(false)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="Search name, domain, industry…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          style={{ padding: 8, flex: 1 }}
        />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1) }} />
          My records
        </label>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>Failed to load companies.</p>}

      {data && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Domain</th>
                <th style={{ padding: 8 }}>Industry</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>
                    <Link to={`/companies/${c.id}`}>{c.name}</Link>
                  </td>
                  <td style={{ padding: 8 }}>{c.domain || '—'}</td>
                  <td style={{ padding: 8 }}>{c.industry || '—'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${c.name}?`)) del.mutate(c.id)
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, color: '#666' }}>No companies yet.</td></tr>
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page} of {totalPages} · {data.total} total</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}
    </section>
  )
}
