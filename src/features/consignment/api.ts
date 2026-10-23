import { VEHICLES_STORAGE_KEY } from '@/features/vehicles/api'
import type { Vehicle } from '@/features/vehicles'
import type { AuditAction, ConsignmentContractStatus, OwnerType, Role } from '@/shared/domain/enums'
import { can } from '@/shared/domain/permissions'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS } from '@/shared/i18n/vi'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  buildTermsSnapshot,
  canActivate,
  canTransition,
  findEffectiveContractForVehicle,
  findOpenContractForVehicle,
  maskAccountNumber,
  nextSequenceCode,
  toLocalDateKey,
  toOwnerAuditSnapshot,
  vehicleOwnerFormSchema,
  type ConsignmentContract,
  type ConsignmentExploitationRights,
  type ConsignmentHandoverRecord,
  type ConsignmentPaymentTerm,
  type ConsignmentStatusChange,
  type OwnerBankAccount,
  type VehicleOwner,
  type VehicleOwnerFormValues,
} from './model'

/**
 * Lớp dữ liệu "fake API" của Xe ký gửi (`docs/CONSIGNMENT-PLAN.md` mục 6).
 *
 * - Mọi đọc, guard và ghi nằm TRONG callback `fakeRequest` (không đọc storage trước rồi ghi sau độ trễ).
 * - Mọi hàm ghi gọi `appendAudit` (VC-BR-17); payload hồ sơ chủ xe luôn đi qua `toOwnerAuditSnapshot` (che dữ liệu).
 * - Không có hàm `remove` (VC-BR-18): hồ sơ chủ xe và hợp đồng chỉ đổi trạng thái.
 * - Bản prototype: dữ liệu nằm ở localStorage nên API vẫn trả số tài khoản đầy đủ; backend thật phải che ở tầng API
 *   (`docs/ARCHITECTURE.md`) và chỉ trả số đầy đủ qua `revealOwnerBankAccount`.
 * - Quy ước kiểm quyền ở UI, ngoại lệ DUY NHẤT là `revealOwnerBankAccount` (dữ liệu nhạy cảm — BRD mục 21).
 */

export const VEHICLE_OWNERS_STORAGE_KEY = 'vehicleOwners'
export const CONSIGNMENT_CONTRACTS_STORAGE_KEY = 'consignmentContracts'
export const CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY = 'consignmentHandoverRecords'

