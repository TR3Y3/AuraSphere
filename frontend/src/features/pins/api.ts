import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Pin, type PinCreate } from '../../lib/api'

export function usePins() {
  return useQuery({ queryKey: ['pins'], queryFn: () => api.get<Pin[]>('/api/pins') })
}

export function useCreatePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PinCreate) => api.post<Pin>('/api/pins', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pins'] }),
  })
}

export function useUpdatePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; note?: string | null; remind_at?: string | null }) =>
      api.patch<Pin>(`/api/pins/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pins'] }),
  })
}

export function useDeletePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/pins/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pins'] }),
  })
}
