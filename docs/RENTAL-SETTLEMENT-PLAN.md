# Kế hoạch triển khai — Quyết toán lượt thuê (Rental Settlement)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (21/10/2026 — người dùng duyệt) · **Round 1
`DONE`** (21/10/2026 — đạt sau 2 vòng review `tech-lead`) · Round 2 chưa giao — kế hoạch chi
tiết Phase 4.1. Chia **2 round**: Round 1 = lõi Settlement Worksheet (mở → chốt → khách xác nhận →
duyệt → yêu cầu thu/hoàn → đóng lượt); Round 2 = Post-Settlement Charge + Điều chỉnh sau `COMPLETED`
+ Đảo quyết toán.

**Nguồn nghiệp vụ (bản chuẩn):** `../thien-bao-car-docs/modules/RentalSettlement-BRD.md` (v1.6 —
toàn bộ, đặc biệt §6-§18, §21-§24, §28). `RentalSettlement-UseCase.md` **chỉ dùng cho §4 State Model**
(đã verify) và tham khảo luồng UC-RS-13/14/15/16/17 khi BRD không mô tả chi tiết bước — không bám
UseCase cho điều kiện/quyền nếu lệch BRD. `../thien-bao-car-docs/WebappQuanTri.md` §11.2-§11.4.
`CR-2026-003/004/005/009/010/022/023/035/054/057/060/062`.

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md`
+ `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` (mẫu format + tiền lệ ranh giới), code hiện có:
`src/shared/domain/enums.ts` (`SETTLEMENT_STATUSES` **sai** — §0.1), `src/shared/domain/permissions.ts`
(`SETTLEMENT.VIEW/CONFIRM/APPROVE/REVERSE` đã có), `src/features/rentals/model.ts`
(`ROUND1_TRANSITIONS`), `src/features/handover-return/model.ts` (`ReturnRecord.additionalCharges`,
`HandoverRecord.prepaymentConfirmed/fullPaymentConfirmed`), `src/features/incidents/model.ts`
(`Incident.customerCharge`/`liability`/`status`).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. Việc đầu tiên: sửa `SETTLEMENT_STATUSES` cho khớp tài liệu (không phải quyết định mới)

`src/shared/domain/enums.ts` hiện là `['DRAFT', 'CONFIRMED', 'CLOSED', 'REVERSED']` kèm comment "BA đề
xuất… tài liệu gốc chưa đặt tên state machine" — **sai**: `RentalSettlement-UseCase.md` §4 đã định
nghĩa state machine. Sửa thành đúng 5 giá trị, đúng thứ tự:

```text
DRAFT → PENDING_CUSTOMER → WAITING_APPROVAL → CONFIRMED → COMPLETED
                                                               │ UC-RS-16 (đảo quyết toán — chỉ SYSTEM_ADMIN)
                                                               ▼
                                                        quay lại DRAFT
