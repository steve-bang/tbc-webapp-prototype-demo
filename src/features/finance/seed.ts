// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2),
// đọc trực tiếp storage key đã export để lấy dữ liệu seed thật (tiền lệ `incidents/seed.ts`
// đọc `RETURN_RECORDS_STORAGE_KEY`).
import { RETURN_RECORDS_STORAGE_KEY, type ReturnRecord } from '@/features/handover-return'
import { INCIDENTS_STORAGE_KEY, type Incident } from '@/features/incidents'
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  CASH_DRAWER_SUBMISSIONS_STORAGE_KEY,
  PAYMENT_REQUESTS_STORAGE_KEY,
  POST_SETTLEMENT_CHARGES_STORAGE_KEY,
  SETTLEMENTS_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
} from './api'
import {
  buildOffsetTransaction,
  buildPscPaymentRequest,
  buildScheduleRequests,
  buildSettlementPaymentRequest,
  buildSourceLines,
  calcDepositHeld,
  calcDepositReconciliation,
  calcPaidToDate,
  calcSettlementTotals,
  deriveRentalPaymentSummary,
  deriveRequestStatus,
  nextSequenceCode,
  pscAmountForIncident,
  refundNeedsApproval,
  type CashDrawerSubmission,
  type DepositReconciliation,
  type PaymentRequest,
  type PostSettlementCharge,
  type Receipt,
  type Settlement,
  type SettlementLine,
  type SettlementPaymentRequest,
  type SettlementWaiver,
  type Transaction,
} from './model'

/** Mirror `dt()` của `incidents/seed.ts`/`handover-return/seed.ts` — tính ngày động từ hôm nay. */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const ACCOUNTANT = 'Lý Thị Kế Toán' // mirror vai trò ACCOUNTANT dùng ở auth demo
const MANAGER = 'Trần Thị Quản Lý'

/** `hours` giờ sau một mốc ISO — dùng để đặt `performedAt` của giao dịch tương đối theo `pickupDateTime`/`createdAt` thật của Rental (§8.2 kế hoạch). */
function hoursAfter(iso: string, hours: number): string {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + hours * 60)
  return d.toISOString()
}

// ==== Payment (PM) — PAYMENT-PLAN.md §8, Round 1 ====
// userId demo thật (`features/auth/model.ts`) — tiền lệ `employees/seed.ts`/`calendar/seed.ts`: hardcode string, không import `features/auth`.
const PM_ACCOUNTANT_USER_ID = 'usr_accountant'
const PM_ACCOUNTANT_NAME = 'Đỗ Thị Kế Toán'
const PM_STAFF_USER_ID = 'usr_staff'
const PM_STAFF_NAME = 'Hoàng Văn Nhân Viên'

/**
 * Seed sổ giao dịch + lịch thanh toán 2 mốc đầu (`BOOKING`/`HANDOVER`) —
 * `docs/PAYMENT-PLAN.md` §8.1/§8.2. Chạy TRƯỚC khối Settlement (B) trong cùng
 * `registerSeeds.ts` (chỉ import `finance/seed` nên thứ tự quyết định bởi thứ
 * tự gọi `registerSeedStep` ngay dưới đây — xem cuối file).
 */
