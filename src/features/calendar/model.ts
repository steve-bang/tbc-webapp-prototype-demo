import { z } from 'zod'
import type { Rental } from '@/features/rentals'
import { TURNAROUND_BUFFER_MINUTES } from '@/features/rentals'
import type { RentalStatus, VehicleBlockStatus } from '@/shared/domain/enums'

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

/**
 * "Rental CONFIRMED trở lên" theo RM-BR-30 §57 — ý nghĩa giống `OCCUPYING_STATUSES`
 * nội bộ của `features/rentals/model.ts` (không export qua barrel — chỉ export
 * đúng 5 mục theo `docs/CALENDAR-MANAGEMENT-PLAN.md` §9), khai lại ở đây vì
 * `calendar` chỉ cần đúng danh sách này cho mục đích hiển thị/cảnh báo, không
 * cần toàn bộ logic chống trùng lịch của `rentals`.
 */
const OCCUPYING_LIKE_STATUSES: RentalStatus[] = [
  'CONFIRMED',
  'CONTRACT_CREATED',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'IN_RENTAL',
]

export function isOccupyingLikeStatus(status: RentalStatus): boolean {
  return OCCUPYING_LIKE_STATUSES.includes(status)
}

/** So sánh chuỗi `YYYY-MM-DD` — coi block không có `endDate` là khoá vô thời hạn. */
function blockEndBound(block: Pick<VehicleBlock, 'endDate'>): string {
  return block.endDate ?? '9999-12-31'
}

/**
 * RM-BR-30/RC-BR-15 — true nếu `vehicleId` bị khoá (status `ACTIVE`) chồng lấp
 * khoảng [`startDate`, `endDate`] (so sánh dạng chuỗi ngày, không giờ).
 */
export function isVehicleBlockedForPeriod(
  blocks: VehicleBlock[],
  vehicleId: string,
  startDate: string,
  endDate: string,
): boolean {
  const periodStart = startDate.slice(0, 10)
  const periodEnd = endDate.slice(0, 10)
  return blocks.some((b) => {
    if (b.vehicleId !== vehicleId || b.status !== 'ACTIVE') return false
    return periodStart <= blockEndBound(b) && b.startDate <= periodEnd
  })
}

/**
 * RM-BR-30 §57 — liệt kê Rental `CONFIRMED` trở lên bị ảnh hưởng khi tạo 1
 * Vehicle Block mới — CHỈ để hiển thị cảnh báo, không tự xử lý (đổi xe/huỷ
 * ngoài phạm vi Round 2, thuộc RM-BR-27/28 chưa build).
 */
export function findRentalsAffectedByBlock(
  rentals: Rental[],
  vehicleId: string,
  startDate: string,
  endDate: string,
): Rental[] {
  const periodStart = startDate.slice(0, 10)
  const periodEnd = (endDate || '9999-12-31').slice(0, 10)
  return rentals.filter((r) => {
    if (r.vehicleId !== vehicleId || !isOccupyingLikeStatus(r.status)) return false
    const rentalStart = r.pickupDateTime.slice(0, 10)
    const rentalEnd = r.expectedReturnDateTime.slice(0, 10)
    return rentalStart <= periodEnd && periodStart <= rentalEnd
  })
}

/**
 * RC-BR-13 — vùng buffer hiển thị ngay sau khi 1 lượt thuê kết thúc, dùng
 * `TURNAROUND_BUFFER_MINUTES` (import từ barrel `@/features/rentals`) — chỉ
 * tính hiển thị, không validate/chặn (chưa có kéo-thả ở Round 2).
 */
export function turnaroundBufferWindow(previousExpectedReturnDateTime: string): { start: string; end: string } {
  const start = previousExpectedReturnDateTime
  const end = new Date(new Date(previousExpectedReturnDateTime).getTime() + TURNAROUND_BUFFER_MINUTES * 60_000).toISOString()
  return { start, end }
}

/**
 * Gom Rental theo `vehicleId` cho 1 khoảng ngày (dùng chung cho Week/Month) —
 * thuần sắp xếp theo overlap ngày, KHÔNG tính lại business logic của `rentals`
 * (không đụng conflict/pricing).
 */
export function rentalsByVehicleInRange(rentals: Rental[], startDate: string, endDate: string): Map<string, Rental[]> {
  const periodStart = startDate.slice(0, 10)
  const periodEnd = endDate.slice(0, 10)
  const map = new Map<string, Rental[]>()
  for (const r of rentals) {
    const rentalStart = r.pickupDateTime.slice(0, 10)
    const rentalEnd = r.expectedReturnDateTime.slice(0, 10)
    if (rentalEnd < periodStart || rentalStart > periodEnd) continue
    const list = map.get(r.vehicleId) ?? []
    list.push(r)
    map.set(r.vehicleId, list)
  }
  return map
}

// TODO(OQ: RentalCalendar-BRD.md §6/§9 `RC-BR-07` vs `RentalManagement-BRD.md`
// `RM-BR-02` — §0.2 kế hoạch Round 2. `RM-BR-02` đã hiện thực hoá thành field
// `vehicleId` bắt buộc ngay lúc tạo Rental (Round 1, DONE) nên dưới data model
// hiện tại KHÔNG THỂ tồn tại Rental nào "chưa xếp xe" — khu vực Unscheduled mà
// BRD mô tả không có dữ liệu để hiển thị. Cần CR nếu BA/khách muốn tách luồng
// "đặt trước, chọn xe sau"; KHÔNG tự sửa lại `rentals/model.ts` đã DONE.)

// ---- Form schema — `VehicleBlockFormDialog` (§5.5) ----

export const vehicleBlockFormSchema = z
  .object({
    vehicleId: z.string().trim().min(1, 'Chọn xe'),
    startDate: z.string().trim().min(1, 'Ngày bắt đầu khoá là bắt buộc'),
    endDate: z.string().trim().optional(),
    reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
  })
  .superRefine((data, ctx) => {
    if (data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu',
      })
    }
  })

export type VehicleBlockFormValues = z.infer<typeof vehicleBlockFormSchema>
