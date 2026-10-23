import { z } from 'zod'
import { paths } from '@/app/paths'
import type { Rental } from '@/features/rentals/model'
import { signalDedupeKey, type OperationalSignal } from '@/shared/domain/alerts'
import {
  CONSIGNMENT_TERMINATION_REQUESTERS,
  type ConsignmentProrationRule,
  type OwnerPayoutAdjustmentStatus,
  type PayoutStatus,
  type Role,
} from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { addDaysToKey, dateTimeToMs, endOfMonthKey, formatDate, toDateKey } from '@/shared/lib/datetime'
import { generateId } from '@/shared/lib/id'
import { formatVnd } from '@/shared/lib/money'
import {
  CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS,
  dayDiff,
  isExpiringSoon,
  isFutureDateTime,
  nextSequenceCode,
  resolveTermVersion,
  type ConsignmentContract,
  type ConsignmentHandoverRecord,
  type VehicleOwner,
} from './model'

/**
 * Lịch chi trả chủ xe hàng tháng (Owner Payout Record) — `VehicleConsignment-BRD.md` mục 6.6, 10, 13, 14.
 * Mô hình chốt theo CR-2026-050: công ty giữ 100% doanh thu cho thuê, trả chủ xe MỘT khoản cố định hàng tháng.
 * Toàn bộ hàm trong file không đọc storage, không ghi audit, không tự gọi `new Date()` — mốc "hôm nay" / "kỳ tới"
 * luôn là tham số (`todayKey` / `uptoPeriod` / `now`). Ngoại lệ duy nhất: `materializeDrafts` sinh id ngẫu nhiên.
 * Kế hoạch: `docs/CONSIGNMENT-PLAN.md` mục 4, 19.4.
 */

const p = vi.consignment.payouts

// ---- Kiểu ----

export interface OwnerPayoutAdjustment {
  id: string
  /** Số nguyên khác 0, có dấu (+ tăng / − giảm khoản phải trả). */
  amount: number
  note: string
  status: OwnerPayoutAdjustmentStatus
  requestedByName: string
  requestedByRole: Role
  requestedAt: string
  decidedByName?: string
  decidedAt?: string
  decisionNote?: string
}

export interface OwnerPayoutStatusChange {
  from?: PayoutStatus
  to: PayoutStatus
  at: string
  byName: string
  reason?: string
}

/** "Linked Owner Payout" (BRD mục 6.6) — có = khoản này đang có lệnh chi; `paidAt` có ⇔ `status = PAID`. */
export interface OwnerPayoutLink {
  paymentRequestId: string
  transactionId: string
  transactionCode: string
  linkedAt: string
  paidAt?: string
}

export interface OwnerPayoutLogEntry {
  at: string
  byName: string
  event: 'LINKED' | 'PAID' | 'UNLINKED' | 'REVERTED'
  transactionCode: string
  note?: string
}

/** Owner Payout Record — BRD mục 6.6. VC-BR-21: mỗi hợp đồng mỗi kỳ có đúng một Record không huỷ. */
export interface OwnerPayoutRecord {
  id: string
  /** `CTCX-000001` tuần tự. */
  code: string
  contractId: string
  ownerId: string
  vehicleId: string
  /** `YYYY-MM` — tháng được trả cho. */
  period: string
  coverageFrom: string
  coverageTo: string
  daysCovered: number
  daysInMonth: number
  /** Điều khoản hiệu lực tại `coverageFrom` (VC-BR-05, AC-VC-012) — KHÔNG đọc `contract.paymentTerm`. */
  termVersionNo: number
  fixedMonthlyAmount: number
  paymentDay: number
  prorationRule: ConsignmentProrationRule
  baseAmount: number
  adjustments: OwnerPayoutAdjustment[]
  /** `baseAmount` + Σ điều chỉnh `APPROVED`; chỉ ghi qua `deriveAmountPayable`. */
  amountPayable: number
  dueDate: string
  status: PayoutStatus
  holdReason?: string
  cancelReason?: string
  replacesRecordId?: string
  replacedByRecordId?: string
  payout?: OwnerPayoutLink
  statusHistory: OwnerPayoutStatusChange[]
  payoutLog: OwnerPayoutLogEntry[]
  createdByName: string
  createdAt: string
  updatedAt: string
}

/** Bản nháp một kỳ chi trả — kết quả hàm tính, chưa có id / mã / trạng thái. */
export interface OwnerPayoutDraft {
  contractId: string
  ownerId: string
  vehicleId: string
  period: string
  coverageFrom: string
  coverageTo: string
  daysCovered: number
  daysInMonth: number
  termVersionNo: number
  fixedMonthlyAmount: number
  paymentDay: number
  prorationRule: ConsignmentProrationRule
  baseAmount: number
  dueDate: string
  /** UC-VC-06 A1 — bản thay thế kế thừa trạng thái tạm giữ + danh sách điều chỉnh của bản bị thay. */
  replacesRecordId?: string
  adjustments: OwnerPayoutAdjustment[]
  holdReason?: string
}

