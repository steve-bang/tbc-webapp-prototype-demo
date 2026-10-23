import { VEHICLES_STORAGE_KEY } from '@/features/vehicles/api'
import type { Vehicle } from '@/features/vehicles'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import type { ConsignmentContractStatus, ConsignmentProrationRule, OwnerType } from '@/shared/domain/enums'
import { addDaysToKey, addMonthsToKey, startOfMonthKey, todayKey, zonedDateTimeToIso } from '@/shared/lib/datetime'
import { readJson, writeJson } from '@/shared/lib/storage'
import {
  CONSIGNMENT_CONTRACTS_STORAGE_KEY,
  CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY,
  CONSIGNMENT_PROPOSALS_STORAGE_KEY,
  OWNER_PAYOUT_RECORDS_STORAGE_KEY,
  VEHICLE_OWNERS_STORAGE_KEY,
} from './storage'
import { applyAddendum, buildAddendum, type ConsignmentAddendum } from './addendumModel'
import {
  buildTermsSnapshot,
  dayDiff,
  EFFECTIVE_CONTRACT_STATUSES,
  INTAKE_CHECKLIST_KEYS,
  INTAKE_DOCUMENT_KEYS,
  nextSequenceCode,
  OPEN_CONTRACT_STATUSES,
  toLocalDateKey,
  type ConsignmentContract,
  type ConsignmentHandoverRecord,
  type ConsignmentStatusChange,
  type OwnerGender,
  type VehicleOwner,
} from './model'
import {
  getProposalCreateBlocker,
  normalizePlate,
  type ConsignmentAppraisal,
  type ConsignmentProposal,
  type ProposalOwnershipCheck,
} from './proposalModel'
import {
  buildExpectedPayouts,
  deriveAmountPayable,
  materializePayoutRecord,
  periodOf,
  type OwnerPayoutAdjustment,
  type OwnerPayoutRecord,
} from './payoutModel'

/**
 * Seed Xe ký gửi (`docs/CONSIGNMENT-PLAN.md` mục 10 + 19.9.1 + 20.10): 10 chủ xe · 22 đề nghị ký gửi (18 backfill + 4 demo)
 * · 19 hợp đồng · 2 phụ lục · 18 biên bản (16 INTAKE + 2 RETURN) · lịch chi trả lịch sử dựng bằng CHÍNH hàm runtime
 * `buildExpectedPayouts` (không gõ tay số tiền / trạng thái); phụ lục dựng bằng `buildAddendum` + `applyAddendum`.
 * Mọi ngày tương đối hôm nay theo NGÀY ĐỊA PHƯƠNG. Snapshot điều khoản dựng bằng `buildTermsSnapshot` từ xe thật
 * (seed `vehicles` chạy trước). Không ghi audit khi seed. Cuối hàm có bước kiểm ràng buộc, vi phạm thì `throw`.
 */

const SEED_ACTOR = 'Trần Thị Quản Lý'
const SEED_COMPANY_REP = 'Trần Thị Quản Lý'
const SEED_ACCOUNTANT = 'Đỗ Thị Kế Toán'
const SEED_SYSTEM = 'Hệ thống'

function dayKey(offset: number): string {
  return addDaysToKey(todayKey(), offset)
}

function addDaysKey(key: string, offset: number): string {
  return addDaysToKey(key, offset)
}

/** Giờ +07 `hour:00` của ngày `key` → ISO. */
function atTime(key: string, hour: number): string {
  return zonedDateTimeToIso(key, hour, 0)
}

/** Ngày `day` của tháng (hiện tại + `monthOffset`). */
function dayOfMonth(monthOffset: number, day: number): string {
  return addDaysToKey(addMonthsToKey(startOfMonthKey(todayKey()), monthOffset), day - 1)
}

// ---- Chủ xe ----

interface OwnerSpec {
  id: string
  ownerType: OwnerType
  fullName: string
  idNumber?: string
  taxCode?: string
  dateOfBirth?: string
  gender?: OwnerGender
  phone: string
  email?: string
  address: string
  bank?: { accountNumber: string; bankName: string; accountHolder: string }
  note?: string
}

const OWNER_SPECS: OwnerSpec[] = [
  {
    id: 'own_001',
    ownerType: 'INDIVIDUAL',
    fullName: 'Trần Minh Khang',
    idNumber: '079075001234',
    dateOfBirth: '1975-04-12',
    gender: 'MALE',
    phone: '0903123456',
    email: 'khang.tran@example.com',
    address: '25 Nguyễn Huệ, Quận 1, TP.HCM',
    bank: { accountNumber: '0071001234567', bankName: 'Vietcombank', accountHolder: 'TRAN MINH KHANG' },
    note: 'Chủ xe lâu năm, ký gửi 3 xe.',
  },
  {
    id: 'own_002',
    ownerType: 'INDIVIDUAL',
    fullName: 'Lê Thị Thu Hà',
    idNumber: '079182005678',
    dateOfBirth: '1982-09-30',
    gender: 'FEMALE',
    phone: '0912345678',
    email: 'thuha.le@example.com',
    address: '112 Lê Văn Sỹ, Quận 3, TP.HCM',
    bank: { accountNumber: '19036789012345', bankName: 'Techcombank', accountHolder: 'LE THI THU HA' },
  },
  {
    id: 'own_003',
    ownerType: 'ORGANIZATION',
    fullName: 'Công ty TNHH Vận tải Phú Gia',
    taxCode: '0312345678',
    phone: '02838123456',
    email: 'ketoan@phugia.example.com',
    address: '88 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM',
    bank: { accountNumber: '1020304050607', bankName: 'BIDV', accountHolder: 'CONG TY TNHH VAN TAI PHU GIA' },
    note: 'Đối tác tổ chức, 3 xe hạng sang.',
  },
  {
    id: 'own_004',
    ownerType: 'INDIVIDUAL',
    fullName: 'Phạm Quốc Bảo',
    idNumber: '079088009999',
    dateOfBirth: '1988-01-18',
    // Cố ý không khai giới tính — field tuỳ chọn (CR-2026-051 Q19).
    phone: '0987654321',
    address: '9 Phan Xích Long, Quận Phú Nhuận, TP.HCM',
    bank: { accountNumber: '0451000099887', bankName: 'MB Bank', accountHolder: 'PHAM QUOC BAO' },
    note: 'Chủ cũ của xe 51B-789.01 (đã bán xe, hợp đồng chấm dứt).',
  },
  {
    id: 'own_005',
    ownerType: 'INDIVIDUAL',
    fullName: 'Võ Hoàng Nam',
    idNumber: '079090002468',
    dateOfBirth: '1990-06-05',
    gender: 'MALE',
    phone: '0933222111',
    address: '47 Cộng Hòa, Quận Tân Bình, TP.HCM',
    bank: { accountNumber: '9704221100334455', bankName: 'ACB', accountHolder: 'VO HOANG NAM' },
  },
  {
    id: 'own_006',
    ownerType: 'INDIVIDUAL',
    fullName: 'Đặng Thị Mai',
    idNumber: '079095013579',
    dateOfBirth: '1995-11-22',
    gender: 'FEMALE',
    phone: '0944556677',
    address: '15 Trần Hưng Đạo, TP. Thủ Đức, TP.HCM',
    bank: { accountNumber: '0061002233445', bankName: 'Vietcombank', accountHolder: 'DANG THI MAI' },
  },
  {
    id: 'own_007',
    ownerType: 'ORGANIZATION',
    fullName: 'Công ty CP Dịch vụ Ô tô Sài Gòn Xanh',
    taxCode: '0309876543',
    phone: '02839998877',
    email: 'info@saigonxanh.example.com',
    address: '210 Võ Văn Kiệt, Quận 5, TP.HCM',
    bank: { accountNumber: '7810203040506', bankName: 'VPBank', accountHolder: 'CONG TY CP DICH VU O TO SAI GON XANH' },
  },
  {
    id: 'own_008',
    ownerType: 'INDIVIDUAL',
    fullName: 'Huỳnh Văn Tài',
    idNumber: '079079024680',
    dateOfBirth: '1979-02-14',
    gender: 'MALE',
    phone: '0977889900',
    address: '63 Nguyễn Thị Minh Khai, Quận 3, TP.HCM',
    bank: { accountNumber: '0381001122334', bankName: 'Vietcombank', accountHolder: 'HUYNH VAN TAI' },
    note: 'Hợp đồng cũ đã đóng, đang ký lại.',
  },
  {
    id: 'own_009',
    ownerType: 'INDIVIDUAL',
    fullName: 'Ngô Thanh Tùng',
    idNumber: '079093011223',
    dateOfBirth: '1993-08-09',
    gender: 'MALE',
    phone: '0966112233',
    address: '5 Lý Thường Kiệt, Quận 10, TP.HCM',
    // Cố ý chưa có tài khoản ngân hàng — vòng sau demo tạm giữ chi trả.
    note: 'Chưa cung cấp tài khoản ngân hàng nhận tiền.',
  },
  {
    id: 'own_010',
    ownerType: 'INDIVIDUAL',
    fullName: 'Bùi Gia Huy',
    idNumber: '079091055667',
    dateOfBirth: '1991-12-01',
    gender: 'MALE',
    phone: '0955667788',
    address: '31 Hoàng Văn Thụ, Quận Tân Bình, TP.HCM',
    bank: { accountNumber: '0501009988776', bankName: 'Sacombank', accountHolder: 'BUI GIA HUY' },
    note: 'Chủ mới của xe 51B-789.01, đang soạn hợp đồng.',
  },
]