/** Người thực hiện thao tác — dùng để ghi audit (VC-BR-17). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}

function readOwners(): VehicleOwner[] {
  return readJson<VehicleOwner[]>(VEHICLE_OWNERS_STORAGE_KEY) ?? []
}
function writeOwners(items: VehicleOwner[]): void {
  writeJson(VEHICLE_OWNERS_STORAGE_KEY, items)
}
function readContracts(): ConsignmentContract[] {
  return readJson<ConsignmentContract[]>(CONSIGNMENT_CONTRACTS_STORAGE_KEY) ?? []
}
function writeContracts(items: ConsignmentContract[]): void {
  writeJson(CONSIGNMENT_CONTRACTS_STORAGE_KEY, items)
}
function readRecords(): ConsignmentHandoverRecord[] {
  return readJson<ConsignmentHandoverRecord[]>(CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY) ?? []
}
function writeRecords(items: ConsignmentHandoverRecord[]): void {
  writeJson(CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY, items)
}
function readVehicles(): Vehicle[] {
  return readJson<Vehicle[]>(VEHICLES_STORAGE_KEY) ?? []
}

function findOwnerOrThrow(items: VehicleOwner[], id: string): VehicleOwner {
  const found = items.find((o) => o.id === id)
  if (!found) throw new Error('Không tìm thấy hồ sơ chủ xe')
  return found
}
function findContractOrThrow(items: ConsignmentContract[], id: string): ConsignmentContract {
  const found = items.find((c) => c.id === id)
  if (!found) throw new Error('Không tìm thấy hợp đồng ký gửi')
  return found
}

function audit(
  actor: ActorInfo,
  action: AuditAction,
  entity: 'VehicleOwner' | 'ConsignmentContract' | 'ConsignmentHandoverRecord',
  entityId: string,
  summary: string,
  before?: unknown,
  after?: unknown,
): void {
  appendAudit({
    action,
    entity,
    entityId,
    summary,
    actorUserId: actor.userId,
    actorName: actor.fullName,
    actorRole: actor.role,
    before,
    after,
  })
}

function requireReason(reason: string): string {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error('Lý do là bắt buộc (tối thiểu 3 ký tự)')
  return trimmed
}

function appendHistory(
  contract: ConsignmentContract,
  to: ConsignmentContractStatus,
  at: string,
  actor: ActorInfo,
  reason?: string,
): ConsignmentStatusChange[] {
  return [...contract.statusHistory, { from: contract.status, to, at, byName: actor.fullName, reason }]
}

// ============================================================================
// Hồ sơ chủ xe
// ============================================================================

export interface VehicleOwnerFilter {
  search?: string
  ownerType?: OwnerType
}

export async function listVehicleOwners(filter?: VehicleOwnerFilter): Promise<VehicleOwner[]> {
  return fakeRequest(() => {
    const q = filter?.search?.trim().toLowerCase() ?? ''
    return readOwners()
      .filter((o) => !filter?.ownerType || o.ownerType === filter.ownerType)
      .filter((o) => {
        if (!q) return true
        return [o.fullName, o.phone, o.idNumber ?? '', o.taxCode ?? '', o.code].join(' ').toLowerCase().includes(q)
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  })
}

export async function getVehicleOwner(id: string): Promise<VehicleOwner | undefined> {
  return fakeRequest(() => readOwners().find((o) => o.id === id))
}

export type VehicleOwnerInput = VehicleOwnerFormValues

/** Chuẩn hoá theo `ownerType` (plan mục 2.1) + gộp tài khoản ngân hàng với bản cũ khi sửa. */
function buildOwnerFields(
  input: VehicleOwnerInput,
  existing?: VehicleOwner,
): Omit<VehicleOwner, 'id' | 'code' | 'createdByName' | 'createdAt' | 'updatedAt'> {
  const parsed = vehicleOwnerFormSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Dữ liệu chủ xe không hợp lệ')
  const v = parsed.data
  const isIndividual = v.ownerType === 'INDIVIDUAL'

  // Ô số tài khoản để trống khi sửa = giữ số cũ (UC bảo mật BRD mục 21: form không điền sẵn số đầy đủ).
  const accountNumber = v.bankAccountNumber || existing?.bankAccount?.accountNumber
  const hasAnyBank = !!(accountNumber || v.bankName || v.bankAccountHolder)
  let bankAccount: OwnerBankAccount | undefined
  if (hasAnyBank) {
    if (!accountNumber || !v.bankName || !v.bankAccountHolder) {
      throw new Error('Tài khoản ngân hàng cần nhập đủ số tài khoản, ngân hàng và chủ tài khoản')
    }
    bankAccount = { accountNumber, bankName: v.bankName, accountHolder: v.bankAccountHolder }
  }

  return {
    ownerType: v.ownerType,
    fullName: v.fullName,
    idNumber: isIndividual ? v.idNumber || undefined : undefined,
    taxCode: isIndividual ? undefined : v.taxCode || undefined,
    // CR-2026-027/051: Ngày sinh + Giới tính chỉ áp dụng cho chủ xe cá nhân, tuỳ chọn.
    dateOfBirth: isIndividual ? v.dateOfBirth || undefined : undefined,
    gender: isIndividual ? v.gender : undefined,
    address: v.address || undefined,
    email: v.email || undefined,
    phone: v.phone,
    bankAccount,
    note: v.note || undefined,
  }
}

export async function createVehicleOwner(input: VehicleOwnerInput, actor: ActorInfo): Promise<VehicleOwner> {
  return fakeRequest(() => {
    const all = readOwners()
    const fields = buildOwnerFields(input)
    const now = new Date().toISOString()
    const created: VehicleOwner = {
      ...fields,
      id: generateId('own'),
      code: nextSequenceCode(
        'CX',
        all.map((o) => o.code),
      ),
      createdByName: actor.fullName,
      createdAt: now,
      updatedAt: now,
    }
    writeOwners([...all, created])
    audit(
      actor,
      'CREATE_VEHICLE_OWNER',
      'VehicleOwner',
      created.id,
      `Tạo hồ sơ chủ xe ${created.code} — ${created.fullName}`,
      undefined,
      toOwnerAuditSnapshot(created),
    )
    return created
  })
}

