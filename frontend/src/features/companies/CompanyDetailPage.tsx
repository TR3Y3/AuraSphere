import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useContacts } from '../contacts/api'
import { useCompany } from './api'
import { CompanyForm } from './CompanyForm'

export function CompanyDetailPage() {
  const { id } = useParams()
  const companyId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: company, isLoading, error } = useCompany(companyId)
  const { data: contacts } = useContacts({ company_id: companyId, page_size: 100 })

  if (isLoading) return <p>Loading…</p>
  if (error || !company) return <p style={{ color: 'red' }}>Company not found.</p>

  return (
    <section>
      <Link to="/companies">← Companies</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>{company.name}</h2>
        <button style={{ marginLeft: 'auto' }} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 12 }}>
          <CompanyForm existing={company} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6, marginTop: 12 }}>
          <dt style={{ color: '#666' }}>Domain</dt><dd>{company.domain || '—'}</dd>
          <dt style={{ color: '#666' }}>Industry</dt><dd>{company.industry || '—'}</dd>
          <dt style={{ color: '#666' }}>Phone</dt><dd>{company.phone || '—'}</dd>
          <dt style={{ color: '#666' }}>Website</dt><dd>{company.website || '—'}</dd>
        </dl>
      )}

      <h3 style={{ marginTop: 24 }}>Contacts</h3>
      <ul>
        {contacts?.items.map((c) => (
          <li key={c.id}>
            <Link to={`/contacts/${c.id}`}>
              {c.first_name} {c.last_name ?? ''}
            </Link>
            {c.title ? ` — ${c.title}` : ''}
          </li>
        ))}
        {contacts && contacts.items.length === 0 && (
          <li style={{ color: '#666' }}>No contacts linked to this company.</li>
        )}
      </ul>
    </section>
  )
}
