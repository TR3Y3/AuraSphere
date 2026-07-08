import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type CompanyPage, type CarrierPage, type ContactPage, type LoadPage } from '../lib/api'

interface Result {
  type: string
  label: string
  to: string
}

// Lightweight global search across the core records. Queries the existing
// list endpoints (org-scoped server-side) and merges the top hits.
export function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      const params = { search: term, page_size: 5 }
      const [loads, shippers, carriers, contacts] = await Promise.all([
        api.get<LoadPage>('/api/loads', params).catch(() => null),
        api.get<CompanyPage>('/api/companies', params).catch(() => null),
        api.get<CarrierPage>('/api/carriers', params).catch(() => null),
        api.get<ContactPage>('/api/contacts', params).catch(() => null),
      ])
      if (cancelled) return
      const merged: Result[] = [
        ...(loads?.items ?? []).map((l) => {
          const lane = [l.origin_city, l.dest_city].filter(Boolean).join(' → ')
          return { type: 'Load', label: `${l.reference ?? `Load ${l.id}`}${lane ? ` · ${lane}` : ''}`, to: `/loads/${l.id}` }
        }),
        ...(shippers?.items ?? []).map((s) => ({ type: 'Shipper', label: s.name, to: `/companies/${s.id}` })),
        ...(carriers?.items ?? []).map((c) => ({ type: 'Carrier', label: `${c.name}${c.mc_number ? ` · ${c.mc_number}` : ''}`, to: `/carriers/${c.id}` })),
        ...(contacts?.items ?? []).map((c) => ({ type: 'Contact', label: `${c.first_name} ${c.last_name ?? ''}`.trim(), to: `/contacts/${c.id}` })),
      ]
      setResults(merged)
      setActive(0)
    }, 180)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const go = (r: Result) => {
    // Remember the last few visited results for instant re-access.
    try {
      const rec: Result[] = JSON.parse(localStorage.getItem('as_recent') || '[]')
      const next = [r, ...rec.filter((x) => x.to !== r.to)].slice(0, 5)
      localStorage.setItem('as_recent', JSON.stringify(next))
    } catch { /* localStorage unavailable — skip recents */ }
    navigate(r.to)
    onClose()
  }

  const recents: Result[] = (() => {
    try { return JSON.parse(localStorage.getItem('as_recent') || '[]') } catch { return [] }
  })()

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search records" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          aria-label="Search loads, lanes, shippers, carriers, MC number, and contacts"
          placeholder="Search loads, lanes, shippers, carriers, MC#, contacts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="palette-results">
          {q.trim() && results.length === 0 && <div className="palette-empty">No matches.</div>}
          {results.map((r, i) => (
            <div key={`${r.to}`} className={`palette-item${i === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
              <span>{r.label}</span>
              <span className="type">{r.type}</span>
            </div>
          ))}
          {!q.trim() && recents.length > 0 && (
            <>
              <div className="palette-empty" style={{ paddingBottom: 4 }}>Recent</div>
              {recents.map((r) => (
                <div key={r.to} className="palette-item" onClick={() => go(r)}>
                  <span>{r.label}</span><span className="type">{r.type}</span>
                </div>
              ))}
            </>
          )}
          {!q.trim() && recents.length === 0 && <div className="palette-empty">Type to search across your records.</div>}
        </div>
      </div>
    </div>
  )
}
