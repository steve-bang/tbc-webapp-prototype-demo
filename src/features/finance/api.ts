// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2),
// không deep-import `/api`/`/hooks`/`/model` của 3 feature nguồn.
import { listReturns, type ReturnRecord } from '@/features/handover-return'
import { INCIDENTS_STORAGE_KEY, listIncidents, type Incident } from '@/features/incidents'
import { MAINTENANCE_RECORDS_STORAGE_KEY, SPARE_PART_RECORDS_STORAGE_KEY, type MaintenanceRecord, type SparePartRecord } from '@/features/maintenance'
import {
  RENTALS_STORAGE_KEY,
  canCompleteRental,
  canOpenSettlement,
  markRentalCompleted,
  markSettlementOpened,
  revertSettlementReversed,
  type Rental,
} from '@/features/rentals'
import type {
  AllocationType,
  CostCategory,
  PaymentMethod,
  PaymentRequestSource,
  PaymentRequestStatus,
  PostSettlementChargeSource,
  PostSettlementChargeStatus,
  PostSettlementChargeType,
  Role,
  SettlementRequestType,
  SettlementStatus,
  SettlementWaiverType,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { formatDate } from '@/shared/lib/datetime'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  buildOffsetTransaction,
  buildPscPaymentRequest,
  buildReversalPair,
  buildReversalReset,
  buildScheduleRequests,
  buildSettlementPaymentRequest,
  buildSourceLines,
  calcCashDrawerBalance,
  calcDepositHeld,
  calcDepositReconciliation,
  calcLedgerDepositHeld,
  calcPaidToDate,
  calcRequestProgress,
  calcSettlementTotals,
  canAdjustSettlement,
  canCreatePostSettlementCharge,
  canReverseSettlement,
  canScheduleRental,
  cashDrawerIdOf,
  deriveCashEntries,
  deriveIncidentCostEntries,
  deriveMaintenanceCostEntries,
  deriveRentalPaymentSummary,
  deriveRequestStatus,
  deriveRevenueLines,
  directionOf,
  expandCostRecord,
  findEffectiveOffset,
  fixedPscType,
  calcSettlementCollectOutstanding,
  getCompletionBlockers,
  getIncidentPscBlocker,
  getLineDiscountedAmount,
  getSubmitBlockers,
  isEffectiveTransaction,
  isFinanceReportKey,
  isManualCostCategory,
  isPscOnHold,
  isRequestActionable,
  mergeResyncedLines,
  nextSequenceCode,
  pscAmountForIncident,
  refundNeedsApproval,
  toLocalDateKey,
  waiverNeedsApproval,
  type CashDrawerSubmission,
  type CashEntry,
  type CostEntry,
  type CostRecord,
  type DepositReconciliation,
  type FinanceReportKey,
  type PaymentRequest,
  type PostSettlementCharge,
  type PscBlockerCode,
  type Receipt,
  type ReportExportFilters,
  type RevenueLine,
  type Settlement,
  type SettlementLine,
  type SettlementPaymentRequest,
  type SettlementWaiver,
  type Transaction,
} from './model'

export const SETTLEMENTS_STORAGE_KEY = 'settlements'
export const POST_SETTLEMENT_CHARGES_STORAGE_KEY = 'postSettlementCharges'

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

/**
 * Nợ 4 (N4, `docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) — chặn mọi thao tác sửa
 * Worksheet khi biên bản trả xe đã bị huỷ (Rental không còn ở `SETTLEMENT`).
 * Cùng thông điệp với guard cũ của `submitForCustomer`.
 */
function assertRentalInSettlement(rentalId: string): Rental {
  const rental = readRentalOrThrow(rentalId)
  if (rental.status !== 'SETTLEMENT') {
    throw new Error(`Biên bản trả xe không còn hiệu lực (lượt thuê đang ở trạng thái ${rental.status}) — không thể gửi khách xác nhận`)
  }
  return rental
}

function readAllPsc(): PostSettlementCharge[] {
  return readJson<PostSettlementCharge[]>(POST_SETTLEMENT_CHARGES_STORAGE_KEY) ?? []
}
function writeAllPsc(items: PostSettlementCharge[]): void {
  writeJson(POST_SETTLEMENT_CHARGES_STORAGE_KEY, items)
}

