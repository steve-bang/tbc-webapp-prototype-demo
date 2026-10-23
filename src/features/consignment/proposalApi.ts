import type { AuditAction, ConsignmentProposalStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_PROPOSAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { formatVnd } from '@/shared/lib/money'
import { INTAKE_CHECKLIST_KEYS, INTAKE_DOCUMENT_KEYS, nextSequenceCode, type ConsignmentActor, type VehicleOwner } from './model'
import {
  canTransitionProposal,
  findVehicleByPlate,
  getProposalApprovalBlocker,
  getProposalCreateBlocker,
  PROPOSAL_OWNERSHIP_CHECKS,
  type ConsignmentAppraisal,
  type ConsignmentProposal,
  type ConsignmentProposalStatusChange,
  type ConsignmentProposalVehicle,
} from './proposalModel'
import { readContracts, readOwners, readProposals, readVehicles, writeProposals } from './storage'

/**
 * Lớp dữ liệu "fake API" của đề nghị ký gửi & thẩm định (`docs/CONSIGNMENT-PLAN.md` mục 20.7.1).
 *
 * - Mọi đọc, guard và ghi nằm TRONG callback `fakeRequest`.
 * - Mọi hàm ghi gọi `appendAudit` (VC-BR-17), entity `ConsignmentProposal`.
 * - Không có hàm huỷ / xoá (VC-BR-18): đề nghị chỉ đổi trạng thái; `REJECTED` là trạng thái cuối.
 * - Kiểm quyền ở UI (tiền lệ của repo); file này không import `api.ts` để không nhân đôi logic hợp đồng.
 */

const t = vi.consignment.proposals

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
    entity: 'ConsignmentProposal',
    entityId,
    summary,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    before,
    after,
  })
}

function findProposalOrThrow(items: ConsignmentProposal[], id: string): ConsignmentProposal {
  const found = items.find((p) => p.id === id)
  if (!found) throw new Error(t.notFound)
  return found
}

function findOwnerOrThrow(items: VehicleOwner[], id: string): VehicleOwner {
  const found = items.find((o) => o.id === id)
  if (!found) throw new Error(t.ownerNotFound)
  return found
}

function requireReason(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error(t.reasonRequired)
  return trimmed
}

function appendHistory(
  proposal: ConsignmentProposal,
  to: ConsignmentProposalStatus,
  at: string,
  actor: ConsignmentActor,
  reason?: string,
): ConsignmentProposalStatusChange[] {
  return [...proposal.statusHistory, { from: proposal.status, to, at, byName: actor.fullName, reason }]
}

// ============================================================================
// Truy vấn
// ============================================================================

export interface ConsignmentProposalFilter {
  status?: ConsignmentProposalStatus
  ownerId?: string
  search?: string
}