// ---- Tiện ích kỳ ----

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM` của một ngày `YYYY-MM-DD`. */
export function periodOf(dateKey: string): string {
  return dateKey.slice(0, 7) // date key — không phụ thuộc múi giờ
}

export function daysInMonthOf(period: string): number {
  return dayDiff(`${period}-01`, endOfMonthKey(`${period}-01`)) + 1
}

export function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${pad2(m + 1)}`
}

/** Mọi kỳ từ `from` đến `to` (gồm cả hai đầu); rỗng nếu `from > to`. */
export function periodRange(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = nextPeriod(cur)
  }
  return out
}

/** Hạn chi = `Payment Day` của tháng SAU kỳ (AC-VC-013); ngày vượt số ngày của tháng → ngày cuối tháng. */
export function calcDueDate(period: string, paymentDay: number): string {
  const next = nextPeriod(period)
  return `${next}-${pad2(Math.min(paymentDay, daysInMonthOf(next)))}`
}

// ---- Tính tiền ----

// `resolveTermVersion` nằm ở `model.ts` (dùng chung với `summarizeContracts`); re-export để giữ API cũ.
export { resolveTermVersion }

/**
 * Cửa sổ tính chi trả: `start = max(effectiveFrom, ngày địa phương của activatedAt)`,
 * `end = min(effectiveTo, endedDate ?? effectiveTo)`. Chưa từng kích hoạt → `undefined`.
 */
export function calcPayoutWindow(
  contract: Pick<ConsignmentContract, 'effectiveFrom' | 'effectiveTo' | 'activatedAt' | 'endedDate'>,
): { start: string; end: string } | undefined {
  if (!contract.activatedAt) return undefined
  const activatedKey = toDateKey(contract.activatedAt)
  const start = activatedKey > contract.effectiveFrom ? activatedKey : contract.effectiveFrom
  const end = contract.endedDate && contract.endedDate < contract.effectiveTo ? contract.endedDate : contract.effectiveTo
  if (start > end) return undefined
  return { start, end }
}

/** Bản nháp chi trả của một kỳ; `undefined` nếu kỳ nằm ngoài cửa sổ chi trả. */
export function calcPeriodPayout(contract: ConsignmentContract, period: string): OwnerPayoutDraft | undefined {
  const window = calcPayoutWindow(contract)
  if (!window) return undefined
  const dim = daysInMonthOf(period)
  const first = `${period}-01`
  const last = `${period}-${pad2(dim)}`
  const coverageFrom = first > window.start ? first : window.start
  const coverageTo = last < window.end ? last : window.end
  if (coverageFrom > coverageTo) return undefined
  const daysCovered = dayDiff(coverageFrom, coverageTo) + 1
  const version = resolveTermVersion(contract, coverageFrom)
  const term = version.paymentTerm
  // TODO(OQ: RentalSettlement-BRD.md mục 28 Q5–Q8 — quy tắc làm tròn tiền chưa chốt; demo làm tròn về đồng)
  const baseAmount =
    term.prorationRule === 'PRORATE_BY_DAY' ? Math.round((term.fixedMonthlyAmount * daysCovered) / dim) : term.fixedMonthlyAmount
  return {
    contractId: contract.id,
    ownerId: contract.ownerId,
    vehicleId: contract.vehicleId,
    period,
    coverageFrom,
    coverageTo,
    daysCovered,
    daysInMonth: dim,
    termVersionNo: version.versionNo,
    fixedMonthlyAmount: term.fixedMonthlyAmount,
    paymentDay: term.paymentDay,
    prorationRule: term.prorationRule,
    baseAmount,
    dueDate: calcDueDate(period, term.paymentDay),
    adjustments: [],
  }
}

/** Mọi kỳ từ đầu cửa sổ chi trả tới `min(uptoPeriod, kỳ của ngày kết thúc)` — dùng chung seed + sinh lịch. */
export function buildExpectedPayouts(contract: ConsignmentContract, uptoPeriod: string): OwnerPayoutDraft[] {
  const window = calcPayoutWindow(contract)
  if (!window) return []
  const lastPeriod = periodOf(window.end) < uptoPeriod ? periodOf(window.end) : uptoPeriod
  const drafts: OwnerPayoutDraft[] = []
  for (const period of periodRange(periodOf(window.start), lastPeriod)) {
    const draft = calcPeriodPayout(contract, period)
    if (draft) drafts.push(draft)
  }
  return drafts
}

