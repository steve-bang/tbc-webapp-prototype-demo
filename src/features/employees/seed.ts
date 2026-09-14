import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { writeJson } from '@/shared/lib/storage'
import { EMPLOYEES_STORAGE_KEY } from './api'
import type { Employee } from './model'

/**
 * 8 nhân viên demo — `EmployeeAssignment-BRD.md` §7 / `WebappQuanTri.md` §8.2.
 * 5 nhân viên đầu khớp `DEMO_ACCOUNTS` (`features/auth/model.ts`) để tài
 * khoản đăng nhập demo và hồ sơ nhân viên nhất quán khi đổi vai trò ở
 * Topbar; 3 `OPERATION_STAFF` còn lại phủ đủ nhánh UI (có/không tài khoản,
 * đủ 3 trạng thái làm việc).
 */
function seedEmployees(): void {
  const employees: Employee[] = [
    {
      id: 'emp_admin',
      employeeCode: 'NV-001',
      fullName: 'Nguyễn Văn Admin',
      phone: '0901000001',
      email: 'admin@thienbaocar.vn',
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      hireDate: '2023-01-10',
      assignedArea: 'Trụ sở chính',
      account: { userId: 'usr_admin', username: 'admin', accountStatus: 'ACTIVE' },
      createdAt: '2023-01-10T02:00:00.000Z',
      updatedAt: '2023-01-10T02:00:00.000Z',
    },
    {
      id: 'emp_manager',
      employeeCode: 'NV-002',
      fullName: 'Trần Thị Quản Lý',
      phone: '0901000002',
      email: 'manager@thienbaocar.vn',
      role: 'MANAGER',
      status: 'ACTIVE',
      hireDate: '2023-02-01',
      assignedArea: 'Trụ sở chính',
      account: { userId: 'usr_manager', username: 'manager', accountStatus: 'ACTIVE' },
      createdAt: '2023-02-01T02:00:00.000Z',
      updatedAt: '2023-02-01T02:00:00.000Z',
    },
    {
      id: 'emp_dispatcher',
      employeeCode: 'NV-003',
      fullName: 'Lê Văn Điều Phối',
      phone: '0901000003',
      email: 'dispatcher@thienbaocar.vn',
      role: 'DISPATCHER',
      status: 'ACTIVE',
      hireDate: '2023-03-15',
      assignedArea: 'Quận 3',
      account: { userId: 'usr_dispatcher', username: 'dispatcher', accountStatus: 'ACTIVE' },
      createdAt: '2023-03-15T02:00:00.000Z',
      updatedAt: '2023-03-15T02:00:00.000Z',
    },
    {
      id: 'emp_sales',
      employeeCode: 'NV-004',
      fullName: 'Phạm Thị Kinh Doanh',
      phone: '0901000004',
      email: 'sales@thienbaocar.vn',
      role: 'SALES',
      status: 'ACTIVE',
      hireDate: '2023-04-20',
      assignedArea: 'Quận 1',
      account: { userId: 'usr_sales', username: 'sales', accountStatus: 'ACTIVE' },
      createdAt: '2023-04-20T02:00:00.000Z',
      updatedAt: '2023-04-20T02:00:00.000Z',
    },
    {
      id: 'emp_accountant',
      employeeCode: 'NV-005',
      fullName: 'Đỗ Thị Kế Toán',
      phone: '0901000005',
      email: 'accountant@thienbaocar.vn',
      role: 'ACCOUNTANT',
      status: 'ACTIVE',
      hireDate: '2023-05-05',
      assignedArea: 'Trụ sở chính',
      account: { userId: 'usr_accountant', username: 'accountant', accountStatus: 'ACTIVE' },
      createdAt: '2023-05-05T02:00:00.000Z',
      updatedAt: '2023-05-05T02:00:00.000Z',
    },
    {
      id: 'emp_staff1',
      employeeCode: 'NV-006',
      fullName: 'Hoàng Văn Nhân Viên',
      phone: '0901000006',
      role: 'OPERATION_STAFF',
      status: 'ACTIVE',
      hireDate: '2023-06-01',
      assignedArea: 'Quận 1',
      account: { userId: 'usr_staff', username: 'staff', accountStatus: 'ACTIVE' },
      createdAt: '2023-06-01T02:00:00.000Z',
      updatedAt: '2023-06-01T02:00:00.000Z',
    },
    {
      id: 'emp_staff2',
      employeeCode: 'NV-007',
      fullName: 'Vũ Thị Vận Hành',
      phone: '0901000007',
      role: 'OPERATION_STAFF',
      status: 'SUSPENDED',
      hireDate: '2023-07-12',
      assignedArea: 'Quận 7',
      note: 'Tạm đình chỉ để xác minh sự cố giao xe ngày 04/01/2026.',
      account: { userId: 'usr_staff2', username: 'staff2', accountStatus: 'LOCKED' },
      createdAt: '2023-07-12T02:00:00.000Z',
      updatedAt: '2026-01-05T02:00:00.000Z',
    },
    {
      id: 'emp_staff3',
      employeeCode: 'NV-008',
      fullName: 'Ngô Văn Nghỉ Việc',
      phone: '0901000008',
      role: 'OPERATION_STAFF',
      status: 'INACTIVE',
      hireDate: '2022-08-01',
      note: 'Đã nghỉ việc — EA-BR-06: giữ hồ sơ, không xoá vật lý.',
      createdAt: '2022-08-01T02:00:00.000Z',
      updatedAt: '2025-11-01T02:00:00.000Z',
    },
  ]
  writeJson(EMPLOYEES_STORAGE_KEY, employees)
}

registerSeedStep(seedEmployees)
