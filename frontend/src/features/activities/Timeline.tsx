import { useState } from 'react'
import { Panel } from '../../components/shell'
import {
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
export function Timeline({ scope, title = 'Activity' }: { scope: ActivityScope; title?: string }) {
  const { data } = useActivities(scope)
  const log = useLogActivity()
  const update = useUpdateActivity()
  const del = useDeleteActivity()

  const [type, setType] = useState<(typeof TYPES)[number]>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [due, setDue] = useState('')

  const submit = () => {
    if (!subject.trim() && !body.trim()) return
    log.mutate({
      type, subject: subject || null, body: body || null,
      due_at: type === 'task' && due ? new Date(due).toISOString() : null,
      ...scope,
    })
    setSubject(''); setBody(''); setDue('')
  }

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
            <input className="ti" style={{ width: 200 }} type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          )}
        </div>
        <input className="ti" placeholder={type === 'task' ? 'Task — what needs doing?' : 'Subject'} value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="ti" rows={2} placeholder="Details…" value={body} onChange={(e) => setBody(e.target.value)} />
        <div><button className="btn sm" onClick={submit} disabled={log.isPending}>Log {type}</button></div>
      </div>

      <div>
        {data?.items.map((a) => {
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
                <button className="iconbtn" title="Delete" onClick={() => del.mutate(a.id)}>✕</button>
              </div>
            </div>
          )
        })}
        {data && data.items.length === 0 && <p className="muted" style={{ margin: 0 }}>No activity yet — log a call, note, or task above.</p>}
      </div>
    </Panel>
  )
}
