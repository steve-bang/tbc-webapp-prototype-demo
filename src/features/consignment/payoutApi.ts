import type { AuditAction, PayoutStatus } from '@/shared/domain/enums'
import { can } from '@/shared/domain/permissions'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { toLocalDateKey, type ConsignmentActor } from './model'
import {
  applyOwnerPayoutLinked,
  applyOwnerPayoutPaid,
  applyOwnerPayoutReverted,
  applyOwnerPayoutUnlinked,
  canAdjust,
  canDecideAdjustment,
  canHold,
  canRelease,
  deriveAmountPayable,
  hasPendingAdjustment,
  materializeDrafts,
  periodOf,
  planPayoutGeneration,
  type OwnerPayoutAdjustment,
  type OwnerPayoutRecord,
} from './payoutModel'
import { readContracts, readPayoutRecords, writePayoutRecords } from './storage'

/**
 * Lớp dữ liệu "fake API" của lịch chi trả chủ xe (`docs/CONSIGNMENT-PLAN.md` mục 19.5.1).
 *
 * - Mọi hàm bất đồng bộ bọc `fakeRequest`; đọc, guard và ghi nằm TRONG callback.
 * - Mọi hàm ghi gọi `appendAudit` (VC-BR-17), entity `OwnerPayoutRecord`; payload không chứa số tài khoản.
 * - 4 hàm cuối (`link…`/`markOwnerPayoutRecordPaid`/`unlink…`/`revert…`) là hàm ĐỒNG BỘ, không `fakeRequest`:
 *   `features/finance` gọi chúng trong cùng callback `fakeRequest` của giao dịch (mirror `markSettlementOpened`
 *   của `rentals`) để trạng thái khoản chi trả và giao dịch đổi nguyên tử.
 */

const msg = vi.consignment.payouts

function audit(
  actor: ConsignmentActor,
  action: AuditAction,
  entityId: string,
  summary: string,
  before?: unknown,
  after?: unknown,
): void {
  appendAudit({
    action,
    entity: 'OwnerPayoutRecord',
    entityId,
    summary,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    before,
    after,
  })
}

function findOrThrow(items: OwnerPayoutRecord[], id: string): OwnerPayoutRecord {
  const found = items.find((r) => r.id === id)
  if (!found) throw new Error(msg.notFound)
  return found
}

function replaceRecord(items: OwnerPayoutRecord[], next: OwnerPayoutRecord): OwnerPayoutRecord[] {
  return items.map((r) => (r.id === next.id ? next : r))
}

function requireReason(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error(msg.reasonRequired)
  return trimmed
}

/** Ảnh chụp gọn để ghi audit — không có dữ liệu chủ xe nên không chứa số tài khoản. */
function snapshot(r: OwnerPayoutRecord): Record<string, unknown> {
  return { code: r.code, period: r.period, status: r.status, baseAmount: r.baseAmount, amountPayable: r.amountPayable, dueDate: r.dueDate }
}

// ============================================================================
// Truy vấn
// ============================================================================

export interface OwnerPayoutRecordFilter {
  contractId?: string
  ownerId?: string
  vehicleId?: string
  /** `YYYY-MM`. */
  period?: string
  status?: PayoutStatus
}

export async function listOwnerPayoutRecords(filter?: OwnerPayoutRecordFilter): Promise<OwnerPayoutRecord[]> {
  return fakeRequest(() =>
    readPayoutRecords()
      .filter((r) => !filter?.contractId || r.contractId === filter.contractId)
      .filter((r) => !filter?.ownerId || r.ownerId === filter.ownerId)
      .filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId)
      .filter((r) => !filter?.period || r.period === filter.period)
      .filter((r) => !filter?.status || r.status === filter.status)
      .sort((a, b) => b.period.localeCompare(a.period) || a.code.localeCompare(b.code)),
  )
}

export async function getOwnerPayoutRecord(id: string): Promise<OwnerPayoutRecord | undefined> {
  return fakeRequest(() => readPayoutRecords().find((r) => r.id === id))
}

// ============================================================================
// Sinh lịch · tạm giữ · điều chỉnh
// ============================================================================

