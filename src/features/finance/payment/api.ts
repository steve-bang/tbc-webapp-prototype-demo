// Payment (PM) — fake API. Tách từ `finance/api.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.2.
import {
  CONSIGNMENT_CONTRACTS_STORAGE_KEY,
  OWNER_PAYOUT_RECORDS_STORAGE_KEY,
  VEHICLE_OWNERS_STORAGE_KEY,
  getOwnerPayoutBlocker,
  linkOwnerPayoutRecord,
  maskAccountNumber,
  type ConsignmentContract,
  type OwnerPayoutRecord,
  type VehicleOwner,
} from '@/features/consignment'
import { listIncidents } from '@/features/incidents'
import type {
  PaymentMethod,
  PaymentRequestSource,
  PaymentRequestStatus,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { formatVnd } from '@/shared/lib/money'
import { readJson } from '@/shared/lib/storage'
import { listPostSettlementCharges, listSettlements } from '../core/api.ts'
import { isPscOnHold } from '../core/model.ts'
import {
  readAllCashDrawerSubmissions,
  readAllPaymentRequests,
  readAllTransactions,
  readRentalOrThrow,
  writeAllCashDrawerSubmissions,
  writeAllPaymentRequests,
  writeAllTransactions,
} from '../core/storage.ts'
import type { ActorInfo, CashDrawerSubmission, PaymentRequest, PostSettlementCharge, Receipt, Transaction } from '../core/types.ts'
import { syncFinanceAfterPaymentChange, syncOwnerPayoutAfterPaymentChange } from './ledger.ts'
import {
  asRentalRequest,
  buildReversalPair,
  buildScheduleRequests,
  calcCashDrawerBalance,
  calcLedgerDepositHeld,
  calcRequestProgress,
  canScheduleRental,
  cashDrawerIdOf,
  directionOf,
  isRequestActionable,
  nextSequenceCode,
  refundNeedsApproval,
} from './model.ts'

// ==== Payment (PM) — PAYMENT-PLAN.md §9 ====

export interface PaymentRequestFilter {
  rentalId?: string
  customerId?: string
  source?: PaymentRequestSource
  status?: PaymentRequestStatus
  /** Round 2 — PAYMENT-PLAN.md §10.7. */
  postSettlementChargeId?: string
  settlementId?: string
}

export async function listPaymentRequests(filter?: PaymentRequestFilter): Promise<PaymentRequest[]> {
  return fakeRequest(() =>
    readAllPaymentRequests().filter((r) => {
      if (filter?.rentalId && r.rentalId !== filter.rentalId) return false
      if (filter?.customerId && r.customerId !== filter.customerId) return false
      if (filter?.source && r.source !== filter.source) return false
      if (filter?.status && r.status !== filter.status) return false
      if (filter?.postSettlementChargeId && r.postSettlementChargeId !== filter.postSettlementChargeId) return false
      if (filter?.settlementId && r.settlementId !== filter.settlementId) return false
      return true
    }),
  )
}

export interface TransactionFilter {
  status?: TransactionStatus
  type?: TransactionType
  method?: PaymentMethod
  direction?: TransactionDirection
  rentalId?: string
  customerId?: string
  /** Tìm theo mã GD / tham chiếu / mã lượt thuê (§7.1 kế hoạch). */
  search?: string
  /** Round 2 — PAYMENT-PLAN.md §10.7 — giao dịch OUT đang chờ duyệt hoàn. */
  approvalPending?: boolean
}

export async function listTransactions(filter?: TransactionFilter): Promise<Transaction[]> {
  return fakeRequest(() =>
    readAllTransactions()
      .filter((t) => {
        if (filter?.status && t.status !== filter.status) return false
        if (filter?.type && t.type !== filter.type) return false
        if (filter?.method && t.method !== filter.method) return false
        if (filter?.direction && t.direction !== filter.direction) return false
        if (filter?.rentalId && t.rentalId !== filter.rentalId) return false
        if (filter?.customerId && t.customerId !== filter.customerId) return false
        if (filter?.approvalPending && t.approval?.status !== 'PENDING_APPROVAL') return false
        if (filter?.search) {
          const q = filter.search.trim().toLowerCase()
          if (q.length === 0) return true
          const haystack = `${t.code} ${t.reference ?? ''} ${t.rentalId ?? ''}`.toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
  )
}

export interface CashDrawerSubmissionFilter {
  cashDrawerId?: string
  status?: CashDrawerSubmission['status']
}

export async function listCashDrawerSubmissions(filter?: CashDrawerSubmissionFilter): Promise<CashDrawerSubmission[]> {
  return fakeRequest(() =>
    readAllCashDrawerSubmissions()
      .filter((s) => {
        if (filter?.cashDrawerId && s.cashDrawerId !== filter.cashDrawerId) return false
        if (filter?.status && s.status !== filter.status) return false
        return true
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  )
}

/** PM-BR-21, CR-2026-003/060 — "Lập lịch thanh toán" là hành động tường minh (§0.3 điểm 9 kế hoạch). */
export async function createPaymentSchedule(rentalId: string, actor: ActorInfo): Promise<PaymentRequest[]> {
  return fakeRequest(() => {
    const rental = readRentalOrThrow(rentalId)
    if (!canScheduleRental(rental)) {
      throw new Error(`Không thể lập lịch thanh toán khi lượt thuê đang ở trạng thái ${rental.status} (PM-BR-21)`)
    }
    const existing = readAllPaymentRequests()
    if (existing.some((r) => r.rentalId === rentalId && (r.source === 'BOOKING' || r.source === 'HANDOVER'))) {
      throw new Error('Lượt thuê này đã có lịch thanh toán')
    }
    const now = new Date().toISOString()
    const created = buildScheduleRequests(rental, actor.fullName, now)
    writeAllPaymentRequests([...existing, ...created])
    appendAudit({
      action: 'CREATE_PAYMENT_SCHEDULE',
      entity: 'PaymentRequest',
      entityId: rentalId,
      summary: `Lập lịch thanh toán cho lượt thuê ${rentalId}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: created,
    })
    return created
  })
}

export interface RecordTransactionInput {
  paymentRequestId: string
  amount: number
  method: PaymentMethod
  reference?: string
  evidenceNote?: string
}

/**
 * UC-PM-01/02/03, PM-BR-09/10/15, AC-PM-001/002/004 — `CASH` → `CONFIRMED` ngay
 * + gắn quỹ; `BANK_TRANSFER`/`E_WALLET` → `PENDING`. Nhiều lần cho một yêu cầu.
 * Round 2 (§10.6): (a) từ chối yêu cầu `purpose = REFUND` (đi qua
 * `createRefundTransaction`); (b) `ctx` cho `isRequestActionable`; (c) xe máy
 * cầm cố (`MOTORBIKE`) + yêu cầu `SETTLEMENT`/`POST_SETTLEMENT_CHARGE` chỉ
 * nhận `BANK_TRANSFER` (BRD §9); (d) cuối cùng gọi `syncFinanceAfterPaymentChange`.
 */
export async function recordTransaction(input: RecordTransactionInput, actor: ActorInfo): Promise<Transaction> {
  // PM-BR-18/§0.3 điểm 8 kế hoạch — `OFFSET` (cấn trừ cọc, Round 2) và
  // `ONLINE_GATEWAY` (webhook SePay) chỉ do hệ thống tự sinh, không phải
  // phương thức người dùng tự chọn khi ghi nhận thủ công — đã chặn ở form
  // schema/UI, chặn lại ở API cho chắc (defense in depth, tech-lead review
  // Phase 4.2 R1 "nên sửa" #2).
  if (input.method === 'OFFSET' || input.method === 'ONLINE_GATEWAY') {
    throw new Error('Phương thức này chỉ do hệ thống tự sinh (cấn trừ cọc / webhook SePay) — không ghi nhận thủ công')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương (PM-BR-20)')
  const requestFound = readAllPaymentRequests().find((r) => r.id === input.paymentRequestId)
  if (!requestFound) throw new Error('Không tìm thấy yêu cầu thanh toán')
  // Lệnh chi trả chủ xe không đi qua đường thu của khách (PM-BR-24) — từ chối ngay đầu hàm.
  const requestPre = asRentalRequest(requestFound)
  if (requestPre.purpose === 'REFUND') {
    throw new Error("Yêu cầu hoàn tiền — dùng 'Tạo giao dịch hoàn' (createRefundTransaction), không ghi nhận thu")
  }
  const settlement = (await listSettlements({ rentalId: requestPre.rentalId }))[0]
  let psc: PostSettlementCharge | undefined
  let pscOnHold = false
  if (requestPre.source === 'POST_SETTLEMENT_CHARGE' && requestPre.postSettlementChargeId) {
    psc = (await listPostSettlementCharges({ rentalId: requestPre.rentalId })).find((p) => p.id === requestPre.postSettlementChargeId)
    if (psc) pscOnHold = isPscOnHold(psc, await listIncidents({ rentalId: requestPre.rentalId }))
  }

  return fakeRequest(() => {
    // N1 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.7, tech-lead review Phase 4.2
    // R2 — sửa điểm nên sửa #2) — đọc lại Rental TRONG callback, không dùng
    // bản đọc trước độ trễ giả lập, để guard `isRequestActionable` luôn dựa
    // trên trạng thái mới nhất.
    const rental = readRentalOrThrow(requestPre.rentalId)
    // §10.2 điểm 8 — xe máy cầm cố: khoản thu yêu cầu `SETTLEMENT`/`POST_SETTLEMENT_CHARGE` chỉ nhận `BANK_TRANSFER`.
    if (rental.securityDepositType === 'MOTORBIKE' && (requestPre.source === 'SETTLEMENT' || requestPre.source === 'POST_SETTLEMENT_CHARGE') && input.method !== 'BANK_TRANSFER') {
      throw new Error('Xe máy cầm cố — khoản thu thuộc quyết toán/phát sinh sau quyết toán chỉ nhận chuyển khoản (PM-BR-22)')
    }
    const prList = readAllPaymentRequests()
    const requestRaw = prList.find((r) => r.id === input.paymentRequestId)
    if (!requestRaw) throw new Error('Không tìm thấy yêu cầu thanh toán')
    const request = asRentalRequest(requestRaw)
    if (!isRequestActionable(request, rental, { settlementStatus: settlement?.status, psc, pscOnHold })) {
      throw new Error('Yêu cầu thanh toán này không còn ở trạng thái cho phép ghi nhận thu')
    }
    const txns = readAllTransactions()
    const { remaining } = calcRequestProgress(request, txns)
    // TODO(OQ: Payment-BRD.md §27 Q8 — trả thừa → Credit/Overpayment chưa chốt; demo chặn ghi vượt số còn lại).
    // TODO(OQ: Payment-BRD.md §27 Q7 — khách đang nợ: không cảnh báo/chặn tạo Rental, roadmap §15.2 kế hoạch).
    if (input.amount > remaining) {
      throw new Error(`Số tiền ghi nhận (${input.amount.toLocaleString('vi-VN')}đ) vượt số còn lại (${remaining.toLocaleString('vi-VN')}đ)`)
    }
    const now = new Date().toISOString()
    // PM-BR-09 — CK/ví → PENDING, chờ xác nhận.
    const isCash = input.method === 'CASH'
    const txn: Transaction = {
      id: generateId('txn'),
      code: nextSequenceCode('GD', txns.map((t) => t.code)),
      type: request.transactionType,
      direction: directionOf(request.transactionType) ?? 'IN',
      amount: input.amount,
      method: input.method,
      status: isCash ? 'CONFIRMED' : 'PENDING',
      customerId: request.customerId,
      rentalId: request.rentalId,
      paymentRequestId: request.id,
      reference: input.reference?.trim() || undefined,
      evidenceNote: input.evidenceNote?.trim() || undefined,
      // PM-BR-10 — CASH gắn quỹ người thu.
      cashDrawerId: isCash ? cashDrawerIdOf(actor.userId) : undefined,
      cashDrawerOwnerName: isCash ? actor.fullName : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.fullName,
      performedAt: now,
      confirmedByName: isCash ? actor.fullName : undefined,
      confirmedAt: isCash ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    writeAllTransactions([...txns, txn])
    appendAudit({
      action: 'CREATE_TRANSACTION',
      entity: 'Transaction',
      entityId: txn.id,
      summary: `Ghi nhận thu ${txn.amount.toLocaleString('vi-VN')}đ (${txn.method}) cho yêu cầu ${request.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: txn,
    })
    syncFinanceAfterPaymentChange(request.rentalId, actor, now)
    return txn
  })
}

export interface ConfirmTransactionInput {
  amount?: number
  note?: string
}

/**
 * UC-PM-06 (A1), BRD §15.2, EX-03 — chỉ `PENDING` CK/ví; cho sửa số theo thực
 * nhận (chỉ áp dụng GD `IN`). Round 2 (§10.6): (a) yêu cầu liên kết `CANCELLED`
 * → từ chối; (b) GD `OUT` (hoàn): không cho sửa số (§10.2 điểm 6), bắt buộc
 * `approval.status = 'APPROVED'` nếu có `approval` (PM-BR-12), `CASH` gắn quỹ
 * của người xác nhận + kiểm số dư đủ trước khi cho xác nhận (PM-BR-11, UC-PM-14 A2).
 */
export async function confirmTransaction(id: string, input: ConfirmTransactionInput, actor: ActorInfo): Promise<Transaction> {
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === id)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'PENDING') throw new Error('Chỉ xác nhận giao dịch đang chờ xử lý')
    const prList = readAllPaymentRequests()
    const request = before.paymentRequestId ? prList.find((r) => r.id === before.paymentRequestId) : undefined
    if (request && request.status === 'CANCELLED') {
      throw new Error('Yêu cầu thanh toán liên quan đã bị huỷ (đảo quyết toán) — không thể xác nhận giao dịch này')
    }
    let amount = before.amount
    let cashDrawerId = before.cashDrawerId
    let cashDrawerOwnerName = before.cashDrawerOwnerName
    if (before.direction === 'OUT') {
      if (input.amount !== undefined && input.amount !== before.amount) {
        // Tham chiếu kế hoạch nội bộ: §10.2 điểm 6 (không hiện trong thông báo UI —
        // tech-lead review Phase 4.2 R2 — sửa điểm nên sửa #2).
        throw new Error('Không thể sửa số tiền hoàn khi xác nhận — Huỷ (VOID) rồi tạo lại nếu cần đổi số')
      }
      if (before.approval && before.approval.status !== 'APPROVED') {
        throw new Error('Khoản hoàn này đang chờ duyệt — chỉ xác nhận đã chi sau khi được duyệt (PM-BR-12)')
      }
      // §10.6(c) kế hoạch — lớp phòng thủ bổ sung: dù đã kiểm `remaining − pending`
      // lúc tạo giao dịch hoàn, kiểm lại ngay trước khi xác nhận (tech-lead
      // review Phase 4.2 R2 — sửa điểm nên sửa #3).
      if (request) {
        const { remaining } = calcRequestProgress(request, txns)
        if (amount > remaining) {
          throw new Error(`Số tiền hoàn vượt số còn lại của yêu cầu (${remaining.toLocaleString('vi-VN')}đ)`)
        }
      }
      if (before.method === 'CASH') {
        cashDrawerId = cashDrawerIdOf(actor.userId)
        cashDrawerOwnerName = actor.fullName
        const submissions = readAllCashDrawerSubmissions()
        const { balance } = calcCashDrawerBalance(cashDrawerId, txns, submissions)
        if (balance < amount) {
          throw new Error('Số dư quỹ tiền mặt không đủ để chi (PM-BR-11)')
        }
      }
    } else {
      amount = input.amount ?? before.amount
      if (!Number.isInteger(amount) || amount <= 0) throw new Error('Số tiền phải là số nguyên dương (PM-BR-20)')
      if (request) {
        // TODO(OQ: Payment-BRD.md §27 Q8 — trả thừa → Credit/Overpayment chưa chốt; demo chặn ghi vượt số còn lại).
        const { remaining } = calcRequestProgress(request, txns)
        if (amount > remaining) {
          throw new Error(`Số tiền vượt số còn lại (${remaining.toLocaleString('vi-VN')}đ)`)
        }
      }
    }
    const now = new Date().toISOString()
    const after: Transaction = {
      ...before,
      status: 'CONFIRMED',
      amount,
      originalAmount: amount !== before.amount ? before.amount : before.originalAmount,
      cashDrawerId,
      cashDrawerOwnerName,
      confirmedByName: actor.fullName,
      confirmedAt: now,
      updatedAt: now,
    }
    writeAllTransactions(txns.map((t) => (t.id === id ? after : t)))
    appendAudit({
      action: 'CONFIRM_TRANSACTION',
      entity: 'Transaction',
      entityId: id,
      summary: `Xác nhận giao dịch ${before.code}${input.note ? `: ${input.note}` : ''}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { amount: before.amount, status: before.status },
      after: { amount: after.amount, status: after.status },
    })
    if (before.rentalId) syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    if (before.type === 'OWNER_PAYOUT') syncOwnerPayoutAfterPaymentChange(before.id, actor, now)
    return after
  })
}

/** Chỉ `PENDING` — EX-03. */
export async function failTransaction(id: string, reason: string, actor: ActorInfo): Promise<Transaction> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do là bắt buộc')
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === id)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'PENDING') throw new Error('Chỉ đánh dấu thất bại giao dịch đang chờ xử lý')
    const now = new Date().toISOString()
    const after: Transaction = { ...before, status: 'FAILED', failReason: trimmedReason, updatedAt: now }
    writeAllTransactions(txns.map((t) => (t.id === id ? after : t)))
    appendAudit({
      action: 'FAIL_TRANSACTION',
      entity: 'Transaction',
      entityId: id,
      summary: `Đánh dấu thất bại giao dịch ${before.code}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status, reason: trimmedReason },
    })
    if (before.rentalId) syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    if (before.type === 'OWNER_PAYOUT') syncOwnerPayoutAfterPaymentChange(before.id, actor, now)
    return after
  })
}

/** PM-BR-02 — chỉ huỷ giao dịch `PENDING`, lý do bắt buộc. */
export async function voidTransaction(id: string, reason: string, actor: ActorInfo): Promise<Transaction> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do là bắt buộc')
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === id)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'PENDING') throw new Error('Chỉ huỷ giao dịch đang chờ xử lý')
    const now = new Date().toISOString()
    const after: Transaction = { ...before, status: 'VOIDED', voidReason: trimmedReason, voidedByName: actor.fullName, voidedAt: now, updatedAt: now }
    writeAllTransactions(txns.map((t) => (t.id === id ? after : t)))
    appendAudit({
      action: 'VOID_TRANSACTION',
      entity: 'Transaction',
      entityId: id,
      summary: `Huỷ giao dịch ${before.code}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status, reason: trimmedReason },
    })
    if (before.rentalId) syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    if (before.type === 'OWNER_PAYOUT') syncOwnerPayoutAfterPaymentChange(before.id, actor, now)
    return after
  })
}

/**
 * UC-PM-12, PM-BR-03/05/19, AC-PM-008/013/015 — chỉ `CONFIRMED`, không phải
 * bản đối ứng, chưa bị đảo, method ≠ `OFFSET` (Round 2 hệ thống tự đảo khi đảo
 * quyết toán). Sinh giao dịch đối ứng, biên lai gốc bị vô hiệu.
 */
export async function reverseTransaction(id: string, reason: string, actor: ActorInfo): Promise<Transaction> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do là bắt buộc')
  // TODO(OQ: Payment-BRD.md §27 Q14 — Accountant được REVERSED chưa chốt; BRD §21 Admin/Manager ✓, Accountant TBD).
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === id)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'CONFIRMED') throw new Error('Chỉ đảo giao dịch đã xác nhận')
    if (before.reversalOfId) throw new Error('Không thể đảo một giao dịch đối ứng')
    if (before.reversedById) throw new Error('Giao dịch này đã được đảo')
    if (before.method === 'OFFSET') throw new Error('Giao dịch cấn trừ cọc chỉ được đảo tự động khi đảo quyết toán (Round 2)')
    const now = new Date().toISOString()
    const code = nextSequenceCode('GD', txns.map((t) => t.code))
    const { updatedOriginal, reversal } = buildReversalPair(before, trimmedReason, actor, code, now)
    writeAllTransactions([...txns.map((t) => (t.id === id ? updatedOriginal : t)), reversal])
    // AC-PM-015 — audit ghi đủ id gốc, id đối ứng và lý do.
    appendAudit({
      action: 'REVERSE_TRANSACTION',
      entity: 'Transaction',
      entityId: id,
      summary: `Đảo giao dịch ${before.code} → sinh ${reversal.code}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { id: before.id, code: before.code, status: before.status },
      after: { originalId: before.id, reversalId: reversal.id, reason: trimmedReason },
    })
    if (before.rentalId) syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    if (before.type === 'OWNER_PAYOUT') syncOwnerPayoutAfterPaymentChange(before.id, actor, now)
    return updatedOriginal
  })
}

