import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const NAV = [
  { to: '/', label: 'Dashboard', ico: '▦', end: true },
  { to: '/companies', label: 'Companies', ico: '▣' },
  { to: '/contacts', label: 'Contacts', ico: '☰' },
  { to: '/deals', label: 'Deals', ico: '◧' },
]

// Page heading is derived from the route so the topbar stays in sync.
function headingFor(path: string): ReactNode {
  if (path.startsWith('/companies')) return 'Companies'
  if (path.startsWith('/contacts')) return 'Contacts'
  if (path.startsWith('/deals')) return 'Deals'
  return 'Dashboard'
}

export function Layout() {
  const { me, logout } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <div className="layout">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <img className="logo" src="/logo.svg" alt="AuraSphere" width={30} height={30} />
          <div>
            <b>AuraSphere</b>
            <small>CRM</small>
          </div>
        </div>
        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="ico">{n.ico}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="who">{me?.user.full_name}</div>
          <div style={{ marginBottom: 8 }}>{me?.organization.name}</div>
          <button onClick={() => logout()}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen((v) => !v)}>☰</button>
          <h1>{headingFor(location.pathname)}</h1>
          <span />
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
