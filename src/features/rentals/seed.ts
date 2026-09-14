import { registerSeedStep } from '@/shared/fixtures/seedAll'
import type { RentalStatus, SecurityDepositType, VehicleClass } from '@/shared/domain/enums'
import { writeJson } from '@/shared/lib/storage'
import { RENTALS_STORAGE_KEY } from './api'
import {
  CASH_DEPOSIT_AMOUNT,
  PRICE_PER_KM_BY_CLASS,
  calcAllowedKm,
  calcBaseAmount,
  calcDeliveryFee,
  calcEstimatedTotal,
  calcPrepaymentAmount,
  rentalDurationDays,
  type Rental,
} from './model'

/**
 * `YYYY-MM-DDTHH:mm:00.000Z`-tương đương tính từ hôm nay ± số ngày, giờ/phút
 * cố định — cùng tinh thần `isoDateOffset()` của `maintenance/seed.ts` nhưng
 * giữ nguyên giờ:phút (Rental cần datetime đầy đủ, không chỉ ngày).
 */
function dt(daysOffset: number, hour: number, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** `createdAt`/`updatedAt` — vài ngày trước `pickupDateTime` (thời điểm đặt lượt). */
function beforeIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const OFFICE = 'Văn phòng Thiên Bảo Car — 123 Nguyễn Văn Cừ, Quận 5, TP.HCM'

interface SeedRentalInput {
  id: string
  status: RentalStatus
  customerId: string
  vehicleId: string
  vehicleClass: VehicleClass
  pickupDateTime: string
  expectedReturnDateTime: string
  pickupLocation?: string
  returnLocation?: string
  rentalRate: number
  discountAmount?: number
  discountNote?: string
  additionalChargesAmount?: number
  additionalChargesNote?: string
  deliveryDistanceKm?: number
  securityDepositType: SecurityDepositType
  securityDepositAssetNote?: string
  note?: string
}

/**
 * Tính toàn bộ field snapshot qua đúng hàm thuần `model.ts` (`§3.1`) — đảm bảo
 * dữ liệu seed nhất quán với công thức ứng dụng dùng thật, không tính tay dễ
 * lệch (RM-BR-12/24/25/26).
 */
function buildRental(input: SeedRentalInput): Rental {
  const duration = rentalDurationDays(input.pickupDateTime, input.expectedReturnDateTime)
  const allowedKm = calcAllowedKm(duration)
  const pricePerKm = PRICE_PER_KM_BY_CLASS[input.vehicleClass]
  const discountAmount = input.discountAmount ?? 0
  const additionalChargesAmount = input.additionalChargesAmount ?? 0
  const baseAmount = calcBaseAmount(input.rentalRate, duration)
  const deliveryFee = calcDeliveryFee(input.deliveryDistanceKm)
  const estimatedTotal = calcEstimatedTotal(baseAmount, discountAmount, additionalChargesAmount, deliveryFee)
  const prepaymentAmount = calcPrepaymentAmount(baseAmount)
  const createdAt = beforeIso(input.pickupDateTime, 3)

  return {
    id: input.id,
    status: input.status,
    customerId: input.customerId,
    vehicleId: input.vehicleId,
    pickupDateTime: input.pickupDateTime,
    expectedReturnDateTime: input.expectedReturnDateTime,
    pickupLocation: input.pickupLocation ?? OFFICE,
    returnLocation: input.returnLocation ?? OFFICE,
    vehicleClass: input.vehicleClass,
    pricePerKm,
    allowedKm,
    rentalRate: input.rentalRate,
    rentalDurationDays: duration,
    baseAmount,
    discountAmount,
    discountNote: input.discountNote,
    additionalChargesAmount,
    additionalChargesNote: input.additionalChargesNote,
    deliveryDistanceKm: input.deliveryDistanceKm,
    deliveryFee,
    estimatedTotal,
    prepaymentAmount,
    securityDepositType: input.securityDepositType,
    securityDepositAmount: input.securityDepositType === 'CASH_20M' ? CASH_DEPOSIT_AMOUNT : undefined,
    securityDepositAssetNote: input.securityDepositType === 'MOTORBIKE' ? input.securityDepositAssetNote : undefined,
    note: input.note,
    createdAt,
    updatedAt: createdAt,
  }
}

const MOTORBIKE_NOTE =
  'Xe máy Honda Wave RSX 2019, biển số 59-X1 123.45, kèm cà vẹt gốc, giá trị ước tính 18.000.000đ.'

/**
 * `docs/RENTAL-MANAGEMENT-PLAN.md` §7 — id khách/xe tham chiếu đúng
 * `features/customers/seed.ts` (9 khách: `cus_001`–`cus_009`, `cus_008`
 * `BLOCKED`) + `features/vehicles/seed.ts` (18 xe: `veh_001`–`veh_018`,
 * `veh_007` `MAINTENANCE`, `veh_013` `INACTIVE`, `veh_018` `RENTED`). 29 bản
 * ghi phủ đủ 12 trạng thái (nhỉnh hơn gợi ý "~20-24" ở đầu §7 để giữ đúng số
 * lượng cụ thể theo từng trạng thái liệt kê chi tiết ngay bên dưới — bao gồm
 * 3 case `DRAFT` cố ý demo `canConfirm()` chặn cứng: khách `BLOCKED`
 * (RM-BR-07), xe `MAINTENANCE` (RM-BR-05), xe `INACTIVE` (RM-BR-06); 1 cặp
 * `CONFIRMED` cùng xe cách nhau 30 phút (< 90 phút buffer) để demo
 * `hasConflict()`/RC-BR-13; nhiều pickup "hôm nay" chuẩn bị cho Dispatch
 * board round sau (§8.1)).
 */
function seedRentals(): void {
  const inputs: SeedRentalInput[] = [
    // ---- DRAFT (5) ----
    {
      id: 'rt_001',
      status: 'DRAFT',
      customerId: 'cus_001',
      vehicleId: 'veh_002',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(3, 9, 0),
      expectedReturnDateTime: dt(5, 21, 0),
      rentalRate: 900000,
      discountAmount: 100000,
      discountNote: 'Khách quen, giảm giá theo thoả thuận.',
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_002',
      status: 'DRAFT',
      customerId: 'cus_004',
      vehicleId: 'veh_005',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(5, 8, 0),
      expectedReturnDateTime: dt(7, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      // cus_008 BLOCKED — demo canConfirm() chặn cứng RM-BR-07 khi bấm "Xác nhận".
      id: 'rt_003',
      status: 'DRAFT',
      customerId: 'cus_008',
      vehicleId: 'veh_009',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(4, 9, 0),
      expectedReturnDateTime: dt(6, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
      note: 'Cảnh báo: khách hàng đang BLOCKED — không thể xác nhận (RM-BR-07).',
    },
    {
      // veh_007 MAINTENANCE — demo canConfirm() chặn cứng RM-BR-05.
      id: 'rt_004',
      status: 'DRAFT',
      customerId: 'cus_003',
      vehicleId: 'veh_007',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(6, 9, 0),
      expectedReturnDateTime: dt(8, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
      note: 'Cảnh báo: xe đang MAINTENANCE — không thể xác nhận (RM-BR-05).',
    },
    {
      // veh_013 INACTIVE — demo canConfirm() chặn cứng RM-BR-06.
      id: 'rt_005',
      status: 'DRAFT',
      customerId: 'cus_009',
      vehicleId: 'veh_013',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(8, 9, 0),
      expectedReturnDateTime: dt(9, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
      note: 'Cảnh báo: xe đang INACTIVE — không thể xác nhận (RM-BR-06).',
    },

    // ---- CONFIRMED (6) ----
    {
      id: 'rt_006',
      status: 'CONFIRMED',
      customerId: 'cus_002',
      vehicleId: 'veh_004',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(0, 14, 0), // hôm nay
      expectedReturnDateTime: dt(1, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_007',
      status: 'CONFIRMED',
      customerId: 'cus_005',
      vehicleId: 'veh_011',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(0, 18, 0), // hôm nay
      expectedReturnDateTime: dt(3, 20, 0),
      rentalRate: 1800000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      // Cặp trùng lịch cùng xe veh_012 — rt_008 kết thúc 21:00, rt_009 nhận
      // xe 21:30 cùng ngày (cách 30 phút < 90 phút buffer) — demo hasConflict()/RC-BR-13.
      id: 'rt_008',
      status: 'CONFIRMED',
      customerId: 'cus_006',
      vehicleId: 'veh_012',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(2, 9, 0),
      expectedReturnDateTime: dt(4, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_009',
      status: 'CONFIRMED',
      customerId: 'cus_007',
      vehicleId: 'veh_012',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(4, 21, 30),
      expectedReturnDateTime: dt(6, 18, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
      note: 'Cách rt_008 chỉ 30 phút, cùng xe — demo cảnh báo Turnaround Buffer (RM-BR-23).',
    },
    {
      id: 'rt_010',
      status: 'CONFIRMED',
      customerId: 'cus_009',
      vehicleId: 'veh_014',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(5, 9, 0),
      expectedReturnDateTime: dt(7, 21, 0),
      rentalRate: 1800000,
      deliveryDistanceKm: 5,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_011',
      status: 'CONFIRMED',
      customerId: 'cus_001',
      vehicleId: 'veh_016',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(6, 10, 0),
      expectedReturnDateTime: dt(8, 19, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- CONTRACT_CREATED (2) ----
    {
      id: 'rt_012',
      status: 'CONTRACT_CREATED',
      customerId: 'cus_002',
      vehicleId: 'veh_015',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(1, 9, 0),
      expectedReturnDateTime: dt(3, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_013',
      status: 'CONTRACT_CREATED',
      customerId: 'cus_003',
      vehicleId: 'veh_003',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(1, 15, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'CASH_20M',
    },

    // ---- READY_FOR_HANDOVER (2) ----
    {
      id: 'rt_014',
      status: 'READY_FOR_HANDOVER',
      customerId: 'cus_004',
      vehicleId: 'veh_006',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(0, 20, 0), // hôm nay, sắp giao
      expectedReturnDateTime: dt(3, 21, 0),
      pickupLocation: '45 Lê Lợi, Quận 3, TP.HCM (giao tận nơi)',
      rentalRate: 1800000,
      deliveryDistanceKm: 3,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_015',
      status: 'READY_FOR_HANDOVER',
      customerId: 'cus_005',
      vehicleId: 'veh_008',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(1, 8, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- HANDED_OVER (2) ----
    {
      id: 'rt_016',
      status: 'HANDED_OVER',
      customerId: 'cus_006',
      vehicleId: 'veh_010',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-1, 9, 0),
      expectedReturnDateTime: dt(2, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_017',
      status: 'HANDED_OVER',
      customerId: 'cus_007',
      vehicleId: 'veh_001',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(0, 7, 0), // hôm nay, đã giao sáng nay
      expectedReturnDateTime: dt(4, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
    },

    // ---- IN_RENTAL (2) ----
    {
      // veh_018 đã seed sẵn status RENTED ở vehicles/seed.ts — khớp với lượt đang IN_RENTAL này.
      id: 'rt_018',
      status: 'IN_RENTAL',
      customerId: 'cus_009',
      vehicleId: 'veh_018',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-2, 9, 0),
      expectedReturnDateTime: dt(1, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_019',
      status: 'IN_RENTAL',
      customerId: 'cus_001',
      vehicleId: 'veh_017',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(0, 6, 0), // hôm nay, đang thuê
      expectedReturnDateTime: dt(3, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- RETURNED (2) ----
    {
      id: 'rt_020',
      status: 'RETURNED',
      customerId: 'cus_003',
      vehicleId: 'veh_009',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-10, 9, 0),
      expectedReturnDateTime: dt(-7, 21, 0),
      rentalRate: 900000,
      additionalChargesAmount: 200000,
      additionalChargesNote: 'Vượt Allowed KM ước tính — chờ VehicleReturn (Phase 3) xác nhận chính thức.',
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_021',
      status: 'RETURNED',
      customerId: 'cus_004',
      vehicleId: 'veh_005',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-8, 9, 0),
      expectedReturnDateTime: dt(-5, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- SETTLEMENT (2) ----
    {
      id: 'rt_022',
      status: 'SETTLEMENT',
      customerId: 'cus_005',
      vehicleId: 'veh_011',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-6, 9, 0),
      expectedReturnDateTime: dt(-3, 21, 0),
      rentalRate: 1800000,
      additionalChargesAmount: 350000,
      additionalChargesNote: 'Nhiên liệu trả thiếu so với baseline giao xe — chờ chốt tại RentalSettlement (Phase 4).',
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_023',
      status: 'SETTLEMENT',
      customerId: 'cus_006',
      vehicleId: 'veh_012',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-12, 9, 0),
      expectedReturnDateTime: dt(-9, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- COMPLETED (3) ----
    {
      id: 'rt_024',
      status: 'COMPLETED',
      customerId: 'cus_007',
      vehicleId: 'veh_014',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-20, 9, 0),
      expectedReturnDateTime: dt(-17, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
    },
    {
      // Lượt thuê trước đây của cus_008 — phát sinh phí phạt chưa thanh toán,
      // lý do khách hàng bị BLOCKED sau này (customers/seed.ts blockReason).
      id: 'rt_025',
      status: 'COMPLETED',
      customerId: 'cus_008',
      vehicleId: 'veh_016',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-30, 9, 0),
      expectedReturnDateTime: dt(-27, 21, 0),
      rentalRate: 500000,
      additionalChargesAmount: 500000,
      additionalChargesNote: 'Phí phạt nguội phát sinh, khách chưa thanh toán — nguồn gốc lý do khoá khách hàng.',
      securityDepositType: 'CASH_20M',
    },
    {
      id: 'rt_026',
      status: 'COMPLETED',
      customerId: 'cus_009',
      vehicleId: 'veh_003',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-15, 9, 0),
      expectedReturnDateTime: dt(-12, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },

    // ---- Ngoại lệ ngoài luồng chính (1 mỗi loại) ----
    {
      id: 'rt_027',
      status: 'CANCELLED',
      customerId: 'cus_001',
      vehicleId: 'veh_010',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(10, 9, 0),
      expectedReturnDateTime: dt(12, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'CASH_20M',
      note: 'Lý do huỷ: Khách đổi lịch trình công tác, không thuê xe nữa.',
    },
    {
      id: 'rt_028',
      status: 'NO_SHOW',
      customerId: 'cus_002',
      vehicleId: 'veh_015',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-2, 9, 0),
      expectedReturnDateTime: dt(1, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'CASH_20M',
      note: 'Khách không đến nhận xe theo lịch hẹn.',
    },
    {
      id: 'rt_029',
      status: 'DISPUTED',
      customerId: 'cus_006',
      vehicleId: 'veh_006',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-25, 9, 0),
      expectedReturnDateTime: dt(-22, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'CASH_20M',
      note: 'Tranh chấp về tình trạng xe khi trả — đang chờ xử lý (DamageIncident, Phase 3).',
    },
  ]

  writeJson(RENTALS_STORAGE_KEY, inputs.map(buildRental))
}

registerSeedStep(seedRentals)
