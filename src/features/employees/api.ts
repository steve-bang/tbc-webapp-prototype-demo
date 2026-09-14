import type { EmployeeStatus, Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  accountStatusFor,
  canTransitionStatus,
  isPhoneTaken,
  nextEmployeeCode,
  type Employee,
  type UserAccount,
} from './model'

export const EMPLOYEES_STORAGE_KEY = 'employees'

function readAll(): Employee[] {
  return readJson<Employee[]>(EMPLOYEES_STORAGE_KEY) ?? []
}

function writeAll(items: Employee[]): void {
  writeJson(EMPLOYEES_STORAGE_KEY, items)
}

export interface EmployeeFilter {
  search?: string
  role?: Role
  status?: EmployeeStatus
  area?: string
}

export interface EmployeeFormInput {
  fullName: string
  phone: string
  email?: string
  role: Role
  hireDate?: string
  assignedArea?: string
  note?: string
}

/** Người thực hiện thao tác — dùng để ghi audit (`EA-BR-16`/`UC-EA-20`). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function matches(employee: Employee, filter?: EmployeeFilter): boolean {
  if (!filter) return true
  if (filter.role && employee.role !== filter.role) return false
  if (filter.status && employee.status !== filter.status) return false
  if (filter.area && employee.assignedArea !== filter.area) return false
  if (filter.search) {
    const q = filter.search.trim().toLowerCase()
    if (
      q.length > 0 &&
      !employee.fullName.toLowerCase().includes(q) &&
      !employee.phone.includes(q) &&
      !employee.employeeCode.toLowerCase().includes(q)
    ) {
      return false
    }
  }
  return true
}

function findOrThrow(items: Employee[], id: string): Employee {
  const found = items.find((e) => e.id === id)
  if (!found) throw new Error('Không tìm thấy nhân viên')
  return found
}

export async function list(filter?: EmployeeFilter): Promise<Employee[]> {
  return fakeRequest(() => readAll().filter((e) => matches(e, filter)))
}

export async function getById(id: string): Promise<Employee | undefined> {
  return fakeRequest(() => readAll().find((e) => e.id === id))
}

export async function create(input: EmployeeFormInput, actor: ActorInfo): Promise<Employee> {
  return fakeRequest(() => {
    const current = readAll()
    const duplicate = isPhoneTaken(current, input.phone)
    if (duplicate) {
      throw new Error(`Số điện thoại đã được dùng bởi ${duplicate.employeeCode} (EA-BR-05)`)
    }
    const now = new Date().toISOString()
    const employee: Employee = {
      id: generateId('emp'),
      employeeCode: nextEmployeeCode(current),
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      role: input.role,
      status: 'ACTIVE', // UC-EA-01 §5.4 bước 5 — mặc định ACTIVE khi tạo mới
      hireDate: input.hireDate || undefined,
      assignedArea: input.assignedArea?.trim() || undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...current, employee])
    appendAudit({
      action: 'CREATE_EMPLOYEE',
      entity: 'Employee',
      entityId: employee.id,
      summary: `Tạo hồ sơ nhân viên ${employee.fullName} (${employee.employeeCode})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: employee,
    })
    return employee
  })
}

export async function update(
  id: string,
  input: EmployeeFormInput,
  actor: ActorInfo,
  roleChangeReason?: string,
): Promise<Employee> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    const duplicate = isPhoneTaken(all, input.phone, id)
    if (duplicate) {
      throw new Error(`Số điện thoại đã được dùng bởi ${duplicate.employeeCode} (EA-BR-05)`)
    }
    if (before.role !== input.role) {
      // EA-BR-04 — không tự hạ/đổi vai trò của chính mình.
      if (before.account?.userId === actor.userId) {
        throw new Error('Không thể tự đổi vai trò của chính mình (EA-BR-04)')
      }
      // UC-EA-20 §24.3 — Reason bắt buộc với hành động CHANGE_ROLE.
      if (!roleChangeReason || !roleChangeReason.trim()) {
        throw new Error('Lý do đổi vai trò là bắt buộc (UC-EA-20 §24.3)')
      }
    }
    const after: Employee = {
      ...before,
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || undefined,
      role: input.role,
      hireDate: input.hireDate || undefined,
      assignedArea: input.assignedArea?.trim() || undefined,
      note: input.note?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((e) => (e.id === id ? after : e)))
    appendAudit({
      action: 'UPDATE_EMPLOYEE',
      entity: 'Employee',
      entityId: id,
      summary: `Cập nhật hồ sơ nhân viên ${after.fullName} (${after.employeeCode})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before,
      after,
    })
    // Đổi vai trò là hành động cần audit tách biệt — UC-EA-01 §5.5 bước 3 / UC-EA-20 §24.3 (CHANGE_ROLE).
    if (before.role !== after.role) {
      const trimmedReason = (roleChangeReason ?? '').trim()
      appendAudit({
        action: 'CHANGE_ROLE',
        entity: 'Employee',
        entityId: id,
        summary: `Đổi vai trò của ${after.fullName} (${after.employeeCode}) từ ${before.role} sang ${after.role}: ${trimmedReason}`,
        actorUserId: actor.userId,
        actorName: actor.fullName,
        actorRole: actor.role,
        before: { role: before.role },
        after: { role: after.role, reason: trimmedReason },
      })
    }
    return after
  })
}

export async function changeStatus(
  id: string,
  status: EmployeeStatus,
  reason: string,
  actor: ActorInfo,
): Promise<Employee> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canTransitionStatus(before.status, status)) {
      throw new Error(`Không thể chuyển từ ${before.status} sang ${status}`)
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new Error('Lý do đổi trạng thái là bắt buộc') // UC-EA-04 §8.3 bước 2
    }
    const after: Employee = {
      ...before,
      status,
      // EA-BR-02 — SUSPENDED/INACTIVE khoá tài khoản, ACTIVE mở lại
      account: before.account ? { ...before.account, accountStatus: accountStatusFor(status) } : before.account,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((e) => (e.id === id ? after : e)))
    appendAudit({
      action: 'CHANGE_WORK_STATUS',
      entity: 'Employee',
      entityId: id,
      summary: `Đổi trạng thái làm việc của ${after.fullName} (${after.employeeCode}) từ ${before.status} sang ${status}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status, reason: trimmedReason },
    })
    return after
  })
}

export async function grantAccount(id: string, username: string, actor: ActorInfo): Promise<Employee> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (before.account) {
      throw new Error('Nhân viên đã có tài khoản (EA-BR-01)')
    }
    const trimmedUsername = username.trim()
    if (!trimmedUsername) {
      throw new Error('Tên đăng nhập là bắt buộc')
    }
    const account: UserAccount = {
      userId: generateId('usr'),
      username: trimmedUsername,
      accountStatus: accountStatusFor(before.status),
    }
    const after: Employee = { ...before, account, updatedAt: new Date().toISOString() }
    writeAll(all.map((e) => (e.id === id ? after : e)))
    appendAudit({
      action: 'GRANT_ACCOUNT',
      entity: 'Employee',
      entityId: id,
      summary: `Cấp tài khoản đăng nhập "${account.username}" cho ${before.fullName} (${before.employeeCode})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: account,
    })
    return after
  })
}

export async function lockAccount(id: string, reason: string, actor: ActorInfo): Promise<Employee> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!before.account) {
      throw new Error('Nhân viên chưa có tài khoản đăng nhập')
    }
    if (before.account.userId === actor.userId) {
      throw new Error('Không thể tự khoá tài khoản của chính mình (EA-BR-04)')
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      throw new Error('Lý do khoá tài khoản là bắt buộc') // UC-EA-20 §24.3 — Reason bắt buộc với LOCK_ACCOUNT
    }
    if (before.account.accountStatus !== 'ACTIVE') {
      throw new Error('Tài khoản không ở trạng thái đang hoạt động')
    }
    const account: UserAccount = { ...before.account, accountStatus: 'LOCKED' }
    const after: Employee = { ...before, account, updatedAt: new Date().toISOString() }
    writeAll(all.map((e) => (e.id === id ? after : e)))
    appendAudit({
      action: 'LOCK_ACCOUNT',
      entity: 'Employee',
      entityId: id,
      summary: `Khoá tài khoản của ${before.fullName} (${before.employeeCode}): ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { accountStatus: before.account.accountStatus },
      after: { accountStatus: 'LOCKED', reason: trimmedReason },
    })
    return after
  })
}

export async function unlockAccount(id: string, actor: ActorInfo): Promise<Employee> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!before.account) {
      throw new Error('Nhân viên chưa có tài khoản đăng nhập')
    }
    if (before.status !== 'ACTIVE') {
      // EA-BR-02 — nhân viên SUSPENDED/INACTIVE thì tài khoản phải giữ khoá, không thể mở lại
      // trong khi nhân viên chưa quay lại ACTIVE.
      throw new Error('Chỉ mở khoá tài khoản của nhân viên đang làm việc (EA-BR-02)')
    }
    if (before.account.accountStatus !== 'LOCKED') {
      throw new Error('Tài khoản không ở trạng thái bị khoá')
    }
    const account: UserAccount = { ...before.account, accountStatus: 'ACTIVE' }
    const after: Employee = { ...before, account, updatedAt: new Date().toISOString() }
    writeAll(all.map((e) => (e.id === id ? after : e)))
    appendAudit({
      action: 'UNLOCK_ACCOUNT',
      entity: 'Employee',
      entityId: id,
      summary: `Mở khoá tài khoản của ${before.fullName} (${before.employeeCode})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { accountStatus: before.account.accountStatus },
      after: { accountStatus: 'ACTIVE' },
    })
    return after
  })
}

// EA-BR-06 — không có `remove`: nhân viên đã có assignment không được xóa vật lý, chuyển INACTIVE thay thế.
