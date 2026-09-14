import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
// MT §8 — join biển số/hãng/currentKm vào bảng "Đến hạn"; `vehicles` chưa export
// `useVehicles` qua barrel `index.ts` nên import thẳng từ `hooks.ts` của feature đó.
import { useVehicles } from '@/features/vehicles/hooks'
import * as api from './api'
import type {
  ActorInfo,
  MaintenanceRecordFilter,
  MaintenanceRecordFormInput,
  MaintenanceRuleFormInput,
  SparePartRecordFilter,
  SparePartRecordFormInput,
} from './api'

export { useVehicles }

/**
 * Người thực hiện thao tác lấy từ phiên đăng nhập demo hiện tại. Fallback khi
 * mất session là `OPERATION_STAFF` (quyền thấp nhất) — cùng pattern
 * `features/vehicles/hooks.ts`.
 */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useMaintenanceRules() {
  return useQuery({ queryKey: ['maintenanceRules'], queryFn: () => api.listRules() })
}

export function useCreateMaintenanceRule() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: MaintenanceRuleFormInput) => api.createRule(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenanceRules'] }),
  })
}

export function useDeactivateMaintenanceRule() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.deactivateRule(id, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenanceRules'] }),
  })
}

export function useMaintenanceRecords(filter?: MaintenanceRecordFilter) {
  return useQuery({
    queryKey: ['maintenanceRecords', filter ?? {}],
    queryFn: () => api.listRecords(filter),
  })
}

export function useCreateMaintenanceRecord() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: MaintenanceRecordFormInput) => api.createRecord(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenanceRecords'] }),
  })
}

export function useSparePartRecords(filter?: SparePartRecordFilter) {
  return useQuery({
    queryKey: ['sparePartRecords', filter ?? {}],
    queryFn: () => api.listSpareParts(filter),
  })
}

export function useCreateSparePartRecord() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: SparePartRecordFormInput) => api.createSparePart(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sparePartRecords'] }),
  })
}
