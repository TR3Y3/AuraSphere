import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Activity, type ActivityCreate, type ActivityPage } from '../../lib/api'

// One of these scopes a timeline to a record.
export interface ActivityScope {
  related_load_id?: number
  related_carrier_id?: number
  related_company_id?: number
  related_contact_id?: number
}

export function useActivities(params: ActivityScope & { type?: string; owner_id?: number; open_tasks?: boolean }) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: () => api.get<ActivityPage>('/api/activities', { ...params, page_size: 200 }),
  })
}

export function useLogActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ActivityCreate) => api.post<Activity>('/api/activities', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Record<string, unknown>) =>
      api.patch<Activity>(`/api/activities/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/activities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['activities'] }),
  })
}

export const TYPE_ICON: Record<string, string> = { call: '📞', email: '✉️', note: '📝', task: '✅' }
