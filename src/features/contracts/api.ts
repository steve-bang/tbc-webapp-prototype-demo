import { getById as getCustomerById } from '@/features/customers/api'
import { canMarkContractCreated, markContractCreated } from '@/features/rentals'
// `rentals` chưa export `getById` qua barrel `index.ts` nên import thẳng từ
// `api.ts` của feature đó — cùng tinh thần `rentals/api.ts` import thẳng
// `customers/api.ts`/`vehicles/api.ts` (`CONVENTIONS.md` §3 đã có tiền lệ này
// cho lớp `api.ts`/`hooks.ts`, không áp dụng cho `screens/`).
import { getById as getRentalById } from '@/features/rentals/api'
import { getById as getVehicleById } from '@/features/vehicles/api'
import type { ContractStatus, Role } from '@/shared/domain/enums'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import { canMarkSigned, canVoid, COMPANY_NAME, generateContractCode, type Contract, type ContractAddendum } from './model'

export const CONTRACTS_STORAGE_KEY = 'contracts'
export const CONTRACT_ADDENDUMS_STORAGE_KEY = 'contract_addendums'

/** Người thực hiện thao tác — dùng để ghi audit (CT-BR-15). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readAll(): Contract[] {
  return readJson<Contract[]>(CONTRACTS_STORAGE_KEY) ?? []
}

function writeAll(items: Contract[]): void {
  writeJson(CONTRACTS_STORAGE_KEY, items)
}

function readAddendums(): ContractAddendum[] {
  return readJson<ContractAddendum[]>(CONTRACT_ADDENDUMS_STORAGE_KEY) ?? []
}

function findOrThrow(items: Contract[], id: string): Contract {
  const found = items.find((c) => c.id === id)
  if (!found) throw new Error('Không tìm thấy hợp đồng')
  return found
}

export interface ContractFilter {
  status?: ContractStatus
  rentalId?: string
}

function matches(contract: Contract, filter?: ContractFilter): boolean {
  if (!filter) return true
  if (filter.status && contract.status !== filter.status) return false
  if (filter.rentalId && contract.rentalId !== filter.rentalId) return false
  return true
}

export async function list(filter?: ContractFilter): Promise<Contract[]> {
  return fakeRequest(() => readAll().filter((c) => matches(c, filter)))
}

export async function getById(id: string): Promise<Contract | undefined> {
  return fakeRequest(() => readAll().find((c) => c.id === id))
}

export interface ContractCreateInput {
  rentalId: string
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §9.1 — 5 bước tuần tự: (1) lấy
 * Rental+Customer+Vehicle, (2) `canMarkContractCreated()` trước khi ghi (tránh
 * tạo Contract mồ côi nếu Rental không hợp lệ — CT-BR-06 mức đơn giản), (3)
 * CT-BR-01 (chưa có Contract nào khác cho `rentalId`), (4) tạo Contract
 * `GENERATED` (CT-BR-07 — snapshot chốt, CT-BR-09 — mã không tái dùng), (5)
 * gọi `markContractCreated()` (`@/features/rentals`, ngoại lệ kiến trúc được
 * phép ở Round 1 — kế hoạch §0.2) để chuyển Rental. Giới hạn demo fake-API:
 * không có transaction thật xuyên 2 storage key — nếu bước 5 lỗi, Contract đã
 * ghi ở bước 4 vẫn tồn tại (chấp nhận được ở bản demo, không có backend thật).
 */
