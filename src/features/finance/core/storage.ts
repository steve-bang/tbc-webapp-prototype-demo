// Storage key + hàm đọc/ghi của RS + PM (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.2.
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import { readJson, writeJson } from '@/shared/lib/storage'
import type { CashDrawerSubmission, PaymentRequest, PostSettlementCharge, Settlement, Transaction } from './types.ts'

export const SETTLEMENTS_STORAGE_KEY = 'settlements'
export const POST_SETTLEMENT_CHARGES_STORAGE_KEY = 'postSettlementCharges'

export const PAYMENT_REQUESTS_STORAGE_KEY = 'paymentRequests'
export const TRANSACTIONS_STORAGE_KEY = 'transactions'
export const CASH_DRAWER_SUBMISSIONS_STORAGE_KEY = 'cashDrawerSubmissions'

export function readAllSettlements(): Settlement[] {
  return readJson<Settlement[]>(SETTLEMENTS_STORAGE_KEY) ?? []
}
export function writeAllSettlements(items: Settlement[]): void {
  writeJson(SETTLEMENTS_STORAGE_KEY, items)
}

/** `RENTALS_STORAGE_KEY` export qua barrel `@/features/rentals` (§0.2/§3.5 kế hoạch) — đọc trực tiếp, không deep-import `rentals/api.ts`. */
export function readRentalOrThrow(rentalId: string): Rental {
  const rental = (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []).find((r) => r.id === rentalId)
  if (!rental) throw new Error('Không tìm thấy lượt thuê')
  return rental
}

export function readAllPsc(): PostSettlementCharge[] {
  return readJson<PostSettlementCharge[]>(POST_SETTLEMENT_CHARGES_STORAGE_KEY) ?? []
}
export function writeAllPsc(items: PostSettlementCharge[]): void {
  writeJson(POST_SETTLEMENT_CHARGES_STORAGE_KEY, items)
}

export function readAllPaymentRequests(): PaymentRequest[] {
  return readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
}
export function writeAllPaymentRequests(items: PaymentRequest[]): void {
  writeJson(PAYMENT_REQUESTS_STORAGE_KEY, items)
}
export function readAllTransactions(): Transaction[] {
  return readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []
}
export function writeAllTransactions(items: Transaction[]): void {
  writeJson(TRANSACTIONS_STORAGE_KEY, items)
}
export function readAllCashDrawerSubmissions(): CashDrawerSubmission[] {
  return readJson<CashDrawerSubmission[]>(CASH_DRAWER_SUBMISSIONS_STORAGE_KEY) ?? []
}
export function writeAllCashDrawerSubmissions(items: CashDrawerSubmission[]): void {
  writeJson(CASH_DRAWER_SUBMISSIONS_STORAGE_KEY, items)
}