export async function updateVehicleOwner(id: string, input: VehicleOwnerInput, actor: ActorInfo): Promise<VehicleOwner> {
  return fakeRequest(() => {
    const all = readOwners()
    const before = findOwnerOrThrow(all, id)
    const after: VehicleOwner = { ...before, ...buildOwnerFields(input, before), updatedAt: new Date().toISOString() }
    writeOwners(all.map((o) => (o.id === id ? after : o)))
    audit(
      actor,
      'UPDATE_VEHICLE_OWNER',
      'VehicleOwner',
      id,
      `Cập nhật hồ sơ chủ xe ${before.code} — ${after.fullName}`,
      toOwnerAuditSnapshot(before),
      toOwnerAuditSnapshot(after),
    )
    return after
  })
}

/**
 * BRD mục 21 / UC nhật ký — xem đầy đủ số tài khoản: người có `CONSIGNMENT.CREATE` hoặc `CONSIGNMENT.CONFIRM`.
 * Ghi meta-audit mỗi lần xem, payload KHÔNG chứa số tài khoản. Đây là hàm duy nhất kiểm quyền ở tầng API.
 * TODO(OQ: VehicleConsignment-BRD.md mục 21 — vai trò được xem đầy đủ chưa nêu rõ; BA đề xuất CREATE hoặc CONFIRM)
 */
export async function revealOwnerBankAccount(id: string, actor: ActorInfo): Promise<string> {
  return fakeRequest(() => {
    if (!can(actor.role, 'CONSIGNMENT', 'CREATE') && !can(actor.role, 'CONSIGNMENT', 'CONFIRM')) {
      throw new Error('Bạn không có quyền xem đầy đủ số tài khoản')
    }
    const owner = findOwnerOrThrow(readOwners(), id)
    if (!owner.bankAccount) throw new Error('Chủ xe này chưa có tài khoản ngân hàng')
    audit(
      actor,
      'VIEW_OWNER_BANK_ACCOUNT',
      'VehicleOwner',
      id,
      `Xem đầy đủ số tài khoản của chủ xe ${owner.code}`,
      undefined,
      { bankName: owner.bankAccount.bankName, accountNumber: maskAccountNumber(owner.bankAccount.accountNumber) },
    )
    return owner.bankAccount.accountNumber
  })
}

// ============================================================================
// Hợp đồng ký gửi
// ============================================================================

export interface ConsignmentContractFilter {
  status?: ConsignmentContractStatus
  ownerId?: string
  vehicleId?: string
  search?: string
}

