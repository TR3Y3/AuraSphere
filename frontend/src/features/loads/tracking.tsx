import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CheckCall, type CheckCallCreate, type Load } from '../../lib/api'
import { Panel } from '../../components/shell'
import { useBoardMeta, STATUS_LABEL } from './api'
import { LiveMap } from './LiveMap'

function useCheckCalls(loadId: number) {
  return useQuery({
    queryKey: ['checkcalls', loadId],
    queryFn: () => api.get<CheckCall[]>(`/api/loads/${loadId}/checkcalls`),
    refetchInterval: 15000, // keep the board fresh as new pings land
  })
}

function useAddCheckCall(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CheckCallCreate) => api.post<CheckCall>(`/api/loads/${loadId}/checkcalls`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checkcalls', loadId] })
      qc.invalidateQueries({ queryKey: ['load', loadId] }) // status may have advanced
    },
  })
}

function useDeleteCheckCall(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/loads/${loadId}/checkcalls/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkcalls', loadId] }),
  })
}

function useEldStatus(loadId: number) {
  return useQuery({
    queryKey: ['eld-status', loadId],
    queryFn: () => api.get<{ connected: boolean; provider: string }>(`/api/loads/${loadId}/eld/status`),
  })
}

function useSyncEld(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<CheckCall>(`/api/loads/${loadId}/eld/sync`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkcalls', loadId] }),
  })
}

function place(c: { city?: string | null; state?: string | null }): string {
  return [c.city, c.state].filter(Boolean).join(', ') || 'Unknown location'
}

function when(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// Schematic, dependency-free route map: origin → current ping → destination.
function RouteMap({ load, latest }: { load: Load; latest?: CheckCall }) {
  const delivered = load.status === 'delivered' || load.status === 'invoiced'
  // Position the truck: no ping = at origin; delivered = at dest; else mid-route.
  const pct = delivered ? 100 : latest ? 55 : 0
  const lat = latest?.latitude != null ? Number(latest.latitude) : null
  const lng = latest?.longitude != null ? Number(latest.longitude) : null

  return (
    <div>
      <div style={{ position: 'relative', margin: '26px 6px 34px' }}>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 0, left: 0, height: 4, width: `${pct}%`,
          background: 'var(--brand)', borderRadius: 2, transition: 'width .3s' }} />
        {/* endpoints */}
        <Dot left="0%" label={`${load.origin_city ?? 'Origin'}${load.origin_state ? ', ' + load.origin_state : ''}`} align="left" />
        <Dot left="100%" label={`${load.dest_city ?? 'Destination'}${load.dest_state ? ', ' + load.dest_state : ''}`} align="right" />
        {/* truck */}
        <div style={{ position: 'absolute', top: -18, left: `${pct}%`, transform: 'translateX(-50%)', fontSize: 18 }}>🚚</div>
      </div>
      {lat != null && lng != null && (
        <div className="muted" style={{ fontSize: 12, marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>📍 {lat.toFixed(4)}, {lng.toFixed(4)}</span>
          <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=9/${lat}/${lng}`} target="_blank" rel="noreferrer">
            View on map ↗
          </a>
        </div>
      )}
    </div>
  )
}

function Dot({ left, label, align }: { left: string; label: string; align: 'left' | 'right' }) {
  return (
    <div style={{ position: 'absolute', top: -4, left, transform: align === 'right' ? 'translateX(-100%)' : 'none' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--surface)',
        border: '2px solid var(--brand)', marginLeft: align === 'right' ? 'auto' : 0 }} />
      <div className="muted" style={{ fontSize: 11, marginTop: 4, whiteSpace: 'nowrap',
        transform: align === 'right' ? 'translateX(0)' : 'none', textAlign: align }}>{label}</div>
    </div>
  )
}

export function TrackingPanel({ load }: { load: Load }) {
  const { data: calls, isLoading } = useCheckCalls(load.id)
  const { data: meta } = useBoardMeta()
  const add = useAddCheckCall(load.id)
  const del = useDeleteCheckCall(load.id)
  const { data: eld } = useEldStatus(load.id)
  const sync = useSyncEld(load.id)

  const [form, setForm] = useState({ city: '', state: '', status_note: '', note: '', eta: '', advance_status: '' })
  const latest = calls?.[0]

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const body: CheckCallCreate = {
      city: form.city || null,
      state: form.state || null,
      status_note: form.status_note || null,
      note: form.note || null,
      eta: form.eta ? new Date(form.eta).toISOString() : null,
      advance_status: form.advance_status || null,
    }
    add.mutate(body, { onSuccess: () => setForm({ city: '', state: '', status_note: '', note: '', eta: '', advance_status: '' }) })
  }

  return (
    <div className="two-col">
      <Panel title="Current location & ETA">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="muted" style={{ fontSize: 12, flex: 1 }}>
            ELD: <span className={`badge ${eld?.connected ? 'b-good' : 'b-muted'}`}>{eld?.connected ? eld.provider : 'demo'}</span>
          </span>
          <button className="btn ghost sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? 'Syncing…' : '⟳ Sync ELD'}
          </button>
        </div>
        <RouteMap load={load} latest={latest} />
        <LiveMap pings={calls ?? []} />
        <div className="kv" style={{ marginTop: 16 }}>
          <div className="k">Last ping</div>
          <div>{latest ? `${place(latest)} · ${when(latest.reported_at)}` : <span className="muted">No check-calls yet</span>}</div>
          <div className="k">Status note</div>
          <div>{latest?.status_note || '—'}</div>
          <div className="k">ETA</div>
          <div>{latest?.eta ? when(latest.eta) : '—'}</div>
        </div>
      </Panel>

      <Panel title="Log a check-call">
        <form onSubmit={submit} className="composer">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="ti" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className="ti" style={{ width: 80 }} placeholder="ST" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
          </div>
          <input className="ti" placeholder="Status note (e.g. Loaded, rolling)" value={form.status_note} onChange={(e) => setForm({ ...form, status_note: e.target.value })} />
          <textarea className="ti" placeholder="Notes (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          <label className="muted" style={{ fontSize: 12 }}>ETA
            <input className="ti" type="datetime-local" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} />
          </label>
          <label className="muted" style={{ fontSize: 12 }}>Advance status (optional)
            <select className="ti" value={form.advance_status} onChange={(e) => setForm({ ...form, advance_status: e.target.value })}>
              <option value="">— keep current —</option>
              {meta?.statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
            </select>
          </label>
          <button className="btn" type="submit" disabled={add.isPending}>{add.isPending ? 'Logging…' : '＋ Log check-call'}</button>
          {add.isError && <span className="notice err" style={{ margin: 0 }}>{(add.error as Error).message}</span>}
        </form>
      </Panel>

      <Panel title="Tracking history" style={{ gridColumn: '1 / -1' }}>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : !calls?.length ? (
          <p className="muted">No check-calls logged yet.</p>
        ) : (
          <div>
            {calls.map((c) => (
              <div key={c.id} className="tl-item">
                <span className="tl-ico">📍</span>
                <div className="tl-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{place(c)}</strong>
                    <button className="copy-btn" title="Delete" onClick={() => { if (confirm('Delete this check-call?')) del.mutate(c.id) }}>✕</button>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {when(c.reported_at)}{c.status_note ? ` · ${c.status_note}` : ''}{c.eta ? ` · ETA ${when(c.eta)}` : ''}
                  </div>
                  {c.note && <div style={{ marginTop: 4 }}>{c.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
