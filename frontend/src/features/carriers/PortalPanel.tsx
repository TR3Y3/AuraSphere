import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Carrier } from '../../lib/api'
import { Panel } from '../../components/shell'

// Broker-side control for the carrier-facing portal link.
export function PortalPanel({ carrier }: { carrier: Carrier }) {
  const qc = useQueryClient()
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = useMutation({
    mutationFn: () => api.post<{ url: string }>(`/api/carriers/${carrier.id}/portal-link`),
    onSuccess: (r) => { setUrl(r.url); setCopied(false); qc.invalidateQueries({ queryKey: ['carrier', carrier.id] }) },
  })
  const revoke = useMutation({
    mutationFn: () => api.del(`/api/carriers/${carrier.id}/portal-link`),
    onSuccess: () => { setUrl(null); qc.invalidateQueries({ queryKey: ['carrier', carrier.id] }) },
  })

  return (
    <Panel title="Carrier portal">
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        A private link this carrier opens on their phone: browse your open loads and make offers,
        upload PODs on their loads, and share live GPS to your tracking map.
      </p>
      {carrier.portal_enabled ? (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge b-good">Portal active</span>
            <button className="btn ghost sm" onClick={() => generate.mutate()} disabled={generate.isPending}
              title="Rotating issues a new link and kills the old one">↻ Rotate link</button>
            <button className="btn subtle" onClick={() => revoke.mutate()} disabled={revoke.isPending}>Revoke access</button>
          </div>
          {url && (
            <div className="notice" style={{ marginTop: 10, background: 'rgba(63,185,80,0.12)', color: 'var(--good)', wordBreak: 'break-all' }}>
              Share this link with the carrier (shown once):<br /><a href={url}>{url}</a>{' '}
              <button className="btn sm" style={{ marginLeft: 6 }}
                onClick={() => { navigator.clipboard.writeText(url); setCopied(true) }}>
                {copied ? '✓ Copied' : '⧉ Copy'}
              </button>
            </div>
          )}
        </>
      ) : (
        <button className="btn" onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? 'Generating…' : '🔗 Generate portal link'}
        </button>
      )}
    </Panel>
  )
}
