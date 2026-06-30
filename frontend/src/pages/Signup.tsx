import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

// Mirror the backend's validation; the backend stays the source of truth.
const schema = z.object({
  organization_name: z.string().min(1, 'Company name is required'),
  full_name: z.string().min(1, 'Your name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
})
type FormValues = z.infer<typeof schema>

export function Signup() {
  const { me, signup } = useAuth()
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
      await signup({
        organization_name: values.organization_name,
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Sign up failed')
    }
  }

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="brand" style={{ border: 0, padding: '0 0 16px' }}>
          <span className="logo-mark">A</span>
          <div>
            <b>AuraSphere</b>
            <small>Start your brokerage</small>
          </div>
        </div>

        {formError && <div className="notice err">{formError}</div>}

        <div className="field">
          <label className="cl">Company name</label>
          <input className="ti" {...register('organization_name')} />
          {errors.organization_name && <span className="err-text">{errors.organization_name.message}</span>}
        </div>
        <div className="field">
          <label className="cl">Your name</label>
          <input className="ti" {...register('full_name')} />
          {errors.full_name && <span className="err-text">{errors.full_name.message}</span>}
        </div>
        <div className="field">
          <label className="cl">Work email</label>
          <input className="ti" type="email" autoComplete="username" {...register('email')} />
          {errors.email && <span className="err-text">{errors.email.message}</span>}
        </div>
        <div className="field">
          <label className="cl">Password</label>
          <input className="ti" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <span className="err-text">{errors.password.message}</span>}
        </div>

        <button className="btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating your workspace…' : 'Create account'}
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
