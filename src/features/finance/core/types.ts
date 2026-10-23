// Kiểu entity được lưu của RS + PM dùng chung (tầng `core`) — docs/FINANCE-REFACTOR-PLAN.md §3.1.
import type {
  CashDrawerSubmissionStatus,
  PaymentMethod,
  PaymentRequestPurpose,
  PaymentRequestSource,
  PaymentRequestStatus,
  PostSettlementChargeSource,
  PostSettlementChargeStatus,
  PostSettlementChargeType,
  RefundApprovalStatus,
  Role,
  SecurityDepositType,
  SettlementLineCategory,
  SettlementLineSource,
  SettlementLineStatus,
  SettlementPaymentStatus,
  SettlementRequestType,
  SettlementStatus,
  SettlementWaiverStatus,
  SettlementWaiverType,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/shared/domain/enums'
import type { vi } from '@/shared/i18n/vi'

/**
 * Khoá chuỗi phẳng (giá trị là `string`) của `vi.finance` — dùng cho bảng ánh xạ mã chặn → nhãn ở các dialog.
 * Bỏ các object lồng (`payment`/`receivables`/`revenueCost`/`reports`…) — thêm namespace mới không phải sửa lại.
 */
export type FinanceStringKey = { [K in keyof typeof vi.finance]: (typeof vi.finance)[K] extends string ? K : never }[keyof typeof vi.finance]

/**
 * Dòng khoản mục quyết toán — `RentalSettlement-BRD.md` §6/§8-§9 (module `RS`),
 * `docs/RENTAL-SETTLEMENT-PLAN.md` §2.1. Số tiền luôn là số nguyên dương;
 * chiều cộng/trừ do `direction`.
 */
export interface SettlementLine {
  id: string
  category: SettlementLineCategory
  source: SettlementLineSource
  direction: 'CHARGE' | 'DISCOUNT'
  /** Chỉ dòng `RETURN`/`INCIDENT` (RS-BR-05). */
  estimatedAmount?: number
  /** Bắt buộc khi `CONFIRMED`/`WAIVED`. */
  actualAmount?: number
  status: SettlementLineStatus
  /** RS-BR-19 — bằng chứng nguồn. */
  sourceRef?: { returnRecordId?: string; additionalChargeItemId?: string; incidentId?: string }
  /** EX-01 — `false` khi Incident chưa đủ điều kiện duyệt → không cho chốt. */
  sourceReady: boolean
  /** EX-05 — nguồn đổi sau khi đã chốt. */
  sourceChanged?: boolean
  /** §0.4 điểm 4 kế hoạch — `DAMAGE` ở Return có thể trùng với Incident. */
  sourceWarning?: 'POSSIBLE_DUPLICATE_DAMAGE'
  /** Ghi chú nguồn (copy từ `AdditionalChargeItem.note`) hoặc ghi chú chốt. */
  note?: string
  /** Bắt buộc với `MANUAL` (RS-BR-19). */
  reason?: string
  disputeNote?: string
  confirmedByName?: string
  confirmedAt?: string
}

/** Miễn giảm/thiện chí — `RentalSettlement-BRD.md` §12, hiển thị riêng, không ẩn vào giá. */
export interface SettlementWaiver {
  id: string
  type: SettlementWaiverType
  /** Bắt buộc với `WAIVE_LINE`/`PARTIAL_DISCOUNT`. */
  lineId?: string
  /** `WAIVE_LINE` = `actualAmount` của dòng. */
  amount: number
  reason: string
  status: SettlementWaiverStatus
  requestedByName: string
  requestedByRole: Role
  requestedAt: string
  decidedByName?: string
  decidedAt?: string
  decisionNote?: string
}

/** `RentalSettlement-BRD.md` §10 — chốt bởi "Xác định đối trừ cọc"; bị xoá (phải chốt lại) khi số liệu dòng/miễn giảm đổi. */
export interface DepositReconciliation {
  finalAmount: number
  paidToDate: number
  depositHeld: number
  depositApplied: number
  depositRefundable: number
  balanceDue: number
  reconciledByName: string
  reconciledAt: string
}

/** `RentalSettlement-BRD.md` §15 — chỉ ghi yêu cầu, Payment (Phase 4.2) mới thực thi (§0.3 kế hoạch). */
export interface SettlementPaymentRequest {
  id: string
  type: SettlementRequestType
  amount: number
  /** `CANCELLED` dùng ở Round 2 (đảo quyết toán) — Round 1 chỉ sinh `REQUESTED`. */
  status: 'REQUESTED' | 'CANCELLED'
  createdByName: string
  createdAt: string
  /** Round 2 (UC-RS-16) — chỉ có khi `status = CANCELLED` do đảo quyết toán. */
  cancelledByName?: string
  cancelledAt?: string
  cancelReason?: string
}

export interface SettlementTotals {
  gross: number
  totalDiscount: number
  subtotal: number
  tax: number
  rounding: number
  finalAmount: number
}

/** Quyết toán lượt thuê — `RentalSettlement-BRD.md` §6 (module `RS`), storage key `settlements`. */
export interface Settlement {
  id: string
  /** RS-BR-01 — duy nhất theo `rentalId`. */
  rentalId: string
  /** Copy từ Rental lúc mở để màn danh sách lọc nhanh. */
  customerId: string
  vehicleId: string
  status: SettlementStatus
  lines: SettlementLine[]
  waivers: SettlementWaiver[]
  /** Snapshot từ `Rental` lúc mở. */
  securityDepositType: SecurityDepositType
  /** RS-BR-21 — từ sổ giao dịch Payment (`calcPaidToDate`), làm mới khi Settlement `DRAFT` (PAYMENT-PLAN.md §10.4). */
  paidToDate: { prepayment: number; handoverPayment: number }
  /** RS-BR-22 — từ sổ giao dịch Payment (`calcDepositHeld`/`calcLedgerDepositHeld`). */
  depositHeld: number
  depositReconciliation?: DepositReconciliation
  /** TODO(OQ: RentalSettlement-BRD.md §28 Q17 — mức xác nhận khách M0-M4 chưa chốt). */
  customerAck?: { recordedByName: string; recordedAt: string; note?: string }
  approval?: { decision: 'APPROVED' | 'RETURNED'; decidedByName: string; decidedAt: string; note?: string }
  paymentRequests: SettlementPaymentRequest[]
  /** Phase 4.1 chỉ `UNPAID`/`REFUND_PENDING` (§0.3 kế hoạch). */
  paymentStatus?: SettlementPaymentStatus
  /** Đóng lượt khi `Balance Due > 0` — TODO(OQ: RentalSettlement-BRD.md §28 Q11). */
  completedWithDebt?: boolean
  /** RS-BR-12 — đóng băng số liệu kỳ gốc. */
  completedTotals?: SettlementTotals & DepositReconciliation
  completedByName?: string
  completedAt?: string
  openedByName: string
  openedAt: string
  createdAt: string
  updatedAt: string
  /** UC-RS-16 — "giữ toàn bộ lịch sử phiên bản trước" (RS-BR-14). */
  reversals?: SettlementReversal[]
}

/** UC-RS-16 — bản Settlement `COMPLETED` ngay trước khi đảo (RS-BR-14), `docs/RENTAL-SETTLEMENT-PLAN.md` §10.3. */
export interface SettlementReversal {
  id: string
  reason: string
  reversedByName: string
  reversedByRole: Role
  reversedAt: string
  snapshot: Omit<Settlement, 'reversals'>
  cancelledPaymentRequestIds: string[]
}

/**
 * Post-Settlement Charge — `RentalSettlement-BRD.md` §17, UC-RS-14/15. Entity
 * riêng, KHÔNG nhúng vào `Settlement` (RS-BR-13, BRD §25.4), storage key
 * `postSettlementCharges` (hằng số `POST_SETTLEMENT_CHARGES_STORAGE_KEY` ở
 * `finance/api.ts`).
 */
export interface PostSettlementCharge {
  id: string
  /** Settlement kỳ gốc (tham chiếu — BRD §6). */
  settlementId: string
  /** Copy từ Settlement — List/4.2/4.3 lọc nhanh. */
  rentalId: string
  customerId: string
  vehicleId: string
  source: PostSettlementChargeSource
  type: PostSettlementChargeType
  /** Số nguyên dương (đồng), chiều do `type`. */
  amount: number
  /** Bắt buộc khi `source = INCIDENT`. */
  incidentId?: string
  /** Bắt buộc (UC-RS-21 §25.3). */
  reason: string
  /** "chứng từ" UC-RS-14 bước 2 — demo chỉ ghi chú text (số biên bản phạt, mã GD VETC…). */
  evidenceNote?: string
  status: PostSettlementChargeStatus
  createdByName: string
  createdByRole: Role
  createdAt: string
  closedByName?: string
  closedAt?: string
  closeNote?: string
}

// ==== Payment (PM) — PAYMENT-PLAN.md §2-§3 ====

/** Payment Request — `Payment-BRD.md` §6.2, UseCase §4.2. Module khác "tạo", Payment thực thi. */
export interface PaymentRequest {
  id: string
  source: PaymentRequestSource
  purpose: PaymentRequestPurpose
  /** Loại giao dịch sinh ra khi thực thi — quyết định Type của Transaction (BRD §8). */
  transactionType: TransactionType
  /** số nguyên đồng > 0 (PM-BR-20). */
  expectedAmount: number
  /** `HỆ THỐNG tính (deriveRequestStatus), không sửa tay. */
  status: PaymentRequestStatus
  /**
   * `PM-BR-16`/`PM-BR-24`: yêu cầu của khách (`source ≠ CONSIGNMENT`) luôn có `rentalId` + `customerId`; lệnh chi trả chủ xe
   * (`source = CONSIGNMENT`) thì KHÔNG — gắn `vehicleOwnerId` + `ownerPayoutRecordId` thay thế.
   */
  rentalId?: string
  /** Copy từ Rental lúc tạo — lọc nhanh/công nợ. */
  customerId?: string
  /** Chỉ `source = CONSIGNMENT` — chủ xe nhận tiền / khoản chi trả (Owner Payout Record) / xe / hợp đồng ký gửi. */
  vehicleOwnerId?: string
  ownerPayoutRecordId?: string
  vehicleId?: string
  consignmentContractId?: string
  // Round 2:
  settlementId?: string
  settlementRequestId?: string
  postSettlementChargeId?: string
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
  cancelledByName?: string
  cancelledAt?: string
  cancelReason?: string
}

/** `Payment-BRD.md` §18 — nhúng trong `Transaction`, một giao dịch một biên lai. */
export interface Receipt {
  /** `GD-…`/`BL-…` tuần tự — TODO(OQ: Payment-BRD.md §27 Q16 — mẫu/đánh số biên lai). */
  receiptNo: string
  issuedByName: string
  issuedAt: string
  /** PM-BR-19 — bị vô hiệu khi giao dịch gốc REVERSED. */
  voided: boolean
}

/** Giao dịch tiền — `Payment-BRD.md` §6.1. Không bao giờ xoá vật lý (PM-BR-05). */
export interface Transaction {
  id: string
  /** "Transaction Code" BRD §6.1 — `GD-000001` tuần tự, sinh trong callback `fakeRequest`. */
  code: string
  type: TransactionType
  /** Suy từ `type` qua `directionOf` — riêng `ADJUSTMENT` do người dùng chọn. */
  direction: TransactionDirection
  amount: number
  method: PaymentMethod
  status: TransactionStatus
  /**
   * PM-BR-16 — bắt buộc với giao dịch thu / hoàn của khách. `type = OWNER_PAYOUT` (PM-BR-24) thì KHÔNG có `customerId`/`rentalId`:
   * gắn `vehicleOwnerId` + `ownerPayoutRecordId` thay thế.
   */
  customerId?: string
  rentalId?: string
  /** Chỉ `OWNER_PAYOUT` — chủ xe nhận tiền, khoản chi trả, xe. */
  vehicleOwnerId?: string
  ownerPayoutRecordId?: string
  vehicleId?: string
  /** Chỉ `OWNER_PAYOUT` — người nhận ĐÃ CHE số tài khoản ("••••6789 — Ngân hàng — Chủ TK"). */
  payoutRecipient?: string
  /** Trống với `ADJUSTMENT`/`OFFSET`. */
  paymentRequestId?: string
  /** Round 2 — `OFFSET`. */
  settlementId?: string
  /** Mã CK / mã ví / mã SePay. */
  reference?: string
  /** Demo: ghi chú chứng từ thay ảnh. */
  evidenceNote?: string
  /** Bắt buộc với `ADJUSTMENT`. */
  reason?: string
  /** PM-BR-10 — `drawer:<userId>` của người thu khi `method = CASH`. */
  cashDrawerId?: string
  cashDrawerOwnerName?: string
  performedByUserId: string
  performedByName: string
  performedAt: string
  confirmedByName?: string
  confirmedAt?: string
  /** UC-PM-06 A1 — số tiền gốc trước khi Accountant sửa lúc xác nhận. */
  originalAmount?: number
  failReason?: string
  voidReason?: string
  voidedByName?: string
  voidedAt?: string
  /** UC-PM-12 — bản đối ứng trỏ bản gốc; bản gốc trỏ bản đối ứng. */
  reversalOfId?: string
  reversedById?: string
  reverseReason?: string
  /** Round 2 — PM-BR-12, chỉ giao dịch hoàn tiền vượt ngưỡng. */
  approval?: { status: RefundApprovalStatus; decidedByName?: string; decidedAt?: string; note?: string }
  /** Round 2 — PM-BR-13, bắt buộc với giao dịch OUT hoàn tiền. */
  refundRecipient?: string
  /** BRD §18. */
  receipt?: Receipt
  createdAt: string
  updatedAt: string
}

/** Phiếu nộp quỹ — `Payment-BRD.md` §14, §15.1, UC-PM-14. Quỹ = theo người thu (BRD §14). */
export interface CashDrawerSubmission {
  id: string
  /** `drawer:<userId>`. */
  cashDrawerId: string
  ownerName: string
  /** Giao dịch CASH được "chốt" vào phiếu này — mỗi giao dịch chỉ thuộc tối đa 1 phiếu. */
  transactionIds: string[]
  /** Σ CASH IN − Σ CASH OUT (hiệu lực) của `transactionIds`. */
  systemAmount: number
  countedAmount: number
  variance: number
  /** Bắt buộc khi `variance ≠ 0` (EX-06, AC-PM-009). */
  varianceReason?: string
  status: CashDrawerSubmissionStatus
  submittedAt: string
  /** "thủ quỹ" — TODO(OQ: Payment-BRD.md §27 Q11). */
  receivedByName?: string
  receivedAt?: string
}

/** Người thực hiện thao tác — dùng để ghi audit (RS-BR-07/14, UC-RS-21). */
export interface ActorInfo {
  userId: string
  fullName: string
  role: Role
}
