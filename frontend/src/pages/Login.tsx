import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
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
    <div className="login-wrap">
      <form className="login" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="brand" style={{ border: 0, padding: '0 0 16px' }}>
          <span className="logo-mark">A</span>
          <div>
            <b>AuraSphere</b>
            <small>Freight TMS</small>
          </div>
        </div>

        {formError && <div className="notice err">{formError}</div>}

        <label className="field">
          <span className="cl">Email</span>
          <input className="ti" type="email" autoComplete="username" {...register('email')} />
          {errors.email && <span className="err-text">{errors.email.message}</span>}
        </label>
        <label className="field">
          <span className="cl">Password</span>
          <input className="ti" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <span className="err-text">{errors.password.message}</span>}
        </label>

        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <span style={{ margin: '0 8px' }}>·</span>
          New here? <Link to="/signup">Start your brokerage</Link>
        </p>
      </form>
      <p className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
        <Link to="/terms">Terms</Link>
        <span style={{ margin: '0 6px' }}>·</span>
        <Link to="/privacy">Privacy</Link>
      </p>
    </div>
  )
}
