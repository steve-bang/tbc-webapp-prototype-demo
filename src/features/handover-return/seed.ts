import { PRICE_PER_KM_BY_CLASS, calcAllowedKm, rentalDurationDays } from '@/features/rentals/model'
import type { VehicleClass } from '@/shared/domain/enums'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { generateId } from '@/shared/lib/id'
import { writeJson } from '@/shared/lib/storage'
import { HANDOVER_RECORDS_STORAGE_KEY, RETURN_RECORDS_STORAGE_KEY } from './api'
import {
  SUGGESTED_CHECKLIST_ITEMS,
  buildBaselineAdditionalCharges,
  buildChecklistComparisonDraft,
  type AdditionalChargeItem,
  type HandoverChecklistItem,
  type HandoverConditionItem,
  type HandoverRecord,
  type MediaMeta,
  type MotorbikeCollateral,
  type ReturnChecklistItem,
  type ReturnIncidentItem,
  type ReturnRecord,
} from './model'

/**
 * `YYYY-MM-DDTHH:mm:00.000Z`-tương đương tính từ hôm nay ± số ngày — mirror
 * `dt()` của `rentals/seed.ts`/`contracts/seed.ts` (KHÔNG export ở đó nên định
 * nghĩa lại đây) để tái tạo đúng thời gian của Rental đang tham chiếu.
 */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function media(category: string, capturedAt: string, employeeId: string, note?: string): MediaMeta {
  return { id: generateId('med'), category, capturedAt, employeeId, note }
}

const STAFF_1 = 'emp_staff1' // Hoàng Văn Nhân Viên
const STAFF_2 = 'emp_staff2' // Vũ Thị Vận Hành

/**
 * Thông tin Rental thật cần để tính `allowedKm`/`pricePerKm` bằng đúng hàm
 * thuần `rentals/model.ts` (không hard-code số 1400) — `docs/HANDOVER-RETURN-
 * MANAGEMENT-PLAN.md` §7/§9 tham chiếu `rentalId` thật từ `rentals/seed.ts`.
 */
interface RentalRef {
  vehicleClass: VehicleClass
  rentalRate: number
  pickupDateTime: string
  expectedReturnDateTime: string
  deliveryFee: number
}

const RENTAL_REFS: Record<string, RentalRef> = {
  rt_016: { vehicleClass: 'TWO_SEATER', rentalRate: 500000, pickupDateTime: dt(-1, 9, 0), expectedReturnDateTime: dt(2, 21, 0), deliveryFee: 0 },
  rt_017: { vehicleClass: 'VIP_LUXURY', rentalRate: 1800000, pickupDateTime: dt(0, 7, 0), expectedReturnDateTime: dt(4, 21, 0), deliveryFee: 0 },
  rt_018: { vehicleClass: 'VIP_LUXURY', rentalRate: 1800000, pickupDateTime: dt(-2, 9, 0), expectedReturnDateTime: dt(1, 21, 0), deliveryFee: 0 },
  rt_019: { vehicleClass: 'STANDARD', rentalRate: 900000, pickupDateTime: dt(0, 6, 0), expectedReturnDateTime: dt(3, 21, 0), deliveryFee: 0 },
  rt_020: { vehicleClass: 'STANDARD', rentalRate: 900000, pickupDateTime: dt(-10, 9, 0), expectedReturnDateTime: dt(-7, 21, 0), deliveryFee: 0 },
  rt_021: { vehicleClass: 'STANDARD', rentalRate: 900000, pickupDateTime: dt(-8, 9, 0), expectedReturnDateTime: dt(-5, 21, 0), deliveryFee: 0 },
  rt_022: { vehicleClass: 'VIP_LUXURY', rentalRate: 1800000, pickupDateTime: dt(-6, 9, 0), expectedReturnDateTime: dt(-3, 21, 0), deliveryFee: 0 },
  rt_023: { vehicleClass: 'STANDARD', rentalRate: 900000, pickupDateTime: dt(-12, 9, 0), expectedReturnDateTime: dt(-9, 21, 0), deliveryFee: 0 },
  rt_024: { vehicleClass: 'VIP_LUXURY', rentalRate: 1800000, pickupDateTime: dt(-20, 9, 0), expectedReturnDateTime: dt(-17, 21, 0), deliveryFee: 0 },
  rt_025: { vehicleClass: 'TWO_SEATER', rentalRate: 500000, pickupDateTime: dt(-30, 9, 0), expectedReturnDateTime: dt(-27, 21, 0), deliveryFee: 0 },
  rt_026: { vehicleClass: 'TWO_SEATER', rentalRate: 500000, pickupDateTime: dt(-15, 9, 0), expectedReturnDateTime: dt(-12, 21, 0), deliveryFee: 0 },
}

