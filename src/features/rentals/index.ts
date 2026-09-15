export type { Rental } from './model'
export { RentalListScreen } from './screens/RentalListScreen'
export { RentalDetailScreen } from './screens/RentalDetailScreen'
// CALENDAR-MANAGEMENT-PLAN.md §9 — export thêm để `features/calendar` tái dùng qua barrel.
export { TURNAROUND_BUFFER_MINUTES, hasConflict } from './model'
export { useRentals } from './hooks'
// RENTAL-MANAGEMENT-PLAN.md §15.4 — mở rộng barrel cho `RentalDetailScreen`.
export { useRental, useConfirmRental, useCancelRental } from './hooks'
export type { RentalFilter } from './api'
