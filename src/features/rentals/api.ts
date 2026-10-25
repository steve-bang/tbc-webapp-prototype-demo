// CALENDAR-ROUND3-PLAN.md §4 (C1) — file lá của `calendar` (chỉ import `shared/*`): đọc khoá xe mà không tạo vòng `rentals ↔ calendar`.
import { VEHICLE_BLOCKS_STORAGE_KEY, type VehicleBlock } from '@/features/calendar/blockRules'
import { getById as getCustomerById } from '@/features/customers/api'
// CALENDAR-ROUND3-PLAN.md §4 (C2) — qua barrel dữ liệu; `employees` chỉ `import type` từ `rentals` nên không tạo vòng.
import { shiftAssignmentWindowsForRental } from '@/features/employees'
// Rental cần Customer/Vehicle đầy đủ (không chỉ id) để chạy `canConfirm()`
// (RM-BR-05/06/07) ngay trong lớp api — `vehicles`/`customers` chưa export
// `getById` qua barrel `index.ts` nên import thẳng từ `api.ts` của feature đó,
// cùng tinh thần `maintenance/hooks.ts` import thẳng `vehicles/hooks.ts`.
import { getById as getVehicleById } from '@/features/vehicles/api'
import type { RentalStatus, Role, SecurityDepositType, VehicleClass } from '@/shared/domain/enums'
import { can } from '@/shared/domain/permissions'
import { vi } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { dateTimeToMs, formatDateTime, toDateKey } from '@/shared/lib/datetime'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  CASH_DEPOSIT_AMOUNT,
  PRICE_PER_KM_BY_CLASS,
  calcAllowedKm,
  calcBaseAmount,
  calcDeliveryFee,
  calcEstimatedTotal,
  calcPrepaymentAmount,
  canCancel,
  canCancelHandover,
  canCancelReturn,
  canCompleteRental,
  canConfirm,
  canMarkContractCreated,
  canOpenSettlement,
  canRevertSettlementReversed,
  evaluateScheduleChange,
  needsOverrideReason,
  rentalDurationDays,
  type Rental,
  type ScheduleIssue,
} from './model'

export const RENTALS_STORAGE_KEY = 'rentals'

function readAll(): Rental[] {
  return readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? []
}

function writeAll(items: Rental[]): void {
  writeJson(RENTALS_STORAGE_KEY, items)
}

export interface RentalFilter {
  status?: RentalStatus
  customerId?: string
  vehicleId?: string
  /** `YYYY-MM-DD` — lọc theo `pickupDateTime` >= `dateFrom`. */
  dateFrom?: string
  /** `YYYY-MM-DD` — lọc theo `pickupDateTime` <= `dateTo`. */
  dateTo?: string
}

/**
 * `UC-RM-01` §5.5 — input tạo lượt thuê. `vehicleClass` do UI resolve sẵn từ
 * `Vehicle` đang chọn (đọc trực tiếp trong `RentalFormSheet` qua `useVehicles()`
 * của feature `vehicles`) rồi truyền vào đây để snapshot — giữ `api.ts` không
 * phải tự đọc storage của feature khác cho phần này (chỉ `confirm()` mới cần,
 * vì phải re-validate với dữ liệu Vehicle/Customer mới nhất tại thời điểm xác nhận).
 */
export interface RentalFormInput {
  customerId: string
  vehicleId: string
  vehicleClass: VehicleClass
  pickupDateTime: string
  expectedReturnDateTime: string
  pickupLocation: string
  returnLocation: string
  deliveryDistanceKm?: number
  rentalRate: number
  discountAmount?: number
  discountNote?: string
  additionalChargesAmount?: number
  additionalChargesNote?: string
  securityDepositType: SecurityDepositType
  securityDepositAssetNote?: string
  note?: string
}

