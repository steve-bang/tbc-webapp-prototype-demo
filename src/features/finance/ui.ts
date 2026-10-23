// Điểm nhập UI của feature (màn hình + component) — TECH-HARDENING-PLAN.md §3.2 (E2). Code không phải UI không import file này.
export { SettlementListScreen } from './settlement/screens/SettlementListScreen'
export { SettlementWorksheet } from './settlement/components/SettlementWorksheet'
// PAYMENT-PLAN.md §9.3 — Round 1.
export { TransactionLedgerScreen } from './payment/screens/TransactionLedgerScreen'
export { CashDrawerScreen } from './payment/screens/CashDrawerScreen'
export { RentalPaymentTab } from './payment/components/RentalPaymentTab'
// PAYMENT-PLAN.md §10.8 — Round 2.
export { CustomerReceivablesScreen } from './payment/screens/CustomerReceivablesScreen'
// REVENUE-COST-PLAN.md §6.3 — Round 1: màn Chi phí vận hành + 3 tab xe (dùng ở `vehicles/VehicleDetailScreen`).
export { CostRecordsScreen } from './revenue-cost/screens/CostRecordsScreen'
export { VehicleRevenueTab } from './revenue-cost/components/VehicleRevenueTab'
export { VehicleCostTab } from './revenue-cost/components/VehicleCostTab'
export { VehicleProfitTab } from './revenue-cost/components/VehicleProfitTab'
// REVENUE-COST-PLAN.md §19 — Round 2: màn Báo cáo tài chính.
// Round 3 (§20.4 nợ d): export bản lazy (`revenue-cost/screens/lazyScreens.ts`) — KHÔNG export tĩnh `FinanceReportScreen.tsx` để `recharts` ra khỏi chunk chính.
export { FinanceReportScreen } from './revenue-cost/screens/lazyScreens'
// docs/CONSIGNMENT-PLAN.md §19.7 — màn Chi trả chủ xe (mount ở /consignment/owner-payouts).
export { OwnerPayoutScreen } from './payment/screens/OwnerPayoutScreen'
// DASHBOARD-PLATFORM-PLAN.md §5.3 — bản lazy (import tĩnh sẽ làm nở SCC), nơi dùng bọc <Suspense>.
export { DashboardFinanceWidget } from './revenue-cost/components/lazyWidgets'
