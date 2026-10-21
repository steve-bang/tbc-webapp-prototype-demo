import { z } from 'zod'
// `customers`/`handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2) —
// không deep-import `/api`, `/hooks`, `/model` của 4 feature nguồn.
import type { Customer } from '@/features/customers'
import type { ReturnIncidentItem, ReturnRecord } from '@/features/handover-return'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import type {
  AdditionalChargeType,
  CashDrawerSubmissionStatus,
  PaymentMethod,
  PaymentMilestone,
  PaymentRequestPurpose,
  PaymentRequestSource,
  PaymentRequestStatus,
  PostSettlementChargeSource,
  PostSettlementChargeStatus,
  PostSettlementChargeType,
  RefundApprovalStatus,
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
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/shared/domain/enums'
import { POST_SETTLEMENT_CHARGE_SOURCES, POST_SETTLEMENT_CHARGE_TYPES, SETTLEMENT_WAIVER_TYPES } from '@/shared/domain/enums'
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
  /** Round 2 (UC-RS-16) — chỉ có khi `status = CANCELLED` do đảo quyết toán. */
  cancelledByName?: string
  cancelledAt?: string
  cancelReason?: string
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
  /** RS-BR-21 — từ sổ giao dịch Payment (`calcPaidToDate`), làm mới khi Settlement `DRAFT` (PAYMENT-PLAN.md §10.4). */
  paidToDate: { prepayment: number; handoverPayment: number }
  /** RS-BR-22 — từ sổ giao dịch Payment (`calcDepositHeld`/`calcLedgerDepositHeld`). */
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
  /** UC-RS-16 — "giữ toàn bộ lịch sử phiên bản trước" (RS-BR-14). */
  reversals?: SettlementReversal[]
}

/** UC-RS-16 — bản Settlement `COMPLETED` ngay trước khi đảo (RS-BR-14), `docs/RENTAL-SETTLEMENT-PLAN.md` §10.3. */
export interface SettlementReversal {
  id: string
  reason: string
  reversedByName: string
  reversedByRole: Role
  reversedAt: string
  snapshot: Omit<Settlement, 'reversals'>
  cancelledPaymentRequestIds: string[]
}

/**
 * Post-Settlement Charge — `RentalSettlement-BRD.md` §17, UC-RS-14/15. Entity
 * riêng, KHÔNG nhúng vào `Settlement` (RS-BR-13, BRD §25.4), storage key
 * `postSettlementCharges` (hằng số `POST_SETTLEMENT_CHARGES_STORAGE_KEY` ở
 * `finance/api.ts`).
 */
