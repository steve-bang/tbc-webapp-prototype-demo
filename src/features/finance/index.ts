export type { Settlement } from './core/types'
export { useSettlements } from './core/hooks'
// Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.8) — để Phase 4.2 (`Payment`) nối vào sau.
export type { PostSettlementCharge } from './core/types'
export { usePostSettlementCharges } from './core/hooks'
export type { Transaction, PaymentRequest } from './core/types'
export type { CostRecord } from './revenue-cost/model'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { PAYMENT_REQUESTS_STORAGE_KEY, SETTLEMENTS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from './core/storage'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { collectPaymentSignals } from './payment/model'
