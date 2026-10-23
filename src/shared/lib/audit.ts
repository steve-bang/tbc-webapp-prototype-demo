import type { AuditAction, AuditActorType, AuditModule, AuditSeverity } from '@/shared/domain/enums'
import { generateId } from './id'
import { readJson, writeJson } from './storage'

const AUDIT_KEY = 'audit'
/**
 * Trần dung lượng key `audit` (số ký tự JSON) — GIỚI HẠN KỸ THUẬT của bản demo (localStorage có hạn), KHÔNG phải chính sách lưu trữ.
 * DASHBOARD-PLATFORM-PLAN.md D8 · §9.1. TODO(OQ: AuditLog-BRD.md §12.2/§22 Q6 — thời hạn lưu trữ nhật ký).
 * Vượt trần thì bỏ bản ghi CŨ NHẤT (đây là cơ chế cắt duy nhất được phép — AL-BR-01).
 */
export const AUDIT_MAX_CHARS = 400_000
/** Khi `setItem` ném lỗi (localStorage đầy): bỏ thêm tỉ lệ này số bản ghi cũ nhất rồi ghi lại đúng một lần. */
const AUDIT_TRIM_RATIO_ON_FAIL = 0.2

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
  // --- Trường mở rộng (AuditLog-BRD.md §6; DASHBOARD-PLATFORM-PLAN.md D7) — TUỲ CHỌN để 113 lời gọi cũ không phải sửa. ---
  /** Thiếu thì suy ra từ `entity` (`features/audit/model.ts` `resolveModule`). */
  module?: AuditModule
  /** Thiếu thì coi `INFO`. */
  severity?: AuditSeverity
  /** Thiếu thì coi `USER`. `SYSTEM` = tác nhân hệ thống (không có người thao tác). */
  actorType?: AuditActorType
  /** Nối các bản ghi của cùng một thao tác nghiệp vụ (AL-BR-04) — chỉ bản ghi mới/seed có. */
  correlationId?: string
  /** Lý do (AL-BR-03). */
  reason?: string
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

  // Cắt theo ký tự, tính TĂNG DẦN: stringify cả mảng đúng một lần, rồi trừ dần độ dài từng bản ghi cũ nhất bị bỏ (+1 dấu phẩy).
  let total = JSON.stringify(records).length
  while (total > AUDIT_MAX_CHARS && records.length > 1) {
    const oldest = records.pop() as AuditRecord
    total -= JSON.stringify(oldest).length + 1
  }

  // Ghi thất bại (localStorage đầy) → bỏ thêm 20% bản ghi cũ nhất rồi ghi lại ĐÚNG MỘT LẦN (D8) — không im lặng mất bản ghi mới nhất.
  if (!writeJson(AUDIT_KEY, records)) {
    writeJson(AUDIT_KEY, records.slice(0, Math.max(1, Math.floor(records.length * (1 - AUDIT_TRIM_RATIO_ON_FAIL)))))
  }
}

export function listAuditRecords(): AuditRecord[] {
  return readJson<AuditRecord[]>(AUDIT_KEY) ?? []
}

export function seedAuditRecords(records: AuditRecord[]): void {
  writeJson(AUDIT_KEY, records)
}
