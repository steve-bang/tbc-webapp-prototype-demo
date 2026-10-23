import { useQuery } from '@tanstack/react-query'
import * as api from './api'

/** Tín hiệu cảnh báo vận hành cho Dashboard (Round 1) — chỉ đọc. */
export function useOperationalSignals() {
  return useQuery({
    queryKey: ['notifications', 'signals'],
    queryFn: () => api.listOperationalSignals(),
  })
}
