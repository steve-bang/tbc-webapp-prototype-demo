// Nhật ký thao tác MẪU — DỮ LIỆU GIẢ LẬP CHO DEMO (không phải thao tác thật). DASHBOARD-PLATFORM-PLAN.md §9.2 / §20.2 mục 13.
import { DEMO_ACCOUNTS } from '@/features/auth'
import { OWNER_PAYOUT_RECORDS_STORAGE_KEY, VEHICLE_OWNERS_STORAGE_KEY } from '@/features/consignment'
import { CONTRACTS_STORAGE_KEY } from '@/features/contracts'
import { ASSIGNMENTS_STORAGE_KEY } from '@/features/employees'
import { PAYMENT_REQUESTS_STORAGE_KEY, SETTLEMENTS_STORAGE_KEY, TRANSACTIONS_STORAGE_KEY } from '@/features/finance'
import { HANDOVER_RECORDS_STORAGE_KEY, RETURN_RECORDS_STORAGE_KEY } from '@/features/handover-return'
import { INCIDENTS_STORAGE_KEY } from '@/features/incidents'
import { RENTALS_STORAGE_KEY } from '@/features/rentals'
import type { AuditAction, AuditModule, AuditSeverity, Role } from '@/shared/domain/enums'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { seedAuditRecords, type AuditRecord } from '@/shared/lib/audit'
import { vi } from '@/shared/i18n/vi'
import { generateId } from '@/shared/lib/id'
import { readJson } from '@/shared/lib/storage'

/** Bản ghi nguồn (kiểu tối thiểu để đọc id/mốc thời gian thật của feature khác — không import kiểu nội bộ của họ). */
interface Row {
  id: string
  rentalId?: string
  customerId?: string
  vehicleId?: string
  ownerId?: string
  type?: string
  status?: string
  period?: string
  pickupDateTime?: string
  createdAt?: string
  openedAt?: string
  completedAt?: string
  confirmedAt?: string
  reportedAt?: string
  signedDate?: string
  statusHistory?: Array<{ to?: string; at?: string }>
}

