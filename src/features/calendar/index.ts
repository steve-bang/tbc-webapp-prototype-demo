export type { VehicleBlock } from './model'
export { CalendarScreen } from './screens/CalendarScreen'
// `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §9.4.
export { DispatchBoardScreen } from './screens/DispatchBoardScreen'
// REVENUE-COST-PLAN.md §0.2 — re-export read-only cho features/finance (trừ ngày khoá lịch khi tính Utilization).
export { useVehicleBlocks } from './hooks'