function seedPaymentRound1(): void {
  const rentals = readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
  function rentalOrThrowP(id: string): Rental {
    const r = rentals.find((x) => x.id === id)
    if (!r) throw new Error(`finance/seed.ts (Payment): không tìm thấy Rental ${id}`)
    return r
  }

  const requests: PaymentRequest[] = []
  const transactions: Transaction[] = []

  /** Lập lịch (sinh `PaymentRequest` BOOKING/HANDOVER[+DEPOSIT]) bằng đúng hàm thuần app dùng — không gõ tay số tổng. */
  function scheduleFor(rentalId: string, actorName: string): void {
    const rental = rentalOrThrowP(rentalId)
    requests.push(...buildScheduleRequests(rental, actorName, rental.createdAt))
  }

  function findReq(rentalId: string, source: 'BOOKING' | 'HANDOVER', type: 'RENTAL_PAYMENT' | 'DEPOSIT'): PaymentRequest {
    const r = requests.find((x) => x.rentalId === rentalId && x.source === source && x.transactionType === type)
    if (!r) throw new Error(`finance/seed.ts (Payment): không tìm thấy PaymentRequest ${rentalId}/${source}/${type}`)
    return r
  }

  /** Sinh `code` tuần tự qua `nextSequenceCode` — không gõ tay (§8.2 kế hoạch). */
  function addTxn(input: Omit<Transaction, 'id' | 'code' | 'createdAt' | 'updatedAt'>): Transaction {
    const txn: Transaction = {
      ...input,
      id: generateId('txn'),
      code: nextSequenceCode('GD', transactions.map((t) => t.code)),
      createdAt: input.performedAt,
      updatedAt: input.performedAt,
    }
    transactions.push(txn)
    return txn
  }

  function issueReceiptFor(txn: Transaction, issuedAt: string): void {
    // TODO(OQ: Payment-BRD.md §27 Q16 — mẫu/đánh số biên lai).
    const receipt: Receipt = {
      receiptNo: nextSequenceCode('BL', transactions.map((t) => t.receipt?.receiptNo).filter((v): v is string => !!v)),
      issuedByName: PM_ACCOUNTANT_NAME,
      issuedAt,
      voided: false,
    }
    txn.receipt = receipt
  }

  // ---- rt_006 — CONFIRMED, CASH_20M: KHÔNG lập lịch (demo nút "Lập lịch thanh toán"). ----
  // (không gọi scheduleFor('rt_006', ...))

  // ---- rt_007 — CONFIRMED, MOTORBIKE: lịch đã lập; BOOKING có GD BANK_TRANSFER PENDING (demo Xác nhận). ----
  scheduleFor('rt_007', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_007')
    const req = findReq('rt_007', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: 'CK-0001',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
    })
  }

  // ---- rt_008–rt_011 — CONFIRMED: lịch đã lập; trộn FULFILLED (CASH) / OPEN / FAILED (EX-03) / VOIDED. ----
  scheduleFor('rt_008', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_008')
    const req = findReq('rt_008', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: hoursAfter(rental.createdAt, 3),
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: hoursAfter(rental.createdAt, 3),
    })
  }
  scheduleFor('rt_009', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_009')
    const req = findReq('rt_009', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'BANK_TRANSFER',
      status: 'FAILED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: 'CK-0002',
      failReason: 'Ngân hàng từ chối giao dịch (sai thông tin thụ hưởng) — EX-03.',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
    })
  }
  scheduleFor('rt_010', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_010')
    const req = findReq('rt_010', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'BANK_TRANSFER',
      status: 'VOIDED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: 'CK-0003',
      voidReason: 'Khách chuyển nhầm nội dung, yêu cầu huỷ để tạo lại (PM-BR-02).',
      voidedByName: PM_ACCOUNTANT_NAME,
      voidedAt: hoursAfter(rental.createdAt, 3),
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
    })
  }
  scheduleFor('rt_011', ACCOUNTANT) // OPEN thuần — không có giao dịch nào.

  // ---- rt_012–rt_013 — CONTRACT_CREATED: BOOKING FULFILLED. ----
  scheduleFor('rt_012', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_012')
    const req = findReq('rt_012', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'BANK_TRANSFER',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: 'CK-0004',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
      confirmedByName: PM_ACCOUNTANT_NAME,
      confirmedAt: hoursAfter(rental.createdAt, 2),
    })
  }
  scheduleFor('rt_013', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_013')
    const req = findReq('rt_013', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'E_WALLET',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: 'VI-0001',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
      confirmedByName: PM_ACCOUNTANT_NAME,
      confirmedAt: hoursAfter(rental.createdAt, 2),
    })
  }

  // ---- rt_014–rt_015 — READY_FOR_HANDOVER: BOOKING FULFILLED; rt_014 HANDOVER 70% PARTIALLY_FULFILLED (AC-PM-004). ----
  scheduleFor('rt_014', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_014')
    const bookingReq = findReq('rt_014', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: bookingReq.expectedAmount,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: bookingReq.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: hoursAfter(rental.createdAt, 2),
    })
    const handoverReq = findReq('rt_014', 'HANDOVER', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: 3_000_000,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: handoverReq.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: hoursAfter(rental.pickupDateTime, -2),
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: hoursAfter(rental.pickupDateTime, -2),
    })
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: handoverReq.expectedAmount - 3_000_000,
      method: 'BANK_TRANSFER',
      status: 'PENDING',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: handoverReq.id,
      reference: 'CK-0005',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.pickupDateTime, -1),
    })
  }
  scheduleFor('rt_015', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_015')
    const req = findReq('rt_015', 'BOOKING', 'RENTAL_PAYMENT')
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: hoursAfter(rental.createdAt, 2),
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: hoursAfter(rental.createdAt, 2),
    })
  }

  // ---- rt_016–rt_026 — Handover COMPLETED, cờ prepaymentConfirmed/fullPaymentConfirmed = true: tất cả FULFILLED. ----
  /** BOOKING (30%) FULFILLED bằng một giao dịch duy nhất. */
  function fulfillBooking(rentalId: string, method: 'CASH' | 'BANK_TRANSFER' | 'E_WALLET', performedAt: string, actor: { userId: string; name: string }): Transaction {
    const rental = rentalOrThrowP(rentalId)
    const req = findReq(rentalId, 'BOOKING', 'RENTAL_PAYMENT')
    return addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method,
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: method !== 'CASH' ? nextSequenceCode(method === 'BANK_TRANSFER' ? 'CK' : 'VI', transactions.map((t) => t.reference).filter((v): v is string => !!v)) : undefined,
      cashDrawerId: method === 'CASH' ? `drawer:${actor.userId}` : undefined,
      cashDrawerOwnerName: method === 'CASH' ? actor.name : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.name,
      performedAt,
      confirmedByName: actor.name,
      confirmedAt: performedAt,
    })
  }
  /** HANDOVER 70% (Tiền thuê) FULFILLED bằng một giao dịch duy nhất. */
  function fulfillHandover70(
    rentalId: string,
    method: 'CASH' | 'BANK_TRANSFER' | 'E_WALLET' | 'ONLINE_GATEWAY',
    performedAt: string,
    actor: { userId: string; name: string },
  ): Transaction {
    const rental = rentalOrThrowP(rentalId)
    const req = findReq(rentalId, 'HANDOVER', 'RENTAL_PAYMENT')
    return addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: req.expectedAmount,
      method,
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      // TODO(OQ: Payment-BRD.md §4.2 — mô hình phí SePay chưa chốt; phí = chi phí công ty → Phase 4.3 RV; Webapp không có cổng thật, CR-2026-047).
      reference: method === 'ONLINE_GATEWAY' ? `SEPAY-${rentalId}` : method !== 'CASH' ? nextSequenceCode(method === 'BANK_TRANSFER' ? 'CK' : 'VI', transactions.map((t) => t.reference).filter((v): v is string => !!v)) : undefined,
      evidenceNote: method === 'ONLINE_GATEWAY' ? 'SePay (webhook)' : undefined,
      cashDrawerId: method === 'CASH' ? `drawer:${actor.userId}` : undefined,
      cashDrawerOwnerName: method === 'CASH' ? actor.name : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.name,
      performedAt,
      confirmedByName: actor.name,
      confirmedAt: performedAt,
    })
  }
  /** HANDOVER cọc (`CASH_20M`) FULFILLED bằng một giao dịch duy nhất. */
  function fulfillDeposit(rentalId: string, method: 'CASH' | 'BANK_TRANSFER' | 'E_WALLET', performedAt: string, actor: { userId: string; name: string }): Transaction {
    const rental = rentalOrThrowP(rentalId)
    const req = findReq(rentalId, 'HANDOVER', 'DEPOSIT')
    return addTxn({
      type: 'DEPOSIT',
      direction: 'IN',
      amount: req.expectedAmount,
      method,
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: req.id,
      reference: method !== 'CASH' ? nextSequenceCode(method === 'BANK_TRANSFER' ? 'CK' : 'VI', transactions.map((t) => t.reference).filter((v): v is string => !!v)) : undefined,
      cashDrawerId: method === 'CASH' ? `drawer:${actor.userId}` : undefined,
      cashDrawerOwnerName: method === 'CASH' ? actor.name : undefined,
      performedByUserId: actor.userId,
      performedByName: actor.name,
      performedAt,
      confirmedByName: actor.name,
      confirmedAt: performedAt,
    })
  }

  const ACCOUNTANT_ACTOR = { userId: PM_ACCOUNTANT_USER_ID, name: PM_ACCOUNTANT_NAME }
  const STAFF_ACTOR = { userId: PM_STAFF_USER_ID, name: PM_STAFF_NAME }

  // rt_016 — CASH_20M. BOOKING CASH hôm nay (nhóm A — Quỹ Accountant, AC-PM-009).
  scheduleFor('rt_016', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_016')
    const booking = fulfillBooking('rt_016', 'CASH', dt(0, 9), ACCOUNTANT_ACTOR)
    issueReceiptFor(booking, dt(0, 9))
    fulfillHandover70('rt_016', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -2), ACCOUNTANT_ACTOR)
    fulfillDeposit('rt_016', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_017 — CASH_20M. BOOKING CASH hôm nay (nhóm A); HANDOVER 70% qua SePay (webhook).
  scheduleFor('rt_017', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_017')
    fulfillBooking('rt_017', 'CASH', dt(0, 10), ACCOUNTANT_ACTOR)
    const handover70 = fulfillHandover70('rt_017', 'ONLINE_GATEWAY', hoursAfter(rental.pickupDateTime, -3), ACCOUNTANT_ACTOR)
    issueReceiptFor(handover70, hoursAfter(rental.pickupDateTime, -3))
    fulfillDeposit('rt_017', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_018 — CASH_20M. HANDOVER 70% chia 2 lần: CASH một phần hôm nay (nhóm A) + BANK_TRANSFER phần còn lại.
  scheduleFor('rt_018', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_018')
    fulfillBooking('rt_018', 'E_WALLET', hoursAfter(rental.createdAt, 2), ACCOUNTANT_ACTOR)
    const handoverReq = findReq('rt_018', 'HANDOVER', 'RENTAL_PAYMENT')
    const part1 = addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: 1_200_000,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: handoverReq.id,
      cashDrawerId: `drawer:${PM_ACCOUNTANT_USER_ID}`,
      cashDrawerOwnerName: PM_ACCOUNTANT_NAME,
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: dt(0, 11),
      confirmedByName: PM_ACCOUNTANT_NAME,
      confirmedAt: dt(0, 11),
    })
    issueReceiptFor(part1, dt(0, 11))
    addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: handoverReq.expectedAmount - 1_200_000,
      method: 'BANK_TRANSFER',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: handoverReq.id,
      reference: 'CK-0006',
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: hoursAfter(rental.pickupDateTime, -1),
      confirmedByName: PM_ACCOUNTANT_NAME,
      confirmedAt: hoursAfter(rental.pickupDateTime, -1),
    })
    fulfillDeposit('rt_018', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_019 — MOTORBIKE (không cọc).
  scheduleFor('rt_019', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_019')
    fulfillBooking('rt_019', 'BANK_TRANSFER', hoursAfter(rental.createdAt, 2), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_019', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_020 — CASH_20M. BOOKING CASH 5 ngày trước (nhóm B — phiếu RECEIVED có chênh lệch, AC-PM-009).
  scheduleFor('rt_020', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_020')
    fulfillBooking('rt_020', 'CASH', dt(-5, 9), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_020', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
    fulfillDeposit('rt_020', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_021 — MOTORBIKE. BOOKING CASH 5 ngày trước (nhóm B); HANDOVER 70% qua SePay (webhook).
  scheduleFor('rt_021', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_021')
    fulfillBooking('rt_021', 'CASH', dt(-5, 10), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_021', 'ONLINE_GATEWAY', hoursAfter(rental.pickupDateTime, -2), ACCOUNTANT_ACTOR)
  }

  // rt_022 — CASH_20M. BOOKING CASH 4 ngày trước (nhóm C — quỹ Staff, phiếu SUBMITTED chờ nhận).
  scheduleFor('rt_022', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_022')
    fulfillBooking('rt_022', 'CASH', dt(-4, 9), STAFF_ACTOR)
    fulfillHandover70('rt_022', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
    fulfillDeposit('rt_022', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_023 — MOTORBIKE.
  scheduleFor('rt_023', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_023')
    fulfillBooking('rt_023', 'BANK_TRANSFER', hoursAfter(rental.createdAt, 2), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_023', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_024 — CASH_20M, COMPLETED.
  scheduleFor('rt_024', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_024')
    fulfillBooking('rt_024', 'BANK_TRANSFER', hoursAfter(rental.createdAt, 2), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_024', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
    fulfillDeposit('rt_024', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_025 — CASH_20M, COMPLETED. BOOKING = cặp đảo (AC-PM-008): GD CASH sai số REVERSED + đối ứng + GD đúng.
  scheduleFor('rt_025', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_025')
    const bookingReq = findReq('rt_025', 'BOOKING', 'RENTAL_PAYMENT')
    const wrongAt = hoursAfter(rental.createdAt, 2)
    const reversalAt = hoursAfter(rental.createdAt, 2.25)
    const correctAt = hoursAfter(rental.createdAt, 2.5)
    const txnWrong = addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: bookingReq.expectedAmount + 50_000, // thu nhầm số tiền
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: bookingReq.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: wrongAt,
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: wrongAt,
    })
    issueReceiptFor(txnWrong, wrongAt)
    const reverseReason = 'Thu nhầm số tiền do đọc sai mệnh giá tiền mặt, đảo để ghi lại đúng số (AC-PM-008).'
    const txnReversal = addTxn({
      type: txnWrong.type,
      direction: 'OUT',
      amount: txnWrong.amount,
      method: txnWrong.method,
      status: 'CONFIRMED',
      customerId: txnWrong.customerId,
      rentalId: txnWrong.rentalId,
      paymentRequestId: txnWrong.paymentRequestId,
      reversalOfId: txnWrong.id,
      reverseReason,
      cashDrawerId: txnWrong.cashDrawerId,
      cashDrawerOwnerName: txnWrong.cashDrawerOwnerName,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: reversalAt,
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: reversalAt,
    })
    // PM-BR-19 — vô hiệu biên lai gốc + liên kết 2 chiều (mirror `reverseTransaction`).
    txnWrong.status = 'REVERSED'
    txnWrong.reversedById = txnReversal.id
    txnWrong.reverseReason = reverseReason
    if (txnWrong.receipt) txnWrong.receipt.voided = true
    const txnCorrect = addTxn({
      type: 'RENTAL_PAYMENT',
      direction: 'IN',
      amount: bookingReq.expectedAmount,
      method: 'CASH',
      status: 'CONFIRMED',
      customerId: rental.customerId,
      rentalId: rental.id,
      paymentRequestId: bookingReq.id,
      cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
      cashDrawerOwnerName: PM_STAFF_NAME,
      performedByUserId: PM_STAFF_USER_ID,
      performedByName: PM_STAFF_NAME,
      performedAt: correctAt,
      confirmedByName: PM_STAFF_NAME,
      confirmedAt: correctAt,
    })
    issueReceiptFor(txnCorrect, correctAt)
    fulfillHandover70('rt_025', 'BANK_TRANSFER', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
    fulfillDeposit('rt_025', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // rt_026 — MOTORBIKE, COMPLETED.
  scheduleFor('rt_026', ACCOUNTANT)
  {
    const rental = rentalOrThrowP('rt_026')
    fulfillBooking('rt_026', 'BANK_TRANSFER', hoursAfter(rental.createdAt, 2), ACCOUNTANT_ACTOR)
    fulfillHandover70('rt_026', 'E_WALLET', hoursAfter(rental.pickupDateTime, -1), ACCOUNTANT_ACTOR)
  }

  // ---- rt_027–rt_029 — CANCELLED/NO_SHOW/DISPUTED: không có yêu cầu/giao dịch (hoàn khi huỷ = ngoài phạm vi). ----

  // ---- 1 giao dịch ADJUSTMENT (IN, lý do "chênh lệch làm tròn…") — PM-BR-18.
  // Method BANK_TRANSFER (không CASH) để không ảnh hưởng số dư quỹ tiền mặt đang demo ở trên. ----
  addTxn({
    type: 'ADJUSTMENT',
    direction: 'IN',
    amount: 15_000,
    method: 'BANK_TRANSFER',
    status: 'CONFIRMED',
    customerId: rentalOrThrowP('rt_006').customerId,
    reason: 'Chênh lệch làm tròn khi thu tiền thuê qua chuyển khoản, khách đồng ý giữ nguyên.',
    reference: 'CK-0099',
    performedByUserId: PM_ACCOUNTANT_USER_ID,
    performedByName: PM_ACCOUNTANT_NAME,
    performedAt: dt(-40, 9),
    confirmedByName: PM_ACCOUNTANT_NAME,
    confirmedAt: dt(-40, 9),
  })

  // ---- Đồng bộ `PaymentRequest.status` bằng `deriveRequestStatus` — không gõ tay (§8.2 kế hoạch). ----
  const now = new Date().toISOString()
  const finalRequests = requests.map((r) => ({ ...r, status: deriveRequestStatus(r, transactions), updatedAt: now }))
  writeJson(PAYMENT_REQUESTS_STORAGE_KEY, finalRequests)
  writeJson(TRANSACTIONS_STORAGE_KEY, transactions)

  // ---- Quỹ tiền mặt — 2 quỹ (Accountant + Staff), 3 trường hợp phiếu nộp (§8.2 kế hoạch). ----
  // Nhóm A (Accountant, hôm nay, chưa nộp) — cố ý KHÔNG tạo phiếu, để lại cho demo "Nộp quỹ".
  // Nhóm B — 2 GD BOOKING CASH của rt_020/rt_021 (5 ngày trước) → phiếu RECEIVED có chênh lệch -200.000.
  const groupBTxnIds = transactions.filter((t) => t.cashDrawerId === `drawer:${PM_ACCOUNTANT_USER_ID}` && (t.rentalId === 'rt_020' || t.rentalId === 'rt_021')).map((t) => t.id)
  const groupBSystemAmount = transactions.filter((t) => groupBTxnIds.includes(t.id)).reduce((sum, t) => sum + (t.direction === 'IN' ? t.amount : -t.amount), 0)
  const submissionReceived: CashDrawerSubmission = {
    id: generateId('cds'),
    cashDrawerId: `drawer:${PM_ACCOUNTANT_USER_ID}`,
    ownerName: PM_ACCOUNTANT_NAME,
    transactionIds: groupBTxnIds,
    systemAmount: groupBSystemAmount,
    countedAmount: groupBSystemAmount - 200_000,
    variance: -200_000,
    varianceReason: 'Thiếu tiền mặt khi đếm lại so với sổ giao dịch, đã lập biên bản nội bộ.',
    status: 'RECEIVED',
    submittedAt: dt(-1, 17),
    receivedByName: MANAGER,
    receivedAt: dt(-1, 18),
  }
  // Nhóm C (Staff, rt_022 BOOKING CASH 4 ngày trước) → phiếu SUBMITTED chờ nhận.
  const groupCTxnIds = transactions.filter((t) => t.cashDrawerId === `drawer:${PM_STAFF_USER_ID}` && t.rentalId === 'rt_022').map((t) => t.id)
  const groupCSystemAmount = transactions.filter((t) => groupCTxnIds.includes(t.id)).reduce((sum, t) => sum + (t.direction === 'IN' ? t.amount : -t.amount), 0)
  const submissionPending: CashDrawerSubmission = {
    id: generateId('cds'),
    cashDrawerId: `drawer:${PM_STAFF_USER_ID}`,
    ownerName: PM_STAFF_NAME,
    transactionIds: groupCTxnIds,
    systemAmount: groupCSystemAmount,
    countedAmount: groupCSystemAmount,
    variance: 0,
    status: 'SUBMITTED',
    submittedAt: dt(-1, 10),
  }
  writeJson(CASH_DRAWER_SUBMISSIONS_STORAGE_KEY, [submissionReceived, submissionPending])
}

/** Chốt mọi dòng `DRAFT` thành `CONFIRMED` với `actualAmount = estimatedAmount` — demo "đã xử lý xong". */
function confirmAllLines(lines: SettlementLine[], confirmedAt: string): SettlementLine[] {
  return lines.map((line) =>
    line.status === 'DRAFT'
      ? { ...line, status: 'CONFIRMED' as const, actualAmount: line.estimatedAmount ?? 0, confirmedByName: ACCOUNTANT, confirmedAt }
      : line,
  )
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §7 — seed 5 Settlement dựng bằng chính các
 * hàm thuần (`buildSourceLines`/`calcSettlementTotals`/`calcDepositReconciliation`),
 * không gõ tay số tổng (tiền lệ `handover-return/seed.ts`). `rt_020`/`rt_021`
 * KHÔNG seed (demo "Mở quyết toán" + EX-01 từ UI).
 */
function seedFinance(): void {
  const rentals = readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
  const returns = readJson<ReturnRecord[]>(RETURN_RECORDS_STORAGE_KEY) ?? []
  const incidents = readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? []
  // §8.1 kế hoạch — A (seedPaymentRound1) chạy TRƯỚC B (seedFinance) nên đọc được PaymentRequest/Transaction thật.
  const paymentRequests = readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
  const transactions = readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []

  function rentalOrThrow(id: string): Rental {
    const r = rentals.find((x) => x.id === id)
    if (!r) throw new Error(`finance/seed.ts: không tìm thấy Rental ${id}`)
    return r
  }
  function completedReturnOf(rentalId: string): ReturnRecord | undefined {
    return returns.find((r) => r.rentalId === rentalId && r.status === 'COMPLETED')
  }
  function incidentsOf(rentalId: string): Incident[] {
    return incidents.filter((i) => i.rentalId === rentalId)
  }
  function incidentOrThrow(id: string): Incident {
    const i = incidents.find((x) => x.id === id)
    if (!i) throw new Error(`finance/seed.ts: không tìm thấy Incident ${id}`)
    return i
  }

  const settlementsToSeed: Settlement[] = []

  // ---- rt_022 — DRAFT: dòng RENTAL CONFIRMED, 2 dòng DRAFT (FUEL_DEFICIT + inc_008), chưa đối trừ cọc. ----
  {
    const rentalId = 'rt_022'
    const rental = rentalOrThrow(rentalId)
    const returnRecord = completedReturnOf(rentalId)
    const openedAt = dt(-2, 10)
    const settlement: Settlement = {
      id: 'stl_022',
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'DRAFT',
      lines: buildSourceLines({ rental, returnRecord, incidents: incidentsOf(rentalId) }),
      waivers: [],
      securityDepositType: rental.securityDepositType,
      paidToDate: calcPaidToDate(rental, paymentRequests, transactions),
      depositHeld: calcDepositHeld(rental, paymentRequests, transactions),
      paymentRequests: [],
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: openedAt,
    }
    settlementsToSeed.push(settlement)
  }

  // ---- rt_023 — WAITING_APPROVAL: mọi dòng CONFIRMED, 1 GOODWILL_CREDIT 300k PENDING_APPROVAL
  //      (mirror AC-RS-006), đã đối trừ cọc (Held 0, MOTORBIKE), có customerAck. ----
  {
    const rentalId = 'rt_023'
    const rental = rentalOrThrow(rentalId)
    const returnRecord = completedReturnOf(rentalId)
    const openedAt = dt(-8, 10)
    const confirmedAt = dt(-7, 11)
    const lines = confirmAllLines(buildSourceLines({ rental, returnRecord, incidents: incidentsOf(rentalId) }), confirmedAt)
    const waiver: SettlementWaiver = {
      id: generateId('wvr'),
      type: 'GOODWILL_CREDIT',
      amount: 300_000,
      reason: 'Khách là khách quen, tặng thiện chí do chờ xe hơi lâu lúc giao xe.',
      status: 'PENDING_APPROVAL',
      requestedByName: ACCOUNTANT,
      requestedByRole: 'ACCOUNTANT',
      requestedAt: dt(-7, 14),
    }
    const paidToDate = calcPaidToDate(rental, paymentRequests, transactions)
    const depositHeld = calcDepositHeld(rental, paymentRequests, transactions)
    const totals = calcSettlementTotals(lines, [waiver])
    const reconciliation: DepositReconciliation = {
      ...calcDepositReconciliation(totals.finalAmount, paidToDate.prepayment + paidToDate.handoverPayment, depositHeld),
      reconciledByName: ACCOUNTANT,
      reconciledAt: dt(-7, 15),
    }
    const settlement: Settlement = {
      id: 'stl_023',
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'WAITING_APPROVAL',
      lines,
      waivers: [waiver],
      securityDepositType: rental.securityDepositType,
      paidToDate,
      depositHeld,
      depositReconciliation: reconciliation,
      customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-7, 16), note: 'Khách đồng ý toàn bộ bảng quyết toán qua Zalo.' },
      paymentRequests: [],
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: dt(-7, 16),
    }
    settlementsToSeed.push(settlement)
  }

  // ---- rt_024 — COMPLETED: đủ dòng, đối trừ một phần cọc, yêu cầu DEPOSIT_REFUND, REFUND_PENDING. ----
  {
    const rentalId = 'rt_024'
    const rental = rentalOrThrow(rentalId)
    const returnRecord = completedReturnOf(rentalId)
    const openedAt = dt(-18, 10)
    const confirmedAt = dt(-17, 11)
    const lines = confirmAllLines(buildSourceLines({ rental, returnRecord, incidents: incidentsOf(rentalId) }), confirmedAt)
    const paidToDate = calcPaidToDate(rental, paymentRequests, transactions)
    const depositHeld = calcDepositHeld(rental, paymentRequests, transactions)
    const totals = calcSettlementTotals(lines, [])
    const reconciliation: DepositReconciliation = {
      ...calcDepositReconciliation(totals.finalAmount, paidToDate.prepayment + paidToDate.handoverPayment, depositHeld),
      reconciledByName: ACCOUNTANT,
      reconciledAt: dt(-17, 15),
    }
    const refundRequest: SettlementPaymentRequest = {
      id: generateId('pyr'),
      type: 'DEPOSIT_REFUND',
      amount: reconciliation.depositRefundable,
      status: 'REQUESTED',
      createdByName: ACCOUNTANT,
      createdAt: dt(-17, 17),
    }
    const completedAt = dt(-17, 18)
    const settlement: Settlement = {
      id: 'stl_024',
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'COMPLETED',
      lines,
      waivers: [],
      securityDepositType: rental.securityDepositType,
      paidToDate,
      depositHeld,
      depositReconciliation: reconciliation,
      customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-17, 16) },
      approval: undefined,
      paymentRequests: [refundRequest],
      paymentStatus: 'REFUND_PENDING',
      completedWithDebt: false,
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push(settlement)
  }

  // ---- rt_025 — COMPLETED: có 1 PARTIAL_DISCOUNT ≤ ngưỡng, APPROVED; yêu cầu DEPOSIT_REFUND. ----
  {
    const rentalId = 'rt_025'
    const rental = rentalOrThrow(rentalId)
    const returnRecord = completedReturnOf(rentalId)
    const openedAt = dt(-28, 10)
    const confirmedAt = dt(-27, 11)
    const lines = confirmAllLines(buildSourceLines({ rental, returnRecord, incidents: incidentsOf(rentalId) }), confirmedAt)
    const trafficFineLine = lines.find((l) => l.category === 'TRAFFIC_FINE')
    const waiver: SettlementWaiver = {
      id: generateId('wvr'),
      type: 'PARTIAL_DISCOUNT',
      lineId: trafficFineLine?.id,
      amount: 50_000,
      reason: 'Giảm một phần phạt nguội do khách chủ động báo sớm (≤ ngưỡng, Accountant tự duyệt).',
      status: 'APPROVED',
      requestedByName: ACCOUNTANT,
      requestedByRole: 'ACCOUNTANT',
      requestedAt: dt(-27, 12),
      decidedByName: ACCOUNTANT,
      decidedAt: dt(-27, 12),
    }
    const paidToDate = calcPaidToDate(rental, paymentRequests, transactions)
    const depositHeld = calcDepositHeld(rental, paymentRequests, transactions)
    const totals = calcSettlementTotals(lines, [waiver])
    const reconciliation: DepositReconciliation = {
      ...calcDepositReconciliation(totals.finalAmount, paidToDate.prepayment + paidToDate.handoverPayment, depositHeld),
      reconciledByName: ACCOUNTANT,
      reconciledAt: dt(-27, 15),
    }
    const refundRequest: SettlementPaymentRequest = {
      id: generateId('pyr'),
      type: 'DEPOSIT_REFUND',
      amount: reconciliation.depositRefundable,
      status: 'REQUESTED',
      createdByName: ACCOUNTANT,
      createdAt: dt(-27, 17),
    }
    const completedAt = dt(-27, 18)
    const settlement: Settlement = {
      id: 'stl_025',
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'COMPLETED',
      lines,
      waivers: [waiver],
      securityDepositType: rental.securityDepositType,
      paidToDate,
      depositHeld,
      depositReconciliation: reconciliation,
      customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-27, 16) },
      paymentRequests: [refundRequest],
      paymentStatus: 'REFUND_PENDING',
      completedWithDebt: false,
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push(settlement)
  }

  // ---- rt_026 — COMPLETED: KHÔNG có dòng sự cố (inc_010 DISPUTED chốt sau — RS-BR-24, §7 kế hoạch);
  //      còn Balance Due → yêu cầu COLLECT, `completedWithDebt = true` (chưa qua Payment). ----
  {
    const rentalId = 'rt_026'
    const rental = rentalOrThrow(rentalId)
    const returnRecord = completedReturnOf(rentalId)
    const openedAt = dt(-13, 10)
    const confirmedAt = dt(-12, 11)
    // inc_010 (DISPUTED) CỐ Ý không truyền vào `incidents` — Settlement này đã đóng trước khi
    // sự cố bị tranh chấp lại (Round 2 sẽ thêm Post-Settlement Charge cho inc_010).
    const lines = confirmAllLines(buildSourceLines({ rental, returnRecord, incidents: [] }), confirmedAt)
    const paidToDate = calcPaidToDate(rental, paymentRequests, transactions)
    const depositHeld = calcDepositHeld(rental, paymentRequests, transactions)
    const totals = calcSettlementTotals(lines, [])
    const reconciliation: DepositReconciliation = {
      ...calcDepositReconciliation(totals.finalAmount, paidToDate.prepayment + paidToDate.handoverPayment, depositHeld),
      reconciledByName: ACCOUNTANT,
      reconciledAt: dt(-12, 15),
    }
    const collectRequest: SettlementPaymentRequest = {
      id: generateId('pyr'),
      type: 'COLLECT',
      amount: reconciliation.balanceDue,
      status: 'REQUESTED',
      createdByName: ACCOUNTANT,
      createdAt: dt(-12, 17),
    }
    const completedAt = dt(-12, 18)
    const settlement: Settlement = {
      id: 'stl_026',
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'COMPLETED',
      lines,
      waivers: [],
      securityDepositType: rental.securityDepositType,
      paidToDate,
      depositHeld,
      depositReconciliation: reconciliation,
      customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-12, 16) },
      paymentRequests: [collectRequest],
      paymentStatus: 'UNPAID',
      // TODO(OQ: RentalSettlement-BRD.md §28 Q11/Q12 — đóng lượt khi còn công nợ; demo: cho đóng vì
      // đã tạo yêu cầu thu, đánh dấu completedWithDebt, chờ Payment (Phase 4.2) xác nhận đã thu đủ.
      completedWithDebt: true,
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push(settlement)
  }

  writeJson(SETTLEMENTS_STORAGE_KEY, settlementsToSeed)

  // ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.12) — Post-Settlement Charge. ----
  // Thời điểm tạo = `completedAt` của Settlement seed tương ứng + vài ngày
  // (luôn trong quá khứ nên tự động `≤ now`).
  const pscsToSeed: PostSettlementCharge[] = [
    {
      id: 'psc_001',
      settlementId: 'stl_024',
      rentalId: 'rt_024',
      customerId: rentalOrThrow('rt_024').customerId,
      vehicleId: rentalOrThrow('rt_024').vehicleId,
      source: 'TRAFFIC_FINE',
      type: 'RECEIVABLE',
      amount: 700_000,
      reason: 'Phạt nguội vi phạm tốc độ trong kỳ thuê, biên bản về sau.',
      evidenceNote: 'Biên bản phạt nguội số BB-2026-00482 (CSGT TP.HCM).',
      status: 'OPEN',
      createdByName: ACCOUNTANT,
      createdByRole: 'ACCOUNTANT',
      createdAt: dt(-14, 10),
    },
    {
      id: 'psc_002',
      settlementId: 'stl_025',
      rentalId: 'rt_025',
      customerId: rentalOrThrow('rt_025').customerId,
      vehicleId: rentalOrThrow('rt_025').vehicleId,
      source: 'ADJUSTMENT',
      type: 'REFUND',
      amount: 200_000,
      reason: 'Tính thừa phí giao nhận, phát hiện sau khi đóng lượt.',
      status: 'CLOSED',
      createdByName: ACCOUNTANT,
      createdByRole: 'ACCOUNTANT',
      createdAt: dt(-24, 10),
      closedByName: ACCOUNTANT,
      closedAt: dt(-23, 11),
      closeNote: 'Đã hoàn qua chuyển khoản QR.',
    },
    {
      id: 'psc_003',
      settlementId: 'stl_026',
      rentalId: 'rt_026',
      customerId: rentalOrThrow('rt_026').customerId,
      vehicleId: rentalOrThrow('rt_026').vehicleId,
      source: 'INCIDENT',
      type: 'RECEIVABLE',
      // RS-BR-24 — lấy nguyên từ Customer Charge của inc_010 (DISPUTED), không gõ tay số.
      amount: pscAmountForIncident(incidentOrThrow('inc_010')),
      incidentId: 'inc_010',
      reason: 'Trầy xước cánh cửa sau phát hiện khi nhận xe, chốt sau khi quyết toán đã đóng.',
      status: 'OPEN',
      createdByName: ACCOUNTANT,
      createdByRole: 'ACCOUNTANT',
      createdAt: dt(-9, 10),
    },
  ]
  writeJson(POST_SETTLEMENT_CHARGES_STORAGE_KEY, pscsToSeed)
}

/**
 * Seed C (`docs/PAYMENT-PLAN.md` §8.1/§10.12) — `PaymentRequest` `SETTLEMENT`/
 * `POST_SETTLEMENT_CHARGE` + `OFFSET` + giao dịch thu/hoàn + duyệt hoàn. Chạy
 * SAU `seedFinance` (B, đã viết Settlement/PSC) trong cùng thứ tự A → B → C
 * (xem cuối file). Dựng bằng CHÍNH hàm thuần app dùng (`buildSettlementPaymentRequest`,
 * `buildPscPaymentRequest`, `buildOffsetTransaction`, `deriveRequestStatus`,
 * `deriveRentalPaymentSummary`, `refundNeedsApproval`, `nextSequenceCode`).
 * KHÔNG tạo giao dịch `CASH` mới — giữ nguyên số liệu quỹ AC-PM-009 của Round 1.
 */
function seedPaymentRound2(): void {
  const rentals = readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
  const settlements = readJson<Settlement[]>(SETTLEMENTS_STORAGE_KEY) ?? []
  const pscs = readJson<PostSettlementCharge[]>(POST_SETTLEMENT_CHARGES_STORAGE_KEY) ?? []
  const requests = readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
  const transactions = readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []

  function settlementOrThrow(id: string): Settlement {
    const s = settlements.find((x) => x.id === id)
    if (!s) throw new Error(`finance/seed.ts (Payment Round 2): không tìm thấy Settlement ${id}`)
    return s
  }

  const newRequests: PaymentRequest[] = []
  const newTxns: Transaction[] = []

  function allCodes(): string[] {
    return [...transactions, ...newTxns].map((t) => t.code)
  }
  function addTxn(input: Omit<Transaction, 'id' | 'code' | 'createdAt' | 'updatedAt'>, updatedAt?: string): Transaction {
    const txn: Transaction = { ...input, id: generateId('txn'), code: nextSequenceCode('GD', allCodes()), createdAt: input.performedAt, updatedAt: updatedAt ?? input.performedAt }
    newTxns.push(txn)
    return txn
  }
  function issueReceiptFor(txn: Transaction, issuedAt: string): void {
    const existingReceiptNos = [...transactions, ...newTxns].map((t) => t.receipt?.receiptNo).filter((v): v is string => !!v)
    const receipt: Receipt = { receiptNo: nextSequenceCode('BL', existingReceiptNos), issuedByName: PM_ACCOUNTANT_NAME, issuedAt, voided: false }
    txn.receipt = receipt
  }

  // ---- 1) OFFSET cho mọi Settlement CONFIRMED/COMPLETED có depositApplied > 0 (stl_024/stl_025 — CASH_20M). ----
  for (const settlement of settlements) {
    if (settlement.status !== 'CONFIRMED' && settlement.status !== 'COMPLETED') continue
    const applied = settlement.depositReconciliation?.depositApplied ?? 0
    if (applied <= 0) continue // stl_026 (MOTORBIKE) → 0, không sinh OFFSET.
    const performedAt = settlement.customerAck?.recordedAt ?? settlement.updatedAt
    const offsetTxn = buildOffsetTransaction(settlement, { userId: PM_ACCOUNTANT_USER_ID, fullName: PM_ACCOUNTANT_NAME }, nextSequenceCode('GD', allCodes()), performedAt)
    newTxns.push(offsetTxn)
  }

  // ---- 2) PaymentRequest `SETTLEMENT` 1-1 cho mọi `SettlementPaymentRequest` `REQUESTED`. ----
  const settlementRequestMap = new Map<string, PaymentRequest>() // key = `${settlementId}:${type}`
  for (const settlement of settlements) {
    for (const spr of settlement.paymentRequests) {
      if (spr.status !== 'REQUESTED') continue
      const pr = buildSettlementPaymentRequest(settlement, spr, ACCOUNTANT, spr.createdAt)
      newRequests.push(pr)
      settlementRequestMap.set(`${settlement.id}:${spr.type}`, pr)
    }
  }

  // ---- 3) PaymentRequest `POST_SETTLEMENT_CHARGE` 1-1 cho `psc_001`/`psc_002`/`psc_003`. ----
  const pscRequestMap = new Map<string, PaymentRequest>() // key = pscId
  for (const psc of pscs) {
    const pr = buildPscPaymentRequest(psc, ACCOUNTANT, psc.createdAt)
    newRequests.push(pr)
    pscRequestMap.set(psc.id, pr)
  }

  // ---- 4) `stl_024` — `DEPOSIT_REFUND`: GD1 FAILED + GD2 CONFIRMED đủ số (AC-PM-005/006). ----
  {
    const settlement = settlementOrThrow('stl_024')
    const request = settlementRequestMap.get('stl_024:DEPOSIT_REFUND')
    if (request) {
      const amount = request.expectedAmount
      const needsApproval = refundNeedsApproval(amount)
      const recipientNote = `Hoàn cọc — chuyển khoản tới STK Vietcombank 0071xxxxxx (lượt thuê ${settlement.rentalId})`
      const completedAt = settlement.completedAt ?? settlement.updatedAt
      const failedAt = hoursAfter(completedAt, 20)
      const correctAt = hoursAfter(completedAt, 44)
      // Mỗi giao dịch duyệt riêng — `decidedAt` phải nằm SAU `performedAt` của
      // chính giao dịch đó (tech-lead review Phase 4.2 R2 — sửa điểm nên sửa #1).
      const approval1 = needsApproval ? { status: 'APPROVED' as const, decidedByName: MANAGER, decidedAt: hoursAfter(failedAt, 0.5) } : undefined
      const approval2 = needsApproval ? { status: 'APPROVED' as const, decidedByName: MANAGER, decidedAt: hoursAfter(correctAt, 0.5) } : undefined
      // GD2 chỉ được xác nhận đã chi (CONFIRMED) SAU KHI duyệt (`approval2.decidedAt`),
      // đúng guard runtime của `confirmTransaction` nhánh OUT (PM-BR-12). Dùng mốc riêng
      // `confirmAt` cho `confirmedAt`/biên lai — không tái dùng `correctAt` (tech-lead
      // review Phase 4.2 R2 — sửa Blocker).
      const confirmAt = hoursAfter(correctAt, 1)
      addTxn(
        {
          type: request.transactionType,
          direction: 'OUT',
          amount,
          method: 'BANK_TRANSFER',
          status: 'FAILED',
          customerId: request.customerId,
          rentalId: request.rentalId,
          paymentRequestId: request.id,
          settlementId: settlement.id,
          reference: 'CK-R-0001',
          refundRecipient: recipientNote,
          approval: approval1,
          failReason: 'Sai số tài khoản — ngân hàng trả lại (AC-PM-006).',
          performedByUserId: PM_ACCOUNTANT_USER_ID,
          performedByName: PM_ACCOUNTANT_NAME,
          performedAt: failedAt,
        },
        // `updatedAt` (đánh dấu thất bại) phải SAU `approval1.decidedAt` (tech-lead
        // review Phase 4.2 R2 — sửa điểm nên sửa #1).
        hoursAfter(failedAt, 2),
      )
      const txnCorrect = addTxn({
        type: request.transactionType,
        direction: 'OUT',
        amount,
        method: 'BANK_TRANSFER',
        status: 'CONFIRMED',
        customerId: request.customerId,
        rentalId: request.rentalId,
        paymentRequestId: request.id,
        settlementId: settlement.id,
        reference: 'CK-R-0002',
        refundRecipient: recipientNote,
        approval: approval2,
        performedByUserId: PM_ACCOUNTANT_USER_ID,
        performedByName: PM_ACCOUNTANT_NAME,
        performedAt: correctAt,
        confirmedByName: PM_ACCOUNTANT_NAME,
        confirmedAt: confirmAt,
      })
      issueReceiptFor(txnCorrect, confirmAt)
    }
  }

  // ---- 5) `stl_025` — `DEPOSIT_REFUND`: 1 GD `PENDING` đủ số, chờ duyệt (demo Duyệt → Xác nhận đã chi). ----
  {
    const settlement = settlementOrThrow('stl_025')
    const request = settlementRequestMap.get('stl_025:DEPOSIT_REFUND')
    if (request) {
      const amount = request.expectedAmount
      const needsApproval = refundNeedsApproval(amount)
      const pendingAt = hoursAfter(settlement.completedAt ?? settlement.updatedAt, 20)
      addTxn({
        type: request.transactionType,
        direction: 'OUT',
        amount,
        method: 'BANK_TRANSFER',
        status: 'PENDING',
        customerId: request.customerId,
        rentalId: request.rentalId,
        paymentRequestId: request.id,
        settlementId: settlement.id,
        reference: 'CK-R-0003',
        refundRecipient: `Hoàn cọc — chuyển khoản tới STK ACB 1903xxxxxx (lượt thuê ${settlement.rentalId})`,
        approval: needsApproval ? { status: 'PENDING_APPROVAL' } : undefined,
        performedByUserId: PM_ACCOUNTANT_USER_ID,
        performedByName: PM_ACCOUNTANT_NAME,
        performedAt: pendingAt,
      })
    }
  }

  // ---- 6) `stl_026` — `COLLECT`: thu một phần (~50%, làm tròn nghìn, < amount) bằng `BANK_TRANSFER` (xe máy). ----
  {
    const settlement = settlementOrThrow('stl_026')
    const request = settlementRequestMap.get('stl_026:COLLECT')
    if (request) {
      const half = Math.min(request.expectedAmount - 1_000, Math.round(request.expectedAmount / 2 / 1_000) * 1_000)
      const performedAt = hoursAfter(settlement.completedAt ?? settlement.updatedAt, 20)
      addTxn({
        type: request.transactionType,
        direction: 'IN',
        amount: half,
        method: 'BANK_TRANSFER',
        status: 'CONFIRMED',
        customerId: request.customerId,
        rentalId: request.rentalId,
        paymentRequestId: request.id,
        settlementId: settlement.id,
        reference: 'CK-R-0004',
        performedByUserId: PM_ACCOUNTANT_USER_ID,
        performedByName: PM_ACCOUNTANT_NAME,
        performedAt,
        confirmedByName: PM_ACCOUNTANT_NAME,
        confirmedAt: performedAt,
      })
    }
  }

  // ---- 7) `psc_002` (`REFUND` 200k, đang `CLOSED` ở seed B) — 1 GD `GOODWILL_REFUND` tất toán (≤ ngưỡng, không duyệt). ----
  let updatedPsc002: PostSettlementCharge | undefined
  {
    const psc = pscs.find((p) => p.id === 'psc_002')
    const request = pscRequestMap.get('psc_002')
    if (psc && request) {
      const performedAt = hoursAfter(psc.createdAt, 20)
      const txn = addTxn({
        type: request.transactionType,
        direction: 'OUT',
        amount: request.expectedAmount,
        method: 'BANK_TRANSFER',
        status: 'CONFIRMED',
        customerId: request.customerId,
        rentalId: request.rentalId,
        settlementId: request.settlementId,
        paymentRequestId: request.id,
        reference: 'CK-R-0005',
        refundRecipient: `Hoàn thiện chí — chuyển khoản QR (lượt thuê ${request.rentalId})`,
        performedByUserId: PM_ACCOUNTANT_USER_ID,
        performedByName: PM_ACCOUNTANT_NAME,
        performedAt,
        confirmedByName: PM_ACCOUNTANT_NAME,
        confirmedAt: performedAt,
      })
      updatedPsc002 = { ...psc, closeNote: `Tất toán qua giao dịch ${txn.code}`, closedAt: performedAt }
    }
  }
  // `psc_001` (RECEIVABLE 700k OPEN) và `psc_003` (INCIDENT inc_010 DISPUTED, OPEN) — KHÔNG tạo GD (demo AC-PM-012 + "Tạm giữ").

  // ---- Đồng bộ cuối C — KHÔNG gõ tay (§8.1/§10.12 kế hoạch). ----
  const allRequests = [...requests, ...newRequests]
  const allTxns = [...transactions, ...newTxns]
  const finalRequests = allRequests.map((r) => ({ ...r, status: deriveRequestStatus(r, allTxns) }))
  writeJson(PAYMENT_REQUESTS_STORAGE_KEY, finalRequests)
  writeJson(TRANSACTIONS_STORAGE_KEY, allTxns)

  const finalSettlements = settlements.map((s) => {
    if (s.status !== 'CONFIRMED' && s.status !== 'COMPLETED') return s
    const rental = rentals.find((r) => r.id === s.rentalId)
    if (!rental) return s
    const summary = deriveRentalPaymentSummary(rental, finalRequests, allTxns, s)
    return { ...s, paymentStatus: summary.paymentStatus }
  })
  writeJson(SETTLEMENTS_STORAGE_KEY, finalSettlements)

  if (updatedPsc002) {
    writeJson(POST_SETTLEMENT_CHARGES_STORAGE_KEY, pscs.map((p) => (p.id === 'psc_002' ? (updatedPsc002 as PostSettlementCharge) : p)))
  }
}

// PAYMENT-PLAN.md §8.1 — chạy TRƯỚC khối Settlement (seedFinance đọc Rental/HandoverRecord, không phụ thuộc Payment ở Round 1).
registerSeedStep(seedPaymentRound1)
registerSeedStep(seedFinance)
// PAYMENT-PLAN.md §8.1/§10.12 — chạy SAU seedFinance (B đã có Settlement/PSC).
registerSeedStep(seedPaymentRound2)
