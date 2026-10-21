# Kế hoạch triển khai — Thanh toán (Payment)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (21/10/2026 — người dùng duyệt nguyên trạng,
giữ cách chia 2 round, không chờ BA xác nhận các điểm diễn giải §0.4 trước khi code) · **Round 1
`DONE` (21/10/2026, đạt ở vòng review 2)** · Round 2 chưa giao — kế hoạch chi tiết Phase 4.2. Chia **2 round**: Round 1 = sổ giao dịch lõi + lịch thanh toán 2
mốc đầu (`BOOKING`/`HANDOVER`) + biên lai + quỹ tiền mặt — **không phụ thuộc Settlement**; Round 2 =
thực thi yêu cầu thu/hoàn do Settlement/Post-Settlement Charge điều phối (mốc `RETURN`), cấn trừ cọc
`OFFSET`, hoàn tiền + duyệt hoàn, đồng bộ Payment Status ngược về Settlement, Công nợ khách hàng.

**Nguồn nghiệp vụ (bản chuẩn):** `../thien-bao-car-docs/modules/Payment-BRD.md` (v1.8 — toàn bộ, đặc
biệt §4.1, §6-§18, §20-§23, §27). `Payment-UseCase.md` (v1.2) **chỉ dùng** cho §4 State Model (4.1
Transaction, 4.2 Payment Request) và luồng bước UC-PM-05/06/09/11/12/14/16 khi BRD không mô tả chi
tiết — **không bám UseCase cho mốc thu cọc/điều kiện lịch thanh toán** (§0.1). `WebappQuanTri.md`
§11.2-§11.4. `CR-2026-003/004/035/047/056/060`. Phía Settlement: `RentalSettlement-BRD.md` §10, §15,
§17 (RS-BR-09/10/11/13/20/21/22).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/RENTAL-SETTLEMENT-PLAN.md` (mẫu
format + quyết định Phase 4.1, đặc biệt §0.3 "Paid To Date tạm suy" và §10.13 `TODO(Phase 4.2)`), code
hiện có `src/features/finance/*` (Settlement Round 1+2), `src/shared/domain/enums.ts`
(`TRANSACTION_TYPES`/`TRANSACTION_DIRECTIONS`/`TRANSACTION_STATUSES`/`PAYMENT_METHODS` **đã scaffold
từ Phase 0, khớp BRD §6.1/§8/§9/§10, chưa nơi nào dùng** — dùng nguyên, không sửa),
`src/shared/domain/permissions.ts` (`PAYMENT.VIEW/RECORD_CASH/CONFIRM/RECONCILE` đã có).

---

## 0. Cảnh báo & quyết định thiết kế — đọc trước khi code

### 0.1. Bám `Payment-BRD.md` §4.1/§8/PM-BR-21, KHÔNG bám `Payment-UseCase.md` cho lịch thanh toán

`Payment-UseCase.md` (v1.2, 01/09/2026) **chưa cập nhật CR-2026-060** (BRD v1.8, 09/09/2026, đã APPLIED):

| Chỗ trong UseCase | UseCase ghi (sai) | Bám theo (BRD v1.8, CR-2026-060) |
| --- | --- | --- |
| UC-PM-02 §6.3 | Thu cọc khi có Payment Request `Source = BOOKING` | Security Deposit `CASH_20M` thu ở mốc **`HANDOVER`** (BRD §8 dòng `DEPOSIT`, PM-BR-21) |
| UC-PM-03 §7.3 (ghi chú CR-2026-004) | `BOOKING` = Prepayment 30% + Security Deposit; `HANDOVER` = 70% | `BOOKING` = **chỉ** Prepayment 30% Base Rental; `HANDOVER` = 70% Base Rental + Security Deposit (BRD §4.1) |

Lỗi tài liệu đã biết (ghi ở `IMPLEMENTATION-PLAN.md` mục Phase 4), **không phải quyết định nghiệp vụ
mới** — không tự sửa `Payment-UseCase.md` (việc của BA). Trong code: comment trích `Payment-BRD.md §8 /
PM-BR-21 (CR-2026-060)` tại hằng số/hàm sinh lịch thanh toán.

### 0.2. Ranh giới kiến trúc — đụng gì, không đụng gì

| Khu vực | Được phép | Không được phép |
| --- | --- | --- |
| `features/finance/*` | Mở rộng `model.ts` · `api.ts` · `hooks.ts` · `seed.ts` · `index.ts` + component/screen mới. Round 2: sửa có kiểm soát các hàm Settlement/PSC đã có (§10.4) | Đổi hành vi Settlement ngoài đúng các điểm §10.4 |
| `features/rentals/screens/RentalDetailScreen.tsx` | Thay `RentalDetailPlaceholder` của tab "Thanh toán" bằng `<RentalPaymentTab>` từ barrel `@/features/finance` + gate tab theo `PAYMENT.VIEW` (§7.2) | Đổi các tab khác |
| `features/rentals/model.ts` · `api.ts` · `hooks.ts` · `index.ts` · `seed.ts` | **Không đụng một ký tự.** Payment không cần transition Rental mới, không cần field mới trên `Rental` (Payment Status của Rental là **giá trị suy ra** hiển thị ở tab Thanh toán — §0.3 điểm 6) | Thêm field `paymentStatus` vào `Rental`; gọi `features/finance` từ `rentals/api.ts` (sẽ tạo phụ thuộc vòng `rentals ↔ finance`) |
| `features/handover-return/*` · `features/incidents/*` | Chỉ **đọc** qua export barrel **đã có** (`useHandoverRecords`, `listHandovers`, `Incident`…) | Sửa bất kỳ file nào, kể cả `index.ts` (không cần export mới) |
| `features/vehicles/*` · `features/customers/*` | Đọc qua hook như tiền lệ (deep-import `useCustomers` từ `customers/hooks.ts` — ngoại lệ đã chấp nhận ở `RENTAL-SETTLEMENT-PLAN.md` §0.2) | Sửa bất kỳ file nào — kể cả tab "Thanh toán" placeholder ở Customer Detail (roadmap §15.2) |
| `shared/domain/enums.ts` | Thêm enum mới §2.6 + nối audit action §6 vào **cuối** `AUDIT_ACTIONS` | Sửa 4 enum Payment đã scaffold; chèn giữa enum khác |
| `shared/domain/permissions.ts` | Thêm đúng các entry §5 | Sửa entry hiện có (kể cả `PAYMENT.VIEW` của `OPERATION_STAFF` — §0.4 điểm 6) |
| `shared/i18n/vi.ts` | Khối `vi.finance.payment.*` + label map mới §2.6 | — |
| `app/routes.tsx` | Thay `ComingSoon` của `/finance/transactions`, `/finance/cash-drawer` (Round 1), `/finance/receivables` (Round 2) | `/finance/reports` (Phase 4.3) |
| `shared/layout/nav.tsx` · `app/paths.ts` | Không cần sửa — 3 mục menu + path đã có, gate `PAYMENT.VIEW` | Thêm route "Biên lai" riêng (Biên lai là dialog từ giao dịch — §7.4) |

**Import trong cùng feature:** Payment và Settlement cùng ở `features/finance` → import **trực tiếp**
`./model` / `./api` (barrel `index.ts` chỉ dành cho feature khác, `CONVENTIONS.md` §3). Đọc/ghi
storage của Settlement/PSC trong cùng callback `fakeRequest()` là hợp lệ (cùng feature, cùng "service").

**Vị trí code:** giữ đúng bảng file của `CONVENTIONS.md` §3 — **nối tiếp** vào `model.ts`/`api.ts`/
`hooks.ts`/`seed.ts` hiện có, mỗi phần mở bằng comment khối `// ==== Payment (PM) — PAYMENT-PLAN.md §x ====`
(như Round 2 Settlement đã làm). `api.ts` sẽ dài (~1.900 dòng) — chấp nhận để không lệch quy ước; tách
`features/finance` thành thư mục con theo module (RS/PM/RV) là **thay đổi kiến trúc**, cần người dùng
duyệt riêng (đề xuất khi tới Phase 4.3, không làm ở đây).

**Pattern form:** dialog mới dùng **`useState` + `zod.safeParse()`** giống các dialog Settlement hiện có
(không chuyển `react-hook-form` giữa chừng — tránh 2 pattern trộn trong một feature). Schema đặt ở
`model.ts` **và phải được dùng thật** trong dialog (bài học Round 2 Settlement: `postSettlementChargeFormSchema`
viết ra nhưng dialog tự validate inline).

### 0.3. Quyết định thiết kế lõi (kỹ thuật — không phải quyết định nghiệp vụ)

1. **`PaymentRequest` là entity lưu trữ riêng** (storage key `paymentRequests`), không suy ra khi đọc —
   vì BRD §6.2 định nghĩa nó có vòng đời riêng (UseCase §4.2), Transaction cần khoá ngoại ổn định
   `paymentRequestId` (PM-BR-15: một yêu cầu — nhiều giao dịch), và backend thật sẽ lưu bảng này.
2. **`PaymentSchedule` KHÔNG lưu** — là **view suy ra** (hàm thuần `buildPaymentSchedule`) từ `Rental` +
   `PaymentRequest[]` + `Transaction[]`: số tiền mỗi mốc hoàn toàn xác định từ snapshot của Rental
   (PM-BR-21: `BOOKING` = `prepaymentAmount`; `HANDOVER` = `baseAmount − prepaymentAmount` + 20.000.000 nếu
   `CASH_20M`; `RETURN` = theo Settlement) → lưu thêm sẽ chỉ tạo nguồn sự thật thứ hai.
3. **Mốc `HANDOVER` = 2 Payment Request** tách theo loại giao dịch: (a) 70% Base Rental → `RENTAL_PAYMENT`;
   (b) Security Deposit `CASH_20M` → `DEPOSIT`. Lý do: BRD §11 tính `Deposit Held` riêng theo Transaction
   `DEPOSIT`, không trộn với tiền thuê. Cọc `MOTORBIKE` **không sinh Payment Request/Transaction** (BRD §8,
   PM-BR-22) — lịch hiển thị dòng "Cọc xe máy — vật bảo đảm, theo dõi ở biên bản giao xe".
4. **Cặp đảo giao dịch triệt tiêu nhau:** khi `REVERSED`, bản gốc chuyển `REVERSED` và sinh giao dịch đối
   ứng (`reversalOfId`, `status = CONFIRMED`, hướng ngược). Hàm tổng hợp **loại cả hai** khỏi mọi phép cộng
   (`isEffectiveTransaction(t) = t.status === 'CONFIRMED' && !t.reversalOfId`). Nếu chỉ loại bản gốc mà vẫn
   cộng bản đối ứng thì số đã thu bị trừ hai lần. Diễn giải PM-BR-01/04 — ghi cho BA (§0.4 điểm 4).
5. **`Paid To Date` không tính Transaction `DEPOSIT`** (cọc là tiền giữ hộ, không phải tiền thuê) nhưng
   **có tính `OFFSET`** (BRD §13). Khớp RS-BR-21 (Paid To Date = Prepayment 30% + 70%) và BRD §12 ("không
   tính DEPOSIT chưa dùng"); nếu tính cả `DEPOSIT` lẫn `OFFSET` thì cọc bị đếm hai lần.
6. **Payment Status của Rental = giá trị suy ra** (`deriveRentalPaymentSummary`), hiển thị ở tab Thanh
   toán — không ghi field vào `Rental` (§0.2). **Riêng Settlement** đã có field `paymentStatus` (Phase 4.1)
   → Round 2 **ghi ngược** giá trị suy ra vào field này sau mỗi thay đổi giao dịch/yêu cầu (RS-BR-11,
   PM-BR-14) qua một helper duy nhất (§10.3).
7. **`Settlement.paymentRequests[]` (Phase 4.1) giữ nguyên** làm bản ghi "Settlement đã điều phối gì";
   Round 2 tạo thêm `PaymentRequest` của Payment liên kết 1-1 qua `settlementRequestId`, ghi **trong cùng
   callback** `createPaymentRequest` của Settlement. Không gộp/đổi kiểu `SettlementPaymentRequest` (đỡ
   phải migrate UI Worksheet + snapshot `reversals[]` đã lưu).
8. **Webapp không có cổng SePay thật** (CR-2026-047): form ghi nhận chỉ cho chọn `CASH` / `BANK_TRANSFER`
   / `E_WALLET`; `ONLINE_GATEWAY` chỉ xuất hiện trong **seed** (giao dịch "SePay (webhook)" đã
   `CONFIRMED`) để sổ giao dịch minh hoạ được. Không build nút giả lập webhook. Baseline đúng BRD §4.2:
   QR/chuyển khoản + Accountant xác nhận tay.
9. **Lập lịch thanh toán là hành động tường minh** ("Lập lịch thanh toán" ở tab Thanh toán, sinh 2-3
   Payment Request mốc `BOOKING`/`HANDOVER`), không tự sinh khi Rental `CONFIRMED` — vì tự sinh đòi
   `rentals/api.ts` gọi `finance` (cấm, §0.2). Seed sinh sẵn cho mọi Rental đủ điều kiện. Ghi roadmap: khi
   có backend, sự kiện "Rental CONFIRMED" sẽ tự tạo (UC-PM-01 kích hoạt bởi System).

### 0.4. Điểm tài liệu chưa nhất quán — ghi lại cho BA, không tự sửa tài liệu

1. **Đánh số Open Question trong `IMPLEMENTATION-PLAN.md` lệch:** OQ (10) "ai được `REVERSED`" ghi
   "PM §27 Q15" — đúng ra là **Q14** (Q15 là "chính sách hoàn/giữ khi khách huỷ lượt"). Đã sửa lại trong
   `IMPLEMENTATION-PLAN.md` cùng lần lập plan này. Ngoài ra BRD §21 đã chốt một phần câu hỏi: `REVERSED` =
   Admin ✓ / Manager ✓ / **Accountant `TBD`** / Operation ✗ → câu hỏi còn treo thực chất chỉ là cột
   Accountant.
2. **Trùng mã `PM-BR-21` khác nghĩa:** BRD §20 `PM-BR-21` = Payment Schedule 3 mốc; UseCase §26 `PM-BR-21`
   = "Post-Settlement Charge không làm đổi Settlement kỳ gốc". Code trích `PM-BR-21` theo nghĩa **BRD**;
   quy tắc PSC trích `RS-BR-13` (Settlement) thay vì mã UseCase.
3. **Enum `Source` của Payment Request (BRD §6.2) thiếu `HANDOVER`** (`SETTLEMENT / BOOKING /
   POST_SETTLEMENT_CHARGE / CONSIGNMENT`) trong khi §4.1/§8/PM-BR-21 nói rõ có yêu cầu "từ giao xe".
   BA đề xuất thêm `HANDOVER` (§2.6) — comment trỏ BRD §4.1/§8.
4. **Đảo giao dịch & PM-BR-01:** giao dịch đối ứng có `status = CONFIRMED` nhưng **không** được cộng vào
   số đã thu (§0.3 điểm 4) — cần BA xác nhận cách diễn giải "chỉ CONFIRMED mới tính" với cặp đảo.
5. **Công nợ khách hàng (BRD §12) — phạm vi `Total Charged`:** công thức chỉ cộng Final Amount của
   Settlement + PSC, nhưng `Total Collected` (Σ IN) lại gồm cả Prepayment/70% của lượt **chưa quyết toán**
   → khách đang thuê sẽ hiện "số dư/Credit" sai. Diễn giải chọn: Công nợ chỉ tính trên các Rental đã có
   Settlement `CONFIRMED`/`COMPLETED` (đã có Final Amount) + PSC; lượt chưa quyết toán hiển thị **riêng**
   cột "Đã thu trước (chưa quyết toán)", không cộng vào Outstanding/Credit.
6. **Quyền xem của `OPERATION_STAFF`:** BRD §21 ghi "✗ / TBD"; `permissions.ts` hiện là `false`. Không sửa
   entry cũ; ghi nhận để BA chốt. Hệ quả demo: Operation Staff có `RECORD_CASH`/nộp quỹ/xuất biên lai theo
   BRD nhưng **không vào được** các màn Payment trên Webapp (menu gate `PAYMENT.VIEW`) — thao tác thu
   tiền hiện trường của họ thực tế thuộc App nhân viên (`CLAUDE.md` §3). Chấp nhận cho demo.
7. **`ADJUSTMENT` thiếu dòng ở ma trận BRD §21**, chỉ có ở UseCase §27 (Admin ✓ / Manager `TBD` /
   Accountant ✓ / Operation ✗) → entry `PAYMENT.EDIT` lấy theo UseCase, `source` ghi rõ.

---

## 1. Phạm vi & chia Round

### 1.1. Vì sao chia 2 round theo ranh giới "trước / sau Settlement"

Settlement chỉ tồn tại sau khi Rental `RETURNED` (`RS-BR-02`) → 2 mốc đầu (`BOOKING`, `HANDOVER`) xảy ra
**trước** khi có Settlement, dựng và demo được độc lập. Phần chạm vào code Settlement (thay `Paid To Date`
tạm suy, ghi ngược Payment Status, đóng PSC theo giao dịch, đảo quyết toán huỷ yêu cầu) rủi ro cao hơn
(sửa hàm đã qua review Phase 4.1) → để riêng Round 2, review riêng.

### 1.2. Trong phạm vi — Round 1 (sổ giao dịch lõi, không phụ thuộc Settlement)

| # | Hạng mục | Nguồn |
| --- | --- | --- |
| 1 | Enum mới §2.6 + label map; 7 permission mới §5; audit action Round 1 §6 | BRD §6, §10, §21 |
| 2 | Model `PaymentRequest` / `Transaction` / `CashDrawerSubmission` + hàm thuần §3 (lịch thanh toán, tổng hợp lượt thuê, quỹ) | BRD §6, §11, §13, §14 |
| 3 | **Lập lịch thanh toán** cho Rental → Payment Request `BOOKING` (30%) + `HANDOVER` (70%) + `HANDOVER` cọc (chỉ `CASH_20M`) | PM-BR-21, CR-2026-003/004/060 |
| 4 | **Ghi nhận thu** theo Payment Request mốc: `CASH` → `CONFIRMED` ngay + gắn quỹ người thu; `BANK_TRANSFER`/`E_WALLET` → `PENDING`. Nhiều lần cho một yêu cầu; cập nhật `OPEN → PARTIALLY_FULFILLED → FULFILLED` | UC-PM-01/02/03, PM-BR-09/10/15, AC-PM-001/002/004 |
| 5 | **Xác nhận** / **Đánh dấu thất bại** giao dịch CK/ví `PENDING` (cho sửa số tiền trước khi xác nhận, có audit) | UC-PM-06 (A1), BRD §15.2, EX-03 |
| 6 | **Huỷ (`VOIDED`)** giao dịch `PENDING`, lý do bắt buộc | UC-PM-11, PM-BR-02 |
| 7 | **Đảo (`REVERSED`)** giao dịch `CONFIRMED`: sinh giao dịch đối ứng, lý do bắt buộc, vô hiệu biên lai gốc | UC-PM-12, PM-BR-03/04/19, AC-PM-008/013/015 |
| 8 | **Điều chỉnh (`ADJUSTMENT`)** — giao dịch thủ công IN/OUT, gắn Customer (+ Rental tuỳ chọn), lý do bắt buộc | UC-PM-13, PM-BR-18 |
| 9 | **Xuất biên lai** cho giao dịch `CONFIRMED` (số biên lai tuần tự, hiển thị dạng chứng từ) | BRD §18, UC-PM-16, AC-PM-014 |
| 10 | **Quỹ tiền mặt**: số dư quỹ theo người thu, **nộp quỹ** (đếm thực tế → chênh lệch + lý do), **thủ quỹ xác nhận đã nhận**; tab **đối soát CK/ví** (danh sách `PENDING`) | BRD §14-§15, UC-PM-14/15, AC-PM-009, EX-06 |
| 11 | Màn **Sổ giao dịch** `/finance/transactions` + màn **Quỹ tiền mặt** `/finance/cash-drawer` + tab **Thanh toán** ở Rental Detail | `WebappQuanTri.md` §11.2 |
| 12 | Seed Payment Request + Transaction mốc `BOOKING`/`HANDOVER` khớp cờ `HandoverRecord` hiện có, đủ mọi trạng thái | §8 |

### 1.3. Trong phạm vi — Round 2 (thực thi điều phối của Settlement)

Chi tiết §10. Tóm tắt: Payment Request `SETTLEMENT` (thu số còn lại / hoàn cọc / hoàn tiền thừa) +
`POST_SETTLEMENT_CHARGE` (thu bổ sung / hoàn) · `OFFSET` cấn trừ cọc tự động khi Settlement chốt ·
giao dịch hoàn tiền + **duyệt hoàn vượt ngưỡng** · chặn `CASH OUT` vượt quỹ · ghi ngược Payment Status
về Settlement · đóng PSC khi yêu cầu `FULFILLED` · đảo quyết toán huỷ yêu cầu + đảo `OFFSET` · thay
`calcPaidToDate`/`calcDepositHeld` bằng số liệu sổ giao dịch · màn **Công nợ khách hàng**
`/finance/receivables`.

### 1.4. Ngoài phạm vi cả 2 round — lý do

| Hạng mục | Lý do / nơi xử lý |
| --- | --- |
| Cổng SePay thật (webhook, VietQR động), phí giao dịch SePay | Không có backend; phí là chi phí công ty → `RV` (Phase 4.3); mô hình phí là OQ (PM §4.2) |
| Chặn bắt đầu/hoàn tất giao xe theo mốc thanh toán (PM-BR-21 vế sau) | Thực thi ở VH/App nhân viên; `handover-return` cấm đụng. Tab Thanh toán chỉ **cảnh báo** lệch giữa sổ giao dịch và cờ `HandoverRecord` (§7.2) |
| Hoàn tiền khi huỷ lượt / xe hỏng trước giao (PM-BR-23, EX-05) | Chính sách huỷ chưa chốt (PM §27 Q15, master §51 Q57); seed không có giao dịch cho Rental `CANCELLED` |
| Cảnh báo/chặn tạo Rental cho khách đang nợ (BRD §12) | Phải sửa `rentals/*` (cấm) + OQ PM §27 Q7 → roadmap §15.2 |
| Cấn trừ `Credit` sang lượt sau, `OVERDUE` | OQ PM §27 Q8/Q9 — chỉ hiển thị, không tính `OVERDUE` |
| Giữ lại cọc chờ phạt nguội (`Deposit Retained`) | OQ RS §28 Q3 / PM §27 Q5 — hoàn toàn bộ phần dư (đã là giả định 4.1) |
| `OWNER_PAYOUT` (chi trả chủ xe ký gửi) | Phase 5 (`VC`) — enum đã có, không dựng luồng |
| Xuất PDF / link chia sẻ biên lai có thời hạn, mẫu biên lai | Demo chỉ hiển thị chứng từ trong dialog; OQ PM §27 Q16 |
| Báo cáo dòng tiền (UC-PM-19), cấu hình phương thức/ngưỡng/quỹ (UC-PM-20) | Báo cáo → Phase 4.3/6; cấu hình phụ thuộc nhiều OQ (§11) — dùng hằng số tạm |
| Tab "Thanh toán" ở Customer Detail (UC-PM-18 bước 1) | Cấm đụng `customers/*` — màn Công nợ (Round 2) có link sang Customer Detail; nối tab là roadmap §15.2 |
| Notification (CK chờ xác nhận, hoàn chờ duyệt, khách còn nợ) | Phase 6 (`NT`) |

---

## 2. Data model (`features/finance/model.ts`, nối sau phần Settlement)

### 2.1. `PaymentRequest` — entity mới, storage key `paymentRequests`

```ts
/** Payment Request — `Payment-BRD.md` §6.2, UseCase §4.2. Module khác "tạo", Payment thực thi. */
export interface PaymentRequest {
  id: string                         // generateId('prq')
  source: PaymentRequestSource       // BOOKING | HANDOVER | SETTLEMENT | POST_SETTLEMENT_CHARGE (§2.6)
  purpose: PaymentRequestPurpose     // COLLECT | REFUND
  /** Loại giao dịch sinh ra khi thực thi — quyết định Type của Transaction (BRD §8). */
  transactionType: TransactionType
  expectedAmount: number             // số nguyên đồng > 0 (PM-BR-20)
  status: PaymentRequestStatus       // OPEN | PARTIALLY_FULFILLED | FULFILLED | CANCELLED — HỆ THỐNG tính, không sửa tay
  rentalId: string
  customerId: string                 // copy từ Rental lúc tạo — lọc nhanh/công nợ
  // Round 2:
  settlementId?: string
  settlementRequestId?: string       // 1-1 với SettlementPaymentRequest.id (§0.3 điểm 7)
  postSettlementChargeId?: string
  note?: string
  createdByName: string
  createdAt: string
  updatedAt: string
  cancelledByName?: string
  cancelledAt?: string
  cancelReason?: string
}
```

Ánh xạ `source` → mốc của lịch (hàm `milestoneOf`, không lưu): `BOOKING → BOOKING`, `HANDOVER → HANDOVER`,
`SETTLEMENT → RETURN`; `POST_SETTLEMENT_CHARGE` nằm ngoài lịch 3 mốc.

Ánh xạ `transactionType` khi sinh yêu cầu:

| Yêu cầu | `source` / `purpose` | `transactionType` | `expectedAmount` |
| --- | --- | --- | --- |
| Prepayment 30% | `BOOKING` / `COLLECT` | `RENTAL_PAYMENT` | `rental.prepaymentAmount` |
| 70% Base Rental | `HANDOVER` / `COLLECT` | `RENTAL_PAYMENT` | `rental.baseAmount − rental.prepaymentAmount` |
| Security Deposit (`CASH_20M`) | `HANDOVER` / `COLLECT` | `DEPOSIT` | `20_000_000` (dùng hằng số Rental `securityDepositAmount`) |
| *(Round 2)* Thu số còn lại | `SETTLEMENT` / `COLLECT` | `ADDITIONAL_CHARGE` | `SettlementPaymentRequest.amount` (Payment không phân bổ theo dòng — UC-PM-04 §8.4) |
| *(Round 2)* Hoàn cọc | `SETTLEMENT` / `REFUND` | `DEPOSIT_REFUND` | như trên |
| *(Round 2)* Hoàn tiền thừa | `SETTLEMENT` / `REFUND` | `OVERPAYMENT_REFUND` | như trên |
| *(Round 2)* PSC `RECEIVABLE` | `POST_SETTLEMENT_CHARGE` / `COLLECT` | `POST_SETTLEMENT_COLLECT` | `psc.amount` |
| *(Round 2)* PSC `REFUND` | `POST_SETTLEMENT_CHARGE` / `REFUND` | `GOODWILL_REFUND` | `psc.amount` (BRD §8 — nguồn `POST_SETTLEMENT`) |

### 2.2. `Transaction` — entity mới, storage key `transactions`

```ts
/** Giao dịch tiền — `Payment-BRD.md` §6.1. Không bao giờ xoá vật lý (PM-BR-05). */
export interface Transaction {
  id: string                         // generateId('txn')
  /** "Transaction Code" BRD §6.1 — `GD-000001` tuần tự, sinh trong callback fakeRequest. */
  code: string
  type: TransactionType              // enum đã có
  direction: TransactionDirection    // enum đã có; suy từ type, riêng ADJUSTMENT do người dùng chọn
  amount: number                     // số nguyên đồng > 0; chiều do `direction`
  method: PaymentMethod              // enum đã có
  status: TransactionStatus          // enum đã có
  customerId: string                 // PM-BR-16 — bắt buộc
  rentalId?: string                  // bắt buộc nếu gắn lượt thuê
  paymentRequestId?: string          // trống với ADJUSTMENT / OFFSET
  settlementId?: string              // Round 2 — OFFSET
  reference?: string                 // mã CK / mã ví / mã SePay
  evidenceNote?: string              // demo: ghi chú chứng từ thay ảnh
  reason?: string                    // bắt buộc với ADJUSTMENT
  /** PM-BR-10 — `drawer:<userId>` của người thu khi method = CASH. */
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
  /** BRD §18 — nhúng, một giao dịch một biên lai. */
  receipt?: Receipt
  createdAt: string
  updatedAt: string
}

