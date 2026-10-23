// Payment (PM) — đường ghi hệ thống vào sổ giao dịch (không phải API cho UI) — docs/FINANCE-REFACTOR-PLAN.md §3.2.
import { markOwnerPayoutRecordPaid, revertOwnerPayoutRecordPaid, unlinkOwnerPayoutRecord } from '@/features/consignment'
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { readJson } from '@/shared/lib/storage'
import {
  readAllPaymentRequests,
  readAllPsc,
  readAllSettlements as readAll,
  readAllTransactions,
  writeAllPaymentRequests,
  writeAllPsc,
  writeAllSettlements as writeAll,
  writeAllTransactions,
} from '../core/storage.ts'
import type { ActorInfo, Settlement } from '../core/types.ts'
import {
  buildOffsetTransaction,
  calcDepositHeld,
  calcLedgerDepositHeld,
  calcPaidToDate,
  deriveRentalPaymentSummary,
  deriveRequestStatus,
  findEffectiveOffset,
  isEffectiveTransaction,
  nextSequenceCode,
} from './model.ts'

/**
 * PAYMENT-PLAN.md §10.4 — helper ghi ngược DUY NHẤT, thay `syncRequestStatus`
 * (Round 1). Gọi ở CUỐI mọi callback ghi có thể làm đổi số liệu của Rental,
 * SAU khi đã ghi `transactions`/`paymentRequests`. Đọc storage MỚI NHẤT (không
 * nhận mảng từ caller) để tránh đọc lệch.
 */
export function syncFinanceAfterPaymentChange(rentalId: string, actor: ActorInfo, now: string): { settlementPaymentStatus?: Settlement['paymentStatus']; closedPscIds: string[] } {
  const allTxns = readAllTransactions()
  const prList = readAllPaymentRequests()
  const rentalRequests = prList.filter((r) => r.rentalId === rentalId)

  // 1) Tính lại `status` mọi PaymentRequest của rentalId — chỉ ghi lại khi có đổi.
  let changed = false
  const updatedPrList = prList.map((r) => {
    if (r.rentalId !== rentalId) return r
    if (r.status === 'CANCELLED') return r
    const newStatus = deriveRequestStatus(r, allTxns)
    if (newStatus === r.status) return r
    changed = true
    return { ...r, status: newStatus, updatedAt: now }
  })
  if (changed) writeAllPaymentRequests(updatedPrList)
  const freshRequests = changed ? updatedPrList : prList

  // 2) Ghi ngược Settlement.
  let settlementPaymentStatus: Settlement['paymentStatus']
  const settlements = readAll()
  const settlement = settlements.find((s) => s.rentalId === rentalId)
  if (settlement) {
    const rental = (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []).find((r) => r.id === rentalId)
    if (rental) {
      let updatedSettlement: Settlement | undefined
      if (settlement.status === 'DRAFT') {
        const freshPaidToDate = calcPaidToDate(rental, freshRequests, allTxns)
        const freshDepositHeld = calcDepositHeld(rental, freshRequests, allTxns)
        const paidToDateChanged =
          freshPaidToDate.prepayment !== settlement.paidToDate.prepayment || freshPaidToDate.handoverPayment !== settlement.paidToDate.handoverPayment
        const depositHeldChanged = freshDepositHeld !== settlement.depositHeld
        if (paidToDateChanged || depositHeldChanged || settlement.paymentStatus !== undefined) {
          updatedSettlement = {
            ...settlement,
            paidToDate: freshPaidToDate,
            depositHeld: freshDepositHeld,
            // §10.2 điểm 3 — nếu số liệu đổi, xoá đối trừ cọc cũ (giống `resyncSettlementSources`).
            depositReconciliation: paidToDateChanged || depositHeldChanged ? undefined : settlement.depositReconciliation,
            paymentStatus: undefined,
            updatedAt: now,
          }
        }
      } else if (settlement.status === 'CONFIRMED' || settlement.status === 'COMPLETED') {
        const summary = deriveRentalPaymentSummary(rental, freshRequests, allTxns, settlement)
        settlementPaymentStatus = summary.paymentStatus
        if (settlement.paymentStatus !== summary.paymentStatus) {
          updatedSettlement = { ...settlement, paymentStatus: summary.paymentStatus, updatedAt: now }
        }
      }
      if (updatedSettlement) {
        writeAll(settlements.map((s) => (s.id === settlement.id ? updatedSettlement! : s)))
      }
    }
  }

  // 3) Tự đóng PSC khi PaymentRequest `source = POST_SETTLEMENT_CHARGE` liên kết vừa `FULFILLED`.
  const closedPscIds: string[] = []
  const fulfilledPscRequests = rentalRequests.filter((r) => r.source === 'POST_SETTLEMENT_CHARGE' && r.postSettlementChargeId)
  if (fulfilledPscRequests.length > 0) {
    const pscs = readAllPsc()
    let pscChanged = false
    const updatedPscs = pscs.map((psc) => {
      if (psc.status !== 'OPEN') return psc
      const request = freshRequests.find((r) => r.postSettlementChargeId === psc.id)
      if (!request || request.status !== 'FULFILLED') return psc
      pscChanged = true
      closedPscIds.push(psc.id)
      const lastTxn = allTxns
        .filter((t) => t.paymentRequestId === request.id && isEffectiveTransaction(t))
        .sort((a, b) => a.performedAt.localeCompare(b.performedAt))
        .at(-1)
      return {
        ...psc,
        status: 'CLOSED' as const,
        closedByName: actor.fullName,
        closedAt: now,
        closeNote: lastTxn ? `Tất toán qua giao dịch ${lastTxn.code} của yêu cầu ${request.id}` : undefined,
      }
    })
    if (pscChanged) {
      writeAllPsc(updatedPscs)
      for (const pscId of closedPscIds) {
        const psc = updatedPscs.find((p) => p.id === pscId)
        appendAudit({
          action: 'CLOSE_POST_SETTLEMENT_CHARGE',
          entity: 'Settlement',
          entityId: psc?.settlementId ?? pscId,
          summary: `Tự động đánh dấu tất toán khoản phát sinh ${pscId} (yêu cầu thanh toán đã FULFILLED)`,
          actorUserId: actor.userId,
          actorName: actor.fullName,
          actorRole: actor.role,
          after: { status: 'CLOSED', pscId },
        })
      }
    }
  }
  // §10.4 bước 4 — PSC rớt khỏi FULFILLED (do đảo GD) mà đã CLOSED thì KHÔNG tự mở lại.
  // TODO(OQ: RS×PM — mở lại PSC khi giao dịch tất toán bị đảo, tài liệu chưa nói.)

  return { settlementPaymentStatus, closedPscIds }
}

