// `handover-return` — đọc trực tiếp `ReturnRecord` đã seed (qua
// `RETURN_RECORDS_STORAGE_KEY`) để lấy ĐÚNG id một `ReturnIncidentItem` có
// thật (không bịa id, DI-BR-14) — seed này chạy SAU `handover-return/seed`
// (`shared/fixtures/registerSeeds.ts`).
import { RETURN_RECORDS_STORAGE_KEY } from '@/features/handover-return/api'
import type { ReturnRecord } from '@/features/handover-return/model'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { INCIDENTS_STORAGE_KEY } from './api'
import { mapIncidentItemTypeToIncidentType, type Incident } from './model'
import type { MediaMeta } from '@/features/handover-return/model'

/** Mirror `dt()` của `handover-return/seed.ts` — tính ngày động từ hôm nay. */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function media(category: string, capturedAt: string, employeeId: string, note?: string): MediaMeta {
  return { id: generateId('med'), category, capturedAt, employeeId, note }
}

const STAFF_1 = 'emp_staff1' // Hoàng Văn Nhân Viên
const STAFF_2 = 'emp_staff2' // Vũ Thị Vận Hành
const MANAGER = 'emp_manager' // Trần Thị Quản Lý

/**
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §7 — phân bổ đủ 11 trạng thái để
 * test badge (1 mỗi trạng thái mainline + `CLOSED` x2 + 3 nhánh phụ chỉ seed
 * = 12 bản ghi, nhiều hơn khoảng gợi ý "8-10" của kế hoạch — ưu tiên phủ đủ
 * từng trạng thái cho mục đích test UI/badge hơn là bó đúng khoảng số lượng,
 * xem báo cáo bàn giao). Tham chiếu `vehicleId` thật (`vehicles/seed.ts`),
 * vài gắn `rentalId` thật từ Rental đã `IN_RENTAL`/`RETURNED`/`SETTLEMENT`/
 * `COMPLETED` (`rentals/seed.ts`).
 */