export async function listConsignmentContracts(filter?: ConsignmentContractFilter): Promise<ConsignmentContract[]> {
  return fakeRequest(() => {
    const owners = readOwners()
    const vehicles = readVehicles()
    const q = filter?.search?.trim().toLowerCase() ?? ''
    return readContracts()
      .filter((c) => !filter?.status || c.status === filter.status)
      .filter((c) => !filter?.ownerId || c.ownerId === filter.ownerId)
      .filter((c) => !filter?.vehicleId || c.vehicleId === filter.vehicleId)
      .filter((c) => {
        if (!q) return true
        const plate = vehicles.find((v) => v.id === c.vehicleId)?.plate ?? ''
        const ownerName = owners.find((o) => o.id === c.ownerId)?.fullName ?? ''
        return [c.contractNo, plate, ownerName].join(' ').toLowerCase().includes(q)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  })
}

export async function getConsignmentContract(id: string): Promise<ConsignmentContract | undefined> {
  return fakeRequest(() => readContracts().find((c) => c.id === id))
}

export interface ConsignmentContractInput {
  effectiveFrom: string
  effectiveTo: string
  noticePeriodDays: number
  autoRenew: boolean
  paymentTerm: Pick<ConsignmentPaymentTerm, 'fixedMonthlyAmount' | 'paymentDay' | 'prorationRule'>
  exploitationRights: ConsignmentExploitationRights
  note?: string
}

export interface ConsignmentContractCreateInput extends ConsignmentContractInput {
  ownerId: string
  vehicleId: string
}

function assertContractInput(input: ConsignmentContractInput): void {
  if (!input.effectiveFrom || !input.effectiveTo || input.effectiveTo <= input.effectiveFrom) {
    throw new Error('Ngày kết thúc hiệu lực phải sau ngày bắt đầu')
  }
  if (!Number.isInteger(input.noticePeriodDays) || input.noticePeriodDays < 0) {
    throw new Error('Thời gian báo trước phải là số nguyên không âm')
  }
  const { fixedMonthlyAmount, paymentDay } = input.paymentTerm
  if (!Number.isInteger(fixedMonthlyAmount) || fixedMonthlyAmount <= 0) {
    throw new Error('Mức chi trả hàng tháng phải là số nguyên lớn hơn 0')
  }
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
    throw new Error('Ngày chi trả phải từ 1 đến 31')
  }
}

function buildPaymentTerm(input: ConsignmentContractInput): ConsignmentPaymentTerm {
  // CR-2026-050 — chỉ một mô hình FIXED_MONTHLY.
  return { model: 'FIXED_MONTHLY', ...input.paymentTerm }
}

export async function createConsignmentContract(
  input: ConsignmentContractCreateInput,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const owners = readOwners()
    const all = readContracts()
    const owner = findOwnerOrThrow(owners, input.ownerId)
    const vehicle = readVehicles().find((v) => v.id === input.vehicleId)
    if (!vehicle) throw new Error('Không tìm thấy xe')
    if (vehicle.ownershipType !== 'CONSIGNED') {
      throw new Error('Chỉ lập hợp đồng cho xe có hình thức sở hữu "Ký gửi"')
    }
    // BA đề xuất — chặn hợp đồng mở thứ hai cho cùng xe (kế hoạch mục 0.3 điểm 3); muốn đổi thì dùng "Thay bằng bản mới".
    // VC-BR-01 — một xe chỉ thuộc một hợp đồng ở trạng thái hiệu lực tại một thời điểm.
    const open = findOpenContractForVehicle(all, vehicle.id)
    if (open) {
      throw new Error(`Xe ${vehicle.plate} đã có hợp đồng ${open.contractNo} đang mở (VC-BR-01) — hãy dùng "Thay bằng bản mới"`)
    }
    assertContractInput(input)

    const now = new Date().toISOString()
    const created: ConsignmentContract = {
      id: generateId('cg'),
      contractNo: nextSequenceCode(
        'HDKG',
        all.map((c) => c.contractNo),
      ),
      ownerId: owner.id,
      vehicleId: vehicle.id,
      status: 'DRAFT',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      noticePeriodDays: input.noticePeriodDays,
      autoRenew: input.autoRenew,
      paymentTerm: buildPaymentTerm(input),
      exploitationRights: input.exploitationRights,
      termVersions: [],
      statusHistory: [{ to: 'DRAFT', at: now, byName: actor.fullName }],
      note: input.note || undefined,
      createdByName: actor.fullName,
      createdAt: now,
      updatedAt: now,
    }
    writeContracts([...all, created])
    audit(
      actor,
      'CREATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      created.id,
      `Tạo hợp đồng ký gửi ${created.contractNo} cho xe ${vehicle.plate} (chủ xe ${owner.code})`,
      undefined,
      created,
    )
    return created
  })
}

const TRACKED_CONTRACT_FIELDS = [
  'effectiveFrom',
  'effectiveTo',
  'noticePeriodDays',
  'autoRenew',
  'paymentTerm',
  'exploitationRights',
  'note',
] as const

export async function updateConsignmentContract(
  id: string,
  input: ConsignmentContractInput,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    // UC-VC-05 — chỉ sửa điều khoản khi còn nháp; sau ký đổi qua phụ lục (VC-BR-05).
    if (before.status !== 'DRAFT') throw new Error('Chỉ sửa được hợp đồng khi còn ở trạng thái Nháp')
    assertContractInput(input)
    const after: ConsignmentContract = {
      ...before,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      noticePeriodDays: input.noticePeriodDays,
      autoRenew: input.autoRenew,
      paymentTerm: buildPaymentTerm(input),
      exploitationRights: input.exploitationRights,
      note: input.note || undefined,
      updatedAt: new Date().toISOString(),
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    const changedBefore: Record<string, unknown> = {}
    const changedAfter: Record<string, unknown> = {}
    for (const key of TRACKED_CONTRACT_FIELDS) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changedBefore[key] = before[key]
        changedAfter[key] = after[key]
      }
    }
    audit(
      actor,
      'UPDATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Cập nhật hợp đồng ký gửi ${before.contractNo}`,
      changedBefore,
      changedAfter,
    )
    return after
  })
}

