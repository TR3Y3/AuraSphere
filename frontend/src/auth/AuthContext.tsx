import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Me } from '../lib/api'

interface AuthState {
  me: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  // Resolve the current session on first load.
  useEffect(() => {
    api
      .get<Me>('/api/auth/me')
      .then(setMe)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err)
        setMe(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const result = await api.post<Me>('/api/auth/login', { email, password })
    setMe(result)
  }

  const logout = async () => {
    await api.post('/api/auth/logout')
    setMe(null)
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
