import { dateTimeToMs } from '@/shared/lib/datetime'
import { z } from 'zod'
import { paths } from '@/app/paths'
// CALENDAR-ROUND3-PLAN.md §4 (C1) — file lá của `calendar` (chỉ import `shared/*`), không tạo vòng; dùng cho kiểm khoá xe ở hàm thuần dưới đây.
import { findBlockingBlocks, type VehicleBlock } from '@/features/calendar/blockRules'
import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
import { signalDedupeKey, type OperationalSignal } from '@/shared/domain/alerts'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime, zonedParts } from '@/shared/lib/datetime'
import { SECURITY_DEPOSIT_TYPES, type RentalStatus, type SecurityDepositType, type VehicleClass } from '@/shared/domain/enums'

/**
 * Lượt thuê — `RentalManagement-BRD.md` §8-§27 (module `RM`), hub trung tâm
 * Phase 2. `Rental Rate` là input tay của chính entity này (§0.1 kế hoạch —
 * KHÔNG có "Bảng giá"/"Rate Card" nào trong toàn hệ thống, không suy ra từ
 * `Vehicle`). Mọi field giá/cọc/Allowed KM khác là **snapshot** tính một lần
 * lúc tạo (RM-BR-12) — bảng giá/hằng số đổi sau không ảnh hưởng lượt đã tạo.
 */
export interface Rental {
  id: string
  /** `RENTAL_STATUSES` (12 giá trị) — khởi tạo `DRAFT` (CR-2026-043). */
  status: RentalStatus
  /** RM-BR-01. */
  customerId: string
  /** RM-BR-02. */
  vehicleId: string
  /** Rental Period — Start DateTime (ISO). */
  pickupDateTime: string
  /**
   * End DateTime nhập tay khi tạo (ISO); RM-BR-03 `> pickupDateTime`. RM-BR-20
   * (khung 21:00) chính thức áp dụng khi `VehicleHandover` tính lại theo
   * `Actual Pickup DateTime` (Phase 3) — Round 1 chỉ dùng 21:00 làm giá trị
   * gợi ý mặc định cho Return Time trong form, không phải rule chặn cứng.
   */
  expectedReturnDateTime: string
  pickupLocation: string
  returnLocation: string
  /** Để sẵn cho `VehicleHandover` (Phase 3) ghi — Round 1 chỉ đọc, không ghi. */
  actualPickupDateTime?: string
  /** Để sẵn cho `VehicleReturn` (Phase 3) ghi — Round 1 chỉ đọc, không ghi. */
  actualReturnDateTime?: string
  /** Snapshot từ `Vehicle.vehicleClass` tại thời điểm tạo (RM-BR-25) — copy giá trị, không tham chiếu sống. */
  vehicleClass: VehicleClass
  /** Snapshot từ `PRICE_PER_KM_BY_CLASS[vehicleClass]` (CR-2026-008) tại thời điểm tạo. */
  pricePerKm: number
  /** Snapshot = `350 × rentalDurationDays` (RM-BR-24, công thức ngày). */
  allowedKm: number
  /** Input tay — VNĐ/ngày (§0.1). */
  rentalRate: number
  /** Snapshot cùng lúc với giá — tính từ `pickupDateTime`/`expectedReturnDateTime`. */
  rentalDurationDays: number
  /** Snapshot = `rentalRate × rentalDurationDays` (§17). */
  baseAmount: number
  /** §17 — số tiền giảm tự do, không có enum loại discount (chưa chốt Business). */
  discountAmount: number
  discountNote?: string
  /** §19 — tổng 1 field, không breakdown theo loại (Overtime/Extra mileage/... thuộc module chưa build). */
  additionalChargesAmount: number
  additionalChargesNote?: string
  /** Số km ngoài bán kính 10km (RM-BR-26/CR-2026-062) — nhân viên tự đo Google Maps + nhập tay. */
  deliveryDistanceKm?: number
  /** Snapshot = `deliveryDistanceKm > 0 ? deliveryDistanceKm × 15000 : 0`. */
  deliveryFee: number
  /** Snapshot = `baseAmount - discountAmount + additionalChargesAmount + deliveryFee` (§17, mở rộng thêm deliveryFee). */
  estimatedTotal: number
  /**
   * Snapshot = `30% × baseAmount` (RM-BR-18/CR-2026-060) — quy tắc làm tròn
   * chưa chốt. TODO(OQ: BusinessRequirementDocument.md §51 Q37 — quy tắc làm
   * tròn Prepayment 30%), Round 1 giữ nguyên số tính được, không tự làm tròn.
   */
  prepaymentAmount: number
  /** `CASH_20M` | `MOTORBIKE` (RM-BR-17) — nhân viên chọn theo khách nói. */
  securityDepositType: SecurityDepositType
  /** Bắt buộc = 20.000.000 nếu `CASH_20M`; bỏ trống nếu `MOTORBIKE`. */
  securityDepositAmount?: number
  /** Bắt buộc nếu `MOTORBIKE` — mô tả xe máy (đời xe, biển số) + cà vẹt, giá trị ước tính ≥ 15.000.000đ. */
  securityDepositAssetNote?: string
  note?: string
  createdAt: string
  updatedAt: string
}

