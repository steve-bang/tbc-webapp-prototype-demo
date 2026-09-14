import type { MaintenanceRuleAppliesTo, Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import type { MaintenanceRecord, MaintenanceRule, SparePartRecord } from './model'

export const MAINTENANCE_RULES_STORAGE_KEY = 'maintenance_rules'
export const MAINTENANCE_RECORDS_STORAGE_KEY = 'maintenance_records'
export const SPARE_PART_RECORDS_STORAGE_KEY = 'spare_part_records'

/** Người thực hiện thao tác — dùng để ghi audit (`MT-BR-10`). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readRules(): MaintenanceRule[] {
  return readJson<MaintenanceRule[]>(MAINTENANCE_RULES_STORAGE_KEY) ?? []
}

function writeRules(items: MaintenanceRule[]): void {
  writeJson(MAINTENANCE_RULES_STORAGE_KEY, items)
}

function readRecords(): MaintenanceRecord[] {
  return readJson<MaintenanceRecord[]>(MAINTENANCE_RECORDS_STORAGE_KEY) ?? []
}

function writeRecords(items: MaintenanceRecord[]): void {
  writeJson(MAINTENANCE_RECORDS_STORAGE_KEY, items)
}

function readSpareParts(): SparePartRecord[] {
  return readJson<SparePartRecord[]>(SPARE_PART_RECORDS_STORAGE_KEY) ?? []
}

function writeSpareParts(items: SparePartRecord[]): void {
  writeJson(SPARE_PART_RECORDS_STORAGE_KEY, items)
}

function findRuleOrThrow(items: MaintenanceRule[], id: string): MaintenanceRule {
  const found = items.find((r) => r.id === id)
  if (!found) throw new Error('Không tìm thấy quy tắc bảo dưỡng')
  return found
}

export interface MaintenanceRuleFormInput {
  category: string
  thresholdKm: number
  appliesTo: MaintenanceRuleAppliesTo
  vehicleId?: string
  vehicleModel?: string
}

export interface MaintenanceRecordFormInput {
  vehicleId: string
  date: string
  odometerAtService: number
  category: string
  cost: number
  provider?: string
  note?: string
}

export interface SparePartRecordFormInput {
  vehicleId: string
  partName: string
  quantity: number
  date: string
  odometerAtReplacement: number
  cost: number
  provider?: string
  note?: string
}

// ---- MaintenanceRule ----

export async function listRules(): Promise<MaintenanceRule[]> {
  return fakeRequest(() => readRules())
}

/** `MT-BR-01` — tạo quy tắc bảo dưỡng mới, mặc định `active: true`. */
export async function createRule(input: MaintenanceRuleFormInput, actor: ActorInfo): Promise<MaintenanceRule> {
  return fakeRequest(() => {
    const now = new Date().toISOString()
    const rule: MaintenanceRule = {
      id: generateId('mtrule'),
      category: input.category.trim(),
      thresholdKm: input.thresholdKm,
      appliesTo: input.appliesTo,
      vehicleId: input.appliesTo === 'SPECIFIC_VEHICLE' ? input.vehicleId : undefined,
      vehicleModel: input.appliesTo === 'VEHICLE_MODEL' ? input.vehicleModel?.trim() : undefined,
      active: true,
      createdAt: now,
      updatedAt: now,
    }
    writeRules([...readRules(), rule])
    appendAudit({
      action: 'CREATE_MAINTENANCE_RULE',
      entity: 'MaintenanceRule',
      entityId: rule.id,
      summary: `Tạo quy tắc bảo dưỡng "${rule.category}" (${rule.thresholdKm.toLocaleString('vi-VN')} km)`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: rule,
    })
    return rule
  })
}

/** `MT-BR-11` — không xoá vật lý, chỉ vô hiệu hoá. */
export async function deactivateRule(id: string, actor: ActorInfo): Promise<MaintenanceRule> {
  return fakeRequest(() => {
    const all = readRules()
    const before = findRuleOrThrow(all, id)
    const after: MaintenanceRule = { ...before, active: false, updatedAt: new Date().toISOString() }
    writeRules(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'DEACTIVATE_MAINTENANCE_RULE',
      entity: 'MaintenanceRule',
      entityId: id,
      summary: `Vô hiệu hoá quy tắc bảo dưỡng "${before.category}"`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { active: before.active },
      after: { active: false },
    })
    return after
  })
}

// ---- MaintenanceRecord ----

export interface MaintenanceRecordFilter {
  vehicleId?: string
}

export async function listRecords(filter?: MaintenanceRecordFilter): Promise<MaintenanceRecord[]> {
  return fakeRequest(() => readRecords().filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId))
}

// MT-BR-11 — không có update()/remove(): Record là lịch sử ghi nhận (append-only).
/** `MT-BR-03` — ghi nhận bản ghi bảo dưỡng mới. */
export async function createRecord(input: MaintenanceRecordFormInput, actor: ActorInfo): Promise<MaintenanceRecord> {
  return fakeRequest(() => {
    const now = new Date().toISOString()
    const record: MaintenanceRecord = {
      id: generateId('mtrec'),
      vehicleId: input.vehicleId,
      date: input.date,
      odometerAtService: input.odometerAtService,
      category: input.category.trim(),
      cost: input.cost,
      provider: input.provider?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      createdBy: actor.fullName,
    }
    writeRecords([...readRecords(), record])
    appendAudit({
      action: 'CREATE_MAINTENANCE_RECORD',
      entity: 'MaintenanceRecord',
      entityId: record.id,
      summary: `Ghi nhận bảo dưỡng "${record.category}" (odo ${record.odometerAtService.toLocaleString('vi-VN')} km)`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: record,
    })
    return record
  })
}

// ---- SparePartRecord ----

export interface SparePartRecordFilter {
  vehicleId?: string
}

export async function listSpareParts(filter?: SparePartRecordFilter): Promise<SparePartRecord[]> {
  return fakeRequest(() => readSpareParts().filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId))
}

// MT-BR-07 — độc lập hoàn toàn với Rule/Record; MT-BR-11 — không có update()/remove().
/** `MT §6.2` — ghi nhận thay thế phụ tùng mới. */
export async function createSparePart(input: SparePartRecordFormInput, actor: ActorInfo): Promise<SparePartRecord> {
  return fakeRequest(() => {
    const now = new Date().toISOString()
    const record: SparePartRecord = {
      id: generateId('sprec'),
      vehicleId: input.vehicleId,
      partName: input.partName.trim(),
      quantity: input.quantity,
      date: input.date,
      odometerAtReplacement: input.odometerAtReplacement,
      cost: input.cost,
      provider: input.provider?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      createdBy: actor.fullName,
    }
    writeSpareParts([...readSpareParts(), record])
    appendAudit({
      action: 'CREATE_SPARE_PART_RECORD',
      entity: 'SparePartRecord',
      entityId: record.id,
      summary: `Ghi nhận thay phụ tùng "${record.partName}" x${record.quantity}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: record,
    })
    return record
  })
}
