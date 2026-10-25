import { z } from 'zod'
import type { Rental } from '@/features/rentals'
import { TURNAROUND_BUFFER_MINUTES } from '@/features/rentals'
import type { AssignmentRole, RentalStatus } from '@/shared/domain/enums'
import {
  addDaysToKey,
  addMonthsToKey,
  eachDayKey,
  endOfMonthKey,
  startOfDayIso,
  startOfMonthKey,
  startOfWeekKey,
  toDateKey,
  zonedDateTimeToIso,
} from '@/shared/lib/datetime'

// CALENDAR-ROUND3-PLAN.md §4 (C1) — entity Vehicle Block + luật chồng khoảng đã chuyển sang file lá `blockRules.ts`; re-export để chỗ dùng cũ không đổi.
import { blockEndBound, type VehicleBlock } from './blockRules'
export type { VehicleBlock } from './blockRules'
export { isVehicleBlockedForPeriod } from './blockRules'

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
  // N8 — ngày +07 (trước đây cắt chuỗi UTC: mốc 00:00–06:59 +07 bị tính vào hôm trước)
  const periodStart = toDateKey(startDate)
  const periodEnd = toDateKey(endDate || '9999-12-31')
  return rentals.filter((r) => {
    if (r.vehicleId !== vehicleId || !isOccupyingLikeStatus(r.status)) return false
    const rentalStart = toDateKey(r.pickupDateTime)
    const rentalEnd = toDateKey(r.expectedReturnDateTime)
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
  // N8 — ngày +07 (trước đây cắt chuỗi UTC: mốc 00:00–06:59 +07 bị tính vào hôm trước)
  const periodStart = toDateKey(startDate)
  const periodEnd = toDateKey(endDate)
  const map = new Map<string, Rental[]>()
  for (const r of rentals) {
    const rentalStart = toDateKey(r.pickupDateTime)
    const rentalEnd = toDateKey(r.expectedReturnDateTime)
    if (rentalEnd < periodStart || rentalStart > periodEnd) continue
    const list = map.get(r.vehicleId) ?? []
    list.push(r)
    map.set(r.vehicleId, list)
  }
  return map
}

// ---- Lưới ngày (SA-BR-14 — mọi khoá ngày theo +07, không phụ thuộc giờ trình duyệt) ----

/** Chế độ xem Lịch — `RentalCalendar-BRD.md` §8 (Day · Week · Month · Agenda), mặc định `week` (`RC-BR-16`). */
export type CalendarView = 'day' | 'week' | 'month' | 'agenda'

/** 7 date key của tuần chứa `anchorKey`, bắt đầu thứ Hai (RC-BR-16: Week là view mặc định). */
export function weekDayKeys(anchorKey: string): string[] {
  const start = startOfWeekKey(anchorKey, 1)
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i))
}

/**
 * Các cột ngày của lưới Tháng (xe × ngày): mọi ngày từ mùng 1 đến cuối tháng — lưới Tháng chỉ vẽ các ngày
 * của chính tháng đó (không có ngày đệm đầu/cuối như lịch dạng tờ), đúng số cột đã hiển thị trước R3b.
 */
export function monthGridKeys(monthKey: string): string[] {
  const first = startOfMonthKey(`${monthKey}-01`)
  return eachDayKey(first, endOfMonthKey(first))
}

/**
 * Chuyển kỳ: Ngày ± 1 ngày; Tuần và Agenda ± 7 ngày (Agenda dùng cùng phạm vi tuần với Week);
 * Tháng ± `step` tháng (kẹp ngày về cuối tháng đích, 31/01 + 1 tháng = 28|29/02).
 */
export function shiftAnchor(anchorKey: string, view: CalendarView, step: number): string {
  switch (view) {
    case 'day':
      return addDaysToKey(anchorKey, step)
    case 'week':
    case 'agenda':
      return addDaysToKey(anchorKey, 7 * step)
    case 'month':
      return addMonthsToKey(anchorKey, step)
  }
}

