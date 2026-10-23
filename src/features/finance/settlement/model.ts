// Module Rental Settlement (RS) — hàm thuần + form schema. Tách từ `finance/model.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.1.
import { z } from 'zod'
import type { ReturnIncidentItem, ReturnRecord } from '@/features/handover-return'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import {
  type AdditionalChargeType,
  type PostSettlementChargeSource,
  type PostSettlementChargeType,
  type Role,
  type SettlementLineCategory,
  type SettlementRequestType,
  type SettlementStatus,
  POST_SETTLEMENT_CHARGE_SOURCES,
  POST_SETTLEMENT_CHARGE_TYPES,
  SETTLEMENT_WAIVER_TYPES,
} from '@/shared/domain/enums'
import { generateId } from '@/shared/lib/id'
import { calcSettlementTotals, NUMERIC_RE } from '../core/model.ts'
import type {
  DepositReconciliation,
  PaymentRequest,
  PostSettlementCharge,
  Settlement,
  SettlementLine,
  SettlementReversal,
  SettlementWaiver,
  Transaction,
} from '../core/types.ts'
import { calcRequestProgress } from '../payment/model.ts'

// ---- §3.1 kế hoạch — Sinh dòng từ nguồn (RS-BR-03, `RentalSettlement-BRD.md` §8) ----

/** BA đề xuất mã — ánh xạ 1-1 `AdditionalChargeType` (Return) → `SettlementLineCategory`. */
const RETURN_CHARGE_CATEGORY: Record<AdditionalChargeType, SettlementLineCategory> = {
  EXTRA_KM: 'EXTRA_KM',
  FUEL_DEFICIT: 'FUEL_DEFICIT',
  OVERTIME: 'OVERTIME',
  DAMAGE: 'DAMAGE',
  VETC: 'VETC',
  TRAFFIC_FINE: 'TRAFFIC_FINE',
  MISSING_ACCESSORY: 'MISSING_ACCESSORY',
  DELIVERY_FEE: 'DELIVERY_FEE',
  OTHER: 'RETURN_OTHER',
  DISCOUNT: 'RETURN_DISCOUNT',
}

/** DI-BR excluded — sự cố ở các trạng thái này không sinh dòng khách chịu (khách không chịu khoản này). */
const INCIDENT_EXCLUDED_STATUSES: Incident['status'][] = ['CANCELLED', 'CLOSED_NO_ACTION', 'WRITTEN_OFF']
/** EX-01 — chỉ các trạng thái này mới cho phép chốt dòng `INCIDENT`. */
const INCIDENT_READY_STATUSES: Incident['status'][] = ['APPROVED', 'IN_REPAIR', 'REPAIRED', 'CLOSED']
/** Liability mà khách có thể phải chịu một phần/toàn bộ — `COMPANY`/`THIRD_PARTY`/`INSURANCE` không sinh dòng. */
const INCIDENT_CHARGEABLE_LIABILITIES: Incident['liability'][] = ['CUSTOMER', 'SHARED', 'UNDETERMINED']

/**
 * RS-BR-03/RS-BR-04 — sinh dòng khoản mục kế thừa từ Rental/Return/Incident,
 * KHÔNG sinh từ `Rental.additionalChargesAmount`/`deliveryFee` (§0.4 điểm 5 kế
 * hoạch — tránh tính trùng với dòng `RETURN`).
 */
