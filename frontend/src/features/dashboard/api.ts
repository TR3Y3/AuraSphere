import { useQuery } from '@tanstack/react-query'
import { api, type DashboardSummary, type LanePrice } from '../../lib/api'

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary'),
  })
}

export function useLanePricing() {
  return useQuery({
    queryKey: ['pricing-lanes'],
    queryFn: () => api.get<LanePrice[]>('/api/pricing/lanes'),
  })
}

export function money(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isNaN(n) ? '—' : n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