/** `MM/YYYY` của một kỳ `YYYY-MM`. */
export function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  return `${month}/${year}`
}

/** Σ điều chỉnh đã duyệt của một khoản chi trả. */
export function sumApprovedAdjustments(record: Pick<OwnerPayoutRecord, 'adjustments'>): number {
  return record.adjustments.filter((a) => a.status === 'APPROVED').reduce((sum, a) => sum + a.amount, 0)
}

export function deriveAmountPayable(record: Pick<OwnerPayoutRecord, 'baseAmount' | 'adjustments'>): number {
  return (
    record.baseAmount +
    record.adjustments.filter((a) => a.status === 'APPROVED').reduce((sum, a) => sum + a.amount, 0)
  )
}

/** Dựng Record từ bản nháp — hàm thuần, dùng chung runtime (`payoutApi`/`api`) và seed. */
export function materializePayoutRecord(
  draft: OwnerPayoutDraft,
  meta: { id: string; code: string; createdAt: string; createdByName: string },
): OwnerPayoutRecord {
  const status: PayoutStatus = draft.holdReason ? 'ON_HOLD' : 'SCHEDULED'
  const base = {
    baseAmount: draft.baseAmount,
    adjustments: draft.adjustments,
  }
  return {
    id: meta.id,
    code: meta.code,
    contractId: draft.contractId,
    ownerId: draft.ownerId,
    vehicleId: draft.vehicleId,
    period: draft.period,
    coverageFrom: draft.coverageFrom,
    coverageTo: draft.coverageTo,
    daysCovered: draft.daysCovered,
    daysInMonth: draft.daysInMonth,
    termVersionNo: draft.termVersionNo,
    fixedMonthlyAmount: draft.fixedMonthlyAmount,
    paymentDay: draft.paymentDay,
    prorationRule: draft.prorationRule,
    ...base,
    amountPayable: deriveAmountPayable(base),
    dueDate: draft.dueDate,
    status,
    holdReason: draft.holdReason,
    replacesRecordId: draft.replacesRecordId,
    statusHistory: [{ to: status, at: meta.createdAt, byName: meta.createdByName, reason: draft.holdReason }],
    payoutLog: [],
    createdByName: meta.createdByName,
    createdAt: meta.createdAt,
    updatedAt: meta.createdAt,
  }
}

/** Dựng nhiều Record từ bản nháp, mã `CTCX-…` nối tiếp mã đang có (cả Record đã huỷ). */
export function materializeDrafts(
  drafts: OwnerPayoutDraft[],
  existing: OwnerPayoutRecord[],
  meta: { createdAt: string; createdByName: string },
): OwnerPayoutRecord[] {
  const codes = existing.map((r) => r.code)
  return drafts.map((draft) => {
    const code = nextSequenceCode('CTCX', codes)
    codes.push(code)
    return materializePayoutRecord(draft, { id: generateId('opr'), code, ...meta })
  })
}

// ---- Sinh lịch / kết thúc hợp đồng ----

function activeRecords(records: OwnerPayoutRecord[]): OwnerPayoutRecord[] {
  return records.filter((r) => r.status !== 'CANCELLED')
}

/**
 * Sinh lịch: hợp đồng `ACTIVE`/`SUSPENDED` × kỳ chưa có Record không huỷ → bản nháp (VC-BR-21).
 * `SUSPENDED` vẫn trả đủ (BRD mục 10).
 * TODO(OQ: VehicleConsignment-BRD.md mục 10 — "trừ khi Terms Snapshot ghi khác"; tài liệu chưa mô tả phương án khác)
 */
export function planPayoutGeneration(
  contracts: ConsignmentContract[],
  records: OwnerPayoutRecord[],
  uptoPeriod: string,
): OwnerPayoutDraft[] {
  const drafts: OwnerPayoutDraft[] = []
  for (const contract of contracts) {
    if (contract.status !== 'ACTIVE' && contract.status !== 'SUSPENDED') continue
    const have = new Set(activeRecords(records).filter((r) => r.contractId === contract.id).map((r) => r.period))
    for (const draft of buildExpectedPayouts(contract, uptoPeriod)) {
      if (!have.has(draft.period)) drafts.push(draft)
    }
  }
  return drafts
}

export interface ContractEndPlan {
  /** Record bị huỷ (chưa chi, chưa có lệnh chi). */
  cancel: OwnerPayoutRecord[]
  /** Bản nháp cần tạo: bản thay thế prorate + kỳ còn thiếu tới kỳ của ngày kết thúc. */
  create: OwnerPayoutDraft[]
}

export interface PayoutReconcileMessages {
  affectedPaid: (code: string, period: string) => string
  amountNotPositive: (code: string) => string
}

