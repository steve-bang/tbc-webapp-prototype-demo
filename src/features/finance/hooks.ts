import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import type { SettlementRequestType } from '@/shared/domain/enums'
import * as api from './api'
import type {
  ActorInfo,
  AdjustSettlementInput,
  CashDrawerSubmissionFilter,
  ConfirmLineInput,
  ConfirmTransactionInput,
  CreateAdjustmentInput,
  CreatePostSettlementChargeInput,
  CustomerAckInput,
  ManualLineInput,
  PaymentRequestFilter,
  PostSettlementChargeFilter,
  RecordTransactionInput,
  ResolveDisputeInput,
  ReverseSettlementInput,
  SettlementFilter,
  SubmitCashDrawerInput,
  TransactionFilter,
  WaiverInput,
} from './api'

/** Mirror `rentals/hooks.ts`/`incidents/hooks.ts` — fallback khi mất session là `OPERATION_STAFF` (quyền thấp nhất). */
function useActor(): ActorInfo {
  const user = useSessionStore((s) => s.user)
  return {
    userId: user?.userId ?? '',
    fullName: user?.fullName ?? '',
    role: user?.role ?? 'OPERATION_STAFF',
  }
}

export function useSettlements(filter?: SettlementFilter) {
  return useQuery({
    queryKey: ['settlements', filter ?? {}],
    queryFn: () => api.listSettlements(filter),
  })
}

export function useSettlementByRental(rentalId?: string) {
  return useQuery({
    queryKey: ['settlements', 'byRental', rentalId],
    queryFn: () => api.getSettlementByRentalId(rentalId as string),
    enabled: !!rentalId,
  })
}

/** Invalidate chung cho mọi mutation — `['settlements']` luôn; `['rentals']` khi đổi trạng thái Rental (mở/đóng lượt). */
function invalidateSettlements(queryClient: ReturnType<typeof useQueryClient>, rentalId?: string, invalidateRental = false) {
  queryClient.invalidateQueries({ queryKey: ['settlements'] })
  if (rentalId) queryClient.invalidateQueries({ queryKey: ['settlements', 'byRental', rentalId] })
  if (invalidateRental && rentalId) {
    queryClient.invalidateQueries({ queryKey: ['rentals'] })
    queryClient.invalidateQueries({ queryKey: ['rentals', 'detail', rentalId] })
  }
}

export function useOpenSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (rentalId: string) => api.openSettlement(rentalId, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId, true),
  })
}

export function useResyncSettlementSources() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.resyncSettlementSources(id, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useConfirmSettlementLine() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, lineId, input }: { id: string; lineId: string; input: ConfirmLineInput }) => api.confirmLine(id, lineId, input, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useAddSettlementManualLine() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ManualLineInput }) => api.addManualLine(id, input, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useRemoveSettlementManualLine() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, lineId }: { id: string; lineId: string }) => api.removeManualLine(id, lineId, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useApplySettlementWaiver() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WaiverInput }) => api.applyWaiver(id, input, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useDisputeSettlementLine() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, lineId, disputeNote }: { id: string; lineId: string; disputeNote: string }) => api.disputeLine(id, lineId, disputeNote, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useResolveSettlementDispute() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, lineId, input }: { id: string; lineId: string; input: ResolveDisputeInput }) => api.resolveDispute(id, lineId, input, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useReconcileSettlementDeposit() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.reconcileDeposit(id, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useSubmitSettlementForCustomer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.submitForCustomer(id, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useRecordSettlementCustomerAck() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerAckInput }) => api.recordCustomerAck(id, input, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useApproveSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.approveSettlement(id, note, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useRejectSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.rejectSettlement(id, note, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useCreateSettlementPaymentRequest() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: SettlementRequestType }) => api.createPaymentRequest(id, type, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId),
  })
}

export function useCompleteSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.completeSettlement(id, actor),
    onSuccess: (settlement) => invalidateSettlements(queryClient, settlement.rentalId, true),
  })
}

// ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.8) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán ----

export function usePostSettlementCharges(filter?: PostSettlementChargeFilter) {
  return useQuery({
    queryKey: ['postSettlementCharges', filter ?? {}],
    queryFn: () => api.listPostSettlementCharges(filter),
  })
}

export function useCreatePostSettlementCharge() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ settlementId, input }: { settlementId: string; input: CreatePostSettlementChargeInput }) =>
      api.createPostSettlementCharge(settlementId, input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postSettlementCharges'] }),
  })
}

export function useAdjustSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ settlementId, input }: { settlementId: string; input: AdjustSettlementInput }) => api.adjustSettlement(settlementId, input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postSettlementCharges'] }),
  })
}

export function useClosePostSettlementCharge() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ pscId, closeNote }: { pscId: string; closeNote?: string }) => api.closePostSettlementCharge(pscId, closeNote, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['postSettlementCharges'] }),
  })
}

export function useReverseSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ settlementId, input }: { settlementId: string; input: ReverseSettlementInput }) => api.reverseSettlement(settlementId, input, actor),
    onSuccess: (settlement) => {
      invalidateSettlements(queryClient, settlement.rentalId, true)
      queryClient.invalidateQueries({ queryKey: ['postSettlementCharges'] })
    },
  })
}

// ==== Payment (PM) — PAYMENT-PLAN.md §9.2, Round 1 ====

function invalidatePayment(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['finance', 'payment'] })
}

export function usePaymentRequests(filter?: PaymentRequestFilter) {
  return useQuery({
    queryKey: ['finance', 'payment', 'requests', filter ?? {}],
    queryFn: () => api.listPaymentRequests(filter),
  })
}

export function useTransactions(filter?: TransactionFilter) {
  return useQuery({
    queryKey: ['finance', 'payment', 'transactions', filter ?? {}],
    queryFn: () => api.listTransactions(filter),
  })
}

export function useCashDrawerSubmissions(filter?: CashDrawerSubmissionFilter) {
  return useQuery({
    queryKey: ['finance', 'payment', 'cashDrawerSubmissions', filter ?? {}],
    queryFn: () => api.listCashDrawerSubmissions(filter),
  })
}

export function useCreatePaymentSchedule() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (rentalId: string) => api.createPaymentSchedule(rentalId, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useRecordTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: RecordTransactionInput) => api.recordTransaction(input, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useConfirmTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmTransactionInput }) => api.confirmTransaction(id, input, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useFailTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.failTransaction(id, reason, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useVoidTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.voidTransaction(id, reason, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useReverseTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reverseTransaction(id, reason, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CreateAdjustmentInput) => api.createAdjustment(input, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useIssueReceipt() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (transactionId: string) => api.issueReceipt(transactionId, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useSubmitCashDrawer() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: SubmitCashDrawerInput) => api.submitCashDrawer(input, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}

export function useReceiveCashDrawerSubmission() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.receiveCashDrawerSubmission(id, actor),
    onSuccess: () => invalidatePayment(queryClient),
  })
}