export function buildSourceLines(input: { rental: Rental; returnRecord?: ReturnRecord; incidents: Incident[] }): SettlementLine[] {
  const lines: SettlementLine[] = []

  // Dòng RENTAL — mặc định CONFIRMED (đã snapshot, BRD §8 BR).
  lines.push({
    id: generateId('sln'),
    category: 'BASE_RENTAL',
    source: 'RENTAL',
    direction: 'CHARGE',
    actualAmount: input.rental.baseAmount,
    status: 'CONFIRMED',
    sourceReady: true,
  })
  if (input.rental.discountAmount > 0) {
    lines.push({
      id: generateId('sln'),
      category: 'CONTRACT_DISCOUNT',
      source: 'RENTAL',
      direction: 'DISCOUNT',
      actualAmount: input.rental.discountAmount,
      status: 'CONFIRMED',
      sourceReady: true,
      note: input.rental.discountNote,
    })
  }

  // Dòng RETURN — chỉ Return `COMPLETED` của đúng Rental, bắt đầu `DRAFT` (RS-BR-05).
  if (input.returnRecord && input.returnRecord.status === 'COMPLETED') {
    for (const item of input.returnRecord.additionalCharges) {
      lines.push({
        id: generateId('sln'),
        category: RETURN_CHARGE_CATEGORY[item.type],
        source: 'RETURN',
        direction: item.type === 'DISCOUNT' ? 'DISCOUNT' : 'CHARGE',
        estimatedAmount: item.amount,
        status: 'DRAFT',
        sourceReady: true,
        sourceRef: { returnRecordId: input.returnRecord.id, additionalChargeItemId: item.id },
        // §0.4 điểm 4 kế hoạch — dòng `DAMAGE` từ Return vẫn sinh (kế thừa RS-BR-03), chỉ cảnh báo.
        // TODO(OQ: RentalSettlement-BRD.md §8 — DAMAGE ở Return vs Customer Charge ở Incident, có thể tính trùng.)
        sourceWarning: item.type === 'DAMAGE' ? 'POSSIBLE_DUPLICATE_DAMAGE' : undefined,
        note: item.note,
      })
    }
  }

  // Dòng INCIDENT — chỉ Incident của đúng Rental, khách có thể phải chịu (không tự tính, chỉ đọc Customer Charge).
  // TODO(OQ: BusinessRequirementDocument.md §51 Q54 / RentalSettlement-BRD.md §28 Q21 — công thức sự cố nặng khi
  // Liability SHARED/UNDETERMINED ≠ khách 100%; Settlement chỉ đọc Customer Charge do Damage & Incident chốt.)
  for (const incident of input.incidents) {
    if (incident.rentalId !== input.rental.id) continue
    if (INCIDENT_EXCLUDED_STATUSES.includes(incident.status)) continue
    if (!INCIDENT_CHARGEABLE_LIABILITIES.includes(incident.liability)) continue
    lines.push({
      id: generateId('sln'),
      category: 'INCIDENT',
      source: 'INCIDENT',
      direction: 'CHARGE',
      estimatedAmount: incident.customerCharge ?? incident.estimatedCost,
      status: incident.status === 'DISPUTED' ? 'DISPUTED' : 'DRAFT', // UC-RS-03 A3
      sourceReady: incident.liability !== 'UNDETERMINED' && INCIDENT_READY_STATUSES.includes(incident.status), // EX-01
      sourceRef: { incidentId: incident.id },
    })
  }

  return lines
}

/**
 * `ReturnIncidentItem` chưa chuyển thành `Incident` — chỉ dùng để hiển thị
 * banner cảnh báo (BRD §8 — tiền sự cố chỉ đi qua Incident), KHÔNG sinh dòng.
 */
export function countPendingReturnIncidentItems(returnRecord: ReturnRecord | undefined, incidents: Incident[]): number {
  if (!returnRecord) return 0
  const convertedIds = new Set(incidents.map((i) => i.returnIncidentItemId).filter((v): v is string => !!v))
  return returnRecord.incidentItems.filter((item: ReturnIncidentItem) => !convertedIds.has(item.id)).length
}

// ---- §3.4 kế hoạch — Đối trừ tiền cọc (`RentalSettlement-BRD.md` §10) ----

export type DepositReconciliationResult = Omit<DepositReconciliation, 'reconciledByName' | 'reconciledAt'>

