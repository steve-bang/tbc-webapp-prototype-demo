import { z } from 'zod'
// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2) —
// không deep-import `/api`, `/hooks`, `/model` của 3 feature nguồn.
import type { HandoverRecord, ReturnIncidentItem, ReturnRecord } from '@/features/handover-return'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import type {
  AdditionalChargeType,
  Role,
  SecurityDepositType,
  SettlementLineCategory,
  SettlementLineSource,
  SettlementLineStatus,
  SettlementPaymentStatus,
  SettlementRequestType,
  SettlementStatus,
  SettlementWaiverStatus,
  SettlementWaiverType,
} from '@/shared/domain/enums'
import { SETTLEMENT_WAIVER_TYPES } from '@/shared/domain/enums'
import { generateId } from '@/shared/lib/id'

/**
 * Dòng khoản mục quyết toán — `RentalSettlement-BRD.md` §6/§8-§9 (module `RS`),
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §2.1. Số tiền luôn là số nguyên dương;
 * chiều cộng/trừ do `direction`.
 */
export interface SettlementLine {
  id: string
  category: SettlementLineCategory
  source: SettlementLineSource
  direction: 'CHARGE' | 'DISCOUNT'
  /** Chỉ dòng `RETURN`/`INCIDENT` (RS-BR-05). */
  estimatedAmount?: number
  /** Bắt buộc khi `CONFIRMED`/`WAIVED`. */
  actualAmount?: number
  status: SettlementLineStatus
  /** RS-BR-19 — bằng chứng nguồn. */
  sourceRef?: { returnRecordId?: string; additionalChargeItemId?: string; incidentId?: string }
  /** EX-01 — `false` khi Incident chưa đủ điều kiện duyệt → không cho chốt. */
  sourceReady: boolean
  /** EX-05 — nguồn đổi sau khi đã chốt. */
  sourceChanged?: boolean
  /** §0.4 điểm 4 kế hoạch — `DAMAGE` ở Return có thể trùng với Incident. */
  sourceWarning?: 'POSSIBLE_DUPLICATE_DAMAGE'
  /** Ghi chú nguồn (copy từ `AdditionalChargeItem.note`) hoặc ghi chú chốt. */
  note?: string
  /** Bắt buộc với `MANUAL` (RS-BR-19). */
  reason?: string
  disputeNote?: string
  confirmedByName?: string
  confirmedAt?: string
}

/** Miễn giảm/thiện chí — `RentalSettlement-BRD.md` §12, hiển thị riêng, không ẩn vào giá. */
export interface SettlementWaiver {
  id: string
  type: SettlementWaiverType
  /** Bắt buộc với `WAIVE_LINE`/`PARTIAL_DISCOUNT`. */
  lineId?: string
  /** `WAIVE_LINE` = `actualAmount` của dòng. */
  amount: number
  reason: string
  status: SettlementWaiverStatus
  requestedByName: string
  requestedByRole: Role
  requestedAt: string
  decidedByName?: string
  decidedAt?: string
  decisionNote?: string
}

/** `RentalSettlement-BRD.md` §10 — chốt bởi "Xác định đối trừ cọc"; bị xoá (phải chốt lại) khi số liệu dòng/miễn giảm đổi. */
export interface DepositReconciliation {
  finalAmount: number
  paidToDate: number
  depositHeld: number
  depositApplied: number
  depositRefundable: number
  balanceDue: number
  reconciledByName: string
  reconciledAt: string
}

/** `RentalSettlement-BRD.md` §15 — chỉ ghi yêu cầu, Payment (Phase 4.2) mới thực thi (§0.3 kế hoạch). */
export interface SettlementPaymentRequest {
  id: string
  type: SettlementRequestType
  amount: number
  /** `CANCELLED` dùng ở Round 2 (đảo quyết toán) — Round 1 chỉ sinh `REQUESTED`. */
  status: 'REQUESTED' | 'CANCELLED'
  createdByName: string
  createdAt: string
}

export interface SettlementTotals {
  gross: number
  totalDiscount: number
  subtotal: number
  tax: number
  rounding: number
  finalAmount: number
}

