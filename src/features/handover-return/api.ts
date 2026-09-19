// `rentals` — ngoại lệ kiến trúc đã duyệt (`docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§9.2):
// `handover-return/api.ts` gọi thẳng `revertHandoverCancelled()`/`revertReturnCancelled()` (hàm
// thuần từ `api.ts`, không phải hook) qua barrel `@/features/rentals` — mirror tiền lệ
// `contracts/api.ts` gọi thẳng `markContractCreated()`.
import { canCancelHandover, canCancelReturn, revertHandoverCancelled, revertReturnCancelled } from '@/features/rentals'
import { getById as getRentalById } from '@/features/rentals/api'
import type { HandoverReturnStatus, Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { readJson, writeJson } from '@/shared/lib/storage'
import { canCancelHandoverRecord, canCancelReturnRecord, canEditHandoverRecord, canEditReturnRecord } from './model'
import type { HandoverRecord, ReturnRecord } from './model'

export const HANDOVER_RECORDS_STORAGE_KEY = 'handoverRecords'
export const RETURN_RECORDS_STORAGE_KEY = 'returnRecords'

/** Người thực hiện thao tác — dùng để ghi audit (VH-BR-12/VR-BR-16). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readHandovers(): HandoverRecord[] {
  return readJson<HandoverRecord[]>(HANDOVER_RECORDS_STORAGE_KEY) ?? []
}
function writeHandovers(items: HandoverRecord[]): void {
  writeJson(HANDOVER_RECORDS_STORAGE_KEY, items)
}
function readReturns(): ReturnRecord[] {
  return readJson<ReturnRecord[]>(RETURN_RECORDS_STORAGE_KEY) ?? []
}
function writeReturns(items: ReturnRecord[]): void {
  writeJson(RETURN_RECORDS_STORAGE_KEY, items)
}

function findHandoverOrThrow(items: HandoverRecord[], id: string): HandoverRecord {
  const found = items.find((h) => h.id === id)
  if (!found) throw new Error('Không tìm thấy biên bản giao xe')
  return found
}
function findReturnOrThrow(items: ReturnRecord[], id: string): ReturnRecord {
  const found = items.find((r) => r.id === id)
  if (!found) throw new Error('Không tìm thấy biên bản trả xe')
  return found
}

export interface HandoverFilter {
  rentalId?: string
  status?: HandoverReturnStatus
}
export interface ReturnFilter {
  rentalId?: string
  status?: HandoverReturnStatus
}

function matchesHandover(record: HandoverRecord, filter?: HandoverFilter): boolean {
  if (!filter) return true
  if (filter.rentalId && record.rentalId !== filter.rentalId) return false
  if (filter.status && record.status !== filter.status) return false
  return true
}
function matchesReturn(record: ReturnRecord, filter?: ReturnFilter): boolean {
  if (!filter) return true
  if (filter.rentalId && record.rentalId !== filter.rentalId) return false
  if (filter.status && record.status !== filter.status) return false
  return true
}

export async function listHandovers(filter?: HandoverFilter): Promise<HandoverRecord[]> {
  return fakeRequest(() => readHandovers().filter((h) => matchesHandover(h, filter)))
}
export async function getHandoverById(id: string): Promise<HandoverRecord | undefined> {
  return fakeRequest(() => readHandovers().find((h) => h.id === id))
}
export async function listReturns(filter?: ReturnFilter): Promise<ReturnRecord[]> {
  return fakeRequest(() => readReturns().filter((r) => matchesReturn(r, filter)))
}
export async function getReturnById(id: string): Promise<ReturnRecord | undefined> {
  return fakeRequest(() => readReturns().find((r) => r.id === id))
}

export type HandoverUpdateInput = Partial<Omit<HandoverRecord, 'id' | 'rentalId' | 'status' | 'createdAt'>>

/**
 * VH-BR-12 — sửa biên bản giao xe `COMPLETED`, bắt buộc lý do + audit
 * before/after. Nếu patch đổi `odometerHandover` và đã có `ReturnRecord`
 * `COMPLETED` dựa trên bản ghi này → re-validate VR-BR-03 (không cho Odometer
 * giao xe vượt Odometer trả xe đã ghi nhận).
 */
export async function updateHandover(id: string, patch: HandoverUpdateInput, reason: string, actor: ActorInfo): Promise<HandoverRecord> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do sửa là bắt buộc')
  return fakeRequest(() => {
    const all = readHandovers()
    const before = findHandoverOrThrow(all, id)
    if (!canEditHandoverRecord(before)) {
      throw new Error(`Không thể sửa biên bản giao xe đang ở trạng thái ${before.status}`)
    }
    if (patch.odometerHandover !== undefined) {
      const linkedReturn = readReturns().find((r) => r.handoverRecordId === id && r.status === 'COMPLETED')
      if (linkedReturn?.odometerReturn !== undefined && patch.odometerHandover > linkedReturn.odometerReturn) {
        throw new Error('Odometer giao xe không được lớn hơn Odometer trả xe đã ghi nhận (VR-BR-03).')
      }
    }
    const after: HandoverRecord = { ...before, ...patch, updatedAt: new Date().toISOString() }
    writeHandovers(all.map((h) => (h.id === id ? after : h)))
    appendAudit({
      action: 'EDIT_HANDOVER',
      entity: 'HandoverRecord',
      entityId: id,
      summary: `Sửa biên bản giao xe của lượt thuê ${before.rentalId}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return after
  })
}

/**
 * UC-VH-14 — Huỷ biên bản giao xe `COMPLETED`. Chặn nếu đã có `ReturnRecord`
 * `COMPLETED` dựa trên bản ghi này (hệ quả toàn vẹn dữ liệu của VH-BR-04 —
 * Return chỉ tồn tại sau khi Handover hoàn tất, nên không thể huỷ ngược
 * Handover trong khi Return vẫn còn hiệu lực). Sau khi ghi `CANCELLED`, gọi
 * `revertHandoverCancelled()` (`@/features/rentals`, kế hoạch §0.3/§9.2) để
 * hoàn tác Rental — giới hạn demo fake-API: không có transaction thật xuyên 2
 * storage key, giống ghi chú ở `contracts/api.ts`'s `create()`.
 */
export async function cancelHandover(id: string, reason: string, actor: ActorInfo): Promise<HandoverRecord> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do huỷ là bắt buộc')
  const before = findHandoverOrThrow(readHandovers(), id)
  if (!canCancelHandoverRecord(before)) {
    throw new Error(`Không thể huỷ biên bản giao xe đang ở trạng thái ${before.status}`)
  }
  const hasCompletedReturn = readReturns().some((r) => r.handoverRecordId === id && r.status === 'COMPLETED')
  if (hasCompletedReturn) {
    throw new Error('Không thể huỷ biên bản giao xe đã có biên bản trả xe hoàn tất (VH-BR-04) — huỷ biên bản trả xe trước.')
  }
  const rental = await getRentalById(before.rentalId)
  if (!rental || !canCancelHandover(rental)) {
    throw new Error('Lượt thuê liên quan đang không ở trạng thái cho phép huỷ giao xe.')
  }

  const record = await fakeRequest(() => {
    const all = readHandovers()
    const now = new Date().toISOString()
    const after: HandoverRecord = {
      ...before,
      status: 'CANCELLED',
      cancelReason: trimmedReason,
      cancelledAt: now,
      cancelledByUserId: actor.userId,
      cancelledByName: actor.fullName,
      cancelledByRole: actor.role,
      updatedAt: now,
    }
    writeHandovers(all.map((h) => (h.id === id ? after : h)))
    appendAudit({
      action: 'CANCEL_HANDOVER',
      entity: 'HandoverRecord',
      entityId: id,
      summary: `Huỷ biên bản giao xe của lượt thuê ${before.rentalId}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CANCELLED', reason: trimmedReason },
    })
    return after
  })

  await revertHandoverCancelled(before.rentalId, actor)

  return record
}