/** Phạm vi ngày (hai đầu gồm cả) của chế độ xem: Ngày = 1 ngày; Tuần/Agenda = `weekDayKeys`; Tháng = cả tháng. */
export function viewRange(anchorKey: string, view: CalendarView): { fromKey: string; toKey: string } {
  switch (view) {
    case 'day':
      return { fromKey: anchorKey, toKey: anchorKey }
    case 'week':
    case 'agenda': {
      const keys = weekDayKeys(anchorKey)
      return { fromKey: keys[0], toKey: keys[6] }
    }
    case 'month':
      return { fromKey: startOfMonthKey(anchorKey), toKey: endOfMonthKey(anchorKey) }
  }
}

// ---- Chế độ Ngày / Agenda (CALENDAR-ROUND3-PLAN.md §13) ----

/**
 * Khung giờ làm việc tô nổi ở chế độ Ngày (giờ +07, `start` gồm, `end` là mốc kết thúc).
 * TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G7) — RC §25 ví dụ 07:00–20:00, chưa cấu hình.
 */
export const WORKING_HOURS = { start: 7, end: 20 } as const

/** Mốc giao/nhận chuẩn 21:00 (CR-2026-005, RM §51) — vạch dọc ở chế độ Ngày. */
export const STANDARD_HANDOVER_HOUR = 21

const DAY_MINUTES = 24 * 60
const MIN_ITEM_WIDTH_PCT = 1

export interface DayTimelineRentalItem {
  rentalId: string
  leftPct: number
  widthPct: number
  /** Lượt bắt đầu trước 00:00 của ngày đang xem. */
  continuesBefore: boolean
  /** Lượt kết thúc sau 24:00 của ngày đang xem. */
  continuesAfter: boolean
}

export interface DayTimelineBufferItem {
  rentalId: string
  leftPct: number
  widthPct: number
}

export interface DayTimelineRow {
  vehicleId: string
  rentals: DayTimelineRentalItem[]
  /** Vùng đệm 90' sau giờ trả dự kiến (RC-BR-13). */
  buffers: DayTimelineBufferItem[]
  /** Vehicle Block `ACTIVE` phủ ngày này (cả ngày) — `undefined` nếu không có. */
  blockId?: string
}

/** Cắt [startMs, endMs] theo 00:00–24:00 (+07) của ngày → % trên trục; null nếu không chồng ngày. */
function clipToDayPct(startMs: number, endMs: number, dayStartMs: number): { leftPct: number; widthPct: number } | null {
  const dayEndMs = dayStartMs + DAY_MINUTES * 60_000
  if (endMs <= dayStartMs || startMs >= dayEndMs) return null
  const clippedStart = Math.max(startMs, dayStartMs)
  const clippedEnd = Math.min(endMs, dayEndMs)
  const leftPct = ((clippedStart - dayStartMs) / (dayEndMs - dayStartMs)) * 100
  const rawWidth = ((clippedEnd - clippedStart) / (dayEndMs - dayStartMs)) * 100
  const widthPct = Math.min(Math.max(rawWidth, MIN_ITEM_WIDTH_PCT), 100 - leftPct)
  return { leftPct, widthPct }
}

/**
 * Bố cục lưới Ngày: mỗi xe (theo thứ tự `vehicles`) một hàng, trục ngang 00:00–24:00 (+07) của `dateKey`.
 * Lượt thuê cắt theo ngày; vùng đệm 90' chỉ cho lượt đang chiếm xe (như Week); khoá xe `ACTIVE` phủ ngày.
 */
export function dayTimelineLayout(
  dateKey: string,
  rentals: Rental[],
  blocks: VehicleBlock[],
  vehicles: { id: string }[],
): DayTimelineRow[] {
  const dayStartMs = Date.parse(startOfDayIso(dateKey))
  const dayEndMs = dayStartMs + DAY_MINUTES * 60_000
  const byVehicle = rentalsByVehicleInRange(rentals, dateKey, dateKey)
  return vehicles.map((v) => {
    const list = (byVehicle.get(v.id) ?? []).slice().sort((a, b) => a.pickupDateTime.localeCompare(b.pickupDateTime))
    const rentalItems: DayTimelineRentalItem[] = []
    const bufferItems: DayTimelineBufferItem[] = []
    for (const r of list) {
      const startMs = Date.parse(r.pickupDateTime)
      const endMs = Date.parse(r.expectedReturnDateTime)
      const pos = clipToDayPct(startMs, endMs, dayStartMs)
      if (pos) {
        rentalItems.push({ rentalId: r.id, ...pos, continuesBefore: startMs < dayStartMs, continuesAfter: endMs > dayEndMs })
      }
      if (isOccupyingLikeStatus(r.status)) {
        const win = turnaroundBufferWindow(r.expectedReturnDateTime)
        const bufPos = clipToDayPct(Date.parse(win.start), Date.parse(win.end), dayStartMs)
        if (bufPos) bufferItems.push({ rentalId: r.id, ...bufPos })
      }
    }
    const block = blocks.find(
      (b) => b.vehicleId === v.id && b.status === 'ACTIVE' && b.startDate <= dateKey && dateKey <= blockEndBound(b),
    )
    return { vehicleId: v.id, rentals: rentalItems, buffers: bufferItems, blockId: block?.id }
  })
}

