import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { usePipelines, useDeals, type DealListParams } from './api'
import { DealsBoard } from './DealsBoard'
import { DealForm } from './DealForm'

function money(amount: string | null): string {
  if (!amount) return '—'
  const n = Number(amount)
  return Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function DealsPage() {
  const { me } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [mine, setMine] = useState(false)
  const [creating, setCreating] = useState(false)

  const { data: pipelines, isLoading: loadingPipelines } = usePipelines()
  const pipeline = pipelines?.find((p) => p.is_default) ?? pipelines?.[0]

  const listKey: DealListParams = {
    pipeline_id: pipeline?.id,
    owner_id: mine ? me?.user.id : undefined,
    page_size: 500,
  }
  const { data, isLoading } = useDeals(listKey)
  const stageName = (id: number) => pipeline?.stages.find((s) => s.id === id)?.name ?? '—'

  if (loadingPipelines || !pipeline) return <p className="muted">Loading pipeline…</p>

  return (
    <section>
      <h1 className="page-h">Loads</h1>
      <div className="toolbar">
        <div className="seg">
          <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          My deals
        </label>
        <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setCreating((v) => !v)}>
          {creating ? '✕ Cancel' : '+ New deal'}
        </button>
      </div>

      {creating && (
        <div className="panel panel-pad" style={{ marginBottom: 16 }}>
          <DealForm pipeline={pipeline} onDone={() => setCreating(false)} />
        </div>
      )}

      {isLoading && <p className="muted">Loading deals…</p>}

      {data && view === 'board' && (
        <DealsBoard pipeline={pipeline} deals={data.items} listKey={listKey} />
      )}

      {data && view === 'list' && (
        <div className="panel">
          <table>
            <thead>
              <tr><th>Deal</th><th>Stage</th><th>Company</th><th>Amount</th></tr>
            </thead>
            <tbody>
              {data.items.map((d) => (
                <tr key={d.id} className="row-link" onClick={() => navigate(`/deals/${d.id}`)}>
                  <td><strong>{d.name}</strong></td>
                  <td>{stageName(d.stage_id)}</td>
                  <td>{d.company?.name ?? '—'}</td>
                  <td>{money(d.amount)}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ padding: 22 }}>No deals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
