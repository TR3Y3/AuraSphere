import { useState } from 'react'
import type { Load } from '../../lib/api'
import { useCarriers } from '../carriers/api'
import { money } from './api'
import { useAcceptOption, useAddOption, useDeleteOption, useOptions, useUpdateOption } from './quoteDesk'

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

  const [carrierId, setCarrierId] = useState('')
  const [rate, setRate] = useState('')

  const customer = num(load.customer_rate)
  const target = num(load.target_rate)

  const submit = () => {
    if (!rate) return
    add.mutate({ carrier_id: carrierId ? Number(carrierId) : null, rate, status: 'available' })
    setRate(''); setCarrierId('')
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
        <input className="ti" style={{ width: 140 }} type="number" placeholder="Offer rate $" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button className="btn" onClick={submit} disabled={!rate}>+ Add option</button>
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>● live</span>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr><th>Carrier</th><th>Rate</th><th>Margin</th><th>vs Target</th><th>Status</th><th className="t-actions" /></tr>
          </thead>
          <tbody>
            {options?.map((o) => {
              const r = num(o.counter_rate) ?? num(o.rate)
              const margin = customer != null && r != null ? customer - r : null
              const overTarget = target != null && r != null && r > target
              const name = o.carrier?.name ?? o.carrier_name ?? '—'
              const accepted = o.status === 'accepted'
              return (
                <tr key={o.id}>
                  <td><strong>{name}</strong></td>
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
                    {!accepted && load.status !== 'covered' && (
                      <button className="btn sm" onClick={() => accept.mutate(o.id)}>Accept</button>
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
              <tr><td colSpan={6} className="muted" style={{ padding: 18 }}>
                No carrier options yet. Add one above — a carrier-side rep can drop offers here and they appear live.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
