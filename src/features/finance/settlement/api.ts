// Rental Settlement (RS) — fake API. Tách từ `finance/api.ts` — docs/FINANCE-REFACTOR-PLAN.md §3.2.
// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2),
// không deep-import `/api`/`/hooks`/`/model` của 3 feature nguồn.
import { listReturns, type ReturnRecord } from '@/features/handover-return'
import { listIncidents, type Incident } from '@/features/incidents'
import {
  canCompleteRental,
  canOpenSettlement,
  markRentalCompleted,
  markSettlementOpened,
  revertSettlementReversed,
  type Rental,
} from '@/features/rentals'
import type {
  PostSettlementChargeSource,
  PostSettlementChargeType,
  SettlementRequestType,
  SettlementWaiverType,
} from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { calcSettlementTotals } from '../core/model.ts'
import {
  readAllPaymentRequests,
  readAllPsc,
  readAllSettlements as readAll,
  readAllTransactions,
  readRentalOrThrow,
  writeAllPaymentRequests,
  writeAllPsc,
  writeAllSettlements as writeAll,
  writeAllTransactions,
} from '../core/storage.ts'
import type {
  ActorInfo,
  DepositReconciliation,
  PostSettlementCharge,
  Settlement,
  SettlementLine,
  SettlementPaymentRequest,
  SettlementWaiver,
} from '../core/types.ts'
import { applyDepositOffsetInCallback, syncFinanceAfterPaymentChange } from '../payment/ledger.ts'
import {
  buildPscPaymentRequest,
  buildReversalPair,
  buildSettlementPaymentRequest,
  calcDepositHeld,
  calcPaidToDate,
  findEffectiveOffset,
  nextSequenceCode,
} from '../payment/model.ts'
import {
  buildReversalReset,
  buildSourceLines,
  calcDepositReconciliation,
  calcSettlementCollectOutstanding,
  canAdjustSettlement,
  canCreatePostSettlementCharge,
  canReverseSettlement,
  fixedPscType,
  getCompletionBlockers,
  getIncidentPscBlocker,
  getLineDiscountedAmount,
  getSubmitBlockers,
  mergeResyncedLines,
  pscAmountForIncident,
  type PscBlockerCode,
  waiverNeedsApproval,
} from './model.ts'

function findOrThrow(items: Settlement[], id: string): Settlement {
  const found = items.find((s) => s.id === id)
  if (!found) throw new Error('Không tìm thấy quyết toán')
  return found
}

/**
 * Nợ 4 (N4, `docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) — chặn mọi thao tác sửa
 * Worksheet khi biên bản trả xe đã bị huỷ (Rental không còn ở `SETTLEMENT`).
 * Cùng thông điệp với guard cũ của `submitForCustomer`.
 */
function assertRentalInSettlement(rentalId: string, actionText = 'cập nhật quyết toán'): Rental {
  const rental = readRentalOrThrow(rentalId)
  if (rental.status !== 'SETTLEMENT') {
    throw new Error(`Biên bản trả xe không còn hiệu lực (lượt thuê đang ở trạng thái ${rental.status}) — không thể ${actionText}`)
  }
  return rental
}

/** Vietnamese cho từng `PscBlockerCode` (§10.4 kế hoạch) — dùng chung lỗi API + nhãn UI (`PostSettlementChargeDialog`). */
export const PSC_BLOCKER_MESSAGES: Record<PscBlockerCode, string> = {
  ALREADY_IN_SETTLEMENT: 'Sự cố đã có dòng trong quyết toán kỳ gốc — dùng Điều chỉnh nếu sai số.',
  ALREADY_HAS_PSC: 'Sự cố đã có khoản phát sinh sau quyết toán.',
  NOT_CUSTOMER_LIABILITY: 'Sự cố không do khách chịu trách nhiệm.',
  INCIDENT_VOID: 'Sự cố đã huỷ/đóng không tính phí/ghi giảm giá trị.',
  CUSTOMER_CHARGE_NOT_FINAL: 'Sự cố chưa chốt Customer Charge (chưa duyệt hoặc chưa xác định trách nhiệm).',
}

async function loadSources(rentalId: string): Promise<{ returnRecord?: ReturnRecord; incidents: Incident[] }> {
  const [returns, incidents] = await Promise.all([listReturns({ rentalId }), listIncidents({ rentalId })])
  return {
    returnRecord: returns.find((r) => r.status === 'COMPLETED'),
    incidents,
  }
}