/**
 * PAYMENT-PLAN.md §10.5 — `OFFSET` tự động, đường hệ thống riêng (không qua
 * `recordTransaction`/`createAdjustment`/`reverseTransaction`, guard chặn
 * `OFFSET` ở 3 hàm đó giữ nguyên). Gọi trong cùng callback của
 * `recordCustomerAck` (chỉ nhánh → `CONFIRMED`) và `approveSettlement`, TRƯỚC
 * khi ghi Settlement.
 */
export function applyDepositOffsetInCallback(settlement: Settlement, actor: ActorInfo, now: string): void {
  const applied = settlement.depositReconciliation?.depositApplied ?? 0
  // BRD §9 — mọi `MOTORBIKE` có `applied = 0` (không có cọc tiền để cấn trừ).
  if (applied <= 0) return
  const txns = readAllTransactions()
  if (findEffectiveOffset(settlement.id, txns)) return // đã có — chống trùng, idempotent.
  const held = calcLedgerDepositHeld(settlement.rentalId, txns)
  if (applied > held) {
    throw new Error(
      `Cọc đang giữ trên sổ giao dịch (${held.toLocaleString('vi-VN')}đ) nhỏ hơn số cấn trừ (${applied.toLocaleString('vi-VN')}đ) — rà soát giao dịch cọc trước khi chốt quyết toán (PM-BR-08)`,
    )
  }
  const code = nextSequenceCode('GD', txns.map((t) => t.code))
  const offsetTxn = buildOffsetTransaction(settlement, actor, code, now)
  writeAllTransactions([...txns, offsetTxn])
  // TODO(OQ: Payment-BRD.md §27 Q4 / RentalSettlement-BRD.md §28 Q1 — cấn trừ tự động hay cần khách
  // đồng ý; demo: tạo khi Settlement vào CONFIRMED, tức sau khi khách đã xác nhận cả gói ở
  // PENDING_CUSTOMER — khớp UC-PM-05 A2.
  appendAudit({
    action: 'OFFSET_DEPOSIT',
    entity: 'Transaction',
    entityId: offsetTxn.id,
    summary: `Cấn trừ cọc ${applied.toLocaleString('vi-VN')}đ theo quyết toán ${settlement.id} — không phải thu tiền (UC-PM-05 bước 6)`,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    after: offsetTxn,
  })
}