/**
 * "Tác vụ nền đầu tháng" của prototype (không có tác vụ nền): sinh Record cho mọi hợp đồng `ACTIVE`/`SUSPENDED`
 * còn thiếu kỳ tới kỳ hiện tại. Idempotent — chạy lần hai không sinh thêm (VC-BR-21).
 */
export async function generateOwnerPayoutRecords(actor: ConsignmentActor): Promise<{ created: number; upToPeriod: string }> {
  return fakeRequest(() => {
    const now = new Date()
    const upToPeriod = periodOf(toLocalDateKey(now))
    const records = readPayoutRecords()
    const drafts = planPayoutGeneration(readContracts(), records, upToPeriod)
    if (drafts.length === 0) return { created: 0, upToPeriod }
    const created = materializeDrafts(drafts, records, { createdAt: now.toISOString(), createdByName: actor.fullName })
    writePayoutRecords([...records, ...created])
    audit(
      actor,
      'GENERATE_OWNER_PAYOUT_RECORDS',
      `batch:${upToPeriod}`,
      msg.auditGenerate(created.length, upToPeriod),
      undefined,
      created.map((r) => r.code),
    )
    return { created: created.length, upToPeriod }
  })
}

export async function holdOwnerPayoutRecord(id: string, reason: string, actor: ConsignmentActor): Promise<OwnerPayoutRecord> {
  return fakeRequest(() => {
    const all = readPayoutRecords()
    const before = findOrThrow(all, id)
    if (!canHold(before)) throw new Error(msg.holdNotAllowed)
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const after: OwnerPayoutRecord = {
      ...before,
      status: 'ON_HOLD',
      holdReason: trimmed,
      statusHistory: [...before.statusHistory, { from: before.status, to: 'ON_HOLD', at: now, byName: actor.fullName, reason: trimmed }],
      updatedAt: now,
    }
    writePayoutRecords(replaceRecord(all, after))
    audit(actor, 'HOLD_OWNER_PAYOUT_RECORD', id, msg.auditHold(before.code, trimmed), snapshot(before), { ...snapshot(after), reason: trimmed })
    return after
  })
}

export async function releaseOwnerPayoutRecord(id: string, reason: string, actor: ConsignmentActor): Promise<OwnerPayoutRecord> {
  return fakeRequest(() => {
    const all = readPayoutRecords()
    const before = findOrThrow(all, id)
    if (!canRelease(before)) throw new Error(msg.releaseNotAllowed)
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const after: OwnerPayoutRecord = {
      ...before,
      status: 'SCHEDULED',
      holdReason: undefined,
      statusHistory: [...before.statusHistory, { from: before.status, to: 'SCHEDULED', at: now, byName: actor.fullName, reason: trimmed }],
      updatedAt: now,
    }
    writePayoutRecords(replaceRecord(all, after))
    audit(actor, 'RELEASE_OWNER_PAYOUT_RECORD', id, msg.auditRelease(before.code, trimmed), snapshot(before), { ...snapshot(after), reason: trimmed })
    return after
  })
}

export interface OwnerPayoutAdjustmentInput {
  /** Số nguyên khác 0, có dấu. */
  amount: number
  note: string
}

/**
 * UC-VC-08 A2 — nhập điều chỉnh thủ công. Người có `EDIT` **và** `APPROVE` (Admin/Manager) tự duyệt → hiệu lực ngay;
 * người chỉ có `EDIT` (Accountant) → `PENDING_APPROVAL`, chờ người có cả hai quyền duyệt. Mỗi Record tối đa 1 điều chỉnh chờ duyệt.
 */
