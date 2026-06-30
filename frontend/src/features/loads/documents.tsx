import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, API_URL, type LoadDocument } from '../../lib/api'
import { Panel } from '../../components/shell'

const KIND_LABEL: Record<string, string> = {
  rate_con: 'Rate Con', bol: 'BOL', pod: 'POD', other: 'Other',
}

function useDocuments(loadId: number) {
  return useQuery({
    queryKey: ['load-docs', loadId],
    queryFn: () => api.get<LoadDocument[]>(`/api/loads/${loadId}/documents`),
  })
}

function useUploadDocument(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: string }) => {
      const form = new FormData()
      form.append('file', file)
      if (kind) form.append('kind', kind)
      return api.upload<LoadDocument>(`/api/loads/${loadId}/documents`, form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-docs', loadId] }),
  })
}

function useDeleteDocument(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (docId: number) => api.del(`/api/loads/${loadId}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-docs', loadId] }),
  })
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentsPanel({ loadId }: { loadId: number }) {
  const { data: docs, isLoading } = useDocuments(loadId)
  const upload = useUploadDocument(loadId)
  const del = useDeleteDocument(loadId)
  const [kind, setKind] = useState('rate_con')
  const fileRef = useRef<HTMLInputElement>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) upload.mutate({ file, kind }, { onSettled: () => { if (fileRef.current) fileRef.current.value = '' } })
  }

  return (
    <Panel title="Documents">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="ti" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <input ref={fileRef} type="file" onChange={onPick} style={{ display: 'none' }} />
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? 'Uploading…' : '＋ Upload document'}
        </button>
        {upload.isError && <span className="notice err" style={{ margin: 0 }}>{(upload.error as Error).message}</span>}
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : !docs?.length ? (
        <p className="muted">No documents yet. Upload a rate confirmation, BOL, or POD.</p>
      ) : (
        <table>
          <thead><tr><th>File</th><th>Type</th><th>Size</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <a href={`${API_URL}/api/loads/${loadId}/documents/${d.id}/download`} target="_blank" rel="noreferrer">
                    {d.filename}
                  </a>
                </td>
                <td>{d.kind ? KIND_LABEL[d.kind] ?? d.kind : '—'}</td>
                <td>{fmtSize(d.size)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost danger" onClick={() => { if (confirm(`Delete ${d.filename}?`)) del.mutate(d.id) }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
