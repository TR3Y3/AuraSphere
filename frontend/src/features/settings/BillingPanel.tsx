import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type BillingStatus } from '../../lib/api'
import { useAuth } from '../../auth/AuthContext'

function useBilling() {
  return useQuery({ queryKey: ['billing'], queryFn: () => api.get<BillingStatus>('/api/billing') })
}

export function BillingPanel() {
  const { me, refresh } = useAuth()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { data: billing, isLoading } = useBilling()

  const isOwner = me?.user.role === 'owner'

  const upgrade = useMutation({
    mutationFn: () => api.post<{ url: string }>('/api/billing/checkout'),
    onSuccess: ({ url }) => { window.location.href = url },
  })
  const portal = useMutation({
    mutationFn: () => api.post<{ url: string | null }>('/api/billing/portal'),
    onSuccess: ({ url }) => { if (url) window.location.href = url },
  })
  const downgrade = useMutation({
    mutationFn: () => api.post('/api/billing/downgrade'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); refresh() },
  })

  // Returning from a (stub or real) checkout: refresh plan + clean the URL.
  useEffect(() => {
    if (params.get('billing')) {
      qc.invalidateQueries({ queryKey: ['billing'] })
      refresh()
      params.delete('billing')
      setParams(params, { replace: true })
    }
  }, [params, qc, refresh, setParams])

  if (isLoading || !billing) return <div className="panel panel-pad" style={{ marginBottom: 22 }}>Loading billing…</div>

  const usagePct = billing.max_loads ? Math.min(100, Math.round((billing.loads_used / billing.max_loads) * 100)) : 0

  return (
    <div className="panel panel-pad" style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h2 style={{ border: 0, padding: 0, margin: 0, flex: 1 }}>Billing & plan</h2>
        <span className={`badge ${billing.is_pro ? 'b-good' : 'b-muted'}`}>{billing.label} plan</span>
        {!billing.configured && <span className="badge b-muted" title="Stripe keys not set — upgrades are simulated">demo billing</span>}
      </div>

      {!billing.is_pro && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span className="muted">Loads used</span>
            <span>{billing.loads_used}{billing.max_loads != null ? ` / ${billing.max_loads}` : ''}</span>
          </div>
          {billing.max_loads != null && (
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
              <div style={{ height: 6, width: `${usagePct}%`, borderRadius: 3,
                background: usagePct >= 90 ? 'var(--danger)' : 'var(--brand)' }} />
            </div>
          )}
        </div>
      )}

      <div className="cardgrid">
        {billing.plans.map((p) => {
          const current = p.key === billing.plan
          return (
            <div className="contact-card" key={p.key}
              style={{ borderColor: current ? 'var(--brand)' : undefined }}>
              <div className="cc-head">
                <div className="cc-name">{p.label}</div>
                {current && <span className="badge b-brand">Current</span>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{p.price}</div>
              <div className="cc-title">{p.blurb}</div>
              <ul style={{ margin: '4px 0 10px', paddingLeft: 18, fontSize: 13 }}>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )
        })}
      </div>

      {!isOwner ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Only the org owner can change the plan.</p>
      ) : billing.is_pro ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {billing.configured
            ? <button className="btn ghost" onClick={() => portal.mutate()} disabled={portal.isPending}>Manage billing</button>
            : <button className="btn ghost" onClick={() => downgrade.mutate()} disabled={downgrade.isPending}>Downgrade to Free</button>}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => upgrade.mutate()} disabled={upgrade.isPending}>
            {upgrade.isPending ? 'Redirecting…' : 'Upgrade to Pro'}
          </button>
          {upgrade.isError && <span className="notice err" style={{ marginLeft: 10 }}>{(upgrade.error as Error).message}</span>}
        </div>
      )}
    </div>
  )
}