// ---- Hằng số §2.2 (giá trị số — không đưa lên shared/domain/enums.ts) ----

/** CR-2026-008 — Price Per KM theo Vehicle Class. */
export const PRICE_PER_KM_BY_CLASS: Record<VehicleClass, number> = {
  VIP_LUXURY: 10000,
  STANDARD: 5000,
  TWO_SEATER: 2000,
}

/**
 * CR-2026-008 — Allowed KM/ngày (cộng dồn). Allowed KM/tháng (3.500) chưa
 * dùng ở Round 1 vì ngưỡng số ngày để tính "thuê tháng" chưa chốt.
 * TODO(OQ: BusinessRequirementDocument.md §51 Q53).
 */
export const ALLOWED_KM_PER_DAY = 350

/** CR-2026-006 — Turnaround Buffer tối thiểu giữa 2 lượt thuê liền kề cùng 1 xe. */
export const TURNAROUND_BUFFER_MINUTES = 90

/** CR-2026-060 — tỉ lệ Prepayment trên Base Rental Amount. */
export const PREPAYMENT_RATE = 0.3

/** CR-2026-003 — Security Deposit cố định cho hình thức CASH_20M. */
export const CASH_DEPOSIT_AMOUNT = 20_000_000

/** RM-BR-26 / CR-2026-062 — đơn giá phí ngoài bán kính miễn phí. */
export const DELIVERY_FEE_PER_KM = 15000
export const FREE_DELIVERY_RADIUS_KM = 10

// ---- §3.1 Tính giá & snapshot ----

/**
 * `docs/RENTAL-MANAGEMENT-PLAN.md` §3.1 — làm tròn LÊN khi có phần ngày lẻ
 * (`Math.ceil`, không dùng `daysBetween()` của `shared/lib/datetime.ts` vì hàm
 * đó `Math.round` — làm tròn gần nhất, sai với quy tắc riêng của Rental),
 * tối thiểu 1 ngày.
 */
