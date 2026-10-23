import { INCIDENTS_STORAGE_KEY } from '@/features/incidents/storageKeys'
import type { Incident } from '@/features/incidents/model'
import { RENTALS_STORAGE_KEY } from '@/features/rentals/api'
import type { Rental } from '@/features/rentals/model'
import type {
  AuditAction,
  ConsignmentContractStatus,
  ConsignmentTerminationRequester,
  IncidentStatus,
  OwnerType,
  RentalStatus,
} from '@/shared/domain/enums'
import { can } from '@/shared/domain/permissions'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { appendAudit } from '@/shared/lib/audit'
import { fakeRequest } from '@/shared/lib/fakeNetwork'
import { generateId } from '@/shared/lib/id'
import { readJson } from '@/shared/lib/storage'
import {
  buildTermsSnapshot,
  canActivate,
  canTransition,
  findEffectiveContractForVehicle,
  findOpenContractForVehicle,
  isFutureDateTime,
  maskAccountNumber,
  nextSequenceCode,
  toOwnerAuditSnapshot,
  vehicleOwnerFormSchema,
  type ConsignmentActor,
  type ConsignmentContract,
  type ConsignmentExploitationRights,
  type ConsignmentHandoverRecord,
  type ConsignmentPaymentTerm,
  type ConsignmentStatusChange,
  type OwnerBankAccount,
  type VehicleOwner,
  type VehicleOwnerFormValues,
} from './model'
import {
  applyContractEndPlan,
  calcPayoutWindow,
  canCloseContract,
  listBlockingRentals,
  makeTerminationNoticeSchema,
  makeVehicleLossSchema,
  materializeDrafts,
  periodOf,
  planContractEnd,
  planPayoutGeneration,
} from './payoutModel'
import { isProposalConsumed, resolveProposalVehicle } from './proposalModel'
import {
  readContracts,
  readOwners,
  readPayoutRecords,
  readProposals,
  readRecords,
  readVehicles,
  writeContracts,
  writeOwners,
  writePayoutRecords,
  writeProposals,
  writeRecords,
} from './storage'

/**
 * Lớp dữ liệu "fake API" của Xe ký gửi (`docs/CONSIGNMENT-PLAN.md` mục 6).
 *
 * - Mọi đọc, guard và ghi nằm TRONG callback `fakeRequest` (không đọc storage trước rồi ghi sau độ trễ).
 * - Mọi hàm ghi gọi `appendAudit` (VC-BR-17); payload hồ sơ chủ xe luôn đi qua `toOwnerAuditSnapshot` (che dữ liệu).
 * - Không có hàm `remove` (VC-BR-18): hồ sơ chủ xe và hợp đồng chỉ đổi trạng thái.
 * - Kết thúc hợp đồng (chấm dứt / mất xe) và kích hoạt ghi cả khoản chi trả (`ownerPayoutRecords`) trong cùng callback;
 *   hàm riêng của khoản chi trả (tạm giữ, điều chỉnh, đồng bộ với `finance`) nằm ở `payoutApi.ts`. Hai file không import lẫn nhau.
 * - Bản prototype: dữ liệu nằm ở localStorage nên API vẫn trả số tài khoản đầy đủ; backend thật phải che ở tầng API
 *   (`docs/ARCHITECTURE.md`) và chỉ trả số đầy đủ qua `revealOwnerBankAccount`.
 * - Quy ước kiểm quyền ở UI, ngoại lệ DUY NHẤT là `revealOwnerBankAccount` (dữ liệu nhạy cảm — BRD mục 21).
 */

/** Người thực hiện thao tác — dùng để ghi audit (VC-BR-17). */
export type ActorInfo = ConsignmentActor

