import { registerSeedStep } from '@/shared/fixtures/seedAll'
import type { RentalStatus, SecurityDepositType, VehicleClass } from '@/shared/domain/enums'
import { writeJson } from '@/shared/lib/storage'
import { RENTALS_STORAGE_KEY } from './api'
import {
  CASH_DEPOSIT_AMOUNT,
  PRICE_PER_KM_BY_CLASS,
  TURNAROUND_BUFFER_MINUTES,
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

// ---- Lịch sử lượt thuê 12 tháng (docs/DEMO-DATA-PLAN.md §3.2) ----
// DỮ LIỆU GIẢ LẬP phục vụ demo — KHÔNG phải số liệu kinh doanh thật. Sinh tất định bằng PRNG cục bộ có hạt giống cố định:
// cấm Math.random/generateId ở đây, vì `vehicles/seed.ts` (chạy sau) dùng Math.random — tiêu thụ thêm sẽ làm đổi id/số giấy tờ xe cũ.

const DEMO_PRNG_SEED = 20261023
const DEMO_FIRST_SEQ = 40 // rt_040… — nối tiếp rt_039; `finance/revenue-cost/seed.ts` dựng tài chính cho mọi COMPLETED có số thứ tự ≥ 40.
const DEMO_HISTORY_FROM = -365
// Ngày trả muộn nhất. Plan ghi −3 nhưng trả lúc 17–21h ngày −3 vẫn muộn hơn "bây giờ − 3 ngày" khi seed chạy ban ngày;
// lùi 1 ngày để mọi mốc (trả xe, quyết toán, hoàn cọc) chắc chắn nằm trong quá khứ.
const DEMO_HISTORY_TO = -4
/** CR-2026-008 — mức giá thuê/ngày theo hạng xe, giữ đúng mức đang dùng ở các lượt seed trên. */
const DEMO_CLASS_RATE: Record<VehicleClass, number> = { VIP_LUXURY: 1_800_000, STANDARD: 900_000, TWO_SEATER: 500_000 }
/**
 * Thời lượng thuê tối đa 14 ngày: tránh nhánh "thuê tháng" chưa chốt (`calcAllowedKm` còn TODO).
 * TODO(OQ: BusinessRequirementDocument.md §51 Q53 — ngưỡng chuyển sang thuê tháng).
 */
const DEMO_MAX_DURATION_DAYS = 14
/** [số ngày, trọng số]. */
const DEMO_DURATIONS: ReadonlyArray<readonly [number, number]> = [[2, 10], [3, 15], [4, 15], [5, 12], [7, 20], [10, 13], [14, 15]]
/** Hệ số mùa vụ theo tháng dương lịch 1..12 (Tết, hè, lễ 30/4 cao; tháng 3, 11 thấp). */
const DEMO_SEASON = [0, 1.1, 1.2, 0.9, 1.05, 1.0, 1.1, 1.15, 1.05, 1.0, 1.0, 0.9, 1.05]
/** Hệ số nhân lên hệ số khai thác mục tiêu của từng xe — chỉnh trong 0,55–0,85 (chốt 0,6: ≥ 0,64 vượt 290 lượt / trần dung lượng). */
const DEMO_SCALE = 0.6
/** Bước 2 (lấp khe gần đây) chỉ xét từ ngày tương đối này trở đi. */
const DEMO_FILL_FROM = -35
/** RM-BR-23 / CR-2026-005 — giờ nhận 07:00–10:30, giờ trả 17:00–21:00 (cửa sổ nhận xe đóng sau 21:00). */
const DEMO_PICKUP_SLOTS: ReadonlyArray<readonly [number, number]> = [[7, 0], [7, 30], [8, 0], [8, 30], [9, 0], [9, 30], [10, 0], [10, 30]]
const DEMO_RETURN_SLOTS: ReadonlyArray<readonly [number, number]> = [[17, 0], [17, 30], [18, 0], [18, 30], [19, 0], [19, 30], [20, 0], [20, 30], [21, 0]]
/** CR-2026-003 — ~20% cọc tiền mặt 20 triệu, còn lại cọc xe máy. */
const DEMO_CASH_DEPOSIT_RATE = 0.2

/**
 * Cửa sổ khai thác theo xe: [từ, đến] là ngày tương đối hôm nay (đến = `null` → tới hết lịch sử), chừa biên 2 ngày sau
 * biên bản nhận xe / trước ngày kết thúc. MIRROR `consignment/seed.ts` `buildSpecs()` (hợp đồng #1–#17: `from`/`to`/
 * `endedOffset`) — nếu seed nguồn đổi, `finance/revenue-cost/seed.ts` sẽ `throw` khi lượt mới lọt ngoài hợp đồng hiệu lực.
 * `target` = hệ số khai thác mục tiêu trong thời gian hợp đồng hiệu lực (giả định demo).
 */
interface DemoVehicleSpec {
  id: string
  vehicleClass: VehicleClass
  from: number
  to: number | null
  target: number
}

function demoVehicleSpecs(): DemoVehicleSpec[] {
  // cg_014 (veh_016) bắt đầu ngày 15 của tháng (hiện tại − 2) — consignment/seed.ts dayOfMonth(-2, 15); +2 ngày biên.
  const now = new Date()
  const day15Back2 = Math.round((new Date(now.getFullYear(), now.getMonth() - 2, 15).getTime() - startOfToday().getTime()) / 86_400_000)
  return [
    { id: 'veh_001', vehicleClass: 'VIP_LUXURY', from: -298, to: null, target: 0.6 }, // cg_001 −300
    { id: 'veh_002', vehicleClass: 'STANDARD', from: -343, to: null, target: 0.55 }, // cg_002 −345
    { id: 'veh_003', vehicleClass: 'TWO_SEATER', from: -278, to: null, target: 0.5 }, // cg_003 −280
    { id: 'veh_004', vehicleClass: 'STANDARD', from: -268, to: null, target: 0.55 }, // cg_004 −270
    { id: 'veh_005', vehicleClass: 'STANDARD', from: -248, to: null, target: 0.5 }, // cg_005 −250
    { id: 'veh_006', vehicleClass: 'VIP_LUXURY', from: -318, to: null, target: 0.25 }, // cg_006 −320
    { id: 'veh_007', vehicleClass: 'STANDARD', from: -365, to: -37, target: 0.45 }, // cg_015 TERMINATED tại −35
    { id: 'veh_008', vehicleClass: 'STANDARD', from: -228, to: null, target: 0.6 }, // cg_009 −230
    { id: 'veh_009', vehicleClass: 'STANDARD', from: -218, to: -14, target: 0.5 }, // cg_010 SUSPENDED tại −12
    { id: 'veh_010', vehicleClass: 'TWO_SEATER', from: -208, to: null, target: 0.55 }, // cg_011 −210
    { id: 'veh_011', vehicleClass: 'VIP_LUXURY', from: -198, to: null, target: 0.65 }, // cg_007 −200
    { id: 'veh_012', vehicleClass: 'STANDARD', from: -238, to: null, target: 0.6 }, // cg_012 −240
    { id: 'veh_013', vehicleClass: 'TWO_SEATER', from: -365, to: -68, target: 0.4 }, // cg_017 hết hạn −66
    { id: 'veh_014', vehicleClass: 'VIP_LUXURY', from: -188, to: null, target: 0.5 }, // cg_008 −190
    { id: 'veh_015', vehicleClass: 'STANDARD', from: -158, to: null, target: 0.28 }, // cg_013 −160
    { id: 'veh_016', vehicleClass: 'TWO_SEATER', from: day15Back2 + 2, to: null, target: 0.3 }, // cg_014
    { id: 'veh_017', vehicleClass: 'STANDARD', from: -365, to: null, target: 0.7 }, // xe công ty
    { id: 'veh_018', vehicleClass: 'VIP_LUXURY', from: -365, to: null, target: 0.7 }, // xe công ty
  ]
}

/**
 * Ngày loại trừ theo xe: [xe, từ, đến] (ngày tương đối, gồm đầu mút). Mirror các seed nguồn:
 * - Vehicle Block quá khứ — calendar/seed.ts (veh_006 −40…−35, veh_002 −20…−15, veh_013 từ −5 không thời hạn); thêm ngày gỡ khoá.
 * - Bảo dưỡng / thay phụ tùng — maintenance/seed.ts (các `isoDateOffset`).
 * - Ngày báo sự cố — incidents/seed.ts (các `reportedAt`; sự cố gắn lượt rt_0xx cũ vẫn loại để an toàn).
 * Lượt đã có trong `inputs` (rt_001…rt_039) của cùng xe được lấy trực tiếp từ tham số, không mirror.
 */
const DEMO_EXCLUSIONS: ReadonlyArray<readonly [string, number, number]> = [
  ['veh_006', -40, -34],
  ['veh_002', -20, -14],
  ['veh_013', -5, 0],
  ['veh_001', -60, -60],
  ['veh_017', -20, -20],
  ['veh_007', -15, -15],
  ['veh_002', -90, -90],
  ['veh_012', -45, -45],
  ['veh_003', -40, -40],
  ['veh_009', -25, -25],
  ['veh_014', -50, -50],
  ['veh_016', -10, -10],
  ['veh_002', -1, -1],
  ['veh_004', -3, -3],
  ['veh_005', -1, -1],
  ['veh_012', -6, -6],
  ['veh_006', -3, -3],
  ['veh_014', -7, -7],
  ['veh_016', -9, -9],
  ['veh_011', -3, -3],
  ['veh_008', -4, -4],
  ['veh_003', -12, -12],
  ['veh_013', -20, -20],
  ['veh_015', -15, -15],
]

/** Khách ACTIVE có GPLX B2 còn hạn trong 9 khách gốc (cus_003 hộ chiếu, cus_005 GPLX hết hạn, cus_006 không GPLX, cus_007 GPLX A1, cus_008 BLOCKED bị loại). */
const DEMO_OLD_CUSTOMER_POOL = ['cus_001', 'cus_002', 'cus_004', 'cus_009']
const DEMO_NEW_CUSTOMER_FIRST_SEQ = 10
const DEMO_NEW_CUSTOMER_COUNT = 48

/** Xe máy cọc theo từng khách: [mẫu xe, đời, giá trị ước tính (triệu đồng) ≥ 15] — CR-2026-003. */
const DEMO_BIKES: ReadonlyArray<readonly [string, number, number]> = [
  ['Honda Wave Alpha', 2020, 15],
  ['Honda Vision', 2021, 22],
  ['Yamaha Exciter 155', 2020, 28],
  ['Honda Air Blade', 2019, 24],
  ['Honda Winner X', 2021, 30],
  ['Yamaha Janus', 2022, 20],
  ['Honda SH Mode', 2020, 36],
  ['Honda Lead', 2019, 18],
  ['Suzuki Raider', 2018, 16],
  ['Yamaha NVX', 2021, 26],
]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Ngày tương đối hôm nay (theo ngày địa phương) của một mốc ISO. */
function dayOffsetOf(iso: string): number {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000)
}

