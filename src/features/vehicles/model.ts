import { z } from 'zod'
import {
  VEHICLE_CLASSES,
  VEHICLE_DOCUMENT_TYPES,
  type OwnershipType,
  type VehicleClass,
  type VehicleDocumentType,
  type VehicleStatus,
} from '@/shared/domain/enums'
import { documentExpiryStatus } from '@/shared/lib/documentStatus'

/**
 * Giấy tờ xe — `VehicleManagement-BRD.md` §16.1 (module `VM`), entity thống
 * nhất từ CR-2026-026 thay thế các field rời rạc `Registration Number`/
 * `Insurance Provider`… ở cấp `Vehicle`. Cho phép nhiều bản ghi lịch sử cùng
 * loại — không xoá, chỉ thêm bản mới (`addDocument`/`updateDocument`).
 */
export interface VehicleDocument {
  id: string
  documentType: VehicleDocumentType
  documentNumber?: string
  issueDate?: string
  expiryDate?: string
  /** Ngưỡng cảnh báo riêng của bản ghi này, mặc định 30 — CR-2026-046, `VM-RULE-016`. */
  warningLeadDays: number
  note?: string
  fileMeta?: { fileName: string; uploadedAt: string; uploadedBy: string }
  /** Chỉ `VEHICLE_REGISTRATION`. */
  registeredOwnerName?: string
  /** Chỉ `INSPECTION`. */
  inspectionCenter?: string
  /** Chỉ `INSURANCE`. */
  insuranceProvider?: string
  policyNumber?: string
  /** Chỉ `MORTGAGE_RECEIPT`. */
  issuingBank?: string
  heldRegistrationNumber?: string
  createdAt: string
  updatedAt: string
}

/** Hồ sơ xe — `VehicleManagement-BRD.md` §7 (module `VM`). */
export interface Vehicle {
  id: string
  plate: string
  brand: string
  model: string
  manufacturingYear?: number
  color?: string
  /** Quyết định Price Per KM & Allowed KM — CR-2026-008, `VM-RULE-011`. */
  vehicleClass: VehicleClass
  /**
   * `VM-RULE-015` — mặc định `OWNED`. BRD gốc dùng `COMPANY_OWNED` nhưng
   * `WebappQuanTri.md` §6.2 + `enums.ts` đã scaffold thống nhất `OWNED`.
   * TODO(OQ: VM-RULE-015 — field này sẽ chuyển thành read-only tại đây khi
   * VehicleConsignment (Phase 5) build, lúc đó chỉ sửa được qua module VC.)
   */
  ownershipType: OwnershipType
  /** `VM-RULE-018`, CR-2026-042 — xe đang thế chấp ngân hàng, nên có `MORTGAGE_RECEIPT` hiệu lực. */
  bankFinanced: boolean
  /** Đọc bởi `features/maintenance` để tính Next Due KM — không đổi tên/shape. */
  currentKm: number
  fuelLevel?: number
  status: VehicleStatus
  note?: string
  documents: VehicleDocument[]
  createdAt: string
  updatedAt: string
}

/** `VM-RULE-001`, BRD §8, `AC-VM-002` — biển số duy nhất toàn hệ thống. */
export function isPlateTaken(list: Vehicle[], plate: string, exceptId?: string): boolean {
  const normalized = plate.trim().toUpperCase()
  return list.some((v) => v.id !== exceptId && v.plate.trim().toUpperCase() === normalized)
}

/**
 * `VM-RULE-003/004`, `AC-VM-003` — ma trận chuyển trạng thái tay ở Round 1.
 * `RENTED` không có action tay (chỉ Rental Management đặt tự động, Phase 2
 * chưa tồn tại); `INACTIVE` là trạng thái cuối, một chiều — cùng tinh thần
 * `EmployeeStatus`/`CustomerStatus`.
 */
const STATUS_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  AVAILABLE: ['MAINTENANCE', 'INACTIVE'],
  MAINTENANCE: ['AVAILABLE', 'INACTIVE'],
  RENTED: [],
  INACTIVE: [],
}

export function canChangeStatus(from: VehicleStatus, to: VehicleStatus): boolean {
  if (from === to) return false
  return STATUS_TRANSITIONS[from].includes(to)
}