/**
 * RS-BR-09 — khớp đúng AC-RS-004 (Held 2tr, Final 3,78tr, Paid 1tr → Applied
 * 2tr, Balance 780k, Refundable 0) và AC-RS-005 (Held 2tr, Final 1,5tr, Paid
 * 1,5tr → Applied 0, Refundable 2tr).
 * TODO(OQ: RentalSettlement-BRD.md §28 Q1 — đối trừ tự động hay cần khách
 * đồng ý; demo: hệ thống đề xuất, Accountant bấm chốt, khách xác nhận ở bước
 * `PENDING_CUSTOMER`.) TODO(OQ: RentalSettlement-BRD.md §28 Q3 — giữ cọc chờ
 * phạt nguội, chưa áp dụng — hoàn toàn bộ phần dư.)
 */
export function calcDepositReconciliation(finalAmount: number, paidToDate: number, depositHeld: number): DepositReconciliationResult {
  if (finalAmount <= paidToDate) {
    return { finalAmount, paidToDate, depositHeld, depositApplied: 0, depositRefundable: depositHeld, balanceDue: finalAmount - paidToDate }
  }
  const shortfall = finalAmount - paidToDate
  const depositApplied = Math.min(shortfall, depositHeld)
  const balanceDue = shortfall - depositApplied
  const depositRefundable = depositHeld - depositApplied
  return { finalAmount, paidToDate, depositHeld, depositApplied, depositRefundable, balanceDue }
}

// ---- §3.6 kế hoạch — Ngưỡng miễn giảm (tạm) ----

/** TODO(OQ: RentalSettlement-BRD.md §28 Q9/Q10 — Ngưỡng A/B chưa chốt). Giá trị lấy từ ví dụ AC-RS-006, chỉ để demo. */
export const WAIVER_APPROVAL_THRESHOLD = 100_000

/** RS-BR-08 — vượt ngưỡng phải qua `WAITING_APPROVAL`, bất kể người tạo (kể cả Manager, không tự duyệt cho mình ở bản demo). */
export function waiverNeedsApproval(amount: number): boolean {
  return amount > WAIVER_APPROVAL_THRESHOLD
}

// ---- §3.7 kế hoạch — Guard trạng thái & điều kiện ----

/** `RentalSettlement-UseCase.md` §4 — State Model. */
export const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  DRAFT: ['PENDING_CUSTOMER'],
  PENDING_CUSTOMER: ['WAITING_APPROVAL', 'CONFIRMED', 'DRAFT'], // DRAFT khi khách không đồng ý 1 dòng
  WAITING_APPROVAL: ['CONFIRMED', 'DRAFT'], // DRAFT = trả lại (EX-06)
  CONFIRMED: ['COMPLETED'],
  COMPLETED: ['DRAFT'], // Round 2 — đảo quyết toán (UC-RS-16), KHÔNG build action ở Round 1
}

/**
 * §0.4 điểm 3 kế hoạch — khoá chỉ-đọc khi Rental không còn ở `SETTLEMENT` (ví
 * dụ Huỷ biên bản trả xe đưa Rental về `IN_RENTAL`).
 * TODO(OQ: RS×VR — Settlement khi Return bị huỷ, chưa có quy tắc chính thức
 * ở tài liệu; demo: khoá chỉ-đọc + banner cảnh báo, không tự xoá/đóng Settlement.)
 */
export function isWorksheetEditable(settlement: Settlement, rental: Rental): boolean {
  return settlement.status === 'DRAFT' && rental.status === 'SETTLEMENT'
}

export type SettlementBlockerCode =
  | 'DRAFT_LINES'
  | 'DISPUTED_LINES'
  | 'DEPOSIT_NOT_RECONCILED'
  | 'DEPOSIT_OUTDATED'
  | 'STATUS_NOT_CONFIRMED'
  | 'CUSTOMER_ACK_MISSING'
  | 'WAIVER_PENDING'
  | 'BALANCE_DUE_NO_COLLECT_REQUEST'
  | 'REFUNDABLE_NO_REFUND_REQUEST'
  | 'OVERPAYMENT_NO_REFUND_REQUEST'