export async function submitConsignmentContract(id: string, actor: ActorInfo): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'DRAFT' || !canTransition(before.status, 'PENDING_APPROVAL')) {
      throw new Error(`Không thể trình duyệt hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    }
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'PENDING_APPROVAL',
      statusHistory: appendHistory(before, 'PENDING_APPROVAL', now, actor),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(actor, 'SUBMIT_CONSIGNMENT_CONTRACT', 'ConsignmentContract', id, `Trình duyệt hợp đồng ký gửi ${before.contractNo}`, {
      status: before.status,
    }, { status: after.status })
    return after
  })
}

export async function returnConsignmentContractToDraft(
  id: string,
  reason: string,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'PENDING_APPROVAL') {
      throw new Error(`Không thể trả về nháp hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    }
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'DRAFT',
      statusHistory: appendHistory(before, 'DRAFT', now, actor, trimmed),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'RETURN_CONSIGNMENT_CONTRACT_TO_DRAFT',
      'ConsignmentContract',
      id,
      `Trả hợp đồng ký gửi ${before.contractNo} về bản nháp: ${trimmed}`,
      { status: before.status },
      { status: after.status, reason: trimmed },
    )
    return after
  })
}

/** Duyệt = xác nhận đã ký (state machine đi thẳng `PENDING_APPROVAL → SIGNED`): chốt `termsSnapshot` + `termVersions[0]` (VC-BR-05). */
export async function signConsignmentContract(
  id: string,
  input: { signedFileName: string },
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'PENDING_APPROVAL') {
      throw new Error(`Không thể duyệt hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    }
    const fileName = input.signedFileName.trim()
    if (!fileName) throw new Error('Tên file bản scan là bắt buộc')
    // VC-BR-01 — xe không được có hợp đồng hiệu lực khác.
    const other = findEffectiveContractForVehicle(all, before.vehicleId, id)
    if (other) throw new Error(`Xe đã có hợp đồng ${other.contractNo} đang hiệu lực (VC-BR-01)`)
    const owner = findOwnerOrThrow(readOwners(), before.ownerId)
    const vehicle = readVehicles().find((v) => v.id === before.vehicleId)
    if (!vehicle) throw new Error('Không tìm thấy xe')

    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'SIGNED',
      termsSnapshot: buildTermsSnapshot(before, owner, vehicle, now),
      termVersions: [
        {
          versionNo: 1,
          effectiveFrom: before.effectiveFrom,
          paymentTerm: { ...before.paymentTerm },
          source: 'ORIGINAL',
          createdAt: now,
        },
      ],
      signedCopy: { fileName, uploadedByName: actor.fullName, uploadedAt: now },
      statusHistory: appendHistory(before, 'SIGNED', now, actor),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'SIGN_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Duyệt và xác nhận đã ký hợp đồng ký gửi ${before.contractNo} (bản scan ${fileName})`,
      { status: before.status },
      { status: after.status, signedFileName: fileName },
    )
    return after
  })
}

export interface ConsignmentIntakeInput {
  handoverAt: string
  odoKm: number
  fuelLevel: number
  baselineCondition: string
  checklist: ConsignmentHandoverRecord['checklist']
  accessories: string[]
  documentsReceived: ConsignmentHandoverRecord['documentsReceived']
  missingDocumentsNote?: string
  mediaNote?: string
  appraisedValue: number
  companyRepName: string
  ownerConfirmed: boolean
  companyConfirmed: boolean
}

