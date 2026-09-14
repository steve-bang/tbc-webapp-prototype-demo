import { differenceInCalendarDays, parseISO } from 'date-fns'
import { z } from 'zod'
import { CUSTOMER_DOCUMENT_TYPES, type CustomerDocumentType, type CustomerStatus, type DocumentStatus } from '@/shared/domain/enums'

/**
 * Giấy tờ khách hàng — `CustomerManagement-BRD.md` §22 / `UC-CM-07`. Round 2
 * hoàn thiện `documentType` bằng enum thật `CustomerDocumentType` (Round 1
 * chỉ khai `string` tạm để giữ shape ổn định cho `Customer.documents`).
 */
export interface CustomerDocument {
  id: string
  documentType: CustomerDocumentType
  documentNumber: string
  issueDate?: string
  expiryDate?: string
  note?: string
  fileMeta?: { fileName: string; uploadedAt: string; uploadedBy: string }
  createdAt: string
  updatedAt: string
}

/**
 * `CustomerManagement-BRD.md` §7.1 không liệt kê giá trị cụ thể cho giới
 * tính — khai literal union riêng của feature này (`CONVENTIONS.md` §2),
 * không đẩy lên `shared/domain/enums.ts` dùng chung.
 */
export type CustomerGender = 'MALE' | 'FEMALE' | 'OTHER'

/** BRD §7.2 — loại giấy tờ định danh chính (khác `CustomerDocument`, đây là field trực tiếp trên hồ sơ). */
export type CustomerIdType = 'ID_CARD' | 'PASSPORT'

/** Hồ sơ khách hàng — `CustomerManagement-BRD.md` §7 (module `CM`). */
export interface Customer {
  id: string
  fullName: string
  dob?: string
  gender?: CustomerGender
  phone: string
  email?: string
  address?: string
  note?: string
  idType?: CustomerIdType
  idNumber: string
  idIssueDate?: string
  idIssuePlace?: string
  idExpiryDate?: string
  licenseNumber?: string
  licenseClass?: string
  licenseIssueDate?: string
  licenseExpiryDate?: string
  status: CustomerStatus
  /** Lý do khoá gần nhất — hiển thị nhanh ở badge/tooltip, không thay thế audit log. `CM-R03`/`AC-CM-006`. */
  blockReason?: string
  documents: CustomerDocument[]
  createdAt: string
  updatedAt: string
}

/**
 * `CM §8` — định danh duy nhất, đề xuất Phone + ID Number ("chưa chốt chính
 * thức", BRD §31 Q1). Diễn giải Phase 1: trùng khi khớp SĐT HOẶC khớp số
 * CCCD/Passport với khách khác (OR trên từng field — khớp đúng ví dụ BRD §8
 * "chỉ CCCD trùng đã đủ coi là duplicate"). Hard-block (throw), không làm
 * luồng "cảnh báo rồi cho xác nhận vượt qua" đầy đủ của `UC-CM-03` A2 — rút
 * gọn có chủ đích cho demo, giống `isPhoneTaken` của Employee.
 * TODO(OQ: CM-BRD §31 Q1 — AND/OR hay ưu tiên field nào chưa chốt chính thức).
 */
export function findDuplicateCustomer(
  list: Customer[],
  input: { phone: string; idNumber?: string },
  exceptId?: string,
): { customer: Customer; matchedField: 'phone' | 'idNumber' } | undefined {
  const phone = input.phone.trim()
  const idNumber = input.idNumber?.trim()
  for (const customer of list) {
    if (customer.id === exceptId) continue
    if (customer.phone === phone) return { customer, matchedField: 'phone' }
    if (idNumber && customer.idNumber === idNumber) return { customer, matchedField: 'idNumber' }
  }
  return undefined
}

/**
 * `CM-R03`/`AC-CM-007`/`RM §41 Case 2` — `BLOCKED` không được tạo lượt thuê
 * mới. Ở đây chỉ ghi nhận trạng thái; việc chặn tạo rental **chưa enforce
 * được** vì `Rental` (module `RM`) chưa tồn tại trong prototype Phase 1.
 */
export function canBlock(status: CustomerStatus): boolean {
  return status === 'ACTIVE'
}

export function canUnblock(status: CustomerStatus): boolean {
  return status === 'BLOCKED'
}

/**
 * CM §23/CM-R09 — hiệu lực giấy tờ. `warningDays` chưa có ngưỡng chính thức
 * (BRD §23 "cần Business xác nhận") — BA đề xuất tạm 30 ngày cho demo, KHÁC
 * ngưỡng CR-2026-046 của VehicleManagement (module khác, không dùng chung
 * số). TODO(OQ: CM-BRD §23). Viết trong `customers/model.ts` — nếu
 * `features/vehicles` sau này cần logic tương tự, cân nhắc rút thành
 * `shared/lib/documentStatus.ts` dùng chung lúc đó.
 */
export function documentExpiryStatus(
  expiryDate: string | undefined,
  today: Date = new Date(),
  warningDays = 30,
): DocumentStatus {
  if (!expiryDate) return 'VALID'
  const diffDays = differenceInCalendarDays(parseISO(expiryDate), today)
  if (diffDays < 0) return 'EXPIRED'
  if (diffDays <= warningDays) return 'EXPIRING_SOON'
  return 'VALID'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** `UC-CM-03` — tạo/sửa hồ sơ khách. `idNumber` bắt buộc ở form Phase 1 (§4 kế hoạch — `AC-CM-001`). */
export const customerFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Họ tên phải có ít nhất 2 ký tự'),
  dob: z.string().trim().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{9,11}$/, 'Số điện thoại phải gồm 9–11 chữ số'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || EMAIL_RE.test(v), { message: 'Email không hợp lệ' }),
  address: z.string().trim().optional(),
  note: z.string().trim().optional(),
  idType: z.enum(['ID_CARD', 'PASSPORT']).optional(),
  // TODO(OQ: CM-BRD §31 Q1/Q2 — có cho phép khách không CCCD? Phase 1 bắt buộc để giữ đơn giản.)
  idNumber: z.string().trim().min(1, 'Số CCCD/Hộ chiếu là bắt buộc'),
  idIssueDate: z.string().trim().optional(),
  idIssuePlace: z.string().trim().optional(),
  idExpiryDate: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  licenseClass: z.string().trim().optional(),
  licenseIssueDate: z.string().trim().optional(),
  licenseExpiryDate: z.string().trim().optional(),
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>

/** `UC-CM-07`/`CM §22` — thêm/sửa giấy tờ khách hàng; `documentType`/`documentNumber` bắt buộc. */
export const customerDocumentFormSchema = z.object({
  documentType: z.enum(CUSTOMER_DOCUMENT_TYPES),
  documentNumber: z.string().trim().min(1, 'Số giấy tờ là bắt buộc'),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

export type CustomerDocumentFormValues = z.infer<typeof customerDocumentFormSchema>

/**
 * `UC-CM-06`/`AC-CM-006` — bắt buộc lý do cho cả khoá lẫn mở khoá (áp dụng
 * nhất quán 2 chiều dù BRD chỉ nói rõ chiều khoá — an toàn hơn, giống tinh
 * thần `EA-BR` khi Employee có action nhạy cảm tương tự). Dùng để validate
 * trong `CustomerReasonDialog` (thay vì kiểm tra tay `trimmed.length < 3`).
 */
export const blockReasonSchema = z.object({
  reason: z.string().trim().min(3, 'Lý do là bắt buộc (tối thiểu 3 ký tự)'),
})

export type BlockReasonValues = z.infer<typeof blockReasonSchema>
