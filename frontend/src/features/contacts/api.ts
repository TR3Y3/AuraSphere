import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type Contact,
  type ContactCreate,
  type ContactPage,
  type ContactUpdate,
} from '../../lib/api'

export interface ContactListParams {
  search?: string
  owner_id?: number
  company_id?: number
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

export function useContacts(params: ContactListParams) {
  return useQuery({
    queryKey: ['contacts', params],
    queryFn: () => api.get<ContactPage>('/api/contacts', { ...params }),
  })
}

export function useContact(id: number | undefined) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<Contact>(`/api/contacts/${id}`),
    enabled: id !== undefined,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ContactCreate) => api.post<Contact>('/api/contacts', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useUpdateContact(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ContactUpdate) =>
      api.patch<Contact>(`/api/contacts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contact', id] })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  })
}
