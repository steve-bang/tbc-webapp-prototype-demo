import type { CustomerStatus, Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { canBlock, canUnblock, findDuplicateCustomer, type Customer, type CustomerDocument } from './model'

export const CUSTOMERS_STORAGE_KEY = 'customers'

function readAll(): Customer[] {
  return readJson<Customer[]>(CUSTOMERS_STORAGE_KEY) ?? []
}

function writeAll(items: Customer[]): void {
  writeJson(CUSTOMERS_STORAGE_KEY, items)
}

export interface CustomerFilter {
  search?: string
  status?: CustomerStatus
}

export interface CustomerFormInput {
  fullName: string
  dob?: string
  gender?: Customer['gender']
  phone: string
  email?: string
  address?: string
  note?: string
  idType?: Customer['idType']
  idNumber: string
  idIssueDate?: string
  idIssuePlace?: string
  idExpiryDate?: string
  licenseNumber?: string
  licenseClass?: string
  licenseIssueDate?: string
  licenseExpiryDate?: string
}

/** Người thực hiện thao tác — dùng để ghi audit (`CM-R06`/`UC-CM-14`). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

/** `UC-CM-07`/`CM §22` — input thêm/sửa giấy tờ khách hàng. */
export interface CustomerDocumentFormInput {
  documentType: CustomerDocument['documentType']
  documentNumber: string
  issueDate?: string
  expiryDate?: string
  note?: string
  fileMeta?: CustomerDocument['fileMeta']
}

function matches(customer: Customer, filter?: CustomerFilter): boolean {
  if (!filter) return true
  if (filter.status && customer.status !== filter.status) return false
  if (filter.search) {
    const q = filter.search.trim().toLowerCase()
    if (
      q.length > 0 &&
      !customer.fullName.toLowerCase().includes(q) &&
      !customer.phone.includes(q) &&
      !customer.idNumber.toLowerCase().includes(q)
    ) {
      return false
    }
  }
  return true
}

function findOrThrow(items: Customer[], id: string): Customer {
  const found = items.find((c) => c.id === id)
  if (!found) throw new Error('Không tìm thấy khách hàng')
  return found
}

export async function list(filter?: CustomerFilter): Promise<Customer[]> {
  return fakeRequest(() => readAll().filter((c) => matches(c, filter)))
}

export async function getById(id: string): Promise<Customer | undefined> {
  return fakeRequest(() => readAll().find((c) => c.id === id))
}

/** `CM-R01`/`UC-CM-03` bước 12/`AC-CM-001` — mặc định `ACTIVE`; `CM-R02` chặn trùng SĐT/CCCD. */
export async function create(input: CustomerFormInput, actor: ActorInfo): Promise<Customer> {
  return fakeRequest(() => {
    const current = readAll()
    const duplicate = findDuplicateCustomer(current, { phone: input.phone, idNumber: input.idNumber })
    if (duplicate) {
      const fieldLabel = duplicate.matchedField === 'phone' ? 'Số điện thoại' : 'Số CCCD/Hộ chiếu'
      throw new Error(`${fieldLabel} đã được dùng bởi khách hàng ${duplicate.customer.fullName} (CM-R02)`)
    }
    const now = new Date().toISOString()
    const customer: Customer = {
      id: generateId('cus'),
      fullName: input.fullName.trim(),
      dob: input.dob || undefined,
      gender: input.gender,
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      note: input.note?.trim() || undefined,
      idType: input.idType,
      idNumber: input.idNumber.trim(),
      idIssueDate: input.idIssueDate || undefined,
      idIssuePlace: input.idIssuePlace?.trim() || undefined,
      idExpiryDate: input.idExpiryDate || undefined,
      licenseNumber: input.licenseNumber?.trim() || undefined,
      licenseClass: input.licenseClass?.trim() || undefined,
      licenseIssueDate: input.licenseIssueDate || undefined,
      licenseExpiryDate: input.licenseExpiryDate || undefined,
      status: 'ACTIVE', // CM-R01/UC-CM-03 bước 12 — mặc định ACTIVE khi tạo mới
      documents: [],
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...current, customer])
    appendAudit({
      action: 'CREATE_CUSTOMER',
      entity: 'Customer',
      entityId: customer.id,
      summary: `Tạo hồ sơ khách hàng ${customer.fullName} (${customer.phone})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: customer,
    })
    return customer
  })
}

export async function update(id: string, input: CustomerFormInput, actor: ActorInfo): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    const duplicate = findDuplicateCustomer(all, { phone: input.phone, idNumber: input.idNumber }, id)
    if (duplicate) {
      const fieldLabel = duplicate.matchedField === 'phone' ? 'Số điện thoại' : 'Số CCCD/Hộ chiếu'
      throw new Error(`${fieldLabel} đã được dùng bởi khách hàng ${duplicate.customer.fullName} (CM-R02)`)
    }
    const after: Customer = {
      ...before,
      fullName: input.fullName.trim(),
      dob: input.dob || undefined,
      gender: input.gender,
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      address: input.address?.trim() || undefined,
      note: input.note?.trim() || undefined,
      idType: input.idType,
      idNumber: input.idNumber.trim(),
      idIssueDate: input.idIssueDate || undefined,
      idIssuePlace: input.idIssuePlace?.trim() || undefined,
      idExpiryDate: input.idExpiryDate || undefined,
      licenseNumber: input.licenseNumber?.trim() || undefined,
      licenseClass: input.licenseClass?.trim() || undefined,
      licenseIssueDate: input.licenseIssueDate || undefined,
      licenseExpiryDate: input.licenseExpiryDate || undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((c) => (c.id === id ? after : c)))
    appendAudit({
      action: 'UPDATE_CUSTOMER',
      entity: 'Customer',
      entityId: id,
      summary: `Cập nhật hồ sơ khách hàng ${after.fullName} (${after.phone})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    return after
  })
}

/** `CM §10`/`CM-R03`/`AC-CM-006`/`UC-CM-06` — khoá khách, bắt buộc lý do. */
export async function block(id: string, reason: string, actor: ActorInfo): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canBlock(before.status)) {
      throw new Error(`Không thể khoá khách hàng đang ở trạng thái ${before.status}`)
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new Error('Lý do khoá khách hàng là bắt buộc') // UC-CM-06 — Reason bắt buộc
    }
    const after: Customer = {
      ...before,
      status: 'BLOCKED',
      blockReason: trimmedReason,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((c) => (c.id === id ? after : c)))
    appendAudit({
      action: 'BLOCK_CUSTOMER',
      entity: 'Customer',
      entityId: id,
      summary: `Khoá khách hàng ${before.fullName} (${before.phone}): ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'BLOCKED', reason: trimmedReason },
    })
    return after
  })
}

/** Suy ra từ `UC-CM-06` — mở khoá, bắt buộc lý do (quyết định Phase 1, xem kế hoạch §5). */
export async function unblock(id: string, reason: string, actor: ActorInfo): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canUnblock(before.status)) {
      throw new Error(`Không thể mở khoá khách hàng đang ở trạng thái ${before.status}`)
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new Error('Lý do mở khoá khách hàng là bắt buộc')
    }
    const after: Customer = {
      ...before,
      status: 'ACTIVE',
      blockReason: undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((c) => (c.id === id ? after : c)))
    appendAudit({
      action: 'UNBLOCK_CUSTOMER',
      entity: 'Customer',
      entityId: id,
      summary: `Mở khoá khách hàng ${before.fullName} (${before.phone}): ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'ACTIVE', reason: trimmedReason },
    })
    return after
  })
}

