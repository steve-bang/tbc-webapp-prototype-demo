# Kế hoạch triển khai — Quyết toán lượt thuê (Rental Settlement)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (21/10/2026 — người dùng duyệt) · **Round 1
`DONE`** (21/10/2026 — đạt sau 2 vòng review `tech-lead`) · **Round 2 `DONE`** (21/10/2026 —
đạt ở vòng review `tech-lead` đầu tiên, không Blocker) — kế hoạch chi tiết Phase 4.1. Chia **2 round**: Round 1 = lõi Settlement Worksheet (mở → chốt → khách xác nhận →
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
| `POST_SETTLEMENT_CHARGE_SOURCES` *(Round 2)* | `TRAFFIC_FINE, VETC, INCIDENT, ADJUSTMENT, OTHER` | BRD §17 dòng 1 + `WebappQuanTri.md` §11.2 chỉ có tên tiếng Việt → **BA đề xuất mã** (chi tiết §10.3) |

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
| *(R2)* Tạo Post-Settlement Charge / đánh dấu tất toán | tạo: `COMPLETED`; tất toán: mọi trạng thái | `SETTLEMENT.CREATE` | `CREATE_POST_SETTLEMENT_CHARGE` / `CLOSE_POST_SETTLEMENT_CHARGE` |
| *(R2)* Điều chỉnh sau `COMPLETED` | `COMPLETED` | `SETTLEMENT.EDIT` (Accountant = `TBD`) | `ADJUST_SETTLEMENT` |
| *(R2)* Đảo quyết toán | `COMPLETED → DRAFT` | `SETTLEMENT.REVERSE` (chỉ `SYSTEM_ADMIN`) | `REVERSE_SETTLEMENT` (+ `REVERT_RENTAL_SETTLEMENT_REVERSED`) |

Chi tiết đầy đủ các dòng *(R2)* ở §10.10.

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
`REVERSE_SETTLEMENT` · (rentals) `REVERT_RENTAL_SETTLEMENT_REVERSED` — chi tiết §10.9.

Ánh xạ UC-RS-21: `OPEN/CONFIRM_LINE/UPDATE_LINE/ADD_MANUAL_LINE/APPLY_WAIVER/DEPOSIT_RECONCILE/
CUSTOMER_ACK/APPROVE/REJECT/CREATE_COLLECT_REQUEST/CREATE_REFUND_REQUEST/COMPLETE/POST_SETTLEMENT_CHARGE/
ADJUST/REVERSE/DISPUTE_RESOLVE`. BA đề xuất thêm (ghi comment): `SYNC_SETTLEMENT_SOURCES`,
`REMOVE_SETTLEMENT_MANUAL_LINE`, `DISPUTE_SETTLEMENT_LINE`, `SUBMIT_SETTLEMENT_FOR_CUSTOMER`,
`CLOSE_POST_SETTLEMENT_CHARGE`. Không làm: `PAYMENT_SYNC`, `EXPORT_PDF`, `CONFIG_CHANGE`, `RECALC_TOTAL`
(tính lại tức thời, không phải thao tác). **Lý do bắt buộc** (UC-RS-21 §25.3) ở: thêm MANUAL, miễn giảm,
trả lại, đóng có công nợ, Post-Settlement Charge, điều chỉnh, đảo, kết luận tranh chấp.

---

## 10. Round 2 — Post-Settlement Charge, Điều chỉnh sau `COMPLETED`, Đảo quyết toán + 4 nợ nhỏ Round 1

**Trạng thái:** `DONE` (21/10/2026 — đạt ở vòng review `tech-lead` đầu tiên, không Blocker; trước đó
`APPROVED` 21/10/2026 — người dùng duyệt, kế hoạch chi tiết lập cùng ngày bởi `tech-lead`). Người dùng duyệt luôn phần mở rộng so với nợ gốc Round 1: N1 áp cả `openSettlement`/
`resyncSettlementSources` (đọc lại + kiểm lại guard trong `fakeRequest`), N4 áp `assertRentalInSettlement` cho
cả `createPaymentRequest` + mọi hàm sửa worksheet `DRAFT` (§10.7). Không chờ BA xác nhận trước 5 điểm diễn giải
§10.2 — vẫn ghi lại để BA xem sau.
Thay thế hoàn toàn bản phác thảo §10 cũ (6 gạch đầu dòng) — khác biệt chính so với bản phác: bỏ cờ
`isAdjustment` thay bằng enum nguồn `POST_SETTLEMENT_CHARGE_SOURCES` (`ADJUSTMENT` ≡ UC-RS-15); thêm luật
chống tính trùng sự cố giữa Settlement và PSC (§10.4); gộp 4 nợ nhỏ Round 1 (§10.7).

**Nguồn nghiệp vụ Round 2 (bản chuẩn):** `RentalSettlement-BRD.md` §6 (cây entity — "Post-Settlement
Charges[] (tham chiếu)"), §16.3, **§17**, **§18.2**, §21 (RS-BR-12/13/14/24), §22 (3 dòng cuối), §23
(**AC-RS-011/012/013**), §25.4, §28 Q13-Q16. `RentalSettlement-UseCase.md` **§18 (UC-RS-14)**, **§19
(UC-RS-15)**, **§20 (UC-RS-16)**, §21 (UC-RS-17 — chỉ để biết nhánh 4 *không* làm), §25 (UC-RS-21),
§29 EX-08/EX-09. `WebappQuanTri.md` §11.2 (gạch "Post-Settlement Charge"), §11.3 ("Kỳ đã đóng thì bất
biến", "Đảo quyết toán"). Tham khảo ranh giới với Payment: `Payment-BRD.md` §5 (dòng "Yêu cầu thanh
toán"), §7 (`Source = POST_SETTLEMENT_CHARGE`), AC-PM-012 — **chỉ đọc để biết 4.2 sẽ nối vào đâu, không
build gì của Payment**.

### 10.1. Phạm vi

**Trong phạm vi Round 2**

| # | Hạng mục | Nguồn |
| --- | --- | --- |
| R2-1 | Enum `POST_SETTLEMENT_CHARGE_TYPES/STATUSES/SOURCES` + label map `vi.ts` + 5 audit action (§10.9) | BRD §17, UC-RS-21 |
| R2-2 | Entity `PostSettlementCharge` (storage riêng `postSettlementCharges`) + hàm thuần §10.4 | BRD §6/§17, UC-RS-14 |
| R2-3 | **Tạo Post-Settlement Charge** (phạt nguội / VETC về trễ / sự cố chốt sau / khác) từ Settlement `COMPLETED` + Rental `COMPLETED`; **không** mở lại Settlement, **không** đổi `completedTotals` | UC-RS-14, RS-BR-13, AC-RS-011, EX-08, RS-BR-24 |
| R2-4 | **Đánh dấu đã tất toán** PSC (`OPEN → CLOSED`) thủ công — thay cho Payment chưa có | BRD §17 bước cuối, UC-RS-14 bước 6, §0.3 |
| R2-5 | **Điều chỉnh sau `COMPLETED`** = tạo PSC `source = ADJUSTMENT` (tăng → `RECEIVABLE`, giảm → `REFUND`), lý do bắt buộc | UC-RS-15, BRD §18.2, AC-RS-012 |
| R2-6 | **Đảo quyết toán**: Settlement `COMPLETED → DRAFT`, Rental `COMPLETED → SETTLEMENT`, yêu cầu thu/hoàn → `CANCELLED`, lưu bản trước vào `reversals[]`, xác nhận 2 bước | UC-RS-16, BRD §18.2, RS-BR-14, AC-RS-013, EX-09 |
| R2-7 | Mở rộng `features/rentals` (vẫn ngoại lệ có kiểm soát lần thứ 3 — cùng Phase 4.1): transition `COMPLETED → SETTLEMENT` + `canRevertSettlementReversed` + `revertSettlementReversed` | §3.8 (đã dự trù), UC-RS-16 |
| R2-8 | UI: khối "Phát sinh sau quyết toán" + khối "Lịch sử đảo quyết toán" + nút "Đảo quyết toán" trong Worksheet; cột "Phát sinh sau QT" ở List | `WebappQuanTri.md` §11.2 |
| R2-9 | Seed 3 PSC (rt_024/025/026), `SEED_VERSION` 13 → 14 | §10.12 |
| R2-10 | **4 nợ nhỏ Round 1** (cùng file `finance/api.ts` + 2 dialog) | §10.7 |

**Quyết định về 4 nợ nhỏ: ĐƯA VÀO Round 2.** Lý do: cả 4 nằm trong `finance/api.ts` (+ `model.ts` và 2
dialog liên quan), là file Round 2 đằng nào cũng sửa nhiều; Round 2 thêm `reverseSettlement` cần đúng
pattern "đọc storage bên trong `fakeRequest`" (nợ 1) và đường "Rental còn `SETTLEMENT`" (nợ 4) — sửa
chung một lượt rẻ hơn và tránh để 2 pattern lẫn lộn trong cùng file. Nợ 3 (`resolveDispute` Miễn bỏ qua
ngưỡng) chạm đúng RS-BR-07/08 — một BR cốt lõi, không nên để trôi sang Phase 4.2.

**Ngoài phạm vi Round 2 — lý do**

| Hạng mục | Lý do / nơi xử lý |
| --- | --- |
| UC-RS-17 nhánh 4 "Tách khoản tranh chấp ra Post-Settlement" | Không nằm trong phạm vi Round 2 đã chốt; phụ thuộc **OQ RS §28 Q13** (giữ hay tách — "theo chính sách"). Giữ 3 nhánh của Round 1, `TODO(OQ)` tại dialog kết luận |
| UC-RS-14 A2 "đề xuất bỏ qua khoản nhỏ" + chặn theo thời hạn truy thu | OQ RS §28 Q14/Q15 — không có ngưỡng, không có thời hạn; `TODO(OQ)` |
| UC-RS-14 A1 "khách không đồng ý PSC" → quy trình tranh chấp riêng cho PSC | Không có state/entity tài liệu cho tranh chấp PSC. Chỉ hiển thị **suy diễn** "Tạm giữ" khi PSC gắn Incident đang `DISPUTED` (§10.4) — không thêm trạng thái |
| Huỷ / xoá PSC | Tài liệu không có hành động huỷ PSC; tạo nhầm → tạo PSC `ADJUSTMENT` ngược chiều (đúng tinh thần "không xoá" của RS/PM). Không build nút huỷ |
| Sinh Payment Request / Transaction `POST_SETTLEMENT_COLLECT`, đóng PSC tự động khi Payment `CONFIRMED` (AC-PM-012), bút toán đảo Payment khi đảo quyết toán | Phase 4.2 (`Payment`). `TODO(Phase 4.2)` |
| Ghi nhận doanh thu/chi phí điều chỉnh theo kỳ phát sinh của PSC; gỡ chốt doanh thu khi đảo quyết toán | Phase 4.3 (`RevenueCost`). `TODO(Phase 4.3)` |
| Màn/route riêng "Post-Settlement Charge" hay "Công nợ khách hàng" | `nav.tsx` không có mục PSC riêng; công nợ = `/finance/receivables` thuộc 4.2. Round 2 chỉ hiển thị PSC trong Worksheet + cột ở List |
| Giữ cọc chờ phạt nguội (EX-04 — cấn PSC vào phần cọc giữ lại) | OQ RS §28 Q3 — Round 1 đã hoàn toàn bộ cọc dư; không đổi |
| Tạo PSC từ màn Incident / Vehicle Return ("kích hoạt từ" UC-RS-14 bước 1) | Phải sửa `incidents/*` / `handover-return/*` — **cấm** (§0.2). Tạo từ Worksheet, chọn Incident trong danh sách |
| Notification "phát sinh sau" (BRD §20) | Phase 6 (`NT`) |
| Đóng Incident liên kết khi PSC `CLOSED` | Ghi vào `incidents/*` — cấm (§0.2), giống §1.2 |

### 10.2. Điểm tài liệu chưa nhất quán / diễn giải — ghi lại cho BA, không tự sửa tài liệu

1. **Trùng mã `RS-BR-21`**: BRD §21 `RS-BR-21` = "`Paid To Date` gồm Prepayment 30% + 70%…"; UseCase §26
   `RS-BR-21` = "Post-Settlement Charge tính vào doanh thu/chi phí điều chỉnh theo kỳ phát sinh". Cùng mã,
   hai nội dung. Code Round 2 **không trích `RS-BR-21` cho PSC** — trích `RentalSettlement-BRD.md §17 BR`
   thay thế. Báo BA.
2. **Đảo quyết toán: dòng/miễn giảm đã chốt xử lý thế nào khi quay `DRAFT`?** UC-RS-16 chỉ nói "Settlement
   quay `DRAFT`… Accountant thực hiện lại quy trình". Diễn giải: **giữ nguyên `lines`/`waivers`** (đã nằm
   trong snapshot `reversals[]`), chỉ xoá kết quả quy trình (`customerAck`, `depositReconciliation`,
   `approval`, `completedTotals`, `completedWithDebt`, `completedByName/At`, `paymentStatus`). Accountant
   chỉnh lại trên nền cũ (chốt lại dòng, "Đồng bộ lại từ nguồn", MANUAL, miễn giảm) rồi đi lại từ đầu —
   đủ đáp ứng "làm lại", không bắt nhập lại từ số 0.
3. **PSC đã có khi đảo quyết toán**: tài liệu không nói. Diễn giải: **giữ nguyên** (UC-RS-14 §18.6 "theo
   dõi độc lập với Settlement gốc"); để tránh tính trùng khi làm lại, áp luật chống trùng sự cố §10.4 +
   banner cảnh báo trong Worksheet.
4. **Quyền "Đánh dấu đã tất toán"**: BRD §22 không có dòng riêng (tài liệu để Payment đóng PSC). Diễn giải:
   dùng chung `SETTLEMENT.CREATE` (cùng nhóm người tạo PSC) — **không thêm entry `permissions.ts`**; comment
   `BA đề xuất — tạm thay Payment (Phase 4.2)`.
5. **Chiều thu/hoàn theo nguồn**: BRD §17 không quy định nguồn nào được `REFUND`. Diễn giải (BA đề xuất):
   `TRAFFIC_FINE`/`VETC`/`INCIDENT` luôn `RECEIVABLE`; `OTHER` (khiếu nại hoàn tiền, bảo hiểm điều chỉnh) và
   `ADJUSTMENT` chọn được cả hai chiều.

### 10.3. Data model

**Enum mới** (`shared/domain/enums.ts`, đặt **ngay sau** `SETTLEMENT_REQUEST_TYPES` — khối enum mới, không
chèn vào giữa mảng nào; mỗi khối 1 dòng comment nguồn):

```ts
/** `RentalSettlement-BRD.md` §17 — loại Post-Settlement Charge. */
POST_SETTLEMENT_CHARGE_TYPES    = ['RECEIVABLE', 'REFUND']
/** BRD §17 (`CLOSED`); `OPEN` BA đề xuất — `docs/RENTAL-SETTLEMENT-PLAN.md` §10.3. */
POST_SETTLEMENT_CHARGE_STATUSES = ['OPEN', 'CLOSED']
/** BRD §17 dòng 1 + WebappQuanTri.md §11.2 — BA đề xuất mã (tài liệu chỉ có tên tiếng Việt). ADJUSTMENT = UC-RS-15. */
POST_SETTLEMENT_CHARGE_SOURCES  = ['TRAFFIC_FINE', 'VETC', 'INCIDENT', 'ADJUSTMENT', 'OTHER']
```

Label map trong `vi.ts`: `POST_SETTLEMENT_CHARGE_TYPE_LABELS` ("Phải thu thêm" / "Phải hoàn"),
`POST_SETTLEMENT_CHARGE_STATUS_LABELS` ("Đang mở" / "Đã tất toán"), `POST_SETTLEMENT_CHARGE_SOURCE_LABELS`
("Phạt nguội" / "VETC về trễ" / "Sự cố chốt sau" / "Điều chỉnh sau quyết toán" / "Khác").

**Entity mới — `features/finance/model.ts`, storage key `postSettlementCharges`** (hằng số
`POST_SETTLEMENT_CHARGES_STORAGE_KEY` ở `finance/api.ts`, cạnh `SETTLEMENTS_STORAGE_KEY`):

```ts
/** RentalSettlement-BRD.md §17, UC-RS-14/15 — entity riêng, KHÔNG nhúng vào Settlement (RS-BR-13, BRD §25.4). */
interface PostSettlementCharge {
  id: string                         // generateId('psc')
  settlementId: string               // Settlement kỳ gốc (tham chiếu — BRD §6)
  rentalId: string; customerId: string; vehicleId: string   // copy từ Settlement — List/4.2/4.3 lọc nhanh
  source: PostSettlementChargeSource
  type: PostSettlementChargeType     // RECEIVABLE | REFUND
  amount: number                     // số nguyên dương (đồng), chiều do `type`
  incidentId?: string                // bắt buộc khi source = INCIDENT
  reason: string                     // bắt buộc (UC-RS-21 §25.3)
  evidenceNote?: string              // "chứng từ" UC-RS-14 bước 2 — demo chỉ ghi chú text (số biên bản phạt, mã GD VETC…)
  status: PostSettlementChargeStatus // OPEN | CLOSED
  createdByName: string; createdByRole: Role; createdAt: string
  closedByName?: string; closedAt?: string; closeNote?: string
}
```

**Mở rộng entity hiện có (chỉ thêm field optional — dữ liệu Round 1 vẫn đọc được):**

```ts
/** UC-RS-16 — "giữ toàn bộ lịch sử phiên bản trước" (RS-BR-14). */
interface SettlementReversal {
  id: string                          // generateId('rev')
  reason: string
  reversedByName: string; reversedByRole: Role; reversedAt: string
  snapshot: Omit<Settlement, 'reversals'>   // bản Settlement COMPLETED ngay trước khi đảo (đủ lines/waivers/completedTotals/paymentRequests)
  cancelledPaymentRequestIds: string[]
}
Settlement            += reversals?: SettlementReversal[]        // đọc bằng `?? []`
SettlementPaymentRequest += cancelledByName?: string; cancelledAt?: string; cancelReason?: string
```

Không đổi `SettlementStatus` (đảo = `COMPLETED → DRAFT`, `SETTLEMENT_TRANSITIONS.COMPLETED` đã có `['DRAFT']`
từ Round 1). Không có field PSC nào trong `Settlement` — quan hệ Settlement → PSC tra theo `settlementId`.

### 10.4. Hàm thuần (`features/finance/model.ts`)

- `canCreatePostSettlementCharge(settlement, rental): boolean` = `settlement.status === 'COMPLETED' &&
  rental.status === 'COMPLETED'` (UC-RS-14 §18.3, RS-BR-13).
- `canAdjustSettlement(settlement, rental)` = cùng điều kiện (UC-RS-15 §19.3).
- `canReverseSettlement(settlement, rental)` = cùng điều kiện (UC-RS-16; AC-RS-013 "Settlement `COMPLETED`").
- `fixedPscType(source): PostSettlementChargeType | undefined` — `TRAFFIC_FINE`/`VETC`/`INCIDENT` →
  `'RECEIVABLE'`; `ADJUSTMENT`/`OTHER` → `undefined` (người dùng chọn) — §10.2 điểm 5.
- `getIncidentPscBlocker(incident, settlement, existingPscs): PscBlockerCode | undefined` — **luật chống
  tính trùng sự cố** (RS-BR-13 + "ba con số khác nhau"):
  - Incident đã có dòng trong `settlement.lines` (`sourceRef.incidentId` khớp) → `ALREADY_IN_SETTLEMENT`
    (đã thu ở kỳ gốc; sai số → dùng Điều chỉnh).
  - Đã có PSC (mọi trạng thái) cùng `incidentId` → `ALREADY_HAS_PSC`.
  - `liability ∈ {COMPANY, THIRD_PARTY, INSURANCE}` → `NOT_CUSTOMER_LIABILITY` (cùng luật §3.1).
  - `status ∈ {CANCELLED, CLOSED_NO_ACTION, WRITTEN_OFF}` → `INCIDENT_VOID`.
  - `status ∈ {OPEN, ASSESSING, WAITING_APPROVAL}` → `CUSTOMER_CHARGE_NOT_FINAL` (EX-01 tương tự: chưa chốt
    Customer Charge). `liability = UNDETERMINED` → cũng `CUSTOMER_CHARGE_NOT_FINAL`.
  - Cho phép: `APPROVED`/`IN_REPAIR`/`REPAIRED`/`CLOSED` **và** `DISPUTED` (để ghi nhận khoản, hiển thị
    "Tạm giữ" — UC-RS-14 A1).
- `pscAmountForIncident(incident)` = `incident.customerCharge ?? incident.estimatedCost` — **khoá số**, không
  cho sửa (mirror dòng `INCIDENT` RS-BR-04/AC-RS-003). `// TODO(OQ: master BRD §51 Q54 / RS §28 Q21 — công
  thức sự cố nặng khi Liability ≠ khách 100%; PSC chỉ đọc Customer Charge từ DI)` + trích `RS-BR-24`.
- `isPscOnHold(psc, incidents)` = `psc.status === 'OPEN' && psc.incidentId` trỏ Incident đang `DISPUTED` →
  hiển thị badge "Tạm giữ — sự cố đang tranh chấp (UC-RS-14 A1)" + **chặn "Đánh dấu đã tất toán"**. Suy
  diễn khi render, **không lưu**, không phải enum.
- `summarizePscs(pscs)` → `{ openReceivable, openRefund, openCount, closedCount }` (Σ `amount` theo `type`
  của PSC `OPEN`) — cho khối tổng PSC + cột List. **Không bao giờ cộng vào `completedTotals`/Final Amount**
  (BRD §25.4, `CLAUDE.md` §4 "ba con số").
- `getLineDiscountedAmount(lineId, waivers)` (nợ 2) = Σ `amount` các waiver `PARTIAL_DISCOUNT` cùng `lineId`
  có `status ∈ {APPROVED, PENDING_APPROVAL}`. Dùng ở API + dialog miễn giảm.
- `buildReversalReset(settlement, actor, reason, now)` → `{ after: Settlement, reversal: SettlementReversal }`
  — gom logic reset §10.6 thành hàm thuần (dễ review, tách khỏi `api.ts`).

### 10.5. Mở rộng `features/rentals` (đã dự trù ở §3.8 — chỉ thêm, không sửa cái cũ)

- `model.ts` — `ROUND1_TRANSITIONS`: **thêm 1 dòng** `COMPLETED: ['SETTLEMENT'], // đảo quyết toán —
  RENTAL-SETTLEMENT-PLAN.md §10.5 (UC-RS-16)`. Đã rà: không guard hiện có nào `includes()` giá trị
  `SETTLEMENT`, nên dòng mới không làm guard cũ trả `true` sai.
- `model.ts` — `canRevertSettlementReversed(rental)` = **`rental.status === 'COMPLETED'`** `&&
  ROUND1_TRANSITIONS.COMPLETED?.includes('SETTLEMENT')`. **Bẫy cần tránh:** không viết kiểu
  `ROUND1_TRANSITIONS[rental.status]?.includes('SETTLEMENT')` — `RETURNED` cũng map tới `SETTLEMENT` nên sẽ
  trả `true` sai cho Rental `RETURNED` (cùng lý do `canOpenSettlement` không dùng map).
- `api.ts` — `revertSettlementReversed(id, actor)`: mirror y hệt `markRentalCompleted` (bọc `fakeRequest`,
  đọc trong callback, guard, ghi, `appendAudit` action `REVERT_RENTAL_SETTLEMENT_REVERSED`, `before/after`
  status). JSDoc ghi ngoại lệ kiến trúc giống 2 hàm Round 1.
- `index.ts` — thêm `canRevertSettlementReversed` vào dòng export model và `revertSettlementReversed` vào
  dòng export api của **khối comment Phase 4.1 đã có** (không mở khối comment mới).
- **Không** đụng `rentals/hooks.ts`, `rentals/seed.ts`, màn hình rentals.

### 10.6. API mới (`features/finance/api.ts`)

**Quy tắc chung cho mọi hàm mới (và là chuẩn khi sửa nợ 1):** toàn bộ đọc storage + guard + ghi + audit nằm
**bên trong callback `fakeRequest()`**; chỉ lời gọi chéo feature bất đồng bộ (`revertSettlementReversed`) nằm
ngoài, **sau** khi ghi thành công.

| Hàm | Guard (ném lỗi tiếng Việt, trích mã) | Ghi | Audit (`entity: 'Settlement'`, `entityId: settlementId`) |
| --- | --- | --- | --- |
| `listPostSettlementCharges(filter?: { settlementId?; rentalId?; status? })` | — | — | — |
| `createPostSettlementCharge(settlementId, input, actor)` — input `{ source, type?, amount?, incidentId?, reason, evidenceNote? }` | `canCreatePostSettlementCharge` (đọc Rental qua `readRentalOrThrow`); `source !== 'ADJUSTMENT'` (đi đường `adjustSettlement`); `reason.trim()` rỗng → lỗi; `INCIDENT`: `incidentId` bắt buộc, đọc Incident qua `listIncidents` **trước** `fakeRequest` (như `loadSources`) rồi `getIncidentPscBlocker` **trong** callback trên bản đọc lại PSC; `amount` = `pscAmountForIncident` (bỏ qua input); nguồn khác: `amount` nguyên > 0; `type` = `fixedPscType(source) ?? input.type` | thêm PSC `OPEN` vào `postSettlementCharges`; **không ghi `settlements`** | `CREATE_POST_SETTLEMENT_CHARGE`, `summary` gồm nguồn + số tiền + lý do, `after: psc` |
| `adjustSettlement(settlementId, { direction: 'INCREASE' \| 'DECREASE', amount, reason, evidenceNote? }, actor)` | `canAdjustSettlement`; lý do bắt buộc; `amount` nguyên > 0 | PSC `source = 'ADJUSTMENT'`, `type = INCREASE ? 'RECEIVABLE' : 'REFUND'`, `OPEN`; **không ghi `settlements`** (UC-RS-15 bước 4) | `ADJUST_SETTLEMENT`, `after: psc` |
| `closePostSettlementCharge(pscId, closeNote?, actor)` | PSC `OPEN`; không `isPscOnHold` (đọc Incident trước callback) | `status = 'CLOSED'`, `closedByName/At`, `closeNote` | `CLOSE_POST_SETTLEMENT_CHARGE`, `before/after: { status }` · `// TODO(Phase 4.2): đóng tự động khi Payment POST_SETTLEMENT_COLLECT/REFUND CONFIRMED (AC-PM-012)` |
| `reverseSettlement(settlementId, { reason, confirmRentalId }, actor)` | lý do bắt buộc; `confirmRentalId === settlement.rentalId` (bước xác nhận 2 — kiểm cả ở API); `canReverseSettlement` (Settlement + Rental cùng `COMPLETED`) | `buildReversalReset`: đẩy snapshot vào `reversals`; `status = 'DRAFT'`; xoá `customerAck`/`depositReconciliation`/`approval`/`completedTotals`/`completedWithDebt`/`completedByName`/`completedAt`/`paymentStatus`; mọi `paymentRequests` `REQUESTED` → `CANCELLED` + `cancelledByName/At/Reason`; `lines`/`waivers` giữ nguyên (§10.2 điểm 2). **Sau** khi ghi xong (ngoài callback): `await revertSettlementReversed(rentalId, actor)` | `REVERSE_SETTLEMENT`, `summary` gồm lý do, `before: { status, completedTotals }`, `after: { status: 'DRAFT', cancelledPaymentRequestIds }` · `// TODO(Phase 4.2): bút toán đảo giao dịch đã CONFIRMED` · `// TODO(Phase 4.3): gỡ chốt doanh thu kỳ gốc (UC-RS-16 bước 2)` |

**Sửa hàm Round 1 do Round 2 kéo theo (bắt buộc):**

- `resyncSettlementSources`: trước khi gọi `buildSourceLines`, **lọc bỏ Incident đã có PSC** (mọi trạng
  thái, cùng `rentalId`) khỏi danh sách `incidents` — comment `// RS-BR-13 — sự cố đã đi qua PSC không đưa lại
  vào Settlement khi làm lại sau đảo quyết toán (RENTAL-SETTLEMENT-PLAN.md §10.2 điểm 3)`. Không đổi chữ ký
  `buildSourceLines`. Ví dụ demo: đảo quyết toán `rt_026` rồi "Đồng bộ lại" → **không** sinh dòng `inc_010`
  (đã có PSC 900k).
- `getCompletionBlockers`/`createPaymentRequest`: đã chỉ xét `status === 'REQUESTED'` → yêu cầu `CANCELLED`
  sau đảo không chặn tạo lại. **Không cần sửa**, chỉ xác nhận khi review.

### 10.7. Bốn nợ nhỏ Round 1 — đưa vào Round 2 (§10.1)

| # | Nợ (review vòng 2 Round 1) | Sửa ở đâu | Cách sửa — tiêu chí review |
| --- | --- | --- | --- |
| N1 | `completeSettlement` đọc `readAll()`/Rental **ngoài** `fakeRequest` → dùng snapshot cũ sau độ trễ | `finance/api.ts` | Chuyển `readAll`/`findOrThrow`/`getCompletionBlockers`/`readRentalOrThrow`/`canCompleteRental` **vào trong** callback; `markRentalCompleted` vẫn gọi sau. **Cùng loại lỗi, sửa luôn:** `openSettlement` và `resyncSettlementSources` buộc phải `await loadSources()` trước, nhưng phải **đọc lại `readAll()` + kiểm lại guard** (RS-BR-01 trùng; `status === 'DRAFT'`) bên trong callback cuối, không dùng mảng `existing` đọc từ trước |
| N2 | `applyWaiver` `PARTIAL_DISCOUNT` chỉ chặn từng lần — cộng dồn nhiều lần vượt `actualAmount` | `finance/model.ts` (`getLineDiscountedAmount`), `finance/api.ts`, `SettlementWaiverDialog.tsx` | API: `getLineDiscountedAmount(lineId) + amount ≤ actualAmount`, lỗi "Tổng giảm một phần vượt số thực tế của dòng (còn được giảm tối đa X)". Thêm chặn ngược: `WAIVE_LINE` trên dòng đã có `PARTIAL_DISCOUNT` hiệu lực → lỗi (vì `calcSettlementTotals` cộng cả dòng `WAIVED` lẫn waiver giảm một phần → trừ trùng). Dialog: hiện "Còn được giảm tối đa: X" khi chọn `PARTIAL_DISCOUNT`, validate trước khi gửi |
| N3 | `resolveDispute` nhánh `WAIVE` chuyển dòng `WAIVED` **không qua ngưỡng** (RS-BR-07/08) | `finance/api.ts`, `SettlementResolveDisputeDialog.tsx` | Nhánh `WAIVE`: tính `amount = input.actualAmount ?? line.actualAmount ?? line.estimatedAmount ?? 0`, đặt `line.actualAmount = amount`, `status = 'WAIVED'`, **đồng thời tạo `SettlementWaiver` `WAIVE_LINE`** (`reason` = lý do kết luận, `status` theo `waiverNeedsApproval(amount)`, `decidedBy*` như `applyWaiver`). Audit `RESOLVE_SETTLEMENT_DISPUTE` ghi cả waiver trong `after`. Kết quả: > ngưỡng → sau khi khách xác nhận Settlement vào `WAITING_APPROVAL` (logic sẵn có); bị Trả lại → `rejectSettlement` sẵn có đưa dòng về `CONFIRMED`. Dialog: chọn "Miễn" + số > ngưỡng → hiện ghi chú "Sẽ cần duyệt (vượt ngưỡng)" giống `SettlementWaiverDialog` |
| N4 | `recordCustomerAck`/`approveSettlement`/`rejectSettlement` chỉ chặn Return-huỷ ở UI | `finance/api.ts` | Thêm helper nội bộ `assertRentalInSettlement(rentalId)` (đọc `readRentalOrThrow`, ném cùng thông điệp với `submitForCustomer`) và gọi **trong callback** của: `recordCustomerAck`, `approveSettlement`, `rejectSettlement` (bắt buộc — đúng nợ), `createPaymentRequest` + các hàm sửa worksheet `DRAFT` (`confirmLine`, `addManualLine`, `removeManualLine`, `applyWaiver`, `disputeLine`, `resolveDispute`, `reconcileDeposit`) — mỗi chỗ 1 dòng. `submitForCustomer` đổi sang dùng helper. **Không** áp cho hàm PSC/đảo (dùng guard Rental `COMPLETED` riêng) |

### 10.8. Hooks & barrel

- `hooks.ts`: `usePostSettlementCharges(filter?)` — query key `['postSettlementCharges', filter ?? {}]`;
  mutation `useCreatePostSettlementCharge`, `useAdjustSettlement`, `useClosePostSettlementCharge` →
  invalidate `['postSettlementCharges']`; `useReverseSettlement` → invalidate `['settlements']`,
  `['settlements','byRental',rentalId]`, `['postSettlementCharges']` **và** Rental (dùng nhánh
  `invalidateRental = true` của `invalidateSettlements` sẵn có).
- `index.ts`: thêm `type PostSettlementCharge` + `usePostSettlementCharges` (để 4.2 nối vào sau) — chỉ thêm dòng.

### 10.9. Audit action — nối **cuối** `AUDIT_ACTIONS`, khối comment mới `// Rental Settlement (RS) — Round 2, RENTAL-SETTLEMENT-PLAN.md §10.9 (UC-RS-21)`

`CREATE_POST_SETTLEMENT_CHARGE` (UC-RS-21 `POST_SETTLEMENT_CHARGE`) · `CLOSE_POST_SETTLEMENT_CHARGE` (BA đề
xuất) · `ADJUST_SETTLEMENT` (`ADJUST`) · `REVERSE_SETTLEMENT` (`REVERSE`) · `REVERT_RENTAL_SETTLEMENT_REVERSED`
(rentals). **Lý do bắt buộc** ở cả 4 action RS (UC-RS-21 §25.3) — ghi vào `summary`. Mọi audit PSC dùng
`entity: 'Settlement'` + `entityId: settlementId` (không phải id PSC) để khối "Lịch sử thao tác" của
Worksheet (lọc theo `Settlement` + id, §5.2 mục 8) hiện luôn — đúng UC-RS-21 "Settlement ID" là khoá audit;
id PSC nằm trong `after`.

### 10.10. UI

**Worksheet (`SettlementWorksheet.tsx`) — tách component mới, không nhồi thêm vào file 466 dòng:**

1. **`PostSettlementChargeSection.tsx`** — hiện khi Settlement `COMPLETED` **hoặc** đã có ≥ 1 PSC (sau đảo
   quyết toán vẫn phải thấy). Gồm:
   - Câu dẫn cố định: "Khoản phát sinh sau khi đóng lượt — không làm thay đổi số liệu quyết toán kỳ gốc
     (RS-BR-13)".
   - Tổng: "Đang mở — phải thu thêm: X · phải hoàn: Y" (`summarizePscs`), **tách hẳn** khối Tổng hợp kỳ gốc.
   - Bảng (≥ md) / card (< md): Nguồn (badge) · Loại (Phải thu/Phải hoàn, màu `text-status-*`) · Số tiền ·
     Sự cố (link `/incidents/:id` nếu có) · Lý do + chứng từ · Trạng thái (+ badge suy diễn "Tạm giữ") ·
     Người tạo/ngày · Thao tác ("Đánh dấu đã tất toán" — ẩn nếu thiếu `SETTLEMENT.CREATE`, disable kèm
     tooltip/ghi chú khi Tạm giữ).
   - Nút "Tạo khoản phát sinh" (`SETTLEMENT.CREATE` + `canCreatePostSettlementCharge`) và "Điều chỉnh"
     (`SETTLEMENT.EDIT` + `canAdjustSettlement` — `ACCOUNTANT` = `TBD` → **ẩn**).
   - Ghi chú: "Thu/hoàn thực tế ghi nhận ở Sổ giao dịch (Phase 4.2)".
2. **`SettlementReversalHistory.tsx`** — hiện khi `reversals.length > 0`: mỗi lần đảo 1 dòng (thời điểm,
   người, lý do, Final Amount + Balance Due của bản cũ từ `snapshot.completedTotals`, số yêu cầu thanh toán
   bị huỷ) + nút "Xem bản trước" mở dialog chỉ-đọc liệt kê dòng khoản mục (khoản mục, nguồn, thực tế, trạng
   thái) + miễn giảm + tổng của snapshot. Đáp ứng DoD "lịch sử bản cũ còn xem được".
3. **Banner mới** (Settlement `DRAFT` và có `reversals`): "Quyết toán đã bị đảo lúc … — lý do: …. Làm lại
   quy trình; khoản đã chuyển sang phát sinh sau quyết toán (N khoản) không đưa lại vào bảng."
4. **Thanh hành động** khi `COMPLETED`: thêm nút "Đảo quyết toán" (variant destructive) — chỉ khi
   `can('SETTLEMENT','REVERSE')` + `canReverseSettlement`. Trạng thái `COMPLETED` vẫn chỉ-đọc toàn bộ phần
   kỳ gốc.
5. Khối "Yêu cầu thanh toán": yêu cầu `CANCELLED` hiển thị gạch/mờ + nhãn "Đã huỷ do đảo quyết toán".

**Dialog mới (`features/finance/components/`, `react-hook-form` + `zod` schema trong `model.ts`):**

- `PostSettlementChargeDialog.tsx` — chọn Nguồn (không có `ADJUSTMENT`); `INCIDENT` → chọn Incident của
  lượt thuê, mục bị chặn hiện lý do (`getIncidentPscBlocker` → khoá i18n), số tiền **chỉ-đọc** = Customer
  Charge; nguồn khác → nhập số; Loại khoá theo `fixedPscType` hoặc cho chọn (`OTHER`); Lý do bắt buộc;
  Chứng từ (tuỳ chọn). Ghi chú `TODO(OQ: RS §28 Q14/Q15)` trong JSDoc component.
- `SettlementAdjustmentDialog.tsx` — Tăng (thu thêm) / Giảm (hoàn); số tiền; lý do bắt buộc; chứng từ; câu
  cảnh báo "Sai sót toàn bộ → dùng Đảo quyết toán (chỉ Quản trị hệ thống)" (UC-RS-15 A1).
- `PostSettlementChargeCloseDialog.tsx` — xác nhận + ghi chú tuỳ chọn ("đã thu/hoàn qua …").
- `SettlementReverseDialog.tsx` — **2 bước** (UC-RS-16 "xác nhận nhiều bước"): bước 1 = cảnh báo hệ quả
  (Rental về Đang quyết toán, yêu cầu thu/hoàn bị huỷ, PSC giữ nguyên, lịch sử giữ) + lý do bắt buộc →
  "Tiếp tục"; bước 2 = gõ lại đúng mã lượt thuê (so khớp tuyệt đối) → nút "Đảo quyết toán" mới bật.
- Dialog xem snapshot (mục 2 ở trên).

**`SettlementListScreen`** — thêm cột "Phát sinh sau QT": `N đang mở` + net (thu − hoàn) màu trạng thái, "—"
khi không có. Dùng `usePostSettlementCharges()` một lần, gom theo `settlementId` bằng `useMemo`. Card
mobile thêm 1 dòng tương ứng. Không thêm bộ lọc mới.

**Hành động × quyền × trạng thái (Round 2):**

| Hành động | Điều kiện | Quyền | Audit |
| --- | --- | --- | --- |
| Tạo khoản phát sinh | Settlement + Rental `COMPLETED` | `SETTLEMENT.CREATE` | `CREATE_POST_SETTLEMENT_CHARGE` |
| Điều chỉnh sau `COMPLETED` | Settlement + Rental `COMPLETED` | `SETTLEMENT.EDIT` (`ACCOUNTANT` `TBD` → ẩn) | `ADJUST_SETTLEMENT` |
| Đánh dấu đã tất toán | PSC `OPEN`, không Tạm giữ (mọi trạng thái Settlement) | `SETTLEMENT.CREATE` (§10.2 điểm 4) | `CLOSE_POST_SETTLEMENT_CHARGE` |
| Đảo quyết toán | Settlement + Rental `COMPLETED` | `SETTLEMENT.REVERSE` (chỉ `SYSTEM_ADMIN`; `SALES` ✗ — CR-2026-035) | `REVERSE_SETTLEMENT` + `REVERT_RENTAL_SETTLEMENT_REVERSED` |

Nút thiếu quyền → **ẩn**. Không `if (role === …)`. **Không sửa `permissions.ts`** — 3 entry
`CREATE`/`EDIT`/`REVERSE` đã có từ Round 1 (§8).

**Responsive:** như §6 — bảng PSC `overflow-x-auto` ≥ md / card < md; dialog đảo 2 bước không vỡ ở ~375px.

### 10.11. Ranh giới kiến trúc Round 2

| Khu vực | Được phép | Không được phép |
| --- | --- | --- |
| `features/finance/*` | Sửa/tạo theo §10.3-§10.10, §10.7 | Gọi `localStorage` trực tiếp; deep-import feature khác |
| `features/rentals/model.ts` · `api.ts` · `index.ts` | Chỉ đúng §10.5 (1 dòng transition + 1 guard + 1 hàm api + export) | Sửa transition/guard/hàm hiện có; `hooks.ts`, `seed.ts`, screens |
| `features/handover-return/*`, `features/incidents/*` | Đọc qua barrel đã có (`listIncidents`, `useIncidents`) | **Không đụng một ký tự** — kể cả `index.ts` (Round 2 không cần re-export mới) |
| `shared/domain/enums.ts` | Thêm 3 enum §10.3 sau `SETTLEMENT_REQUEST_TYPES`; nối 5 audit action **cuối** `AUDIT_ACTIONS` | Sửa/chèn enum khác |
| `shared/domain/permissions.ts` | — | **Không sửa** |
| `shared/i18n/vi.ts` | Thêm khoá `vi.finance.*` + 3 label map | Sửa khoá hiện có của feature khác |
| `shared/fixtures/seedAll.ts` | `SEED_VERSION` 13 → 14 | — |
| `shared/fixtures/registerSeeds.ts`, `app/routes.tsx`, `app/paths.ts`, `shared/layout/nav.tsx` | — | **Không sửa** (PSC seed nằm trong `finance/seed.ts` sẵn có, không route mới) |

### 10.12. Seed (`features/finance/seed.ts` — cùng `seedFinance()`, ghi thêm key `postSettlementCharges`)

Thời điểm tạo PSC tính **động** = `completedAt` của Settlement seed tương ứng + vài ngày, kẹp `≤ now`.
Người tạo dùng tên nhân viên kế toán đã có trong seed (như Settlement Round 1).

| Rental | PSC | Minh hoạ |
| --- | --- | --- |
| `rt_024` (`CASH_20M`, cọc đã đề nghị hoàn) | `TRAFFIC_FINE` · `RECEIVABLE` · **700.000** · `OPEN` · lý do "Phạt nguội vi phạm tốc độ trong kỳ thuê, biên bản về sau" · `evidenceNote` số biên bản giả lập | AC-RS-011, EX-08 (số tiền mirror AC-PM-012); `completedTotals` của rt_024 không đổi |
| `rt_025` | `ADJUSTMENT` · `REFUND` · **200.000** · `CLOSED` (có `closedByName/At`, `closeNote`) · lý do "Tính thừa phí giao nhận, phát hiện sau khi đóng lượt" | AC-RS-012 |
| `rt_026` (`MOTORBIKE`) | `INCIDENT` · `RECEIVABLE` · **900.000** (= `inc_010.customerCharge`) · `incidentId: 'inc_010'` · `OPEN` → hiển thị **Tạm giữ** vì `inc_010` `DISPUTED` | RS-BR-24, UC-RS-14 A1; khoá "Đánh dấu đã tất toán" |

Không seed Settlement đã đảo (SYSTEM_ADMIN tự demo trên rt_024/025/026). Không seed audit. Dựng PSC bằng
literal + `generateId('psc')`; số tiền `INCIDENT` lấy từ `pscAmountForIncident(inc_010)` (không gõ tay).

### 10.13. `TODO` bắt buộc trong code Round 2

- `TODO(OQ: RentalSettlement-BRD.md §28 Q14/Q15 — thời hạn truy thu + ngưỡng bỏ qua khoản nhỏ; demo: không
  giới hạn thời hạn, không đề xuất bỏ qua (UC-RS-14 A2 chưa build))` — tại `createPostSettlementCharge`.
- `TODO(OQ: RentalSettlement-BRD.md §28 Q16 — ai được điều chỉnh sau COMPLETED; Accountant = TBD)` — tại
  `adjustSettlement` (permissions đã có `TBD`).
- `TODO(OQ: RentalSettlement-BRD.md §28 Q13 — nhánh 4 "tách khoản tranh chấp ra Post-Settlement" chưa
  build)` — giữ/cập nhật tại `resolveDispute` + `SettlementResolveDisputeDialog`.
- `TODO(OQ: master BRD §51 Q54 / RS §28 Q21)` — tại `pscAmountForIncident`.
- `TODO(Phase 4.2)` — sinh Payment Request `Source = POST_SETTLEMENT_CHARGE`; đóng PSC theo Payment
  (AC-PM-012); bút toán đảo khi đảo quyết toán.
- `TODO(Phase 4.3)` — PSC → doanh thu/chi phí điều chỉnh theo kỳ phát sinh (BRD §17 BR); gỡ chốt doanh thu khi
  đảo (UC-RS-16).

### 10.14. Danh sách file `dev` đọc trước khi code Round 2 (đọc đúng danh sách, không scan rộng)

**Tài liệu nghiệp vụ**
- `../thien-bao-car-docs/modules/RentalSettlement-BRD.md` §6 (dòng ~145-185), §16.3-§18 (dòng ~464-520),
  §21 (RS-BR-12/13/14/24), §22, §23 AC-RS-011/012/013 (dòng ~687-708), §25.4, §28 Q13-Q16.
- `../thien-bao-car-docs/modules/RentalSettlement-UseCase.md` §18-§20 (dòng ~626-733), §21 (dòng ~736-767),
  §25.3 (dòng ~868-884), §29 EX-08/EX-09 (dòng ~1088-1110).
- `../thien-bao-car-docs/WebappQuanTri.md` §11.2-§11.3 (dòng ~652-685).
- Kế hoạch này: §0.2, §0.3, §2.1, §3.3, §3.6, §3.7, §3.8, §5.2, §9.4 và **toàn bộ §10**.

**Code tham chiếu**
- `src/features/finance/model.ts` (toàn bộ — Round 2 mở rộng chính file này), `src/features/finance/api.ts`
  (toàn bộ — 4 nợ nhỏ + hàm mới), `src/features/finance/hooks.ts`, `src/features/finance/index.ts`,
  `src/features/finance/seed.ts` (khối rt_024/025/026, dòng ~150-332).
- `src/features/finance/components/SettlementWorksheet.tsx`, `SettlementWaiverDialog.tsx`,
  `SettlementResolveDisputeDialog.tsx`, `SettlementCompleteDialog.tsx` (mẫu dialog xác nhận),
  `SettlementApprovalDialog.tsx` (mẫu lý do bắt buộc), `src/features/finance/screens/SettlementListScreen.tsx`.
- `src/features/rentals/model.ts` dòng ~205-300 (`ROUND1_TRANSITIONS`, `canOpenSettlement`,
  `canCompleteRental`), `src/features/rentals/api.ts` dòng ~335-400 (`markSettlementOpened`,
  `markRentalCompleted` — mẫu cho `revertSettlementReversed`), `src/features/rentals/index.ts`.
- `src/features/incidents/model.ts` (interface `Incident`: `status`, `liability`, `customerCharge`,
  `estimatedCost`) + `src/features/incidents/seed.ts` khối `inc_010` (dòng ~314-345).
- `src/shared/domain/enums.ts` dòng ~200-265 (khối Settlement) + cuối `AUDIT_ACTIONS` (dòng ~465-490);
  `src/shared/domain/permissions.ts` dòng ~322-360 (chỉ để biết entry `CREATE`/`EDIT`/`REVERSE`, không sửa);
  `src/shared/i18n/vi.ts` khối `finance` (dòng ~991) + các `SETTLEMENT_*_LABELS` (dòng ~1478-1545);
  `src/shared/lib/audit.ts`; `src/shared/fixtures/seedAll.ts`.

### 10.15. File dự kiến tạo / sửa (Round 2)

**Tạo mới:** `src/features/finance/components/{PostSettlementChargeSection.tsx, PostSettlementChargeDialog.tsx,
PostSettlementChargeCloseDialog.tsx, SettlementAdjustmentDialog.tsx, SettlementReverseDialog.tsx,
SettlementReversalHistory.tsx}` (+ dialog xem snapshot — được gộp vào `SettlementReversalHistory.tsx` nếu ngắn).

**Sửa:** `src/features/finance/{model.ts, api.ts, hooks.ts, seed.ts, index.ts}` ·
`src/features/finance/components/{SettlementWorksheet.tsx, SettlementWaiverDialog.tsx,
SettlementResolveDisputeDialog.tsx}` · `src/features/finance/screens/SettlementListScreen.tsx` ·
`src/features/rentals/{model.ts, api.ts, index.ts}` (§10.5) · `src/shared/domain/enums.ts` ·
`src/shared/i18n/vi.ts` · `src/shared/fixtures/seedAll.ts` (`SEED_VERSION` 14).

### 10.16. Definition of Done — Round 2

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `git diff` **trống** ở `src/features/handover-return/`, `src/features/incidents/`, `src/shared/domain/permissions.ts`,
   `src/shared/fixtures/registerSeeds.ts`, `src/app/`, `src/shared/layout/`, `rentals/{hooks.ts, seed.ts, screens/, components/}`;
   `rentals/model.ts` chỉ **thêm** 1 dòng transition + 1 hàm; enum mới đúng từng ký tự §10.3, audit action
   chỉ nối cuối mảng.
3. PSC lưu ở key `postSettlementCharges`; tạo/điều chỉnh/tất toán PSC **không ghi** key `settlements`
   (`completedTotals`, `lines`, `paymentStatus` của Settlement kỳ gốc giữ nguyên — RS-BR-13, BRD §25.4,
   AC-RS-011/012).
4. Luật chống trùng §10.4 đúng: không tạo được PSC `INCIDENT` cho sự cố đã có dòng trong Settlement hoặc đã
   có PSC; số tiền PSC `INCIDENT` khoá = Customer Charge; resync sau đảo không đưa lại sự cố đã có PSC.
5. Đảo quyết toán: chỉ `SYSTEM_ADMIN` thấy nút; lý do + gõ mã lượt thuê (kiểm cả ở API); Settlement
   `DRAFT`, Rental `SETTLEMENT`; yêu cầu thu/hoàn `CANCELLED` (không xoá); `reversals[]` có snapshot đầy đủ
   và xem lại được trên UI; PSC giữ nguyên; `canRevertSettlementReversed` trả `false` cho Rental `RETURNED`.
6. "Điều chỉnh" ẩn với `ACCOUNTANT` (`TBD`), hiện với `MANAGER`/`SALES`/`SYSTEM_ADMIN`; "Tạo khoản phát sinh"
   hiện với `ACCOUNTANT`; `OPERATION_STAFF`/`DISPATCHER` vẫn không thấy tab "Quyết toán".
7. 4 nợ nhỏ §10.7 đã sửa đúng tiêu chí từng dòng (N1: không còn `readAll()` ngoài callback ở hàm ghi nào của
   `finance/api.ts`; N2: cộng dồn giảm một phần bị chặn + chặn `WAIVE_LINE` trên dòng đã giảm một phần; N3:
   Miễn khi kết luận tranh chấp sinh `SettlementWaiver` theo ngưỡng; N4: helper gọi trong các hàm liệt kê).
8. Mọi `TODO` §10.13 có mặt, trỏ đúng mã.
9. Seed đúng §10.12, `SEED_VERSION` = 14.
10. *(Chủ dự án tự test)*: `rt_024` (ACCOUNTANT) → tạo PSC phạt nguội → Final Amount kỳ gốc không đổi; đổi
    `MANAGER` → Điều chỉnh giảm 200k → PSC `REFUND`; `rt_026` → PSC 900k hiện "Tạm giữ", nút tất toán bị
    khoá; đổi `SYSTEM_ADMIN` → Đảo quyết toán `rt_025` (2 bước) → Rental về "Đang quyết toán", yêu cầu hoàn
    cọc "Đã huỷ", "Lịch sử đảo quyết toán" xem được bản cũ → làm lại tới Đóng lượt; đảo `rt_026` → "Đồng bộ
    lại" không sinh dòng `inc_010`; thử giảm một phần 2 lần vượt số dòng trên `rt_022` → bị chặn.
11. `docs/IMPLEMENTATION-PLAN.md` cập nhật.

### 10.17. Thứ tự làm đề xuất cho `dev` (một lượt, cùng một task)

1. Nợ N1 + N4 (`api.ts` — sửa pattern trước để hàm mới bám theo) → N2 + N3 (`model.ts`/`api.ts`/2 dialog).
2. Enum + label map + audit action → model PSC/Reversal + hàm thuần §10.4.
3. `rentals` §10.5 → API §10.6 (+ sửa `resyncSettlementSources`) → hooks/barrel.
4. UI Worksheet (2 component mới + banner + nút đảo) → dialog → cột List.
5. Seed + `SEED_VERSION` → chạy 3 cổng.

Phụ thuộc: Round 1 `DONE` (đã thoả). Không phụ thuộc Phase 4.2/4.3.

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
| 7 | Khoản tranh chấp giữ trong Settlement hay tách Post-Settlement; khách từ chối toàn bộ — RS §28 Q13 | UC-RS-17 nhánh 4, UC-RS-08 A2 | Chỉ build 3 nhánh giữ/điều chỉnh/miễn; "từ chối toàn bộ" = đánh dấu mọi dòng `DISPUTED` → về `DRAFT`; TODO tại dialog kết luận. **Round 2 giữ nguyên** — nhánh 4 "tách ra Post-Settlement" vẫn không build (§10.1); nhánh Miễn đi qua ngưỡng duyệt (§10.7 N3) |
| 8 | Thời hạn truy thu + ngưỡng bỏ qua — RS §28 Q14/Q15 | Post-Settlement Charge (Round 2) | Không giới hạn thời hạn, không đề xuất bỏ qua (UC-RS-14 A2 không build); TODO tại `createPostSettlementCharge` (§10.13) |
| 9 | Mức xác nhận khách Phase 1 (M0-M4) — RS §28 Q17 | Bước `PENDING_CUSTOMER` | Luôn đi qua `PENDING_CUSTOMER`; nhân viên ghi nhận thay khách (gần M1 — mức BRD đề xuất tối thiểu); TODO tại `recordCustomerAck` |

Không chặn nhưng cần BA xem: 5 điểm lệch tài liệu ở §0.4 (thứ tự `WAITING_APPROVAL`; trừ trùng `WAIVED`;
huỷ Return khi Settlement đã mở; `DAMAGE` ở Return vs Incident; `Rental.additionalChargesAmount`).

---

## 12. Danh sách file `dev` đọc trước khi code — Round 1 (Round 2: xem §10.14)

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

## 13. File dự kiến tạo / sửa — Round 1 (Round 2: xem §10.15)

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

Xem **§10.16** (bản chi tiết thay cho 5 điểm tóm tắt cũ ở đây, 21/10/2026).

---

## 16. Phụ thuộc & thứ tự

Round 1 không phụ thuộc gì chưa xong (Phase 3 `DONE`). Round 2 phụ thuộc Round 1. Phase 4.2 (Payment) phụ
thuộc 4.1 **chỉ** ở phần thực thi `paymentRequests` + đồng bộ `paymentStatus`/`Paid To Date` (§0.3) + thu/hoàn
Post-Settlement Charge và đóng PSC theo giao dịch (Round 2, §10.13 `TODO(Phase 4.2)`); 2 mốc
thanh toán đầu (`BOOKING`/`HANDOVER`) không phụ thuộc. Phase 4.3 đọc Settlement `COMPLETED`
(`completedTotals`) để sinh Revenue Line `ON_SETTLEMENT` (CR-2026-048).