/**
 * Phần chung của "kết thúc hợp đồng" và "tính lại theo phụ lục": so Record không huỷ (`own`) với kỳ kỳ vọng (`expected`).
 * Record không có kỳ kỳ vọng → huỷ; Record khác kỳ vọng (theo `isUnchanged`) → huỷ + bản thay thế kế thừa tạm giữ và điều chỉnh
 * (UC-VC-06 A1); kỳ kỳ vọng chưa có Record → tạo bù. Record bị ảnh hưởng đã `PAID` / đang có lệnh chi → `{ error }`.
 */
export function reconcilePayoutRecords(
  own: OwnerPayoutRecord[],
  expected: OwnerPayoutDraft[],
  isUnchanged: (draft: OwnerPayoutDraft, record: OwnerPayoutRecord) => boolean,
  messages: PayoutReconcileMessages,
): ContractEndPlan | { error: string } {
  const expectedByPeriod = new Map(expected.map((d) => [d.period, d]))

  const cancel: OwnerPayoutRecord[] = []
  const create: OwnerPayoutDraft[] = []
  for (const record of own) {
    const draft = expectedByPeriod.get(record.period)
    if (draft && isUnchanged(draft, record)) continue
    if (record.status === 'PAID' || record.payout) return { error: messages.affectedPaid(record.code, formatPeriod(record.period)) }
    cancel.push(record)
    if (draft) {
      const replacement: OwnerPayoutDraft = {
        ...draft,
        replacesRecordId: record.id,
        adjustments: record.adjustments.map((a) => ({ ...a })),
        holdReason: record.status === 'ON_HOLD' ? record.holdReason : undefined,
      }
      if (deriveAmountPayable({ baseAmount: replacement.baseAmount, adjustments: replacement.adjustments }) <= 0) {
        return { error: messages.amountNotPositive(record.code) }
      }
      create.push(replacement)
    }
  }
  const have = new Set(own.map((r) => r.period))
  for (const draft of expected) {
    if (!have.has(draft.period)) create.push(draft)
  }
  create.sort((a, b) => a.period.localeCompare(b.period))
  return { cancel, create }
}

/**
 * Kết thúc giữa tháng (UC-VC-06 A1, AC-VC-015): Record kỳ sau kỳ của `endedDate` → huỷ; Record kỳ của `endedDate` → huỷ +
 * bản thay thế nếu số tiền / ngày bao phủ đổi (kế thừa tạm giữ + điều chỉnh); bù kỳ còn thiếu tới kỳ của `endedDate`.
 * Record bị ảnh hưởng đã `PAID` hoặc đang có lệnh chi → `{ error }`, yêu cầu đảo / huỷ giao dịch trước.
 */
export function planContractEnd(
  contract: ConsignmentContract,
  records: OwnerPayoutRecord[],
  endedDate: string,
): ContractEndPlan | { error: string } {
  const own = activeRecords(records).filter((r) => r.contractId === contract.id)
  const expected = buildExpectedPayouts({ ...contract, endedDate }, periodOf(endedDate))
  return reconcilePayoutRecords(
    own,
    expected,
    (draft, record) =>
      draft.baseAmount === record.baseAmount && draft.coverageFrom === record.coverageFrom && draft.coverageTo === record.coverageTo,
    { affectedPaid: p.endErrorAffectedPaid, amountNotPositive: p.endErrorAmountNotPositive },
  )
}

/**
 * Áp dụng kế hoạch kết thúc hợp đồng lên danh sách Record: huỷ các Record bị ảnh hưởng (kèm lý do, trỏ sang bản thay thế),
 * tạo bản thay thế / kỳ còn thiếu. Trả danh sách mới + hai nhóm để caller ghi audit.
 */
export function applyContractEndPlan(
  records: OwnerPayoutRecord[],
  plan: ContractEndPlan,
  meta: { now: string; byName: string; cancelReason: string },
): { records: OwnerPayoutRecord[]; cancelled: OwnerPayoutRecord[]; created: OwnerPayoutRecord[] } {
  const created = materializeDrafts(plan.create, records, { createdAt: meta.now, createdByName: meta.byName })
  const replacedBy = new Map<string, string>()
  for (const rec of created) if (rec.replacesRecordId) replacedBy.set(rec.replacesRecordId, rec.id)
  const cancelIds = new Set(plan.cancel.map((r) => r.id))
  const cancelled: OwnerPayoutRecord[] = []
  const next = records.map((r) => {
    if (!cancelIds.has(r.id)) return r
    const updated: OwnerPayoutRecord = {
      ...r,
      status: 'CANCELLED',
      cancelReason: meta.cancelReason,
      replacedByRecordId: replacedBy.get(r.id),
      statusHistory: [...r.statusHistory, { from: r.status, to: 'CANCELLED', at: meta.now, byName: meta.byName, reason: meta.cancelReason }],
      updatedAt: meta.now,
    }
    cancelled.push(updated)
    return updated
  })
  return { records: [...next, ...created], cancelled, created }
}

