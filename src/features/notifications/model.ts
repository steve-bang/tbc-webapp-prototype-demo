import { format } from 'date-fns'
import { collectConsignmentSignals, type ConsignmentContract, type OwnerPayoutRecord } from '@/features/consignment'
import { collectContractSignals, type Contract } from '@/features/contracts'
import { collectAssignmentSignals, type Assignment, type Employee } from '@/features/employees'
import { collectPaymentSignals, type PaymentRequest, type Settlement, type Transaction } from '@/features/finance'
import { collectIncidentSignals, type Incident } from '@/features/incidents'
import {
  collectMaintenanceDueSignals,
  type MaintenanceRecord,
  type MaintenanceRule,
} from '@/features/maintenance'
import { collectRentalTimeSignals, type Rental } from '@/features/rentals'
import { collectVehicleDocumentSignals, type Vehicle } from '@/features/vehicles'
import type { OperationalSignal } from '@/shared/domain/alerts'
import {
  DASHBOARD_ALERT_GROUPS,
  type DashboardAlertGroup,
  type NotificationEventType,
  type Role,
} from '@/shared/domain/enums'
import { can as canRole, type Action, type Resource } from '@/shared/domain/permissions'
import { vi } from '@/shared/i18n/vi'

/** Dữ liệu nguồn mà các collector cần (đọc từ storage ở `api.ts`). */
export interface SignalSources {
  vehicles: Vehicle[]
  maintenanceRules: MaintenanceRule[]
  maintenanceRecords: MaintenanceRecord[]
  rentals: Rental[]
  contracts: Contract[]
  paymentRequests: PaymentRequest[]
  transactions: Transaction[]
  settlements: Settlement[]
  incidents: Incident[]
  employees: Employee[]
  assignments: Assignment[]
  consignmentContracts: ConsignmentContract[]
  ownerPayoutRecords: OwnerPayoutRecord[]
}

/**
 * Gom tín hiệu từ 8 module nguồn (NT-BR-01) — hàm thuần: `now` là tham số, ngưỡng do từng collector sở hữu (NT-BR-02).
 * Mô hình quét (pull), DASHBOARD-PLATFORM-PLAN.md D1.
 */
export function collectAllSignals(sources: SignalSources, now: Date): OperationalSignal[] {
  const todayKey = format(now, 'yyyy-MM-dd')
  return [
    ...collectVehicleDocumentSignals(sources.vehicles, now),
    ...collectMaintenanceDueSignals(sources.vehicles, sources.maintenanceRules, sources.maintenanceRecords),
    ...collectRentalTimeSignals(sources.rentals, sources.vehicles, now),
    ...collectContractSignals(sources.contracts, sources.rentals),
    ...collectPaymentSignals(sources.rentals, sources.paymentRequests, sources.transactions, sources.settlements),
    ...collectIncidentSignals(sources.incidents, sources.vehicles),
    ...collectAssignmentSignals(sources.assignments, sources.employees, sources.rentals, now),
    ...collectConsignmentSignals(sources.consignmentContracts, sources.ownerPayoutRecords, todayKey),
  ]
}

/**
 * Bảng định tuyến vai trò nhận theo Event Type — Notification-BRD.md §6.2.
 * BA đề xuất, KHÔNG phải quyết định đã chốt (DASHBOARD-PLATFORM-PLAN.md §4.2, §11 Q5/Q18).
 * TODO(OQ: Notification-BRD.md §6.2/§20 Q3, Q6) — vai trò nhận từng loại + phạm vi người nhận chưa chốt.
 * `OPERATION_ALERT_OTHER` định tuyến theo `payload.kind` (xem `OPERATION_ALERT_KIND_ROUTING`).
 */
export const RECIPIENT_ROUTING: Record<NotificationEventType, Role[]> = {
  RENTAL_UPCOMING: ['MANAGER', 'SALES', 'DISPATCHER'],
  HANDOVER_UPCOMING: ['MANAGER', 'SALES', 'DISPATCHER'],
  RETURN_UPCOMING: ['MANAGER', 'SALES', 'DISPATCHER'],
  // Người được giao nhận qua `recipientUserIds`; DISPATCHER theo dõi điều phối.
  EMPLOYEE_ASSIGNMENT: ['DISPATCHER'],
  CONTRACT_INCOMPLETE: ['MANAGER', 'SALES'],
  PAYMENT_INCOMPLETE: ['MANAGER', 'SALES', 'ACCOUNTANT'],
  VEHICLE_INSPECTION_EXPIRING: ['SYSTEM_ADMIN', 'MANAGER', 'SALES'],
  VEHICLE_INSURANCE_EXPIRING: ['SYSTEM_ADMIN', 'MANAGER', 'SALES'],
  VEHICLE_DOCUMENT_EXPIRING: ['SYSTEM_ADMIN', 'MANAGER', 'SALES'],
  CUSTOMER_BOOKING_SUCCESS: ['MANAGER', 'SALES'],
  RETURN_TIME_CONFIRMATION_REQUEST: ['MANAGER', 'SALES', 'DISPATCHER'],
  VEHICLE_BREAKDOWN_BEFORE_HANDOVER: ['MANAGER', 'SALES', 'DISPATCHER'],
  // CR-2026-051 — Phase 1 nhắc hết hạn hợp đồng ký gửi gửi Admin.
  CONSIGNMENT_CONTRACT_EXPIRING: ['SYSTEM_ADMIN'],
  CONSIGNMENT_PAYMENT_DUE: ['SYSTEM_ADMIN', 'ACCOUNTANT'],
  MAINTENANCE_DUE: ['SYSTEM_ADMIN', 'MANAGER', 'SALES'],
  VEHICLE_OVERUSE: ['SYSTEM_ADMIN', 'MANAGER'],
  TASK_ASSIGNMENT: ['DISPATCHER'],
  OPERATION_ALERT_OTHER: ['MANAGER', 'SALES'],
}