export function rentalDurationDays(pickupDateTime: string, expectedReturnDateTime: string): number {
  const ms = dateTimeToMs(expectedReturnDateTime) - dateTimeToMs(pickupDateTime)
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * RM-BR-24 — Allowed KM = 350×ngày (cộng dồn). TODO(OQ: BusinessRequirementDocument.md
 * §51 Q53 — nhánh "thuê tháng"), Round 1 LUÔN dùng công thức theo ngày bất kể
 * thời lượng, không tự đặt ngưỡng chuyển sang tháng.
 */
export function calcAllowedKm(days: number): number {
  return days * ALLOWED_KM_PER_DAY
}

/** RM-BR-26/CR-2026-062 — phí giao/nhận ngoài bán kính 10km miễn phí. */
export function calcDeliveryFee(distanceKm: number | undefined): number {
  return !distanceKm || distanceKm <= 0 ? 0 : distanceKm * DELIVERY_FEE_PER_KM
}

/** §17 — Base Amount = Rental Rate × Rental Duration. */
export function calcBaseAmount(rentalRate: number, days: number): number {
  return rentalRate * days
}

/** §17, mở rộng thêm `deliveryFee` (Delivery fee tách field riêng vì có công thức tính riêng theo km). */
export function calcEstimatedTotal(
  baseAmount: number,
  discountAmount: number,
  additionalChargesAmount: number,
  deliveryFee: number,
): number {
  return baseAmount - discountAmount + additionalChargesAmount + deliveryFee
}

/**
 * RM-BR-18/CR-2026-060 — Prepayment = 30% Base Rental, KHÔNG làm tròn.
 * TODO(OQ: BusinessRequirementDocument.md §51 Q37 — quy tắc làm tròn).
 */
export function calcPrepaymentAmount(baseAmount: number): number {
  return baseAmount * PREPAYMENT_RATE
}

// ---- §3.2 Chống trùng lịch + Turnaround Buffer (RM-BR-04, RM-BR-23/RC-BR-13) ----

/**
 * Các trạng thái được coi là "đang chiếm dụng xe" — suy trực tiếp từ ý nghĩa
 * state ở BRD §9: xe bị giữ kể từ khi xác nhận tới khi trả xong (`RETURNED`
 * trở đi coi như xe đã về, không còn chiếm).
 */
const OCCUPYING_STATUSES: RentalStatus[] = [
  'CONFIRMED',
  'CONTRACT_CREATED',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'IN_RENTAL',
]

/**
 * RM-BR-04/RM-BR-23 — true nếu tồn tại rental khác cùng `vehicleId`, status
 * thuộc `OCCUPYING_STATUSES`, và khoảng thời gian cách nhau < Turnaround
 * Buffer 90 phút so với rental đang xét — công thức chuẩn "khoảng cách tối
 * thiểu": `A.start < B.end + buffer && B.start < A.end + buffer`. KHÔNG tính
 * rental đang `DRAFT` của người khác là chiếm dụng (DRAFT = "chưa xác nhận" —
 * CR-2026-043) — chỉ cảnh báo mềm ở bước tạo, CHẶN CỨNG ở bước Confirm.
 */
export function hasConflict(
  existingRentals: Rental[],
  vehicleId: string,
  pickupDateTime: string,
  expectedReturnDateTime: string,
  excludeRentalId?: string,
): boolean {
  const bufferMs = TURNAROUND_BUFFER_MINUTES * 60 * 1000
  // N8 — nhận cả ISO lẫn giá trị datetime-local (hiểu theo +07)
  const aStart = dateTimeToMs(pickupDateTime)
  const aEnd = dateTimeToMs(expectedReturnDateTime)
  return existingRentals.some((r) => {
    if (r.id === excludeRentalId) return false
    if (r.vehicleId !== vehicleId) return false
    if (!OCCUPYING_STATUSES.includes(r.status)) return false
    const bStart = new Date(r.pickupDateTime).getTime()
    const bEnd = new Date(r.expectedReturnDateTime).getTime()
    return aStart < bEnd + bufferMs && bStart < aEnd + bufferMs
  })
}

/** CR-2026-006 — gợi ý giờ giao lượt sau tự dời, dùng khi form Create phát hiện xe vừa có 1 rental khác kết thúc gần đó. */
export function suggestNextPickup(previousExpectedReturnDateTime: string): string {
  return new Date(new Date(previousExpectedReturnDateTime).getTime() + TURNAROUND_BUFFER_MINUTES * 60 * 1000).toISOString()
}

// ---- Dời lịch / đổi xe trước giao — CALENDAR-ROUND3-PLAN.md §3.2 / §14.2 (UC-RC-06, UC-RC-07) ----

/**
 * RC-BR-01 — chỉ lượt CHƯA giao mới dời lịch / đổi xe được (từ `HANDED_OVER` trở đi: đổi xe giữa kỳ là Round C, không kéo-thả).
 * TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q1 / RentalCalendar-BRD.md §35 Q8) — có cho cả `CONFIRMED`/`CONTRACT_CREATED`/`READY_FOR_HANDOVER`
 * hay chỉ `DRAFT`? Giả định tạm: cả 4 trạng thái theo tiên quyết UC-RC-06/07.
 */
export const RESCHEDULABLE_STATUSES = ['DRAFT', 'CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER'] as const

/** Dùng để ẩn/hiện nút "Dời lịch"/"Đổi xe" (và tay kéo ở Round B2). */
export function canRescheduleRental(rental: Pick<Rental, 'status'>): boolean {
  return (RESCHEDULABLE_STATUSES as readonly RentalStatus[]).includes(rental.status)
}

/**
 * Tách "chồng thời gian" khỏi "vi phạm vùng đệm 90'" (`hasConflict()` gộp cả hai — giữ nguyên hàm đó). Chỉ tính lượt đang chiếm xe
 * (cùng `OCCUPYING_STATUSES` với `hasConflict`), bỏ qua `excludeRentalId`. Nhận ISO hoặc giá trị `datetime-local` (hiểu theo +07).
 */
export function classifyConflicts(
  rentals: Rental[],
  vehicleId: string,
  startIso: string,
  endIso: string,
  excludeRentalId?: string,
): { overlaps: Rental[]; bufferViolations: Rental[] } {
  const bufferMs = TURNAROUND_BUFFER_MINUTES * 60 * 1000
  const aStart = dateTimeToMs(startIso)
  const aEnd = dateTimeToMs(endIso)
  const overlaps: Rental[] = []
  const bufferViolations: Rental[] = []
  for (const r of rentals) {
    if (r.id === excludeRentalId || r.vehicleId !== vehicleId || !OCCUPYING_STATUSES.includes(r.status)) continue
    const bStart = dateTimeToMs(r.pickupDateTime)
    const bEnd = dateTimeToMs(r.expectedReturnDateTime)
    if (aStart < bEnd && bStart < aEnd) overlaps.push(r)
    else if (aStart < bEnd + bufferMs && bStart < aEnd + bufferMs) bufferViolations.push(r)
  }
  return { overlaps, bufferViolations }
}

/** Mã lỗi/cảnh báo của `evaluateScheduleChange` — bảng chuẩn ở CALENDAR-ROUND3-PLAN.md §3.2. */
export const SCHEDULE_ISSUE_CODES = [
  'STATUS_LOCKED',
  'INVALID_PERIOD',
  'PICKUP_IN_PAST',
  'VEHICLE_UNAVAILABLE',
  'VEHICLE_BLOCKED',
  'OVERLAP',
  'BUFFER_VIOLATION',
  'OUTSIDE_RECEIVING_WINDOW',
  'DURATION_CHANGED',
  'VEHICLE_CLASS_DIFFERS',
  'CONTRACT_EXISTS',
  'NO_CHANGE',
] as const
export type ScheduleIssueCode = (typeof SCHEDULE_ISSUE_CODES)[number]

export interface ScheduleIssue {
  code: ScheduleIssueCode
  /** `OVERLAP` / `BUFFER_VIOLATION` — lượt gây xung đột. */
  rentalIds?: string[]
  /** `VEHICLE_BLOCKED` — khoá lịch gây xung đột. */
  blockIds?: string[]
}

export interface ScheduleChangeProposal {
  vehicleId: string
  /** ISO hoặc giá trị `datetime-local` (hiểu theo +07). */
  pickupDateTime: string
  expectedReturnDateTime: string
}

/** Khung nhận xe chuẩn (phút trong ngày, +07) — RM §51. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G3). */
const RECEIVING_WINDOW_OPEN_MINUTES = 8 * 60
const RECEIVING_WINDOW_CLOSE_MINUTES = 23 * 60

/**
 * Hàm kiểm tra DUY NHẤT cho dời lịch / đổi xe — UI (hộp thoại) và API (`rescheduleRental`/`changeRentalVehicle`) cùng gọi.
 * Thuần: `now`, danh sách lượt, xe đích và khoá xe đều là tham số. `errors` chặn; `warnings` cho phép đi tiếp
 * (riêng `BUFFER_VIOLATION` bắt buộc có lý do ghi đè — xem `needsOverrideReason`).
 */
export function evaluateScheduleChange(input: {
  rental: Rental
  proposed: ScheduleChangeProposal
  rentals: Rental[]
  targetVehicle: Pick<Vehicle, 'status' | 'vehicleClass'>
  vehicleBlocks: VehicleBlock[]
  now: Date
}): { errors: ScheduleIssue[]; warnings: ScheduleIssue[] } {
  const { rental, proposed, rentals, targetVehicle, vehicleBlocks, now } = input
  const errors: ScheduleIssue[] = []
  const warnings: ScheduleIssue[] = []

  // RC-BR-01, UC-RC-06/07 §tiên quyết — các kiểm tra còn lại vô nghĩa khi lượt đã khoá.
  if (!canRescheduleRental(rental)) return { errors: [{ code: 'STATUS_LOCKED' }], warnings }

  const pickupMs = dateTimeToMs(proposed.pickupDateTime)
  const returnMs = dateTimeToMs(proposed.expectedReturnDateTime)

  const unchanged =
    proposed.vehicleId === rental.vehicleId &&
    pickupMs === dateTimeToMs(rental.pickupDateTime) &&
    returnMs === dateTimeToMs(rental.expectedReturnDateTime)
  if (unchanged) return { errors: [{ code: 'NO_CHANGE' }], warnings }

  // RM-BR-03, UC-RM-10 — thời gian trả phải sau thời gian giao (sai định dạng → NaN → cũng là lỗi).
  const validPeriod = returnMs > pickupMs
  if (!validPeriod) errors.push({ code: 'INVALID_PERIOD' })

  // TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G1) — giả định tạm: không cho dời giờ giao về quá khứ.
  if (pickupMs < now.getTime()) errors.push({ code: 'PICKUP_IN_PAST' })

  // RC-BR-04, UC-RC-08. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G2) — giả định tạm: chặn cả khi chỉ dời lịch trên cùng xe.
  if (targetVehicle.status === 'MAINTENANCE' || targetVehicle.status === 'INACTIVE') errors.push({ code: 'VEHICLE_UNAVAILABLE' })

  if (!validPeriod) return { errors, warnings }

  const pickupIso = new Date(pickupMs).toISOString()
  const returnIso = new Date(returnMs).toISOString()

  // RM §57, RC-BR-15 — khoảng mới chồng Vehicle Block ACTIVE của xe đích.
  const blocking = findBlockingBlocks(vehicleBlocks, proposed.vehicleId, pickupIso, returnIso)
  if (blocking.length > 0) errors.push({ code: 'VEHICLE_BLOCKED', blockIds: blocking.map((b) => b.id) })

  // RC-BR-02/05, BR-001 — chồng thời gian với lượt khác đang chiếm xe.
  const { overlaps, bufferViolations } = classifyConflicts(rentals, proposed.vehicleId, pickupIso, returnIso, rental.id)
  if (overlaps.length > 0) errors.push({ code: 'OVERLAP', rentalIds: overlaps.map((r) => r.id) })

  // RC-BR-13, RM §12 — không chồng nhưng cách lượt liền kề < 90': cảnh báo, CẦN lý do ghi đè.
  // TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G4) — giả định tạm: mọi vai trò có RENTAL.EDIT được ghi đè, không giới hạn tối thiểu.
  if (bufferViolations.length > 0) warnings.push({ code: 'BUFFER_VIOLATION', rentalIds: bufferViolations.map((r) => r.id) })

  // RM §51. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G3) — giả định tạm: chỉ cảnh báo (RM §51 mô tả phụ thu, không cấm).
  const p = zonedParts(returnMs)
  const returnMinutes = p.hour * 60 + p.minute
  if (returnMinutes > RECEIVING_WINDOW_CLOSE_MINUTES || returnMinutes < RECEIVING_WINDOW_OPEN_MINUTES) {
    warnings.push({ code: 'OUTSIDE_RECEIVING_WINDOW' })
  }

  // RC-BR-06, UC-RC-06 bước 5. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q2) — giữ nguyên snapshot giá/km; chỉ cảnh báo, không tự tính lại.
  if (rentalDurationDays(pickupIso, returnIso) !== rental.rentalDurationDays) warnings.push({ code: 'DURATION_CHANGED' })

  // RC-BR-06, UC-RC-07 bước 4. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q3) — giữ nguyên snapshot hạng xe/Price Per KM; chỉ cảnh báo.
  if (proposed.vehicleId !== rental.vehicleId && targetVehicle.vehicleClass !== rental.vehicleClass) {
    warnings.push({ code: 'VEHICLE_CLASS_DIFFERS' })
  }

  // UC-RC-07 A2/A3. TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q4) — chỉ cảnh báo; không tự huỷ/tạo lại hợp đồng.
  if (rental.status === 'CONTRACT_CREATED' || rental.status === 'READY_FOR_HANDOVER') warnings.push({ code: 'CONTRACT_EXISTS' })

  return { errors, warnings }
}

/** RC-BR-13 — có cảnh báo vi phạm vùng đệm thì bắt buộc nhập lý do ghi đè (UI và API cùng dùng). */
export function needsOverrideReason(warnings: ScheduleIssue[]): boolean {
  return warnings.some((w) => w.code === 'BUFFER_VIOLATION')
}

/**
 * Form hộp thoại Dời lịch / Đổi xe. `datetime-local` (`YYYY-MM-DDTHH:mm`, +07) — so sánh bằng `dateTimeToMs`.
 * Điều kiện nghiệp vụ còn lại (xung đột, khoá, trạng thái…) KHÔNG nằm ở đây — chỉ `evaluateScheduleChange`.
 */
export const rentalScheduleChangeSchema = z
  .object({
    pickupDateTime: z.string().trim().min(1, 'Thời gian nhận xe là bắt buộc'),
    expectedReturnDateTime: z.string().trim().min(1, 'Thời gian trả xe dự kiến là bắt buộc'),
    vehicleId: z.string().trim().min(1, 'Chọn xe'),
    overrideReason: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // RM-BR-03 — End DateTime > Start DateTime.
    if (data.pickupDateTime && data.expectedReturnDateTime && !(dateTimeToMs(data.expectedReturnDateTime) > dateTimeToMs(data.pickupDateTime))) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedReturnDateTime'],
        message: 'Thời gian trả xe dự kiến phải sau thời gian nhận xe (RM-BR-03)',
      })
    }
  })

