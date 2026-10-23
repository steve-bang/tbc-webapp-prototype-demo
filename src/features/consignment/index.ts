export type { ConsignmentContract, ConsignmentHandoverRecord, VehicleOwner } from './model'
export { maskAccountNumber } from './model'
export type { OwnerPayoutRecord } from './payoutModel'
export {
  CONSIGNMENT_CONTRACTS_STORAGE_KEY,
  CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY,
  OWNER_PAYOUT_RECORDS_STORAGE_KEY,
  VEHICLE_OWNERS_STORAGE_KEY,
} from './storage'
export { CONSIGNMENT_QUERY_KEY, useConsignmentContracts, useOwnerPayoutRecords, useVehicleOwners } from './hooks'

// ---- Chỉ `features/finance` dùng (chi trả chủ xe — xem docs/CONSIGNMENT-PLAN.md mục 19.5) ----
export {
  linkOwnerPayoutRecord,
  markOwnerPayoutRecordPaid,
  revertOwnerPayoutRecordPaid,
  unlinkOwnerPayoutRecord,
} from './payoutApi'
export {
  applyOwnerPayoutLinked,
  applyOwnerPayoutPaid,
  applyOwnerPayoutReverted,
  buildExpectedPayouts,
  getOwnerPayoutBlocker,
  isPayoutDueSoon,
  isPayoutOverdue,
  summarizeOwnerPayables,
} from './payoutModel'
export type { OwnerPayableSummary } from './payoutModel'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { collectConsignmentSignals } from './payoutModel'
