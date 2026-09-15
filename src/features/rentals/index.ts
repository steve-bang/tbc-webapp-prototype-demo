export type { Rental } from './model'
export { RentalListScreen } from './screens/RentalListScreen'
export { RentalDetailScreen } from './screens/RentalDetailScreen'
// CALENDAR-MANAGEMENT-PLAN.md §9 — export thêm để `features/calendar` tái dùng qua barrel.
export { TURNAROUND_BUFFER_MINUTES, hasConflict } from './model'
export { useRentals } from './hooks'
// RENTAL-MANAGEMENT-PLAN.md §15.4 — mở rộng barrel cho `RentalDetailScreen`.
export { useRental, useConfirmRental, useCancelRental } from './hooks'
export type { RentalFilter } from './api'
// CONTRACT-MANAGEMENT-PLAN.md §0.2/§9.3 — ngoại lệ kiến trúc có chủ đích, chỉ
// `features/contracts` dùng các export này. Kế hoạch §9.3 chỉ liệt kê 2 dòng
// (`canMarkContractCreated` + `useMarkContractCreated`), nhưng `contracts/api.ts`
// `create()` (§9.1 bước 5) gọi `markContractCreated()` trực tiếp trong một hàm
// `api.ts` (không phải component) nên không thể dùng hook — buộc phải export
// thêm hàm async gốc `markContractCreated` từ `api.ts` để có thể gọi được.
export { canMarkContractCreated } from './model'
export { useMarkContractCreated } from './hooks'
export { markContractCreated } from './api'
