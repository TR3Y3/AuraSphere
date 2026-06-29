import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Deal,
  type DealCreate,
  type DealPage,
  type DealUpdate,
  type Pipeline,
} from '../../lib/api'

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/api/pipelines'),
  })
}

export interface DealListParams {
  pipeline_id?: number
  owner_id?: number
  search?: string
  page_size?: number
}

export function useDeals(params: DealListParams) {
  return useQuery({
    queryKey: ['deals', params],
    queryFn: () => api.get<DealPage>('/api/deals', { ...params }),
  })
}

export function useDeal(id: number | undefined) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => api.get<Deal>(`/api/deals/${id}`),
    enabled: id !== undefined,
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DealCreate) => api.post<Deal>('/api/deals', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useUpdateDeal(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DealUpdate) => api.patch<Deal>(`/api/deals/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['deal', id] })
    },
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/deals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}

// Kanban drag: optimistically move the card, roll back on error.
export function useChangeStage(listKey: DealListParams) {
  const qc = useQueryClient()
  const queryKey = ['deals', listKey]
  return useMutation({
    mutationFn: ({ id, stage_id }: { id: number; stage_id: number }) =>
      api.patch<Deal>(`/api/deals/${id}/stage`, { stage_id }),
    onMutate: async ({ id, stage_id }) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<DealPage>(queryKey)
      if (prev) {
        qc.setQueryData<DealPage>(queryKey, {
          ...prev,
          items: prev.items.map((d) => (d.id === id ? { ...d, stage_id } : d)),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  })
}