export type RentalScheduleChangeValues = z.infer<typeof rentalScheduleChangeSchema>

// ---- §3.3 Guard chuyển trạng thái (mirror pattern `vehicles/model.ts` `canChangeStatus`) ----

/**
 * CHỈ định nghĩa transition mà Round 1 tự thực hiện qua UI. Các state khác
 * (`CONTRACT_CREATED→...→COMPLETED`, `NO_SHOW`, `DISPUTED`) do seed data gán
 * trực tiếp (minh hoạ đủ badge màu cho List) — KHÔNG có action UI nào đưa
 * Rental tới các state đó ở Round 1; mở rộng map này khi Round tương ứng
 * (Contract/Handover/Return/Settlement) build tới.
 */
const ROUND1_TRANSITIONS: Partial<Record<RentalStatus, RentalStatus[]>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'CONTRACT_CREATED'], // + CONTRACT_CREATED — `docs/CONTRACT-MANAGEMENT-PLAN.md` §0.2/§3.1
  // + 4 dòng dưới — `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§3.4 (revert khi Huỷ Handover/Return có kiểm soát).
  HANDED_OVER: ['READY_FOR_HANDOVER'], // revert khi Huỷ Handover
  IN_RENTAL: ['READY_FOR_HANDOVER'], // revert khi Huỷ Handover (nếu đã tự tiến từ HANDED_OVER)
  // + SETTLEMENT/COMPLETED — `docs/RENTAL-SETTLEMENT-PLAN.md` §3.8 (UC-RS-01/UC-RS-13), round THỨ 3 mở rộng.
  RETURNED: ['IN_RENTAL', 'SETTLEMENT'], // revert khi Huỷ Return / mở quyết toán
  SETTLEMENT: ['IN_RENTAL', 'COMPLETED'], // revert khi Huỷ Return (nếu đã tự tiến từ RETURNED) / đóng lượt
  COMPLETED: ['SETTLEMENT'], // đảo quyết toán — RENTAL-SETTLEMENT-PLAN.md §10.5 (UC-RS-16)
}

