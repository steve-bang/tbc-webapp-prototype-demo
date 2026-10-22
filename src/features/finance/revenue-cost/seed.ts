// Revenue & Cost (RV) — seed lịch sử doanh thu + Cost Record (export, đăng ký ở `finance/seed.ts`) — docs/FINANCE-REFACTOR-PLAN.md §3.4.
import { RENTALS_STORAGE_KEY, type Rental } from '@/features/rentals'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { calcSettlementTotals } from '../core/model.ts'
import { ACCOUNTANT, dt, hoursAfter, MANAGER, PM_ACCOUNTANT_NAME, PM_ACCOUNTANT_USER_ID } from '../core/seedHelpers.ts'
import { PAYMENT_REQUESTS_STORAGE_KEY, SETTLEMENTS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '../core/storage.ts'
import type {
  DepositReconciliation,
  PaymentRequest,
  Settlement,
  SettlementLine,
  SettlementPaymentRequest,
  Transaction,
} from '../core/types.ts'
import {
  buildScheduleRequests,
  buildSettlementPaymentRequest,
  calcDepositHeld,
  calcPaidToDate,
  deriveRentalPaymentSummary,
  deriveRequestStatus,
  nextSequenceCode,
} from '../payment/model.ts'
import { COST_RECORDS_STORAGE_KEY } from './api.ts'
import { type CostRecord, toLocalDateKey } from './model.ts'
import { buildReversalReset, buildSourceLines, calcDepositReconciliation, calcSettlementCollectOutstanding } from '../settlement/model.ts'

// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §9 ====

/** Lượt thuê lịch sử `rt_030`…`rt_039` (`rentals/seed.ts`) — mỗi lượt có Payment Request + giao dịch + Settlement `COMPLETED`. */
const HISTORY_RENTAL_IDS = ['rt_030', 'rt_031', 'rt_032', 'rt_033', 'rt_034', 'rt_035', 'rt_036', 'rt_037', 'rt_038', 'rt_039']

/** Khoản `MANUAL_OTHER` cộng thêm ở 2 lượt lịch sử để có danh mục doanh thu `OTHER` (yêu cầu thu `COLLECT` + thu đủ). */
const HISTORY_EXTRA_LINES: Record<string, { amount: number; reason: string }> = {
  rt_034: { amount: 200_000, reason: 'Phí vệ sinh nội thất sau khi trả xe' },
  rt_037: { amount: 150_000, reason: 'Phí gửi xe qua đêm tại bãi' },
}

/** `rt_038` — khoản nhập nhầm ở bản quyết toán 1, bị đảo ở bản 2 (minh hoạ đảo quyết toán, EX-02). */
const REVERSED_SETTLEMENT_MISTAKE = { amount: 300_000, reason: 'Phí phát sinh nhập nhầm' }

const SYSTEM_ADMIN_NAME = 'Nguyễn Văn Admin'

/**
 * Lịch sử doanh thu (`docs/REVENUE-COST-PLAN.md` §9.2, phương án B): dựng Payment Request + giao dịch thu (chuyển khoản —
 * không tạo CASH để giữ nguyên số liệu quỹ) + Settlement `COMPLETED` cho 10 lượt thuê quá khứ. Dựng bằng chính các hàm thuần
 * của app (`buildScheduleRequests`, `buildSourceLines`, `calcSettlementTotals`, `calcDepositReconciliation`,
 * `buildSettlementPaymentRequest`, `buildReversalReset`, `deriveRequestStatus`, `deriveRentalPaymentSummary`) — không gõ tay số tổng/trạng thái.
 * Helper viết riêng tại đây (không dùng lại closure của `seedPaymentRound1`). Chạy SAU `seedPaymentRound2`: đọc lại storage
 * đã ghi và nối thêm bản ghi mới. Seed không gọi `appendAudit`.
 */
export function seedRevenueHistory(): void {
  const rentals = readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
  const requests = readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
  const transactions = readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []
  const settlements = readJson<Settlement[]>(SETTLEMENTS_STORAGE_KEY) ?? []

  const newRequests: PaymentRequest[] = []
  const newTxns: Transaction[] = []
  const newSettlements: Settlement[] = []

  function rentalOrThrow(id: string): Rental {
    const r = rentals.find((x) => x.id === id)
    if (!r) throw new Error(`finance/seed.ts (Revenue history): không tìm thấy Rental ${id}`)
    return r
  }
  function allRequests(): PaymentRequest[] {
    return [...requests, ...newRequests]
  }
  function allTxns(): Transaction[] {
    return [...transactions, ...newTxns]
  }

  /** Giao dịch thu bằng chuyển khoản đã xác nhận; mã `GD-`/`CK-` tuần tự tính trên TOÀN BỘ giao dịch đã có + mới thêm. */
  function recordTransfer(input: { rental: Rental; request: PaymentRequest; performedAt: string; settlementId?: string }): Transaction {
    const all = allTxns()
    const txn: Transaction = {
      id: generateId('txn'),
      code: nextSequenceCode('GD', all.map((t) => t.code)),
      type: input.request.transactionType,
      direction: 'IN',
      amount: input.request.expectedAmount,
      method: 'BANK_TRANSFER',
      status: 'CONFIRMED',
      customerId: input.rental.customerId,
      rentalId: input.rental.id,
      paymentRequestId: input.request.id,
      settlementId: input.settlementId,
      reference: nextSequenceCode('CK', all.map((t) => t.reference).filter((v): v is string => !!v)),
      performedByUserId: PM_ACCOUNTANT_USER_ID,
      performedByName: PM_ACCOUNTANT_NAME,
      performedAt: input.performedAt,
      confirmedByName: PM_ACCOUNTANT_NAME,
      confirmedAt: input.performedAt,
      createdAt: input.performedAt,
      updatedAt: input.performedAt,
    }
    newTxns.push(txn)
    return txn
  }

  /** Lập lịch BOOKING/HANDOVER (MOTORBIKE → 2 yêu cầu) + thu đủ 30% (sau `createdAt`) và 70% (trước giờ giao ~2 giờ). */
  function schedulePaid(rental: Rental): void {
    const schedule = buildScheduleRequests(rental, ACCOUNTANT, rental.createdAt)
    newRequests.push(...schedule)
    const booking = schedule.find((r) => r.source === 'BOOKING')
    const handover = schedule.find((r) => r.source === 'HANDOVER' && r.transactionType === 'RENTAL_PAYMENT')
    if (!booking || !handover) throw new Error(`finance/seed.ts (Revenue history): thiếu yêu cầu BOOKING/HANDOVER của ${rental.id}`)
    recordTransfer({ rental, request: booking, performedAt: hoursAfter(rental.createdAt, 3) })
    recordTransfer({ rental, request: handover, performedAt: hoursAfter(rental.pickupDateTime, -2) })
  }

  function manualLine(input: { amount: number; reason: string }, confirmedAt: string): SettlementLine {
    return {
      id: generateId('sln'),
      category: 'MANUAL_OTHER',
      source: 'MANUAL',
      direction: 'CHARGE',
      actualAmount: input.amount,
      status: 'CONFIRMED',
      sourceReady: true,
      reason: input.reason,
      confirmedByName: ACCOUNTANT,
      confirmedAt,
    }
  }

  /** Số liệu quyết toán tính từ sổ giao dịch + dòng hiện có (Paid To Date, Deposit Held, Final Amount, đối trừ cọc). */
  function reconcile(rental: Rental, lines: SettlementLine[], reconciledAt: string) {
    const paidToDate = calcPaidToDate(rental, allRequests(), allTxns())
    const depositHeld = calcDepositHeld(rental, allRequests(), allTxns())
    const totals = calcSettlementTotals(lines, [])
    const reconciliation: DepositReconciliation = {
      ...calcDepositReconciliation(totals.finalAmount, paidToDate.prepayment + paidToDate.handoverPayment, depositHeld),
      reconciledByName: ACCOUNTANT,
      reconciledAt,
    }
    return { paidToDate, depositHeld, totals, reconciliation }
  }

  for (const rentalId of HISTORY_RENTAL_IDS) {
    const rental = rentalOrThrow(rentalId)
    schedulePaid(rental)

    const settlementId = `stl_${rentalId.slice(3)}`
    // createdAt < pickup < expectedReturn < openedAt < … < completedAt.
    const openedAt = hoursAfter(rental.expectedReturnDateTime, 1)
    const baseLines = buildSourceLines({ rental, returnRecord: undefined, incidents: [] })

    if (rentalId === 'rt_038') {
      // ---- Bản 1 COMPLETED (≈ −60 ngày): có dòng nhập nhầm + yêu cầu COLLECT chưa thu (completedWithDebt). ----
      const lines1 = [...baseLines, manualLine(REVERSED_SETTLEMENT_MISTAKE, dt(-61, 10))]
      const r1 = reconcile(rental, lines1, dt(-61, 11))
      const spr: SettlementPaymentRequest = {
        id: generateId('pyr'),
        type: 'COLLECT',
        amount: r1.reconciliation.balanceDue,
        status: 'REQUESTED',
        createdByName: ACCOUNTANT,
        createdAt: dt(-61, 12),
      }
      const completedAt1 = dt(-60, 10)
      const settlement1Base: Settlement = {
        id: settlementId,
        rentalId,
        customerId: rental.customerId,
        vehicleId: rental.vehicleId,
        status: 'COMPLETED',
        lines: lines1,
        waivers: [],
        securityDepositType: rental.securityDepositType,
        paidToDate: r1.paidToDate,
        depositHeld: r1.depositHeld,
        depositReconciliation: r1.reconciliation,
        customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-61, 11, 30) },
        paymentRequests: [spr],
        paymentStatus: 'UNPAID',
        completedTotals: { ...r1.totals, ...r1.reconciliation },
        completedByName: MANAGER,
        completedAt: completedAt1,
        openedByName: ACCOUNTANT,
        openedAt,
        createdAt: openedAt,
        updatedAt: completedAt1,
      }
      const collectRequest = buildSettlementPaymentRequest(settlement1Base, spr, ACCOUNTANT, spr.createdAt)
      // Lúc đóng bản 1 yêu cầu thu còn mở (chưa thu đồng nào) — tính cờ trước khi bản này bị đảo/huỷ yêu cầu.
      const settlement1: Settlement = {
        ...settlement1Base,
        completedWithDebt: calcSettlementCollectOutstanding(settlement1Base, [...allRequests(), collectRequest], allTxns(), completedAt1) > 0,
      }

      // ---- Đảo (≈ −58 ngày) bởi SYSTEM_ADMIN: yêu cầu thu bị huỷ, bản 1 vào `reversals[].snapshot`. ----
      const reversedAt = dt(-58, 10)
      const reason = 'Nhập nhầm phí phát sinh, cần quyết toán lại'
      const { after: reset, reversal } = buildReversalReset(settlement1, { fullName: SYSTEM_ADMIN_NAME, role: 'SYSTEM_ADMIN' }, reason, reversedAt)
      newRequests.push({ ...collectRequest, status: 'CANCELLED', cancelledByName: SYSTEM_ADMIN_NAME, cancelledAt: reversedAt, cancelReason: reason })

      // ---- Bản 2 COMPLETED (≈ −57 ngày): bỏ dòng nhầm, chốt lại, cân bằng. ----
      const lines2 = reset.lines.filter((l) => l.source !== 'MANUAL')
      const r2 = reconcile(rental, lines2, dt(-58, 14))
      const completedAt2 = dt(-57, 10)
      const settlement2Base: Settlement = {
        ...reset,
        status: 'COMPLETED',
        lines: lines2,
        paidToDate: r2.paidToDate,
        depositHeld: r2.depositHeld,
        depositReconciliation: r2.reconciliation,
        customerAck: { recordedByName: ACCOUNTANT, recordedAt: dt(-58, 15) },
        completedTotals: { ...r2.totals, ...r2.reconciliation },
        completedByName: MANAGER,
        completedAt: completedAt2,
        updatedAt: completedAt2,
        reversals: [reversal],
      }
      newSettlements.push({ ...settlement2Base, completedWithDebt: calcSettlementCollectOutstanding(settlement2Base, allRequests(), allTxns(), completedAt2) > 0 })
      continue
    }

    // ---- Lượt thường: 1 dòng BASE_RENTAL (+ tuỳ chọn MANUAL_OTHER đã thu đủ qua yêu cầu COLLECT). ----
    const extra = HISTORY_EXTRA_LINES[rentalId]
    const lines = extra ? [...baseLines, manualLine(extra, hoursAfter(openedAt, 1))] : baseLines
    const { paidToDate, depositHeld, totals, reconciliation } = reconcile(rental, lines, hoursAfter(openedAt, 2))
    const completedAt = hoursAfter(openedAt, 6)
    const sprList: SettlementPaymentRequest[] =
      reconciliation.balanceDue > 0
        ? [{ id: generateId('pyr'), type: 'COLLECT', amount: reconciliation.balanceDue, status: 'REQUESTED', createdByName: ACCOUNTANT, createdAt: hoursAfter(openedAt, 4) }]
        : []
    const settlementBase: Settlement = {
      id: settlementId,
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
      customerAck: { recordedByName: ACCOUNTANT, recordedAt: hoursAfter(openedAt, 3) },
      paymentRequests: sprList,
      completedTotals: { ...totals, ...reconciliation },
      completedByName: MANAGER,
      completedAt,
      openedByName: ACCOUNTANT,
      openedAt,
      createdAt: openedAt,
      updatedAt: completedAt,
    }
    // Dựng yêu cầu thu + giao dịch thu TRƯỚC (giao dịch ở openedAt + 5h < completedAt = openedAt + 6h), rồi mới tính cờ.
    for (const spr of sprList) {
      const collectRequest = buildSettlementPaymentRequest(settlementBase, spr, ACCOUNTANT, spr.createdAt)
      newRequests.push(collectRequest)
      recordTransfer({ rental, request: collectRequest, performedAt: hoursAfter(openedAt, 5), settlementId })
    }
    newSettlements.push({ ...settlementBase, completedWithDebt: calcSettlementCollectOutstanding(settlementBase, allRequests(), allTxns(), completedAt) > 0 })
  }

  // ---- Đồng bộ cuối — KHÔNG gõ tay trạng thái (mirror khối "Đồng bộ cuối C" của seedPaymentRound2). ----
  const finalTxns = allTxns()
  const finalRequests = allRequests().map((r) => ({ ...r, status: deriveRequestStatus(r, finalTxns) }))
  writeJson(PAYMENT_REQUESTS_STORAGE_KEY, finalRequests)
  writeJson(TRANSACTIONS_STORAGE_KEY, finalTxns)
  writeJson(
    SETTLEMENTS_STORAGE_KEY,
    [...settlements, ...newSettlements].map((s) => {
      if (!HISTORY_RENTAL_IDS.includes(s.rentalId) || s.status !== 'COMPLETED') return s
      const rental = rentalOrThrow(s.rentalId)
      return { ...s, paymentStatus: deriveRentalPaymentSummary(rental, finalRequests, finalTxns, s).paymentStatus }
    }),
  )
}

