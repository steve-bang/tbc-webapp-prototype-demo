import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { isVehicleBlockedForPeriod, type VehicleBlock } from '../model'

export interface QuickCreateRequest {
  vehicleId: string
  /** `datetime-local` (`YYYY-MM-DDTHH:mm`) — điền sẵn cho `RentalFormSheet`. */
  pickupDateTime: string
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.4/§8 — cổng kiểm tra trước khi mở
 * `RentalFormSheet` từ ô trống trên lịch (UC-RC-05). Không phải component có
 * JSX — đặt cùng `components/` theo đúng vị trí kế hoạch chỉ định, vì đây là
 * logic tương tác UI riêng của `calendar` (khác `hooks.ts` vốn chỉ bọc
 * TanStack Query, xem `CONVENTIONS.md` §3).
 *
 * RC-BR-15 — "xe bị khoá không nhận lượt thuê mới": nếu `vehicleId` đang có
 * Vehicle Block `ACTIVE` chồng lấp ngày trong `request.pickupDateTime`, chặn
 * mở form + tự hiện toast lý do khoá, trả về `false`. Ngược lại trả về `true`
 * để component gọi mở `RentalFormSheet` với `defaultValues` tương ứng.
 */
export function canOpenRentalQuickCreate(blocks: VehicleBlock[], request: QuickCreateRequest): boolean {
  const dateOnly = request.pickupDateTime.slice(0, 10)
  if (!isVehicleBlockedForPeriod(blocks, request.vehicleId, dateOnly, dateOnly)) return true
  const activeBlock = blocks.find((b) => b.vehicleId === request.vehicleId && b.status === 'ACTIVE')
  toast.error(`${vi.calendar.vehicleBlockedNotice}${activeBlock ? `: ${activeBlock.reason}` : ''}`)
  return false
}
