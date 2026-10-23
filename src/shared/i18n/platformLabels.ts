import type { Action, Resource } from '@/shared/domain/permissions'

/**
 * Nhãn màn "Vai trò & quyền" (SystemAdministration-BRD.md §9). Tách khỏi `vi.ts` (D12, DASHBOARD-PLATFORM-PLAN.md §0.2 · §21.2 mục 7)
 * để nhãn nằm trong chunk tải lười, không phình chunk chính. CHỈ màn tải lười của `features/auth` được import file này.
 */

/** `Record<Resource, string>` — TS ép đủ mọi giá trị `RESOURCES`. */
export const RESOURCE_LABELS: Record<Resource, string> = {
  VEHICLE: 'Xe',
  VEHICLE_DOCUMENT: 'Giấy tờ xe',
  MAINTENANCE: 'Bảo dưỡng & phụ tùng',
  CUSTOMER: 'Khách hàng',
  CALENDAR: 'Lịch cho thuê',
  ASSIGNMENT: 'Phân công giao/nhận',
  EMPLOYEE: 'Nhân viên',
  RENTAL: 'Lượt thuê',
  CONTRACT: 'Hợp đồng',
  HANDOVER_RETURN: 'Giao / nhận xe',
  INCIDENT: 'Sự cố',
  SETTLEMENT: 'Quyết toán',
  PAYMENT: 'Thanh toán',
  FINANCE_REPORT: 'Báo cáo tài chính',
  CONSIGNMENT: 'Xe ký gửi',
  AUDIT: 'Nhật ký thao tác',
  NOTIFICATION: 'Thông báo',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
}

/** `Record<Action, string>` — TS ép đủ mọi giá trị `ACTIONS`. */
export const ACTION_LABELS: Record<Action, string> = {
  VIEW: 'Xem',
  CREATE: 'Tạo',
  EDIT: 'Sửa',
  DELETE: 'Xoá',
  CONFIRM: 'Xác nhận',
  APPROVE: 'Phê duyệt',
  EXPORT: 'Xuất dữ liệu',
  CONFIG: 'Cấu hình',
  BLOCK: 'Chặn / khoá',
  VOID: 'Huỷ hiệu lực',
  REVERSE: 'Đảo',
  EXECUTE: 'Thực hiện',
  ASSIGN: 'Phân công',
  ASSESS: 'Đánh giá',
  CLOSE: 'Đóng',
  RECORD_CASH: 'Ghi nhận tiền mặt',
  RECONCILE: 'Đối soát / đối trừ',
}
