import { Panel, AlertBadge } from '../../components/shell'
import { useVetting, useRunVetting } from './ops'

const VERDICT: Record<string, { label: string; cls: string; note: string }> = {
  clear: { label: '✓ Clear to book', cls: 'b-good', note: 'Authority, insurance, and safety all check out.' },
  review: { label: '⚠ Review', cls: 'b-warn', note: 'Bookable, but review the flags below first.' },
  fail: { label: '✕ Do not book', cls: 'b-danger', note: 'Failed vetting — resolve the flags before activating.' },
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function VettingPanel({ carrierId }: { carrierId: number }) {
  const { data: v, isLoading } = useVetting(carrierId)
  const run = useRunVetting(carrierId)

  return (
    <Panel title="Carrier vetting">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="muted" style={{ fontSize: 13, flex: 1 }}>
          Authority · insurance · safety check (Highway / Carrier411).
        </span>
        <button className="btn" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? 'Checking…' : v ? '↻ Re-run check' : 'Run vetting check'}
        </button>
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : !v ? (
        <p className="muted">Not vetted yet. Run a check to verify this carrier before booking.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className={`badge ${VERDICT[v.result]?.cls ?? 'b-muted'}`} style={{ fontSize: 14, padding: '5px 12px' }}>
              {VERDICT[v.result]?.label ?? v.result}
            </span>
            <span className="muted" style={{ fontSize: 13 }}>{VERDICT[v.result]?.note}</span>
          </div>

          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi"><div className="kpi-v">{v.risk_score ?? '—'}</div><div className="kpi-k">Safety score</div></div>
            <div className="kpi"><div className="kpi-v" style={{ textTransform: 'capitalize' }}>{v.authority_status ?? '—'}</div><div className="kpi-k">Authority</div></div>
            <div className="kpi"><div className="kpi-v">{v.insurance_on_file ? 'On file' : 'Missing'}</div><div className="kpi-k">Insurance</div></div>
            <div className="kpi"><div className="kpi-v">{v.safety_rating ?? '—'}</div><div className="kpi-k">Safety rating</div></div>
          </div>

          {v.flags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {v.flags.map((f) => <AlertBadge key={f}>{f}</AlertBadge>)}
            </div>
          )}

          <div className="muted" style={{ fontSize: 12 }}>
            Checked {when(v.created_at)} · source: {v.source}
          </div>
        </>
      )}
    </Panel>
  )
}