/** UC-RS-01, RS-BR-01/02/03 — mở quyết toán thủ công từ Rental `RETURNED`/`SETTLEMENT` (seed cũ). */
export async function openSettlement(rentalId: string, actor: ActorInfo): Promise<Settlement> {
  const rental = readRentalOrThrow(rentalId)
  if (!canOpenSettlement(rental)) {
    throw new Error(`Không thể mở quyết toán khi lượt thuê đang ở trạng thái ${rental.status} (RS-BR-02)`)
  }
  const { returnRecord, incidents } = await loadSources(rentalId)

  const settlement = await fakeRequest(() => {
    // N1 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) — đọc lại + kiểm lại guard
    // chống trùng TRONG callback, không dùng mảng đọc trước độ trễ.
    const existing = readAll()
    if (existing.some((s) => s.rentalId === rentalId)) {
      throw new Error('Lượt thuê này đã có quyết toán (RS-BR-01)')
    }
    // PAYMENT-PLAN.md §10.6 — Paid To Date/Deposit Held đọc từ sổ giao dịch Payment thật, không còn suy từ `HandoverRecord`.
    const paymentRequests = readAllPaymentRequests()
    const transactions = readAllTransactions()
    const now = new Date().toISOString()
    const result: Settlement = {
      id: generateId('stl'),
      rentalId,
      customerId: rental.customerId,
      vehicleId: rental.vehicleId,
      status: 'DRAFT',
      lines: buildSourceLines({ rental, returnRecord, incidents }),
      waivers: [],
      securityDepositType: rental.securityDepositType,
      paidToDate: calcPaidToDate(rental, paymentRequests, transactions),
      depositHeld: calcDepositHeld(rental, paymentRequests, transactions),
      paymentRequests: [],
      openedByName: actor.fullName,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...existing, result])
    appendAudit({
      action: 'OPEN_SETTLEMENT',
      entity: 'Settlement',
      entityId: result.id,
      summary: `Mở quyết toán cho lượt thuê ${rentalId}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: result,
    })
    return result
  })

  if (rental.status === 'RETURNED') {
    await markSettlementOpened(rentalId, actor)
  }
  return settlement
}

/** RS-BR-04, EX-05 — Return/Incident đổi sau khi mở → đồng bộ lại, chỉ khi Settlement `DRAFT`. */
export async function resyncSettlementSources(id: string, actor: ActorInfo): Promise<Settlement> {
  const before = findOrThrow(readAll(), id)
  if (before.status !== 'DRAFT') {
    throw new Error('Chỉ đồng bộ lại khi quyết toán đang Đang soạn')
  }
  const rental = readRentalOrThrow(before.rentalId)
  // RS-BR-13 — sự cố đã đi qua PSC không đưa lại vào Settlement khi làm lại
  // sau đảo quyết toán (RENTAL-SETTLEMENT-PLAN.md §10.2 điểm 3).
  const pscIncidentIds = new Set(readAllPsc().filter((p) => p.rentalId === before.rentalId && p.incidentId).map((p) => p.incidentId))
  const { returnRecord, incidents: sourceIncidents } = await loadSources(before.rentalId)
  const incidents = sourceIncidents.filter((i) => !pscIncidentIds.has(i.id))

  return fakeRequest(() => {
    // N1 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) — đọc lại + kiểm lại guard
    // (`status === 'DRAFT'`) TRONG callback, không dùng `before` đọc trước độ trễ.
    const existing = readAll()
    const current = findOrThrow(existing, id)
    if (current.status !== 'DRAFT') {
      throw new Error('Chỉ đồng bộ lại khi quyết toán đang Đang soạn')
    }
    const freshLines = buildSourceLines({ rental, returnRecord, incidents })
    // PAYMENT-PLAN.md §10.6 — Paid To Date/Deposit Held đọc từ sổ giao dịch Payment thật.
    const paymentRequests = readAllPaymentRequests()
    const transactions = readAllTransactions()
    const after: Settlement = {
      ...current,
      lines: mergeResyncedLines(current.lines, freshLines),
      paidToDate: calcPaidToDate(rental, paymentRequests, transactions),
      depositHeld: calcDepositHeld(rental, paymentRequests, transactions),
      depositReconciliation: undefined, // mọi lần resync xoá đối trừ cọc (§3.7 kế hoạch)
      updatedAt: new Date().toISOString(),
    }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'SYNC_SETTLEMENT_SOURCES',
      entity: 'Settlement',
      entityId: id,
      summary: `Đồng bộ lại dòng khoản mục từ nguồn cho quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { lines: current.lines },
      after: { lines: after.lines },
    })
    return after
  })
}

export interface ConfirmLineInput {
  actualAmount: number
  note?: string
}

/** UC-RS-03, RS-BR-05/27, AC-RS-002/003/015 — dòng `INCIDENT` khoá `Actual = Customer Charge`. */
export async function confirmLine(id: string, lineId: string, input: ConfirmLineInput, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ chốt dòng khi quyết toán đang Đang soạn')
    const line = before.lines.find((l) => l.id === lineId)
    if (!line) throw new Error('Không tìm thấy dòng khoản mục')
    if (line.status === 'DISPUTED') throw new Error('Dòng đang tranh chấp — kết luận tranh chấp trước khi chốt lại')
    if (line.status === 'WAIVED') throw new Error('Dòng đã được miễn — không thể chốt lại')
    if (!line.sourceReady) throw new Error('Nguồn của dòng này chưa sẵn sàng (chờ duyệt hồ sơ sự cố — EX-01)')
    if (line.source === 'INCIDENT' && input.actualAmount !== (line.estimatedAmount ?? 0)) {
      throw new Error('Không thể sửa số tiền dòng sự cố — lấy nguyên Customer Charge từ Damage & Incident (RS-BR-04)')
    }
    const now = new Date().toISOString()
    const changed = line.estimatedAmount !== undefined && input.actualAmount !== line.estimatedAmount
    const updatedLine: SettlementLine = {
      ...line,
      actualAmount: input.actualAmount,
      status: 'CONFIRMED',
      note: input.note ?? line.note,
      sourceChanged: false,
      confirmedByName: actor.fullName,
      confirmedAt: now,
    }
    const after: Settlement = { ...before, lines: before.lines.map((l) => (l.id === lineId ? updatedLine : l)), updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: changed ? 'UPDATE_SETTLEMENT_LINE' : 'CONFIRM_SETTLEMENT_LINE',
      entity: 'Settlement',
      entityId: id,
      summary: `Chốt dòng ${line.category} (${before.rentalId})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: line,
      after: updatedLine,
    })
    return after
  })
}

export interface ManualLineInput {
  direction: 'CHARGE' | 'DISCOUNT'
  amount: number
  reason: string
}

/** UC-RS-04, BRD §18.1, RS-BR-19 — thêm dòng `MANUAL`, bắt buộc lý do. */
export async function addManualLine(id: string, input: ManualLineInput, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ thêm dòng thủ công khi quyết toán đang Đang soạn')
    const now = new Date().toISOString()
    const newLine: SettlementLine = {
      id: generateId('sln'),
      category: 'MANUAL_OTHER',
      source: 'MANUAL',
      direction: input.direction,
      actualAmount: input.amount,
      status: 'CONFIRMED',
      sourceReady: true,
      reason: input.reason,
      confirmedByName: actor.fullName,
      confirmedAt: now,
    }
    const after: Settlement = { ...before, lines: [...before.lines, newLine], updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'ADD_SETTLEMENT_MANUAL_LINE',
      entity: 'Settlement',
      entityId: id,
      summary: `Thêm khoản mục thủ công: ${input.reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: newLine,
    })
    return after
  })
}

