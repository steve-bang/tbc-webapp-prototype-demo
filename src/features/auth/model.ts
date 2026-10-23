import { z } from 'zod'
import type { Role } from '@/shared/domain/enums'
import { RESOURCES, type listPermissionMatrix } from '@/shared/domain/permissions'

export interface DemoAccount {
  userId: string
  username: string
  /** Mật khẩu demo hiển thị sẵn trên màn Login — bản demo chấp nhận mọi mật khẩu. */
  password: string
  fullName: string
  role: Role
}

export interface SessionUser {
  userId: string
  username: string
  fullName: string
  role: Role
}

/**
 * Tài khoản nội bộ đăng nhập bằng username + password do Admin cấp — không
 * OTP (CR-2026-034). Mỗi vai trò trong `WebappQuanTri.md` §3 có một tài
 * khoản demo để người trình bày chọn nhanh trên màn Login.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    userId: 'usr_admin',
    username: 'admin',
    password: 'admin123',
    fullName: 'Nguyễn Văn Admin',
    role: 'SYSTEM_ADMIN',
  },
  {
    userId: 'usr_manager',
    username: 'manager',
    password: 'manager123',
    fullName: 'Trần Thị Quản Lý',
    role: 'MANAGER',
  },
  {
    userId: 'usr_dispatcher',
    username: 'dispatcher',
    password: 'dispatcher123',
    fullName: 'Lê Văn Điều Phối',
    role: 'DISPATCHER',
  },
  {
    userId: 'usr_sales',
    username: 'sales',
    password: 'sales123',
    fullName: 'Phạm Thị Kinh Doanh',
    role: 'SALES',
  },
  {
    userId: 'usr_accountant',
    username: 'accountant',
    password: 'accountant123',
    fullName: 'Đỗ Thị Kế Toán',
    role: 'ACCOUNTANT',
  },
  {
    userId: 'usr_staff',
    username: 'staff',
    password: 'staff123',
    fullName: 'Hoàng Văn Nhân Viên',
    role: 'OPERATION_STAFF',
  },
]

export function findDemoAccount(username: string, password: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase() && password.length > 0,
  )
}

// ---------------------------------------------------------------------------
// Cấu hình hệ thống (SystemAdministration-BRD.md §6.3/§10, UC-SA-12) — DASHBOARD-PLATFORM-PLAN.md §21.2
// ---------------------------------------------------------------------------

/**
 * Cấu hình công ty — một bản ghi duy nhất (`SA` §10). Múi giờ + tiền tệ cố định, chỉ đọc (`SA-BR-14`).
 * TODO(OQ: SystemAdministration-BRD.md §19 Q8) danh sách trường cuối cùng · TODO(OQ: §19 Q9) một pháp nhân hay nhiều.
 */
export interface SystemConfig {
  companyName: string
  address: string
  taxCode: string
  representative: string
  phone: string
  email: string
  /** Logo chỉ là ghi chú văn bản ở bản demo (không upload ảnh). */
  logoNote: string
  timezone: 'Asia/Ho_Chi_Minh'
  currency: 'VND'
  updatedAt?: string
  updatedBy?: string
}

const OPTIONAL_TEXT = z.string().trim()

/** Form cấu hình công ty (SA §10): tên bắt buộc ≥ 3 ký tự; email đúng định dạng nếu có; timezone/currency không nằm trong form. */
export const systemConfigSchema = z.object({
  companyName: z.string().trim().min(3, 'Tên công ty phải có ít nhất 3 ký tự'),
  address: OPTIONAL_TEXT,
  taxCode: OPTIONAL_TEXT,
  representative: OPTIONAL_TEXT,
  phone: OPTIONAL_TEXT,
  email: OPTIONAL_TEXT.refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Email không hợp lệ' }),
  logoNote: OPTIONAL_TEXT,
})
export type SystemConfigFormValues = z.infer<typeof systemConfigSchema>

/**
 * Trần dung lượng localStorage giả định cho đồng hồ dung lượng (WebKit ~5 MB UTF-16 ≈ 2,6 triệu ký tự) —
 * DEMO-DATA-PLAN.md D13; chỉ là ước lượng của bản demo, không phải giới hạn nghiệp vụ.
 */
export const DEMO_STORAGE_QUOTA_CHARS = 2_600_000

/** Tỉ lệ dùng dung lượng 0..1+ (có thể vượt 1). Thuần. */
export function storageUsageRatio(totalChars: number): number {
  return totalChars / DEMO_STORAGE_QUOTA_CHARS
}

// ---------------------------------------------------------------------------
// Vai trò & quyền — chỉ đọc (SystemAdministration-BRD.md §9, UC-SA-09 phần xem)
// ---------------------------------------------------------------------------

/** Kiểu một dòng ma trận (`PermissionEntry` không export ở permissions.ts — R4a không đổi file đó). */
export type PermissionMatrixEntry = ReturnType<typeof listPermissionMatrix>[number]

export interface PermissionMatrixSummary {
  entries: number
  cells: number
  trueCells: number
  falseCells: number
  tbdCells: number
  /** Ô chưa khai báo = hệ thống coi như không có quyền. */
  undefinedCells: number
  /** Số dòng (resource × action) có ít nhất một ô `TBD`. */
  rowsWithTbd: number
}

export function summarizePermissionMatrix(entries: readonly PermissionMatrixEntry[], roles: readonly Role[]): PermissionMatrixSummary {
  const s: PermissionMatrixSummary = { entries: entries.length, cells: entries.length * roles.length, trueCells: 0, falseCells: 0, tbdCells: 0, undefinedCells: 0, rowsWithTbd: 0 }
  for (const entry of entries) {
    let hasTbd = false
    for (const role of roles) {
      const v = entry.values[role]
      if (v === true) s.trueCells++
      else if (v === false) s.falseCells++
      else if (v === 'TBD') {
        s.tbdCells++
        hasTbd = true
      } else s.undefinedCells++
    }
    if (hasTbd) s.rowsWithTbd++
  }
  return s
}

/** Nhóm theo `resource`, giữ thứ tự `RESOURCES`; bỏ resource không có dòng. */
export function groupPermissionEntries(entries: readonly PermissionMatrixEntry[]): { resource: PermissionMatrixEntry['resource']; entries: PermissionMatrixEntry[] }[] {
  return RESOURCES.map((resource) => ({ resource, entries: entries.filter((e) => e.resource === resource) })).filter((g) => g.entries.length > 0)
}
