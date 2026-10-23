// Revenue & Cost (RV) — fake API. Tách từ `finance/api.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.2.
import { OWNER_PAYOUT_RECORDS_STORAGE_KEY, type OwnerPayoutRecord } from '@/features/consignment'
import { INCIDENTS_STORAGE_KEY, type Incident } from '@/features/incidents'
import {
  MAINTENANCE_RECORDS_STORAGE_KEY,
  SPARE_PART_RECORDS_STORAGE_KEY,
  type MaintenanceRecord,
  type SparePartRecord,
} from '@/features/maintenance'
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import type { AllocationType, CostCategory } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { readAllPsc, readAllSettlements as readAll, readAllTransactions } from '../core/storage.ts'
import type { ActorInfo } from '../core/types.ts'
import { nextSequenceCode } from '../payment/model.ts'
import {
  type CashEntry,
  type CostEntry,
  type CostRecord,
  deriveCashEntries,
  deriveConsignmentPayoutCostEntries,
  deriveIncidentCostEntries,
  deriveMaintenanceCostEntries,
  deriveRevenueLines,
  expandCostRecord,
  type FinanceReportKey,
  isFinanceReportKey,
  isManualCostCategory,
  type ReportExportFilters,
  type RevenueLine,
} from './model.ts'

// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §6 ====

export const COST_RECORDS_STORAGE_KEY = 'costRecords'

function readAllCostRecords(): CostRecord[] {
  return readJson<CostRecord[]>(COST_RECORDS_STORAGE_KEY) ?? []
}
function writeAllCostRecords(items: CostRecord[]): void {
  writeJson(COST_RECORDS_STORAGE_KEY, items)
}

export interface RevenueLineFilter {
  vehicleId?: string
  customerId?: string
  rentalId?: string
}

/** Revenue Line không lưu (§0.3 điểm 1) — suy ra từ Settlement + PSC. Không lọc kỳ ở API (hàm thuần lọc, cần cả kỳ trước). */
export async function listRevenueLines(filter?: RevenueLineFilter): Promise<RevenueLine[]> {
  return fakeRequest(() =>
    deriveRevenueLines(readAll(), readAllPsc()).filter((l) => {
      if (filter?.vehicleId && l.vehicleId !== filter.vehicleId) return false
      if (filter?.customerId && l.customerId !== filter.customerId) return false
      if (filter?.rentalId && l.rentalId !== filter.rentalId) return false
      return true
    }),
  )
}

export interface CostRecordFilter {
  vehicleId?: string
  includeReversed?: boolean
}

/** Cost Record nhập tay đã lưu, mới nhất trước theo `costDate`. */
export async function listCostRecords(filter?: CostRecordFilter): Promise<CostRecord[]> {
  return fakeRequest(() =>
    readAllCostRecords()
      .filter((r) => (filter?.includeReversed ? true : r.status === 'ACTIVE'))
      .filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId)
      .sort((a, b) => b.costDate.localeCompare(a.costDate) || b.enteredAt.localeCompare(a.enteredAt)),
  )
}

export interface CostEntryFilter {
  vehicleId?: string
}

/** View chi phí thống nhất: nhập tay (đã rải kỳ) + sự cố + bảo dưỡng/phụ tùng — RV-BR-04/11, sửa ở module nguồn. */
export async function listCostEntries(filter?: CostEntryFilter): Promise<CostEntry[]> {
  return fakeRequest(() => {
    const manual = readAllCostRecords().flatMap(expandCostRecord)
    const incident = deriveIncidentCostEntries(readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? [])
    const maintenance = deriveMaintenanceCostEntries(
      readJson<MaintenanceRecord[]>(MAINTENANCE_RECORDS_STORAGE_KEY) ?? [],
      readJson<SparePartRecord[]>(SPARE_PART_RECORDS_STORAGE_KEY) ?? [],
    )
    // RV-BR-19 (CR-2026-050) — Owner Payout Record của features/consignment → CostEntry CONSIGNMENT_PAYOUT, DIRECT, ghi nhận theo kỳ.
    const consignment = deriveConsignmentPayoutCostEntries(readJson<OwnerPayoutRecord[]>(OWNER_PAYOUT_RECORDS_STORAGE_KEY) ?? [])
    return [...manual, ...incident, ...maintenance, ...consignment]
      .filter((c) => !filter?.vehicleId || c.vehicleId === filter.vehicleId)
      .sort((a, b) => b.costDate.localeCompare(a.costDate))
  })
}

export interface CashEntryFilter {
  customerId?: string
}

/** Góc nhìn thực thu (RV-BR-14) suy ra từ sổ giao dịch hiệu lực. */
export async function listCashEntries(filter?: CashEntryFilter): Promise<CashEntry[]> {
  return fakeRequest(() => deriveCashEntries(readAllTransactions()).filter((c) => !filter?.customerId || c.customerId === filter.customerId))
}