/**
 * Cost Record nhập tay (`docs/REVENUE-COST-PLAN.md` §9.1) — chạy SAU `seedRevenueHistory` (cần Rental lịch sử `rt_035`).
 * Chi phí sự cố/bảo dưỡng KHÔNG seed ở đây vì được suy ra từ `incidents`/`maintenance`. Seed không gọi `appendAudit`.
 * Mốc `enteredAt` luôn ≥ `costDate`, `reversedAt` > `enteredAt`; mọi mốc ở quá khứ.
 */
export function seedRevenueCost(): void {
  const records: CostRecord[] = []

  function add(spec: {
    category: CostRecord['category']
    amount: number
    dayOffset: number
    allocationType: CostRecord['allocationType']
    vehicleId?: string
    rentalId?: string
    spreadMonths?: number
    isUnusual?: boolean
    evidenceNote?: string
    note?: string
    reversed?: { reason: string; daysAfter: number }
  }): void {
    const enteredAt = dt(spec.dayOffset, 16)
    const reversedAt = spec.reversed ? dt(spec.dayOffset + spec.reversed.daysAfter, 9) : undefined
    records.push({
      id: `cst_${String(records.length + 1).padStart(3, '0')}`,
      code: nextSequenceCode('CP', records.map((r) => r.code)),
      category: spec.category,
      amount: spec.amount,
      costDate: toLocalDateKey(dt(spec.dayOffset, 12)),
      allocationType: spec.allocationType,
      vehicleId: spec.vehicleId,
      rentalId: spec.rentalId,
      spreadMonths: spec.spreadMonths ?? 1,
      isUnusual: spec.isUnusual ?? false,
      evidenceNote: spec.evidenceNote,
      note: spec.note,
      status: spec.reversed ? 'REVERSED' : 'ACTIVE',
      reverseReason: spec.reversed?.reason,
      reversedByName: spec.reversed ? PM_ACCOUNTANT_NAME : undefined,
      reversedAt,
      enteredByName: PM_ACCOUNTANT_NAME,
      enteredByRole: 'ACCOUNTANT',
      enteredAt,
      updatedByName: spec.reversed ? PM_ACCOUNTANT_NAME : undefined,
      updatedAt: reversedAt ?? enteredAt,
    })
  }

  // 1 — AC-RV-004: 6.000.000 rải 12 tháng = 500.000/tháng (xe công ty).
  add({ category: 'INSURANCE', amount: 6_000_000, dayOffset: -200, allocationType: 'DIRECT', vehicleId: 'veh_017', spreadMonths: 12, evidenceNote: 'HĐ bảo hiểm BH-2026-0187', note: 'Bảo hiểm thân vỏ 12 tháng' })
  // 2 — công ty chịu bảo hiểm cả xe ký gửi (CR-2026-050).
  add({ category: 'INSURANCE', amount: 7_200_000, dayOffset: -150, allocationType: 'DIRECT', vehicleId: 'veh_001', spreadMonths: 12, evidenceNote: 'HĐ bảo hiểm BH-2026-0231', note: 'Xe ký gửi — công ty chịu bảo hiểm thân vỏ' })
  // 3-4 — đăng kiểm rải theo kỳ.
  add({ category: 'INSPECTION', amount: 1_200_000, dayOffset: -120, allocationType: 'DIRECT', vehicleId: 'veh_017', spreadMonths: 12, evidenceNote: 'Biên lai đăng kiểm 5201-01', note: 'Đăng kiểm định kỳ' })
  add({ category: 'INSPECTION', amount: 1_200_000, dayOffset: -100, allocationType: 'DIRECT', vehicleId: 'veh_011', spreadMonths: 12, evidenceNote: 'Biên lai đăng kiểm 5201-02', note: 'Đăng kiểm định kỳ' })
  // 5-7 — bãi đỗ 3 tháng gần nhất (gián tiếp, hiện riêng).
  add({ category: 'PARKING', amount: 3_500_000, dayOffset: -75, allocationType: 'INDIRECT', note: 'Thuê bãi đỗ xe tháng trước nữa' })
  add({ category: 'PARKING', amount: 3_500_000, dayOffset: -45, allocationType: 'INDIRECT', note: 'Thuê bãi đỗ xe tháng trước' })
  add({ category: 'PARKING', amount: 3_500_000, dayOffset: -15, allocationType: 'INDIRECT', note: 'Thuê bãi đỗ xe tháng này' })
  // 8-9 — thuê mặt bằng văn phòng.
  add({ category: 'OPERATIONS', amount: 15_000_000, dayOffset: -50, allocationType: 'INDIRECT', note: 'Thuê mặt bằng văn phòng' })
  add({ category: 'OPERATIONS', amount: 15_000_000, dayOffset: -20, allocationType: 'INDIRECT', note: 'Thuê mặt bằng văn phòng' })
  // 10 — EX-04: chi phí bất thường / một lần.
  add({ category: 'OPERATIONS', amount: 22_000_000, dayOffset: -35, allocationType: 'INDIRECT', isUnusual: true, evidenceNote: 'HĐ sửa chữa số 0042', note: 'Sửa mái che bãi xe sau bão' })
  // 11 — gắn lượt thuê lịch sử của đúng xe (rt_035 thuộc veh_017).
  add({ category: 'REPOSITION_FUEL', amount: 450_000, dayOffset: -98, allocationType: 'DIRECT', vehicleId: 'veh_017', rentalId: 'rt_035', note: 'Đổ xăng chạy điều xe tới điểm giao' })
  // 12.
  add({ category: 'CLEANING', amount: 180_000, dayOffset: -25, allocationType: 'DIRECT', vehicleId: 'veh_003', note: 'Vệ sinh nội thất định kỳ' })
  // 13 — phần công ty chịu, khác doanh thu thu hồi (RV-BR-05).
  add({ category: 'VETC', amount: 320_000, dayOffset: -55, allocationType: 'DIRECT', vehicleId: 'veh_018', note: 'Phí VETC công ty chịu (không thu hồi được)' })
  add({ category: 'TRAFFIC_FINE', amount: 800_000, dayOffset: -40, allocationType: 'DIRECT', vehicleId: 'veh_004', evidenceNote: 'Biên bản phạt BB-2026-00311', note: 'Phạt nguội công ty chịu' })
  // 14 — huỷ mềm: nhập trùng hoá đơn.
  add({ category: 'OTHER', amount: 600_000, dayOffset: -30, allocationType: 'DIRECT', vehicleId: 'veh_005', reversed: { reason: 'Nhập trùng hoá đơn', daysAfter: 1 } })

  writeJson(COST_RECORDS_STORAGE_KEY, records)
}
