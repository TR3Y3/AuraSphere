import { useState } from 'react'
import { Panel } from '../../components/shell'
import { useAddCapacity, useCapacity, useDeleteCapacity } from './ops'

// Posted capacity per location (empty location, radius, weekly trucks).
export function CapacityPanel({ carrierId }: { carrierId: number }) {
  const { data: rows } = useCapacity(carrierId)
  const add = useAddCapacity(carrierId)
  const del = useDeleteCapacity(carrierId)
  const [location, setLocation] = useState('')
  const [radius, setRadius] = useState('')
  const [weekly, setWeekly] = useState('')

  const submit = () => {
    if (!location.trim()) return
    add.mutate({
      location: location.trim(),
      radius_miles: radius ? Number(radius) : null,
      weekly_capacity: weekly ? Number(weekly) : null,
    })
    setLocation(''); setRadius(''); setWeekly('')
  }

  return (
    <Panel title="Capacity">
      <table>
        <thead><tr><th>Empty location</th><th>Radius</th><th>Weekly</th><th /></tr></thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.id}>
              <td><strong>{r.location}</strong></td>
              <td>{r.radius_miles != null ? `${r.radius_miles} mi` : '—'}</td>
              <td>{r.weekly_capacity ?? '—'}</td>
              <td className="t-actions"><button className="btn danger sm" onClick={() => del.mutate(r.id)}>✕</button></td>
            </tr>
          ))}
          {rows && rows.length === 0 && (
            <tr><td colSpan={4} className="muted" style={{ padding: 12 }}>No capacity posted.</td></tr>
          )}
        </tbody>
      </table>
      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <input className="ti" style={{ flex: 1, minWidth: 120 }} placeholder="Hialeah, FL" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input className="ti" style={{ width: 80 }} type="number" placeholder="mi" value={radius} onChange={(e) => setRadius(e.target.value)} />
        <input className="ti" style={{ width: 80 }} type="number" placeholder="trucks" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
        <button className="btn sm" onClick={submit} disabled={!location.trim()}>+ Add</button>
      </div>
    </Panel>
  )
}