/**
 * UC-VC-09 / VC-BR-13 — đồng bộ khoản chi trả chủ xe (Owner Payout Record) và lệnh chi sau mỗi thay đổi của giao dịch
 * `OWNER_PAYOUT`. Gọi trong CÙNG callback `fakeRequest` của `confirm/fail/void/reverseTransaction`, SAU khi đã ghi sổ
 * giao dịch (đọc storage mới nhất, nguyên tử với giao dịch):
 * - `CONFIRMED` → lệnh chi tính lại trạng thái (`FULFILLED`), khoản chi trả `PAID`;
 * - `FAILED`/`VOIDED` → lệnh chi `CANCELLED`, khoản chi trả gỡ liên kết (vẫn `SCHEDULED`);
 * - `REVERSED` → lệnh chi `CANCELLED`, khoản chi trả `PAID` → `SCHEDULED` (chi lại bằng lệnh chi mới).
 * Mỗi khoản chi trả tối đa MỘT lệnh chi chưa huỷ nên huỷ lệnh cũ là điều kiện để tạo lệnh mới.
 */
export function syncOwnerPayoutAfterPaymentChange(transactionId: string, actor: ActorInfo, now: string): void {
  const txns = readAllTransactions()
  const txn = txns.find((t) => t.id === transactionId)
  if (!txn || txn.type !== 'OWNER_PAYOUT' || txn.reversalOfId) return
  const recordId = txn.ownerPayoutRecordId
  const requestId = txn.paymentRequestId
  if (!recordId || !requestId) return

  const requests = readAllPaymentRequests()
  const request = requests.find((r) => r.id === requestId)
  if (!request) return

  if (txn.status === 'CONFIRMED') {
    const status = deriveRequestStatus(request, txns)
    if (status !== request.status) {
      writeAllPaymentRequests(requests.map((r) => (r.id === request.id ? { ...r, status, updatedAt: now } : r)))
    }
    markOwnerPayoutRecordPaid(recordId, { transactionId: txn.id, paidAt: txn.confirmedAt ?? now }, actor, now)
    return
  }

  // Giao dịch `PENDING` hoặc trạng thái lạ không được huỷ lệnh chi / đổi khoản chi trả.
  if (txn.status !== 'FAILED' && txn.status !== 'VOIDED' && txn.status !== 'REVERSED') return

  const reason =
    txn.status === 'FAILED'
      ? vi.finance.ownerPayout.cancelReasonFailed(txn.code, txn.failReason ?? '')
      : txn.status === 'VOIDED'
        ? vi.finance.ownerPayout.cancelReasonVoided(txn.code, txn.voidReason ?? '')
        : vi.finance.ownerPayout.cancelReasonReversed(txn.code, txn.reverseReason ?? '')
  if (request.status !== 'CANCELLED') {
    writeAllPaymentRequests(
      requests.map((r) =>
        r.id === request.id
          ? { ...r, status: 'CANCELLED' as const, cancelledByName: actor.fullName, cancelledAt: now, cancelReason: reason, updatedAt: now }
          : r,
      ),
    )
  }
  if (txn.status === 'FAILED' || txn.status === 'VOIDED') {
    unlinkOwnerPayoutRecord(recordId, { transactionId: txn.id, reason }, actor, now)
  } else if (txn.status === 'REVERSED') {
    revertOwnerPayoutRecordPaid(recordId, { transactionId: txn.id, reason }, actor, now)
  }
}
