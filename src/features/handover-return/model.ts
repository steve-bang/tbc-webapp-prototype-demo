import { z } from 'zod'
import type { AdditionalChargeType, ConditionItemType, HandoverReturnStatus, IncidentItemType } from '@/shared/domain/enums'
import { generateId } from '@/shared/lib/id'

/**
 * Media placeholder — `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §2.1, mirror
 * `VehicleDocument.fileMeta` (`vehicles/model.ts`). Webapp KHÔNG thực hiện
 * chụp ảnh/video thật (`CLAUDE.md` §3/`WebappQuanTri.md` §10.1-10.2) — chỉ lưu
 * metadata mô tả bằng chứng đã có (không `fileUrl`).
 */
export interface MediaMeta {
  id: string
  category: string
  capturedAt: string
  employeeId?: string
  note?: string
}

/** Danh mục gợi ý cho `MediaMeta.category` — chuỗi tự do, không phải enum `shared/domain` (chưa có màn cấu hình). */
export const MEDIA_CATEGORIES = [
  'EXTERIOR_FRONT',
  'EXTERIOR_BACK',
  'EXTERIOR_LEFT',
  'EXTERIOR_RIGHT',
  'INTERIOR',
  'ODOMETER',
  'FUEL_GAUGE',
  'CONDITION_ITEM',
  'INCIDENT',
  'MOTORBIKE_COLLATERAL',
  'CAVET',
] as const

/** VH §12 — baseline hư hỏng/tình trạng có sẵn ghi nhận lúc giao xe. */
export interface HandoverConditionItem {
  id: string
  type: ConditionItemType
  position?: string
  description: string
  /** BRD: "tuỳ cấu hình" — không bắt buộc ở Round 1. */
  severity?: 'MINOR' | 'MODERATE' | 'SEVERE'
  mediaMeta: MediaMeta[]
}

/** VH §13 — checklist đồ đi kèm/giấy tờ giao cho khách. `itemName` chuỗi tự do (gợi ý từ `SUGGESTED_CHECKLIST_ITEMS`). */
export interface HandoverChecklistItem {
  id: string
  itemName: string
  status: 'DELIVERED' | 'NOT_DELIVERED' | 'NOT_APPLICABLE'
  note?: string
}

/** VH-BR-18/§12.1 — bắt buộc khi `rental.securityDepositType === 'MOTORBIKE'` và Handover `COMPLETED`. */
export interface MotorbikeCollateral {
  mediaMeta: MediaMeta[]
  odometer: number
  fuelLevel: number
  cavetMediaMeta: MediaMeta[]
}

/**
 * Biên bản giao xe — `VehicleHandover-BRD.md` §6/§9-§10/§12-§16/§22/§29
 * (module `VH`), `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §2.1. Webapp Round
 * 1 KHÔNG build wizard thực hiện (§0.2 kế hoạch) — bản ghi `COMPLETED` chỉ qua
 * seed; Webapp chỉ Theo dõi/Xem/Sửa có kiểm soát/Huỷ có kiểm soát.
 */
export interface HandoverRecord {
  id: string
  /** VH-BR-01/03 — tối đa 1 Handover `COMPLETED` hợp lệ/Rental. */
  rentalId: string
  status: HandoverReturnStatus
  /** VH-BR-14 — nhân viên thực hiện, chặn cứng ở App nhân viên; Webapp Round 1 chỉ hiển thị. */
  deliveryStaffEmployeeId?: string
  /** VH-BR-06/19 — đầu vào tính `Expected Return DateTime` (owned bởi `Rental`, không tính lại ở round này). Bắt buộc khi `COMPLETED`. */
  actualPickupDateTime?: string
  /** VH-BR-06/07 — bắt buộc khi `COMPLETED`. */
  odometerHandover?: number
  /** VH-BR-06/22 — số vạch. TODO(OQ: `VehicleHandover-BRD.md` §29 Q5-8 — thang đo cụ thể chưa chốt), bắt buộc khi `COMPLETED`. */
  fuelLevelHandover?: number
  /** §12 BRD — baseline hư hỏng có sẵn. */
  preExistingConditionItems: HandoverConditionItem[]
  /** §13 BRD. */
  checklist: HandoverChecklistItem[]
  /** §14.1 — placeholder, không có file thật (§0.2 kế hoạch). */
  mediaMeta: MediaMeta[]
  note?: string
  /** §16, tối giản. TODO(OQ: `VehicleHandover-BRD.md` §29 Q12-14 — mức xác nhận khách M0-M4 chưa chốt). */
  customerAcknowledged: boolean
  customerAcknowledgedNote?: string
  /** VH-BR-18 — bắt buộc khi `COMPLETED` và `rental.securityDepositType === 'MOTORBIKE'`. */
  motorbikeCollateral?: MotorbikeCollateral
  /** VH-BR-17 điều kiện bắt đầu — flag thủ công (module `Payment` chưa build nên không tự kiểm tra được). */
  prepaymentConfirmed: boolean
  /** VH-BR-17 điều kiện hoàn tất (70% + Deposit) — flag thủ công, cùng lý do. */
  fullPaymentConfirmed: boolean
  /** Bắt buộc khi `status === 'CANCELLED'`. */
  cancelReason?: string
  cancelledAt?: string
  cancelledByUserId?: string
  cancelledByName?: string
  cancelledByRole?: string
  createdAt: string
  updatedAt: string
}