export interface PostSettlementCharge {
  id: string
  /** Settlement kỳ gốc (tham chiếu — BRD §6). */
  settlementId: string
  /** Copy từ Settlement — List/4.2/4.3 lọc nhanh. */
  rentalId: string
  customerId: string
  vehicleId: string
  source: PostSettlementChargeSource
  type: PostSettlementChargeType
  /** Số nguyên dương (đồng), chiều do `type`. */
  amount: number
  /** Bắt buộc khi `source = INCIDENT`. */
  incidentId?: string
  /** Bắt buộc (UC-RS-21 §25.3). */
  reason: string
  /** "chứng từ" UC-RS-14 bước 2 — demo chỉ ghi chú text (số biên bản phạt, mã GD VETC…). */
  evidenceNote?: string
  status: PostSettlementChargeStatus
  createdByName: string
  createdByRole: Role
  createdAt: string
  closedByName?: string
  closedAt?: string
  closeNote?: string
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

// ---- §3.2 kế hoạch / PAYMENT-PLAN.md §10.3 — Paid To Date / Deposit Held từ sổ giao dịch thật ----

/**
 * RS-BR-21 — `Paid To Date` của Settlement = Prepayment 30% (yêu cầu mốc
 * `BOOKING`) + 70% (yêu cầu mốc `HANDOVER` loại `RENTAL_PAYMENT`) đọc từ sổ
 * giao dịch Payment thật, KHÔNG tính `OFFSET`/yêu cầu `SETTLEMENT` (RS-BR-21
 * chỉ 30%+70%). `RS-BR-21 + PAYMENT-PLAN.md §10.3`.
 */
export function calcPaidToDate(rental: Rental, requests: PaymentRequest[], txns: Transaction[]): { prepayment: number; handoverPayment: number } {
  const rentalRequests = requests.filter((r) => r.rentalId === rental.id)
  const bookingReq = rentalRequests.find((r) => r.source === 'BOOKING')
  const handoverReq = rentalRequests.find((r) => r.source === 'HANDOVER' && r.transactionType === 'RENTAL_PAYMENT')
  const prepayment = bookingReq ? Math.max(0, calcRequestProgress(bookingReq, txns).collected) : 0
  const handoverPayment = handoverReq ? Math.max(0, calcRequestProgress(handoverReq, txns).collected) : 0
  return { prepayment, handoverPayment }
}

/**
 * RS-BR-22 — cọc đang giữ theo sổ giao dịch Payment thật (`calcLedgerDepositHeld`).
 * Giữ chữ ký 3 tham số như `calcPaidToDate` để gọi cùng lúc ở `api.ts`/`seed.ts`
 * (`requests` không dùng tới — `calcLedgerDepositHeld` chỉ cần `txns`).
 */
export function calcDepositHeld(rental: Rental, _requests: PaymentRequest[], txns: Transaction[]): number {
  return calcLedgerDepositHeld(rental.id, txns)
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

/**
 * Suy diễn khi render, KHÔNG lưu, không phải enum — UC-RS-14 A1: PSC `OPEN`
 * gắn Incident đang `DISPUTED` → "Tạm giữ", chặn "Đánh dấu đã tất toán".
 */
export function isPscOnHold(psc: PostSettlementCharge, incidents: Incident[]): boolean {
  if (psc.status !== 'OPEN' || !psc.incidentId) return false
  return incidents.find((i) => i.id === psc.incidentId)?.status === 'DISPUTED'
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

// ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.10) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán ----

export const postSettlementChargeFormSchema = z
  .object({
    source: z.enum(POST_SETTLEMENT_CHARGE_SOURCES),
    type: z.enum(POST_SETTLEMENT_CHARGE_TYPES).optional(),
    incidentId: z.string().trim().optional(),
    amount: z.string().trim().optional(),
    reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — UC-RS-21'),
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

// ==== Payment (PM) — PAYMENT-PLAN.md §2-§3 ====

/** Payment Request — `Payment-BRD.md` §6.2, UseCase §4.2. Module khác "tạo", Payment thực thi. */
export interface PaymentRequest {
  id: string
  source: PaymentRequestSource
  purpose: PaymentRequestPurpose
  /** Loại giao dịch sinh ra khi thực thi — quyết định Type của Transaction (BRD §8). */
  transactionType: TransactionType
  /** số nguyên đồng > 0 (PM-BR-20). */
  expectedAmount: number
  /** `HỆ THỐNG tính (deriveRequestStatus), không sửa tay. */
  status: PaymentRequestStatus
  rentalId: string
  /** Copy từ Rental lúc tạo — lọc nhanh/công nợ. */
  customerId: string
  // Round 2:
  settlementId?: string
  settlementRequestId?: string
  postSettlementChargeId?: string
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
  cancelledByName?: string
  cancelledAt?: string
  cancelReason?: string
}

/** `Payment-BRD.md` §18 — nhúng trong `Transaction`, một giao dịch một biên lai. */
export interface Receipt {
  /** `GD-…`/`BL-…` tuần tự — TODO(OQ: Payment-BRD.md §27 Q16 — mẫu/đánh số biên lai). */
  receiptNo: string
  issuedByName: string
  issuedAt: string
  /** PM-BR-19 — bị vô hiệu khi giao dịch gốc REVERSED. */
  voided: boolean
}

/** Giao dịch tiền — `Payment-BRD.md` §6.1. Không bao giờ xoá vật lý (PM-BR-05). */
export interface Transaction {
  id: string
  /** "Transaction Code" BRD §6.1 — `GD-000001` tuần tự, sinh trong callback `fakeRequest`. */
  code: string
  type: TransactionType
  /** Suy từ `type` qua `directionOf` — riêng `ADJUSTMENT` do người dùng chọn. */
  direction: TransactionDirection
  amount: number
  method: PaymentMethod
  status: TransactionStatus
  /** PM-BR-16 — bắt buộc. */
  customerId: string
  rentalId?: string
  /** Trống với `ADJUSTMENT`/`OFFSET`. */
  paymentRequestId?: string
  /** Round 2 — `OFFSET`. */
  settlementId?: string
  /** Mã CK / mã ví / mã SePay. */
  reference?: string
  /** Demo: ghi chú chứng từ thay ảnh. */
  evidenceNote?: string
  /** Bắt buộc với `ADJUSTMENT`. */
  reason?: string
  /** PM-BR-10 — `drawer:<userId>` của người thu khi `method = CASH`. */
  cashDrawerId?: string
  cashDrawerOwnerName?: string
  performedByUserId: string
  performedByName: string
  performedAt: string
  confirmedByName?: string
  confirmedAt?: string
  /** UC-PM-06 A1 — số tiền gốc trước khi Accountant sửa lúc xác nhận. */
  originalAmount?: number
  failReason?: string
  voidReason?: string
  voidedByName?: string
  voidedAt?: string
  /** UC-PM-12 — bản đối ứng trỏ bản gốc; bản gốc trỏ bản đối ứng. */
  reversalOfId?: string
  reversedById?: string
  reverseReason?: string
  /** Round 2 — PM-BR-12, chỉ giao dịch hoàn tiền vượt ngưỡng. */
  approval?: { status: RefundApprovalStatus; decidedByName?: string; decidedAt?: string; note?: string }
  /** Round 2 — PM-BR-13, bắt buộc với giao dịch OUT hoàn tiền. */
  refundRecipient?: string
  /** BRD §18. */
  receipt?: Receipt
  createdAt: string
  updatedAt: string
}

/** Phiếu nộp quỹ — `Payment-BRD.md` §14, §15.1, UC-PM-14. Quỹ = theo người thu (BRD §14). */
export interface CashDrawerSubmission {
  id: string
  /** `drawer:<userId>`. */
  cashDrawerId: string
  ownerName: string
  /** Giao dịch CASH được "chốt" vào phiếu này — mỗi giao dịch chỉ thuộc tối đa 1 phiếu. */
  transactionIds: string[]
  /** Σ CASH IN − Σ CASH OUT (hiệu lực) của `transactionIds`. */
  systemAmount: number
  countedAmount: number
  variance: number
  /** Bắt buộc khi `variance ≠ 0` (EX-06, AC-PM-009). */
  varianceReason?: string
  status: CashDrawerSubmissionStatus
  submittedAt: string
  /** "thủ quỹ" — TODO(OQ: Payment-BRD.md §27 Q11). */
  receivedByName?: string
  receivedAt?: string
}

/** View suy ra (không lưu) — lịch thanh toán 3 mốc, `Payment-BRD.md` §4.1. */
export interface PaymentMilestoneView {
  milestone: PaymentMilestone
  requests: PaymentRequest[]
  expectedTotal: number
  /** Σ giao dịch IN hiệu lực của các yêu cầu này. */
  collectedTotal: number
  /** Σ giao dịch `PENDING` (chưa tính vào đã thu). */
  pendingTotal: number
  state: 'NOT_SCHEDULED' | 'OPEN' | 'PARTIAL' | 'DONE' | 'CANCELLED' | 'BY_SETTLEMENT'
  /** `HANDOVER` + `MOTORBIKE` → hiện dòng vật bảo đảm (PM-BR-22). */
  motorbikeCollateral?: boolean
}

/** View suy ra (không lưu) — tổng hợp thanh toán của một Rental, `Payment-BRD.md` §13. */
export interface RentalPaymentSummary {
  totalPayable: number
  totalPayableIsEstimate: boolean
  paidToDate: number
  depositHeld: number
  refunded: number
  balanceDue: number
  paymentStatus: SettlementPaymentStatus
  /** Round 2 — Σ `remaining` của yêu cầu `REFUND` còn mở (OPEN/PARTIALLY_FULFILLED). */
  pendingRefund: number
}

/** Bảng `type → direction` cố định (BRD §8) — `ADJUSTMENT` không nằm trong 2 danh sách, do người dùng chọn. */
const IN_TRANSACTION_TYPES: TransactionType[] = ['DEPOSIT', 'RENTAL_PAYMENT', 'ADDITIONAL_CHARGE', 'POST_SETTLEMENT_COLLECT']
const OUT_TRANSACTION_TYPES: TransactionType[] = ['DEPOSIT_REFUND', 'OVERPAYMENT_REFUND', 'GOODWILL_REFUND', 'OWNER_PAYOUT']

export function directionOf(type: TransactionType): TransactionDirection | undefined {
  if (IN_TRANSACTION_TYPES.includes(type)) return 'IN'
  if (OUT_TRANSACTION_TYPES.includes(type)) return 'OUT'
  return undefined
}

/** PM-BR-01/04 + §0.3 điểm 4 `PAYMENT-PLAN.md` — loại CẢ cặp đảo khỏi mọi phép cộng. */
export function isEffectiveTransaction(t: Transaction): boolean {
  return t.status === 'CONFIRMED' && !t.reversalOfId
}

/** PM-BR-21 — các trạng thái Rental còn cho lập lịch/ghi nhận thanh toán. */
const SCHEDULABLE_RENTAL_STATUSES: Rental['status'][] = [
  'CONFIRMED',
  'CONTRACT_CREATED',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'IN_RENTAL',
  'RETURNED',
  'SETTLEMENT',
]

export function canScheduleRental(rental: Rental): boolean {
  return SCHEDULABLE_RENTAL_STATUSES.includes(rental.status)
}

/** `Payment-BRD.md` §8 / PM-BR-21 (CR-2026-060) — sinh 2-3 Payment Request mốc `BOOKING`/`HANDOVER`. */
export function buildScheduleRequests(rental: Rental, actorName: string, now: string): PaymentRequest[] {
  const base = {
    rentalId: rental.id,
    customerId: rental.customerId,
    purpose: 'COLLECT' as const,
    status: 'OPEN' as const,
    createdByName: actorName,
    createdAt: now,
    updatedAt: now,
  }
  const requests: PaymentRequest[] = [
    {
      id: generateId('prq'),
      source: 'BOOKING',
      transactionType: 'RENTAL_PAYMENT',
      expectedAmount: rental.prepaymentAmount,
      ...base,
    },
    {
      id: generateId('prq'),
      source: 'HANDOVER',
      transactionType: 'RENTAL_PAYMENT',
      expectedAmount: rental.baseAmount - rental.prepaymentAmount,
      ...base,
    },
  ]
  // PM-BR-22 + CR-2026-003 — MOTORBIKE không sinh yêu cầu/giao dịch cọc.
  if (rental.securityDepositType === 'CASH_20M') {
    requests.push({
      id: generateId('prq'),
      source: 'HANDOVER',
      transactionType: 'DEPOSIT',
      expectedAmount: rental.securityDepositAmount ?? 20_000_000,
      ...base,
    })
  }
  return requests
}

/**
 * UC-PM-01 bước 3, PM-BR-15 — `collected` = "đã thực hiện" của yêu cầu, tính
 * có dấu theo `purpose` (F1, PAYMENT-PLAN.md §10.3): `COLLECT` → giao dịch
 * `IN` cộng/`OUT` trừ (như Round 1); `REFUND` → giao dịch `OUT` cộng/`IN` trừ
 * (để yêu cầu hoàn đạt `FULFILLED` khi đã hoàn đủ, không bao giờ âm). `pending`
 * chỉ tính giao dịch `PENDING` cùng chiều mong đợi của `purpose`.
 */
export function calcRequestProgress(request: PaymentRequest, txns: Transaction[]): { collected: number; pending: number; remaining: number } {
  const related = txns.filter((t) => t.paymentRequestId === request.id)
  const expectedDirection: TransactionDirection = request.purpose === 'REFUND' ? 'OUT' : 'IN'
  const collected = related
    .filter(isEffectiveTransaction)
    .reduce((sum, t) => sum + (t.direction === expectedDirection ? t.amount : -t.amount), 0)
  const pending = related.filter((t) => t.status === 'PENDING' && t.direction === expectedDirection).reduce((sum, t) => sum + t.amount, 0)
  const remaining = Math.max(0, request.expectedAmount - collected)
  return { collected, pending, remaining }
}

/** `Payment-UseCase.md` §4.2. */
export function deriveRequestStatus(request: PaymentRequest, txns: Transaction[]): PaymentRequestStatus {
  if (request.status === 'CANCELLED') return 'CANCELLED'
  const { collected } = calcRequestProgress(request, txns)
  if (collected <= 0) return 'OPEN'
  if (collected < request.expectedAmount) return 'PARTIALLY_FULFILLED'
  return 'FULFILLED'
}

/** PM-BR-21; huỷ lượt = TODO(OQ: Payment-BRD.md §27 Q15 / master §51 Q57 — hoàn/giữ khi huỷ lượt; không build). */
const PAYMENT_BLOCKED_RENTAL_STATUSES: Rental['status'][] = ['CANCELLED', 'NO_SHOW', 'DISPUTED']

/** F2 (PAYMENT-PLAN.md §10.3) — ngữ cảnh bổ sung để quyết định theo `source`. */
export interface RequestActionableContext {
  settlementStatus?: SettlementStatus
  psc?: PostSettlementCharge
  pscOnHold?: boolean
}

/**
 * PM-BR-21. F2 (PAYMENT-PLAN.md §10.3) — luật theo `source`, không còn chặn
 * cứng Rental `COMPLETED` (PSC và phần thu/hoàn của Settlement nằm trên Rental
 * `COMPLETED`): `BOOKING`/`HANDOVER` ngừng nhận khi Settlement đã rời `DRAFT`
 * (§10.2 điểm 4); `SETTLEMENT` actionable khi Rental `SETTLEMENT`/`COMPLETED`;
 * `POST_SETTLEMENT_CHARGE` actionable khi PSC `OPEN` và không `pscOnHold`
 * (UC-RS-14 A1).
 */
export function isRequestActionable(request: PaymentRequest, rental: Rental, ctx?: RequestActionableContext): boolean {
  if (request.status !== 'OPEN' && request.status !== 'PARTIALLY_FULFILLED') return false
  if (request.source === 'BOOKING' || request.source === 'HANDOVER') {
    if (PAYMENT_BLOCKED_RENTAL_STATUSES.includes(rental.status) || rental.status === 'COMPLETED') return false
    return ctx?.settlementStatus === undefined || ctx.settlementStatus === 'DRAFT'
  }
  if (request.source === 'SETTLEMENT') {
    return rental.status === 'SETTLEMENT' || rental.status === 'COMPLETED'
  }
  if (request.source === 'POST_SETTLEMENT_CHARGE') {
    return !!ctx?.psc && ctx.psc.status === 'OPEN' && !ctx.pscOnHold
  }
  return false
}

/**
 * `Payment-BRD.md` §4.1 — `PaymentMilestoneView[]`. Mốc `RETURN`: Round 2 lấy
 * yêu cầu `source = SETTLEMENT` (kể cả `CANCELLED` để hiện lịch sử đảo quyết
 * toán); không có yêu cầu nào thì `BY_SETTLEMENT` như Round 1.
 */
export function buildPaymentSchedule(rental: Rental, requests: PaymentRequest[], txns: Transaction[]): PaymentMilestoneView[] {
  const milestones: PaymentMilestone[] = ['BOOKING', 'HANDOVER', 'RETURN']
  return milestones.map((milestone): PaymentMilestoneView => {
    if (milestone === 'RETURN') {
      const returnReqs = requests.filter((r) => r.source === 'SETTLEMENT')
      if (returnReqs.length === 0) {
        return { milestone, requests: [], expectedTotal: 0, collectedTotal: 0, pendingTotal: 0, state: 'BY_SETTLEMENT' }
      }
      const expectedTotal = returnReqs.reduce((sum, r) => sum + r.expectedAmount, 0)
      let collectedTotal = 0
      let pendingTotal = 0
      for (const r of returnReqs) {
        const progress = calcRequestProgress(r, txns)
        collectedTotal += progress.collected
        pendingTotal += progress.pending
      }
      let returnState: PaymentMilestoneView['state']
      if (returnReqs.every((r) => r.status === 'CANCELLED')) {
        returnState = 'CANCELLED'
      } else if (returnReqs.every((r) => r.status === 'FULFILLED' || r.status === 'CANCELLED')) {
        returnState = 'DONE'
      } else if (collectedTotal > 0 || pendingTotal > 0) {
        returnState = 'PARTIAL'
      } else {
        returnState = 'OPEN'
      }
      return { milestone, requests: returnReqs, expectedTotal, collectedTotal, pendingTotal, state: returnState }
    }
    const reqs = requests.filter((r) => r.source === milestone)
    const expectedTotal = reqs.reduce((sum, r) => sum + r.expectedAmount, 0)
    let collectedTotal = 0
    let pendingTotal = 0
    for (const r of reqs) {
      const progress = calcRequestProgress(r, txns)
      collectedTotal += progress.collected
      pendingTotal += progress.pending
    }
    let state: PaymentMilestoneView['state']
    if (reqs.length === 0) {
      state = 'NOT_SCHEDULED'
    } else if (reqs.every((r) => r.status === 'CANCELLED')) {
      state = 'CANCELLED'
    } else if (reqs.every((r) => r.status === 'FULFILLED' || r.status === 'CANCELLED')) {
      state = 'DONE'
    } else if (collectedTotal > 0 || pendingTotal > 0) {
      state = 'PARTIAL'
    } else {
      state = 'OPEN'
    }
    // PM-BR-22 — HANDOVER + MOTORBIKE → dòng vật bảo đảm, không sinh giao dịch tiền.
    const motorbikeCollateral = milestone === 'HANDOVER' && rental.securityDepositType === 'MOTORBIKE'
    return { milestone, requests: reqs, expectedTotal, collectedTotal, pendingTotal, state, motorbikeCollateral }
  })
}

/**
 * `Payment-BRD.md` §11/§13, PM-BR-06/14 — §2.5 `PAYMENT-PLAN.md`.
 * TODO(OQ: Payment-BRD.md §27 Q9 — hạn thanh toán; không tính `OVERDUE`).
 * F3 (PAYMENT-PLAN.md §10.3): (a) chỉ tính trong **kỳ gốc** — loại mọi yêu
 * cầu/giao dịch `POST_SETTLEMENT_CHARGE` (`scopeToOriginalPeriod`) để PSC
 * không làm đổi trạng thái thanh toán của Settlement gốc (AC-PM-012, RS-BR-13);
 * (b) `REFUNDED` chỉ đúng khi có ÍT NHẤT một yêu cầu `REFUND` `FULFILLED` (sau
 * đảo quyết toán mọi yêu cầu có thể chỉ còn `CANCELLED`, không phải đã hoàn).
 */
export function deriveRentalPaymentSummary(
  rental: Rental,
  requests: PaymentRequest[],
  txns: Transaction[],
  settlement?: Settlement,
): RentalPaymentSummary {
  const rentalRequestsAll = requests.filter((r) => r.rentalId === rental.id)
  const rentalTxnsAll = txns.filter((t) => t.rentalId === rental.id)
  const { requests: rentalRequests, txns: rentalTxns } = scopeToOriginalPeriod(rentalRequestsAll, rentalTxnsAll)
  const effective = rentalTxns.filter(isEffectiveTransaction)

  let totalPayable = rental.estimatedTotal
  let totalPayableIsEstimate = true
  if (settlement?.status === 'COMPLETED' && settlement.completedTotals) {
    totalPayable = settlement.completedTotals.finalAmount
    totalPayableIsEstimate = false
  } else if (settlement?.status === 'CONFIRMED') {
    totalPayable = calcSettlementTotals(settlement.lines, settlement.waivers).finalAmount
    totalPayableIsEstimate = false
  }

  // §0.3 điểm 5 kế hoạch — Paid To Date KHÔNG tính `DEPOSIT`, CÓ tính `OFFSET` (method OFFSET vẫn type khác DEPOSIT).
  const paidToDate = effective
    .filter((t) => t.direction === 'IN' && t.type !== 'DEPOSIT')
    .reduce((sum, t) => sum + t.amount, 0)
  const depositHeld = calcLedgerDepositHeld(rental.id, rentalTxns)
  const refunded = effective.filter((t) => t.direction === 'OUT' && t.type !== 'ADJUSTMENT').reduce((sum, t) => sum + t.amount, 0)
  const balanceDue = totalPayable - paidToDate

  const refundRequests = rentalRequests.filter((r) => r.purpose === 'REFUND')
  const openRefundRequests = refundRequests.filter((r) => r.status === 'OPEN' || r.status === 'PARTIALLY_FULFILLED')
  const hasOpenRefund = openRefundRequests.length > 0
  const hasFulfilledRefund = refundRequests.some((r) => r.status === 'FULFILLED')
  const allRefundRequestsClosed = refundRequests.length > 0 && refundRequests.every((r) => r.status === 'FULFILLED' || r.status === 'CANCELLED')
  const pendingRefund = openRefundRequests.reduce((sum, r) => sum + calcRequestProgress(r, rentalTxns).remaining, 0)

  let paymentStatus: SettlementPaymentStatus
  if (hasOpenRefund) {
    paymentStatus = 'REFUND_PENDING'
  } else if (hasFulfilledRefund && allRefundRequestsClosed && balanceDue <= 0) {
    paymentStatus = 'REFUNDED'
  } else if (paidToDate <= 0) {
    paymentStatus = 'UNPAID'
  } else if (paidToDate < totalPayable) {
    paymentStatus = 'PARTIALLY_PAID'
  } else {
    paymentStatus = 'PAID'
  }

  return { totalPayable, totalPayableIsEstimate, paidToDate, depositHeld, refunded, balanceDue, paymentStatus, pendingRefund }
}

// ==== Payment (PM) — Round 2, PAYMENT-PLAN.md §10.3 ====

/** BRD §11 — `Σ DEPOSIT (IN hiệu lực) − Σ method OFFSET hiệu lực − Σ DEPOSIT_REFUND hiệu lực`, chỉ giao dịch của `rentalId`. */
export function calcLedgerDepositHeld(rentalId: string, txns: Transaction[]): number {
  const effective = txns.filter((t) => t.rentalId === rentalId).filter(isEffectiveTransaction)
  const depositIn = effective.filter((t) => t.type === 'DEPOSIT').reduce((sum, t) => sum + t.amount, 0)
  const offsetUsed = effective.filter((t) => t.method === 'OFFSET').reduce((sum, t) => sum + t.amount, 0)
  const depositRefundOut = effective.filter((t) => t.type === 'DEPOSIT_REFUND').reduce((sum, t) => sum + t.amount, 0)
  return depositIn - offsetUsed - depositRefundOut
}

/** §10.2 điểm 1 — loại yêu cầu/giao dịch nguồn `POST_SETTLEMENT_CHARGE` khỏi phạm vi "kỳ gốc". */
export function scopeToOriginalPeriod(requests: PaymentRequest[], txns: Transaction[]): { requests: PaymentRequest[]; txns: Transaction[] } {
  const pscRequestIds = new Set(requests.filter((r) => r.source === 'POST_SETTLEMENT_CHARGE').map((r) => r.id))
  return {
    requests: requests.filter((r) => r.source !== 'POST_SETTLEMENT_CHARGE'),
    txns: txns.filter((t) => !t.paymentRequestId || !pscRequestIds.has(t.paymentRequestId)),
  }
}

/**
 * PM-BR-12, AC-PM-007 — TODO(OQ: Payment-BRD.md §27 Q13 — ngưỡng duyệt hoàn
 * chưa chốt; giá trị lấy từ ví dụ AC-PM-007; UC-PM-09 có 2 cấp Manager/Admin,
 * demo 1 cấp `PAYMENT.APPROVE`). Hệ quả: hoàn cọc `CASH_20M` (20tr) gần như
 * luôn cần duyệt.
 */
export const REFUND_APPROVAL_THRESHOLD = 1_000_000
export function refundNeedsApproval(amount: number): boolean {
  return amount > REFUND_APPROVAL_THRESHOLD
}

/** BRD §8, UC-PM-04 §8.4 — bảng §2.1 `PAYMENT-PLAN.md`. */
export const SETTLEMENT_REQUEST_MAPPING: Record<SettlementRequestType, { purpose: PaymentRequestPurpose; transactionType: TransactionType }> = {
  COLLECT: { purpose: 'COLLECT', transactionType: 'ADDITIONAL_CHARGE' },
  DEPOSIT_REFUND: { purpose: 'REFUND', transactionType: 'DEPOSIT_REFUND' },
  OVERPAYMENT_REFUND: { purpose: 'REFUND', transactionType: 'OVERPAYMENT_REFUND' },
}

/** UC-PM-01 — `PaymentRequest` `source = SETTLEMENT`, 1-1 với `SettlementPaymentRequest` (§0.3 điểm 7). */
export function buildSettlementPaymentRequest(settlement: Settlement, spr: SettlementPaymentRequest, actorName: string, now: string): PaymentRequest {
  const mapping = SETTLEMENT_REQUEST_MAPPING[spr.type]
  return {
    id: generateId('prq'),
    source: 'SETTLEMENT',
    purpose: mapping.purpose,
    transactionType: mapping.transactionType,
    expectedAmount: spr.amount,
    status: 'OPEN',
    rentalId: settlement.rentalId,
    customerId: settlement.customerId,
    settlementId: settlement.id,
    settlementRequestId: spr.id,
    createdByName: actorName,
    createdAt: now,
    updatedAt: now,
  }
}

/** BRD §8, UC-RS-14/UC-PM-10 — `PaymentRequest` `source = POST_SETTLEMENT_CHARGE`, 1-1 với PSC. */
export function buildPscPaymentRequest(psc: PostSettlementCharge, actorName: string, now: string): PaymentRequest {
  const purpose: PaymentRequestPurpose = psc.type === 'RECEIVABLE' ? 'COLLECT' : 'REFUND'
  // §10.13 điểm 7 — `GOODWILL_REFUND` cho mọi PSC `REFUND` (kể cả `ADJUSTMENT` giảm, UC-RS-10 A2).
  const transactionType: TransactionType = psc.type === 'RECEIVABLE' ? 'POST_SETTLEMENT_COLLECT' : 'GOODWILL_REFUND'
  return {
    id: generateId('prq'),
    source: 'POST_SETTLEMENT_CHARGE',
    purpose,
    transactionType,
    expectedAmount: psc.amount,
    status: 'OPEN',
    rentalId: psc.rentalId,
    customerId: psc.customerId,
    settlementId: psc.settlementId,
    postSettlementChargeId: psc.id,
    createdByName: actorName,
    createdAt: now,
    updatedAt: now,
  }
}

/** UC-PM-05 bước 3, AC-PM-003 — giao dịch `OFFSET` hệ thống tự sinh khi Settlement chốt, không qua `PaymentRequest`. */
export function buildOffsetTransaction(settlement: Settlement, actor: { userId: string; fullName: string }, code: string, now: string): Transaction {
  const amount = settlement.depositReconciliation?.depositApplied ?? 0
  return {
    id: generateId('txn'),
    code,
    type: 'ADDITIONAL_CHARGE',
    direction: 'IN',
    amount,
    method: 'OFFSET',
    status: 'CONFIRMED',
    customerId: settlement.customerId,
    rentalId: settlement.rentalId,
    settlementId: settlement.id,
    reason: `Cấn trừ cọc theo quyết toán ${settlement.id}`,
    performedByUserId: actor.userId,
    performedByName: actor.fullName,
    performedAt: now,
    confirmedByName: actor.fullName,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

/** §10.5 — tìm giao dịch `OFFSET` hiệu lực đang gắn một Settlement (chống tạo trùng, idempotent). */
export function findEffectiveOffset(settlementId: string, txns: Transaction[]): Transaction | undefined {
  return txns.find((t) => t.method === 'OFFSET' && t.settlementId === settlementId && isEffectiveTransaction(t))
}

/**
 * PM-BR-03/04/19 — tách lõi đảo giao dịch thành hàm thuần, dùng chung đường
 * thủ công (`reverseTransaction`) và đường hệ thống (đảo `OFFSET` khi đảo
 * quyết toán, §10.5).
 */
export function buildReversalPair(
  original: Transaction,
  reason: string,
  actor: { userId: string; fullName: string },
  code: string,
  now: string,
): { updatedOriginal: Transaction; reversal: Transaction } {
  const reversal: Transaction = {
    id: generateId('txn'),
    code,
    type: original.type,
    direction: original.direction === 'IN' ? 'OUT' : 'IN',
    amount: original.amount,
    method: original.method,
    status: 'CONFIRMED',
    customerId: original.customerId,
    rentalId: original.rentalId,
    paymentRequestId: original.paymentRequestId,
    settlementId: original.settlementId,
    reversalOfId: original.id,
    reverseReason: reason,
    cashDrawerId: original.cashDrawerId,
    cashDrawerOwnerName: original.cashDrawerOwnerName,
    performedByUserId: actor.userId,
    performedByName: actor.fullName,
    performedAt: now,
    confirmedByName: actor.fullName,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  }
  const updatedOriginal: Transaction = {
    ...original,
    status: 'REVERSED',
    reversedById: reversal.id,
    reverseReason: reason,
    updatedAt: now,
    // PM-BR-19 — vô hiệu biên lai gốc.
    receipt: original.receipt ? { ...original.receipt, voided: true } : original.receipt,
  }
  return { updatedOriginal, reversal }
}

/** UC-PM-10 — tổng hợp thu/hoàn theo từng PSC (dùng ở khối "Phát sinh sau quyết toán" + Công nợ). */
export interface PscPaymentSummary {
  psc: PostSettlementCharge
  request?: PaymentRequest
  done: number
  pending: number
  remaining: number
}

export function summarizePscPayments(
  pscs: PostSettlementCharge[],
  requests: PaymentRequest[],
  txns: Transaction[],
): { items: PscPaymentSummary[]; openReceivable: number; openRefund: number } {
  const items: PscPaymentSummary[] = pscs.map((psc) => {
    const request = requests.find((r) => r.postSettlementChargeId === psc.id)
    const progress = request ? calcRequestProgress(request, txns) : { collected: 0, pending: 0, remaining: psc.amount }
    return { psc, request, done: progress.collected, pending: progress.pending, remaining: progress.remaining }
  })
  let openReceivable = 0
  let openRefund = 0
  for (const item of items) {
    if (item.psc.status !== 'OPEN') continue
    if (item.psc.type === 'RECEIVABLE') openReceivable += item.remaining
    else openRefund += item.remaining
  }
  return { items, openReceivable, openRefund }
}

/** BRD §12, UC-PM-18 — Công nợ theo khách, §10.8 `PAYMENT-PLAN.md`. */
export interface CustomerBalance {
  customerId: string
  totalCharged: number
  totalCollected: number
  outstanding: number
  credit: number
  depositHeld: number
  /** "Đã thu trước (chưa quyết toán)" — Σ Paid To Date của Rental chưa có Settlement `CONFIRMED`/`COMPLETED`. */
  unsettledPaidToDate: number
  /** "Tạm giữ (tranh chấp)" — Σ amount PSC `RECEIVABLE` đang on-hold, KHÔNG cộng vào Outstanding. */
  onHoldAmount: number
  rentalItems: { rentalId: string; charged: number; collected: number; balance: number; paymentStatus: SettlementPaymentStatus }[]
  pscItems: { psc: PostSettlementCharge; balance: number; onHold: boolean }[]
}

/**
 * BRD §12, UC-PM-18, §10.8 `PAYMENT-PLAN.md`, diễn giải §0.4 điểm 5 — tính
 * theo TỪNG khoản riêng (Rental đã quyết toán / từng PSC), KHÔNG bù trừ chéo
 * giữa các khoản (Credit/Overpayment là `TODO(OQ: Payment-BRD.md §27 Q8)`).
 * Rental chưa có Settlement `CONFIRMED`/`COMPLETED` không tính vào
 * Outstanding/Credit, chỉ gộp vào `unsettledPaidToDate`.
 */
export function deriveCustomerBalances(input: {
  customers: Customer[]
  rentals: Rental[]
  settlements: Settlement[]
  pscs: PostSettlementCharge[]
  requests: PaymentRequest[]
  txns: Transaction[]
  onHoldPscIds: Set<string>
}): CustomerBalance[] {
  const map = new Map<string, CustomerBalance>()
  function ensure(customerId: string): CustomerBalance {
    let b = map.get(customerId)
    if (!b) {
      b = {
        customerId,
        totalCharged: 0,
        totalCollected: 0,
        outstanding: 0,
        credit: 0,
        depositHeld: 0,
        unsettledPaidToDate: 0,
        onHoldAmount: 0,
        rentalItems: [],
        pscItems: [],
      }
      map.set(customerId, b)
    }
    return b
  }

  for (const rental of input.rentals) {
    const rentalTxns = input.txns.filter((t) => t.rentalId === rental.id)
    const rentalRequests = input.requests.filter((r) => r.rentalId === rental.id)
    if (rentalRequests.length === 0 && rentalTxns.length === 0) continue
    const settlement = input.settlements.find((s) => s.rentalId === rental.id)
    const b = ensure(rental.customerId)
    b.depositHeld += calcLedgerDepositHeld(rental.id, rentalTxns)

    if (!settlement || (settlement.status !== 'CONFIRMED' && settlement.status !== 'COMPLETED')) {
      const paidToDate = calcPaidToDate(rental, rentalRequests, rentalTxns)
      b.unsettledPaidToDate += paidToDate.prepayment + paidToDate.handoverPayment
      continue
    }

    const { requests: scopedRequests, txns: scopedTxns } = scopeToOriginalPeriod(rentalRequests, rentalTxns)
    const summary = deriveRentalPaymentSummary(rental, scopedRequests, scopedTxns, settlement)
    const charged = summary.totalPayable
    const settlementRequestIds = new Set(scopedRequests.filter((r) => r.source === 'SETTLEMENT').map((r) => r.id))
    const refundOut = scopedTxns
      .filter(isEffectiveTransaction)
      .filter(
        (t) =>
          t.direction === 'OUT' &&
          (t.type === 'OVERPAYMENT_REFUND' || t.type === 'GOODWILL_REFUND') &&
          !!t.paymentRequestId &&
          settlementRequestIds.has(t.paymentRequestId),
      )
      .reduce((sum, t) => sum + t.amount, 0)
    const collected = summary.paidToDate - refundOut
    const balance = charged - collected
    b.totalCharged += charged
    b.totalCollected += collected
    b.rentalItems.push({ rentalId: rental.id, charged, collected, balance, paymentStatus: summary.paymentStatus })
  }

  for (const psc of input.pscs) {
    const b = ensure(psc.customerId)
    const onHold = input.onHoldPscIds.has(psc.id)
    if (onHold) {
      if (psc.type === 'RECEIVABLE') b.onHoldAmount += psc.amount
      b.pscItems.push({ psc, balance: 0, onHold: true })
      continue
    }
    const request = input.requests.find((r) => r.postSettlementChargeId === psc.id)
    const done = request ? calcRequestProgress(request, input.txns).collected : 0
    const balance = psc.type === 'RECEIVABLE' ? psc.amount - done : -(psc.amount - done)
    b.pscItems.push({ psc, balance, onHold: false })
  }

  for (const b of map.values()) {
    const itemBalances = [...b.rentalItems.map((r) => r.balance), ...b.pscItems.filter((p) => !p.onHold).map((p) => p.balance)]
    b.outstanding = itemBalances.reduce((sum, v) => sum + Math.max(0, v), 0)
    b.credit = itemBalances.reduce((sum, v) => sum + Math.max(0, -v), 0)
  }

  const validCustomerIds = new Set(input.customers.map((c) => c.id))
  return Array.from(map.values()).filter((b) => validCustomerIds.has(b.customerId))
}

// ---- Form schema Round 2 (`model.ts`, dùng thật trong dialog — §0.2) ----

/** PM-BR-13 — tạo yêu cầu hoàn, bắt buộc thông tin người nhận. */
export const refundCreateFormSchema = z
  .object({
    amount: z
      .string()
      .trim()
      .min(1, 'Số tiền là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương (PM-BR-20)' }),
    method: z.enum(['CASH', 'BANK_TRANSFER', 'E_WALLET']),
    refundRecipient: z.string().trim().min(3, 'Thông tin nhận tiền là bắt buộc — PM-BR-13'),
    reference: z.string().trim().optional(),
    evidenceNote: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.method === 'BANK_TRANSFER' || data.method === 'E_WALLET') && !data.reference) {
      ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Mã tham chiếu là bắt buộc với chuyển khoản/ví' })
    }
  })
export type RefundCreateFormValues = z.infer<typeof refundCreateFormSchema>

/** UC-PM-09 bước 4 — duyệt/từ chối hoàn vượt ngưỡng, lý do bắt buộc khi từ chối. */
export const refundDecisionFormSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'REJECTED' && (!data.note || data.note.length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Lý do từ chối là bắt buộc (tối thiểu 3 ký tự)' })
    }
  })
export type RefundDecisionFormValues = z.infer<typeof refundDecisionFormSchema>

/** `Payment-BRD.md` §14. */
export function cashDrawerIdOf(userId: string): string {
  return `drawer:${userId}`
}

/** `Payment-BRD.md` §14, UC-PM-14 — Σ CASH hiệu lực chưa thuộc phiếu nào (IN +, OUT −). */
export function calcCashDrawerBalance(
  drawerId: string,
  txns: Transaction[],
  submissions: CashDrawerSubmission[],
): { balance: number; transactions: Transaction[] } {
  const submittedIds = new Set(submissions.flatMap((s) => s.transactionIds))
  const related = txns.filter((t) => t.method === 'CASH' && t.cashDrawerId === drawerId && isEffectiveTransaction(t) && !submittedIds.has(t.id))
  const balance = related.reduce((sum, t) => sum + (t.direction === 'IN' ? t.amount : -t.amount), 0)
  return { balance, transactions: related }
}

/** `Payment-BRD.md` §6.1/§18 — `GD-000001` / `BL-000001`. */
export function nextSequenceCode(prefix: string, existingCodes: string[]): string {
  let max = 0
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  for (const code of existingCodes) {
    const match = re.exec(code)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-${String(max + 1).padStart(6, '0')}`
}

// ---- §3.1 kế hoạch — Form schema (dùng thật trong dialog, §0.2) ----

export const transactionRecordFormSchema = z
  .object({
    paymentRequestId: z.string().trim().min(1, 'Chọn yêu cầu thanh toán'),
    amount: z
      .string()
      .trim()
      .min(1, 'Số tiền là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương (PM-BR-20)' }),
    method: z.enum(['CASH', 'BANK_TRANSFER', 'E_WALLET']),
    reference: z.string().trim().optional(),
    evidenceNote: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    // `Payment-BRD.md` §9 — mã tham chiếu bắt buộc khi CK/ví.
    if ((data.method === 'BANK_TRANSFER' || data.method === 'E_WALLET') && !data.reference) {
      ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Mã tham chiếu là bắt buộc với chuyển khoản/ví' })
    }
  })
export type TransactionRecordFormValues = z.infer<typeof transactionRecordFormSchema>

/** UC-PM-06 A1 — sửa số theo thực nhận lúc xác nhận CK/ví. */
export const transactionConfirmFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Số tiền là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
  note: z.string().trim().optional(),
})
export type TransactionConfirmFormValues = z.infer<typeof transactionConfirmFormSchema>

/** Dùng chung cho Thất bại / Huỷ / Đảo. */
export const transactionReasonFormSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type TransactionReasonFormValues = z.infer<typeof transactionReasonFormSchema>

/** PM-BR-18 — giao dịch thủ công IN/OUT, gắn Customer (+ Rental tuỳ chọn), lý do bắt buộc. */
export const adjustmentFormSchema = z.object({
  direction: z.enum(['IN', 'OUT']),
  amount: z
    .string()
    .trim()
    .min(1, 'Số tiền là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Số tiền phải là số nguyên dương' }),
  customerId: z.string().trim().min(1, 'Chọn khách hàng'),
  rentalId: z.string().trim().optional(),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'E_WALLET']),
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự) — PM-BR-18'),
})
export type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>

/** AC-PM-009 — bắt buộc lý do khi `countedAmount ≠ systemAmount` (EX-06). */
export function makeCashDrawerSubmitSchema(systemAmount: number) {
  return z
    .object({
      countedAmount: z
        .string()
        .trim()
        .min(1, 'Số đếm thực tế là bắt buộc')
        .refine((v) => NUMERIC_RE.test(v), { message: 'Số đếm phải là số nguyên không âm' }),
      varianceReason: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      if (Number(data.countedAmount) !== systemAmount && !data.varianceReason) {
        ctx.addIssue({ code: 'custom', path: ['varianceReason'], message: 'Lý do chênh lệch là bắt buộc khi số đếm khác số hệ thống' })
      }
    })
}
export type CashDrawerSubmitFormValues = z.infer<ReturnType<typeof makeCashDrawerSubmitSchema>>
