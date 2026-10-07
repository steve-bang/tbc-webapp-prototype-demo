import { z } from 'zod'
import { EMPLOYEE_STATUSES, ROLES } from '@/shared/domain/enums'
import type { AccountStatus, AssignmentRole, AssignmentStatus, EmployeeStatus, Role } from '@/shared/domain/enums'

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

// =====================================================================
// Assignment — Phân công giao/nhận (`docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md`,
// module `EmployeeAssignment-BRD.md` §9-§18, §26). Entity ĐỘC LẬP giữ
// `rentalId` (mirror `Contract`/`HandoverRecord`/`ReturnRecord`) — KHÔNG
// phải field trên `Rental` (§0.1 kế hoạch, roadmap stub cũ đã bị bác bỏ).
// =====================================================================

/** EA-BR-12 — lịch sử đổi người phụ trách, lưu trực tiếp trên `Assignment`. */
export interface AssignmentReassignment {
  id: string
  fromEmployeeId: string
  toEmployeeId: string
  reason: string
  byUserId: string
  byName: string
  byRole: string
  at: string
}

/**
 * Phân công giao/nhận cho 1 Rental — `EmployeeAssignment-BRD.md` §9. Planned
 * Window là **snapshot** copy từ `Rental.pickupDateTime`/`expectedReturnDateTime`
 * lúc phân công (không tham chiếu sống, mirror snapshot pattern `Contract`).
 * Actual Start/End KHÔNG lưu ở đây (§2.1 kế hoạch) — đọc trực tiếp
 * `Rental.actualPickupDateTime`/`actualReturnDateTime` qua barrel khi cần hiển thị.
 */
export interface Assignment {
  id: string
  /** EA-BR-07 — tối đa 1 Assignment hiệu lực/`role`/Rental. */
  rentalId: string
  role: AssignmentRole
  /** EA-BR-08/09 — phải `ACTIVE` + vai trò phù hợp (`ASSIGNABLE_ROLES`). */
  assigneeEmployeeId: string
  plannedWindowStart: string
  plannedWindowEnd: string
  status: AssignmentStatus
  assignedByUserId: string
  assignedByName: string
  assignedByRole: string
  assignedAt: string
  /** EA-BR-12 — mặc định `[]`. */
  reassignmentHistory: AssignmentReassignment[]
  /** Bắt buộc khi `status === 'CANCELLED'`. */
  cancelReason?: string
  note?: string
  createdAt: string
  updatedAt: string
}

/**
 * EA-BR-09 — chỉ nhân viên vai trò này được gán assignment giao/nhận
 * (`DISPATCHER`/`SALES`/`ACCOUNTANT` không nhận — `EmployeeAssignment-BRD.md`
 * Lịch sử sửa đổi 1.2: "SALES ... không nhận assignment giao/nhận").
 */
export const ASSIGNABLE_ROLES: Role[] = ['OPERATION_STAFF', 'MANAGER', 'SYSTEM_ADMIN']

/** EA-BR-08/09 — nhân viên `ACTIVE` + vai trò phù hợp mới được chọn khi phân công. */
export function isAssignableEmployee(employee: Employee): boolean {
  return employee.status === 'ACTIVE' && ASSIGNABLE_ROLES.includes(employee.role)
}

/** EA-BR-07 — true nếu còn Assignment hiệu lực (khác `CANCELLED`) cùng `rentalId`+`role`. */
export function hasActiveAssignment(assignments: Assignment[], rentalId: string, role: AssignmentRole): boolean {
  return assignments.some((a) => a.rentalId === rentalId && a.role === role && a.status !== 'CANCELLED')
}

/**
 * EA-BR-10/RC-BR-11 — cảnh báo (không chặn), overlap Planned Window cùng
 * `assigneeEmployeeId`. TODO(OQ: §0.5 kế hoạch — chưa cộng buffer di chuyển
 * giữa 2 việc, `EmployeeAssignment-BRD.md` §26 Q10/11 chưa chốt).
 */
export function hasAssignmentConflict(
  assignments: Assignment[],
  employeeId: string,
  windowStart: string,
  windowEnd: string,
  excludeAssignmentId?: string,
): boolean {
  const aStart = new Date(windowStart).getTime()
  const aEnd = new Date(windowEnd).getTime()
  return assignments.some((a) => {
    if (a.id === excludeAssignmentId) return false
    if (a.assigneeEmployeeId !== employeeId) return false
    if (a.status === 'CANCELLED') return false
    const bStart = new Date(a.plannedWindowStart).getTime()
    const bEnd = new Date(a.plannedWindowEnd).getTime()
    return aStart < bEnd && bStart < aEnd
  })
}

/** EA-BR-11 — không đổi người khi đã `IN_PROGRESS`/`DONE` (và các trạng thái kết thúc khác). */
export function canReassign(assignment: Assignment): boolean {
  return assignment.status === 'ASSIGNED'
}

/** Guard nút "Huỷ phân công" — chỉ khi còn đang hiệu lực và chưa hoàn tất. */
export function canCancelAssignment(assignment: Assignment): boolean {
  return assignment.status === 'ASSIGNED' || assignment.status === 'IN_PROGRESS'
}

/**
 * EA-BR-13 — hàm thuần chuẩn bị sẵn cho round sau (khi `handover-return` nối
 * dây tự động) — CHƯA có nơi gọi ở Round 1 (§0.3 kế hoạch, không mở lại
 * `handover-return/api.ts` để trigger).
 */
export function deriveAssignmentStatusFromRecord(
  handoverOrReturnStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISCARDED',
): AssignmentStatus | undefined {
  switch (handoverOrReturnStatus) {
    case 'IN_PROGRESS':
      return 'IN_PROGRESS'
    case 'COMPLETED':
      return 'DONE'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return undefined
  }
}

// ---- Form schema — 3 dialog (§5.3 kế hoạch) ----

/** `AssignmentCreateDialog` — chỉ hỏi nhân viên phụ trách (Rental/role cố định theo context mở dialog). */
export const assignmentAssignSchema = z.object({
  employeeId: z.string().trim().min(1, 'Chọn nhân viên phụ trách'),
  note: z.string().trim().optional(),
})
export type AssignmentAssignValues = z.infer<typeof assignmentAssignSchema>

/** `AssignmentReassignDialog` — EA-BR-12: lý do bắt buộc. */
export const assignmentReassignSchema = z.object({
  employeeId: z.string().trim().min(1, 'Chọn nhân viên phụ trách mới'),
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type AssignmentReassignValues = z.infer<typeof assignmentReassignSchema>

/** `AssignmentCancelDialog` — mirror `rentalCancelReasonSchema`. */
export const assignmentCancelSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type AssignmentCancelValues = z.infer<typeof assignmentCancelSchema>
