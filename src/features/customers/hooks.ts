import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, CustomerFilter, CustomerFormInput } from './api'

/**
 * Người thực hiện thao tác lấy từ phiên đăng nhập demo hiện tại. Fallback khi
 * mất session là `OPERATION_STAFF` (quyền thấp nhất) — tránh audit ghi nhầm
 * quyền cao (`SYSTEM_ADMIN`) khi không xác định được actor thật.
 */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useCustomers(filter?: CustomerFilter) {
  return useQuery({
    queryKey: ['customers', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CustomerFormInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerFormInput }) => api.update(id, input, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', variables.id] })
    },
  })
}

export function useBlockCustomer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.block(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', variables.id] })
    },
  })
}

export function useUnblockCustomer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.unblock(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', variables.id] })
    },
  })
}
