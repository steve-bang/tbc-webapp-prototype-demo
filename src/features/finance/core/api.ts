// Truy vấn đọc Settlement/PSC dùng chung RS + PM (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.2.
import type { PostSettlementChargeStatus, SettlementStatus } from '@/shared/domain/enums'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { readAllPsc, readAllSettlements as readAll } from './storage.ts'
import type { PostSettlementCharge, Settlement } from './types.ts'

export interface SettlementFilter {
  status?: SettlementStatus
  rentalId?: string
}

function matches(settlement: Settlement, filter?: SettlementFilter): boolean {
  if (!filter) return true
  if (filter.status && settlement.status !== filter.status) return false
  if (filter.rentalId && settlement.rentalId !== filter.rentalId) return false
  return true
}

export async function listSettlements(filter?: SettlementFilter): Promise<Settlement[]> {
  return fakeRequest(() => readAll().filter((s) => matches(s, filter)))
}

export async function getSettlementByRentalId(rentalId: string): Promise<Settlement | undefined> {
  return fakeRequest(() => readAll().find((s) => s.rentalId === rentalId))
}

export interface PostSettlementChargeFilter {
  settlementId?: string
  rentalId?: string
  status?: PostSettlementChargeStatus
}

export async function listPostSettlementCharges(filter?: PostSettlementChargeFilter): Promise<PostSettlementCharge[]> {
  return fakeRequest(() =>
    readAllPsc().filter((p) => {
      if (filter?.settlementId && p.settlementId !== filter.settlementId) return false
      if (filter?.rentalId && p.rentalId !== filter.rentalId) return false
      if (filter?.status && p.status !== filter.status) return false
      return true
    }),
  )
}
