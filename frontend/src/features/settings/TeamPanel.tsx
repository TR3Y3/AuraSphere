import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type User } from '../../lib/api'
import { useUsers } from '../users/api'
import { useAuth } from '../../auth/AuthContext'

interface InviteResult { user: User; invite_url: string | null }

export function TeamPanel() {
  const { me } = useAuth()
  const qc = useQueryClient()
  const { data: users } = useUsers()
  const canInvite = me?.user.role === 'owner' || me?.user.role === 'admin'

  const [form, setForm] = useState({ email: '', full_name: '', role: 'member' })
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const invite = useMutation({
    mutationFn: () => api.post<InviteResult>('/api/users/invite', form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setForm({ email: '', full_name: '', role: 'member' })
      setInviteLink(res.invite_url) // shown in demo (console) email mode
    },
  })

  return (
    <div className="panel panel-pad" style={{ marginBottom: 22 }}>
      <h2 style={{ border: 0, padding: 0, marginBottom: 12 }}>Team</h2>

      <table style={{ marginBottom: canInvite ? 18 : 0 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td><span className="badge b-muted">{u.role}</span></td>
              <td>{u.email_verified ? <span className="badge b-good">active</span> : <span className="badge b-warn">invited</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canInvite && (
        <form onSubmit={(e) => { e.preventDefault(); invite.mutate() }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 180px', margin: 0 }}>
            <label className="cl">Email</label>
            <input className="ti" type="email" value={form.email} required
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 160px', margin: 0 }}>
            <label className="cl">Name</label>
            <input className="ti" value={form.full_name} required
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label className="cl">Role</label>
            <select className="ti" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn" type="submit" disabled={invite.isPending}>
            {invite.isPending ? 'Inviting…' : 'Invite teammate'}
          </button>
        </form>
      )}
      {invite.isError && <div className="notice err" style={{ marginTop: 10 }}>{(invite.error as ApiError).message}</div>}
      {inviteLink && (
        <div className="notice" style={{ marginTop: 10, background: 'rgba(63,185,80,0.12)', color: 'var(--good)' }}>
          Invite sent. Demo mode — share this set-password link directly:{' '}
          <a href={inviteLink}>{inviteLink}</a>
        </div>
      )}
    </div>
  )
}