/**
 * RM-BR-04/05/06/07 — chặn cứng, không phải cảnh báo có thể bỏ qua. RM-BR-08
 * (Customer INACTIVE) N/A: `CustomerStatus` hiện chỉ có `ACTIVE`/`BLOCKED`
 * (quyết định Phase 1, không có `INACTIVE`) nên rule này không áp dụng được.
 */
export function canConfirm(
  rental: Rental,
  customer: Pick<Customer, 'status'>,
  vehicle: Pick<Vehicle, 'status'>,
  existingRentals: Rental[],
): { ok: true } | { ok: false; reason: string } {
  if (!ROUND1_TRANSITIONS[rental.status]?.includes('CONFIRMED')) {
    return { ok: false, reason: `Lượt thuê đang ở trạng thái ${rental.status}, không thể xác nhận.` }
  }
  if (hasConflict(existingRentals, rental.vehicleId, rental.pickupDateTime, rental.expectedReturnDateTime, rental.id)) {
    return { ok: false, reason: 'Xe đã có lượt thuê khác trùng hoặc quá gần thời gian này (RM-BR-04/RM-BR-23).' }
  }
  if (vehicle.status === 'MAINTENANCE') {
    return { ok: false, reason: 'Xe đang bảo trì, không thể xác nhận lượt thuê (RM-BR-05).' }
  }
  if (vehicle.status === 'INACTIVE') {
    return { ok: false, reason: 'Xe đã ngừng hoạt động, không thể xác nhận lượt thuê (RM-BR-06).' }
  }
  if (customer.status === 'BLOCKED') {
    return { ok: false, reason: 'Khách hàng đang bị khoá, không thể xác nhận lượt thuê (RM-BR-07).' }
  }
  return { ok: true }
}

