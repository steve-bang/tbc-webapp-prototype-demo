// Hằng + hàm ngày dùng chung của các bước seed finance (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.4.

import { addDaysToKey, todayKey, zonedDateTimeToIso } from '@/shared/lib/datetime'

/** Mirror `dt()` của `incidents/seed.ts`/`handover-return/seed.ts` — tính ngày động từ hôm nay. */
export function dt(daysOffset: number, hour: number, minute = 0): string {
  return zonedDateTimeToIso(addDaysToKey(todayKey(), daysOffset), hour, minute)
}

export const ACCOUNTANT = 'Lý Thị Kế Toán' // mirror vai trò ACCOUNTANT dùng ở auth demo
export const MANAGER = 'Trần Thị Quản Lý'

/** `hours` giờ sau một mốc ISO — dùng để đặt `performedAt` của giao dịch tương đối theo `pickupDateTime`/`createdAt` thật của Rental (§8.2 kế hoạch). */
export function hoursAfter(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString()
}

// ==== Payment (PM) — PAYMENT-PLAN.md §8, Round 1 ====
// userId demo thật (`features/auth/model.ts`) — tiền lệ `employees/seed.ts`/`calendar/seed.ts`: hardcode string, không import `features/auth`.
export const PM_ACCOUNTANT_USER_ID = 'usr_accountant'
export const PM_ACCOUNTANT_NAME = 'Đỗ Thị Kế Toán'
export const PM_STAFF_USER_ID = 'usr_staff'
export const PM_STAFF_NAME = 'Hoàng Văn Nhân Viên'