/** `DRAFT → PENDING_CUSTOMER` (RS-BR-06). */
export function getSubmitBlockers(settlement: Settlement): SettlementBlockerCode[] {
  const blockers: SettlementBlockerCode[] = []
  if (settlement.lines.some((l) => l.status === 'DRAFT')) blockers.push('DRAFT_LINES')
  if (settlement.lines.some((l) => l.status === 'DISPUTED')) blockers.push('DISPUTED_LINES')
  if (!settlement.depositReconciliation) {
    blockers.push('DEPOSIT_NOT_RECONCILED')
  } else {
    const totals = calcSettlementTotals(settlement.lines, settlement.waivers)
    const paidToDate = settlement.paidToDate.prepayment + settlement.paidToDate.handoverPayment
    const fresh = calcDepositReconciliation(totals.finalAmount, paidToDate, settlement.depositHeld)
    if (fresh.finalAmount !== settlement.depositReconciliation.finalAmount || fresh.depositApplied !== settlement.depositReconciliation.depositApplied) {
      blockers.push('DEPOSIT_OUTDATED')
    }
  }
  return blockers
}

/**
 * AC-RS-009 — `CONFIRMED → COMPLETED`.
 * TODO(OQ: RentalSettlement-BRD.md §28 Q11/Q12 — đóng lượt khi còn công nợ;
 * demo giả định theo đề xuất BRD §15: cho đóng nếu đã tạo yêu cầu thu, đánh
 * dấu `completedWithDebt`, không áp hạn mức. Người đóng = `SETTLEMENT.CONFIRM`
 * theo ma trận §22 (Accountant ✓).)
 */
export function getCompletionBlockers(settlement: Settlement): SettlementBlockerCode[] {
  const blockers: SettlementBlockerCode[] = []
  if (settlement.status !== 'CONFIRMED') blockers.push('STATUS_NOT_CONFIRMED')
  if (settlement.lines.some((l) => l.status === 'DRAFT')) blockers.push('DRAFT_LINES')
  if (settlement.lines.some((l) => l.status === 'DISPUTED')) blockers.push('DISPUTED_LINES')
  if (!settlement.depositReconciliation) blockers.push('DEPOSIT_NOT_RECONCILED')
  if (!settlement.customerAck) blockers.push('CUSTOMER_ACK_MISSING')
  if (settlement.waivers.some((w) => w.status === 'PENDING_APPROVAL')) blockers.push('WAIVER_PENDING')

  const balanceDue = settlement.depositReconciliation?.balanceDue ?? 0
  const depositRefundable = settlement.depositReconciliation?.depositRefundable ?? 0
  const hasRequest = (type: SettlementRequestType) => settlement.paymentRequests.some((r) => r.type === type && r.status === 'REQUESTED')
  // RS-BR-20.
  if (balanceDue > 0 && !hasRequest('COLLECT')) blockers.push('BALANCE_DUE_NO_COLLECT_REQUEST')
  if (depositRefundable > 0 && !hasRequest('DEPOSIT_REFUND')) blockers.push('REFUNDABLE_NO_REFUND_REQUEST')
  if (balanceDue < 0 && !hasRequest('OVERPAYMENT_REFUND')) blockers.push('OVERPAYMENT_NO_REFUND_REQUEST') // EX-03

  return blockers
}

/**
 * RentalSettlement-BRD.md §15 / EX-02 — số tiền khách CÒN PHẢI NỘP trên các yêu cầu thu (`COLLECT`) của quyết toán,
 * tại thời điểm `asOf` (mặc định: hiện tại = mọi giao dịch). Yêu cầu chưa sang Payment = chưa thu đồng nào.
 * "Đóng kèm công nợ" (`completedWithDebt`) = outstanding > 0 lúc đóng lượt; cờ là sự kiện lịch sử, không tự xoá khi khách trả sau.
 * Lưu ý `asOf`: lọc giao dịch theo thời điểm, nhưng trạng thái hiệu lực (đảo/huỷ) lấy theo HIỆN TẠI — đủ cho cờ lịch sử + seed;
 * muốn dùng như "số dư tại ngày X" phải xét thêm `reversedAt`.
 * TODO(OQ: RentalSettlement-BRD.md §28 Q11 — đóng lượt khi còn công nợ; demo cho đóng khi đã tạo yêu cầu thu, không hạn mức.)
 */