function allowedKmOf(ref: RentalRef): number {
  return calcAllowedKm(rentalDurationDays(ref.pickupDateTime, ref.expectedReturnDateTime))
}
function pricePerKmOf(ref: RentalRef): number {
  return PRICE_PER_KM_BY_CLASS[ref.vehicleClass]
}

/** VH §13 — checklist chuẩn từ `SUGGESTED_CHECKLIST_ITEMS` (5 mục đầu), mặc định toàn `DELIVERED`. */
function buildChecklist(overrides?: Record<string, HandoverChecklistItem['status']>): HandoverChecklistItem[] {
  return SUGGESTED_CHECKLIST_ITEMS.slice(0, 5).map((itemName) => ({
    id: generateId('chk'),
    itemName,
    status: overrides?.[itemName] ?? 'DELIVERED',
    note: overrides?.[itemName] === 'NOT_APPLICABLE' ? 'Xe không trang bị mục này.' : undefined,
  }))
}

function buildHandover(input: {
  id: string
  rentalId: string
  odometerHandover: number
  fuelLevelHandover: number
  deliveryStaffEmployeeId: string
  preExistingConditionItems?: HandoverConditionItem[]
  checklistOverrides?: Record<string, HandoverChecklistItem['status']>
  motorbikeCollateral?: MotorbikeCollateral
}): HandoverRecord {
  const ref = RENTAL_REFS[input.rentalId]
  const checklist = buildChecklist(input.checklistOverrides)
  return {
    id: input.id,
    rentalId: input.rentalId,
    status: 'COMPLETED',
    deliveryStaffEmployeeId: input.deliveryStaffEmployeeId,
    actualPickupDateTime: ref.pickupDateTime,
    odometerHandover: input.odometerHandover,
    fuelLevelHandover: input.fuelLevelHandover,
    preExistingConditionItems: input.preExistingConditionItems ?? [],
    checklist,
    mediaMeta: [
      media('EXTERIOR_FRONT', ref.pickupDateTime, input.deliveryStaffEmployeeId),
      media('ODOMETER', ref.pickupDateTime, input.deliveryStaffEmployeeId, `Odo ${input.odometerHandover.toLocaleString('vi-VN')} km`),
      media('FUEL_GAUGE', ref.pickupDateTime, input.deliveryStaffEmployeeId),
    ],
    customerAcknowledged: true,
    motorbikeCollateral: input.motorbikeCollateral,
    prepaymentConfirmed: true,
    fullPaymentConfirmed: true,
    createdAt: ref.pickupDateTime,
    updatedAt: ref.pickupDateTime,
  }
}