// ---- Guard trạng thái ----

export function canHold(record: OwnerPayoutRecord): boolean {
  return record.status === 'SCHEDULED' && !record.payout
}

export function canRelease(record: OwnerPayoutRecord): boolean {
  return record.status === 'ON_HOLD'
}

export function canAdjust(record: OwnerPayoutRecord): boolean {
  return (record.status === 'SCHEDULED' || record.status === 'ON_HOLD') && !record.payout
}

export function hasPendingAdjustment(record: OwnerPayoutRecord): boolean {
  return record.adjustments.some((a) => a.status === 'PENDING_APPROVAL')
}

export function canDecideAdjustment(record: OwnerPayoutRecord, adjustment: OwnerPayoutAdjustment): boolean {
  return canAdjust(record) && adjustment.status === 'PENDING_APPROVAL'
}

/**
 * VC-BR-10 / AC-VC-007 — điều kiện để tạo lệnh chi: Record `SCHEDULED`, chưa có lệnh chi, không có điều chỉnh chờ duyệt,
 * chủ xe có tài khoản nhận tiền, số phải trả > 0. Trả lý do chặn (tiếng Việt) hoặc `undefined` nếu được phép.
 * Dùng chung API `finance` và UI.
 */
export function getOwnerPayoutBlocker(
  record: OwnerPayoutRecord,
  owner: Pick<VehicleOwner, 'bankAccount'> | undefined,
): string | undefined {
  if (record.status !== 'SCHEDULED') return p.blockerNotScheduled
  if (record.payout) return p.blockerHasPayout(record.payout.transactionCode)
  if (hasPendingAdjustment(record)) return p.blockerPendingAdjustment
  if (!owner?.bankAccount) return p.blockerNoBank
  if (record.amountPayable <= 0) return p.blockerAmount
  return undefined
}

// ---- Biến đổi thuần khi đồng bộ với Payment (dùng bởi 4 hàm đồng bộ và seed finance) ----

export interface OwnerPayoutLinkInfo {
  paymentRequestId: string
  transactionId: string
  transactionCode: string
  at: string
  byName: string
}

export function applyOwnerPayoutLinked(record: OwnerPayoutRecord, info: OwnerPayoutLinkInfo): OwnerPayoutRecord {
  return {
    ...record,
    payout: {
      paymentRequestId: info.paymentRequestId,
      transactionId: info.transactionId,
      transactionCode: info.transactionCode,
      linkedAt: info.at,
    },
    payoutLog: [...record.payoutLog, { at: info.at, byName: info.byName, event: 'LINKED', transactionCode: info.transactionCode }],
    updatedAt: info.at,
  }
}

export function applyOwnerPayoutPaid(
  record: OwnerPayoutRecord,
  info: { paidAt: string; byName: string },
): OwnerPayoutRecord {
  const link = record.payout
  return {
    ...record,
    status: 'PAID',
    payout: link ? { ...link, paidAt: info.paidAt } : link,
    statusHistory: [...record.statusHistory, { from: record.status, to: 'PAID', at: info.paidAt, byName: info.byName }],
    payoutLog: [
      ...record.payoutLog,
      { at: info.paidAt, byName: info.byName, event: 'PAID', transactionCode: link?.transactionCode ?? '' },
    ],
    updatedAt: info.paidAt,
  }
}

/** Giao dịch `FAILED`/`VOIDED` → gỡ liên kết, Record vẫn `SCHEDULED`. */
export function applyOwnerPayoutUnlinked(
  record: OwnerPayoutRecord,
  info: { at: string; byName: string; reason: string },
): OwnerPayoutRecord {
  return {
    ...record,
    payout: undefined,
    payoutLog: [
      ...record.payoutLog,
      { at: info.at, byName: info.byName, event: 'UNLINKED', transactionCode: record.payout?.transactionCode ?? '', note: info.reason },
    ],
    updatedAt: info.at,
  }
}

/** Giao dịch đã chi bị đảo → Record về `SCHEDULED`, gỡ liên kết (VC-BR-13). */
export function applyOwnerPayoutReverted(
  record: OwnerPayoutRecord,
  info: { at: string; byName: string; reason: string },
): OwnerPayoutRecord {
  return {
    ...record,
    status: 'SCHEDULED',
    payout: undefined,
    statusHistory: [
      ...record.statusHistory,
      { from: record.status, to: 'SCHEDULED', at: info.at, byName: info.byName, reason: info.reason },
    ],
    payoutLog: [
      ...record.payoutLog,
      { at: info.at, byName: info.byName, event: 'REVERTED', transactionCode: record.payout?.transactionCode ?? '', note: info.reason },
    ],
    updatedAt: info.at,
  }
}