export interface Receipt {
  receiptNo: string                  // `BL-000001` tuần tự — TODO(OQ: Payment-BRD.md §27 Q16)
  issuedByName: string
  issuedAt: string
  /** PM-BR-19 — bị vô hiệu khi giao dịch gốc REVERSED. */
  voided: boolean
}
```

Bảng `type → direction` cố định (hàm `directionOf`): `DEPOSIT`/`RENTAL_PAYMENT`/`ADDITIONAL_CHARGE`/
`POST_SETTLEMENT_COLLECT` → `IN`; `DEPOSIT_REFUND`/`OVERPAYMENT_REFUND`/`GOODWILL_REFUND`/`OWNER_PAYOUT`
→ `OUT`; `ADJUSTMENT` → theo người dùng chọn.

### 2.3. `CashDrawerSubmission` — entity mới, storage key `cashDrawerSubmissions`

```ts
/** Phiếu nộp quỹ — `Payment-BRD.md` §14, §15.1, UC-PM-14. Quỹ = theo người thu (BRD §14). */
export interface CashDrawerSubmission {
  id: string                          // generateId('cds')
  cashDrawerId: string                // `drawer:<userId>`
  ownerName: string
  /** Giao dịch CASH được "chốt" vào phiếu này — mỗi giao dịch chỉ thuộc tối đa 1 phiếu. */
  transactionIds: string[]
  systemAmount: number                // Σ CASH IN − Σ CASH OUT (hiệu lực) của transactionIds
  countedAmount: number               // số đếm thực tế
  variance: number                    // countedAmount − systemAmount
  varianceReason?: string             // bắt buộc khi variance ≠ 0 (EX-06, AC-PM-009)
  status: CashDrawerSubmissionStatus  // SUBMITTED | RECEIVED
  submittedAt: string
  receivedByName?: string             // "thủ quỹ" — TODO(OQ: Payment-BRD.md §27 Q11)
  receivedAt?: string
}
```

Số dư quỹ hiện tại của một người = Σ giao dịch `CASH` hiệu lực có `cashDrawerId` đó **chưa nằm trong
phiếu nào** (IN cộng, OUT trừ). Sau khi nộp, quỹ về 0 (UC-PM-14 §18.5); chênh lệch được lưu ở phiếu,
không "treo" vào quỹ.

### 2.4. `PaymentSchedule` — view suy ra (không lưu)

```ts
export interface PaymentMilestoneView {
  milestone: PaymentMilestone         // BOOKING | HANDOVER | RETURN
  requests: PaymentRequest[]          // 0..2 yêu cầu của mốc
  expectedTotal: number
  collectedTotal: number              // Σ giao dịch IN hiệu lực của các yêu cầu này
  pendingTotal: number                // Σ giao dịch PENDING (chưa tính vào đã thu)
  state: 'NOT_SCHEDULED' | 'OPEN' | 'PARTIAL' | 'DONE' | 'CANCELLED' | 'BY_SETTLEMENT'
  motorbikeCollateral?: boolean       // HANDOVER + MOTORBIKE → hiện dòng vật bảo đảm (PM-BR-22)
}
```

`RETURN` ở Round 1 luôn `BY_SETTLEMENT` (hiển thị "Theo quyết toán" + link tab Quyết toán); Round 2 lấy
từ yêu cầu `source = SETTLEMENT`.

### 2.5. `RentalPaymentSummary` — view suy ra (BRD §13)

```text
Total Payable  = Final Amount của Settlement (CONFIRMED/COMPLETED — completedTotals nếu đã COMPLETED)
                 nếu chưa có → rental.estimatedTotal (gắn nhãn "ước tính")