const t = vi.consignment.termination
const pt = vi.consignment.proposals

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
  entity: 'VehicleOwner' | 'ConsignmentContract' | 'ConsignmentHandoverRecord' | 'OwnerPayoutRecord' | 'ConsignmentProposal',
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
  const parsed = vehicleOwnerFormSchema.safeParse({ ...input, hasExistingBankAccount: !!existing?.bankAccount })
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
  /** Đề nghị ký gửi `APPROVED` chưa dùng — chủ xe và xe suy ra từ đề nghị (UC-VC-03 tiền điều kiện). */
  proposalId: string
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
    const proposals = readProposals()
    // UC-VC-03 — chỉ soạn hợp đồng từ đề nghị đã duyệt và chưa dùng.
    const proposal = proposals.find((p) => p.id === input.proposalId)
    if (!proposal) throw new Error(pt.notFound)
    if (proposal.status !== 'APPROVED') throw new Error(pt.contractNeedsApproved)
    if (isProposalConsumed(proposal, all)) throw new Error(pt.contractProposalConsumed)
    const owner = findOwnerOrThrow(owners, proposal.ownerId)
    const resolved = resolveProposalVehicle(proposal, readVehicles())
    if ('error' in resolved) throw new Error(resolved.error)
    const vehicle = resolved.vehicle
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
      proposalId: proposal.id,
      status: 'DRAFT',
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      noticePeriodDays: input.noticePeriodDays,
      autoRenew: input.autoRenew,
      paymentTerm: buildPaymentTerm(input),
      exploitationRights: input.exploitationRights,
      termVersions: [],
      addenda: [],
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
      `Tạo hợp đồng ký gửi ${created.contractNo} cho xe ${vehicle.plate} (chủ xe ${owner.code}) từ đề nghị ${proposal.code}`,
      undefined,
      created,
    )
    // Gắn lại xe ở Danh sách xe vào đề nghị khi xe mới được tạo sau lúc ghi nhận đề nghị (UC-VC-03 A1).
    if (proposal.vehicleId !== vehicle.id) {
      writeProposals(proposals.map((p) => (p.id === proposal.id ? { ...p, vehicleId: vehicle.id, updatedAt: now } : p)))
      audit(
        actor,
        'UPDATE_CONSIGNMENT_PROPOSAL',
        'ConsignmentProposal',
        proposal.id,
        pt.auditLinkVehicle(proposal.code, vehicle.plate),
        { vehicleId: proposal.vehicleId },
        { vehicleId: vehicle.id },
      )
    }
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
    if (isFutureDateTime(input.handoverAt)) throw new Error(t.handoverFuture)
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
    if (toDateKey(new Date()) > before.effectiveTo) {
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
    // UC-VC-06 §10.3 — kích hoạt bù các kỳ chi trả từ ngày bắt đầu tới tháng hiện tại (prorate tháng đầu lẻ).
    const records = readPayoutRecords()
    const drafts = planPayoutGeneration([after], records, periodOf(toDateKey(new Date())))
    if (drafts.length > 0) {
      const created = materializeDrafts(drafts, records, { createdAt: now, createdByName: actor.fullName })
      writePayoutRecords([...records, ...created])
      audit(
        actor,
        'GENERATE_OWNER_PAYOUT_RECORDS',
        'OwnerPayoutRecord',
        `contract:${id}`,
        t.auditGenerateOnActivate(created.length, before.contractNo),
        undefined,
        created.map((r) => r.code),
      )
    }
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
      proposalId: before.proposalId,
      status: 'DRAFT',
      effectiveFrom: before.effectiveFrom,
      effectiveTo: before.effectiveTo,
      noticePeriodDays: before.noticePeriodDays,
      autoRenew: before.autoRenew,
      paymentTerm: { ...before.paymentTerm },
      exploitationRights: { ...before.exploitationRights },
      termVersions: [],
      addenda: [],
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

// ============================================================================
// Chấm dứt · đóng · mất xe (Round 2)
// ============================================================================

const ENDABLE_STATUSES: ConsignmentContractStatus[] = ['ACTIVE', 'SUSPENDED']

function assertEndable(contract: ConsignmentContract): void {
  if (!ENDABLE_STATUSES.includes(contract.status)) {
    throw new Error(t.notRunning(CONSIGNMENT_CONTRACT_STATUS_LABELS[contract.status]))
  }
}

export interface ConsignmentTerminationNoticeInput {
  requestedBy: ConsignmentTerminationRequester
  noticeDate: string
  plannedEndDate: string
  reason: string
}

/**
 * UC-VC-11 — ghi nhận thông báo chấm dứt. Cho nhập lùi ngày thông báo (thông báo nhận ngoài hệ thống); ngày dự kiến kết
 * thúc phải ≥ ngày thông báo + Notice Period (VC-BR-14) và trước ngày hết hạn (bằng/sau = hết hạn tự nhiên → "Đóng hợp đồng").
 */
export async function notifyConsignmentTermination(
  id: string,
  input: ConsignmentTerminationNoticeInput,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    assertEndable(before)
    if (before.terminationNotice) throw new Error(t.noticeExists)
    const parsed = makeTerminationNoticeSchema({
      effectiveFrom: before.effectiveFrom,
      effectiveTo: before.effectiveTo,
      noticePeriodDays: before.noticePeriodDays,
      todayKey: toDateKey(new Date()),
    }).safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? t.noticeInvalid)
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      terminationNotice: { ...parsed.data, recordedByName: actor.fullName, recordedAt: now },
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'NOTIFY_CONSIGNMENT_TERMINATION',
      'ConsignmentContract',
      id,
      t.auditNotice(before.contractNo, parsed.data.noticeDate, parsed.data.plannedEndDate),
      undefined,
      after.terminationNotice,
    )
    return after
  })
}

