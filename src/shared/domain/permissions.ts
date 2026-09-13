import type { Role } from './enums'

/**
 * Ma trận phân quyền Role × Resource × Action.
 *
 * Nguồn sự thật theo tài liệu: `SystemAdministration-BRD.md` §9 (`SA-BR-02`).
 * Các bảng tóm tắt theo nhóm nghiệp vụ trong `WebappQuanTri.md` (§6.4, §7.4,
 * §8.4, §9.4, §10.4, §11.4, §12.4) chỉ là *ánh xạ* — được chép lại nguyên
 * trạng vào đây, kể cả các ô còn `TBD` (chưa quyết định — KHÔNG phải "cấm").
 * `SALES` Phase 1 = tương đương `MANAGER` trên mọi resource nghiệp vụ, trừ
 * `SYSTEM_ADMIN` (resource) và `REVERSE` trên `SETTLEMENT` (CR-2026-035).
 *
 * Không tự "chốt" các ô TBD ở đây — `can()` coi TBD như false (an toàn hơn
 * là bịa quyền), nhưng màn "Vai trò & quyền" hiển thị riêng để BA/khách thấy
 * đây là Open Question, không phải hành vi cuối cùng.
 */

export const RESOURCES = [
  'VEHICLE',
  'VEHICLE_DOCUMENT',
  'MAINTENANCE',
  'CUSTOMER',
  'CALENDAR',
  'ASSIGNMENT',
  'EMPLOYEE',
  'RENTAL',
  'CONTRACT',
  'HANDOVER_RETURN',
  'INCIDENT',
  'SETTLEMENT',
  'PAYMENT',
  'FINANCE_REPORT',
  'CONSIGNMENT',
  'AUDIT',
  'NOTIFICATION',
  'SYSTEM_ADMIN',
] as const
export type Resource = (typeof RESOURCES)[number]

export const ACTIONS = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'CONFIRM',
  'APPROVE',
  'EXPORT',
  'CONFIG',
  'BLOCK',
  'VOID',
  'REVERSE',
  'EXECUTE',
  'ASSIGN',
  'ASSESS',
  'CLOSE',
  'RECORD_CASH',
  'RECONCILE',
] as const
export type Action = (typeof ACTIONS)[number]

/** `true`/`false` = đã chốt · `'TBD'` = Open Question, tài liệu chưa quyết định. */
export type PermissionValue = boolean | 'TBD'

type RoleValueMap = Partial<Record<Role, PermissionValue>>

interface PermissionEntry {
  resource: Resource
  action: Action
  values: RoleValueMap
  /** Trích dẫn nguồn trong WebappQuanTri.md để BA đối chiếu nhanh. */
  source: string
}

const ALL_ROLES: Role[] = ['SYSTEM_ADMIN', 'MANAGER', 'DISPATCHER', 'SALES', 'OPERATION_STAFF', 'ACCOUNTANT']

/** `SALES` Phase 1 ≈ `MANAGER` (CR-2026-035) — helper để khỏi lặp lại mọi dòng. */
function likeManager(values: RoleValueMap): RoleValueMap {
  return { SALES: values.MANAGER, ...values }
}

