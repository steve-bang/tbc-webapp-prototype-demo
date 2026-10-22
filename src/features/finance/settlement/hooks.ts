// Rental Settlement (RS) — hook TanStack Query. Tách từ `finance/hooks.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.3.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SettlementRequestType } from '@/shared/domain/enums'
import * as api from './api'
import { invalidateFinanceAll, invalidateSettlements, useActor } from '../core/hooks.ts'
import type {
  AdjustSettlementInput,
  ConfirmLineInput,
  CreatePostSettlementChargeInput,
  CustomerAckInput,
  ManualLineInput,
  ResolveDisputeInput,
  ReverseSettlementInput,
  WaiverInput,
} from './api.ts'

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
