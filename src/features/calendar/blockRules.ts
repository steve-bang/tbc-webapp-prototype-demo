import type { VehicleBlockStatus } from '@/shared/domain/enums'
import { toDateKey } from '@/shared/lib/datetime'

/**
 * File LÁ (chỉ import `shared/*`) chứa entity Vehicle Block + luật kiểm tra chồng khoảng — CALENDAR-ROUND3-PLAN.md §4 (ngoại lệ C1).
 * Lý do tách: `rentals` phải kiểm khoá xe ở lớp API/hàm thuần (UC-RC-08) nhưng `calendar` đã import `rentals`; đi qua barrel `calendar`
 * sẽ tạo vòng `rentals ↔ calendar`. Tiền lệ: `incidents/storageKeys.ts`. `calendar/model.ts` và `calendar/api.ts` re-export đúng tên cũ.
 * Không import `rentals` hay bất kỳ feature nào ở đây.
 */

/** Khoá lưu Vehicle Block trong `storage.ts`. */
export const VEHICLE_BLOCKS_STORAGE_KEY = 'vehicleBlocks'

/**
 * Vehicle Block — `RentalManagement-BRD.md` §57 (CR-2026-015) + `RentalCalendar-BRD.md`
 * §30 `RC-BR-15/16` (module `RC`, xem `docs/CALENDAR-MANAGEMENT-PLAN.md` §2.1 —
 * mâu thuẫn tài liệu giữa `RentalCalendar-UseCase.md` §24 và BRD §30 đã chốt
 * dùng BRD §30 làm nguồn `RC-BR-xx`). Khoá lịch xe theo khoảng ngày, độc lập
 * với `Vehicle.status` (VM §10a) — tạo/gỡ Block KHÔNG tự đổi trạng thái xe.
 */
export interface VehicleBlock {
  id: string
  vehicleId: string
  /** ISO date (`YYYY-MM-DD`, không giờ). */
  startDate: string
  /**
   * ISO date, optional — để trống = khoá vô thời hạn tới khi gỡ tay.
   * TODO(OQ: CHANGE-REQUESTS.md CR-2026-015 câu 2 — "khoá vô thời hạn hay nhập
   * ngày dự kiến xong" chưa chốt, Round 2 cho phép cả 2, không ép buộc).
   */
  endDate?: string
  /** Nhân viên tự mô tả (VD "tai nạn", "hư nặng") — không phải enum cố định, BRD không liệt kê danh mục. */
  reason: string
  status: VehicleBlockStatus
  createdByUserId: string
  createdByName: string
  createdByRole: string
  releasedByUserId?: string
  releasedByName?: string
  releasedByRole?: string
  releasedAt?: string
  createdAt: string
  updatedAt: string
}

/** So sánh chuỗi `YYYY-MM-DD` — coi block không có `endDate` là khoá vô thời hạn. */
export function blockEndBound(block: Pick<VehicleBlock, 'endDate'>): string {
  return block.endDate ?? '9999-12-31'
}

/**
 * RM-BR-30/RC-BR-15 — các khoá `ACTIVE` của `vehicleId` chồng khoảng [`startIso`, `endIso`]; so sánh theo ngày +07
 * (N8 — mốc 00:00–06:59 +07 thuộc ngày +07 chứ không phải ngày UTC). Nhận ISO hoặc date key.
 */
export function findBlockingBlocks(
  blocks: VehicleBlock[],
  vehicleId: string,
  startIso: string,
  endIso: string,
): VehicleBlock[] {
  const periodStart = toDateKey(startIso)
  const periodEnd = toDateKey(endIso)
  return blocks.filter((b) => {
    if (b.vehicleId !== vehicleId || b.status !== 'ACTIVE') return false
    return periodStart <= blockEndBound(b) && b.startDate <= periodEnd
  })
}

/** RM-BR-30/RC-BR-15 — true nếu `vehicleId` bị khoá (status `ACTIVE`) chồng lấp khoảng [`startDate`, `endDate`]. */
export function isVehicleBlockedForPeriod(
  blocks: VehicleBlock[],
  vehicleId: string,
  startDate: string,
  endDate: string,
): boolean {
  return findBlockingBlocks(blocks, vehicleId, startDate, endDate).length > 0
}
