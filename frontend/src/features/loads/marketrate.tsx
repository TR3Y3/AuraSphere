import { useQuery } from '@tanstack/react-query'
import { api, type Load, type MarketRate } from '../../lib/api'
import { Panel } from '../../components/shell'

function useMarketRate(loadId: number) {
  return useQuery({
    queryKey: ['market-rate', loadId],
    queryFn: () => api.get<MarketRate>(`/api/market/rate/load/${loadId}`),
  })
}

function usd(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function MarketRatePanel({ load }: { load: Load }) {
  const { data: m, isLoading } = useMarketRate(load.id)

  if (isLoading || !m) return <Panel title="Market rate (DAT)"><p className="muted">Loading…</p></Panel>

  const buy = load.carrier_rate != null ? Number(load.carrier_rate) : null
  const marketAvg = m.total_avg
  // Buying below market average is favorable (green); above is a caution.
  const delta = buy != null && marketAvg != null ? buy - marketAvg : null
  const favorable = delta != null && delta <= 0

  return (
    <Panel title="Market rate (DAT)">
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="kpi-v">{usd(m.total_low)}</div><div className="kpi-k">Low</div></div>
        <div className="kpi"><div className="kpi-v">{usd(m.total_avg)}</div><div className="kpi-k">Market avg</div></div>
        <div className="kpi"><div className="kpi-v">{usd(m.total_high)}</div><div className="kpi-k">High</div></div>
        <div className="kpi"><div className="kpi-v">${m.rate_per_mile_avg.toFixed(2)}</div><div className="kpi-k">$/mile</div></div>
      </div>

      {delta != null ? (
        <div className={`notice ${favorable ? '' : 'err'}`}
          style={favorable ? { background: 'rgba(63,185,80,0.14)', color: 'var(--good)' } : undefined}>
          {favorable
            ? `✓ Your buy ${usd(buy)} is ${usd(Math.abs(delta))} under market — healthy margin room.`
            : `⚠ Your buy ${usd(buy)} is ${usd(delta)} over market avg — margin at risk.`}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>
          {buy == null ? 'Assign a carrier rate to compare against market.' : 'Add miles to the load for a total-rate comparison.'}
        </p>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {m.equipment || 'Any equipment'}{m.miles ? ` · ${m.miles.toLocaleString()} mi` : ''} · confidence: {m.confidence} · source: {m.source}
      </div>
    </Panel>
  )
}
