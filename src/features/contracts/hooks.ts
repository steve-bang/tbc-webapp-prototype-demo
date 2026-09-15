import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, ContractAddendumFilter, ContractCreateInput, ContractFilter, ContractSignInput } from './api'

/** Mirror `rentals/hooks.ts`/`vehicles/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useContracts(filter?: ContractFilter) {
  return useQuery({
    queryKey: ['contracts', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useContract(id?: string) {
  return useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

export function useContractAddendums(filter?: ContractAddendumFilter) {
  return useQuery({
    queryKey: ['contractAddendums', filter ?? {}],
    queryFn: () => api.listAddendums(filter),
  })
}

/**
 * Tạo Contract từ Rental — cũng đổi trạng thái Rental (qua `markContractCreated()`
 * bên trong `api.create()`) nên invalidate luôn `['rentals']` để `RentalContractTab`/
 * badge trạng thái Rental cập nhật ngay.
 */
export function useCreateContract() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: ContractCreateInput) => api.create(input, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['rentals'] })
    },
  })
}

export function useMarkContractSigned() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContractSignInput }) => api.markSigned(id, input, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', variables.id] })
    },
  })
}

export function useVoidContract() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.voidContract(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', variables.id] })
    },
  })
}
