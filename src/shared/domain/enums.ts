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

/**
 * Vòng đời phân công giao/nhận — `EmployeeAssignment-BRD.md` §10 (6 giá trị
 * đủ theo tài liệu — mở rộng từ 3 giá trị scaffold ban đầu,
 * `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §11). `IN_PROGRESS`/`DONE` dự
 * kiến tự cập nhật theo Handover/Return (EA-BR-13) nhưng Round 1 KHÔNG nối
 * dây tự động (§0.3 kế hoạch — ngoại lệ kiến trúc chưa mở). `REASSIGNED` là
 * trạng thái chỉ-seed Round 1 (mirror tiền lệ `DISCARDED` của
 * `HANDOVER_RETURN_STATUSES`) — hành động "Đổi người" thật ở UI Round 1 giữ
 * nguyên bản ghi ở `ASSIGNED`, chỉ cập nhật `assigneeEmployeeId` +
 * `reassignmentHistory` (không tạo bản ghi mới như mô tả đầy đủ ở BRD §10).
 */
export const ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'DONE', 'REASSIGNED', 'CANCELLED', 'MISSED'] as const
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

/**
 * Vòng đời sự cố — `DamageIncident-BRD.md` §8/§20 (DI-BR), v1.6. Mở rộng đủ 11
 * giá trị theo BRD (trước đây chỉ scaffold 7 giá trị khi `features/incidents`
 * chưa tồn tại — sửa đúng theo tài liệu nguồn, không phải tính năng mới, xem
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §0.1).
 */
export const INCIDENT_STATUSES = [
  'OPEN',
  'ASSESSING',
  'WAITING_APPROVAL',
  'APPROVED',
  'IN_REPAIR',
  'REPAIRED',
  'CLOSED',
  'DISPUTED',
  'CANCELLED',
  'WRITTEN_OFF',
  'CLOSED_NO_ACTION',
] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

/**
 * Bên chịu trách nhiệm sự cố — `DamageIncident-BRD.md` §12. Mở rộng đủ 6 giá
 * trị (trước đây chỉ 4 — thêm `SHARED`/`UNDETERMINED`; `UNDETERMINED` là điều
 * kiện chặn `APPROVED`/`CLOSED` theo DI-BR-05, xem
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §0.1).
 */
export const LIABILITIES = ['CUSTOMER', 'COMPANY', 'THIRD_PARTY', 'INSURANCE', 'SHARED', 'UNDETERMINED'] as const
export type Liability = (typeof LIABILITIES)[number]

/** Nguồn phát sinh sự cố — `DamageIncident-BRD.md` §7. */
export const INCIDENT_SOURCES = ['RETURN', 'STANDALONE', 'INSPECTION', 'ACCIDENT'] as const
export type IncidentSource = (typeof INCIDENT_SOURCES)[number]

/**
 * Phân loại sự cố — `DamageIncident-BRD.md` §9.1 (7 nhóm: Ngoại thất/Nội
 * thất/Chức năng/Phụ kiện/Vệ sinh/Tai nạn/Khác). Tài liệu chỉ liệt kê tên
 * nhóm tiếng Việt, chưa có mã enum chính thức — BA đặt mã tiếng Anh tương ứng.
 * Khác `INCIDENT_ITEM_TYPES` (dùng cho `ReturnIncidentItem` của
 * `VehicleReturn` — giữ nguyên, KHÔNG gộp, xem
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §2.2).
 */
export const INCIDENT_TYPES = ['EXTERIOR', 'INTERIOR', 'FUNCTIONAL', 'ACCESSORY', 'HYGIENE', 'ACCIDENT', 'OTHER'] as const
export type IncidentType = (typeof INCIDENT_TYPES)[number]

/** Mức độ nghiêm trọng sự cố — `DamageIncident-BRD.md` §9.2. */
export const INCIDENT_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'] as const
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]

/** Đối chiếu baseline Handover — `DamageIncident-BRD.md` §11, chỉ áp dụng khi `Incident.source === 'RETURN'`. */
export const INCIDENT_BASELINE_REFERENCES = ['NEW', 'WORSENED', 'PRE_EXISTING'] as const
export type IncidentBaselineReference = (typeof INCIDENT_BASELINE_REFERENCES)[number]

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