export async function requestOwnerPayoutAdjustment(
  id: string,
  input: OwnerPayoutAdjustmentInput,
  actor: ConsignmentActor,
): Promise<OwnerPayoutRecord> {
  return fakeRequest(() => {
    const all = readPayoutRecords()
    const before = findOrThrow(all, id)
    if (!Number.isInteger(input.amount) || input.amount === 0) throw new Error(msg.adjustAmountInvalid)
    const note = input.note.trim()
    if (note.length < 3) throw new Error(msg.adjustNoteRequired)
    if (!canAdjust(before)) throw new Error(msg.adjustNotAllowed)
    if (hasPendingAdjustment(before)) throw new Error(msg.adjustPendingExists)
    if (before.amountPayable + input.amount <= 0) throw new Error(msg.adjustResultNotPositive)

    // Ngoại lệ thứ 2 của quy ước "chỉ gate quyền ở UI" (ngoại lệ thứ nhất: `revealOwnerBankAccount`): đây KHÔNG phải chặn
    // quyền mà là quyết định luồng duyệt — người nhập có đủ quyền duyệt thì điều chỉnh có hiệu lực ngay (UC-VC-08 A2).
    const selfApprove = can(actor.role, 'CONSIGNMENT', 'EDIT') && can(actor.role, 'CONSIGNMENT', 'APPROVE')
    const now = new Date().toISOString()
    const adjustment: OwnerPayoutAdjustment = {
      id: generateId('opa'),
      amount: input.amount,
      note,
      status: selfApprove ? 'APPROVED' : 'PENDING_APPROVAL',
      requestedByName: actor.fullName,
      requestedByRole: actor.role,
      requestedAt: now,
      decidedByName: selfApprove ? actor.fullName : undefined,
      decidedAt: selfApprove ? now : undefined,
    }
    const adjustments = [...before.adjustments, adjustment]
    const after: OwnerPayoutRecord = {
      ...before,
      adjustments,
      amountPayable: deriveAmountPayable({ baseAmount: before.baseAmount, adjustments }),
      updatedAt: now,
    }
    writePayoutRecords(replaceRecord(all, after))
    audit(actor, 'ADJUST_OWNER_PAYOUT_RECORD', id, msg.auditAdjust(before.code, input.amount, note, selfApprove), snapshot(before), {
      ...snapshot(after),
      adjustment: { amount: adjustment.amount, note, status: adjustment.status },
    })
    if (selfApprove) {
      audit(actor, 'APPROVE_OWNER_PAYOUT_ADJUSTMENT', id, msg.auditApprove(before.code, input.amount), undefined, {
        adjustmentId: adjustment.id,
        status: adjustment.status,
      })
    }
    return after
  })
}

export interface OwnerPayoutAdjustmentDecision {
  decision: 'APPROVED' | 'REJECTED'
  note?: string
}

export async function decideOwnerPayoutAdjustment(
  id: string,
  adjustmentId: string,
  input: OwnerPayoutAdjustmentDecision,
  actor: ConsignmentActor,
): Promise<OwnerPayoutRecord> {
  return fakeRequest(() => {
    const all = readPayoutRecords()
    const before = findOrThrow(all, id)
    const adjustment = before.adjustments.find((a) => a.id === adjustmentId)
    if (!adjustment) throw new Error(msg.adjustNotFound)
    if (!canDecideAdjustment(before, adjustment)) throw new Error(msg.adjustDecideNotAllowed)
    const note = input.note?.trim() || undefined
    if (input.decision === 'REJECTED' && (!note || note.length < 3)) throw new Error(msg.rejectReasonRequired)
    if (input.decision === 'APPROVED' && before.amountPayable + adjustment.amount <= 0) throw new Error(msg.adjustResultNotPositive)

    const now = new Date().toISOString()
    const adjustments = before.adjustments.map((a) =>
      a.id === adjustmentId ? { ...a, status: input.decision, decidedByName: actor.fullName, decidedAt: now, decisionNote: note } : a,
    )
    const after: OwnerPayoutRecord = {
      ...before,
      adjustments,
      amountPayable: deriveAmountPayable({ baseAmount: before.baseAmount, adjustments }),
      updatedAt: now,
    }
    writePayoutRecords(replaceRecord(all, after))
    if (input.decision === 'APPROVED') {
      audit(actor, 'APPROVE_OWNER_PAYOUT_ADJUSTMENT', id, msg.auditApprove(before.code, adjustment.amount), snapshot(before), snapshot(after))
    } else {
      audit(actor, 'REJECT_OWNER_PAYOUT_ADJUSTMENT', id, msg.auditReject(before.code, adjustment.amount, note ?? ''), snapshot(before), snapshot(after))
    }
    return after
  })
}

