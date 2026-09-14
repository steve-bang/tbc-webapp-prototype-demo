/**
 * Toàn bộ enum nghiệp vụ của hệ thống, định nghĩa theo mẫu `as const` +
 * union type (không dùng TypeScript `enum`) — đúng convention của App nhân
 * viên (`CONVENTIONS.md`). Mỗi khối trỏ về mã module/nguồn trong
 * `thien-bao-car-docs` để BA/DEV đối chiếu khi cần.
 */

/** Vai trò người dùng nội bộ — nguồn: `SystemAdministration-BRD.md` §9. */
export const ROLES = [
  'SYSTEM_ADMIN',
  'MANAGER',
  'DISPATCHER',
  'SALES',
  'OPERATION_STAFF',
  'ACCOUNTANT',
] as const
export type Role = (typeof ROLES)[number]

/** Trạng thái tài khoản — `SA-BR-06`. */
export const ACCOUNT_STATUSES = ['ACTIVE', 'LOCKED', 'DISABLED'] as const
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

/** Trạng thái xe — `VehicleManagement-BRD.md`. */
export const VEHICLE_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'INACTIVE'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

/** Hạng xe — quyết định Price Per KM & Allowed KM (CR-2026-008, `BR-016`). */
export const VEHICLE_CLASSES = ['VIP_LUXURY', 'STANDARD', 'TWO_SEATER'] as const
export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

/** Hình thức sở hữu xe — điểm nối sang Nhóm 7 (Xe ký gửi). */
export const OWNERSHIP_TYPES = ['OWNED', 'CONSIGNED'] as const
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number]

/** Loại giấy tờ xe — tách theo CR-2026-042. */
export const VEHICLE_DOCUMENT_TYPES = [
  'VEHICLE_REGISTRATION',
  'INSPECTION',
  'INSURANCE',
  'MORTGAGE_RECEIPT',
  'OTHER',
] as const
export type VehicleDocumentType = (typeof VEHICLE_DOCUMENT_TYPES)[number]

/** Trạng thái hiệu lực giấy tờ — dựa trên Expiry Date − Warning Lead Days (CR-2026-046). */
export const DOCUMENT_STATUSES = ['VALID', 'EXPIRING_SOON', 'EXPIRED'] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

/** Mốc trên Vehicle Condition Timeline — CR-2026-045, `VM-RULE-019`. */
export const CONDITION_EVENT_TYPES = [
  'HANDOVER_BASELINE',
  'RETURN',
  'INCIDENT',
  'CONSIGNMENT_INTAKE',
  'CONSIGNMENT_RETURN',
  'MAINTENANCE',
] as const
export type ConditionEventType = (typeof CONDITION_EVENT_TYPES)[number]

/**
 * Khách hàng — `CustomerManagement-BRD.md` §9/§10 (2 giá trị đang dùng).
 * TODO(OQ: CM-BRD §9 đề xuất thêm `INACTIVE` — "ngừng sử dụng dịch vụ";
 * UC-CM-13 (Deactivate) yêu cầu kiểm tra active rental trước khi chuyển,
 * phụ thuộc `Rental` (Phase 2, chưa tồn tại). Không tự thêm `INACTIVE` bây
 * giờ — sửa cùng lúc với luồng kiểm tra active rental khi Rental build.)
 */
export const CUSTOMER_STATUSES = ['ACTIVE', 'BLOCKED'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

/** Loại giấy tờ khách hàng — `CustomerManagement-BRD.md` §22, `UC-CM-07`. */
export const CUSTOMER_DOCUMENT_TYPES = ['ID_CARD', 'PASSPORT', 'DRIVER_LICENSE', 'OTHER'] as const
export type CustomerDocumentType = (typeof CUSTOMER_DOCUMENT_TYPES)[number]

/** Nhân viên — `EmployeeAssignment-BRD.md`. */
export const EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]

/** Vòng đời phân công giao/nhận — tự cập nhật từ Handover/Return. */
export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'DONE'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export const ASSIGNMENT_ROLES = ['DELIVERY', 'RECEIVING'] as const
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number]

/**
 * Vòng đời lượt thuê chuẩn — CR-2026-043, đồng bộ master BRD §38 / `RM` §8–§9.
 * Ngoại lệ ngoài luồng chính: CANCELLED · NO_SHOW · DISPUTED.
 */
export const RENTAL_STATUSES = [
  'DRAFT',
  'CONFIRMED',
  'CONTRACT_CREATED',
  'READY_FOR_HANDOVER',
  'HANDED_OVER',
  'IN_RENTAL',
  'RETURNED',
  'SETTLEMENT',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'DISPUTED',
] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

/** Cọc 2 phần — CR-2026-003. */
export const SECURITY_DEPOSIT_TYPES = ['CASH_20M', 'MOTORBIKE'] as const
export type SecurityDepositType = (typeof SECURITY_DEPOSIT_TYPES)[number]

