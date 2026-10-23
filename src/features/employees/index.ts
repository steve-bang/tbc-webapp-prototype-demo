export type { Employee, UserAccount } from './model'
export { EmployeeListScreen } from './screens/EmployeeListScreen'
// DASHBOARD-PLATFORM-PLAN.md §21.2 mục 12 — bản lazy.
export { EmployeeDetailScreen } from './screens/lazyScreens'

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
