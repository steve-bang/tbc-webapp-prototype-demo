export type { Employee, UserAccount } from './model'
// `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §9.3 — khác tiền lệ
// `handover-return`/`contracts` (chỉ export type + Screen): feature này export
// thêm hooks/hàm thuần của `Assignment` qua barrel vì cả `calendar`
// (`DispatchBoardScreen`) và `rentals` (`RentalAssignmentTab`) đều cần tiêu
// thụ, tránh deep-import lặp lại ở 2 nơi.
export type { Assignment } from './model'
export { hasAssignmentConflict, canReassign, canCancelAssignment } from './model'
export { useAssignments, useAssignment, useCreateAssignment, useReassignAssignment, useCancelAssignment } from './hooks'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { ASSIGNMENTS_STORAGE_KEY, EMPLOYEES_STORAGE_KEY } from './api'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { collectAssignmentSignals } from './model'
// CALENDAR-ROUND3-PLAN.md §14.2 (C2) — `rentals/api.ts` dời Planned Window phân công khi dời lịch lượt thuê (EA-BR-14).
export { shiftedAssignmentWindow } from './model'
export { shiftAssignmentWindowsForRental } from './api'