// CM-R05/UC-CM-BR-05 — không có `remove()`: khách hàng đã phát sinh nghiệp vụ không được xóa vật lý.

function findDocumentOrThrow(customer: Customer, docId: string): CustomerDocument {
  const found = customer.documents.find((d) => d.id === docId)
  if (!found) throw new Error('Không tìm thấy giấy tờ')
  return found
}

/** `UC-CM-07`/`CM §22`/`UC-CM-14` — thêm giấy tờ mới cho khách hàng. */
export async function addDocument(
  customerId: string,
  input: CustomerDocumentFormInput,
  actor: ActorInfo,
): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, customerId)
    const now = new Date().toISOString()
    const doc: CustomerDocument = {
      id: generateId('doc'),
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      issueDate: input.issueDate || undefined,
      expiryDate: input.expiryDate || undefined,
      note: input.note?.trim() || undefined,
      fileMeta: input.fileMeta,
      createdAt: now,
      updatedAt: now,
    }
    const after: Customer = { ...before, documents: [...before.documents, doc], updatedAt: now }
    writeAll(all.map((c) => (c.id === customerId ? after : c)))
    appendAudit({
      action: 'ADD_CUSTOMER_DOCUMENT',
      entity: 'Customer',
      entityId: customerId,
      summary: `Thêm giấy tờ ${doc.documentType} (${doc.documentNumber}) cho khách hàng ${before.fullName}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: doc,
    })
    return after
  })
}

/** `UC-CM-07`/`CM §22`/`UC-CM-14` — sửa giấy tờ đã có. */
export async function updateDocument(
  customerId: string,
  docId: string,
  input: CustomerDocumentFormInput,
  actor: ActorInfo,
): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, customerId)
    const beforeDoc = findDocumentOrThrow(before, docId)
    const now = new Date().toISOString()
    const afterDoc: CustomerDocument = {
      ...beforeDoc,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      issueDate: input.issueDate || undefined,
      expiryDate: input.expiryDate || undefined,
      note: input.note?.trim() || undefined,
      fileMeta: input.fileMeta ?? beforeDoc.fileMeta,
      updatedAt: now,
    }
    const after: Customer = {
      ...before,
      documents: before.documents.map((d) => (d.id === docId ? afterDoc : d)),
      updatedAt: now,
    }
    writeAll(all.map((c) => (c.id === customerId ? after : c)))
    appendAudit({
      action: 'UPDATE_CUSTOMER_DOCUMENT',
      entity: 'Customer',
      entityId: customerId,
      summary: `Cập nhật giấy tờ ${afterDoc.documentType} (${afterDoc.documentNumber}) của khách hàng ${before.fullName}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: beforeDoc,
      after: afterDoc,
    })
    return after
  })
}

/** `UC-CM-14` liệt kê "Delete Document" là audit trigger — xoá được (khác `Customer` gốc, không ràng buộc như `CM-R05`). */
export async function removeDocument(customerId: string, docId: string, actor: ActorInfo): Promise<Customer> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, customerId)
    const doc = findDocumentOrThrow(before, docId)
    const now = new Date().toISOString()
    const after: Customer = {
      ...before,
      documents: before.documents.filter((d) => d.id !== docId),
      updatedAt: now,
    }
    writeAll(all.map((c) => (c.id === customerId ? after : c)))
    appendAudit({
      action: 'DELETE_CUSTOMER_DOCUMENT',
      entity: 'Customer',
      entityId: customerId,
      summary: `Xoá giấy tờ ${doc.documentType} (${doc.documentNumber}) của khách hàng ${before.fullName}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: doc,
    })
    return after
  })
}
