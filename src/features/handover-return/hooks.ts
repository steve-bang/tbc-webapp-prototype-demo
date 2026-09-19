import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, HandoverFilter, HandoverUpdateInput, ReturnFilter, ReturnUpdateInput } from './api'

/** Mirror `contracts/hooks.ts`/`rentals/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useHandoverRecords(filter?: HandoverFilter) {
  return useQuery({
    queryKey: ['handoverRecords', filter ?? {}],
    queryFn: () => api.listHandovers(filter),
  })
}

export function useHandoverRecord(id?: string) {
  return useQuery({
    queryKey: ['handoverRecords', 'detail', id],
    queryFn: () => api.getHandoverById(id as string),
    enabled: !!id,
  })
}

export function useReturnRecords(filter?: ReturnFilter) {
  return useQuery({
    queryKey: ['returnRecords', filter ?? {}],
    queryFn: () => api.listReturns(filter),
  })
}

export function useReturnRecord(id?: string) {
  return useQuery({
    queryKey: ['returnRecords', 'detail', id],
    queryFn: () => api.getReturnById(id as string),
    enabled: !!id,
  })
}

export function useUpdateHandover() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, patch, reason }: { id: string; patch: HandoverUpdateInput; reason: string }) =>
      api.updateHandover(id, patch, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['handoverRecords'] })
      queryClient.invalidateQueries({ queryKey: ['handoverRecords', 'detail', variables.id] })
    },
  })
}

/** Cũng đổi trạng thái Rental (qua `revertHandoverCancelled()` bên trong `api.cancelHandover()`) nên invalidate luôn `['rentals']`. */
export function useCancelHandover() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.cancelHandover(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['handoverRecords'] })
      queryClient.invalidateQueries({ queryKey: ['handoverRecords', 'detail', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
    },
  })
}

export function useUpdateReturn() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, patch, reason }: { id: string; patch: ReturnUpdateInput; reason: string }) =>
      api.updateReturn(id, patch, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['returnRecords'] })
      queryClient.invalidateQueries({ queryKey: ['returnRecords', 'detail', variables.id] })
    },
  })
}

/** Cũng đổi trạng thái Rental (qua `revertReturnCancelled()` bên trong `api.cancelReturn()`) nên invalidate luôn `['rentals']`. */
export function useCancelReturn() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.cancelReturn(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['returnRecords'] })
      queryClient.invalidateQueries({ queryKey: ['returnRecords', 'detail', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
    },
  })
}
