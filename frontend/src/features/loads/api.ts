import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Load, type LoadCreate, type LoadPage, type LoadUpdate } from '../../lib/api'

export interface LoadListParams {
  search?: string
  status?: string
  statuses?: string
  shipper_id?: number
  carrier_id?: number
  owner_id?: number
  page_size?: number
}

export function useBoardMeta() {
  return useQuery({
    queryKey: ['loads-board-meta'],
    queryFn: () => api.get<{ pipeline: string[]; statuses: string[] }>('/api/loads/board'),
    staleTime: Infinity,
  })
}

export function useLoads(params: LoadListParams) {
  return useQuery({
    queryKey: ['loads', params],
    queryFn: () => api.get<LoadPage>('/api/loads', { ...params }),
  })
}

export function useLoad(id: number | undefined) {
  return useQuery({
    queryKey: ['load', id],
    queryFn: () => api.get<Load>(`/api/loads/${id}`),
    enabled: id !== undefined,
  })
}

export function useCreateLoad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoadCreate) => api.post<Load>('/api/loads', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loads'] }),
  })
}

export function useUpdateLoad(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoadUpdate) => api.patch<Load>(`/api/loads/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loads'] })
      qc.invalidateQueries({ queryKey: ['load', id] })
    },
  })
}

export function useDatPost(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (posted: boolean) => {
      if (posted) await api.post<Load>(`/api/loads/${id}/dat-post`)
      else await api.del(`/api/loads/${id}/dat-post`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loads'] })
      qc.invalidateQueries({ queryKey: ['load', id] })
    },
  })
}

export function useDuplicateLoad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Load>(`/api/loads/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loads'] }),
  })
}

export function useDeleteLoad() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/loads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loads'] }),
  })
}

// Board drag / action-row status change — optimistic, rolls back on error.
export function useChangeStatus(listKey: LoadListParams) {
  const qc = useQueryClient()
  const queryKey = ['loads', listKey]
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch<Load>(`/api/loads/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<LoadPage>(queryKey)
      if (prev) {
        qc.setQueryData<LoadPage>(queryKey, {
          ...prev,
          items: prev.items.map((l) => (l.id === id ? { ...l, status } : l)),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['loads'] }),
  })
}

export const STATUS_LABEL: Record<string, string> = {
  quote: 'Quote', tendered: 'Tendered', offered: 'Offered', covered: 'Covered',
  dispatched: 'Dispatched', in_transit: 'In Transit', delivered: 'Delivered',
  invoiced: 'Invoiced', lost: 'Lost', tonu: 'TONU',
}

export function money(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Margin as a % of the customer rate. Used to flag thin-margin loads.
export const LOW_MARGIN_PCT = 12

export function marginPct(
  margin: string | null | undefined,
  customerRate: string | null | undefined,
): number | null {
  if (margin == null || customerRate == null) return null
  const m = Number(margin)
  const c = Number(customerRate)
  if (Number.isNaN(m) || Number.isNaN(c) || c === 0) return null
  return (m / c) * 100
}
