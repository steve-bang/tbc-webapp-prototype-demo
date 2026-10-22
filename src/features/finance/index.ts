export type { Settlement } from './core/types'
export { SettlementListScreen } from './settlement/screens/SettlementListScreen'
export { SettlementWorksheet } from './settlement/components/SettlementWorksheet'
export { useSettlements } from './core/hooks'
// Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.8) — để Phase 4.2 (`Payment`) nối vào sau.
export type { PostSettlementCharge } from './core/types'
export { usePostSettlementCharges } from './core/hooks'
// PAYMENT-PLAN.md §9.3 — Round 1.
export { TransactionLedgerScreen } from './payment/screens/TransactionLedgerScreen'
export { CashDrawerScreen } from './payment/screens/CashDrawerScreen'
export { RentalPaymentTab } from './payment/components/RentalPaymentTab'
export type { Transaction, PaymentRequest } from './core/types'
// PAYMENT-PLAN.md §10.8 — Round 2.
export { CustomerReceivablesScreen } from './payment/screens/CustomerReceivablesScreen'
// REVENUE-COST-PLAN.md §6.3 — Round 1: màn Chi phí vận hành + 3 tab xe (dùng ở `vehicles/VehicleDetailScreen`).
export { CostRecordsScreen } from './revenue-cost/screens/CostRecordsScreen'
export { VehicleRevenueTab } from './revenue-cost/components/VehicleRevenueTab'
export { VehicleCostTab } from './revenue-cost/components/VehicleCostTab'
export { VehicleProfitTab } from './revenue-cost/components/VehicleProfitTab'
export type { CostRecord } from './revenue-cost/model'
// REVENUE-COST-PLAN.md §19 — Round 2: màn Báo cáo tài chính.
// Round 3 (§20.4 nợ d): export bản lazy (`revenue-cost/screens/lazyScreens.ts`) — KHÔNG export tĩnh `FinanceReportScreen.tsx` để `recharts` ra khỏi chunk chính.
export { FinanceReportScreen } from './revenue-cost/screens/lazyScreens'
