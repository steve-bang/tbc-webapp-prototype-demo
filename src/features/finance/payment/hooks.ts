// Payment (PM) — hook TanStack Query. Tách từ `finance/hooks.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.3.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CONSIGNMENT_QUERY_KEY } from '@/features/consignment'
import * as api from './api'
import { invalidateFinanceAll, invalidatePayment, useActor } from '../core/hooks.ts'
import type {
  CashDrawerSubmissionFilter,
  ConfirmTransactionInput,
  CreateAdjustmentInput,
  CreateOwnerPayoutInput,
  CreateRefundTransactionInput,
  DecideRefundApprovalInput,
  PaymentRequestFilter,
  RecordTransactionInput,
  SubmitCashDrawerInput,
  TransactionFilter,
} from './api.ts'

/**
 * Giao dịch chi trả chủ xe đổi trạng thái khoản chi trả (Owner Payout Record) và chi phí / thực chi của xe ký gửi →
 * ngoài namespace `finance` còn phải làm mới `['consignment']` (lịch chi trả, công nợ chủ xe).
 */
function invalidateAfterTransaction(queryClient: ReturnType<typeof useQueryClient>, txn: { type: string; rentalId?: string }) {
  invalidateFinanceAll(queryClient, txn.rentalId)
  if (txn.type === 'OWNER_PAYOUT') queryClient.invalidateQueries({ queryKey: CONSIGNMENT_QUERY_KEY })
}

// ==== Payment (PM) — PAYMENT-PLAN.md §9.2, Round 1 ====

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
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useConfirmTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConfirmTransactionInput }) => api.confirmTransaction(id, input, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useFailTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.failTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useVoidTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.voidTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useReverseTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.reverseTransaction(id, reason, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: (input: CreateAdjustmentInput) => api.createAdjustment(input, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

// Round 2 — PAYMENT-PLAN.md §10.10.
export function useCreateRefundTransaction() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ requestId, input }: { requestId: string; input: CreateRefundTransactionInput }) => api.createRefundTransaction(requestId, input, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}

export function useDecideRefundApproval() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: DecideRefundApprovalInput }) => api.decideRefundApproval(transactionId, input, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
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

// Chi trả chủ xe ký gửi (UC-VC-09).
export function useCreateOwnerPayout() {
  const queryClient = useQueryClient()
  const actor = useActor()
  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: CreateOwnerPayoutInput }) => api.createOwnerPayout(recordId, input, actor),
    onSuccess: (txn) => invalidateAfterTransaction(queryClient, txn),
  })
}
