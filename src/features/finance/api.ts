// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2),
// không deep-import `/api`/`/hooks`/`/model` của 3 feature nguồn.
import {
  listHandovers,
  listReturns,
  type HandoverRecord,
  type ReturnRecord,
} from '@/features/handover-return'
import { listIncidents, type Incident } from '@/features/incidents'
import {
  RENTALS_STORAGE_KEY,
  canCompleteRental,
  canOpenSettlement,
  markRentalCompleted,
  markSettlementOpened,
  type Rental,
} from '@/features/rentals'
import type { Role, SettlementRequestType, SettlementStatus, SettlementWaiverType } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  buildSourceLines,
  calcDepositHeld,
  calcDepositReconciliation,
  calcPaidToDate,
  calcSettlementTotals,
  getCompletionBlockers,
  getSubmitBlockers,
  mergeResyncedLines,
  waiverNeedsApproval,
  type DepositReconciliation,
  type Settlement,
  type SettlementLine,
  type SettlementPaymentRequest,
  type SettlementWaiver,
} from './model'

export const SETTLEMENTS_STORAGE_KEY = 'settlements'

/** Người thực hiện thao tác — dùng để ghi audit (RS-BR-07/14, UC-RS-21). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readAll(): Settlement[] {
  return readJson<Settlement[]>(SETTLEMENTS_STORAGE_KEY) ?? []
}
function writeAll(items: Settlement[]): void {
  writeJson(SETTLEMENTS_STORAGE_KEY, items)
}
function findOrThrow(items: Settlement[], id: string): Settlement {
  const found = items.find((s) => s.id === id)
  if (!found) throw new Error('Không tìm thấy quyết toán')
  return found
}

/** `RENTALS_STORAGE_KEY` export qua barrel `@/features/rentals` (§0.2/§3.5 kế hoạch) — đọc trực tiếp, không deep-import `rentals/api.ts`. */
function readRentalOrThrow(rentalId: string): Rental {
  const rental = (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []).find((r) => r.id === rentalId)
  if (!rental) throw new Error('Không tìm thấy lượt thuê')
  return rental
}

export interface SettlementFilter {
  status?: SettlementStatus
  rentalId?: string
}

function matches(settlement: Settlement, filter?: SettlementFilter): boolean {
  if (!filter) return true
  if (filter.status && settlement.status !== filter.status) return false
  if (filter.rentalId && settlement.rentalId !== filter.rentalId) return false
  return true
}

export async function listSettlements(filter?: SettlementFilter): Promise<Settlement[]> {
  return fakeRequest(() => readAll().filter((s) => matches(s, filter)))
}

export async function getSettlementByRentalId(rentalId: string): Promise<Settlement | undefined> {
  return fakeRequest(() => readAll().find((s) => s.rentalId === rentalId))
}

async function loadSources(rentalId: string): Promise<{ returnRecord?: ReturnRecord; handover?: HandoverRecord; incidents: Incident[] }> {
  const [returns, handovers, incidents] = await Promise.all([
    listReturns({ rentalId }),
    listHandovers({ rentalId }),
    listIncidents({ rentalId }),
  ])
  return {
    returnRecord: returns.find((r) => r.status === 'COMPLETED'),
    handover: handovers.find((h) => h.status === 'COMPLETED'),
    incidents,
  }
}

