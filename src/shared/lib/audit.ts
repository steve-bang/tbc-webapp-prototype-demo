import type { AuditAction } from '@/shared/domain/enums'
import { generateId } from './id'
import { readJson, writeJson } from './storage'

const AUDIT_KEY = 'audit'
const MAX_RECORDS = 500

export interface AuditRecord {
  id: string
  action: AuditAction
  /** Tên entity dạng "Vehicle", "Rental", "Contract"... — không phải Resource enum để hiển thị tự nhiên. */
  entity: string
  entityId: string
  /** Mô tả ngắn gọn để hiển thị trực tiếp trong danh sách, không cần join thêm dữ liệu. */
  summary: string
  actorUserId: string
  actorName: string
  actorRole: string
  at: string
  before?: unknown
  after?: unknown
}

/**
 * Ghi một bản ghi audit bất biến (append-only) — tương đương `appendAudit()`
 * của App nhân viên (`shared/lib/audit.ts`). Mọi hàm create/update/remove ở
 * `features/<feature>/api.ts` phải gọi hàm này để màn "Nhật ký thao tác" có dữ liệu
 * thật phát sinh từ chính thao tác demo.
 */
export function appendAudit(input: Omit<AuditRecord, 'id' | 'at'>): void {
  const records = readJson<AuditRecord[]>(AUDIT_KEY) ?? []
  const record: AuditRecord = { ...input, id: generateId('AL'), at: new Date().toISOString() }
  records.unshift(record)
  writeJson(AUDIT_KEY, records.slice(0, MAX_RECORDS))
}

export function listAuditRecords(): AuditRecord[] {
  return readJson<AuditRecord[]>(AUDIT_KEY) ?? []
}

export function seedAuditRecords(records: AuditRecord[]): void {
  writeJson(AUDIT_KEY, records)
}