/** Vòng đời hợp đồng thuê xe — `ContractManagement-BRD.md`. */
export const CONTRACT_STATUSES = ['GENERATED', 'SIGNED', 'ACTIVE', 'CLOSED', 'VOID', 'SUPERSEDED'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

/** Loại phụ lục hợp đồng — CR-2026-012/013. */
export const CONTRACT_ADDENDUM_TYPES = ['ADDENDUM_VEHICLE_SWAP', 'TERMINATION_AGREEMENT'] as const
export type ContractAddendumType = (typeof CONTRACT_ADDENDUM_TYPES)[number]

/** Vòng đời sự cố — `DamageIncident-BRD.md`. */
export const INCIDENT_STATUSES = [
  'OPEN',
  'ASSESSING',
  'APPROVED',
  'IN_REPAIR',
  'REPAIRED',
  'CLOSED',
  'CANCELLED',
] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

/** Bên chịu trách nhiệm sự cố. */
export const LIABILITIES = ['CUSTOMER', 'COMPANY', 'THIRD_PARTY', 'INSURANCE'] as const
export type Liability = (typeof LIABILITIES)[number]

/** Loại giao dịch tiền — `Payment-BRD.md`. */
export const TRANSACTION_TYPES = [
  'DEPOSIT',
  'RENTAL_PAYMENT',
  'ADDITIONAL_CHARGE',
  'POST_SETTLEMENT_COLLECT',
  'DEPOSIT_REFUND',
  'OVERPAYMENT_REFUND',
  'GOODWILL_REFUND',
  'ADJUSTMENT',
  'OWNER_PAYOUT',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const TRANSACTION_DIRECTIONS = ['IN', 'OUT'] as const
export type TransactionDirection = (typeof TRANSACTION_DIRECTIONS)[number]

export const TRANSACTION_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'VOIDED', 'REVERSED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'E_WALLET', 'OFFSET', 'ONLINE_GATEWAY'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Trạng thái quyết toán (Settlement) — BA đề xuất cho bản demo, tài liệu gốc
 * chỉ mô tả bằng hành vi ("chốt từng dòng" → "đóng lượt"), chưa đặt tên state
 * machine riêng. Dùng tạm để dựng UI; xác nhận lại với BA khi làm SRS thật.
 */
export const SETTLEMENT_STATUSES = ['DRAFT', 'CONFIRMED', 'CLOSED', 'REVERSED'] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

/** Danh mục chi phí — `RevenueCost-BRD.md`. */
export const COST_CATEGORIES = [
  'MAINTENANCE',
  'INCIDENT',
  'CONSIGNMENT_PAYOUT',
  'DELIVERY_FEE',
  'FUEL',
  'OTHER',
] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

export const ALLOCATION_TYPES = ['DIRECT', 'INDIRECT'] as const
export type AllocationType = (typeof ALLOCATION_TYPES)[number]

/** Hồ sơ chủ xe ký gửi — `VehicleConsignment-BRD.md`. */
export const OWNER_TYPES = ['INDIVIDUAL', 'ORGANIZATION'] as const
export type OwnerType = (typeof OWNER_TYPES)[number]

export const CONSIGNMENT_CONTRACT_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SIGNED',
  'ACTIVE',
  'CLOSED',
  'SUSPENDED',
  'TERMINATED',
  'SUPERSEDED',
] as const
export type ConsignmentContractStatus = (typeof CONSIGNMENT_CONTRACT_STATUSES)[number]

/** Lịch chi trả chủ xe — mô hình FIXED_MONTHLY, CR-2026-050. */
export const PAYOUT_STATUSES = ['SCHEDULED', 'PAID', 'ON_HOLD'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

/** Danh mục sự kiện thông báo — `Notification-BRD.md` §7 + mở rộng. */
export const NOTIFICATION_EVENT_TYPES = [
  'VEHICLE_DOCUMENT_EXPIRING',
  'VEHICLE_INSPECTION_EXPIRING',
  'MAINTENANCE_DUE',
  'VEHICLE_OVERUSE',
  'CONTRACT_EXPIRY',
  'CONSIGNMENT_CONTRACT_EXPIRING',
  'CONSIGNMENT_PAYMENT_DUE',
  'PARTNER_PAYMENT_DUE',
  'TASK_ASSIGNMENT',
  'RENTAL_PICKUP_SOON',
  'RENTAL_RETURN_SOON',
  'RENTAL_RETURN_OVERDUE',
  'PAYMENT_OVERDUE',
] as const
export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number]

export const NOTIFICATION_DELIVERY_STATUSES = ['PENDING', 'SENT', 'FAILED', 'RETRY', 'CANCELLED'] as const
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number]

/**
 * Hành động audit — dùng chung cho mọi feature (xem `shared/lib/audit.ts`).
 * 8 giá trị đầu là từ vựng chung (CRUD + xác nhận). Các giá trị nối thêm bên
 * dưới là hành động riêng của `EmployeeAssignment` — danh mục action bắt
 * buộc theo `UC-EA-20` §24.3 (không dùng CREATE/UPDATE chung chung vì tài
 * liệu yêu cầu phân biệt rõ CHANGE_ROLE/CHANGE_WORK_STATUS/GRANT_ACCOUNT/
 * LOCK_ACCOUNT cho màn "Nhật ký thao tác").
 */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'CONFIRM',
  'APPROVE',
  'CANCEL',
  'LOGIN',
  'EXPORT',
  'CREATE_EMPLOYEE',
  'UPDATE_EMPLOYEE',
  'CHANGE_ROLE',
  'CHANGE_WORK_STATUS',
  'GRANT_ACCOUNT',
  'LOCK_ACCOUNT',
  'UNLOCK_ACCOUNT', // BA đề xuất — bổ sung ngoài UC-EA-20 §24.3 (chỉ liệt kê LOCK_ACCOUNT)
  // Customer Management (CM) — CM-R06/UC-CM-14/AC-CM-009, Round 1 (List).
  'CREATE_CUSTOMER',
  'UPDATE_CUSTOMER',
  'BLOCK_CUSTOMER',
  'UNBLOCK_CUSTOMER',
  // Customer Management (CM) — Round 2 (Detail), CustomerDocument CRUD (`UC-CM-07`/`UC-CM-14`).
  'ADD_CUSTOMER_DOCUMENT',
  'UPDATE_CUSTOMER_DOCUMENT',
  'DELETE_CUSTOMER_DOCUMENT',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
