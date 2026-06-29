import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useContact } from './api'
import { ContactForm } from './ContactForm'

export function ContactDetailPage() {
  const { id } = useParams()
  const contactId = id ? Number(id) : undefined
  const [editing, setEditing] = useState(false)
  const { data: contact, isLoading, error } = useContact(contactId)

  if (isLoading) return <p>Loading…</p>
  if (error || !contact) return <p style={{ color: 'red' }}>Contact not found.</p>

  return (
    <section>
      <Link to="/contacts">← Contacts</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>{contact.first_name} {contact.last_name ?? ''}</h2>
        <button style={{ marginLeft: 'auto' }} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginTop: 12 }}>
          <ContactForm existing={contact} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6, marginTop: 12 }}>
          <dt style={{ color: '#666' }}>Email</dt><dd>{contact.email || '—'}</dd>
          <dt style={{ color: '#666' }}>Phone</dt><dd>{contact.phone || '—'}</dd>
          <dt style={{ color: '#666' }}>Title</dt><dd>{contact.title || '—'}</dd>
          <dt style={{ color: '#666' }}>Company</dt>
          <dd>
            {contact.company ? (
              <Link to={`/companies/${contact.company.id}`}>{contact.company.name}</Link>
            ) : '—'}
          </dd>
        </dl>
      )}
    </section>
  )
}