/**
 * Sự cố phát hiện lúc nhận xe — `VehicleReturn-BRD.md` §13, nhúng trong
 * `ReturnRecord` (KHÔNG phải entity `Incident` độc lập — đó là phạm vi
 * `features/incidents` (DI) round sau). `status` cố định `'OPEN'`, không có
 * lifecycle tiếp ở Round 1.
 */
export interface ReturnIncidentItem {
  id: string
  type: IncidentItemType
  position?: string
  description: string
  /** VR-BR-08 — chỉ hư hỏng KHÔNG có baseline (`NEW`) mới tính phát sinh; `WORSENED` = có baseline nhưng nặng hơn. */
  baselineComparison: 'NEW' | 'WORSENED'
  estimatedCost: number
  /** VR-BR-20 — chỉ lưu field, không có hành động tự động đổi Vehicle status ở Round 1 (kế hoạch §0.4). */
  affectsSafety: boolean
  /** VR-BR-23/24 — phản ánh trạng thái chờ duyệt/chờ bill garage, không có hành động Duyệt/Nhập bill ở Round 1 (thuộc DI). */
  chargeApprovalStatus: 'ESTIMATED' | 'PENDING_MANAGER_APPROVAL' | 'PENDING_GARAGE_BILL'
  mediaMeta: MediaMeta[]
  status: 'OPEN'
}

/** VR §14 — đối chiếu với `HandoverChecklistItem` các mục `DELIVERED`. */
export interface ReturnChecklistItem {
  id: string
  handoverChecklistItemId?: string
  itemName: string
  status: 'OK' | 'MISSING' | 'DAMAGED' | 'NOT_APPLICABLE'
  note?: string
}

/** §15 BRD — khoản phát sinh ước tính, VR-BR-12: Settlement (Phase 4) mới chốt số thật. */
export interface AdditionalChargeItem {
  id: string
  type: AdditionalChargeType
  amount: number
  note?: string
}

/**
 * Biên bản trả xe — `VehicleReturn-BRD.md` §6/§13-§15/§25/§32 (module `VR`),
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §2.2.
 */
export interface ReturnRecord {
  id: string
  /** VR-BR-01/06. */
  rentalId: string
  /** VR-BR-02 — phải trỏ tới 1 `HandoverRecord` `COMPLETED`. */
  handoverRecordId: string
  status: HandoverReturnStatus
  /** VR-BR-19 — chặn cứng ở App nhân viên, Webapp chỉ hiển thị. */
  receivingStaffEmployeeId?: string
  /** VR-BR-05 — không tương lai, không trước `actualPickupDateTime` của Handover. Bắt buộc khi `COMPLETED`. */
  actualReturnDateTime?: string
  /** VR-BR-03 — chặn cứng nếu `< odometerHandover`. Bắt buộc khi `COMPLETED`. */
  odometerReturn?: number
  /** VR-BR-04 — cùng thang Handover. Bắt buộc khi `COMPLETED`. */
  fuelLevelReturn?: number
  /** §13 BRD — nhúng, không phải entity `Incident` riêng. */
  incidentItems: ReturnIncidentItem[]
  checklistComparison: ReturnChecklistItem[]
  /** §15 BRD — trạng thái luôn ước tính (VR-BR-12). */
  additionalCharges: AdditionalChargeItem[]
  note?: string
  /** TODO(OQ: `VehicleReturn-BRD.md` §32 Q23 — mức xác nhận khách M0-M4 chưa chốt), tối giản. */
  customerAcknowledged: boolean
  customerAcknowledgedNote?: string
  cancelReason?: string
  cancelledAt?: string
  cancelledByUserId?: string
  cancelledByName?: string
  cancelledByRole?: string
  createdAt: string
  updatedAt: string
}

// ---- §2.3 kế hoạch — danh mục tĩnh, không đưa lên `shared/domain/enums.ts` (chưa có màn cấu hình). ----

