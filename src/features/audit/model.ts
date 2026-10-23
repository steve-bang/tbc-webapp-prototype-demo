import type { AuditActorType, AuditModule, AuditSeverity, Role } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { AUDIT_ACTION_LABELS, AUDIT_MODULE_LABELS, AUDIT_SEVERITY_LABELS } from '@/shared/i18n/auditLabels'
import type { AuditRecord } from '@/shared/lib/audit'
import type { CsvCell } from '@/shared/lib/csv'
import { formatDateTime, toDateKey } from '@/shared/lib/datetime'

/**
 * Hàm thuần của màn Nhật ký thao tác (AuditLog-BRD.md §6/§9/§10/§11/§16; DASHBOARD-PLATFORM-PLAN.md §4.5/§20.2 mục 9).
 * KHÔNG đọc storage, KHÔNG `new Date()` — thời điểm và viewer do `api.ts`/hook truyền vào.
 */

// ---------------------------------------------------------------------------
// Module / Severity / Actor Type — suy ra khi bản ghi cũ không có trường (D7)
// ---------------------------------------------------------------------------

/**
 * Entity → Module (AuditLog-BRD.md §6; DASHBOARD-PLATFORM-PLAN.md §3.3). Phủ MỌI giá trị `entity` đang được ghi trong `src/`
 * (grep `entity:` — kể cả giá trị `entity` động ở `consignment/api.ts`). Các mã module `NOTIFICATION`/`MAINTENANCE`/`CALENDAR`/
 * `CONSIGNMENT`/`SYSTEM_ADMIN` là BA đề xuất (AL §6 chưa liệt kê). Entity lạ → `resolveModule` trả `undefined` (UI hiện `entity` thô).
 */
export const ENTITY_MODULE_MAP: Record<string, AuditModule> = {
  Vehicle: 'VEHICLE',
  VehicleDocument: 'VEHICLE',
  MaintenanceRule: 'MAINTENANCE',
  MaintenanceRecord: 'MAINTENANCE',
  SparePartRecord: 'MAINTENANCE',
  Customer: 'CUSTOMER',
  VehicleBlock: 'CALENDAR',
  Employee: 'EMPLOYEE',
  Assignment: 'EMPLOYEE',
  UserAccount: 'AUTH',
  Rental: 'RENTAL',
  Contract: 'CONTRACT',
  HandoverRecord: 'HANDOVER',
  ReturnRecord: 'RETURN',
  Incident: 'INCIDENT',
  Settlement: 'SETTLEMENT',
  Transaction: 'PAYMENT',
  PaymentRequest: 'PAYMENT',
  CashDrawerSubmission: 'PAYMENT',
  CostRecord: 'REVENUE_COST',
  FinanceReport: 'REVENUE_COST',
  VehicleOwner: 'CONSIGNMENT',
  ConsignmentProposal: 'CONSIGNMENT',
  ConsignmentContract: 'CONSIGNMENT',
  ConsignmentHandoverRecord: 'CONSIGNMENT',
  OwnerPayoutRecord: 'CONSIGNMENT',
  NotificationEvent: 'NOTIFICATION',
  AuditLog: 'AUDIT',
  SystemConfig: 'SYSTEM_ADMIN',
}

/** Ưu tiên `record.module` (bản ghi mới/seed), rồi bảng ánh xạ theo `entity`; không có → `undefined`, không ném. */
export function resolveModule(record: Pick<AuditRecord, 'module' | 'entity'>): AuditModule | undefined {
  if (record.module) return record.module
  return Object.prototype.hasOwnProperty.call(ENTITY_MODULE_MAP, record.entity) ? ENTITY_MODULE_MAP[record.entity] : undefined
}

export function resolveSeverity(record: Pick<AuditRecord, 'severity'>): AuditSeverity {
  return record.severity ?? 'INFO'
}

export function resolveActorType(record: Pick<AuditRecord, 'actorType'>): AuditActorType {
  return record.actorType ?? 'USER'
}

// ---------------------------------------------------------------------------
// Phạm vi xem theo vai trò (AL-BR-12; AL §16; CR-2026-035/037)
// ---------------------------------------------------------------------------

export type AuditScope = 'ALL' | 'FINANCE' | 'NONE'

const FINANCE_MODULES: AuditModule[] = ['SETTLEMENT', 'PAYMENT', 'REVENUE_COST']

/**
 * `SYSTEM_ADMIN`/`MANAGER`/`SALES` → toàn hệ thống (CR-2026-037; SALES ≈ MANAGER — CR-2026-035). `ACCOUNTANT` → chỉ phạm vi tài chính.
 * Còn lại (`OPERATION_STAFF`, `DISPATCHER`) → không xem (AL-BR-12; DISPATCHER `TBD`).
 * TODO(OQ: AuditLog-BRD.md §16 — "giới hạn tài chính" gồm những module nào; DASHBOARD-PLATFORM-PLAN.md §11 Q9).
 */