/** UC-RS-01, RS-BR-01/02/03 — mở quyết toán thủ công từ Rental `RETURNED`/`SETTLEMENT` (seed cũ). */
export async function openSettlement(rentalId: string, actor: ActorInfo): Promise<Settlement> {
  const rental = readRentalOrThrow(rentalId)
  const existing = readAll()
  if (existing.some((s) => s.rentalId === rentalId)) {
    throw new Error('Lượt thuê này đã có quyết toán (RS-BR-01)')
  }
  if (!canOpenSettlement(rental)) {
    throw new Error(`Không thể mở quyết toán khi lượt thuê đang ở trạng thái ${rental.status} (RS-BR-02)`)
  }
  const { returnRecord, handover, incidents } = await loadSources(rentalId)

  const settlement = await fakeRequest(() => {
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
      paidToDate: calcPaidToDate(rental, handover),
      depositHeld: calcDepositHeld(rental, handover),
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
  const existing = readAll()
  const before = findOrThrow(existing, id)
  if (before.status !== 'DRAFT') {
    throw new Error('Chỉ đồng bộ lại khi quyết toán đang Đang soạn')
  }
  const rental = readRentalOrThrow(before.rentalId)
  const { returnRecord, handover, incidents } = await loadSources(before.rentalId)

  return fakeRequest(() => {
    const freshLines = buildSourceLines({ rental, returnRecord, incidents })
    const after: Settlement = {
      ...before,
      lines: mergeResyncedLines(before.lines, freshLines),
      paidToDate: calcPaidToDate(rental, handover),
      depositHeld: calcDepositHeld(rental, handover),
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
      before: { lines: before.lines },
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
    if (before.status !== 'DRAFT') throw new Error('Chỉ chốt dòng khi quyết toán đang Đang soạn')
    const line = before.lines.find((l) => l.id === lineId)
    if (!line) throw new Error('Không tìm thấy dòng khoản mục')
    if (line.status === 'DISPUTED') throw new Error('Dòng đang tranh chấp — kết luận tranh chấp trước khi chốt lại (UC-RS-17)')
    if (line.status === 'WAIVED') throw new Error('Dòng đã được miễn — không thể chốt lại')
    if (!line.sourceReady) throw new Error('Nguồn của dòng này chưa sẵn sàng (chờ duyệt hồ sơ sự cố — EX-01)')
    if (line.source === 'INCIDENT' && input.actualAmount !== (line.estimatedAmount ?? 0)) {
      throw new Error('Không thể sửa số tiền dòng sự cố — lấy nguyên Customer Charge từ Damage & Incident (RS-BR-04/AC-RS-003)')
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
    if (before.status !== 'DRAFT') throw new Error('Chỉ áp dụng miễn giảm khi quyết toán đang Đang soạn')
    let amount = input.amount
    if (input.type === 'WAIVE_LINE' || input.type === 'PARTIAL_DISCOUNT') {
      if (!input.lineId) throw new Error('Chọn dòng liên quan')
      const line = before.lines.find((l) => l.id === input.lineId)
      if (!line) throw new Error('Không tìm thấy dòng khoản mục')
      if (line.direction !== 'CHARGE' || line.status !== 'CONFIRMED') {
        throw new Error('Chỉ áp dụng miễn giảm cho dòng Thu đang Đã chốt')
      }
      if (input.type === 'WAIVE_LINE') {
        amount = line.actualAmount ?? 0
      } else if (amount > (line.actualAmount ?? 0)) {
        throw new Error('Số tiền giảm không được vượt số thực tế của dòng')
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
    if (before.status !== 'DRAFT') throw new Error('Chỉ kết luận tranh chấp khi quyết toán đang Đang soạn (RS-BR-12)')
    const line = before.lines.find((l) => l.id === lineId)
    if (!line || line.status !== 'DISPUTED') throw new Error('Dòng này không ở trạng thái tranh chấp')
    let updatedLine: SettlementLine
    if (input.resolution === 'KEEP') {
      updatedLine = { ...line, status: 'CONFIRMED', disputeNote: undefined, note: input.reason }
    } else if (input.resolution === 'ADJUST') {
      updatedLine = { ...line, status: 'CONFIRMED', actualAmount: input.actualAmount, disputeNote: undefined, note: input.reason }
    } else {
      updatedLine = {
        ...line,
        status: 'WAIVED',
        actualAmount: input.actualAmount ?? line.actualAmount ?? line.estimatedAmount ?? 0,
        disputeNote: undefined,
        note: input.reason,
      }
    }
    const after: Settlement = { ...before, lines: before.lines.map((l) => (l.id === lineId ? updatedLine : l)), updatedAt: new Date().toISOString() }
    writeAll(existing.map((s) => (s.id === id ? after : s)))
    appendAudit({
      action: 'RESOLVE_SETTLEMENT_DISPUTE',
      entity: 'Settlement',
      entityId: id,
      summary: `Kết luận tranh chấp dòng ${line.category} (${input.resolution}): ${input.reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: line,
      after: updatedLine,
    })
    return after
  })
}

/** UC-RS-06, RS-BR-09/22, AC-RS-004/005, CR-2026-003 — Accountant bấm "Xác định đối trừ cọc" để chốt. */
export async function reconcileDeposit(id: string, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
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
    const rental = readRentalOrThrow(before.rentalId)
    if (rental.status !== 'SETTLEMENT') {
      throw new Error(`Biên bản trả xe không còn hiệu lực (lượt thuê đang ở trạng thái ${rental.status}) — không thể gửi khách xác nhận`)
    }
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
    return after
  })
}

/** BRD §14, UC-RS-09 — `WAITING_APPROVAL → CONFIRMED`. */
export async function approveSettlement(id: string, note: string | undefined, actor: ActorInfo): Promise<Settlement> {
  return fakeRequest(() => {
    const existing = readAll()
    const before = findOrThrow(existing, id)
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
    return after
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
    const paymentStatus = type === 'COLLECT' ? (before.paymentStatus ?? 'UNPAID') : 'REFUND_PENDING' // §0.3 kế hoạch
    const after: Settlement = { ...before, paymentRequests: [...before.paymentRequests, request], paymentStatus, updatedAt: now }
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
    return after
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
  const existing = readAll()
  const before = findOrThrow(existing, id)
  const blockers = getCompletionBlockers(before)
  if (blockers.length > 0) {
    throw new Error('Chưa đủ điều kiện đóng lượt thuê (RS-BR-06/20, AC-RS-009).')
  }
  const rental = readRentalOrThrow(before.rentalId)
  if (!canCompleteRental(rental)) {
    throw new Error(`Lượt thuê đang ở trạng thái ${rental.status}, không thể đóng lượt (biên bản trả xe có thể đã bị huỷ).`)
  }
  const after = await fakeRequest(() => {
    const totals = calcSettlementTotals(before.lines, before.waivers)
    const now = new Date().toISOString()
    const completedWithDebt = (before.depositReconciliation?.balanceDue ?? 0) > 0
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
      summary: completedWithDebt ? `Đóng lượt thuê kèm công nợ (quyết toán ${id}) — OQ RS §28 Q11` : `Đóng lượt thuê (quyết toán ${id})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: result.status, completedWithDebt },
    })
    return result
  })
  await markRentalCompleted(before.rentalId, actor)
  return after
}