// ---- Nhắc việc + công nợ chủ xe ----

/** VC-BR-20 — `SCHEDULED`/`ON_HOLD`, còn 0–3 ngày tới hạn chi. */
export function isPayoutDueSoon(record: OwnerPayoutRecord, todayKey: string): boolean {
  if (record.status !== 'SCHEDULED' && record.status !== 'ON_HOLD') return false
  const left = dayDiff(todayKey, record.dueDate)
  return left >= 0 && left <= CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS
}

export function isPayoutOverdue(record: OwnerPayoutRecord, todayKey: string): boolean {
  return (record.status === 'SCHEDULED' || record.status === 'ON_HOLD') && record.dueDate < todayKey
}

/**
 * Tín hiệu ký gửi — hợp đồng sắp hết hạn (`isExpiringSoon`, VC-BR-19) và khoản chi trả chủ xe sắp/quá hạn
 * (`isPayoutDueSoon` → `NORMAL`, `isPayoutOverdue` → `URGENT`, VC-BR-20). Ngưỡng dùng nguyên hằng
 * `CONSIGNMENT_EXPIRY_REMINDER_DAYS`/`CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS` của module. Hàm thuần: `todayKey` là tham số.
 * CR-2026-051: Phase 1 nhắc gửi Admin (định tuyến người nhận ở `features/notifications`). DASHBOARD-PLATFORM-PLAN.md §4.1.
 */
export function collectConsignmentSignals(
  contracts: ConsignmentContract[],
  payoutRecords: OwnerPayoutRecord[],
  todayKey: string,
): OperationalSignal[] {
  const signals: OperationalSignal[] = []
  const contractNoById = new Map(contracts.map((c) => [c.id, c.contractNo]))
  for (const contract of contracts) {
    if (!isExpiringSoon(contract, todayKey)) continue
    signals.push({
      dedupeKey: signalDedupeKey('CONSIGNMENT_CONTRACT_EXPIRING', 'ConsignmentContract', contract.id, contract.effectiveTo),
      eventType: 'CONSIGNMENT_CONTRACT_EXPIRING',
      sourceModule: 'VC',
      group: 'CONSIGNMENT',
      resource: 'CONSIGNMENT',
      entityType: 'ConsignmentContract',
      entityId: contract.id,
      entityLabel: `${vi.notifications.entity.consignmentContract} ${contract.contractNo}`,
      priority: 'NORMAL',
      dueRef: contract.effectiveTo,
      payload: {
        contractCode: contract.contractNo,
        endDate: formatDate(contract.effectiveTo),
        daysLeft: dayDiff(todayKey, contract.effectiveTo),
      },
      link: paths.consignmentContractDetail(contract.id),
    })
  }
  for (const record of payoutRecords) {
    const overdue = isPayoutOverdue(record, todayKey)
    if (!overdue && !isPayoutDueSoon(record, todayKey)) continue
    const contractCode = contractNoById.get(record.contractId) ?? record.contractId
    signals.push({
      dedupeKey: signalDedupeKey('CONSIGNMENT_PAYMENT_DUE', 'OwnerPayoutRecord', record.id, record.dueDate),
      eventType: 'CONSIGNMENT_PAYMENT_DUE',
      sourceModule: 'VC',
      group: 'CONSIGNMENT',
      resource: 'CONSIGNMENT',
      entityType: 'OwnerPayoutRecord',
      entityId: record.id,
      entityLabel: `${vi.notifications.entity.payout} ${record.code}`,
      priority: overdue ? 'URGENT' : 'NORMAL',
      dueRef: record.dueDate,
      payload: {
        kind: overdue ? 'OVERDUE' : 'DUE_SOON',
        contractCode,
        period: record.period,
        dueDate: formatDate(record.dueDate),
        daysOverdue: Math.max(0, dayDiff(record.dueDate, todayKey)),
      },
      link: paths.consignmentPayouts,
    })
  }
  return signals
}

export interface OwnerPayableSummary {
  ownerId: string
  /** Σ khoản `SCHEDULED` đã tới hạn (`dueDate ≤ hôm nay`) chưa chi. */
  dueUnpaid: number
  /** Σ khoản đang `ON_HOLD` (mọi hạn). */
  onHold: number
  overdueCount: number
  overdueAmount: number
  /** Σ khoản `PAID`. */
  paidTotal: number
  /** Hạn chi gần nhất (≥ hôm nay) của khoản chưa chi. */
  nextDueDate?: string
}