export async function create(input: ContractCreateInput, actor: ActorInfo): Promise<Contract> {
  const rental = await getRentalById(input.rentalId)
  if (!rental) throw new Error('Không tìm thấy lượt thuê')
  const [customer, vehicle] = await Promise.all([getCustomerById(rental.customerId), getVehicleById(rental.vehicleId)])
  if (!customer) throw new Error('Không tìm thấy khách hàng của lượt thuê này')
  if (!vehicle) throw new Error('Không tìm thấy xe của lượt thuê này')
  if (!canMarkContractCreated(rental)) {
    throw new Error(`Không thể sinh hợp đồng cho lượt thuê đang ở trạng thái ${rental.status}.`)
  }

  const contract = await fakeRequest(() => {
    const all = readAll()
    if (all.some((c) => c.rentalId === rental.id)) {
      throw new Error('Lượt thuê này đã có hợp đồng (CT-BR-01).')
    }
    const now = new Date().toISOString()
    const created: Contract = {
      id: generateId('ct'),
      contractCode: generateContractCode(all.length),
      version: 1,
      rentalId: rental.id,
      status: 'GENERATED',
      snapshotCompanyName: COMPANY_NAME,
      snapshotCustomerName: customer.fullName,
      snapshotCustomerIdNumber: customer.idNumber,
      snapshotCustomerPhone: customer.phone,
      snapshotCustomerAddress: customer.address,
      snapshotVehiclePlate: vehicle.plate,
      snapshotVehicleBrand: vehicle.brand,
      snapshotVehicleModel: vehicle.model,
      snapshotPickupDateTime: rental.pickupDateTime,
      snapshotExpectedReturnDateTime: rental.expectedReturnDateTime,
      snapshotPickupLocation: rental.pickupLocation,
      snapshotReturnLocation: rental.returnLocation,
      snapshotRentalRate: rental.rentalRate,
      snapshotRentalDurationDays: rental.rentalDurationDays,
      snapshotBaseAmount: rental.baseAmount,
      snapshotDiscountAmount: rental.discountAmount,
      snapshotEstimatedTotal: rental.estimatedTotal,
      snapshotPrepaymentAmount: rental.prepaymentAmount,
      snapshotAllowedKm: rental.allowedKm,
      snapshotPricePerKm: rental.pricePerKm,
      snapshotSecurityDepositType: rental.securityDepositType,
      snapshotSecurityDepositAmount: rental.securityDepositAmount,
      createdAt: now,
      updatedAt: now,
    }
    writeAll([...all, created])
    appendAudit({
      action: 'CREATE_CONTRACT',
      entity: 'Contract',
      entityId: created.id,
      summary: `Sinh hợp đồng ${created.contractCode} từ lượt thuê ${rental.id}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      after: created,
    })
    return created
  })

  await markContractCreated(rental.id, actor)

  return contract
}

export interface ContractSignInput {
  signedCopyFileName: string
  signedDate: string
  signedByCompany: string
  signedByCustomer: string
}

/** `GENERATED -> SIGNED`, giả lập "Tải lên bản ký" (kế hoạch §1.1 mục 4) — không upload file thật. */
export async function markSigned(id: string, input: ContractSignInput, actor: ActorInfo): Promise<Contract> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canMarkSigned(before)) {
      throw new Error(`Không thể ghi nhận bản ký cho hợp đồng đang ở trạng thái ${before.status}`)
    }
    const after: Contract = {
      ...before,
      status: 'SIGNED',
      signedCopyFileName: input.signedCopyFileName.trim(),
      signedDate: input.signedDate,
      signedByCompany: input.signedByCompany.trim(),
      signedByCustomer: input.signedByCustomer.trim(),
      updatedAt: new Date().toISOString(),
    }
    writeAll(all.map((c) => (c.id === id ? after : c)))
    appendAudit({
      action: 'SET_CONTRACT_SIGNED',
      entity: 'Contract',
      entityId: id,
      summary: `Ghi nhận bản ký cho hợp đồng ${before.contractCode}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'SIGNED' },
    })
    return after
  })
}

/** CT-BR-05/UC-CT-13 — `GENERATED`/`SIGNED -> VOID`, bắt buộc lý do, chỉ `SYSTEM_ADMIN` (gate ở UI qua `permissions.ts`). */
export async function voidContract(id: string, reason: string, actor: ActorInfo): Promise<Contract> {
  return fakeRequest(() => {
    const all = readAll()
    const before = findOrThrow(all, id)
    if (!canVoid(before)) {
      throw new Error(`Không thể huỷ hợp đồng đang ở trạng thái ${before.status}`)
    }
    const trimmedReason = reason.trim()
    if (!trimmedReason) throw new Error('Lý do huỷ hợp đồng là bắt buộc')
    const now = new Date().toISOString()
    const after: Contract = {
      ...before,
      status: 'VOID',
      voidReason: trimmedReason,
      voidedAt: now,
      voidedByUserId: actor.userId,
      voidedByName: actor.fullName,
      voidedByRole: actor.role,
      updatedAt: now,
    }
    writeAll(all.map((c) => (c.id === id ? after : c)))
    appendAudit({
      action: 'VOID_CONTRACT',
      entity: 'Contract',
      entityId: id,
      summary: `Huỷ hợp đồng ${before.contractCode}: ${trimmedReason}`,
      actorUserId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      before: { status: before.status },
      after: { status: 'VOID', reason: trimmedReason },
    })
    return after
  })
}

// ---- ContractAddendum — kế hoạch §1.2/§7: chỉ seed + đọc, không có form tạo. ----

export interface ContractAddendumFilter {
  contractId?: string
}

export async function listAddendums(filter?: ContractAddendumFilter): Promise<ContractAddendum[]> {
  return fakeRequest(() => readAddendums().filter((a) => !filter?.contractId || a.contractId === filter.contractId))
}