// ---- Payment (PM) — `docs/PAYMENT-PLAN.md` §2.6, Round 1. ----

/** `Payment-BRD.md` §6.2 + BA đề xuất `HANDOVER` (BRD §4.1/§8/PM-BR-21 — §0.4 điểm 3 `PAYMENT-PLAN.md`). `CONSIGNMENT` thuộc Phase 5, chưa thêm. */
export const PAYMENT_REQUEST_SOURCES = ['BOOKING', 'HANDOVER', 'SETTLEMENT', 'POST_SETTLEMENT_CHARGE'] as const
export type PaymentRequestSource = (typeof PAYMENT_REQUEST_SOURCES)[number]

/** `Payment-BRD.md` §6.2 — `PAYOUT` thuộc Phase 5 (`VC`), chưa thêm. */
export const PAYMENT_REQUEST_PURPOSES = ['COLLECT', 'REFUND'] as const
export type PaymentRequestPurpose = (typeof PAYMENT_REQUEST_PURPOSES)[number]

/** `Payment-UseCase.md` §4.2. */
export const PAYMENT_REQUEST_STATUSES = ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'] as const
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number]

/** `Payment-BRD.md` §4.1, PM-BR-21 (CR-2026-004/060). */
export const PAYMENT_MILESTONES = ['BOOKING', 'HANDOVER', 'RETURN'] as const
export type PaymentMilestone = (typeof PAYMENT_MILESTONES)[number]

/** BA đề xuất — BRD §14/UC-PM-14 mô tả "nộp quỹ" + "thủ quỹ xác nhận đã nhận", chưa đặt tên trạng thái. */
export const CASH_DRAWER_SUBMISSION_STATUSES = ['SUBMITTED', 'RECEIVED'] as const
export type CashDrawerSubmissionStatus = (typeof CASH_DRAWER_SUBMISSION_STATUSES)[number]

/** Round 2 — BA đề xuất, UC-PM-09 ("chờ duyệt" / Đồng ý / Từ chối). Khai ở Round 1 vì kiểu field `Transaction.approval?` cần nó. */
export const REFUND_APPROVAL_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const
export type RefundApprovalStatus = (typeof REFUND_APPROVAL_STATUSES)[number]

/**
 * Trạng thái quyết toán (Settlement) — `RentalSettlement-UseCase.md` §4 (State
 * Model, đã verify) · `docs/RENTAL-SETTLEMENT-PLAN.md` §0.1. Sửa đúng theo tài
 * liệu (trước đây là enum scaffold sai `['DRAFT','CONFIRMED','CLOSED','REVERSED']`
 * do tài liệu gốc chưa đọc tới — KHÔNG có chỗ nào trong `src/` dùng
 * `SettlementStatus` ngoài chính định nghĩa này nên sửa an toàn). `REVERSED` là
 * tên HÀNH ĐỘNG (audit action `REVERSE_SETTLEMENT`), không phải state đích —
 * đảo quyết toán đưa `COMPLETED` quay lại `DRAFT` (UC-RS-16, Round 2).
 */
