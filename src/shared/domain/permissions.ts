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
    resource: 'SETTLEMENT',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'RentalSettlement-BRD.md §22 — Tạo Post-Settlement Charge (Round 2, docs/RENTAL-SETTLEMENT-PLAN.md §8)',
  },
  {
    resource: 'SETTLEMENT',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: 'TBD', OPERATION_STAFF: false }),
    source: 'RentalSettlement-BRD.md §22 — Điều chỉnh sau COMPLETED (Accountant TBD — RS §28 Q16, Round 2)',
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
  // ---- Payment (PM) — PAYMENT-PLAN.md §5, Round 1 ----
  {
    resource: 'PAYMENT',
    action: 'CREATE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'Payment-BRD.md §21 — Ghi nhận thu CK/ví · Tạo giao dịch hoàn tiền · (Lập lịch thanh toán)',
  },
  {
    resource: 'PAYMENT',
    action: 'VOID',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'Payment-BRD.md §21 — VOID giao dịch PENDING',
  },
  {
    resource: 'PAYMENT',
    action: 'REVERSE',
    // TODO(OQ: Payment-BRD.md §27 Q14 — Accountant được REVERSED chưa chốt; BRD §21 Admin/Manager ✓, Accountant TBD).
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: 'TBD', OPERATION_STAFF: false }),
    source: 'Payment-BRD.md §21 — REVERSED giao dịch CONFIRMED (Accountant TBD — PM §27 Q14)',
  },
  {
    resource: 'PAYMENT',
    action: 'APPROVE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: false, OPERATION_STAFF: false }),
    source: 'Payment-BRD.md §21 — Duyệt hoàn tiền vượt ngưỡng (dùng ở Round 2, thêm luôn ở Round 1)',
  },
  {
    resource: 'PAYMENT',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: 'TBD', ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'Payment-UseCase.md §27 — Tạo ADJUSTMENT (BRD §21 chưa có dòng — PAYMENT-PLAN.md §0.4 điểm 7)',
  },
  {
    resource: 'PAYMENT',
    action: 'EXECUTE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, SALES: true, OPERATION_STAFF: true },
    source: 'Payment-BRD.md §21 — Nộp quỹ tiền mặt',
  },
  {
    resource: 'PAYMENT',
    action: 'EXPORT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, SALES: true, OPERATION_STAFF: true },
    source: 'Payment-BRD.md §21 — Xuất biên lai',
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
  // REVENUE-COST-PLAN.md §5 — 3 entry mới cho Phase 4.3.
  // TODO(OQ: RevenueCost-BRD.md §28 Q16 — ai được xem báo cáo/KPI chưa chốt; demo bám ma trận BRD §22 + SALES ≈ MANAGER)
  {
    resource: 'FINANCE_REPORT',
    action: 'EDIT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: 'TBD', ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'RevenueCost-BRD.md §22 — Sửa / xóa chi phí thủ công (trước chốt kỳ)',
  },
  {
    resource: 'FINANCE_REPORT',
    action: 'DELETE',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: 'TBD', ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'RevenueCost-BRD.md §22 — Sửa / xóa chi phí thủ công (dùng cho "Huỷ chi phí", huỷ mềm)',
  },
  {
    resource: 'FINANCE_REPORT',
    action: 'EXPORT',
    values: likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false }),
    source: 'RevenueCost-BRD.md §22 — Xuất báo cáo',
  },

  // ---- Nhóm 7 — Xe ký gửi (VehicleConsignment-BRD.md §18) ----
  // Viết lại theo docs/CONSIGNMENT-PLAN.md §0.1 F1: khối scaffold cũ khai `EDIT` hai lần (entry sau ghi đè entry
  // trước nên Accountant sửa được hồ sơ chủ xe còn Sales thì không) và cho OPERATION_STAFF xem (BRD §18 ghi ✗).
  // SALES ≈ MANAGER (CR-2026-035) trừ dòng điều chỉnh Owner Payout Record (BRD §18 ghi Sales ✗ — giữ đúng chữ).
  // Ô `'TBD'` (tạo Owner Payout của Manager/Sales) = Open Question, không phải cấm. Plan §0.4 điểm 2.
  {
    resource: 'CONSIGNMENT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: true, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Xem hợp đồng ký gửi / lịch chi trả',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'CREATE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Tạo / sửa hồ sơ chủ xe · Ghi nhận đề nghị ký gửi · Soạn hợp đồng ký gửi (DRAFT)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'ASSESS',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: true },
    source: 'VehicleConsignment-BRD.md §18 — Thẩm định xe ký gửi (nhập biên bản)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'APPROVE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Duyệt / từ chối xe · Duyệt & kích hoạt hợp đồng · Tạm dừng / chấm dứt hợp đồng',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'EXECUTE',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: true },
    source: 'VehicleConsignment-BRD.md §18 — Nhận xe / trả xe ký gửi (biên bản bàn giao)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, ACCOUNTANT: false, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Cấu hình mức chi trả hàng tháng của hợp đồng (Fixed Monthly Amount, Payment Day)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: false, ACCOUNTANT: true, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Điều chỉnh thủ công Owner Payout Record (Adjustment / ON_HOLD)',
  },
  {
    resource: 'CONSIGNMENT',
    action: 'CONFIRM',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: 'TBD', ACCOUNTANT: true, OPERATION_STAFF: false },
    source: 'VehicleConsignment-BRD.md §18 — Tạo Owner Payout',
  },

  // ---- Nền tảng ----
  // AUDIT — DASHBOARD-PLATFORM-PLAN.md §7. SALES ≈ MANAGER (CR-2026-035, CR-2026-037). ACCOUNTANT chỉ thấy phạm vi tài chính — phạm vi
  // được lọc ở `features/audit` (`scopeForRole`, tầng api) chứ không ở đây. OPERATION_STAFF ✗ (AL-BR-12).
  // Cột DISPATCHER không có trong bảng AL §16 → 'TBD' (không cấp ngầm).
  // TODO(OQ: AuditLog-BRD.md §16 "giới hạn tài chính" — Accountant gồm những module nào; DISPATCHER chưa có cột — DASHBOARD-PLATFORM-PLAN.md §11 Q9/Q19).
  {
    resource: 'AUDIT',
    action: 'VIEW',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: true },
    source: 'AuditLog-BRD.md §16 + CR-2026-035/037 — Truy cập nhật ký toàn hệ thống; Accountant giới hạn tài chính; OPERATION_STAFF ✗ (AL-BR-12)',
  },
  // TODO(OQ: AuditLog-BRD.md §22 Q11 — Accountant có được xuất nhật ký không; DISPATCHER chưa có cột) → 'TBD' (không thấy nút Xuất CSV).
  {
    resource: 'AUDIT',
    action: 'EXPORT',
    values: { SYSTEM_ADMIN: true, MANAGER: true, SALES: true, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: 'TBD' },
    source: 'AuditLog-BRD.md §16 — Xuất nhật ký (CR-2026-037: Manager xuất được; CR-2026-035: SALES ≈ Manager; Accountant TBD — §22 Q11)',
  },
  {
    resource: 'NOTIFICATION',
    action: 'VIEW',
    values: ALL_ROLES.reduce((acc, r) => ({ ...acc, [r]: true }), {} as RoleValueMap),
    source: 'Notification-BRD.md §14 — Xem Trung tâm thông báo của mình / Đánh dấu đã đọc',
  },
  // 4 entry dưới chưa có UI dùng ở Phase 6 — chỉ để màn "Vai trò & quyền" hiện rõ quyết định còn treo (DASHBOARD-PLATFORM-PLAN.md §7).
  // Cột DISPATCHER không có trong bảng NT §14 → 'TBD' (TODO(OQ) §11 Q19). SALES = false theo đúng chữ NT §14
  // dù CR-2026-035 nói SALES ≈ MANAGER — TODO(OQ) §11 Q2, báo BA. Không dùng likeManager().
  {
    resource: 'NOTIFICATION',
    action: 'CONFIG',
    values: { SYSTEM_ADMIN: true, MANAGER: false, SALES: false, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'Notification-BRD.md §14 — Cấu hình danh mục sự kiện / ngưỡng / kênh',
  },
  {
    resource: 'NOTIFICATION',
    action: 'EDIT',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: false, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'Notification-BRD.md §14 — Soạn / sửa Template',
  },
  {
    resource: 'NOTIFICATION',
    action: 'VOID',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: false, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: false },
    source: 'Notification-BRD.md §14 — Huỷ (CANCELLED) một Notification Event',
  },
  {
    resource: 'NOTIFICATION',
    action: 'EXPORT',
    values: { SYSTEM_ADMIN: true, MANAGER: 'TBD', SALES: false, DISPATCHER: 'TBD', OPERATION_STAFF: false, ACCOUNTANT: 'TBD' },
    source: 'Notification-BRD.md §14 — Xem báo cáo gửi thông báo toàn hệ thống',
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
