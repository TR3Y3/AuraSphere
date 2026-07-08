import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SearchPalette } from './SearchPalette'
import { FeedbackButton } from './Feedback'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tasks', label: 'Tasks' },
  { to: '/loads', label: 'Loads' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/carriers', label: 'Carriers' },
  { to: '/companies', label: 'Shippers' },
  { to: '/contacts', label: 'Contacts' },
]

// Secondary destinations live under "More ▾" to keep the bar uncrowded.
const MORE_NAV = [
  { to: '/prospects', label: 'Lead-Gen' },
  { to: '/pricing', label: 'Pricing' },
]

// Close a popover when clicking outside it.
function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onOut])
  return ref
}

// TODO: re-enable VerifyBanner when domain + Resend are configured
// Nudge owners whose email isn't verified yet; lets them resend the link.
// Dismissible per-session so it doesn't nag on every page view.
/*
function VerifyBanner() {
  const { me } = useAuth()
  const [sent, setSent] = useState<'idle' | 'sending' | 'done'>('idle')
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('as_verify_dismissed') === '1')
  if (!me || me.user.email_verified || dismissed) return null

  const dismiss = () => {
    sessionStorage.setItem('as_verify_dismissed', '1')
    setDismissed(true)
  }

  const resend = async () => {
    setSent('sending')
    try {
      await api.post('/api/auth/resend-verification')
      setSent('done')
    } catch {
      setSent('idle')
    }
  }

  return (
    <div className="notice" style={{ background: 'rgba(227,147,60,0.14)', color: 'var(--warn)',
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <span style={{ flex: 1 }}>⚠ Verify your email ({me.user.email}) to secure your account.</span>
      {sent === 'done'
        ? <span className="muted" style={{ fontSize: 13 }}>Link sent — check your inbox.</span>
        : <button className="btn sm" onClick={resend} disabled={sent === 'sending'}>
            {sent === 'sending' ? 'Sending…' : 'Resend link'}
          </button>}
      <button className="iconbtn" title="Dismiss for this session" onClick={dismiss}
        style={{ color: 'var(--warn)', padding: '2px 6px' }}>✕</button>
    </div>
  )
}
*/

export function Layout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [meOpen, setMeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const newRef = useClickOutside(() => setNewOpen(false))
  const meRef = useClickOutside(() => setMeOpen(false))
  const moreRef = useClickOutside(() => setMoreOpen(false))

  // Per-tenant accent: paint the org's brand color into the theme.
  useEffect(() => {
    const accent = me?.organization.accent_color
    const root = document.documentElement
    if (accent) {
      root.style.setProperty('--brand', accent)
      root.style.setProperty('--brand-2', accent)
    } else {
      root.style.removeProperty('--brand')
      root.style.removeProperty('--brand-2')
    }
  }, [me?.organization.accent_color])

  // ⌘K / Ctrl-K opens the search palette.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const orgName = me?.organization.name ?? 'AuraSphere'
  const initials = orgName.slice(0, 2).toUpperCase()

  const newItem = (label: string, to: string) => (
    <button onClick={() => { setNewOpen(false); navigate(to) }}>{label}</button>
  )

  return (
    <div>
      <header className="appbar">
        <div className="brand2">
          <span className="logo-mark">{initials}</span>
          <div>
            <b>{orgName}</b>
            <small>Freight TMS</small>
          </div>
        </div>

        <nav className="topnav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
          <div className="menu" ref={moreRef}>
            <button className="iconbtn" style={{ fontSize: 14, fontWeight: 500 }}
              onClick={() => setMoreOpen((v) => !v)}>More ▾</button>
            {moreOpen && (
              <div className="menu-pop" style={{ left: 0, right: 'auto' }}>
                {MORE_NAV.map((n) => (
                  <button key={n.to} onClick={() => { setMoreOpen(false); navigate(n.to) }}>{n.label}</button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="appbar-spacer" />

        <button className="searchbtn" onClick={() => setSearch(true)}>
          🔍 Search <kbd>⌘K</kbd>
        </button>

        <div className="menu" ref={newRef}>
          <button className="btn sm" onClick={() => setNewOpen((v) => !v)}>+ New ▾</button>
          {newOpen && (
            <div className="menu-pop">
              {newItem('New load', '/loads')}
              {newItem('New quote', '/quotes')}
              {newItem('New carrier', '/carriers')}
              {newItem('New shipper', '/companies')}
              {newItem('New contact', '/contacts')}
            </div>
          )}
        </div>

        <FeedbackButton />

        <div className="menu" ref={meRef}>
          <button className="avatar-btn" aria-label="Account menu" aria-haspopup="menu"
            aria-expanded={meOpen} onClick={() => setMeOpen((v) => !v)}>
            {(me?.user.full_name ?? '?').slice(0, 1).toUpperCase()}
          </button>
          {meOpen && (
            <div className="menu-pop">
              <div className="who">{me?.user.full_name}<br />{me?.user.email}</div>
              <button onClick={() => { setMeOpen(false); navigate('/settings') }}>⚙ Settings</button>
              <button onClick={() => logout()}>Sign out</button>
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        <Outlet />
      </div>

      {search && <SearchPalette onClose={() => setSearch(false)} />}
    </div>
  )
}