Paid To Date   = Σ Transaction IN hiệu lực gắn Rental, TRỪ type DEPOSIT, GỒM method OFFSET   (§0.3 điểm 5)
Deposit Held   = Σ DEPOSIT (IN, hiệu lực) − Σ OFFSET hiệu lực − Σ DEPOSIT_REFUND hiệu lực   (BRD §11)
Refunded       = Σ Transaction OUT hiệu lực gắn Rental (trừ ADJUSTMENT)
Balance Due    = Total Payable − Paid To Date
Payment Status = REFUND_PENDING nếu có yêu cầu REFUND OPEN/PARTIALLY_FULFILLED
                 → REFUNDED nếu có yêu cầu REFUND và tất cả FULFILLED, Balance Due ≤ 0
                 → UNPAID (Paid = 0) → PARTIALLY_PAID (0 < Paid < Total) → PAID (Paid ≥ Total)
                 (OVERDUE không tính — TODO(OQ: Payment-BRD.md §27 Q9))
```

"Hiệu lực" = `isEffectiveTransaction` (§0.3 điểm 4). Round 1 Total Payable của Rental chưa quyết toán
là ước tính → Payment Status hiển thị kèm chú thích "trước quyết toán".

### 2.6. Enum mới (`shared/domain/enums.ts`, nối sau `PAYMENT_METHODS`, mỗi khối comment nguồn)

```ts
/** `Payment-BRD.md` §6.2 + BA đề xuất `HANDOVER` (BRD §4.1/§8/PM-BR-21 — §0.4 điểm 3 PAYMENT-PLAN.md). `CONSIGNMENT` thuộc Phase 5, chưa thêm. */
export const PAYMENT_REQUEST_SOURCES = ['BOOKING', 'HANDOVER', 'SETTLEMENT', 'POST_SETTLEMENT_CHARGE'] as const
/** `Payment-BRD.md` §6.2 — `PAYOUT` thuộc Phase 5 (`VC`), chưa thêm. */
export const PAYMENT_REQUEST_PURPOSES = ['COLLECT', 'REFUND'] as const
/** `Payment-UseCase.md` §4.2. */
export const PAYMENT_REQUEST_STATUSES = ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'] as const
/** `Payment-BRD.md` §4.1, PM-BR-21 (CR-2026-004/060). */
export const PAYMENT_MILESTONES = ['BOOKING', 'HANDOVER', 'RETURN'] as const
/** BA đề xuất — BRD §14/UC-PM-14 mô tả "nộp quỹ" + "thủ quỹ xác nhận đã nhận", chưa đặt tên trạng thái. */
export const CASH_DRAWER_SUBMISSION_STATUSES = ['SUBMITTED', 'RECEIVED'] as const
/** Round 2 — BA đề xuất, UC-PM-09 ("chờ duyệt" / Đồng ý / Từ chối). */
export const REFUND_APPROVAL_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const
```

Label map mới trong `vi.ts`: `TRANSACTION_TYPE_LABELS`, `TRANSACTION_DIRECTION_LABELS`,
`PAYMENT_METHOD_LABELS` (`ONLINE_GATEWAY` = "Cổng thanh toán (SePay)", `OFFSET` = "Cấn trừ cọc"),
`PAYMENT_REQUEST_SOURCE_LABELS`, `PAYMENT_REQUEST_STATUS_LABELS`, `PAYMENT_MILESTONE_LABELS`,
`CASH_DRAWER_SUBMISSION_STATUS_LABELS`, `REFUND_APPROVAL_STATUS_LABELS` (Round 2). `TRANSACTION_STATUS_LABELS`
đã có — dùng nguyên.

---

## 3. Hàm thuần (`features/finance/model.ts`) — Round 1

| Hàm | Mô tả | Nguồn |
| --- | --- | --- |
| `directionOf(type)` | Bảng §2.2 | BRD §8 |
| `isEffectiveTransaction(t)` | `CONFIRMED && !reversalOfId` | §0.3 điểm 4, PM-BR-01 |
| `canScheduleRental(rental)` | Rental ∈ `CONFIRMED`, `CONTRACT_CREATED`, `READY_FOR_HANDOVER`, `HANDED_OVER`, `IN_RENTAL`, `RETURNED`, `SETTLEMENT` | PM-BR-21 |
| `buildScheduleRequests(rental, actorName, now)` | Sinh 2-3 `PaymentRequest` mốc `BOOKING`/`HANDOVER` theo bảng §2.1; `MOTORBIKE` không sinh yêu cầu cọc | PM-BR-21/22, CR-2026-003/060 |
| `calcRequestProgress(request, txns)` | `{ collected, pending, remaining }` (collected = Σ hiệu lực của yêu cầu) | UC-PM-01 bước 3 |
| `deriveRequestStatus(request, txns)` | `CANCELLED` giữ nguyên; `collected = 0` → `OPEN`; `< expected` → `PARTIALLY_FULFILLED`; `≥` → `FULFILLED` | UseCase §4.2 |
| `isRequestActionable(request, rental)` | Yêu cầu `OPEN`/`PARTIALLY_FULFILLED` **và** Rental không `CANCELLED`/`NO_SHOW`/`DISPUTED`/`COMPLETED` (mốc `BOOKING`/`HANDOVER`) | PM-BR-21; huỷ lượt = OQ Q15 |
| `buildPaymentSchedule(rental, requests, txns)` | `PaymentMilestoneView[]` §2.4 | BRD §4.1 |
| `deriveRentalPaymentSummary(rental, requests, txns, settlement?)` | §2.5 | BRD §11/§13, PM-BR-06/14 |
| `cashDrawerIdOf(userId)` | `drawer:${userId}` | BRD §14 |
| `calcCashDrawerBalance(drawerId, txns, submissions)` | Σ CASH hiệu lực chưa thuộc phiếu nào (IN +, OUT −) + danh sách giao dịch đó | BRD §14, UC-PM-14 |
| `nextSequenceCode(prefix, existingCodes)` | `GD-000001` / `BL-000001` | BRD §6.1/§18 |

Mọi số tiền là số nguyên (PM-BR-20); validate `Number.isInteger(amount) && amount > 0`.

### 3.1. Form schema (dùng thật trong dialog — §0.2)

- `transactionRecordFormSchema` — `{ paymentRequestId, amount, method ∈ CASH|BANK_TRANSFER|E_WALLET, reference?, evidenceNote? }`;
  `reference` bắt buộc khi `BANK_TRANSFER`/`E_WALLET` (BRD §9 "Mã tham chiếu"). Kiểm `amount ≤ remaining`
  của yêu cầu ở **API** (không chỉ form) — TODO(OQ: Payment-BRD.md §27 Q8 — trả thừa → Credit; demo chặn).
- `transactionConfirmFormSchema` — `{ amount, note? }` (cho sửa số theo thực nhận, UC-PM-06 A1).
- `transactionReasonFormSchema` — `{ reason: min 3 }` dùng chung cho Thất bại / Huỷ / Đảo.
- `adjustmentFormSchema` — `{ direction, amount, customerId, rentalId?, reason: min 3, method ∈ CASH|BANK_TRANSFER|E_WALLET }`.
- `cashDrawerSubmitFormSchema` — `{ countedAmount (≥ 0), varianceReason? }`; `superRefine`: bắt buộc lý do khi
  `countedAmount ≠ systemAmount` (truyền `systemAmount` qua factory `makeCashDrawerSubmitSchema(systemAmount)`).

---

## 4. Business rule cần trích dẫn trong code (comment 1 dòng tại chỗ)

| Mã | Tại đâu |
| --- | --- |
| PM-BR-01/04 + §0.3 điểm 4 | `isEffectiveTransaction` |
| PM-BR-02 | `voidTransaction` (chỉ `PENDING`) |
| PM-BR-03/05 | `reverseTransaction`; **không có** hàm `removeTransaction` |
| PM-BR-06/14 | `deriveRentalPaymentSummary` |
| PM-BR-09 | `recordTransaction` (CK/ví → `PENDING`) + `confirmTransaction` |
| PM-BR-10 | `recordTransaction` (CASH → gắn `cashDrawerId`) |
| PM-BR-15 | `calcRequestProgress` |
| PM-BR-16 | `recordTransaction`/`createAdjustment` (bắt buộc `customerId`) |
| PM-BR-18 | `createAdjustment` |
| PM-BR-19 | `reverseTransaction` (đặt `receipt.voided = true`) |
| PM-BR-20 | validate số tiền |
| PM-BR-21 (nghĩa BRD) + CR-2026-060 | `buildScheduleRequests` |
| PM-BR-22 + CR-2026-003 | nhánh `MOTORBIKE` trong `buildScheduleRequests` |
| *(Round 2)* PM-BR-07/08 | `executeDepositOffset` |
| *(Round 2)* PM-BR-11 | `confirmTransaction` nhánh CASH OUT |
| *(Round 2)* PM-BR-12/13 | `createRefundTransaction`, `decideRefundApproval` |
| *(Round 2)* RS-BR-11 / RS-BR-13 | `syncFinanceAfterPaymentChange` / đóng PSC |

---

## 5. `permissions.ts` — thêm 7 entry (khối "Nhóm 6 — Tài chính", sau `PAYMENT.RECONCILE`), giữ nguyên entry cũ

| Resource.Action | ADMIN | MANAGER | ACCOUNTANT | OPERATION_STAFF | SALES | `source` |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| `PAYMENT.CREATE` | ✓ | ✓ | ✓ | ✗ | `likeManager` | `Payment-BRD.md §21 — Ghi nhận thu CK/ví · Tạo giao dịch hoàn tiền · (Lập lịch thanh toán)` |
| `PAYMENT.VOID` | ✓ | ✓ | ✓ | ✗ | `likeManager` | `Payment-BRD.md §21 — VOID giao dịch PENDING` |
| `PAYMENT.REVERSE` | ✓ | ✓ | `'TBD'` | ✗ | `likeManager` | `Payment-BRD.md §21 — REVERSED giao dịch CONFIRMED (Accountant TBD — PM §27 Q14)` |
| `PAYMENT.APPROVE` | ✓ | ✓ | ✗ | ✗ | `likeManager` | `Payment-BRD.md §21 — Duyệt hoàn tiền vượt ngưỡng` (dùng ở Round 2, thêm luôn ở Round 1) |
| `PAYMENT.EDIT` | ✓ | `'TBD'` | ✓ | ✗ | `likeManager` (→ `'TBD'`) | `Payment-UseCase.md §27 — Tạo ADJUSTMENT (BRD §21 chưa có dòng — PAYMENT-PLAN.md §0.4 điểm 7)` |
| `PAYMENT.EXECUTE` | ✓ | ✓ | ✓ | ✓ | ✓ | `Payment-BRD.md §21 — Nộp quỹ tiền mặt` |
| `PAYMENT.EXPORT` | ✓ | ✓ | ✓ | ✓ | ✓ | `Payment-BRD.md §21 — Xuất biên lai` |

- `SALES` ≈ `MANAGER` (CR-2026-035, BRD §21 ghi chú) — **khác** Settlement: `PAYMENT.REVERSE` **không** có
  ngoại lệ chặn `SALES` (ngoại lệ CR-2026-035 chỉ áp cho `SETTLEMENT.REVERSE`).
- Dùng lại entry có sẵn: `PAYMENT.VIEW` (xem màn), `PAYMENT.RECORD_CASH` (ghi nhận thu tiền mặt),
  `PAYMENT.CONFIRM` (xác nhận CK/ví, đánh dấu thất bại; Round 2: cấn trừ cọc), `PAYMENT.RECONCILE` (thủ quỹ
  nhận phiếu nộp, đối soát — TODO(OQ: Payment-BRD.md §27 Q11)).
- **Ghi nhận thu**: phương thức `CASH` cần `RECORD_CASH`; `BANK_TRANSFER`/`E_WALLET` cần `CREATE`. Dialog chỉ
  liệt kê phương thức người dùng có quyền.

---

## 6. Audit action mới — nối **cuối** `AUDIT_ACTIONS`

Round 1 — khối comment `// Payment (PM) — PAYMENT-PLAN.md §6 (UC-PM-21), Round 1.`:
`CREATE_PAYMENT_SCHEDULE`, `CREATE_TRANSACTION`, `CONFIRM_TRANSACTION`, `FAIL_TRANSACTION`,
`VOID_TRANSACTION`, `REVERSE_TRANSACTION`, `CREATE_PAYMENT_ADJUSTMENT`, `ISSUE_RECEIPT`,
`SUBMIT_CASH_DRAWER`, `RECEIVE_CASH_DRAWER`.