export function scopeForRole(role: Role): AuditScope {
  if (role === 'SYSTEM_ADMIN' || role === 'MANAGER' || role === 'SALES') return 'ALL'
  if (role === 'ACCOUNTANT') return 'FINANCE'
  return 'NONE'
}

export function isInScope(record: Pick<AuditRecord, 'module' | 'entity'>, scope: AuditScope): boolean {
  if (scope === 'ALL') return true
  if (scope === 'NONE') return false
  const module = resolveModule(record)
  return (module !== undefined && FINANCE_MODULES.includes(module)) || record.entity === 'OwnerPayoutRecord'
}

// ---------------------------------------------------------------------------
// Lọc & phân trang (AL §9.1/§9.2)
// ---------------------------------------------------------------------------

export interface AuditFilter {
  module?: AuditModule
  action?: AuditRecord['action']
  actorUserId?: string
  actorType?: AuditActorType
  /** Loại đối tượng (`entity`), khớp chính xác. */
  entity?: string
  entityId?: string
  severity?: AuditSeverity
  correlationId?: string
  /** `yyyy-MM-dd`, ngày +07 của `at`. */
  from?: string
  to?: string
}

function localDay(iso: string): string {
  return toDateKey(iso)
}

/** Lọc theo AL §9.1; giữ nguyên thứ tự đầu vào (kỳ vọng mới → cũ). Tiêu chí bỏ trống = không lọc. */
export function filterAuditRecords(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {
  return records.filter((r) => {
    if (filter.module && resolveModule(r) !== filter.module) return false
    if (filter.action && r.action !== filter.action) return false
    if (filter.actorUserId && r.actorUserId !== filter.actorUserId) return false
    if (filter.actorType && resolveActorType(r) !== filter.actorType) return false
    if (filter.entity && r.entity !== filter.entity) return false
    if (filter.entityId && r.entityId !== filter.entityId) return false
    if (filter.severity && resolveSeverity(r) !== filter.severity) return false
    if (filter.correlationId && r.correlationId !== filter.correlationId) return false
    if (filter.from || filter.to) {
      const day = localDay(r.at)
      if (filter.from && day < filter.from) return false
      if (filter.to && day > filter.to) return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Che dữ liệu nhạy cảm — CHỈ ở tầng hiển thị/CSV, bản lưu giữ đầy đủ (AL-BR-07; AL §11)
// ---------------------------------------------------------------------------

export type SensitiveKind = 'ID' | 'PHONE' | 'BANK'

/**
 * Tên khoá nhạy cảm trong ảnh chụp `before`/`after` → loại dữ liệu (AL §11).
 * TODO(OQ: AuditLog-BRD.md §22 Q4 — danh sách trường nhạy cảm & quy tắc che tổng quát chưa được khách xác nhận).
 */
export const SENSITIVE_FIELDS: Record<string, SensitiveKind> = {
  idNumber: 'ID',
  licenseNumber: 'ID',
  documentNumber: 'ID',
  passportNumber: 'ID',
  phone: 'PHONE',
  accountNumber: 'BANK',
  bankAccountNumber: 'BANK',
}

function sensitiveKindOf(key: string): SensitiveKind | undefined {
  return Object.prototype.hasOwnProperty.call(SENSITIVE_FIELDS, key) ? SENSITIVE_FIELDS[key] : undefined
}

/**
 * Ai xem đầy đủ (AL §11 + §16): CCCD/Passport/GPLX và SĐT → Admin/Manager (SALES ≈ Manager — CR-2026-035, CR-2026-037);
 * số tài khoản → thêm Accountant. Xem đầy đủ luôn cần bấm "Hiện đầy đủ" (AL-BR-08).
 */
export function canRevealSensitive(role: Role, kind: SensitiveKind): boolean {
  if (role === 'SYSTEM_ADMIN' || role === 'MANAGER' || role === 'SALES') return true
  if (role === 'ACCOUNTANT') return kind === 'BANK'
  return false
}

/** Giữ 4 ký tự đầu + 2 cuối, giữa `****`; chuỗi ≤ 6 ký tự → `****` (AL §11, ví dụ `0123****89`). */
export function maskSensitive(value: string): string {
  if (value.length <= 6) return '****'
  return `${value.slice(0, 4)}****${value.slice(-2)}`
}

/**
 * Trả BẢN SAO đã che theo tên khoá (đệ quy object/mảng); không đổi bản gốc. Hiện đầy đủ một khoá chỉ khi `revealed` VÀ vai trò
 * được phép xem loại đó (`canRevealSensitive`).
 */
export function maskSnapshot(value: unknown, role: Role, revealed: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => maskSnapshot(v, role, revealed))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const kind = sensitiveKindOf(key)
      if (kind && (typeof child === 'string' || typeof child === 'number')) {
        out[key] = revealed && canRevealSensitive(role, kind) ? child : maskSensitive(String(child))
      } else {
        out[key] = maskSnapshot(child, role, revealed)
      }
    }
    return out
  }
  return value
}

/** Các loại dữ liệu nhạy cảm (có giá trị) xuất hiện trong `before`/`after` của bản ghi. */
export function sensitiveKindsIn(record: Pick<AuditRecord, 'before' | 'after'>): SensitiveKind[] {
  const found = new Set<SensitiveKind>()
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk)
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const kind = sensitiveKindOf(key)
        if (kind && (typeof child === 'string' || typeof child === 'number')) found.add(kind)
        else walk(child)
      }
    }
  }
  walk(record.before)
  walk(record.after)
  return [...found]
}