export interface CreateAdjustmentInput {
  direction: TransactionDirection
  amount: number
  customerId: string
  rentalId?: string
  method: PaymentMethod
  reason: string
}

/** UC-PM-13, PM-BR-18 — giao dịch thủ công IN/OUT, gắn Customer (+ Rental tuỳ chọn), lý do bắt buộc. */
export async function createAdjustment(input: CreateAdjustmentInput, actor: ActorInfo): Promise<Transaction> {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Lý do là bắt buộc')
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương (PM-BR-20)')
  // PM-BR-18/§0.3 điểm 8 kế hoạch — như `recordTransaction`: `OFFSET`/`ONLINE_GATEWAY`
  // chỉ do hệ thống tự sinh, chặn cả ở tầng API (tech-lead review Phase 4.2 R1 "nên sửa" #2).
  if (input.method === 'OFFSET' || input.method === 'ONLINE_GATEWAY') {
    throw new Error('Phương thức này chỉ do hệ thống tự sinh (cấn trừ cọc / webhook SePay) — không ghi nhận thủ công')
  }
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const now = new Date().toISOString()
    const isCash = input.method === 'CASH'
    // F4 (PAYMENT-PLAN.md §10.1/§10.6) — CASH + OUT phải kiểm số dư quỹ trước khi cho ghi (PM-BR-11).
    if (isCash && input.direction === 'OUT') {
      const drawerId = cashDrawerIdOf(actor.userId)
      const submissions = readAllCashDrawerSubmissions()
      const { balance } = calcCashDrawerBalance(drawerId, txns, submissions)
      if (balance < input.amount) {
        throw new Error('Số dư quỹ tiền mặt không đủ để chi (PM-BR-11)')
      }
    }
    const txn: Transaction = {
      id: generateId('txn'),
      code: nextSequenceCode('GD', txns.map((t) => t.code)),
      type: 'ADJUSTMENT',
      direction: input.direction,
      amount: input.amount,
      method: input.method,
      status: isCash ? 'CONFIRMED' : 'PENDING',
      customerId: input.customerId,
      rentalId: input.rentalId,
      reason,
      cashDrawerId: isCash ? cashDrawerIdOf(actor.userId) : undefined,
      cashDrawerOwnerName: isCash ? actor.fullName : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.fullName,
      performedAt: now,
      confirmedByName: isCash ? actor.fullName : undefined,
      confirmedAt: isCash ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    writeAllTransactions([...txns, txn])
    appendAudit({
      action: 'CREATE_PAYMENT_ADJUSTMENT',
      entity: 'Transaction',
      entityId: txn.id,
      summary: `Tạo điều chỉnh ${input.direction} ${input.amount.toLocaleString('vi-VN')}đ: ${reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: txn,
    })
    if (input.rentalId) syncFinanceAfterPaymentChange(input.rentalId, actor, now)
    return txn
  })
}

/** BRD §18, UC-PM-16, AC-PM-014 — chỉ `CONFIRMED`, chưa có biên lai. */
export async function issueReceipt(transactionId: string, actor: ActorInfo): Promise<Transaction> {
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === transactionId)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'CONFIRMED') throw new Error('Chỉ xuất biên lai cho giao dịch đã xác nhận')
    if (before.receipt) throw new Error('Giao dịch đã có biên lai')
    const now = new Date().toISOString()
    // TODO(OQ: Payment-BRD.md §27 Q16 — mẫu/đánh số biên lai).
    const existingReceiptNos = txns.map((t) => t.receipt?.receiptNo).filter((v): v is string => !!v)
    const receipt: Receipt = { receiptNo: nextSequenceCode('BL', existingReceiptNos), issuedByName: actor.fullName, issuedAt: now, voided: false }
    const after: Transaction = { ...before, receipt, updatedAt: now }
    writeAllTransactions(txns.map((t) => (t.id === transactionId ? after : t)))
    appendAudit({
      action: 'ISSUE_RECEIPT',
      entity: 'Transaction',
      entityId: transactionId,
      summary: `Xuất biên lai ${receipt.receiptNo} cho giao dịch ${before.code}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: receipt,
    })
    return after
  })
}

