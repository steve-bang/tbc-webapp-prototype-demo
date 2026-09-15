import {
  CASH_DEPOSIT_AMOUNT,
  PRICE_PER_KM_BY_CLASS,
  calcAllowedKm,
  calcBaseAmount,
  calcDeliveryFee,
  calcEstimatedTotal,
  calcPrepaymentAmount,
  rentalDurationDays,
} from '@/features/rentals/model'
import { registerSeedStep } from '@/shared/fixtures/seedAll'
import type { ContractStatus, SecurityDepositType, VehicleClass } from '@/shared/domain/enums'
import { writeJson } from '@/shared/lib/storage'
import { CONTRACTS_STORAGE_KEY, CONTRACT_ADDENDUMS_STORAGE_KEY } from './api'
import { COMPANY_NAME, generateContractCode, type Contract, type ContractAddendum } from './model'

/**
 * `YYYY-MM-DDTHH:mm:00.000Z`-tương đương tính từ hôm nay ± số ngày — mirror
 * `dt()` của `rentals/seed.ts` (KHÔNG export ở đó nên định nghĩa lại đây) để
 * tái tạo đúng `pickupDateTime`/`expectedReturnDateTime` của Rental đang tham
 * chiếu, dùng đúng hàm thuần `rentals/model.ts` để số snapshot khớp với Rental
 * thật (không tính tay dễ lệch — cùng tinh thần `rentals/seed.ts` §3.1).
 */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** `createdAt`/`updatedAt` — vài ngày trước `pickupDateTime` (thời điểm sinh hợp đồng, sau khi Rental `CONFIRMED`). */
function beforeIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const OFFICE = 'Văn phòng Thiên Bảo Car — 123 Nguyễn Văn Cừ, Quận 5, TP.HCM'

interface SeedContractInput {
  id: string
  rentalId: string
  status: ContractStatus
  customerName: string
  customerIdNumber: string
  customerPhone: string
  customerAddress?: string
  vehiclePlate: string
  vehicleBrand: string
  vehicleModel: string
  vehicleClass: VehicleClass
  pickupDateTime: string
  expectedReturnDateTime: string
  pickupLocation?: string
  returnLocation?: string
  rentalRate: number
  discountAmount?: number
  deliveryDistanceKm?: number
  securityDepositType: SecurityDepositType
  signed?: { fileName: string; date: string; byCompany: string; byCustomer: string }
  voidReason?: string
}

