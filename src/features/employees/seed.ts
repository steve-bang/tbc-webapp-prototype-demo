import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { generateId } from '@/shared/lib/id'
import { writeJson } from '@/shared/lib/storage'
import { ASSIGNMENTS_STORAGE_KEY, EMPLOYEES_STORAGE_KEY } from './api'
import type { Assignment, Employee } from './model'

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

/**
 * `YYYY-MM-DDTHH:mm:00.000Z`-tương đương tính từ hôm nay ± số ngày, giờ/phút
 * cố định — mirror `dt()` của `rentals/seed.ts`/`handover-return/seed.ts`
 * (không export ở đó nên định nghĩa lại đây) để tái tạo đúng thời gian của
 * Rental đang tham chiếu (`docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §7).
 */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

/** Vài ngày trước mốc đã cho — thời điểm phân công thường đi trước Planned Window. */
function beforeIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

interface SeedAssignmentInput {
  id: string
  rentalId: string
  role: Assignment['role']
  assigneeEmployeeId: string
  windowStart: string
  status: Assignment['status']
  assignedByUserId: string
  assignedByName: string
  assignedByRole: string
  assignedAt?: string
  updatedAt?: string
  cancelReason?: string
  note?: string
  reassignmentHistory?: Assignment['reassignmentHistory']
}

function buildAssignment(input: SeedAssignmentInput): Assignment {
  const assignedAt = input.assignedAt ?? beforeIso(input.windowStart, 2)
  return {
    id: input.id,
    rentalId: input.rentalId,
    role: input.role,
    assigneeEmployeeId: input.assigneeEmployeeId,
    plannedWindowStart: input.windowStart,
    plannedWindowEnd: addMinutesIso(input.windowStart, 30),
    status: input.status,
    assignedByUserId: input.assignedByUserId,
    assignedByName: input.assignedByName,
    assignedByRole: input.assignedByRole,
    assignedAt,
    reassignmentHistory: input.reassignmentHistory ?? [],
    cancelReason: input.cancelReason,
    note: input.note,
    createdAt: assignedAt,
    updatedAt: input.updatedAt ?? assignedAt,
  }
}

const DISPATCHER = { userId: 'usr_dispatcher', fullName: 'Lê Văn Điều Phối', role: 'DISPATCHER' }
const MANAGER = { userId: 'usr_manager', fullName: 'Trần Thị Quản Lý', role: 'MANAGER' }

/**
 * 9 `Assignment` demo — `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §7.
 * `rentalId` tham chiếu đúng `features/rentals/seed.ts` (29 bản ghi,
 * `rt_001`-`rt_029` — file này chạy TRƯỚC `rentals/seed.ts` trong thứ tự
 * đăng ký `registerSeedStep`, nhưng không đọc chéo `localStorage` lúc seed
 * nên không cần đợi, chỉ cần id khớp đúng chuỗi hardcode — §11 kế hoạch).
 * `assigneeEmployeeId` tham chiếu đúng nhân viên vừa seed ở trên (`emp_staff1`
 * ACTIVE, `emp_staff2` SUSPENDED — vẫn dùng được cho bản ghi lịch sử `DONE`/
 * `CANCELLED` vì EA-BR-08 chỉ enforce ở hành động tạo qua UI, không áp lại
 * cho dữ liệu lịch sử; `emp_manager`, `emp_admin`).
 *
 * Phân bổ: 4 `ASSIGNED` (rt_006/rt_014 hôm nay, rt_010/rt_013 sắp tới), 2
 * `DONE` (rt_017 DELIVERY + rt_021 RECEIVING — khớp đúng
 * `deliveryStaffEmployeeId`/`receivingStaffEmployeeId` đã seed ở
 * `handover-return/seed.ts`), 1 `CANCELLED` (rt_027, khớp lý do huỷ ở
 * `handover-return/seed.ts`), 1 `MISSED` (rt_008, chỉ minh hoạ — Round 1
 * không có ngưỡng tự động đánh dấu, §1.2 kế hoạch), 1 `REASSIGNED` (rt_015,
 * trạng thái chỉ-seed — hành động "Đổi người" thật ở UI Round 1 KHÔNG đưa
 * bản ghi tới trạng thái này, xem comment `ASSIGNMENT_STATUSES` ở `enums.ts`).
 *
 * Cố ý để `rt_007`/`rt_019` (hôm nay) + `rt_011` (sắp tới) KHÔNG có Assignment
 * nào — demo badge "Chưa phân công" trên Dispatch board.
 */
