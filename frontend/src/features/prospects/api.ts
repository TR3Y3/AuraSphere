import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Prospect, type ProspectCreate, type ProspectPage } from '../../lib/api'

export interface ProspectListParams {
  search?: string
  status?: string
  page_size?: number
}

export function useProspects(params: ProspectListParams) {
  return useQuery({
    queryKey: ['prospects', params],
    queryFn: () => api.get<ProspectPage>('/api/prospects', { ...params }),
  })
}

export function useCreateProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProspectCreate) => api.post<Prospect>('/api/prospects', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export function useImportProspects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.upload<{ created: number; skipped: number }>('/api/prospects/import', form)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export function useEnrichProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Prospect>(`/api/prospects/${id}/enrich`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export function useUpdateProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch<Prospect>(`/api/prospects/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export function useConvertProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Prospect>(`/api/prospects/${id}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospects'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useDeleteProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/prospects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}
