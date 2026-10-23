// Module Revenue & Cost (RV) — lõi hàm thuần + form Cost Record. Tách từ `finance/model.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.1.
import { addDaysToKey, addMonthsToKey, dayDiff, eachDayKey, endOfMonthKey, startOfMonthKey, startOfWeekKey, toDateKey, toMonthKey, todayKey as currentDateKey } from '@/shared/lib/datetime'
import { z } from 'zod'
import type { OwnerPayoutRecord } from '@/features/consignment'
import type { Incident } from '@/features/incidents'
import type { VehicleBlock } from '@/features/calendar'
import type { MaintenanceRecord, SparePartRecord } from '@/features/maintenance'
import type { Rental } from '@/features/rentals'
// CHỈ `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel, REVENUE-COST-PLAN.md §0.2).
import type { Vehicle } from '@/features/vehicles'
import {
  type AllocationType,
  type CostCategory,
  type CostRecordStatus,
  type CostSource,
  type CustomerStatus,
  type PaymentMethod,
  type PostSettlementChargeSource,
  type RevenueCategory,
  type RevenueLineNature,
  type RevenueRecognitionPolicy,
  type Role,
  type SettlementLineCategory,
  type TransactionDirection,
  type TransactionType,
  ALLOCATION_TYPES,
  COST_CATEGORIES,
} from '@/shared/domain/enums'
import { NUMERIC_RE } from '../core/model.ts'
import type { PostSettlementCharge, Settlement, Transaction } from '../core/types.ts'
import { isEffectiveTransaction, type CustomerBalance } from '../payment/model.ts'

// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §2-§3 ====

/** `RevenueCost-BRD.md` §7, CR-2026-048 — chính sách ghi nhận doanh thu cố định `ON_SETTLEMENT` (không có màn cấu hình). */
export const REVENUE_RECOGNITION_POLICY: RevenueRecognitionPolicy = 'ON_SETTLEMENT'

/**
 * Dòng doanh thu — `RevenueCost-BRD.md` §6.1. View SUY RA từ `settlements` + `postSettlementCharges`
 * (không lưu — REVENUE-COST-PLAN.md §0.3 điểm 1). `amount` có dấu: dòng giảm trừ/đảo là số âm.
 */
export interface RevenueLine {
  /** Tất định (§0.3 điểm 3) — không `generateId()` vì không lưu. */
  id: string
  category: RevenueCategory
  amount: number
  nature: RevenueLineNature
  /** ISO — `completedAt` / `reversedAt` / `psc.createdAt`. */
  recognitionDate: string
  /** BRD §6.1 "Adjustment?" — `true` với dòng PSC và dòng `REVERSAL`. */
  isAdjustment: boolean
  rentalId: string
  vehicleId: string
  customerId: string
  sourceType: 'SETTLEMENT' | 'POST_SETTLEMENT_CHARGE'
  sourceId: string
  settlementLineId?: string
  waiverId?: string
  reversalId?: string
  note?: string
}

/** Cost Record nhập tay — `RevenueCost-BRD.md` §6.2/§18, storage key `costRecords`. Chỉ `Source = MANUAL` được lưu (§0.3 điểm 4). */
export interface CostRecord {
  id: string
  /** `CP-000001` tuần tự. */
  code: string
  /** RV-BR-04 / RV-BR-19 — chỉ thuộc `MANUAL_COST_CATEGORIES`. */
  category: CostCategory
  /** Số nguyên dương (đồng). */
  amount: number
  /** `YYYY-MM-DD`. */
  costDate: string
  allocationType: AllocationType
  /** Bắt buộc khi `DIRECT`, cấm khi `INDIRECT`. */
  vehicleId?: string
  rentalId?: string
  /** 1..36 — 1 = không rải (§0.3 điểm 5). */
  spreadMonths: number
  /** EX-04 — "chi phí bất thường / một lần". */
  isUnusual: boolean
  evidenceNote?: string
  note?: string
  status: CostRecordStatus
  reverseReason?: string
  reversedByName?: string
  reversedAt?: string
  enteredByName: string
  enteredByRole: Role
  enteredAt: string
  updatedByName?: string
  updatedAt: string
}

/** View thống nhất cho phân tích (MANUAL + INCIDENT + SYSTEM) — KHÔNG lưu (§2.3). */
export interface CostEntry {
  id: string
  category: CostCategory
  allocationType: AllocationType
  amount: number
  /** `YYYY-MM-DD`. */
  costDate: string
  vehicleId?: string
  rentalId?: string
  source: CostSource
  sourceRef: {
    costRecordId?: string
    incidentId?: string
    maintenanceRecordId?: string
    sparePartRecordId?: string
    ownerPayoutRecordId?: string
    consignmentContractId?: string
  }
  sourceLabel: string
  isUnusual: boolean
  /** Chỉ khi `spreadMonths > 1`. */
  slice?: { index: number; total: number }
}

/** Dòng thực thu/thực chi suy ra từ sổ giao dịch — RV-BR-14 (§0.3 điểm 6). */
export interface CashEntry {
  transactionId: string
  code: string
  /** ISO = `confirmedAt ?? performedAt`. */
  date: string
  direction: TransactionDirection
  /** IN dương, OUT âm. */
  signedAmount: number
  type: TransactionType
  method: PaymentMethod
  rentalId?: string
  /** Giao dịch chi trả chủ xe (`OWNER_PAYOUT`) không có khách hàng (PM-BR-24). */
  customerId?: string
  revenueRelated: boolean
}

/** Kỳ phân tích theo ngày địa phương, gồm cả 2 đầu — REVENUE-COST-PLAN.md §0.3 điểm 9. */
export interface FinancePeriod {
  from: string
  to: string
}

