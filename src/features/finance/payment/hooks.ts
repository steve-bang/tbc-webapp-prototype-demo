// Payment (PM) — hook TanStack Query. Tách từ `finance/hooks.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.3.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { invalidateFinanceAll, invalidatePayment, useActor } from '../core/hooks.ts'
import type {
  CashDrawerSubmissionFilter,
  ConfirmTransactionInput,
  CreateAdjustmentInput,
  CreateRefundTransactionInput,
  DecideRefundApprovalInput,
  PaymentRequestFilter,
  RecordTransactionInput,
  SubmitCashDrawerInput,
  TransactionFilter,
} from './api.ts'

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