/** Chỉ xoá khi Settlement `DRAFT` (RS-BR-19). */
export async function removeManualLine(id: string, lineId: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ xoá dòng thủ công khi quyết toán đang Đang soạn')
    const line = before.lines.find((l) => l.id === lineId)
    if (!line || line.source !== 'MANUAL') throw new Error('Chỉ xoá được dòng khoản mục thủ công')
    const after: Settlement = { ...before, lines: before.lines.filter((l) => l.id !== lineId), updatedAt: new Date().toISOString() }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'REMOVE_SETTLEMENT_MANUAL_LINE',
      entity: 'Settlement',
      entityId: id,
      summary: `Xoá khoản mục thủ công (${line.reason ?? ''})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: line,
    })
    return after
  })
}

export interface WaiverInput {
  type: SettlementWaiverType
  lineId?: string
  amount: number
  reason: string
}

/**
 * UC-RS-05, BRD §12, RS-BR-07/08 — vượt ngưỡng tạm → `PENDING_APPROVAL`.
 * `WAIVE_LINE` chỉ miễn đúng dòng `CHARGE` đang `CONFIRMED`, số tiền LUÔN lấy
 * nguyên `actualAmount` của dòng (không nhận số tự do) và KHÔNG ghi đè
 * `actualAmount` — tránh mất số gốc khỏi Final Amount (RS-BR-04/AC-RS-003,
 * tech-lead review Phase 4.1 R1 Blocker 1). `PARTIAL_DISCOUNT` không được
 * vượt `actualAmount` của dòng liên quan.
 */
export async function applyWaiver(id: string, input: WaiverInput, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ áp dụng miễn giảm khi quyết toán đang Đang soạn')
    let amount = input.amount
    if (input.type === 'WAIVE_LINE' || input.type === 'PARTIAL_DISCOUNT') {
      if (!input.lineId) throw new Error('Chọn dòng liên quan')
      const line = before.lines.find((l) => l.id === input.lineId)
      if (!line) throw new Error('Không tìm thấy dòng khoản mục')
      if (line.direction !== 'CHARGE' || line.status !== 'CONFIRMED') {
        throw new Error('Chỉ áp dụng miễn giảm cho dòng Thu đang Đã chốt')
      }
      // Nợ 2 (N2, §10.7) — chống cộng dồn `PARTIAL_DISCOUNT` vượt số thực tế +
      // chặn ngược `WAIVE_LINE` trên dòng đã có giảm một phần còn hiệu lực
      // (tránh trừ trùng trong `calcSettlementTotals`).
      const alreadyDiscounted = getLineDiscountedAmount(input.lineId, before.waivers)
      if (input.type === 'WAIVE_LINE') {
        if (alreadyDiscounted > 0) {
          throw new Error('Dòng này đã có giảm một phần còn hiệu lực — không thể miễn hẳn (tránh trừ trùng)')
        }
        amount = line.actualAmount ?? 0
      } else {
        if (amount > (line.actualAmount ?? 0)) {
          throw new Error('Số tiền giảm không được vượt số thực tế của dòng')
        }
        if (alreadyDiscounted + amount > (line.actualAmount ?? 0)) {
          throw new Error(
            `Tổng giảm một phần vượt số thực tế của dòng (còn được giảm tối đa ${((line.actualAmount ?? 0) - alreadyDiscounted).toLocaleString('vi-VN')}đ)`,
          )
        }
      }
    }
    const now = new Date().toISOString()
    const needsApproval = waiverNeedsApproval(amount)
    const waiver: SettlementWaiver = {
      id: generateId('wvr'),
      type: input.type,
      lineId: input.lineId,
      amount,
      reason: input.reason,
      status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
      requestedByName: actor.fullName,
      requestedByRole: actor.role,
      requestedAt: now,
      decidedByName: needsApproval ? undefined : actor.fullName,
      decidedAt: needsApproval ? undefined : now,
    }
    let lines = before.lines
    if (input.type === 'WAIVE_LINE' && input.lineId) {
      lines = lines.map((l) => (l.id === input.lineId ? { ...l, status: 'WAIVED' } : l))
    }
    const after: Settlement = { ...before, lines, waivers: [...before.waivers, waiver], updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'APPLY_SETTLEMENT_WAIVER',
      entity: 'Settlement',
      entityId: id,
      summary: `Áp dụng miễn giảm ${input.type}: ${input.reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: waiver,
    })
    return after
  })
}

/**
 * AC-RS-007, RS-BR-17 — đánh dấu dòng tranh chấp, không tính vào Final Amount.
 * RS-BR-12 — không sửa sau khi Settlement đã `CONFIRMED`/`COMPLETED`.
 */