function rows(key: string): Row[] {
  return readJson<Row[]>(key) ?? []
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/** Cửa sổ nhật ký mẫu: 14 ngày trước thời điểm seed (DASHBOARD-PLATFORM-PLAN.md §20.9). */
const WINDOW_MS = 14 * DAY

const ms = (iso?: string): number => (iso ? Date.parse(iso) : Number.NaN)
const desc = (field: keyof Row) => (a: Row, b: Row) => ms(b[field] as string | undefined) - ms(a[field] as string | undefined)

/**
 * Nhật ký mẫu (DỮ LIỆU GIẢ LẬP DEMO) — mỗi bản ghi lấy `at` từ MỐC THẬT của thực thể trong store (createdAt/reportedAt/openedAt/
 * completedAt/confirmedAt/signedDate…); hành động không có mốc riêng đặt SAU createdAt. Thực thể chọn THEO MỐC rơi vào cửa sổ,
 * không cố định id; không tìm thấy hoặc ngoài cửa sổ thì BỎ bản ghi (không ép, không rơi về phần tử đầu). Summary không ghi số tiền/số lượng.
 * Không `before`/`after`. Không gọi `appendAudit` trong seed (tiền lệ).
 */
registerSeedStep(() => {
  const now = Date.now()
  const lo = now - WINDOW_MS
  const inWindow = (t: number) => Number.isFinite(t) && t >= lo && t <= now

  const rentals = rows(RENTALS_STORAGE_KEY)
  const settlements = rows(SETTLEMENTS_STORAGE_KEY)
  const transactions = rows(TRANSACTIONS_STORAGE_KEY)
  const requests = rows(PAYMENT_REQUESTS_STORAGE_KEY)
  const incidents = rows(INCIDENTS_STORAGE_KEY)
  const contracts = rows(CONTRACTS_STORAGE_KEY)
  const handovers = rows(HANDOVER_RECORDS_STORAGE_KEY)
  const returns = rows(RETURN_RECORDS_STORAGE_KEY)
  const assignments = rows(ASSIGNMENTS_STORAGE_KEY)
  const owners = rows(VEHICLE_OWNERS_STORAGE_KEY)
  const payouts = rows(OWNER_PAYOUT_RECORDS_STORAGE_KEY)

  const account = (role: Role) => {
    const a = DEMO_ACCOUNTS.find((x) => x.role === role)
    return a ? { actorUserId: a.userId, actorName: a.fullName, actorRole: a.role as string } : undefined
  }
  const manager = account('MANAGER')
  const admin = account('SYSTEM_ADMIN')
  const dispatcher = account('DISPATCHER')
  const sales = account('SALES')
  const accountant = account('ACCOUNTANT')
  const staff = account('OPERATION_STAFF')
  if (!manager || !admin || !dispatcher || !sales || !accountant || !staff) return seedAuditRecords([])
  const system = { actorUserId: 'system', actorName: vi.notifications.systemActor, actorRole: 'SYSTEM', actorType: 'SYSTEM' as const }

  type Actor = typeof manager | typeof system
  interface Draft {
    at: number
    actor: Actor
    action: AuditAction
    module: AuditModule
    entity: string
    entityId: string
    summary: string
    severity?: AuditSeverity
    correlationId?: string
  }
  const drafts: Draft[] = []
  /** Chỉ nhận bản ghi có `at` hợp lệ, nằm trong cửa sổ và không ở tương lai. */
  const add = (d: Draft) => {
    if (inWindow(d.at)) drafts.push(d)
  }
  const pickRentalId = (id?: string) => rentals.find((r) => r.id === id)?.id

  // ---- RENTAL: tạo (createdAt) + xác nhận (sau createdAt, trước giờ giao) ----
  const eligibleRentals = rentals
    .filter(
      (r) =>
        inWindow(ms(r.createdAt)) &&
        ms(r.createdAt) < ms(r.pickupDateTime) &&
        ['CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER', 'HANDED_OVER', 'IN_RENTAL', 'RETURNED', 'SETTLEMENT'].includes(r.status ?? ''),
    )
    .sort(desc('createdAt'))
  eligibleRentals.slice(0, 4).forEach((r) => {
    add({ at: ms(r.createdAt), actor: sales, action: 'CREATE_RENTAL', module: 'RENTAL', entity: 'Rental', entityId: r.id, summary: `Tạo lượt thuê ${r.id}` })
  })
  eligibleRentals.slice(1, 2).forEach((r) => {
    const at = ms(r.createdAt) + 20 * MIN
    if (at < ms(r.pickupDateTime)) {
      add({ at, actor: sales, action: 'CONFIRM_RENTAL', module: 'RENTAL', entity: 'Rental', entityId: r.id, summary: `Xác nhận lượt thuê ${r.id}` })
    }
  })

  // ---- CUSTOMER / VEHICLE: cập nhật sau khi lượt thuê được tạo (thực thể gốc có từ trước) ----
  const [rA, rB] = eligibleRentals.slice(2, 4)
  if (rA?.customerId) {
    add({ at: ms(rA.createdAt) + 10 * MIN, actor: sales, action: 'UPDATE_CUSTOMER', module: 'CUSTOMER', entity: 'Customer', entityId: rA.customerId, summary: 'Cập nhật hồ sơ khách hàng' })
  }
  if (rB?.vehicleId) {
    add({ at: ms(rB.createdAt) + HOUR, actor: manager, action: 'UPDATE_VEHICLE', module: 'VEHICLE', entity: 'Vehicle', entityId: rB.vehicleId, summary: 'Cập nhật thông tin xe' })
  }

  // ---- CONTRACT: sinh (createdAt) + ký (cùng ngày signedDate, sau createdAt) ----
  contracts
    .filter((c) => inWindow(ms(c.createdAt)))
    .sort(desc('createdAt'))
    .slice(0, 2)
    .forEach((c) => {
      add({ at: ms(c.createdAt), actor: sales, action: 'CREATE_CONTRACT', module: 'CONTRACT', entity: 'Contract', entityId: c.id, summary: `Sinh hợp đồng cho lượt ${c.rentalId}` })
    })
  contracts
    .filter((c) => c.signedDate)
    .map((c) => ({ c, at: ms(`${c.signedDate}T09:00:00+07:00`) }))
    .filter(({ c, at }) => inWindow(at) && at >= ms(c.createdAt))
    .sort((a, b) => b.at - a.at)
    .slice(0, 1)
    .forEach(({ c, at }) => {
      add({ at, actor: sales, action: 'SET_CONTRACT_SIGNED', module: 'CONTRACT', entity: 'Contract', entityId: c.id, summary: `Ghi nhận hợp đồng của lượt ${c.rentalId} đã ký` })
    })

  // ---- HANDOVER / RETURN: sửa biên bản sau khi được tạo ----
  handovers
    .filter((h) => inWindow(ms(h.createdAt) + 3 * HOUR) && h.status === 'COMPLETED')
    .sort(desc('createdAt'))
    .slice(2, 3)
    .forEach((h) => add({ at: ms(h.createdAt) + 3 * HOUR, actor: manager, action: 'EDIT_HANDOVER', module: 'HANDOVER', entity: 'HandoverRecord', entityId: h.id, summary: `Sửa biên bản giao xe của lượt ${h.rentalId}` }))
  returns
    .filter((r) => inWindow(ms(r.createdAt) + 3 * HOUR) && r.status === 'COMPLETED')
    .sort(desc('createdAt'))
    .slice(1, 2)
    .forEach((r) => add({ at: ms(r.createdAt) + 3 * HOUR, actor: manager, action: 'EDIT_RETURN', module: 'RETURN', entity: 'ReturnRecord', entityId: r.id, summary: `Sửa biên bản nhận xe của lượt ${r.rentalId}` }))

  // ---- EMPLOYEE: phân công (createdAt) ----
  assignments
    .filter((a) => inWindow(ms(a.createdAt)))
    .sort(desc('createdAt'))
    .slice(0, 2)
    .forEach((a) => add({ at: ms(a.createdAt), actor: dispatcher, action: 'CREATE_ASSIGNMENT', module: 'EMPLOYEE', entity: 'Assignment', entityId: a.id, summary: `Phân công cho lượt ${a.rentalId}` }))

  // ---- INCIDENT: tạo (reportedAt) ----
  incidents
    .filter((i) => i.rentalId && inWindow(ms(i.reportedAt)))
    .sort(desc('reportedAt'))
    .slice(0, 2)
    .forEach((i) => add({ at: ms(i.reportedAt), actor: manager, action: 'CREATE_INCIDENT', module: 'INCIDENT', entity: 'Incident', entityId: i.id, summary: `Tạo sự cố cho lượt ${i.rentalId}` }))

  // ---- Chuỗi correlation: quyết toán COMPLETED → giao dịch thu cuối/hoàn cọc đã xác nhận → hoàn tất lượt — của CÙNG một lượt, theo mốc thật ----
  const chainRentals = new Set<string>()
  const chainCandidates: Array<{ diff: number; s: Row; t: Row }> = []
  for (const s of settlements) {
    if (s.status !== 'COMPLETED' || !s.rentalId || !inWindow(ms(s.completedAt) + MIN)) continue
    for (const t of transactions) {
      if (t.rentalId !== s.rentalId || t.status !== 'CONFIRMED' || !['DEPOSIT_REFUND', 'ADDITIONAL_CHARGE'].includes(t.type ?? '')) continue
      if (!inWindow(ms(t.confirmedAt))) continue
      chainCandidates.push({ diff: Math.abs(ms(t.confirmedAt) - ms(s.completedAt)), s, t })
    }
  }
  chainCandidates.sort((a, b) => a.diff - b.diff || ms(b.s.completedAt) - ms(a.s.completedAt))
  for (const { s, t } of chainCandidates) {
    if (chainRentals.size >= 2 || !s.rentalId || chainRentals.has(s.rentalId) || !pickRentalId(s.rentalId)) continue
    chainRentals.add(s.rentalId)
    const correlationId = `cor_${s.id}`
    add({ at: ms(s.completedAt), actor: accountant, action: 'COMPLETE_SETTLEMENT', module: 'SETTLEMENT', entity: 'Settlement', entityId: s.id, summary: `Hoàn tất quyết toán lượt ${s.rentalId}`, correlationId })
    add({ at: ms(t.confirmedAt), actor: accountant, action: 'CONFIRM_TRANSACTION', module: 'PAYMENT', entity: 'Transaction', entityId: t.id, summary: `Xác nhận giao dịch ${t.type === 'DEPOSIT_REFUND' ? 'hoàn cọc' : 'thu khoản phát sinh'} của lượt ${s.rentalId}`, correlationId })
    add({ at: ms(s.completedAt) + MIN, actor: manager, action: 'COMPLETE_RENTAL', module: 'RENTAL', entity: 'Rental', entityId: s.rentalId, summary: `Hoàn tất lượt thuê ${s.rentalId}`, correlationId })
  }

  // ---- SETTLEMENT: mở (openedAt), hoàn tất ngoài chuỗi (completedAt), xác nhận dòng (sau openedAt) ----
  const openSettlements = settlements.filter((s) => inWindow(ms(s.openedAt)) && s.status !== 'COMPLETED').sort(desc('openedAt'))
  openSettlements.slice(0, 2).forEach((s) => add({ at: ms(s.openedAt), actor: accountant, action: 'OPEN_SETTLEMENT', module: 'SETTLEMENT', entity: 'Settlement', entityId: s.id, summary: `Mở quyết toán lượt ${s.rentalId}` }))
  openSettlements.slice(0, 1).forEach((s) => add({ at: ms(s.openedAt) + 2 * HOUR, actor: accountant, action: 'CONFIRM_SETTLEMENT_LINE', module: 'SETTLEMENT', entity: 'Settlement', entityId: s.id, summary: `Xác nhận dòng quyết toán của lượt ${s.rentalId}` }))
  settlements
    .filter((s) => s.status === 'COMPLETED' && s.rentalId && !chainRentals.has(s.rentalId) && inWindow(ms(s.completedAt)))
    .sort(desc('completedAt'))
    .slice(0, 2)
    .forEach((s) => add({ at: ms(s.completedAt), actor: accountant, action: 'COMPLETE_SETTLEMENT', module: 'SETTLEMENT', entity: 'Settlement', entityId: s.id, summary: `Hoàn tất quyết toán lượt ${s.rentalId}` }))

  // ---- PAYMENT: giao dịch (createdAt/confirmedAt), biên lai (sau xác nhận), yêu cầu thanh toán (createdAt) ----
  const paymentTxns = transactions.filter((t) => t.rentalId && t.status === 'CONFIRMED' && t.type === 'RENTAL_PAYMENT' && !chainRentals.has(t.rentalId))
  const byConfirmed = paymentTxns.filter((t) => inWindow(ms(t.confirmedAt))).sort(desc('confirmedAt'))
  byConfirmed.slice(0, 2).forEach((t) => add({ at: ms(t.confirmedAt), actor: accountant, action: 'CONFIRM_TRANSACTION', module: 'PAYMENT', entity: 'Transaction', entityId: t.id, summary: `Xác nhận giao dịch thu tiền thuê của lượt ${t.rentalId}` }))
  byConfirmed.slice(2, 3).forEach((t) => add({ at: ms(t.confirmedAt) + 5 * MIN, actor: accountant, action: 'ISSUE_RECEIPT', module: 'PAYMENT', entity: 'Transaction', entityId: t.id, summary: `Phát hành biên lai cho giao dịch của lượt ${t.rentalId}` }))
  paymentTxns
    .filter((t) => inWindow(ms(t.createdAt)))
    .sort(desc('createdAt'))
    .slice(3, 5)
    .forEach((t) => add({ at: ms(t.createdAt), actor: accountant, action: 'CREATE_TRANSACTION', module: 'PAYMENT', entity: 'Transaction', entityId: t.id, summary: `Tạo giao dịch thu tiền thuê của lượt ${t.rentalId}` }))
  requests
    .filter((r) => r.rentalId && inWindow(ms(r.createdAt)))
    .sort(desc('createdAt'))
    .filter((_, i) => i % 7 === 0)
    .slice(0, 2)
    .forEach((r) => add({ at: ms(r.createdAt), actor: accountant, action: 'CREATE_PAYMENT_REQUEST', module: 'PAYMENT', entity: 'PaymentRequest', entityId: r.id, summary: `Tạo yêu cầu thanh toán cho lượt ${r.rentalId}` }))

  // ---- CONSIGNMENT: chi trả chủ xe đã PAID (mốc PAID trong statusHistory), xem tài khoản ngân hàng chủ xe trước đó, sinh lịch theo kỳ ----
  const paidPayouts = payouts
    .map((p) => ({ p, paidAt: ms([...(p.statusHistory ?? [])].reverse().find((h) => h.to === 'PAID')?.at) }))
    .filter(({ paidAt }) => inWindow(paidAt))
    .sort((a, b) => b.paidAt - a.paidAt)
  paidPayouts.slice(0, 2).forEach(({ p, paidAt }) =>
    add({ at: paidAt, actor: accountant, action: 'MARK_OWNER_PAYOUT_RECORD_PAID', module: 'CONSIGNMENT', entity: 'OwnerPayoutRecord', entityId: p.id, summary: `Đánh dấu đã chi trả chủ xe kỳ ${p.period ?? ''}`.trim() }),
  )
  const firstPaid = paidPayouts[0]
  if (firstPaid && owners.some((o) => o.id === firstPaid.p.ownerId)) {
    add({ at: firstPaid.paidAt - 30 * MIN, actor: accountant, action: 'VIEW_OWNER_BANK_ACCOUNT', module: 'CONSIGNMENT', entity: 'VehicleOwner', entityId: firstPaid.p.ownerId as string, summary: 'Xem số tài khoản ngân hàng chủ xe', severity: 'SENSITIVE' })
  }
  const nowDate = new Date(now)
  const period = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`
  add({ at: now - 2 * DAY, actor: system, action: 'GENERATE_OWNER_PAYOUT_RECORDS', module: 'CONSIGNMENT', entity: 'OwnerPayoutRecord', entityId: `batch:${period}`, summary: `Hệ thống sinh lịch chi trả chủ xe đến kỳ ${period}` })

  // ---- Báo cáo tài chính (reportKey là mã thật trong FINANCE_REPORT_KEYS) ----
  add({ at: now - 3 * DAY - 2 * HOUR, actor: manager, action: 'REPORT_EXPORT', module: 'REVENUE_COST', entity: 'FinanceReport', entityId: 'REVENUE', summary: 'Xuất báo cáo doanh thu', severity: 'NOTICE' })

  // ---- Hệ thống & nhật ký (entityId quy ước: batch / view / export) ----
  ;[20 * MIN, 2 * DAY + 3 * HOUR, 8 * DAY + HOUR].forEach((ago) =>
    add({ at: now - ago, actor: system, action: 'SYNC_NOTIFICATIONS', module: 'NOTIFICATION', entity: 'NotificationEvent', entityId: 'batch', summary: 'Hệ thống đồng bộ thông báo vận hành' }),
  )
  add({ at: now - 3 * HOUR, actor: admin, action: 'VIEW_AUDIT_LOG', module: 'AUDIT', entity: 'AuditLog', entityId: 'view', summary: 'Mở màn Nhật ký thao tác', severity: 'NOTICE' })
  add({ at: now - 5 * DAY, actor: manager, action: 'VIEW_AUDIT_LOG', module: 'AUDIT', entity: 'AuditLog', entityId: 'view', summary: 'Mở màn Nhật ký thao tác', severity: 'NOTICE' })
  add({ at: now - 5 * DAY + HOUR, actor: manager, action: 'EXPORT', module: 'AUDIT', entity: 'AuditLog', entityId: 'export', summary: 'Xuất nhật ký thao tác', severity: 'NOTICE' })

  // ---- Phiên đăng nhập (LOGOUT luôn SAU LOGIN cùng người) ----
  const sessions: Array<{ who: NonNullable<typeof manager>; role: Role; loginAgo: number; logoutAgo?: number }> = [
    { who: manager, role: 'MANAGER', loginAgo: 40 * MIN },
    { who: accountant, role: 'ACCOUNTANT', loginAgo: DAY + 2 * HOUR, logoutAgo: DAY - HOUR },
    { who: admin, role: 'SYSTEM_ADMIN', loginAgo: 4 * DAY },
    { who: sales, role: 'SALES', loginAgo: 6 * DAY + 3 * HOUR, logoutAgo: 6 * DAY - 2 * HOUR },
    { who: staff, role: 'OPERATION_STAFF', loginAgo: 9 * DAY, logoutAgo: 9 * DAY - 2 * HOUR },
    { who: dispatcher, role: 'DISPATCHER', loginAgo: 11 * DAY },
  ]
  for (const sn of sessions) {
    add({ at: now - sn.loginAgo, actor: sn.who, action: 'LOGIN', module: 'AUTH', entity: 'UserAccount', entityId: sn.who.actorUserId, summary: `${sn.who.actorName} (${sn.role}) đăng nhập` })
    if (sn.logoutAgo !== undefined) {
      add({ at: now - sn.logoutAgo, actor: sn.who, action: 'LOGOUT', module: 'AUTH', entity: 'UserAccount', entityId: sn.who.actorUserId, summary: `${sn.who.actorName} (${sn.role}) đăng xuất` })
    }
  }

  const records: AuditRecord[] = drafts
    .map((d) => ({
      id: generateId('AL'),
      action: d.action,
      entity: d.entity,
      entityId: d.entityId,
      summary: d.summary,
      actorUserId: d.actor.actorUserId,
      actorName: d.actor.actorName,
      actorRole: d.actor.actorRole,
      at: new Date(d.at).toISOString(),
      module: d.module,
      ...(d.severity ? { severity: d.severity } : {}),
      ...('actorType' in d.actor ? { actorType: d.actor.actorType } : {}),
      ...(d.correlationId ? { correlationId: d.correlationId } : {}),
    }))
    .sort((a, b) => b.at.localeCompare(a.at))

  seedAuditRecords(records)
})