export function calcSettlementCollectOutstanding(settlement: Pick<Settlement, 'paymentRequests'>, paymentRequests: PaymentRequest[], txns: Transaction[], asOf?: string): number {
  const asOfTime = asOf ? Date.parse(asOf) : undefined
  const visibleTxns = asOfTime === undefined ? txns : txns.filter((t) => Date.parse(t.confirmedAt ?? t.performedAt) <= asOfTime)
  let outstanding = 0
  for (const spr of settlement.paymentRequests) {
    if (spr.type !== 'COLLECT' || spr.status !== 'REQUESTED') continue
    const pr = paymentRequests.find((p) => p.settlementRequestId === spr.id && p.status !== 'CANCELLED')
    outstanding += pr ? calcRequestProgress(pr, visibleTxns).remaining : spr.amount
  }
  return outstanding
}

/**
 * EX-05 — ghép dòng cũ với dòng tính lại từ nguồn hiện tại: dòng nguồn mới →
 * thêm `DRAFT`; dòng nguồn biến mất → xoá nếu `DRAFT`, nếu không thì về
 * `DRAFT` + `sourceChanged`; `estimatedAmount` đổi trên dòng đã chốt → về
 * `DRAFT` + `sourceChanged`; dòng `MANUAL` giữ nguyên, không đối chiếu.
 */
export function mergeResyncedLines(existing: SettlementLine[], fresh: SettlementLine[]): SettlementLine[] {
  function key(line: SettlementLine): string {
    if (line.source === 'RENTAL') return `rental:${line.category}`
    if (line.sourceRef?.additionalChargeItemId) return `chg:${line.sourceRef.additionalChargeItemId}`
    if (line.sourceRef?.incidentId) return `inc:${line.sourceRef.incidentId}`
    return line.id
  }

  const freshByKey = new Map(fresh.filter((f) => f.source !== 'MANUAL').map((f) => [key(f), f]))
  const usedKeys = new Set<string>()
  const merged: SettlementLine[] = []

  for (const line of existing) {
    if (line.source === 'MANUAL') {
      merged.push(line)
      continue
    }
    const k = key(line)
    const match = freshByKey.get(k)
    if (!match) {
      if (line.status === 'DRAFT') continue // nguồn biến mất, chưa chốt → xoá
      merged.push({ ...line, status: 'DRAFT', sourceChanged: true })
      continue
    }
    usedKeys.add(k)
    const estimatedChanged = line.estimatedAmount !== undefined && match.estimatedAmount !== undefined && line.estimatedAmount !== match.estimatedAmount
    if (line.status === 'CONFIRMED' && estimatedChanged) {
      merged.push({ ...line, estimatedAmount: match.estimatedAmount, status: 'DRAFT', sourceChanged: true, sourceReady: match.sourceReady })
    } else {
      merged.push({
        ...line,
        estimatedAmount: match.estimatedAmount ?? line.estimatedAmount,
        sourceReady: match.sourceReady,
        status: line.status === 'DRAFT' ? match.status : line.status,
      })
    }
  }
  for (const [k, f] of freshByKey) {
    if (!usedKeys.has(k)) merged.push(f)
  }
  return merged
}

// ---- §10.4 kế hoạch (Round 2) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán (hàm thuần) ----

/** UC-RS-14 §18.3, RS-BR-13 — Settlement + Rental cùng phải `COMPLETED`. */
export function canCreatePostSettlementCharge(settlement: Settlement, rental: Rental): boolean {
  return settlement.status === 'COMPLETED' && rental.status === 'COMPLETED'
}