export async function disputeLine(id: string, lineId: string, disputeNote: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT' && before.status !== 'PENDING_CUSTOMER') {
      throw new Error('Chỉ đánh dấu tranh chấp khi quyết toán đang Đang soạn hoặc Chờ khách xác nhận (RS-BR-12)')
    }
    const line = before.lines.find((l) => l.id === lineId)
    if (!line) throw new Error('Không tìm thấy dòng khoản mục')
    const updatedLine: SettlementLine = { ...line, status: 'DISPUTED', disputeNote }
    // BRD §13 BR — khách không đồng ý một khoản khi đang `PENDING_CUSTOMER` → quay `DRAFT`.
    const status = before.status === 'PENDING_CUSTOMER' ? 'DRAFT' : before.status
    const after: Settlement = { ...before, lines: before.lines.map((l) => (l.id === lineId ? updatedLine : l)), status, updatedAt: new Date().toISOString() }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'DISPUTE_SETTLEMENT_LINE',
      entity: 'Settlement',
      entityId: id,
      summary: `Đánh dấu tranh chấp dòng ${line.category}: ${disputeNote}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: line,
      after: updatedLine,
    })
    return after
  })
}

export interface ResolveDisputeInput {
  resolution: 'KEEP' | 'ADJUST' | 'WAIVE'
  actualAmount?: number
  reason: string
}

/**
 * UC-RS-17 — Giữ nguyên/Điều chỉnh số/Miễn (3/4 nhánh, Round 1 — xem §1.2 kế hoạch,
 * nhánh "Tách ra Post-Settlement" là Round 2).
 * TODO(OQ: RentalSettlement-BRD.md §28 Q13 — khoản tranh chấp giữ trong Settlement hay
 * tách Post-Settlement; "khách từ chối toàn bộ" demo = đánh dấu mọi dòng `DISPUTED`.)
 */
export async function resolveDispute(id: string, lineId: string, input: ResolveDisputeInput, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ kết luận tranh chấp khi quyết toán đang Đang soạn (RS-BR-12)')
    const line = before.lines.find((l) => l.id === lineId)
    if (!line || line.status !== 'DISPUTED') throw new Error('Dòng này không ở trạng thái tranh chấp')
    const now = new Date().toISOString()
    let updatedLine: SettlementLine
    let waivers = before.waivers
    if (input.resolution === 'KEEP') {
      updatedLine = { ...line, status: 'CONFIRMED', disputeNote: undefined, note: input.reason }
    } else if (input.resolution === 'ADJUST') {
      updatedLine = { ...line, status: 'CONFIRMED', actualAmount: input.actualAmount, disputeNote: undefined, note: input.reason }
    } else {
      // Nợ 3 (N3, §10.7, RS-BR-07/08) — Miễn khi kết luận tranh chấp cũng phải
      // qua ngưỡng duyệt: tạo kèm `SettlementWaiver` `WAIVE_LINE`.
      const amount = input.actualAmount ?? line.actualAmount ?? line.estimatedAmount ?? 0
      updatedLine = { ...line, status: 'WAIVED', actualAmount: amount, disputeNote: undefined, note: input.reason }
      const needsApproval = waiverNeedsApproval(amount)
      const waiver: SettlementWaiver = {
        id: generateId('wvr'),
        type: 'WAIVE_LINE',
        lineId: line.id,
        amount,
        reason: input.reason,
        status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED',
        requestedByName: actor.fullName,
        requestedByRole: actor.role,
        requestedAt: now,
        decidedByName: needsApproval ? undefined : actor.fullName,
        decidedAt: needsApproval ? undefined : now,
      }
      waivers = [...before.waivers, waiver]
    }
    const after: Settlement = { ...before, lines: before.lines.map((l) => (l.id === lineId ? updatedLine : l)), waivers, updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'RESOLVE_SETTLEMENT_DISPUTE',
      entity: 'Settlement',
      entityId: id,
      summary: `Kết luận tranh chấp dòng ${line.category} (${input.resolution}): ${input.reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { line, waivers: before.waivers },
      after: { line: updatedLine, waivers },
    })
    return after
  })
}

/** UC-RS-06, RS-BR-09/22, AC-RS-004/005, CR-2026-003 — Accountant bấm "Xác định đối trừ cọc" để chốt. */
export async function reconcileDeposit(id: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'DRAFT') throw new Error('Chỉ đối trừ cọc khi quyết toán đang Đang soạn')
    if (before.lines.some((l) => l.status === 'DRAFT' || l.status === 'DISPUTED')) {
      throw new Error('Còn dòng chưa chốt hoặc đang tranh chấp (RS-BR-06)')
    }
    const totals = calcSettlementTotals(before.lines, before.waivers)
    const paidToDate = before.paidToDate.prepayment + before.paidToDate.handoverPayment
    const calc = calcDepositReconciliation(totals.finalAmount, paidToDate, before.depositHeld)
    const now = new Date().toISOString()
    const reconciliation: DepositReconciliation = { ...calc, reconciledByName: actor.fullName, reconciledAt: now }
    const after: Settlement = { ...before, depositReconciliation: reconciliation, updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'RECONCILE_SETTLEMENT_DEPOSIT',
      entity: 'Settlement',
      entityId: id,
      summary: `Xác định đối trừ cọc cho quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: reconciliation,
    })
    return after
  })
}

/**
 * `DRAFT → PENDING_CUSTOMER` (BRD §13, UC §4). Kiểm Rental còn ở `SETTLEMENT`
 * trước khi ghi — tránh lệch dữ liệu khi biên bản trả xe đã bị huỷ
 * (tech-lead review Phase 4.1 R1 Blocker 3).
 */
export async function submitForCustomer(id: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    if (before.status !== 'DRAFT') throw new Error('Quyết toán không ở trạng thái Đang soạn')
    assertRentalInSettlement(before.rentalId, 'gửi khách xác nhận')
    const blockers = getSubmitBlockers(before)
    if (blockers.length > 0) throw new Error('Chưa đủ điều kiện gửi khách xác nhận.')
    const after: Settlement = { ...before, status: 'PENDING_CUSTOMER', updatedAt: new Date().toISOString() }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'SUBMIT_SETTLEMENT_FOR_CUSTOMER',
      entity: 'Settlement',
      entityId: id,
      summary: `Gửi khách xác nhận quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status },
    })
    return after
  })
}

export interface CustomerAckInput {
  disputedLineIds: string[]
  note?: string
}

/**
 * `→ WAITING_APPROVAL`/`CONFIRMED` hoặc dòng `DISPUTED` + quay `DRAFT` — diễn
 * giải §0.4 điểm 1 kế hoạch (giữ đúng thứ tự State Model: chỉ `WAITING_APPROVAL`
 * nếu còn miễn giảm `PENDING_APPROVAL`, ngược lại thẳng `CONFIRMED`).
 * TODO(OQ: RentalSettlement-BRD.md §28 Q17 — mức xác nhận khách Phase 1 (M0-M4)
 * chưa chốt; demo luôn đi qua `PENDING_CUSTOMER`, nhân viên ghi nhận thay khách
 * (gần M1 — mức BRD đề xuất tối thiểu).)
 */