```

- `REVERSED` là **tên hành động**, không phải state đích → bỏ khỏi enum (vẫn có audit action
  `REVERSE_SETTLEMENT`, §9). `CLOSED` không tồn tại trong tài liệu → bỏ.
- Đã `grep` toàn `src/`: **chưa có chỗ nào dùng** `SettlementStatus`/`SETTLEMENT_STATUSES` ngoài chính
  định nghĩa → sửa an toàn, không vỡ code khác. Thay comment bằng trích nguồn `RentalSettlement-UseCase.md §4`.
- Thêm label map `SETTLEMENT_STATUS_LABELS` vào `vi.ts` (chưa có).

### 0.2. Ranh giới kiến trúc — đụng gì, không đụng gì

| Khu vực | Được phép | Không được phép |
| --- | --- | --- |
| `features/finance/*` (mới) | Tạo mới toàn bộ: `model.ts` · `api.ts` · `hooks.ts` · `components/` · `screens/` · `seed.ts` · `index.ts` | — |
| `features/rentals/model.ts` · `api.ts` · `hooks.ts` · `index.ts` | **Mở rộng có kiểm soát lần thứ 3** (sau `contracts`, `handover-return`) — chỉ đúng các transition ở §3.4 + export qua barrel | Sửa logic/transition hiện có (`canConfirm`, `canCancel`, `canCancelReturn`…), đổi entity `Rental`, đụng `rentals/seed.ts` |
| `features/rentals/screens/RentalDetailScreen.tsx` | Thêm tab "Quyết toán" + đọc `?tab=` từ URL (§5.3) | Đổi 8 tab hiện có (trừ cập nhật chữ placeholder tab "Thanh toán") |
| `features/handover-return/index.ts` | **Chỉ thêm dòng re-export** (read-only) — §3.5 | `handover-return/model.ts` · `api.ts` · `hooks.ts` · `seed.ts` · components — **không đụng một ký tự** |
| `features/incidents/index.ts` | **Chỉ thêm dòng re-export** (read-only) — §3.5 | `incidents/model.ts` · `api.ts` · `hooks.ts` · `seed.ts` — **không đụng** (không tự đóng Incident khi đóng lượt, xem §1.2) |
| `features/vehicles/*`, `features/customers/*` | Đọc qua barrel/hooks như tiền lệ | Ghi bất kỳ field nào (cập nhật "lịch sử xe/khách" BRD §16.2 đã có sẵn qua dữ liệu Rental — không cần ghi) |
| `shared/domain/enums.ts` | Sửa `SETTLEMENT_STATUSES` + thêm enum mới §2.2 + nối audit action §9 vào **cuối** `AUDIT_ACTIONS` | Sửa/chèn giữa enum khác |
| `shared/domain/permissions.ts` | Thêm đúng 2 entry §8 | Sửa entry hiện có |
| `app/routes.tsx` | Thay `ComingSoon` của `/finance/settlement` | Đụng route khác của nhóm Tài chính (vẫn `ComingSoon`, thuộc 4.2/4.3) |

**Lý do mở barrel thay vì deep-import:** repo có tiền lệ deep-import read-only (`incidents/api.ts` →
`handover-return/api`), nhưng quy ước `CONVENTIONS.md` §3 là chỉ đi qua barrel. Phase 4.1 làm đúng
quy ước: thêm re-export read-only ở `index.ts` của 2 feature nguồn, `features/finance` **chỉ import
`@/features/handover-return`, `@/features/incidents`, `@/features/rentals`** (không `/api`, `/hooks`,
`/model`). Ngoại lệ duy nhất được chấp nhận: deep-import `useCustomers`/`useVehicles` từ `hooks.ts`
như mọi feature khác đang làm (2 feature đó chưa export hook qua barrel — không thuộc phạm vi sửa).

### 0.3. Payment (Phase 4.2) chưa tồn tại — `Paid To Date` & trạng thái thanh toán là **giá trị tạm suy**

RS-BR-11 nói trạng thái thanh toán của Settlement đồng bộ **từ Payment**. Phase 4.1 chưa có Payment, nên:

- `Paid To Date` (RS-BR-21 = Prepayment 30% + 70% mốc giao xe) **suy tạm** từ 2 cờ thủ công đã có ở
  `HandoverRecord` (`prepaymentConfirmed`, `fullPaymentConfirmed` — VH-BR-17), §3.2.
- `Deposit Held` (RS-BR-22) suy tạm: `CASH_20M` + `fullPaymentConfirmed` → 20.000.000; ngược lại 0.
- Yêu cầu thu/hoàn (UC-RS-10/11) chỉ **ghi lại yêu cầu** trong Settlement (`paymentRequests[]`,
  trạng thái `REQUESTED`) — không sinh giao dịch. `paymentStatus` chỉ nhận `UNPAID` / `REFUND_PENDING`
  ở 4.1; `PARTIALLY_PAID`/`PAID`/`REFUNDED` chờ Payment đồng bộ ở 4.2.
- Comment tại mỗi chỗ: `// TODO(Phase 4.2): thay bằng tổng giao dịch CONFIRMED từ Payment (RS-BR-11/21)`.
  Phase 4.2 sẽ quyết định giữ `paymentRequests` nhúng hay tách thành entity `PaymentRequest` riêng (bump
  `SEED_VERSION`) — **không** thiết kế trước entity Payment ở đây.

### 0.4. Điểm tài liệu chưa nhất quán — tech-lead diễn giải để code được, **ghi lại cho BA**, không tự sửa tài liệu

1. **Thời điểm vào `WAITING_APPROVAL`**: AC-RS-006 nói "Accountant lưu miễn giảm > ngưỡng → Settlement
   chuyển `WAITING_APPROVAL`" ngay; State Model §4 xếp `WAITING_APPROVAL` **sau** `PENDING_CUSTOMER`.
   Diễn giải chọn: giữ đúng thứ tự State Model (đã verify) — lưu miễn giảm vượt ngưỡng chỉ đánh dấu
   **miễn giảm** `PENDING_APPROVAL`; Settlement đi `DRAFT → PENDING_CUSTOMER`, sau khi khách xác nhận
   thì vào `WAITING_APPROVAL` nếu còn miễn giảm chờ duyệt, ngược lại thẳng `CONFIRMED`. Kết quả cuối
   của AC-RS-006 (cần Manager duyệt trước khi chốt) vẫn đạt.
2. **Công thức §11 có thể trừ trùng phần `WAIVED`**: "Gross = Σ dòng `CONFIRMED`" và "Total Discount
   gồm phần `WAIVED`". Nếu dòng `WAIVED` đã không nằm trong Gross mà còn cộng vào Discount thì bị trừ 2
   lần. Diễn giải chọn (không trừ trùng + đúng §12 "hiển thị riêng, không ẩn vào giá"): **Gross tính cả
   dòng `CONFIRMED` và `WAIVED`** (giữ số thực tế để minh bạch), **Total Discount cộng số tiền dòng
   `WAIVED`** → hiệu ứng ròng = 0 cho dòng được miễn, nhưng vẫn hiện rõ trên bảng.
3. **Huỷ biên bản trả xe khi Settlement đã mở**: `VehicleReturn-BRD.md` (dòng ~749) cho phép Huỷ Return
   đưa `SETTLEMENT → IN_RENTAL` (đã implement qua `canCancelReturn`), nhưng RS không nói Settlement đang
   mở xử lý thế nào. **Không đổi** hành vi Huỷ Return (thuộc VR, ngoài phạm vi). Settlement chưa
   `COMPLETED` mà Rental không còn ở `RETURNED`/`SETTLEMENT` → worksheet **khoá chỉ-đọc** + banner cảnh
   báo + `TODO(OQ: RS×VR — Settlement khi Return bị huỷ)`.
4. **Trùng nguồn tiền sự cố**: `ADDITIONAL_CHARGE_TYPES` của Return có `DAMAGE`, trong khi BRD §8 nói
   chi phí sự cố lấy từ Incident (`Customer Charge`). Giữ RS-BR-03 (kế thừa nguyên nguồn): dòng `DAMAGE`
   từ Return vẫn sinh dòng `RETURN`, nhưng hiển thị cảnh báo "đối chiếu hồ sơ sự cố để tránh tính trùng"
   + `TODO(OQ: RS §8 — DAMAGE ở Return vs Customer Charge ở Incident)`. Seed hiện **không** có dòng
   `DAMAGE` nào.
5. **`Rental.additionalChargesAmount`** (field tổng tạm tính của RM §19) — seed đang đặt trùng giá trị với
   Additional Charge Item của Return. BRD §8 chỉ lấy **Tiền thuê gốc + Giảm giá hợp đồng** từ nguồn
   `RENTAL`; mọi phát sinh lấy từ `RETURN`. → Settlement **không** sinh dòng từ
   `additionalChargesAmount` (tránh tính trùng). Tương tự **phí giao/nhận** chỉ lấy từ dòng
   `DELIVERY_FEE` của Return (VR-BR-25 đã copy `rental.deliveryFee`), không lấy lại từ `Rental`.

---

## 1. Phạm vi

### 1.1. Trong phạm vi — Round 1 (lõi Worksheet)

| # | Hạng mục | Nguồn |
| --- | --- | --- |
| 1 | Sửa `SETTLEMENT_STATUSES` + enum mới §2.2 + audit action §9 + 2 permission §8 | UC §4, BRD §6/§12/§15/§22 |
| 2 | Model `Settlement`/`SettlementLine`/`SettlementWaiver` + hàm thuần §3 | BRD §6, §8-§16 |
| 3 | **Mở quyết toán thủ công** từ Rental `RETURNED` (nút "Mở quyết toán") → Rental `RETURNED → SETTLEMENT`, sinh dòng từ Rental + Return + Incident | UC-RS-01, RS-BR-01/02/03, AC-RS-001 |
| 4 | **Đồng bộ lại từ nguồn** (Return/Incident đổi sau khi mở → dòng `CONFIRMED` có nguồn đổi quay `DRAFT`, gắn cờ "nguồn đã thay đổi"; Incident vừa `APPROVED` → dòng mở khoá chốt) | RS-BR-04, EX-01, EX-05 |
| 5 | **Chốt dòng** (`DRAFT → CONFIRMED`): dòng `RETURN` cho sửa `Actual Amount`; dòng `INCIDENT` khoá `Actual = Customer Charge` của Incident | UC-RS-03, RS-BR-05, AC-RS-002/003/015, RS-BR-27 |
| 6 | **Thêm / xoá dòng `MANUAL`** (khoản khác — thu thêm hoặc giảm), bắt buộc lý do; chỉ xoá khi Settlement `DRAFT` | UC-RS-04, BRD §18.1, RS-BR-19 |
| 7 | **Miễn giảm / thiện chí** (`WAIVE_LINE` / `PARTIAL_DISCOUNT` / `GOODWILL_CREDIT`), bắt buộc lý do; vượt ngưỡng tạm → `PENDING_APPROVAL` | UC-RS-05, BRD §12, RS-BR-07/08 |
| 8 | **Đánh dấu tranh chấp** một dòng (`DISPUTED`, không tính vào Final) + **Kết luận tranh chấp** (giữ nguyên / điều chỉnh số / miễn) | AC-RS-007, RS-BR-17, UC-RS-17 (3/4 nhánh) |
| 9 | **Tính Final Amount** tức thời (Gross / Discount / VAT=0 / Làm tròn=0 / Final) | BRD §11, RS-BR-15, AC-RS-002 |
| 10 | **Đối trừ cọc** — hệ thống tính đề xuất theo công thức §10, Accountant bấm "Xác định đối trừ cọc" để chốt | UC-RS-06, RS-BR-09/22, AC-RS-004/005, CR-2026-003 |
| 11 | **Gửi khách xác nhận** (`DRAFT → PENDING_CUSTOMER`) + **Ghi nhận khách xác nhận / không đồng ý dòng** (`→ WAITING_APPROVAL`/`CONFIRMED` hoặc dòng `DISPUTED` + quay `DRAFT`) | BRD §13, UC §4 |
| 12 | **Duyệt / Trả lại** quyết toán (`WAITING_APPROVAL → CONFIRMED` / `→ DRAFT` kèm ghi chú bắt buộc) | BRD §14, UC-RS-09, EX-06 |
| 13 | **Tạo yêu cầu thu / hoàn cọc / hoàn tiền thừa** (ghi nhận yêu cầu, không ghi giao dịch) | UC-RS-10/11, RS-BR-10/20, EX-03, §0.3 |
| 14 | **Đóng lượt** (`CONFIRMED → COMPLETED` + Rental `SETTLEMENT → COMPLETED`), liệt kê điều kiện chưa thỏa | UC-RS-13, BRD §16, RS-BR-06/12/20, AC-RS-009/010 |
| 15 | Màn **Quyết toán** `/finance/settlement` (danh sách) + tab **"Quyết toán"** ở Rental Detail (worksheet) | `WebappQuanTri.md` §11.2 |
| 16 | Seed Settlement cho các Rental `SETTLEMENT`/`COMPLETED` đã có | §7 |

### 1.2. Ngoài phạm vi Round 1 — lý do

| Hạng mục | Lý do / nơi xử lý |
| --- | --- |
| Post-Settlement Charge, Điều chỉnh sau `COMPLETED`, Đảo quyết toán (UC-RS-14/15/16) | **Round 2** của plan này (§10) |
| Ghi nhận giao dịch tiền, đồng bộ `PAID`/`REFUNDED`, quỹ tiền mặt, công nợ khách | Phase 4.2 (`Payment`) — RS-BR-10/11 |
| Ghi nhận doanh thu `ON_SETTLEMENT`, cập nhật doanh thu/chi phí xe | Phase 4.3 (`RevenueCost`) — RS-BR-16 |
| Tự động mở Settlement khi Return `COMPLETED` (AC-RS-001 nhánh tự động) | Return `COMPLETED` chỉ có qua seed (Webapp không có wizard nhận xe); muốn tự động phải sửa `handover-return/api.ts` — **cấm** (§0.2). BRD §7 cho phép "dừng chờ Accountant mở" theo cấu hình → dùng nhánh thủ công |
| Đóng Incident liên kết khi đóng lượt (BRD §16.2) | Phải ghi vào `incidents/*` — cấm (§0.2). Roadmap |
| Xuất PDF bảng quyết toán (UC-RS-18), báo cáo (UC-RS-19), cấu hình ngưỡng/VAT/làm tròn (UC-RS-20) | Ngoài phạm vi demo Phase 4.1; cấu hình phụ thuộc nhiều Open Question (§11) |
| Nhánh "tách khoản tranh chấp ra Post-Settlement" (UC-RS-17 bước 4 nhánh 4) | Phụ thuộc OQ RS §28 Q13 + Round 2 |
| Giữ lại một phần cọc chờ phạt nguội (EX-04) | OQ RS §28 Q3 — `Deposit Refundable` hoàn toàn bộ, `TODO(OQ)` |
| Ngưỡng B (Admin duyệt), hạn mức tổng miễn giảm, cảnh báo "Final Amount bất thường" | OQ RS §28 Q9/Q10 — chỉ 1 ngưỡng tạm (§3.6) |
| Notification (quyết toán chờ duyệt, khách còn nợ…) | Phase 6 (`NT`) |

---

## 2. Data model

### 2.1. `features/finance/model.ts` — entity (storage key `settlements`)

```ts
/** RS §6 — dòng khoản mục. Số tiền luôn là số nguyên dương; chiều cộng/trừ do `direction`. */
interface SettlementLine {
  id: string
  category: SettlementLineCategory      // §2.2
  source: SettlementLineSource          // RENTAL | RETURN | INCIDENT | MANUAL | SYSTEM
  direction: 'CHARGE' | 'DISCOUNT'      // CHARGE = khách phải trả; DISCOUNT = giảm cho khách
  estimatedAmount?: number              // chỉ dòng RETURN/INCIDENT (RS-BR-05)
  actualAmount?: number                 // bắt buộc khi CONFIRMED/WAIVED
  status: SettlementLineStatus          // DRAFT | CONFIRMED | WAIVED | DISPUTED
  sourceRef?: { returnRecordId?: string; additionalChargeItemId?: string; incidentId?: string } // RS-BR-19 bằng chứng
  sourceReady: boolean                  // EX-01 — false khi Incident chưa APPROVED → không cho chốt
  sourceChanged?: boolean               // EX-05 — nguồn đổi sau khi đã chốt
  sourceWarning?: 'POSSIBLE_DUPLICATE_DAMAGE' // §0.4 điểm 4
  note?: string                         // ghi chú nguồn (copy từ AdditionalChargeItem.note) hoặc ghi chú chốt
  reason?: string                       // bắt buộc với MANUAL (RS-BR-19)
  disputeNote?: string
  confirmedByName?: string; confirmedAt?: string
}

