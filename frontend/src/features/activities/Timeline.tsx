import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Panel } from '../../components/shell'
import { api } from '../../lib/api'
import { useUsers } from '../users/api'
import {
  EVENT_ICON,
  TYPE_ICON,
  useActivities,
  useDeleteActivity,
  useLogActivity,
  useUpdateActivity,
  type ActivityScope,
} from './api'

const TYPES = ['note', 'call', 'email', 'task'] as const

function when(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A record's activity feed + a quick composer. `scope` is one related_* id.
// On loads this is the live thread: user notes + @mentions + auto-posted
// system events (status/carrier/ratecon/docs) in one chronological feed.
export function Timeline({ scope, title = 'Activity' }: { scope: ActivityScope; title?: string }) {
  const isLoadFeed = scope.related_load_id != null
  const { data } = useActivities(scope, { live: isLoadFeed })
  const { data: users } = useUsers()
  const log = useLogActivity()
  const update = useUpdateActivity()
  const del = useDeleteActivity()
  const qc = useQueryClient()

  const [type, setType] = useState<(typeof TYPES)[number]>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')
  const [notesOnly, setNotesOnly] = useState(false)
  const [mentionIds, setMentionIds] = useState<number[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // "@" in the note body opens a teammate picker; picking inserts @Name and
  // records the user id for the notification.
  const onBodyChange = (v: string) => {
    setBody(v)
    const m = v.match(/@([A-Za-z]*)$/)
    setMentionQuery(m ? m[1].toLowerCase() : null)
  }
  const mentionMatches = mentionQuery != null
    ? (users ?? []).filter((u) => u.full_name.toLowerCase().includes(mentionQuery)).slice(0, 5)
    : []
  const pickMention = (id: number, name: string) => {
    setBody((b) => b.replace(/@([A-Za-z]*)$/, `@${name} `))
    setMentionIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setMentionQuery(null)
  }

  const submit = () => {
    if (!subject.trim() && !body.trim()) return
    log.mutate({
      type, subject: subject || null, body: body || null,
      due_at: type === 'task' && due ? new Date(due).toISOString() : null,
      mentions: mentionIds.length ? mentionIds : null,
      ...scope,
    })
    setSubject(''); setBody(''); setDue(''); setMentionIds([]); setMentionQuery(null)
  }

  async function attachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || scope.related_load_id == null) return
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'other')
    setUploading(true)
    try {
      await api.upload(`/api/loads/${scope.related_load_id}/documents`, form)
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['documents', scope.related_load_id] })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const items = (data?.items ?? []).filter((a) => !notesOnly || a.kind !== 'system')

  return (
    <Panel title={title}>
      <div className="composer">
        <div className="composer-row">
          <div className="type-pills">
            {TYPES.map((t) => (
              <button key={t} className={t === type ? 'on' : ''} onClick={() => setType(t)}>
                {TYPE_ICON[t]} {t}
              </button>
            ))}
          </div>
          {type === 'task' && (
            <input className="ti" style={{ width: 200 }} type="datetime-local" aria-label="Task due date"
              value={due} onChange={(e) => setDue(e.target.value)} />
          )}
          <div style={{ flex: 1 }} />
          {isLoadFeed && (
            <label className="check" style={{ fontSize: 12 }}>
              <input type="checkbox" checked={notesOnly} onChange={(e) => setNotesOnly(e.target.checked)} />
              Notes only
            </label>
          )}
        </div>
        <input className="ti" placeholder={type === 'task' ? 'Task — what needs doing?' : 'Subject'} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <div style={{ position: 'relative' }}>
          <textarea className="ti" rows={2} placeholder="Details… (type @ to tag a teammate)" value={body}
            onChange={(e) => onBodyChange(e.target.value)} />
          {mentionMatches.length > 0 && (
            <div className="menu-pop" style={{ left: 8, right: 'auto', top: '100%' }}>
              {mentionMatches.map((u) => (
                <button key={u.id} onClick={() => pickMention(u.id, u.full_name)}>@{u.full_name}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn sm" onClick={submit} disabled={log.isPending}>Log {type}</button>
          {isLoadFeed && (
            <button className="btn ghost sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '📎 Attach file'}
            </button>
          )}
          {mentionIds.length > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              tagging {mentionIds.length} teammate{mentionIds.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={attachFile}
          aria-label="Attach a file to this load" />
      </div>

      <div>
        {items.map((a) => {
          if (a.kind === 'system') {
            return (
              <div key={a.id} className="tl-item" style={{ padding: '7px 0' }}>
                <span className="tl-ico" style={{ fontSize: 13 }}>{EVENT_ICON[a.event_type ?? ''] ?? '•'}</span>
                <div className="tl-body">
                  <div className="tl-meta" style={{ marginTop: 0 }}>
                    <span style={{ color: 'var(--text)' }}>{a.subject}</span>
                    {a.body ? <> — {a.body}</> : null}
                    {' · '}{when(a.created_at)}
                  </div>
                </div>
              </div>
            )
          }
          const done = !!a.completed_at
          const overdue = a.type === 'task' && !done && a.due_at && new Date(a.due_at) < new Date()
          return (
            <div key={a.id} className={`tl-item${done ? ' tl-done' : ''}`}>
              <span className="tl-ico">{TYPE_ICON[a.type] ?? '•'}</span>
              <div className="tl-body">
                {a.subject && <div className="tl-subject">{a.subject}</div>}
                {a.body && <div className="tl-text">{a.body}</div>}
                <div className="tl-meta">
                  {a.type}
                  {a.type === 'task' && a.due_at && <> · <span className={overdue ? 'tl-overdue' : ''}>due {when(a.due_at)}</span></>}
                  {' · '}{when(a.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                {a.type === 'task' && (
                  <button className="btn ghost sm" onClick={() => update.mutate({ id: a.id, completed: !done })}>
                    {done ? '↺ Reopen' : '✓ Done'}
                  </button>
                )}
                <button className="iconbtn" title="Delete" aria-label="Delete entry" onClick={() => del.mutate(a.id)}>✕</button>
              </div>
            </div>
          )
        })}
        {data && items.length === 0 && <p className="muted" style={{ margin: 0 }}>No activity yet — log a call, note, or task above.</p>}
      </div>
    </Panel>
  )
}
