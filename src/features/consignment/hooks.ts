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
  ConsignmentReturnInput,
  ConsignmentTerminationNoticeInput,
  ConsignmentVehicleLossInput,
  VehicleOwnerFilter,
  VehicleOwnerInput,
} from './api'
import * as addendumApi from './addendumApi'
import type { ConsignmentAddendumDraftInput } from './addendumModel'
import * as payoutApi from './payoutApi'
import type { OwnerPayoutAdjustmentDecision, OwnerPayoutAdjustmentInput, OwnerPayoutRecordFilter } from './payoutApi'
import * as proposalApi from './proposalApi'
import type { ConsignmentAppraisalInput, ConsignmentProposalFilter, ConsignmentProposalInput } from './proposalApi'

/** Mirror `contracts/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

/** Khoá gốc mọi query của Xe ký gửi — `features/finance` dùng để làm mới sau khi tạo / xác nhận / đảo lệnh chi. */
export const CONSIGNMENT_QUERY_KEY = ['consignment'] as const
const ROOT = CONSIGNMENT_QUERY_KEY

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

/** `options.enabled` mặc định `true` (caller cũ không đổi) — `ConsignmentAuditTab` tắt khi không có `contractId` (DASHBOARD-PLATFORM-PLAN.md §10 nợ #2). */
export function useConsignmentHandoverRecords(filter?: ConsignmentHandoverRecordFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ROOT, 'handover-records', filter ?? {}],
    queryFn: () => api.listConsignmentHandoverRecords(filter),
    enabled: options?.enabled ?? true,
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

// ---- Lịch chi trả hàng tháng ----

/** `options.enabled` mặc định `true` (caller cũ không đổi) — xem `useConsignmentHandoverRecords`. */
export function useOwnerPayoutRecords(filter?: OwnerPayoutRecordFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...ROOT, 'payout-records', filter ?? {}],
    queryFn: () => payoutApi.listOwnerPayoutRecords(filter),
    enabled: options?.enabled ?? true,
  })
}

export function useOwnerPayoutRecord(id?: string) {
  return useQuery({
    queryKey: [...ROOT, 'payout-record', id],
    queryFn: () => payoutApi.getOwnerPayoutRecord(id as string),
    enabled: !!id,
  })
}

export function useGenerateOwnerPayoutRecords() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: () => payoutApi.generateOwnerPayoutRecords(actor),
    onSuccess: invalidate,
  })
}

export function useHoldOwnerPayoutRecord() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => payoutApi.holdOwnerPayoutRecord(id, reason, actor),
    onSuccess: invalidate,
  })
}

export function useReleaseOwnerPayoutRecord() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => payoutApi.releaseOwnerPayoutRecord(id, reason, actor),
    onSuccess: invalidate,
  })
}

export function useRequestOwnerPayoutAdjustment() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OwnerPayoutAdjustmentInput }) =>
      payoutApi.requestOwnerPayoutAdjustment(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useDecideOwnerPayoutAdjustment() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, adjustmentId, input }: { id: string; adjustmentId: string; input: OwnerPayoutAdjustmentDecision }) =>
      payoutApi.decideOwnerPayoutAdjustment(id, adjustmentId, input, actor),
    onSuccess: invalidate,
  })
}

// ---- Chấm dứt · trả xe · đóng · mất xe ----

export function useVehicleRentalsForConsignment(vehicleId?: string) {
  return useQuery({
    queryKey: [...ROOT, 'vehicle-rentals', vehicleId],
    queryFn: () => api.listVehicleRentalsForConsignment(vehicleId as string),
    enabled: !!vehicleId,
  })
}

export function useVehicleIncidentsForConsignment(vehicleId?: string) {
  return useQuery({
    queryKey: [...ROOT, 'vehicle-incidents', vehicleId],
    queryFn: () => api.listVehicleIncidentsForConsignment(vehicleId as string),
    enabled: !!vehicleId,
  })
}

export function useConsignmentEndPreview(contractId?: string, endedDate?: string) {
  return useQuery({
    queryKey: [...ROOT, 'end-preview', contractId, endedDate],
    queryFn: () => api.previewConsignmentContractEnd(contractId as string, endedDate as string),
    enabled: !!contractId && !!endedDate,
  })
}

export function useNotifyConsignmentTermination() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsignmentTerminationNoticeInput }) =>
      api.notifyConsignmentTermination(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useRecordConsignmentReturn() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ contractId, input }: { contractId: string; input: ConsignmentReturnInput }) =>
      api.recordConsignmentReturn(contractId, input, actor),
    onSuccess: invalidate,
  })
}

export function useTerminateConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => api.terminateConsignmentContract(id, actor),
    onSuccess: invalidate,
  })
}

export function useCloseConsignmentContract() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => api.closeConsignmentContract(id, actor),
    onSuccess: invalidate,
  })
}

export function useRecordConsignmentVehicleLoss() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsignmentVehicleLossInput }) =>
      api.recordConsignmentVehicleLoss(id, input, actor),
    onSuccess: invalidate,
  })
}

// ---- Đề nghị ký gửi & thẩm định ----

export function useConsignmentProposals(filter?: ConsignmentProposalFilter, enabled = true) {
  return useQuery({
    queryKey: [...ROOT, 'proposals', filter ?? {}],
    queryFn: () => proposalApi.listConsignmentProposals(filter),
    enabled,
  })
}

export function useConsignmentProposal(id?: string) {
  return useQuery({
    queryKey: [...ROOT, 'proposal', id],
    queryFn: () => proposalApi.getConsignmentProposal(id as string),
    enabled: !!id,
  })
}

export function useCreateConsignmentProposal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (input: ConsignmentProposalInput) => proposalApi.createConsignmentProposal(input, actor),
    onSuccess: invalidate,
  })
}

export function useUpdateConsignmentProposal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsignmentProposalInput }) =>
      proposalApi.updateConsignmentProposal(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useStartConsignmentAppraisal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => proposalApi.startConsignmentAppraisal(id, actor),
    onSuccess: invalidate,
  })
}

export function useRecordConsignmentAppraisal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConsignmentAppraisalInput }) =>
      proposalApi.recordConsignmentAppraisal(id, input, actor),
    onSuccess: invalidate,
  })
}

export function useApproveConsignmentProposal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: (id: string) => proposalApi.approveConsignmentProposal(id, actor),
    onSuccess: invalidate,
  })
}

export function useRejectConsignmentProposal() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => proposalApi.rejectConsignmentProposal(id, reason, actor),
    onSuccess: invalidate,
  })
}

// ---- Phụ lục hợp đồng ----

export function useCreateConsignmentAddendum() {
  const actor = useActor()
  const invalidate = useInvalidateConsignment()
  return useMutation({
    mutationFn: ({ contractId, input }: { contractId: string; input: ConsignmentAddendumDraftInput }) =>
      addendumApi.createConsignmentAddendum(contractId, input, actor),
    onSuccess: invalidate,
  })
}
