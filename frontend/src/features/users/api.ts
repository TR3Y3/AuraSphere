import { useQuery } from '@tanstack/react-query'
import { api, type User } from '../../lib/api'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/api/users'),
  })
}
