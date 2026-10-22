import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import type { SettlementRequestType } from '@/shared/domain/enums'
import * as api from './api'
import type {
  ActorInfo,
  AdjustSettlementInput,
  CashDrawerSubmissionFilter,
  CashEntryFilter,
  ConfirmLineInput,
  ConfirmTransactionInput,
  CreateAdjustmentInput,
  CreatePostSettlementChargeInput,
  CostEntryFilter,
  CostRecordFilter,
  CostRecordInput,
  CreateRefundTransactionInput,
  CustomerAckInput,
  DecideRefundApprovalInput,
  ManualLineInput,
  PaymentRequestFilter,
  PostSettlementChargeFilter,
  RecordReportExportInput,
  RecordTransactionInput,
  ResolveDisputeInput,
  RevenueLineFilter,
  ReverseSettlementInput,
  SettlementFilter,
  SubmitCashDrawerInput,
  TransactionFilter,
  WaiverInput,
} from './api'

/** REVENUE-COST-PLAN.md §6.2 — key gốc của mọi query phân tích (Revenue/Cost/Cash). */
const ANALYTICS_QUERY_KEY = ['finance', 'analytics'] as const

/**
 * PAYMENT-PLAN.md §10.10 — F5: Settlement dùng key `['settlements']`, PSC dùng
 * `['postSettlementCharges']`, Payment dùng `['finance','payment']`; Round 2 có
 * ghi chéo ba phía nên mọi mutation Payment VÀ mọi mutation Settlement có ghi
 * chéo sang Payment (OFFSET, huỷ yêu cầu, đóng PSC tự động…) phải invalidate
 * đủ cả ba namespace.
 */
function invalidateFinanceAll(queryClient: ReturnType<typeof useQueryClient>, rentalId?: string) {
  queryClient.invalidateQueries({ queryKey: ['finance', 'payment'] })
  // REVENUE-COST-PLAN.md §6.2 — hoàn tất/đảo quyết toán, PSC, giao dịch làm đổi số liệu phân tích (Revenue Line/thực thu suy ra).
  // Mutation của `incidents`/`maintenance` không invalidate được (ngoài phạm vi) — query analytics để `staleTime: 0` mặc định
  // + refetch khi mount nên luôn tải lại khi mở màn/tab.
  queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: ['settlements'] })
  if (rentalId) queryClient.invalidateQueries({ queryKey: ['settlements', 'byRental', rentalId] })
  queryClient.invalidateQueries({ queryKey: ['postSettlementCharges'] })
}

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
  // REVENUE-COST-PLAN.md §6.2 — mọi thay đổi Settlement làm đổi Revenue Line suy ra.
  queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })
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
    onSuccess: (settlement) => {
      invalidateSettlements(queryClient, settlement.rentalId, true)
      invalidateFinanceAll(queryClient, settlement.rentalId)
    },
  })
}

export function useResyncSettlementSources() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (id: string) => api.resyncSettlementSources(id, actor),
    onSuccess: (settlement) => {
      invalidateSettlements(queryClient, settlement.rentalId)
      invalidateFinanceAll(queryClient, settlement.rentalId)
    },
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
    onSuccess: (settlement) => invalidateFinanceAll(queryClient, settlement.rentalId),
  })
}

export function useApproveSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.approveSettlement(id, note, actor),
    onSuccess: (settlement) => invalidateFinanceAll(queryClient, settlement.rentalId),
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
    onSuccess: (settlement) => invalidateFinanceAll(queryClient, settlement.rentalId),
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
    onSuccess: (psc) => invalidateFinanceAll(queryClient, psc.rentalId),
  })
}

export function useAdjustSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ settlementId, input }: { settlementId: string; input: AdjustSettlementInput }) => api.adjustSettlement(settlementId, input, actor),
    onSuccess: (psc) => invalidateFinanceAll(queryClient, psc.rentalId),
  })
}

export function useReverseSettlement() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ settlementId, input }: { settlementId: string; input: ReverseSettlementInput }) => api.reverseSettlement(settlementId, input, actor),
    onSuccess: (settlement) => {
      invalidateSettlements(queryClient, settlement.rentalId, true)
      invalidateFinanceAll(queryClient, settlement.rentalId)
    },
  })
}

// ==== Payment (PM) — PAYMENT-PLAN.md §9.2, Round 1 ====

function invalidatePayment(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['finance', 'payment'] })
  // KPI "Thực thu" đọc `useCashEntries` (analytics) — lập lịch, biên lai, quỹ cũng phải làm mới góc nhìn thực thu.
  queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })
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
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useConfirmTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmTransactionInput }) => api.confirmTransaction(id, input, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useFailTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.failTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useVoidTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.voidTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useReverseTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reverseTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CreateAdjustmentInput) => api.createAdjustment(input, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

// Round 2 — PAYMENT-PLAN.md §10.10.
export function useCreateRefundTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ requestId, input }: { requestId: string; input: CreateRefundTransactionInput }) => api.createRefundTransaction(requestId, input, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
  })
}

export function useDecideRefundApproval() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: DecideRefundApprovalInput }) => api.decideRefundApproval(transactionId, input, actor),
    onSuccess: (txn) => invalidateFinanceAll(queryClient, txn.rentalId),
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

// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §6.2 ====

export function useRevenueLines(filter?: RevenueLineFilter) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'revenueLines', filter ?? {}],
    queryFn: () => api.listRevenueLines(filter),
  })
}

export function useCostRecords(filter?: CostRecordFilter) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'costRecords', filter ?? {}],
    queryFn: () => api.listCostRecords(filter),
  })
}

export function useCostEntries(filter?: CostEntryFilter) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'costEntries', filter ?? {}],
    queryFn: () => api.listCostEntries(filter),
  })
}

export function useCashEntries(filter?: CashEntryFilter) {
  return useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'cashEntries', filter ?? {}],
    queryFn: () => api.listCashEntries(filter),
  })
}

export function useCreateCostRecord() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CostRecordInput) => api.createCostRecord(input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY }),
  })
}

export function useUpdateCostRecord() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CostRecordInput }) => api.updateCostRecord(id, input, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY }),
  })
}

export function useReverseCostRecord() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reverseCostRecord(id, reason, actor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY }),
  })
}

/** Ghi audit `REPORT_EXPORT` — không đổi dữ liệu phân tích nên không invalidate query nào. */
export function useRecordReportExport() {
  const actor = useActor()
  return useMutation({
    mutationFn: (input: RecordReportExportInput) => api.recordReportExport(input, actor),
  })
}