/** RS §12 — miễn giảm / thiện chí, hiển thị riêng, không ẩn vào giá. */
interface SettlementWaiver {
  id: string
  type: SettlementWaiverType            // WAIVE_LINE | PARTIAL_DISCOUNT | GOODWILL_CREDIT
  lineId?: string                       // bắt buộc với WAIVE_LINE / PARTIAL_DISCOUNT
  amount: number                        // WAIVE_LINE = actualAmount của dòng
  reason: string                        // RS-BR-07
  status: SettlementWaiverStatus        // APPROVED | PENDING_APPROVAL | REJECTED
  requestedByName: string; requestedByRole: Role; requestedAt: string
  decidedByName?: string; decidedAt?: string; decisionNote?: string
}

/** RS §10 — chốt bởi hành động "Xác định đối trừ cọc"; bị xoá (phải chốt lại) khi số liệu dòng/miễn giảm đổi. */
interface DepositReconciliation {
  finalAmount: number; paidToDate: number
  depositHeld: number; depositApplied: number; depositRefundable: number; balanceDue: number
  reconciledByName: string; reconciledAt: string
}

/** RS §15 — chỉ ghi yêu cầu, Payment (4.2) mới thực thi (§0.3). */
interface SettlementPaymentRequest {
  id: string
  type: SettlementRequestType           // COLLECT | DEPOSIT_REFUND | OVERPAYMENT_REFUND
  amount: number
  status: 'REQUESTED' | 'CANCELLED'     // CANCELLED dùng ở Round 2 (đảo quyết toán)
  createdByName: string; createdAt: string
}

interface Settlement {
  id: string                            // generateId('stl')
  rentalId: string                      // RS-BR-01 — duy nhất theo rentalId
  customerId: string; vehicleId: string // copy từ Rental lúc mở để List lọc nhanh
  status: SettlementStatus
  lines: SettlementLine[]
  waivers: SettlementWaiver[]
  securityDepositType: SecurityDepositType   // snapshot từ Rental
  paidToDate: { prepayment: number; handoverPayment: number }  // §0.3 — suy tạm từ HandoverRecord
  depositHeld: number                        // §0.3 — suy tạm
  depositReconciliation?: DepositReconciliation
  customerAck?: { recordedByName: string; recordedAt: string; note?: string } // TODO(OQ RS §28 Q17)
  approval?: { decision: 'APPROVED' | 'RETURNED'; decidedByName: string; decidedAt: string; note?: string }
  paymentRequests: SettlementPaymentRequest[]
  paymentStatus?: SettlementPaymentStatus    // 4.1 chỉ UNPAID / REFUND_PENDING (§0.3)
  completedWithDebt?: boolean                // đóng khi Balance Due > 0 — giả định OQ RS §28 Q11
  completedTotals?: SettlementTotals & DepositReconciliation  // RS-BR-12 — đóng băng số liệu kỳ gốc
  completedByName?: string; completedAt?: string
  openedByName: string; openedAt: string
  createdAt: string; updatedAt: string
}
```

Totals **không lưu** khi chưa `COMPLETED` — luôn tính lại bằng `calcSettlementTotals()` (BRD §25.1 "tính
lại tức thời"). Khi `COMPLETED` mới đóng băng vào `completedTotals`.

### 2.2. Enum mới trong `shared/domain/enums.ts` (nối sau `SETTLEMENT_STATUSES`, kèm comment nguồn)

| Hằng số | Giá trị | Nguồn |
| --- | --- | --- |
| `SETTLEMENT_STATUSES` (**sửa**) | `DRAFT, PENDING_CUSTOMER, WAITING_APPROVAL, CONFIRMED, COMPLETED` | UseCase §4 |
| `SETTLEMENT_LINE_SOURCES` | `RENTAL, RETURN, INCIDENT, MANUAL, SYSTEM` | BRD §6 |
| `SETTLEMENT_LINE_STATUSES` | `DRAFT, CONFIRMED, WAIVED, DISPUTED` | BRD §6 |
| `SETTLEMENT_LINE_CATEGORIES` | `BASE_RENTAL, CONTRACT_DISCOUNT, EXTRA_KM, FUEL_DEFICIT, OVERTIME, DELIVERY_FEE, DAMAGE, MISSING_ACCESSORY, VETC, TRAFFIC_FINE, RETURN_DISCOUNT, RETURN_OTHER, INCIDENT, MANUAL_OTHER` | BRD §8 chỉ có tên tiếng Việt → **BA đề xuất mã**, ánh xạ 1-1 `ADDITIONAL_CHARGE_TYPES` (ghi rõ trong comment) |
| `SETTLEMENT_WAIVER_TYPES` | `WAIVE_LINE, PARTIAL_DISCOUNT, GOODWILL_CREDIT` | BRD §12 |
| `SETTLEMENT_WAIVER_STATUSES` | `APPROVED, PENDING_APPROVAL, REJECTED` | BA đề xuất (BRD §14 chỉ mô tả hành vi) |
| `SETTLEMENT_PAYMENT_STATUSES` | `UNPAID, PARTIALLY_PAID, PAID, REFUND_PENDING, REFUNDED` | BRD §15 |
| `SETTLEMENT_REQUEST_TYPES` | `COLLECT, DEPOSIT_REFUND, OVERPAYMENT_REFUND` | BRD §15 + EX-03 (BA đề xuất mã) |
| `POST_SETTLEMENT_CHARGE_TYPES` *(Round 2)* | `RECEIVABLE, REFUND` | BRD §17 |
| `POST_SETTLEMENT_CHARGE_STATUSES` *(Round 2)* | `OPEN, CLOSED` | BRD §17 (`CLOSED`); `OPEN` BA đề xuất |

Mỗi enum có label map tương ứng trong `vi.ts`.

---

## 3. Hàm thuần (`features/finance/model.ts`)

### 3.1. Sinh dòng từ nguồn — `buildSourceLines({ rental, returnRecord, incidents })` (RS-BR-03, BRD §8)

| Nguồn | Điều kiện | Dòng sinh ra |
| --- | --- | --- |
| `Rental.baseAmount` | luôn | `BASE_RENTAL` · `RENTAL` · `CHARGE` · `actual = baseAmount` · **`CONFIRMED`** (BRD §8 BR "dòng RENTAL mặc định CONFIRMED") |
| `Rental.discountAmount` | `> 0` | `CONTRACT_DISCOUNT` · `RENTAL` · `DISCOUNT` · `CONFIRMED` · note = `discountNote` |
| `Rental.additionalChargesAmount`, `Rental.deliveryFee` | — | **không sinh** (§0.4 điểm 5) |
| `ReturnRecord.additionalCharges[]` (chỉ Return `COMPLETED` của rental) | mỗi item | `RETURN` · `DRAFT` · `estimated = item.amount` · category ánh xạ 1-1 (`EXTRA_KM→EXTRA_KM`, …, `OTHER→RETURN_OTHER`, `DISCOUNT→RETURN_DISCOUNT` với `direction = DISCOUNT`, `DAMAGE` kèm `sourceWarning`) · `sourceRef.additionalChargeItemId` |
| `Incident` có `rentalId` khớp | `status ∉ {CANCELLED, CLOSED_NO_ACTION, WRITTEN_OFF}` **và** `liability ∈ {CUSTOMER, SHARED, UNDETERMINED}` | `INCIDENT` · `CHARGE` · `estimated = customerCharge ?? estimatedCost` · `sourceRef.incidentId` · status: Incident `DISPUTED` → dòng `DISPUTED` (UC-RS-03 A3); còn lại `DRAFT` · `sourceReady = status ∈ {APPROVED, IN_REPAIR, REPAIRED, CLOSED}` (EX-01) |
| `Incident` liability `COMPANY` / `THIRD_PARTY` / `INSURANCE` | — | không sinh dòng (khách không chịu — "ba con số khác nhau", `CLAUDE.md` §4) |

- `SHARED`/`UNDETERMINED`: Settlement **không tự tính** phần khách — dùng nguyên `customerCharge` do DI
  chốt; `UNDETERMINED` luôn `sourceReady=false`. `// TODO(OQ: master BRD §51 Q54 / RS §28 Q21 — công
  thức sự cố nặng khi Liability ≠ khách 100%; Settlement chỉ đọc Customer Charge từ DI)`.
- `ReturnIncidentItem` chưa chuyển thành `Incident` (không có Incident nào trỏ `returnIncidentItemId`
  tương ứng): **không sinh dòng**, chỉ hiện banner cảnh báo "Có N hư hỏng lúc nhận xe chưa lập hồ sơ sự
  cố" + link tab "Sự cố" (tiền sự cố chỉ đi qua Incident — BRD §8).

### 3.2. Suy tạm Paid To Date / Deposit Held (§0.3)

```text
prepayment       = handover.prepaymentConfirmed  ? rental.prepaymentAmount                      : 0
handoverPayment  = handover.fullPaymentConfirmed ? rental.baseAmount − rental.prepaymentAmount : 0   // 70% Base Rental — CR-2026-060
paidToDate       = prepayment + handoverPayment                                                     // RS-BR-21
depositHeld      = (rental.securityDepositType = CASH_20M ∧ handover.fullPaymentConfirmed) ? 20.000.000 : 0   // RS-BR-22
```
Không có `HandoverRecord` `COMPLETED` → cả 3 = 0 + banner cảnh báo.

### 3.3. Tổng tiền — `calcSettlementTotals(lines, waivers)` (BRD §11, diễn giải §0.4 điểm 2)

```text
Gross Charges   = Σ actual của dòng CHARGE có status ∈ {CONFIRMED, WAIVED}
Total Discount  = Σ actual dòng DISCOUNT CONFIRMED
                + Σ actual dòng CHARGE WAIVED
                + Σ amount waiver PARTIAL_DISCOUNT/GOODWILL_CREDIT có status ∈ {APPROVED, PENDING_APPROVAL}