/** Người thực hiện thao tác — dùng để ghi audit (RM-BR-11). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function matches(rental: Rental, filter?: RentalFilter): boolean {
  if (!filter) return true
  if (filter.status && rental.status !== filter.status) return false
  if (filter.customerId && rental.customerId !== filter.customerId) return false
  if (filter.vehicleId && rental.vehicleId !== filter.vehicleId) return false
  // N8 — ngày +07 của mốc giao (trước đây cắt chuỗi UTC: giao 00:00–06:59 +07 bị lọc vào hôm trước)
  const pickupDate = toDateKey(rental.pickupDateTime)
  if (filter.dateFrom && pickupDate < filter.dateFrom) return false
  if (filter.dateTo && pickupDate > filter.dateTo) return false
  return true
}

function findOrThrow(items: Rental[], id: string): Rental {
  const found = items.find((r) => r.id === id)
  if (!found) throw new Error('Không tìm thấy lượt thuê')
  return found
}

export async function list(filter?: RentalFilter): Promise<Rental[]> {
  return fakeRequest(() => readAll().filter((r) => matches(r, filter)))
}

export async function getById(id: string): Promise<Rental | undefined> {
  return fakeRequest(() => readAll().find((r) => r.id === id))
}

/**
 * RM-BR-01/02/12/17/18/24/25/26 — tính toàn bộ field snapshot qua hàm thuần
 * `model.ts`, status khởi tạo `DRAFT` (CR-2026-043).
 */
export async function create(input: RentalFormInput, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const now = new Date().toISOString()
    const durationDays = rentalDurationDays(input.pickupDateTime, input.expectedReturnDateTime)
    const allowedKm = calcAllowedKm(durationDays)
    const pricePerKm = PRICE_PER_KM_BY_CLASS[input.vehicleClass] // RM-BR-25
    const baseAmount = calcBaseAmount(input.rentalRate, durationDays)
    const deliveryFee = calcDeliveryFee(input.deliveryDistanceKm)
    const discountAmount = input.discountAmount ?? 0
    const additionalChargesAmount = input.additionalChargesAmount ?? 0
    const estimatedTotal = calcEstimatedTotal(baseAmount, discountAmount, additionalChargesAmount, deliveryFee)
    const prepaymentAmount = calcPrepaymentAmount(baseAmount) // RM-BR-18/CR-2026-060

    const rental: Rental = {
      id: generateId('rt'),
      status: 'DRAFT', // CR-2026-043
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      pickupDateTime: input.pickupDateTime,
      expectedReturnDateTime: input.expectedReturnDateTime,
      pickupLocation: input.pickupLocation.trim(),
      returnLocation: input.returnLocation.trim(),
      vehicleClass: input.vehicleClass, // RM-BR-25 — snapshot
      pricePerKm,
      allowedKm,
      rentalRate: input.rentalRate,
      rentalDurationDays: durationDays,
      baseAmount,
      discountAmount,
      discountNote: input.discountNote?.trim() || undefined,
      additionalChargesAmount,
      additionalChargesNote: input.additionalChargesNote?.trim() || undefined,
      deliveryDistanceKm: input.deliveryDistanceKm,
      deliveryFee,
      estimatedTotal,
      prepaymentAmount,
      securityDepositType: input.securityDepositType,
      securityDepositAmount: input.securityDepositType === 'CASH_20M' ? CASH_DEPOSIT_AMOUNT : undefined,
      securityDepositAssetNote:
        input.securityDepositType === 'MOTORBIKE' ? input.securityDepositAssetNote?.trim() || undefined : undefined,
      note: input.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...readAll(), rental])
    appendAudit({
      action: 'CREATE_RENTAL',
      entity: 'Rental',
      entityId: rental.id,
      summary: `Tạo lượt thuê ${rental.id} (khách ${rental.customerId}, xe ${rental.vehicleId})`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: rental,
    })
    return rental
  })
}

