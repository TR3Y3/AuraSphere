import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { me, loading } = useAuth()
  if (loading) return <p style={{ padding: 24 }}>Loading…</p>
  if (!me) return <Navigate to="/login" replace />
  return <Outlet />
}
