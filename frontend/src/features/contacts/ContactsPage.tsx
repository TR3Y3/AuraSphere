import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useContacts, useDeleteContact } from './api'
import { ContactForm } from './ContactForm'

const PAGE_SIZE = 10

export function ContactsPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)

  const { data, isLoading, error } = useContacts({
    search: search || undefined,
    owner_id: mine ? me?.user.id : undefined,
    page,
    page_size: PAGE_SIZE,
    sort: 'created_at',
    order: 'desc',
  })
  const del = useDeleteContact()
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <section>
      <h1 className="page-h">Contacts</h1>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1) }} />
          My records
        </label>
        <button className="btn" onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New contact'}
        </button>
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <ContactForm onDone={() => setCreating(false)} />
        </div>
      )}

      {error && <div className="notice err">Failed to load contacts.</div>}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th className="t-actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>Loading…</td></tr>
            )}
            {data?.items.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/contacts/${c.id}`)}>
                <td>
                  <strong>{c.first_name} {c.last_name ?? ''}</strong>
                  {c.title && <div className="sub">{c.title}</div>}
                </td>
                <td>{c.email || '—'}</td>
                <td>{c.company?.name ?? '—'}</td>
                <td className="t-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn danger sm"
                    onClick={() => { if (confirm(`Delete ${c.first_name}?`)) del.mutate(c.id) }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>No contacts yet.</td></tr>
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
