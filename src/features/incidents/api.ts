// `handover-return`/`rentals` — deep-import `api.ts` của feature khác đúng
// tiền lệ đã có (`contracts/api.ts` → `rentals/api.ts`, `handover-return/api.ts`
// → `rentals/api.ts`/`@/features/rentals` barrel). Chỉ ĐỌC (`getReturnById`/
// `getById`), không sửa/xoá gì ở `handover-return`/`rentals`
// (`docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §0.3).
import { getReturnById } from '@/features/handover-return/api'
import { getById as getRentalById } from '@/features/rentals/api'
import type {
  IncidentBaselineReference,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
  IncidentType,
  Liability,
  Role,
} from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  canApprove,
  canCancelIncident,
  canClose,
  canMarkRepaired,
  canStartAssessing,
  canStartRepair,
  generateIncidentCode,
  mapIncidentItemTypeToIncidentType,
  needsWaitingApproval,
  validateCostAllocation,
  type Incident,
} from './model'
import type { MediaMeta } from '@/features/handover-return/model'

export const INCIDENTS_STORAGE_KEY = 'incidents'

/** Người thực hiện thao tác — dùng để ghi audit (DI-BR-17). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readAll(): Incident[] {
  return readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? []
}
function writeAll(items: Incident[]): void {
  writeJson(INCIDENTS_STORAGE_KEY, items)
}
function findOrThrow(items: Incident[], id: string): Incident {
  const found = items.find((i) => i.id === id)
  if (!found) throw new Error('Không tìm thấy hồ sơ sự cố')
  return found
}

export interface IncidentFilter {
  status?: IncidentStatus
  severity?: IncidentSeverity
  source?: IncidentSource
  vehicleId?: string
  rentalId?: string
}

function matches(incident: Incident, filter?: IncidentFilter): boolean {
  if (!filter) return true
  if (filter.status && incident.status !== filter.status) return false
  if (filter.severity && incident.severity !== filter.severity) return false
  if (filter.source && incident.source !== filter.source) return false
  if (filter.vehicleId && incident.vehicleId !== filter.vehicleId) return false
  if (filter.rentalId && incident.rentalId !== filter.rentalId) return false
  return true
}

export async function list(filter?: IncidentFilter): Promise<Incident[]> {
  return fakeRequest(() => readAll().filter((i) => matches(i, filter)))
}

export async function getById(id: string): Promise<Incident | undefined> {
  return fakeRequest(() => readAll().find((i) => i.id === id))
}

export interface IncidentCreateInput {
  vehicleId: string
  rentalId?: string
  source: IncidentSource
  type: IncidentType
  severity: IncidentSeverity
  safetyImpact: boolean
  location?: string
  description: string
  estimatedCost: number
  mediaMeta?: MediaMeta[]
  baselineReference?: IncidentBaselineReference
  returnRecordId?: string
  returnIncidentItemId?: string
}

function buildIncident(input: IncidentCreateInput, existingCount: number, actor: ActorInfo): Incident {
  const now = new Date().toISOString()
  return {
    id: generateId('inc'),
    incidentCode: generateIncidentCode(existingCount),
    vehicleId: input.vehicleId,
    rentalId: input.rentalId,
    source: input.source,
    reportedByUserId: actor.userId,
    reportedByName: actor.fullName,
    reportedByRole: actor.role,
    reportedAt: now,
    type: input.type,
    severity: input.severity,
    safetyImpact: input.safetyImpact,
    location: input.location,
    description: input.description,
    mediaMeta: input.mediaMeta ?? [],
    baselineReference: input.baselineReference,
    liability: 'UNDETERMINED', // DI-BR-05 — mặc định, không optional
    estimatedCost: input.estimatedCost,
    status: 'OPEN',
    returnRecordId: input.returnRecordId,
    returnIncidentItemId: input.returnIncidentItemId,
    createdAt: now,
    updatedAt: now,
  }
}

/** UC-DI-02 — tạo Incident thủ công (`STANDALONE`/`INSPECTION`/`ACCIDENT`), gate `INCIDENT.CREATE`. */
export async function create(input: IncidentCreateInput, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const created = buildIncident(input, all.length, actor)
    writeAll([...all, created])
    appendAudit({
      action: 'CREATE_INCIDENT',
      entity: 'Incident',
      entityId: created.id,
      summary: `Tạo hồ sơ sự cố ${created.incidentCode} (${created.source}) cho xe ${created.vehicleId}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: created,
    })
    return created
  })
}

/**
 * UC-DI-01/AC-DI-001 — DI-BR-14: kế thừa dữ liệu từ `ReturnIncidentItem`
 * (type/position/description/estimatedCost/baselineComparison/mediaMeta/
 * affectsSafety), không nhập lại; chỉ bổ sung `Severity` (nhân viên chưa nhập
 * ở Return). Chặn tạo trùng — 1 `ReturnIncidentItem` chỉ chuyển thành 1
 * `Incident` (kế hoạch §0.3 — không sửa/xoá gì ở `ReturnRecord.incidentItems`).
 */
export async function createFromReturnIncidentItem(
  returnRecordId: string,
  itemId: string,
  input: { severity: IncidentSeverity; safetyImpact: boolean },
  actor: ActorInfo,
): Promise<Incident> {
  const returnRecord = await getReturnById(returnRecordId)
  if (!returnRecord) throw new Error('Không tìm thấy biên bản trả xe')
  const item = returnRecord.incidentItems.find((i) => i.id === itemId)
  if (!item) throw new Error('Không tìm thấy sự cố phát hiện khi nhận xe')
  const rental = await getRentalById(returnRecord.rentalId)
  if (!rental) throw new Error('Không tìm thấy lượt thuê liên quan')

  return fakeRequest(() => {
    const all = readAll()
    if (all.some((i) => i.returnIncidentItemId === itemId)) {
      throw new Error('Sự cố này đã được tạo hồ sơ (Incident) trước đó.')
    }
    const created = buildIncident(
      {
        vehicleId: rental.vehicleId,
        rentalId: returnRecord.rentalId,
        source: 'RETURN',
        type: mapIncidentItemTypeToIncidentType(item.type),
        severity: input.severity,
        safetyImpact: input.safetyImpact,
        location: item.position,
        description: item.description,
        estimatedCost: item.estimatedCost,
        mediaMeta: item.mediaMeta,
        baselineReference: item.baselineComparison,
        returnRecordId,
        returnIncidentItemId: itemId,
      },
      all.length,
      actor,
    )
    writeAll([...all, created])
    appendAudit({
      action: 'CREATE_INCIDENT',
      entity: 'Incident',
      entityId: created.id,
      summary: `Tạo hồ sơ sự cố ${created.incidentCode} (RETURN) từ biên bản trả xe ${returnRecordId}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: created,
    })
    return created
  })
}

