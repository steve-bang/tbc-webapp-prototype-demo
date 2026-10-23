import { can } from '@/shared/domain/permissions'
import type { Role } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { appendAudit, listAuditRecords, type AuditRecord } from '@/shared/lib/audit'
import { toCsv } from '@/shared/lib/csv'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import {
  AUDIT_EXPORT_MAX_ROWS,
  buildAuditCsvRows,
  canRevealAnyIn,
  filterAuditRecords,
  isInScope,
  maskSnapshot,
  paginate,
  scopeForRole,
  type AuditFilter,
  type AuditScope,
  type PageResult,
} from './model'

/** Người đang xem/xuất nhật ký (lấy từ session ở hooks). */
export interface AuditViewer {
  userId: string
  fullName: string
  role: Role
}

/**
 * Chỉ ĐỌC + ghi meta-audit; không có hàm nào sửa/xoá bản ghi (AL-BR-01). Phạm vi xem theo vai trò áp ở ĐÂY (AL-BR-12), không chỉ ở UI.
 */

function scopedRecords(viewer: AuditViewer): { records: AuditRecord[]; scope: AuditScope } {
  const scope = scopeForRole(viewer.role)
  if (scope === 'NONE') throw new Error(vi.audit.errors.noAccess)
  return { records: listAuditRecords().filter((r) => isInScope(r, scope)), scope }
}

function viewerFields(viewer: AuditViewer) {
  return { actorUserId: viewer.userId, actorName: viewer.fullName, actorRole: viewer.role }
}

/** Danh sách đã lọc theo phạm vi vai trò + bộ lọc, phân trang (mới → cũ). */
export async function listAuditRecordsPage(
  filter: AuditFilter,
  page: number,
  pageSize: number,
  viewer: AuditViewer,
): Promise<PageResult<AuditRecord>> {
  return fakeRequest(() => {
    const { records } = scopedRecords(viewer)
    const result = paginate(filterAuditRecords(records, filter), page, pageSize)
    // Danh sách chỉ hiện `summary`; ảnh chụp trước/sau không cần trả về → bỏ ra khỏi kết quả cho nhẹ.
    return { ...result, items: result.items.map(({ before: _b, after: _a, ...rest }) => rest) }
  })
}

/** Một bản ghi với `before`/`after` ĐÃ CHE theo vai trò (chưa "Hiện đầy đủ"). */
export async function getAuditRecord(id: string, viewer: AuditViewer): Promise<AuditRecord> {
  return fakeRequest(() => {
    const { records } = scopedRecords(viewer)
    const record = records.find((r) => r.id === id)
    if (!record) throw new Error(vi.audit.errors.notFound)
    return {
      ...record,
      before: record.before === undefined ? undefined : maskSnapshot(record.before, viewer.role, false),
      after: record.after === undefined ? undefined : maskSnapshot(record.after, viewer.role, false),
    }
  })
}

/**
 * "Hiện đầy đủ": trả ảnh chụp không che ở các loại viewer được phép (phần còn lại vẫn che) + ghi meta-audit
 * `VIEW_AUDIT_SENSITIVE_VALUE` (`SENSITIVE`) — AL-BR-08, AL §11.
 */
export async function revealAuditRecord(id: string, viewer: AuditViewer): Promise<AuditRecord> {
  return fakeRequest(() => {
    const { records } = scopedRecords(viewer)
    const record = records.find((r) => r.id === id)
    if (!record) throw new Error(vi.audit.errors.notFound)
    if (!canRevealAnyIn(record, viewer.role)) throw new Error(vi.audit.errors.revealForbidden)
    appendAudit({
      ...viewerFields(viewer),
      action: 'VIEW_AUDIT_SENSITIVE_VALUE',
      module: 'AUDIT',
      severity: 'SENSITIVE',
      entity: 'AuditLog',
      entityId: record.id,
      summary: vi.audit.metaRevealSummary.replace('{{id}}', record.id),
    })
    return {
      ...record,
      before: record.before === undefined ? undefined : maskSnapshot(record.before, viewer.role, true),
      after: record.after === undefined ? undefined : maskSnapshot(record.after, viewer.role, true),
    }
  })
}

/**
 * Meta-audit mở màn Nhật ký (AL-BR-06). Gọi MỘT lần mỗi lần mở màn — không ghi mỗi lần đổi bộ lọc.
 * TODO(OQ: AuditLog-BRD.md §22 Q1 — meta-audit khi xem/tìm nhật ký có bắt buộc từng lần không; DASHBOARD-PLATFORM-PLAN.md §11 Q8).
 */
export async function recordAuditLogView(viewer: AuditViewer): Promise<void> {
  return fakeRequest(() => {
    if (scopeForRole(viewer.role) === 'NONE') throw new Error(vi.audit.errors.noAccess)
    appendAudit({
      ...viewerFields(viewer),
      action: 'VIEW_AUDIT_LOG',
      module: 'AUDIT',
      severity: 'NOTICE',
      entity: 'AuditLog',
      entityId: 'view',
      summary: vi.audit.metaViewSummary,
    })
  })
}

/**
 * Xuất kết quả đang lọc ra CSV (AL §10): cần quyền `AUDIT.EXPORT`, áp phạm vi vai trò, vượt `AUDIT_EXPORT_MAX_ROWS` → yêu cầu thu hẹp lọc.
 * Ghi `EXPORT` (`module = AUDIT`) SAU khi dựng CSV nên file không chứa chính dòng meta-audit của nó.
 * TODO(OQ: AuditLog-BRD.md §22 Q11 — Accountant có được xuất không) — hiện `TBD` ⇒ bị chặn ở đây.
 */
export async function exportAuditCsv(filter: AuditFilter, viewer: AuditViewer): Promise<string> {
  return fakeRequest(() => {
    if (!can(viewer.role, 'AUDIT', 'EXPORT')) throw new Error(vi.audit.errors.exportForbidden)
    const { records } = scopedRecords(viewer)
    const rows = filterAuditRecords(records, filter)
    if (rows.length > AUDIT_EXPORT_MAX_ROWS) {
      throw new Error(vi.audit.errors.exportTooMany.replace('{{max}}', String(AUDIT_EXPORT_MAX_ROWS)))
    }
    const csv = toCsv(buildAuditCsvRows(rows, filter, { fullName: viewer.fullName, role: viewer.role }, new Date()))
    appendAudit({
      ...viewerFields(viewer),
      action: 'EXPORT',
      module: 'AUDIT',
      severity: 'NOTICE',
      entity: 'AuditLog',
      entityId: 'export',
      summary: vi.audit.metaExportSummary.replace('{{count}}', String(rows.length)),
    })
    return csv
  })
}
