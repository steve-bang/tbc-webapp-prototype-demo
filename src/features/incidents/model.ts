import { z } from 'zod'
// Deep-import CHỈ type `MediaMeta` từ `handover-return` (kế hoạch §0.3/§2.1 —
// mirror placeholder media đã dùng, KHÔNG import giá trị runtime/hàm của
// feature đó).
import type { MediaMeta } from '@/features/handover-return/model'
import type {
  IncidentBaselineReference,
  IncidentItemType,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
  IncidentType,
  Liability,
} from '@/shared/domain/enums'

/**
 * Hồ sơ sự cố — `DamageIncident-BRD.md` §6-§13/§20 (module `DI`),
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §2.1. Flat fields (không nhúng
 * sâu) — khác hẳn `ReturnIncidentItem` (nhúng trong `ReturnRecord`, status cố
 * định `OPEN`): đây là entity độc lập có vòng đời đầy đủ (11 trạng thái).
 */
export interface Incident {
  id: string
  /** Tạm `SC-0001` tăng dần — TODO(OQ: `DamageIncident-BRD.md` §27, quy tắc đánh số chính thức chưa chốt). */
  incidentCode: string
  /** DI-BR-01 — mỗi Incident thuộc đúng 1 Vehicle. */
  vehicleId: string
  /** DI-BR-02 — có thể không gắn Rental (STANDALONE do công ty/INSPECTION). */
  rentalId?: string
  source: IncidentSource
  reportedByUserId: string
  reportedByName: string
  reportedByRole: string
  reportedAt: string
  type: IncidentType
  severity: IncidentSeverity
  /** DI-BR-07 — chỉ lưu field, KHÔNG tự động chuyển Vehicle `MAINTENANCE` (kế hoạch §0.4). */
  safetyImpact: boolean
  /** Mô tả vị trí tự do — kế hoạch §0.5 (chưa có sơ đồ xe tương tác). */
  location?: string
  description: string
  /** Placeholder, mirror `MediaMeta` của `handover-return` — DI-BR-03 (chưa validate cứng số ảnh, kế hoạch §4). */
  mediaMeta: MediaMeta[]
  /** Bắt buộc khi `source === 'RETURN'` — DI-BR-14. */
  baselineReference?: IncidentBaselineReference
  /** Mặc định `UNDETERMINED` lúc tạo (DI-BR-05) — không optional. */
  liability: Liability
  /** Bắt buộc khi `liability === 'SHARED'` (mô tả tỉ lệ phân chia). */
  liabilityNote?: string
  /** Nhập lúc tạo. */
  estimatedCost: number
  /** Nhập khi `REPAIRED` (DI-BR-09). */
  actualCostParts?: number
  actualCostLabor?: number
  actualCostOther?: number
  /** Nhập ở bước Xác định trách nhiệm (DI-BR-06). */
  customerCharge?: number
  companyCost?: number
  insuranceCovered?: number
  /** Nhập khi `IN_REPAIR`. */
  repairVendorName?: string
  repairStartDate?: string
  repairEndDate?: string
  /** Placeholder hoá đơn — DI-BR-09. */
  repairInvoiceMeta?: MediaMeta
  /** Tối giản, không có vòng đời claim riêng (kế hoạch §1.2). */
  insuranceClaimCode?: string
  insuranceClaimStatus?: string
  insuranceClaimAmount?: number
  /** Chỉ hiển thị khi seed ở `DISPUTED` (kế hoạch §1.2 — không build UI). */
  disputeNote?: string
  /** 11 giá trị, khởi tạo `OPEN`. */
  status: IncidentStatus
  cancelReason?: string
  writeOffReason?: string
  closedNoActionReason?: string
  closedAt?: string
  /**
   * Liên kết nguồn khi `source === 'RETURN'` — cần thiết để xác định
   * `ReturnIncidentItem` nào ĐÃ chuyển thành `Incident` (tránh tạo trùng +
   * RentalIncidentsTab biết item nào còn "chưa tạo hồ sơ"). Không có trong
   * bảng field §2.1 của kế hoạch — bổ sung kỹ thuật cần thiết, không phải
   * quyết định nghiệp vụ mới (DI-BR-14 vẫn chỉ kế thừa dữ liệu, không nhập lại).
   */
  returnRecordId?: string
  returnIncidentItemId?: string
  createdAt: string
  updatedAt: string
}

/** Tạo mã sự cố tạm — TODO(OQ: `DamageIncident-BRD.md` §27, quy tắc đánh số chính thức chưa chốt). */
export function generateIncidentCode(existingCount: number): string {
  return `SC-${String(existingCount + 1).padStart(4, '0')}`
}

/**
 * BA đặt mã — mapping từ `IncidentItemType` (`ReturnIncidentItem`, 9 giá trị)
 * sang `IncidentType` (`Incident`, 7 nhóm BRD §9.1) khi tạo Incident từ
 * `ReturnIncidentItem` (DI-BR-14 — kế thừa, không nhập lại).
 */