export interface IncidentAssessInput {
  type: IncidentType
  severity: IncidentSeverity
  safetyImpact: boolean
  location?: string
  description: string
  baselineReference?: IncidentBaselineReference
}

/** UC-DI-03/04 — `OPEN -> ASSESSING`. */
export async function startAssessing(id: string, input: IncidentAssessInput, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canStartAssessing(before)) {
      throw new Error(`Không thể chuyển sang Đang đánh giá khi hồ sơ đang ở trạng thái ${before.status}`)
    }
    const after: Incident = { ...before, ...input, status: 'ASSESSING', updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'ASSESS_INCIDENT',
      entity: 'Incident',
      entityId: id,
      summary: `Đánh giá sự cố ${before.incidentCode}: chuyển Đang đánh giá`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'ASSESSING' },
    })
    return after
  })
}

export interface IncidentLiabilityInput {
  liability: Liability
  liabilityNote?: string
  customerCharge: number
  companyCost: number
  insuranceCovered: number
}

/**
 * UC-DI-05 — Xác định trách nhiệm & phân bổ chi phí. Tự quyết `APPROVED`/
 * `WAITING_APPROVAL` theo `needsWaitingApproval` (DI-BR-08); nếu Incident đã
 * `APPROVED` (sửa lại sau khi duyệt — DI-BR-13), giữ nguyên trạng thái, chỉ
 * audit before/after.
 */
export async function setLiabilityAndCost(id: string, input: IncidentLiabilityInput, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    const allowedStatuses: IncidentStatus[] = ['ASSESSING', 'WAITING_APPROVAL', 'APPROVED']
    if (!allowedStatuses.includes(before.status)) {
      throw new Error(`Không thể xác định trách nhiệm & chi phí khi hồ sơ đang ở trạng thái ${before.status}`)
    }
    if (input.liability === 'UNDETERMINED') {
      throw new Error('Vui lòng xác định rõ bên chịu trách nhiệm (DI-BR-05).')
    }
    if (input.liability === 'SHARED' && !input.liabilityNote?.trim()) {
      throw new Error('Mô tả tỉ lệ phân chia trách nhiệm là bắt buộc khi Liability = SHARED.')
    }
    const candidate: Incident = { ...before, ...input }
    if (!validateCostAllocation(candidate)) {
      throw new Error('Tổng Customer Charge + Company Cost + Insurance Covered phải bằng Actual/Estimated Cost (DI-BR-06).')
    }
    const nextStatus: IncidentStatus =
      before.status === 'APPROVED' ? 'APPROVED' : needsWaitingApproval(before.estimatedCost) ? 'WAITING_APPROVAL' : 'APPROVED'
    const after: Incident = { ...candidate, status: nextStatus, updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'SET_INCIDENT_LIABILITY',
      entity: 'Incident',
      entityId: id,
      summary: `Xác định trách nhiệm & chi phí sự cố ${before.incidentCode} (Liability=${input.liability})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return after
  })
}

/** UC-DI-07 — `WAITING_APPROVAL -> APPROVED`, gate `INCIDENT.APPROVE`. */
export async function approve(id: string, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (before.status !== 'WAITING_APPROVAL') {
      throw new Error(`Chỉ duyệt được hồ sơ đang ở trạng thái Chờ duyệt (hiện: ${before.status}).`)
    }
    if (!canApprove(before)) {
      throw new Error('Chưa xác định trách nhiệm (Liability) — không thể duyệt (DI-BR-05).')
    }
    const after: Incident = { ...before, status: 'APPROVED', updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'APPROVE_INCIDENT',
      entity: 'Incident',
      entityId: id,
      summary: `Duyệt sự cố ${before.incidentCode}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'APPROVED' },
    })
    return after
  })
}