/** UC-RS-15 §19.3 — cùng điều kiện `canCreatePostSettlementCharge`. */
export function canAdjustSettlement(settlement: Settlement, rental: Rental): boolean {
  return settlement.status === 'COMPLETED' && rental.status === 'COMPLETED'
}

/** UC-RS-16, AC-RS-013 "Settlement `COMPLETED`" — cùng điều kiện. */
export function canReverseSettlement(settlement: Settlement, rental: Rental): boolean {
  return settlement.status === 'COMPLETED' && rental.status === 'COMPLETED'
}

/**
 * §10.2 điểm 5 kế hoạch — BA đề xuất: `TRAFFIC_FINE`/`VETC`/`INCIDENT` luôn
 * `RECEIVABLE`; `ADJUSTMENT`/`OTHER` để người dùng chọn (`undefined`).
 */
export function fixedPscType(source: PostSettlementChargeSource): PostSettlementChargeType | undefined {
  if (source === 'TRAFFIC_FINE' || source === 'VETC' || source === 'INCIDENT') return 'RECEIVABLE'
  return undefined
}

/** Nguồn cho dialog "Tạo khoản phát sinh" — không có `ADJUSTMENT` (đi qua `adjustSettlement`). */
export const POST_SETTLEMENT_CHARGE_CREATABLE_SOURCES = POST_SETTLEMENT_CHARGE_SOURCES.filter((s) => s !== 'ADJUSTMENT')

export type PscBlockerCode = 'ALREADY_IN_SETTLEMENT' | 'ALREADY_HAS_PSC' | 'NOT_CUSTOMER_LIABILITY' | 'INCIDENT_VOID' | 'CUSTOMER_CHARGE_NOT_FINAL'

const PSC_INCIDENT_VOID_STATUSES: Incident['status'][] = ['CANCELLED', 'CLOSED_NO_ACTION', 'WRITTEN_OFF']
const PSC_INCIDENT_NOT_FINAL_STATUSES: Incident['status'][] = ['OPEN', 'ASSESSING', 'WAITING_APPROVAL']
const PSC_NOT_CUSTOMER_LIABILITIES: Incident['liability'][] = ['COMPANY', 'THIRD_PARTY', 'INSURANCE']

/**
 * Luật chống tính trùng sự cố giữa Settlement kỳ gốc và Post-Settlement Charge
 * — RS-BR-13 + "ba con số khác nhau" (`CLAUDE.md` §4). Cho phép tạo khi
 * `APPROVED`/`IN_REPAIR`/`REPAIRED`/`CLOSED` và `DISPUTED` (hiển thị "Tạm giữ").
 */
export function getIncidentPscBlocker(incident: Incident, settlement: Settlement, existingPscs: PostSettlementCharge[]): PscBlockerCode | undefined {
  if (settlement.lines.some((l) => l.sourceRef?.incidentId === incident.id)) return 'ALREADY_IN_SETTLEMENT'
  if (existingPscs.some((p) => p.incidentId === incident.id)) return 'ALREADY_HAS_PSC'
  if (PSC_NOT_CUSTOMER_LIABILITIES.includes(incident.liability)) return 'NOT_CUSTOMER_LIABILITY'
  if (PSC_INCIDENT_VOID_STATUSES.includes(incident.status)) return 'INCIDENT_VOID'
  if (incident.liability === 'UNDETERMINED' || PSC_INCIDENT_NOT_FINAL_STATUSES.includes(incident.status)) return 'CUSTOMER_CHARGE_NOT_FINAL'
  return undefined
}

/**
 * RS-BR-04/AC-RS-003 mirror — khoá số, không cho sửa.
 * TODO(OQ: master BRD §51 Q54 / RentalSettlement-BRD.md §28 Q21 — công thức sự
 * cố nặng khi Liability ≠ khách 100%; PSC chỉ đọc Customer Charge từ DI.)
 * RS-BR-24.
 */
export function pscAmountForIncident(incident: Incident): number {
  return incident.customerCharge ?? incident.estimatedCost
}

