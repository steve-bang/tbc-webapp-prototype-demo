import { z } from 'zod'
import type { Vehicle } from '@/features/vehicles'
import { MAINTENANCE_RULE_APPLIES_TO, type MaintenanceRuleAppliesTo } from '@/shared/domain/enums'

/**
 * Quy tắc bảo dưỡng — `VehicleMaintenance-BRD.md` §6.1 (module `MT`), áp dụng
 * theo một xe cụ thể (`SPECIFIC_VEHICLE`) hoặc cả dòng xe (`VEHICLE_MODEL`).
 * Vô hiệu hoá thay vì xoá (`MT-BR-11`).
 *
 * KHÔNG có field/quan hệ nào trỏ tới "Owner Statement"/"Deduction" — xem
 * `docs/MAINTENANCE-MANAGEMENT-PLAN.md` §0 (`MT-BR-09` bãi bỏ trên thực tế
 * theo CR-2026-050, dù BRD gốc còn nhắc).
 */
export interface MaintenanceRule {
  id: string
  category: string
  thresholdKm: number
  appliesTo: MaintenanceRuleAppliesTo
  /** Bắt buộc khi `appliesTo === 'SPECIFIC_VEHICLE'`. */
  vehicleId?: string
  /** Bắt buộc khi `appliesTo === 'VEHICLE_MODEL'` — so khớp `Vehicle.model`. */
  vehicleModel?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Lịch sử bảo dưỡng thực tế — `MT-BR-03`. Append-only: không có `update()`/
 * `remove()` (`MT-BR-11`) — khác `VehicleDocument` là giấy tờ có thể sửa.
 */
export interface MaintenanceRecord {
  id: string
  vehicleId: string
  date: string
  odometerAtService: number
  /** Free text, nên khớp `category` của một Rule active nhưng không bắt buộc. */
  category: string
  cost: number
  provider?: string
  note?: string
  createdAt: string
  createdBy: string
}

/**
 * Lịch sử thay thế phụ tùng — `MT-BR-07`, độc lập hoàn toàn với
 * `MaintenanceRule`/`MaintenanceRecord` (không tham chiếu `category`, không
 * tính vào Next Due KM). Không quản lý tồn kho (chỉ là lịch sử).
 */
export interface SparePartRecord {
  id: string
  vehicleId: string
  partName: string
  quantity: number
  date: string
  odometerAtReplacement: number
  cost: number
  provider?: string
  note?: string
  createdAt: string
  createdBy: string
}

/**
 * `MT §6.3` — Next Due KM = Odometer at Service (MaintenanceRecord gần nhất
 * cùng vehicleId + category) + Threshold KM (MaintenanceRule áp dụng, ưu
 * tiên SPECIFIC_VEHICLE hơn VEHICLE_MODEL — MT-BR-02).
 *
 * Khi CHƯA có MaintenanceRecord nào cho cặp (vehicleId, category): BRD EX-02
 * nói dùng "Odometer tại Consignment Intake" — nhưng VehicleConsignment
 * (Phase 5) chưa tồn tại, không có nguồn đó. Phase 1 dùng baseline = 0 (Next
 * Due KM = Threshold KM) — nghĩa là xe chưa có lịch sử cho hạng mục đó sẽ
 * hiện đến hạn ngay nếu Current KM đã vượt Threshold, đúng tinh thần "cần
 * thiết lập bảo dưỡng lần đầu sớm". TODO(OQ: VehicleMaintenance-BRD.md EX-02
 * — baseline thật sẽ cần Consignment Intake khi VehicleConsignment build,
 * sửa lại cùng lúc).
 */
export function nextDueKm(rule: MaintenanceRule, latestRecordOdometer: number | undefined): number {
  return (latestRecordOdometer ?? 0) + rule.thresholdKm
}

/**
 * `MT §6.3/§19 Q2` — ngưỡng DUE_SOON (km) BA đề xuất tạm 500km (khớp ví dụ
 * minh hoạ AC-MT-003 trong BRD, KHÔNG phải giá trị đã chốt chính thức).
 * TODO(OQ: VehicleMaintenance-BRD.md §19 Q2 — số km cụ thể chưa chốt).
 */
export const DEFAULT_DUE_SOON_WARNING_KM = 500

/** Trạng thái đến hạn — tính động (derived), không lưu persistent nên không đặt trong `enums.ts`. */
export type MaintenanceDueStatus = 'OK' | 'DUE_SOON' | 'OVERDUE'

export function maintenanceDueStatus(
  nextDue: number,
  currentKm: number,
  warningKm: number = DEFAULT_DUE_SOON_WARNING_KM,
): MaintenanceDueStatus {
  if (currentKm >= nextDue) return 'OVERDUE'
  if (currentKm >= nextDue - warningKm) return 'DUE_SOON'
  return 'OK'
}

/**
 * `MT-BR-02` — chọn Rule active ưu tiên `SPECIFIC_VEHICLE` trước
 * `VEHICLE_MODEL`, cùng `category`, áp dụng cho 1 xe cụ thể.
 */
export function applicableRule(
  rules: MaintenanceRule[],
  vehicle: Pick<Vehicle, 'id' | 'model'>,
  category: string,
): MaintenanceRule | undefined {
  const activeForCategory = rules.filter((r) => r.active && r.category === category)
  const specific = activeForCategory.find((r) => r.appliesTo === 'SPECIFIC_VEHICLE' && r.vehicleId === vehicle.id)
  if (specific) return specific
  return activeForCategory.find((r) => r.appliesTo === 'VEHICLE_MODEL' && r.vehicleModel === vehicle.model)
}

/** Odometer lớn nhất đã ghi nhận (bất kể ngày nhập) — dùng để derive "gần nhất" vì odo chỉ tăng dần. */
function maxOdometer(records: MaintenanceRecord[]): number | undefined {
  if (records.length === 0) return undefined
  return records.reduce((max, r) => (r.odometerAtService > max ? r.odometerAtService : max), 0)
}

/** Odometer của Record gần nhất cùng xe + category — nguồn cho `nextDueKm()`. */
export function latestOdometerForCategory(
  records: MaintenanceRecord[],
  vehicleId: string,
  category: string,
): number | undefined {
  return maxOdometer(records.filter((r) => r.vehicleId === vehicleId && r.category === category))
}

/** `UC-MT-02` A1 — validate odometer nhập không nhỏ hơn record gần nhất cùng xe (bất kể category). */
export function isOdometerRegression(records: MaintenanceRecord[], vehicleId: string, newOdometer: number): boolean {
  const latest = maxOdometer(records.filter((r) => r.vehicleId === vehicleId))
  return latest !== undefined && newOdometer < latest
}

const NUMERIC_RE = /^\d+$/
const POSITIVE_NUMERIC_RE = /^[1-9]\d*$/

/** `MT-BR-01` — Category/Threshold KM/Applies To bắt buộc; vehicleId/vehicleModel theo `appliesTo`. */
export const maintenanceRuleFormSchema = z
  .object({
    category: z.string().trim().min(1, 'Hạng mục là bắt buộc'),
    thresholdKm: z
      .string()
      .trim()
      .min(1, 'Số km giữa 2 lần là bắt buộc')
      .refine((v) => POSITIVE_NUMERIC_RE.test(v), { message: 'Số km phải là số nguyên dương' }),
    appliesTo: z.enum(MAINTENANCE_RULE_APPLIES_TO),
    vehicleId: z.string().trim().optional(),
    vehicleModel: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.appliesTo === 'SPECIFIC_VEHICLE' && !data.vehicleId) {
      ctx.addIssue({ code: 'custom', path: ['vehicleId'], message: 'Chọn xe áp dụng' })
    }
    if (data.appliesTo === 'VEHICLE_MODEL' && !data.vehicleModel) {
      ctx.addIssue({ code: 'custom', path: ['vehicleModel'], message: 'Chọn dòng xe áp dụng' })
    }
  })

