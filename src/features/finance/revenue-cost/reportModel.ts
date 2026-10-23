// RV — hàm thuần CHỈ màn Báo cáo tài chính dùng (chunk lazy). File thuộc chunk chính KHÔNG được import file này
// (docs/FINANCE-REFACTOR-PLAN.md §2 điểm 5).
import {
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from 'date-fns'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
// CHỈ `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel, REVENUE-COST-PLAN.md §0.2).
import type { Vehicle } from '@/features/vehicles'
import { type CostCategory, type PaymentMethod, type RevenueCategory, PAYMENT_METHODS } from '@/shared/domain/enums'
import type { CsvCell } from '@/shared/lib/csv'
import type { Settlement } from '../core/types.ts'
import type { CustomerBalance } from '../payment/model.ts'
import {
  bucketKeyOf,
  type CashEntry,
  checkSettlementRevenueReconciliation,
  type CostEntry,
  dateKeyOf,
  enumeratePeriodBuckets,
  type FinancePeriod,
  isDateInPeriod,
  isIncidentCostCounted,
  type PeriodSelection,
  previousPeriod,
  type ReportGranularity,
  type RevenueLine,
  summarizePeriod,
  type VehiclePerformanceRow,
} from './model.ts'

// ---- Báo cáo tài chính (REVENUE-COST-PLAN.md §19.3) — hàm thuần, UI chỉ hiển thị kết quả ----

/** `RevenueCost-BRD.md` §14 "so với kỳ trước": tháng/quý/năm lịch so với kỳ lịch liền trước; còn lại so với kỳ cùng độ dài liền trước. */
export function comparisonPeriodOf(selection: PeriodSelection): FinancePeriod {
  const from = parseISO(selection.period.from)
  switch (selection.preset) {
    case 'THIS_MONTH':
    case 'LAST_MONTH': {
      const prev = subMonths(from, 1)
      return { from: dateKeyOf(startOfMonth(prev)), to: dateKeyOf(endOfMonth(prev)) }
    }
    case 'THIS_QUARTER': {
      const prev = subMonths(from, 3)
      return { from: dateKeyOf(startOfQuarter(prev)), to: dateKeyOf(endOfQuarter(prev)) }
    }
    case 'THIS_YEAR': {
      const prev = subMonths(from, 12)
      return { from: dateKeyOf(startOfYear(prev)), to: dateKeyOf(endOfYear(prev)) }
    }
    default:
      return previousPeriod(selection.period)
  }
}

/** Kỳ trước bằng 0 thì không có tỉ lệ (`null`, UI hiện "—"); ngược lại (hiện tại − trước) / |trước|. */
export function calcChangeRatio(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / Math.abs(previous)
}

/** Gợi ý độ chi tiết khi đổi kỳ: ≤ 31 ngày theo ngày · ≤ 92 ngày theo tuần · còn lại theo tháng. */
export function suggestGranularity(period: FinancePeriod): ReportGranularity {
  const days = differenceInCalendarDays(parseISO(period.to), parseISO(period.from)) + 1
  if (days <= 31) return 'DAY'
  if (days <= 92) return 'WEEK'
  return 'MONTH'
}

/** RV-BR-14 — thực thu liên quan doanh thu trong kỳ (IN dương, OUT âm). */
export function sumRevenueCash(cashEntries: CashEntry[], period: FinancePeriod): number {
  return cashEntries.filter((c) => c.revenueRelated && isDateInPeriod(c.date, period)).reduce((sum, c) => sum + c.signedAmount, 0)
}

/** Nhãn hiển thị của khoá mốc: Ngày `dd/MM` · Tuần "<weekPrefix> dd/MM" (ngày thứ Hai) · Tháng `MM/yyyy`. */
export function bucketDisplayLabel(bucket: string, granularity: ReportGranularity, weekPrefix: string): string {
  if (granularity === 'MONTH') return `${bucket.slice(5, 7)}/${bucket.slice(0, 4)}`
  const day = `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`
  return granularity === 'WEEK' ? `${weekPrefix} ${day}` : day
}

/** Một mốc của biểu đồ/báo cáo theo thời gian. `bucket` là khoá của `bucketKeyOf` (ngày · thứ Hai của tuần · `yyyy-MM`). */
export interface TimeSeriesPoint {
  bucket: string
  revenue: number
  directCost: number
  indirectCost: number
  operatingProfit: number
  cashIn: number
  rentalCount: number
  /** Report 01 "Doanh thu TB/lượt" — `null` khi không có lượt hoàn tất. */
  avgRevenuePerRental: number | null
}

/**
 * Report 01 + biểu đồ Tổng quan. BẤT BIẾN: Σ các mốc = `summarizePeriod` cùng kỳ (doanh thu, chi phí trực tiếp, chi phí gián tiếp).
 * AC-RV-006 (ghi nhận theo Recognition Date), AC-RV-009 (gián tiếp tách riêng), RV-BR-14 (thực thu).
 */
export function buildTimeSeries(input: {
  revenueLines: RevenueLine[]
  costEntries: CostEntry[]
  cashEntries: CashEntry[]
  settlements: Settlement[]
  period: FinancePeriod
  granularity: ReportGranularity
}): TimeSeriesPoint[] {
  const { period, granularity } = input
  const points = new Map<string, TimeSeriesPoint>(
    enumeratePeriodBuckets(period, granularity).map((bucket) => [
      bucket,
      { bucket, revenue: 0, directCost: 0, indirectCost: 0, operatingProfit: 0, cashIn: 0, rentalCount: 0, avgRevenuePerRental: null },
    ]),
  )
  for (const line of input.revenueLines) {
    if (!isDateInPeriod(line.recognitionDate, period)) continue
    const point = points.get(bucketKeyOf(line.recognitionDate, granularity))
    if (point) point.revenue += line.amount
  }
  for (const cost of input.costEntries) {
    if (!isDateInPeriod(cost.costDate, period)) continue
    const point = points.get(bucketKeyOf(cost.costDate, granularity))
    if (!point) continue
    if (cost.allocationType === 'DIRECT') point.directCost += cost.amount
    else point.indirectCost += cost.amount
  }
  for (const cash of input.cashEntries) {
    if (!cash.revenueRelated || !isDateInPeriod(cash.date, period)) continue
    const point = points.get(bucketKeyOf(cash.date, granularity))
    if (point) point.cashIn += cash.signedAmount
  }
  for (const settlement of input.settlements) {
    if (settlement.status !== 'COMPLETED' || !settlement.completedAt || !isDateInPeriod(settlement.completedAt, period)) continue
    const point = points.get(bucketKeyOf(settlement.completedAt, granularity))
    if (point) point.rentalCount += 1
  }
  return Array.from(points.values()).map((point) => ({
    ...point,
    operatingProfit: point.revenue - point.directCost,
    avgRevenuePerRental: point.rentalCount > 0 ? Math.round(point.revenue / point.rentalCount) : null,
  }))
}

/** Một dòng cơ cấu doanh thu theo danh mục. `reduction` ≤ 0; `reversal` là Σ dòng đối ứng khi đảo quyết toán (có dấu). */
export interface RevenueCategoryRow {
  category: RevenueCategory
  charge: number
  reduction: number
  reversal: number
  net: number
  /** Tỉ trọng `net` so với tổng `net`; `null` khi tổng bằng 0. */
  share: number | null
}

/** BẤT BIẾN: Σ `net` = doanh thu của kỳ, Σ `reduction` = giảm trừ của kỳ (`summarizePeriod`) — RV-BR-06, AC-RV-002. Sắp theo `net` giảm dần. */
export function buildRevenueByCategory(revenueLines: RevenueLine[], period: FinancePeriod): RevenueCategoryRow[] {
  const map = new Map<RevenueCategory, RevenueCategoryRow>()
  for (const line of revenueLines) {
    if (!isDateInPeriod(line.recognitionDate, period)) continue
    const row = map.get(line.category) ?? { category: line.category, charge: 0, reduction: 0, reversal: 0, net: 0, share: null }
    if (line.nature === 'CHARGE') row.charge += line.amount
    else if (line.nature === 'REDUCTION') row.reduction += line.amount
    else row.reversal += line.amount
    row.net += line.amount
    map.set(line.category, row)
  }
  const rows = Array.from(map.values()).sort((a, b) => b.net - a.net)
  const total = rows.reduce((sum, r) => sum + r.net, 0)
  return rows.map((r) => ({ ...r, share: total === 0 ? null : r.net / total }))
}

/** Một dòng Report 05 — chi phí theo loại. */
export interface CostBreakdownRow {
  category: CostCategory
  count: number
  total: number
  /** Tỉ trọng so với tổng chi phí; `null` khi tổng bằng 0. */
  share: number | null
  directTotal: number
  indirectTotal: number
}

/** Report 05. BẤT BIẾN: `total` = chi phí trực tiếp + gián tiếp của `summarizePeriod` cùng kỳ; `count` = số CostEntry trong kỳ. Sắp theo tổng giảm dần. */
export function buildCostBreakdown(costEntries: CostEntry[], period: FinancePeriod): { rows: CostBreakdownRow[]; total: number; directTotal: number; indirectTotal: number; count: number } {
  const map = new Map<CostCategory, CostBreakdownRow>()
  for (const entry of costEntries) {
    if (!isDateInPeriod(entry.costDate, period)) continue
    const row = map.get(entry.category) ?? { category: entry.category, count: 0, total: 0, share: null, directTotal: 0, indirectTotal: 0 }
    row.count += 1
    row.total += entry.amount
    if (entry.allocationType === 'DIRECT') row.directTotal += entry.amount
    else row.indirectTotal += entry.amount
    map.set(entry.category, row)
  }
  const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total)
  const total = sorted.reduce((sum, r) => sum + r.total, 0)
  return {
    rows: sorted.map((r) => ({ ...r, share: total === 0 ? null : r.total / total })),
    total,
    directTotal: sorted.reduce((sum, r) => sum + r.directTotal, 0),
    indirectTotal: sorted.reduce((sum, r) => sum + r.indirectTotal, 0),
    count: sorted.reduce((sum, r) => sum + r.count, 0),
  }
}

