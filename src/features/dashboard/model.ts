import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { toDateKey } from '@/shared/lib/datetime'

export interface OperationalKpis {
  totalVehicles: number
  available: number
  rented: number
  maintenance: number
  inactive: number
  /** Lượt có giờ giao rơi vào hôm nay (ngày +07), kể cả lượt đã giao trong ngày; bỏ `CANCELLED`/`NO_SHOW`. */
  deliveriesToday: number
  /** Lượt có giờ nhận dự kiến rơi vào hôm nay (ngày +07); bỏ `CANCELLED`/`NO_SHOW`. */
  returnsToday: number
  /** Lượt thuê đang diễn ra = `HANDED_OVER` + `IN_RENTAL`. */
  activeRentals: number
}

/**
 * KPI vận hành của Dashboard — `WebappQuanTri.md` §5.3, master BRD §46. Số xe theo `Vehicle Status` (VM); giao/nhận hôm nay
 * theo ngày +07 và cùng quy tắc loại `CANCELLED`/`NO_SHOW` với `DispatchBoardScreen`. Hàm thuần: `now` là tham số.
 */
export function buildOperationalKpis(input: { vehicles: Vehicle[]; rentals: Rental[]; now: Date }): OperationalKpis {
  const { vehicles, rentals, now } = input
  const todayKey = toDateKey(now)
  const live = rentals.filter((r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW')
  return {
    totalVehicles: vehicles.length,
    available: vehicles.filter((v) => v.status === 'AVAILABLE').length,
    rented: vehicles.filter((v) => v.status === 'RENTED').length,
    maintenance: vehicles.filter((v) => v.status === 'MAINTENANCE').length,
    inactive: vehicles.filter((v) => v.status === 'INACTIVE').length,
    deliveriesToday: live.filter((r) => toDateKey(r.pickupDateTime) === todayKey).length,
    returnsToday: live.filter((r) => toDateKey(r.expectedReturnDateTime) === todayKey).length,
    activeRentals: rentals.filter((r) => r.status === 'HANDED_OVER' || r.status === 'IN_RENTAL').length,
  }
}