/** BRD mục 14 "công nợ chủ xe" — gom theo chủ xe, bỏ khoản `CANCELLED`. */
export function summarizeOwnerPayables(records: OwnerPayoutRecord[], todayKey: string): OwnerPayableSummary[] {
  const map = new Map<string, OwnerPayableSummary>()
  for (const r of records) {
    if (r.status === 'CANCELLED') continue
    let s = map.get(r.ownerId)
    if (!s) {
      s = { ownerId: r.ownerId, dueUnpaid: 0, onHold: 0, overdueCount: 0, overdueAmount: 0, paidTotal: 0 }
      map.set(r.ownerId, s)
    }
    if (r.status === 'PAID') {
      s.paidTotal += r.amountPayable
      continue
    }
    if (r.status === 'ON_HOLD') s.onHold += r.amountPayable
    if (r.status === 'SCHEDULED' && r.dueDate <= todayKey) s.dueUnpaid += r.amountPayable
    if (isPayoutOverdue(r, todayKey)) {
      s.overdueCount += 1
      s.overdueAmount += r.amountPayable
    }
    if (r.dueDate >= todayKey && (!s.nextDueDate || r.dueDate < s.nextDueDate)) s.nextDueDate = r.dueDate
  }
  return [...map.values()]
}

/**
 * UC-VC-11 A2 — điều kiện đóng hợp đồng khi hết hạn: `effectiveTo ≤ hôm nay`, đã có biên bản trả xe, đủ kỳ trong lịch và
 * mọi Record không huỷ đã `PAID`. Trả lý do chặn hoặc `undefined`.
 */
export function canCloseContract(
  contract: ConsignmentContract,
  records: OwnerPayoutRecord[],
  returnRecord: ConsignmentHandoverRecord | undefined,
  todayKey: string,
): string | undefined {
  if (contract.effectiveTo > todayKey) return p.closeBlockNotEnded
  if (!returnRecord || returnRecord.type !== 'RETURN') return p.closeBlockNoReturn
  const own = activeRecords(records).filter((r) => r.contractId === contract.id)
  const unpaid = own.filter((r) => r.status !== 'PAID')
  if (unpaid.length > 0) {
    return p.closeBlockUnpaid(unpaid.length, formatVnd(unpaid.reduce((sum, r) => sum + r.amountPayable, 0)))
  }
  const have = new Set(own.map((r) => r.period))
  const missing = buildExpectedPayouts({ ...contract, endedDate: contract.effectiveTo }, periodOf(contract.effectiveTo)).filter(
    (d) => !have.has(d.period),
  )
  if (missing.length > 0) return p.closeBlockMissing(missing.length)
  return undefined
}

// ---- Lượt thuê của xe (VC-BR-14) ----

type RentalLite = Pick<Rental, 'id' | 'status' | 'vehicleId'>

/** Lượt thuê chặn việc trả xe về chủ (§19.1 điểm 18). */
export const BLOCKING_RENTAL_STATUSES: Rental['status'][] = [
  'CONFIRMED',
  'CONTRACT_CREATED',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'IN_RENTAL',
]

export function listBlockingRentals<T extends RentalLite>(rentals: T[], vehicleId: string): T[] {
  return rentals.filter((r) => r.vehicleId === vehicleId && BLOCKING_RENTAL_STATUSES.includes(r.status))
}

/** Lượt `DRAFT` chỉ cảnh báo, không chặn. */
export function listDraftRentals<T extends RentalLite>(rentals: T[], vehicleId: string): T[] {
  return rentals.filter((r) => r.vehicleId === vehicleId && r.status === 'DRAFT')
}

// ---- Form schema (RHF + zodResolver) ----

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/
const SIGNED_INT_RE = /^-?\d+$/
const NUMERIC_RE = /^\d+$/

/** Điều chỉnh thủ công khoản chi trả — số nguyên có dấu khác 0 + ghi chú. */
export const ownerPayoutAdjustmentSchema = z.object({
  amount: z
    .string()
    .trim()
    .refine((v) => SIGNED_INT_RE.test(v) && Number(v) !== 0, { message: p.adjustAmountInvalid }),
  note: z.string().trim().min(3, p.adjustNoteRequired),
})

export type OwnerPayoutAdjustmentFormValues = z.infer<typeof ownerPayoutAdjustmentSchema>

export interface TerminationNoticeContext {
  effectiveFrom: string
  effectiveTo: string
  noticePeriodDays: number
  todayKey: string
}

/** Ngày dự kiến kết thúc sớm nhất hợp lệ = ngày thông báo + Notice Period (VC-BR-14). */
export function earliestPlannedEnd(noticeDate: string, noticePeriodDays: number): string {
  return addDaysToKey(noticeDate, noticePeriodDays)
}

