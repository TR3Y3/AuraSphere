import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '6px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  color: isActive ? '#fff' : '#333',
  background: isActive ? '#2563eb' : 'transparent',
})

export function Layout() {
  const { me, logout } = useAuth()
  return (
    <div style={{ fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: 12,
          marginBottom: 20,
        }}
      >
        <strong style={{ fontSize: 18 }}>AuraSphere</strong>
        <nav style={{ display: 'flex', gap: 8 }}>
          <NavLink to="/companies" style={linkStyle}>Companies</NavLink>
          <NavLink to="/contacts" style={linkStyle}>Contacts</NavLink>
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#666', fontSize: 14 }}>
            {me?.user.full_name} · {me?.organization.name}
          </span>
          <button onClick={() => logout()}>Log out</button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