/** VH §13 — danh mục checklist gợi ý (nhân viên có thể gõ tự do ngoài danh mục này). */
export const SUGGESTED_CHECKLIST_ITEMS = [
  'Chìa khoá chính',
  'Chìa khoá phụ',
  'Giấy đăng ký xe (bản photo)',
  'Bảo hiểm (bản photo)',
  'Sạc/phụ kiện theo xe',
  'Lốp dự phòng',
  'Bộ dụng cụ sửa xe',
  'Tam giác cảnh báo',
]

// ---- §3.1 kế hoạch — Guard trạng thái bản ghi (UC-VH/VR §4 — cả 2 entity dùng chung 1 tập trạng thái). ----

export function canCompleteHandover(record: HandoverRecord): boolean {
  return record.status === 'IN_PROGRESS' || record.status === 'NOT_STARTED'
}
export function canCancelHandoverRecord(record: HandoverRecord): boolean {
  return record.status === 'COMPLETED'
}
export function canEditHandoverRecord(record: HandoverRecord): boolean {
  return record.status === 'COMPLETED'
}

export function canCancelReturnRecord(record: ReturnRecord): boolean {
  return record.status === 'COMPLETED'
}
export function canEditReturnRecord(record: ReturnRecord): boolean {
  return record.status === 'COMPLETED'
}

// ---- §3.2 kế hoạch — Tính khoản phát sinh ước tính (VR-BR-21/22/24/25). ----

/** VR-BR-21/CR-2026-057 — vượt km làm tròn LÊN bội số 10km trước khi nhân đơn giá. */
export function calcExtraKmFee(
  odometerHandover: number,
  odometerReturn: number,
  allowedKm: number,
  pricePerKm: number,
): number {
  const actualKm = Math.max(0, odometerReturn - odometerHandover)
  const extraKm = Math.max(0, actualKm - allowedKm)
  const roundedExtraKm = Math.ceil(extraKm / 10) * 10
  return roundedExtraKm * pricePerKm
}

/**
 * VR-BR-22/CR-2026-005/007/054 — ân hạn 15 phút; bậc thang 10/30/50% đơn giá
 * 1 ngày cho trễ tới 1h/2h/3h (không cộng dồn); > 3h → giữ ở 50%, khách giữ xe
 * qua đêm (cửa đóng 23:00): trả trước 08:00 → phụ thu ½ ngày; sau 08:00 → 1
 * ngày (loại trừ với phí trễ giờ theo giờ — chỉ tính 1 trong 2).
 */
export function calcOvertimeFee(
  expectedReturnDateTime: string,
  actualReturnDateTime: string,
  dailyRate: number,
  graceMinutes = 15,
): number {
  const lateMs = new Date(actualReturnDateTime).getTime() - new Date(expectedReturnDateTime).getTime()
  const lateMinutes = lateMs / 60000
  if (lateMinutes <= graceMinutes) return 0
  const actualReturn = new Date(actualReturnDateTime)
  const closedAfter23h = actualReturn.getHours() >= 23
  if (!closedAfter23h && lateMinutes <= 180) {
    if (lateMinutes <= 60) return dailyRate * 0.1
    if (lateMinutes <= 120) return dailyRate * 0.3
    return dailyRate * 0.5
  }
  // > 3h hoặc sau giờ đóng cửa 23:00 — khách giữ xe qua đêm.
  return actualReturn.getHours() < 8 ? dailyRate * 0.5 : dailyRate * 1
}

/** VR-BR-25/CR-2026-062 — copy nguyên `rental.deliveryFee` đã snapshot lúc tạo Rental, không tính lại. */
export function buildDeliveryFeeCharge(deliveryFee: number): AdditionalChargeItem | undefined {
  return deliveryFee > 0 ? { id: generateId('chg'), type: 'DELIVERY_FEE', amount: deliveryFee } : undefined
}

/**
 * Gộp Extra KM + Overtime + Delivery Fee thành baseline Additional Charge
 * Items khi Return hoàn tất. Damage/Fuel Deficit/Missing Accessory là nhập
 * tay (VR-BR-28 nói rõ Fuel Deficit KHÔNG tự tính) — không có trong hàm này.
 */