export async function listConsignmentProposals(filter?: ConsignmentProposalFilter): Promise<ConsignmentProposal[]> {
  return fakeRequest(() => {
    const owners = readOwners()
    const q = filter?.search?.trim().toLowerCase() ?? ''
    return readProposals()
      .filter((p) => !filter?.status || p.status === filter.status)
      .filter((p) => !filter?.ownerId || p.ownerId === filter.ownerId)
      .filter((p) => {
        if (!q) return true
        const ownerName = owners.find((o) => o.id === p.ownerId)?.fullName ?? ''
        return [p.code, p.declaredVehicle.plate, ownerName].join(' ').toLowerCase().includes(q)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function getConsignmentProposal(id: string): Promise<ConsignmentProposal | undefined> {
  return fakeRequest(() => readProposals().find((p) => p.id === id))
}

// ============================================================================
// Ghi nhận / sửa đề nghị
// ============================================================================

export interface ConsignmentProposalInput {
  ownerId: string
  declaredVehicle: ConsignmentProposalVehicle
  declaredCondition: string
  expectedMonthlyAmount: number
  note?: string
}

function assertProposalInput(input: ConsignmentProposalInput): ConsignmentProposalVehicle {
  const v = input.declaredVehicle
  const plate = v.plate.trim()
  const brand = v.brand.trim()
  const model = v.model.trim()
  if (!plate) throw new Error(t.plateRequired)
  if (!brand) throw new Error(t.brandRequired)
  if (!model) throw new Error(t.modelRequired)
  if (v.manufacturingYear !== undefined && (!Number.isInteger(v.manufacturingYear) || v.manufacturingYear < 1980 || v.manufacturingYear > 2100)) {
    throw new Error(t.yearInvalid)
  }
  if (input.declaredCondition.trim().length < 3) throw new Error(t.conditionRequired)
  if (!Number.isInteger(input.expectedMonthlyAmount) || input.expectedMonthlyAmount <= 0) throw new Error(t.expectedAmountInvalid)
  return { plate, brand, model, manufacturingYear: v.manufacturingYear, color: v.color?.trim() || undefined }
}

/** UC-VC-01 — ghi nhận đề nghị: chủ xe phải có hồ sơ; từ chối khi xe đang có hợp đồng mở hoặc đã có đề nghị cùng biển số (A1). */
export async function createConsignmentProposal(input: ConsignmentProposalInput, actor: ConsignmentActor): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const owner = findOwnerOrThrow(readOwners(), input.ownerId)
    const declaredVehicle = assertProposalInput(input)
    const vehicles = readVehicles()
    const all = readProposals()
    const blocker = getProposalCreateBlocker({ plate: declaredVehicle.plate }, { vehicles, contracts: readContracts(), proposals: all })
    if (blocker) throw new Error(blocker)

    const now = new Date().toISOString()
    const created: ConsignmentProposal = {
      id: generateId('cgp'),
      code: nextSequenceCode(
        'DNKG',
        all.map((p) => p.code),
      ),
      ownerId: owner.id,
      declaredVehicle,
      vehicleId: findVehicleByPlate(vehicles, declaredVehicle.plate)?.id,
      declaredCondition: input.declaredCondition.trim(),
      expectedMonthlyAmount: input.expectedMonthlyAmount,
      status: 'SUBMITTED',
      statusHistory: [{ to: 'SUBMITTED', at: now, byName: actor.fullName }],
      note: input.note?.trim() || undefined,
      createdByName: actor.fullName,
      createdAt: now,
      updatedAt: now,
    }
    writeProposals([...all, created])
    audit(
      actor,
      'CREATE_CONSIGNMENT_PROPOSAL',
      created.id,
      t.auditCreate(created.code, declaredVehicle.plate, owner.code),
      undefined,
      created,
    )
    return created
  })
}

const TRACKED_PROPOSAL_FIELDS = ['ownerId', 'declaredVehicle', 'declaredCondition', 'expectedMonthlyAmount', 'note'] as const

/** Chỉ sửa được khi còn `SUBMITTED`; đổi biển số thì kiểm lại trùng lặp (loại trừ chính đề nghị này). */
export async function updateConsignmentProposal(
  id: string,
  input: ConsignmentProposalInput,
  actor: ConsignmentActor,
): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const all = readProposals()
    const before = findProposalOrThrow(all, id)
    if (before.status !== 'SUBMITTED') throw new Error(t.editNotAllowed)
    const owner = findOwnerOrThrow(readOwners(), input.ownerId)
    const declaredVehicle = assertProposalInput(input)
    const vehicles = readVehicles()
    const blocker = getProposalCreateBlocker(
      { plate: declaredVehicle.plate, excludeProposalId: id },
      { vehicles, contracts: readContracts(), proposals: all },
    )
    if (blocker) throw new Error(blocker)

    const after: ConsignmentProposal = {
      ...before,
      ownerId: owner.id,
      declaredVehicle,
      vehicleId: findVehicleByPlate(vehicles, declaredVehicle.plate)?.id,
      declaredCondition: input.declaredCondition.trim(),
      expectedMonthlyAmount: input.expectedMonthlyAmount,
      note: input.note?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    writeProposals(all.map((p) => (p.id === id ? after : p)))
    const changedBefore: Record<string, unknown> = {}
    const changedAfter: Record<string, unknown> = {}
    for (const key of TRACKED_PROPOSAL_FIELDS) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedBefore[key] = before[key]
        changedAfter[key] = after[key]
      }
    }
    audit(actor, 'UPDATE_CONSIGNMENT_PROPOSAL', id, t.auditUpdate(before.code), changedBefore, changedAfter)
    return after
  })
}

// ============================================================================
// Thẩm định · duyệt · từ chối
// ============================================================================

export async function startConsignmentAppraisal(id: string, actor: ConsignmentActor): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const all = readProposals()
    const before = findProposalOrThrow(all, id)
    if (!canTransitionProposal(before.status, 'APPRAISING')) {
      throw new Error(t.startNotAllowed(CONSIGNMENT_PROPOSAL_STATUS_LABELS[before.status]))
    }
    const now = new Date().toISOString()
    const after: ConsignmentProposal = {
      ...before,
      status: 'APPRAISING',
      statusHistory: appendHistory(before, 'APPRAISING', now, actor),
      updatedAt: now,
    }
    writeProposals(all.map((p) => (p.id === id ? after : p)))
    audit(actor, 'START_CONSIGNMENT_APPRAISAL', id, t.auditStart(before.code), { status: before.status }, { status: after.status })
    return after
  })
}

export interface ConsignmentAppraisalInput {
  ownershipCheck: ConsignmentAppraisal['ownershipCheck']
  documents: ConsignmentAppraisal['documents']
  checklist: ConsignmentAppraisal['checklist']
  odoKm: number
  accessories: string[]
  mediaNote?: string
  conditionNote: string
  appraisedValue: number
  pendingDocumentsNote?: string
}