Subtotal        = Gross − Total Discount
Tax (VAT)       = 0      // TODO(OQ: RS §28 Q5/Q6 — VAT; BRD §19 "chưa áp dụng → cấu hình tắt")
Rounding        = 0      // TODO(OQ: RS §28 Q5/Q7 — làm tròn 1.000đ/10.000đ, thứ tự discount/VAT/rounding)
Final Amount    = Subtotal + Tax + Rounding
```
- Dòng `DRAFT`/`DISPUTED` **không** tính (RS-BR-05/17). Miễn giảm `PENDING_APPROVAL` được tính tạm (khách
  xác nhận trên số đề xuất); bị trả lại → `REJECTED` → loại khỏi tổng và Settlement về `DRAFT` (EX-06).
- Số nguyên đồng; không làm tròn ngầm (BRD §25.2).

### 3.4. Đối trừ cọc — `calcDepositReconciliation(finalAmount, paidToDate, depositHeld)` (BRD §10)

```text
Nếu Final ≤ PaidToDate:  applied = 0;  refundable = depositHeld;  balanceDue = Final − PaidToDate   (≤ 0 → hoàn tiền thừa, EX-03)
Nếu Final > PaidToDate:  shortfall = Final − PaidToDate
                         applied    = min(shortfall, depositHeld)      // MOTORBIKE: depositHeld = 0 → applied = 0
                         balanceDue = shortfall − applied               // MOTORBIKE: khách trả bằng chuyển khoản QR (CR-2026-003)
                         refundable = depositHeld − applied
```
Phải khớp đúng AC-RS-004 (Held 2tr, Final 3,78tr, Paid 1tr → Applied 2tr, Balance 780k, Refundable 0) và
AC-RS-005 (Held 2tr, Final 1,5tr, Paid 1,5tr → Applied 0, Refundable 2tr). Comment:
`// TODO(OQ: RS §28 Q1 — đối trừ tự động hay cần khách đồng ý; demo: hệ thống đề xuất, Accountant bấm chốt,
khách xác nhận ở bước PENDING_CUSTOMER)`, `// TODO(OQ: RS §28 Q3 — giữ cọc chờ phạt nguội, chưa áp dụng)`.

### 3.5. Thay đổi barrel feature nguồn (chỉ thêm re-export, read-only)

- `features/handover-return/index.ts`: `export type { AdditionalChargeItem, ReturnIncidentItem } from './model'` ·
  `export { listHandovers, listReturns, HANDOVER_RECORDS_STORAGE_KEY, RETURN_RECORDS_STORAGE_KEY } from './api'` ·
  `export { useHandoverRecords, useReturnRecords } from './hooks'` — kèm comment
  `// RENTAL-SETTLEMENT-PLAN.md §0.2/§3.5 — re-export read-only cho features/finance`.
- `features/incidents/index.ts`: `export { list as listIncidents, INCIDENTS_STORAGE_KEY } from './api'` ·
  `export { useIncidents } from './hooks'` (cùng comment).
- `features/rentals/index.ts`: thêm `RENTALS_STORAGE_KEY` (seed cần) + các export §3.7.

### 3.6. Ngưỡng miễn giảm (tạm)

```ts
/** TODO(OQ: RS §28 Q9/Q10 — Ngưỡng A/B chưa chốt). Giá trị lấy từ ví dụ AC-RS-006, chỉ để demo. */
export const WAIVER_APPROVAL_THRESHOLD = 100_000
export function waiverNeedsApproval(amount: number): boolean { return amount > WAIVER_APPROVAL_THRESHOLD }
```
Mọi miễn giảm `> ngưỡng` → `PENDING_APPROVAL` **bất kể người tạo** (kể cả Manager — không tự duyệt cho
mình ở bản demo); `≤ ngưỡng` → `APPROVED` ngay (người quyết định = người tạo). Chỉ 1 cấp duyệt
(`SETTLEMENT.APPROVE`), không có Ngưỡng B. Mirror tiền lệ `incidents/model.ts` `APPROVAL_THRESHOLD`.

### 3.7. Guard trạng thái & điều kiện

```ts
SETTLEMENT_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  DRAFT: ['PENDING_CUSTOMER'],
  PENDING_CUSTOMER: ['WAITING_APPROVAL', 'CONFIRMED', 'DRAFT'],  // DRAFT khi khách không đồng ý 1 dòng
  WAITING_APPROVAL: ['CONFIRMED', 'DRAFT'],                       // DRAFT = trả lại (EX-06)
  CONFIRMED: ['COMPLETED'],
  COMPLETED: ['DRAFT'],                                           // Round 2 — đảo quyết toán (UC-RS-16)
}
```
- `isWorksheetEditable(s, rental)` = `s.status === 'DRAFT'` **và** `rental.status === 'SETTLEMENT'` (§0.4 điểm 3).
- `getSubmitBlockers(s)` (`DRAFT → PENDING_CUSTOMER`): còn dòng `DRAFT`; còn dòng `DISPUTED` (RS-BR-06);
  chưa có `depositReconciliation` hoặc đã lệch so với số tính lại.
- `getCompletionBlockers(s)` (AC-RS-009 — trả mảng khoá i18n để liệt kê): status ≠ `CONFIRMED`; còn
  `DRAFT`/`DISPUTED`; chưa đối trừ cọc; chưa có `customerAck`; còn waiver `PENDING_APPROVAL`; `balanceDue > 0`
  mà chưa có yêu cầu `COLLECT`; `depositRefundable > 0` mà chưa có `DEPOSIT_REFUND` (RS-BR-20);
  `balanceDue < 0` mà chưa có `OVERPAYMENT_REFUND`.
  `// TODO(OQ: RS §28 Q11/Q12 — đóng lượt khi còn công nợ; demo giả định theo đề xuất BRD §15: cho đóng
  nếu đã tạo yêu cầu thu, đánh dấu completedWithDebt, không áp hạn mức)`.
