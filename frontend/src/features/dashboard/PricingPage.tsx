import { useLanePricing, money } from './api'

export function PricingPage() {
  const { data, isLoading } = useLanePricing()

  return (
    <section>
      <h1 className="page-h">Pricing · Lane rates</h1>
      <p className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 13 }}>
        Average customer vs carrier rates per lane, across all your loads — your rate memory when quoting.
      </p>
      {isLoading && <p className="muted">Loading…</p>}
      <div className="panel">
        <table>
          <thead><tr><th>Lane</th><th>Equip</th><th>Loads</th><th>Avg customer</th><th>Avg carrier</th><th>Avg margin</th></tr></thead>
          <tbody>
            {data?.map((l, i) => (
              <tr key={i}>
                <td><strong>{l.origin}</strong> → {l.destination}</td>
                <td>{l.equipment || '—'}</td>
                <td>{l.loads}</td>
                <td>{money(l.avg_customer_rate)}</td>
                <td>{money(l.avg_carrier_rate)}</td>
                <td className="dc-amt">{l.avg_margin != null ? money(l.avg_margin) : '—'}</td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 22 }}>No lane data yet — run some loads and rates will accumulate here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
