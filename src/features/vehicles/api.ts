import type { OwnershipType, Role, VehicleClass, VehicleStatus } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { canChangeStatus, isPlateTaken, type Vehicle, type VehicleDocument } from './model'

export const VEHICLES_STORAGE_KEY = 'vehicles'

function readAll(): Vehicle[] {
  return readJson<Vehicle[]>(VEHICLES_STORAGE_KEY) ?? []
}

function writeAll(items: Vehicle[]): void {
  writeJson(VEHICLES_STORAGE_KEY, items)
}

export interface VehicleFilter {
  search?: string
  status?: VehicleStatus
  brand?: string
  vehicleClass?: VehicleClass
  ownershipType?: OwnershipType
}

export interface VehicleFormInput {
  plate: string
  brand: string
  model: string
  manufacturingYear?: number
  color?: string
  vehicleClass: VehicleClass
  ownershipType: OwnershipType
  bankFinanced: boolean
  currentKm: number
  fuelLevel?: number
  note?: string
}

/** Người thực hiện thao tác — dùng để ghi audit (`VM-RULE-007`). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

/** `VM §16.1` — input thêm/sửa giấy tờ xe. */
export interface VehicleDocumentFormInput {
  documentType: VehicleDocument['documentType']
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  warningLeadDays: number
  note?: string
  fileMeta?: VehicleDocument['fileMeta']
  registeredOwnerName?: string
  inspectionCenter?: string
  insuranceProvider?: string
  policyNumber?: string
  issuingBank?: string
  heldRegistrationNumber?: string
}

function matches(vehicle: Vehicle, filter?: VehicleFilter): boolean {
  if (!filter) return true
  if (filter.status && vehicle.status !== filter.status) return false
  if (filter.brand && vehicle.brand !== filter.brand) return false
  if (filter.vehicleClass && vehicle.vehicleClass !== filter.vehicleClass) return false
  if (filter.ownershipType && vehicle.ownershipType !== filter.ownershipType) return false
  if (filter.search) {
    const q = filter.search.trim().toLowerCase()
    if (
      q.length > 0 &&
      !vehicle.plate.toLowerCase().includes(q) &&
      !vehicle.brand.toLowerCase().includes(q) &&
      !vehicle.model.toLowerCase().includes(q)
    ) {
      return false
    }
  }
  return true
}

function findOrThrow(items: Vehicle[], id: string): Vehicle {
  const found = items.find((v) => v.id === id)
  if (!found) throw new Error('Không tìm thấy xe')
  return found
}

function findDocumentOrThrow(vehicle: Vehicle, docId: string): VehicleDocument {
  const found = vehicle.documents.find((d) => d.id === docId)
  if (!found) throw new Error('Không tìm thấy giấy tờ')
  return found
}

export async function list(filter?: VehicleFilter): Promise<Vehicle[]> {
  return fakeRequest(() => readAll().filter((v) => matches(v, filter)))
}

export async function getById(id: string): Promise<Vehicle | undefined> {
  return fakeRequest(() => readAll().find((v) => v.id === id))
}

