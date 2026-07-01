import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Carrier,
  type CarrierCreate,
  type CarrierPage,
  type CarrierUpdate,
} from '../../lib/api'

export interface CarrierListParams {
  search?: string
  owner_id?: number
  status?: string
  hq_state?: string
  equipment?: string
  min_rating?: number
  page?: number
  page_size?: number
}

export function useCarriers(params: CarrierListParams) {
  return useQuery({
    queryKey: ['carriers', params],
    queryFn: () => api.get<CarrierPage>('/api/carriers', { ...params }),
  })
}

export function useCarrier(id: number | undefined) {
  return useQuery({
    queryKey: ['carrier', id],
    queryFn: () => api.get<Carrier>(`/api/carriers/${id}`),
    enabled: id !== undefined,
  })
}

export function useCreateCarrier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CarrierCreate) => api.post<Carrier>('/api/carriers', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  })
}

export function useUpdateCarrier(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CarrierUpdate) => api.patch<Carrier>(`/api/carriers/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['carriers'] })
      qc.invalidateQueries({ queryKey: ['carrier', id] })
    },
  })
}

export function useDeleteCarrier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/carriers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carriers'] }),
  })
}
