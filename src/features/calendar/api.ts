import type { Role, VehicleBlockStatus } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import type { VehicleBlock } from './model'

export const VEHICLE_BLOCKS_STORAGE_KEY = 'vehicleBlocks'

function readAll(): VehicleBlock[] {
  return readJson<VehicleBlock[]>(VEHICLE_BLOCKS_STORAGE_KEY) ?? []
}

function writeAll(items: VehicleBlock[]): void {
  writeJson(VEHICLE_BLOCKS_STORAGE_KEY, items)
}

export interface VehicleBlockFilter {
  vehicleId?: string
  status?: VehicleBlockStatus
}

/** Người thực hiện thao tác — dùng để ghi audit, cùng pattern `rentals/api.ts`. */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

export interface VehicleBlockCreateInput {
  vehicleId: string
  startDate: string
  endDate?: string
  reason: string
}

function matches(block: VehicleBlock, filter?: VehicleBlockFilter): boolean {
  if (!filter) return true
  if (filter.vehicleId && block.vehicleId !== filter.vehicleId) return false
  if (filter.status && block.status !== filter.status) return false
  return true
}

function findOrThrow(items: VehicleBlock[], id: string): VehicleBlock {
  const found = items.find((b) => b.id === id)
  if (!found) throw new Error('Không tìm thấy khoá lịch xe')
  return found
}

export async function list(filter?: VehicleBlockFilter): Promise<VehicleBlock[]> {
  return fakeRequest(() => readAll().filter((b) => matches(b, filter)))
}

/** RC-BR-15/CR-2026-015 — tạo Vehicle Block mới, luôn khởi tạo `ACTIVE`. */
export async function create(input: VehicleBlockCreateInput, actor: ActorInfo): Promise<VehicleBlock> {
  return fakeRequest(() => {
    const now = new Date().toISOString()
    const block: VehicleBlock = {
      id: generateId('vblk'),
      vehicleId: input.vehicleId,
      startDate: input.startDate,
      endDate: input.endDate || undefined,
      reason: input.reason.trim(),
      status: 'ACTIVE',
      createdByUserId: actor.userId,
      createdByName: actor.fullName,
      createdByRole: actor.role,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...readAll(), block])
    appendAudit({
      action: 'CREATE_VEHICLE_BLOCK',
      entity: 'VehicleBlock',
      entityId: block.id,
      summary: `Khoá lịch xe ${block.vehicleId} từ ${block.startDate}${block.endDate ? ` đến ${block.endDate}` : ' (vô thời hạn)'}: ${block.reason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: block,
    })
    return block
  })
}

/**
 * CR-2026-015 — "giữ khoá đến khi SYSTEM_ADMIN/MANAGER cập nhật lại trạng
 * thái xe" → gỡ khoá chỉ đổi status `RELEASED` + ghi `releasedBy*`, KHÔNG tự
 * đổi `Vehicle.status` (độc lập, §2.1 kế hoạch).
 */
export async function release(id: string, actor: ActorInfo): Promise<VehicleBlock> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (before.status !== 'ACTIVE') {
      throw new Error('Khoá lịch xe này đã được gỡ trước đó')
    }
    const now = new Date().toISOString()
    const after: VehicleBlock = {
      ...before,
      status: 'RELEASED',
      releasedByUserId: actor.userId,
      releasedByName: actor.fullName,
      releasedByRole: actor.role,
      releasedAt: now,
      updatedAt: now,
    }
    writeAll(all.map((b) => (b.id === id ? after : b)))
    appendAudit({
      action: 'RELEASE_VEHICLE_BLOCK',
      entity: 'VehicleBlock',
      entityId: id,
      summary: `Gỡ khoá lịch xe ${before.vehicleId}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'RELEASED' },
    })
    return after
  })
}
