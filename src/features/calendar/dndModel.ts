import type { Rental } from '@/features/rentals'
import { addDaysToKey, startOfDayIso, toDateKey, zonedDateTimeToIso, zonedParts } from '@/shared/lib/datetime'

/**
 * `docs/CALENDAR-ROUND3-PLAN.md` §15.2 mục 1 — hàm THUẦN quy đổi vị trí thả (kéo–thả Lịch, Round B2) thành đề xuất
 * dời lịch / đổi xe. KHÔNG có luật nghiệp vụ (mọi điều kiện nằm ở `evaluateScheduleChange`) và KHÔNG gọi API ghi:
 * đề xuất chỉ để mở `RentalScheduleChangeDialog` (B1). RC §13, §15, EX-01, `AC-RC-004…007`.
 *
 * Chỉ `calendar/components/*` và `calendar/screens/CalendarScreen.tsx` được import file này — KHÔNG export qua
 * `calendar/index.ts` để nằm ngoài tải đầu (§15.1). Không import `@dnd-kit` ở đây (harness chạy được không cần trình duyệt).
 */

/** Bước làm tròn khi kéo theo giờ (Day) — 30 phút (§15.2). */
export const DND_STEP_MINUTES = 30
const STEP_MS = DND_STEP_MINUTES * 60_000
const MINUTES_PER_DAY = 24 * 60

/** Đề xuất sau khi thả — ISO `...Z`; cùng hình với `ScheduleChangeInitial` của hộp thoại B1. */
export interface DndProposal {
  vehicleId: string
  pickupDateTime: string
  expectedReturnDateTime: string
}

/** Bóng mờ (viền nét đứt) vẽ ở vị trí đề xuất trong lúc hộp thoại mở (RC §29 — hiển thị lạc quan). */
export interface DndGhost extends DndProposal {
  rentalId: string
}

export type DragEdge = 'start' | 'end'

// ---- Làm tròn ----

/** Làm tròn số phút về bội 30 (44 → 30, 46 → 60); tránh `-0`. */
export function roundToStep(minutes: number): number {
  const r = Math.round(minutes / DND_STEP_MINUTES) * DND_STEP_MINUTES
  return r === 0 ? 0 : r
}

/** Độ lệch ngang (px) → phút, với toàn bộ hàng 24h = `rowWidthPx`; làm tròn 30'. */
export function minuteDeltaFromPixels(deltaX: number, rowWidthPx: number): number {
  if (!(rowWidthPx > 0)) return 0
  return roundToStep((deltaX / rowWidthPx) * MINUTES_PER_DAY)
}

// ---- Đề xuất ----

/** Dời `iso` đúng `dayDelta` ngày lịch +07, giữ nguyên giờ:phút (và phần giây/ms nếu có). */
function shiftByDays(iso: string, dayDelta: number): string {
  const key = toDateKey(iso)
  const p = zonedParts(iso)
  const residualMs = Date.parse(iso) - Date.parse(zonedDateTimeToIso(key, p.hour, p.minute))
  const shifted = zonedDateTimeToIso(addDaysToKey(key, dayDelta), p.hour, p.minute)
  return new Date(Date.parse(shifted) + residualMs).toISOString()
}

/** Week/Month — dời NGUYÊN NGÀY, giữ giờ:phút +07; đổi hàng = đổi xe (`targetVehicleId`). */
export function proposalFromDayShift(
  rental: Pick<Rental, 'pickupDateTime' | 'expectedReturnDateTime'>,
  dayDelta: number,
  targetVehicleId: string,
): DndProposal {
  return {
    vehicleId: targetVehicleId,
    pickupDateTime: shiftByDays(rental.pickupDateTime, dayDelta),
    expectedReturnDateTime: shiftByDays(rental.expectedReturnDateTime, dayDelta),
  }
}

/**
 * Day — dời theo phút (làm tròn bội 30). Không `edge`: dời cả lượt. `edge = 'start'` chỉ đổi giờ giao, `'end'` chỉ đổi giờ trả;
 * cạnh đầu không vượt quá (cạnh cuối − 30'), cạnh cuối không lùi quá (cạnh đầu + 30').
 */
export function proposalFromTimeShift(
  rental: Pick<Rental, 'pickupDateTime' | 'expectedReturnDateTime'>,
  minuteDelta: number,
  targetVehicleId: string,
  edge?: DragEdge,
): DndProposal {
  const deltaMs = roundToStep(minuteDelta) * 60_000
  const pickupMs = Date.parse(rental.pickupDateTime)
  const returnMs = Date.parse(rental.expectedReturnDateTime)
  let nextPickup = pickupMs
  let nextReturn = returnMs
  if (edge === 'start') {
    nextPickup = Math.min(pickupMs + deltaMs, returnMs - STEP_MS)
  } else if (edge === 'end') {
    nextReturn = Math.max(returnMs + deltaMs, pickupMs + STEP_MS)
  } else {
    nextPickup = pickupMs + deltaMs
    nextReturn = returnMs + deltaMs
  }
  return {
    vehicleId: targetVehicleId,
    pickupDateTime: new Date(nextPickup).toISOString(),
    expectedReturnDateTime: new Date(nextReturn).toISOString(),
  }
}

