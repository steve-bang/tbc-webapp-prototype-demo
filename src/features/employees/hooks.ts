import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import type { EmployeeStatus } from '@/shared/domain/enums'
import * as api from './api'
import type { ActorInfo, EmployeeFilter, EmployeeFormInput } from './api'

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

export function useEmployees(filter?: EmployeeFilter) {
  return useQuery({
    queryKey: ['employees', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useEmployee(id?: string) {
  return useQuery({
    queryKey: ['employees', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: EmployeeFormInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({
      id,
      input,
      roleChangeReason,
    }: {
      id: string
      input: EmployeeFormInput
      roleChangeReason?: string
    }) => api.update(id, input, actor, roleChangeReason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'detail', variables.id] })
    },
  })
}

export function useChangeEmployeeStatus() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: EmployeeStatus; reason: string }) =>
      api.changeStatus(id, status, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'detail', variables.id] })
    },
  })
}

export function useGrantAccount() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, username }: { id: string; username: string }) => api.grantAccount(id, username, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'detail', variables.id] })
    },
  })
}

export function useLockAccount() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.lockAccount(id, reason, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'detail', variables.id] })
    },
  })
}

export function useUnlockAccount() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.unlockAccount(id, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employees', 'detail', variables.id] })
    },
  })
}