Round 2 — khối comment `// Payment (PM) — Round 2, PAYMENT-PLAN.md §10.7.`:
`CREATE_PAYMENT_REQUEST`, `CANCEL_PAYMENT_REQUEST`, `OFFSET_DEPOSIT`, `APPROVE_REFUND`, `REJECT_REFUND`.

Ánh xạ sang tên UC-PM-21 §25.3 (để BA đối chiếu): `RECEIVE_REQUEST→CREATE_PAYMENT_REQUEST`,
`CREATE_TXN→CREATE_TRANSACTION`, `CONFIRM_TXN→CONFIRM_TRANSACTION` (gồm sửa số khi xác nhận —
`UPDATE_PENDING_TXN` gộp vào `before/after`), `VOID_TXN`, `REVERSE_TXN`, `OFFSET→OFFSET_DEPOSIT`,
`ADJUSTMENT→CREATE_PAYMENT_ADJUSTMENT`, `REFUND_APPROVE/REJECT`, `CASH_DEPOSIT_SUBMIT→SUBMIT_CASH_DRAWER`,
`RECONCILE→RECEIVE_CASH_DRAWER`, `RECEIPT_ISSUE→ISSUE_RECEIPT`. `entity` = `'Transaction'` /
`'PaymentRequest'` / `'CashDrawerSubmission'`. `REVERSE_TRANSACTION` ghi cả id gốc + id đối ứng + lý do
(AC-PM-015). Ghi ngược trạng thái sang `PaymentRequest`/`Settlement`/PSC do **cùng một thao tác** gây ra
→ nằm trong `after` của audit thao tác đó, **không** sinh bản ghi audit riêng cho từng side-effect.