/** Dùng để ẩn/hiện nút Huỷ. */
export function canCancel(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('CANCELLED') ?? false
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §0.2/§3.1 — ngoại lệ kiến trúc có chủ
 * đích: `features/contracts` (module `CT`) là feature DUY NHẤT được phép mở
 * rộng `rentals/model.ts`/`api.ts`/`hooks.ts` ở Round 1. Mirror `canCancel()`.
 */
export function canMarkContractCreated(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('CONTRACT_CREATED') ?? false
}

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§3.4 — round THỨ 2 (sau
 * `contracts`) được phép mở rộng `rentals/model.ts`/`api.ts`/`hooks.ts`/
 * `index.ts`, giới hạn ở chiều Huỷ có kiểm soát (revert) — không build
 * transition thuận qua UI. Mirror `canCancel()`/`canMarkContractCreated()`.
 */
export function canCancelHandover(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('READY_FOR_HANDOVER') ?? false
}
export function canCancelReturn(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('IN_RENTAL') ?? false
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §3.8 — round THỨ 3 được phép mở rộng
 * `rentals/model.ts`/`api.ts`/`index.ts`, giới hạn ở 2 transition thuận
 * `RETURNED → SETTLEMENT` (UC-RS-01, RS-BR-02) và `SETTLEMENT → COMPLETED`
 * (UC-RS-13). Mirror `canMarkContractCreated()`. Trả `true` cho cả `RETURNED`
 * (mở quyết toán lần đầu) và `SETTLEMENT` (đã mở — để nhánh "không gọi lại
 * `markSettlementOpened`" ở `finance/api.ts` chạy tới; tech-lead review Phase
 * 4.1 R1 Nên sửa 4) — không dùng `ROUND1_TRANSITIONS` vì nó không tự-map.
 */
export function canOpenSettlement(rental: Rental): boolean {
  return rental.status === 'RETURNED' || rental.status === 'SETTLEMENT'
}
export function canCompleteRental(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('COMPLETED') ?? false
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §10.5 (UC-RS-16) — đảo quyết toán, chỉ
 * `SYSTEM_ADMIN`. Bẫy cần tránh: KHÔNG viết
 * `ROUND1_TRANSITIONS[rental.status]?.includes('SETTLEMENT')` — `RETURNED`
 * cũng map tới `SETTLEMENT` nên sẽ trả `true` sai cho Rental `RETURNED`.
 */
export function canRevertSettlementReversed(rental: Rental): boolean {
  return rental.status === 'COMPLETED' && (ROUND1_TRANSITIONS.COMPLETED?.includes('SETTLEMENT') ?? false)
}

/**
 * Hàm thuần chuẩn bị sẵn cho round sau (App nhân viên/quick-record) — CHƯA có
 * UI/action nào gọi ở Round 1 (kế hoạch §1.2 — không build transition thuận
 * qua UI vì chưa có wizard tạo).
 */
export function canMarkHandedOver(rental: Rental): boolean {
  return ['CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER'].includes(rental.status) // VH-BR-02
}
export function canMarkReturned(rental: Rental): boolean {
  return rental.status === 'IN_RENTAL' // VR-BR-02
}

// ---- Form schema ----

const NUMERIC_RE = /^\d+$/

/**
 * `UC-RM-01` §5.5 — tạo lượt thuê (Round 1 không có Edit). Field số dạng
 * `string` trong form rồi convert sang `number` ở `toInput()` của
 * `RentalFormSheet` — cùng lý do tránh lỗi kiểu giữa `z.coerce.number()` và
 * `react-hook-form` đã ghi nhận ở `vehicles/model.ts`.
 */
export const rentalFormSchema = z
  .object({
    customerId: z.string().trim().min(1, 'Chọn khách hàng'),
    vehicleId: z.string().trim().min(1, 'Chọn xe'),
    // datetime-local (`YYYY-MM-DDTHH:mm`) — so sánh chuỗi vẫn đúng thứ tự thời gian.
    pickupDateTime: z.string().trim().min(1, 'Thời gian nhận xe là bắt buộc'),
    expectedReturnDateTime: z.string().trim().min(1, 'Thời gian trả xe dự kiến là bắt buộc'),
    pickupLocation: z.string().trim().min(1, 'Địa điểm giao xe là bắt buộc'),
    returnLocation: z.string().trim().min(1, 'Địa điểm nhận xe là bắt buộc'),
    deliveryDistanceKm: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || NUMERIC_RE.test(v), { message: 'Số km phải là số nguyên không âm' }),
    rentalRate: z
      .string()
      .trim()
      .min(1, 'Đơn giá thuê là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Đơn giá thuê phải là số nguyên dương' }),
    discountAmount: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || NUMERIC_RE.test(v), { message: 'Số tiền giảm giá phải là số nguyên không âm' }),
    discountNote: z.string().trim().optional(),
    additionalChargesAmount: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || NUMERIC_RE.test(v), { message: 'Chi phí phát sinh phải là số nguyên không âm' }),
    additionalChargesNote: z.string().trim().optional(),
    securityDepositType: z.enum(SECURITY_DEPOSIT_TYPES),
    securityDepositAssetNote: z.string().trim().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // RM-BR-03 — End DateTime > Start DateTime.
    if (data.expectedReturnDateTime <= data.pickupDateTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['expectedReturnDateTime'],
        message: 'Thời gian trả xe dự kiến phải sau thời gian nhận xe (RM-BR-03)',
      })
    }
    // RM-BR-17 — MOTORBIKE bắt buộc mô tả tài sản đặt cọc.
    if (data.securityDepositType === 'MOTORBIKE' && !data.securityDepositAssetNote) {
      ctx.addIssue({
        code: 'custom',
        path: ['securityDepositAssetNote'],
        message: 'Mô tả xe máy đặt cọc là bắt buộc (RM-BR-17)',
      })
    }
  })

