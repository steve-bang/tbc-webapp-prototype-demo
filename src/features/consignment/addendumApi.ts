import { vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { formatVnd } from '@/shared/lib/money'
import { planAddendum, type ConsignmentAddendum, type ConsignmentAddendumDraftInput } from './addendumModel'
import { nextSequenceCode, toLocalDateKey, type ConsignmentActor, type ConsignmentContract } from './model'
import { applyContractEndPlan } from './payoutModel'
import { readContracts, readPayoutRecords, writeContracts, writePayoutRecords } from './storage'

/**
 * Lập phụ lục hợp đồng ký gửi (`docs/CONSIGNMENT-PLAN.md` mục 20.7.2). Đọc, guard, tính lại khoản chi trả và ghi nằm trong CÙNG
 * một callback `fakeRequest`; lỗi ở bất kỳ bước nào → `throw`, không ghi gì. Phụ lục hiệu lực ngay khi lập (không có nháp / duyệt)
 * và không bao giờ sửa / xoá (VC-BR-18). Kiểm quyền ở UI (tiền lệ của repo).
 */

const t = vi.consignment.addenda

export interface CreateConsignmentAddendumResult {
  contract: ConsignmentContract
  addendum: ConsignmentAddendum
  cancelledCount: number
  createdCount: number
}

/** Ảnh chụp điều khoản đang là phiên bản mới nhất — dùng cho before/after của audit. */
function snapshotLatest(contract: ConsignmentContract) {
  const latest = contract.termVersions.reduce<ConsignmentContract['termVersions'][number] | undefined>(
    (max, v) => (!max || v.versionNo > max.versionNo ? v : max),
    undefined,
  )
  const term = latest?.paymentTerm ?? contract.paymentTerm
  return {
    effectiveTo: contract.effectiveTo,
    termVersionNo: latest?.versionNo ?? 1,
    fixedMonthlyAmount: term.fixedMonthlyAmount,
    paymentDay: term.paymentDay,
    prorationRule: term.prorationRule,
  }
}

function describeAddendum(addendum: ConsignmentAddendum): string {
  const parts: string[] = []
  if (addendum.extension) parts.push(t.auditPartExtension(formatDate(addendum.extension.toEffectiveTo)))
  if (addendum.termChange) {
    const { from, to, effectiveFrom } = addendum.termChange
    parts.push(
      t.auditPartTerm(formatVnd(from.fixedMonthlyAmount), formatVnd(to.fixedMonthlyAmount), formatDate(effectiveFrom), from.paymentDay, to.paymentDay),
    )
  }
  return parts.join('; ')
}

export async function createConsignmentAddendum(
  contractId: string,
  input: ConsignmentAddendumDraftInput,
  actor: ConsignmentActor,
): Promise<CreateConsignmentAddendumResult> {
  return fakeRequest(() => {
    const contracts = readContracts()
    const before = contracts.find((c) => c.id === contractId)
    if (!before) throw new Error(t.contractNotFound)
    if (input.content.trim().length < 3) throw new Error(t.contentRequired)
    if (!input.signedFileName.trim()) throw new Error(t.signedFileRequired)

    const now = new Date().toISOString()
    const records = readPayoutRecords()
    const addendumNo = nextSequenceCode(
      'PLKG',
      contracts.flatMap((c) => c.addenda.map((a) => a.addendumNo)),
    )
    const result = planAddendum(before, records, input, toLocalDateKey(new Date()), {
      id: generateId('cga'),
      addendumNo,
      byName: actor.fullName,
      now,
    })
    if ('error' in result) throw new Error(result.error)

    const { addendum, contractAfter, plan } = result
    const applied = applyContractEndPlan(records, plan, {
      now,
      byName: actor.fullName,
      cancelReason: t.cancelReasonRecalc(addendum.addendumNo),
    })
    if (plan.cancel.length > 0 || plan.create.length > 0) writePayoutRecords(applied.records)
    writeContracts(contracts.map((c) => (c.id === contractId ? contractAfter : c)))

    appendAudit({
      action: 'CREATE_CONSIGNMENT_ADDENDUM',
      entity: 'ConsignmentContract',
      entityId: contractId,
      summary: t.auditCreate(addendum.addendumNo, before.contractNo, describeAddendum(addendum)),
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: snapshotLatest(before),
      after: snapshotLatest(contractAfter),
    })
    for (const r of applied.cancelled) {
      appendAudit({
        action: 'CANCEL_OWNER_PAYOUT_RECORD',
        entity: 'OwnerPayoutRecord',
        entityId: r.id,
        summary: vi.consignment.termination.auditCancelRecord(r.code, r.period, t.cancelReasonRecalc(addendum.addendumNo)),
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        after: { code: r.code, period: r.period, status: r.status, replacedByRecordId: r.replacedByRecordId },
      })
    }
    if (applied.created.length > 0) {
      appendAudit({
        action: 'GENERATE_OWNER_PAYOUT_RECORDS',
        entity: 'OwnerPayoutRecord',
        entityId: `contract:${contractId}`,
        summary: t.auditGenerate(applied.created.length, before.contractNo, addendum.addendumNo),
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        after: applied.created.map((r) => r.code),
      })
    }
    return { contract: contractAfter, addendum, cancelledCount: applied.cancelled.length, createdCount: applied.created.length }
  })
}