/** EX-07 (Use Case) — Settlement `COMPLETED` trong kỳ mà Σ dòng doanh thu lệch `completedTotals.finalAmount`. */
export function findRevenueReconciliationIssues(
  settlements: Settlement[],
  revenueLines: RevenueLine[],
  period: FinancePeriod,
): { settlementId: string; rentalId: string; expected: number; recognized: number; diff: number }[] {
  const issues: { settlementId: string; rentalId: string; expected: number; recognized: number; diff: number }[] = []
  for (const settlement of settlements) {
    if (settlement.status !== 'COMPLETED' || !settlement.completedAt || !isDateInPeriod(settlement.completedAt, period)) continue
    const { expected, recognized, diff } = checkSettlementRevenueReconciliation(settlement, revenueLines)
    if (diff !== 0) issues.push({ settlementId: settlement.id, rentalId: settlement.rentalId, expected, recognized, diff })
  }
  return issues
}

/**
 * EX-05 — xe `INACTIVE` chỉ hiện trong Report 02 nếu có phát sinh trong kỳ. BẤT BIẾN: Σ `estimatedProfit` các dòng giữ lại
 * = Lợi nhuận vận hành của kỳ (mọi dòng doanh thu/chi phí trực tiếp đều gắn xe; xe bị loại không có phát sinh nên lợi nhuận 0).
 */
