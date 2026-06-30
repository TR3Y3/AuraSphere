import { useState } from 'react'

// Small click-to-copy control for IDs/details reps paste all day
// (MC#, DOT#, phone, email, load reference, …).
export function Copy({ value }: { value: string | null | undefined }) {
  const [done, setDone] = useState(false)
  if (!value) return null

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    } catch {
      // clipboard blocked (insecure context) — no-op
    }
  }

  return (
    <button className="copy-btn" onClick={copy} title={`Copy "${value}"`} aria-label="Copy">
      {done ? '✓' : '⧉'}
    </button>
  )
}

// Convenience: a value followed by a copy button.
export function Copyable({ value, children }: { value: string | null | undefined; children?: React.ReactNode }) {
  if (!value) return <>—</>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children ?? value}
      <Copy value={value} />
    </span>
  )
}