function seedAssignments(): void {
  const assignments: Assignment[] = [
    buildAssignment({
      id: 'asg_001',
      rentalId: 'rt_006',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_staff1',
      windowStart: dt(0, 14, 0),
      status: 'ASSIGNED',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
    }),
    buildAssignment({
      id: 'asg_002',
      rentalId: 'rt_014',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_manager',
      windowStart: dt(0, 20, 0),
      status: 'ASSIGNED',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
      note: 'Xe giao tận nơi (45 Lê Lợi, Quận 3) — RM-BR-26/CR-2026-062.',
    }),
    buildAssignment({
      id: 'asg_003',
      rentalId: 'rt_010',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_staff1',
      windowStart: dt(5, 9, 0),
      status: 'ASSIGNED',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
    }),
    buildAssignment({
      id: 'asg_004',
      rentalId: 'rt_013',
      role: 'RECEIVING',
      assigneeEmployeeId: 'emp_admin',
      windowStart: dt(2, 21, 0),
      status: 'ASSIGNED',
      assignedByUserId: MANAGER.userId,
      assignedByName: MANAGER.fullName,
      assignedByRole: MANAGER.role,
    }),
    buildAssignment({
      // Khớp ho_002 (`handover-return/seed.ts`) — rt_017 HANDED_OVER, deliveryStaffEmployeeId = emp_staff2.
      id: 'asg_005',
      rentalId: 'rt_017',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_staff2',
      windowStart: dt(0, 7, 0),
      status: 'DONE',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
    }),
    buildAssignment({
      // Khớp rr_002 (`handover-return/seed.ts`) — rt_021 RETURNED, receivingStaffEmployeeId = emp_staff1.
      id: 'asg_006',
      rentalId: 'rt_021',
      role: 'RECEIVING',
      assigneeEmployeeId: 'emp_staff1',
      windowStart: dt(-5, 21, 0),
      status: 'DONE',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
    }),
    buildAssignment({
      // Khớp lý do huỷ Rental rt_027 ở `handover-return/seed.ts` (cancelledHandover).
      id: 'asg_007',
      rentalId: 'rt_027',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_staff1',
      windowStart: dt(10, 9, 0),
      status: 'CANCELLED',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
      assignedAt: dt(-3, 10, 0),
      updatedAt: dt(-1, 10, 0),
      cancelReason: 'Lượt thuê gốc đã bị huỷ trước khi thực hiện giao xe.',
    }),
    buildAssignment({
      id: 'asg_008',
      rentalId: 'rt_008',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_staff1',
      windowStart: dt(2, 9, 0),
      status: 'MISSED',
      assignedByUserId: MANAGER.userId,
      assignedByName: MANAGER.fullName,
      assignedByRole: MANAGER.role,
      note: 'Minh hoạ trạng thái MISSED — Round 1 chưa có ngưỡng tự động đánh dấu (UC-EA-13, §1.2 kế hoạch).',
    }),
    buildAssignment({
      // REASSIGNED — trạng thái chỉ-seed, xem comment ASSIGNMENT_STATUSES (`shared/domain/enums.ts`).
      id: 'asg_009',
      rentalId: 'rt_015',
      role: 'DELIVERY',
      assigneeEmployeeId: 'emp_manager',
      windowStart: dt(1, 8, 0),
      status: 'REASSIGNED',
      assignedByUserId: DISPATCHER.userId,
      assignedByName: DISPATCHER.fullName,
      assignedByRole: DISPATCHER.role,
      reassignmentHistory: [
        {
          id: generateId('asgrh'),
          fromEmployeeId: 'emp_staff1',
          toEmployeeId: 'emp_manager',
          reason: 'Nhân viên ban đầu bị trùng lịch với 1 lượt giao xe khác — đổi sang Quản lý hỗ trợ.',
          byUserId: MANAGER.userId,
          byName: MANAGER.fullName,
          byRole: MANAGER.role,
          at: beforeIso(dt(1, 8, 0), 1),
        },
      ],
    }),
  ]
  writeJson(ASSIGNMENTS_STORAGE_KEY, assignments)
}

registerSeedStep(seedAssignments)
