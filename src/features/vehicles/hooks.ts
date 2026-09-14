import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, VehicleDocumentFormInput, VehicleFilter, VehicleFormInput } from './api'
import type { VehicleStatus } from '@/shared/domain/enums'

/**
 * Người thực hiện thao tác lấy từ phiên đăng nhập demo hiện tại. Fallback khi
 * mất session là `OPERATION_STAFF` (quyền thấp nhất) — cùng pattern
 * `features/customers/hooks.ts`/`features/employees/hooks.ts`.
 */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useVehicles(filter?: VehicleFilter) {
  return useQuery({
    queryKey: ['vehicles', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useVehicle(id?: string) {
  return useQuery({
    queryKey: ['vehicles', 'detail', id],
    queryFn: () => api.getById(id as string),
    enabled: !!id,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: VehicleFormInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  })
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VehicleFormInput }) => api.update(id, input, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', variables.id] })
    },
  })
}

export function useChangeVehicleStatus() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: VehicleStatus }) => api.changeStatus(id, status, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', variables.id] })
    },
  })
}

export function useAddVehicleDocument() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ vehicleId, input }: { vehicleId: string; input: VehicleDocumentFormInput }) =>
      api.addDocument(vehicleId, input, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', variables.vehicleId] })
    },
  })
}

export function useUpdateVehicleDocument() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({
      vehicleId,
      docId,
      input,
    }: {
      vehicleId: string
      docId: string
      input: VehicleDocumentFormInput
    }) => api.updateDocument(vehicleId, docId, input, actor),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'detail', variables.vehicleId] })
    },
  })
}