export interface SubmitCashDrawerInput {
  countedAmount: number
  varianceReason?: string
}

/**
 * BRD §14-§15, UC-PM-14, AC-PM-009, EX-06 — đếm thực tế → chênh lệch + lý do.
 * TODO(OQ: Payment-BRD.md §27 Q10-Q12 — quỹ theo ca/ngày/điểm, thủ quỹ, xử lý
 * chênh lệch chưa chốt; demo: quỹ theo người thu, nộp theo ngày, mọi người có
 * `PAYMENT.RECONCILE` nhận phiếu.)
 */
export async function submitCashDrawer(input: SubmitCashDrawerInput, actor: ActorInfo): Promise<CashDrawerSubmission> {
  if (!Number.isInteger(input.countedAmount) || input.countedAmount < 0) throw new Error('Số đếm phải là số nguyên không âm')
  return fakeRequest(() => {
    const drawerId = cashDrawerIdOf(actor.userId)
    const txns = readAllTransactions()
    const submissions = readAllCashDrawerSubmissions()
    const { balance, transactions } = calcCashDrawerBalance(drawerId, txns, submissions)
    if (transactions.length === 0) throw new Error('Quỹ hiện không có giao dịch nào chưa nộp')
    const variance = input.countedAmount - balance
    if (variance !== 0 && !input.varianceReason?.trim()) {
      throw new Error('Lý do chênh lệch là bắt buộc khi số đếm khác số hệ thống')
    }
    const now = new Date().toISOString()
    const submission: CashDrawerSubmission = {
      id: generateId('cds'),
      cashDrawerId: drawerId,
      ownerName: actor.fullName,
      transactionIds: transactions.map((t) => t.id),
      systemAmount: balance,
      countedAmount: input.countedAmount,
      variance,
      varianceReason: variance !== 0 ? input.varianceReason?.trim() : undefined,
      status: 'SUBMITTED',
      submittedAt: now,
    }
    writeAllCashDrawerSubmissions([...submissions, submission])
    appendAudit({
      action: 'SUBMIT_CASH_DRAWER',
      entity: 'CashDrawerSubmission',
      entityId: submission.id,
      summary: `Nộp quỹ ${balance.toLocaleString('vi-VN')}đ (đếm ${input.countedAmount.toLocaleString('vi-VN')}đ)`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: submission,
    })
    return submission
  })
}