function monthOfOffset(offset: number): number {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.getMonth() + 1
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

/** Mô tả xe máy cọc — suy tất định từ id khách (cùng khách luôn cùng một xe máy). */
function demoMotorbikeNote(customerId: string): string {
  const n = Number(customerId.slice(4))
  const [model, year, valueMillions] = DEMO_BIKES[n % DEMO_BIKES.length]
  const plate = `59-${'ABCDEFGHKLMNPSTUVXYZ'[n % 20]}${1 + (n % 9)} ${pad((n * 37) % 1000, 3)}.${pad((n * 53) % 100, 2)}`
  return `Xe máy ${model} ${year}, biển số ${plate}, kèm cà vẹt gốc, giá trị ước tính ${valueMillions}.000.000đ.`
}

function buildDemoHistoryInputs(existing: SeedRentalInput[]): SeedRentalInput[] {
  const rnd = mulberry32(DEMO_PRNG_SEED)
  const specs = demoVehicleSpecs()

  interface Candidate {
    vehicleId: string
    vehicleClass: VehicleClass
    s: number
    e: number
    d: number
    pickSlot: readonly [number, number]
    retSlot: readonly [number, number]
  }
  const candidates: Candidate[] = []

  function drawDuration(): number {
    const total = DEMO_DURATIONS.reduce((sum, [, w]) => sum + w, 0)
    let x = rnd() * total
    for (const [days, weight] of DEMO_DURATIONS) {
      x -= weight
      if (x < 0) return days
    }
    return DEMO_DURATIONS[0][0]
  }

  function obstaclesOf(vehicleId: string): Array<[number, number]> {
    const fixed = DEMO_EXCLUSIONS.filter((x) => x[0] === vehicleId).map((x): [number, number] => [x[1], x[2]])
    const rentals = existing
      .filter((r) => r.vehicleId === vehicleId)
      .map((r): [number, number] => [dayOffsetOf(r.pickupDateTime), dayOffsetOf(r.expectedReturnDateTime)])
    return [...fixed, ...rentals]
  }

  /** Ngày cuối lớn nhất trong các vật cản chạm khoảng [s−1, e+1]; `undefined` nếu khoảng trống. */
  function blockerEnd(obstacles: Array<[number, number]>, s: number, e: number): number | undefined {
    let end: number | undefined
    for (const [a, b] of obstacles) if (a <= e + 1 && s - 1 <= b) end = end === undefined ? b : Math.max(end, b)
    return end
  }

  function addCandidate(spec: DemoVehicleSpec, s: number, e: number): void {
    candidates.push({
      vehicleId: spec.id,
      vehicleClass: spec.vehicleClass,
      s,
      e,
      d: e - s + 1,
      pickSlot: DEMO_PICKUP_SLOTS[Math.floor(rnd() * DEMO_PICKUP_SLOTS.length)],
      retSlot: DEMO_RETURN_SLOTS[Math.floor(rnd() * DEMO_RETURN_SLOTS.length)],
    })
  }

  // ---- Bước 1: rải lượt theo hệ số khai thác mục tiêu × mùa vụ × SCALE. ----
  for (const spec of specs) {
    const obstacles = obstaclesOf(spec.id)
    const windowEnd = Math.min(spec.to ?? DEMO_HISTORY_TO, DEMO_HISTORY_TO)
    let cur = Math.max(spec.from, DEMO_HISTORY_FROM)
    for (;;) {
      const d = drawDuration()
      const u = Math.min(0.9, spec.target * DEMO_SEASON[monthOfOffset(cur)] * DEMO_SCALE)
      const gap = Math.max(0, Math.round((d * (1 - u)) / u) + (Math.floor(rnd() * 3) - 1))
      const s = cur + gap
      const e = s + d - 1
      if (e > windowEnd) break
      const blocked = blockerEnd(obstacles, s, e)
      if (blocked !== undefined) {
        cur = blocked + 2
        continue
      }
      addCandidate(spec, s, e)
      cur = e + 1
    }
  }

  // ---- Bước 2: lấp khe gần đây bằng lượt 2–3 ngày (cách vật cản ≥ 1 ngày) để tháng hiện tại không thiếu doanh thu. ----
  for (const spec of specs) {
    const obstacles = [
      ...obstaclesOf(spec.id),
      ...candidates.filter((c) => c.vehicleId === spec.id).map((c): [number, number] => [c.s, c.e]),
    ]
    const windowEnd = Math.min(spec.to ?? DEMO_HISTORY_TO, DEMO_HISTORY_TO)
    let st = Math.max(DEMO_FILL_FROM, spec.from)
    while (st < windowEnd) {
      const d = 2 + Math.floor(rnd() * 2)
      const e = st + d - 1
      if (e > windowEnd || blockerEnd(obstacles, st, e) !== undefined) {
        st++
        continue
      }
      addCandidate(spec, st, e)
      obstacles.push([st, e])
      st = e + 2
    }
  }

  // ---- Bước 3: sắp theo (giờ nhận, xe) rồi gán id liên tiếp. ----
  const timed = candidates
    .map((c) => ({ c, pickup: dt(c.s, c.pickSlot[0], c.pickSlot[1]), ret: dt(c.e, c.retSlot[0], c.retSlot[1]) }))
    .sort((x, y) => (x.pickup === y.pickup ? x.c.vehicleId.localeCompare(y.c.vehicleId) : x.pickup < y.pickup ? -1 : 1))

  // ---- Bước 4: gán khách (khách thân thiết nặng hơn, đuôi dài 1–3 lượt), bỏ qua khách đang có lượt chồng ngày. ----
  const pool: string[] = [...DEMO_OLD_CUSTOMER_POOL]
  for (let i = 0; i < DEMO_NEW_CUSTOMER_COUNT; i++) pool.push(`cus_${pad(DEMO_NEW_CUSTOMER_FIRST_SEQ + i, 3)}`)
  // 4 khách gốc + 10 khách mới đầu danh sách ≈ 50% số lượt.
  const weights = pool.map((_, i) => (i < DEMO_OLD_CUSTOMER_POOL.length ? 12 : i < DEMO_OLD_CUSTOMER_POOL.length + 10 ? 8 : 3))
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const busy = new Map<string, Array<[number, number]>>()
  for (const r of existing) {
    const list = busy.get(r.customerId) ?? []
    list.push([dayOffsetOf(r.pickupDateTime), dayOffsetOf(r.expectedReturnDateTime)])
    busy.set(r.customerId, list)
  }

  const result: SeedRentalInput[] = []
  timed.forEach(({ c, pickup, ret }, index) => {
    let x = rnd() * weightTotal
    let pick = 0
    for (; pick < pool.length - 1; pick++) {
      x -= weights[pick]
      if (x < 0) break
    }
    let customerId: string | undefined
    for (let step = 0; step < pool.length; step++) {
      const candidateId = pool[(pick + step) % pool.length]
      if (!(busy.get(candidateId) ?? []).some(([a, b]) => a <= c.e && c.s <= b)) {
        customerId = candidateId
        break
      }
    }
    if (!customerId) throw new Error(`[seed rentals/demo-history] không còn khách rảnh cho lượt ${index + 1}`)
    busy.set(customerId, [...(busy.get(customerId) ?? []), [c.s, c.e]])

    // ---- Bước 5: cọc (CR-2026-003). ----
    const cash = rnd() < DEMO_CASH_DEPOSIT_RATE
    result.push({
      id: `rt_${pad(DEMO_FIRST_SEQ + index, 3)}`,
      status: 'COMPLETED',
      customerId,
      vehicleId: c.vehicleId,
      vehicleClass: c.vehicleClass,
      pickupDateTime: pickup,
      expectedReturnDateTime: ret,
      rentalRate: DEMO_CLASS_RATE[c.vehicleClass],
      securityDepositType: cash ? 'CASH_20M' : 'MOTORBIKE',
      securityDepositAssetNote: cash ? undefined : demoMotorbikeNote(customerId),
    })
  })

  validateDemoHistory(existing, result, specs, pool)
  return result
}

/** Kiểm ràng buộc sau khi sinh — vi phạm thì `throw` (tiền lệ `consignment/seed.ts`). */
function validateDemoHistory(existing: SeedRentalInput[], created: SeedRentalInput[], specs: DemoVehicleSpec[], pool: string[]): void {
  const fail = (message: string): never => {
    throw new Error(`[seed rentals/demo-history] ${message}`)
  }
  const bufferMs = TURNAROUND_BUFFER_MINUTES * 60 * 1000
  const latestReturn = Date.now() - 3 * 86_400_000 // D12 — trả xe muộn nhất là hôm nay − 3 ngày
  const accepted: SeedRentalInput[] = [...existing]
  for (const r of created) {
    const spec = specs.find((v) => v.id === r.vehicleId)
    if (!spec) return fail(`${r.id}: xe ${r.vehicleId} không có trong bảng cửa sổ khai thác`)
    const days = rentalDurationDays(r.pickupDateTime, r.expectedReturnDateTime)
    if (days < 1 || days > DEMO_MAX_DURATION_DAYS) fail(`${r.id}: thời lượng ${days} ngày ngoài 1–${DEMO_MAX_DURATION_DAYS}`)
    if (new Date(r.expectedReturnDateTime).getTime() > latestReturn) fail(`${r.id}: trả xe muộn hơn hôm nay − 3 ngày`)
    if (!pool.includes(r.customerId)) fail(`${r.id}: khách ${r.customerId} ngoài pool khách hợp lệ`)
    const s = dayOffsetOf(r.pickupDateTime)
    const e = dayOffsetOf(r.expectedReturnDateTime)
    if (s < Math.max(spec.from, DEMO_HISTORY_FROM) || e > Math.min(spec.to ?? DEMO_HISTORY_TO, DEMO_HISTORY_TO)) {
      fail(`${r.id}: ngoài cửa sổ khai thác của ${r.vehicleId}`)
    }
    for (const [vehicleId, from, to] of DEMO_EXCLUSIONS) {
      if (vehicleId === r.vehicleId && from <= e && s <= to) fail(`${r.id}: phủ ngày loại trừ ${from}…${to} của ${vehicleId}`)
    }
    const a0 = new Date(r.pickupDateTime).getTime()
    const a1 = new Date(r.expectedReturnDateTime).getTime()
    for (const o of accepted) {
      const b0 = new Date(o.pickupDateTime).getTime()
      const b1 = new Date(o.expectedReturnDateTime).getTime()
      if (o.vehicleId === r.vehicleId && a0 < b1 + bufferMs && b0 < a1 + bufferMs) fail(`${r.id}: trùng lịch xe ${r.vehicleId} với ${o.id} (RM-BR-04/RM-BR-23)`)
      if (o.customerId === r.customerId && a0 < b1 && b0 < a1) fail(`${r.id}: khách ${r.customerId} có 2 lượt chồng thời gian với ${o.id}`)
    }
    accepted.push(r)
  }
}

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

    // ---- Lịch sử COMPLETED phục vụ báo cáo doanh thu (REVENUE-COST-PLAN.md §9.2, Phase 4.3) ----
    // 10 lượt trong quá khứ xa (−170 → −41 ngày), CHỈ có Settlement/Payment ở `finance/seed.ts`: không có hợp đồng,
    // biên bản giao–nhận hay phân công (Rental Detail các tab đó để trống). Không discount/phụ phí/phí giao để
    // Final Amount = baseAmount; cọc xe máy nên không có luồng cọc/hoàn. `rt_038` là lượt có quyết toán từng bị đảo.
    {
      id: 'rt_030',
      status: 'COMPLETED',
      customerId: 'cus_001',
      vehicleId: 'veh_017',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-170, 9, 0),
      expectedReturnDateTime: dt(-167, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_031',
      status: 'COMPLETED',
      customerId: 'cus_002',
      vehicleId: 'veh_001',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-160, 9, 0),
      expectedReturnDateTime: dt(-156, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_032',
      status: 'COMPLETED',
      customerId: 'cus_003',
      vehicleId: 'veh_003',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-150, 9, 0),
      expectedReturnDateTime: dt(-148, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_033',
      status: 'COMPLETED',
      customerId: 'cus_004',
      vehicleId: 'veh_018',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-135, 9, 0),
      expectedReturnDateTime: dt(-130, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_034',
      status: 'COMPLETED',
      customerId: 'cus_005',
      vehicleId: 'veh_004',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-120, 9, 0),
      expectedReturnDateTime: dt(-117, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_035',
      status: 'COMPLETED',
      customerId: 'cus_007',
      vehicleId: 'veh_017',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-100, 9, 0),
      expectedReturnDateTime: dt(-96, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_036',
      status: 'COMPLETED',
      customerId: 'cus_009',
      vehicleId: 'veh_010',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-85, 9, 0),
      expectedReturnDateTime: dt(-82, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_037',
      status: 'COMPLETED',
      customerId: 'cus_006',
      vehicleId: 'veh_013',
      vehicleClass: 'TWO_SEATER',
      pickupDateTime: dt(-75, 9, 0),
      expectedReturnDateTime: dt(-72, 21, 0),
      rentalRate: 500000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_038',
      status: 'COMPLETED',
      customerId: 'cus_001',
      vehicleId: 'veh_011',
      vehicleClass: 'VIP_LUXURY',
      pickupDateTime: dt(-65, 9, 0),
      expectedReturnDateTime: dt(-62, 21, 0),
      rentalRate: 1800000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
    {
      id: 'rt_039',
      status: 'COMPLETED',
      customerId: 'cus_002',
      vehicleId: 'veh_005',
      vehicleClass: 'STANDARD',
      pickupDateTime: dt(-45, 9, 0),
      expectedReturnDateTime: dt(-41, 21, 0),
      rentalRate: 900000,
      securityDepositType: 'MOTORBIKE',
      securityDepositAssetNote: MOTORBIKE_NOTE,
    },
  ]

  inputs.push(...buildDemoHistoryInputs(inputs)) // docs/DEMO-DATA-PLAN.md §3.2

  writeJson(RENTALS_STORAGE_KEY, inputs.map(buildRental))
}

registerSeedStep(seedRentals)