export type RentalFormValues = z.infer<typeof rentalFormSchema>

/**
 * `UC-RM-01`/`AC-RM` — bắt buộc nhập lý do khi huỷ lượt thuê (§5.3 kế hoạch).
 */
export const rentalCancelReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})

export type RentalCancelReasonValues = z.infer<typeof rentalCancelReasonSchema>

/**
 * Cửa sổ "sắp đến hạn" giao/nhận (giờ). Cùng 24h với widget `DispatchBoardScreen` (không refactor file đó ở Phase 6).
 * TODO(OQ: RentalCalendar-BRD.md §21 — câu hỏi 16) — cửa sổ "sắp đến hạn" chưa chốt; Notification-BRD.md §20 Q4.
 */
export const UPCOMING_WINDOW_HOURS = 24

/** Trước giao = chưa `HANDED_OVER` (khớp `PRE_HANDOVER_STATUSES` của `DispatchBoardScreen`). */
const SIGNAL_PRE_HANDOVER_STATUSES: RentalStatus[] = ['CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER']
/**
 * Đang thuê (đã giao, chưa nhận). Lệch có chủ đích so với `DispatchBoardScreen` (widget nhận/quá hạn của bảng đó dùng
 * cả trạng thái trước giao): lượt chưa giao thì không thể "quá hạn trả" — DASHBOARD-PLATFORM-PLAN.md §4.1.
 */