/** Thủ quỹ xác nhận đã nhận — chỉ `SUBMITTED`. */
export async function receiveCashDrawerSubmission(id: string, actor: ActorInfo): Promise<CashDrawerSubmission> {
  return fakeRequest(() => {
    const submissions = readAllCashDrawerSubmissions()
    const before = submissions.find((s) => s.id === id)
    if (!before) throw new Error('Không tìm thấy phiếu nộp quỹ')
    if (before.status !== 'SUBMITTED') throw new Error('Phiếu nộp quỹ này đã được xác nhận')
    const now = new Date().toISOString()
    const after: CashDrawerSubmission = { ...before, status: 'RECEIVED', receivedByName: actor.fullName, receivedAt: now }
    writeAllCashDrawerSubmissions(submissions.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'RECEIVE_CASH_DRAWER',
      entity: 'CashDrawerSubmission',
      entityId: id,
      summary: `Xác nhận đã nhận quỹ từ ${before.ownerName}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status },
    })
    return after
  })
}

// ==== Payment (PM) — Round 2, PAYMENT-PLAN.md §10.7 ====

export interface CreateRefundTransactionInput {
  amount: number
  method: PaymentMethod
  refundRecipient: string
  reference?: string
  evidenceNote?: string
}

/**
 * UC-PM-07, PM-BR-08/12/13 — tạo giao dịch hoàn `OUT` luôn ở `PENDING` (kể cả
 * `CASH` — §10.2 điểm 5), bắt buộc thông tin người nhận. Vượt ngưỡng
 * (`refundNeedsApproval`) → gắn `approval.status = 'PENDING_APPROVAL'`
 * (PM-BR-12); chưa gắn quỹ (gắn lúc `confirmTransaction` xác nhận đã chi).
 */
export async function createRefundTransaction(requestId: string, input: CreateRefundTransactionInput, actor: ActorInfo): Promise<Transaction> {
  if (input.method !== 'CASH' && input.method !== 'BANK_TRANSFER' && input.method !== 'E_WALLET') {
    throw new Error('Phương thức hoàn không hợp lệ')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương (PM-BR-20)')
  const refundRecipient = input.refundRecipient.trim()
  if (refundRecipient.length < 3) throw new Error('Thông tin nhận tiền là bắt buộc (PM-BR-13)')
  if ((input.method === 'BANK_TRANSFER' || input.method === 'E_WALLET') && !input.reference?.trim()) {
    throw new Error('Mã tham chiếu là bắt buộc với chuyển khoản/ví')
  }
  const requestFound = readAllPaymentRequests().find((r) => r.id === requestId)
  if (!requestFound) throw new Error('Không tìm thấy yêu cầu thanh toán')
  // Lệnh chi trả chủ xe có đường riêng (`createOwnerPayout`) — không đi qua đường hoàn tiền của khách.
  const requestPre = asRentalRequest(requestFound)
  if (requestPre.purpose !== 'REFUND') throw new Error('Chỉ tạo giao dịch hoàn cho yêu cầu hoàn tiền')
  const settlement = (await listSettlements({ rentalId: requestPre.rentalId }))[0]
  let psc: PostSettlementCharge | undefined
  let pscOnHold = false
  if (requestPre.source === 'POST_SETTLEMENT_CHARGE' && requestPre.postSettlementChargeId) {
    psc = (await listPostSettlementCharges({ rentalId: requestPre.rentalId })).find((p) => p.id === requestPre.postSettlementChargeId)
    if (psc) pscOnHold = isPscOnHold(psc, await listIncidents({ rentalId: requestPre.rentalId }))
  }

  return fakeRequest(() => {
    // N1 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.7, tech-lead review Phase 4.2
    // R2 — sửa điểm nên sửa #2) — đọc lại Rental TRONG callback, không dùng
    // bản đọc trước độ trễ giả lập, để guard `isRequestActionable` luôn dựa
    // trên trạng thái mới nhất.
    const rental = readRentalOrThrow(requestPre.rentalId)
    const prList = readAllPaymentRequests()
    const requestRaw = prList.find((r) => r.id === requestId)
    if (!requestRaw) throw new Error('Không tìm thấy yêu cầu thanh toán')
    const request = asRentalRequest(requestRaw)
    if (!isRequestActionable(request, rental, { settlementStatus: settlement?.status, psc, pscOnHold })) {
      throw new Error('Yêu cầu thanh toán này không còn ở trạng thái cho phép tạo giao dịch hoàn')
    }
    const txns = readAllTransactions()
    const { remaining, pending } = calcRequestProgress(request, txns)
    // §10.2 điểm 7 — không cho tạo hai lệnh hoàn song song cho cùng một yêu cầu.
    const available = remaining - pending
    if (input.amount > available) {
      throw new Error(`Số tiền hoàn (${input.amount.toLocaleString('vi-VN')}đ) vượt số còn có thể hoàn (${available.toLocaleString('vi-VN')}đ)`)
    }
    if (request.transactionType === 'DEPOSIT_REFUND') {
      const held = calcLedgerDepositHeld(request.rentalId, txns)
      const pendingDepositRefund = txns
        .filter((t) => t.status === 'PENDING' && t.type === 'DEPOSIT_REFUND' && t.rentalId === request.rentalId)
        .reduce((sum, t) => sum + t.amount, 0)
      if (input.amount > held - pendingDepositRefund) {
        throw new Error('Số tiền hoàn cọc vượt cọc đang giữ trên sổ giao dịch (PM-BR-08)')
      }
    }
    const now = new Date().toISOString()
    const needsApproval = refundNeedsApproval(input.amount)
    const txn: Transaction = {
      id: generateId('txn'),
      code: nextSequenceCode('GD', txns.map((t) => t.code)),
      type: request.transactionType,
      direction: 'OUT',
      amount: input.amount,
      method: input.method,
      status: 'PENDING',
      customerId: request.customerId,
      rentalId: request.rentalId,
      paymentRequestId: request.id,
      settlementId: request.settlementId,
      reference: input.reference?.trim() || undefined,
      evidenceNote: input.evidenceNote?.trim() || undefined,
      refundRecipient,
      approval: needsApproval ? { status: 'PENDING_APPROVAL' } : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.fullName,
      performedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    writeAllTransactions([...txns, txn])
    appendAudit({
      action: 'CREATE_TRANSACTION',
      entity: 'Transaction',
      entityId: txn.id,
      summary: `Tạo giao dịch hoàn ${txn.amount.toLocaleString('vi-VN')}đ cho yêu cầu ${request.id}${needsApproval ? ' — chờ duyệt' : ''}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: txn,
    })
    syncFinanceAfterPaymentChange(request.rentalId, actor, now)
    return txn
  })
}