export interface AgendaGroup {
  dateKey: string
  /** `continuing`: bắt đầu trước phạm vi nhưng còn chạy trong phạm vi. */
  rentals: { rental: Rental; continuing: boolean }[]
}

/**
 * Nhóm lượt theo ngày giao cho Agenda. Lượt bắt đầu trước `fromKey` nhưng còn chạy tới `fromKey` trở đi
 * xếp vào ngày đầu phạm vi (`continuing: true`). Cùng tập lượt với `rentalsByVehicleInRange`. Nhóm trống bị bỏ; sắp theo giờ giao.
 */
export function agendaGroups(rentals: Rental[], fromKey: string, toKey: string): AgendaGroup[] {
  const map = new Map<string, AgendaGroup['rentals']>()
  for (const r of rentals) {
    const pickupKey = toDateKey(r.pickupDateTime)
    const returnKey = toDateKey(r.expectedReturnDateTime)
    let groupKey: string
    let continuing = false
    if (pickupKey >= fromKey && pickupKey <= toKey) {
      groupKey = pickupKey
    } else if (pickupKey < fromKey && returnKey >= fromKey) {
      groupKey = fromKey
      continuing = true
    } else {
      continue
    }
    const list = map.get(groupKey) ?? []
    list.push({ rental: r, continuing })
    map.set(groupKey, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, list]) => ({
      dateKey,
      rentals: list.sort(
        (a, b) => a.rental.pickupDateTime.localeCompare(b.rental.pickupDateTime) || a.rental.id.localeCompare(b.rental.id),
      ),
    }))
}

/**
 * Vị trí nhấp trên trục Ngày (0–1) → ISO, làm tròn 30' (+07). Dùng tạo nhanh khi nhấp ô trống (RC §13).
 * Kẹp trong [0, 1]; 1 = 00:00 ngày kế tiếp.
 */
export function timeFromDayPosition(dateKey: string, pct: number): string {
  const clamped = Math.min(Math.max(pct, 0), 1)
  const minutes = Math.round((clamped * DAY_MINUTES) / 30) * 30
  return zonedDateTimeToIso(dateKey, 0, minutes)
}

export interface DispatchDayRow {
  key: string
  rental: Rental
  role: AssignmentRole
  time: string
}

/**
 * Danh sách giao/nhận của một ngày lịch +07 (Bảng điều phối, "hôm nay" = `todayKey()`), sắp theo giờ.
 * Bỏ lượt `CANCELLED`/`NO_SHOW`.
 */
export function dispatchRowsForDay(rentals: Rental[], dayKey: string): DispatchDayRow[] {
  const rows: DispatchDayRow[] = []
  for (const r of rentals) {
    if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') continue
    // N8 — so ngày +07 (trước đây cắt chuỗi UTC: giao 06:00 +07 = 23:00Z hôm trước bị bỏ khỏi "hôm nay")
    if (toDateKey(r.pickupDateTime) === dayKey) {
      rows.push({ key: `${r.id}-DELIVERY`, rental: r, role: 'DELIVERY', time: r.pickupDateTime })
    }
    if (toDateKey(r.expectedReturnDateTime) === dayKey) {
      rows.push({ key: `${r.id}-RECEIVING`, rental: r, role: 'RECEIVING', time: r.expectedReturnDateTime })
    }
  }
  return rows.sort((a, b) => a.time.localeCompare(b.time))
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