/** Quyết toán lượt thuê — `RentalSettlement-BRD.md` §6 (module `RS`), storage key `settlements`. */
export interface Settlement {
  id: string
  /** RS-BR-01 — duy nhất theo `rentalId`. */
  rentalId: string
  /** Copy từ Rental lúc mở để màn danh sách lọc nhanh. */
  customerId: string
  vehicleId: string
  status: SettlementStatus
  lines: SettlementLine[]
  waivers: SettlementWaiver[]
  /** Snapshot từ `Rental` lúc mở. */
  securityDepositType: SecurityDepositType
  /** §0.3 kế hoạch — suy tạm từ `HandoverRecord` (chưa có Payment). */
  paidToDate: { prepayment: number; handoverPayment: number }
  /** §0.3 kế hoạch — suy tạm. */
  depositHeld: number
  depositReconciliation?: DepositReconciliation
  /** TODO(OQ: RentalSettlement-BRD.md §28 Q17 — mức xác nhận khách M0-M4 chưa chốt). */
  customerAck?: { recordedByName: string; recordedAt: string; note?: string }
  approval?: { decision: 'APPROVED' | 'RETURNED'; decidedByName: string; decidedAt: string; note?: string }
  paymentRequests: SettlementPaymentRequest[]
  /** Phase 4.1 chỉ `UNPAID`/`REFUND_PENDING` (§0.3 kế hoạch). */
  paymentStatus?: SettlementPaymentStatus
  /** Đóng lượt khi `Balance Due > 0` — TODO(OQ: RentalSettlement-BRD.md §28 Q11). */
  completedWithDebt?: boolean
  /** RS-BR-12 — đóng băng số liệu kỳ gốc. */
  completedTotals?: SettlementTotals & DepositReconciliation
  completedByName?: string
  completedAt?: string
  openedByName: string
  openedAt: string
  createdAt: string
  updatedAt: string
}

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

// ---- §3.2 kế hoạch — Suy tạm Paid To Date / Deposit Held (§0.3) ----

/** RS-BR-22 — `CASH_20M` cố định 20 triệu, đối trừ được; `MOTORBIKE` = 0 (chỉ theo dõi Collateral Asset). */
const CASH_DEPOSIT_AMOUNT_RS = 20_000_000

/**
 * RS-BR-21 — `Paid To Date` gồm Prepayment 30% (thu mốc đặt xe) + 70% mốc
 * giao xe. // TODO(Phase 4.2): thay bằng tổng giao dịch `CONFIRMED` từ Payment
 * (RS-BR-11/21) — hiện suy tạm từ 2 cờ thủ công của `HandoverRecord`.
 */
export function calcPaidToDate(rental: Rental, handover: HandoverRecord | undefined): { prepayment: number; handoverPayment: number } {
  const prepayment = handover?.prepaymentConfirmed ? rental.prepaymentAmount : 0
  const handoverPayment = handover?.fullPaymentConfirmed ? rental.baseAmount - rental.prepaymentAmount : 0
  return { prepayment, handoverPayment }
}

/** RS-BR-22 — TODO(Phase 4.2): thay bằng Payment xác nhận đã thu cọc. */
export function calcDepositHeld(rental: Rental, handover: HandoverRecord | undefined): number {
  return rental.securityDepositType === 'CASH_20M' && handover?.fullPaymentConfirmed ? CASH_DEPOSIT_AMOUNT_RS : 0
}

// ---- §3.3 kế hoạch — Final Amount (`RentalSettlement-BRD.md` §11, diễn giải §0.4 điểm 2) ----

/**
 * RS-BR-06/17 — dòng `DRAFT`/`DISPUTED` không tính. Diễn giải §0.4 điểm 2:
 * Gross tính cả dòng `WAIVED` (giữ số thực tế để minh bạch), Total Discount
 * cộng lại số tiền dòng `WAIVED` → hiệu ứng ròng = 0 cho dòng được miễn nhưng
 * vẫn hiện rõ trên bảng.
 */
export function calcSettlementTotals(lines: SettlementLine[], waivers: SettlementWaiver[]): SettlementTotals {
  const gross = lines
    .filter((l) => l.direction === 'CHARGE' && (l.status === 'CONFIRMED' || l.status === 'WAIVED'))
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  const discountLines = lines
    .filter((l) => l.direction === 'DISCOUNT' && l.status === 'CONFIRMED')
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  const waivedLines = lines
    .filter((l) => l.direction === 'CHARGE' && l.status === 'WAIVED')
    .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0)
  // `WAIVE_LINE` đã cộng vào `waivedLines` qua chính dòng — chỉ cộng thêm
  // waiver loại `PARTIAL_DISCOUNT`/`GOODWILL_CREDIT` để tránh tính trùng.
  const waiverAmount = waivers
    .filter((w) => w.type !== 'WAIVE_LINE' && (w.status === 'APPROVED' || w.status === 'PENDING_APPROVAL'))
    .reduce((sum, w) => sum + w.amount, 0)
  const totalDiscount = discountLines + waivedLines + waiverAmount
  const subtotal = gross - totalDiscount
  // TODO(OQ: RentalSettlement-BRD.md §28 Q5/Q6 — VAT; BRD §19 "chưa áp dụng → cấu hình tắt").
  const tax = 0
  // TODO(OQ: RentalSettlement-BRD.md §28 Q5/Q7 — làm tròn 1.000đ/10.000đ, thứ tự discount/VAT/rounding).
  const rounding = 0
  const finalAmount = subtotal + tax + rounding
  return { gross, totalDiscount, subtotal, tax, rounding, finalAmount }
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

// ---- Form schema (react-hook-form + zod, `CONVENTIONS.md` §7) ----

const NUMERIC_RE = /^\d+$/

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