- `mergeResyncedLines(existing, fresh)` (EX-05): ghép theo `sourceRef`; dòng nguồn mới → thêm `DRAFT`;
  dòng nguồn biến mất → xoá nếu `DRAFT`, nếu `CONFIRMED` thì về `DRAFT` + `sourceChanged`; `estimated`
  đổi trên dòng `CONFIRMED` → về `DRAFT` + `sourceChanged`; dòng `MANUAL` giữ nguyên; `sourceReady` cập
  nhật theo Incident hiện tại. Mọi lần resync xoá `depositReconciliation`.

### 3.8. Mở rộng `features/rentals` (lần thứ 3, có kiểm soát)

`ROUND1_TRANSITIONS` — chỉ **thêm** giá trị, không xoá giá trị cũ (giữ nguyên hành vi `canCancelReturn`):

```ts
RETURNED:   ['IN_RENTAL', 'SETTLEMENT'],   // + SETTLEMENT — RENTAL-SETTLEMENT-PLAN.md §3.8 (UC-RS-01)
SETTLEMENT: ['IN_RENTAL', 'COMPLETED'],    // + COMPLETED — UC-RS-13
COMPLETED:  ['SETTLEMENT'],                // Round 2 — đảo quyết toán (UC-RS-16)
```
- `model.ts`: `canOpenSettlement(rental)` = `RETURNED` hoặc `SETTLEMENT` (RS-BR-02);
  `canCompleteRental(rental)`; *(Round 2)* `canRevertSettlementReversed(rental)`. Mirror `canMarkContractCreated()`.
- `api.ts` (hàm thuần async, mirror `markContractCreated`): `markSettlementOpened(id, actor)`
  (`RETURNED → SETTLEMENT`, audit `MARK_RENTAL_SETTLEMENT`); `markRentalCompleted(id, actor)`
  (`SETTLEMENT → COMPLETED`, audit `COMPLETE_RENTAL`); *(Round 2)* `revertSettlementReversed(id, actor)`
  (`COMPLETED → SETTLEMENT`, audit `REVERT_RENTAL_SETTLEMENT_REVERSED`).
- `index.ts`: export 3 guard + 3 hàm api + `RENTALS_STORAGE_KEY`, kèm comment ngoại lệ kiến trúc giống 2 khối
  hiện có. **Không** cần hook mới ở `rentals/hooks.ts` (finance tự invalidate `['rentals']`).

---

## 4. Business rule cần trích dẫn trong code

`RS-BR-01` (1 Rental = 1 Settlement — `open` trả lỗi nếu đã tồn tại) · `02` (mở khi `RETURNED`/`SETTLEMENT`)
· `03/04` (kế thừa nguồn, không sửa nguồn — dòng `INCIDENT` khoá số) · `05` (dòng RETURN/INCIDENT bắt đầu
`DRAFT`) · `06` (chặn khi còn `DRAFT`/`DISPUTED`) · `07` (lý do + người quyết định) · `08` (vượt ngưỡng
qua `WAITING_APPROVAL`) · `09` (số hoàn = Held − Applied) · `10` (không ghi giao dịch) · `11` (đồng bộ từ
Payment — §0.3) · `12` (`COMPLETED` không sửa) · `15` (thứ tự tính — OQ) · `17` (`DISPUTED` không tính) ·
`19` (bằng chứng/lý do) · `20` (phải có yêu cầu hoàn cọc trước khi đóng) · `21/22` (Paid To Date, cọc 2
loại) · `23/25/27` (dòng trễ giờ/phí giao nhận/nhiên liệu nhận từ Return, Settlement không tự tính lại) ·
`26` (trả sớm không giảm Base Rental — không sinh dòng hoàn vì trả sớm) · `CR-2026-003/060`.

---

## 5. Màn hình

### 5.1. `SettlementListScreen` (`/finance/settlement`) — thay `ComingSoon`

- `PageHeader` "Quyết toán" + mô tả ranh giới (Settlement quyết định *bao nhiêu*).
- Nguồn dữ liệu: `useSettlements()` + `useRentals()` (barrel) + customers/vehicles để hiển thị tên/biển số.
- Gồm 2 nhóm hàng: (a) Settlement đã mở; (b) Rental `RETURNED` **chưa có** Settlement → trạng thái ảo
  "Chờ mở quyết toán" (không phải enum, chỉ nhãn i18n).
- Cột: Lượt thuê · Khách · Xe · Trạng thái quyết toán (badge) · Final Amount · Balance Due (dương = phải
  thu, âm = phải hoàn — màu `text-status-*`) · Trạng thái thanh toán · Ngày mở.
- Bộ lọc: trạng thái quyết toán (gồm "Chờ mở"), tìm theo khách/biển số. Bấm hàng → `/rentals/:id?tab=settlement`.
- Responsive: bảng `overflow-x-auto` ở ≥ md, card list ở < md (mirror `IncidentListScreen`).

### 5.2. `SettlementWorksheet` (component, export qua barrel `@/features/finance`, prop `rentalId`)

1. **Chưa có Settlement**: nếu `canOpenSettlement(rental)` + `can('SETTLEMENT','CONFIRM')` → nút "Mở quyết
   toán" (dialog xác nhận); nếu Rental chưa trả xe → trạng thái rỗng "Quyết toán chỉ mở sau khi trả xe
   (RS-BR-02)".
2. **Header**: stepper 5 trạng thái + badge trạng thái thanh toán + banner: nguồn chưa sẵn sàng (EX-01),
   nguồn đã thay đổi (EX-05), hư hỏng chưa lập hồ sơ, chưa có biên bản giao xe (§3.2), Return đã bị huỷ
   (§0.4 điểm 3), `MOTORBIKE` → "phát sinh trả bằng chuyển khoản QR, không đối trừ".
3. **Bảng dòng khoản mục** (BRD §9): Khoản mục · Nguồn (link bằng chứng: `RETURN` → tab Giao-nhận của
   Rental; `INCIDENT` → `/incidents/:id`) · Ước tính · Thực tế · Trạng thái · Thao tác theo dòng. Dòng
   `DISCOUNT` hiển thị số âm. Hàng `DRAFT`/`DISPUTED` nổi bật bằng token màu trạng thái.
4. **Miễn giảm / thiện chí** — danh sách riêng (loại, dòng liên quan, số tiền, lý do, trạng thái, người).
5. **Tổng hợp** (BRD §9 mẫu): Gross · Tổng giảm · VAT ("Chưa áp dụng") · Làm tròn ("Chưa áp dụng") ·
   **Final Amount** · Đã thanh toán (30% + 70%) · Cọc giữ · Đối trừ cọc · **Còn phải thu / Phải hoàn** ·
   Cọc hoàn lại.
6. **Yêu cầu thanh toán** — danh sách `paymentRequests` + ghi chú "Payment ghi nhận ở Phase 4.2".
7. **Thanh hành động** theo trạng thái (§5.4).
8. **Lịch sử thao tác** — `listAuditRecords()` lọc `entity === 'Settlement' && entityId === settlement.id`
   (mirror `RentalAuditTab`).
- `COMPLETED`: toàn bộ chỉ-đọc, số liệu lấy từ `completedTotals` (RS-BR-12).

### 5.3. Tab "Quyết toán" ở `RentalDetailScreen`

- Thêm `TabsTrigger value="settlement"` **ngay sau** "Giá-cọc-phát sinh"; **ẩn hẳn** trigger khi thiếu
  `SETTLEMENT.VIEW` (tiền lệ ẩn tab DI-BR-22) — `OPERATION_STAFF`, `DISPATCHER` không thấy.
- Tabs đọc giá trị mặc định từ `useSearchParams().get('tab')` (fallback `overview`) để List §5.1 nhảy thẳng
  vào tab. Không đổi 8 tab hiện có; chỉ đổi chữ `vi.rentals.paymentPlaceholder` thành "Chờ Payment (Phase 4.2)."
- Import `SettlementWorksheet` qua `@/features/finance` (barrel).

### 5.4. Hành động × quyền × trạng thái