export function hasSensitiveValue(record: Pick<AuditRecord, 'before' | 'after'>): boolean {
  return sensitiveKindsIn(record).length > 0
}

/** Vai trò có xem đầy đủ được ÍT NHẤT một loại nhạy cảm có trong bản ghi (điều kiện hiện nút "Hiện đầy đủ"). */
export function canRevealAnyIn(record: Pick<AuditRecord, 'before' | 'after'>, role: Role): boolean {
  return sensitiveKindsIn(record).some((kind) => canRevealSensitive(role, kind))
}

// ---------------------------------------------------------------------------
// Xuất CSV (AL §10)
// ---------------------------------------------------------------------------

/** Giới hạn số bản ghi mỗi lần xuất; vượt → yêu cầu thu hẹp bộ lọc (AL §10). */
export const AUDIT_EXPORT_MAX_ROWS = 2000

export interface AuditExporter {
  fullName: string
  role: Role
}

/** Mô tả bộ lọc đang áp dụng thành một chuỗi (dòng "tiêu chí lọc" của CSV). */
export function describeFilter(filter: AuditFilter): string {
  const t = vi.audit.csv
  const parts: string[] = []
  if (filter.module) parts.push(`${t.fModule}: ${AUDIT_MODULE_LABELS[filter.module]}`)
  if (filter.action) parts.push(`${t.fAction}: ${AUDIT_ACTION_LABELS[filter.action]}`)
  if (filter.actorUserId) parts.push(`${t.fActor}: ${filter.actorUserId}`)
  if (filter.actorType) parts.push(`${t.fActorType}: ${filter.actorType}`)
  if (filter.entity) parts.push(`${t.fEntity}: ${filter.entity}`)
  if (filter.entityId) parts.push(`${t.fEntityId}: ${filter.entityId}`)
  if (filter.severity) parts.push(`${t.fSeverity}: ${AUDIT_SEVERITY_LABELS[filter.severity]}`)
  if (filter.correlationId) parts.push(`${t.fCorrelation}: ${filter.correlationId}`)
  if (filter.from) parts.push(`${t.fFrom}: ${filter.from}`)
  if (filter.to) parts.push(`${t.fTo}: ${filter.to}`)
  return parts.length > 0 ? parts.join('; ') : t.noFilter
}

/**
 * 4 dòng đầu (tiêu chí lọc · thời điểm xuất · người xuất (tên + vai trò) · số bản ghi) rồi tiêu đề cột + dữ liệu.
 * KHÔNG xuất `before`/`after` (đã che ở UI, CSV chỉ là bản tóm tắt điều tra).
 */
export function buildAuditCsvRows(
  records: AuditRecord[],
  filter: AuditFilter,
  exporter: AuditExporter,
  now: Date,
): CsvCell[][] {
  const t = vi.audit.csv
  const rows: CsvCell[][] = [
    [t.criteria, describeFilter(filter)],
    [t.exportedAt, formatDateTime(now.toISOString())],
    [t.exportedBy, `${exporter.fullName} (${exporter.role})`],
    [t.count, records.length],
    [t.colTime, t.colActor, t.colRole, t.colModule, t.colAction, t.colEntity, t.colEntityId, t.colSummary, t.colSeverity, t.colCorrelation],
  ]
  for (const r of records) {
    const module = resolveModule(r)
    rows.push([
      formatDateTime(r.at),
      r.actorName,
      resolveActorType(r) === 'SYSTEM' ? 'SYSTEM' : r.actorRole,
      module ? AUDIT_MODULE_LABELS[module] : r.entity,
      AUDIT_ACTION_LABELS[r.action] ?? r.action,
      r.entity,
      r.entityId,
      r.summary,
      AUDIT_SEVERITY_LABELS[resolveSeverity(r)],
      r.correlationId,
    ])
  }
  return rows
}