export async function recordConsignmentIntake(
  contractId: string,
  input: ConsignmentIntakeInput,
  actor: ActorInfo,
): Promise<ConsignmentHandoverRecord> {
  return fakeRequest(() => {
    const contracts = readContracts()
    const records = readRecords()
    const contract = findContractOrThrow(contracts, contractId)
    if (contract.status !== 'SIGNED') throw new Error('Chỉ lập biên bản nhận xe khi hợp đồng đã ký (Đã ký)')
    if (records.some((r) => r.contractId === contractId && r.type === 'INTAKE')) {
      throw new Error('Hợp đồng này đã có biên bản nhận xe')
    }
    // VC-BR-15 — biên bản phải được cả hai bên xác nhận.
    if (!input.ownerConfirmed || !input.companyConfirmed) {
      throw new Error('Biên bản cần được cả chủ xe và đại diện công ty xác nhận (VC-BR-15)')
    }
    // VC-BR-16 — Appraised Value bắt buộc khi nhận xe.
    if (!Number.isInteger(input.appraisedValue) || input.appraisedValue <= 0) {
      throw new Error('Giá trị định giá phải là số nguyên lớn hơn 0 (VC-BR-16)')
    }
    if (!Number.isInteger(input.odoKm) || input.odoKm < 0) throw new Error('Odo phải là số nguyên không âm')
    if (!Number.isFinite(input.fuelLevel) || input.fuelLevel < 0 || input.fuelLevel > 100) {
      throw new Error('Mức nhiên liệu phải từ 0 đến 100')
    }
    if (!input.baselineCondition.trim()) throw new Error('Mô tả hiện trạng là bắt buộc')

    const now = new Date().toISOString()
    const record: ConsignmentHandoverRecord = {
      id: generateId('cgh'),
      code: nextSequenceCode(
        'BBKG',
        records.map((r) => r.code),
      ),
      type: 'INTAKE',
      contractId: contract.id,
      vehicleId: contract.vehicleId,
      ownerId: contract.ownerId,
      handoverAt: input.handoverAt,
      odoKm: input.odoKm,
      fuelLevel: input.fuelLevel,
      baselineCondition: input.baselineCondition.trim(),
      checklist: input.checklist,
      accessories: input.accessories,
      documentsReceived: input.documentsReceived,
      missingDocumentsNote: input.missingDocumentsNote || undefined,
      mediaNote: input.mediaNote || undefined,
      appraisedValue: input.appraisedValue,
      companyRepName: input.companyRepName.trim(),
      ownerConfirmed: input.ownerConfirmed,
      companyConfirmed: input.companyConfirmed,
      createdByName: actor.fullName,
      createdAt: now,
    }
    writeRecords([...records, record])
    writeContracts(contracts.map((c) => (c.id === contractId ? { ...c, intakeRecordId: record.id, updatedAt: now } : c)))
    audit(
      actor,
      'CREATE_CONSIGNMENT_INTAKE',
      'ConsignmentHandoverRecord',
      record.id,
      `Lập biên bản nhận xe ${record.code} cho hợp đồng ${contract.contractNo}`,
      undefined,
      record,
    )
    return record
  })
}

export async function activateConsignmentContract(id: string, actor: ActorInfo): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'SIGNED') throw new Error(`Không thể kích hoạt hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    const intake = readRecords().find((r) => r.contractId === id && r.type === 'INTAKE')
    // VC-BR-02 / AC-VC-001 — chỉ kích hoạt khi đã có biên bản nhận xe hoàn tất.
    if (!canActivate(before, intake)) {
      throw new Error('Chưa có biên bản nhận xe — không thể kích hoạt hợp đồng (VC-BR-02)')
    }
    // VC-BR-01 — không có hợp đồng hiệu lực khác cho xe.
    const other = findEffectiveContractForVehicle(all, before.vehicleId, id)
    if (other) throw new Error(`Xe đã có hợp đồng ${other.contractNo} đang hiệu lực (VC-BR-01)`)
    if (toLocalDateKey(new Date()) > before.effectiveTo) {
      throw new Error('Hợp đồng đã quá ngày hết hiệu lực — không thể kích hoạt')
    }
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'ACTIVE',
      activatedAt: now,
      statusHistory: appendHistory(before, 'ACTIVE', now, actor),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'ACTIVATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Kích hoạt hợp đồng ký gửi ${before.contractNo}`,
      { status: before.status },
      { status: after.status },
    )
    return after
  })
}

export async function suspendConsignmentContract(
  id: string,
  reason: string,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'ACTIVE') throw new Error(`Không thể tạm ngưng hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'SUSPENDED',
      statusHistory: appendHistory(before, 'SUSPENDED', now, actor, trimmed),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'SUSPEND_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Tạm ngưng hợp đồng ký gửi ${before.contractNo}: ${trimmed}`,
      { status: before.status },
      { status: after.status, reason: trimmed },
    )
    return after
  })
}

