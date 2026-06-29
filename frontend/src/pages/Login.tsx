import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

// Mirror the backend's validation; the backend remains the source of truth.
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function Login() {
  const { me, login } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (me) return <Navigate to="/" replace />

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await login(values.email, values.password)
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Login failed')
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '64px auto', fontFamily: 'system-ui' }}>
      <h1>Sign in to AuraSphere</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input type="email" autoComplete="username" {...register('email')}
            style={{ width: '100%', padding: 8 }} />
          {errors.email && <small style={{ color: 'red' }}>{errors.email.message}</small>}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input type="password" autoComplete="current-password" {...register('password')}
            style={{ width: '100%', padding: 8 }} />
          {errors.password && (
            <small style={{ color: 'red' }}>{errors.password.message}</small>
          )}
        </div>
        {formError && <p style={{ color: 'red' }}>{formError}</p>}
        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: 10 }}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