export function selectReportVehicleRows(rows: VehiclePerformanceRow[], vehicles: Vehicle[]): VehiclePerformanceRow[] {
  const statusById = new Map(vehicles.map((v) => [v.id, v.status]))
  return rows.filter((row) => {
    if (statusById.get(row.vehicleId) !== 'INACTIVE') return true
    return row.revenue !== 0 || row.directCost !== 0 || row.rentalCount > 0 || row.incidentCount > 0
  })
}

/** Dòng tổng của Report 02. Utilization tổng = Σ ngày thuê / Σ ngày khả dụng (AC-RV-014); `null` khi Σ ngày khả dụng = 0. */
export function sumVehicleRows(rows: VehiclePerformanceRow[]): Omit<VehiclePerformanceRow, 'vehicleId'> {
  const total = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      directCost: acc.directCost + r.directCost,
      estimatedProfit: acc.estimatedProfit + r.estimatedProfit,
      rentalCount: acc.rentalCount + r.rentalCount,
      rentalDays: acc.rentalDays + r.rentalDays,
      availableDays: acc.availableDays + r.availableDays,
      incidentCount: acc.incidentCount + r.incidentCount,
    }),
    { revenue: 0, directCost: 0, estimatedProfit: 0, rentalCount: 0, rentalDays: 0, availableDays: 0, incidentCount: 0 },
  )
  return { ...total, utilization: total.availableDays > 0 ? total.rentalDays / total.availableDays : null }
}