const INCIDENT_ITEM_TYPE_TO_INCIDENT_TYPE: Record<IncidentItemType, IncidentType> = {
  SCRATCH: 'EXTERIOR',
  DENT: 'EXTERIOR',
  CRACK: 'EXTERIOR',
  FUNCTIONAL_DAMAGE: 'FUNCTIONAL',
  MISSING_ACCESSORY: 'ACCESSORY',
  INTERIOR_DAMAGE: 'INTERIOR',
  STAIN: 'HYGIENE',
  ACCIDENT: 'ACCIDENT',
  OTHER: 'OTHER',
}

export function mapIncidentItemTypeToIncidentType(itemType: IncidentItemType): IncidentType {
  return INCIDENT_ITEM_TYPE_TO_INCIDENT_TYPE[itemType]
}

/**
 * DI-BR-06 — Customer Charge + Company Cost + Insurance Covered phải bằng
 * Actual Cost (nếu đã nhập đủ 3 phần `actualCost*`) hoặc Estimated Cost (nếu
 * chưa) — sai lệch > 1đ coi là không khớp (tránh lỗi số thực dấu phẩy động).
 */
export function validateCostAllocation(
  incident: Pick<Incident, 'actualCostParts' | 'actualCostLabor' | 'actualCostOther' | 'estimatedCost' | 'customerCharge' | 'companyCost' | 'insuranceCovered'>,
): boolean {
  const hasActualCost =
    incident.actualCostParts !== undefined || incident.actualCostLabor !== undefined || incident.actualCostOther !== undefined
  const basis = hasActualCost
    ? (incident.actualCostParts ?? 0) + (incident.actualCostLabor ?? 0) + (incident.actualCostOther ?? 0)
    : incident.estimatedCost
  const allocated = (incident.customerCharge ?? 0) + (incident.companyCost ?? 0) + (incident.insuranceCovered ?? 0)
  return Math.abs(allocated - basis) <= 1
}

// ---- Guard trạng thái — mirror pattern `canCancel()`/`canVoid()` các feature trước. ----

/** `OPEN -> ASSESSING`. */
export function canStartAssessing(incident: Incident): boolean {
  return incident.status === 'OPEN'
}

/**
 * `ASSESSING`/`WAITING_APPROVAL -> APPROVED` — chặn nếu chưa xác định trách
 * nhiệm (DI-BR-05). Cũng dùng làm điều kiện cho phép gọi lại bước "Xác định
 * trách nhiệm" khi đã `APPROVED` (DI-BR-13 — sửa sau Approved).
 */
export function canApprove(incident: Incident): boolean {
  return (incident.status === 'ASSESSING' || incident.status === 'WAITING_APPROVAL') && incident.liability !== 'UNDETERMINED'
}

/** Hằng số tạm — TODO(OQ: `DamageIncident-BRD.md` §27, ngưỡng duyệt chính thức chưa chốt, kế hoạch §0.5). */
export const APPROVAL_THRESHOLD = 2_000_000

/** DI-BR-08 — vượt ngưỡng duyệt phải qua `WAITING_APPROVAL`, không tự `APPROVED`. */
export function needsWaitingApproval(estimatedCost: number): boolean {
  return estimatedCost > APPROVAL_THRESHOLD
}

/** `APPROVED -> IN_REPAIR`. */
export function canStartRepair(incident: Incident): boolean {
  return incident.status === 'APPROVED'
}

/** `IN_REPAIR -> REPAIRED` — chặn nếu thiếu `actualCost*`/`repairInvoiceMeta` (DI-BR-09). */
export function canMarkRepaired(incident: Incident): boolean {
  return (
    incident.status === 'IN_REPAIR' &&
    incident.actualCostParts !== undefined &&
    incident.actualCostLabor !== undefined &&
    incident.actualCostOther !== undefined &&
    incident.repairInvoiceMeta !== undefined
  )
}

/** `REPAIRED -> CLOSED` — chặn nếu `liability === 'UNDETERMINED'` (DI-BR-05/10). */
export function canClose(incident: Incident): boolean {
  return incident.status === 'REPAIRED' && incident.liability !== 'UNDETERMINED'
}

/** `OPEN`/`ASSESSING`/`APPROVED -> CANCELLED`. */
export function canCancelIncident(incident: Incident): boolean {
  return incident.status === 'OPEN' || incident.status === 'ASSESSING' || incident.status === 'APPROVED'
}

// ---- Form schema (react-hook-form + zod, `CONVENTIONS.md` §7) ----

const NUMERIC_RE = /^\d+$/

