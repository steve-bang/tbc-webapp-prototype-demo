import { parseISO } from 'date-fns'
import { z } from 'zod'
import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
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
  const ms = parseISO(expectedReturnDateTime).getTime() - parseISO(pickupDateTime).getTime()
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
  const aStart = new Date(pickupDateTime).getTime()
  const aEnd = new Date(expectedReturnDateTime).getTime()
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
  RETURNED: ['IN_RENTAL'], // revert khi Huỷ Return
  SETTLEMENT: ['IN_RENTAL'], // revert khi Huỷ Return (nếu đã tự tiến từ RETURNED)
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
