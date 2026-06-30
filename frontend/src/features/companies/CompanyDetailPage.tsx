import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useContacts } from '../contacts/api'
import { useCompany } from './api'
import { CompanyForm } from './CompanyForm'
import { PinButton } from '../pins/PinButton'

export function CompanyDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const companyId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: company, isLoading, error } = useCompany(companyId)
  const { data: contacts } = useContacts({ company_id: companyId, page_size: 100 })

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !company) return <div className="notice err">Company not found.</div>

  return (
    <section>
      <p style={{ marginBottom: 14 }}>
        <Link to="/companies" className="muted">← Shippers</Link>
      </p>

      <div className="profile">
        <div className="panel panel-pad">
          <div className="head">
            <div className="avatar">{company.name.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{company.name}</div>
              <div className="muted">{company.industry || 'Industry n/a'}</div>
            </div>
            <PinButton entityType="shipper" entityId={company.id} />
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? '✕ Cancel' : '✎ Edit'}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="panel panel-pad">
            <CompanyForm existing={company} onDone={() => setEditing(false)} />
          </div>
        ) : (
          <div className="panel panel-pad">
            <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>Details</h2>
            <div className="kv">
              <div className="k">Domain</div><div>{company.domain || '—'}</div>
              <div className="k">Industry</div><div>{company.industry || '—'}</div>
              <div className="k">Phone</div><div>{company.phone || '—'}</div>
              <div className="k">Website</div>
              <div>
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a>
                ) : '—'}
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <h2>Contacts</h2>
          <table>
            <tbody>
              {contacts?.items.map((c) => (
                <tr key={c.id} className="row-link" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <td>
                    <strong>{c.first_name} {c.last_name ?? ''}</strong>
                    {c.title && <div className="sub">{c.title}</div>}
                  </td>
                  <td>{c.email || '—'}</td>
                </tr>
              ))}
              {contacts && contacts.items.length === 0 && (
                <tr><td className="muted" style={{ padding: 18 }}>No contacts linked to this company.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
