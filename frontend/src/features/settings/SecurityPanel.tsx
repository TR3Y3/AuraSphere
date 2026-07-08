import { useEffect, useState } from 'react'

interface SecurityStats {
  total_bans: number
  active_bans: number
  auto_banned: number
  failed_attempts_24h: number
}

interface IPBan {
  id: number
  ip_address: string
  reason?: string
  is_active: boolean
  auto_banned: boolean
  created_at: string
  expires_at?: string
}

interface FailedAttempt {
  ip: string
  attempts: number
  last_attempt: string
  attempted_emails: string[]
}

export function SecurityPanel() {
  const [stats, setStats] = useState<SecurityStats | null>(null)
  const [bans, setBans] = useState<IPBan[]>([])
  const [failed, setFailed] = useState<FailedAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [banIP, setBanIP] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banning, setBanning] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, bansRes, failedRes] = await Promise.all([
        fetch(`/api/admin/security/stats`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/admin/security/bans`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/admin/security/failed-attempts`, { credentials: 'include' }).then(r => r.json()),
      ])
      setStats(statsRes)
      setBans(bansRes)
      setFailed(failedRes)
    } catch (e) {
      console.error('Failed to load security data:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleBanIP = async () => {
    if (!banIP.trim() || !banReason.trim()) return
    setBanning(true)
    try {
      await fetch(`/api/admin/security/ban`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: banIP, reason: banReason, expires_in_hours: 24 }),
      })
      setBanIP('')
      setBanReason('')
      await loadData()
    } catch (e) {
      console.error('Failed to ban IP:', e)
    } finally {
      setBanning(false)
    }
  }

  const handleUnban = async (ip: string) => {
    try {
      await fetch(`/api/admin/security/unban/${ip}`, {
        method: 'POST',
        credentials: 'include',
      })
      await loadData()
    } catch (e) {
      console.error('Failed to unban IP:', e)
    }
  }

  if (loading) return <p className="muted">Loading security data…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h3 style={{ border: 0, padding: 0, margin: '0 0 12px 0', fontSize: 18 }}>🔒 Security Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--good)' }}>{stats?.active_bans ?? 0}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Active bans</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--danger)' }}>{stats?.auto_banned ?? 0}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Auto-banned IPs</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warn)' }}>{stats?.failed_attempts_24h ?? 0}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Failed attempts (24h)</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 4, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{stats?.total_bans ?? 0}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Total bans</div>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ border: 0, padding: 0, margin: '0 0 12px 0', fontSize: 18 }}>🚫 Ban an IP</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="ti"
            placeholder="IP address (e.g., 192.168.1.100)"
            value={banIP}
            onChange={(e) => setBanIP(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            className="ti"
            placeholder="Reason"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={handleBanIP} disabled={banning || !banIP || !banReason}>
            {banning ? '…' : 'Ban'}
          </button>
        </div>
      </div>

      <div>
        <h3 style={{ border: 0, padding: 0, margin: '0 0 12px 0', fontSize: 18 }}>🚷 Active Bans</h3>
        {bans.length === 0 ? (
          <p className="muted">No active bans</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-3)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>IP</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Reason</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Expires</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bans.map((ban) => (
                  <tr key={ban.id} style={{ borderBottom: '1px solid var(--surface-3)' }}>
                    <td style={{ padding: '8px 0' }}>
                      <code style={{ background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 2 }}>
                        {ban.ip_address}
                      </code>
                    </td>
                    <td style={{ padding: '8px 0' }}>{ban.reason || '—'}</td>
                    <td style={{ padding: '8px 0' }}>
                      {ban.auto_banned ? <span className="badge b-danger">Auto</span> : <span className="badge b-brand">Manual</span>}
                    </td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: '#999' }}>
                      {ban.expires_at ? new Date(ban.expires_at).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right' }}>
                      <button className="btn ghost sm" onClick={() => handleUnban(ban.ip_address)}>
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 style={{ border: 0, padding: 0, margin: '0 0 12px 0', fontSize: 18 }}>⚠️ Failed Login Attempts (24h)</h3>
        {failed.length === 0 ? (
          <p className="muted">No failed attempts</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-3)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>IP</th>
                  <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600 }}>Attempts</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Last Attempt</th>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>Emails Tried</th>
                </tr>
              </thead>
              <tbody>
                {failed.slice(0, 20).map((attempt) => (
                  <tr key={attempt.ip} style={{ borderBottom: '1px solid var(--surface-3)' }}>
                    <td style={{ padding: '8px 0' }}>
                      <code style={{ background: 'var(--surface-2)', padding: '2px 4px', borderRadius: 2 }}>
                        {attempt.ip}
                      </code>
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'center', fontWeight: 600, color: attempt.attempts > 3 ? 'var(--danger)' : 'inherit' }}>
                      {attempt.attempts}
                    </td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: '#999' }}>
                      {new Date(attempt.last_attempt).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 0', fontSize: 12 }}>
                      {attempt.attempted_emails.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