/** `VM-RULE-001`/`AC-VM-002` — chặn trùng biển số; mặc định `status = AVAILABLE`. */
export async function create(input: VehicleFormInput, actor: ActorInfo): Promise<Vehicle> {
  return fakeRequest(() => {
    const current = readAll()
    if (isPlateTaken(current, input.plate)) {
      throw new Error(`Biển số ${input.plate} đã tồn tại trong hệ thống (VM-RULE-001)`)
    }
    const now = new Date().toISOString()
    const vehicle: Vehicle = {
      id: generateId('veh'),
      plate: input.plate.trim(),
      brand: input.brand.trim(),
      model: input.model.trim(),
      manufacturingYear: input.manufacturingYear,
      color: input.color?.trim() || undefined,
      vehicleClass: input.vehicleClass,
      ownershipType: input.ownershipType,
      bankFinanced: input.bankFinanced,
      currentKm: input.currentKm,
      fuelLevel: input.fuelLevel,
      status: 'AVAILABLE', // VM-RULE mặc định khi tạo mới
      note: input.note?.trim() || undefined,
      documents: [],
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...current, vehicle])
    appendAudit({
      action: 'CREATE_VEHICLE',
      entity: 'Vehicle',
      entityId: vehicle.id,
      summary: `Tạo hồ sơ xe ${vehicle.plate} (${vehicle.brand} ${vehicle.model})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: vehicle,
    })
    return vehicle
  })
}

export async function update(id: string, input: VehicleFormInput, actor: ActorInfo): Promise<Vehicle> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (isPlateTaken(all, input.plate, id)) {
      throw new Error(`Biển số ${input.plate} đã tồn tại trong hệ thống (VM-RULE-001)`)
    }
    const after: Vehicle = {
      ...before,
      plate: input.plate.trim(),
      brand: input.brand.trim(),
      model: input.model.trim(),
      manufacturingYear: input.manufacturingYear,
      color: input.color?.trim() || undefined,
      vehicleClass: input.vehicleClass,
      ownershipType: input.ownershipType,
      bankFinanced: input.bankFinanced,
      currentKm: input.currentKm,
      fuelLevel: input.fuelLevel,
      note: input.note?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((v) => (v.id === id ? after : v)))
    appendAudit({
      action: 'UPDATE_VEHICLE',
      entity: 'Vehicle',
      entityId: id,
      summary: `Cập nhật hồ sơ xe ${after.plate} (${after.brand} ${after.model})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return after
  })
}

/** `VM-RULE-003/004`/`AC-VM-003`/`AC-VM-006` — đổi trạng thái xe, không bắt buộc lý do nhưng vẫn audit đầy đủ. */
export async function changeStatus(id: string, status: VehicleStatus, actor: ActorInfo): Promise<Vehicle> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canChangeStatus(before.status, status)) {
      throw new Error(`Không thể chuyển từ ${before.status} sang ${status}`)
    }
    const after: Vehicle = { ...before, status, updatedAt: new Date().toISOString() }
    writeAll(all.map((v) => (v.id === id ? after : v)))
    appendAudit({
      action: 'CHANGE_VEHICLE_STATUS',
      entity: 'Vehicle',
      entityId: id,
      summary: `Đổi trạng thái xe ${after.plate} từ ${before.status} sang ${status}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status },
    })
    return after
  })
}

// VM-RULE-005, BRD §19 — không có `remove()`: xe không được xóa vật lý (nhất quán Employee/Customer).

/** `VM §16.1` — thêm giấy tờ mới cho xe (không có nút Xoá, giữ lịch sử). */
export async function addDocument(
  vehicleId: string,
  input: VehicleDocumentFormInput,
  actor: ActorInfo,
): Promise<Vehicle> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, vehicleId)
    const now = new Date().toISOString()
    const doc: VehicleDocument = {
      id: generateId('vdoc'),
      documentType: input.documentType,
      documentNumber: input.documentNumber?.trim() || undefined,
      issueDate: input.issueDate || undefined,
      expiryDate: input.expiryDate || undefined,
      warningLeadDays: input.warningLeadDays,
      note: input.note?.trim() || undefined,
      fileMeta: input.fileMeta,
      registeredOwnerName: input.registeredOwnerName?.trim() || undefined,
      inspectionCenter: input.inspectionCenter?.trim() || undefined,
      insuranceProvider: input.insuranceProvider?.trim() || undefined,
      policyNumber: input.policyNumber?.trim() || undefined,
      issuingBank: input.issuingBank?.trim() || undefined,
      heldRegistrationNumber: input.heldRegistrationNumber?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    const after: Vehicle = { ...before, documents: [...before.documents, doc], updatedAt: now }
    writeAll(all.map((v) => (v.id === vehicleId ? after : v)))
    appendAudit({
      action: 'ADD_VEHICLE_DOCUMENT',
      entity: 'Vehicle',
      entityId: vehicleId,
      summary: `Thêm giấy tờ ${doc.documentType} cho xe ${before.plate}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: doc,
    })
    return after
  })
}

/** `VM §16.1` — sửa giấy tờ đã có (không xoá, chỉ cập nhật bản ghi hiện tại). */
export async function updateDocument(
  vehicleId: string,
  docId: string,
  input: VehicleDocumentFormInput,
  actor: ActorInfo,
): Promise<Vehicle> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, vehicleId)
    const beforeDoc = findDocumentOrThrow(before, docId)
    const now = new Date().toISOString()
    const afterDoc: VehicleDocument = {
      ...beforeDoc,
      documentType: input.documentType,
      documentNumber: input.documentNumber?.trim() || undefined,
      issueDate: input.issueDate || undefined,
      expiryDate: input.expiryDate || undefined,
      warningLeadDays: input.warningLeadDays,
      note: input.note?.trim() || undefined,
      fileMeta: input.fileMeta ?? beforeDoc.fileMeta,
      registeredOwnerName: input.registeredOwnerName?.trim() || undefined,
      inspectionCenter: input.inspectionCenter?.trim() || undefined,
      insuranceProvider: input.insuranceProvider?.trim() || undefined,
      policyNumber: input.policyNumber?.trim() || undefined,
      issuingBank: input.issuingBank?.trim() || undefined,
      heldRegistrationNumber: input.heldRegistrationNumber?.trim() || undefined,
      updatedAt: now,
    }
    const after: Vehicle = {
      ...before,
      documents: before.documents.map((d) => (d.id === docId ? afterDoc : d)),
      updatedAt: now,
    }
    writeAll(all.map((v) => (v.id === vehicleId ? after : v)))
    appendAudit({
      action: 'UPDATE_VEHICLE_DOCUMENT',
      entity: 'Vehicle',
      entityId: vehicleId,
      summary: `Cập nhật giấy tờ ${afterDoc.documentType} của xe ${before.plate}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: beforeDoc,
      after: afterDoc,
    })
    return after
  })
}