function buildReturn(input: {
  id: string
  rentalId: string
  handoverRecordId: string
  handover: HandoverRecord
  odometerReturn: number
  fuelLevelReturn: number
  receivingStaffEmployeeId: string
  actualReturnDateTime?: string
  extraCharges?: AdditionalChargeItem[]
  incidentItems?: ReturnIncidentItem[]
  checklistOverrides?: (draft: ReturnChecklistItem[]) => ReturnChecklistItem[]
}): ReturnRecord {
  const ref = RENTAL_REFS[input.rentalId]
  const actualReturnDateTime = input.actualReturnDateTime ?? ref.expectedReturnDateTime
  const baselineCharges = buildBaselineAdditionalCharges({
    odometerHandover: input.handover.odometerHandover ?? 0,
    odometerReturn: input.odometerReturn,
    allowedKm: allowedKmOf(ref),
    pricePerKm: pricePerKmOf(ref),
    expectedReturnDateTime: ref.expectedReturnDateTime,
    actualReturnDateTime,
    rentalRate: ref.rentalRate,
    rentalDurationDays: rentalDurationDays(ref.pickupDateTime, ref.expectedReturnDateTime),
    deliveryFee: ref.deliveryFee,
  })
  let checklistComparison = buildChecklistComparisonDraft(input.handover.checklist)
  if (input.checklistOverrides) checklistComparison = input.checklistOverrides(checklistComparison)
  return {
    id: input.id,
    rentalId: input.rentalId,
    handoverRecordId: input.handoverRecordId,
    status: 'COMPLETED',
    receivingStaffEmployeeId: input.receivingStaffEmployeeId,
    actualReturnDateTime,
    odometerReturn: input.odometerReturn,
    fuelLevelReturn: input.fuelLevelReturn,
    incidentItems: input.incidentItems ?? [],
    checklistComparison,
    additionalCharges: [...baselineCharges, ...(input.extraCharges ?? [])],
    customerAcknowledged: true,
    createdAt: actualReturnDateTime,
    updatedAt: actualReturnDateTime,
  }
}

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §7/§9 — 12 `HandoverRecord` + 7
 * `ReturnRecord` tham chiếu đúng `rentalId` thật từ `rentals/seed.ts` (2
 * `HANDED_OVER`, 2 `IN_RENTAL`, 2 `RETURNED`, 2 `SETTLEMENT`, 3 `COMPLETED`, 1
 * `CANCELLED`). Số liệu odo/fuel/charge tính bằng đúng hàm thuần `model.ts`
 * (`calcExtraKmFee`/`calcOvertimeFee`/`buildBaselineAdditionalCharges`), khớp
 * với `currentKm` hiện tại của xe (`vehicles/seed.ts`) cho các Rental đã trả
 * xe/hoàn tất.
 */