export interface IncidentStartRepairInput {
  repairVendorName: string
  repairStartDate: string
}

/** UC-DI-08 — `APPROVED -> IN_REPAIR`. */
export async function startRepair(id: string, input: IncidentStartRepairInput, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canStartRepair(before)) {
      throw new Error(`Không thể bắt đầu sửa chữa khi hồ sơ đang ở trạng thái ${before.status}`)
    }
    const after: Incident = { ...before, ...input, status: 'IN_REPAIR', updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'START_INCIDENT_REPAIR',
      entity: 'Incident',
      entityId: id,
      summary: `Bắt đầu sửa chữa sự cố ${before.incidentCode} tại ${input.repairVendorName}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'IN_REPAIR', ...input },
    })
    return after
  })
}

export interface IncidentMarkRepairedInput {
  actualCostParts: number
  actualCostLabor: number
  actualCostOther: number
  repairEndDate: string
  repairInvoiceMeta: MediaMeta
}

/** UC-DI-09 — `IN_REPAIR -> REPAIRED`, chặn nếu thiếu `actualCost*`/hoá đơn (DI-BR-09). */
export async function markRepaired(id: string, input: IncidentMarkRepairedInput, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    const candidate: Incident = { ...before, ...input }
    if (!canMarkRepaired(candidate)) {
      throw new Error(`Không thể chuyển Đã sửa xong: hồ sơ đang ở trạng thái ${before.status} hoặc thiếu chi phí thực tế/hoá đơn (DI-BR-09).`)
    }
    const after: Incident = { ...candidate, status: 'REPAIRED', updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'MARK_INCIDENT_REPAIRED',
      entity: 'Incident',
      entityId: id,
      summary: `Ghi nhận hoàn tất sửa chữa sự cố ${before.incidentCode}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'REPAIRED', ...input },
    })
    return after
  })
}

/** UC-DI-05/14 — `REPAIRED -> CLOSED`, chặn nếu `liability === 'UNDETERMINED'` (DI-BR-05/10). */
export async function close(id: string, actor: ActorInfo): Promise<Incident> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canClose(before)) {
      throw new Error('Không thể đóng hồ sơ: chưa đủ điều kiện (đã sửa xong + đã xác định trách nhiệm) hoặc đang ở trạng thái khác (DI-BR-10).')
    }
    const now = new Date().toISOString()
    const after: Incident = { ...before, status: 'CLOSED', closedAt: now, updatedAt: now }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'CLOSE_INCIDENT',
      entity: 'Incident',
      entityId: id,
      summary: `Đóng hồ sơ sự cố ${before.incidentCode}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CLOSED' },
    })
    return after
  })
}

/** `OPEN`/`ASSESSING`/`APPROVED -> CANCELLED`, bắt buộc lý do. */
export async function cancel(id: string, reason: string, actor: ActorInfo): Promise<Incident> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do huỷ là bắt buộc')
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canCancelIncident(before)) {
      throw new Error(`Không thể huỷ hồ sơ sự cố đang ở trạng thái ${before.status}`)
    }
    const after: Incident = { ...before, status: 'CANCELLED', cancelReason: trimmedReason, updatedAt: new Date().toISOString() }
    writeAll(all.map((i) => (i.id === id ? after : i)))
    appendAudit({
      action: 'CANCEL_INCIDENT',
      entity: 'Incident',
      entityId: id,
      summary: `Huỷ hồ sơ sự cố ${before.incidentCode}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CANCELLED', reason: trimmedReason },
    })
    return after
  })
}

// DI-BR-15 — `CLOSED` không xoá vật lý: không có remove().
