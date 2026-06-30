// Reusable record-shell primitives — the AuraSphere look applied across
// every detail page: status-hero header, contextual action row, KPI strip,
// titled panels, in-panel tabs, and alert/rating badges.
import { useState, type CSSProperties, type ReactNode } from 'react'

export function RecordHeader({
  status,
  statusClass,
  title,
  subtitle,
  actions,
}: {
  status?: string
  statusClass?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="rec-header">
      <div>
        {status && <div className={`rec-status ${statusClass ?? ''}`}>{status}</div>}
        <div className="rec-title">{title}</div>
        {subtitle && <div className="rec-sub">{subtitle}</div>}
      </div>
      <div className="rec-spacer" />
      {actions && <div className="action-row">{actions}</div>}
    </div>
  )
}

export interface Kpi {
  label: string
  value: ReactNode
}

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div className="kpi" key={i}>
          <div className="kpi-v">{k.value}</div>
          <div className="kpi-k">{k.label}</div>
        </div>
      ))}
    </div>
  )
}

export function Panel({
  title,
  pad = true,
  style,
  children,
}: {
  title?: ReactNode
  pad?: boolean
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div className={`panel${pad ? ' panel-pad' : ''}`} style={style}>
      {title && <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>{title}</h2>}
      {children}
    </div>
  )
}

export function Tabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[]
}) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) ?? tabs[0]
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={t.key === active ? 'on' : ''} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  )
}

export function AlertBadge({ children }: { children: ReactNode }) {
  return <span className="alert-badge">⚠ {children}</span>
}

export function Rating({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="muted">Not rated</span>
  const n = Math.round(value)
  return (
    <span>
      <span className="rating-stars">{'★'.repeat(n)}{'☆'.repeat(Math.max(0, 5 - n))}</span>{' '}
      <span className="muted">{Number(value).toFixed(1)}</span>
    </span>
  )
}