/** Tính toàn bộ field snapshot qua đúng hàm thuần `rentals/model.ts` — nhất quán với Rental thật đang tham chiếu (CT-BR-07). */
function buildContract(input: SeedContractInput, existingCount: number): Contract {
  const duration = rentalDurationDays(input.pickupDateTime, input.expectedReturnDateTime)
  const allowedKm = calcAllowedKm(duration)
  const pricePerKm = PRICE_PER_KM_BY_CLASS[input.vehicleClass]
  const discountAmount = input.discountAmount ?? 0
  const baseAmount = calcBaseAmount(input.rentalRate, duration)
  const deliveryFee = calcDeliveryFee(input.deliveryDistanceKm)
  const estimatedTotal = calcEstimatedTotal(baseAmount, discountAmount, 0, deliveryFee)
  const prepaymentAmount = calcPrepaymentAmount(baseAmount)
  const createdAt = beforeIso(input.pickupDateTime, 2)
  const now = createdAt

  const isVoid = input.status === 'VOID'
  const isSignedOrLater = input.status !== 'GENERATED' && input.status !== 'VOID'

  return {
    id: input.id,
    contractCode: generateContractCode(existingCount),
    version: 1,
    rentalId: input.rentalId,
    status: input.status,
    snapshotCompanyName: COMPANY_NAME,
    snapshotCustomerName: input.customerName,
    snapshotCustomerIdNumber: input.customerIdNumber,
    snapshotCustomerPhone: input.customerPhone,
    snapshotCustomerAddress: input.customerAddress,
    snapshotVehiclePlate: input.vehiclePlate,
    snapshotVehicleBrand: input.vehicleBrand,
    snapshotVehicleModel: input.vehicleModel,
    snapshotPickupDateTime: input.pickupDateTime,
    snapshotExpectedReturnDateTime: input.expectedReturnDateTime,
    snapshotPickupLocation: input.pickupLocation ?? OFFICE,
    snapshotReturnLocation: input.returnLocation ?? OFFICE,
    snapshotRentalRate: input.rentalRate,
    snapshotRentalDurationDays: duration,
    snapshotBaseAmount: baseAmount,
    snapshotDiscountAmount: discountAmount,
    snapshotEstimatedTotal: estimatedTotal,
    snapshotPrepaymentAmount: prepaymentAmount,
    snapshotAllowedKm: allowedKm,
    snapshotPricePerKm: pricePerKm,
    snapshotSecurityDepositType: input.securityDepositType,
    snapshotSecurityDepositAmount: input.securityDepositType === 'CASH_20M' ? CASH_DEPOSIT_AMOUNT : undefined,
    signedCopyFileName: isSignedOrLater ? (input.signed?.fileName ?? `HD-scan-${input.id}.pdf`) : undefined,
    signedDate: isSignedOrLater ? (input.signed?.date ?? input.pickupDateTime.slice(0, 10)) : undefined,
    signedByCompany: isSignedOrLater ? (input.signed?.byCompany ?? 'Nguyễn Văn Admin') : undefined,
    signedByCustomer: isSignedOrLater ? (input.signed?.byCustomer ?? input.customerName) : undefined,
    voidReason: isVoid ? input.voidReason : undefined,
    voidedAt: isVoid ? beforeIso(input.pickupDateTime, 1) : undefined,
    voidedByUserId: isVoid ? 'usr_admin' : undefined,
    voidedByName: isVoid ? 'Nguyễn Văn Admin' : undefined,
    voidedByRole: isVoid ? 'SYSTEM_ADMIN' : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §7 — 8 `Contract` tham chiếu đúng
 * `rentalId`/`customerId`/`vehicleId` thật từ `rentals/seed.ts` (chỉ chọn
 * Rental status `CONTRACT_CREATED` trở lên: `rt_012`/`rt_013` `CONTRACT_CREATED`,
 * `rt_014`/`rt_015` `READY_FOR_HANDOVER`, `rt_016` `HANDED_OVER`, `rt_018`
 * `IN_RENTAL`, `rt_020` `RETURNED`, `rt_024` `COMPLETED`) + `customers/seed.ts`/
 * `vehicles/seed.ts`. Ngày giờ tái tạo bằng đúng `dt()` mirror `rentals/seed.ts`
 * nên khớp Rental gốc. Phân bổ trạng thái theo ý nghĩa Rental status (§7 kế
 * hoạch): 1 `GENERATED` chưa ký, 3 `SIGNED`, 3 `ACTIVE`, 1 `CLOSED`, 1 `VOID`
 * (kèm `voidReason` — không cascade từ Rental, chỉ minh hoạ thao tác Huỷ).
 */
function seedContracts(): void {
  const inputs: SeedContractInput[] = [
    {
      // rt_012 CONTRACT_CREATED — cus_002 (Trần Văn Bảo Long), veh_015 (51B-555.66 Toyota Innova).
      id: 'ct_001',
      rentalId: 'rt_012',
      status: 'GENERATED',
      customerName: 'Trần Văn Bảo Long',
      customerIdNumber: '079188002345',
      customerPhone: '0909333444',
      customerAddress: '45 Lê Lợi, Quận 3, TP.HCM',
      vehiclePlate: '51B-555.66',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Innova',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(1, 9, 0),
      expectedReturnDateTime: dt(3, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_013 CONTRACT_CREATED — cus_003 (Sarah Johnson), veh_003 (51B-345.67 Kia Morning).
      id: 'ct_002',
      rentalId: 'rt_013',
      status: 'SIGNED',
      customerName: 'Sarah Johnson',
      customerIdNumber: 'N1234567',
      customerPhone: '0909555666',
      customerAddress: 'Khách sạn Rex, Quận 1, TP.HCM',
      vehiclePlate: '51B-345.67',
      vehicleBrand: 'Kia',
      vehicleModel: 'Morning',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(1, 15, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_014 READY_FOR_HANDOVER — cus_004 (Phạm Minh Tuấn), veh_006 (51A-678.90 Mercedes-Benz C200), giao tận nơi.
      id: 'ct_003',
      rentalId: 'rt_014',
      status: 'SIGNED',
      customerName: 'Phạm Minh Tuấn',
      customerIdNumber: '079195003456',
      customerPhone: '0909777888',
      customerAddress: '78 Cách Mạng Tháng 8, Quận 10, TP.HCM',
      vehiclePlate: '51A-678.90',
      vehicleBrand: 'Mercedes-Benz',
      vehicleModel: 'C200',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(0, 20, 0),
      expectedReturnDateTime: dt(3, 21, 0),
      pickupLocation: '45 Lê Lợi, Quận 3, TP.HCM (giao tận nơi)',
      rentalRate: 1800000,
      deliveryDistanceKm: 3,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_015 READY_FOR_HANDOVER — cus_005 (Lê Thị Kim Anh), veh_008 (51A-890.12 Honda City). Demo Huỷ hợp đồng
      // (không cascade với Rental — kế hoạch §1.2 chưa build cascade Round 1, đây chỉ minh hoạ thao tác VOID độc lập).
      id: 'ct_004',
      rentalId: 'rt_015',
      status: 'VOID',
      customerName: 'Lê Thị Kim Anh',
      customerIdNumber: '079185004567',
      customerPhone: '0909999000',
      customerAddress: '23 Điện Biên Phủ, Bình Thạnh, TP.HCM',
      vehiclePlate: '51A-890.12',
      vehicleBrand: 'Honda',
      vehicleModel: 'City',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(1, 8, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      voidReason: 'Nhập sai thông tin khách hàng lúc sinh hợp đồng — huỷ để lập lại thủ công ngoài hệ thống.',
    },
    {
      // rt_016 HANDED_OVER — cus_006 (Đặng Văn Hùng), veh_010 (51A-012.34 VinFast Fadil).
      id: 'ct_005',
      rentalId: 'rt_016',
      status: 'ACTIVE',
      customerName: 'Đặng Văn Hùng',
      customerIdNumber: '079190005678',
      customerPhone: '0912345678',
      customerAddress: '9 Hoàng Văn Thụ, Tân Bình, TP.HCM',
      vehiclePlate: '51A-012.34',
      vehicleBrand: 'VinFast',
      vehicleModel: 'Fadil',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-1, 9, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_018 IN_RENTAL — cus_009 (Nguyễn Thị Diễm Quỳnh), veh_018 (51A-888.99 VinFast VF8).
      id: 'ct_006',
      rentalId: 'rt_018',
      status: 'ACTIVE',
      customerName: 'Nguyễn Thị Diễm Quỳnh',
      customerIdNumber: '079193008901',
      customerPhone: '0933222111',
      customerAddress: '67 Nguyễn Trãi, Quận 5, TP.HCM',
      vehiclePlate: '51A-888.99',
      vehicleBrand: 'VinFast',
      vehicleModel: 'VF8',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-2, 9, 0),
      expectedReturnDateTime: dt(1, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_020 RETURNED — cus_003 (Sarah Johnson), veh_009 (51B-901.23 Kia Soluto). Vẫn ACTIVE — CLOSED chỉ khi Rental COMPLETED (CT-BR-04).
      id: 'ct_007',
      rentalId: 'rt_020',
      status: 'ACTIVE',
      customerName: 'Sarah Johnson',
      customerIdNumber: 'N1234567',
      customerPhone: '0909555666',
      customerAddress: 'Khách sạn Rex, Quận 1, TP.HCM',
      vehiclePlate: '51B-901.23',
      vehicleBrand: 'Kia',
      vehicleModel: 'Soluto',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-10, 9, 0),
      expectedReturnDateTime: dt(-7, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
    },
    {
      // rt_024 COMPLETED — cus_007 (Vũ Thị Ngọc Mai), veh_014 (51A-444.55 Ford Ranger).
      id: 'ct_008',
      rentalId: 'rt_024',
      status: 'CLOSED',
      customerName: 'Vũ Thị Ngọc Mai',
      customerIdNumber: '079198006789',
      customerPhone: '0912345699',
      customerAddress: '156 Phan Xích Long, Phú Nhuận, TP.HCM',
      vehiclePlate: '51A-444.55',
      vehicleBrand: 'Ford',
      vehicleModel: 'Ranger',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-20, 9, 0),
      expectedReturnDateTime: dt(-17, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
    },
  ]

  const contracts = inputs.map((input, index) => buildContract(input, index))
  writeJson(CONTRACTS_STORAGE_KEY, contracts)

  /**
   * 2 `ContractAddendum` (trong dải 2-3 gợi ý §7) — gắn vào 2 Contract đã
   * `ACTIVE`/`CLOSED` (mirror ý nghĩa CT-BR-17/RM-BR-27/28 đã xảy ra trong quá
   * khứ), đọc-only, không có form tạo (kế hoạch §1.2).
   */
  const addendums: ContractAddendum[] = [
    {
      id: 'ctad_001',
      contractId: 'ct_005', // ct_005 (ACTIVE, rt_016) — đổi xe giữa kỳ, ghi chênh lệch giá (CT-BR-17).
      type: 'ADDENDUM_VEHICLE_SWAP',
      effectiveDate: dt(0, 9, 0).slice(0, 10),
      description:
        'Đổi từ xe VinFast Fadil (51A-012.34) sang xe cùng hạng do phát sinh bảo trì đột xuất — không phát sinh chênh lệch giá (cùng Vehicle Class).',
      createdAt: beforeIso(dt(-1, 9, 0), 0),
    },
    {
      id: 'ctad_002',
      contractId: 'ct_008', // ct_008 (CLOSED, rt_024) — kết thúc sớm giữa kỳ (CT-BR-17/RM-BR-28).
      type: 'TERMINATION_AGREEMENT',
      effectiveDate: dt(-18, 9, 0).slice(0, 10),
      description: 'Khách yêu cầu kết thúc lượt thuê sớm hơn dự kiến 1 ngày do thay đổi lịch trình cá nhân.',
      createdAt: dt(-18, 10, 0),
    },
  ]
  writeJson(CONTRACT_ADDENDUMS_STORAGE_KEY, addendums)
}

registerSeedStep(seedContracts)
