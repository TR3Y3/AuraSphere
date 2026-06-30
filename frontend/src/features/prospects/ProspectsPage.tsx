import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertBadge } from '../../components/shell'
import { useProspects, useConvertProspect, useUpdateProspect, useDeleteProspect } from './api'
import { ProspectForm } from './ProspectForm'

const STATUS_TABS = [
  { key: 'new', label: 'New' },
  { key: 'imported', label: 'Imported' },
  { key: 'dismissed', label: 'Dismissed' },
]

function fitBadge(score: number | null | undefined) {
  if (score == null) return <span className="badge b-muted">—</span>
  const cls = score >= 75 ? 'b-good' : score >= 50 ? 'b-brand' : 'b-muted'
  return <span className={`badge ${cls}`}>{score}</span>
}

export function ProspectsPage() {
  const [tab, setTab] = useState('new')
  const [creating, setCreating] = useState(false)
  const { data, isLoading } = useProspects({ status: tab, page_size: 200 })
  const convert = useConvertProspect()
  const update = useUpdateProspect()
  const del = useDeleteProspect()

  return (
    <section>
      <h1 className="page-h">Lead-Gen · Shipper Prospects</h1>
      <div className="toolbar">
        <div className="tabs" style={{ border: 0, margin: 0 }}>
          {STATUS_TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ Add prospect'}
        </button>
      </div>

      <p className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 13 }}>
        Candidate shippers to qualify. Run the <code>/add-prospects</code> skill to research and fill this list,
        then <strong>Approve</strong> the good ones — that creates a Shipper + Contact in the CRM.
      </p>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <ProspectForm onDone={() => setCreating(false)} />
        </div>
      )}

      {isLoading && <p className="muted">Loading…</p>}

      <div className="panel">
        <table>
          <thead>
            <tr><th>Fit</th><th>Company</th><th>Contact</th><th>Location</th><th>Signal</th><th className="t-actions" /></tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td>{fitBadge(p.freight_fit_score)}</td>
                <td>
                  <strong>{p.company_name}</strong>
                  {p.industry && <div className="sub">{p.industry}</div>}
                  {p.duplicate_of && (
                    <div style={{ marginTop: 4 }}>
                      <AlertBadge>Dupe of <Link to={`/companies/${p.duplicate_of.id}`}>{p.duplicate_of.name}</Link></AlertBadge>
                    </div>
                  )}
                </td>
                <td>
                  {p.contact_name ? <>{p.contact_name}{p.contact_title ? <div className="sub">{p.contact_title}</div> : null}</> : <span className="muted">—</span>}
                  {p.contact_email && <div className="sub">{p.contact_email}</div>}
                </td>
                <td>{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                <td className="sub" style={{ whiteSpace: 'normal', maxWidth: 240 }}>{p.fit_reason}</td>
                <td className="t-actions">
                  {p.status === 'imported' ? (
                    p.shipper_id ? <Link to={`/companies/${p.shipper_id}`}>View shipper →</Link> : <span className="muted">imported</span>
                  ) : (
                    <>
                      <button className="btn sm" onClick={() => convert.mutate(p.id)} disabled={convert.isPending}>✓ Approve</button>{' '}
                      {p.status !== 'dismissed' && <button className="btn ghost sm" onClick={() => update.mutate({ id: p.id, status: 'dismissed' })}>Dismiss</button>}{' '}
                      <button className="btn danger sm" onClick={() => del.mutate(p.id)}>✕</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>No {tab} prospects.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