function seedIncidents(): void {
  // ---- 1. OPEN — STANDALONE, không gắn Rental. ----
  const inc001: Incident = {
    id: 'inc_001',
    incidentCode: 'SC-0001',
    vehicleId: 'veh_002',
    source: 'STANDALONE',
    reportedByUserId: STAFF_1,
    reportedByName: 'Hoàng Văn Nhân Viên',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: dt(-1, 10),
    type: 'FUNCTIONAL',
    severity: 'MODERATE',
    safetyImpact: false,
    location: 'Đèn pha bên trái',
    description: 'Khách báo đèn pha bên trái không sáng trong kỳ thuê, chưa kiểm tra kỹ nguyên nhân.',
    mediaMeta: [media('OTHER', dt(-1, 10), STAFF_1, 'Ảnh đèn pha khách gửi qua Zalo')],
    liability: 'UNDETERMINED',
    estimatedCost: 800000,
    status: 'OPEN',
    createdAt: dt(-1, 10),
    updatedAt: dt(-1, 10),
  }

  // ---- 2. ASSESSING — INSPECTION, không gắn Rental. ----
  const inc002: Incident = {
    id: 'inc_002',
    incidentCode: 'SC-0002',
    vehicleId: 'veh_004',
    source: 'INSPECTION',
    reportedByUserId: STAFF_2,
    reportedByName: 'Vũ Thị Vận Hành',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: dt(-3, 9),
    type: 'INTERIOR',
    severity: 'MINOR',
    safetyImpact: false,
    location: 'Ghế sau bên phải',
    description: 'Phát hiện vết bẩn lớn trên ghế sau khi kiểm tra xe định kỳ giữa 2 lượt thuê.',
    mediaMeta: [media('OTHER', dt(-3, 9), STAFF_2)],
    liability: 'UNDETERMINED',
    estimatedCost: 400000,
    status: 'ASSESSING',
    createdAt: dt(-3, 9),
    updatedAt: dt(-2, 14),
  }

  // ---- 3. WAITING_APPROVAL — STANDALONE, gắn Rental `RETURNED` (rt_021, veh_005). ----
  const inc003: Incident = {
    id: 'inc_003',
    incidentCode: 'SC-0003',
    vehicleId: 'veh_005',
    rentalId: 'rt_021',
    source: 'STANDALONE',
    reportedByUserId: STAFF_1,
    reportedByName: 'Hoàng Văn Nhân Viên',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: dt(-1, 15),
    type: 'FUNCTIONAL',
    severity: 'MAJOR',
    safetyImpact: false,
    location: 'Hệ thống điều hoà',
    description: 'Khách phản hồi sau khi trả xe: điều hoà yếu hơi lạnh suốt kỳ thuê, nghi do thiếu gas — nhân viên ghi nhận lại để đánh giá.',
    mediaMeta: [],
    liability: 'CUSTOMER',
    estimatedCost: 3500000, // > APPROVAL_THRESHOLD (2.000.000đ) → WAITING_APPROVAL (DI-BR-08)
    customerCharge: 3500000,
    companyCost: 0,
    insuranceCovered: 0,
    status: 'WAITING_APPROVAL',
    createdAt: dt(-1, 15),
    updatedAt: dt(0, 9),
  }

  // ---- 4. APPROVED — STANDALONE, gắn Rental `SETTLEMENT` (rt_023, veh_012). ----
  const inc004: Incident = {
    id: 'inc_004',
    incidentCode: 'SC-0004',
    vehicleId: 'veh_012',
    rentalId: 'rt_023',
    source: 'STANDALONE',
    reportedByUserId: STAFF_2,
    reportedByName: 'Vũ Thị Vận Hành',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: dt(-6, 11),
    type: 'EXTERIOR',
    severity: 'MODERATE',
    safetyImpact: false,
    location: 'Cản trước bên phải',
    description: 'Khách báo trầy nhẹ cản trước giữa kỳ thuê, mức độ nhỏ, khách tự nhận.',
    mediaMeta: [media('OTHER', dt(-6, 11), STAFF_2)],
    liability: 'CUSTOMER',
    estimatedCost: 700000, // ≤ APPROVAL_THRESHOLD → APPROVED trực tiếp
    customerCharge: 700000,
    companyCost: 0,
    insuranceCovered: 0,
    status: 'APPROVED',
    createdAt: dt(-6, 11),
    updatedAt: dt(-5, 10),
  }

  // ---- 5. IN_REPAIR — STANDALONE, không gắn Rental (công ty tự phát hiện). ----
  const inc005RepairStart = dt(-2, 9)
  const inc005: Incident = {
    id: 'inc_005',
    incidentCode: 'SC-0005',
    vehicleId: 'veh_006',
    source: 'STANDALONE',
    reportedByUserId: MANAGER,
    reportedByName: 'Trần Thị Quản Lý',
    reportedByRole: 'MANAGER',
    reportedAt: dt(-3, 8),
    type: 'FUNCTIONAL',
    severity: 'MAJOR',
    safetyImpact: true,
    location: 'Hệ thống phanh',
    description: 'Phát hiện phanh có tiếng kêu lạ, nghi hao mòn má phanh, đưa vào garage kiểm tra trước khi cho thuê tiếp.',
    mediaMeta: [media('OTHER', dt(-3, 8), MANAGER)],
    liability: 'COMPANY',
    estimatedCost: 5000000,
    customerCharge: 0,
    companyCost: 5000000,
    insuranceCovered: 0,
    repairVendorName: 'Garage Thiên Long',
    repairStartDate: inc005RepairStart,
    status: 'IN_REPAIR',
    createdAt: dt(-3, 8),
    updatedAt: inc005RepairStart,
  }

  // ---- 6. REPAIRED — STANDALONE, gắn Rental `COMPLETED` (rt_024, veh_014). ----
  const inc006RepairStart = dt(-5, 9)
  const inc006RepairEnd = dt(-3, 17)
  const inc006: Incident = {
    id: 'inc_006',
    incidentCode: 'SC-0006',
    vehicleId: 'veh_014',
    rentalId: 'rt_024',
    source: 'STANDALONE',
    reportedByUserId: STAFF_1,
    reportedByName: 'Hoàng Văn Nhân Viên',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: dt(-7, 10),
    type: 'EXTERIOR',
    severity: 'MODERATE',
    safetyImpact: false,
    location: 'Gương chiếu hậu bên trái',
    description: 'Khách báo gương bị nứt nhẹ trong kỳ thuê, đã xác nhận khách gây ra.',
    mediaMeta: [media('OTHER', dt(-7, 10), STAFF_1)],
    liability: 'CUSTOMER',
    estimatedCost: 1200000,
    customerCharge: 1200000,
    companyCost: 0,
    insuranceCovered: 0,
    actualCostParts: 900000,
    actualCostLabor: 300000,
    actualCostOther: 0,
    repairVendorName: 'Garage Thiên Long',
    repairStartDate: inc006RepairStart,
    repairEndDate: inc006RepairEnd,
    repairInvoiceMeta: media('OTHER', inc006RepairEnd, MANAGER, 'Hoá đơn garage số HD-2201'),
    status: 'REPAIRED',
    createdAt: dt(-7, 10),
    updatedAt: inc006RepairEnd,
  }

  // ---- 7. CLOSED #1 — STANDALONE, gắn Rental `COMPLETED` (rt_025, veh_016). ----
  const inc007Day = dt(-9, 9)
  const inc007Closed = dt(-8, 10)
  const inc007: Incident = {
    id: 'inc_007',
    incidentCode: 'SC-0007',
    vehicleId: 'veh_016',
    rentalId: 'rt_025',
    source: 'STANDALONE',
    reportedByUserId: STAFF_2,
    reportedByName: 'Vũ Thị Vận Hành',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: inc007Day,
    type: 'ACCESSORY',
    severity: 'MINOR',
    safetyImpact: false,
    location: 'Khoang để đồ',
    description: 'Khách báo mất sạc dự phòng theo xe sau khi trả xe vài ngày, xác nhận qua trao đổi Zalo.',
    mediaMeta: [],
    liability: 'CUSTOMER',
    estimatedCost: 300000,
    customerCharge: 300000,
    companyCost: 0,
    insuranceCovered: 0,
    actualCostParts: 300000,
    actualCostLabor: 0,
    actualCostOther: 0,
    repairVendorName: 'Mua mới trực tiếp (không qua garage)',
    repairStartDate: inc007Day,
    repairEndDate: inc007Day,
    repairInvoiceMeta: media('OTHER', inc007Day, STAFF_2, 'Biên nhận mua sạc dự phòng thay thế'),
    status: 'CLOSED',
    closedAt: inc007Closed,
    createdAt: inc007Day,
    updatedAt: inc007Closed,
  }

  // ---- 8. CLOSED #2 — source=RETURN, kế thừa đúng 1 ReturnIncidentItem có thật (rr_003, DI-BR-14). ----
  const returns = readJson<ReturnRecord[]>(RETURN_RECORDS_STORAGE_KEY) ?? []
  const rr022 = returns.find((r) => r.id === 'rr_003')
  const returnItem = rr022?.incidentItems[0]
  const incidentsToSeed: Incident[] = [inc001, inc002, inc003, inc004, inc005, inc006, inc007]

  if (rr022 && returnItem) {
    const closedAt = dt(-11, 9)
    const inc008: Incident = {
      id: 'inc_008',
      incidentCode: 'SC-0008',
      vehicleId: 'veh_011', // rt_022 → veh_011 (`rentals/seed.ts`)
      rentalId: rr022.rentalId,
      source: 'RETURN',
      reportedByUserId: STAFF_2, // = receivingStaffEmployeeId của rr_003 (`handover-return/seed.ts`)
      reportedByName: 'Vũ Thị Vận Hành',
      reportedByRole: 'OPERATION_STAFF',
      reportedAt: rr022.createdAt,
      type: mapIncidentItemTypeToIncidentType(returnItem.type),
      severity: 'MINOR',
      safetyImpact: returnItem.affectsSafety,
      location: returnItem.position,
      description: returnItem.description,
      mediaMeta: returnItem.mediaMeta,
      baselineReference: returnItem.baselineComparison,
      liability: 'CUSTOMER',
      estimatedCost: returnItem.estimatedCost,
      customerCharge: returnItem.estimatedCost,
      companyCost: 0,
      insuranceCovered: 0,
      actualCostParts: returnItem.estimatedCost,
      actualCostLabor: 0,
      actualCostOther: 0,
      repairVendorName: 'Garage Thiên Long',
      repairStartDate: rr022.createdAt,
      repairEndDate: closedAt,
      repairInvoiceMeta: media('OTHER', closedAt, MANAGER, 'Hoá đơn garage số HD-2187'),
      status: 'CLOSED',
      closedAt,
      returnRecordId: rr022.id,
      returnIncidentItemId: returnItem.id,
      createdAt: rr022.createdAt,
      updatedAt: closedAt,
    }
    incidentsToSeed.push(inc008)
  }

  // ---- 9. CANCELLED — STANDALONE, không gắn Rental (ghi nhận nhầm). ----
  const inc009At = dt(-4, 14)
  const inc009: Incident = {
    id: 'inc_009',
    incidentCode: 'SC-0009',
    vehicleId: 'veh_008',
    source: 'STANDALONE',
    reportedByUserId: STAFF_1,
    reportedByName: 'Hoàng Văn Nhân Viên',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: inc009At,
    type: 'OTHER',
    severity: 'MINOR',
    safetyImpact: false,
    location: 'Toàn xe',
    description: 'Nhân viên báo nhầm vết bẩn là hư hỏng, kiểm tra lại thì chỉ là bụi bẩn thông thường.',
    mediaMeta: [],
    liability: 'UNDETERMINED',
    estimatedCost: 0,
    status: 'CANCELLED',
    cancelReason: 'Ghi nhận nhầm — không phải hư hỏng thực tế (EX-01, `DamageIncident-BRD.md` §23).',
    createdAt: inc009At,
    updatedAt: dt(-4, 15),
  }

  // ---- 10. DISPUTED — STANDALONE, gắn Rental `COMPLETED` (rt_026, veh_003). ----
  const inc010At = dt(-12, 9)
  const inc010: Incident = {
    id: 'inc_010',
    incidentCode: 'SC-0010',
    vehicleId: 'veh_003',
    rentalId: 'rt_026',
    source: 'STANDALONE',
    reportedByUserId: STAFF_2,
    reportedByName: 'Vũ Thị Vận Hành',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: inc010At,
    type: 'EXTERIOR',
    severity: 'MODERATE',
    safetyImpact: false,
    location: 'Cánh cửa sau bên trái',
    description: 'Phát hiện trầy xước cánh cửa sau khi nhận lại xe, lập biên bản thu phụ thu.',
    mediaMeta: [media('OTHER', inc010At, STAFF_2)],
    liability: 'CUSTOMER',
    estimatedCost: 900000,
    customerCharge: 900000,
    companyCost: 0,
    insuranceCovered: 0,
    status: 'DISPUTED',
    disputeNote: 'Khách phản đối qua Zalo sau khi nhận thông báo phụ thu, cho rằng vết trầy đã có từ trước. Manager đang thu thập bằng chứng đối chiếu baseline Handover (UC-DI-12).',
    createdAt: inc010At,
    updatedAt: dt(-10, 9),
  }

  // ---- 11. WRITTEN_OFF — INSPECTION, không gắn Rental. ----
  const inc011At = dt(-20, 9)
  const inc011: Incident = {
    id: 'inc_011',
    incidentCode: 'SC-0011',
    vehicleId: 'veh_013',
    source: 'INSPECTION',
    reportedByUserId: MANAGER,
    reportedByName: 'Trần Thị Quản Lý',
    reportedByRole: 'MANAGER',
    reportedAt: inc011At,
    type: 'HYGIENE',
    severity: 'MINOR',
    safetyImpact: false,
    location: 'Nội thất ghế lái',
    description: 'Vết bẩn cũ không thể xử lý triệt để, công ty quyết định không sửa, chấp nhận giảm giá trị xe khi thanh lý.',
    mediaMeta: [],
    liability: 'COMPANY',
    estimatedCost: 1500000,
    customerCharge: 0,
    companyCost: 1500000,
    insuranceCovered: 0,
    status: 'WRITTEN_OFF',
    writeOffReason: 'Không sửa, chấp nhận giảm giá trị xe khi thanh lý (EX-03, `DamageIncident-BRD.md` §23).',
    createdAt: inc011At,
    updatedAt: dt(-18, 9),
  }

  // ---- 12. CLOSED_NO_ACTION — INSPECTION, không gắn Rental. ----
  const inc012At = dt(-15, 9)
  const inc012: Incident = {
    id: 'inc_012',
    incidentCode: 'SC-0012',
    vehicleId: 'veh_015',
    source: 'INSPECTION',
    reportedByUserId: STAFF_1,
    reportedByName: 'Hoàng Văn Nhân Viên',
    reportedByRole: 'OPERATION_STAFF',
    reportedAt: inc012At,
    type: 'EXTERIOR',
    severity: 'MINOR',
    safetyImpact: false,
    location: 'Cản sau',
    description: 'Trầy xước rất nhỏ phát hiện khi kiểm tra định kỳ, Manager quyết định không sửa và không tính phí.',
    mediaMeta: [],
    liability: 'COMPANY',
    estimatedCost: 0,
    customerCharge: 0,
    companyCost: 0,
    insuranceCovered: 0,
    status: 'CLOSED_NO_ACTION',
    closedNoActionReason: 'Hư hỏng nhỏ, không sửa, không tính phí (EX-02, `DamageIncident-BRD.md` §23).',
    closedAt: dt(-15, 10),
    createdAt: inc012At,
    updatedAt: dt(-15, 10),
  }

  incidentsToSeed.push(inc009, inc010, inc011, inc012)
  writeJson(INCIDENTS_STORAGE_KEY, incidentsToSeed)
}

registerSeedStep(seedIncidents)