export type VehicleSortKey = 'PROFIT' | 'REVENUE' | 'UTILIZATION'

/** Sắp giảm dần theo tiêu chí; Utilization `null` (không có ngày khả dụng) xếp cuối. */
export function sortVehicleRows(rows: VehiclePerformanceRow[], key: VehicleSortKey): VehiclePerformanceRow[] {
  const value = (row: VehiclePerformanceRow): number | null => (key === 'PROFIT' ? row.estimatedProfit : key === 'REVENUE' ? row.revenue : row.utilization)
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return vb - va
  })
}

// ==== Round 3 — Báo cáo 03/04/06, đối chiếu, xuất CSV (REVENUE-COST-PLAN.md §20.3) ====

// ---- Report 03 — Khách hàng (BRD §13/§16, UC-RV-09) ----

/** Một dòng Report 03. `outstandingNow` là số dư HIỆN TẠI, các cột còn lại theo kỳ. */
export interface CustomerReportRow {
  customerId: string
  revenue: number
  rentalCount: number
  totalSpending: number
  collected: number
  outstandingNow: number
  incidentCount: number
}

export type CustomerReportTotals = Omit<CustomerReportRow, 'customerId'>

/** Dòng tổng của Report 03 — panel gọi lại sau khi lọc trạng thái khách để tổng = Σ các dòng đang hiển thị. */
export function sumCustomerRows(rows: CustomerReportRow[]): CustomerReportTotals {
  return rows.reduce<CustomerReportTotals>(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      rentalCount: acc.rentalCount + r.rentalCount,
      totalSpending: acc.totalSpending + r.totalSpending,
      collected: acc.collected + r.collected,
      outstandingNow: acc.outstandingNow + r.outstandingNow,
      incidentCount: acc.incidentCount + r.incidentCount,
    }),
    { revenue: 0, rentalCount: 0, totalSpending: 0, collected: 0, outstandingNow: 0, incidentCount: 0 },
  )
}

/**
 * Report 03 — RV-BR-03 (doanh thu theo Recognition Date), RV-BR-14 (thực thu liên quan doanh thu), §0.4 điểm 15 (công nợ = hiện tại).
 * BẤT BIẾN (khi không lọc trạng thái): Σ revenue = `summarizePeriod.revenue` · Σ collected = `sumRevenueCash` · Σ rentalCount =
 * `countCompletedSettlements` · Σ outstandingNow = thẻ "Đang nợ" màn Công nợ khách hàng.
 * Chỉ trả mã khách (tên/trạng thái do panel tra từ hồ sơ) — không SĐT/CCCD/GPLX/email/địa chỉ.
 * TODO(OQ: AuditLog-BRD.md §22 Q4 / CustomerManagement-BRD.md §31 Q17 — trường nhạy cảm & quy tắc che chưa chốt; báo cáo/CSV chỉ mã + họ tên + trạng thái khách)
 */
export function buildCustomerReport(input: {
  revenueLines: RevenueLine[]
  settlements: Settlement[]
  cashEntries: CashEntry[]
  incidents: Incident[]
  rentals: Rental[]
  balances: CustomerBalance[]
  period: FinancePeriod
}): { rows: CustomerReportRow[]; totals: CustomerReportTotals } {
  const { period } = input
  const map = new Map<string, CustomerReportRow>()
  const present = new Set<string>()
  function ensure(customerId: string): CustomerReportRow {
    let row = map.get(customerId)
    if (!row) {
      row = { customerId, revenue: 0, rentalCount: 0, totalSpending: 0, collected: 0, outstandingNow: 0, incidentCount: 0 }
      map.set(customerId, row)
    }
    return row
  }

  for (const line of input.revenueLines) {
    if (!isDateInPeriod(line.recognitionDate, period)) continue
    ensure(line.customerId).revenue += line.amount
    present.add(line.customerId)
  }
  for (const settlement of input.settlements) {
    // Cùng điều kiện `countCompletedSettlements`.
    if (settlement.status !== 'COMPLETED' || !settlement.completedAt || !isDateInPeriod(settlement.completedAt, period)) continue
    const row = ensure(settlement.customerId)
    row.rentalCount += 1
    row.totalSpending += settlement.completedTotals?.finalAmount ?? 0
    present.add(settlement.customerId)
  }
  for (const cash of input.cashEntries) {
    // Giao dịch chi trả chủ xe không có khách hàng — và cũng không phải revenue-related nên vốn không vào đây.
    if (!cash.revenueRelated || !cash.customerId || !isDateInPeriod(cash.date, period)) continue
    ensure(cash.customerId).collected += cash.signedAmount
    present.add(cash.customerId)
  }
  const customerByRental = new Map(input.rentals.map((r) => [r.id, r.customerId]))
  for (const incident of input.incidents) {
    if (!incident.rentalId || !isDateInPeriod(incident.reportedAt, period)) continue
    const customerId = customerByRental.get(incident.rentalId)
    if (!customerId) continue
    ensure(customerId).incidentCount += 1
    present.add(customerId)
  }
  for (const balance of input.balances) {
    if (balance.outstanding <= 0) continue
    ensure(balance.customerId).outstandingNow = balance.outstanding
    present.add(balance.customerId)
  }

  const rows = Array.from(map.values()).filter((r) => present.has(r.customerId))
  return { rows, totals: sumCustomerRows(rows) }
}

