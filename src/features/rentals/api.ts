import { getById as getCustomerById } from '@/features/customers/api'
// Rental cần Customer/Vehicle đầy đủ (không chỉ id) để chạy `canConfirm()`
// (RM-BR-05/06/07) ngay trong lớp api — `vehicles`/`customers` chưa export
// `getById` qua barrel `index.ts` nên import thẳng từ `api.ts` của feature đó,
// cùng tinh thần `maintenance/hooks.ts` import thẳng `vehicles/hooks.ts`.
import { getById as getVehicleById } from '@/features/vehicles/api'
import type { RentalStatus, Role, SecurityDepositType, VehicleClass } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
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
  canConfirm,
  canMarkContractCreated,
  rentalDurationDays,
  type Rental,
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
  const pickupDate = rental.pickupDateTime.slice(0, 10)
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

// RM-BR-15 — history không xoá: không có remove() (Cancel chỉ đổi status).