function buildOwners(): VehicleOwner[] {
  const owners: VehicleOwner[] = []
  OWNER_SPECS.forEach((spec, index) => {
    // Hồ sơ chủ xe tạo cách đây ~470 ngày, luôn sớm hơn mọi hợp đồng (sớm nhất tạo cách đây 440 ngày).
    const createdAt = atTime(dayKey(-470 + index), 9)
    owners.push({
      id: spec.id,
      code: nextSequenceCode(
        'CX',
        owners.map((o) => o.code),
      ),
      ownerType: spec.ownerType,
      fullName: spec.fullName,
      idNumber: spec.idNumber,
      taxCode: spec.taxCode,
      dateOfBirth: spec.dateOfBirth,
      gender: spec.gender,
      address: spec.address,
      email: spec.email,
      phone: spec.phone,
      bankAccount: spec.bank,
      note: spec.note,
      createdByName: SEED_ACTOR,
      createdAt,
      updatedAt: createdAt,
    })
  })
  return owners
}

// ---- Hợp đồng + biên bản ----

type ContractPhase = 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'CLOSED' | 'DRAFT' | 'PENDING_APPROVAL' | 'SUPERSEDED'

interface ContractSpec {
  vehicleId: string
  ownerId: string
  phase: ContractPhase
  /** Ngày bắt đầu / kết thúc hiệu lực (`YYYY-MM-DD`). */
  from: string
  to: string
  amount: number
  paymentDay: number
  rule: ConsignmentProrationRule
  autoRenew?: boolean
  noticePeriodDays?: number
  thirdParty?: boolean
  advertising?: boolean
  usageScopeNote?: string
  note?: string
  /** Ngày tạo / trình / thay bản (offset ngày) — cho các hợp đồng chưa qua `SIGNED`. */
  createdOffset?: number
  submittedOffset?: number
  supersededOffset?: number
  /** Ngày tạm ngưng / chấm dứt / đóng (offset). */
  endedOffset?: number
  endedReason?: string
  /** Ghi đè ngày nhận xe (biên bản) — mặc định `from − 1`. */
  intakeDate?: string
  missingDocumentsNote?: string
  insuranceCopyOnly?: boolean
}

