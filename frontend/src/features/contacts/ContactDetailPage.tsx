import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useContact } from './api'
import { ContactForm } from './ContactForm'
import { PinButton } from '../pins/PinButton'
import { Timeline } from '../activities/Timeline'

export function ContactDetailPage() {
  const { id } = useParams()
  const contactId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: contact, isLoading, error } = useContact(contactId)

  if (isLoading) return <p className="muted">Loading…</p>
  if (error || !contact) return <div className="notice err">Contact not found.</div>

  const fullName = `${contact.first_name} ${contact.last_name ?? ''}`.trim()

  return (
    <section>
      <p style={{ marginBottom: 14 }}>
        <Link to="/contacts" className="muted">← Contacts</Link>
      </p>

      <div className="profile">
        <div className="panel panel-pad">
          <div className="head">
            <div className="avatar">{fullName.slice(0, 2).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{fullName}</div>
              <div className="muted">{contact.title || 'No title'}</div>
            </div>
            <PinButton entityType="contact" entityId={contact.id} />
            <button className="btn ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? '✕ Cancel' : '✎ Edit'}
            </button>
          </div>
        </div>

        {editing ? (
          <div className="panel panel-pad">
            <ContactForm existing={contact} onDone={() => setEditing(false)} />
          </div>
        ) : (
          <div className="panel panel-pad">
            <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>Details</h2>
            <div className="kv">
              <div className="k">Email</div>
              <div>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : '—'}</div>
              <div className="k">Phone</div><div>{contact.phone || '—'}</div>
              <div className="k">Title</div><div>{contact.title || '—'}</div>
              <div className="k">Shipper</div>
              <div>
                {contact.company ? (
                  <Link to={`/companies/${contact.company.id}`}>{contact.company.name}</Link>
                ) : '—'}
              </div>
              <div className="k">Carrier</div>
              <div>
                {contact.carrier ? (
                  <Link to={`/carriers/${contact.carrier.id}`}>{contact.carrier.name}</Link>
                ) : '—'}
              </div>
            </div>
          </div>
        )}

        <Timeline scope={{ related_contact_id: contact.id }} />
      </div>
    </section>
  )
}
