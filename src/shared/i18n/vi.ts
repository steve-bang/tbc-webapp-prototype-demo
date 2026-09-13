import type {
  AssignmentStatus,
  ConsignmentContractStatus,
  ContractStatus,
  CustomerStatus,
  DocumentStatus,
  EmployeeStatus,
  IncidentStatus,
  Liability,
  PayoutStatus,
  RentalStatus,
  Role,
  TransactionStatus,
  VehicleClass,
  VehicleStatus,
} from '@/shared/domain/enums'

/**
 * Toàn bộ chuỗi UI tiếng Việt tập trung tại đây — không hard-code chuỗi rải
 * rác trong component, đúng convention `shared/i18n/vi.ts` của App nhân viên.
 */
export const vi = {
  common: {
    appName: 'Thiên Bảo Car — Quản trị',
    loading: 'Đang tải...',
    save: 'Lưu',
    cancel: 'Hủy',
    create: 'Tạo mới',
    edit: 'Sửa',
    delete: 'Xóa',
    view: 'Xem',
    search: 'Tìm kiếm',
    filter: 'Bộ lọc',
    today: 'Hôm nay',
    noData: 'Chưa có dữ liệu',
    comingSoon: 'Sắp ra mắt',
    resetDemoData: 'Reset dữ liệu demo',
    resetDemoDataConfirm: 'Toàn bộ dữ liệu demo hiện tại sẽ bị xoá và khôi phục về dữ liệu mẫu ban đầu. Tiếp tục?',
    resetDemoDataSuccess: 'Đã reset dữ liệu demo.',
    switchRole: 'Đổi vai trò demo',
    logout: 'Đăng xuất',
    actions: 'Thao tác',
    status: 'Trạng thái',
    close: 'Đóng',
    confirm: 'Xác nhận',
    back: 'Quay lại',
    export: 'Xuất',
  },
  nav: {
    dashboard: 'Dashboard',
    calendar: 'Lịch cho thuê',
    vehicles: 'Xe & vòng đời',
    customers: 'Khách hàng',
    schedule: 'Lịch & điều phối',
    rentals: 'Lượt thuê & hợp đồng',
    handoverReturn: 'Giao / nhận xe & sự cố',
    finance: 'Tài chính',
    consignment: 'Xe ký gửi',
    platform: 'Nền tảng',
    systemConfig: 'Cấu hình hệ thống',
    permissions: 'Vai trò & quyền',
    audit: 'Nhật ký thao tác',
    notifications: 'Trung tâm thông báo',
  },
  auth: {
    loginTitle: 'Đăng nhập Webapp quản trị',
    loginSubtitle: 'Thiên Bảo Car Management System',
    username: 'Tên đăng nhập',
    usernamePlaceholder: 'SĐT / email / username',
    password: 'Mật khẩu',
    loginButton: 'Đăng nhập',
    loginError: 'Sai tên đăng nhập hoặc mật khẩu.',
    demoAccountsTitle: 'Tài khoản demo (bấm để điền nhanh)',
    noOtpNote: 'Đăng nhập bằng tên đăng nhập + mật khẩu do Admin cấp — không dùng OTP (CR-2026-034).',
  },
} as const

export const ROLE_LABELS: Record<Role, string> = {
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý',
  DISPATCHER: 'Điều phối viên',
  SALES: 'Kinh doanh',
  OPERATION_STAFF: 'Nhân viên vận hành',
  ACCOUNTANT: 'Kế toán',
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: 'Sẵn sàng',
  RENTED: 'Đang thuê',
  MAINTENANCE: 'Bảo trì',
  INACTIVE: 'Ngừng hoạt động',
}

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  VIP_LUXURY: 'VIP / Hạng sang',
  STANDARD: 'Tiêu chuẩn',
  TWO_SEATER: '2 chỗ',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  VALID: 'Còn hiệu lực',
  EXPIRING_SOON: 'Sắp hết hạn',
  EXPIRED: 'Đã hết hạn',
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: 'Hoạt động',
  BLOCKED: 'Đã khoá',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Đang làm việc',
  INACTIVE: 'Ngừng làm việc',
  SUSPENDED: 'Tạm ngưng',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ASSIGNED: 'Đã phân công',
  IN_PROGRESS: 'Đang thực hiện',
  DONE: 'Hoàn tất',
}

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  CONTRACT_CREATED: 'Đã lập hợp đồng',
  READY_FOR_HANDOVER: 'Chờ giao xe',
  HANDED_OVER: 'Đã giao xe',
  IN_RENTAL: 'Đang thuê',
  RETURNED: 'Đã nhận xe',
  SETTLEMENT: 'Đang quyết toán',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Khách không đến',
  DISPUTED: 'Đang tranh chấp',
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  GENERATED: 'Đã sinh',
  SIGNED: 'Đã ký',
  ACTIVE: 'Hiệu lực',
  CLOSED: 'Đã đóng',
  VOID: 'Đã hủy',
  SUPERSEDED: 'Đã thay thế',
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Mới ghi nhận',
  ASSESSING: 'Đang đánh giá',
  APPROVED: 'Đã duyệt',
  IN_REPAIR: 'Đang sửa chữa',
  REPAIRED: 'Đã sửa xong',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
}

export const LIABILITY_LABELS: Record<Liability, string> = {
  CUSTOMER: 'Khách hàng',
  COMPANY: 'Công ty',
  THIRD_PARTY: 'Bên thứ ba',
  INSURANCE: 'Bảo hiểm',
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  FAILED: 'Thất bại',
  VOIDED: 'Đã hủy',
  REVERSED: 'Đã đảo',
}

export const CONSIGNMENT_CONTRACT_STATUS_LABELS: Record<ConsignmentContractStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  SIGNED: 'Đã ký',
  ACTIVE: 'Hiệu lực',
  CLOSED: 'Đã đóng',
  SUSPENDED: 'Tạm ngưng',
  TERMINATED: 'Đã chấm dứt',
  SUPERSEDED: 'Đã thay thế',
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  SCHEDULED: 'Đã lên lịch',
  PAID: 'Đã chi trả',
  ON_HOLD: 'Tạm giữ',
}
