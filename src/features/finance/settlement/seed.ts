// Rental Settlement (RS) — seed Settlement/PSC (export, đăng ký ở `finance/seed.ts`) — docs/FINANCE-REFACTOR-PLAN.md §3.4.
// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2),
// đọc trực tiếp storage key đã export để lấy dữ liệu seed thật (tiền lệ `incidents/seed.ts`
// đọc `RETURN_RECORDS_STORAGE_KEY`).
import { RETURN_RECORDS_STORAGE_KEY, type ReturnRecord } from '@/features/handover-return'
import { INCIDENTS_STORAGE_KEY, type Incident } from '@/features/incidents'
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { calcSettlementTotals } from '../core/model.ts'
import { ACCOUNTANT, dt, MANAGER } from '../core/seedHelpers.ts'
import {
  PAYMENT_REQUESTS_STORAGE_KEY,
  POST_SETTLEMENT_CHARGES_STORAGE_KEY,
  SETTLEMENTS_STORAGE_KEY,
  TRANSACTIONS_STORAGE_KEY,
} from '../core/storage.ts'
import type {
  DepositReconciliation,
  PaymentRequest,
  PostSettlementCharge,
  Settlement,
  SettlementLine,
  SettlementPaymentRequest,
  SettlementWaiver,
  Transaction,
} from '../core/types.ts'
import { calcDepositHeld, calcPaidToDate } from '../payment/model.ts'
import { buildSourceLines, calcDepositReconciliation, calcSettlementCollectOutstanding, pscAmountForIncident } from './model.ts'

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
export function seedFinance(): void {
  const rentals = readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
  const returns = readJson<ReturnRecord[]>(RETURN_RECORDS_STORAGE_KEY) ?? []
  const incidents = readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? []
  // §8.1 kế hoạch — A (seedPaymentRound1) chạy TRƯỚC B (seedFinance) nên đọc được PaymentRequest/Transaction thật.
  const paymentRequests = readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
  const transactions = readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []

  /**
   * Cờ "đóng kèm công nợ" tính bằng đúng hàm của `completeSettlement()` tại `completedAt` — không gõ tay.
   * Yêu cầu thu của Settlement seed sang Payment ở `seedPaymentRound2` (chạy sau): lúc này chưa có `PaymentRequest`
   * nên coi như chưa thu đồng nào — kết quả trùng với việc tính sau (giao dịch thu của `stl_026` nằm SAU `completedAt`).
   */
  function debtAtCompletion(settlement: Settlement): boolean {
    return calcSettlementCollectOutstanding(settlement, paymentRequests, transactions, settlement.completedAt) > 0
  }

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
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push({ ...settlement, completedWithDebt: debtAtCompletion(settlement) })
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
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push({ ...settlement, completedWithDebt: debtAtCompletion(settlement) })
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
      // đã tạo yêu cầu thu, cờ `completedWithDebt` tính bằng `calcSettlementCollectOutstanding` lúc đóng.
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    settlementsToSeed.push({ ...settlement, completedWithDebt: debtAtCompletion(settlement) })
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