| Hành động | Trạng thái Settlement | Quyền (`permissions.ts`) | Audit |
| --- | --- | --- | --- |
| Mở quyết toán | (chưa có), Rental `RETURNED`/`SETTLEMENT` | `SETTLEMENT.CONFIRM` | `OPEN_SETTLEMENT` (+ `MARK_RENTAL_SETTLEMENT`) |
| Đồng bộ lại từ nguồn | `DRAFT` | `SETTLEMENT.CONFIRM` | `SYNC_SETTLEMENT_SOURCES` |
| Chốt dòng / sửa số thực tế | `DRAFT` | `SETTLEMENT.CONFIRM` | `CONFIRM_SETTLEMENT_LINE` / `UPDATE_SETTLEMENT_LINE` (before/after — AC-RS-015) |
| Thêm / xoá dòng `MANUAL` | `DRAFT` | `SETTLEMENT.CONFIRM` | `ADD_SETTLEMENT_MANUAL_LINE` / `REMOVE_SETTLEMENT_MANUAL_LINE` |
| Áp dụng miễn giảm | `DRAFT` | `SETTLEMENT.CONFIRM` | `APPLY_SETTLEMENT_WAIVER` |
| Đánh dấu tranh chấp | `DRAFT` | `SETTLEMENT.CONFIRM` | `DISPUTE_SETTLEMENT_LINE` |
| Kết luận tranh chấp | `DRAFT` | `SETTLEMENT.APPROVE` (UC-RS-17 actor Manager — BA đề xuất dùng APPROVE) | `RESOLVE_SETTLEMENT_DISPUTE` |
| Xác định đối trừ cọc | `DRAFT` | `SETTLEMENT.CONFIRM` | `RECONCILE_SETTLEMENT_DEPOSIT` |
| Gửi khách xác nhận | `DRAFT → PENDING_CUSTOMER` | `SETTLEMENT.CONFIRM` | `SUBMIT_SETTLEMENT_FOR_CUSTOMER` |
| Ghi nhận khách xác nhận / không đồng ý dòng | `PENDING_CUSTOMER →` `WAITING_APPROVAL`/`CONFIRMED` hoặc `DRAFT` | `SETTLEMENT.CONFIRM` | `RECORD_SETTLEMENT_CUSTOMER_ACK` / `DISPUTE_SETTLEMENT_LINE` |
| Duyệt / Trả lại (ghi chú bắt buộc) | `WAITING_APPROVAL →` `CONFIRMED` / `DRAFT` | `SETTLEMENT.APPROVE` | `APPROVE_SETTLEMENT` / `REJECT_SETTLEMENT` |
| Tạo yêu cầu thu / hoàn | `CONFIRMED` | `SETTLEMENT.CONFIRM` | `CREATE_SETTLEMENT_COLLECT_REQUEST` / `CREATE_SETTLEMENT_REFUND_REQUEST` |
| Đóng lượt | `CONFIRMED → COMPLETED` | `SETTLEMENT.CONFIRM` | `COMPLETE_SETTLEMENT` (+ `COMPLETE_RENTAL`) |
| *(R2)* Tạo Post-Settlement Charge / đánh dấu tất toán | `COMPLETED` | `SETTLEMENT.CREATE` | `CREATE_POST_SETTLEMENT_CHARGE` / `CLOSE_POST_SETTLEMENT_CHARGE` |
| *(R2)* Điều chỉnh sau `COMPLETED` | `COMPLETED` | `SETTLEMENT.EDIT` (Accountant = `TBD`) | `ADJUST_SETTLEMENT` |
| *(R2)* Đảo quyết toán | `COMPLETED → DRAFT` | `SETTLEMENT.REVERSE` (chỉ `SYSTEM_ADMIN`) | `REVERSE_SETTLEMENT` (+ `REVERT_RENTAL_SETTLEMENT_REVERSED`) |

`SALES` = `MANAGER` ở mọi dòng (đã qua `likeManager()`), trừ `REVERSE` (CR-2026-035). Nút bị ẩn khi thiếu
quyền (không chỉ disable). Mọi kiểm tra quyền qua `usePermission()` — không `if (role === …)`.

### 5.5. Dialog (đặt ở `features/finance/components/`)

`SettlementOpenDialog` · `SettlementLineConfirmDialog` (số thực tế; khoá với `INCIDENT`; ghi chú) ·
`SettlementManualLineDialog` (chiều thu/giảm, số tiền, lý do bắt buộc) · `SettlementWaiverDialog` (loại,
dòng, số tiền, lý do bắt buộc; hiển thị "sẽ cần duyệt" khi > ngưỡng) · `SettlementDisputeDialog` ·
`SettlementResolveDisputeDialog` (3 kết luận + lý do bắt buộc) · `SettlementDepositDialog` (xem công thức
→ chốt) · `SettlementCustomerAckDialog` (đồng ý toàn bộ, hoặc chọn dòng không đồng ý + ghi chú) ·
`SettlementApprovalDialog` (Duyệt / Trả lại, ghi chú bắt buộc khi trả lại) · `SettlementPaymentRequestDialog`
· `SettlementCompleteDialog` (liệt kê blocker AC-RS-009; cảnh báo `completedWithDebt`). Form dùng
`react-hook-form` + `zod` schema trong `model.ts`.

---

## 6. Responsive

Worksheet: bảng dòng khoản mục `overflow-x-auto` ở ≥ md, card theo dòng ở < md; khối Tổng hợp xếp dọc ở
mobile, 2 cột ở ≥ lg. Thanh hành động `flex-wrap`. Kiểm ~375px và ~768px không cuộn ngang cả trang
(`CONVENTIONS.md` §8, gotcha `min-w-0` ở `ARCHITECTURE.md` §6).

---

## 7. Seed data (`features/finance/seed.ts`)

Đăng ký **sau** `incidents` trong `registerSeeds.ts` (cần Rental + Handover/Return + Incident). Tăng
`SEED_VERSION` 12 → 13. Đọc dữ liệu qua `readJson(<STORAGE_KEY>)` với key import từ barrel (§3.5), và **dựng
bằng chính hàm thuần** `buildSourceLines`/`calcSettlementTotals`/`calcDepositReconciliation` (tiền lệ
`handover-return/seed.ts`), không gõ tay số tổng.

| Rental (seed hiện có) | Bối cảnh | Settlement seed |
| --- | --- | --- |
| `rt_020` `RETURNED`, `CASH_20M` | Return có `EXTRA_KM` + `MISSING_ACCESSORY` | **Không seed** — demo "Mở quyết toán" + đối trừ cọc `CASH_20M` |
| `rt_021` `RETURNED`, `MOTORBIKE` | `inc_003` `WAITING_APPROVAL` 3,5tr | **Không seed** — demo EX-01 (dòng sự cố khoá chốt tới khi DI duyệt) |
| `rt_022` `SETTLEMENT`, `CASH_20M` | `FUEL_DEFICIT` 350k + `inc_008` `CLOSED` 500k | **`DRAFT`**: dòng RENTAL `CONFIRMED`, 2 dòng `DRAFT`, chưa đối trừ cọc |
| `rt_023` `SETTLEMENT`, `MOTORBIKE` | `inc_004` `APPROVED` 700k | **`WAITING_APPROVAL`**: mọi dòng `CONFIRMED`, 1 `GOODWILL_CREDIT` 300k `PENDING_APPROVAL` (mirror AC-RS-006), đã đối trừ cọc (Held 0), có `customerAck` |
| `rt_024` `COMPLETED`, `CASH_20M` | `inc_006` `REPAIRED` 1,2tr | **`COMPLETED`**: đủ dòng, đối trừ một phần cọc, yêu cầu `DEPOSIT_REFUND`, `paymentStatus = REFUND_PENDING` |
| `rt_025` `COMPLETED`, `CASH_20M` | `TRAFFIC_FINE` 500k + `inc_007` 300k | **`COMPLETED`**: có 1 `WAIVE_LINE`/`PARTIAL_DISCOUNT` ≤ ngưỡng `APPROVED` |
| `rt_026` `COMPLETED`, `MOTORBIKE` | `OVERTIME` + `inc_010` `DISPUTED` 900k | **`COMPLETED`** **không có** dòng sự cố (sự cố tranh chấp chốt sau — RS-BR-24); Round 2 thêm Post-Settlement Charge cho `inc_010` |

`PENDING_CUSTOMER`/`CONFIRMED` không có seed (không có thêm Rental phù hợp; không sửa `rentals/seed.ts`) —
đi tới được qua UI từ `rt_022`. Mọi ngày tính động theo ngày trả xe của Rental.

---

## 8. Thay đổi `permissions.ts` (thêm 2 entry, giữ nguyên 4 entry cũ)

| Resource.Action | Giá trị | `source` |
| --- | --- | --- |
| `SETTLEMENT.CREATE` | `likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: true, OPERATION_STAFF: false })` | `RentalSettlement-BRD.md §22 — Tạo Post-Settlement Charge` |
| `SETTLEMENT.EDIT` | `likeManager({ SYSTEM_ADMIN: true, MANAGER: true, ACCOUNTANT: 'TBD', OPERATION_STAFF: false })` | `RentalSettlement-BRD.md §22 — Điều chỉnh sau COMPLETED (Accountant TBD — RS §28 Q16)` |

Thêm vào Round 1 (dù chỉ Round 2 dùng) để màn "Vai trò & quyền" (Phase 6) thấy đủ. `SETTLEMENT.CONFIRM`
hiện gộp nhiều dòng của §22 có cùng giá trị (Mở/Chốt/MANUAL/miễn giảm ≤ ngưỡng/đối trừ/yêu cầu thu-hoàn/
Đóng) — đúng, không tách thêm.

---

## 9. API / hooks / audit

### 9.1. `features/finance/api.ts` (storage key `settlements`, mọi hàm bọc `fakeRequest()`)