export async function recordCustomerAck(id: string, input: CustomerAckInput, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'PENDING_CUSTOMER') throw new Error('Quyết toán không ở trạng thái Chờ khách xác nhận')
    const now = new Date().toISOString()
    if (input.disputedLineIds.length > 0) {
      const lines = before.lines.map((l) => (input.disputedLineIds.includes(l.id) ? { ...l, status: 'DISPUTED' as const, disputeNote: input.note } : l))
      const after: Settlement = { ...before, lines, status: 'DRAFT', customerAck: undefined, updatedAt: now }
      writeAll(existing.map((s) => (s.id === id ? after : s)))
      appendAudit({
        action: 'DISPUTE_SETTLEMENT_LINE',
        entity: 'Settlement',
        entityId: id,
        summary: `Khách không đồng ý ${input.disputedLineIds.length} dòng khoản mục`,
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        after: { disputedLineIds: input.disputedLineIds, note: input.note },
      })
      return after
    }
    const hasPendingWaiver = before.waivers.some((w) => w.status === 'PENDING_APPROVAL')
    const status: Settlement['status'] = hasPendingWaiver ? 'WAITING_APPROVAL' : 'CONFIRMED'
    const after: Settlement = { ...before, status, customerAck: { recordedByName: actor.fullName, recordedAt: now, note: input.note }, updatedAt: now }
    // PAYMENT-PLAN.md §10.5 — cấn trừ cọc tự động chỉ ở nhánh → CONFIRMED (không ở → WAITING_APPROVAL),
    // TRƯỚC khi ghi Settlement; cọc không đủ thì throw, không ghi gì (PM-BR-07/08).
    if (status === 'CONFIRMED') {
      applyDepositOffsetInCallback(after, actor, now)
    }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'RECORD_SETTLEMENT_CUSTOMER_ACK',
      entity: 'Settlement',
      entityId: id,
      summary: `Ghi nhận khách xác nhận quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status },
    })
    if (status === 'CONFIRMED') {
      syncFinanceAfterPaymentChange(before.rentalId, actor, now)
      return findOrThrow(readAll(), id)
    }
    return after
  })
}

/** BRD §14, UC-RS-09 — `WAITING_APPROVAL → CONFIRMED`. */
export async function approveSettlement(id: string, note: string | undefined, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'WAITING_APPROVAL') throw new Error('Quyết toán không ở trạng thái Chờ duyệt')
    const now = new Date().toISOString()
    const waivers = before.waivers.map((w) =>
      w.status === 'PENDING_APPROVAL' ? { ...w, status: 'APPROVED' as const, decidedByName: actor.fullName, decidedAt: now, decisionNote: note } : w,
    )
    const after: Settlement = {
      ...before,
      status: 'CONFIRMED',
      waivers,
      approval: { decision: 'APPROVED', decidedByName: actor.fullName, decidedAt: now, note },
      updatedAt: now,
    }
    // PAYMENT-PLAN.md §10.5 — cấn trừ cọc tự động TRƯỚC khi ghi Settlement.
    applyDepositOffsetInCallback(after, actor, now)
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'APPROVE_SETTLEMENT',
      entity: 'Settlement',
      entityId: id,
      summary: `Duyệt quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status },
    })
    syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    return findOrThrow(readAll(), id)
  })
}

/**
 * EX-06 — `WAITING_APPROVAL → DRAFT`, ghi chú bắt buộc. Mọi `SettlementWaiver`
 * `WAIVE_LINE` bị `REJECTED` phải trả dòng `SettlementLine` liên quan về lại
 * `CONFIRMED` (loại khỏi tổng → quay lại tính vào tổng) — tech-lead review
 * Phase 4.1 R1 Blocker 2, khớp §3.3 kế hoạch.
 */