function assertAppraisalInput(input: ConsignmentAppraisalInput): void {
  if (!PROPOSAL_OWNERSHIP_CHECKS.includes(input.ownershipCheck)) throw new Error(t.ownershipCheckInvalid)
  if (INTAKE_DOCUMENT_KEYS.some((key) => !input.documents.some((d) => d.key === key))) throw new Error(t.documentsIncomplete)
  if (INTAKE_CHECKLIST_KEYS.some((key) => !input.checklist.some((c) => c.item === key))) throw new Error(t.checklistIncomplete)
  if (!Number.isInteger(input.odoKm) || input.odoKm < 0) throw new Error(t.odoInvalid)
  if (input.conditionNote.trim().length < 3) throw new Error(t.conditionNoteRequired)
  // VC-BR-16 — định giá bắt buộc, số nguyên dương.
  if (!Number.isInteger(input.appraisedValue) || input.appraisedValue <= 0) throw new Error(t.appraisedValueInvalid)
}

/** UC-VC-02 — ghi (hoặc ghi lại) kết quả thẩm định khi `APPRAISING`; bản sau ghi đè, audit giữ before/after. */
export async function recordConsignmentAppraisal(
  id: string,
  input: ConsignmentAppraisalInput,
  actor: ConsignmentActor,
): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const all = readProposals()
    const before = findProposalOrThrow(all, id)
    if (before.status !== 'APPRAISING') {
      throw new Error(t.appraisalNotAllowed(CONSIGNMENT_PROPOSAL_STATUS_LABELS[before.status]))
    }
    assertAppraisalInput(input)
    const now = new Date().toISOString()
    const appraisal: ConsignmentAppraisal = {
      ownershipCheck: input.ownershipCheck,
      documents: input.documents.map((d) => ({ key: d.key, ok: d.ok, note: d.note?.trim() || undefined })),
      checklist: input.checklist.map((c) => ({ item: c.item, ok: c.ok, note: c.note?.trim() || undefined })),
      odoKm: input.odoKm,
      accessories: input.accessories.map((a) => a.trim()).filter(Boolean),
      mediaNote: input.mediaNote?.trim() || undefined,
      conditionNote: input.conditionNote.trim(),
      appraisedValue: input.appraisedValue,
      pendingDocumentsNote: input.pendingDocumentsNote?.trim() || undefined,
      appraisedByName: actor.fullName,
      appraisedAt: now,
    }
    const after: ConsignmentProposal = { ...before, appraisal, updatedAt: now }
    writeProposals(all.map((p) => (p.id === id ? after : p)))
    audit(
      actor,
      'RECORD_CONSIGNMENT_APPRAISAL',
      id,
      t.auditAppraisal(before.code, formatVnd(appraisal.appraisedValue)),
      before.appraisal,
      appraisal,
    )
    return after
  })
}

/** UC-VC-02 — duyệt: cần kết quả thẩm định, định giá > 0, xác minh chủ sở hữu hợp lệ (EX-01); kiểm lại xe không vừa có hợp đồng mở. */
export async function approveConsignmentProposal(id: string, actor: ConsignmentActor): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const all = readProposals()
    const before = findProposalOrThrow(all, id)
    const approvalBlocker = getProposalApprovalBlocker(before)
    if (approvalBlocker) throw new Error(approvalBlocker)
    const createBlocker = getProposalCreateBlocker(
      { plate: before.declaredVehicle.plate, excludeProposalId: id },
      { vehicles: readVehicles(), contracts: readContracts(), proposals: all },
    )
    if (createBlocker) throw new Error(createBlocker)
    const now = new Date().toISOString()
    const after: ConsignmentProposal = {
      ...before,
      status: 'APPROVED',
      decidedByName: actor.fullName,
      decidedAt: now,
      statusHistory: appendHistory(before, 'APPROVED', now, actor),
      updatedAt: now,
    }
    writeProposals(all.map((p) => (p.id === id ? after : p)))
    audit(actor, 'APPROVE_CONSIGNMENT_PROPOSAL', id, t.auditApprove(before.code), { status: before.status }, { status: after.status })
    return after
  })
}

/** UC-VC-02 / EX-01 — từ chối (chỉ từ `APPRAISING`), lý do bắt buộc; `REJECTED` là trạng thái cuối. */
export async function rejectConsignmentProposal(id: string, reason: string, actor: ConsignmentActor): Promise<ConsignmentProposal> {
  return fakeRequest(() => {
    const all = readProposals()
    const before = findProposalOrThrow(all, id)
    if (!canTransitionProposal(before.status, 'REJECTED')) {
      throw new Error(t.rejectNotAllowed(CONSIGNMENT_PROPOSAL_STATUS_LABELS[before.status]))
    }
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const after: ConsignmentProposal = {
      ...before,
      status: 'REJECTED',
      rejectReason: trimmed,
      decidedByName: actor.fullName,
      decidedAt: now,
      statusHistory: appendHistory(before, 'REJECTED', now, actor, trimmed),
      updatedAt: now,
    }
    writeProposals(all.map((p) => (p.id === id ? after : p)))
    audit(
      actor,
      'REJECT_CONSIGNMENT_PROPOSAL',
      id,
      t.auditReject(before.code, trimmed),
      { status: before.status },
      { status: after.status, reason: trimmed },
    )
    return after
  })
}
