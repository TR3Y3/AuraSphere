import { Link } from 'react-router-dom'
import { useCompanies } from '../companies/api'
import { useCarriers } from '../carriers/api'
import { useLoads } from '../loads/api'
import { useUsers } from '../users/api'

// A dismiss-itself onboarding checklist for fresh orgs. Each step links to
// where it's done and checks off once there's data — the whole card hides
// when everything's complete.
export function GettingStarted() {
  const { data: shippers } = useCompanies({ page_size: 1 })
  const { data: carriers } = useCarriers({ page_size: 1 })
  const { data: loads } = useLoads({ page_size: 1 })
  const { data: users } = useUsers()

  // Wait until all counts are known to avoid a flash.
  if (!shippers || !carriers || !loads || !users) return null

  const steps = [
    { done: shippers.total > 0, label: 'Add your first shipper (customer)', to: '/companies' },
    { done: carriers.total > 0, label: 'Add a carrier', to: '/carriers' },
    { done: loads.total > 0, label: 'Create your first load', to: '/loads' },
    { done: users.length > 1, label: 'Invite your team', to: '/settings' },
  ]
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null // fully set up — hide

  return (
    <div className="panel panel-pad" style={{ marginBottom: 22, borderColor: 'var(--brand)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h2 style={{ border: 0, padding: 0, margin: 0 }}>🚀 Get started</h2>
        <span className="muted" style={{ fontSize: 13 }}>{doneCount} of {steps.length} done</span>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {steps.map((s) => (
          <Link key={s.to} to={s.to}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, background: 'var(--surface-2)', textDecoration: 'none',
              color: s.done ? 'var(--muted)' : 'var(--text)' }}>
            <span style={{ color: s.done ? 'var(--good)' : 'var(--muted)', fontWeight: 700 }}>
              {s.done ? '✓' : '○'}
            </span>
            <span style={{ flex: 1, textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
            {!s.done && <span className="muted" style={{ fontSize: 13 }}>→</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