export async function rejectSettlement(id: string, note: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const trimmedNote = note.trim()
    if (!trimmedNote) throw new Error('Ghi chú trả lại là bắt buộc (EX-06)')
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'WAITING_APPROVAL') throw new Error('Quyết toán không ở trạng thái Chờ duyệt')
    const now = new Date().toISOString()
    const rejectedWaiveLineIds = new Set(
      before.waivers.filter((w) => w.type === 'WAIVE_LINE' && w.status === 'PENDING_APPROVAL' && w.lineId).map((w) => w.lineId as string),
    )
    const waivers = before.waivers.map((w) =>
      w.status === 'PENDING_APPROVAL' ? { ...w, status: 'REJECTED' as const, decidedByName: actor.fullName, decidedAt: now, decisionNote: trimmedNote } : w,
    )
    const lines = before.lines.map((l) => (rejectedWaiveLineIds.has(l.id) && l.status === 'WAIVED' ? { ...l, status: 'CONFIRMED' as const } : l))
    const after: Settlement = {
      ...before,
      status: 'DRAFT',
      waivers,
      lines,
      approval: { decision: 'RETURNED', decidedByName: actor.fullName, decidedAt: now, note: trimmedNote },
      updatedAt: now,
    }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'REJECT_SETTLEMENT',
      entity: 'Settlement',
      entityId: id,
      summary: `Trả lại quyết toán ${id}: ${trimmedNote}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status },
    })
    return after
  })
}

/** UC-RS-10/11, RS-BR-10/20, EX-03 — chỉ ghi lại yêu cầu (§0.3 kế hoạch), không sinh giao dịch. */
export async function createPaymentRequest(id: string, type: SettlementRequestType, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
    assertRentalInSettlement(before.rentalId)
    if (before.status !== 'CONFIRMED') throw new Error('Chỉ tạo yêu cầu thu/hoàn khi quyết toán đã Đã chốt')
    if (before.paymentRequests.some((r) => r.type === type && r.status === 'REQUESTED')) {
      throw new Error('Đã có yêu cầu cùng loại đang chờ xử lý cho quyết toán này')
    }
    const reco = before.depositReconciliation
    if (!reco) throw new Error('Chưa đối trừ cọc')
    const amount = type === 'COLLECT' ? Math.max(0, reco.balanceDue) : type === 'DEPOSIT_REFUND' ? reco.depositRefundable : Math.max(0, -reco.balanceDue)
    if (amount <= 0) throw new Error('Không có khoản phù hợp để tạo yêu cầu này')
    const now = new Date().toISOString()
    const request: SettlementPaymentRequest = { id: generateId('pyr'), type, amount, status: 'REQUESTED', createdByName: actor.fullName, createdAt: now }
    // §0.3 điểm 7 kế hoạch — Round 2: `paymentStatus` không còn gán tay ở đây, do
    // `syncFinanceAfterPaymentChange` tính lại từ sổ giao dịch (§10.4/§10.6).
    const after: Settlement = { ...before, paymentRequests: [...before.paymentRequests, request], updatedAt: now }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: type === 'COLLECT' ? 'CREATE_SETTLEMENT_COLLECT_REQUEST' : 'CREATE_SETTLEMENT_REFUND_REQUEST',
      entity: 'Settlement',
      entityId: id,
      summary: `Tạo yêu cầu ${type} ${amount.toLocaleString('vi-VN')}đ cho quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: request,
    })
    // PAYMENT-PLAN.md §10.6 — sinh kèm `PaymentRequest` 1-1 (§0.3 điểm 7) TRONG cùng callback.
    const paymentRequest = buildSettlementPaymentRequest(after, request, actor.fullName, now)
    writeAllPaymentRequests([...readAllPaymentRequests(), paymentRequest])
    appendAudit({
      action: 'CREATE_PAYMENT_REQUEST',
      entity: 'PaymentRequest',
      entityId: paymentRequest.id,
      summary: `Sinh yêu cầu thanh toán cho ${type} của quyết toán ${id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: paymentRequest,
    })
    syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    return findOrThrow(readAll(), id)
  })
}

/**
 * UC-RS-13, BRD §16, RS-BR-06/12/20, AC-RS-009/010 — `CONFIRMED → COMPLETED` +
 * Rental `SETTLEMENT → COMPLETED`. Kiểm `canCompleteRental(rental)` TRƯỚC khi
 * ghi bất kỳ thay đổi nào vào Settlement — nếu Rental không còn ở
 * `SETTLEMENT` (ví dụ biên bản trả xe vừa bị huỷ) thì không ghi gì cả, tránh
 * Settlement `COMPLETED` nhưng Rental kẹt ở trạng thái khác vĩnh viễn
 * (tech-lead review Phase 4.1 R1 Blocker 3).
 */
export async function completeSettlement(id: string, actor: ActorInfo): Promise<Settlement> {
  const after = await fakeRequest(() => {
    // N1 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) — đọc storage + kiểm guard
    // TRONG callback, không dùng snapshot đọc trước độ trễ.
    const existing = readAll()
    const before = findOrThrow(existing, id)
    const blockers = getCompletionBlockers(before)
    if (blockers.length > 0) {
      throw new Error('Chưa đủ điều kiện đóng lượt thuê (RS-BR-06/20).')
    }
    const rental = readRentalOrThrow(before.rentalId)
    if (!canCompleteRental(rental)) {
      throw new Error(`Lượt thuê đang ở trạng thái ${rental.status}, không thể đóng lượt (biên bản trả xe có thể đã bị huỷ).`)
    }
    const totals = calcSettlementTotals(before.lines, before.waivers)
    const now = new Date().toISOString()
    // RentalSettlement-BRD.md §15 / EX-02 — còn phải thu trên yêu cầu thu lúc đóng = đóng kèm công nợ (cờ lịch sử).
    const completedWithDebt = calcSettlementCollectOutstanding(before, readAllPaymentRequests(), readAllTransactions()) > 0
    const result: Settlement = {
      ...before,
      status: 'COMPLETED',
      completedTotals: { ...totals, ...(before.depositReconciliation as DepositReconciliation) },
      completedWithDebt,
      completedByName: actor.fullName,
      completedAt: now,
      updatedAt: now,
    }
    writeAll(existing.map((s) => (s.id === id ? result : s)))
    appendAudit({
      action: 'COMPLETE_SETTLEMENT',
      entity: 'Settlement',
      entityId: id,
      summary: completedWithDebt ? `Đóng lượt thuê kèm công nợ (quyết toán ${id})` : `Đóng lượt thuê (quyết toán ${id})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: result.status, completedWithDebt },
    })
    return result
  })
  await markRentalCompleted(after.rentalId, actor)
  return after
}

// ---- Round 2 (`docs/RENTAL-SETTLEMENT-PLAN.md` §10.6) — Post-Settlement Charge / Điều chỉnh / Đảo quyết toán ----

export interface CreatePostSettlementChargeInput {
  source: PostSettlementChargeSource
  type?: PostSettlementChargeType
  amount?: number
  incidentId?: string
  reason: string
  evidenceNote?: string
}

/**
 * UC-RS-14, RS-BR-13, AC-RS-011, EX-08, RS-BR-24 — tạo Post-Settlement Charge
 * khi Settlement + Rental đã `COMPLETED`. KHÔNG mở lại/ghi vào Settlement kỳ
 * gốc (chỉ ghi key `postSettlementCharges`).
 * TODO(OQ: RentalSettlement-BRD.md §28 Q14/Q15 — thời hạn truy thu + ngưỡng bỏ
 * qua khoản nhỏ; demo: không giới hạn thời hạn, không đề xuất bỏ qua (UC-RS-14
 * A2 chưa build)).
 */