export function buildBaselineAdditionalCharges(input: {
  odometerHandover: number
  odometerReturn: number
  allowedKm: number
  pricePerKm: number
  expectedReturnDateTime: string
  actualReturnDateTime: string
  rentalRate: number
  rentalDurationDays: number
  deliveryFee: number
}): AdditionalChargeItem[] {
  const items: AdditionalChargeItem[] = []
  const extraKmFee = calcExtraKmFee(input.odometerHandover, input.odometerReturn, input.allowedKm, input.pricePerKm)
  if (extraKmFee > 0) items.push({ id: generateId('chg'), type: 'EXTRA_KM', amount: extraKmFee })
  const overtimeFee = calcOvertimeFee(input.expectedReturnDateTime, input.actualReturnDateTime, input.rentalRate)
  if (overtimeFee > 0) items.push({ id: generateId('chg'), type: 'OVERTIME', amount: overtimeFee })
  const deliveryCharge = buildDeliveryFeeCharge(input.deliveryFee)
  if (deliveryCharge) items.push(deliveryCharge)
  return items
}

// ---- §3.3 kế hoạch — Đối chiếu checklist (VR §14). ----

/** Sinh `ReturnChecklistItem[]` từ các mục `DELIVERED` của Handover Checklist. */
export function buildChecklistComparisonDraft(handoverChecklist: HandoverChecklistItem[]): ReturnChecklistItem[] {
  return handoverChecklist
    .filter((item) => item.status === 'DELIVERED')
    .map((item) => ({
      id: generateId('rci'),
      handoverChecklistItemId: item.id,
      itemName: item.itemName,
      status: 'OK' as const,
    }))
}

/** VR-BR §14 — mục MISSING/DAMAGED tự gợi ý thêm 1 `AdditionalChargeItem` loại `MISSING_ACCESSORY` (amount=0, nhân viên tự điền). */
export function suggestMissingAccessoryCharges(checklist: ReturnChecklistItem[]): AdditionalChargeItem[] {
  return checklist
    .filter((item) => item.status === 'MISSING' || item.status === 'DAMAGED')
    .map((item) => ({
      id: generateId('chg'),
      type: 'MISSING_ACCESSORY' as const,
      amount: 0,
      note: `${item.itemName} — ${item.status === 'MISSING' ? 'thiếu' : 'hư hỏng'}, nhân viên tự điền số tiền.`,
    }))
}

// ---- Form schema (react-hook-form + zod, `CONVENTIONS.md` §7) ----

const NUMERIC_RE = /^\d+$/

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§0.5 — form Sửa quản lý phần
 * field vô hướng qua RHF+zod; danh sách lặp (checklist/condition items) quản
 * lý bằng `useState` thuần ở component (không có tiền lệ `useFieldArray`
 * trong repo). `reason` bắt buộc — VH-BR-12.
 */
export const handoverEditFormSchema = z.object({
  actualPickupDateTime: z.string().trim().min(1, 'Thời gian giao xe thực tế là bắt buộc'),
  odometerHandover: z
    .string()
    .trim()
    .min(1, 'Odometer giao xe là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Odometer phải là số nguyên không âm' }),
  fuelLevelHandover: z
    .string()
    .trim()
    .min(1, 'Mức nhiên liệu giao xe là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Mức nhiên liệu phải là số nguyên không âm' }),
  note: z.string().trim().optional(),
  customerAcknowledged: z.boolean(),
  customerAcknowledgedNote: z.string().trim().optional(),
  prepaymentConfirmed: z.boolean(),
  fullPaymentConfirmed: z.boolean(),
  reason: z.string().trim().min(3, 'Lý do sửa là bắt buộc (tối thiểu 3 ký tự)'),
})
export type HandoverEditFormValues = z.infer<typeof handoverEditFormSchema>

/** VR-BR-16 — cùng tinh thần `handoverEditFormSchema`. */
export const returnEditFormSchema = z.object({
  actualReturnDateTime: z.string().trim().min(1, 'Thời gian trả xe thực tế là bắt buộc'),
  odometerReturn: z
    .string()
    .trim()
    .min(1, 'Odometer trả xe là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Odometer phải là số nguyên không âm' }),
  fuelLevelReturn: z
    .string()
    .trim()
    .min(1, 'Mức nhiên liệu trả xe là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Mức nhiên liệu phải là số nguyên không âm' }),
  note: z.string().trim().optional(),
  customerAcknowledged: z.boolean(),
  customerAcknowledgedNote: z.string().trim().optional(),
  reason: z.string().trim().min(3, 'Lý do sửa là bắt buộc (tối thiểu 3 ký tự)'),
})
export type ReturnEditFormValues = z.infer<typeof returnEditFormSchema>

/** Mirror `rentalCancelReasonSchema` — bắt buộc nhập lý do khi huỷ Handover/Return. */
export const handoverCancelReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type HandoverCancelReasonValues = z.infer<typeof handoverCancelReasonSchema>

export const returnCancelReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type ReturnCancelReasonValues = z.infer<typeof returnCancelReasonSchema>
