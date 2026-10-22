// Revenue & Cost (RV) — hook TanStack Query. Tách từ `finance/hooks.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.3.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { ANALYTICS_QUERY_KEY, useActor } from '../core/hooks.ts'
import type {
  CashEntryFilter,
  CostEntryFilter,
  CostRecordFilter,
  CostRecordInput,
  RecordReportExportInput,
  RevenueLineFilter,
} from './api.ts'

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
