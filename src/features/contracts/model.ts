import { z } from 'zod'
import type { ContractAddendumType, ContractStatus, SecurityDepositType } from '@/shared/domain/enums'

/**
 * Hợp đồng thuê xe — `ContractManagement-BRD.md` §6-§19 (module `CT`), sinh
 * 1-1 từ một `Rental` đã `CONFIRMED` (`docs/CONTRACT-MANAGEMENT-PLAN.md`
 * §0.2/§9.1). Toàn bộ field `snapshot*` chốt giá trị một lần lúc `GENERATED`
 * (CT-BR-07) — copy từ `Rental`/`Customer`/`Vehicle` tại thời điểm sinh, KHÔNG
 * tham chiếu sống; nguồn đổi sau (sửa hồ sơ khách, đổi đơn giá Rental...)
 * không ảnh hưởng Contract đã sinh.
 */
export interface Contract {
  id: string
  /** Tạm `HD-0001` tăng dần — TODO(OQ: ContractManagement-BRD.md §26 Q15, quy tắc đánh số chính thức chưa chốt). */
  contractCode: string
  /** Luôn `1` ở Round 1 — không có tái tạo (kế hoạch §1.2). */
  version: number
  /** CT-BR-01 — tối đa 1 Contract hiệu lực/Rental. */
  rentalId: string
  status: ContractStatus
  /** Kế hoạch §0.3 — không có "Company Info"/`SystemAdministration` entity nào build; hằng số cố định. */
  snapshotCompanyName: string
  snapshotCustomerName: string
  snapshotCustomerIdNumber: string
  snapshotCustomerPhone: string
  snapshotCustomerAddress?: string
  snapshotVehiclePlate: string
  snapshotVehicleBrand: string
  snapshotVehicleModel: string
  snapshotPickupDateTime: string
  snapshotExpectedReturnDateTime: string
  snapshotPickupLocation: string
  snapshotReturnLocation: string
  snapshotRentalRate: number
  snapshotRentalDurationDays: number
  snapshotBaseAmount: number
  snapshotDiscountAmount: number
  snapshotEstimatedTotal: number
  snapshotPrepaymentAmount: number
  snapshotAllowedKm: number
  snapshotPricePerKm: number
  snapshotSecurityDepositType: SecurityDepositType
  snapshotSecurityDepositAmount?: number
  /** Giả lập upload — kế hoạch §1.1 mục 4 (không có file thật). */
  signedCopyFileName?: string
  signedDate?: string
  signedByCompany?: string
  signedByCustomer?: string
  voidReason?: string
  voidedAt?: string
  voidedByUserId?: string
  voidedByName?: string
  voidedByRole?: string
  createdAt: string
  updatedAt: string
}

/**
 * Phụ lục hợp đồng — CT §13.1, CR-2026-012/013. Round 1 chỉ seed + đọc, không
 * có form tạo (kế hoạch §1.2 — cần Rental có UI tới `IN_RENTAL`/đổi xe giữa kỳ
 * để có kịch bản thật, Handover/Return chưa build).
 */
export interface ContractAddendum {
  id: string
  contractId: string
  type: ContractAddendumType
  effectiveDate: string
  /** Nội dung thay đổi (tự do) — TODO(OQ: ContractManagement-BRD.md §26 Q17, mẫu phụ lục chuẩn chưa chốt). */
  description: string
  createdAt: string
}

/** Kế hoạch §0.3 — dữ kiện thực tế (không phải quyết định nghiệp vụ cần BA chốt), không có entity cấu hình công ty nào build. */
export const COMPANY_NAME = 'Công ty TNHH Thiên Bảo Car'

/**
 * Tạo mã hợp đồng tạm, tăng dần theo số Contract đã tồn tại —
 * TODO(OQ: ContractManagement-BRD.md §26 Q15, quy tắc đánh số chính thức chưa chốt).
 */
export function generateContractCode(existingCount: number): string {
  return `HD-${String(existingCount + 1).padStart(4, '0')}`
}

/** CT-BR-05/UC-CT-13 — Huỷ áp dụng cho `GENERATED`/`SIGNED`. */
export function canVoid(contract: Contract): boolean {
  return contract.status === 'GENERATED' || contract.status === 'SIGNED'
}

/** `GENERATED -> SIGNED`. */
export function canMarkSigned(contract: Contract): boolean {
  return contract.status === 'GENERATED'
}

// ---- Form schema ----

/** Kế hoạch §1.1 mục 4/§5.4 — form "Tải lên bản ký" giả lập, không upload file thật. */
export const contractSignFormSchema = z.object({
  signedCopyFileName: z.string().trim().min(1, 'Tên file bản ký là bắt buộc'),
  signedDate: z.string().trim().min(1, 'Ngày ký là bắt buộc'),
  signedByCompany: z.string().trim().min(1, 'Người ký đại diện công ty là bắt buộc'),
  signedByCustomer: z.string().trim().min(1, 'Người ký đại diện khách hàng là bắt buộc'),
})

export type ContractSignFormValues = z.infer<typeof contractSignFormSchema>

/** Mirror `rentalCancelReasonSchema` — bắt buộc nhập lý do khi huỷ hợp đồng. */
export const contractVoidReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})

export type ContractVoidReasonValues = z.infer<typeof contractVoidReasonSchema>
