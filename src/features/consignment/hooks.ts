import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import { listAuditRecords } from '@/shared/lib/audit'
import * as api from './api'
import type {
  ActorInfo,
  ConsignmentContractCreateInput,
  ConsignmentContractFilter,
  ConsignmentContractInput,
  ConsignmentHandoverRecordFilter,
  ConsignmentIntakeInput,
  VehicleOwnerFilter,
  VehicleOwnerInput,
} from './api'

/** Mirror `contracts/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

const ROOT = ['consignment'] as const

export function useVehicleOwners(filter?: VehicleOwnerFilter) {
  return useQuery({
    queryKey: [...ROOT, 'owners', filter ?? {}],
    queryFn: () => api.listVehicleOwners(filter),
  })
}

export function useVehicleOwner(id?: string) {
  return useQuery({
    queryKey: [...ROOT, 'owner', id],
    queryFn: () => api.getVehicleOwner(id as string),
    enabled: !!id,
  })
}

export function useConsignmentContracts(filter?: ConsignmentContractFilter) {
  return useQuery({
    queryKey: [...ROOT, 'contracts', filter ?? {}],
    queryFn: () => api.listConsignmentContracts(filter),
  })
}

export function useConsignmentContract(id?: string) {
  return useQuery({
    queryKey: [...ROOT, 'contract', id],
    queryFn: () => api.getConsignmentContract(id as string),
    enabled: !!id,
  })
}

export function useConsignmentHandoverRecords(filter?: ConsignmentHandoverRecordFilter) {
  return useQuery({
    queryKey: [...ROOT, 'handover-records', filter ?? {}],
    queryFn: () => api.listConsignmentHandoverRecords(filter),
  })
}

/**
 * Tab "Nhật ký thao tác" — đọc `listAuditRecords()` (không phải dữ liệu nghiệp vụ nên không qua `fakeRequest`) nhưng
 * bọc `useQuery` dưới khoá `consignment` để mọi mutation (kể cả meta-audit xem số tài khoản) làm tab tự làm mới.
 */
export function useConsignmentAudit(entities: Array<{ entity: string; entityIds: string[] }>) {
  const key = entities.map((e) => `${e.entity}:${e.entityIds.join(',')}`).join('|')
  return useQuery({
    queryKey: [...ROOT, 'audit', key],
    queryFn: () =>
      listAuditRecords()
        .filter((r) => entities.some((e) => e.entity === r.entity && e.entityIds.includes(r.entityId)))
        .sort((a, b) => b.at.localeCompare(a.at)),
  })
}

function useInvalidateConsignment() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ROOT })
}

export function useCreateVehicleOwner() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (input: VehicleOwnerInput) => api.createVehicleOwner(input, actor),
    onSuccess: invalidate,
  })
}

export function useUpdateVehicleOwner() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VehicleOwnerInput }) => api.updateVehicleOwner(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useRevealOwnerBankAccount() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => api.revealOwnerBankAccount(id, actor),
    onSuccess: invalidate,
  })
}

export function useCreateConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (input: ConsignmentContractCreateInput) => api.createConsignmentContract(input, actor),
    onSuccess: invalidate,
  })
}

export function useUpdateConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsignmentContractInput }) =>
      api.updateConsignmentContract(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useSubmitConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => api.submitConsignmentContract(id, actor),
    onSuccess: invalidate,
  })
}

export function useReturnConsignmentContractToDraft() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.returnConsignmentContractToDraft(id, reason, actor),
    onSuccess: invalidate,
  })
}

export function useSignConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, signedFileName }: { id: string; signedFileName: string }) =>
      api.signConsignmentContract(id, { signedFileName }, actor),
    onSuccess: invalidate,
  })
}

export function useRecordConsignmentIntake() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ contractId, input }: { contractId: string; input: ConsignmentIntakeInput }) =>
      api.recordConsignmentIntake(contractId, input, actor),
    onSuccess: invalidate,
  })
}

export function useActivateConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => api.activateConsignmentContract(id, actor),
    onSuccess: invalidate,
  })
}

export function useSuspendConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.suspendConsignmentContract(id, reason, actor),
    onSuccess: invalidate,
  })
}

export function useResumeConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.resumeConsignmentContract(id, reason, actor),
    onSuccess: invalidate,
  })
}

export function useSupersedeConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.supersedeConsignmentContract(id, reason, actor),
    onSuccess: invalidate,
  })
}