// ============================================================================
// 4 hàm đồng bộ cho `features/finance` — gọi trong cùng callback `fakeRequest` của giao dịch
// ============================================================================

export interface OwnerPayoutLinkInput {
  paymentRequestId: string
  transactionId: string
  transactionCode: string
}

/** Tạo lệnh chi → gắn liên kết (Record `SCHEDULED`, chưa có lệnh chi). */
export function linkOwnerPayoutRecord(
  recordId: string,
  input: OwnerPayoutLinkInput,
  actor: ConsignmentActor,
  now: string,
): OwnerPayoutRecord {
  const all = readPayoutRecords()
  const before = findOrThrow(all, recordId)
  if (before.status !== 'SCHEDULED' || before.payout) throw new Error(msg.linkNotAllowed)
  const after = applyOwnerPayoutLinked(before, { ...input, at: now, byName: actor.fullName })
  writePayoutRecords(replaceRecord(all, after))
  audit(actor, 'LINK_OWNER_PAYOUT_RECORD', recordId, msg.auditLink(before.code, input.transactionCode), snapshot(before), {
    ...snapshot(after),
    transactionCode: input.transactionCode,
  })
  return after
}

/** Giao dịch chi `CONFIRMED` → Record `PAID`. */
export function markOwnerPayoutRecordPaid(
  recordId: string,
  input: { transactionId: string; paidAt: string },
  actor: ConsignmentActor,
  now: string,
): OwnerPayoutRecord {
  const all = readPayoutRecords()
  const before = findOrThrow(all, recordId)
  if (before.status !== 'SCHEDULED' || before.payout?.transactionId !== input.transactionId) throw new Error(msg.paidNotAllowed)
  const after = applyOwnerPayoutPaid(before, { paidAt: input.paidAt, byName: actor.fullName })
  writePayoutRecords(replaceRecord(all, { ...after, updatedAt: now }))
  audit(actor, 'MARK_OWNER_PAYOUT_RECORD_PAID', recordId, msg.auditPaid(before.code, before.payout.transactionCode), snapshot(before), snapshot(after))
  return after
}

/** Giao dịch chi `FAILED`/`VOIDED` → gỡ liên kết; Record vẫn `SCHEDULED`. */
export function unlinkOwnerPayoutRecord(
  recordId: string,
  input: { transactionId: string; reason: string },
  actor: ConsignmentActor,
  now: string,
): OwnerPayoutRecord {
  const all = readPayoutRecords()
  const before = findOrThrow(all, recordId)
  if (before.status !== 'SCHEDULED' || before.payout?.transactionId !== input.transactionId) throw new Error(msg.unlinkNotAllowed)
  const after = applyOwnerPayoutUnlinked(before, { at: now, byName: actor.fullName, reason: input.reason })
  writePayoutRecords(replaceRecord(all, after))
  audit(actor, 'UNLINK_OWNER_PAYOUT_RECORD', recordId, msg.auditUnlink(before.code, before.payout.transactionCode, input.reason), snapshot(before), snapshot(after))
  return after
}

/** Giao dịch đã chi bị đảo → Record `PAID` về `SCHEDULED`, gỡ liên kết (VC-BR-13). */
export function revertOwnerPayoutRecordPaid(
  recordId: string,
  input: { transactionId: string; reason: string },
  actor: ConsignmentActor,
  now: string,
): OwnerPayoutRecord {
  const all = readPayoutRecords()
  const before = findOrThrow(all, recordId)
  if (before.status !== 'PAID' || before.payout?.transactionId !== input.transactionId) throw new Error(msg.revertNotAllowed)
  const after = applyOwnerPayoutReverted(before, { at: now, byName: actor.fullName, reason: input.reason })
  writePayoutRecords(replaceRecord(all, after))
  audit(actor, 'REVERT_OWNER_PAYOUT_RECORD_PAID', recordId, msg.auditRevert(before.code, before.payout.transactionCode, input.reason), snapshot(before), snapshot(after))
  return after
}