export function availableStatusTransitions(from: VehicleStatus): VehicleStatus[] {
  return STATUS_TRANSITIONS[from]
}

/** Số giấy tờ `EXPIRING_SOON`/`EXPIRED` của xe — dùng cho badge cảnh báo ở List (BRD §2). */
export function countDocumentsNeedingAttention(vehicle: Vehicle, today: Date = new Date()): number {
  return vehicle.documents.filter((d) => documentExpiryStatus(d.expiryDate, d.warningLeadDays, today) !== 'VALID')
    .length
}

const NUMERIC_RE = /^\d+$/

/**
 * `UC-VM` tạo/sửa xe — `vehicleClass` mặc định `STANDARD`, `ownershipType`
 * mặc định `OWNED`. Field số (`currentKm`/`manufacturingYear`/`fuelLevel`)
 * khai dạng `string` trong form (giống pattern `phone` của Customer/Employee)
 * rồi convert sang `number` ở `toInput()` của `VehicleFormSheet` — tránh lỗi
 * kiểu giữa `z.coerce.number()` (input `unknown`) và `react-hook-form`.
 */
export const vehicleFormSchema = z.object({
  plate: z.string().trim().min(1, 'Biển số là bắt buộc'),
  brand: z.string().trim().min(1, 'Hãng xe là bắt buộc'),
  model: z.string().trim().min(1, 'Dòng xe là bắt buộc'),
  manufacturingYear: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (NUMERIC_RE.test(v) && Number(v) >= 1980 && Number(v) <= 2100), {
      message: 'Năm sản xuất không hợp lệ',
    }),
  color: z.string().trim().optional(),
  vehicleClass: z.enum(VEHICLE_CLASSES),
  ownershipType: z.enum(['OWNED', 'CONSIGNED']),
  bankFinanced: z.boolean(),
  currentKm: z
    .string()
    .trim()
    .min(1, 'Odo hiện tại là bắt buộc')
    .refine((v) => NUMERIC_RE.test(v), { message: 'Odo hiện tại phải là số nguyên không âm' }),
  fuelLevel: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (NUMERIC_RE.test(v) && Number(v) >= 0 && Number(v) <= 100), {
      message: 'Mức nhiên liệu phải từ 0 đến 100',
    }),
  note: z.string().trim().optional(),
})

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

/**
 * `UC-VM`/`VM §16.1` — thêm/sửa giấy tờ xe. `expiryDate` bắt buộc trừ khi
 * `documentType === 'VEHICLE_REGISTRATION'` và xe không `bankFinanced` (BRD
 * §16.1) — nhận `bankFinanced` của xe hiện tại để refine đúng ngữ cảnh.
 * `warningLeadDays` cùng lý do `string` như `vehicleFormSchema` ở trên.
 */
export function vehicleDocumentFormSchema(bankFinanced: boolean) {
  return z
    .object({
      documentType: z.enum(VEHICLE_DOCUMENT_TYPES),
      documentNumber: z.string().trim().optional(),
      issueDate: z.string().trim().optional(),
      expiryDate: z.string().trim().optional(),
      warningLeadDays: z
        .string()
        .trim()
        .min(1, 'Ngưỡng cảnh báo là bắt buộc')
        .refine((v) => NUMERIC_RE.test(v), { message: 'Ngưỡng cảnh báo phải là số nguyên không âm' }),
      note: z.string().trim().optional(),
      registeredOwnerName: z.string().trim().optional(),
      inspectionCenter: z.string().trim().optional(),
      insuranceProvider: z.string().trim().optional(),
      policyNumber: z.string().trim().optional(),
      issuingBank: z.string().trim().optional(),
      heldRegistrationNumber: z.string().trim().optional(),
    })
    .superRefine((data, ctx) => {
      const expiryRequired = data.documentType !== 'VEHICLE_REGISTRATION' || bankFinanced
      if (expiryRequired && !data.expiryDate) {
        ctx.addIssue({ code: 'custom', path: ['expiryDate'], message: 'Ngày hết hạn là bắt buộc' })
      }
    })
}

export type VehicleDocumentFormValues = z.infer<ReturnType<typeof vehicleDocumentFormSchema>>