/**
 * RM-BR-04/05/06/07 — re-validate với dữ liệu Customer/Vehicle mới nhất
 * (không phải dữ liệu lúc tạo), chặn cứng nếu không đạt (`canConfirm()`), đổi
 * status sang `CONFIRMED`.
 */
export async function confirm(id: string, actor: ActorInfo): Promise<Rental> {
  const all = readAll()
  const before = findOrThrow(all, id)
  const [vehicle, customer] = await Promise.all([getVehicleById(before.vehicleId), getCustomerById(before.customerId)])
  if (!vehicle) throw new Error('Không tìm thấy xe của lượt thuê này')
  if (!customer) throw new Error('Không tìm thấy khách hàng của lượt thuê này')

  return fakeRequest(() => {
    const result = canConfirm(before, customer, vehicle, all)
    if (!result.ok) throw new Error(result.reason)
    const after: Rental = { ...before, status: 'CONFIRMED', updatedAt: new Date().toISOString() }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'CONFIRM_RENTAL',
      entity: 'Rental',
      entityId: id,
      summary: `Xác nhận lượt thuê ${before.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CONFIRMED' },
    })
    return after
  })
}

/** `DRAFT`/`CONFIRMED → CANCELLED`, bắt buộc lý do — mẫu `ReasonDialog`. */
export async function cancel(id: string, reason: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canCancel(before)) {
      throw new Error(`Không thể huỷ lượt thuê đang ở trạng thái ${before.status}`)
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) throw new Error('Lý do huỷ lượt thuê là bắt buộc')
    const after: Rental = {
      ...before,
      status: 'CANCELLED',
      note: before.note ? `${before.note}\nLý do huỷ: ${trimmedReason}` : `Lý do huỷ: ${trimmedReason}`,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'CANCEL_RENTAL',
      entity: 'Rental',
      entityId: id,
      summary: `Huỷ lượt thuê ${before.id}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CANCELLED', reason: trimmedReason },
    })
    return after
  })
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §0.2/§9.3 — ngoại lệ kiến trúc có chủ
 * đích, chỉ `features/contracts` (`CT`) gọi hàm này (qua barrel `index.ts`)
 * sau khi ghi `Contract` `GENERATED` thành công. Mirror `confirm()`/`cancel()`.
 */