export interface VehicleRentalForConsignment {
  id: string
  vehicleId: string
  status: RentalStatus
  pickupDateTime: string
  expectedReturnDateTime: string
  customerId: string
}

/** Chỉ ĐỌC lượt thuê của xe (VC-BR-14) — không tự huỷ / đổi xe; xử lý lượt thuê làm ở màn Lượt thuê. */
export async function listVehicleRentalsForConsignment(vehicleId: string): Promise<VehicleRentalForConsignment[]> {
  return fakeRequest(() =>
    (readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? [])
      .filter((r) => r.vehicleId === vehicleId)
      .map((r) => ({
        id: r.id,
        vehicleId: r.vehicleId,
        status: r.status,
        pickupDateTime: r.pickupDateTime,
        expectedReturnDateTime: r.expectedReturnDateTime,
        customerId: r.customerId,
      }))
      .sort((a, b) => b.pickupDateTime.localeCompare(a.pickupDateTime)),
  )
}

export interface VehicleIncidentForConsignment {
  id: string
  incidentCode: string
  status: IncidentStatus
  reportedAt: string
}

/** Chỉ ĐỌC sự cố của xe — để liên kết khi ghi nhận mất xe (tuỳ chọn). */
export async function listVehicleIncidentsForConsignment(vehicleId: string): Promise<VehicleIncidentForConsignment[]> {
  return fakeRequest(() =>
    (readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? [])
      .filter((i) => i.vehicleId === vehicleId)
      .map((i) => ({ id: i.id, incidentCode: i.incidentCode, status: i.status, reportedAt: i.reportedAt }))
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
  )
}

export type ConsignmentReturnInput = Omit<ConsignmentIntakeInput, 'appraisedValue'>

/**
 * UC-VC-11 — biên bản trả xe về chủ xe (`RETURN`). Điều kiện: có thông báo chấm dứt và ngày trả ≥ ngày dự kiến kết thúc,
 * hoặc ngày trả ≥ ngày hết hạn; không còn lượt thuê chặn (VC-BR-14); hai bên xác nhận (VC-BR-15). Không có định giá.
 */
export async function recordConsignmentReturn(
  contractId: string,
  input: ConsignmentReturnInput,
  actor: ActorInfo,
): Promise<ConsignmentHandoverRecord> {
  return fakeRequest(() => {
    const contracts = readContracts()
    const records = readRecords()
    const contract = findContractOrThrow(contracts, contractId)
    assertEndable(contract)
    if (records.some((r) => r.contractId === contractId && r.type === 'RETURN')) throw new Error(t.returnExists)
    const intake = records.find((r) => r.contractId === contractId && r.type === 'INTAKE')
    if (!intake) throw new Error(t.returnNoIntake)

    if (isFutureDateTime(input.handoverAt)) throw new Error(t.handoverFuture)
    if (new Date(input.handoverAt).getTime() < new Date(intake.handoverAt).getTime()) throw new Error(t.returnBeforeIntake)
    const returnDate = toDateKey(new Date(input.handoverAt))
    const notice = contract.terminationNotice
    if (returnDate < contract.effectiveTo) {
      if (!notice) throw new Error(t.returnNeedsNotice)
      if (returnDate < notice.plannedEndDate) throw new Error(t.returnBeforePlanned(formatDate(notice.plannedEndDate)))
    }
    if (!Number.isInteger(input.odoKm) || input.odoKm < intake.odoKm) throw new Error(t.returnOdoBelowIntake(intake.odoKm))
    if (!Number.isFinite(input.fuelLevel) || input.fuelLevel < 0 || input.fuelLevel > 100) {
      throw new Error('Mức nhiên liệu phải từ 0 đến 100')
    }
    if (!input.baselineCondition.trim()) throw new Error('Mô tả hiện trạng là bắt buộc')
    // VC-BR-15 — biên bản phải được cả hai bên xác nhận.
    if (!input.ownerConfirmed || !input.companyConfirmed) throw new Error(t.confirmRequired)
    // VC-BR-14 — không trả xe về chủ khi còn lượt thuê đã xác nhận / đang chạy.
    const blocking = listBlockingRentals(readJson<Rental[]>(RENTALS_STORAGE_KEY) ?? [], contract.vehicleId)
    if (blocking.length > 0) throw new Error(t.blockedByRentals(blocking.length))

    const now = new Date().toISOString()
    const record: ConsignmentHandoverRecord = {
      id: generateId('cgh'),
      code: nextSequenceCode(
        'BBKG',
        records.map((r) => r.code),
      ),
      type: 'RETURN',
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
      companyRepName: input.companyRepName.trim(),
      ownerConfirmed: input.ownerConfirmed,
      companyConfirmed: input.companyConfirmed,
      createdByName: actor.fullName,
      createdAt: now,
    }
    writeRecords([...records, record])
    writeContracts(contracts.map((c) => (c.id === contractId ? { ...c, returnRecordId: record.id, updatedAt: now } : c)))
    audit(
      actor,
      'CREATE_CONSIGNMENT_RETURN',
      'ConsignmentHandoverRecord',
      record.id,
      t.auditReturn(record.code, contract.contractNo),
      undefined,
      record,
    )
    return record
  })
}

