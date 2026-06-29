import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCompanies } from '../features/companies/api'
import { useContacts } from '../features/contacts/api'
import { useDeals } from '../features/deals/api'

export function Dashboard() {
  const { me } = useAuth()
  const companies = useCompanies({ page_size: 1 })
  const contacts = useContacts({ page_size: 1 })
  const deals = useDeals({ page_size: 1 })
  const myDeals = useDeals({ page_size: 1, owner_id: me?.user.id })
  if (!me) return null

  const stat = (q: { data?: { total: number } }) => (q.data ? q.data.total : '—')

  return (
    <section>
      <div className="cards">
        <div className="card">
          <div className="k">Companies</div>
          <div className="v">{stat(companies)}</div>
        </div>
        <div className="card">
          <div className="k">Contacts</div>
          <div className="v">{stat(contacts)}</div>
        </div>
        <div className="card">
          <div className="k">Deals</div>
          <div className="v">{stat(deals)}</div>
        </div>
        <div className="card">
          <div className="k">My deals</div>
          <div className="v">{stat(myDeals)}</div>
        </div>
      </div>

      <div className="panel panel-pad">
        <h2 style={{ border: 0, padding: 0, marginBottom: 8 }}>
          Welcome back, {me.user.full_name.split(' ')[0]}
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {me.organization.name} · <span className="badge b-brand">{me.user.role}</span>
        </p>
        <p style={{ marginTop: 12 }}>
          Jump into <Link to="/companies">Companies</Link>,{' '}
          <Link to="/contacts">Contacts</Link>, or the{' '}
          <Link to="/deals">Deals</Link> board.
        </p>
      </div>
    </section>
  )
}