export async function markContractCreated(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canMarkContractCreated(before)) {
      throw new Error(`Không thể chuyển lượt thuê đang ở trạng thái ${before.status} sang Đã lập hợp đồng`)
    }
    const after: Rental = { ...before, status: 'CONTRACT_CREATED', updatedAt: new Date().toISOString() }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'MARK_CONTRACT_CREATED',
      entity: 'Rental',
      entityId: id,
      summary: `Lập hợp đồng cho lượt thuê ${before.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'CONTRACT_CREATED' },
    })
    return after
  })
}

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§9.2 — ngoại lệ kiến trúc có
 * chủ đích, chỉ `features/handover-return` (`VH`/`VR`) gọi hàm này (qua
 * barrel `index.ts`) sau khi ghi `HandoverRecord` `CANCELLED` thành công.
 * Xoá `actualPickupDateTime` (Round 1 chưa build lại field này khi giao xe
 * lại — nhân viên nhập lại từ đầu ở lần giao kế tiếp). Mirror `confirm()`/
 * `markContractCreated()`.
 */
export async function revertHandoverCancelled(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canCancelHandover(before)) {
      throw new Error(`Không thể hoàn tác lượt thuê đang ở trạng thái ${before.status} về Sẵn sàng giao xe`)
    }
    const after: Rental = {
      ...before,
      status: 'READY_FOR_HANDOVER',
      actualPickupDateTime: undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'REVERT_HANDOVER_CANCELLED',
      entity: 'Rental',
      entityId: id,
      summary: `Hoàn tác lượt thuê ${before.id} về Sẵn sàng giao xe (do Huỷ biên bản giao xe)`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'READY_FOR_HANDOVER' },
    })
    return after
  })
}

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.3/§9.2 — cùng ngoại lệ kiến
 * trúc, chỉ `features/handover-return` gọi sau khi ghi `ReturnRecord`
 * `CANCELLED` thành công. Xoá `actualReturnDateTime`.
 */
export async function revertReturnCancelled(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canCancelReturn(before)) {
      throw new Error(`Không thể hoàn tác lượt thuê đang ở trạng thái ${before.status} về Đang thuê`)
    }
    const after: Rental = {
      ...before,
      status: 'IN_RENTAL',
      actualReturnDateTime: undefined,
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'REVERT_RETURN_CANCELLED',
      entity: 'Rental',
      entityId: id,
      summary: `Hoàn tác lượt thuê ${before.id} về Đang thuê (do Huỷ biên bản trả xe)`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'IN_RENTAL' },
    })
    return after
  })
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §0.2/§3.8 — ngoại lệ kiến trúc có chủ đích,
 * round THỨ 3 (sau `contracts`, `handover-return`), chỉ `features/finance`
 * (`RS`) gọi hàm này (qua barrel `index.ts`) sau khi ghi `Settlement` `DRAFT`
 * thành công. Mirror `markContractCreated()`.
 */
export async function markSettlementOpened(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canOpenSettlement(before)) {
      throw new Error(`Không thể chuyển lượt thuê đang ở trạng thái ${before.status} sang Đang quyết toán`)
    }
    const after: Rental = { ...before, status: 'SETTLEMENT', updatedAt: new Date().toISOString() }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'MARK_RENTAL_SETTLEMENT',
      entity: 'Rental',
      entityId: id,
      summary: `Mở quyết toán cho lượt thuê ${before.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'SETTLEMENT' },
    })
    return after
  })
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §0.2/§3.8 — cùng ngoại lệ kiến trúc, chỉ
 * `features/finance` gọi sau khi ghi `Settlement` `COMPLETED` thành công
 * (UC-RS-13).
 */