---

## 7. Màn hình & UI

### 7.1. `TransactionLedgerScreen` — Sổ giao dịch (`/finance/transactions`, thay `ComingSoon`)

- `PageHeader` "Sổ giao dịch" + action: **Ghi nhận thu** (cần `RECORD_CASH` hoặc `CREATE`; dialog chọn
  Rental → chọn yêu cầu đang mở) · **Tạo điều chỉnh** (`PAYMENT.EDIT`).
- Thẻ tổng nhanh (theo bộ lọc hiện tại): Tổng thu hiệu lực · Tổng chi/hoàn hiệu lực · Đang chờ xác nhận
  (số + tiền).
- Bộ lọc: trạng thái, loại, phương thức, hướng, khoảng ngày (`performedAt`), ô tìm theo mã GD / tham chiếu /
  mã lượt thuê.
- Bảng (desktop) / card (≤ md): Mã GD · Thời điểm · Loại · Hướng (badge thu/chi) · Số tiền (`formatVnd`;
  đối ứng hiển thị kèm "Đối ứng của GD-…") · Phương thức · Trạng thái (`TRANSACTION_STATUS_LABELS`) · Lượt
  thuê (link `/rentals/:id?tab=payment`) · Khách · Người thực hiện · Biên lai (số BL hoặc "—").
- Click hàng → `TransactionDetailSheet`: mọi field §2.2, chuỗi đảo (gốc ↔ đối ứng), yêu cầu liên quan,
  các nút hành động hợp lệ (bảng §7.6).
- Rỗng: "Chưa có giao dịch nào khớp bộ lọc."

### 7.2. `RentalPaymentTab` — tab "Thanh toán" ở Rental Detail (export qua barrel, prop `rental`)

Sửa `RentalDetailScreen.tsx`: thay placeholder; `TabsTrigger`/`TabsContent` "payment" chỉ render khi
`can('PAYMENT','VIEW')` (mirror cách gate tab "Quyết toán"). Xoá khoá i18n `vi.rentals.paymentPlaceholder`
nếu hết dùng.

Nội dung:
1. **Tóm tắt** (§2.5): Total Payable (nhãn "ước tính" nếu chưa quyết toán) · Đã thu · Còn lại · Cọc đang giữ ·
   Đã hoàn · badge Payment Status.
2. **Lịch thanh toán 3 mốc** (`buildPaymentSchedule`): mỗi mốc một card — số phải thu / đã thu / đang chờ,
   trạng thái, nút **Ghi nhận thu** trên từng yêu cầu `isRequestActionable`. Mốc `HANDOVER` + `MOTORBIKE` →
   dòng "Cọc xe máy (vật bảo đảm) — không sinh giao dịch tiền" + `securityDepositAssetNote`. Mốc `RETURN`
   Round 1 = "Theo quyết toán" + link `?tab=settlement`.
3. Nếu chưa có yêu cầu nào và `canScheduleRental` → empty state + nút **Lập lịch thanh toán** (`PAYMENT.CREATE`).
   Rental `DRAFT` → thông báo "Lịch thanh toán lập sau khi xác nhận lượt thuê".
4. **Đối chiếu biên bản giao xe** (chỉ đọc, `useHandoverRecords` qua barrel `@/features/handover-return`):
   nếu Handover `COMPLETED` có `prepaymentConfirmed`/`fullPaymentConfirmed = true` mà mốc tương ứng chưa
   `DONE` trong sổ → banner cảnh báo "Biên bản giao xe ghi đã thu nhưng sổ giao dịch chưa ghi nhận đủ".
   Comment: `// PM-BR-21 — chặn giao xe theo mốc thuộc VH/App nhân viên; Webapp chỉ cảnh báo lệch.`
5. **Danh sách giao dịch** của Rental (bảng rút gọn, click → `TransactionDetailSheet`).

### 7.3. `CashDrawerScreen` — Quỹ tiền mặt (`/finance/cash-drawer`, thay `ComingSoon`)

`Tabs` 3 tab, mỗi tab gate theo quyền (ẩn tab không có quyền; nếu không còn tab nào → empty state):

1. **Quỹ của tôi** (`PAYMENT.EXECUTE`): số dư quỹ của người đang đăng nhập (`calcCashDrawerBalance` theo
   `session.userId`), danh sách giao dịch tiền mặt chưa nộp, nút **Nộp quỹ** → `CashDrawerSubmitDialog`
   (hiện số hệ thống, nhập số đếm thực tế, tự tính chênh lệch, bắt buộc lý do khi lệch — AC-PM-009). Lịch sử
   phiếu nộp của tôi.
2. **Các quỹ & phiếu nộp** (`PAYMENT.RECONCILE`): bảng mọi quỹ có số dư ≠ 0 hoặc có phiếu; danh sách phiếu
   `SUBMITTED` → nút **Xác nhận đã nhận** (`RECEIVE_CASH_DRAWER`); phiếu có chênh lệch hiển thị nổi bật
   (`text-status-error`). Tổng CASH IN/OUT theo ngày theo từng quỹ (UC-PM-15 phần tiền mặt).
3. **Đối soát chuyển khoản / ví** (`PAYMENT.CONFIRM`): danh sách giao dịch `BANK_TRANSFER`/`E_WALLET`
   `PENDING`, sắp theo ngày, nút **Xác nhận** / **Thất bại** ngay trên dòng (UC-PM-06, BRD §15.2).

Comment đầu screen: `// TODO(OQ: Payment-BRD.md §27 Q10-Q12 — quỹ theo ca/ngày/điểm, thủ quỹ, xử lý chênh
lệch chưa chốt; demo: quỹ theo người thu, nộp theo ngày, mọi người có PAYMENT.RECONCILE nhận phiếu.)`

### 7.4. Biên lai — `ReceiptDialog` (không có route riêng)

Mở từ `TransactionDetailSheet` / hàng sổ giao dịch / tab Thanh toán của Rental. Giao dịch `CONFIRMED`
chưa có biên lai → nút **Xuất biên lai** (`PAYMENT.EXPORT`) gọi `issueReceipt` (sinh số `BL-…`, audit) rồi
mở dialog; đã có → **Xem biên lai**. Nội dung đúng BRD §18/AC-PM-014: số biên lai, ngày, khách, lượt thuê,
loại khoản, số tiền (số + chữ không bắt buộc), phương thức, người thu/chi; tên công ty placeholder. Biên lai
`voided` → watermark/badge "Đã vô hiệu (giao dịch đã đảo)". **Không** xuất PDF/link chia sẻ (§1.4) — ghi
dòng chú thích "Bản xem trước — xuất PDF ở phiên bản chính thức".

### 7.5. Dialog mới (`features/finance/components/`)