export type ReturnUpdateInput = Partial<Omit<ReturnRecord, 'id' | 'rentalId' | 'handoverRecordId' | 'status' | 'createdAt'>>

/**
 * VR-BR-16 — sửa biên bản trả xe `COMPLETED`, bắt buộc lý do + audit
 * before/after. Re-validate VR-BR-03 (odometer) và VR-BR-05 (thời gian) với
 * `HandoverRecord` gốc khi patch đổi field liên quan. "Đồng bộ Settlement" ở
 * VR-BR-16 N/A Round 1 (chưa có `RentalSettlement`).
 */
export async function updateReturn(id: string, patch: ReturnUpdateInput, reason: string, actor: ActorInfo): Promise<ReturnRecord> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do sửa là bắt buộc')
  return fakeRequest(() => {
    const all = readReturns()
    const before = findReturnOrThrow(all, id)
    if (!canEditReturnRecord(before)) {
      throw new Error(`Không thể sửa biên bản trả xe đang ở trạng thái ${before.status}`)
    }
    const handover = readHandovers().find((h) => h.id === before.handoverRecordId)
    const nextOdometerReturn = patch.odometerReturn ?? before.odometerReturn
    if (patch.odometerReturn !== undefined && handover?.odometerHandover !== undefined && nextOdometerReturn !== undefined) {
      if (nextOdometerReturn < handover.odometerHandover) {
        throw new Error('Odometer trả xe phải lớn hơn hoặc bằng Odometer giao xe (VR-BR-03).')
      }
    }
    if (patch.actualReturnDateTime !== undefined) {
      const nextReturnAt = new Date(patch.actualReturnDateTime).getTime()
      if (nextReturnAt > Date.now()) {
        throw new Error('Thời gian trả xe thực tế không được ở tương lai (VR-BR-05).')
      }
      if (handover?.actualPickupDateTime && nextReturnAt < new Date(handover.actualPickupDateTime).getTime()) {
        throw new Error('Thời gian trả xe thực tế phải sau thời gian giao xe thực tế (VR-BR-05).')
      }
    }
    const after: ReturnRecord = { ...before, ...patch, updatedAt: new Date().toISOString() }
    writeReturns(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'EDIT_RETURN',
      entity: 'ReturnRecord',
      entityId: id,
      summary: `Sửa biên bản trả xe của lượt thuê ${before.rentalId}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return after
  })
}

/**
 * UC-VR-19 — Huỷ biên bản trả xe `COMPLETED`, gọi `revertReturnCancelled()`
 * (`@/features/rentals`, kế hoạch §0.3/§9.2) để hoàn tác Rental. Phần hoàn tác
 * Vehicle.status/currentKm KHÔNG tự động (kế hoạch §0.4) — dialog UI hiển thị
 * cảnh báo tương ứng.
 */
export async function cancelReturn(id: string, reason: string, actor: ActorInfo): Promise<ReturnRecord> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('Lý do huỷ là bắt buộc')
  const before = findReturnOrThrow(readReturns(), id)
  if (!canCancelReturnRecord(before)) {
    throw new Error(`Không thể huỷ biên bản trả xe đang ở trạng thái ${before.status}`)
  }
  const rental = await getRentalById(before.rentalId)
  if (!rental || !canCancelReturn(rental)) {
    throw new Error('Lượt thuê liên quan đang không ở trạng thái cho phép huỷ trả xe.')
  }

  const record = await fakeRequest(() => {
    const all = readReturns()
    const now = new Date().toISOString()
    const after: ReturnRecord = {
      ...before,
      status: 'CANCELLED',
      cancelReason: trimmedReason,
      cancelledAt: now,
      cancelledByUserId: actor.userId,
      cancelledByName: actor.fullName,
      cancelledByRole: actor.role,
      updatedAt: now,
    }
    writeReturns(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'CANCEL_RETURN',
      entity: 'ReturnRecord',
      entityId: id,
      summary: `Huỷ biên bản trả xe của lượt thuê ${before.rentalId}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CANCELLED', reason: trimmedReason },
    })
    return after
  })

  await revertReturnCancelled(before.rentalId, actor)

  return record
}

// VH-BR-11/VR-BR-15 — `COMPLETED` không xoá vật lý: không có remove(); Round 1 không có create()
// (bản ghi `COMPLETED` chỉ qua seed — `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.2).