function seedHandoverReturn(): void {
  // ---- HANDED_OVER (2) — chỉ Handover, chưa có Return. ----
  const ho016 = buildHandover({
    id: 'ho_001',
    rentalId: 'rt_016',
    odometerHandover: 38700, // = currentKm veh_010 hiện tại (đang HANDED_OVER, chưa chạy thêm km)
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
  })
  const ho017 = buildHandover({
    id: 'ho_002',
    rentalId: 'rt_017',
    odometerHandover: 18500, // = currentKm veh_001
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_2,
  })

  // ---- IN_RENTAL (2) — chỉ Handover, chưa có Return; odo < currentKm vì xe đang chạy tiếp. ----
  const ho018 = buildHandover({
    id: 'ho_003',
    rentalId: 'rt_018',
    odometerHandover: 13800, // < currentKm veh_018 (14000) — xe đang IN_RENTAL, đã chạy thêm ~200km
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
  })
  const ho019 = buildHandover({
    id: 'ho_004',
    rentalId: 'rt_019',
    odometerHandover: 6100, // < currentKm veh_017 (6200)
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_2,
    motorbikeCollateral: {
      mediaMeta: [media('MOTORBIKE_COLLATERAL', RENTAL_REFS.rt_019.pickupDateTime, STAFF_2)],
      odometer: 12500,
      fuelLevel: 6,
      cavetMediaMeta: [media('CAVET', RENTAL_REFS.rt_019.pickupDateTime, STAFF_2)],
    },
  })

  // ---- RETURNED (2) — Handover + Return. ----
  const ho020 = buildHandover({
    id: 'ho_005',
    rentalId: 'rt_020',
    odometerHandover: 59565,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
    checklistOverrides: { 'Lốp dự phòng': 'NOT_APPLICABLE' },
    preExistingConditionItems: [
      {
        id: generateId('cnd'),
        type: 'SCRATCH',
        position: 'Cản sau bên trái',
        description: 'Trầy nhẹ có sẵn trước khi giao, khách đã được thông báo.',
        severity: 'MINOR',
        mediaMeta: [media('CONDITION_ITEM', RENTAL_REFS.rt_020.pickupDateTime, STAFF_1)],
      },
    ],
  })
  const rr020Draft = buildReturn({
    id: 'rr_001',
    rentalId: 'rt_020',
    handoverRecordId: ho020.id,
    handover: ho020,
    odometerReturn: 61000, // = currentKm veh_009 — actualKm 1435, extraKm 35 → làm tròn 40 → 200.000đ (khớp Rental.additionalChargesAmount)
    fuelLevelReturn: 7,
    receivingStaffEmployeeId: STAFF_2,
    checklistOverrides: (draft) => {
      const [first, ...rest] = draft
      if (!first) return draft
      return [{ ...first, status: 'MISSING' as const, note: 'Không thấy trong cốp xe lúc nhận.' }, ...rest]
    },
  })
  // VR §14 — mục MISSING/DAMAGED tự gợi ý thêm 1 khoản MISSING_ACCESSORY (`suggestMissingAccessoryCharges()`), seed điền sẵn số tiền đã chốt với khách.
  const rr020: ReturnRecord = {
    ...rr020Draft,
    additionalCharges: [
      ...rr020Draft.additionalCharges,
      { id: generateId('chg'), type: 'MISSING_ACCESSORY', amount: 150000, note: `${rr020Draft.checklistComparison[0]?.itemName} — thiếu, đã trừ vào cọc.` },
    ],
  }

  const ho021 = buildHandover({
    id: 'ho_006',
    rentalId: 'rt_021',
    odometerHandover: 26100,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_2,
    motorbikeCollateral: {
      mediaMeta: [media('MOTORBIKE_COLLATERAL', RENTAL_REFS.rt_021.pickupDateTime, STAFF_2)],
      odometer: 9800,
      fuelLevel: 7,
      cavetMediaMeta: [media('CAVET', RENTAL_REFS.rt_021.pickupDateTime, STAFF_2)],
    },
  })
  const rr021 = buildReturn({
    id: 'rr_002',
    rentalId: 'rt_021',
    handoverRecordId: ho021.id,
    handover: ho021,
    odometerReturn: 27400, // = currentKm veh_005 — actualKm 1300 < allowedKm 1400 → không phụ phí, case sạch
    fuelLevelReturn: 8,
    receivingStaffEmployeeId: STAFF_1,
  })

  // ---- SETTLEMENT (2) — Handover + Return, kèm Additional Charge + 1 Incident Item mẫu. ----
  const ho022 = buildHandover({
    id: 'ho_007',
    rentalId: 'rt_022',
    odometerHandover: 14600,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
  })
  const rr022 = buildReturn({
    id: 'rr_003',
    rentalId: 'rt_022',
    handoverRecordId: ho022.id,
    handover: ho022,
    odometerReturn: 15600, // = currentKm veh_011 — actualKm 1000 < allowedKm 1400, không extra-km
    fuelLevelReturn: 5,
    receivingStaffEmployeeId: STAFF_2,
    // VR-BR-28 — thiếu nhiên liệu KHÔNG tự tính, nhân viên nhập tay (khớp Rental.additionalChargesAmount note "Nhiên liệu trả thiếu").
    extraCharges: [{ id: generateId('chg'), type: 'FUEL_DEFICIT', amount: 350000, note: 'Trả thiếu khoảng 1/3 bình so với lúc giao xe — nhân viên ước tính.' }],
    incidentItems: [
      {
        id: generateId('inc'),
        type: 'SCRATCH',
        position: 'Cản trước bên phải',
        description: 'Trầy nhẹ phát hiện khi nhận xe, không có baseline tương ứng.',
        baselineComparison: 'NEW',
        estimatedCost: 500000,
        affectsSafety: false,
        chargeApprovalStatus: 'PENDING_MANAGER_APPROVAL', // VR-BR-23 — hư hỏng nhẹ cần Manager duyệt trước khi chốt
        mediaMeta: [media('INCIDENT', RENTAL_REFS.rt_022.expectedReturnDateTime, STAFF_2, 'Ảnh cận cảnh vết trầy')],
        status: 'OPEN',
      },
    ],
  })

  const ho023 = buildHandover({
    id: 'ho_008',
    rentalId: 'rt_023',
    odometerHandover: 28800,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_2,
    motorbikeCollateral: {
      mediaMeta: [media('MOTORBIKE_COLLATERAL', RENTAL_REFS.rt_023.pickupDateTime, STAFF_2)],
      odometer: 11200,
      fuelLevel: 8,
      cavetMediaMeta: [media('CAVET', RENTAL_REFS.rt_023.pickupDateTime, STAFF_2)],
    },
  })
  const rr023 = buildReturn({
    id: 'rr_004',
    rentalId: 'rt_023',
    handoverRecordId: ho023.id,
    handover: ho023,
    odometerReturn: 29900, // = currentKm veh_012 — actualKm 1100 < allowedKm 1400, case sạch còn lại
    fuelLevelReturn: 8,
    receivingStaffEmployeeId: STAFF_1,
  })

  // ---- COMPLETED (3) — Handover + Return; rt_025 minh hoạ TRAFFIC_FINE, rt_026 minh hoạ OVERTIME. ----
  const ho024 = buildHandover({
    id: 'ho_009',
    rentalId: 'rt_024',
    odometerHandover: 39750,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
  })
  const rr024 = buildReturn({
    id: 'rr_005',
    rentalId: 'rt_024',
    handoverRecordId: ho024.id,
    handover: ho024,
    odometerReturn: 41000, // = currentKm veh_014 — actualKm 1250 < allowedKm 1400, case sạch
    fuelLevelReturn: 8,
    receivingStaffEmployeeId: STAFF_2,
  })

  const ho025 = buildHandover({
    id: 'ho_010',
    rentalId: 'rt_025',
    odometerHandover: 46800,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_2,
  })
  const rr025 = buildReturn({
    id: 'rr_006',
    rentalId: 'rt_025',
    handoverRecordId: ho025.id,
    handover: ho025,
    odometerReturn: 48200, // = currentKm veh_016 — actualKm 1400 = allowedKm đúng biên, không phụ phí extra-km
    fuelLevelReturn: 7,
    receivingStaffEmployeeId: STAFF_1,
    // Phạt nguội — nhập tay (VR-BR-13/14 N/A form Round 1, chỉ cấu trúc dữ liệu), khớp Rental.additionalChargesAmount note.
    extraCharges: [{ id: generateId('chg'), type: 'TRAFFIC_FINE', amount: 500000, note: 'Phí phạt nguội phát sinh, khách chưa thanh toán — nguồn gốc lý do khoá khách hàng.' }],
  })

  const ho026 = buildHandover({
    id: 'ho_011',
    rentalId: 'rt_026',
    odometerHandover: 44150,
    fuelLevelHandover: 8,
    deliveryStaffEmployeeId: STAFF_1,
    motorbikeCollateral: {
      mediaMeta: [media('MOTORBIKE_COLLATERAL', RENTAL_REFS.rt_026.pickupDateTime, STAFF_1)],
      odometer: 8500,
      fuelLevel: 8,
      cavetMediaMeta: [media('CAVET', RENTAL_REFS.rt_026.pickupDateTime, STAFF_1)],
    },
  })
  // Trễ 90 phút so với `expectedReturnDateTime` → bậc 30% đơn giá ngày (`calcOvertimeFee` gọi bên trong `buildBaselineAdditionalCharges`) — phát sinh mới tại Return, độc lập số tạm tính 0đ ở Rental.
  const rr026 = buildReturn({
    id: 'rr_007',
    rentalId: 'rt_026',
    handoverRecordId: ho026.id,
    handover: ho026,
    odometerReturn: 45200, // = currentKm veh_003 — actualKm 1050 < allowedKm 1400
    fuelLevelReturn: 8,
    receivingStaffEmployeeId: STAFF_2,
    actualReturnDateTime: addMinutesIso(RENTAL_REFS.rt_026.expectedReturnDateTime, 90),
  })

  // ---- CANCELLED (1) — Rental rt_027 huỷ trước khi thực hiện giao xe (pickup dự kiến vẫn ở tương lai). ----
  const cancelledAt = dt(-1, 10, 0)
  const cancelledHandover: HandoverRecord = {
    id: 'ho_012',
    rentalId: 'rt_027',
    status: 'CANCELLED',
    preExistingConditionItems: [],
    checklist: [],
    mediaMeta: [],
    customerAcknowledged: false,
    prepaymentConfirmed: false,
    fullPaymentConfirmed: false,
    cancelReason: 'Lượt thuê gốc đã bị huỷ trước khi thực hiện giao xe.',
    cancelledAt,
    cancelledByUserId: 'emp_admin',
    cancelledByName: 'Nguyễn Văn Admin',
    cancelledByRole: 'SYSTEM_ADMIN',
    createdAt: cancelledAt,
    updatedAt: cancelledAt,
  }

  writeJson(HANDOVER_RECORDS_STORAGE_KEY, [
    ho016,
    ho017,
    ho018,
    ho019,
    ho020,
    ho021,
    ho022,
    ho023,
    ho024,
    ho025,
    ho026,
    cancelledHandover,
  ])

  writeJson(RETURN_RECORDS_STORAGE_KEY, [rr020, rr021, rr022, rr023, rr024, rr025, rr026])
}

registerSeedStep(seedHandoverReturn)