export type MaintenanceRuleFormValues = z.infer<typeof maintenanceRuleFormSchema>

/** `MT-BR-03` — Vehicle/Date/Odometer/Category/Cost bắt buộc. */
export const maintenanceRecordFormSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Chọn xe'),
  date: z.string().trim().min(1, 'Ngày là bắt buộc'),
  odometerAtService: z
    .string()
    .trim()
    .min(1, 'Odo là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Odo phải là số nguyên không âm' }),
  category: z.string().trim().min(1, 'Hạng mục là bắt buộc'),
  cost: z
    .string()
    .trim()
    .min(1, 'Chi phí là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Chi phí phải là số nguyên không âm' }),
  provider: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export type MaintenanceRecordFormValues = z.infer<typeof maintenanceRecordFormSchema>

export const sparePartRecordFormSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Chọn xe'),
  partName: z.string().trim().min(1, 'Tên phụ tùng là bắt buộc'),
  quantity: z
    .string()
    .trim()
    .min(1, 'Số lượng là bắt buộc')
    .refine((v) => POSITIVE_NUMERIC_RE.test(v), { message: 'Số lượng phải là số nguyên dương' }),
  date: z.string().trim().min(1, 'Ngày là bắt buộc'),
  odometerAtReplacement: z
    .string()
    .trim()
    .min(1, 'Odo là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Odo phải là số nguyên không âm' }),
  cost: z
    .string()
    .trim()
    .min(1, 'Chi phí là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Chi phí phải là số nguyên không âm' }),
  provider: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export type SparePartRecordFormValues = z.infer<typeof sparePartRecordFormSchema>