export async function createPostSettlementCharge(settlementId: string, input: CreatePostSettlementChargeInput, actor: ActorInfo): Promise<PostSettlementCharge> {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Lý do là bắt buộc')
  if (input.source === 'ADJUSTMENT') {
    throw new Error('Điều chỉnh sau khi đóng lượt dùng chức năng "Điều chỉnh", không tạo qua đây')
  }

  let incident: Incident | undefined
  if (input.source === 'INCIDENT') {
    if (!input.incidentId) throw new Error('Chọn sự cố liên quan')
    const incidents = await listIncidents()
    incident = incidents.find((i) => i.id === input.incidentId)
    if (!incident) throw new Error('Không tìm thấy hồ sơ sự cố')
  } else if (!input.amount || !Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('Số tiền phải là số nguyên dương')
  }

  return fakeRequest(() => {
    const settlement = findOrThrow(readAll(), settlementId)
    const rental = readRentalOrThrow(settlement.rentalId)
    if (!canCreatePostSettlementCharge(settlement, rental)) {
      throw new Error('Chỉ tạo khoản phát sinh sau quyết toán khi quyết toán và lượt thuê đã Hoàn tất (RS-BR-13)')
    }
    const existingPscs = readAllPsc()
    let resolvedAmount: number
    let resolvedType: PostSettlementChargeType
    if (incident) {
      if (incident.rentalId !== settlement.rentalId) throw new Error('Sự cố không thuộc lượt thuê này')
      const blocker = getIncidentPscBlocker(incident, settlement, existingPscs)
      if (blocker) throw new Error(PSC_BLOCKER_MESSAGES[blocker])
      resolvedAmount = pscAmountForIncident(incident)
      resolvedType = 'RECEIVABLE'
    } else {
      resolvedAmount = input.amount as number
      const fixed = fixedPscType(input.source)
      if (fixed) {
        resolvedType = fixed
      } else {
        if (!input.type) throw new Error('Chọn loại khoản (phải thu thêm/phải hoàn)')
        resolvedType = input.type
      }
    }
    const now = new Date().toISOString()
    const psc: PostSettlementCharge = {
      id: generateId('psc'),
      settlementId,
      rentalId: settlement.rentalId,
      customerId: settlement.customerId,
      vehicleId: settlement.vehicleId,
      source: input.source,
      type: resolvedType,
      amount: resolvedAmount,
      incidentId: input.incidentId,
      reason,
      evidenceNote: input.evidenceNote?.trim() || undefined,
      status: 'OPEN',
      createdByName: actor.fullName,
      createdByRole: actor.role,
      createdAt: now,
    }
    writeAllPsc([...existingPscs, psc])
    appendAudit({
      action: 'CREATE_POST_SETTLEMENT_CHARGE',
      entity: 'Settlement',
      entityId: settlementId,
      summary: `Tạo khoản phát sinh sau quyết toán (${input.source}, ${resolvedAmount.toLocaleString('vi-VN')}đ): ${reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: psc,
    })
    // PAYMENT-PLAN.md §10.6 — mỗi PSC sinh kèm 1 `PaymentRequest` qua `buildPscPaymentRequest`.
    const paymentRequest = buildPscPaymentRequest(psc, actor.fullName, now)
    writeAllPaymentRequests([...readAllPaymentRequests(), paymentRequest])
    appendAudit({
      action: 'CREATE_PAYMENT_REQUEST',
      entity: 'PaymentRequest',
      entityId: paymentRequest.id,
      summary: `Sinh yêu cầu thanh toán cho khoản phát sinh sau quyết toán ${psc.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: paymentRequest,
    })
    return psc
  })
}

export interface AdjustSettlementInput {
  direction: 'INCREASE' | 'DECREASE'
  amount: number
  reason: string
  evidenceNote?: string
}

/**
 * UC-RS-15, BRD §18.2, AC-RS-012 — điều chỉnh sau `COMPLETED` = tạo PSC
 * `source = 'ADJUSTMENT'`. KHÔNG ghi key `settlements`.
 * TODO(OQ: RentalSettlement-BRD.md §28 Q16 — ai được điều chỉnh sau
 * `COMPLETED`; Accountant = `TBD` — xem `permissions.ts`).
 */
export async function adjustSettlement(settlementId: string, input: AdjustSettlementInput, actor: ActorInfo): Promise<PostSettlementCharge> {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Lý do là bắt buộc')
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương')

  return fakeRequest(() => {
    const settlement = findOrThrow(readAll(), settlementId)
    const rental = readRentalOrThrow(settlement.rentalId)
    if (!canAdjustSettlement(settlement, rental)) {
      throw new Error('Chỉ điều chỉnh khi quyết toán và lượt thuê đã Hoàn tất (RS-BR-13)')
    }
    const now = new Date().toISOString()
    const psc: PostSettlementCharge = {
      id: generateId('psc'),
      settlementId,
      rentalId: settlement.rentalId,
      customerId: settlement.customerId,
      vehicleId: settlement.vehicleId,
      source: 'ADJUSTMENT',
      type: input.direction === 'INCREASE' ? 'RECEIVABLE' : 'REFUND',
      amount: input.amount,
      reason,
      evidenceNote: input.evidenceNote?.trim() || undefined,
      status: 'OPEN',
      createdByName: actor.fullName,
      createdByRole: actor.role,
      createdAt: now,
    }
    writeAllPsc([...readAllPsc(), psc])
    appendAudit({
      action: 'ADJUST_SETTLEMENT',
      entity: 'Settlement',
      entityId: settlementId,
      summary: `Điều chỉnh sau quyết toán (${input.direction}, ${input.amount.toLocaleString('vi-VN')}đ): ${reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: psc,
    })
    // PAYMENT-PLAN.md §10.6 — mỗi PSC sinh kèm 1 `PaymentRequest` qua `buildPscPaymentRequest`.
    const paymentRequest = buildPscPaymentRequest(psc, actor.fullName, now)
    writeAllPaymentRequests([...readAllPaymentRequests(), paymentRequest])
    appendAudit({
      action: 'CREATE_PAYMENT_REQUEST',
      entity: 'PaymentRequest',
      entityId: paymentRequest.id,
      summary: `Sinh yêu cầu thanh toán cho điều chỉnh sau quyết toán ${psc.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: paymentRequest,
    })
    return psc
  })
}

// §10.2 điểm 10 kế hoạch — Round 2 bỏ hẳn đóng PSC thủ công (`closePostSettlementCharge` đã xoá).
// PSC chỉ `CLOSED` qua `syncFinanceAfterPaymentChange` khi `PaymentRequest` liên kết `FULFILLED`
// (AC-PM-012), vẫn dùng audit action `CLOSE_POST_SETTLEMENT_CHARGE`.

export interface ReverseSettlementInput {
  reason: string
  confirmRentalId: string
}

/**
 * UC-RS-16, BRD §18.2, RS-BR-14, AC-RS-013, EX-09 — đảo quyết toán
 * `COMPLETED → DRAFT` + Rental `COMPLETED → SETTLEMENT`. Xác nhận 2 bước
 * (lý do + gõ lại mã lượt thuê) — kiểm cả ở đây, không chỉ ở UI.
 */
export async function reverseSettlement(settlementId: string, input: ReverseSettlementInput, actor: ActorInfo): Promise<Settlement> {
  const reason = input.reason.trim()
  if (!reason) throw new Error('Lý do là bắt buộc')

  const after = await fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, settlementId)
    if (input.confirmRentalId !== before.rentalId) {
      throw new Error('Mã lượt thuê xác nhận không khớp')
    }
    const rental = readRentalOrThrow(before.rentalId)
    if (!canReverseSettlement(before, rental)) {
      throw new Error('Chỉ đảo quyết toán khi quyết toán và lượt thuê đã Hoàn tất')
    }
    const now = new Date().toISOString()
    const { after: result, reversal } = buildReversalReset(before, actor, reason, now)
    writeAll(existing.map((s) => (s.id === settlementId ? result : s)))

    // PAYMENT-PLAN.md §10.5 — (1) huỷ PaymentRequest của Payment còn mở, liên kết qua `settlementRequestId`.
    const cancelledSettlementRequestIds = new Set(reversal.cancelledPaymentRequestIds)
    const cancelledPaymentRequestIds: string[] = []
    const prList = readAllPaymentRequests().map((r) => {
      if (!r.settlementRequestId || !cancelledSettlementRequestIds.has(r.settlementRequestId)) return r
      if (r.status !== 'OPEN' && r.status !== 'PARTIALLY_FULFILLED') return r
      cancelledPaymentRequestIds.push(r.id)
      return { ...r, status: 'CANCELLED' as const, cancelledByName: actor.fullName, cancelledAt: now, cancelReason: reason }
    })
    writeAllPaymentRequests(prList)
    for (const requestId of cancelledPaymentRequestIds) {
      appendAudit({
        action: 'CANCEL_PAYMENT_REQUEST',
        entity: 'PaymentRequest',
        entityId: requestId,
        summary: `Huỷ yêu cầu thanh toán do đảo quyết toán ${settlementId}: ${reason}`,
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        after: { status: 'CANCELLED' },
      })
    }

    // (2) VOID giao dịch `PENDING` gắn các yêu cầu vừa huỷ (PM-BR-02) — tránh lệnh hoàn đang
    // chờ bị xác nhận chi sau khi quyết toán đã đảo.
    const cancelledRequestIdSet = new Set(cancelledPaymentRequestIds)
    const voidedTransactionIds: string[] = []
    let txnList = readAllTransactions().map((t) => {
      if (t.status !== 'PENDING' || !t.paymentRequestId || !cancelledRequestIdSet.has(t.paymentRequestId)) return t
      voidedTransactionIds.push(t.id)
      return {
        ...t,
        status: 'VOIDED' as const,
        voidReason: `Yêu cầu thanh toán bị huỷ do đảo quyết toán: ${reason}`,
        voidedByName: actor.fullName,
        voidedAt: now,
        updatedAt: now,
      }
    })
    writeAllTransactions(txnList)
    for (const txnId of voidedTransactionIds) {
      appendAudit({
        action: 'VOID_TRANSACTION',
        entity: 'Transaction',
        entityId: txnId,
        summary: `Huỷ giao dịch do đảo quyết toán ${settlementId}: ${reason}`,
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        after: { status: 'VOIDED' },
      })
    }

    // (3) Đảo giao dịch `OFFSET` tương ứng (nếu có) — UC-PM-12 A2, Deposit Held trở về mức trước.
    let reversedOffsetId: string | undefined
    const offset = findEffectiveOffset(settlementId, txnList)
    if (offset) {
      const code = nextSequenceCode('GD', txnList.map((t) => t.code))
      const { updatedOriginal, reversal: offsetReversal } = buildReversalPair(offset, reason, actor, code, now)
      txnList = [...txnList.map((t) => (t.id === offset.id ? updatedOriginal : t)), offsetReversal]
      writeAllTransactions(txnList)
      reversedOffsetId = offsetReversal.id
      appendAudit({
        action: 'REVERSE_TRANSACTION',
        entity: 'Transaction',
        entityId: offset.id,
        summary: `Đảo giao dịch cấn trừ cọc ${offset.code} do đảo quyết toán ${settlementId}: ${reason}`,
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        before: { id: offset.id, code: offset.code, status: offset.status },
        after: { originalId: offset.id, reversalId: offsetReversal.id, reason },
      })
    }

    appendAudit({
      action: 'REVERSE_SETTLEMENT',
      entity: 'Settlement',
      entityId: settlementId,
      summary: `Đảo quyết toán ${settlementId}: ${reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status, completedTotals: before.completedTotals },
      after: {
        status: result.status,
        cancelledPaymentRequestIds,
        voidedTransactionIds,
        reversedOffsetId,
      },
    })
    // (4) Giao dịch thu/hoàn tiền thật đã `CONFIRMED` theo yêu cầu cũ → GIỮ NGUYÊN, không đảo tiền
    // thật (UC-PM-01 A1 để ngỏ cách xử lý khi làm lại quyết toán).
    // TODO(OQ: UC-PM-01 A1 — tiền thật đã thu/hoàn theo quyết toán cũ xử lý thế nào khi làm lại
    // quyết toán; demo: giữ nguyên, Paid To Date của quyết toán mới KHÔNG tính khoản này (RS-BR-21),
    // người dùng rà soát + đảo tay ở Sổ giao dịch nếu cần.)
    // UC-RS-16 bước 2 / RevenueCost-BRD.md EX-02 — doanh thu không lưu riêng: deriveRevenueLines() đọc
    // reversals[].snapshot (giữ kỳ gốc) và sinh dòng đối ứng âm tại reversedAt; quyết toán lại sinh dòng mới
    // (REVENUE-COST-PLAN.md §0.3 điểm 2). Không cần ghi gì thêm ở đây.
    syncFinanceAfterPaymentChange(before.rentalId, actor, now)
    return findOrThrow(readAll(), settlementId)
  })
  await revertSettlementReversed(after.rentalId, actor)
  return after
}