export interface DecideRefundApprovalInput {
  decision: 'APPROVED' | 'REJECTED'
  note?: string
}

/** UC-PM-09 bước 4, PM-BR-12 — duyệt/từ chối hoàn tiền vượt ngưỡng. */
export async function decideRefundApproval(transactionId: string, input: DecideRefundApprovalInput, actor: ActorInfo): Promise<Transaction> {
  if (input.decision === 'REJECTED' && (!input.note || input.note.trim().length < 3)) {
    throw new Error('Lý do từ chối là bắt buộc (tối thiểu 3 ký tự)')
  }
  return fakeRequest(() => {
    const txns = readAllTransactions()
    const before = txns.find((t) => t.id === transactionId)
    if (!before) throw new Error('Không tìm thấy giao dịch')
    if (before.status !== 'PENDING' || before.approval?.status !== 'PENDING_APPROVAL') {
      throw new Error('Giao dịch này không ở trạng thái chờ duyệt')
    }
    const now = new Date().toISOString()
    const after: Transaction =
      input.decision === 'REJECTED'
        ? {
            ...before,
            status: 'VOIDED',
            voidReason: input.note,
            voidedByName: actor.fullName,
            voidedAt: now,
            approval: { status: 'REJECTED', decidedByName: actor.fullName, decidedAt: now, note: input.note },
            updatedAt: now,
          }
        : {
            ...before,
            approval: { status: 'APPROVED', decidedByName: actor.fullName, decidedAt: now, note: input.note },
            updatedAt: now,
          }
    writeAllTransactions(txns.map((t) => (t.id === transactionId ? after : t)))
    appendAudit({
      action: input.decision === 'REJECTED' ? 'REJECT_REFUND' : 'APPROVE_REFUND',
      entity: 'Transaction',
      entityId: transactionId,
      summary: input.decision === 'REJECTED' ? `Từ chối hoàn giao dịch ${before.code}: ${input.note}` : `Duyệt hoàn giao dịch ${before.code}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status, approval: before.approval },
      after: { status: after.status, approval: after.approval },
    })
    if (before.rentalId) syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    return after
  })
}

// ==== Chi trả chủ xe ký gửi (UC-VC-09, PM-BR-16/24) ====

export interface CreateOwnerPayoutInput {
  reference?: string
  note?: string
}

/**
 * Tạo lệnh chi cho một khoản chi trả chủ xe: `PaymentRequest` (`CONSIGNMENT`/`PAYOUT`) + `Transaction` `OWNER_PAYOUT`
 * `OUT` `PENDING` bằng chuyển khoản, rồi gắn liên kết vào khoản chi trả — tất cả trong cùng một callback. Số tiền = `amountPayable`
 * (không sửa tay); điều kiện tạo xem `getOwnerPayoutBlocker` (VC-BR-10). Giao dịch không gắn khách / lượt thuê / quỹ tiền mặt.
 * TODO(OQ: Payment-BRD.md §27 Q24 — phương thức chi trả chủ xe chưa chốt; demo chỉ chuyển khoản, nhập tay xác nhận)
 */
export async function createOwnerPayout(recordId: string, input: CreateOwnerPayoutInput, actor: ActorInfo): Promise<Transaction> {
  return fakeRequest(() => {
    const record = (readJson<OwnerPayoutRecord[]>(OWNER_PAYOUT_RECORDS_STORAGE_KEY) ?? []).find((r) => r.id === recordId)
    if (!record) throw new Error(vi.finance.ownerPayout.errRecordNotFound)
    const owner = (readJson<VehicleOwner[]>(VEHICLE_OWNERS_STORAGE_KEY) ?? []).find((o) => o.id === record.ownerId)
    const contract = (readJson<ConsignmentContract[]>(CONSIGNMENT_CONTRACTS_STORAGE_KEY) ?? []).find((c) => c.id === record.contractId)
    const blocker = getOwnerPayoutBlocker(record, owner)
    if (blocker) throw new Error(blocker)
    if (!owner?.bankAccount) throw new Error(vi.finance.ownerPayout.errNoRecipient)
    const requests = readAllPaymentRequests()
    if (requests.some((r) => r.ownerPayoutRecordId === record.id && r.status !== 'CANCELLED')) {
      throw new Error(vi.finance.ownerPayout.errAlreadyHasRequest)
    }

    const now = new Date().toISOString()
    const txns = readAllTransactions()
    const [year, month] = record.period.split('-')
    const request: PaymentRequest = {
      id: generateId('prq'),
      source: 'CONSIGNMENT',
      purpose: 'PAYOUT',
      transactionType: 'OWNER_PAYOUT',
      expectedAmount: record.amountPayable,
      status: 'OPEN',
      vehicleOwnerId: record.ownerId,
      ownerPayoutRecordId: record.id,
      vehicleId: record.vehicleId,
      consignmentContractId: record.contractId,
      note: vi.finance.ownerPayout.requestNote(`${month}/${year}`, contract?.contractNo ?? record.contractId),
      createdByName: actor.fullName,
      createdAt: now,
      updatedAt: now,
    }
    const txn: Transaction = {
      id: generateId('txn'),
      code: nextSequenceCode('GD', txns.map((t) => t.code)),
      type: 'OWNER_PAYOUT',
      direction: 'OUT',
      amount: record.amountPayable,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      vehicleOwnerId: record.ownerId,
      ownerPayoutRecordId: record.id,
      vehicleId: record.vehicleId,
      // Chỉ lưu dạng đã che — số tài khoản đầy đủ không đi vào sổ giao dịch hay nhật ký.
      payoutRecipient: `${maskAccountNumber(owner.bankAccount.accountNumber)} — ${owner.bankAccount.bankName} — ${owner.bankAccount.accountHolder}`,
      paymentRequestId: request.id,
      reference: input.reference?.trim() || undefined,
      evidenceNote: input.note?.trim() || undefined,
      performedByUserId: actor.userId,
      performedByName: actor.fullName,
      performedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    writeAllPaymentRequests([...requests, request])
    writeAllTransactions([...txns, txn])
    linkOwnerPayoutRecord(record.id, { paymentRequestId: request.id, transactionId: txn.id, transactionCode: txn.code }, actor, now)
    appendAudit({
      action: 'CREATE_OWNER_PAYOUT',
      entity: 'Transaction',
      entityId: txn.id,
      summary: vi.finance.ownerPayout.auditCreate(txn.code, record.code, formatVnd(txn.amount)),
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: txn,
    })
    return txn
  })
}
