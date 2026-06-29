import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Dashboard() {
  const { me } = useAuth()
  if (!me) return null

  return (
    <section>
      <h2>Welcome, {me.user.full_name}</h2>
      <p style={{ color: '#666' }}>
        {me.organization.name} · role <code>{me.user.role}</code>
      </p>
      <p>
        Jump into <Link to="/companies">Companies</Link> or{' '}
        <Link to="/contacts">Contacts</Link>.
      </p>
    </section>
  )
}