/** Vietnamese cho từng `PscBlockerCode` (§10.4 kế hoạch) — dùng chung lỗi API + nhãn UI (`PostSettlementChargeDialog`). */
export const PSC_BLOCKER_MESSAGES: Record<PscBlockerCode, string> = {
  ALREADY_IN_SETTLEMENT: 'Sự cố đã có dòng trong quyết toán kỳ gốc — dùng Điều chỉnh nếu sai số.',
  ALREADY_HAS_PSC: 'Sự cố đã có khoản phát sinh sau quyết toán.',
  NOT_CUSTOMER_LIABILITY: 'Sự cố không do khách chịu trách nhiệm.',
  INCIDENT_VOID: 'Sự cố đã huỷ/đóng không tính phí/ghi giảm giá trị.',
  CUSTOMER_CHARGE_NOT_FINAL: 'Sự cố chưa chốt Customer Charge (chưa duyệt hoặc chưa xác định trách nhiệm).',
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
    assertRentalInSettlement(before.rentalId)
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

export interface PostSettlementChargeFilter {
  settlementId?: string
  rentalId?: string
  status?: PostSettlementChargeStatus
}

export async function listPostSettlementCharges(filter?: PostSettlementChargeFilter): Promise<PostSettlementCharge[]> {
  return fakeRequest(() =>
    readAllPsc().filter((p) => {
      if (filter?.settlementId && p.settlementId !== filter.settlementId) return false
      if (filter?.rentalId && p.rentalId !== filter.rentalId) return false
      if (filter?.status && p.status !== filter.status) return false
      return true
    }),
  )
}

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

// ==== Payment (PM) — PAYMENT-PLAN.md §9 ====

export const PAYMENT_REQUESTS_STORAGE_KEY = 'paymentRequests'
export const TRANSACTIONS_STORAGE_KEY = 'transactions'
export const CASH_DRAWER_SUBMISSIONS_STORAGE_KEY = 'cashDrawerSubmissions'

function readAllPaymentRequests(): PaymentRequest[] {
  return readJson<PaymentRequest[]>(PAYMENT_REQUESTS_STORAGE_KEY) ?? []
}
function writeAllPaymentRequests(items: PaymentRequest[]): void {
  writeJson(PAYMENT_REQUESTS_STORAGE_KEY, items)
}
function readAllTransactions(): Transaction[] {
  return readJson<Transaction[]>(TRANSACTIONS_STORAGE_KEY) ?? []
}
function writeAllTransactions(items: Transaction[]): void {
  writeJson(TRANSACTIONS_STORAGE_KEY, items)
}
function readAllCashDrawerSubmissions(): CashDrawerSubmission[] {
  return readJson<CashDrawerSubmission[]>(CASH_DRAWER_SUBMISSIONS_STORAGE_KEY) ?? []
}
function writeAllCashDrawerSubmissions(items: CashDrawerSubmission[]): void {
  writeJson(CASH_DRAWER_SUBMISSIONS_STORAGE_KEY, items)
}

/**
 * PAYMENT-PLAN.md §10.4 — helper ghi ngược DUY NHẤT, thay `syncRequestStatus`
 * (Round 1). Gọi ở CUỐI mọi callback ghi có thể làm đổi số liệu của Rental,
 * SAU khi đã ghi `transactions`/`paymentRequests`. Đọc storage MỚI NHẤT (không
 * nhận mảng từ caller) để tránh đọc lệch.
 */
function syncFinanceAfterPaymentChange(rentalId: string, actor: ActorInfo, now: string): { settlementPaymentStatus?: Settlement['paymentStatus']; closedPscIds: string[] } {
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
function applyDepositOffsetInCallback(settlement: Settlement, actor: ActorInfo, now: string): void {
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
  const requestPre = readAllPaymentRequests().find((r) => r.id === input.paymentRequestId)
  if (!requestPre) throw new Error('Không tìm thấy yêu cầu thanh toán')
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
    const request = prList.find((r) => r.id === input.paymentRequestId)
    if (!request) throw new Error('Không tìm thấy yêu cầu thanh toán')
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
  const requestPre = readAllPaymentRequests().find((r) => r.id === requestId)
  if (!requestPre) throw new Error('Không tìm thấy yêu cầu thanh toán')
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
    const request = prList.find((r) => r.id === requestId)
    if (!request) throw new Error('Không tìm thấy yêu cầu thanh toán')
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

// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §6 ====

export const COST_RECORDS_STORAGE_KEY = 'costRecords'

function readAllCostRecords(): CostRecord[] {
  return readJson<CostRecord[]>(COST_RECORDS_STORAGE_KEY) ?? []
}
function writeAllCostRecords(items: CostRecord[]): void {
  writeJson(COST_RECORDS_STORAGE_KEY, items)
}

export interface RevenueLineFilter {
  vehicleId?: string
  customerId?: string
  rentalId?: string
}

/** Revenue Line không lưu (§0.3 điểm 1) — suy ra từ Settlement + PSC. Không lọc kỳ ở API (hàm thuần lọc, cần cả kỳ trước). */
export async function listRevenueLines(filter?: RevenueLineFilter): Promise<RevenueLine[]> {
  return fakeRequest(() =>
    deriveRevenueLines(readAll(), readAllPsc()).filter((l) => {
      if (filter?.vehicleId && l.vehicleId !== filter.vehicleId) return false
      if (filter?.customerId && l.customerId !== filter.customerId) return false
      if (filter?.rentalId && l.rentalId !== filter.rentalId) return false
      return true
    }),
  )
}

export interface CostRecordFilter {
  vehicleId?: string
  includeReversed?: boolean
}

/** Cost Record nhập tay đã lưu, mới nhất trước theo `costDate`. */
export async function listCostRecords(filter?: CostRecordFilter): Promise<CostRecord[]> {
  return fakeRequest(() =>
    readAllCostRecords()
      .filter((r) => (filter?.includeReversed ? true : r.status === 'ACTIVE'))
      .filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId)
      .sort((a, b) => b.costDate.localeCompare(a.costDate) || b.enteredAt.localeCompare(a.enteredAt)),
  )
}

export interface CostEntryFilter {
  vehicleId?: string
}

/** View chi phí thống nhất: nhập tay (đã rải kỳ) + sự cố + bảo dưỡng/phụ tùng — RV-BR-04/11, sửa ở module nguồn. */
export async function listCostEntries(filter?: CostEntryFilter): Promise<CostEntry[]> {
  return fakeRequest(() => {
    const manual = readAllCostRecords().flatMap(expandCostRecord)
    const incident = deriveIncidentCostEntries(readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? [])
    const maintenance = deriveMaintenanceCostEntries(
      readJson<MaintenanceRecord[]>(MAINTENANCE_RECORDS_STORAGE_KEY) ?? [],
      readJson<SparePartRecord[]>(SPARE_PART_RECORDS_STORAGE_KEY) ?? [],
    )
    // Phase 5 (features/consignment) — Owner Payout Record → CostEntry CONSIGNMENT_PAYOUT, DIRECT, Recognition Date = tháng chi trả (RV-BR-19, CR-2026-050).
    return [...manual, ...incident, ...maintenance]
      .filter((c) => !filter?.vehicleId || c.vehicleId === filter.vehicleId)
      .sort((a, b) => b.costDate.localeCompare(a.costDate))
  })
}

export interface CashEntryFilter {
  customerId?: string
}

/** Góc nhìn thực thu (RV-BR-14) suy ra từ sổ giao dịch hiệu lực. */
export async function listCashEntries(filter?: CashEntryFilter): Promise<CashEntry[]> {
  return fakeRequest(() => deriveCashEntries(readAllTransactions()).filter((c) => !filter?.customerId || c.customerId === filter.customerId))
}

export interface CostRecordInput {
  category: CostCategory
  amount: number
  /** `YYYY-MM-DD`. */
  costDate: string
  allocationType: AllocationType
  vehicleId?: string
  rentalId?: string
  spreadMonths: number
  isUnusual: boolean
  evidenceNote?: string
  note?: string
}

const COST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Guard dùng chung cho tạo/sửa — lặp lại ở API, không chỉ dựa vào schema của form (RV-BR-04, RV-BR-19, BRD §9 BR). */
function assertCostRecordInput(input: CostRecordInput): void {
  if (!isManualCostCategory(input.category)) {
    throw new Error('Chi phí sự cố và chi trả chủ xe ký gửi được ghi nhận tự động, không nhập tay')
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error('Số tiền phải là số nguyên dương')
  if (!COST_DATE_RE.test(input.costDate)) throw new Error('Ngày chi phí không hợp lệ')
  if (input.costDate > toLocalDateKey(new Date().toISOString())) throw new Error('Ngày chi phí không được ở tương lai')
  if (!Number.isInteger(input.spreadMonths) || input.spreadMonths < 1 || input.spreadMonths > 36) {
    throw new Error('Số tháng rải phải là số nguyên từ 1 đến 36')
  }
  if (input.allocationType === 'DIRECT') {
    if (!input.vehicleId) throw new Error('Chi phí trực tiếp phải gắn với một xe')
  } else if (input.vehicleId || input.rentalId) {
    throw new Error('Chi phí gián tiếp không gắn xe hoặc lượt thuê')
  }
  if (input.rentalId) {
    const rental = (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []).find((r) => r.id === input.rentalId)
    if (!rental) throw new Error('Không tìm thấy lượt thuê')
    if (rental.vehicleId !== input.vehicleId) throw new Error('Lượt thuê không thuộc xe đã chọn')
  }
}

const COST_RECORD_DIFF_KEYS = ['category', 'amount', 'costDate', 'allocationType', 'vehicleId', 'rentalId', 'spreadMonths', 'isUnusual', 'evidenceNote', 'note'] as const

/**
 * UC-RV-03, BRD §18 — nhập chi phí thủ công (`Source = MANUAL`). RV-BR-17: KHÔNG tự tạo giao dịch Payment.
 * RV-BR-16: audit đầy đủ.
 */
export async function createCostRecord(input: CostRecordInput, actor: ActorInfo): Promise<CostRecord> {
  return fakeRequest(() => {
    assertCostRecordInput(input)
    const records = readAllCostRecords()
    const now = new Date().toISOString()
    const record: CostRecord = {
      id: generateId('cst'),
      code: nextSequenceCode('CP', records.map((r) => r.code)),
      category: input.category,
      amount: input.amount,
      costDate: input.costDate,
      allocationType: input.allocationType,
      vehicleId: input.vehicleId || undefined,
      rentalId: input.rentalId || undefined,
      spreadMonths: input.spreadMonths,
      isUnusual: input.isUnusual,
      evidenceNote: input.evidenceNote || undefined,
      note: input.note || undefined,
      status: 'ACTIVE',
      enteredByName: actor.fullName,
      enteredByRole: actor.role,
      enteredAt: now,
      updatedAt: now,
    }
    writeAllCostRecords([...records, record])
    appendAudit({
      action: 'COST_MANUAL_CREATE',
      entity: 'CostRecord',
      entityId: record.id,
      summary: `Thêm chi phí ${record.code} (${record.category}) ${record.amount.toLocaleString('vi-VN')}đ`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: record,
    })
    return record
  })
}

/**
 * UC-RV-04, AC-RV-013 — sửa chi phí nhập tay, audit ghi giá trị cũ → mới của các field đổi.
 * TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close; mọi bản ghi coi như thuộc kỳ đang mở, RV-BR-10)
 * TODO(OQ: RevenueCost-UseCase.md UC-RV-04 bước 2 — "lý do nếu thay đổi lớn", chưa có ngưỡng)
 */
export async function updateCostRecord(id: string, input: CostRecordInput, actor: ActorInfo): Promise<CostRecord> {
  return fakeRequest(() => {
    const records = readAllCostRecords()
    const before = records.find((r) => r.id === id)
    if (!before) throw new Error('Không tìm thấy chi phí')
    if (before.status !== 'ACTIVE') throw new Error('Chỉ sửa được chi phí đang hiệu lực')
    assertCostRecordInput(input)
    const next = {
      category: input.category,
      amount: input.amount,
      costDate: input.costDate,
      allocationType: input.allocationType,
      vehicleId: input.vehicleId || undefined,
      rentalId: input.rentalId || undefined,
      spreadMonths: input.spreadMonths,
      isUnusual: input.isUnusual,
      evidenceNote: input.evidenceNote || undefined,
      note: input.note || undefined,
    }
    const changedKeys = COST_RECORD_DIFF_KEYS.filter((k) => before[k] !== next[k])
    if (changedKeys.length === 0) return before
    const now = new Date().toISOString()
    const after: CostRecord = { ...before, ...next, updatedByName: actor.fullName, updatedAt: now }
    writeAllCostRecords(records.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'COST_MANUAL_UPDATE',
      entity: 'CostRecord',
      entityId: id,
      summary: `Sửa chi phí ${before.code}: ${changedKeys.join(', ')}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: Object.fromEntries(changedKeys.map((k) => [k, before[k]])),
      after: Object.fromEntries(changedKeys.map((k) => [k, after[k]])),
    })
    return after
  })
}

/**
 * RV-BR-10, `RevenueCost-BRD.md` §25.4 — "xoá" chi phí nhập tay = huỷ mềm (không xoá vật lý), lý do bắt buộc.
 * TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close; mọi bản ghi coi như thuộc kỳ đang mở, RV-BR-10)
 */
export async function reverseCostRecord(id: string, reason: string, actor: ActorInfo): Promise<CostRecord> {
  const trimmedReason = reason.trim()
  if (trimmedReason.length < 5) throw new Error('Lý do huỷ là bắt buộc (tối thiểu 5 ký tự)')
  return fakeRequest(() => {
    const records = readAllCostRecords()
    const before = records.find((r) => r.id === id)
    if (!before) throw new Error('Không tìm thấy chi phí')
    if (before.status !== 'ACTIVE') throw new Error('Chi phí này đã được huỷ trước đó')
    const now = new Date().toISOString()
    const after: CostRecord = { ...before, status: 'REVERSED', reverseReason: trimmedReason, reversedByName: actor.fullName, reversedAt: now, updatedByName: actor.fullName, updatedAt: now }
    writeAllCostRecords(records.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'COST_MANUAL_REVERSE',
      entity: 'CostRecord',
      entityId: id,
      summary: `Huỷ chi phí ${before.code}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: after.status, reason: trimmedReason },
    })
    return after
  })
}

export interface RecordReportExportInput {
  reportKey: FinanceReportKey
  /** `yyyy-MM-dd`. */
  from: string
  /** `yyyy-MM-dd`. */
  to: string
  /** Số dòng dữ liệu của file (không tính khối đầu, dòng tên cột, dòng tổng). */
  rowCount: number
  filters: ReportExportFilters
}

const REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Chỉ giữ các khoá bộ lọc đã biết, đúng kiểu id/enum/boolean — không để lọt tên/SĐT khách vào audit (AuditLog-BRD.md §11). */
function sanitizeReportFilters(filters: ReportExportFilters): ReportExportFilters {
  const safe: ReportExportFilters = {}
  if (typeof filters.vehicleId === 'string') safe.vehicleId = filters.vehicleId
  if (typeof filters.customerId === 'string') safe.customerId = filters.customerId
  if (filters.customerStatus === 'ACTIVE' || filters.customerStatus === 'BLOCKED') safe.customerStatus = filters.customerStatus
  if (filters.granularity === 'DAY' || filters.granularity === 'WEEK' || filters.granularity === 'MONTH') safe.granularity = filters.granularity
  if (typeof filters.sortKey === 'string') safe.sortKey = filters.sortKey
  if (typeof filters.excludeUnusual === 'boolean') safe.excludeUnusual = filters.excludeUnusual
  return safe
}

/**
 * UC-RV-13 / AuditLog — ghi ĐÚNG một bản ghi `REPORT_EXPORT` mỗi lần xuất; UI chỉ tải file sau khi hàm này thành công.
 * Không ghi họ tên/SĐT/CCCD khách: `filters` chỉ chứa id/enum/boolean.
 * TODO(OQ: RevenueCost-BRD.md §28 Q14 — định dạng xuất PDF/Excel chưa chốt; demo xuất CSV mở bằng Excel)
 */
export async function recordReportExport(input: RecordReportExportInput, actor: ActorInfo): Promise<void> {
  return fakeRequest(() => {
    if (!isFinanceReportKey(input.reportKey)) throw new Error(vi.finance.reports.exportAuditInvalid)
    if (!REPORT_DATE_RE.test(input.from) || !REPORT_DATE_RE.test(input.to) || input.from > input.to) throw new Error(vi.finance.reports.exportAuditInvalid)
    if (!Number.isInteger(input.rowCount) || input.rowCount < 0) throw new Error(vi.finance.reports.exportAuditInvalid)
    const filters = sanitizeReportFilters(input.filters)
    appendAudit({
      action: 'REPORT_EXPORT',
      entity: 'FinanceReport',
      entityId: input.reportKey,
      summary: vi.finance.reports.exportAuditSummary
        .replace('{report}', vi.finance.reports.exportNames[input.reportKey])
        .replace('{from}', formatDate(input.from))
        .replace('{to}', formatDate(input.to))
        .replace('{count}', String(input.rowCount)),
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: { reportKey: input.reportKey, from: input.from, to: input.to, rowCount: input.rowCount, filters },
    })
  })
}
