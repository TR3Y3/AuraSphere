import { useState } from 'react'
import type { Load } from '../../lib/api'
import { useCarriers } from '../carriers/api'
import { money } from './api'
import { useAcceptOption, useAddOption, useCoverOption, useDeleteOption, useOfferLoad, useOptions, useUpdateOption } from './quoteDesk'

// Traffic-light bookability derived server-side from vetting + compliance.
const LIGHT: Record<string, { dot: string; label: string }> = {
  green: { dot: '#3fb950', label: 'Vetted & bookable' },
  orange: { dot: '#e3933c', label: 'Needs review before booking' },
  red: { dot: '#f85149', label: 'Not approved' },
  grey: { dot: '#8b949e', label: 'Not in your carrier list yet' },
}

const STATUS_BADGE: Record<string, string> = {
  available: 'b-good', countered: 'b-brand', not_available: 'b-muted',
  declined: 'b-muted', accepted: 'b-good',
}

function num(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function QuoteDesk({ load }: { load: Load }) {
  const { data: options } = useOptions(load.id)
  const { data: carriers } = useCarriers({ page_size: 200 })
  const add = useAddOption(load.id)
  const update = useUpdateOption(load.id)
  const del = useDeleteOption(load.id)
  const accept = useAcceptOption(load.id)
  const cover = useCoverOption(load.id)
  const offer = useOfferLoad(load.id)

  const [carrierId, setCarrierId] = useState('')
  const [mc, setMc] = useState('')
  const [rate, setRate] = useState('')
  const [signInfo, setSignInfo] = useState<string | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)

  const onCoverResult = (r: { sign_url: string | null; sent_to: string | null }) => {
    setActionErr(null)
    setSignInfo(r.sent_to
      ? `Rate con sent to ${r.sent_to} for signature.`
      : 'Rate con generated — no carrier email on file, share the link manually.'
      + '')
    if (r.sign_url) setSignInfo((s) => `${s} Demo link: ${r.sign_url}`)
  }

  const customer = num(load.customer_rate)
  const target = num(load.target_rate)

  const submit = () => {
    if (!rate) return
    add.mutate({ carrier_id: carrierId ? Number(carrierId) : null, mc_number: mc || null, rate, status: 'available' })
    setRate(''); setCarrierId(''); setMc('')
  }

  return (
    <div>
      {/* Pricing targets */}
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="kpi-v">{money(load.customer_rate)}</div><div className="kpi-k">Customer rate</div></div>
        <div className="kpi"><div className="kpi-v">{money(load.target_rate)}</div><div className="kpi-k">Target buy</div></div>
        <div className="kpi">
          <div className="kpi-v">{customer != null && target != null ? money(String(customer - target)) : '—'}</div>
          <div className="kpi-k">Target margin</div>
        </div>
        <div className="kpi"><div className="kpi-v">{options?.length ?? 0}</div><div className="kpi-k">Options</div></div>
      </div>

      {/* Add option */}
      <div className="toolbar">
        <select className="ti" style={{ minWidth: 180 }} value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
          <option value="">Carrier…</option>
          {carriers?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="ti" style={{ width: 130 }} placeholder="or MC #" value={mc} onChange={(e) => setMc(e.target.value)} />
        <input className="ti" style={{ width: 140 }} type="number" placeholder="Offer rate $" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button className="btn" onClick={submit} disabled={!rate}>+ Add option</button>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>● live</span>
      </div>

      {load.status === 'offered' && load.offer_expires_at && (
        <div className="notice" style={{ background: 'rgba(227,147,60,0.14)', color: 'var(--warn)' }}>
          ⏳ Offered — locked for the carrier's signature until {new Date(load.offer_expires_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })};
          reverts to Tendered if unsigned.
        </div>
      )}
      {signInfo && <div className="notice" style={{ background: 'rgba(63,185,80,0.12)', color: 'var(--good)', wordBreak: 'break-all' }}>{signInfo}</div>}
      {actionErr && <div className="notice err">{actionErr}</div>}

      <div className="panel">
        <table>
          <thead>
            <tr><th></th><th>Carrier</th><th>Rate</th><th>Margin</th><th>vs Target</th><th>Status</th><th className="t-actions" /></tr>
          </thead>
          <tbody>
            {options?.map((o) => {
              const r = num(o.counter_rate) ?? num(o.rate)
              const margin = customer != null && r != null ? customer - r : null
              const overTarget = target != null && r != null && r > target
              const name = o.carrier?.name ?? o.carrier_name ?? '—'
              const accepted = o.status === 'accepted'
              const light = LIGHT[o.carrier_light ?? 'grey'] ?? LIGHT.grey
              return (
                <tr key={o.id}>
                  <td style={{ width: 26 }} title={light.label}>
                    <span style={{ display: 'inline-block', width: 11, height: 11, borderRadius: '50%', background: light.dot }} />
                  </td>
                  <td>
                    <strong>{name}</strong>
                    {o.mc_number && <span className="muted" style={{ fontSize: 12 }}> · {o.mc_number}</span>}
                    {o.source === 'carrier_app' && <span className="badge b-brand" style={{ marginLeft: 6, fontSize: 10 }}>app</span>}
                  </td>
                  <td>
                    {money(o.rate)}
                    {o.counter_rate != null && <span className="muted"> → {money(o.counter_rate)}</span>}
                  </td>
                  <td className="dc-amt">{margin != null ? money(String(margin)) : '—'}</td>
                  <td>
                    {r == null || target == null ? '—'
                      : overTarget ? <span className="badge b-muted">over</span>
                      : <span className="badge b-good">on target</span>}
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[o.status] ?? 'b-muted'}`}>{o.status.replace('_', ' ')}</span></td>
                  <td className="t-actions">
                    {!accepted && load.status !== 'covered' && o.carrier_light === 'green' && (
                      <button className="btn sm" disabled={cover.isPending}
                        title="Cover the load AND send the rate con for signature"
                        onClick={() => cover.mutate(o.id, { onSuccess: onCoverResult, onError: (e) => setActionErr(e.message) })}>
                        {cover.isPending ? '…' : '✓ Cover Load'}
                      </button>
                    )}{' '}
                    {!accepted && ['quote', 'tendered'].includes(load.status) && o.carrier_id != null && o.carrier_light !== 'red' && (
                      <button className="btn ghost sm" disabled={offer.isPending}
                        title="Lock the load to this carrier while they sign (auto-reverts if unsigned)"
                        onClick={() => offer.mutate({ option_id: o.id }, { onSuccess: onCoverResult, onError: (e) => setActionErr(e.message) })}>
                        ⏳ Offer
                      </button>
                    )}{' '}
                    {!accepted && load.status !== 'covered' && o.carrier_light !== 'green' && (
                      <button className="btn ghost sm" title="Cover without vetting (no rate con sent)"
                        onClick={() => accept.mutate(o.id)}>Accept</button>
                    )}{' '}
                    {!accepted && o.status !== 'not_available' && (
                      <button className="btn ghost sm" onClick={() => update.mutate({ id: o.id, status: 'not_available' })}>N/A</button>
                    )}{' '}
                    <button className="btn danger sm" onClick={() => del.mutate(o.id)}>✕</button>
                  </td>
                </tr>
              )
            })}
            {options && options.length === 0 && (
              <tr><td colSpan={7} className="muted" style={{ padding: 18 }}>
                No carrier options yet. Add one above — a carrier-side rep can drop offers here and they appear live.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