/**
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.5 — form tạo Incident (thủ
 * công/từ Return). `location` chỉ bắt buộc (DI-BR-03) ở biến thể thủ công
 * (`source !== 'RETURN'`) — biến thể từ Return hiển thị field kế thừa
 * read-only (không qua input có tên `location` của form này), `vehicleId`/
 * `rentalId`/`type`/`description`/`estimatedCost` vẫn tiền điền hợp lệ từ
 * `IncidentFromReturnPrefill` để qua được validate chung (component tạo dialog
 * không gửi các giá trị này khi `fromReturn` — chỉ gửi `severity`/`safetyImpact`).
 */
export const incidentCreateFormSchema = z
  .object({
    vehicleId: z.string().trim().min(1, 'Chọn xe'),
    rentalId: z.string().trim().optional(),
    source: z.string().trim().min(1, 'Chọn nguồn phát sinh'),
    type: z.string().trim().min(1, 'Chọn loại sự cố'),
    severity: z.string().trim().min(1, 'Chọn mức độ nghiêm trọng'),
    safetyImpact: z.boolean(),
    location: z.string().trim().optional(),
    description: z.string().trim().min(3, 'Mô tả là bắt buộc (tối thiểu 3 ký tự)'),
    estimatedCost: z
      .string()
      .trim()
      .min(1, 'Chi phí dự kiến là bắt buộc')
      .refine((v) => NUMERIC_RE.test(v), { message: 'Chi phí dự kiến phải là số nguyên không âm' }),
  })
  .superRefine((data, ctx) => {
    if (data.source !== 'RETURN' && !data.location) {
      ctx.addIssue({ code: 'custom', path: ['location'], message: 'Vị trí hư hỏng là bắt buộc (DI-BR-03)' })
    }
  })
export type IncidentCreateFormValues = z.infer<typeof incidentCreateFormSchema>

/** Form "Đánh giá" (`OPEN -> ASSESSING`, UC-DI-03/04). */
export const incidentAssessFormSchema = z.object({
  type: z.string().trim().min(1, 'Chọn loại sự cố'),
  severity: z.string().trim().min(1, 'Chọn mức độ nghiêm trọng'),
  safetyImpact: z.boolean(),
  location: z.string().trim().min(1, 'Vị trí hư hỏng là bắt buộc (DI-BR-03)'),
  description: z.string().trim().min(3, 'Mô tả là bắt buộc (tối thiểu 3 ký tự)'),
  baselineReference: z.string().trim().optional(),
})
export type IncidentAssessFormValues = z.infer<typeof incidentAssessFormSchema>

/** Form "Xác định trách nhiệm & chi phí" (UC-DI-05). Validate tổng = Actual/Estimated Cost (DI-BR-06) ở component (cần biết incident gốc). */
export const incidentLiabilityFormSchema = z
  .object({
    liability: z.string().trim().min(1, 'Chọn bên chịu trách nhiệm'),
    liabilityNote: z.string().trim().optional(),
    customerCharge: z.string().trim().refine((v) => v === '' || NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
    companyCost: z.string().trim().refine((v) => v === '' || NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
    insuranceCovered: z.string().trim().refine((v) => v === '' || NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
  })
  .superRefine((data, ctx) => {
    if (data.liability === 'SHARED' && !data.liabilityNote) {
      ctx.addIssue({ code: 'custom', path: ['liabilityNote'], message: 'Mô tả tỉ lệ phân chia trách nhiệm là bắt buộc khi Liability = SHARED' })
    }
  })
export type IncidentLiabilityFormValues = z.infer<typeof incidentLiabilityFormSchema>

/** Form "Bắt đầu sửa" (`APPROVED -> IN_REPAIR`). */
export const incidentStartRepairFormSchema = z.object({
  repairVendorName: z.string().trim().min(1, 'Đơn vị sửa là bắt buộc'),
  repairStartDate: z.string().trim().min(1, 'Ngày bắt đầu sửa là bắt buộc'),
})
export type IncidentStartRepairFormValues = z.infer<typeof incidentStartRepairFormSchema>

/** Form "Hoàn tất sửa" (`IN_REPAIR -> REPAIRED`) — chặn thiếu actual cost/hoá đơn (DI-BR-09). */
export const incidentCompleteRepairFormSchema = z.object({
  actualCostParts: z.string().trim().refine((v) => NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
  actualCostLabor: z.string().trim().refine((v) => NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
  actualCostOther: z.string().trim().refine((v) => NUMERIC_RE.test(v), { message: 'Phải là số nguyên không âm' }),
  repairEndDate: z.string().trim().min(1, 'Ngày hoàn tất sửa là bắt buộc'),
  invoiceNote: z.string().trim().min(3, 'Số hoá đơn/ghi chú hoá đơn là bắt buộc (DI-BR-09)'),
})
export type IncidentCompleteRepairFormValues = z.infer<typeof incidentCompleteRepairFormSchema>

/** Mirror `rentalCancelReasonSchema` — bắt buộc nhập lý do khi huỷ Incident. */
export const incidentCancelReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})
export type IncidentCancelReasonValues = z.infer<typeof incidentCancelReasonSchema>
