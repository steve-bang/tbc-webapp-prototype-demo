import { ASSIGNMENTS_STORAGE_KEY, EMPLOYEES_STORAGE_KEY } from '@/features/employees'
import { CONSIGNMENT_CONTRACTS_STORAGE_KEY, OWNER_PAYOUT_RECORDS_STORAGE_KEY } from '@/features/consignment'
import { CONTRACTS_STORAGE_KEY } from '@/features/contracts'
import { PAYMENT_REQUESTS_STORAGE_KEY, SETTLEMENTS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '@/features/finance'
import { INCIDENTS_STORAGE_KEY } from '@/features/incidents'
import { MAINTENANCE_RECORDS_STORAGE_KEY, MAINTENANCE_RULES_STORAGE_KEY } from '@/features/maintenance'
import { RENTALS_STORAGE_KEY } from '@/features/rentals'
import { VEHICLES_STORAGE_KEY } from '@/features/vehicles'
import type { OperationalSignal } from '@/shared/domain/alerts'
import type { Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { vi } from '@/shared/i18n/vi'
import {
  collectAllSignals,
  countUnread,
  filterNotifications,
  isRecipient,
  isSensitiveNotification,
  NOTIFICATIONS_MAX_CHARS,
  planSync,
  pruneToBudget,
  trimByRatio,
  type NotificationEvent,
  type NotificationFilter,
  type SignalSources,
} from './model'

export const NOTIFICATIONS_STORAGE_KEY = 'notifications'

/** Người dùng thực hiện thao tác (lấy từ session ở hooks). */
export interface NotificationActor {
  userId: string
  fullName: string
  role: Role
}

/**
 * Tác nhân hệ thống cho bản ghi audit gộp của lượt đồng bộ.
 * TODO(Phase 6 R3): chuyển sang `actorType: 'SYSTEM'` khi `AuditRecord` có trường này.
 */
const SYSTEM_ACTOR = { actorUserId: 'system', actorName: vi.notifications.systemActor, actorRole: 'SYSTEM' } as const

function readEvents(): NotificationEvent[] {
  return readJson<NotificationEvent[]>(NOTIFICATIONS_STORAGE_KEY) ?? []
}

function readSources(): SignalSources {
  return {
    vehicles: readJson<SignalSources['vehicles']>(VEHICLES_STORAGE_KEY) ?? [],
    maintenanceRules: readJson<SignalSources['maintenanceRules']>(MAINTENANCE_RULES_STORAGE_KEY) ?? [],
    maintenanceRecords: readJson<SignalSources['maintenanceRecords']>(MAINTENANCE_RECORDS_STORAGE_KEY) ?? [],
    rentals: readJson<SignalSources['rentals']>(RENTALS_STORAGE_KEY) ?? [],
    contracts: readJson<SignalSources['contracts']>(CONTRACTS_STORAGE_KEY) ?? [],
    paymentRequests: readJson<SignalSources['paymentRequests']>(PAYMENT_REQUESTS_STORAGE_KEY) ?? [],
    transactions: readJson<SignalSources['transactions']>(TRANSACTIONS_STORAGE_KEY) ?? [],
    settlements: readJson<SignalSources['settlements']>(SETTLEMENTS_STORAGE_KEY) ?? [],
    incidents: readJson<SignalSources['incidents']>(INCIDENTS_STORAGE_KEY) ?? [],
    employees: readJson<SignalSources['employees']>(EMPLOYEES_STORAGE_KEY) ?? [],
    assignments: readJson<SignalSources['assignments']>(ASSIGNMENTS_STORAGE_KEY) ?? [],
    consignmentContracts: readJson<SignalSources['consignmentContracts']>(CONSIGNMENT_CONTRACTS_STORAGE_KEY) ?? [],
    ownerPayoutRecords: readJson<SignalSources['ownerPayoutRecords']>(OWNER_PAYOUT_RECORDS_STORAGE_KEY) ?? [],
  }
}

/**
 * Tín hiệu cảnh báo vận hành, tính động từ dữ liệu nguồn — KHÔNG ghi gì (Round 1, DASHBOARD-PLATFORM-PLAN.md D4).
 * Ngoại lệ kiến trúc E1: đọc storage của 8 feature qua storage key export ở barrel.
 */
export async function listOperationalSignals(): Promise<OperationalSignal[]> {
  return fakeRequest(() => collectAllSignals(readSources(), new Date()))
}

/**
 * Đồng bộ tín hiệu → sự kiện lưu (Round 2, DASHBOARD-PLATFORM-PLAN.md §19.2 mục 5). ĐỒNG BỘ, không bọc `fakeRequest`;
 * không export qua barrel. Mô hình quét (E3): chạy mỗi lần đọc danh sách thông báo — module nguồn không gọi vào đây.
 * Ghi MỘT bản audit gộp cho cả lượt (NT-BR-13, BA đề xuất gộp để tiết kiệm dung lượng).
 */
export function syncNotifications(now: Date): { created: number; cancelled: number } {
  const existing = readEvents()
  const signals = collectAllSignals(readSources(), now)
  const { toCreate, toCancelIds } = planSync(existing, signals, now)

  const cancelSet = new Set(toCancelIds)
  const nowIso = now.toISOString()
  const updated: NotificationEvent[] = existing.map((e) =>
    cancelSet.has(e.id) ? { ...e, deliveryStatus: 'CANCELLED', cancelledAt: nowIso } : e,
  )
  const added: NotificationEvent[] = toCreate.map((e) => ({ ...e, id: generateId('NT') }))
  const merged = [...added, ...updated]
  const pruned = pruneToBudget(merged, NOTIFICATIONS_MAX_CHARS)

  if (added.length > 0 || cancelSet.size > 0 || pruned.length !== merged.length) {
    // `writeJson` thất bại (localStorage đầy) → cắt thêm 20% bản ghi theo thứ tự ưu tiên bỏ rồi ghi lại đúng một lần (D8).
    if (!writeJson(NOTIFICATIONS_STORAGE_KEY, pruned)) {
      writeJson(NOTIFICATIONS_STORAGE_KEY, trimByRatio(pruned, 0.2))
    }
  }

  if (added.length + cancelSet.size > 0) {
    appendAudit({
      ...SYSTEM_ACTOR,
      action: 'SYNC_NOTIFICATIONS',
      entity: 'NotificationEvent',
      entityId: 'batch',
      summary: vi.notifications.syncAuditSummary
        .replace('{{created}}', String(added.length))
        .replace('{{cancelled}}', String(cancelSet.size)),
    })
  }
  return { created: added.length, cancelled: cancelSet.size }
}

export async function listMyNotifications(user: NotificationActor, filter: NotificationFilter): Promise<NotificationEvent[]> {
  return fakeRequest(() => {
    syncNotifications(new Date())
    return filterNotifications(readEvents().filter((e) => isRecipient(e, user)), filter, user.userId)
  })
}

export async function getUnreadCount(user: NotificationActor): Promise<number> {
  return fakeRequest(() => {
    syncNotifications(new Date())
    return countUnread(readEvents(), user)
  })
}

/** Đánh dấu đã đọc theo từng người (AC-NT-004). Audit chỉ ở lần đọc đầu của thông báo nhạy cảm (AC-NT-009). */
export async function markNotificationRead(id: string, user: NotificationActor): Promise<void> {
  return fakeRequest(() => {
    const events = readEvents()
    const event = events.find((e) => e.id === id)
    if (!event || !isRecipient(event, user)) throw new Error(vi.notifications.errorNotFound)
    // Event đã hết hiệu lực không đánh dấu đọc (chỉ xem lại).
    if (event.deliveryStatus !== 'SENT' || event.readBy[user.userId]) return
    event.readBy[user.userId] = new Date().toISOString()
    writeJson(NOTIFICATIONS_STORAGE_KEY, events)
    if (isSensitiveNotification(event)) {
      appendAudit({
        action: 'VIEW_SENSITIVE_NOTIFICATION',
        entity: 'NotificationEvent',
        entityId: event.id,
        summary: vi.notifications.viewSensitiveAuditSummary.replace('{{title}}', event.title),
        actorUserId: user.userId,
        actorName: user.fullName,
        actorRole: user.role,
      })
    }
  })
}

/** Đánh dấu hàng loạt ≠ mở chi tiết → không audit từng event nhạy cảm (AC-NT-009). Trả số event đã đánh dấu. */
export async function markAllNotificationsRead(user: NotificationActor): Promise<number> {
  return fakeRequest(() => {
    const events = readEvents()
    const nowIso = new Date().toISOString()
    let count = 0
    for (const event of events) {
      if (event.deliveryStatus === 'SENT' && isRecipient(event, user) && !event.readBy[user.userId]) {
        event.readBy[user.userId] = nowIso
        count++
      }
    }
    if (count > 0) writeJson(NOTIFICATIONS_STORAGE_KEY, events)
    return count
  })
}
