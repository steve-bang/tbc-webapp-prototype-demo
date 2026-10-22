// Hook + helper invalidate dùng chung RS + PM (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.3.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/features/auth'
import * as api from './api'
import type { PostSettlementChargeFilter, SettlementFilter } from './api.ts'
import type { ActorInfo } from './types.ts'

/** REVENUE-COST-PLAN.md §6.2 — key gốc của mọi query phân tích (Revenue/Cost/Cash). */
export const ANALYTICS_QUERY_KEY = ['finance', 'analytics'] as const

/**
 * PAYMENT-PLAN.md §10.10 — F5: Settlement dùng key `['settlements']`, PSC dùng
 * `['postSettlementCharges']`, Payment dùng `['finance','payment']`; Round 2 có
 * ghi chéo ba phía nên mọi mutation Payment VÀ mọi mutation Settlement có ghi
 * chéo sang Payment (OFFSET, huỷ yêu cầu, đóng PSC tự động…) phải invalidate
 * đủ cả ba namespace.
 */
export function invalidateFinanceAll(queryClient: ReturnType<typeof useQueryClient>, rentalId?: string) {
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
export function useActor(): ActorInfo {
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
export function invalidateSettlements(queryClient: ReturnType<typeof useQueryClient>, rentalId?: string, invalidateRental = false) {
  queryClient.invalidateQueries({ queryKey: ['settlements'] })
  // REVENUE-COST-PLAN.md §6.2 — mọi thay đổi Settlement làm đổi Revenue Line suy ra.
  queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })
  if (rentalId) queryClient.invalidateQueries({ queryKey: ['settlements', 'byRental', rentalId] })
  if (invalidateRental && rentalId) {
    queryClient.invalidateQueries({ queryKey: ['rentals'] })
    queryClient.invalidateQueries({ queryKey: ['rentals', 'detail', rentalId] })
  }
}

// ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.8) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán ----

export function usePostSettlementCharges(filter?: PostSettlementChargeFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['postSettlementCharges', filter ?? {}],
    queryFn: () => api.listPostSettlementCharges(filter),
    enabled: options?.enabled,
  })
}

export function invalidatePayment(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['finance', 'payment'] })
  // KPI "Thực thu" đọc `useCashEntries` (analytics) — lập lịch, biên lai, quỹ cũng phải làm mới góc nhìn thực thu.
  queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })
}