/** Ghi khoản chi trả sau khi hợp đồng kết thúc (huỷ / tạo thay thế) + audit từng khoản — gọi trong callback của hàm kết thúc. */
function applyEndPlanAndAudit(
  contract: ConsignmentContract,
  endedDate: string,
  actor: ActorInfo,
  now: string,
  cancelReason: string,
): void {
  const records = readPayoutRecords()
  const plan = planContractEnd(contract, records, endedDate)
  if ('error' in plan) throw new Error(plan.error)
  const result = applyContractEndPlan(records, plan, { now, byName: actor.fullName, cancelReason })
  writePayoutRecords(result.records)
  for (const r of result.cancelled) {
    audit(actor, 'CANCEL_OWNER_PAYOUT_RECORD', 'OwnerPayoutRecord', r.id, t.auditCancelRecord(r.code, r.period, cancelReason), undefined, {
      code: r.code,
      period: r.period,
      status: r.status,
      replacedByRecordId: r.replacedByRecordId,
    })
  }
  if (result.created.length > 0) {
    audit(
      actor,
      'GENERATE_OWNER_PAYOUT_RECORDS',
      'OwnerPayoutRecord',
      `contract:${contract.id}`,
      t.auditGenerateOnEnd(result.created.length, contract.contractNo),
      undefined,
      result.created.map((r) => r.code),
    )
  }
}

/** Dry-run `planContractEnd` cho dialog xác nhận (không ghi). Trả kế hoạch hoặc lỗi. */
export async function previewConsignmentContractEnd(
  id: string,
  endedDate: string,
): Promise<{ cancelCount: number; createCount: number; lastPeriodDays?: number; lastPeriodDaysInMonth?: number; unpaidCount: number; error?: string }> {
  return fakeRequest(() => {
    const contract = findContractOrThrow(readContracts(), id)
    const records = readPayoutRecords()
    const plan = planContractEnd(contract, records, endedDate)
    const unpaidCount = records.filter((r) => r.contractId === id && (r.status === 'SCHEDULED' || r.status === 'ON_HOLD')).length
    if ('error' in plan) return { cancelCount: 0, createCount: 0, unpaidCount, error: plan.error }
    const last = [...plan.create].sort((a, b) => b.period.localeCompare(a.period))[0]
    return {
      cancelCount: plan.cancel.length,
      createCount: plan.create.length,
      lastPeriodDays: last?.daysCovered,
      lastPeriodDaysInMonth: last?.daysInMonth,
      unpaidCount,
    }
  })
}

/**
 * UC-VC-11 — chấm dứt trước hạn: cần thông báo chấm dứt + biên bản trả xe (VC-BR-15). Ngày kết thúc = ngày của biên bản
 * trả xe. Record kỳ sau bị huỷ, kỳ của ngày kết thúc tính lại theo số ngày (AC-VC-011). Khoản chưa chi vẫn được chi sau.
 */
