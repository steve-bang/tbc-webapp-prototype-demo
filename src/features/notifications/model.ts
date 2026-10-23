import { canAccessPath } from '@/app/routeAccess'
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
  type NotificationDeliveryStatus,
  type NotificationEventType,
  type NotificationPriority,
  type NotificationSourceModule,
  type Role,
} from '@/shared/domain/enums'
import { can as canRole, type Action, type Resource } from '@/shared/domain/permissions'
import { vi } from '@/shared/i18n/vi'
import { toDateKey } from '@/shared/lib/datetime'

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
  const todayKey = toDateKey(now)
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

/**
 * Link theo người xem (TECH-HARDENING-PLAN.md §11.2 mục 5): `link` nếu người xem qua được guard route,
 * ngược lại `linkFallback` nếu qua được, ngược lại `undefined` (không điều hướng).
 */
export function resolveLink(
  item: { link: string; linkFallback?: string },
  check: (resource: Resource, action: Action) => boolean,
): string | undefined {
  if (canAccessPath(item.link, check)) return item.link
  if (item.linkFallback && canAccessPath(item.linkFallback, check)) return item.linkFallback
  return undefined
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

// ---------------------------------------------------------------------------------------------------------------------
// Round 2 — Notification Event có lưu (DASHBOARD-PLATFORM-PLAN.md §3.2, §19). Mọi hàm dưới đây THUẦN: id và thời điểm do api.ts cấp.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Notification Event + Delivery gộp một bản ghi (Notification-BRD.md §6.1/§6.4) — Phase 1 chỉ một kênh `IN_APP_WEBAPP`.
 * `deliveryStatus` chỉ `SENT` | `CANCELLED` (IN_APP coi là SENT ngay khi tạo — NT §6.5).
 */
export interface NotificationEvent {
  id: string
  /** EX-02 — duy nhất trong các bản ghi đang hiệu lực (`SENT`). */
  dedupeKey: string
  eventType: NotificationEventType
  sourceModule: NotificationSourceModule
  entityType: string
  entityId: string
  entityLabel: string
  priority: NotificationPriority
  dueRef?: string
  link: string
  /** Dùng khi người xem không qua được guard của `link` — TECH-HARDENING-PLAN.md §11.2 mục 5. */
  linkFallback?: string
  resource: Resource
  /** Snapshot từ Template v1 tại thời điểm tạo — không sửa về sau (NT-BR-09, AC-NT-007). */
  title: string
  body: string
  templateVersion: number
  recipientRoles: Role[]
  recipientUserIds: string[]
  channel: 'IN_APP_WEBAPP'
  deliveryStatus: Extract<NotificationDeliveryStatus, 'SENT' | 'CANCELLED'>
  triggerAt: string
  /** AC-NT-008 / NT-BR-14 — huỷ khi tín hiệu biến mất, không xoá vật lý. */
  cancelledAt?: string
  /** Trạng thái đọc theo từng người nhận (AC-NT-004): userId → thời điểm ISO. */
  readBy: Record<string, string>
}

export type NewNotificationEvent = Omit<NotificationEvent, 'id'>

export interface NotificationUser {
  userId: string
  role: Role
}

/** NT-BR-12 + EX-03: người nhận theo vai trò HIỆN TẠI hoặc được chỉ định trực tiếp (không lọc thêm theo quyền VIEW). */
export function isRecipient(event: Pick<NotificationEvent, 'recipientRoles' | 'recipientUserIds'>, user: NotificationUser): boolean {
  return event.recipientRoles.includes(user.role) || event.recipientUserIds.includes(user.userId)
}

/**
 * Đồng bộ tín hiệu → sự kiện lưu (EX-02 khử trùng theo `dedupeKey`, AC-NT-008/NT-BR-14 tự CANCELLED khi tín hiệu mất).
 * Thuần, không sinh id.
 */
export function planSync(
  existing: NotificationEvent[],
  signals: OperationalSignal[],
  now: Date,
): { toCreate: NewNotificationEvent[]; toCancelIds: string[] } {
  const activeKeys = new Set(existing.filter((e) => e.deliveryStatus === 'SENT').map((e) => e.dedupeKey))
  const signalKeys = new Set(signals.map((s) => s.dedupeKey))
  const toCreate: NewNotificationEvent[] = []
  const created = new Set<string>()
  for (const signal of signals) {
    if (activeKeys.has(signal.dedupeKey) || created.has(signal.dedupeKey)) continue
    const recipientRoles = recipientRolesFor(signal)
    const recipientUserIds = signal.recipientUserIds ?? []
    // Không có người nhận nào → không tạo event mồ côi.
    if (recipientRoles.length === 0 && recipientUserIds.length === 0) continue
    created.add(signal.dedupeKey)
    const { title, body } = renderTemplate(signal.eventType, signal.payload)
    toCreate.push({
      dedupeKey: signal.dedupeKey,
      eventType: signal.eventType,
      sourceModule: signal.sourceModule,
      entityType: signal.entityType,
      entityId: signal.entityId,
      entityLabel: signal.entityLabel,
      priority: signal.priority,
      dueRef: signal.dueRef,
      link: signal.link,
      ...(signal.linkFallback ? { linkFallback: signal.linkFallback } : {}),
      resource: signal.resource,
      title,
      body,
      templateVersion: vi.notifications.templateVersion,
      recipientRoles,
      recipientUserIds,
      channel: 'IN_APP_WEBAPP',
      deliveryStatus: 'SENT',
      triggerAt: now.toISOString(),
      readBy: {},
    })
  }
  const toCancelIds = existing
    .filter((e) => e.deliveryStatus === 'SENT' && !signalKeys.has(e.dedupeKey))
    .map((e) => e.id)
  return { toCreate, toCancelIds }
}

/**
 * Giới hạn KỸ THUẬT của bản demo (localStorage), KHÔNG phải chính sách lưu trữ — NT-BR-14 cấm xoá thông báo.
 * DASHBOARD-PLATFORM-PLAN.md §9.1.
 */
export const NOTIFICATIONS_MAX_CHARS = 80_000

/** Thứ tự bỏ: (1) CANCELLED cũ nhất → (2) SENT đã có người đọc, cũ nhất → (3) còn lại, cũ nhất. */
function dropOrder(events: NotificationEvent[]): NotificationEvent[] {
  const rank = (e: NotificationEvent) => (e.deliveryStatus === 'CANCELLED' ? 0 : Object.keys(e.readBy).length > 0 ? 1 : 2)
  const time = (e: NotificationEvent) => (e.deliveryStatus === 'CANCELLED' ? (e.cancelledAt ?? e.triggerAt) : e.triggerAt)
  return [...events].sort((a, b) => rank(a) - rank(b) || time(a).localeCompare(time(b)))
}

/** Bỏ bớt cho tới khi `JSON.stringify(events).length <= maxChars`; giữ nguyên thứ tự các event còn lại. */
export function pruneToBudget(events: NotificationEvent[], maxChars: number): NotificationEvent[] {
  if (JSON.stringify(events).length <= maxChars) return events
  const dropped = new Set<string>()
  let kept = events
  for (const candidate of dropOrder(events)) {
    dropped.add(candidate.id)
    kept = events.filter((e) => !dropped.has(e.id))
    if (JSON.stringify(kept).length <= maxChars) break
  }
  return kept
}

/** Bỏ thêm `ratio` (0–1) số event theo cùng thứ tự ưu tiên bỏ — dùng khi `writeJson` thất bại (D8). */
export function trimByRatio(events: NotificationEvent[], ratio: number): NotificationEvent[] {
  const count = Math.max(1, Math.ceil(events.length * ratio))
  const dropped = new Set(dropOrder(events).slice(0, count).map((e) => e.id))
  return events.filter((e) => !dropped.has(e.id))
}

export interface NotificationFilter {
  tab: 'ACTIVE' | 'CANCELLED'
  eventType?: NotificationEventType
  priority?: NotificationPriority
  readState?: 'ALL' | 'UNREAD' | 'READ'
  sourceModule?: NotificationSourceModule
  /** `yyyy-MM-dd`, so theo ngày địa phương của `triggerAt`. */
  from?: string
  to?: string
}

/** Bộ lọc Inbox (NT §10). Sắp: chưa đọc trước → ưu tiên → mới trước. */
export function filterNotifications(
  events: NotificationEvent[],
  filter: NotificationFilter,
  userId: string,
): NotificationEvent[] {
  const wantStatus = filter.tab === 'ACTIVE' ? 'SENT' : 'CANCELLED'
  const isUnread = (e: NotificationEvent) => e.deliveryStatus === 'SENT' && !e.readBy[userId]
  return events
    .filter((e) => {
      if (e.deliveryStatus !== wantStatus) return false
      if (filter.eventType && e.eventType !== filter.eventType) return false
      if (filter.priority && e.priority !== filter.priority) return false
      if (filter.sourceModule && e.sourceModule !== filter.sourceModule) return false
      if (filter.readState === 'UNREAD' && e.readBy[userId]) return false
      if (filter.readState === 'READ' && !e.readBy[userId]) return false
      if (filter.from || filter.to) {
        const day = toDateKey(e.triggerAt)
        if (filter.from && day < filter.from) return false
        if (filter.to && day > filter.to) return false
      }
      return true
    })
    .sort(
      (a, b) =>
        Number(isUnread(b)) - Number(isUnread(a)) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.triggerAt.localeCompare(a.triggerAt),
    )
}

/** AC-NT-009, NT §5.1 — thông báo nhóm tài chính: mở lần đầu phải ghi audit. */
export function isSensitiveNotification(event: Pick<NotificationEvent, 'eventType'>): boolean {
  return event.eventType === 'PAYMENT_INCOMPLETE' || event.eventType === 'CONSIGNMENT_PAYMENT_DUE'
}

/** Số chưa đọc của người dùng: event đang hiệu lực, là người nhận, chưa có `readBy[userId]`. */
export function countUnread(events: NotificationEvent[], user: NotificationUser): number {
  return events.filter((e) => e.deliveryStatus === 'SENT' && isRecipient(e, user) && !e.readBy[user.userId]).length
}
