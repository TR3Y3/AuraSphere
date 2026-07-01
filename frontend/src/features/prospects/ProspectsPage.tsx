import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertBadge } from '../../components/shell'
import { useProspects, useConvertProspect, useUpdateProspect, useDeleteProspect, useImportProspects } from './api'
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
  const [search, setSearch] = useState('')
  const { data, isLoading } = useProspects({ status: tab, search: search || undefined, page_size: 200 })
  const convert = useConvertProspect()
  const update = useUpdateProspect()
  const del = useDeleteProspect()
  const importCsv = useImportProspects()
  const fileRef = useRef<HTMLInputElement>(null)

  function onPickCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) importCsv.mutate(file, { onSettled: () => { if (fileRef.current) fileRef.current.value = '' } })
  }

  return (
    <section>
      <h1 className="page-h">Lead-Gen · Shipper Prospects</h1>
      <div className="toolbar">
        <div className="tabs" style={{ border: 0, margin: 0 }}>
          {STATUS_TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
        <input className="ti" style={{ maxWidth: 200, marginLeft: 'auto' }} placeholder="Search company, city, contact…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickCsv} style={{ display: 'none' }} />
        <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}
          title="Import candidate shippers from a CSV (flexible column names; company name required)">
          {importCsv.isPending ? 'Importing…' : '⇪ Import CSV'}
        </button>
        <button className="btn" onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ Add prospect'}
        </button>
      </div>

      {importCsv.isSuccess && (
        <div className="notice" style={{ background: 'rgba(63,185,80,0.12)', color: 'var(--good)' }}>
          Imported {importCsv.data.created} prospect{importCsv.data.created === 1 ? '' : 's'}
          {importCsv.data.skipped ? ` · skipped ${importCsv.data.skipped} row(s) with no company name` : ''}.
        </div>
      )}
      {importCsv.isError && <div className="notice err">{(importCsv.error as Error).message}</div>}

      <p className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 13 }}>
        Candidate shippers to qualify. <strong>Import a CSV</strong> of target companies, add them manually, or run
        the <code>/add-prospects</code> skill to research them — then <strong>Approve</strong> the good ones, which
        creates a Shipper + Contact in the CRM.
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