export const SETTLEMENT_STATUSES = ['DRAFT', 'PENDING_CUSTOMER', 'WAITING_APPROVAL', 'CONFIRMED', 'COMPLETED'] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — nguồn dòng khoản mục quyết toán, `RentalSettlement-BRD.md` §6. */
export const SETTLEMENT_LINE_SOURCES = ['RENTAL', 'RETURN', 'INCIDENT', 'MANUAL', 'SYSTEM'] as const
export type SettlementLineSource = (typeof SETTLEMENT_LINE_SOURCES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — trạng thái dòng khoản mục, `RentalSettlement-BRD.md` §6. */
export const SETTLEMENT_LINE_STATUSES = ['DRAFT', 'CONFIRMED', 'WAIVED', 'DISPUTED'] as const
export type SettlementLineStatus = (typeof SETTLEMENT_LINE_STATUSES)[number]

/**
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — danh mục khoản mục quyết toán.
 * `RentalSettlement-BRD.md` §8 chỉ liệt kê tên tiếng Việt, chưa có mã enum
 * chính thức — BA đề xuất mã, ánh xạ 1-1 với `ADDITIONAL_CHARGE_TYPES` của
 * `VehicleReturn` (`EXTRA_KM→EXTRA_KM`, `FUEL_DEFICIT→FUEL_DEFICIT`,
 * `OVERTIME→OVERTIME`, `DAMAGE→DAMAGE`, `VETC→VETC`, `TRAFFIC_FINE→TRAFFIC_FINE`,
 * `MISSING_ACCESSORY→MISSING_ACCESSORY`, `DELIVERY_FEE→DELIVERY_FEE`,
 * `OTHER→RETURN_OTHER`, `DISCOUNT→RETURN_DISCOUNT`).
 */
export const SETTLEMENT_LINE_CATEGORIES = [
  'BASE_RENTAL',
  'CONTRACT_DISCOUNT',
  'EXTRA_KM',
  'FUEL_DEFICIT',
  'OVERTIME',
  'DELIVERY_FEE',
  'DAMAGE',
  'MISSING_ACCESSORY',
  'VETC',
  'TRAFFIC_FINE',
  'RETURN_DISCOUNT',
  'RETURN_OTHER',
  'INCIDENT',
  'MANUAL_OTHER',
] as const
export type SettlementLineCategory = (typeof SETTLEMENT_LINE_CATEGORIES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — `RentalSettlement-BRD.md` §12. */
export const SETTLEMENT_WAIVER_TYPES = ['WAIVE_LINE', 'PARTIAL_DISCOUNT', 'GOODWILL_CREDIT'] as const
export type SettlementWaiverType = (typeof SETTLEMENT_WAIVER_TYPES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — BA đề xuất (BRD §14 chỉ mô tả hành vi, chưa đặt tên trạng thái). */
export const SETTLEMENT_WAIVER_STATUSES = ['APPROVED', 'PENDING_APPROVAL', 'REJECTED'] as const
export type SettlementWaiverStatus = (typeof SETTLEMENT_WAIVER_STATUSES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — `RentalSettlement-BRD.md` §15 (đồng bộ từ Payment, RS-BR-11; Phase 4.1 chỉ dùng `UNPAID`/`REFUND_PENDING`, §0.3). */
export const SETTLEMENT_PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUND_PENDING', 'REFUNDED'] as const
export type SettlementPaymentStatus = (typeof SETTLEMENT_PAYMENT_STATUSES)[number]

/** `docs/RENTAL-SETTLEMENT-PLAN.md` §2.2 — `RentalSettlement-BRD.md` §15 + EX-03 (BA đề xuất mã). */
export const SETTLEMENT_REQUEST_TYPES = ['COLLECT', 'DEPOSIT_REFUND', 'OVERPAYMENT_REFUND'] as const
export type SettlementRequestType = (typeof SETTLEMENT_REQUEST_TYPES)[number]

/** `RentalSettlement-BRD.md` §17 — loại Post-Settlement Charge. */
export const POST_SETTLEMENT_CHARGE_TYPES = ['RECEIVABLE', 'REFUND'] as const
export type PostSettlementChargeType = (typeof POST_SETTLEMENT_CHARGE_TYPES)[number]

/** BRD §17 (`CLOSED`); `OPEN` BA đề xuất — `docs/RENTAL-SETTLEMENT-PLAN.md` §10.3. */
export const POST_SETTLEMENT_CHARGE_STATUSES = ['OPEN', 'CLOSED'] as const
export type PostSettlementChargeStatus = (typeof POST_SETTLEMENT_CHARGE_STATUSES)[number]

/** BRD §17 dòng 1 + WebappQuanTri.md §11.2 — BA đề xuất mã (tài liệu chỉ có tên tiếng Việt). `ADJUSTMENT` = UC-RS-15. */
export const POST_SETTLEMENT_CHARGE_SOURCES = ['TRAFFIC_FINE', 'VETC', 'INCIDENT', 'ADJUSTMENT', 'OTHER'] as const
export type PostSettlementChargeSource = (typeof POST_SETTLEMENT_CHARGE_SOURCES)[number]

/**
 * Danh mục chi phí — `RevenueCost-BRD.md` §6.2/§9 (12 giá trị; `INSPECTION` — CR-2026-042;
 * `CONSIGNMENT_PAYOUT` — CR-2026-050). Sửa scaffold Phase 0 cũ cho khớp tài liệu (`DELIVERY_FEE`/`FUEL`
 * là danh mục DOANH THU, không phải chi phí) — `docs/REVENUE-COST-PLAN.md` §0.1 F1.
 * TODO(OQ: RevenueCost-BRD.md §28 Q4 — danh mục chi phí chuẩn chưa chốt; demo dùng nguyên danh mục BRD §9)
 */
export const COST_CATEGORIES = [
  'INCIDENT',
  'VETC',
  'TRAFFIC_FINE',
  'MAINTENANCE',
  'INSURANCE',
  'INSPECTION',
  'PARKING',
  'REPOSITION_FUEL',
  'CLEANING',
  'OPERATIONS',
  'OTHER',
  'CONSIGNMENT_PAYOUT',
] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]

/** Danh mục doanh thu — `RevenueCost-BRD.md` §6.1/§8. */
export const REVENUE_CATEGORIES = [
  'BASE_RENTAL',
  'EXTRA_KM',
  'FUEL',
  'OVERTIME',
  'DAMAGE_RECOVERY',
  'VETC_RECOVERY',
  'FINE_RECOVERY',
  'DELIVERY_FEE',
  'OTHER',
] as const
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number]

/** Nguồn của Cost Record — `RevenueCost-BRD.md` §6.2. */
export const COST_SOURCES = ['INCIDENT', 'MANUAL', 'SYSTEM'] as const
export type CostSource = (typeof COST_SOURCES)[number]

/** Chính sách ghi nhận doanh thu — `RevenueCost-BRD.md` §7 (CR-2026-048 chốt `ON_SETTLEMENT`). */
export const REVENUE_RECOGNITION_POLICIES = ['ON_BOOKING', 'ON_HANDOVER', 'ON_SETTLEMENT', 'ON_PAYMENT'] as const
export type RevenueRecognitionPolicy = (typeof REVENUE_RECOGNITION_POLICIES)[number]

/** Trạng thái Cost Record nhập tay — `RevenueCost-UseCase.md` §4.1 (bỏ `IN_CLOSED_PERIOD`: chưa làm Period Close). */
export const COST_RECORD_STATUSES = ['ACTIVE', 'REVERSED'] as const
export type CostRecordStatus = (typeof COST_RECORD_STATUSES)[number]

/** Bản chất dòng doanh thu — BA đề xuất (`RevenueCost-BRD.md` §6.1/§8 BR/EX-02 chỉ mô tả hành vi). */
export const REVENUE_LINE_NATURES = ['CHARGE', 'REDUCTION', 'REVERSAL'] as const
export type RevenueLineNature = (typeof REVENUE_LINE_NATURES)[number]

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

/**
 * Phạm vi áp dụng của một `MaintenanceRule` — `VehicleMaintenance-BRD.md` §6.1,
 * `MT-BR-01/02`. `SPECIFIC_VEHICLE` (một xe) ưu tiên hơn `VEHICLE_MODEL`
 * (nhiều xe cùng dòng) khi cùng `category` (`MT-BR-02`).
 */
export const MAINTENANCE_RULE_APPLIES_TO = ['SPECIFIC_VEHICLE', 'VEHICLE_MODEL'] as const
export type MaintenanceRuleAppliesTo = (typeof MAINTENANCE_RULE_APPLIES_TO)[number]

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
 * Vehicle Block — CR-2026-015, `RC-BR-15/16` (`RentalManagement-BRD.md` §57 +
 * `RentalCalendar-BRD.md` §30). `ACTIVE` = đang khoá lịch xe, `RELEASED` = đã
 * gỡ (không xoá — giữ lịch sử, đúng nguyên tắc chung `AL`).
 */
export const VEHICLE_BLOCK_STATUSES = ['ACTIVE', 'RELEASED'] as const
export type VehicleBlockStatus = (typeof VEHICLE_BLOCK_STATUSES)[number]

/**
 * Vòng đời bản ghi Giao xe/Nhận xe — `VehicleHandover-UseCase.md` §4 /
 * `VehicleReturn-UseCase.md` §4. Dùng chung 1 enum cho cả 2 entity
 * (`docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §3.1). `DISCARDED` là nhánh Phase
 * 2 (bản nháp bị bỏ trước khi hoàn tất) — Round 1 không có action nào đưa bản
 * ghi tới trạng thái này qua UI, chỉ giữ chỗ enum cho đủ theo tài liệu.
 */
export const HANDOVER_RETURN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISCARDED'] as const
export type HandoverReturnStatus = (typeof HANDOVER_RETURN_STATUSES)[number]

/** Loại hư hỏng/tình trạng có sẵn ghi nhận lúc giao xe — `VehicleHandover-BRD.md` §12. */
export const CONDITION_ITEM_TYPES = [
  'SCRATCH',
  'DENT',
  'CRACK',
  'MISSING_ACCESSORY',
  'INTERIOR_DAMAGE',
  'STAIN',
  'OTHER',
] as const
export type ConditionItemType = (typeof CONDITION_ITEM_TYPES)[number]

/** Loại sự cố phát hiện lúc nhận xe — `VehicleReturn-BRD.md` §13. */
export const INCIDENT_ITEM_TYPES = [
  'SCRATCH',
  'DENT',
  'CRACK',
  'FUNCTIONAL_DAMAGE',
  'MISSING_ACCESSORY',
  'INTERIOR_DAMAGE',
  'STAIN',
  'ACCIDENT',
  'OTHER',
] as const
export type IncidentItemType = (typeof INCIDENT_ITEM_TYPES)[number]

/** Loại khoản phát sinh ước tính lúc nhận xe — `VehicleReturn-BRD.md` §15. */
export const ADDITIONAL_CHARGE_TYPES = [
  'EXTRA_KM',
  'FUEL_DEFICIT',
  'OVERTIME',
  'DAMAGE',
  'VETC',
  'TRAFFIC_FINE',
  'MISSING_ACCESSORY',
  'DELIVERY_FEE',
  'OTHER',
  'DISCOUNT',
] as const
export type AdditionalChargeType = (typeof ADDITIONAL_CHARGE_TYPES)[number]

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
  // Vehicle Management (VM) — Round 1 (List), Vehicle + VehicleDocument CRUD (`VM-RULE-007`, BRD §16.1).
  'CREATE_VEHICLE',
  'UPDATE_VEHICLE',
  'CHANGE_VEHICLE_STATUS',
  'ADD_VEHICLE_DOCUMENT',
  'UPDATE_VEHICLE_DOCUMENT',
  // Vehicle Maintenance (MT) — Rule/Record/SparePart CRUD (`MT-BR-10`).
  'CREATE_MAINTENANCE_RULE',
  'DEACTIVATE_MAINTENANCE_RULE',
  'CREATE_MAINTENANCE_RECORD',
  'CREATE_SPARE_PART_RECORD',
  // Rental Management (RM) — Round 1 (List/Create/Confirm/Cancel), RM-BR-11.
  'CREATE_RENTAL',
  'CONFIRM_RENTAL',
  'CANCEL_RENTAL',
  // Rental Calendar (RC) — Vehicle Block CRUD, `docs/CALENDAR-MANAGEMENT-PLAN.md` §9 (CR-2026-015).
  'CREATE_VEHICLE_BLOCK',
  'RELEASE_VEHICLE_BLOCK',
  // Contract Management (CT) — Round 1 (Sinh/Ký/Huỷ), `docs/CONTRACT-MANAGEMENT-PLAN.md` §9.1/§9.3.
  'CREATE_CONTRACT',
  'SET_CONTRACT_SIGNED',
  'VOID_CONTRACT',
  'MARK_CONTRACT_CREATED',
  // Vehicle Handover/Return (VH/VR) — Sửa/Huỷ có kiểm soát, `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §9.1.
  'EDIT_HANDOVER',
  'CANCEL_HANDOVER',
  'EDIT_RETURN',
  'CANCEL_RETURN',
  // Rental (RM) — revert khi Huỷ Handover/Return, `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §9.2.
  'REVERT_HANDOVER_CANCELLED',
  'REVERT_RETURN_CANCELLED',
  // Damage Incident (DI) — vòng đời sự cố, `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §9.1.
  'CREATE_INCIDENT',
  'ASSESS_INCIDENT',
  'SET_INCIDENT_LIABILITY',
  'APPROVE_INCIDENT',
  'START_INCIDENT_REPAIR',
  'MARK_INCIDENT_REPAIRED',
  'CLOSE_INCIDENT',
  'CANCEL_INCIDENT',
  // Employee Assignment (EA) — Phân công/Đổi người/Huỷ, `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §9.1 (EA-BR-07..12/16).
  'CREATE_ASSIGNMENT',
  'REASSIGN_ASSIGNMENT',
  'CANCEL_ASSIGNMENT',
  // Rental Settlement (RS) — RENTAL-SETTLEMENT-PLAN.md §9.4 (UC-RS-21), Round 1.
  'OPEN_SETTLEMENT',
  'SYNC_SETTLEMENT_SOURCES',
  'CONFIRM_SETTLEMENT_LINE',
  'UPDATE_SETTLEMENT_LINE',
  'ADD_SETTLEMENT_MANUAL_LINE',
  'REMOVE_SETTLEMENT_MANUAL_LINE',
  'APPLY_SETTLEMENT_WAIVER',
  'DISPUTE_SETTLEMENT_LINE',
  'RESOLVE_SETTLEMENT_DISPUTE',
  'RECONCILE_SETTLEMENT_DEPOSIT',
  'SUBMIT_SETTLEMENT_FOR_CUSTOMER',
  'RECORD_SETTLEMENT_CUSTOMER_ACK',
  'APPROVE_SETTLEMENT',
  'REJECT_SETTLEMENT',
  'CREATE_SETTLEMENT_COLLECT_REQUEST',
  'CREATE_SETTLEMENT_REFUND_REQUEST',
  'COMPLETE_SETTLEMENT',
  // Rentals (RM) — đi cùng Settlement (RENTAL-SETTLEMENT-PLAN.md §3.8/§9.4).
  'MARK_RENTAL_SETTLEMENT',
  'COMPLETE_RENTAL',
  // Rental Settlement (RS) — Round 2, RENTAL-SETTLEMENT-PLAN.md §10.9 (UC-RS-21).
  'CREATE_POST_SETTLEMENT_CHARGE',
  'CLOSE_POST_SETTLEMENT_CHARGE',
  'ADJUST_SETTLEMENT',
  'REVERSE_SETTLEMENT',
  'REVERT_RENTAL_SETTLEMENT_REVERSED',
  // Payment (PM) — PAYMENT-PLAN.md §6 (UC-PM-21), Round 1.
  'CREATE_PAYMENT_SCHEDULE',
  'CREATE_TRANSACTION',
  'CONFIRM_TRANSACTION',
  'FAIL_TRANSACTION',
  'VOID_TRANSACTION',
  'REVERSE_TRANSACTION',
  'CREATE_PAYMENT_ADJUSTMENT',
  'ISSUE_RECEIPT',
  'SUBMIT_CASH_DRAWER',
  'RECEIVE_CASH_DRAWER',
  // Payment (PM) — Round 2, PAYMENT-PLAN.md §10.11.
  'CREATE_PAYMENT_REQUEST',
  'CANCEL_PAYMENT_REQUEST',
  'OFFSET_DEPOSIT',
  'APPROVE_REFUND',
  'REJECT_REFUND',
  // Revenue & Cost (RV) — REVENUE-COST-PLAN.md §7 (UseCase §20.3; `COST_MANUAL_REVERSE` BA đề xuất).
  'COST_MANUAL_CREATE',
  'COST_MANUAL_UPDATE',
  'COST_MANUAL_REVERSE',
  'REPORT_EXPORT',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