/** Đổi xe → hộp thoại "Đổi xe"; ngược lại "Dời lịch". */
export function scheduleModeFor(rental: Pick<Rental, 'vehicleId'>, proposal: Pick<DndProposal, 'vehicleId'>): 'changeVehicle' | 'reschedule' {
  return proposal.vehicleId !== rental.vehicleId ? 'changeVehicle' : 'reschedule'
}

/** Thả lại đúng chỗ cũ (cùng xe, cùng giờ giao/trả) → không làm gì. */
export function isNoopProposal(
  rental: Pick<Rental, 'vehicleId' | 'pickupDateTime' | 'expectedReturnDateTime'>,
  proposal: DndProposal,
): boolean {
  return (
    proposal.vehicleId === rental.vehicleId &&
    Date.parse(proposal.pickupDateTime) === Date.parse(rental.pickupDateTime) &&
    Date.parse(proposal.expectedReturnDateTime) === Date.parse(rental.expectedReturnDateTime)
  )
}

// ---- Id kéo / thả ----

export type DragSource =
  | { kind: 'rental'; rentalId: string; dayKey: string }
  | { kind: 'edge'; edge: DragEdge; rentalId: string }

export type DropTarget = { kind: 'cell'; vehicleId: string; dayKey: string } | { kind: 'row'; vehicleId: string }

/** Kéo một mảnh khối lượt thuê: `rental:<rentalId>:<dayKey>` (Day: dayKey = ngày đang xem). */
export const rentalDragId = (rentalId: string, dayKey: string) => `rental:${rentalId}:${dayKey}`
/** Kéo cạnh (Day): `edge:<start|end>:<rentalId>`. */
export const edgeDragId = (edge: DragEdge, rentalId: string) => `edge:${edge}:${rentalId}`
/** Ô thả Week/Month: `cell:<vehicleId>:<dayKey>`. */
export const cellDropId = (vehicleId: string, dayKey: string) => `cell:${vehicleId}:${dayKey}`
/** Hàng thả Day: `row:<vehicleId>`. */
export const rowDropId = (vehicleId: string) => `row:${vehicleId}`

export function parseDragId(id: string | number | null | undefined): DragSource | null {
  if (id === null || id === undefined) return null
  const parts = String(id).split(':')
  if (parts[0] === 'rental' && parts.length === 3 && parts[1] && parts[2]) return { kind: 'rental', rentalId: parts[1], dayKey: parts[2] }
  if (parts[0] === 'edge' && parts.length === 3 && (parts[1] === 'start' || parts[1] === 'end') && parts[2]) {
    return { kind: 'edge', edge: parts[1], rentalId: parts[2] }
  }
  return null
}

export function parseDropId(id: string | number | null | undefined): DropTarget | null {
  if (id === null || id === undefined) return null
  const parts = String(id).split(':')
  if (parts[0] === 'cell' && parts.length === 3 && parts[1] && parts[2]) return { kind: 'cell', vehicleId: parts[1], dayKey: parts[2] }
  if (parts[0] === 'row' && parts.length === 2 && parts[1]) return { kind: 'row', vehicleId: parts[1] }
  return null
}

// ---- Bóng mờ ----

/** Bóng mờ có phủ ngày `dayKey` (+07) của xe `vehicleId`? Dùng cho Week/Month. */
export function ghostCoversDay(ghost: DndGhost | undefined, vehicleId: string, dayKey: string): boolean {
  if (!ghost || ghost.vehicleId !== vehicleId) return false
  return toDateKey(ghost.pickupDateTime) <= dayKey && dayKey <= toDateKey(ghost.expectedReturnDateTime)
}

/** Vị trí ngang (% của 24h) của khoảng [start, end] trong ngày `dayKey` — `null` nếu không chồng lấp. Dùng cho Day. */
export function spanPctInDay(dayKey: string, startIso: string, endIso: string): { leftPct: number; widthPct: number } | null {
  const dayStart = Date.parse(startOfDayIso(dayKey))
  const dayEnd = dayStart + 86_400_000
  const s = Date.parse(startIso)
  const e = Date.parse(endIso)
  if (e <= dayStart || s >= dayEnd) return null
  const from = Math.max(s, dayStart)
  const to = Math.min(e, dayEnd)
  return { leftPct: ((from - dayStart) / 86_400_000) * 100, widthPct: Math.max(((to - from) / 86_400_000) * 100, 0.5) }
}