/** Cho khối tổng PSC + cột List. KHÔNG bao giờ cộng vào `completedTotals`/Final Amount (BRD §25.4). */
export function summarizePscs(pscs: PostSettlementCharge[]): { openReceivable: number; openRefund: number; openCount: number; closedCount: number } {
  let openReceivable = 0
  let openRefund = 0
  let openCount = 0
  let closedCount = 0
  for (const p of pscs) {
    if (p.status === 'OPEN') {
      openCount += 1
      if (p.type === 'RECEIVABLE') openReceivable += p.amount
      else openRefund += p.amount
    } else {
      closedCount += 1
    }
  }
  return { openReceivable, openRefund, openCount, closedCount }
}

/** Nợ 2 (N2) — Σ số tiền các waiver `PARTIAL_DISCOUNT` còn hiệu lực của một dòng. */
export function getLineDiscountedAmount(lineId: string, waivers: SettlementWaiver[]): number {
  return waivers
    .filter((w) => w.type === 'PARTIAL_DISCOUNT' && w.lineId === lineId && (w.status === 'APPROVED' || w.status === 'PENDING_APPROVAL'))
    .reduce((sum, w) => sum + w.amount, 0)
}

/**
 * UC-RS-16 — gom toàn bộ logic reset khi đảo quyết toán thành hàm thuần (dễ
 * review, tách khỏi `api.ts`). Diễn giải §10.2 điểm 2 kế hoạch: giữ nguyên
 * `lines`/`waivers` (đã nằm trong `snapshot`), chỉ xoá kết quả quy trình.
 */
export function buildReversalReset(
  settlement: Settlement,
  actor: { fullName: string; role: Role },
  reason: string,
  now: string,
): { after: Settlement; reversal: SettlementReversal } {
  const { reversals, ...snapshot } = settlement
  const cancelledPaymentRequestIds: string[] = []
  const paymentRequests = settlement.paymentRequests.map((r) => {
    if (r.status !== 'REQUESTED') return r
    cancelledPaymentRequestIds.push(r.id)
    return { ...r, status: 'CANCELLED' as const, cancelledByName: actor.fullName, cancelledAt: now, cancelReason: reason }
  })
  const reversal: SettlementReversal = {
    id: generateId('rev'),
    reason,
    reversedByName: actor.fullName,
    reversedByRole: actor.role,
    reversedAt: now,
    snapshot,
    cancelledPaymentRequestIds,
  }
  const after: Settlement = {
    ...settlement,
    status: 'DRAFT',
    paymentRequests,
    customerAck: undefined,
    depositReconciliation: undefined,
    approval: undefined,
    completedTotals: undefined,
    completedWithDebt: undefined,
    completedByName: undefined,
    completedAt: undefined,
    paymentStatus: undefined,
    reversals: [...(reversals ?? []), reversal],
    updatedAt: now,
  }
  return { after, reversal }
}

// ---- Form schema (react-hook-form + zod, `CONVENTIONS.md` §7) ----

export const settlementConfirmLineFormSchema = z.object({
  actualAmount: z
    .string()
    .trim()
    .min(1, 'Số thực tế là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Số thực tế phải là số nguyên không âm' }),
  note: z.string().trim().optional(),
})
export type SettlementConfirmLineFormValues = z.infer<typeof settlementConfirmLineFormSchema>

export const settlementManualLineFormSchema = z.object({
  direction: z.enum(['CHARGE', 'DISCOUNT']),
  amount: z
    .string()
    .trim()
    .min(1, 'Số tiền là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — RS-BR-19'),
})
export type SettlementManualLineFormValues = z.infer<typeof settlementManualLineFormSchema>

export const settlementWaiverFormSchema = z
  .object({
    type: z.enum(SETTLEMENT_WAIVER_TYPES),
    lineId: z.string().trim().optional(),
    amount: z
      .string()
      .trim()
      .min(1, 'Số tiền là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
    reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — RS-BR-07'),
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'WAIVE_LINE' || data.type === 'PARTIAL_DISCOUNT') && !data.lineId) {
      ctx.addIssue({ code: 'custom', path: ['lineId'], message: 'Chọn dòng liên quan' })
    }
  })
