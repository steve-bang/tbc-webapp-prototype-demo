import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, RentalFilter, RentalFormInput } from './api'

/**
 * Người thực hiện thao tác lấy từ phiên đăng nhập demo hiện tại. Fallback khi
 * mất session là `OPERATION_STAFF` (quyền thấp nhất) — cùng pattern
 * `features/vehicles/hooks.ts`/`features/customers/hooks.ts`.
 */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useRentals(filter?: RentalFilter) {
  return useQuery({
    queryKey: ['rentals', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useRental(id?: string) {
  return useQuery({
    queryKey: ['rentals', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateRental() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: RentalFormInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rentals'] }),
  })
}

export function useConfirmRental() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.confirm(id, actor),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
      queryClient.invalidateQueries({ queryKey: ['rentals', 'detail', id] })
    },
  })
}

export function useCancelRental() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.cancel(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
      queryClient.invalidateQueries({ queryKey: ['rentals', 'detail', variables.id] })
    },
  })
}

/** `docs/CONTRACT-MANAGEMENT-PLAN.md` §0.2/§9.3 — chỉ `features/contracts` gọi hook này. */
export function useMarkContractCreated() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.markContractCreated(id, actor),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
      queryClient.invalidateQueries({ queryKey: ['rentals', 'detail', id] })
    },
  })
}