export type CustomerReportSortKey = 'REVENUE' | 'OUTSTANDING'

/** UC-RV-09 bước 3 — sắp giảm dần theo Doanh thu hoặc Còn phải thu; hoà thì theo mã khách để thứ tự ổn định. */
export function sortCustomerRows(rows: CustomerReportRow[], key: CustomerReportSortKey): CustomerReportRow[] {
  const value = (row: CustomerReportRow) => (key === 'REVENUE' ? row.revenue : row.outstandingNow)
  return [...rows].sort((a, b) => value(b) - value(a) || a.customerId.localeCompare(b.customerId))
}

// ---- Report 04 — Sự cố (BRD §16, nguồn Damage & Incident) ----

export interface IncidentReportRow {
  incidentId: string
  incidentCode: string
  vehicleId: string
  rentalId?: string
  reportedAt: string
  status: Incident['status']
  /** Σ phụ tùng + nhân công + khác (thiếu = 0) nếu có ≥ 1 trường; ngược lại `null`. */
  actualCost: number | null
  customerCharge: number | null
  companyCost: number | null
  insuranceCovered: number | null
  /** `isIncidentCostCounted` — sự cố đã chốt phần công ty chịu mới được tính vào chi phí. */
  countedAsCost: boolean
}

export interface IncidentReportTotals {
  actualCost: number
  customerCharge: number
  companyCost: number
  insuranceCovered: number
  /** Σ `companyCost` của các dòng `countedAsCost` — bằng dòng `INCIDENT` của Report 05 cùng kỳ. */
  countedCompanyCost: number
}

/**
 * Report 04. Kỳ theo `reportedAt` (cùng mốc Cost Date chi phí sự cố); mọi trạng thái đều hiện.
 * BẤT BIẾN: `totals.countedCompanyCost` = Σ CostEntry nguồn `INCIDENT` trong kỳ (dòng `INCIDENT` của Report 05).
 * TODO(OQ: RevenueCost-UseCase.md UC-RV-02 bước 2 — Cost Date = ngày chốt hay ngày phát sinh; demo dùng reportedAt)
 */
export function buildIncidentReport(incidents: Incident[], period: FinancePeriod): { rows: IncidentReportRow[]; totals: IncidentReportTotals } {
  const rows = incidents
    .filter((i) => isDateInPeriod(i.reportedAt, period))
    .map((i): IncidentReportRow => {
      const parts = [i.actualCostParts, i.actualCostLabor, i.actualCostOther]
      const hasActual = parts.some((v) => v !== undefined)
      return {
        incidentId: i.id,
        incidentCode: i.incidentCode,
        vehicleId: i.vehicleId,
        rentalId: i.rentalId,
        reportedAt: i.reportedAt,
        status: i.status,
        actualCost: hasActual ? parts.reduce<number>((sum, v) => sum + (v ?? 0), 0) : null,
        customerCharge: i.customerCharge ?? null,
        companyCost: i.companyCost ?? null,
        insuranceCovered: i.insuranceCovered ?? null,
        countedAsCost: isIncidentCostCounted(i),
      }
    })
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || a.incidentCode.localeCompare(b.incidentCode))
  const totals = rows.reduce<IncidentReportTotals>(
    (acc, r) => ({
      actualCost: acc.actualCost + (r.actualCost ?? 0),
      customerCharge: acc.customerCharge + (r.customerCharge ?? 0),
      companyCost: acc.companyCost + (r.companyCost ?? 0),
      insuranceCovered: acc.insuranceCovered + (r.insuranceCovered ?? 0),
      countedCompanyCost: acc.countedCompanyCost + (r.countedAsCost ? (r.companyCost ?? 0) : 0),
    }),
    { actualCost: 0, customerCharge: 0, companyCost: 0, insuranceCovered: 0, countedCompanyCost: 0 },
  )
  return { rows, totals }
}