/** Hằng số UI (không phải enum nghiệp vụ nên không đặt ở `enums.ts`). */
export const FINANCE_PERIOD_PRESETS = ['THIS_MONTH', 'LAST_MONTH', 'LAST_30_DAYS', 'THIS_QUARTER', 'THIS_YEAR', 'LAST_12_MONTHS', 'CUSTOM'] as const
export type FinancePeriodPreset = (typeof FINANCE_PERIOD_PRESETS)[number]

/** Lựa chọn kỳ đang áp dụng ở UI: preset + khoảng ngày cụ thể (`CUSTOM` giữ khoảng người dùng nhập). */
export interface PeriodSelection {
  preset: FinancePeriodPreset
  period: FinancePeriod
}

/** `RevenueCost-BRD.md` §14 — "quý" phủ bằng preset kỳ. */
export type ReportGranularity = 'DAY' | 'WEEK' | 'MONTH'

export type ManualCostCategory = Exclude<CostCategory, 'INCIDENT' | 'CONSIGNMENT_PAYOUT'>

/** RV-BR-04 (INCIDENT lấy tự động từ Damage & Incident) + RV-BR-19 (CONSIGNMENT_PAYOUT lấy từ Owner Payout) — không nhập tay. */
export const MANUAL_COST_CATEGORIES: readonly ManualCostCategory[] = COST_CATEGORIES.filter(
  (c): c is ManualCostCategory => c !== 'INCIDENT' && c !== 'CONSIGNMENT_PAYOUT',
)

export function isManualCostCategory(value: string): value is ManualCostCategory {
  return (MANUAL_COST_CATEGORIES as readonly string[]).includes(value)
}

// ---- Kỳ phân tích (§3.3) ----

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Ngày đầu / cuối quý chứa `key` (quý lịch: 1–3, 4–6, 7–9, 10–12). */
export function quarterRange(key: string): { from: string; to: string } {
  const quarterFirstMonth = Math.floor((Number(key.slice(5, 7)) - 1) / 3) * 3 + 1 // date key — không phụ thuộc múi giờ
  const from = `${key.slice(0, 4)}-${String(quarterFirstMonth).padStart(2, '0')}-01`
  return { from, to: endOfMonthKey(addMonthsToKey(from, 2)) }
}

