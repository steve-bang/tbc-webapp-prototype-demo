import { z } from 'zod'
import {
  CONSIGNMENT_PRORATION_RULES,
  OWNER_TYPES,
  type ConsignmentContractStatus,
  type ConsignmentEndReason,
  type ConsignmentHandoverType,
  type ConsignmentPaymentTermModel,
  type ConsignmentProrationRule,
  type ConsignmentTerminationRequester,
  type OwnerType,
  type Role,
} from '@/shared/domain/enums'
import { CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import type { ConsignmentAddendum } from './addendumModel'

/**
 * Xe ký gửi (module `VC`) — `VehicleConsignment-BRD.md` v1.7, mô hình chốt theo CR-2026-050:
 * công ty giữ 100% doanh thu cho thuê, trả chủ xe MỘT khoản cố định hàng tháng (`FIXED_MONTHLY`).
 * Không có logic chia doanh thu. Kế hoạch: `docs/CONSIGNMENT-PLAN.md` mục 2.
 */

// ---- Kiểu cục bộ (không phải enum nghiệp vụ dùng chung) ----

/** BRD mục 6.1 — Giới tính là field tuỳ chọn (CR-2026-051 Q19); cùng giá trị với `customers`. */
export type OwnerGender = 'MALE' | 'FEMALE' | 'OTHER'

export type ConsignmentDocumentKind = 'ORIGINAL' | 'COPY'

export interface OwnerBankAccount {
  accountNumber: string
  bankName: string
  accountHolder: string
}

/** Hồ sơ chủ xe — BRD mục 6.1 (CR-2026-027/051). */
export interface VehicleOwner {
  id: string
  /** `CX-000001` tuần tự. */
  code: string
  ownerType: OwnerType
  fullName: string
  /** CCCD — bắt buộc khi `INDIVIDUAL`. */
  idNumber?: string
  /** Mã số thuế — bắt buộc khi `ORGANIZATION`. */
  taxCode?: string
  /** Chỉ `INDIVIDUAL`, tuỳ chọn; tuổi tự tính khi hiển thị (CR-2026-051 Q19). */
  dateOfBirth?: string
  gender?: OwnerGender
  address?: string
  email?: string
  phone: string
  bankAccount?: OwnerBankAccount
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

/** BRD mục 6.4 — mô hình `FIXED_MONTHLY` (CR-2026-050). */
export interface ConsignmentPaymentTerm {
  model: ConsignmentPaymentTermModel
  fixedMonthlyAmount: number
  /** Ngày trong tháng công ty chi trả (1–31). */
  paymentDay: number
  prorationRule: ConsignmentProrationRule
}

/** BRD mục 9 nhóm C — "cho thuê tự lái" là cố định, không phải field. */
export interface ConsignmentExploitationRights {
  thirdPartyPlatformAllowed: boolean
  advertisingImageAllowed: boolean
  usageScopeNote?: string
}

/** VC-BR-22 / BRD mục 12 — 7 hạng mục, bên chịu luôn là Công ty. Nhãn ở `vi.consignment.responsibility`. */
export const RESPONSIBILITY_ITEM_KEYS = [
  'ROUTINE_MAINTENANCE',
  'NATURAL_WEAR',
  'CLEANING',
  'INSPECTION_ROAD_FEE',
  'INSURANCE',
  'TRANSFER_FUEL',
  'UNRECOVERED_DAMAGE',
] as const
export type ResponsibilityItemKey = (typeof RESPONSIBILITY_ITEM_KEYS)[number]

/** VC-BR-05 — bản chốt điều khoản lúc ký; KHÔNG chép số tài khoản/CCCD của chủ xe vào snapshot. */
export interface ConsignmentTermsSnapshot {
  snapshotAt: string
  effectiveFrom: string
  effectiveTo: string
  noticePeriodDays: number
  autoRenew: boolean
  paymentTerm: ConsignmentPaymentTerm
  exploitationRights: ConsignmentExploitationRights
  responsibilityMatrix: ResponsibilityItemKey[]
  owner: { code: string; fullName: string; ownerType: OwnerType }
  vehicle: { plate: string; brand: string; model: string; manufacturingYear?: number; color?: string }
}

/** Phiên bản điều khoản hiệu lực — vòng sau nối phụ lục vào mảng này (AC-VC-012). */
export interface ConsignmentTermVersion {
  versionNo: number
  effectiveFrom: string
  paymentTerm: ConsignmentPaymentTerm
  source: 'ORIGINAL' | 'ADDENDUM'
  /** Có khi `source = 'ADDENDUM'` — phụ lục tạo ra phiên bản này. */
  addendumId?: string
  createdAt: string
}

export interface ConsignmentStatusChange {
  from?: ConsignmentContractStatus
  to: ConsignmentContractStatus
  at: string
  byName: string
  reason?: string
}

/** Hợp đồng ký gửi — BRD mục 6.2. CR-2026-051: một hợp đồng = một xe. */
export interface ConsignmentContract {
  id: string
  /** `HDKG-000001` tuần tự. */
  contractNo: string
  ownerId: string
  vehicleId: string
  /** Đề nghị ký gửi `APPROVED` mà hợp đồng được soạn từ đó (UC-VC-03); "Thay bằng bản mới" chép sang bản mới. */
  proposalId: string
  status: ConsignmentContractStatus
  effectiveFrom: string
  effectiveTo: string
  noticePeriodDays: number
  autoRenew: boolean
  paymentTerm: ConsignmentPaymentTerm
  exploitationRights: ConsignmentExploitationRights
  termsSnapshot?: ConsignmentTermsSnapshot
  termVersions: ConsignmentTermVersion[]
  /** Phụ lục đã lập (append-only, hiệu lực ngay khi lập) — gia hạn và/hoặc đổi điều khoản chi trả (AC-VC-012). */
  addenda: ConsignmentAddendum[]
  signedCopy?: { fileName: string; uploadedByName: string; uploadedAt: string }
  intakeRecordId?: string
  activatedAt?: string
  supersedesContractId?: string
  supersededByContractId?: string
  /** Thông báo chấm dứt trước hạn (BRD mục 15, VC-BR-14) — ghi nhận bởi người có quyền chấm dứt. */
  terminationNotice?: {
    requestedBy: ConsignmentTerminationRequester
    noticeDate: string
    plannedEndDate: string
    reason: string
    recordedByName: string
    recordedAt: string
  }
  /** Ngày kết thúc tính tiền (`YYYY-MM-DD`) — có khi `TERMINATED`/`CLOSED`; mốc `payoutEnd` của lịch chi trả. */
  endedDate?: string
  endReason?: ConsignmentEndReason
  /** Biên bản trả xe (`RETURN`) đã lập cho hợp đồng này. */
  returnRecordId?: string
  /** Mất xe (BRD mục 11, VC-BR-16) — ngày sự kiện + sự cố liên quan (tuỳ chọn). */
  lossInfo?: { eventDate: string; incidentId?: string; note: string; recordedByName: string; recordedAt: string }
  statusHistory: ConsignmentStatusChange[]
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
}

export interface ConsignmentChecklistItem {
  /** Khoá mục (`EXTERIOR` / `INTERIOR` / `MECHANICAL`); nhãn ở `vi.consignment`. */
  item: string
  ok: boolean
  note?: string
}

/** Biên bản nhận/trả xe ký gửi — BRD mục 6.3. Append-only (không sửa/xoá). */
export interface ConsignmentHandoverRecord {
  id: string
  /** `BBKG-000001` tuần tự. */
  code: string
  type: ConsignmentHandoverType
  contractId: string
  vehicleId: string
  ownerId: string
  handoverAt: string
  odoKm: number
  /** 0–100 (%). */
  fuelLevel: number
  baselineCondition: string
  checklist: ConsignmentChecklistItem[]
  accessories: string[]
  documentsReceived: { name: string; kind: ConsignmentDocumentKind }[]
  missingDocumentsNote?: string
  mediaNote?: string
  /** Chỉ `INTAKE` (VC-BR-16) — tài liệu tham chiếu, không dùng tính tiền. */
  appraisedValue?: number
  companyRepName: string
  ownerConfirmed: boolean
  companyConfirmed: boolean
  createdByName: string
  createdAt: string
}

/** Người thực hiện thao tác — dùng để ghi audit (VC-BR-17). */
export interface ConsignmentActor {
  userId: string
  fullName: string
  role: Role
}

// ---- Hằng số ----

/** VC-BR-01. */
export const EFFECTIVE_CONTRACT_STATUSES: ConsignmentContractStatus[] = ['SIGNED', 'ACTIVE', 'SUSPENDED']

// BA đề xuất — chặn thêm hợp đồng mở thứ 2 cho cùng xe (plan mục 0.3 điểm 3), chặt hơn VC-BR-01 một chút.
export const OPEN_CONTRACT_STATUSES: ConsignmentContractStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SIGNED',
  'ACTIVE',
  'SUSPENDED',
]

// VC-BR-19 — ngưỡng nhắc hết hạn 30 ngày.
// TODO(OQ: VehicleConsignment-BRD.md mục 23 Q20 — ngưỡng cấu hình được; bản demo dùng hằng số)
export const CONSIGNMENT_EXPIRY_REMINDER_DAYS = 30

// VC-BR-20 — ngưỡng nhắc tới hạn chi trả 3 ngày (dùng khi có lịch chi trả).
// TODO(OQ: VehicleConsignment-BRD.md mục 23 Q20 — ngưỡng cấu hình được; bản demo dùng hằng số)
export const CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS = 3

/** Tên công ty bên nhận ký gửi — cùng giá trị `COMPANY_NAME` của hợp đồng thuê (không có entity cấu hình công ty). */
export const CONSIGNMENT_COMPANY_NAME = 'Công ty TNHH Thiên Bảo Car'

/** Ba mục checklist theo BRD mục 8 (ngoại thất · nội thất · máy móc). */
export const INTAKE_CHECKLIST_KEYS = ['EXTERIOR', 'INTERIOR', 'MECHANICAL'] as const

/** Ba giấy tờ nhận từ chủ xe theo BRD mục 6.3 / 8. */
export const INTAKE_DOCUMENT_KEYS = ['REGISTRATION', 'INSPECTION', 'INSURANCE'] as const

// ---- Hàm thuần ----

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `YYYY-MM-DD` theo giờ ĐỊA PHƯƠNG. Không dùng `toISOString().slice(0, 10)` vì lệch ngày theo UTC.
 * Mirror helper cùng tên của finance (consignment không được import finance — plan mục 0.3 điểm 1).
 */
export function toLocalDateKey(value: string | Date): string {
  if (typeof value === 'string' && DATE_KEY_RE.test(value)) return value
  const d = typeof value === 'string' ? new Date(value) : value
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Số ngày từ `fromKey` đến `toKey` (cả hai dạng `YYYY-MM-DD`), tính theo lịch — không bị lệch giờ mùa hè. */
export function dayDiff(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** Cộng/trừ `offset` ngày vào một khoá ngày `YYYY-MM-DD` (theo lịch, giờ địa phương). */
export function addDaysKey(key: string, offset: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return toLocalDateKey(new Date(y, m - 1, d + offset))
}

/** Mã tuần tự 6 chữ số: lấy số lớn nhất đang có trong `codes` (cùng `prefix`) cộng 1. */
export function nextSequenceCode(prefix: string, codes: string[]): string {
  let max = 0
  for (const code of codes) {
    if (!code.startsWith(`${prefix}-`)) continue
    const n = Number(code.slice(prefix.length + 1))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}-${String(max + 1).padStart(6, '0')}`
}

/** State machine hợp đồng — plan mục 3.1 (BRD mục 7.2). */
export const CONTRACT_TRANSITIONS: Record<ConsignmentContractStatus, ConsignmentContractStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'SUPERSEDED'],
  PENDING_APPROVAL: ['DRAFT', 'SIGNED', 'SUPERSEDED'],
  SIGNED: ['ACTIVE', 'SUPERSEDED'],
  ACTIVE: ['SUSPENDED', 'TERMINATED', 'CLOSED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED', 'CLOSED'],
  CLOSED: [],
  TERMINATED: [],
  SUPERSEDED: [],
}

export function canTransition(from: ConsignmentContractStatus, to: ConsignmentContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from].includes(to)
}

/** VC-BR-01 — hợp đồng đang hiệu lực (`SIGNED`/`ACTIVE`/`SUSPENDED`) của xe, bỏ qua `excludeId`. */
export function findEffectiveContractForVehicle(
  contracts: ConsignmentContract[],
  vehicleId: string,
  excludeId?: string,
): ConsignmentContract | undefined {
  return contracts.find(
    (c) => c.vehicleId === vehicleId && c.id !== excludeId && EFFECTIVE_CONTRACT_STATUSES.includes(c.status),
  )
}

/** Hợp đồng "mở" của xe (kể cả nháp / chờ duyệt), bỏ qua `excludeId`. */
export function findOpenContractForVehicle(
  contracts: ConsignmentContract[],
  vehicleId: string,
  excludeId?: string,
): ConsignmentContract | undefined {
  return contracts.find(
    (c) => c.vehicleId === vehicleId && c.id !== excludeId && OPEN_CONTRACT_STATUSES.includes(c.status),
  )
}

const CURRENT_CONTRACT_PRIORITY: ConsignmentContractStatus[][] = [
  ['ACTIVE', 'SUSPENDED'],
  ['SIGNED'],
  ['PENDING_APPROVAL'],
  ['DRAFT'],
]

/** Hợp đồng hiện hành để hiển thị ở tab xe: ưu tiên đang hiệu lực → đã ký → chờ duyệt → nháp → bản kết thúc mới nhất. */
export function getCurrentContractForVehicle(
  contracts: ConsignmentContract[],
  vehicleId: string,
): ConsignmentContract | undefined {
  const own = contracts.filter((c) => c.vehicleId === vehicleId)
  for (const group of CURRENT_CONTRACT_PRIORITY) {
    const found = own.find((c) => group.includes(c.status))
    if (found) return found
  }
  return own
    .filter((c) => c.status === 'CLOSED' || c.status === 'TERMINATED')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

/** VC-BR-02 / AC-VC-001 — chỉ kích hoạt khi `SIGNED` và đã có biên bản nhận xe được hai bên xác nhận. */
export function canActivate(contract: ConsignmentContract, intake?: ConsignmentHandoverRecord): boolean {
  return (
    contract.status === 'SIGNED' &&
    !!intake &&
    intake.type === 'INTAKE' &&
    intake.ownerConfirmed &&
    intake.companyConfirmed
  )
}

/** VC-BR-19 — `ACTIVE`/`SUSPENDED` còn từ 0 đến 30 ngày tới ngày hết hạn. */
export function isExpiringSoon(contract: ConsignmentContract, todayKey: string): boolean {
  if (contract.status !== 'ACTIVE' && contract.status !== 'SUSPENDED') return false
  const left = dayDiff(todayKey, contract.effectiveTo)
  return left >= 0 && left <= CONSIGNMENT_EXPIRY_REMINDER_DAYS
}

/** Tuổi tròn năm tại `todayKey`. */
export function calcAge(dobKey: string, todayKey: string): number {
  const [by, bm, bd] = dobKey.split('-').map(Number)
  const [ty, tm, td] = todayKey.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age -= 1
  return Math.max(0, age)
}

/** Che dữ liệu nhạy cảm (BRD mục 21): giữ 4 ký tự cuối. */
export function maskAccountNumber(value: string): string {
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`
}

export function maskIdNumber(value: string): string {
  return maskAccountNumber(value)
}

/** Bản sao hồ sơ chủ xe đã che số tài khoản + CCCD/MST — dùng cho MỌI payload `before`/`after` của audit. */
export function toOwnerAuditSnapshot(owner: VehicleOwner): Record<string, unknown> {
  return {
    ...owner,
    idNumber: owner.idNumber ? maskIdNumber(owner.idNumber) : undefined,
    taxCode: owner.taxCode ? maskIdNumber(owner.taxCode) : undefined,
    bankAccount: owner.bankAccount
      ? { ...owner.bankAccount, accountNumber: maskAccountNumber(owner.bankAccount.accountNumber) }
      : undefined,
  }
}

export interface SnapshotVehicleInfo {
  plate: string
  brand: string
  model: string
  manufacturingYear?: number
  color?: string
  currentKm?: number
}

/** VC-BR-05 — chốt điều khoản + Responsibility Matrix tại thời điểm ký. */
export function buildTermsSnapshot(
  contract: Pick<
    ConsignmentContract,
    'effectiveFrom' | 'effectiveTo' | 'noticePeriodDays' | 'autoRenew' | 'paymentTerm' | 'exploitationRights'
  >,
  owner: Pick<VehicleOwner, 'code' | 'fullName' | 'ownerType'>,
  vehicle: SnapshotVehicleInfo,
  nowIso: string,
): ConsignmentTermsSnapshot {
  return {
    snapshotAt: nowIso,
    effectiveFrom: contract.effectiveFrom,
    effectiveTo: contract.effectiveTo,
    noticePeriodDays: contract.noticePeriodDays,
    autoRenew: contract.autoRenew,
    paymentTerm: { ...contract.paymentTerm },
    exploitationRights: { ...contract.exploitationRights },
    // VC-BR-22 — công ty chịu cả 7 hạng mục.
    responsibilityMatrix: [...RESPONSIBILITY_ITEM_KEYS],
    owner: { code: owner.code, fullName: owner.fullName, ownerType: owner.ownerType },
    vehicle: {
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      manufacturingYear: vehicle.manufacturingYear,
      color: vehicle.color,
    },
  }
}

export type MergeFieldGroup = 'A' | 'B' | 'C' | 'D' | 'E' | 'FG' | 'H' | 'I' | 'J'

export interface MergeField {
  group: MergeFieldGroup
  placeholder: string
  label: string
  value: string
}

export const MERGE_FIELD_GROUPS: MergeFieldGroup[] = ['A', 'B', 'C', 'D', 'E', 'FG', 'H', 'I', 'J']

const t = vi.consignment

/**
 * Danh sách trường trộn (merge-field) theo nhóm A–J của BRD mục 9 (CR-2026-049): chỉ liệt kê trường sẽ điền vào mẫu,
 * KHÔNG soạn điều khoản pháp lý. Số tài khoản luôn ở dạng đã che.
 * TODO(OQ: CR-2026-049 — khách chưa cấp mẫu .docx; map placeholder thật khi có mẫu)
 */
export function buildMergeFields(
  contract: ConsignmentContract,
  owner: VehicleOwner,
  vehicle: SnapshotVehicleInfo,
  intake?: ConsignmentHandoverRecord,
): MergeField[] {
  const terms = contract.termsSnapshot
  const paymentTerm = terms?.paymentTerm ?? contract.paymentTerm
  const rights = terms?.exploitationRights ?? contract.exploitationRights
  const effectiveFrom = terms?.effectiveFrom ?? contract.effectiveFrom
  const effectiveTo = terms?.effectiveTo ?? contract.effectiveTo
  const noticePeriodDays = terms?.noticePeriodDays ?? contract.noticePeriodDays
  const autoRenew = terms?.autoRenew ?? contract.autoRenew
  const yesNo = (v: boolean) => (v ? t.yes : t.no)

  return [
    { group: 'A', placeholder: '{{company.name}}', label: t.mergeCompanyName, value: CONSIGNMENT_COMPANY_NAME },
    { group: 'A', placeholder: '{{owner.fullName}}', label: t.mergeOwnerName, value: owner.fullName },
    {
      group: 'A',
      placeholder: '{{owner.idOrTaxCode}}',
      label: t.mergeOwnerId,
      value: (owner.ownerType === 'INDIVIDUAL' ? owner.idNumber : owner.taxCode) ?? t.noValue,
    },
    { group: 'A', placeholder: '{{owner.address}}', label: t.mergeOwnerAddress, value: owner.address ?? t.noValue },
    { group: 'A', placeholder: '{{owner.phone}}', label: t.mergeOwnerPhone, value: owner.phone },
    {
      group: 'A',
      placeholder: '{{owner.bankAccount}}',
      label: t.mergeOwnerBank,
      value: owner.bankAccount
        ? `${maskAccountNumber(owner.bankAccount.accountNumber)} — ${owner.bankAccount.bankName} — ${owner.bankAccount.accountHolder}`
        : t.noValue,
    },
    { group: 'B', placeholder: '{{vehicle.plate}}', label: t.mergeVehiclePlate, value: vehicle.plate },
    {
      group: 'B',
      placeholder: '{{vehicle.brandModel}}',
      label: t.mergeVehicleBrandModel,
      value: `${vehicle.brand} ${vehicle.model}`,
    },
    {
      group: 'B',
      placeholder: '{{vehicle.year}}',
      label: t.mergeVehicleYear,
      value: vehicle.manufacturingYear ? String(vehicle.manufacturingYear) : t.noValue,
    },
    { group: 'B', placeholder: '{{vehicle.color}}', label: t.mergeVehicleColor, value: vehicle.color ?? t.noValue },
    {
      group: 'B',
      placeholder: '{{intake.odoKm}}',
      label: t.mergeVehicleOdo,
      value: intake ? `${intake.odoKm.toLocaleString('vi-VN')} km` : t.mergeNotDeliveredYet,
    },
    {
      group: 'B',
      placeholder: '{{intake.accessories}}',
      label: t.mergeVehicleAccessories,
      value: intake && intake.accessories.length > 0 ? intake.accessories.join(', ') : t.noValue,
    },
    { group: 'C', placeholder: '{{rights.selfDrive}}', label: t.mergeUsageRight, value: t.mergeRightsFixedByContract },
    {
      group: 'C',
      placeholder: '{{rights.thirdParty}}',
      label: t.termFieldThirdParty,
      value: yesNo(rights.thirdPartyPlatformAllowed),
    },
    {
      group: 'C',
      placeholder: '{{rights.advertising}}',
      label: t.termFieldAdvertising,
      value: yesNo(rights.advertisingImageAllowed),
    },
    {
      group: 'C',
      placeholder: '{{rights.usageScope}}',
      label: t.termFieldUsageScope,
      value: rights.usageScopeNote ?? t.noValue,
    },
    {
      group: 'D',
      placeholder: '{{term.effective}}',
      label: t.termFieldEffective,
      value: `${formatDate(effectiveFrom)} – ${formatDate(effectiveTo)}`,
    },
    { group: 'D', placeholder: '{{term.autoRenew}}', label: t.termFieldAutoRenew, value: yesNo(autoRenew) },
    {
      group: 'D',
      placeholder: '{{term.noticePeriodDays}}',
      label: t.termFieldNotice,
      value: t.noticeDays(noticePeriodDays),
    },
    {
      group: 'E',
      placeholder: '{{payment.fixedMonthlyAmount}}',
      label: t.termFieldAmount,
      value: formatVnd(paymentTerm.fixedMonthlyAmount),
    },
    {
      group: 'E',
      placeholder: '{{payment.paymentDay}}',
      label: t.termFieldPaymentDay,
      value: t.paymentDayValue(paymentTerm.paymentDay),
    },
    {
      group: 'E',
      placeholder: '{{payment.prorationRule}}',
      label: t.termFieldProration,
      value: CONSIGNMENT_PRORATION_RULE_LABELS[paymentTerm.prorationRule],
    },
    { group: 'E', placeholder: '{{payment.suspendedRule}}', label: t.paymentSuspendedRule, value: t.yes },
    ...RESPONSIBILITY_ITEM_KEYS.map(
      (key): MergeField => ({
        group: 'FG',
        placeholder: `{{responsibility.${key}}}`,
        label: t.responsibility[key],
        value: t.responsibilityCompany,
      }),
    ),
    { group: 'H', placeholder: '{{insurance.byCompany}}', label: t.responsibility.INSURANCE, value: t.mergeInsuranceByCompany },
    { group: 'I', placeholder: '{{rights.ownerNoBlock}}', label: t.mergeGroupI, value: t.mergeOwnerNoBlock },
    { group: 'J', placeholder: '{{termination.outside}}', label: t.mergeGroupJ, value: t.mergeTerminationOutside },
  ]
}

/**
 * Bản điều khoản mới nhất có `effectiveFrom ≤ dateKey`; không có → bản đầu; chưa có bản nào (chưa ký) → điều khoản hợp
 * đồng. Đặt ở `model.ts` (payoutModel re-export) để `summarizeContracts` dùng được mà không tạo vòng import.
 */
export function resolveTermVersion(contract: ConsignmentContract, dateKey: string): ConsignmentTermVersion {
  const sorted = [...contract.termVersions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const effective = sorted.filter((v) => v.effectiveFrom <= dateKey)
  const picked = effective.length > 0 ? effective[effective.length - 1] : sorted[0]
  if (picked) return picked
  return {
    versionNo: 1,
    effectiveFrom: contract.effectiveFrom,
    paymentTerm: contract.paymentTerm,
    source: 'ORIGINAL',
    createdAt: contract.createdAt,
  }
}

export interface ContractSummary {
  effectiveCount: number
  monthlyTotal: number
  expiringSoonCount: number
}

/** KPI màn danh sách: hợp đồng hiệu lực = `ACTIVE` + `SUSPENDED` (SUSPENDED mặc định vẫn trả đủ — BRD mục 10). */
export function summarizeContracts(contracts: ConsignmentContract[], todayKey: string): ContractSummary {
  const running = contracts.filter((c) => c.status === 'ACTIVE' || c.status === 'SUSPENDED')
  return {
    effectiveCount: running.length,
    // VC-BR-05 — tổng theo điều khoản đang áp dụng hôm nay (đã tính phụ lục), không phải điều khoản gốc.
    monthlyTotal: running.reduce((sum, c) => sum + resolveTermVersion(c, todayKey).paymentTerm.fixedMonthlyAmount, 0),
    expiringSoonCount: running.filter((c) => isExpiringSoon(c, todayKey)).length,
  }
}

// ---- Form schema ----

const NUMERIC_RE = /^\d+$/

/** `true` khi chuỗi ngày giờ (ISO hoặc `datetime-local`) nằm sau thời điểm hiện tại. */
export function isFutureDateTime(value: string): boolean {
  const t = new Date(value).getTime()
  return Number.isFinite(t) && t > Date.now()
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9]{9,11}$/

/**
 * Tạo/sửa hồ sơ chủ xe. Field bắt buộc tối thiểu là BA đề xuất (plan mục 0.4 điểm 13): loại, họ tên, SĐT, CCCD (cá nhân)
 * hoặc MST (tổ chức). Không đặt định dạng CCCD/MST cứng (mirror `customers`). Tài khoản ngân hàng tuỳ chọn; ô số tài khoản
 * để trống khi sửa = giữ số cũ (API kiểm tra tính đủ 3 trường sau khi gộp).
 */
export const vehicleOwnerFormSchema = z
  .object({
    ownerType: z.enum(OWNER_TYPES),
    fullName: z.string().trim().min(2, 'Họ tên / tên tổ chức phải có ít nhất 2 ký tự'),
    idNumber: z.string().trim().optional(),
    taxCode: z.string().trim().optional(),
    dateOfBirth: z.string().trim().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    phone: z.string().trim().regex(PHONE_RE, 'Số điện thoại phải gồm 9–11 chữ số'),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || EMAIL_RE.test(v), { message: 'Email không hợp lệ' }),
    address: z.string().trim().optional(),
    bankAccountNumber: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    bankAccountHolder: z.string().trim().optional(),
    /** Form sửa: hồ sơ đã có sẵn số tài khoản (ô số tài khoản để trống = giữ nguyên số cũ). */
    hasExistingBankAccount: z.boolean().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.ownerType === 'INDIVIDUAL' && !v.idNumber) {
      ctx.addIssue({ code: 'custom', path: ['idNumber'], message: 'Số CCCD là bắt buộc với chủ xe cá nhân' })
    }
    if (v.ownerType === 'ORGANIZATION' && !v.taxCode) {
      ctx.addIssue({ code: 'custom', path: ['taxCode'], message: 'Mã số thuế là bắt buộc với tổ chức' })
    }
    if (v.dateOfBirth && !DATE_KEY_RE.test(v.dateOfBirth)) {
      ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Ngày sinh không hợp lệ' })
    }
    if (v.bankAccountNumber) {
      if (!v.bankName) ctx.addIssue({ code: 'custom', path: ['bankName'], message: 'Nhập ngân hàng khi có số tài khoản' })
      if (!v.bankAccountHolder) {
        ctx.addIssue({ code: 'custom', path: ['bankAccountHolder'], message: 'Nhập chủ tài khoản khi có số tài khoản' })
      }
    } else if ((v.bankName || v.bankAccountHolder) && !v.hasExistingBankAccount) {
      // Nhập ngân hàng / chủ tài khoản mà không có số tài khoản (và chưa có tài khoản cũ để giữ) → lỗi ở ô số tài khoản.
      ctx.addIssue({ code: 'custom', path: ['bankAccountNumber'], message: 'Nhập số tài khoản khi có ngân hàng hoặc chủ tài khoản' })
    }
  })

export type VehicleOwnerFormValues = z.infer<typeof vehicleOwnerFormSchema>

/** Tạo/sửa hợp đồng `DRAFT`. Field số khai dạng chuỗi trong form (mirror `vehicleFormSchema`) rồi đổi sang số ở `toInput`. */
export const consignmentContractFormSchema = z
  .object({
    /** Đề nghị ký gửi `APPROVED` chưa dùng — chủ xe + xe suy ra từ đề nghị (UC-VC-03). */
    proposalId: z.string().min(1, 'Chọn đề nghị ký gửi đã duyệt'),
    effectiveFrom: z.string().min(1, 'Ngày bắt đầu hiệu lực là bắt buộc'),
    effectiveTo: z.string().min(1, 'Ngày kết thúc hiệu lực là bắt buộc'),
    noticePeriodDays: z
      .string()
      .trim()
      .refine((v) => NUMERIC_RE.test(v), { message: 'Thời gian báo trước phải là số nguyên không âm' }),
    autoRenew: z.boolean(),
    fixedMonthlyAmount: z
      .string()
      .trim()
      .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Mức chi trả hàng tháng phải là số nguyên lớn hơn 0' }),
    paymentDay: z
      .string()
      .trim()
      .refine((v) => NUMERIC_RE.test(v) && Number(v) >= 1 && Number(v) <= 31, {
        message: 'Ngày chi trả phải từ 1 đến 31',
      }),
    prorationRule: z.enum(CONSIGNMENT_PRORATION_RULES),
    thirdPartyPlatformAllowed: z.boolean(),
    advertisingImageAllowed: z.boolean(),
    usageScopeNote: z.string().trim().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.effectiveFrom && v.effectiveTo && v.effectiveTo <= v.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu hiệu lực',
      })
    }
  })

