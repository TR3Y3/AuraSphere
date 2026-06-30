import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Load, type LoadOption, type OptionCreate, type OptionUpdate } from '../../lib/api'

// Options refetch on an interval so two reps working the same load see each
// other's changes near-real-time (a lightweight stand-in for websockets).
export function useOptions(loadId: number) {
  return useQuery({
    queryKey: ['load-options', loadId],
    queryFn: () => api.get<LoadOption[]>(`/api/loads/${loadId}/options`),
    refetchInterval: 5000,
  })
}

export function useAddOption(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: OptionCreate) => api.post<LoadOption>(`/api/loads/${loadId}/options`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-options', loadId] }),
  })
}

export function useUpdateOption(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & OptionUpdate) =>
      api.patch<LoadOption>(`/api/loads/${loadId}/options/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-options', loadId] }),
  })
}

export function useDeleteOption(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/loads/${loadId}/options/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['load-options', loadId] }),
  })
}

export function useAcceptOption(loadId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Load>(`/api/loads/${loadId}/options/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['load-options', loadId] })
      qc.invalidateQueries({ queryKey: ['load', loadId] })
      qc.invalidateQueries({ queryKey: ['loads'] })
    },
  })
}