`listSettlements(filter?)` · `getSettlementByRentalId(rentalId)` · `openSettlement(rentalId, actor)` ·
`resyncSettlementSources(id, actor)` · `confirmLine(id, lineId, input, actor)` ·
`addManualLine` / `removeManualLine` · `applyWaiver` · `disputeLine` · `resolveDispute` ·
`reconcileDeposit` · `submitForCustomer` · `recordCustomerAck(id, { disputedLineIds, note }, actor)` ·
`approveSettlement` / `rejectSettlement(id, note, actor)` · `createPaymentRequest(id, type, actor)` ·
`completeSettlement(id, actor)`.

- Mỗi hàm ghi: kiểm guard §3.7 → ghi storage → `appendAudit({ entity: 'Settlement', entityId, before, after,
  … })`. Đọc nguồn qua `listReturns`/`listHandovers`/`listIncidents`/`getById` rental — **import qua barrel**.
- `openSettlement`: nếu Rental `RETURNED` → gọi `markSettlementOpened()` (rentals) **sau** khi ghi Settlement
  thành công; nếu đã `SETTLEMENT` (seed cũ) → không gọi.
- `completeSettlement`: ghi `completedTotals` + `COMPLETED`, rồi gọi `markRentalCompleted()`.

### 9.2. `features/finance/hooks.ts`

`useSettlements`, `useSettlementByRental`, một `useMutation` cho mỗi hàm ghi; `onSuccess` invalidate
`['settlements']` + (khi đổi trạng thái Rental) `['rentals']` và `['rentals','detail',rentalId]` — đúng
query key đang dùng ở `rentals/hooks.ts`. `useActor()` mirror `rentals/hooks.ts`.

### 9.3. `features/finance/index.ts`

`SettlementListScreen`, `SettlementWorksheet`, type `Settlement`, `useSettlements` (Phase 4.2/4.3 sẽ mở thêm).

### 9.4. Audit action mới — nối **cuối** `AUDIT_ACTIONS`, nhóm comment `// Rental Settlement (RS) — RENTAL-SETTLEMENT-PLAN.md §9.4 (UC-RS-21)`

Round 1: `OPEN_SETTLEMENT` · `SYNC_SETTLEMENT_SOURCES` · `CONFIRM_SETTLEMENT_LINE` · `UPDATE_SETTLEMENT_LINE`
· `ADD_SETTLEMENT_MANUAL_LINE` · `REMOVE_SETTLEMENT_MANUAL_LINE` · `APPLY_SETTLEMENT_WAIVER` ·
`DISPUTE_SETTLEMENT_LINE` · `RESOLVE_SETTLEMENT_DISPUTE` · `RECONCILE_SETTLEMENT_DEPOSIT` ·
`SUBMIT_SETTLEMENT_FOR_CUSTOMER` · `RECORD_SETTLEMENT_CUSTOMER_ACK` · `APPROVE_SETTLEMENT` ·
`REJECT_SETTLEMENT` · `CREATE_SETTLEMENT_COLLECT_REQUEST` · `CREATE_SETTLEMENT_REFUND_REQUEST` ·
`COMPLETE_SETTLEMENT` · (rentals) `MARK_RENTAL_SETTLEMENT` · `COMPLETE_RENTAL`.

Round 2: `CREATE_POST_SETTLEMENT_CHARGE` · `CLOSE_POST_SETTLEMENT_CHARGE` · `ADJUST_SETTLEMENT` ·
`REVERSE_SETTLEMENT` · (rentals) `REVERT_RENTAL_SETTLEMENT_REVERSED`.

Ánh xạ UC-RS-21: `OPEN/CONFIRM_LINE/UPDATE_LINE/ADD_MANUAL_LINE/APPLY_WAIVER/DEPOSIT_RECONCILE/
CUSTOMER_ACK/APPROVE/REJECT/CREATE_COLLECT_REQUEST/CREATE_REFUND_REQUEST/COMPLETE/POST_SETTLEMENT_CHARGE/
ADJUST/REVERSE/DISPUTE_RESOLVE`. BA đề xuất thêm (ghi comment): `SYNC_SETTLEMENT_SOURCES`,
`REMOVE_SETTLEMENT_MANUAL_LINE`, `DISPUTE_SETTLEMENT_LINE`, `SUBMIT_SETTLEMENT_FOR_CUSTOMER`,
`CLOSE_POST_SETTLEMENT_CHARGE`. Không làm: `PAYMENT_SYNC`, `EXPORT_PDF`, `CONFIG_CHANGE`, `RECALC_TOTAL`
(tính lại tức thời, không phải thao tác). **Lý do bắt buộc** (UC-RS-21 §25.3) ở: thêm MANUAL, miễn giảm,
trả lại, đóng có công nợ, Post-Settlement Charge, điều chỉnh, đảo, kết luận tranh chấp.

---

## 10. Round 2 — Post-Settlement Charge, Điều chỉnh, Đảo quyết toán (giao sau khi Round 1 `DONE`)

- Entity `PostSettlementCharge` (storage key `postSettlementCharges`): `id, settlementId, rentalId,
  customerId, incidentId?, type (RECEIVABLE|REFUND), amount, reason, isAdjustment, status (OPEN|CLOSED),
  createdBy…, closedBy…/closedAt?`. Không mở lại Settlement gốc, không đổi `completedTotals` (RS-BR-13,
  BRD §25.4).
- UC-RS-14: tạo PSC (`SETTLEMENT.CREATE`), chỉ khi Rental `COMPLETED`; "Đánh dấu đã tất toán" thủ công →
  `CLOSED` (`// TODO(Phase 4.2): đóng theo Payment`). `// TODO(OQ: RS §28 Q14/Q15 — thời hạn truy thu,
  ngưỡng bỏ qua)`.
- UC-RS-15: Điều chỉnh (`SETTLEMENT.EDIT`, Accountant `TBD` → ẩn) = PSC `isAdjustment = true`, lý do bắt buộc.
- UC-RS-16: Đảo quyết toán (`SETTLEMENT.REVERSE`): dialog 2 bước (lý do bắt buộc + gõ lại mã lượt thuê),
  Settlement `COMPLETED → DRAFT`, lưu bản trước vào `reversals[]` (giữ toàn bộ lịch sử), xoá
  `customerAck`/`depositReconciliation`/`approval`/`completedTotals`, yêu cầu thanh toán → `CANCELLED`,
  Rental `COMPLETED → SETTLEMENT` qua `revertSettlementReversed()`. PSC đã có giữ nguyên.
- Phần PSC trong worksheet (khi `COMPLETED`) + cột "PSC đang mở" ở List.
- Seed: `rt_024` PSC `RECEIVABLE` `OPEN` (phạt nguội về sau — AC-RS-011); `rt_025` PSC `REFUND`
  `isAdjustment` `CLOSED` 200k (AC-RS-012); `rt_026` PSC `RECEIVABLE` `OPEN` 900k gắn `inc_010`
  (RS-BR-24). Bump `SEED_VERSION`.

---

## 11. Open Question chặn — xử lý bằng `TODO(OQ)` (không tự chốt)

| # (IMPLEMENTATION-PLAN) | Open Question | Chặn phần nào | Xử lý tạm ở 4.1 |
| --- | --- | --- | --- |
| 1 | Công thức sự cố nặng khi `Liability` ≠ khách 100% — master §51 Q54, RS §28 Q21 | Số tiền dòng `INCIDENT` | Settlement **chỉ đọc** `customerCharge` do DI chốt, không tự tính; `SHARED`/`UNDETERMINED` có TODO tại `buildSourceLines` |
| 2 | Đối trừ cọc tự động hay cần khách đồng ý — RS §28 Q1 | Bước đối trừ cọc | Hệ thống đề xuất theo công thức §10, Accountant bấm chốt, khách xác nhận cả gói ở `PENDING_CUSTOMER`; TODO tại `calcDepositReconciliation` |
| 3 | Ngưỡng miễn giảm A/B — RS §14, §28 Q9 (+ Q10 hạn mức) | Khi nào cần `WAITING_APPROVAL` | Hằng số tạm `WAIVER_APPROVAL_THRESHOLD = 100_000` (ví dụ AC-RS-006), 1 cấp duyệt; TODO tại hằng số |
| 4 | Làm tròn / VAT / thứ tự — RS §19, §28 Q5-Q8 | `Tax`, `Rounding`, `Final Amount` | VAT = 0, Rounding = 0, hiển thị "Chưa áp dụng"; thứ tự cố định Gross → Discount → (VAT) → (Rounding); TODO tại `calcSettlementTotals` |
| 5 | Giữ cọc chờ phạt nguội — RS §28 Q3 | `Deposit Refundable`, EX-04 | Hoàn toàn bộ phần dư; TODO tại hàm đối trừ cọc + dialog yêu cầu hoàn |
| 6 | Đóng lượt khi còn công nợ, hạn mức — RS §28 Q11; ai được đóng — Q12 | `getCompletionBlockers` | Theo đề xuất BRD §15: cho đóng nếu đã có yêu cầu `COLLECT`, gắn `completedWithDebt` + cảnh báo; không hạn mức. Người đóng = `SETTLEMENT.CONFIRM` theo ma trận §22 (Accountant ✓); TODO tại hàm |
| 7 | Khoản tranh chấp giữ trong Settlement hay tách Post-Settlement; khách từ chối toàn bộ — RS §28 Q13 | UC-RS-17 nhánh 4, UC-RS-08 A2 | Chỉ build 3 nhánh giữ/điều chỉnh/miễn; "từ chối toàn bộ" = đánh dấu mọi dòng `DISPUTED` → về `DRAFT`; TODO tại dialog kết luận |
| 8 | Thời hạn truy thu + ngưỡng bỏ qua — RS §28 Q14/Q15 | Post-Settlement Charge (Round 2) | Không giới hạn thời hạn, không đề xuất bỏ qua; TODO tại hàm tạo PSC |
| 9 | Mức xác nhận khách Phase 1 (M0-M4) — RS §28 Q17 | Bước `PENDING_CUSTOMER` | Luôn đi qua `PENDING_CUSTOMER`; nhân viên ghi nhận thay khách (gần M1 — mức BRD đề xuất tối thiểu); TODO tại `recordCustomerAck` |

