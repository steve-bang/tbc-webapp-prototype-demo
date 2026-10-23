import type { DashboardAlertGroup, NotificationEventType, NotificationPriority, NotificationSourceModule } from './enums'
import type { Resource } from './permissions'

/**
 * Tín hiệu cảnh báo vận hành — kết quả của các hàm `collect…Signals` ở module nguồn (NT-BR-01/02:
 * ngưỡng thuộc module nguồn, Notification chỉ gom). Tính động, không lưu ở Round 1
 * (DASHBOARD-PLATFORM-PLAN.md §3.1, D1).
 */
export interface OperationalSignal {
  /** NT EX-02 — khoá khử trùng, ổn định theo dữ liệu. */
  dedupeKey: string
  eventType: NotificationEventType
  sourceModule: NotificationSourceModule
  /** Thiếu = tín hiệu không hiển thị ở Dashboard (vd. `EMPLOYEE_ASSIGNMENT`, chỉ dành cho Inbox ở Round 2). */
  group?: DashboardAlertGroup
  /** Dùng để lọc theo quyền VIEW: người xem không có quyền thì không thấy tín hiệu. */
  resource: Resource
  entityType: string
  entityId: string
  entityLabel: string
  priority: NotificationPriority
  /** Mốc nghiệp vụ (ISO hoặc yyyy-MM-dd): Expiry Date, Pickup/Return DateTime, dueDate… */
  dueRef?: string
  /** Biến cho Template; câu chữ hiển thị lấy ở `vi.ts`. */
  payload: Record<string, string | number>
  /** Đường dẫn mở đối tượng nguồn. */
  link: string
  /** Dùng khi người xem không qua được guard của `link` — TECH-HARDENING-PLAN.md §11.2 mục 5. */
  linkFallback?: string
  recipientUserIds?: string[]
}

export function signalDedupeKey(
  eventType: NotificationEventType,
  entityType: string,
  entityId: string,
  dueRef?: string,
): string {
  return `${eventType}:${entityType}:${entityId}:${dueRef ?? ''}`
}
