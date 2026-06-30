import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SearchPalette } from './SearchPalette'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/loads', label: 'Loads' },
  { to: '/quotes', label: 'Quotes' },
  { to: '/carriers', label: 'Carriers' },
  { to: '/companies', label: 'Shippers' },
  { to: '/contacts', label: 'Contacts' },
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

export function Layout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [meOpen, setMeOpen] = useState(false)
  const newRef = useClickOutside(() => setNewOpen(false))
  const meRef = useClickOutside(() => setMeOpen(false))

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

        <button className="iconbtn" title="Notifications">🔔</button>

        <div className="menu" ref={meRef}>
          <button className="avatar-btn" onClick={() => setMeOpen((v) => !v)}>
            {(me?.user.full_name ?? '?').slice(0, 1).toUpperCase()}
          </button>
          {meOpen && (
            <div className="menu-pop">
              <div className="who">{me?.user.full_name}<br />{me?.user.email}</div>
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