export interface CostRecordInput {
  category: CostCategory
  amount: number
  /** `YYYY-MM-DD`. */
  costDate: string
  allocationType: AllocationType
  vehicleId?: string
  rentalId?: string
  spreadMonths: number
  isUnusual: boolean
  evidenceNote?: string
  note?: string
}

const COST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Guard dùng chung cho tạo/sửa — lặp lại ở API, không chỉ dựa vào schema của form (RV-BR-04, RV-BR-19, BRD §9 BR). */
function assertCostRecordInput(input: CostRecordInput): void {
  if (!isManualCostCategory(input.category)) {
    throw new Error('Chi phí sự cố và chi trả chủ xe ký gửi được ghi nhận tự động, không nhập tay')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương')
  if (!COST_DATE_RE.test(input.costDate)) throw new Error('Ngày chi phí không hợp lệ')
  if (input.costDate > toDateKey(new Date().toISOString())) throw new Error('Ngày chi phí không được ở tương lai')
  if (!Number.isInteger(input.spreadMonths) || input.spreadMonths < 1 || input.spreadMonths > 36) {
    throw new Error('Số tháng rải phải là số nguyên từ 1 đến 36')
  }
  if (input.allocationType === 'DIRECT') {
    if (!input.vehicleId) throw new Error('Chi phí trực tiếp phải gắn với một xe')
  } else if (input.vehicleId || input.rentalId) {
    throw new Error('Chi phí gián tiếp không gắn xe hoặc lượt thuê')
  }
  if (input.rentalId) {
    const rental = (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []).find((r) => r.id === input.rentalId)
    if (!rental) throw new Error('Không tìm thấy lượt thuê')
    if (rental.vehicleId !== input.vehicleId) throw new Error('Lượt thuê không thuộc xe đã chọn')
  }
}

const COST_RECORD_DIFF_KEYS = ['category', 'amount', 'costDate', 'allocationType', 'vehicleId', 'rentalId', 'spreadMonths', 'isUnusual', 'evidenceNote', 'note'] as const

/**
 * UC-RV-03, BRD §18 — nhập chi phí thủ công (`Source = MANUAL`). RV-BR-17: KHÔNG tự tạo giao dịch Payment.
 * RV-BR-16: audit đầy đủ.
 */
export async function createCostRecord(input: CostRecordInput, actor: ActorInfo): Promise<CostRecord> {
  return fakeRequest(() => {
    assertCostRecordInput(input)
    const records = readAllCostRecords()
    const now = new Date().toISOString()
    const record: CostRecord = {
      id: generateId('cst'),
      code: nextSequenceCode('CP', records.map((r) => r.code)),
      category: input.category,
      amount: input.amount,
      costDate: input.costDate,
      allocationType: input.allocationType,
      vehicleId: input.vehicleId || undefined,
      rentalId: input.rentalId || undefined,
      spreadMonths: input.spreadMonths,
      isUnusual: input.isUnusual,
      evidenceNote: input.evidenceNote || undefined,
      note: input.note || undefined,
      status: 'ACTIVE',
      enteredByName: actor.fullName,
      enteredByRole: actor.role,
      enteredAt: now,
      updatedAt: now,
    }
    writeAllCostRecords([...records, record])
    appendAudit({
      action: 'COST_MANUAL_CREATE',
      entity: 'CostRecord',
      entityId: record.id,
      summary: `Thêm chi phí ${record.code} (${record.category}) ${record.amount.toLocaleString('vi-VN')}đ`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: record,
    })
    return record
  })
}

/**
 * UC-RV-04, AC-RV-013 — sửa chi phí nhập tay, audit ghi giá trị cũ → mới của các field đổi.
 * TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close; mọi bản ghi coi như thuộc kỳ đang mở, RV-BR-10)
 * TODO(OQ: RevenueCost-UseCase.md UC-RV-04 bước 2 — "lý do nếu thay đổi lớn", chưa có ngưỡng)
 */
export async function updateCostRecord(id: string, input: CostRecordInput, actor: ActorInfo): Promise<CostRecord> {
  return fakeRequest(() => {
    const records = readAllCostRecords()
    const before = records.find((r) => r.id === id)
    if (!before) throw new Error('Không tìm thấy chi phí')
    if (before.status !== 'ACTIVE') throw new Error('Chỉ sửa được chi phí đang hiệu lực')
    assertCostRecordInput(input)
    const next = {
      category: input.category,
      amount: input.amount,
      costDate: input.costDate,
      allocationType: input.allocationType,
      vehicleId: input.vehicleId || undefined,
      rentalId: input.rentalId || undefined,
      spreadMonths: input.spreadMonths,
      isUnusual: input.isUnusual,
      evidenceNote: input.evidenceNote || undefined,
      note: input.note || undefined,
    }
    const changedKeys = COST_RECORD_DIFF_KEYS.filter((k) => before[k] !== next[k])
    if (changedKeys.length === 0) return before
    const now = new Date().toISOString()
    const after: CostRecord = { ...before, ...next, updatedByName: actor.fullName, updatedAt: now }
    writeAllCostRecords(records.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'COST_MANUAL_UPDATE',
      entity: 'CostRecord',
      entityId: id,
      summary: `Sửa chi phí ${before.code}: ${changedKeys.join(', ')}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: Object.fromEntries(changedKeys.map((k) => [k, before[k]])),
      after: Object.fromEntries(changedKeys.map((k) => [k, after[k]])),
    })
    return after
  })
}

/**
 * RV-BR-10, `RevenueCost-BRD.md` §25.4 — "xoá" chi phí nhập tay = huỷ mềm (không xoá vật lý), lý do bắt buộc.
 * TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close; mọi bản ghi coi như thuộc kỳ đang mở, RV-BR-10)
 */
export async function reverseCostRecord(id: string, reason: string, actor: ActorInfo): Promise<CostRecord> {
  const trimmedReason = reason.trim()
  if (trimmedReason.length < 5) throw new Error('Lý do huỷ là bắt buộc (tối thiểu 5 ký tự)')
  return fakeRequest(() => {
    const records = readAllCostRecords()
    const before = records.find((r) => r.id === id)
    if (!before) throw new Error('Không tìm thấy chi phí')
    if (before.status !== 'ACTIVE') throw new Error('Chi phí này đã được huỷ trước đó')
    const now = new Date().toISOString()
    const after: CostRecord = { ...before, status: 'REVERSED', reverseReason: trimmedReason, reversedByName: actor.fullName, reversedAt: now, updatedByName: actor.fullName, updatedAt: now }
    writeAllCostRecords(records.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'COST_MANUAL_REVERSE',
      entity: 'CostRecord',
      entityId: id,
      summary: `Huỷ chi phí ${before.code}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status, reason: trimmedReason },
    })
    return after
  })
}

