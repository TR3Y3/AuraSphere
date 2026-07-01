import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Company,
  type CompanyCreate,
  type CompanyPage,
  type CompanyUpdate,
} from '../../lib/api'

export interface CompanyListParams {
  search?: string
  owner_id?: number
  industry?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export function useCompanies(params: CompanyListParams) {
  return useQuery({
    queryKey: ['companies', params],
    queryFn: () => api.get<CompanyPage>('/api/companies', { ...params }),
  })
}

export function useCompany(id: number | undefined) {
  return useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get<Company>(`/api/companies/${id}`),
    enabled: id !== undefined,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CompanyCreate) => api.post<Company>('/api/companies', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CompanyUpdate) =>
      api.patch<Company>(`/api/companies/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['company', id] })
    },
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/companies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}