export type SettlementWaiverFormValues = z.infer<typeof settlementWaiverFormSchema>

export const settlementDisputeFormSchema = z.object({
  disputeNote: z.string().trim().min(3, 'Ghi chú tranh chấp là bắt buộc (tối thiểu 3 ký tự)'),
})
export type SettlementDisputeFormValues = z.infer<typeof settlementDisputeFormSchema>

export const settlementResolveDisputeFormSchema = z
  .object({
    resolution: z.enum(['KEEP', 'ADJUST', 'WAIVE']),
    actualAmount: z.string().trim().optional(),
    reason: z.string().trim().min(3, 'Kết luận / lý do là bắt buộc (tối thiểu 3 ký tự) — UC-RS-17'),
  })
  .superRefine((data, ctx) => {
    if (data.resolution === 'ADJUST' && (!data.actualAmount || !NUMERIC_RE.test(data.actualAmount))) {
      ctx.addIssue({ code: 'custom', path: ['actualAmount'], message: 'Số tiền điều chỉnh là bắt buộc và phải là số nguyên không âm' })
    }
  })
export type SettlementResolveDisputeFormValues = z.infer<typeof settlementResolveDisputeFormSchema>

export const settlementCustomerAckFormSchema = z
  .object({
    outcome: z.enum(['ALL_AGREE', 'SOME_DISAGREE']),
    disagreeLineIds: z.array(z.string()).optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.outcome === 'SOME_DISAGREE' && (!data.disagreeLineIds || data.disagreeLineIds.length === 0)) {
      ctx.addIssue({ code: 'custom', path: ['disagreeLineIds'], message: 'Chọn ít nhất 1 dòng khách không đồng ý' })
    }
  })
export type SettlementCustomerAckFormValues = z.infer<typeof settlementCustomerAckFormSchema>

export const settlementApprovalFormSchema = z
  .object({
    decision: z.enum(['APPROVED', 'RETURNED']),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'RETURNED' && !data.note) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Ghi chú là bắt buộc khi trả lại (EX-06)' })
    }
  })
export type SettlementApprovalFormValues = z.infer<typeof settlementApprovalFormSchema>

// ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.10) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán ----

export const postSettlementChargeFormSchema = z
  .object({
    source: z.enum(POST_SETTLEMENT_CHARGE_SOURCES),
    type: z.enum(POST_SETTLEMENT_CHARGE_TYPES).optional(),
    incidentId: z.string().trim().optional(),
    amount: z.string().trim().optional(),
    reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
    evidenceNote: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.source === 'INCIDENT') {
      if (!data.incidentId) ctx.addIssue({ code: 'custom', path: ['incidentId'], message: 'Chọn sự cố liên quan' })
      return
    }
    if (!data.amount || !NUMERIC_RE.test(data.amount) || Number(data.amount) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Số tiền phải là số nguyên dương' })
    }
    if (!fixedPscType(data.source) && !data.type) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: 'Chọn loại khoản' })
    }
  })
export type PostSettlementChargeFormValues = z.infer<typeof postSettlementChargeFormSchema>

export const settlementAdjustmentFormSchema = z.object({
  direction: z.enum(['INCREASE', 'DECREASE']),
  amount: z
    .string()
    .trim()
    .min(1, 'Số tiền là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — UC-RS-15'),
  evidenceNote: z.string().trim().optional(),
})
export type SettlementAdjustmentFormValues = z.infer<typeof settlementAdjustmentFormSchema>

/** Bước 1 (lý do) — bước 2 (gõ lại mã lượt thuê) so khớp trực tiếp trong component, không qua schema. */
export const settlementReverseReasonFormSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — UC-RS-16'),
})
export type SettlementReverseReasonFormValues = z.infer<typeof settlementReverseReasonFormSchema>