// ---- Đối chiếu ghi nhận ↔ thực thu/thực chi (BRD §15, UC-RV-11, AC-RV-008) ----

export interface ReconciliationRentalRow {
  /** `null` = giao dịch/doanh thu không gắn lượt thuê. */
  rentalId: string | null
  customerId?: string
  accrual: number
  cash: number
  diff: number
}

export interface ReconciliationResult {
  revenueAccrual: number
  revenueCash: number
  /** > 0: công nợ phải thu · < 0: thu trước (AC-RV-008). */
  revenueDiff: number
  costRecognized: number
  costPaid: number
  costDiff: number
  rentalRows: ReconciliationRentalRow[]
}

/**
 * Đối chiếu doanh thu ghi nhận (Recognition Date) với thực thu (Cash Date) và chi phí ghi nhận với thực chi.
 * BẤT BIẾN: Σ `rentalRows.diff` = `revenueDiff`. Công cụ quản trị, không phải báo cáo lưu chuyển tiền tệ (BRD §15).
 * `costPaid` chỉ gồm chi trả chủ xe (`OWNER_PAYOUT`) hiệu lực, theo ngày xác nhận chi — chi phí nhập tay không gắn giao dịch
 * (RV-BR-17, BRD §15). Chi trả chủ xe là `Cost Record` ghi nhận theo kỳ nên `costDiff` phản ánh khoản đã ghi nhận chưa chi.
 */
export function buildReconciliation(input: { revenueLines: RevenueLine[]; cashEntries: CashEntry[]; costEntries: CostEntry[]; period: FinancePeriod }): ReconciliationResult {
  const { period } = input
  const summary = summarizePeriod(input.revenueLines, input.costEntries, period)
  const revenueAccrual = summary.revenue
  const revenueCash = sumRevenueCash(input.cashEntries, period)
  const costRecognized = summary.directCost + summary.indirectCost
  const costPaid = input.cashEntries.filter((c) => c.type === 'OWNER_PAYOUT' && isDateInPeriod(c.date, period)).reduce((sum, c) => sum - c.signedAmount, 0)

  const NO_RENTAL = '__NO_RENTAL__'
  const byRental = new Map<string, ReconciliationRentalRow>()
  function ensure(rentalId: string | undefined): ReconciliationRentalRow {
    const key = rentalId ?? NO_RENTAL
    let row = byRental.get(key)
    if (!row) {
      row = { rentalId: rentalId ?? null, accrual: 0, cash: 0, diff: 0 }
      byRental.set(key, row)
    }
    return row
  }
  for (const line of input.revenueLines) {
    if (!isDateInPeriod(line.recognitionDate, period)) continue
    const row = ensure(line.rentalId)
    row.accrual += line.amount
    row.customerId ??= line.customerId
  }
  for (const cash of input.cashEntries) {
    if (!cash.revenueRelated || !isDateInPeriod(cash.date, period)) continue
    const row = ensure(cash.rentalId)
    row.cash += cash.signedAmount
    row.customerId ??= cash.customerId
  }
  const rentalRows = Array.from(byRental.values())
    .map((r) => ({ ...r, diff: r.accrual - r.cash }))
    .filter((r) => r.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || (a.rentalId ?? '').localeCompare(b.rentalId ?? ''))

  return { revenueAccrual, revenueCash, revenueDiff: revenueAccrual - revenueCash, costRecognized, costPaid, costDiff: costRecognized - costPaid, rentalRows }
}

// ---- Report 06 — Dòng tiền vận hành (BRD §16) ----

export interface CashflowPoint {
  bucket: string
  cashIn: number
  /** Số dương. */
  cashOut: number
  net: number
}

