import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { ActorInfo, VehicleBlockCreateInput, VehicleBlockFilter } from './api'

/**
 * Người thực hiện thao tác lấy từ phiên đăng nhập demo hiện tại — cùng pattern
 * `rentals/hooks.ts`/`vehicles/hooks.ts`.
 */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useVehicleBlocks(filter?: VehicleBlockFilter) {
  return useQuery({
    queryKey: ['vehicleBlocks', filter ?? {}],
    queryFn: () => api.list(filter),
  })
}

export function useCreateVehicleBlock() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: VehicleBlockCreateInput) => api.create(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicleBlocks'] }),
  })
}

export function useReleaseVehicleBlock() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.release(id, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicleBlocks'] }),
  })
}