export interface RecordReportExportInput {
  reportKey: FinanceReportKey
  /** `yyyy-MM-dd`. */
  from: string
  /** `yyyy-MM-dd`. */
  to: string
  /** Số dòng dữ liệu của file (không tính khối đầu, dòng tên cột, dòng tổng). */
  rowCount: number
  filters: ReportExportFilters
}

const REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Chỉ giữ các khoá bộ lọc đã biết, đúng kiểu id/enum/boolean — không để lọt tên/SĐT khách vào audit (AuditLog-BRD.md §11). */
function sanitizeReportFilters(filters: ReportExportFilters): ReportExportFilters {
  const safe: ReportExportFilters = {}
  if (typeof filters.vehicleId === 'string') safe.vehicleId = filters.vehicleId
  if (typeof filters.customerId === 'string') safe.customerId = filters.customerId
  if (filters.customerStatus === 'ACTIVE' || filters.customerStatus === 'BLOCKED') safe.customerStatus = filters.customerStatus
  if (filters.granularity === 'DAY' || filters.granularity === 'WEEK' || filters.granularity === 'MONTH') safe.granularity = filters.granularity
  if (typeof filters.sortKey === 'string') safe.sortKey = filters.sortKey
  if (typeof filters.excludeUnusual === 'boolean') safe.excludeUnusual = filters.excludeUnusual
  return safe
}

/**
 * UC-RV-13 / AuditLog — ghi ĐÚNG một bản ghi `REPORT_EXPORT` mỗi lần xuất; UI chỉ tải file sau khi hàm này thành công.
 * Không ghi họ tên/SĐT/CCCD khách: `filters` chỉ chứa id/enum/boolean.
 * TODO(OQ: RevenueCost-BRD.md §28 Q14 — định dạng xuất PDF/Excel chưa chốt; demo xuất CSV mở bằng Excel)
 */
export async function recordReportExport(input: RecordReportExportInput, actor: ActorInfo): Promise<void> {
  return fakeRequest(() => {
    if (!isFinanceReportKey(input.reportKey)) throw new Error(vi.finance.reports.exportAuditInvalid)
    if (!REPORT_DATE_RE.test(input.from) || !REPORT_DATE_RE.test(input.to) || input.from > input.to) throw new Error(vi.finance.reports.exportAuditInvalid)
    if (!Number.isInteger(input.rowCount) || input.rowCount < 0) throw new Error(vi.finance.reports.exportAuditInvalid)
    const filters = sanitizeReportFilters(input.filters)
    appendAudit({
      action: 'REPORT_EXPORT',
      entity: 'FinanceReport',
      entityId: input.reportKey,
      summary: vi.finance.reports.exportAuditSummary
        .replace('{report}', vi.finance.reports.exportNames[input.reportKey])
        .replace('{from}', formatDate(input.from))
        .replace('{to}', formatDate(input.to))
        .replace('{count}', String(input.rowCount)),
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: { reportKey: input.reportKey, from: input.from, to: input.to, rowCount: input.rowCount, filters },
    })
  })
}