export function yearRange(key: string): { from: string; to: string } {
  const year = key.slice(0, 4) // date key — không phụ thuộc múi giờ
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** RV-BR-03 — chỉ so theo `Recognition Date`/`Cost Date`, KHÔNG dùng `createdAt`. */
export function isDateInPeriod(value: string, period: FinancePeriod): boolean {
  const key = toDateKey(value)
  return key >= period.from && key <= period.to
}

export function resolvePeriodPreset(preset: FinancePeriodPreset, today: Date = new Date()): FinancePeriod {
  const t = toDateKey(today)
  switch (preset) {
    case 'LAST_MONTH': {
      const last = addMonthsToKey(t, -1)
      return { from: startOfMonthKey(last), to: endOfMonthKey(last) }
    }
    case 'LAST_30_DAYS':
      return { from: addDaysToKey(t, -29), to: t }
    case 'THIS_QUARTER':
      return quarterRange(t)
    case 'THIS_YEAR':
      return yearRange(t)
    case 'LAST_12_MONTHS':
      return { from: startOfMonthKey(addMonthsToKey(t, -11)), to: endOfMonthKey(t) }
    case 'THIS_MONTH':
    case 'CUSTOM':
    default:
      return { from: startOfMonthKey(t), to: endOfMonthKey(t) }
  }
}

export function initialPeriodSelection(preset: FinancePeriodPreset): PeriodSelection {
  return { preset, period: resolvePeriodPreset(preset) }
}

/** BRD §14 "so với kỳ trước" — cùng độ dài, liền trước. */
export function previousPeriod(period: FinancePeriod): FinancePeriod {
  const length = dayDiff(period.from, period.to) + 1
  const prevTo = addDaysToKey(period.from, -1)
  return { from: addDaysToKey(prevTo, -(length - 1)), to: prevTo }
}

/** Khoá nhóm theo độ chi tiết: ngày `yyyy-MM-dd` · tuần ISO bắt đầu thứ Hai (khoá = ngày thứ Hai) · tháng `yyyy-MM`. */
export function bucketKeyOf(value: string, granularity: ReportGranularity): string {
  const key = toDateKey(value)
  if (granularity === 'DAY') return key
  if (granularity === 'MONTH') return toMonthKey(key)
  return startOfWeekKey(key, 1)
}

export function enumeratePeriodBuckets(period: FinancePeriod, granularity: ReportGranularity): string[] {
  const keys: string[] = []
  for (const day of eachDayKey(period.from, period.to)) {
    const key = bucketKeyOf(day, granularity)
    if (keys[keys.length - 1] !== key) keys.push(key)
  }
  return keys
}

/** Số ngày lịch chung của hai đoạn `[aFrom,aTo]` ∩ `[bFrom,bTo]` (khoá `yyyy-MM-dd`, gồm 2 đầu); 0 nếu không giao nhau. */
function overlapDays(aFrom: string, aTo: string, bFrom: string, bTo: string): number {
  const from = aFrom > bFrom ? aFrom : bFrom
  const to = aTo < bTo ? aTo : bTo
  if (from > to) return 0
  return dayDiff(from, to) + 1
}

// ---- Doanh thu (§3.1) ----

/** RV-BR-05 — nhóm `*_RECOVERY` là doanh thu thu hồi (gross), không trừ chi phí; ánh xạ khoản mục quyết toán → danh mục doanh thu (§0.4 điểm 9). */
export const SETTLEMENT_TO_REVENUE_CATEGORY: Record<SettlementLineCategory, RevenueCategory> = {
  BASE_RENTAL: 'BASE_RENTAL',
  CONTRACT_DISCOUNT: 'BASE_RENTAL',
  EXTRA_KM: 'EXTRA_KM',
  FUEL_DEFICIT: 'FUEL',
  OVERTIME: 'OVERTIME',
  DELIVERY_FEE: 'DELIVERY_FEE',
  DAMAGE: 'DAMAGE_RECOVERY',
  INCIDENT: 'DAMAGE_RECOVERY',
  MISSING_ACCESSORY: 'DAMAGE_RECOVERY',
  VETC: 'VETC_RECOVERY',
  TRAFFIC_FINE: 'FINE_RECOVERY',
  RETURN_DISCOUNT: 'OTHER',
  RETURN_OTHER: 'OTHER',
  MANUAL_OTHER: 'OTHER',
}

/** RV-BR-05 — khoản phát sinh sau quyết toán → danh mục doanh thu thu hồi. */
export const PSC_SOURCE_TO_REVENUE_CATEGORY: Record<PostSettlementChargeSource, RevenueCategory> = {
  TRAFFIC_FINE: 'FINE_RECOVERY',
  VETC: 'VETC_RECOVERY',
  INCIDENT: 'DAMAGE_RECOVERY',
  ADJUSTMENT: 'OTHER',
  OTHER: 'OTHER',
}

type RevenueSettlementSource = Pick<Settlement, 'id' | 'rentalId' | 'vehicleId' | 'customerId' | 'lines' | 'waivers'>

/**
 * Dòng doanh thu của MỘT bản quyết toán — lọc ĐÚNG như `calcSettlementTotals()` để
 * Σ dòng = `completedTotals.finalAmount`. RV-BR-06: miễn giảm làm giảm doanh thu, hiện thành dòng riêng.
 */
export function buildSettlementRevenueLines(settlement: RevenueSettlementSource, recognitionDate: string, idScope: string): RevenueLine[] {
  const common = {
    recognitionDate,
    isAdjustment: false,
    rentalId: settlement.rentalId,
    vehicleId: settlement.vehicleId,
    customerId: settlement.customerId,
    sourceType: 'SETTLEMENT' as const,
    sourceId: settlement.id,
    reversalId: idScope === 'current' ? undefined : idScope,
  }
  const idPrefix = `rvl:${settlement.id}:${idScope}`
  const lines: RevenueLine[] = []
  const categoryByLineId = new Map(settlement.lines.map((l) => [l.id, SETTLEMENT_TO_REVENUE_CATEGORY[l.category]]))

  for (const line of settlement.lines) {
    const category = SETTLEMENT_TO_REVENUE_CATEGORY[line.category]
    const actual = line.actualAmount ?? 0
    const note = line.note ?? line.reason
    if (line.direction === 'CHARGE' && (line.status === 'CONFIRMED' || line.status === 'WAIVED')) {
      lines.push({ ...common, id: `${idPrefix}:${line.id}`, category, amount: actual, nature: 'CHARGE', settlementLineId: line.id, note })
      // AC-RV-002 — dòng được miễn giữ số gốc và thêm dòng giảm trừ cùng danh mục.
      if (line.status === 'WAIVED') {
        lines.push({ ...common, id: `${idPrefix}:${line.id}:waived`, category, amount: -actual, nature: 'REDUCTION', settlementLineId: line.id, note })
      }
    } else if (line.direction === 'DISCOUNT' && line.status === 'CONFIRMED') {
      lines.push({ ...common, id: `${idPrefix}:${line.id}`, category, amount: -actual, nature: 'REDUCTION', settlementLineId: line.id, note })
    }
  }

  for (const waiver of settlement.waivers) {
    // `WAIVE_LINE` đã tính qua dòng `WAIVED` — bỏ để không tính trùng (mirror `calcSettlementTotals`).
    if (waiver.type === 'WAIVE_LINE') continue
    if (waiver.status !== 'APPROVED' && waiver.status !== 'PENDING_APPROVAL') continue
    const category = (waiver.lineId ? categoryByLineId.get(waiver.lineId) : undefined) ?? 'OTHER'
    lines.push({ ...common, id: `${idPrefix}:${waiver.id}`, category, amount: -waiver.amount, nature: 'REDUCTION', settlementLineId: waiver.lineId, waiverId: waiver.id, note: waiver.reason })
  }
  return lines
}

/**
 * CR-2026-048 / `RevenueCost-BRD.md` §7 — `ON_SETTLEMENT`: Recognition Date = `completedAt`.
 * EX-02 (đảo quyết toán): giữ nguyên dòng kỳ gốc (từ `reversals[].snapshot`), thêm dòng đối ứng âm ở kỳ đảo,
 * quyết toán lại sinh dòng mới. PSC: RV-BR-07 — ghi nhận theo ngày tạo PSC, kỳ gốc không đổi (AC-RV-007).
 * TODO(OQ: RevenueCost-BRD.md §28 Q12 — nợ xấu EX-06: Settlement completedWithDebt vẫn ghi nhận đủ doanh thu, chưa có chính sách giảm trừ.)
 */
export function deriveRevenueLines(settlements: Settlement[], pscs: PostSettlementCharge[]): RevenueLine[] {
  const result: RevenueLine[] = []
  for (const settlement of settlements) {
    for (const reversal of settlement.reversals ?? []) {
      const snapshot = reversal.snapshot
      if (!snapshot.completedAt) continue
      const original = buildSettlementRevenueLines(snapshot, snapshot.completedAt, reversal.id)
      result.push(...original)
      for (const line of original) {
        result.push({ ...line, id: `${line.id}:rev`, amount: -line.amount, nature: 'REVERSAL', recognitionDate: reversal.reversedAt, isAdjustment: true, note: reversal.reason })
      }
    }
    if (settlement.status === 'COMPLETED' && settlement.completedAt) {
      result.push(...buildSettlementRevenueLines(settlement, settlement.completedAt, 'current'))
    }
  }
  for (const psc of pscs) {
    // TODO(OQ: RevenueCost-BRD.md RV-BR-07 / RentalSettlement-UseCase.md UC-RS-14 A1 / RentalSettlement-BRD.md §28 Q13 — PSC "Tạm giữ" (sự cố DISPUTED) có hoãn ghi nhận doanh thu không; demo ghi tại psc.createdAt — REVENUE-COST-PLAN.md §0.4 điểm 18)
    result.push({
      id: `rvl:psc:${psc.id}`,
      category: PSC_SOURCE_TO_REVENUE_CATEGORY[psc.source],
      amount: psc.type === 'RECEIVABLE' ? psc.amount : -psc.amount,
      nature: psc.type === 'RECEIVABLE' ? 'CHARGE' : 'REDUCTION',
      recognitionDate: psc.createdAt,
      isAdjustment: true,
      rentalId: psc.rentalId,
      vehicleId: psc.vehicleId,
      customerId: psc.customerId,
      sourceType: 'POST_SETTLEMENT_CHARGE',
      sourceId: psc.id,
      note: psc.reason,
    })
  }
  return result
}

/** Σ dòng doanh thu của bản quyết toán HIỆN TẠI phải bằng `completedTotals.finalAmount` (dùng để cảnh báo lệch nguồn). */
export function checkSettlementRevenueReconciliation(settlement: Settlement, lines: RevenueLine[]): { expected: number; recognized: number; diff: number } {
  const expected = settlement.status === 'COMPLETED' ? (settlement.completedTotals?.finalAmount ?? 0) : 0
  const recognized = lines.filter((l) => l.sourceType === 'SETTLEMENT' && l.sourceId === settlement.id && !l.reversalId).reduce((sum, l) => sum + l.amount, 0)
  return { expected, recognized, diff: recognized - expected }
}

// ---- Chi phí (§3.2) ----

/** AC-RV-004 / BRD §28 Q6 (CR-2026-048) — rải đều theo tháng: chia nguyên, phần dư dồn lát cuối; bản `REVERSED` không sinh lát. */
export function expandCostRecord(record: CostRecord): CostEntry[] {
  if (record.status !== 'ACTIVE') return []
  const total = Math.max(1, record.spreadMonths)
  const perSlice = Math.floor(record.amount / total)
  const entries: CostEntry[] = []
  for (let index = 0; index < total; index += 1) {
    entries.push({
      id: `cst:${record.id}:${index}`,
      category: record.category,
      allocationType: record.allocationType,
      amount: index === total - 1 ? record.amount - perSlice * (total - 1) : perSlice,
      costDate: addMonthsToKey(toDateKey(record.costDate), index),
      vehicleId: record.vehicleId,
      rentalId: record.rentalId,
      source: 'MANUAL',
      sourceRef: { costRecordId: record.id },
      sourceLabel: record.code,
      isUnusual: record.isUnusual,
      slice: total > 1 ? { index: index + 1, total } : undefined,
    })
  }
  return entries
}

/** Sự cố đã chốt phần công ty chịu — loại OPEN/ASSESSING/WAITING_APPROVAL (chưa chốt), DISPUTED, CANCELLED/CLOSED_NO_ACTION (§0.4 điểm 10). */
const INCIDENT_COST_STATUSES: Incident['status'][] = ['APPROVED', 'IN_REPAIR', 'REPAIRED', 'CLOSED', 'WRITTEN_OFF']

/** Sự cố có được tính vào chi phí `INCIDENT` không — đã chốt phần công ty chịu (`INCIDENT_COST_STATUSES`) và `companyCost > 0`. Dùng chung cho `deriveIncidentCostEntries` và Report 04. */
export function isIncidentCostCounted(incident: Incident): boolean {
  return INCIDENT_COST_STATUSES.includes(incident.status) && (incident.companyCost ?? 0) > 0
}

/**
 * RV-BR-04 / RV-BR-11 / DI-BR-18 — Company Cost của sự cố tự chuyển thành chi phí `INCIDENT`, sửa ở module nguồn.
 * TODO(OQ: RevenueCost-UseCase.md UC-RV-02 bước 2 — Cost Date = ngày chốt hay ngày phát sinh; demo dùng reportedAt)
 */
export function deriveIncidentCostEntries(incidents: Incident[]): CostEntry[] {
  return incidents
    .filter(isIncidentCostCounted)
    .map(
      (i): CostEntry => ({
        id: `inc:${i.id}`,
        category: 'INCIDENT',
        allocationType: 'DIRECT',
        amount: i.companyCost ?? 0,
        costDate: toDateKey(i.reportedAt),
        vehicleId: i.vehicleId,
        rentalId: i.rentalId,
        source: 'INCIDENT',
        sourceRef: { incidentId: i.id },
        sourceLabel: i.incidentCode,
        isUnusual: false,
      }),
    )
}

/** RV-BR-11 — bảo dưỡng + phụ tùng (WebappQuanTri.md §6.5) → `MAINTENANCE`, `Source = SYSTEM`; bỏ bản ghi `cost ≤ 0`. */
export function deriveMaintenanceCostEntries(records: MaintenanceRecord[], spareParts: SparePartRecord[]): CostEntry[] {
  const fromRecords = records
    .filter((r) => r.cost > 0)
    .map(
      (r): CostEntry => ({
        id: `mtr:${r.id}`,
        category: 'MAINTENANCE',
        allocationType: 'DIRECT',
        amount: r.cost,
        costDate: toDateKey(r.date),
        vehicleId: r.vehicleId,
        source: 'SYSTEM',
        sourceRef: { maintenanceRecordId: r.id },
        sourceLabel: r.category,
        isUnusual: false,
      }),
    )
  const fromParts = spareParts
    .filter((r) => r.cost > 0)
    .map(
      (r): CostEntry => ({
        id: `spr:${r.id}`,
        category: 'MAINTENANCE',
        allocationType: 'DIRECT',
        amount: r.cost,
        costDate: toDateKey(r.date),
        vehicleId: r.vehicleId,
        source: 'SYSTEM',
        sourceRef: { sparePartRecordId: r.id },
        sourceLabel: r.partName,
        isUnusual: false,
      }),
    )
  return [...fromRecords, ...fromParts]
}

/**
 * RV-BR-19 / VC-BR-12 (CR-2026-050) — mỗi Owner Payout Record (trừ `CANCELLED`) là một chi phí trực tiếp `CONSIGNMENT_PAYOUT`
 * của xe ký gửi, ghi nhận DỒN TÍCH theo nghĩa vụ hợp đồng: `costDate` = ngày 1 của kỳ chi trả (chi phí khớp tháng xe được khai
 * thác), `amount` = `amountPayable`; khoản `ON_HOLD` vẫn tính vì nghĩa vụ vẫn tồn tại. Không phụ thuộc đã chi hay chưa
 * (thực chi nằm ở góc nhìn thực thu / đối chiếu).
 * TODO(OQ: RevenueCost-BRD.md §28 Q18–Q19 — Recognition Date là tháng được trả cho hay tháng thực chi chưa chốt; demo ghi theo kỳ)
 */
export function deriveConsignmentPayoutCostEntries(records: OwnerPayoutRecord[]): CostEntry[] {
  return records
    .filter((r) => r.status !== 'CANCELLED')
    .map((r): CostEntry => {
      const [year, month] = r.period.split('-')
      return {
        id: `opr:${r.id}`,
        category: 'CONSIGNMENT_PAYOUT',
        allocationType: 'DIRECT',
        amount: r.amountPayable,
        costDate: `${r.period}-01`,
        vehicleId: r.vehicleId,
        source: 'SYSTEM',
        sourceRef: { ownerPayoutRecordId: r.id, consignmentContractId: r.contractId },
        sourceLabel: `${r.code} · ${month}/${year}`,
        isUnusual: false,
      }
    })
}

// ---- Thực thu (§3.4) ----

// RevenueCost-BRD.md §15 — revenue-related: loại DEPOSIT/DEPOSIT_REFUND (cọc giữ hộ, không phải doanh thu).
export const REVENUE_CASH_IN_TYPES: TransactionType[] = ['RENTAL_PAYMENT', 'ADDITIONAL_CHARGE', 'POST_SETTLEMENT_COLLECT']
export const REVENUE_CASH_OUT_TYPES: TransactionType[] = ['OVERPAYMENT_REFUND', 'GOODWILL_REFUND']

/** RV-BR-14 — dùng đúng `isEffectiveTransaction()` (loại cả cặp đảo) để số thực thu trùng Sổ giao dịch/Công nợ. */
export function deriveCashEntries(txns: Transaction[]): CashEntry[] {
  return txns.filter(isEffectiveTransaction).map(
    (t): CashEntry => ({
      transactionId: t.id,
      code: t.code,
      date: t.confirmedAt ?? t.performedAt,
      direction: t.direction,
      signedAmount: t.direction === 'IN' ? t.amount : -t.amount,
      type: t.type,
      method: t.method,
      rentalId: t.rentalId,
      customerId: t.customerId,
      // `ADJUSTMENT` cộng/trừ theo direction (§0.4 điểm 12).
      revenueRelated: t.type === 'ADJUSTMENT' || (t.direction === 'IN' ? REVENUE_CASH_IN_TYPES.includes(t.type) : REVENUE_CASH_OUT_TYPES.includes(t.type)),
    }),
  )
}

// ---- Tổng hợp (§3.5) ----

export interface PeriodSummary {
  revenue: number
  /** Số âm — Σ dòng `REDUCTION` (RV-BR-06), đã nằm trong `revenue`. */
  reductions: number
  directCost: number
  indirectCost: number
  operatingProfit: number
  afterIndirect: number
}

function sumAmount(items: { amount: number }[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0)
}

/**
 * RV-BR-08 / AC-RV-009 — chi phí gián tiếp hiển thị riêng, KHÔNG trừ vào lợi nhuận xe.
 * CR-2026-048: Lợi nhuận vận hành = Doanh thu − Chi phí trực tiếp. RV-BR-09: "ước tính quản trị".
 */
export function summarizePeriod(revenueLines: RevenueLine[], costEntries: CostEntry[], period: FinancePeriod, options?: { excludeUnusual?: boolean }): PeriodSummary {
  const lines = revenueLines.filter((l) => isDateInPeriod(l.recognitionDate, period))
  const costs = costEntries.filter((c) => isDateInPeriod(c.costDate, period) && !(options?.excludeUnusual && c.isUnusual))
  const revenue = sumAmount(lines)
  const reductions = sumAmount(lines.filter((l) => l.nature === 'REDUCTION'))
  const directCost = sumAmount(costs.filter((c) => c.allocationType === 'DIRECT'))
  const indirectCost = sumAmount(costs.filter((c) => c.allocationType === 'INDIRECT'))
  const operatingProfit = revenue - directCost
  return { revenue, reductions, directCost, indirectCost, operatingProfit, afterIndirect: operatingProfit - indirectCost }
}

/** `Rental Count` (BRD §12) = số Settlement `COMPLETED` có `completedAt` trong kỳ — khớp mốc ghi nhận doanh thu (§0.4 điểm 13). */
export function countCompletedSettlements(settlements: Settlement[], period: FinancePeriod): number {
  return settlements.filter((s) => s.status === 'COMPLETED' && !!s.completedAt && isDateInPeriod(s.completedAt, period)).length
}

/** Xe đã giao cho khách (status ≥ `HANDED_OVER`), loại `CANCELLED`/`NO_SHOW` (§0.4 điểm 13). */
const RENTAL_DAYS_STATUSES: Rental['status'][] = ['HANDED_OVER', 'IN_RENTAL', 'RETURNED', 'SETTLEMENT', 'COMPLETED', 'DISPUTED']

/**
 * `Rental Days` (BRD §12) — số ngày lịch trong kỳ mà xe thực sự đang được thuê: từ `actualPickup ?? pickup`
 * tới `actualReturn ?? min(expectedReturn, hôm nay)`, để Utilization ≤ 100%.
 */
export function calcRentalDaysInPeriod(rental: Rental, period: FinancePeriod, today: Date): number {
  if (!RENTAL_DAYS_STATUSES.includes(rental.status)) return 0
  const todayKey = toDateKey(today)
  const start = toDateKey(rental.actualPickupDateTime ?? rental.pickupDateTime)
  const expectedEnd = toDateKey(rental.expectedReturnDateTime)
  const end = rental.actualReturnDateTime ? toDateKey(rental.actualReturnDateTime) : expectedEnd < todayKey ? expectedEnd : todayKey
  return overlapDays(start, end, period.from, period.to)
}

/**
 * RV-BR-15 — số ngày xe khả dụng trong kỳ = ngày của (kỳ ∩ [ngày tạo xe, hôm nay]) − ngày bị Vehicle Block.
 * TODO(OQ: RevenueCost-BRD.md §28 Q10 — "số ngày khả dụng" chưa chốt; demo trừ ngày khoá lịch, chưa trừ MAINTENANCE/INACTIVE)
 */
export function calcAvailableDays(vehicle: Vehicle, blocks: VehicleBlock[], period: FinancePeriod, today: Date): number {
  const todayKey = toDateKey(today)
  const createdKey = toDateKey(vehicle.createdAt)
  const from = period.from > createdKey ? period.from : createdKey
  const to = period.to < todayKey ? period.to : todayKey
  if (from > to) return 0
  const total = dayDiff(from, to) + 1

  // Gộp các khoảng khoá giao nhau để không trừ trùng ngày.
  const intervals = blocks
    .filter((b) => b.vehicleId === vehicle.id)
    .map((b) => {
      const releasedKey = b.releasedAt ? toDateKey(b.releasedAt) : undefined
      const end = b.endDate ?? releasedKey ?? todayKey
      return { start: b.startDate, end: releasedKey && releasedKey < end ? releasedKey : end }
    })
    .filter((i) => i.start <= i.end)
    .sort((a, b) => a.start.localeCompare(b.start))
  let blocked = 0
  let cursor: { start: string; end: string } | undefined
  for (const interval of intervals) {
    if (cursor && interval.start <= cursor.end) {
      if (interval.end > cursor.end) cursor = { start: cursor.start, end: interval.end }
      continue
    }
    if (cursor) blocked += overlapDays(cursor.start, cursor.end, from, to)
    cursor = interval
  }
  if (cursor) blocked += overlapDays(cursor.start, cursor.end, from, to)
  return Math.max(0, total - blocked)
}

/** Một dòng Report 02 (BRD §16) cho một xe. */
export interface VehiclePerformanceRow {
  vehicleId: string
  revenue: number
  directCost: number
  /** RV-BR-09 — ước tính quản trị. */
  estimatedProfit: number
  rentalCount: number
  rentalDays: number
  availableDays: number
  /** Tỉ lệ 0..1; `null` khi `availableDays = 0`. */
  utilization: number | null
  incidentCount: number
}

/**
 * Xe không phát sinh trong kỳ vẫn có dòng (Utilization = 0%) — EX-05: xe INACTIVE vẫn hiện nếu truyền vào `vehicles`.
 * AC-RV-014: Utilization = Rental Days / Available Days.
 */
export function buildVehiclePerformance(input: {
  vehicles: Vehicle[]
  rentals: Rental[]
  settlements: Settlement[]
  revenueLines: RevenueLine[]
  costEntries: CostEntry[]
  incidents: Incident[]
  blocks: VehicleBlock[]
  period: FinancePeriod
  today: Date
}): VehiclePerformanceRow[] {
  const { period, today } = input
  return input.vehicles.map((vehicle): VehiclePerformanceRow => {
    const summary = summarizePeriod(
      input.revenueLines.filter((l) => l.vehicleId === vehicle.id),
      input.costEntries.filter((c) => c.vehicleId === vehicle.id),
      period,
    )
    const rentalDays = input.rentals.filter((r) => r.vehicleId === vehicle.id).reduce((sum, r) => sum + calcRentalDaysInPeriod(r, period, today), 0)
    const availableDays = calcAvailableDays(vehicle, input.blocks, period, today)
    return {
      vehicleId: vehicle.id,
      revenue: summary.revenue,
      directCost: summary.directCost,
      estimatedProfit: summary.operatingProfit,
      rentalCount: countCompletedSettlements(
        input.settlements.filter((s) => s.vehicleId === vehicle.id),
        period,
      ),
      rentalDays,
      availableDays,
      utilization: availableDays > 0 ? rentalDays / availableDays : null,
      incidentCount: input.incidents.filter((i) => i.vehicleId === vehicle.id && isDateInPeriod(i.reportedAt, period)).length,
    }
  })
}

/** Một tháng của bảng tab Lợi nhuận (R1 là bảng, R2 thêm biểu đồ). */
export interface MonthlyVehicleRow {
  /** `yyyy-MM`. */
  month: string
  revenue: number
  directCost: number
  profit: number
}

export function buildMonthlyVehicleSeries(input: { vehicleId: string; revenueLines: RevenueLine[]; costEntries: CostEntry[]; period: FinancePeriod }): MonthlyVehicleRow[] {
  const lines = input.revenueLines.filter((l) => l.vehicleId === input.vehicleId && isDateInPeriod(l.recognitionDate, input.period))
  const costs = input.costEntries.filter((c) => c.vehicleId === input.vehicleId && c.allocationType === 'DIRECT' && isDateInPeriod(c.costDate, input.period))
  return enumeratePeriodBuckets(input.period, 'MONTH').map((month): MonthlyVehicleRow => {
    const revenue = sumAmount(lines.filter((l) => bucketKeyOf(l.recognitionDate, 'MONTH') === month))
    const directCost = sumAmount(costs.filter((c) => bucketKeyOf(c.costDate, 'MONTH') === month))
    return { month, revenue, directCost, profit: revenue - directCost }
  })
}

/** Cơ cấu chi phí theo loại (danh sách ở tab Chi phí) — sắp theo tổng giảm dần. */
export function breakdownCostByCategory(entries: CostEntry[]): { category: CostCategory; total: number; count: number }[] {
  const map = new Map<CostCategory, { category: CostCategory; total: number; count: number }>()
  for (const e of entries) {
    const row = map.get(e.category) ?? { category: e.category, total: 0, count: 0 }
    row.total += e.amount
    row.count += 1
    map.set(e.category, row)
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// ---- Nợ (e) — chú thích chi phí phân bổ ngày tương lai ----

/**
 * Σ chi phí có `costDate` trong kỳ nhưng SAU ngày địa phương của `today` (lát chi phí rải theo tháng). Chỉ để hiện chú thích —
 * KHÔNG đổi quy tắc ghi nhận theo Cost Date (RV-BR-03, AC-RV-004).
 */
export function sumFutureDatedCost(costEntries: CostEntry[], period: FinancePeriod, today: Date): number {
  const todayKey = toDateKey(today)
  return costEntries.filter((c) => isDateInPeriod(c.costDate, period) && toDateKey(c.costDate) > todayKey).reduce((sum, c) => sum + c.amount, 0)
}

/** Tỉ lệ 0..1 → "80%" / "73,3%" (1 chữ số thập phân); `null` → `none`. Helper chung cho các bảng/thẻ trên màn và dựng CSV. */
export function formatPercentText(ratio: number | null, none: string): string {
  if (ratio === null) return none
  return `${(Math.round(ratio * 1000) / 10).toLocaleString('vi-VN')}%`
}

/** "+12,5%" / "-3%" / "0%"; `null` (kỳ trước bằng 0) → `none`. Helper chung cho thẻ KPI trên màn và dựng CSV. */
export function formatChangeText(ratio: number | null, none: string): string {
  if (ratio === null) return none
  const percent = Math.round(ratio * 1000) / 10
  const text = Math.abs(percent).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
  if (percent > 0) return `+${text}%`
  if (percent < 0) return `-${text}%`
  return '0%'
}

// ---- Xuất báo cáo (UC-RV-13) ----

/** Mã báo cáo của 7 tab — hằng số UI (không phải enum nghiệp vụ nên không đặt ở `enums.ts`). */
export const FINANCE_REPORT_KEYS = ['OVERVIEW', 'REVENUE', 'VEHICLE_PERFORMANCE', 'COST_BREAKDOWN', 'CUSTOMER', 'INCIDENT', 'RECONCILIATION'] as const
export type FinanceReportKey = (typeof FINANCE_REPORT_KEYS)[number]

export function isFinanceReportKey(value: string): value is FinanceReportKey {
  return (FINANCE_REPORT_KEYS as readonly string[]).includes(value)
}

/** Bộ lọc ghi vào audit khi xuất — CHỈ id/enum/boolean, không tên, không SĐT. */
export interface ReportExportFilters {
  vehicleId?: string
  customerId?: string
  customerStatus?: CustomerStatus
  granularity?: ReportGranularity
  sortKey?: string
  excludeUnusual?: boolean
}

// ---- Form schema Cost Record (dùng thật trong dialog — `CONVENTIONS.md` §7 ngoại lệ `finance`) ----

export const costRecordFormSchema = z
  .object({
    category: z.string().trim().refine(isManualCostCategory, { message: 'Chọn loại chi phí nhập tay hợp lệ (chi phí sự cố và chi trả chủ xe được ghi nhận tự động — RV-BR-04)' }),
    amount: z
      .string()
      .trim()
      .min(1, 'Số tiền là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
    costDate: z
      .string()
      .trim()
      .min(1, 'Ngày chi phí là bắt buộc')
      .refine((v) => DATE_KEY_RE.test(v), { message: 'Ngày chi phí không hợp lệ' })
      .refine((v) => v <= currentDateKey(), { message: 'Ngày chi phí không được ở tương lai' }),
    allocationType: z.enum(ALLOCATION_TYPES),
    vehicleId: z.string().trim().optional(),
    rentalId: z.string().trim().optional(),
    spreadMonths: z
      .string()
      .trim()
      .min(1, 'Số tháng rải là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) >= 1 && Number(v) <= 36, { message: 'Số tháng rải phải là số nguyên từ 1 đến 36' }),
    isUnusual: z.boolean(),
    evidenceNote: z.string().trim().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.allocationType === 'DIRECT' && !data.vehicleId) {
      ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Chi phí trực tiếp phải gắn với một xe' })
    }
    if (data.allocationType === 'INDIRECT' && (data.vehicleId || data.rentalId)) {
      ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Chi phí gián tiếp không gắn xe hoặc lượt thuê' })
    }
  })
export type CostRecordFormValues = z.infer<typeof costRecordFormSchema>

/** Huỷ mềm Cost Record (BRD §25.4, RV-BR-10) — lý do bắt buộc. */
export const costRecordReverseFormSchema = z.object({
  reason: z.string().trim().min(5, 'Lý do huỷ là bắt buộc (tối thiểu 5 ký tự)'),
})
export type CostRecordReverseFormValues = z.infer<typeof costRecordReverseFormSchema>

// ==== Dashboard (RV §17) — DASHBOARD-PLATFORM-PLAN.md §4.4 ====

/** Cặp kỳ hiện tại / kỳ liền trước cùng `PeriodSummary` — nguồn cho thẻ KPI + "so kỳ trước". */
export interface DashboardPeriodPair {
  period: FinancePeriod
  previousPeriod: FinancePeriod
  current: PeriodSummary
  previous: PeriodSummary
}

export interface DashboardFinanceSummary {
  /** Tháng này so với tháng trước (`THIS_MONTH`/`LAST_MONTH`). */
  month: DashboardPeriodPair
  /** Hôm nay so với hôm qua (RV §17.1 "hôm nay / tháng này"). */
  day: DashboardPeriodPair
  /** Σ `outstanding > 0` của `deriveCustomerBalances` — cùng số với thẻ "Đang nợ" ở màn Công nợ. */
  receivables: number
  /** Doanh thu theo ngày, 30 ngày gần nhất (`LAST_30_DAYS`), đủ mọi ngày. */
  dailyRevenue: { bucket: string; revenue: number }[]
  /** 5 xe lợi nhuận vận hành cao nhất trong 30 ngày. */
  topVehicles: VehiclePerformanceRow[]
  /** 5 xe lợi nhuận vận hành thấp nhất trong 30 ngày (không trùng `topVehicles`). */
  lowVehicles: VehiclePerformanceRow[]
}

const DASHBOARD_TOP_VEHICLES = 5

/**
 * KPI tài chính cho Dashboard — chỉ ghép các hàm thuần sẵn có (`summarizePeriod`, `resolvePeriodPreset`,
 * `buildVehiclePerformance`) với chính sách `ON_SETTLEMENT` (CR-2026-048; lợi nhuận vận hành = doanh thu − chi phí
 * trực tiếp, RV-BR-09 "ước tính quản trị"). `today` là tham số (không gọi `new Date()` trong hàm).
 * TODO(OQ: RevenueCost-BRD.md §17.1/§28 Q14) — tiêu chí "xe hiệu quả thấp": giả định 5 xe lợi nhuận vận hành thấp nhất 30 ngày qua.
 */
export function buildDashboardFinanceSummary(input: {
  revenueLines: RevenueLine[]
  costEntries: CostEntry[]
  vehicles: Vehicle[]
  rentals: Rental[]
  settlements: Settlement[]
  incidents: Incident[]
  blocks: VehicleBlock[]
  balances: CustomerBalance[]
  today: Date
}): DashboardFinanceSummary {
  const { revenueLines, costEntries, today } = input
  const pair = (period: FinancePeriod, previous: FinancePeriod): DashboardPeriodPair => ({
    period,
    previousPeriod: previous,
    current: summarizePeriod(revenueLines, costEntries, period),
    previous: summarizePeriod(revenueLines, costEntries, previous),
  })
  const todayKey = toDateKey(today)
  const yesterdayKey = addDaysToKey(todayKey, -1)

  const last30 = resolvePeriodPreset('LAST_30_DAYS', today)
  const lines30 = revenueLines.filter((l) => isDateInPeriod(l.recognitionDate, last30))
  const dailyRevenue = enumeratePeriodBuckets(last30, 'DAY').map((bucket) => ({
    bucket,
    revenue: sumAmount(lines30.filter((l) => bucketKeyOf(l.recognitionDate, 'DAY') === bucket)),
  }))

  const ranked = buildVehiclePerformance({
    vehicles: input.vehicles.filter((v) => v.status !== 'INACTIVE'),
    rentals: input.rentals,
    settlements: input.settlements,
    revenueLines,
    costEntries,
    incidents: input.incidents,
    blocks: input.blocks,
    period: last30,
    today,
  }).sort((a, b) => b.estimatedProfit - a.estimatedProfit)
  const topVehicles = ranked.slice(0, DASHBOARD_TOP_VEHICLES)
  const lowVehicles = ranked.slice(Math.max(DASHBOARD_TOP_VEHICLES, ranked.length - DASHBOARD_TOP_VEHICLES)).reverse()

  return {
    month: pair(resolvePeriodPreset('THIS_MONTH', today), resolvePeriodPreset('LAST_MONTH', today)),
    day: pair({ from: todayKey, to: todayKey }, { from: yesterdayKey, to: yesterdayKey }),
    receivables: input.balances.reduce((sum, b) => sum + (b.outstanding > 0 ? b.outstanding : 0), 0),
    dailyRevenue,
    topVehicles,
    lowVehicles,
  }
}
