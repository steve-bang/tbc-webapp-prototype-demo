import { z } from 'zod'
import { EMPLOYEE_STATUSES, ROLES } from '@/shared/domain/enums'
import type { AccountStatus, EmployeeStatus, Role } from '@/shared/domain/enums'

/**
 * Tài khoản đăng nhập nhúng trong hồ sơ nhân viên — quan hệ 0..1 (`EA-BR-01`).
 * Bản chất xác thực/phiên đăng nhập thuộc `SystemAdministration`; feature này
 * chỉ yêu cầu tạo và hiển thị trạng thái liên kết.
 */
export interface UserAccount {
  userId: string
  username: string
  accountStatus: AccountStatus
}

/** Hồ sơ nhân viên — `EmployeeAssignment-BRD.md` §6 (module `EA`). */
export interface Employee {
  id: string
  employeeCode: string
  fullName: string
  phone: string
  email?: string
  role: Role
  status: EmployeeStatus
  hireDate?: string
  /** Khu vực phụ trách — chuẩn bị sẵn cho điều phối Phase 2. */
  assignedArea?: string
  note?: string
  account?: UserAccount
  createdAt: string
  updatedAt: string
}

/** Sinh `Employee Code` tiếp theo dạng `NV-001`, `NV-002`… — `UC-EA-01` §5.4 bước 5. */
export function nextEmployeeCode(list: Employee[]): string {
  const max = list.reduce((acc, e) => {
    const match = /^NV-(\d+)$/.exec(e.employeeCode)
    if (!match) return acc
    return Math.max(acc, Number(match[1]))
  }, 0)
  return `NV-${String(max + 1).padStart(3, '0')}`
}

/** `EA-BR-05` — số điện thoại nhân viên phải duy nhất toàn hệ thống. */
export function isPhoneTaken(list: Employee[], phone: string, exceptId?: string): Employee | undefined {
  const normalized = phone.trim()
  return list.find((e) => e.phone === normalized && e.id !== exceptId)
}

/**
 * Ma trận chuyển trạng thái hợp lệ, rút gọn 3 giá trị hiện có trong
 * `enums.ts` (`ACTIVE ⇄ SUSPENDED`, cả hai → `INACTIVE` một chiều —
 * `EA-BR-06`/`UC-EA-04` §8.4 A1).
 *
 * TODO(OQ: EA-BRD §8 vs WebappQuanTri §8.2 — `ON_LEAVE` chưa vào enums.ts,
 * chờ Phase 2 Assignment) — tài liệu gốc có 4 trạng thái
 * (`ACTIVE/ON_LEAVE/SUSPENDED/INACTIVE`); `ON_LEAVE` gắn chặt với Assignment
 * (`EA-BR-03`, `EA-BR-18`) ngoài phạm vi Phase 1 webapp nên chưa thêm vào
 * `enums.ts`. Không tự suy diễn hành vi — sửa cùng lúc khi Assignment build.
 */
const STATUS_TRANSITIONS: Record<EmployeeStatus, EmployeeStatus[]> = {
  ACTIVE: ['SUSPENDED', 'INACTIVE'],
  SUSPENDED: ['ACTIVE', 'INACTIVE'],
  INACTIVE: [],
}

export function canTransitionStatus(from: EmployeeStatus, to: EmployeeStatus): boolean {
  if (from === to) return false
  return STATUS_TRANSITIONS[from].includes(to)
}

export function availableTransitions(from: EmployeeStatus): EmployeeStatus[] {
  return STATUS_TRANSITIONS[from]
}

/** `EA-BR-02` — nhân viên `SUSPENDED`/`INACTIVE` thì tài khoản bị khoá đăng nhập. */
export function accountStatusFor(status: EmployeeStatus): AccountStatus {
  if (status === 'ACTIVE') return 'ACTIVE'
  if (status === 'SUSPENDED') return 'LOCKED'
  return 'DISABLED'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const employeeFormSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{9,11}$/, 'Số điện thoại phải gồm 9–11 chữ số'),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || EMAIL_RE.test(v), { message: 'Email không hợp lệ' }),
    role: z.enum(ROLES),
    hireDate: z.string().trim().optional(),
    assignedArea: z.string().trim().optional(),
    note: z.string().trim().optional(),
    /** Chỉ dùng khi nhân viên chưa có tài khoản — `UC-EA-03`. */
    createAccount: z.boolean(),
    username: z.string().trim().optional(),
  })
  .refine((data) => !data.createAccount || (data.username && data.username.trim().length > 0), {
    message: 'Tên đăng nhập là bắt buộc khi tạo tài khoản',
    path: ['username'],
  })

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

/** `UC-EA-04` — bắt buộc nhập lý do khi đổi trạng thái làm việc. */
export const statusChangeSchema = z.object({
  status: z.enum(EMPLOYEE_STATUSES),
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})

export type StatusChangeValues = z.infer<typeof statusChangeSchema>