export async function markRentalCompleted(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canCompleteRental(before)) {
      throw new Error(`Không thể chuyển lượt thuê đang ở trạng thái ${before.status} sang Hoàn tất`)
    }
    const after: Rental = { ...before, status: 'COMPLETED', updatedAt: new Date().toISOString() }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'COMPLETE_RENTAL',
      entity: 'Rental',
      entityId: id,
      summary: `Đóng lượt thuê ${before.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'COMPLETED' },
    })
    return after
  })
}

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §0.2/§10.5 — ngoại lệ kiến trúc có chủ đích,
 * cùng round thứ 3 (`features/finance`), mirror y hệt `markRentalCompleted()`.
 * Chỉ `features/finance` gọi (qua barrel `index.ts`) sau khi ghi `Settlement`
 * `DRAFT` (đảo quyết toán) thành công — UC-RS-16.
 */
export async function revertSettlementReversed(id: string, actor: ActorInfo): Promise<Rental> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canRevertSettlementReversed(before)) {
      throw new Error(`Không thể chuyển lượt thuê đang ở trạng thái ${before.status} về Đang quyết toán`)
    }
    const after: Rental = { ...before, status: 'SETTLEMENT', updatedAt: new Date().toISOString() }
    writeAll(all.map((r) => (r.id === id ? after : r)))
    appendAudit({
      action: 'REVERT_RENTAL_SETTLEMENT_REVERSED',
      entity: 'Rental',
      entityId: id,
      summary: `Đảo quyết toán — lượt thuê ${before.id} về Đang quyết toán`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'SETTLEMENT' },
    })
    return after
  })
}

// ---- Dời lịch / đổi xe trước giao — CALENDAR-ROUND3-PLAN.md §3.3 / §14.2 (UC-RC-06, UC-RC-07) ----

export interface RescheduleRentalInput {
  /** ISO hoặc giá trị `datetime-local` (hiểu theo +07). */
  pickupDateTime: string
  expectedReturnDateTime: string
  /** `rental.updatedAt` lúc người dùng mở hộp thoại — lệch thì từ chối (EX-03). */
  expectedUpdatedAt: string
  /** Bắt buộc khi có `BUFFER_VIOLATION` (RC-BR-13). */
  overrideReason?: string
}

export interface ChangeRentalVehicleInput {
  vehicleId: string
  /** Bỏ trống = giữ nguyên thời gian hiện tại. */
  pickupDateTime?: string
  expectedReturnDateTime?: string
  expectedUpdatedAt: string
  overrideReason?: string
}

export interface ScheduleChangeResult {
  rental: Rental
  /** Cảnh báo của lần kiểm tra cuối (đã được người dùng chấp nhận). */
  warnings: ScheduleIssue[]
  /** Phân công bị trùng lịch nhân viên sau khi dời giờ (EA-BR-10) — chỉ cảnh báo. */
  assignmentConflicts: { assignmentId: string; employeeId: string }[]
}

type ScheduleChangeKind = 'RESCHEDULE_RENTAL' | 'CHANGE_RENTAL_VEHICLE'

function assertScheduleEditable(all: Rental[], id: string, expectedUpdatedAt: string, actor: ActorInfo): Rental {
  if (!can(actor.role, 'RENTAL', 'EDIT')) throw new Error(vi.rentals.scheduleNoPermission)
  const rental = findOrThrow(all, id)
  // EX-03 — người khác đã sửa lượt thuê này kể từ lúc mở hộp thoại.
  if (rental.updatedAt !== expectedUpdatedAt) throw new Error(vi.rentals.scheduleStale)
  return rental
}

/**
 * Lõi chung của `rescheduleRental`/`changeRentalVehicle`. MỌI kiểm tra xong trước MỌI thao tác ghi (bài học N4): quyền → lượt tồn tại →
 * `updatedAt` → xe đích → khoá xe → `evaluateScheduleChange` (+ lý do ghi đè). Chỉ ghi 4 trường `pickupDateTime`/`expectedReturnDateTime`/
 * `vehicleId`/`updatedAt` — KHÔNG đụng trường snapshot nào (RC-BR-06, TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q2/Q3)).
 */
async function applyScheduleChange(
  kind: ScheduleChangeKind,
  id: string,
  change: {
    vehicleId?: string
    pickupDateTime?: string
    expectedReturnDateTime?: string
    expectedUpdatedAt: string
    overrideReason?: string
  },
  actor: ActorInfo,
): Promise<ScheduleChangeResult> {
  // Kiểm sớm để từ chối ngay không tốn độ trễ; được lặp lại với dữ liệu mới nhất trong `fakeRequest` bên dưới.
  const current = assertScheduleEditable(readAll(), id, change.expectedUpdatedAt, actor)
  const targetVehicleId = change.vehicleId ?? current.vehicleId
  const targetVehicle = await getVehicleById(targetVehicleId)
  if (!targetVehicle) throw new Error(vi.rentals.scheduleVehicleNotFound)

  const correlationId = generateId('corr')
  const done = await fakeRequest(() => {
    const all = readAll()
    const before = assertScheduleEditable(all, id, change.expectedUpdatedAt, actor)
    const vehicleBlocks = readJson<VehicleBlock[]>(VEHICLE_BLOCKS_STORAGE_KEY) ?? []
    const proposed = {
      vehicleId: targetVehicleId,
      pickupDateTime: change.pickupDateTime ?? before.pickupDateTime,
      expectedReturnDateTime: change.expectedReturnDateTime ?? before.expectedReturnDateTime,
    }
    const { errors, warnings } = evaluateScheduleChange({
      rental: before,
      proposed,
      rentals: all,
      targetVehicle,
      vehicleBlocks,
      now: new Date(),
    })
    if (errors.length > 0) throw new Error(errors.map((e) => vi.rentals.scheduleIssues[e.code]).join(' '))
    const overrideReason = change.overrideReason?.trim() ?? ''
    if (needsOverrideReason(warnings) && !overrideReason) throw new Error(vi.rentals.scheduleOverrideReasonRequired)

    // ---- Hết kiểm tra — từ đây mới ghi ----
    const pickupMs = dateTimeToMs(proposed.pickupDateTime)
    const returnMs = dateTimeToMs(proposed.expectedReturnDateTime)
    const after: Rental = {
      ...before,
      vehicleId: proposed.vehicleId,
      pickupDateTime: new Date(pickupMs).toISOString(),
      expectedReturnDateTime: new Date(returnMs).toISOString(),
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((r) => (r.id === id ? after : r)))

    const vehicleChanged = after.vehicleId !== before.vehicleId
    const pickupDeltaMs = pickupMs - dateTimeToMs(before.pickupDateTime)
    const returnDeltaMs = returnMs - dateTimeToMs(before.expectedReturnDateTime)
    const beforeFields: Record<string, string> = {}
    const afterFields: Record<string, unknown> = {}
    if (pickupDeltaMs !== 0) {
      beforeFields.pickupDateTime = before.pickupDateTime
      afterFields.pickupDateTime = after.pickupDateTime
    }
    if (returnDeltaMs !== 0) {
      beforeFields.expectedReturnDateTime = before.expectedReturnDateTime
      afterFields.expectedReturnDateTime = after.expectedReturnDateTime
    }
    if (vehicleChanged) {
      beforeFields.vehicleId = before.vehicleId
      afterFields.vehicleId = after.vehicleId
    }
    if (overrideReason) afterFields.overrideReason = overrideReason
    afterFields.warnings = warnings.map((w) => w.code)

    const summary =
      kind === 'RESCHEDULE_RENTAL'
        ? `Dời lịch lượt thuê ${id}: ${formatDateTime(before.pickupDateTime)} → ${formatDateTime(after.pickupDateTime)}`
        : vehicleChanged
          ? `Đổi xe lượt thuê ${id}: ${before.vehicleId} → ${after.vehicleId}`
          : `Đổi lịch lượt thuê ${id} (giữ nguyên xe)`
    appendAudit({
      action: kind,
      entity: 'Rental',
      entityId: id,
      summary,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: beforeFields,
      after: afterFields,
      correlationId,
      reason: overrideReason || undefined,
    })
    return { after, warnings, pickupDeltaMs, returnDeltaMs }
  })

  // EA-BR-14 — thời gian đổi thì dời Planned Window phân công `ASSIGNED`; đổi xe thuần tuý KHÔNG đổi phân công.
  let assignmentConflicts: ScheduleChangeResult['assignmentConflicts'] = []
  if (done.pickupDeltaMs !== 0 || done.returnDeltaMs !== 0) {
    const shifted = await shiftAssignmentWindowsForRental(
      id,
      { pickupDeltaMs: done.pickupDeltaMs, returnDeltaMs: done.returnDeltaMs },
      actor,
      correlationId,
    )
    assignmentConflicts = shifted.conflicts
  }
  return { rental: done.after, warnings: done.warnings, assignmentConflicts }
}

/** UC-RC-06 — dời lịch (giờ giao/trả) trên cùng xe. */
export async function rescheduleRental(
  id: string,
  input: RescheduleRentalInput,
  actor: ActorInfo,
): Promise<ScheduleChangeResult> {
  return applyScheduleChange('RESCHEDULE_RENTAL', id, input, actor)
}

/** UC-RC-07 — đổi sang xe khác (có thể kèm đổi giờ) trước khi giao. */
export async function changeRentalVehicle(
  id: string,
  input: ChangeRentalVehicleInput,
  actor: ActorInfo,
): Promise<ScheduleChangeResult> {
  return applyScheduleChange('CHANGE_RENTAL_VEHICLE', id, input, actor)
}

// RM-BR-15 — history không xoá: không có remove() (Cancel chỉ đổi status).
