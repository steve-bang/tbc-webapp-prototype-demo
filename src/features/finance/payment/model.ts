// Module Payment (PM) — hàm thuần + form schema. Tách từ `finance/model.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.1.
import { z } from 'zod'
// `customers`/`handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2) —
// không deep-import `/api`, `/hooks`, `/model` của 4 feature nguồn.
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import type {
  PaymentMilestone,
  PaymentRequestPurpose,
  PaymentRequestStatus,
  SettlementPaymentStatus,
  SettlementRequestType,
  SettlementStatus,
  TransactionDirection,
  TransactionType,
} from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { generateId } from '@/shared/lib/id'
import { calcSettlementTotals, NUMERIC_RE } from '../core/model.ts'
import type {
  CashDrawerSubmission,
  PaymentRequest,
  PostSettlementCharge,
  Settlement,
  SettlementPaymentRequest,
  Transaction,
} from '../core/types.ts'

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
 * (để yêu cầu hoàn đạt `FULFILLED` khi đã hoàn đủ, không bao giờ âm); `PAYOUT` (chi trả chủ xe) tính như `REFUND`. `pending`
 * chỉ tính giao dịch `PENDING` cùng chiều mong đợi của `purpose`.
 */
export function calcRequestProgress(request: PaymentRequest, txns: Transaction[]): { collected: number; pending: number; remaining: number } {
  const related = txns.filter((t) => t.paymentRequestId === request.id)
  // `PAYOUT` (chi trả chủ xe) cũng là chiều ra tiền — nếu không liệt kê ở đây, lệnh chi bị tính như khoản thu mà không báo lỗi.
  const expectedDirection: TransactionDirection = request.purpose === 'REFUND' || request.purpose === 'PAYOUT' ? 'OUT' : 'IN'
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

/** Yêu cầu thu / hoàn của khách: bắt buộc có `rentalId` + `customerId` (PM-BR-16). */
export type RentalPaymentRequest = PaymentRequest & { rentalId: string; customerId: string }

/**
 * Đường thu / hoàn của khách chỉ nhận yêu cầu của khách. Lệnh chi trả chủ xe (`source = CONSIGNMENT`, PM-BR-24) không có
 * `rentalId`/`customerId` và được xử lý ở màn Chi trả chủ xe — từ chối ngay đầu hàm, đồng thời thu hẹp kiểu.
 */
export function asRentalRequest(request: PaymentRequest): RentalPaymentRequest {
  if (request.source === 'CONSIGNMENT' || request.rentalId === undefined || request.customerId === undefined) {
    throw new Error(vi.finance.ownerPayout.errConsignmentRequest)
  }
  return { ...request, rentalId: request.rentalId, customerId: request.customerId }
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
    // Chi trả chủ xe (PM-BR-24): bản đối ứng phải trỏ cùng chủ xe / khoản chi trả / xe để sổ giao dịch và công nợ chủ xe khớp.
    vehicleOwnerId: original.vehicleOwnerId,
    ownerPayoutRecordId: original.ownerPayoutRecordId,
    vehicleId: original.vehicleId,
    payoutRecipient: original.payoutRecipient,
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

/** UC-VC-09 — tạo lệnh chi trả chủ xe: số tiền, người nhận, phương thức do khoản chi trả quyết định; chỉ nhập mã tham chiếu / ghi chú. */
export const ownerPayoutCreateFormSchema = z.object({
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
})
export type OwnerPayoutCreateFormValues = z.infer<typeof ownerPayoutCreateFormSchema>

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