export async function terminateConsignmentContract(id: string, actor: ActorInfo): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    assertEndable(before)
    if (!before.terminationNotice) throw new Error(t.terminateNeedsNotice)
    const returnRecord = readRecords().find((r) => r.id === before.returnRecordId && r.type === 'RETURN')
    if (!returnRecord) throw new Error(t.terminateNeedsReturn)
    const endedDate = toDateKey(returnRecord.handoverAt)
    if (endedDate >= before.effectiveTo) throw new Error(t.terminateAlreadyExpired)
    const now = new Date().toISOString()
    const reason = before.terminationNotice.reason
    const after: ConsignmentContract = {
      ...before,
      status: 'TERMINATED',
      endedDate,
      endReason: 'EARLY_TERMINATION',
      statusHistory: appendHistory(before, 'TERMINATED', now, actor, reason),
      updatedAt: now,
    }
    applyEndPlanAndAudit(after, endedDate, actor, now, t.cancelReasonTerminated(formatDate(endedDate)))
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'TERMINATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      t.auditTerminate(before.contractNo, endedDate),
      { status: before.status },
      { status: after.status, endedDate, endReason: after.endReason },
    )
    return after
  })
}

/**
 * UC-VC-11 A2 — đóng hợp đồng khi hết hạn: cần biên bản trả xe và mọi khoản chi trả đã `PAID` (kể cả kỳ cuối). Không tự
 * sinh lịch — người dùng bấm "Sinh lịch chi trả" và chi trước, rồi mới đóng.
 */
export async function closeConsignmentContract(id: string, actor: ActorInfo): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    assertEndable(before)
    const returnRecord = readRecords().find((r) => r.id === before.returnRecordId && r.type === 'RETURN')
    const blocker = canCloseContract(before, readPayoutRecords(), returnRecord, toDateKey(new Date()))
    if (blocker) throw new Error(blocker)
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'CLOSED',
      endedDate: before.effectiveTo,
      endReason: 'EXPIRED',
      statusHistory: appendHistory(before, 'CLOSED', now, actor),
      updatedAt: now,
    }
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'CLOSE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      t.auditClose(before.contractNo),
      { status: before.status },
      { status: after.status, endedDate: after.endedDate },
    )
    return after
  })
}

export interface ConsignmentVehicleLossInput {
  eventDate: string
  incidentId?: string
  note: string
}

/**
 * UC-VC-12 — ghi nhận mất xe: hợp đồng `TERMINATED` ngay từ `Event Date`, KHÔNG cần biên bản trả xe (AC-VC-015).
 * Bồi thường và tranh chấp bảo hiểm nằm ngoài hệ thống (VC-BR-16). Không ghi `vehicles` — nhắc cập nhật trạng thái xe ở UI.
 */
export async function recordConsignmentVehicleLoss(
  id: string,
  input: ConsignmentVehicleLossInput,
  actor: ActorInfo,
): Promise<ConsignmentContract> {
  return fakeRequest(() => {
    const all = readContracts()
    const before = findContractOrThrow(all, id)
    assertEndable(before)
    const window = calcPayoutWindow(before)
    if (!window) throw new Error(t.lossNotActivated)
    const parsed = makeVehicleLossSchema({ payoutStart: window.start, todayKey: toDateKey(new Date()) }).safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? t.lossInvalid)
    const { eventDate, note } = parsed.data
    const incidentId = parsed.data.incidentId || undefined
    if (incidentId) {
      const incident = (readJson<Incident[]>(INCIDENTS_STORAGE_KEY) ?? []).find((i) => i.id === incidentId)
      if (!incident || incident.vehicleId !== before.vehicleId) throw new Error(t.lossIncidentMismatch)
    }
    const now = new Date().toISOString()
    const after: ConsignmentContract = {
      ...before,
      status: 'TERMINATED',
      endedDate: eventDate,
      endReason: 'VEHICLE_LOSS',
      lossInfo: { eventDate, incidentId, note, recordedByName: actor.fullName, recordedAt: now },
      statusHistory: appendHistory(before, 'TERMINATED', now, actor, note),
      updatedAt: now,
    }
    applyEndPlanAndAudit(after, eventDate, actor, now, t.cancelReasonLoss(formatDate(eventDate)))
    writeContracts(all.map((c) => (c.id === id ? after : c)))
    audit(
      actor,
      'TERMINATE_CONSIGNMENT_CONTRACT',
      'ConsignmentContract',
      id,
      t.auditLoss(before.contractNo, eventDate),
      { status: before.status },
      { status: after.status, endedDate: eventDate, endReason: after.endReason, incidentId },
    )
    return after
  })
}
