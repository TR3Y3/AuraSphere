import { useAuth } from '../../auth/AuthContext'
import { BillingPanel } from './BillingPanel'

// "Available at launch" surface: integrations are visible here as cards with
// a status, even though the wiring is built later (see docs/integrations.md).
interface Integration {
  key: string
  name: string
  icon: string
  category: string
  blurb: string
  status: 'planned' | 'coming-soon'
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'email', name: 'Email logging', icon: '✉️', category: 'Gmail / Outlook',
    blurb: 'Auto-log sent & received email onto the right record’s activity timeline.',
    status: 'planned',
  },
  {
    key: 'dat', name: 'DAT', icon: '📡', category: 'Load board · Market rates',
    blurb: 'Post loads and pull live market rates into the Quote Desk and Pricing.',
    status: 'planned',
  },
  {
    key: 'highway', name: 'Highway / Carrier411', icon: '🛡️', category: 'Carrier vetting',
    blurb: 'Vet carriers and gate “active” status — the source of truth for compliance flags.',
    status: 'planned',
  },
  {
    key: 'factoring', name: 'Factoring', icon: '💵', category: 'Carrier setup · Payments',
    blurb: 'Capture the carrier’s factoring company & NOA so payments route to the right pay-to.',
    status: 'planned',
  },
  {
    key: 'eld', name: 'ELD tracking', icon: '📍', category: 'Samsara · Motive · Geotab',
    blurb: 'Live truck location & HOS feeding the load’s tracking, map, and ETA.',
    status: 'planned',
  },
]

export function SettingsPage() {
  const { me } = useAuth()
  if (!me) return null

  return (
    <section>
      <h1 className="page-h">Settings</h1>

      <div className="panel panel-pad" style={{ marginBottom: 22 }}>
        <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>Organization</h2>
        <div className="kv">
          <div className="k">Name</div><div>{me.organization.name}</div>
          <div className="k">Slug</div><div><code>{me.organization.slug}</code></div>
          <div className="k">Plan</div><div><span className="badge b-brand">{me.organization.plan}</span></div>
          <div className="k">You</div><div>{me.user.full_name} · <span className="badge b-muted">{me.user.role}</span></div>
        </div>
      </div>

      <BillingPanel />

      <h2 style={{ fontSize: 15, margin: '8px 0 4px' }}>Integrations</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 14, fontSize: 13 }}>
        Connect AuraSphere to the tools you already run on. These are on the roadmap — planning lives in
        <code> docs/integrations.md</code>.
      </p>

      <div className="cardgrid">
        {INTEGRATIONS.map((i) => (
          <div className="contact-card" key={i.key}>
            <div className="cc-head">
              <div className="cc-name"><span style={{ marginRight: 8 }}>{i.icon}</span>{i.name}</div>
              <span className="badge b-muted">Coming soon</span>
            </div>
            <div className="cc-title">{i.category}</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{i.blurb}</div>
            <button className="btn ghost sm" disabled title="Not yet available">Connect</button>
          </div>
        ))}
      </div>
    </section>
  )
}
