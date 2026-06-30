import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type Me } from '../lib/api'

interface SignupInput {
  organization_name: string
  full_name: string
  email: string
  password: string
}

interface AuthState {
  me: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
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

  const signup = async (input: SignupInput) => {
    const result = await api.post<Me>('/api/auth/signup', input)
    setMe(result)
  }

  // Re-resolve identity (e.g. after email verification flips email_verified).
  const refresh = async () => {
    try {
      setMe(await api.get<Me>('/api/auth/me'))
    } catch {
      setMe(null)
    }
  }

  const logout = async () => {
    await api.post('/api/auth/logout')
    setMe(null)
  }

  return (
    <AuthContext.Provider value={{ me, loading, login, signup, logout, refresh }}>
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
