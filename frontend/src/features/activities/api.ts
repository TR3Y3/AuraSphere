import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Activity, type ActivityCreate, type ActivityPage } from '../../lib/api'

// One of these scopes a timeline to a record.
export interface ActivityScope {
  related_load_id?: number
  related_carrier_id?: number
  related_company_id?: number
  related_contact_id?: number
}

export function useActivities(
  params: ActivityScope & { type?: string; owner_id?: number; open_tasks?: boolean },
  opts?: { live?: boolean },
) {
  return useQuery({
    queryKey: ['activities', params],
    queryFn: () => api.get<ActivityPage>('/api/activities', { ...params, page_size: 200 }),
    // "Live" feeds (the load thread) poll so two reps see each other's notes.
    refetchInterval: opts?.live ? 10000 : undefined,
  })
}

export function useUnseenMentions() {
  return useQuery({
    queryKey: ['mentions-unseen'],
    queryFn: () => api.get<ActivityPage>('/api/activities/mentions/unseen'),
    refetchInterval: 30000,
  })
}

export function useMarkMentionsSeen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/activities/mentions/seen', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mentions-unseen'] }),
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

// Compact icons for auto-posted system feed events.
export const EVENT_ICON: Record<string, string> = {
  created: '＋', status_change: '⇄', carrier_assigned: '🚚', carrier_removed: '🚫',
  uncovered: '↩', ratecon_sent: '📨', ratecon_signed: '✍️', doc_uploaded: '📄',
}