`PaymentScheduleCreateDialog` (xác nhận lập lịch, liệt kê yêu cầu sẽ sinh) · `TransactionRecordDialog`
(nhận `rental` + `request?`; nếu không có `request` thì cho chọn Rental + yêu cầu) · `TransactionConfirmDialog`
· `TransactionReasonDialog` (dùng chung Thất bại/Huỷ/Đảo — prop `mode`; Đảo hiện cảnh báo "sinh giao dịch
đối ứng, biên lai gốc bị vô hiệu") · `PaymentAdjustmentDialog` · `CashDrawerSubmitDialog` ·
`ReceiptDialog` · `TransactionDetailSheet` · `TransactionStatusBadge` · `PaymentRequestStatusBadge`.

### 7.6. Hành động × quyền × trạng thái (Round 1)

| Hành động | Quyền | Điều kiện trạng thái |
| --- | --- | --- |
| Lập lịch thanh toán | `PAYMENT.CREATE` | `canScheduleRental` + Rental chưa có yêu cầu `BOOKING`/`HANDOVER` |
| Ghi nhận thu — CASH | `PAYMENT.RECORD_CASH` | `isRequestActionable`; `amount ≤ remaining` |
| Ghi nhận thu — CK/ví | `PAYMENT.CREATE` | như trên |
| Xác nhận / Thất bại | `PAYMENT.CONFIRM` | `PENDING`, method `BANK_TRANSFER`/`E_WALLET` |
| Huỷ (VOID) | `PAYMENT.VOID` | `PENDING` |
| Đảo (REVERSE) | `PAYMENT.REVERSE` | `CONFIRMED`, không phải bản đối ứng, chưa bị đảo, method ≠ `OFFSET` (đảo OFFSET chỉ do hệ thống khi đảo quyết toán — Round 2) |
| Tạo điều chỉnh | `PAYMENT.EDIT` | — |
| Xuất / xem biên lai | `PAYMENT.EXPORT` | `CONFIRMED` (xem được cả khi `REVERSED`, biên lai vô hiệu) |
| Nộp quỹ | `PAYMENT.EXECUTE` | Quỹ của mình có giao dịch chưa nộp |
| Xác nhận đã nhận phiếu nộp | `PAYMENT.RECONCILE` | Phiếu `SUBMITTED` |

Nút hành động ẩn hẳn khi thiếu quyền (không chỉ disable); API **cũng** kiểm điều kiện trạng thái (không chỉ UI
— bài học N4 Phase 4.1).

### 7.7. Responsive

Như Settlement: bảng chỉ cuộn ngang trong `overflow-x-auto`, ≤ md chuyển card; dialog/sheet dùng `max-w-*`
mặc định (đã sửa gotcha `--spacing-*`); các hàng flex có text dài dùng `min-w-0 truncate`. Kiểm ~375px và ~768px.

---

## 8. Seed (`features/finance/seed.ts`)

### 8.1. Thứ tự trong `seedFinance()` (bắt buộc — tránh phụ thuộc vòng Payment ↔ Settlement)

```text
A. Payment Round 1: PaymentRequest BOOKING/HANDOVER + Transaction mốc 1-2 + CashDrawerSubmission
   ↓  (Round 2: Settlement đọc Paid To Date / Deposit Held từ A thay cho cờ HandoverRecord)
B. Settlement + PSC (code hiện có)
   ↓
C. Payment Round 2: PaymentRequest SETTLEMENT / POST_SETTLEMENT_CHARGE + OFFSET + giao dịch thu/hoàn + duyệt hoàn
```

Round 1 chèn bước A **trước** khối Settlement hiện có trong cùng hàm (hoặc một `registerSeedStep` riêng đặt
trước — `registerSeeds.ts` không đổi vì vẫn chỉ import `finance/seed`). `SEED_VERSION` 14 → **15** (Round 1),
15 → **16** (Round 2).

### 8.2. Dữ liệu Round 1 (tham chiếu `rentalId` thật — `rentals/seed.ts`, cờ `HandoverRecord` ở `handover-return/seed.ts`)

| Rental | Trạng thái Rental | Seed Payment |
| --- | --- | --- |
| `rt_001`–`rt_005` | `DRAFT` | Không có gì (minh hoạ "lập lịch sau khi xác nhận") |
| `rt_006` | `CONFIRMED`, `CASH_20M` | **Không lập lịch** → demo nút "Lập lịch thanh toán" |
| `rt_007` | `CONFIRMED`, `MOTORBIKE` | Lịch đã lập; `BOOKING` có GD `BANK_TRANSFER` **`PENDING`** (demo Xác nhận) |
| `rt_008`–`rt_011` | `CONFIRMED` | Lịch đã lập; trộn: `BOOKING` `FULFILLED` (CASH), `OPEN`, một GD `FAILED` (EX-03), một GD `VOIDED` |
| `rt_012`–`rt_015` | `CONTRACT_CREATED` / `READY_FOR_HANDOVER` | `BOOKING` `FULFILLED`; `rt_014` `HANDOVER` 70% `PARTIALLY_FULFILLED` (AC-PM-004 — trả 2 lần, lần 2 còn `PENDING`) |
| `rt_016`–`rt_026` | Handover `COMPLETED`, cờ `prepaymentConfirmed`/`fullPaymentConfirmed = true` | `BOOKING` + `HANDOVER` 70% + (nếu `CASH_20M`) `DEPOSIT` 20tr — **tất cả `FULFILLED`** để khớp cờ (Round 2 Settlement sẽ đọc số này). Trộn phương thức: CASH, BANK_TRANSFER, E_WALLET, 2 GD `ONLINE_GATEWAY` "SePay (webhook)" |
| 1 Rental bất kỳ trong nhóm trên | — | Thêm 1 cặp đảo (AC-PM-008): GD CASH sai số `REVERSED` + GD đối ứng + GD đúng; số đã thu của mốc vẫn đúng bằng expected |
| `rt_027`–`rt_029` | `CANCELLED` / `NO_SHOW` / `DISPUTED` | Không có giao dịch (hoàn khi huỷ = ngoài phạm vi) |

- Giao dịch CASH gán cho **2 quỹ**: `usr_accountant` và một tài khoản khác có `RECORD_CASH` (lấy `userId`
  thật từ `features/auth/model.ts`). Dùng `performedAt` **tương đối theo ngày hiện tại** (không hardcode ngày)
  để: quỹ của Accountant có 3 GD tiền mặt **hôm nay** chưa nộp (tổng 4.500.000 — tái hiện AC-PM-009); một phiếu
  `RECEIVED` hôm qua có chênh lệch −200.000 + lý do; một phiếu `SUBMITTED` chờ nhận của quỹ còn lại.
- `receipt` đã xuất cho ~5 GD `CONFIRMED`; GD gốc bị đảo có `receipt.voided = true`.
- 1 GD `ADJUSTMENT` (IN, có lý do "chênh lệch làm tròn…").
- Mọi `code`/`receiptNo` tuần tự, không trùng; mọi `PaymentRequest.status` **tính bằng** `deriveRequestStatus`
  (không gõ tay) để seed luôn nhất quán với hàm thuần.

---

## 9. API / hooks / barrel — Round 1

### 9.1. `features/finance/api.ts` (mọi hàm bọc `fakeRequest()`, đọc/ghi storage **trong** callback — N1 Phase 4.1)

Storage key: `PAYMENT_REQUESTS_STORAGE_KEY = 'paymentRequests'`, `TRANSACTIONS_STORAGE_KEY = 'transactions'`,
`CASH_DRAWER_SUBMISSIONS_STORAGE_KEY = 'cashDrawerSubmissions'`.

| Hàm | Ghi chú | Audit |
| --- | --- | --- |
| `listPaymentRequests(filter?: { rentalId?, customerId?, source?, status? })` | | — |
| `listTransactions(filter?: TransactionFilter)` | lọc §7.1, sort `performedAt` giảm dần | — |
| `listCashDrawerSubmissions(filter?)` | | — |
| `createPaymentSchedule(rentalId, actor)` | guard `canScheduleRental` + chưa có yêu cầu mốc → ghi yêu cầu `buildScheduleRequests` | `CREATE_PAYMENT_SCHEDULE` |
| `recordTransaction(input, actor)` | guard quyền-theo-phương-thức ở UI, guard trạng thái ở API: yêu cầu actionable, `amount ≤ remaining`; CASH → `CONFIRMED` + `cashDrawerId`; CK/ví → `PENDING`; cập nhật `status` yêu cầu | `CREATE_TRANSACTION` |
| `confirmTransaction(id, { amount?, note? }, actor)` | chỉ `PENDING` CK/ví; sửa số → lưu `originalAmount`; kiểm lại `amount ≤ remaining`; cập nhật yêu cầu | `CONFIRM_TRANSACTION` |
| `failTransaction(id, reason, actor)` | chỉ `PENDING` | `FAIL_TRANSACTION` |
| `voidTransaction(id, reason, actor)` | chỉ `PENDING` (PM-BR-02) | `VOID_TRANSACTION` |
| `reverseTransaction(id, reason, actor)` | chỉ `CONFIRMED`, không `reversalOfId`, chưa `reversedById`, method ≠ `OFFSET`; tạo GD đối ứng (`code` mới, cùng `cashDrawerId` nếu CASH); gốc → `REVERSED` + `receipt.voided`; cập nhật yêu cầu (có thể lùi về `PARTIALLY_FULFILLED`/`OPEN`) | `REVERSE_TRANSACTION` (gốc + đối ứng + lý do) |
| `createAdjustment(input, actor)` | `CONFIRMED` ngay nếu CASH (gắn quỹ), `PENDING` nếu CK/ví | `CREATE_PAYMENT_ADJUSTMENT` |
| `issueReceipt(transactionId, actor)` | chỉ `CONFIRMED`, chưa có biên lai | `ISSUE_RECEIPT` |
| `submitCashDrawer(input: { countedAmount, varianceReason? }, actor)` | quỹ `cashDrawerIdOf(actor.userId)`; tính lại `systemAmount` trong callback; chặn khi không có GD chưa nộp; bắt buộc lý do khi lệch | `SUBMIT_CASH_DRAWER` |
| `receiveCashDrawerSubmission(id, actor)` | chỉ `SUBMITTED` | `RECEIVE_CASH_DRAWER` |

Không có hàm xoá giao dịch/yêu cầu/phiếu nộp (PM-BR-05, AC-PM-013).

### 9.2. `hooks.ts`

Query key gốc `['finance','payment', …]`. Mọi mutation invalidate `['finance','payment']` (Round 2 thêm
`['finance','settlements']` + PSC — vì có ghi ngược). `useActor` lấy như các hook Settlement hiện có.

### 9.3. `index.ts` (barrel) — Round 1 chỉ thêm

```ts
// PAYMENT-PLAN.md §9.3 — Round 1.
export { TransactionLedgerScreen } from './screens/TransactionLedgerScreen'
export { CashDrawerScreen } from './screens/CashDrawerScreen'
export { RentalPaymentTab } from './components/RentalPaymentTab'
export type { Transaction, PaymentRequest } from './model'
```

---

## 10. Round 2 — Thực thi điều phối của Settlement, hoàn tiền, công nợ

### 10.1. Phụ thuộc

Round 1 `DONE`. Phase 4.1 đã có đủ `SettlementPaymentRequest` + `PostSettlementCharge` (đã xác nhận ở
`finance/model.ts`).

### 10.2. Payment Request từ Settlement / PSC (UC-PM-01)

- `createPaymentRequest` (Settlement, đã có) — trong **cùng callback**, sau khi ghi `SettlementPaymentRequest`,
  ghi thêm `PaymentRequest` (`source = SETTLEMENT`, map §2.1, `settlementId`, `settlementRequestId`). Audit
  `CREATE_SETTLEMENT_*_REQUEST` cũ giữ nguyên + thêm `CREATE_PAYMENT_REQUEST`.
- `createPostSettlementCharge` / `adjustSettlement` (đã có) — cùng cách, `source = POST_SETTLEMENT_CHARGE`,
  `postSettlementChargeId`.
- Seed C: tạo `PaymentRequest` cho mọi `SettlementPaymentRequest` `REQUESTED` và mọi PSC `OPEN` đã seed.

### 10.3. Helper ghi ngược duy nhất — `syncFinanceAfterPaymentChange(rentalId, actorName, now)` (gọi cuối mọi hàm ghi giao dịch/yêu cầu, trong cùng callback)

1. Tính lại `status` mọi `PaymentRequest` của Rental (`deriveRequestStatus`).
2. Nếu Rental có Settlement → ghi `settlement.paymentStatus = deriveRentalPaymentSummary(...).paymentStatus`
   (RS-BR-11, PM-BR-14) — **không** đụng `completedTotals`/`depositReconciliation`/`lines` (RS-BR-12).
3. Với yêu cầu `POST_SETTLEMENT_CHARGE` vừa `FULFILLED` → PSC liên quan `OPEN → CLOSED` (`closedByName` =
   người xác nhận giao dịch, `closeNote` = "Tất toán qua giao dịch GD-…") — AC-PM-012; Settlement gốc không đổi
   (RS-BR-13). Ghi audit `CLOSE_POST_SETTLEMENT_CHARGE` (action đã có).
4. Ngược lại (đảo giao dịch làm yêu cầu PSC rớt khỏi `FULFILLED`) → PSC `CLOSED → OPEN`? **Không tự mở lại** —
   chỉ hiển thị cảnh báo trên PSC "Giao dịch tất toán đã bị đảo" + `TODO(OQ: RS×PM — mở lại PSC khi giao dịch
   tất toán bị đảo, tài liệu chưa nói)`.

### 10.4. Sửa có kiểm soát code Settlement/PSC (chỉ đúng các điểm này)

| Chỗ | Thay đổi |
| --- | --- |
| `calcPaidToDate` / `calcDepositHeld` (`model.ts`) | Đổi chữ ký nhận `(rental, requests, transactions)` thay cho `HandoverRecord`; Paid = Σ hiệu lực của yêu cầu `BOOKING` + `HANDOVER`/`RENTAL_PAYMENT`; Deposit Held = công thức §2.5. Xoá 2 comment `TODO(Phase 4.2)`. Giữ shape `{ prepayment, handoverPayment }` để không phải sửa UI Worksheet. `openSettlement`/`resyncSettlementSources`/seed B gọi theo chữ ký mới (không còn đọc cờ `HandoverRecord` cho mục đích này) |
| Khi Settlement vào `CONFIRMED` (`recordCustomerAck` nhánh `CONFIRMED`, `approveSettlement`) | Gọi `executeDepositOffset` trong cùng callback: nếu `depositReconciliation.depositApplied > 0` và chưa có GD `OFFSET` hiệu lực cho `settlementId` → tạo GD `ADDITIONAL_CHARGE` / `OFFSET` / `IN` / `CONFIRMED` (UC-PM-05, AC-PM-003), kiểm `≤ Deposit Held` (PM-BR-07/08). Audit `OFFSET_DEPOSIT`. TODO(OQ: Payment-BRD.md §27 Q4 / RS §28 Q1 — demo cấn trừ sau khi khách đã xác nhận cả gói ở `PENDING_CUSTOMER`, khớp UC-PM-05 A2) |
| `reverseSettlement` | Trong cùng callback: mọi `PaymentRequest` có `settlementRequestId ∈ cancelledPaymentRequestIds` → `CANCELLED` (UC-PM-01 A1, audit `CANCEL_PAYMENT_REQUEST`); GD `OFFSET` hiệu lực của Settlement → đảo bằng hệ thống (cùng cơ chế `reverseTransaction`, lý do = lý do đảo quyết toán; UC-PM-12 A2). GD thu/hoàn tiền thật đã `CONFIRMED` **giữ nguyên** + banner trên Worksheet "Có giao dịch đã thực thi theo quyết toán cũ — rà soát ở Sổ giao dịch" |
| `closePostSettlementCharge` + nút "Đánh dấu đã tất toán" | Bỏ đường đóng thủ công cho PSC **có** `PaymentRequest` (mọi PSC sau Round 2) — PSC chỉ đóng qua §10.3; nút thay bằng "Ghi nhận thu/hoàn" (mở `TransactionRecordDialog`/`RefundCreateDialog`). PSC "Tạm giữ" (`isPscOnHold`) → chặn ghi nhận giao dịch ở API |
| `SettlementWorksheet` khối yêu cầu thu/hoàn | Thêm trạng thái thực thi (`PaymentRequestStatusBadge` + đã thu/hoàn) cạnh mỗi `SettlementPaymentRequest`, link sang tab Thanh toán |
| `getCompletionBlockers` | **Không đổi** (vẫn chỉ cần có yêu cầu — RS-BR-20; TODO OQ RS §28 Q11 giữ nguyên) |

### 10.5. Hoàn tiền + duyệt (UC-PM-07/08/09, BRD §16)

- `createRefundTransaction(requestId, { amount, method, refundRecipient, reference? }, actor)` — `PAYMENT.CREATE`;
  yêu cầu `purpose = REFUND` actionable; `amount ≤ remaining`; `DEPOSIT_REFUND` thêm `≤ Deposit Held`
  (PM-BR-08); `refundRecipient` bắt buộc (PM-BR-13). Tạo GD `OUT` `PENDING`; nếu `amount > REFUND_APPROVAL_THRESHOLD`
  → `approval.status = PENDING_APPROVAL` (PM-BR-12).
- `REFUND_APPROVAL_THRESHOLD = 1_000_000` — hằng số tạm lấy từ **ví dụ AC-PM-007**,
  `TODO(OQ: Payment-BRD.md §27 Q13 — ngưỡng duyệt hoàn chưa chốt; UC-PM-09 có 2 cấp Manager/Admin, demo 1 cấp)`.
  Hệ quả demo cần biết: hoàn cọc `CASH_20M` (thường > 1tr) **luôn** cần duyệt.
- `decideRefundApproval(txnId, 'APPROVED' | 'REJECTED', note, actor)` — `PAYMENT.APPROVE`; `REJECTED` → GD
  `VOIDED` (`voidReason` = ghi chú từ chối, bắt buộc). Audit `APPROVE_REFUND`/`REJECT_REFUND`.
- `confirmTransaction` cho GD `OUT`: chặn khi `approval.status !== 'APPROVED'` (nếu có approval); CASH OUT →
  gắn quỹ người xác nhận + chặn vượt số dư quỹ (PM-BR-11, UC-PM-14 A2 — không cho âm). GD hoàn `FAILED` →
  yêu cầu vẫn mở, Payment Status giữ `REFUND_PENDING` (AC-PM-006).
- UI: `RefundCreateDialog`, `RefundApprovalDialog`; Sổ giao dịch thêm bộ lọc "Chờ duyệt hoàn"; tab Thanh toán
  của Rental hiện yêu cầu `REFUND`.

### 10.6. Công nợ khách hàng — `CustomerReceivablesScreen` (`/finance/receivables`, thay `ComingSoon`)

Hàm thuần `deriveCustomerBalances(customers, rentals, settlements, pscs, requests, txns)` theo diễn giải §0.4
điểm 5: mỗi khách → `Total Charged` (Σ Final Amount Settlement `CONFIRMED`/`COMPLETED` + Σ PSC `RECEIVABLE` −
Σ PSC `REFUND`), `Total Collected` (Σ IN hiệu lực **trừ `DEPOSIT`** của các Rental đó + PSC), `Outstanding`,
`Credit` (phần âm), `Deposit Held`, "Đã thu trước (chưa quyết toán)". Bảng/card: lọc "Đang nợ" / "Có số dư" /
tất cả, tìm theo tên/SĐT; mở rộng một khách → danh sách lượt (Total Payable / Đã thu / Còn lại / Payment
Status) + PSC chưa tất toán + link Customer Detail & Rental Detail (AC-PM-011, UC-PM-18). `Credit` chỉ hiển thị
— `TODO(OQ: Payment-BRD.md §27 Q8)`; không cảnh báo khi tạo Rental — `TODO(OQ: Payment-BRD.md §27 Q7)`.

### 10.7. Audit Round 2

Xem §6 (5 action). Nối cuối mảng, sau khối Round 1.

### 10.8. Seed C (Round 2) — khớp settlement/PSC đã seed ở `finance/seed.ts`

- `stl_024` (`DEPOSIT_REFUND` `REQUESTED`) → yêu cầu `FULFILLED`: GD `DEPOSIT_REFUND` `BANK_TRANSFER` đã duyệt
  (Manager) + `CONFIRMED`, Payment Status `REFUNDED` (AC-PM-005).
- `stl_025` (`DEPOSIT_REFUND`) → GD hoàn `PENDING` + `approval PENDING_APPROVAL` (demo duyệt).
- `stl_026` (`COLLECT`, `completedWithDebt`) → yêu cầu `PARTIALLY_FULFILLED` (một GD CASH một phần) → khách của
  `rt_026` hiện **Outstanding > 0** ở Công nợ.
- GD `OFFSET` cho mọi Settlement seed `CONFIRMED`/`COMPLETED` có `depositApplied > 0`.
- `psc_002` (`REFUND`) → yêu cầu `FULFILLED` + PSC `CLOSED`; `psc_001` (`RECEIVABLE` 700k — AC-PM-012) → yêu cầu
  `OPEN` (demo thu → PSC tự `CLOSED`); PSC còn lại giữ nguyên trạng thái đã seed, yêu cầu tương ứng nhất quán.
- Không còn PSC nào `CLOSED` mà không có GD tất toán (trừ khi seed hiện có cố ý — `dev` kiểm và báo lại nếu gặp).

### 10.9. Barrel Round 2

`export { CustomerReceivablesScreen } from './screens/CustomerReceivablesScreen'`.

---

## 11. Open Question chặn — xử lý bằng `TODO(OQ)` (không tự chốt)

| # (IMPLEMENTATION-PLAN) | Open Question | Chặn phần nào | Xử lý tạm |
| --- | --- | --- | --- |
| 10 | Ai được `REVERSED` giao dịch `CONFIRMED` — **PM §27 Q14** (BRD §21: Admin ✓ / Manager ✓ / Accountant `TBD`) | Nút/API Đảo giao dịch (R1) | Entry `PAYMENT.REVERSE` giữ `'TBD'` cho Accountant → `can()` = false; TODO tại `reverseTransaction` |
| 11 | Ngưỡng duyệt hoàn tiền — PM §27 Q13 | Hoàn tiền (R2) | `REFUND_APPROVAL_THRESHOLD = 1_000_000` (ví dụ AC-PM-007), 1 cấp duyệt; TODO tại hằng số |
| 12 | Tạo Rental mới cho khách đang nợ, ngưỡng — PM §27 Q7; xử lý Credit/Overpayment — Q8 | Công nợ (R2), ghi nhận thu (R1) | Không cảnh báo/chặn tạo Rental (roadmap); chặn ghi thu vượt `remaining` (không phát sinh Credit từ thu thừa); Credit chỉ hiển thị; TODO tại `recordTransaction` + `deriveCustomerBalances` |
| 13 | Mô hình quỹ (ca/ngày/điểm), thủ quỹ — PM §27 Q10-Q11 (+ Q12 xử lý chênh lệch) | Quỹ tiền mặt (R1) | Quỹ theo người thu, nộp theo ngày, ai có `PAYMENT.RECONCILE` cũng nhận phiếu; chênh lệch chỉ ghi + lý do, không quy trình xử lý; TODO đầu `CashDrawerScreen` + `submitCashDrawer` |
| 14 | Mô hình phí SePay — PM §4.2 | Không chặn code demo | Không ghi phí; `ONLINE_GATEWAY` chỉ trong seed; TODO tại label/seed giao dịch SePay (phí = chi phí công ty → Phase 4.3 `RV`) |

**Open Question phụ cũng chạm code** (không nằm trong 5 câu chặn lõi, xử lý cùng cách):
PM §27 Q4 / RS §28 Q1 (cấn trừ tự động — §10.4) · Q5 / RS §28 Q3 (giữ cọc chờ phạt — hoàn toàn bộ) · Q9 (hạn
thanh toán → không tính `OVERDUE`) · Q15 (hoàn khi huỷ lượt — không build) · Q16 (mẫu/đánh số biên lai — số
tuần tự `BL-000001`) · Q23 (`OWNER_PAYOUT` cùng sổ hay tách — Phase 5) · RS×PM: mở lại PSC khi GD tất toán bị đảo (§10.3).

Không chặn nhưng cần BA xem: 7 điểm §0.4.

---

## 12. Danh sách file `dev` đọc trước khi code (đọc đúng danh sách, không scan rộng)

### 12.1. Round 1

**Tài liệu nghiệp vụ**
- `../thien-bao-car-docs/modules/Payment-BRD.md` §4.1, §6-§10, §13-§15, §17-§18, §20-§22, §23 (EX-02b, EX-03, EX-06), §27.
- `../thien-bao-car-docs/modules/Payment-UseCase.md` §4 (State Models), §5 (UC-PM-01), §10 (UC-PM-06), §15-§18 (UC-PM-11→14), §20 (UC-PM-16), §25 (UC-PM-21) — **bỏ qua** §6.3 và ghi chú §7.3 (sai, §0.1).
- `../thien-bao-car-docs/WebappQuanTri.md` §11.2-§11.4.
- File này: §0-§9, §11.

**Code tham chiếu**
- `src/shared/domain/enums.ts` — khối `TRANSACTION_TYPES` → `PAYMENT_METHODS` (dòng ~180-201), `RENTAL_STATUSES`, cuối `AUDIT_ACTIONS`.
- `src/shared/domain/permissions.ts` — `likeManager()` + khối "Nhóm 6 — Tài chính" (dòng ~322-395).
- `src/shared/i18n/vi.ts` — khối `finance:` (dòng ~994) + `TRANSACTION_STATUS_LABELS` (dòng ~1457) + `SETTLEMENT_PAYMENT_STATUS_LABELS`.
- `src/features/finance/model.ts` (toàn bộ — nắm Settlement/PSC + pattern form schema), `api.ts` dòng 1-135 (storage/actor/guard pattern) + `openSettlement` + `createPaymentRequest`, `hooks.ts` (query key + `useActor`), `index.ts`, `seed.ts` (cấu trúc `seedFinance`).
- Mẫu dialog/screen: `src/features/finance/components/SettlementPaymentRequestDialog.tsx`, `SettlementReverseDialog.tsx` (lý do bắt buộc), `PostSettlementChargeSection.tsx`, `src/features/finance/screens/SettlementListScreen.tsx`.
- `src/features/rentals/model.ts` (interface `Rental` dòng ~14-75), `src/features/rentals/screens/RentalDetailScreen.tsx`, `src/features/rentals/index.ts`.
- `src/features/handover-return/model.ts` dòng ~85-100 (`prepaymentConfirmed`/`fullPaymentConfirmed`) + `handover-return/index.ts`.
- `src/features/auth/model.ts` (`userId` tài khoản demo) + cách lấy session/actor trong `finance/hooks.ts`.
- `src/shared/fixtures/seedAll.ts`, `src/app/routes.tsx`, `src/shared/layout/nav.tsx` (dòng ~94-120), `src/shared/lib/audit.ts`, `src/shared/lib/money.ts`, `src/shared/lib/datetime.ts`.

### 12.2. Round 2 (thêm)

- `Payment-BRD.md` §11, §12, §16, EX-01/04/07; `Payment-UseCase.md` §9 (UC-PM-05), §11-§14 (UC-PM-07→10), §21-§22 (UC-PM-17/18).
- `../thien-bao-car-docs/modules/RentalSettlement-BRD.md` §10, §15, §17 (RS-BR-09/10/11/13/20/21/22).
- `docs/RENTAL-SETTLEMENT-PLAN.md` §0.3, §10.3, §10.6, §10.13.
- `src/features/finance/api.ts` — `recordCustomerAck`, `approveSettlement`, `createPaymentRequest`, `createPostSettlementCharge`, `adjustSettlement`, `closePostSettlementCharge`, `reverseSettlement`, `resyncSettlementSources`; `components/SettlementWorksheet.tsx`, `PostSettlementChargeSection.tsx`, `PostSettlementChargeCloseDialog.tsx`; `seed.ts` (stl_022→026, psc_001→003).
- `src/features/customers/model.ts` (interface `Customer`) + `customers/hooks.ts` (`useCustomers`).

---

## 13. File dự kiến tạo / sửa

**Round 1 — tạo mới:** `src/features/finance/screens/{TransactionLedgerScreen, CashDrawerScreen}.tsx`;
`src/features/finance/components/{RentalPaymentTab, PaymentScheduleCreateDialog, TransactionRecordDialog,
TransactionConfirmDialog, TransactionReasonDialog, PaymentAdjustmentDialog, CashDrawerSubmitDialog,
ReceiptDialog, TransactionDetailSheet, TransactionStatusBadge, PaymentRequestStatusBadge}.tsx`.
**Round 1 — sửa:** `src/features/finance/{model, api, hooks, seed, index}.ts` · `src/shared/domain/enums.ts` ·
`src/shared/domain/permissions.ts` · `src/shared/i18n/vi.ts` · `src/shared/fixtures/seedAll.ts` (15) ·
`src/app/routes.tsx` (2 route) · `src/features/rentals/screens/RentalDetailScreen.tsx` (tab Thanh toán).

**Round 2 — tạo mới:** `screens/CustomerReceivablesScreen.tsx`, `components/{RefundCreateDialog,
RefundApprovalDialog}.tsx`. **Round 2 — sửa:** `finance/{model, api, hooks, seed, index}.ts` +
`components/{SettlementWorksheet, PostSettlementChargeSection, RentalPaymentTab, TransactionLedgerScreen…}`
(+ xoá `PostSettlementChargeCloseDialog.tsx` nếu hết dùng) · `enums.ts` (audit + `REFUND_APPROVAL_STATUSES`
nếu chưa thêm) · `vi.ts` · `seedAll.ts` (16) · `app/routes.tsx` (`/finance/receivables`).

---

## 14. Definition of Done

### 14.1. Round 1

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. 4 enum Payment cũ **không đổi**; enum mới khớp từng ký tự §2.6; audit action chỉ nối cuối mảng; 7 entry
   permission đúng bảng §5, không sửa entry cũ.
3. `git diff` **trống** ở `features/rentals/{model,api,hooks,index,seed}.ts`, `features/handover-return/*`,
   `features/incidents/*`, `features/vehicles/*`, `features/customers/*`; ở `rentals/` chỉ
   `RentalDetailScreen.tsx` đổi (tab Thanh toán). Code Settlement/PSC hiện có **không đổi hành vi** (chỉ thêm
   phần Payment nối tiếp trong cùng file).
4. Không gọi `localStorage` trực tiếp; mọi hàm ghi bọc `fakeRequest()` + `appendAudit()`; không có hàm xoá
   giao dịch; form schema mới được dùng thật trong dialog.
5. Công thức: `isEffectiveTransaction` loại cả cặp đảo; Paid To Date không tính `DEPOSIT`; trạng thái yêu cầu
   luôn suy từ giao dịch; ghi thu vượt `remaining` bị API chặn; `MOTORBIKE` không sinh yêu cầu/giao dịch cọc.
6. Mọi chỗ phụ thuộc OQ §11 có `TODO(OQ: …)` trỏ đúng mã câu hỏi (Q14, không phải Q15).
7. *(Chủ dự án tự test)*: `rt_006` → Lập lịch thanh toán → 3 yêu cầu; ghi thu CASH 30% → mốc `BOOKING` xong,
   quỹ của tôi tăng; `rt_007` → Xác nhận GD CK `PENDING` → `FULFILLED`, không có yêu cầu cọc (xe máy);
   `rt_014` → ghi phần còn lại mốc 70% → `FULFILLED`; Sổ giao dịch → Đảo một GD CASH → sinh đối ứng, biên lai
   gốc "Đã vô hiệu", số đã thu của mốc lùi về đúng; Huỷ một GD `PENDING`; Xuất biên lai; Quỹ tiền mặt → Nộp
   quỹ với số đếm lệch → bắt nhập lý do → đổi vai trò `MANAGER` → Xác nhận đã nhận; đổi `ACCOUNTANT` → không
   thấy nút Đảo (`TBD`); đổi `OPERATION_STAFF` → không thấy menu Sổ giao dịch/Quỹ và tab Thanh toán.
8. `docs/IMPLEMENTATION-PLAN.md` cập nhật; `ComingSoon` `/finance/transactions`, `/finance/cash-drawer` đã thay.

### 14.2. Round 2

1. Như 14.1 điểm 1, 4, 6.
2. `calcPaidToDate`/`calcDepositHeld` không còn đọc cờ `HandoverRecord`; Settlement seed `paidToDate`/`depositHeld`
   khớp sổ giao dịch; mọi `SettlementPaymentRequest` `REQUESTED` có đúng 1 `PaymentRequest` liên kết.
3. `settlement.paymentStatus` luôn bằng giá trị suy ra sau mọi thao tác (ghi thu/xác nhận/đảo/huỷ/duyệt hoàn/đảo
   quyết toán); `completedTotals` của Settlement `COMPLETED` không bao giờ đổi (RS-BR-12/13).
4. `OFFSET` sinh đúng một lần khi Settlement vào `CONFIRMED` (kể cả sau đảo quyết toán rồi chốt lại — OFFSET cũ
   đã bị đảo), không vượt Deposit Held; đảo quyết toán huỷ yêu cầu + đảo OFFSET, giữ GD tiền thật.
5. PSC chỉ đóng qua giao dịch; PSC "Tạm giữ" không ghi nhận được giao dịch; hoàn > ngưỡng phải duyệt trước khi
   xác nhận; CASH OUT không vượt quỹ.
6. *(Chủ dự án tự test)*: `stl_025` → `MANAGER` duyệt hoàn → `ACCOUNTANT` xác nhận đã chi → Payment Status
   `REFUNDED` ở Worksheet; `psc_001` → ghi nhận thu 700k → PSC tự `CLOSED`, Settlement gốc không đổi; `rt_026` →
   thu nốt phần còn lại → Công nợ khách về 0; mở một Settlement `DRAFT` → chốt → khách xác nhận → thấy GD `OFFSET`
   trong Sổ giao dịch; `SYSTEM_ADMIN` đảo quyết toán → yêu cầu `CANCELLED`, OFFSET bị đảo.
7. `IMPLEMENTATION-PLAN.md` cập nhật; `ComingSoon` `/finance/receivables` đã thay.

---

## 15. Phụ thuộc, thứ tự & roadmap

### 15.1. Phụ thuộc & thứ tự làm đề xuất

Round 1 không phụ thuộc gì chưa xong (Phase 4.1 `DONE`, chỉ cần `Rental` + `HandoverRecord` đọc qua barrel).
Round 2 phụ thuộc Round 1. Thứ tự trong Round 1 cho `dev`: enum + label + permission → model + hàm thuần →
api/hooks → seed (+ `SEED_VERSION`) → `RentalPaymentTab` + dialog ghi thu/xác nhận → `TransactionLedgerScreen`
+ sheet/đảo/huỷ/điều chỉnh/biên lai → `CashDrawerScreen` → routes → 3 cổng. Phase 4.3 (`RV`) đọc giao dịch
`CONFIRMED` hiệu lực cho góc nhìn "thực thu" (CR-2026-048) — dùng lại `isEffectiveTransaction`.

### 15.2. Roadmap (ngoài phạm vi, ghi để không quên)

- Tự tạo lịch thanh toán khi Rental `CONFIRMED` (sự kiện backend, §0.3 điểm 9).
- VH/App nhân viên đọc mốc thanh toán từ Payment thay cờ thủ công `prepaymentConfirmed`/`fullPaymentConfirmed` (PM-BR-21).
- Tab "Thanh toán" ở Customer Detail dùng `deriveCustomerBalances` (cần mở `customers/*` có kiểm soát).
- Cảnh báo/chặn tạo Rental cho khách đang nợ (sau khi chốt PM §27 Q7).
- Hoàn tiền khi huỷ lượt / xe hỏng trước giao (PM-BR-23, sau khi chốt PM §27 Q15 + master §51 Q57).
- `OWNER_PAYOUT` từ Owner Payout Record (Phase 5 `VC`).
- SePay thật (webhook, đối soát tự động), xuất PDF/link biên lai, báo cáo dòng tiền (UC-PM-19), cấu hình (UC-PM-20).
