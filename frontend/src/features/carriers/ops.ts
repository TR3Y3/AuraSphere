import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Capacity, type CapacityCreate, type CarrierVetting, type Lane } from '../../lib/api'

export function useVetting(carrierId: number | undefined) {
  return useQuery({
    queryKey: ['carrier-vetting', carrierId],
    queryFn: () => api.get<CarrierVetting | null>(`/api/carriers/${carrierId}/vetting`),
    enabled: carrierId !== undefined,
  })
}

export function useRunVetting(carrierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<CarrierVetting>(`/api/carriers/${carrierId}/vet`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carrier-vetting', carrierId] }),
  })
}

export function useLanes(carrierId: number | undefined) {
  return useQuery({
    queryKey: ['carrier-lanes', carrierId],
    queryFn: () => api.get<Lane[]>(`/api/carriers/${carrierId}/lanes`),
    enabled: carrierId !== undefined,
  })
}

export function useCapacity(carrierId: number | undefined) {
  return useQuery({
    queryKey: ['carrier-capacity', carrierId],
    queryFn: () => api.get<Capacity[]>(`/api/carriers/${carrierId}/capacity`),
    enabled: carrierId !== undefined,
  })
}

export function useAddCapacity(carrierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CapacityCreate) => api.post<Capacity>(`/api/carriers/${carrierId}/capacity`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carrier-capacity', carrierId] }),
  })
}

export function useDeleteCapacity(carrierId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/carriers/${carrierId}/capacity/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['carrier-capacity', carrierId] }),
  })
}