Không chặn nhưng cần BA xem: 5 điểm lệch tài liệu ở §0.4 (thứ tự `WAITING_APPROVAL`; trừ trùng `WAIVED`;
huỷ Return khi Settlement đã mở; `DAMAGE` ở Return vs Incident; `Rental.additionalChargesAmount`).

---

## 12. Danh sách file `dev` đọc trước khi code (đọc đúng danh sách, không scan rộng)

**Tài liệu nghiệp vụ**
- `../thien-bao-car-docs/modules/RentalSettlement-BRD.md` §6-§16, §21-§24, §28 (toàn bộ khoảng này).
- `../thien-bao-car-docs/modules/RentalSettlement-UseCase.md` §4 (State Model), §17 (UC-RS-13), §21 (UC-RS-17), §25 (UC-RS-21) — Round 2 thêm §18-§20.
- `../thien-bao-car-docs/WebappQuanTri.md` §11.2-§11.4.

**Code tham chiếu**
- `src/shared/domain/enums.ts` — `SETTLEMENT_STATUSES` (dòng ~203-209), `ADDITIONAL_CHARGE_TYPES`, `LIABILITIES`, `INCIDENT_STATUSES`, cuối `AUDIT_ACTIONS`.
- `src/shared/domain/permissions.ts` — khối "Nhóm 6 — Tài chính (§11.4)" + `likeManager()`.
- `src/features/rentals/model.ts` (interface `Rental`, `ROUND1_TRANSITIONS`, `canMarkContractCreated`), `rentals/api.ts` (`markContractCreated`, `revertReturnCancelled` — mẫu), `rentals/index.ts`, `rentals/hooks.ts` (query key, `useActor`), `rentals/screens/RentalDetailScreen.tsx`, `rentals/components/RentalAuditTab.tsx`.
- `src/features/handover-return/model.ts` (`HandoverRecord`, `ReturnRecord`, `AdditionalChargeItem`, `ReturnIncidentItem`) + `handover-return/api.ts` dòng 1-80 (key + `listReturns`/`listHandovers`) + `handover-return/index.ts` + `handover-return/seed.ts` dòng 170-400 (dữ liệu rt_020→rt_026).
- `src/features/incidents/model.ts` (interface `Incident`, `APPROVAL_THRESHOLD` — mẫu hằng số tạm) + `incidents/api.ts` dòng 1-80 + `incidents/index.ts` + `incidents/seed.ts` (inc_003/004/006/007/008/010).
- Mẫu màn hình/dialog: `src/features/incidents/screens/IncidentListScreen.tsx`, `src/features/rentals/components/RentalIncidentsTab.tsx`, một dialog lý do bắt buộc bất kỳ trong `incidents/components/`.
- `src/shared/fixtures/registerSeeds.ts`, `src/shared/fixtures/seedAll.ts`, `src/app/routes.tsx`, `src/shared/layout/nav.tsx` (mục "Quyết toán" đã có), `src/shared/lib/audit.ts`, `src/shared/lib/money.ts`.

---

## 13. File dự kiến tạo / sửa

**Tạo mới:** `src/features/finance/{model.ts, api.ts, hooks.ts, seed.ts, index.ts}`,
`src/features/finance/screens/SettlementListScreen.tsx`, `src/features/finance/components/` (
`SettlementWorksheet.tsx`, `SettlementStatusBadge.tsx`, các dialog §5.5, bảng dòng/khối tổng hợp tách
component nếu dài).

**Sửa:** `src/shared/domain/enums.ts` · `src/shared/domain/permissions.ts` · `src/shared/i18n/vi.ts`
(khối `vi.finance.settlement.*` + label map) · `src/shared/fixtures/registerSeeds.ts` ·
`src/shared/fixtures/seedAll.ts` (`SEED_VERSION` 13) · `src/app/routes.tsx` (`/finance/settlement`) ·
`src/features/rentals/{model.ts, api.ts, index.ts}` (§3.8) · `src/features/rentals/screens/RentalDetailScreen.tsx`
(§5.3) · `src/features/handover-return/index.ts` + `src/features/incidents/index.ts` (§3.5, chỉ re-export).

---

## 14. Definition of Done — Round 1

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `SETTLEMENT_STATUSES` đúng 5 giá trị theo thứ tự §0.1; enum mới khớp từng ký tự §2.2; audit action
   chỉ nối cuối mảng.
3. `git diff` **trống** ở `handover-return/{model,api,hooks,seed}.ts`, `incidents/{model,api,hooks,seed}.ts`,
   `rentals/seed.ts`, `vehicles/*`, `customers/*`; `handover-return/index.ts` + `incidents/index.ts` chỉ có
   dòng `export` thêm; `rentals/model.ts` chỉ **thêm** giá trị vào `ROUND1_TRANSITIONS` + hàm mới.
4. `features/finance` không import sâu `handover-return`/`incidents`/`rentals` (chỉ barrel); không gọi
   `localStorage` trực tiếp; mọi hàm ghi có `appendAudit()`.
5. Công thức: `calcDepositReconciliation` cho đúng 2 ví dụ AC-RS-004/005; dòng `DRAFT`/`DISPUTED` không
   vào Final; dòng `INCIDENT` không sửa được số; không sinh dòng từ `Rental.additionalChargesAmount`/`deliveryFee`.
6. Mọi chỗ phụ thuộc OQ §11 có `TODO(OQ: …)` trỏ đúng mã câu hỏi.
7. *(Chủ dự án tự test)*: `rt_020` → Mở quyết toán → Rental chuyển `SETTLEMENT` → chốt dòng → đối trừ cọc →
   gửi khách → khách xác nhận → `CONFIRMED` → tạo yêu cầu hoàn cọc → Đóng lượt → Rental `COMPLETED`; `rt_021`
   dòng sự cố khoá cho tới khi duyệt `inc_003` ở `/incidents/:id` rồi "Đồng bộ lại từ nguồn"; `rt_022` thử
   gửi khách khi còn dòng `DRAFT` → bị chặn có liệt kê lý do; `rt_023` đổi vai trò `ACCOUNTANT` → không thấy
   nút Duyệt, đổi `MANAGER` → Duyệt → `CONFIRMED`; thử Trả lại → về `DRAFT`, miễn giảm `REJECTED`; đổi
   `OPERATION_STAFF` → không thấy tab "Quyết toán" và menu "Quyết toán".
8. `docs/IMPLEMENTATION-PLAN.md` cập nhật, `ComingSoon` `/finance/settlement` đã thay.

## 15. Definition of Done — Round 2

1. Cổng 1 + điểm 3-4 của Round 1 vẫn đúng. 2. PSC không đổi `completedTotals` của Settlement gốc. 3. Đảo
quyết toán chỉ hiện với `SYSTEM_ADMIN`, cần lý do + xác nhận 2 bước, Rental về `SETTLEMENT`, lịch sử bản
cũ còn xem được. 4. "Điều chỉnh sau COMPLETED" ẩn với `ACCOUNTANT` (`TBD`). 5. Seed PSC đúng §10.

---

## 16. Phụ thuộc & thứ tự

Round 1 không phụ thuộc gì chưa xong (Phase 3 `DONE`). Round 2 phụ thuộc Round 1. Phase 4.2 (Payment) phụ
thuộc 4.1 **chỉ** ở phần thực thi `paymentRequests` + đồng bộ `paymentStatus`/`Paid To Date` (§0.3); 2 mốc
thanh toán đầu (`BOOKING`/`HANDOVER`) không phụ thuộc. Phase 4.3 đọc Settlement `COMPLETED`
(`completedTotals`) để sinh Revenue Line `ON_SETTLEMENT` (CR-2026-048).