const SIGNAL_ON_RENT_STATUSES: RentalStatus[] = ['HANDED_OVER', 'IN_RENTAL']

/**
 * Tín hiệu giao/nhận sắp tới và quá hạn trả — hàm thuần, `now` là tham số. DASHBOARD-PLATFORM-PLAN.md §4.1.
 * Không phát `RENTAL_UPCOMING`.
 * TODO(OQ: Notification-BRD.md §7 — ranh giới RENTAL_UPCOMING vs HANDOVER_UPCOMING) — chỉ phát HANDOVER_UPCOMING/RETURN_UPCOMING.
 * TODO(OQ: Notification-BRD.md §7 — "quá hạn trả" chưa có mã Event riêng) — dùng OPERATION_ALERT_OTHER + payload.kind RETURN_OVERDUE.
 */
export function collectRentalTimeSignals(rentals: Rental[], vehicles: Vehicle[], now: Date): OperationalSignal[] {
  const plateById = new Map(vehicles.map((v) => [v.id, v.plate]))
  const nowMs = now.getTime()
  const untilMs = nowMs + UPCOMING_WINDOW_HOURS * 60 * 60 * 1000
  const signals: OperationalSignal[] = []
  for (const rental of rentals) {
    const plate = plateById.get(rental.vehicleId) ?? rental.vehicleId
    const base = {
      sourceModule: 'RM',
      resource: 'RENTAL',
      entityType: 'Rental',
      entityId: rental.id,
      entityLabel: `${vi.notifications.entity.rental} ${rental.id}`,
      link: paths.rentalDetail(rental.id),
    } as const
    if (SIGNAL_PRE_HANDOVER_STATUSES.includes(rental.status)) {
      const t = new Date(rental.pickupDateTime).getTime()
      if (t >= nowMs && t <= untilMs) {
        signals.push({
          ...base,
          dedupeKey: signalDedupeKey('HANDOVER_UPCOMING', 'Rental', rental.id, rental.pickupDateTime),
          eventType: 'HANDOVER_UPCOMING',
          group: 'UPCOMING_HANDOVER',
          priority: 'NORMAL',
          dueRef: rental.pickupDateTime,
          payload: { rentalId: rental.id, plate, time: formatDateTime(rental.pickupDateTime) },
        })
      }
    } else if (SIGNAL_ON_RENT_STATUSES.includes(rental.status)) {
      const t = new Date(rental.expectedReturnDateTime).getTime()
      const payload = { rentalId: rental.id, plate, time: formatDateTime(rental.expectedReturnDateTime) }
      if (t >= nowMs && t <= untilMs) {
        signals.push({
          ...base,
          dedupeKey: signalDedupeKey('RETURN_UPCOMING', 'Rental', rental.id, rental.expectedReturnDateTime),
          eventType: 'RETURN_UPCOMING',
          group: 'UPCOMING_RETURN',
          priority: 'NORMAL',
          dueRef: rental.expectedReturnDateTime,
          payload,
        })
      } else if (t < nowMs) {
        signals.push({
          ...base,
          dedupeKey: signalDedupeKey('OPERATION_ALERT_OTHER', 'Rental', rental.id, `RETURN_OVERDUE:${rental.expectedReturnDateTime}`),
          eventType: 'OPERATION_ALERT_OTHER',
          group: 'OVERDUE_RETURN',
          priority: 'URGENT',
          dueRef: rental.expectedReturnDateTime,
          payload: { ...payload, kind: 'RETURN_OVERDUE' },
        })
      }
    }
  }
  return signals
}