export interface CashflowMethodRow {
  method: PaymentMethod
  cashIn: number
  cashOut: number
  net: number
}

export interface CashflowResult {
  points: CashflowPoint[]
  byMethod: CashflowMethodRow[]
  totals: { cashIn: number; cashOut: number; net: number }
  /** Cầu nối với thẻ Thực thu: `totals.net = revenueCash − offsetRevenue + nonRevenueNet`. */
  bridge: { revenueCash: number; offsetRevenue: number; nonRevenueNet: number }
}

/**
 * Report 06. Phạm vi = giao dịch có hiệu lực trong kỳ, bỏ `OFFSET` (cấn trừ cọc không có dòng tiền — §0.4 điểm 12), mọi loại giao dịch
 * (kể cả cọc thu/hoàn, chi trả chủ xe) nên khác thẻ Thực thu (chỉ phần liên quan doanh thu) — `bridge` giải thích phần lệch.
 * BẤT BIẾN: Σ points = Σ byMethod = totals; totals.net = revenueCash − offsetRevenue + nonRevenueNet.
 */
export function buildCashflow(input: { cashEntries: CashEntry[]; period: FinancePeriod; granularity: ReportGranularity }): CashflowResult {
  const { period, granularity } = input
  const points = new Map<string, CashflowPoint>(enumeratePeriodBuckets(period, granularity).map((bucket) => [bucket, { bucket, cashIn: 0, cashOut: 0, net: 0 }]))
  const methods = new Map<PaymentMethod, CashflowMethodRow>()
  const totals = { cashIn: 0, cashOut: 0, net: 0 }
  let offsetRevenue = 0
  let nonRevenueNet = 0
  for (const cash of input.cashEntries) {
    if (!isDateInPeriod(cash.date, period)) continue
    if (cash.method === 'OFFSET') {
      if (cash.revenueRelated) offsetRevenue += cash.signedAmount
      continue
    }
    if (!cash.revenueRelated) nonRevenueNet += cash.signedAmount
    const amountIn = cash.direction === 'IN' ? cash.signedAmount : 0
    const amountOut = cash.direction === 'OUT' ? -cash.signedAmount : 0
    const point = points.get(bucketKeyOf(cash.date, granularity))
    if (point) {
      point.cashIn += amountIn
      point.cashOut += amountOut
      point.net += cash.signedAmount
    }
    const row = methods.get(cash.method) ?? { method: cash.method, cashIn: 0, cashOut: 0, net: 0 }
    row.cashIn += amountIn
    row.cashOut += amountOut
    row.net += cash.signedAmount
    methods.set(cash.method, row)
    totals.cashIn += amountIn
    totals.cashOut += amountOut
    totals.net += cash.signedAmount
  }
  const order = PAYMENT_METHODS as readonly PaymentMethod[]
  return {
    points: Array.from(points.values()),
    byMethod: Array.from(methods.values()).sort((a, b) => order.indexOf(a.method) - order.indexOf(b.method)),
    totals,
    bridge: { revenueCash: sumRevenueCash(input.cashEntries, period), offsetRevenue, nonRevenueNet },
  }
}

/** Một phần của file CSV: tiêu đề phần · dòng tên cột · dòng dữ liệu · dòng tổng (nếu có). */
export interface CsvSection {
  title: string
  headers: string[]
  rows: CsvCell[][]
  totalRow?: CsvCell[]
}

/** Ghép khối đầu (`metaLines`, mỗi dòng 2 ô nhãn · giá trị) + dòng trống + các phần cách nhau 1 dòng trống. */
export function buildReportCsvRows(meta: { metaLines: [string, string][] }, sections: CsvSection[]): CsvCell[][] {
  const rows: CsvCell[][] = meta.metaLines.map(([label, value]) => [label, value])
  for (const section of sections) {
    rows.push([])
    rows.push([section.title])
    rows.push(section.headers)
    rows.push(...section.rows)
    if (section.totalRow) rows.push(section.totalRow)
  }
  return rows
}

/** `rowCount` của audit xuất = Σ số dòng dữ liệu (không tính khối đầu, dòng tên cột, dòng tổng). */
export function countCsvDataRows(sections: CsvSection[]): number {
  return sections.reduce((sum, s) => sum + s.rows.length, 0)
}