export type ConsignmentContractFormValues = z.infer<typeof consignmentContractFormSchema>

/** Dialog "Duyệt & xác nhận đã ký" — bản scan là upload giả lập (mirror `ContractSignDialog`). */
export const consignmentSignFormSchema = z.object({
  signedFileName: z.string().trim().min(1, 'Tên file bản scan là bắt buộc'),
})

export type ConsignmentSignFormValues = z.infer<typeof consignmentSignFormSchema>

/** Dialog lý do dùng chung: trả về nháp / tạm ngưng / khôi phục / thay bằng bản mới. */
export const consignmentReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})

export type ConsignmentReasonValues = z.infer<typeof consignmentReasonSchema>

/** Biên bản nhận xe — VC-BR-15 (hai bên xác nhận) + VC-BR-16 (định giá bắt buộc khi nhận xe). */
export const consignmentIntakeFormSchema = z.object({
  handoverAt: z
    .string()
    .min(1, 'Thời điểm nhận xe là bắt buộc')
    .refine((v) => !isFutureDateTime(v), { message: 'Thời điểm nhận xe không được ở tương lai' }),
  odoKm: z.string().trim().refine((v) => NUMERIC_RE.test(v), { message: 'Odo phải là số nguyên không âm' }),
  fuelLevel: z
    .string()
    .trim()
    .refine((v) => NUMERIC_RE.test(v) && Number(v) <= 100, { message: 'Mức nhiên liệu phải từ 0 đến 100' }),
  baselineCondition: z.string().trim().min(3, 'Mô tả hiện trạng là bắt buộc'),
  checklist: z.array(
    z.object({
      item: z.string(),
      ok: z.boolean(),
      note: z.string().trim().optional(),
    }),
  ),
  accessoriesText: z.string().trim().optional(),
  documents: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['ORIGINAL', 'COPY', 'NONE']),
    }),
  ),
  missingDocumentsNote: z.string().trim().optional(),
  mediaNote: z.string().trim().optional(),
  appraisedValue: z
    .string()
    .trim()
    .refine((v) => NUMERIC_RE.test(v) && Number(v) > 0, { message: 'Giá trị định giá phải là số nguyên lớn hơn 0' }),
  companyRepName: z.string().trim().min(2, 'Đại diện công ty là bắt buộc'),
  ownerConfirmed: z.boolean().refine((v) => v === true, { message: 'Cần chủ xe xác nhận biên bản (VC-BR-15)' }),
  companyConfirmed: z.boolean().refine((v) => v === true, { message: 'Cần đại diện công ty xác nhận biên bản (VC-BR-15)' }),
})

export type ConsignmentIntakeFormValues = z.infer<typeof consignmentIntakeFormSchema>