/** Thông báo chấm dứt (§19.1 điểm 17): cho nhập lùi, `effectiveFrom ≤ noticeDate ≤ hôm nay`, `plannedEnd ≥ noticeDate + notice`. */
export function makeTerminationNoticeSchema(ctx: TerminationNoticeContext) {
  return z
    .object({
      requestedBy: z.enum(CONSIGNMENT_TERMINATION_REQUESTERS),
      noticeDate: z.string().regex(DATE_KEY_RE, p.noticeDateRequired),
      plannedEndDate: z.string().regex(DATE_KEY_RE, p.plannedEndRequired),
      reason: z.string().trim().min(3, p.noticeReasonRequired),
    })
    .superRefine((v, c) => {
      if (DATE_KEY_RE.test(v.noticeDate)) {
        if (v.noticeDate > ctx.todayKey) c.addIssue({ code: 'custom', path: ['noticeDate'], message: p.noticeDateFuture })
        else if (v.noticeDate < ctx.effectiveFrom) {
          c.addIssue({ code: 'custom', path: ['noticeDate'], message: p.noticeDateBeforeEffective })
        }
      }
      if (DATE_KEY_RE.test(v.noticeDate) && DATE_KEY_RE.test(v.plannedEndDate)) {
        const earliest = earliestPlannedEnd(v.noticeDate, ctx.noticePeriodDays)
        if (v.plannedEndDate < earliest) {
          c.addIssue({ code: 'custom', path: ['plannedEndDate'], message: p.plannedEndTooSoon(ctx.noticePeriodDays) })
        } else if (v.plannedEndDate >= ctx.effectiveTo) {
          c.addIssue({ code: 'custom', path: ['plannedEndDate'], message: p.plannedEndAfterExpiry })
        }
      }
    })
}

export type TerminationNoticeFormValues = z.infer<ReturnType<typeof makeTerminationNoticeSchema>>

export interface ConsignmentReturnContext {
  intakeHandoverAt: string
  intakeOdoKm: number
}

/** Biên bản trả xe — mirror biên bản nhận xe nhưng không có định giá; chặn thời điểm tương lai (nợ R1). */
export function makeConsignmentReturnFormSchema(ctx: ConsignmentReturnContext) {
  return z.object({
    handoverAt: z
      .string()
      .min(1, p.returnAtRequired)
      .refine((v) => !isFutureDateTime(v), { message: p.returnAtFuture })
      .refine((v) => dateTimeToMs(v) >= dateTimeToMs(ctx.intakeHandoverAt), { message: p.returnAtBeforeIntake }),
    odoKm: z
      .string()
      .trim()
      .refine((v) => NUMERIC_RE.test(v), { message: p.returnOdoInvalid })
      .refine((v) => !NUMERIC_RE.test(v) || Number(v) >= ctx.intakeOdoKm, { message: p.returnOdoBelowIntake(ctx.intakeOdoKm) }),
    fuelLevel: z
      .string()
      .trim()
      .refine((v) => NUMERIC_RE.test(v) && Number(v) <= 100, { message: p.returnFuelInvalid }),
    baselineCondition: z.string().trim().min(3, p.returnConditionRequired),
    checklist: z.array(z.object({ item: z.string(), ok: z.boolean(), note: z.string().trim().optional() })),
    accessoriesText: z.string().trim().optional(),
    documents: z.array(z.object({ name: z.string(), kind: z.enum(['ORIGINAL', 'COPY', 'NONE']) })),
    missingDocumentsNote: z.string().trim().optional(),
    mediaNote: z.string().trim().optional(),
    companyRepName: z.string().trim().min(2, p.returnCompanyRepRequired),
    ownerConfirmed: z.boolean().refine((v) => v === true, { message: p.returnOwnerConfirmRequired }),
    companyConfirmed: z.boolean().refine((v) => v === true, { message: p.returnCompanyConfirmRequired }),
  })
}

export type ConsignmentReturnFormValues = z.infer<ReturnType<typeof makeConsignmentReturnFormSchema>>

export interface VehicleLossContext {
  payoutStart: string
  todayKey: string
}

/** Mất xe (UC-VC-12): `payoutStart ≤ Event Date ≤ hôm nay`. */
export function makeVehicleLossSchema(ctx: VehicleLossContext) {
  return z.object({
    eventDate: z
      .string()
      .regex(DATE_KEY_RE, p.lossDateRequired)
      .refine((v) => v <= ctx.todayKey, { message: p.lossDateFuture })
      .refine((v) => v >= ctx.payoutStart, { message: p.lossDateBeforeStart }),
    incidentId: z.string().optional(),
    note: z.string().trim().min(3, p.lossNoteRequired),
  })
}

export type VehicleLossFormValues = z.infer<ReturnType<typeof makeVehicleLossSchema>>