export async function resumeConsignmentContract(
  id: string,
  reason: string,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (before.status !== 'SUSPENDED') throw new Error(`Không thể khôi phục hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    const trimmed = requireReason(reason)
    // VC-BR-01 — khôi phục không được tạo ra hai hợp đồng hiệu lực cho cùng xe.
    const other = findEffectiveContractForVehicle(all, before.vehicleId, id)
    if (other) throw new Error(`Xe đã có hợp đồng ${other.contractNo} đang hiệu lực (VC-BR-01)`)
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'ACTIVE',
      statusHistory: appendHistory(before, 'ACTIVE', now, actor, trimmed),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'RESUME_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Khôi phục hợp đồng ký gửi ${before.contractNo}: ${trimmed}`,
      { status: before.status },
      { status: after.status, reason: trimmed },
    )
    return after
  })
}

/** UC thay bản: hợp đồng cũ → `SUPERSEDED`, tạo bản `DRAFT` mới kế thừa dữ liệu và liên kết hai chiều. */
export async function supersedeConsignmentContract(
  id: string,
  reason: string,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    if (!canTransition(before.status, 'SUPERSEDED')) {
      throw new Error(`Không thể thay thế hợp đồng đang ở trạng thái ${CONSIGNMENT_CONTRACT_STATUS_LABELS[before.status]}`)
    }
    // BA đề xuất — xe đã nhận theo hợp đồng này (có biên bản) thì không thay bản, tránh biên bản mồ côi.
    if (before.status === 'SIGNED' && (before.intakeRecordId || readRecords().some((r) => r.contractId === id))) {
      throw new Error('Hợp đồng đã có biên bản nhận xe — không thể thay bằng bản mới')
    }
    const trimmed = requireReason(reason)
    const now = new Date().toISOString()
    const created: ConsignmentContract = {
      id: generateId('cg'),
      contractNo: nextSequenceCode(
        'HDKG',
        all.map((c) => c.contractNo),
      ),
      ownerId: before.ownerId,
      vehicleId: before.vehicleId,
      status: 'DRAFT',
      effectiveFrom: before.effectiveFrom,
      effectiveTo: before.effectiveTo,
      noticePeriodDays: before.noticePeriodDays,
      autoRenew: before.autoRenew,
      paymentTerm: { ...before.paymentTerm },
      exploitationRights: { ...before.exploitationRights },
      termVersions: [],
      supersedesContractId: before.id,
      statusHistory: [{ to: 'DRAFT', at: now, byName: actor.fullName, reason: trimmed }],
      note: before.note,
      createdByName: actor.fullName,
      createdAt: now,
      updatedAt: now,
    }
    const superseded: ConsignmentContract = {
      ...before,
      status: 'SUPERSEDED',
      supersededByContractId: created.id,
      statusHistory: appendHistory(before, 'SUPERSEDED', now, actor, trimmed),
      updatedAt: now,
    }
    writeContracts([...all.map((c) => (c.id === id ? superseded : c)), created])
    audit(
      actor,
      'SUPERSEDE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      `Thay hợp đồng ký gửi ${before.contractNo} bằng ${created.contractNo}: ${trimmed}`,
      { status: before.status },
      { status: superseded.status, supersededByContractId: created.id, reason: trimmed },
    )
    audit(
      actor,
      'CREATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      created.id,
      `Tạo hợp đồng ký gửi ${created.contractNo} thay thế ${before.contractNo}`,
      undefined,
      created,
    )
    return created
  })
}

// ============================================================================
// Biên bản nhận / trả xe
// ============================================================================

export interface ConsignmentHandoverRecordFilter {
  contractId?: string
  vehicleId?: string
}

export async function listConsignmentHandoverRecords(
  filter?: ConsignmentHandoverRecordFilter,
): Promise<ConsignmentHandoverRecord[]> {
  return fakeRequest(() =>
    readRecords()
      .filter((r) => !filter?.contractId || r.contractId === filter.contractId)
      .filter((r) => !filter?.vehicleId || r.vehicleId === filter.vehicleId)
      .sort((a, b) => b.handoverAt.localeCompare(a.handoverAt)),
  )
}