/** Định tuyến riêng cho `OPERATION_ALERT_OTHER` theo `payload.kind` (TODO(OQ): chưa có mã Event riêng — §11 Q13). */
export const OPERATION_ALERT_KIND_ROUTING: Record<string, Role[]> = {
  RETURN_OVERDUE: ['MANAGER', 'SALES', 'DISPATCHER'],
  INCIDENT_OPEN: ['MANAGER', 'SALES'],
}

/** Vai trò theo bảng định tuyến, CHƯA lọc quyền (để harness phát hiện vai trò bị loại). */
export function routedRoles(signal: OperationalSignal): Role[] {
  if (signal.eventType === 'OPERATION_ALERT_OTHER') {
    const kind = String(signal.payload.kind ?? '')
    return OPERATION_ALERT_KIND_ROUTING[kind] ?? RECIPIENT_ROUTING.OPERATION_ALERT_OTHER
  }
  return RECIPIENT_ROUTING[signal.eventType]
}

/** Vai trò nhận cuối cùng: bỏ vai trò không có `VIEW` trên `resource` của tín hiệu — không cấp quyền ngầm. */
export function recipientRolesFor(signal: OperationalSignal): Role[] {
  return routedRoles(signal).filter((role) => canRole(role, signal.resource, 'VIEW'))
}

/**
 * Dựng tiêu đề/nội dung từ Template v1 (`vi.notifications.templates`), thay `{{biến}}` bằng `payload`.
 * Khoá tra cứu: `<EventType>:<payload.kind>` rồi `<EventType>`.
 * TODO(OQ: Notification-BRD.md §20 Q3) — ai soạn/sửa Template chưa chốt; Phase 6 cố định trong `vi.ts`.
 */
export function renderTemplate(
  eventType: NotificationEventType,
  payload: OperationalSignal['payload'],
): { title: string; body: string } {
  const templates = vi.notifications.templates
  const kind = payload.kind !== undefined ? String(payload.kind) : undefined
  const template = (kind ? templates[`${eventType}:${kind}`] : undefined) ?? templates[eventType]
  if (!template) return { title: eventType, body: '' }
  const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(payload[key] ?? ''))
  return { title: fill(template.title), body: fill(template.body) }
}

/** Nhóm cảnh báo → resource quyết định ai được thấy nhóm (ẩn cả nhóm nếu không có `VIEW`). */
export const ALERT_GROUP_RESOURCE: Record<DashboardAlertGroup, Resource> = {
  VEHICLE_DOCUMENT: 'VEHICLE',
  UPCOMING_HANDOVER: 'RENTAL',
  UPCOMING_RETURN: 'RENTAL',
  OVERDUE_RETURN: 'RENTAL',
  PAYMENT_INCOMPLETE: 'PAYMENT',
  INCIDENT_OPEN: 'INCIDENT',
  CONTRACT_UNSIGNED: 'CONTRACT',
  MAINTENANCE_DUE: 'MAINTENANCE',
  VEHICLE_OVERUSE: 'VEHICLE',
  CONSIGNMENT: 'CONSIGNMENT',
}

const PRIORITY_RANK: Record<OperationalSignal['priority'], number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }

export interface DashboardAlertGroupView {
  group: DashboardAlertGroup
  /** Đã sắp: ưu tiên (cao trước) → mốc `dueRef` (sớm trước). */
  signals: OperationalSignal[]
}

/**
 * Gom tín hiệu theo `DASHBOARD_ALERT_GROUPS` cho Dashboard (WebappQuanTri.md §5.3). Chỉ trả nhóm mà người xem có quyền
 * `VIEW` trên resource của nhóm (nhóm rỗng vẫn trả để UI hiện "Không có cảnh báo"); tín hiệu không có `group` bị bỏ.
 */
export function groupSignalsForDashboard(
  signals: OperationalSignal[],
  can: (resource: Resource, action: Action) => boolean,
): DashboardAlertGroupView[] {
  const views: DashboardAlertGroupView[] = []
  for (const group of DASHBOARD_ALERT_GROUPS) {
    if (!can(ALERT_GROUP_RESOURCE[group], 'VIEW')) continue
    const inGroup = signals
      .filter((s) => s.group === group && can(s.resource, 'VIEW'))
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.dueRef ?? '').localeCompare(b.dueRef ?? ''),
      )
    views.push({ group, signals: inGroup })
  }
  return views
}