function buildSpecs(): ContractSpec[] {
  const day15Back2 = dayOfMonth(-2, 15)
  return [
    // 1
    { vehicleId: 'veh_001', ownerId: 'own_001', phase: 'ACTIVE', from: dayKey(-300), to: dayKey(430), amount: 15_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY', autoRenew: true, thirdParty: true },
    // 2 — sắp hết hạn (VC-BR-19)
    { vehicleId: 'veh_002', ownerId: 'own_001', phase: 'ACTIVE', from: dayKey(-345), to: dayKey(20), amount: 9_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY', autoRenew: true },
    // 3
    { vehicleId: 'veh_003', ownerId: 'own_001', phase: 'ACTIVE', from: dayKey(-280), to: dayKey(450), amount: 5_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY' },
    // 4
    { vehicleId: 'veh_004', ownerId: 'own_002', phase: 'ACTIVE', from: dayKey(-270), to: dayKey(460), amount: 9_000_000, paymentDay: 10, rule: 'PRORATE_BY_DAY', advertising: true },
    // 5 — thiếu giấy tờ gốc (nhận xe có ghi chú)
    {
      vehicleId: 'veh_005', ownerId: 'own_002', phase: 'ACTIVE', from: dayKey(-250), to: dayKey(480), amount: 8_000_000, paymentDay: 10, rule: 'PRORATE_BY_DAY',
      insuranceCopyOnly: true, missingDocumentsNote: 'Thiếu bản gốc sổ bảo hiểm, chủ xe cam kết bổ sung.',
    },
    // 6 — thời hạn gốc lúc ký đến dayKey(45); phụ lục gia hạn thuần nâng lên dayKey(410) (xem `seedAddenda`)
    { vehicleId: 'veh_006', ownerId: 'own_003', phase: 'ACTIVE', from: dayKey(-320), to: dayKey(45), amount: 15_000_000, paymentDay: 15, rule: 'PRORATE_BY_DAY', noticePeriodDays: 60, usageScopeNote: 'Xe thế chấp ngân hàng — không đưa ra khỏi địa bàn TP.HCM và lân cận.' },
    // 7 — trả tròn tháng
    { vehicleId: 'veh_011', ownerId: 'own_003', phase: 'ACTIVE', from: dayKey(-200), to: dayKey(530), amount: 15_000_000, paymentDay: 15, rule: 'FULL_MONTH', noticePeriodDays: 60 },
    // 8
    { vehicleId: 'veh_014', ownerId: 'own_003', phase: 'ACTIVE', from: dayKey(-190), to: dayKey(540), amount: 15_000_000, paymentDay: 15, rule: 'PRORATE_BY_DAY', noticePeriodDays: 60 },
    // 9 — ngày chi trả 31 (kẹp ngày cuối tháng)
    { vehicleId: 'veh_008', ownerId: 'own_005', phase: 'ACTIVE', from: dayKey(-230), to: dayKey(500), amount: 9_000_000, paymentDay: 31, rule: 'PRORATE_BY_DAY' },
    // 10 — tạm ngưng
    {
      vehicleId: 'veh_009', ownerId: 'own_005', phase: 'SUSPENDED', from: dayKey(-220), to: dayKey(510), amount: 9_000_000, paymentDay: 31, rule: 'PRORATE_BY_DAY',
      endedOffset: -12, endedReason: 'Tranh chấp điều khoản với chủ xe, chờ làm rõ.',
    },
    // 11
    { vehicleId: 'veh_010', ownerId: 'own_006', phase: 'ACTIVE', from: dayKey(-210), to: dayKey(520), amount: 5_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY' },
    // 12
    { vehicleId: 'veh_012', ownerId: 'own_007', phase: 'ACTIVE', from: dayKey(-240), to: dayKey(490), amount: 9_000_000, paymentDay: 20, rule: 'PRORATE_BY_DAY', thirdParty: true },
    // 13
    { vehicleId: 'veh_015', ownerId: 'own_007', phase: 'ACTIVE', from: dayKey(-160), to: dayKey(570), amount: 8_000_000, paymentDay: 20, rule: 'PRORATE_BY_DAY' },
    // 14 — kích hoạt giữa tháng (vòng sau prorate tháng đầu)
    {
      vehicleId: 'veh_016', ownerId: 'own_009', phase: 'ACTIVE', from: day15Back2, to: addDaysKey(dayOfMonth(10, 15), -1), amount: 5_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY',
      intakeDate: dayOfMonth(-2, 14),
    },
    // 15 — đã chấm dứt (chủ cũ bán xe)
    {
      vehicleId: 'veh_007', ownerId: 'own_004', phase: 'TERMINATED', from: dayKey(-400), to: dayKey(330), amount: 9_000_000, paymentDay: 10, rule: 'PRORATE_BY_DAY',
      endedOffset: -35, endedReason: 'Chủ xe bán xe, hai bên thống nhất chấm dứt trước hạn.',
    },
    // 16 — bản nháp cho chủ mới của veh_007
    { vehicleId: 'veh_007', ownerId: 'own_010', phase: 'DRAFT', from: dayKey(7), to: dayKey(372), amount: 9_000_000, paymentDay: 10, rule: 'PRORATE_BY_DAY', createdOffset: -3 },
    // 17 — đã đóng (xe về chủ)
    {
      vehicleId: 'veh_013', ownerId: 'own_008', phase: 'CLOSED', from: dayKey(-430), to: dayKey(-66), amount: 5_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY',
      endedOffset: -60, endedReason: 'Hết hạn hợp đồng, đã trả xe về chủ xe.',
    },
    // 18 — nhập sai mức, bị thay bằng #19
    { vehicleId: 'veh_013', ownerId: 'own_008', phase: 'SUPERSEDED', from: dayKey(5), to: dayKey(370), amount: 4_500_000, paymentDay: 5, rule: 'PRORATE_BY_DAY', createdOffset: -20, supersededOffset: -10, endedReason: 'Nhập sai mức chi trả hàng tháng, lập lại bản mới.' },
    // 19 — chờ duyệt, thay #18
    { vehicleId: 'veh_013', ownerId: 'own_008', phase: 'PENDING_APPROVAL', from: dayKey(5), to: dayKey(370), amount: 5_000_000, paymentDay: 5, rule: 'PRORATE_BY_DAY', createdOffset: -10, submittedOffset: -2 },
  ]
}

const APPRAISAL_BASE = { VIP_LUXURY: 1_100_000_000, STANDARD: 550_000_000, TWO_SEATER: 300_000_000 } as const
const APPRAISAL_STEP = { VIP_LUXURY: 50_000_000, STANDARD: 25_000_000, TWO_SEATER: 10_000_000 } as const
const ACCESSORY_SETS = [
  ['Đăng ký xe (bản sao)', 'Lốp dự phòng', 'Thảm sàn', 'Camera hành trình'],
  ['Lốp dự phòng', 'Thảm sàn', 'Bộ dụng cụ sửa xe'],
  ['Thảm sàn', 'Camera hành trình', 'Cáp sạc điện thoại'],
]

function seedContractsAndRecords(owners: VehicleOwner[], vehicles: Vehicle[]) {
  const specs = buildSpecs()
  const contracts: ConsignmentContract[] = []
  const records: ConsignmentHandoverRecord[] = []
  const pendingReturns: Array<{ contract: ConsignmentContract; vehicle: Vehicle; endedAt: string }> = []
  const endedAtByContract = new Map<string, string>()

  specs.forEach((spec, index) => {
    const owner = owners.find((o) => o.id === spec.ownerId)
    const vehicle = vehicles.find((v) => v.id === spec.vehicleId)
    if (!owner || !vehicle) throw new Error(`[seed consignment] thiếu chủ xe hoặc xe cho hợp đồng #${index + 1}`)

    const id = `cg_${String(index + 1).padStart(3, '0')}`
    const contractNo = nextSequenceCode(
      'HDKG',
      contracts.map((c) => c.contractNo),
    )
    const base = {
      effectiveFrom: spec.from,
      effectiveTo: spec.to,
      noticePeriodDays: spec.noticePeriodDays ?? 30,
      autoRenew: spec.autoRenew ?? false,
      paymentTerm: {
        model: 'FIXED_MONTHLY' as const,
        fixedMonthlyAmount: spec.amount,
        paymentDay: spec.paymentDay,
        prorationRule: spec.rule,
      },
      exploitationRights: {
        thirdPartyPlatformAllowed: spec.thirdParty ?? false,
        advertisingImageAllowed: spec.advertising ?? false,
        usageScopeNote: spec.usageScopeNote,
      },
    }

    const passedSigned = ['ACTIVE', 'SUSPENDED', 'TERMINATED', 'CLOSED'].includes(spec.phase)
    const history: ConsignmentStatusChange[] = []
    let status: ConsignmentContractStatus = 'DRAFT'
    let createdAt: string
    let termsSnapshot: ConsignmentContract['termsSnapshot']
    let termVersions: ConsignmentContract['termVersions'] = []
    let signedCopy: ConsignmentContract['signedCopy']
    let intakeRecordId: string | undefined
    let activatedAt: string | undefined
    let updatedAt: string
    let supersedesContractId: string | undefined
    let supersededByContractId: string | undefined

    if (passedSigned) {
      // tạo ≤ trình ≤ ký ≤ biên bản ≤ kích hoạt ≤ tạm ngưng/kết thúc ≤ hôm nay
      const createdKey = addDaysKey(spec.from, -10)
      const submittedKey = addDaysKey(spec.from, -8)
      const signedKey = addDaysKey(spec.from, -5)
      const intakeKey = spec.intakeDate ?? addDaysKey(spec.from, -1)
      createdAt = atTime(createdKey, 9)
      const signedAt = atTime(signedKey, 10)
      activatedAt = atTime(spec.from, 9)
      history.push(
        { to: 'DRAFT', at: createdAt, byName: SEED_ACTOR },
        { from: 'DRAFT', to: 'PENDING_APPROVAL', at: atTime(submittedKey, 9), byName: SEED_ACTOR },
        { from: 'PENDING_APPROVAL', to: 'SIGNED', at: signedAt, byName: SEED_ACTOR },
        { from: 'SIGNED', to: 'ACTIVE', at: activatedAt, byName: SEED_ACTOR },
      )
      status = 'ACTIVE'
      updatedAt = activatedAt
      if (spec.endedOffset !== undefined) {
        const endedAt = atTime(dayKey(spec.endedOffset), 10)
        status = spec.phase as ConsignmentContractStatus
        history.push({ from: 'ACTIVE', to: status, at: endedAt, byName: SEED_ACTOR, reason: spec.endedReason })
        updatedAt = endedAt
        if (spec.phase === 'TERMINATED' || spec.phase === 'CLOSED') endedAtByContract.set(id, endedAt)
      }
      const draftForSnapshot = { ...base }
      termsSnapshot = buildTermsSnapshot(draftForSnapshot, owner, vehicle, signedAt)
      termVersions = [
        { versionNo: 1, effectiveFrom: spec.from, paymentTerm: { ...base.paymentTerm }, source: 'ORIGINAL', createdAt: signedAt },
      ]
      signedCopy = {
        fileName: `${contractNo}-da-ky.pdf`,
        uploadedByName: SEED_ACTOR,
        uploadedAt: signedAt,
      }

      // Biên bản nhận xe (INTAKE) — odo luôn nhỏ hơn odo hiện tại của xe.
      const recordSeq = records.length + 1
      const recordId = `cgh_${String(recordSeq).padStart(3, '0')}`
      const cls = vehicle.vehicleClass
      const handoverAt = atTime(intakeKey, 9)
      records.push({
        id: recordId,
        code: nextSequenceCode(
          'BBKG',
          records.map((r) => r.code),
        ),
        type: 'INTAKE',
        contractId: id,
        vehicleId: vehicle.id,
        ownerId: owner.id,
        handoverAt,
        odoKm: Math.floor((vehicle.currentKm * 0.55) / 100) * 100,
        fuelLevel: 60 + ((index * 7) % 41),
        baselineCondition:
          index % 3 === 0
            ? 'Xe sạch sẽ, sơn zin, nội thất còn mới, không có hư hỏng đáng kể.'
            : index % 3 === 1
              ? 'Xe hoạt động tốt, có vài vết xước nhỏ ở cản sau và mâm bánh trước.'
              : 'Xe đã sử dụng nhiều, nội thất hơi mòn ở ghế lái, máy móc vận hành bình thường.',
        checklist: [
          { item: 'EXTERIOR', ok: true, note: index % 3 === 1 ? 'Xước nhẹ cản sau' : undefined },
          { item: 'INTERIOR', ok: true },
          { item: 'MECHANICAL', ok: true },
        ],
        accessories: ACCESSORY_SETS[index % ACCESSORY_SETS.length],
        documentsReceived: [
          { name: 'Đăng ký xe', kind: 'ORIGINAL' },
          { name: 'Đăng kiểm', kind: 'ORIGINAL' },
          { name: 'Bảo hiểm', kind: spec.insuranceCopyOnly ? 'COPY' : 'ORIGINAL' },
        ],
        missingDocumentsNote: spec.missingDocumentsNote,
        mediaNote: 'Ảnh ngoại thất 4 góc và nội thất đã lưu (giả lập).',
        appraisedValue: APPRAISAL_BASE[cls] + (index % 5) * APPRAISAL_STEP[cls],
        companyRepName: SEED_COMPANY_REP,
        ownerConfirmed: true,
        companyConfirmed: true,
        createdByName: SEED_ACTOR,
        createdAt: handoverAt,
      })
      intakeRecordId = recordId
    } else {
      const createdKey = dayKey(spec.createdOffset ?? -1)
      createdAt = atTime(createdKey, 9)
      history.push({ to: 'DRAFT', at: createdAt, byName: SEED_ACTOR })
      updatedAt = createdAt
      if (spec.phase === 'PENDING_APPROVAL') {
        const submittedAt = atTime(dayKey(spec.submittedOffset ?? -1), 9)
        status = 'PENDING_APPROVAL'
        history.push({ from: 'DRAFT', to: 'PENDING_APPROVAL', at: submittedAt, byName: SEED_ACTOR })
        updatedAt = submittedAt
        supersedesContractId = 'cg_018'
      }
      if (spec.phase === 'SUPERSEDED') {
        const supersededAt = atTime(dayKey(spec.supersededOffset ?? -1), 9)
        status = 'SUPERSEDED'
        history.push({ from: 'DRAFT', to: 'SUPERSEDED', at: supersededAt, byName: SEED_ACTOR, reason: spec.endedReason })
        updatedAt = supersededAt
        supersededByContractId = 'cg_019'
      }
    }

    // Chấm dứt trước hạn / hết hạn (kế hoạch mục 19.9.1): ngày kết thúc tính tiền + thông báo chấm dứt nếu có.
    const endedAtIso = endedAtByContract.get(id)
    let endedDate: string | undefined
    let endReason: ConsignmentContract['endReason']
    let terminationNotice: ConsignmentContract['terminationNotice']
    if (status === 'TERMINATED' && endedAtIso) {
      endedDate = toLocalDateKey(endedAtIso)
      endReason = 'EARLY_TERMINATION'
      const noticeDate = addDaysKey(endedDate, -base.noticePeriodDays)
      terminationNotice = {
        requestedBy: 'OWNER',
        noticeDate,
        plannedEndDate: endedDate,
        reason: spec.endedReason ?? 'Chấm dứt trước hạn',
        recordedByName: SEED_ACTOR,
        recordedAt: atTime(noticeDate, 9),
      }
    }
    if (status === 'CLOSED') {
      endedDate = base.effectiveTo
      endReason = 'EXPIRED'
    }

    const contract: ConsignmentContract = {
      id,
      contractNo,
      ownerId: owner.id,
      vehicleId: vehicle.id,
      // Khoá tạm của chuỗi hợp đồng — `seedConsignment` đổi sang id đề nghị thật sau khi dựng đề nghị (#18 + #19 dùng chung một).
      proposalId: index === 18 ? 'cg_018' : id,
      status,
      ...base,
      terminationNotice,
      endedDate,
      endReason,
      termsSnapshot,
      termVersions,
      addenda: [],
      signedCopy,
      intakeRecordId,
      activatedAt,
      supersedesContractId,
      supersededByContractId,
      statusHistory: history,
      note: spec.note,
      createdByName: SEED_ACTOR,
      createdAt,
      updatedAt,
    }
    contracts.push(contract)
    const endedAt = endedAtByContract.get(id)
    if (endedAt) pendingReturns.push({ contract, vehicle, endedAt })
  })

  // 2 biên bản RETURN (hợp đồng đã chấm dứt / đã đóng).
  for (const { contract, vehicle, endedAt } of pendingReturns) {
    const recordSeq = records.length + 1
    contract.returnRecordId = `cgh_${String(recordSeq).padStart(3, '0')}`
    records.push({
      id: `cgh_${String(recordSeq).padStart(3, '0')}`,
      code: nextSequenceCode(
        'BBKG',
        records.map((r) => r.code),
      ),
      type: 'RETURN',
      contractId: contract.id,
      vehicleId: vehicle.id,
      ownerId: contract.ownerId,
      handoverAt: endedAt,
      odoKm: vehicle.currentKm,
      fuelLevel: 50,
      baselineCondition: 'Xe được trả về chủ xe, tình trạng chung tốt, đã vệ sinh trước khi bàn giao.',
      checklist: [
        { item: 'EXTERIOR', ok: true },
        { item: 'INTERIOR', ok: true },
        { item: 'MECHANICAL', ok: true },
      ],
      accessories: ['Đăng ký xe (bản sao)', 'Lốp dự phòng', 'Thảm sàn'],
      documentsReceived: [
        { name: 'Đăng ký xe', kind: 'ORIGINAL' },
        { name: 'Đăng kiểm', kind: 'ORIGINAL' },
        { name: 'Bảo hiểm', kind: 'ORIGINAL' },
      ],
      mediaNote: 'Ảnh bàn giao trả xe đã lưu (giả lập).',
      companyRepName: SEED_COMPANY_REP,
      ownerConfirmed: true,
      companyConfirmed: true,
      createdByName: SEED_ACTOR,
      createdAt: endedAt,
    })
  }

  return { contracts, records }
}

// ---- Lịch chi trả lịch sử (kế hoạch mục 19.9.1) ----

function minIso(a: string, b: string): string {
  return a < b ? a : b
}
function maxIso(a: string, b: string): string {
  return a > b ? a : b
}

/**
 * Record cho mọi hợp đồng đã kích hoạt, dựng bằng `buildExpectedPayouts` (cùng hàm runtime). Trạng thái theo luật, không
 * gõ tay từng bản: (a) chủ xe chưa có tài khoản → tạo ra đã `ON_HOLD`; (b) hợp đồng tạm ngưng → khoản có hạn chi từ ngày
 * tạm ngưng trở đi `ON_HOLD`; (c) `cg_012` kỳ trước có điều chỉnh −1.000.000 đã duyệt; (d) `cg_013` kỳ hiện tại có điều chỉnh
 * +500.000 chờ duyệt. Mốc thời gian luôn nằm trong `[createdAt, now]`.
 */
function buildPayoutRecords(owners: VehicleOwner[], contracts: ConsignmentContract[]): OwnerPayoutRecord[] {
  const nowIso = new Date().toISOString()
  const currentPeriod = periodOf(dayKey(0))
  const previousPeriod = periodOf(dayOfMonth(-1, 1))
  const records: OwnerPayoutRecord[] = []
  let adjustmentSeq = 0

  for (const contract of contracts) {
    if (!contract.activatedAt) continue
    const owner = owners.find((o) => o.id === contract.ownerId)
    if (!owner) throw new Error(`[seed consignment] thiếu chủ xe cho hợp đồng ${contract.contractNo}`)
    const suspendedAt =
      contract.status === 'SUSPENDED' ? [...contract.statusHistory].reverse().find((h) => h.to === 'SUSPENDED')?.at : undefined

    for (const draft of buildExpectedPayouts(contract, currentPeriod)) {
      const seq = records.length + 1
      const createdAt = minIso(maxIso(atTime(`${draft.period}-01`, 8), contract.activatedAt), nowIso)
      const holdNoBank = !owner.bankAccount ? 'Chủ xe chưa cung cấp tài khoản ngân hàng' : undefined
      let record = materializePayoutRecord(
        { ...draft, holdReason: holdNoBank },
        { id: `opr_${String(seq).padStart(3, '0')}`, code: `CTCX-${String(seq).padStart(6, '0')}`, createdAt, createdByName: SEED_SYSTEM },
      )

      // (b) Hợp đồng tạm ngưng: khoản có hạn chi từ ngày tạm ngưng trở đi bị tạm giữ.
      if (suspendedAt && record.status === 'SCHEDULED' && record.dueDate >= toLocalDateKey(suspendedAt)) {
        const holdAt = minIso(maxIso(createdAt, suspendedAt), nowIso)
        const reason = 'Tạm giữ do tranh chấp điều khoản, chờ làm rõ'
        record = {
          ...record,
          status: 'ON_HOLD',
          holdReason: reason,
          statusHistory: [...record.statusHistory, { from: 'SCHEDULED', to: 'ON_HOLD', at: holdAt, byName: SEED_ACTOR, reason }],
          updatedAt: holdAt,
        }
      }

      // (c) / (d) Điều chỉnh thủ công.
      const addAdjustment = (amount: number, note: string, approved: boolean): void => {
        adjustmentSeq += 1
        const requestedAt = minIso(new Date(new Date(createdAt).getTime() + 86_400_000).toISOString(), nowIso)
        const decidedAt = minIso(new Date(new Date(requestedAt).getTime() + 2 * 3_600_000).toISOString(), nowIso)
        const adjustment: OwnerPayoutAdjustment = {
          id: `opa_${String(adjustmentSeq).padStart(3, '0')}`,
          amount,
          note,
          status: approved ? 'APPROVED' : 'PENDING_APPROVAL',
          requestedByName: SEED_ACCOUNTANT,
          requestedByRole: 'ACCOUNTANT',
          requestedAt,
          decidedByName: approved ? SEED_ACTOR : undefined,
          decidedAt: approved ? decidedAt : undefined,
        }
        const adjustments = [...record.adjustments, adjustment]
        record = {
          ...record,
          adjustments,
          amountPayable: deriveAmountPayable({ baseAmount: record.baseAmount, adjustments }),
          updatedAt: approved ? decidedAt : requestedAt,
        }
      }
      if (contract.id === 'cg_012' && draft.period === previousPeriod) {
        addAdjustment(-1_000_000, 'Hai bên thống nhất giảm do xe nằm xưởng 5 ngày vì lỗi công ty', true)
      }
      if (contract.id === 'cg_013' && draft.period === currentPeriod) {
        addAdjustment(500_000, 'Hỗ trợ phí gửi xe theo thoả thuận', false)
      }
      records.push(record)
    }
  }
  return records
}

// ---- Phụ lục (kế hoạch mục 20.10 điểm 4–6) ----

/**
 * 2 phụ lục dựng bằng hàm runtime `buildAddendum` + `applyAddendum` (không gõ tay phiên bản / tổng):
 * - `cg_004`: đổi mức 9.000.000 → 9.500.000 hiệu lực ngày 1 của THÁNG HIỆN TẠI, ký ngày 25 tháng trước (AC-VC-012);
 * - `cg_006`: gia hạn thuần `dayKey(45)` → `dayKey(410)`, ký `dayKey(-10)`.
 * Mã `PLKG-` theo thứ tự `signedDate`. Trả về hợp đồng đã áp phụ lục (thay thế cùng id).
 */
function seedAddenda(contracts: ConsignmentContract[]): ConsignmentContract[] {
  const plans: Array<{
    contractId: string
    signedDate: string
    build: (contract: ConsignmentContract, meta: { id: string; addendumNo: string; byName: string; now: string }) => ConsignmentAddendum
  }> = [
    {
      contractId: 'cg_004',
      signedDate: dayOfMonth(-1, 25),
      build: (contract, meta) =>
        buildAddendum(
          contract,
          {
            origin: 'MANUAL',
            signedDate: dayOfMonth(-1, 25),
            termChange: {
              effectiveFrom: dayOfMonth(0, 1),
              to: { fixedMonthlyAmount: 9_500_000, paymentDay: contract.paymentTerm.paymentDay, prorationRule: contract.paymentTerm.prorationRule },
            },
            content: 'Điều chỉnh mức thuê theo thoả thuận khi chủ xe lắp thêm camera hành trình và phim cách nhiệt',
            signedFileName: `${meta.addendumNo}-da-ky.pdf`,
          },
          meta,
        ),
    },
    {
      contractId: 'cg_006',
      signedDate: dayKey(-10),
      build: (contract, meta) =>
        buildAddendum(
          contract,
          {
            origin: 'MANUAL',
            signedDate: dayKey(-10),
            extension: { toEffectiveTo: dayKey(410) },
            content: 'Gia hạn hợp đồng thêm một năm theo thoả thuận của hai bên, giữ nguyên điều khoản chi trả',
            signedFileName: `${meta.addendumNo}-da-ky.pdf`,
          },
          meta,
        ),
    },
  ]
  plans.sort((a, b) => a.signedDate.localeCompare(b.signedDate))

  let result = contracts
  const codes: string[] = []
  plans.forEach((plan, index) => {
    const contract = result.find((c) => c.id === plan.contractId)
    if (!contract) throw new Error(`[seed consignment] thiếu hợp đồng ${plan.contractId} để lập phụ lục`)
    const addendumNo = nextSequenceCode('PLKG', codes)
    codes.push(addendumNo)
    const addendum = plan.build(contract, {
      id: `cga_${String(index + 1).padStart(3, '0')}`,
      addendumNo,
      byName: SEED_ACTOR,
      now: atTime(plan.signedDate, 14),
    })
    const applied = applyAddendum(contract, addendum)
    result = result.map((c) => (c.id === contract.id ? applied : c))
  })
  return result
}

// ---- Đề nghị ký gửi (kế hoạch mục 20.10 điểm 1–3) ----

interface ProposalDraft {
  /** Khoá tạm (id hợp đồng đầu chuỗi hoặc `demo_*`) — đổi sang id thật sau khi sắp theo `createdAt`. */
  key: string
  proposal: Omit<ConsignmentProposal, 'id' | 'code'>
}

function shiftIso(iso: string, deltaMs: number): string {
  return new Date(new Date(iso).getTime() + deltaMs).toISOString()
}

function buildAppraisal(args: {
  ownershipCheck: ProposalOwnershipCheck
  failedDocuments?: Array<(typeof INTAKE_DOCUMENT_KEYS)[number]>
  odoKm: number
  accessories: string[]
  conditionNote: string
  appraisedValue: number
  pendingDocumentsNote?: string
  appraisedAt: string
}): ConsignmentAppraisal {
  return {
    ownershipCheck: args.ownershipCheck,
    documents: INTAKE_DOCUMENT_KEYS.map((key) => ({ key, ok: !args.failedDocuments?.includes(key) })),
    checklist: INTAKE_CHECKLIST_KEYS.map((item) => ({ item, ok: true })),
    odoKm: Math.max(0, args.odoKm),
    accessories: args.accessories,
    mediaNote: 'Ảnh ngoại thất 4 góc và nội thất đã lưu (giả lập).',
    conditionNote: args.conditionNote,
    appraisedValue: args.appraisedValue,
    pendingDocumentsNote: args.pendingDocumentsNote,
    appraisedByName: SEED_ACTOR,
    appraisedAt: args.appraisedAt,
  }
}

/**
 * 22 đề nghị: 18 backfill `APPROVED` đã dùng (mỗi chuỗi hợp đồng một đề nghị; #18 + #19 dùng chung) + 4 demo
 * (`SUBMITTED` / `APPRAISING` có giấy tờ chưa đạt / `REJECTED` không chính chủ / `APPROVED` chưa dùng, xe chưa có ở Danh sách xe).
 * Mốc backfill = ngày tạo hợp đồng đầu chuỗi: −10 tạo · −8 bắt đầu thẩm định · −7 ghi kết quả · −6 duyệt; nếu trước ngày tạo hồ
 * sơ chủ xe thì dời cả chuỗi mốc về sau (giữ thứ tự). Mã `DNKG-` và id cấp theo thứ tự `createdAt`.
 */
function buildProposals(
  owners: VehicleOwner[],
  vehicles: Vehicle[],
  contracts: ConsignmentContract[],
  records: ConsignmentHandoverRecord[],
): ProposalDraft[] {
  const drafts: ProposalDraft[] = []
  const chains = new Map<string, ConsignmentContract[]>()
  for (const c of contracts) chains.set(c.proposalId, [...(chains.get(c.proposalId) ?? []), c])

  let chainIndex = 0
  for (const [key, chain] of chains) {
    chainIndex += 1
    const head = chain[0]
    const last = chain[chain.length - 1]
    const owner = owners.find((o) => o.id === head.ownerId)
    const vehicle = vehicles.find((v) => v.id === head.vehicleId)
    if (!owner || !vehicle) throw new Error(`[seed consignment] thiếu chủ xe hoặc xe cho đề nghị của hợp đồng ${head.contractNo}`)
    const intake = records.find((r) => r.type === 'INTAKE' && chain.some((c) => c.id === r.contractId))

    const anchor = toLocalDateKey(head.createdAt)
    let times = [atTime(addDaysKey(anchor, -10), 9), atTime(addDaysKey(anchor, -8), 9), atTime(addDaysKey(anchor, -7), 10), atTime(addDaysKey(anchor, -6), 14)]
    const earliest = shiftIso(owner.createdAt, 3_600_000)
    if (times[0] < earliest) {
      const delta = new Date(earliest).getTime() - new Date(times[0]).getTime()
      times = times.map((t) => shiftIso(t, delta))
    }
    const [createdAt, startedAt, appraisedAt, decidedAt] = times

    const cls = vehicle.vehicleClass
    // Chuỗi không có biên bản nhận xe (#16, #18/#19): giá trị cố định trong khoảng hạng xe (plan mục 10.3).
    const fixedValue = APPRAISAL_BASE[cls] + (key === 'cg_016' ? 2 : 1) * APPRAISAL_STEP[cls]
    const appraisal = buildAppraisal({
      ownershipCheck: 'REGISTERED_OWNER',
      odoKm: (intake ? intake.odoKm : vehicle.currentKm) - 50,
      accessories: intake ? intake.accessories : ACCESSORY_SETS[chainIndex % ACCESSORY_SETS.length],
      conditionNote: intake ? intake.baselineCondition : 'Xe vận hành tốt, ngoại thất và nội thất còn đẹp, đủ giấy tờ theo khai báo.',
      appraisedValue: intake?.appraisedValue ?? fixedValue,
      appraisedAt,
    })
    drafts.push({
      key,
      proposal: {
        ownerId: owner.id,
        declaredVehicle: {
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          manufacturingYear: vehicle.manufacturingYear,
          color: vehicle.color,
        },
        vehicleId: vehicle.id,
        declaredCondition: `Xe ${vehicle.brand} ${vehicle.model}${vehicle.manufacturingYear ? ` đời ${vehicle.manufacturingYear}` : ''}, đang sử dụng bình thường, máy móc vận hành tốt, chủ xe đủ giấy tờ.`,
        expectedMonthlyAmount: last.paymentTerm.fixedMonthlyAmount,
        status: 'APPROVED',
        appraisal,
        decidedByName: SEED_ACTOR,
        decidedAt,
        statusHistory: [
          { to: 'SUBMITTED', at: createdAt, byName: SEED_ACTOR },
          { from: 'SUBMITTED', to: 'APPRAISING', at: startedAt, byName: SEED_ACTOR },
          { from: 'APPRAISING', to: 'APPROVED', at: decidedAt, byName: SEED_ACTOR },
        ],
        createdByName: SEED_ACTOR,
        createdAt,
        updatedAt: decidedAt,
      },
    })
  }

  // ---- 4 đề nghị demo (biển số không trùng xe ở Danh sách xe và không trùng nhau) ----
  const at = (offset: number, hour: number): string => atTime(dayKey(offset), hour)
  const base = (ownerId: string, plate: string, brand: string, model: string, year: number, color: string, condition: string, expected: number) => ({
    ownerId,
    declaredVehicle: { plate, brand, model, manufacturingYear: year, color },
    declaredCondition: condition,
    expectedMonthlyAmount: expected,
    createdByName: SEED_ACTOR,
  })

  // SUBMITTED — vừa ghi nhận.
  drafts.push({
    key: 'demo_submitted',
    proposal: {
      ...base('own_005', '51C-135.79', 'Toyota', 'Vios', 2022, 'Trắng', 'Xe gia đình, ít sử dụng, nội thất sạch, chưa từng tai nạn.', 8_000_000),
      status: 'SUBMITTED',
      statusHistory: [{ to: 'SUBMITTED', at: at(-2, 15), byName: SEED_ACTOR }],
      createdAt: at(-2, 15),
      updatedAt: at(-2, 15),
    },
  })

  // APPRAISING — đã ghi kết quả, đăng kiểm chưa đạt (UC-VC-02 A2).
  drafts.push({
    key: 'demo_appraising',
    proposal: {
      ...base('own_002', '51D-246.80', 'Mazda', 'CX-5', 2021, 'Đỏ', 'Xe SUV 5 chỗ, bảo dưỡng định kỳ đầy đủ tại hãng.', 9_500_000),
      status: 'APPRAISING',
      appraisal: buildAppraisal({
        ownershipCheck: 'REGISTERED_OWNER',
        failedDocuments: ['INSPECTION'],
        odoKm: 42_300,
        accessories: ['Lốp dự phòng', 'Thảm sàn', 'Camera hành trình'],
        conditionNote: 'Ngoại thất có vài vết xước nhỏ ở cản trước, nội thất sạch, máy móc vận hành êm.',
        appraisedValue: 720_000_000,
        pendingDocumentsNote: 'Đăng kiểm đã hết hạn — chủ xe cam kết đăng kiểm lại trước khi bàn giao',
        appraisedAt: at(-4, 11),
      }),
      statusHistory: [
        { to: 'SUBMITTED', at: at(-6, 9), byName: SEED_ACTOR },
        { from: 'SUBMITTED', to: 'APPRAISING', at: at(-5, 9), byName: SEED_ACTOR },
      ],
      createdAt: at(-6, 9),
      updatedAt: at(-4, 11),
    },
  })

  // REJECTED — không chính chủ (EX-01): xác minh chủ sở hữu không hợp lệ chỉ được từ chối.
  drafts.push({
    key: 'demo_rejected',
    proposal: {
      ...base('own_010', '51F-357.91', 'Hyundai', 'Accent', 2020, 'Bạc', 'Xe 5 chỗ chạy dịch vụ nhiều năm, ngoại thất xuống cấp.', 6_000_000),
      status: 'REJECTED',
      appraisal: buildAppraisal({
        ownershipCheck: 'INVALID',
        failedDocuments: ['REGISTRATION'],
        odoKm: 98_500,
        accessories: ['Lốp dự phòng'],
        conditionNote: 'Xe đã sử dụng nhiều, nội thất mòn, giấy đăng ký đứng tên người khác.',
        appraisedValue: 290_000_000,
        appraisedAt: at(-13, 10),
      }),
      rejectReason: 'Người đề nghị không phải chủ đăng ký, giấy uỷ quyền chưa công chứng',
      decidedByName: SEED_ACTOR,
      decidedAt: at(-12, 14),
      statusHistory: [
        { to: 'SUBMITTED', at: at(-15, 9), byName: SEED_ACTOR },
        { from: 'SUBMITTED', to: 'APPRAISING', at: at(-14, 9), byName: SEED_ACTOR },
        {
          from: 'APPRAISING',
          to: 'REJECTED',
          at: at(-12, 14),
          byName: SEED_ACTOR,
          reason: 'Người đề nghị không phải chủ đăng ký, giấy uỷ quyền chưa công chứng',
        },
      ],
      createdAt: at(-15, 9),
      updatedAt: at(-12, 14),
    },
  })

  // APPROVED chưa dùng — xe CHƯA có ở Danh sách xe (demo luồng: tạo xe hình thức Ký gửi rồi mới soạn hợp đồng).
  drafts.push({
    key: 'demo_approved',
    proposal: {
      ...base('own_006', '51G-468.02', 'Kia', 'Morning', 2020, 'Vàng', 'Xe nhỏ đi phố, tiết kiệm nhiên liệu, nội thất còn mới.', 5_000_000),
      status: 'APPROVED',
      appraisal: buildAppraisal({
        ownershipCheck: 'REGISTERED_OWNER',
        odoKm: 36_800,
        accessories: ['Thảm sàn', 'Cáp sạc điện thoại'],
        conditionNote: 'Xe sạch, sơn zin, không hư hỏng; lốp còn khoảng 70%.',
        appraisedValue: 310_000_000,
        appraisedAt: at(-6, 10),
      }),
      decidedByName: SEED_ACTOR,
      decidedAt: at(-3, 14),
      statusHistory: [
        { to: 'SUBMITTED', at: at(-9, 9), byName: SEED_ACTOR },
        { from: 'SUBMITTED', to: 'APPRAISING', at: at(-8, 9), byName: SEED_ACTOR },
        { from: 'APPRAISING', to: 'APPROVED', at: at(-3, 14), byName: SEED_ACTOR },
      ],
      createdAt: at(-9, 9),
      updatedAt: at(-3, 14),
    },
  })

  return drafts
}

/** Sắp theo `createdAt`, cấp id `cgp_001…` + mã `DNKG-000001…`; trả thêm bảng khoá tạm → id thật. */
function finalizeProposals(drafts: ProposalDraft[]): { proposals: ConsignmentProposal[]; idByKey: Map<string, string> } {
  const sorted = [...drafts].sort((a, b) => a.proposal.createdAt.localeCompare(b.proposal.createdAt))
  const idByKey = new Map<string, string>()
  const proposals = sorted.map((draft, index): ConsignmentProposal => {
    const id = `cgp_${String(index + 1).padStart(3, '0')}`
    idByKey.set(draft.key, id)
    return { ...draft.proposal, id, code: `DNKG-${String(index + 1).padStart(6, '0')}` }
  })
  return { proposals, idByKey }
}

/** Kiểm ràng buộc trên chính dữ liệu seed (plan mục 10.2) — vi phạm thì `throw` để không sai âm thầm. */
function assertSeedInvariants(
  owners: VehicleOwner[],
  contracts: ConsignmentContract[],
  records: ConsignmentHandoverRecord[],
  vehicles: Vehicle[],
  payouts: OwnerPayoutRecord[],
  proposals: ConsignmentProposal[],
): void {
  const today = todayKey()
  const fail = (msg: string): never => {
    throw new Error(`[seed consignment] ${msg}`)
  }

  const vehicleIds = new Set(contracts.map((c) => c.vehicleId))
  for (const vehicleId of vehicleIds) {
    const own = contracts.filter((c) => c.vehicleId === vehicleId)
    if (own.filter((c) => EFFECTIVE_CONTRACT_STATUSES.includes(c.status)).length > 1) {
      fail(`xe ${vehicleId} có hơn 1 hợp đồng hiệu lực (VC-BR-01)`)
    }
    if (own.filter((c) => OPEN_CONTRACT_STATUSES.includes(c.status)).length > 1) {
      fail(`xe ${vehicleId} có hơn 1 hợp đồng đang mở`)
    }
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (!vehicle || vehicle.ownershipType !== 'CONSIGNED') fail(`xe ${vehicleId} không phải xe ký gửi`)
  }

  for (const c of contracts) {
    if (!owners.some((o) => o.id === c.ownerId)) fail(`hợp đồng ${c.contractNo} trỏ chủ xe không tồn tại`)
    if (c.effectiveTo <= c.effectiveFrom) fail(`hợp đồng ${c.contractNo} có thời hạn không hợp lệ`)
    if (c.createdAt > new Date().toISOString()) fail(`hợp đồng ${c.contractNo} có ngày tạo ở tương lai`)
    let prev = ''
    for (const h of c.statusHistory) {
      if (prev && h.at < prev) fail(`hợp đồng ${c.contractNo} có lịch sử trạng thái sai thứ tự thời gian`)
      if (h.at > new Date().toISOString()) fail(`hợp đồng ${c.contractNo} có mốc trạng thái ở tương lai`)
      prev = h.at
    }
    const passedSigned = ['ACTIVE', 'SUSPENDED', 'TERMINATED', 'CLOSED'].includes(c.status)
    if (passedSigned && (!c.termsSnapshot || !c.signedCopy || !c.intakeRecordId)) {
      fail(`hợp đồng ${c.contractNo} đã qua ký nhưng thiếu snapshot, bản ký hoặc biên bản`)
    }
    if (passedSigned) {
      // Phiên bản 1 là bản gốc; mỗi phiên bản ADDENDUM khớp đúng một phụ lục có đổi điều khoản (AC-VC-012).
      const [first, ...rest] = [...c.termVersions].sort((a, b) => a.versionNo - b.versionNo)
      if (!first || first.versionNo !== 1 || first.source !== 'ORIGINAL') fail(`hợp đồng ${c.contractNo} thiếu phiên bản điều khoản gốc`)
      const termChanges = c.addenda.filter((a) => a.termChange)
      const matched = rest.every((v) =>
        termChanges.some((a) => a.id === v.addendumId && a.termChange?.versionNo === v.versionNo && a.termChange.effectiveFrom === v.effectiveFrom),
      )
      if (rest.length !== termChanges.length || !matched || rest.some((v) => v.source !== 'ADDENDUM')) {
        fail(`hợp đồng ${c.contractNo} có phiên bản điều khoản không khớp phụ lục`)
      }
      // Hạn hợp đồng = hạn của phụ lục gia hạn mới nhất, hoặc hạn gốc lúc ký.
      const lastExtension = [...c.addenda].filter((a) => a.extension).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      const expectedEnd = lastExtension?.extension?.toEffectiveTo ?? c.termsSnapshot?.effectiveTo
      if (c.effectiveTo !== expectedEnd) fail(`hợp đồng ${c.contractNo} có hạn hiệu lực không khớp phụ lục gia hạn`)
    }
    if (!passedSigned && (c.termsSnapshot || c.intakeRecordId || c.termVersions.length > 0 || c.addenda.length > 0)) {
      fail(`hợp đồng ${c.contractNo} chưa ký nhưng đã có snapshot, phiên bản điều khoản hoặc phụ lục`)
    }
    for (const a of c.addenda) {
      if (a.createdAt > new Date().toISOString() || a.signedDate > today) fail(`phụ lục ${a.addendumNo} có mốc ở tương lai`)
      if (a.signedDate < toLocalDateKey(c.activatedAt ?? c.createdAt)) fail(`phụ lục ${a.addendumNo} ký trước ngày kích hoạt hợp đồng`)
    }
    // Đề nghị gốc: APPROVED, cùng chủ xe, biển số khớp xe (plan mục 20.10 điểm 7).
    const proposal = proposals.find((p) => p.id === c.proposalId)
    const vehicleOfContract = vehicles.find((v) => v.id === c.vehicleId)
    if (!proposal || proposal.status !== 'APPROVED') fail(`hợp đồng ${c.contractNo} không trỏ đề nghị đã duyệt`)
    if (proposal && (proposal.ownerId !== c.ownerId || normalizePlate(proposal.declaredVehicle.plate) !== normalizePlate(vehicleOfContract?.plate ?? ''))) {
      fail(`hợp đồng ${c.contractNo} không khớp chủ xe hoặc biển số với đề nghị ${proposal.code}`)
    }
    if (proposal && c.createdAt < (proposal.decidedAt ?? '')) fail(`hợp đồng ${c.contractNo} được tạo trước khi đề nghị ${proposal.code} được duyệt`)
    if (c.status === 'ACTIVE' || c.status === 'SUSPENDED') {
      if (dayDiff(today, c.effectiveTo) < 0) fail(`hợp đồng ${c.contractNo} đang hiệu lực nhưng đã quá hạn`)
      if (dayDiff(c.effectiveFrom, today) < 0) fail(`hợp đồng ${c.contractNo} đang hiệu lực nhưng chưa tới ngày bắt đầu`)
    }
  }

  // ---- Đề nghị ký gửi (kế hoạch mục 20.10) ----
  const nowIsoForProposals = new Date().toISOString()
  for (const p of proposals) {
    const owner = owners.find((o) => o.id === p.ownerId)
    if (!owner) fail(`đề nghị ${p.code} trỏ chủ xe không tồn tại`)
    let prevAt = owner?.createdAt ?? ''
    for (const h of p.statusHistory) {
      if (h.at < prevAt || h.at > nowIsoForProposals) fail(`đề nghị ${p.code} có lịch sử trạng thái sai thứ tự hoặc ở tương lai`)
      prevAt = h.at
    }
    if (p.statusHistory[p.statusHistory.length - 1]?.to !== p.status) fail(`đề nghị ${p.code} có lịch sử trạng thái không khớp trạng thái`)
    if (p.status !== 'SUBMITTED' && !p.appraisal) fail(`đề nghị ${p.code} đã qua thẩm định nhưng thiếu kết quả`)
    if (p.appraisal && (p.appraisal.appraisedValue <= 0 || p.appraisal.appraisedAt > nowIsoForProposals)) {
      fail(`đề nghị ${p.code} có kết quả thẩm định không hợp lệ`)
    }
    if (p.status === 'REJECTED' && (!p.rejectReason || p.appraisal?.ownershipCheck !== 'INVALID')) fail(`đề nghị ${p.code} bị từ chối thiếu lý do hoặc kết quả xác minh`)
    if (p.status === 'APPROVED' && (!p.decidedAt || p.appraisal?.ownershipCheck === 'INVALID')) fail(`đề nghị ${p.code} đã duyệt nhưng chủ sở hữu không hợp lệ`)
    if (p.createdAt > p.updatedAt || p.updatedAt > nowIsoForProposals) fail(`đề nghị ${p.code} có mốc thời gian sai`)
    const linked = contracts.filter((c) => c.proposalId === p.id && c.status !== 'SUPERSEDED')
    if (linked.length > 1) fail(`đề nghị ${p.code} có hơn 1 hợp đồng (khác đã thay thế)`)
    if (linked.length > 0 && p.status !== 'APPROVED') fail(`đề nghị ${p.code} chưa duyệt nhưng đã có hợp đồng`)
  }
  const plateOwnerCount = new Map<string, number>()
  for (const p of proposals) {
    if (p.vehicleId) continue
    const plate = normalizePlate(p.declaredVehicle.plate)
    plateOwnerCount.set(plate, (plateOwnerCount.get(plate) ?? 0) + 1)
    if (vehicles.some((v) => normalizePlate(v.plate) === plate)) fail(`đề nghị ${p.code} dùng biển số đã có ở Danh sách xe nhưng không gắn xe`)
  }
  for (const [plate, count] of plateOwnerCount) if (count > 1) fail(`biển số ${plate} bị khai báo ở hơn 1 đề nghị chưa gắn xe`)
  // Đề nghị đang thẩm định / mới ghi nhận không được vi phạm chính quy tắc chặn trùng lúc ghi nhận (dùng chung hàm runtime).
  for (const p of proposals) {
    if (p.status !== 'SUBMITTED' && p.status !== 'APPRAISING') continue
    const blocker = getProposalCreateBlocker({ plate: p.declaredVehicle.plate, excludeProposalId: p.id }, { vehicles, contracts, proposals })
    if (blocker) fail(`đề nghị ${p.code}: ${blocker}`)
  }

  for (const r of records) {
    const contract = contracts.find((c) => c.id === r.contractId)
    if (!contract) fail(`biên bản ${r.code} trỏ hợp đồng không tồn tại`)
    const vehicle = vehicles.find((v) => v.id === r.vehicleId)
    if (!vehicle) fail(`biên bản ${r.code} trỏ xe không tồn tại`)
    if (r.type === 'INTAKE') {
      if (!r.appraisedValue || r.appraisedValue <= 0) fail(`biên bản ${r.code} thiếu giá trị định giá (VC-BR-16)`)
      if (r.odoKm >= (vehicle?.currentKm ?? 0)) fail(`biên bản ${r.code} có odo không nhỏ hơn odo hiện tại của xe`)
    }
    if (!r.ownerConfirmed || !r.companyConfirmed) fail(`biên bản ${r.code} chưa được hai bên xác nhận (VC-BR-15)`)
    if (r.createdAt > new Date().toISOString()) fail(`biên bản ${r.code} có ngày tạo ở tương lai`)
  }

  // ---- Lịch chi trả (kế hoạch mục 19.9.1 điểm 4) ----
  const nowIso = new Date().toISOString()
  const currentPeriod = periodOf(today)
  for (const c of contracts) {
    const own = payouts.filter((r) => r.contractId === c.id && r.status !== 'CANCELLED')
    if (c.status === 'ACTIVE' || c.status === 'SUSPENDED') {
      const expected = buildExpectedPayouts(c, currentPeriod).map((d) => d.period)
      if (expected.length !== own.length || expected.some((period) => own.filter((r) => r.period === period).length !== 1)) {
        fail(`hợp đồng ${c.contractNo} không có đúng 1 khoản chi trả không huỷ cho mỗi kỳ tới kỳ hiện tại (VC-BR-21)`)
      }
    }
    const endedDate = c.endedDate
    if (endedDate && own.some((r) => r.period > periodOf(endedDate))) {
      fail(`hợp đồng ${c.contractNo} có khoản chi trả sau kỳ của ngày kết thúc`)
    }
    if (!c.activatedAt && own.length > 0) fail(`hợp đồng ${c.contractNo} chưa kích hoạt nhưng đã có khoản chi trả`)
  }
  for (const r of payouts) {
    if (r.period > currentPeriod) fail(`khoản chi trả ${r.code} có kỳ ở tương lai`)
    if (r.amountPayable !== deriveAmountPayable(r)) fail(`khoản chi trả ${r.code} có số phải trả không khớp công thức`)
    if (r.amountPayable <= 0) fail(`khoản chi trả ${r.code} có số phải trả không dương`)
    if (r.createdAt > nowIso || r.updatedAt > nowIso || r.updatedAt < r.createdAt) fail(`khoản chi trả ${r.code} có mốc thời gian sai`)
    for (const h of r.statusHistory) if (h.at > nowIso) fail(`khoản chi trả ${r.code} có lịch sử trạng thái ở tương lai`)
  }
}

function seedConsignment(): void {
  const vehicles = readJson<Vehicle[]>(VEHICLES_STORAGE_KEY) ?? []
  const owners = buildOwners()
  const { contracts: baseContracts, records } = seedContractsAndRecords(owners, vehicles)
  const { proposals, idByKey } = finalizeProposals(buildProposals(owners, vehicles, baseContracts, records))
  // Đổi khoá tạm của chuỗi hợp đồng sang id đề nghị thật rồi lập 2 phụ lục.
  const linked = baseContracts.map((c) => {
    const proposalId = idByKey.get(c.proposalId)
    if (!proposalId) throw new Error(`[seed consignment] hợp đồng ${c.contractNo} không có đề nghị`)
    return { ...c, proposalId }
  })
  const contracts = seedAddenda(linked)
  const payouts = buildPayoutRecords(owners, contracts)
  assertSeedInvariants(owners, contracts, records, vehicles, payouts, proposals)
  writeJson(VEHICLE_OWNERS_STORAGE_KEY, owners)
  writeJson(CONSIGNMENT_PROPOSALS_STORAGE_KEY, proposals)
  writeJson(CONSIGNMENT_CONTRACTS_STORAGE_KEY, contracts)
  writeJson(CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY, records)
  writeJson(OWNER_PAYOUT_RECORDS_STORAGE_KEY, payouts)
}

registerSeedStep(seedConsignment)
