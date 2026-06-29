import { useAuth } from '../auth/AuthContext'

export function Dashboard() {
  const { me, logout } = useAuth()
  if (!me) return null

  return (
    <div style={{ maxWidth: 720, margin: '48px auto', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>AuraSphere</h1>
        <button onClick={() => logout()}>Log out</button>
      </header>
      <p>
        Signed in as <strong>{me.user.full_name}</strong> ({me.user.email}) —
        role <code>{me.user.role}</code>
      </p>
      <p>
        Organization: <strong>{me.organization.name}</strong> (
        <code>{me.organization.slug}</code>, plan {me.organization.plan})
      </p>
      <p style={{ color: '#666' }}>
        Phase 1 complete. Contacts &amp; companies arrive in Phase 2.
      </p>
    </div>
  )
}