const TABLE: PermissionEntry[] = [
  // ---- Nhóm 1 — Xe & vòng đời (§6.4) ----
  {
    resource: 'VEHICLE',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §6.4',
  },
  {
    resource: 'VEHICLE',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §6.4 — Tạo/sửa xe, đổi trạng thái, upload giấy tờ',
  },
  {
    resource: 'VEHICLE',
    action: 'BLOCK',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §6.4 — Vehicle Block (CR-2026-015)',
  },
  {
    resource: 'VEHICLE',
    action: 'EXPORT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: true }),
    source: 'WebappQuanTri.md §6.4 — View Financial (CR-2026-036)',
  },
  {
    resource: 'MAINTENANCE',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'BA đề xuất — xem theo cùng nhóm với VEHICLE VIEW, tài liệu không tách dòng riêng',
  },
  {
    resource: 'MAINTENANCE',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: true, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §6.4 — Ghi nhận Maintenance/Spare Parts Record',
  },
  {
    resource: 'MAINTENANCE',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §6.4 — Cấu hình Maintenance Rule / ngưỡng cảnh báo',
  },

  // ---- Nhóm 2 — Khách hàng (§7.4) ----
  {
    resource: 'CUSTOMER',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §7.4',
  },
  {
    resource: 'CUSTOMER',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: 'TBD', ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §7.4 — Tạo/sửa khách, xem/upload giấy tờ',
  },
  {
    resource: 'CUSTOMER',
    action: 'BLOCK',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §7.4 — Khoá khách',
  },
  {
    resource: 'PAYMENT',
    action: 'VIEW',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: true }),
    source: 'WebappQuanTri.md §7.4/§11.4 — Xem thanh toán/công nợ khách (OPERATION_STAFF: hạn chế)',
  },

  // ---- Nhóm 3 — Lịch & điều phối (§8.4) ----
  {
    resource: 'CALENDAR',
    action: 'VIEW',
    values: {
      SYSTEM_ADMIN: true,
      MANAGER: true,
      DISPATCHER: true,
      SALES: true,
      OPERATION_STAFF: 'TBD',
      ACCOUNTANT: true,
    },
    source: 'WebappQuanTri.md §8.4 (OPERATION_STAFF: TBD — lượt của mình hay toàn bộ)',
  },
  {
    resource: 'RENTAL',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, DISPATCHER: true, SALES: true, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §8.4 — Tạo/dời/hủy lượt, đổi xe từ lịch',
  },
  {
    resource: 'ASSIGNMENT',
    action: 'VIEW',
    values: {
      SYSTEM_ADMIN: true,
      MANAGER: true,
      DISPATCHER: true,
      SALES: true,
      OPERATION_STAFF: 'TBD',
      ACCOUNTANT: false,
    },
    source: 'BA đề xuất — Bảng điều phối trong ngày, cùng nhóm quyền với CALENDAR VIEW',
  },
  {
    resource: 'EMPLOYEE',
    action: 'VIEW',
    values: {
      SYSTEM_ADMIN: true,
      MANAGER: true,
      DISPATCHER: true,
      SALES: true,
      OPERATION_STAFF: false,
      ACCOUNTANT: false,
    },
    source: 'BA đề xuất — Hồ sơ nhân viên, tài liệu không tách dòng "xem" riêng khỏi "sửa"',
  },
  {
    resource: 'ASSIGNMENT',
    action: 'ASSIGN',
    values: { SYSTEM_ADMIN: true, MANAGER: true, DISPATCHER: true, SALES: true, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §8.4 — Phân công / đổi người phụ trách',
  },
  {
    resource: 'EMPLOYEE',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, DISPATCHER: false, SALES: true, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §8.4 — Tạo/sửa hồ sơ nhân viên (theo quyền)',
  },
  {
    resource: 'EMPLOYEE',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: 'TBD', DISPATCHER: false, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §8.4 — Gắn tài khoản / chọn vai trò',
  },
  {
    resource: 'ASSIGNMENT',
    action: 'EXPORT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, DISPATCHER: true, SALES: true, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §8.4 — Bảng khối lượng / báo cáo hiệu suất',
  },

  // ---- Nhóm 4 — Lượt thuê & hợp đồng (§9.4) ----
  {
    resource: 'RENTAL',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §9.4',
  },
  {
    resource: 'RENTAL',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: 'TBD', ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §9.4 — Tạo lượt thuê',
  },
  {
    resource: 'RENTAL',
    action: 'CONFIRM',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §9.4 — Sửa/xác nhận/hủy lượt thuê',
  },
  {
    resource: 'CONTRACT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §9.4',
  },
  {
    resource: 'CONTRACT',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: 'TBD', ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §9.4 — Sinh/tái tạo hợp đồng, tạo phụ lục',
  },
  {
    resource: 'CONTRACT',
    action: 'EXPORT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §9.4 — Xuất PDF / tải lên bản ký',
  },
  {
    resource: 'CONTRACT',
    action: 'VOID',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §9.4 — Hủy hợp đồng đã ký (chỉ SYSTEM_ADMIN)',
  },

  // ---- Nhóm 5 — Giao/nhận & sự cố (§10.4) ----
  {
    resource: 'HANDOVER_RETURN',
    action: 'EXECUTE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: false, OPERATION_STAFF: true, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §10.4 — Thực hiện giao/nhận xe (chủ yếu App nhân viên)',
  },
  {
    resource: 'HANDOVER_RETURN',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'WebappQuanTri.md §10.4 — Xem biên bản giao/nhận trên Webapp',
  },
  {
    resource: 'INCIDENT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, OPERATION_STAFF: true, ACCOUNTANT: true },
    source: 'BA đề xuất — cùng nhóm quyền với HANDOVER_RETURN VIEW',
  },
  {
    resource: 'INCIDENT',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: true, ACCOUNTANT: false }),
    source: 'WebappQuanTri.md §10.4 — Tạo Incident / bổ sung media',
  },
  {
    resource: 'INCIDENT',
    action: 'ASSESS',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: 'TBD' }),
    source: 'WebappQuanTri.md §10.4 — Xác định Liability & phân bổ chi phí',
  },
  {
    resource: 'INCIDENT',
    action: 'APPROVE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: true }),
    source: 'WebappQuanTri.md §10.4 — Duyệt Incident theo ngưỡng',
  },
  {
    resource: 'INCIDENT',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: true }),
    source: 'WebappQuanTri.md §10.4 — Nhập Actual Cost / hóa đơn',
  },
  {
    resource: 'INCIDENT',
    action: 'CLOSE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, OPERATION_STAFF: false, ACCOUNTANT: 'TBD' }),
    source: 'WebappQuanTri.md §10.4 — Đóng Incident (CLOSED)',
  },
  {
    resource: 'INCIDENT',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'WebappQuanTri.md §10.4 — Cấu hình bộ ảnh/checklist/loại sự cố/ngưỡng',
  },

  // ---- Nhóm 6 — Tài chính (§11.4) ----
  {
    resource: 'SETTLEMENT',
    action: 'VIEW',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4',
  },
  {
    resource: 'SETTLEMENT',
    action: 'CONFIRM',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4 — Mở & chốt Settlement, Final Amount, đóng Rental',
  },
  {
    resource: 'SETTLEMENT',
    action: 'APPROVE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: false, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4 — Duyệt miễn giảm > ngưỡng',
  },
  {
    resource: 'SETTLEMENT',
    action: 'REVERSE',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §11.4 — Đảo quyết toán (chỉ SYSTEM_ADMIN)',
  },
  {
    resource: 'PAYMENT',
    action: 'RECORD_CASH',
    values: {
      SYSTEM_ADMIN: true,
      MANAGER: true,
      ACCOUNTANT: true,
      SALES: true,
      OPERATION_STAFF: true,
    },
    source: 'WebappQuanTri.md §11.4 — Ghi nhận thu tiền mặt (hiện trường)',
  },
  {
    resource: 'PAYMENT',
    action: 'CONFIRM',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4 — Xác nhận giao dịch CK/ví, cấn trừ cọc, hoàn tiền',
  },
  {
    resource: 'PAYMENT',
    action: 'RECONCILE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4 — Đối soát quỹ / chuyển khoản',
  },
  {
    resource: 'FINANCE_REPORT',
    action: 'VIEW',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'WebappQuanTri.md §11.4 — Dashboard & báo cáo tài chính, hiệu quả xe',
  },
  {
    resource: 'FINANCE_REPORT',
    action: 'CREATE',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', ACCOUNTANT: true, SALES: true, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §11.4 — Nhập chi phí thủ công',
  },
  {
    resource: 'FINANCE_REPORT',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §11.4 — Cấu hình danh mục chi phí / chính sách ghi nhận doanh thu',
  },

  // ---- Nhóm 7 — Xe ký gửi (§12.4) ----
  {
    resource: 'CONSIGNMENT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: true, OPERATION_STAFF: true },
    source: 'WebappQuanTri.md §12.4',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §12.4 — Tạo/sửa hồ sơ chủ xe, ghi nhận đề nghị ký gửi',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'ASSESS',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: true },
    source: 'WebappQuanTri.md §12.4 — Thẩm định xe (phần hiện trạng)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'APPROVE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §12.4 — Duyệt/từ chối xe, duyệt & kích hoạt hợp đồng, chấm dứt',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'EXECUTE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: true },
    source: 'WebappQuanTri.md §12.4 — Nhận / trả xe ký gửi (biên bản)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §12.4 — Cấu hình Fixed Monthly Amount + Payment Day',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, SALES: false, OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §12.4 — Điều chỉnh thủ công / ON_HOLD Owner Payout Record',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'CREATE',
    values: { SYSTEM_ADMIN: true, ACCOUNTANT: true, MANAGER: 'TBD', SALES: 'TBD', OPERATION_STAFF: false },
    source: 'WebappQuanTri.md §12.4 — Tạo Owner Payout hàng tháng',
  },

  // ---- Nền tảng ----
  {
    resource: 'AUDIT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: false, DISPATCHER: false, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'BA đề xuất cho bản demo — chưa có bảng riêng trong tài liệu gốc, mặc định thận trọng theo vai trò quản lý',
  },
  {
    resource: 'NOTIFICATION',
    action: 'VIEW',
    values: ALL_ROLES.reduce((acc, r) => ({ ...acc, [r]: true }), {} as RoleValueMap),
    source: 'Notification-BRD.md — trung tâm thông báo hiển thị cho mọi tài khoản nội bộ',
  },
  {
    resource: 'SYSTEM_ADMIN',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, DISPATCHER: false, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'SystemAdministration-BRD.md — quản trị hệ thống ngoài phạm vi SALES≈MANAGER (CR-2026-035)',
  },
  {
    resource: 'SYSTEM_ADMIN',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, DISPATCHER: false, OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'SystemAdministration-BRD.md §9 — chỉ SYSTEM_ADMIN',
  },
]

const LOOKUP = new Map<string, PermissionValue>()
for (const entry of TABLE) {
  for (const role of ALL_ROLES) {
    const value = entry.values[role]
    if (value !== undefined) {
      LOOKUP.set(`${role}:${entry.resource}:${entry.action}`, value)
    }
  }
}

/** `TBD` được coi như chưa cấp quyền — an toàn hơn là tự suy đoán quyết định nghiệp vụ. */
export function can(role: Role, resource: Resource, action: Action): boolean {
  const value = LOOKUP.get(`${role}:${resource}:${action}`)
  return value === true
}

export function permissionValue(role: Role, resource: Resource, action: Action): PermissionValue | undefined {
  return LOOKUP.get(`${role}:${resource}:${action}`)
}

export function canViewResource(role: Role, resource: Resource): boolean {
  return can(role, resource, 'VIEW')
}

/** Dùng cho màn "Vai trò & quyền" — liệt kê toàn bộ ma trận để hiển thị bảng. */
export function listPermissionMatrix(): PermissionEntry[] {
  return TABLE
}
