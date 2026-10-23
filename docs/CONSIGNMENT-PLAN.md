# Kế hoạch triển khai — Xe ký gửi (Vehicle Consignment)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (23/10/2026 — `tech-lead` tự duyệt theo giao việc của người
dùng "giao cho tech lead làm phase 5"; không có quyết định nghiệp vụ mới nào cần người dùng chốt — mọi điểm treo xử lý
bằng giả định tạm + `TODO(OQ)` ở §12) · **Round 1 — `DONE` (23/10/2026, review `tech-lead` đạt vòng 1)** · **Round 2 —
`DONE` (23/10/2026, chi tiết §19, review `tech-lead` đạt vòng 1 — nợ "Nên sửa" ghi §18)** · Round 3 — chưa giao (chi tiết hoá
khi tới lượt).

Kế hoạch chi tiết **Phase 5** (`features/consignment`, module `VC`). Chia **3 round**:

- **Round 1** — Hồ sơ chủ xe + Hợp đồng ký gửi `FIXED_MONTHLY` (vòng đời `DRAFT → PENDING_APPROVAL → SIGNED → ACTIVE`,
  `ACTIVE ⇄ SUSPENDED`, `SUPERSEDED`) + Biên bản nhận xe ký gửi (`INTAKE`) + tab "Chủ xe & Ký gửi" ở Vehicle Detail +
  seed. **Không đụng `features/finance`** — số liệu Phase 4 không đổi.
- **Round 2** — Lịch chi trả hàng tháng (Owner Payout Record `SCHEDULED`/`ON_HOLD`/`PAID`/`CANCELLED`, prorate tháng
  đầu/cuối, điều chỉnh thủ công) + Chấm dứt / Đóng hợp đồng + Biên bản trả xe (`RETURN`) + mất xe (UC-VC-12) + nối
  `finance`: chi trả `OWNER_PAYOUT` (Payment) + Cost `CONSIGNMENT_PAYOUT` (Revenue & Cost) + màn "Chi trả chủ xe".
- **Round 3** — Đề nghị ký gửi & thẩm định (UC-VC-01 bước 3–5, UC-VC-02) + Phụ lục / gia hạn (UC-VC-10, AC-VC-012) +
  các điểm nối còn lại có kiểm soát (xem §1.4).

**Nguồn nghiệp vụ (bản chuẩn):** `../thien-bao-car-docs/modules/VehicleConsignment-BRD.md` (v1.7 — toàn bộ; đặc biệt §6,
§7, §9, §10, §13–§15, §17, §18, §19, §21, §23). `VehicleConsignment-UseCase.md` (v1.6) **chỉ dùng** cho luồng bước
UC-VC-01…15 khi BRD không mô tả chi tiết — **không bám UseCase cho ma trận quyền (§20) và các vết sót "chia doanh thu"**
(§0.4). `WebappQuanTri.md` §5.4 (cây điều hướng nhóm 7), §12.1–§12.7. `VehicleManagement-BRD.md` §12.3/§12.4 (tab
Vehicle Detail), `VM-RULE-015`. Phía nối finance (Round 2): `Payment-BRD.md` §6, §8 (`OWNER_PAYOUT`), `PM-BR-16`,
`PM-BR-24`, §27 Q23–Q25 · `RevenueCost-BRD.md` §6.2/§9 (`CONSIGNMENT_PAYOUT`), §11, `RV-BR-19`, §28 Q18/Q19. CR liên quan:
`CR-2026-021/027/028/035/038/049/050/051`.

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/FINANCE-REFACTOR-PLAN.md` (quy tắc thư mục con
`finance` — Round 2), `docs/REVENUE-COST-PLAN.md` (mẫu format), code hiện có: `shared/domain/enums.ts` (`OWNER_TYPES`,
`CONSIGNMENT_CONTRACT_STATUSES` đã scaffold đúng; `PAYOUT_STATUSES` scaffold thiếu — §0.1), `shared/domain/permissions.ts`
(khối `CONSIGNMENT` scaffold **có lỗi** — §0.1 F1), `features/vehicles` (16/18 xe `CONSIGNED`), `features/finance`
(chỗ chừa `CONSIGNMENT_PAYOUT`/`OWNER_PAYOUT`), `SEED_VERSION` = 19.

---

## 0. Cảnh báo & quyết định thiết kế — đọc trước khi code

### 0.1. Phát hiện khi đối chiếu tài liệu với code thật

| # | Phát hiện | Xử lý |
| --- | --- | --- |
| F1 | `permissions.ts` khối "Nhóm 7" khai **2 entry `CONSIGNMENT.EDIT`** (dòng ~473 "Tạo/sửa hồ sơ chủ xe" và ~505 "Điều chỉnh/ON_HOLD Owner Payout Record") — `LOOKUP` ghi đè nên giá trị thực tế của EDIT = entry sau: `SALES: false`, `ACCOUNTANT: true` → nếu dùng EDIT để gate "sửa hồ sơ chủ xe" thì **Accountant sửa được, Sales không** — ngược tài liệu. Ngoài ra `VIEW` cho `OPERATION_STAFF: true` với `source` trỏ `WebappQuanTri.md §12.4` (bảng đó **không có** dòng Xem) trong khi `VehicleConsignment-BRD.md` §18 dòng cuối ghi Operation Staff ✗. "Tạo Owner Payout" đang dùng action `CREATE` — trùng nghĩa với "tạo hồ sơ/hợp đồng" | **Viết lại khối CONSIGNMENT** theo `VehicleConsignment-BRD.md` §18 (bảng §5). Chưa nơi nào trong `src/` gọi `can('CONSIGNMENT', …)` ngoài `nav.tsx` (VIEW) — sửa an toàn. Sửa scaffold cho khớp tài liệu, không phải quyết định nghiệp vụ mới |
| F2 | `PAYOUT_STATUSES = ['SCHEDULED','PAID','ON_HOLD']` — thiếu `CANCELLED` (BRD §6.6, §7.3, UseCase §4.3: 4 trạng thái) | Round 2 nối `'CANCELLED'` vào **cuối** mảng + nhãn |
| F3 | `CONSIGNMENT_CONTRACT_STATUSES` đủ 8 giá trị đúng BRD §6.2 (thứ tự khác BRD nhưng giá trị khớp từng ký tự) · `OWNER_TYPES` đúng | Dùng nguyên, không sắp lại |
| F4 | `PAYMENT_REQUEST_SOURCES`/`PURPOSES` có comment "`CONSIGNMENT`/`PAYOUT` thuộc Phase 5, chưa thêm" · `TRANSACTION_TYPES` đã có `OWNER_PAYOUT` · `COST_CATEGORIES` đã có `CONSIGNMENT_PAYOUT` (không nhập tay) | Round 2 nối `CONSIGNMENT`/`PAYOUT` vào cuối 2 mảng |
| F5 | `PaymentRequest.rentalId`/`customerId` và `Transaction.customerId` đang **bắt buộc** (`finance/core/types.ts`) — trong khi `Payment-BRD.md` §6/`PM-BR-16`/`PM-BR-24`: `OWNER_PAYOUT` gắn **Vehicle Owner + Owner Payout Record thay cho Customer**, không gắn Rental | Round 2 nới kiểu (optional + field chủ xe) và rà mọi chỗ giả định "giao dịch nào cũng có khách" (§9.3) |
| F6 | `finance/revenue-cost/api.ts` `listCostEntries` có comment chừa chỗ `CONSIGNMENT_PAYOUT`; `reportModel.ts` `costPaid` đã lọc `OWNER_PAYOUT` từ sổ giao dịch (`TODO(Phase 5)` "hiện luôn 0"); `VehicleProfitTab.tsx` + `FinanceReportScreen.tsx` có banner "chưa gồm chi trả chủ xe" + `TODO(Phase 5)` | Round 2: nối nguồn, gỡ banner + `TODO(Phase 5)`, **giữ** `TODO(OQ: RevenueCost-BRD.md §28 Q18 …)` |
| F7 | `vehicles/model.ts` `ownershipType` có `TODO(OQ: VM-RULE-015 — chuyển read-only khi VC build)`; `VehicleFormSheet.tsx` vẫn cho sửa tay `ownershipType` | **Không đụng `vehicles` ngoài `VehicleDetailScreen.tsx`** — đồng bộ `Ownership Type` (VC-BR-03 / VM-RULE-015) để roadmap §13 (cần ngoại lệ kiến trúc ghi vào `vehicles/api.ts`) |
| F8 | Seed `vehicles`: 16 xe `CONSIGNED` (`veh_001`…`veh_016`), `veh_007` `MAINTENANCE`, `veh_013` `INACTIVE`; mọi xe ký gửi trừ `veh_007`/`veh_013` đều có lượt thuê đang/sắp chạy | Seed hợp đồng §10: 14 xe có hợp đồng hiệu lực; `veh_007` + `veh_013` là 2 xe "giữa hai hợp đồng" để demo `DRAFT`/`PENDING_APPROVAL` |
| F9 | Nav nhóm 7 có 3 mục; `WebappQuanTri.md` §5.4 liệt kê **4**: Hồ sơ chủ xe · Hợp đồng ký gửi · Lịch chi trả hàng tháng · **Chi trả chủ xe** | Round 2 thêm mục thứ 4 (§9.4) |
| F10 | `features/finance/payment/model.ts` có `nextSequenceCode` nhưng `consignment` **không được import `finance`** (§0.3 điểm 1) | `consignment/model.ts` tự có helper sinh mã tuần tự (3 dòng, mirror) |
| F11 | Không có tiền lệ kiểm quyền ở tầng API (mọi feature chỉ gate UI) | Giữ nguyên tiền lệ; **ngoại lệ duy nhất**: `revealOwnerBankAccount` kiểm `can(actor.role, …)` ở API vì là dữ liệu nhạy cảm (BRD §21) |

### 0.2. Ranh giới kiến trúc — đụng gì, không đụng gì

| Khu vực | Round | Được phép | Không được phép |
| --- | --- | --- | --- |
| `features/consignment/**` (mới) | R1+ | Toàn quyền theo cấu trúc `CONVENTIONS.md` §3 (feature đơn module — **không** chia thư mục con) | Import `@/features/finance` dưới mọi hình thức (§0.3 điểm 1) |
| `features/vehicles/screens/VehicleDetailScreen.tsx` — **ngoại lệ có kiểm soát** (tiền lệ 4.3) | R1 | (1) 1 dòng import `VehicleConsignmentTab` từ `@/features/consignment`; (2) thay đúng `<VehicleDetailPlaceholder note={vi.vehicles.consignmentPlaceholder} />` bằng `<VehicleConsignmentTab vehicle={vehicle} />`; (3) thêm điều kiện `can('CONSIGNMENT','VIEW')` vào **cả** `TabsTrigger` lẫn `TabsContent` của tab `consignment` (ẩn hẳn, mirror gate 3 tab tài chính); (4) sửa docstring cho khớp | Đổi tab khác/thứ tự tab/gate khác; sửa `vehicles/{model,api,hooks,seed,index}.ts` hay component `vehicles/components/*` |
| `features/vehicles/api.ts` | R1 | **Chỉ đọc** `VEHICLES_STORAGE_KEY` (deep import — tiền lệ `rentals`/`contracts` deep-import `@/features/vehicles/api`); UI dùng `useVehicles`/`useVehicle` deep-import `@/features/vehicles/hooks` | Ghi xe (đổi `ownershipType`/`status`) — roadmap §13 |
| `features/rentals` | R2 | **Chỉ đọc** qua deep import `@/features/rentals/api` (`RENTALS_STORAGE_KEY`) + `import type { Rental }` từ `…/model` — **không** barrel (barrel → `RentalDetailScreen` → `finance` → `consignment` = vòng mới; §19.5.3) — để liệt kê lượt thuê đang chạy/đã đặt khi chấm dứt (VC-BR-14, AC-VC-011) | Sửa bất kỳ file nào (chặn lượt thuê mới VC-BR-04 → roadmap) |
| `features/incidents` | R2 | Chỉ đọc qua deep import `@/features/incidents/api` (`INCIDENTS_STORAGE_KEY`) + `import type` từ `…/model` (liên kết sự cố khi mất xe — UC-VC-12, tuỳ chọn) | Sửa |
| `features/finance/**` | R2 | Theo tầng `core ← payment ← settlement ← revenue-cost` (§9) — finance **import** `@/features/consignment` (barrel) | Phá chiều import giữa thư mục con; tạo barrel con |
| `shared/domain/enums.ts` | R1/R2/R3 | Thêm enum mới + nối cuối mảng có sẵn (F2/F4) + nối audit action vào **cuối** `AUDIT_ACTIONS` | Sửa/sắp lại enum khác |
| `shared/domain/permissions.ts` | R1 | Viết lại **đúng khối "Nhóm 7 — Xe ký gửi"** (F1, bảng §5) | Sửa khối khác |
| `shared/i18n/vi.ts` | R1+ | Namespace mới `vi.consignment` + label map mới; **xoá** khoá mồ côi `vi.vehicles.consignmentPlaceholder` (R1) | Sửa chuỗi của feature khác |
| `app/paths.ts` · `app/routes.tsx` | R1/R2 | R1: thêm `consignmentOwnerDetail(id)`, `consignmentContractDetail(id)`; mount 4 screen; `/consignment/payouts` **giữ** `ComingSoon` tới R2. R2: `consignmentOwnerPayouts` | Logic nghiệp vụ |
| `shared/layout/nav.tsx` | R2 | Thêm mục "Chi trả chủ xe" (F9) | R1 không đụng |
| `shared/fixtures/registerSeeds.ts` · `seedAll.ts` | R1 | Import `@/features/consignment/seed` **ngay trước** `@/features/finance/seed` + đoạn docstring; `SEED_VERSION` 19 → 20 | Đổi thứ tự import cũ |
| Mọi feature khác | — | — | Không đụng |

### 0.3. Quyết định thiết kế lõi (kỹ thuật — không phải quyết định nghiệp vụ)

1. **Chiều phụ thuộc `finance → consignment` (một chiều). `consignment` không bao giờ import `finance`.** Lý do:
   - Revenue & Cost là **lớp phân tích đọc dữ liệu nguồn** — tiền lệ đã có: `finance/revenue-cost` đọc `incidents`/
     `maintenance`/`rentals` qua barrel (storage key + type) rồi suy ra `CostEntry`. `RevenueCost-BRD.md` §11: Cost
     `CONSIGNMENT_PAYOUT` "phát sinh mỗi tháng khi … Owner Payout Record được sinh" → nguồn chi phí **là Owner Payout
     Record của VC** (ghi nhận theo dồn tích, không đợi chi). Nếu đảo chiều (VC ghi vào finance) thì phải nhân bản bản
     ghi sang `costRecords` và đồng bộ mỗi lần điều chỉnh/huỷ — dễ lệch.
   - Payment là nơi **thực thi** chi (BRD §6.7, §14; `Payment-BRD.md` §8): `PaymentRequest`/`Transaction` thuộc
     `finance/payment`. Ghi ngược trạng thái `PAID` về VC theo đúng tiền lệ "module nguồn export hàm `mark…` thuần,
     finance gọi trong callback `fakeRequest`" (`rentals` export `markSettlementOpened`/`revertSettlementReversed`).
   - Hệ quả UI: màn **"Chi trả chủ xe"** (mục thứ 4 nhóm 7 — `WebappQuanTri.md` §5.4) là screen **của `finance/payment`**
     mount ở path `/consignment/owner-payouts` (app layer mount screen của bất kỳ feature nào — tiền lệ
     `/schedule/dispatch` của `calendar`). Màn "Lịch chi trả hàng tháng" `/consignment/payouts` là của VC; nút "Chi trả"
     ở đó chỉ là `Link` tới path (`@/app/paths`), không import `finance`.
   - Đã kiểm: repo hiện có vòng import cấp barrel (`vehicles ↔ finance`, `rentals ↔ finance`) — chạy được vì không dùng
     import ở top-level, nhưng **không thêm vòng mới**: `consignment` chỉ import `auth`, `vehicles` (hooks/api deep),
     `rentals`/`incidents` (barrel, R2), `@/app/paths`, `shared/*`.
2. **Một hợp đồng = một xe** (CR-2026-051, BRD §6.2) — `vehicleId` + `ownerId` bắt buộc, cố định sau khi tạo (muốn đổi →
   "Thay bằng bản mới" UC-VC-03 A2).
3. **Hợp đồng chỉ tạo cho xe đã có trong Vehicle Management với `ownershipType = CONSIGNED` và chưa có hợp đồng "mở"**
   (`DRAFT`/`PENDING_APPROVAL`/`SIGNED`/`ACTIVE`/`SUSPENDED`). Lý do: R1 không ghi `vehicles` (F7) nên không thể tự đặt
   `CONSIGNED` khi `ACTIVE`; luồng demo xe mới = tạo xe ở Danh sách xe (hình thức Ký gửi) → tạo hợp đồng. Chặn hợp đồng
   mở thứ 2 cho cùng xe chặt hơn VC-BR-01 một chút (VC-BR-01 chỉ nói `ACTIVE`/`SIGNED`/`SUSPENDED`) — đồng bộ UC-VC-01 A1
   (từ chối đề nghị khi xe đang có hợp đồng hiệu lực) và tránh 2 bản nháp song song; thay bản cũ dùng UC-VC-03 A2.
   Ghi `// BA đề xuất` tại hàm guard.
4. **Kích hoạt là thao tác tường minh** ("Kích hoạt hợp đồng", gate `APPROVE`) chứ không tự `ACTIVE` khi lưu biên bản
   nhận xe — để thể hiện được `AC-VC-001` (thử kích hoạt khi chưa có biên bản → bị từ chối) và UC-VC-04 A2 (thiếu giấy tờ
   gốc → Manager quyết định kích hoạt hay chờ). Diễn giải §0.4 điểm 6.
5. **Duyệt = xác nhận đã ký**: state machine BRD §7.2/UseCase §4.2 đi thẳng `PENDING_APPROVAL → SIGNED` (không có trạng
   thái "đã duyệt chưa ký") → một thao tác "Duyệt & xác nhận đã ký" (gate `APPROVE`) nhận tên file bản scan (upload giả
   lập — tiền lệ `ContractSignDialog`) và **chốt `termsSnapshot` + `termVersions[0]`** (VC-BR-05). Sau `SIGNED` mọi điều
   khoản bất biến (đổi chỉ qua phụ lục — Round 3).
6. **`termVersions[]` dựng từ R1** (R1 chỉ có 1 phần tử `ORIGINAL`): Round 2 tính tiền theo phiên bản điều khoản hiệu lực
   tại tháng; Round 3 nối phụ lục vào mảng → R2 không phải sửa công thức khi R3 tới (AC-VC-012).
7. **Biên bản nhận/trả xe ký gửi là entity riêng** `ConsignmentHandoverRecord` (`type` `INTAKE`/`RETURN` — BRD §6.3),
   không dùng lại `features/handover-return` (đó là giao/nhận với **khách thuê**, vòng đời khác). `Appraised Value` nằm ở
   biên bản `INTAKE` (BRD §6.3, VC-BR-16). Ảnh/video = ghi chú giả lập (tiền lệ `handover-return`).
8. **Che số tài khoản ngân hàng** (BRD §21, UC-VC-14 bước 2–3): UI luôn hiện dạng `••••6789`; nút "Hiện đầy đủ" gọi
   `revealOwnerBankAccount()` → trả số đầy đủ + `appendAudit` (meta-audit `VIEW_OWNER_BANK_ACCOUNT`). Form sửa hồ sơ
   **không** điền sẵn số tài khoản (ô trống = giữ nguyên số cũ, placeholder hiện số đã che). Payload `before`/`after` của
   audit **luôn** qua `toOwnerAuditSnapshot()` (che số tài khoản + CCCD/MST). Bản prototype: API vẫn trả dữ liệu đầy đủ
   (storage nằm ở trình duyệt) — ghi vào docstring `api.ts`: backend thật phải che ở tầng API (`ARCHITECTURE.md` §8.5).
9. **Form**: `features/consignment` là feature mới → theo quy ước chung `react-hook-form` + `zod` (`CONVENTIONS.md` §7);
   **không** áp ngoại lệ `useState` + `safeParse` của `finance`. Mọi schema ở `model.ts` và **được dùng thật**
   (`zodResolver`). Round 2 phần nằm trong `finance/payment` theo ngoại lệ của `finance`.
10. **Mọi đọc/guard nằm trong callback `fakeRequest`** (bài học Phase 4.1 — không đọc storage trước `fakeRequest` rồi ghi
    sau độ trễ). Hàm ghi `mark…` export cho `finance` là hàm **đồng bộ thuần** (không `fakeRequest`) để gọi trong callback
    của finance — mirror `rentals/api.ts` `markSettlementOpened`.
11. **Ngày**: field ngày nghiệp vụ lưu `YYYY-MM-DD` theo **ngày địa phương** (helper `toLocalDateKey` riêng trong
    `consignment/model.ts`, mirror `finance/revenue-cost/model.ts`) — **không** dùng `toISOString().slice(0, 10)` (lệch
    ngày theo UTC). Mốc thời điểm (`createdAt`, `handoverAt`, `activatedAt`…) lưu ISO.
12. **Ngưỡng nhắc** (VC-BR-19/20) là hằng số trong `model.ts` (`CONSIGNMENT_EXPIRY_REMINDER_DAYS = 30`,
    `CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS = 3`) + `TODO(OQ)` "cấu hình được" (CR-2026-051 Q20) — R1/R2 chỉ hiện **badge**
    trên màn; sự kiện `Notification` thật (`CONSIGNMENT_CONTRACT_EXPIRING`/`CONSIGNMENT_PAYMENT_DUE`) để Phase 6.

### 0.4. Điểm tài liệu chưa nhất quán / diễn giải — ghi lại cho BA, không tự sửa tài liệu

1. **Ma trận quyền UseCase §20 lệch BRD §18**: UseCase để `SALES` = `TBD`/✗ ở nhiều dòng (tạo hồ sơ, soạn hợp đồng, duyệt,
   chấm dứt, nhận/trả xe, xem) trong khi BRD §18 (đã cập nhật CR-2026-035) và `WebappQuanTri.md` §12.4 ghi Sales = Manager.
   → **Bám BRD §18**.
2. **BRD §18 tự mâu thuẫn ở 2 dòng**: (a) ghi chú đầu bảng "mọi ô Sales = ô Manager", nhưng dòng "Điều chỉnh thủ công Owner
   Payout Record (`Adjustment`/`ON_HOLD`)" có Manager ✓ / Sales ✗ (WebappQuanTri §12.4 cũng ✗) → **giữ đúng chữ ✗**; (b)
   Operation Staff ✓ "Thẩm định (phần hiện trạng)" + ✓ "Nhận/trả xe ký gửi" nhưng ✗ "Xem hợp đồng ký gửi / lịch chi trả"
   → không vào được màn để lập biên bản. **Giữ đúng chữ** (VIEW ✗ → nhóm 7 + tab ở Vehicle Detail ẩn với
   `OPERATION_STAFF`); `ASSESS`/`EXECUTE` vẫn khai `true` cho đúng ma trận. Hỏi BA: Operation Staff có cần quyền xem tối
   thiểu hợp đồng để lập biên bản không.
3. **`Due Date` của Owner Payout Record**: BRD §10/§13 + UC-VC-06 ghi "`Due Date` = `Payment Day` của tháng (đó)", còn
   `AC-VC-013` ví dụ cụ thể: kỳ **tháng 9**, `Payment Day` = 5 → `Due Date` = **05/10** (trả sau). → **Bám AC-VC-013**:
   `dueDate` = `Payment Day` của **tháng kế tiếp** kỳ (Round 2). Hỏi BA chốt lại câu chữ §10/§13.
4. **`Recognition Date` của `CONSIGNMENT_PAYOUT`** = "tháng chi trả" (`RevenueCost-BRD.md` §9, `RV-BR-19`, §28 Q19) — mơ hồ
   giữa *tháng được trả cho* (kỳ) và *tháng thực chi* (kỳ + 1 theo điểm 3). Bản trước CR-2026-050 chốt "= kỳ Owner
   Statement". → **Ghi nhận theo kỳ** (`costDate` = ngày 1 của tháng kỳ) — đúng nguyên tắc chi phí khớp tháng xe được khai
   thác (Round 2).
5. **Tên thực thể trùng nghĩa**: UseCase §4.1 gọi máy trạng thái **thẩm định** (`SUBMITTED → APPRAISING → APPROVED/
   REJECTED`) là "Consigned Vehicle Intake", trong khi BRD §6.3 dùng "Consigned Vehicle Intake / Return" cho **biên bản
   bàn giao** (`INTAKE`/`RETURN`). → Code đặt tên tách bạch: `ConsignmentProposal` (đề nghị + thẩm định, Round 3) và
   `ConsignmentHandoverRecord` (biên bản, R1/R2).
6. **Kích hoạt tự động hay thủ công**: UC-VC-04 bước 6 "Khi Intake hoàn tất → System chuyển ACTIVE", nhưng `AC-VC-001`
   ("nhân viên thử chuyển hợp đồng sang ACTIVE → từ chối") và UC-VC-04 A2 ("Manager quyết định ACTIVE hay chờ") ngụ ý thao
   tác tay → demo dùng thao tác tường minh (§0.3 điểm 4).
7. **Vết sót mô hình cũ trong UseCase**: UC-VC-09 §13.1 "Chi trả **phần doanh thu** cho chủ xe", §13.4 "`Purpose = PAYOUT`"
   (BRD §6.7 ghi `Purpose = OWNER_PAYOUT`, còn `Payment-BRD.md` §6 dùng `Purpose = PAYOUT` + `Type = OWNER_PAYOUT`); §19
   VC-BR-05 "cấu hình chia", VC-BR-12 "phần chia chủ xe". → Bám `Payment-BRD.md` §6/§8: `Source = CONSIGNMENT`,
   `Purpose = PAYOUT`, `Transaction.type = OWNER_PAYOUT`.
8. **VM BRD §12.3/§12.4 tách 2 tab** "Owner/Partner" + "Consignment Contract"; app đã chốt 1 tab gộp "Chủ xe & Ký gửi" từ
   Phase 1 (`VEHICLE-MANAGEMENT-PLAN.md`) → giữ 1 tab, trình bày 2 khối (Chủ xe · Hợp đồng hiện hành) + lịch sử hợp đồng
   của xe; khối "lịch chi trả gần nhất" (§12.4) thêm ở Round 2.
9. **`Payment Day` > số ngày của tháng** (vd ngày 31, tháng 2) — tài liệu không nói → **BA đề xuất**: lấy ngày cuối tháng
   (Round 2). Nhập 1–31.
10. **Làm tròn prorate** (`9.000.000 × 10/28` lẻ) — tài liệu không nói → `Math.round` về đồng + `TODO(OQ)` (cùng nhóm câu làm
    tròn còn treo `RentalSettlement-BRD.md` §28 Q5–Q8).
11. **Mã `Proration Rule`** — BRD §6.4 chỉ mô tả "prorate theo ngày / trả tròn tháng — mặc định prorate" → mã
    `PRORATE_BY_DAY` / `FULL_MONTH` là **BA đề xuất**.
12. **Hợp đồng `SUSPENDED` "trừ khi Terms Snapshot ghi khác"** (§9E, §10) — tài liệu không mô tả phương án khác → chỉ
    hiện "Khi tạm ngưng: vẫn chi trả đủ (mặc định)" + `TODO(OQ)`; không dựng tuỳ chọn khác.
13. **Field bắt buộc của hồ sơ chủ xe** — BRD §6.1 không đánh dấu bắt buộc → BA đề xuất tối thiểu: `ownerType`, họ tên /
    tên tổ chức, SĐT (9–11 chữ số, mirror `customers`), CCCD (cá nhân) / MST (tổ chức). Tài khoản ngân hàng **tuỳ chọn** khi
    lưu hồ sơ (thiếu → Round 2 tạm giữ chi trả — BRD §6.6 `ON_HOLD` "chủ xe chưa cung cấp tài khoản"). Không đặt định dạng
    CCCD/MST cứng (mirror `customers`: chỉ bắt buộc không rỗng).
14. **Quyền xem đầy đủ số tài khoản** (BRD §21 "chỉ vai trò có quyền") chưa nêu vai trò → BA đề xuất: người có
    `CONSIGNMENT.CREATE` (nhập/sửa hồ sơ) hoặc `CONSIGNMENT.CONFIRM` (người chi) — `TODO(OQ)`.

---

## 1. Phạm vi & chia Round

### 1.1. Vì sao 3 round

Lõi nghiệp vụ VC (BRD §22, UseCase §26) = **quản lý hợp đồng + sinh lịch chi trả + tạo Owner Payout**. Ba khối có ranh
giới tự nhiên và phụ thuộc một chiều: R1 (hồ sơ + hợp đồng — không đụng tài chính, số liệu Phase 4 giữ nguyên, rủi ro
thấp) → R2 (tiền: lịch chi trả, chấm dứt có prorate tháng cuối, nối `finance` — đổi số liệu Phase 4, rủi ro cao nhất, cần
kiểm chứng tay) → R3 (mở rộng vòng đời: đề nghị/thẩm định trước hợp đồng, phụ lục sau hợp đồng). Gộp R2 vào R1 sẽ làm
round đầu vừa dựng feature mới vừa sửa `finance/payment` (kiểu `Transaction`) — quá rộng cho một lượt review.

### 1.2. Trong phạm vi — Round 1

1. Enum/permission/i18n nền (§2.6, §5, §8).
2. **Hồ sơ chủ xe** (UC-VC-01 bước 1–2, A2): danh sách `/consignment/owners` + chi tiết `/consignment/owners/:id` (Hồ sơ ·
   Xe & hợp đồng · Nhật ký) + tạo/sửa (Sheet) + xem đầy đủ số tài khoản có meta-audit.
3. **Hợp đồng ký gửi** (UC-VC-03, UC-VC-04, UC-VC-05, UC-VC-10 phần tạm ngưng/khôi phục): danh sách `/consignment/contracts`
   + chi tiết `/consignment/contracts/:id` (Tổng quan & điều khoản · Biên bản nhận/trả xe · Nhật ký); tạo/sửa `DRAFT` (gồm
   cấu hình `Fixed Monthly Amount` + `Payment Day` + `Proration Rule`), trình duyệt, trả về nháp (có lý do), duyệt & xác
   nhận đã ký (chốt snapshot), lập biên bản nhận xe (`INTAKE`), kích hoạt (VC-BR-01/02), tạm ngưng / khôi phục (có lý do),
   thay bằng bản mới (`SUPERSEDED`); xem "bản nháp hợp đồng" = bảng trường trộn (merge-field) giả lập.
4. **Tab "Chủ xe & Ký gửi"** ở Vehicle Detail: hồ sơ chủ xe (đã che) + hợp đồng hiện hành + biên bản nhận xe + lịch sử hợp
   đồng của xe.
5. Badge nhắc "Sắp hết hạn" (≤ 30 ngày tới `effectiveTo` — VC-BR-19).
6. Seed 10 chủ xe · 19 hợp đồng (7/8 trạng thái — §10) · 16 biên bản `INTAKE` + 2 `RETURN`; `SEED_VERSION` 20.

### 1.3. Trong phạm vi — Round 2 (phác thảo — bản chi tiết đã duyệt ở **§19**, §19 thắng khi khác)

1. Owner Payout Record: sinh lịch theo tháng (UC-VC-06, VC-BR-21), prorate tháng đầu/cuối (AC-VC-014/015), `ON_HOLD` ⇄
   `SCHEDULED` (UC-VC-08 A1), điều chỉnh thủ công + duyệt (UC-VC-08 A2), `CANCELLED` + bản prorate thay thế (UC-VC-06 A1);
   màn **Lịch chi trả hàng tháng** `/consignment/payouts` (gộp tổng theo chủ xe — BRD §13) + tab "Lịch chi trả" ở chi tiết
   hợp đồng / chủ xe + khối "chi trả gần nhất" ở tab Vehicle Detail; badge tới hạn (−3 ngày, VC-BR-20) / quá hạn.
2. Chấm dứt (`TERMINATED`, có thông báo trước — Notice Period, liệt kê lượt thuê đang chạy/đã đặt — VC-BR-14, AC-VC-011),
   Đóng (`CLOSED` — cần biên bản `RETURN` VC-BR-15 + mọi khoản đã `PAID` UC-VC-11 A2), mất xe (UC-VC-12 / AC-VC-015 — không
   cần `RETURN`, hiện `Appraised Value` tham chiếu, bồi thường ngoài hệ thống), biên bản trả xe `RETURN`.
3. Nối `finance` (§9): `OWNER_PAYOUT` qua `PaymentRequest` `CONSIGNMENT`/`PAYOUT`, ghi ngược `PAID`, `REVERSED` → về
   `SCHEDULED` (VC-BR-13); màn **Chi trả chủ xe** + công nợ chủ xe (BRD §14, `PM-BR-24`); Cost `CONSIGNMENT_PAYOUT`
   (`RV-BR-19`); gỡ banner/`TODO(Phase 5)`.
4. Seed lịch chi trả lịch sử + giao dịch chi tương ứng; `SEED_VERSION` 21.

### 1.4. Trong phạm vi — Round 3 (phác thảo)

1. **Đề nghị ký gửi & thẩm định** (`ConsignmentProposal` `SUBMITTED → APPRAISING → APPROVED/REJECTED` — UC-VC-01 bước 3–5,
   UC-VC-02, EX-01) — siết điều kiện tạo hợp đồng: phải từ đề nghị `APPROVED` (UC-VC-03 §7.3); hợp đồng kế thừa xe + mức kỳ
   vọng; thẩm định gate `ASSESS`, duyệt/từ chối gate `APPROVE`.
2. **Phụ lục / gia hạn** (UC-VC-10 §14.4, AC-VC-012): phụ lục có ngày hiệu lực nối `termVersions[]` (gia hạn `effectiveTo`,
   đổi `Fixed Monthly Amount`/`Payment Day`), bản ký giả lập; `Auto Renew` = nút "Tạo phụ lục gia hạn" gợi ý khi tới hạn (không
   có tác vụ nền).
3. Ứng viên (cần người dùng duyệt ngoại lệ kiến trúc nếu muốn đưa vào): mốc `CONSIGNMENT_INTAKE`/`CONSIGNMENT_RETURN` trên
   Vehicle Condition Timeline (`vehicles/components/VehicleConditionTimelineTab.tsx`); nhãn "Xe ký gửi + tên chủ xe + mã hợp
   đồng" ở tab Tổng quan xe (VM BRD §12 dòng Ownership Type).

### 1.5. Ngoài phạm vi cả Phase 5 — lý do

| Hạng mục | Lý do |
| --- | --- |
| Đồng bộ `Ownership Type` khi `ACTIVE`/`CLOSED`/`TERMINATED` (VC-BR-03, VM-RULE-015) + khoá sửa tay ở form xe | Ngoại lệ kiến trúc ghi vào `vehicles/api.ts` + `VehicleFormSheet.tsx` — roadmap §13, cần người dùng duyệt riêng |
| Chặn gán lượt thuê mới cho xe thuộc hợp đồng `SUSPENDED`/`TERMINATED`/`CLOSED` (VC-BR-04) | Phải sửa `rentals/model.ts`/`api.ts` (đọc VC) — roadmap §13; R1/R2 chỉ hiện cảnh báo trên màn VC + tab xe |
| Sự kiện `Notification` cho VC-BR-19/20 | `features/notifications` là Phase 6 — chỉ badge |
| Cổng chủ xe tự phục vụ, chữ ký điện tử, chi trả tự động qua API ngân hàng | Phase sau theo BRD §4.2 |
| PDF hợp đồng thật | Khách chưa cấp `.docx` (CR-2026-049) — chỉ bảng trường trộn giả lập; **không** tự soạn điều khoản pháp lý |
| Khấu trừ thuế TNCN, phí phạt chấm dứt, bồi thường mất xe | Ngoài phạm vi hệ thống (BRD §4.2, CR-2026-050/051) |
| Xoá hồ sơ chủ xe / hợp đồng | VC-BR-18 — chỉ đổi trạng thái; không có hàm `remove` |

---

## 2. Data model (`features/consignment/model.ts`)

### 2.1. `VehicleOwner` — lưu, storage key `vehicleOwners` (BRD §6.1, CR-2026-027/051)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | `own_…` |
| `code` | `string` | `CX-000001` tuần tự (sinh trong callback `fakeRequest`) |
| `ownerType` | `OwnerType` | `INDIVIDUAL`/`ORGANIZATION` |
| `fullName` | `string` | Họ tên hoặc tên tổ chức — bắt buộc |
| `idNumber?` | `string` | CCCD — **bắt buộc khi `INDIVIDUAL`**, bỏ khi `ORGANIZATION` |
| `taxCode?` | `string` | MST — **bắt buộc khi `ORGANIZATION`**, bỏ khi `INDIVIDUAL` |
| `dateOfBirth?` | `string` `YYYY-MM-DD` | Chỉ `INDIVIDUAL`, tuỳ chọn; UI tự tính tuổi (CR-2026-051 Q19) |
| `gender?` | `OwnerGender` = `'MALE' \| 'FEMALE' \| 'OTHER'` | Chỉ `INDIVIDUAL`, **tuỳ chọn** (kiểu cục bộ trong `model.ts`, cùng giá trị `customers`) |
| `address?` · `email?` | `string` | Tuỳ chọn |
| `phone` | `string` | Bắt buộc, 9–11 chữ số |
| `bankAccount?` | `{ accountNumber: string; bankName: string; accountHolder: string }` | Tuỳ chọn; nhập thì đủ 3 field |
| `note?` | `string` | |
| `createdByName` · `createdAt` · `updatedAt` | | |

Khi đổi `ownerType` sang `ORGANIZATION` → API xoá `idNumber`/`dateOfBirth`/`gender`; sang `INDIVIDUAL` → xoá `taxCode`.

### 2.2. `ConsignmentContract` — lưu, storage key `consignmentContracts` (BRD §6.2 "Consignment Agreement")

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` · `contractNo` | `string` | `cg_…` · `HDKG-000001` tuần tự |
| `ownerId` · `vehicleId` | `string` | Bắt buộc, cố định sau khi tạo (§0.3 điểm 2) |
| `status` | `ConsignmentContractStatus` | |
| `effectiveFrom` · `effectiveTo` | `YYYY-MM-DD` | `effectiveTo > effectiveFrom` |
| `noticePeriodDays` | `number` | Số nguyên ≥ 0, bắt buộc (không đặt mặc định) |
| `autoRenew` | `boolean` | R1 chỉ lưu/hiển thị; hành vi gia hạn ở R3 |
| `paymentTerm` | `ConsignmentPaymentTerm` = `{ model: 'FIXED_MONTHLY'; fixedMonthlyAmount: number; paymentDay: number; prorationRule: ConsignmentProrationRule }` | Sửa được khi `DRAFT` (UC-VC-05); `fixedMonthlyAmount` nguyên > 0; `paymentDay` 1–31; mặc định `PRORATE_BY_DAY` |
| `exploitationRights` | `{ thirdPartyPlatformAllowed: boolean; advertisingImageAllowed: boolean; usageScopeNote?: string }` | BRD §9C ("cho thuê tự lái" là cố định, không phải field) |
| `termsSnapshot?` | `ConsignmentTermsSnapshot` | Chốt khi `SIGNED` (VC-BR-05): `snapshotAt`, `effectiveFrom/To`, `noticePeriodDays`, `autoRenew`, `paymentTerm`, `exploitationRights`, `responsibilityMatrix: ResponsibilityItemKey[]`, `owner: { code, fullName, ownerType }`, `vehicle: { plate, brand, model, manufacturingYear?, color? }` — **không** chép số tài khoản/CCCD vào snapshot |
| `termVersions` | `ConsignmentTermVersion[]` = `{ versionNo; effectiveFrom; paymentTerm; source: 'ORIGINAL' \| 'ADDENDUM'; createdAt }[]` | `[]` tới khi `SIGNED`; ký → 1 phần tử `ORIGINAL` (R3 nối phụ lục) |
| `signedCopy?` | `{ fileName; uploadedByName; uploadedAt }` | Upload giả lập |
| `intakeRecordId?` | `string` | Gán khi lập biên bản `INTAKE` |
| `activatedAt?` | ISO | Mốc bắt đầu tính chi trả ở R2 (cùng `effectiveFrom`) |
| `supersedesContractId?` · `supersededByContractId?` | `string` | UC-VC-03 A2 |
| `statusHistory` | `{ from?: Status; to: Status; at: string; byName: string; reason?: string }[]` | Mọi chuyển trạng thái (cả lúc tạo: `from` rỗng → `DRAFT`) |
| `note?` · `createdByName` · `createdAt` · `updatedAt` | | |

R2 sẽ thêm (không khai ở R1): `terminationNotice?`, `endedDate?`, `endReason?`, `returnRecordId?`.

### 2.3. `ConsignmentHandoverRecord` — lưu, storage key `consignmentHandoverRecords` (BRD §6.3)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` · `code` | `string` | `cgh_…` · `BBKG-000001` |
| `type` | `ConsignmentHandoverType` | `INTAKE` (R1 tạo qua UI) / `RETURN` (R1 chỉ seed; R2 tạo qua UI) |
| `contractId` · `vehicleId` · `ownerId` | `string` | Copy từ hợp đồng |
| `handoverAt` | ISO | |
| `odoKm` | `number` | Nguyên ≥ 0 |
| `fuelLevel` | `number` | 0–100 (% — mirror `Vehicle.fuelLevel`) |
| `baselineCondition` | `string` | Mô tả hiện trạng, bắt buộc |
| `checklist` | `{ item: string; ok: boolean; note?: string }[]` | Mặc định 3 mục theo BRD §8: Ngoại thất · Nội thất · Máy móc (nhãn ở `vi.ts`) |
| `accessories` | `string[]` | Phụ kiện đi kèm (nhập tự do, phân tách dòng) |
| `documentsReceived` | `{ name: string; kind: 'ORIGINAL' \| 'COPY' }[]` | Đăng ký xe / đăng kiểm / bảo hiểm — bản gốc / bản sao |
| `missingDocumentsNote?` | `string` | UC-VC-04 A2 |
| `mediaNote?` | `string` | Ghi chú ảnh/video (giả lập) |
| `appraisedValue?` | `number` | Chỉ `INTAKE`, bắt buộc khi `INTAKE` (VC-BR-16) |
| `companyRepName` | `string` | Đại diện công ty |
| `ownerConfirmed` · `companyConfirmed` | `boolean` | Cả hai phải `true` mới lưu được (UC-VC-04 bước 5, VC-BR-15) |
| `createdByName` · `createdAt` | | Append-only — R1 không có sửa/xoá biên bản |

### 2.4. Hằng số & kiểu phụ

- `EFFECTIVE_CONTRACT_STATUSES = ['SIGNED','ACTIVE','SUSPENDED']` — VC-BR-01.
- `OPEN_CONTRACT_STATUSES = ['DRAFT','PENDING_APPROVAL','SIGNED','ACTIVE','SUSPENDED']` — guard tạo hợp đồng (§0.3 điểm 3,
  BA đề xuất).
- `CONSIGNMENT_EXPIRY_REMINDER_DAYS = 30` (VC-BR-19), `CONSIGNMENT_PAYMENT_DUE_REMINDER_DAYS = 3` (VC-BR-20, dùng R2) —
  `TODO(OQ: VehicleConsignment-BRD.md §23 Q20 — ngưỡng cấu hình được; demo hằng số)`.
- `RESPONSIBILITY_ITEM_KEYS` — 7 hạng mục BRD §12 (bảo dưỡng định kỳ · hao mòn tự nhiên · vệ sinh · đăng kiểm & phí đường bộ ·
  bảo hiểm thân vỏ + TNDS · xăng điều chuyển · sửa chữa do khách gây — phần không thu được), bên chịu = Công ty (VC-BR-22).
  Nhãn ở `vi.consignment.responsibility.*`.
- `OwnerGender`, `ConsignmentDocumentKind = 'ORIGINAL' | 'COPY'` — kiểu cục bộ (không phải enum nghiệp vụ dùng chung).

### 2.5. Hàm thuần (`model.ts`)

| Hàm | Mục đích |
| --- | --- |
| `toLocalDateKey(iso)` | `YYYY-MM-DD` theo giờ địa phương (§0.3 điểm 11) |
| `nextSequenceCode(prefix, codes)` | Mã tuần tự 6 chữ số (F10) |
| `CONTRACT_TRANSITIONS` + `canTransition(from, to)` | R1: `DRAFT→PENDING_APPROVAL/SUPERSEDED` · `PENDING_APPROVAL→DRAFT/SIGNED/SUPERSEDED` · `SIGNED→ACTIVE/SUPERSEDED` · `ACTIVE→SUSPENDED` · `SUSPENDED→ACTIVE` (R2 nối `TERMINATED`/`CLOSED`) |
| `findOpenContractForVehicle(contracts, vehicleId, excludeId?)` / `findEffectiveContractForVehicle(…)` | Guard §0.3 điểm 3 / VC-BR-01 |
| `getCurrentContractForVehicle(contracts, vehicleId)` | Hợp đồng hiện hành để hiển thị: ưu tiên `ACTIVE`/`SUSPENDED` → `SIGNED` → `PENDING_APPROVAL` → `DRAFT` → mới nhất đã kết thúc |
| `canActivate(contract, intake?)` | VC-BR-02 / AC-VC-001: `SIGNED` + có `INTAKE` đã xác nhận hai bên |
| `isExpiringSoon(contract, todayKey)` | `ACTIVE`/`SUSPENDED` và `0 ≤ effectiveTo − today ≤ 30` |
| `calcAge(dobKey, todayKey)` | Tuổi tròn năm |
| `maskAccountNumber(n)` / `maskIdNumber(n)` | `••••` + 4 ký tự cuối |
| `toOwnerAuditSnapshot(owner)` | Bản sao đã che số tài khoản + CCCD/MST — dùng cho mọi `before`/`after` |
| `buildTermsSnapshot(contract, owner, vehicle, nowIso)` | VC-BR-05 |
| `buildMergeFields(contract, owner, vehicle, intake?)` | Danh sách trường trộn theo nhóm A–J BRD §9: `{ group, placeholder: '{{owner.fullName}}', label, value }` — số tài khoản trong danh sách **đã che** |
| `summarizeContracts(contracts, todayKey)` | KPI màn danh sách: số hợp đồng hiệu lực (`ACTIVE`+`SUSPENDED`), tổng `fixedMonthlyAmount` của nhóm đó, số sắp hết hạn |

### 2.6. Enum (`shared/domain/enums.ts`) — khối mới `// ---- Vehicle Consignment (VC) — docs/CONSIGNMENT-PLAN.md §2.6 ----`

| Hằng | Giá trị | Nguồn |
| --- | --- | --- |
| `CONSIGNMENT_PAYMENT_TERM_MODELS` | `['FIXED_MONTHLY']` | BRD §6.4 (CR-2026-050) |
| `CONSIGNMENT_PRORATION_RULES` | `['PRORATE_BY_DAY','FULL_MONTH']` | BRD §6.4 — mã BA đề xuất (§0.4 điểm 11) |
| `CONSIGNMENT_HANDOVER_TYPES` | `['INTAKE','RETURN']` | BRD §6.3 |
| R2: `PAYOUT_STATUSES` nối `'CANCELLED'`; `PAYMENT_REQUEST_SOURCES` nối `'CONSIGNMENT'`; `PAYMENT_REQUEST_PURPOSES` nối `'PAYOUT'`; enum trạng thái điều chỉnh + lý do kết thúc hợp đồng | | §0.1 F2/F4 |
| R3: `CONSIGNMENT_PROPOSAL_STATUSES` `['SUBMITTED','APPRAISING','APPROVED','REJECTED']` | | BRD §7.1 |

---

## 3. State machine

### 3.1. Hợp đồng ký gửi (BRD §7.2, UseCase §4.2)

```text
(tạo — CREATE)            → DRAFT
DRAFT ── Trình duyệt (CREATE) ─────────────────► PENDING_APPROVAL
PENDING_APPROVAL ── Trả về nháp + lý do (APPROVE) ► DRAFT                      (UC-VC-03 A1, UC-VC-04 A1)
PENDING_APPROVAL ── Duyệt & xác nhận đã ký (APPROVE, file scan, VC-BR-01) ► SIGNED   (chốt termsSnapshot + termVersions[0])
SIGNED ── Lập biên bản nhận xe (EXECUTE) ── (vẫn SIGNED, gán intakeRecordId)
SIGNED ── Kích hoạt (APPROVE; VC-BR-02 + VC-BR-01 + hôm nay ≤ effectiveTo) ► ACTIVE  (activatedAt)
ACTIVE ── Tạm ngưng + lý do (APPROVE) ► SUSPENDED ── Khôi phục (APPROVE, VC-BR-01) ► ACTIVE
DRAFT | PENDING_APPROVAL ── Thay bằng bản mới + lý do (CREATE) ► SUPERSEDED  (+ tạo DRAFT mới kế thừa dữ liệu)
SIGNED ── Thay bằng bản mới + lý do (APPROVE) ► SUPERSEDED
R2: ACTIVE | SUSPENDED ► TERMINATED (chấm dứt trước hạn / mất xe) · ACTIVE ► CLOSED (hết hạn)
```

Bản mới khi "thay bằng bản mới": copy `ownerId`, `vehicleId`, `effectiveFrom/To`, `noticePeriodDays`, `autoRenew`,
`paymentTerm`, `exploitationRights`, `note`; `status = DRAFT`; `supersedesContractId` = bản cũ; bản cũ nhận
`supersededByContractId`. Bản `SIGNED` bị thay mà đã có biên bản `INTAKE` → **từ chối** (xe đã nhận theo hợp đồng này;
BA đề xuất — tránh biên bản mồ côi).

### 3.2. Owner Payout Record (Round 2 — BRD §7.3)

```text
(sinh theo tháng — VC-BR-21) → SCHEDULED
SCHEDULED ── Tạm giữ + lý do (EDIT) ► ON_HOLD ── Bỏ tạm giữ (EDIT) ► SCHEDULED
SCHEDULED ── (finance) chi CONFIRMED ► PAID ── (finance) REVERSED ► SCHEDULED      (VC-BR-13)
SCHEDULED | ON_HOLD ── hợp đồng kết thúc giữa tháng ► CANCELLED (+ bản prorate thay thế)  (UC-VC-06 A1)
```

---

## 4. Công thức chi trả (Round 2 — khai trước để R1 dựng đúng dữ liệu)

```text
payoutStart = max(effectiveFrom, ngày địa phương của activatedAt)
payoutEnd   = min(effectiveTo, endedDate nếu đã TERMINATED/CLOSED)
Kỳ P (YYYY-MM): coverageFrom = max(ngày 1 của P, payoutStart) · coverageTo = min(ngày cuối của P, payoutEnd)
                (không sinh nếu coverageFrom > coverageTo)
daysCovered = coverageTo − coverageFrom + 1        daysInMonth = số ngày của P
fixedMonthlyAmount = termVersions có effectiveFrom ≤ coverageFrom, lấy bản mới nhất          (VC-BR-05, AC-VC-012)
baseAmount = PRORATE_BY_DAY ? round(fixedMonthlyAmount × daysCovered / daysInMonth) : fixedMonthlyAmount
amountPayable = baseAmount + adjustment đã duyệt (≥ 0)
dueDate = Payment Day của tháng P+1 (ngày > số ngày tháng → ngày cuối tháng)                   (§0.4 điểm 3, 9)
CONSIGNMENT_PAYOUT costDate = ngày 1 của P, amount = amountPayable, bỏ CANCELLED                (§0.4 điểm 4)
```

Ví dụ kiểm chứng (dùng trong DoD R2 — chạy hàm thuần với ngày cố định):

| Ca | Đầu vào | Kết quả |
| --- | --- | --- |
| AC-VC-013 | 8.000.000, Payment Day 5, kỳ 09/2026 trọn tháng | `amountPayable` 8.000.000 · `dueDate` 05/10/2026 |
| AC-VC-014 | 9.000.000, `PRORATE_BY_DAY`, `ACTIVE` từ 20/09/2026 | 11 ngày / 30 → **3.300.000** |
| AC-VC-015 | 8.000.000, mất xe 12/09/2026 | 12/30 → **3.200.000**; không sinh kỳ 10/2026 |
| Tháng 2 | 9.000.000, `ACTIVE` từ 19/02/2027 | 10/28 → 3.214.285,71 → **3.214.286** |
| `FULL_MONTH` | 9.000.000, `ACTIVE` từ 20/09/2026 | **9.000.000** |
| Payment Day 31 | kỳ 01/2027 | `dueDate` **28/02/2027** |

---

## 5. `permissions.ts` — viết lại khối "Nhóm 7 — Xe ký gửi" (nguồn `VehicleConsignment-BRD.md` §18)

| Action | Dùng cho | SA | MGR | SALES | ACC | OPS | `source` |
| --- | --- | :-: | :-: | :-: | :-: | :-: | --- |
| `VIEW` | Xem hồ sơ chủ xe, hợp đồng, lịch chi trả; tab Vehicle Detail | ✓ | ✓ | ✓ | ✓ | ✗ | `VehicleConsignment-BRD.md §18 — Xem hợp đồng ký gửi / lịch chi trả` |
| `CREATE` | Tạo/sửa hồ sơ chủ xe; ghi nhận đề nghị (R3); soạn/sửa `DRAFT`, trình duyệt, thay bản `DRAFT`/`PENDING_APPROVAL` | ✓ | ✓ | ✓ | ✗ | ✗ | `… §18 — Tạo / sửa hồ sơ chủ xe · Ghi nhận đề nghị ký gửi · Soạn hợp đồng ký gửi (DRAFT)` |
| `ASSESS` | Thẩm định (R3) | ✓ | ✓ | ✓ | ✗ | ✓ | `… §18 — Thẩm định xe ký gửi (nhập biên bản)` |
| `APPROVE` | Trả về nháp, duyệt & xác nhận đã ký, kích hoạt, tạm ngưng/khôi phục, thay bản `SIGNED`; R2 chấm dứt/đóng; R3 duyệt/từ chối đề nghị | ✓ | ✓ | ✓ | ✗ | ✗ | `… §18 — Duyệt/từ chối xe · Duyệt & kích hoạt · Tạm dừng / chấm dứt hợp đồng` |
| `EXECUTE` | Lập biên bản nhận/trả xe | ✓ | ✓ | ✓ | ✗ | ✓ | `… §18 — Nhận xe / trả xe ký gửi (biên bản bàn giao)` |
| `CONFIG` | Nhập/sửa `Fixed Monthly Amount` + `Payment Day` + `Proration Rule` (fieldset trong form hợp đồng) | ✓ | ✓ | ✓ | ✗ | ✗ | `… §18 — Cấu hình mức chi trả hàng tháng của hợp đồng` |
| `EDIT` | R2: điều chỉnh / tạm giữ Owner Payout Record, sinh lịch tháng | ✓ | ✓ | ✗ | ✓ | ✗ | `… §18 — Điều chỉnh thủ công Owner Payout Record (Adjustment / ON_HOLD)` (Sales ✗ giữ đúng chữ — §0.4 điểm 2a) |
| `CONFIRM` | R2: tạo Owner Payout (lệnh chi) | ✓ | `'TBD'` | `'TBD'` | ✓ | ✗ | `… §18 — Tạo Owner Payout` |

- Ghi đủ giá trị cho cả 5 vai trò ở mọi dòng (không dùng `likeManager` cho dòng `EDIT` vì Sales ≠ Manager; các dòng khác
  được phép dùng `likeManager`). `DISPATCHER` không khai (giữ như khối cũ — `can()` trả `false`).
- Comment đầu khối: trỏ `VehicleConsignment-BRD.md §18` + CR-2026-035 + `docs/CONSIGNMENT-PLAN.md §0.1 F1, §0.4 điểm 2`.
- `nav.tsx` không cần sửa ở R1 (3 mục đang gate `VIEW` — `OPERATION_STAFF` sẽ không thấy nhóm 7).
- Quyền xem đầy đủ số tài khoản = `CREATE` **hoặc** `CONFIRM` (§0.4 điểm 14).

---

## 6. API / hooks / barrel (Round 1)

### 6.1. `features/consignment/api.ts`

Mọi hàm `fakeRequest()`; mọi đọc + guard + ghi nằm **trong** callback; mọi hàm ghi `appendAudit()` (payload đã che). Kiểu
`ActorInfo { userId; fullName; role }` khai cục bộ (tiền lệ `incidents/api.ts`). Đọc xe qua `readJson<Vehicle[]>(VEHICLES_STORAGE_KEY)`.

| Hàm | Guard | Audit action |
| --- | --- | --- |
| `listVehicleOwners(filter?: { search?; ownerType? })` | — (search theo tên/SĐT/CCCD/MST/mã) | — |
| `getVehicleOwner(id)` | | — |
| `createVehicleOwner(input, actor)` | schema + chuẩn hoá field theo `ownerType` | `CREATE_VEHICLE_OWNER` |
| `updateVehicleOwner(id, input, actor)` | tồn tại; `bankAccountNumber` rỗng = giữ số cũ | `UPDATE_VEHICLE_OWNER` |
| `revealOwnerBankAccount(id, actor)` → `string` | `can(actor.role,'CONSIGNMENT','CREATE') \|\| can(…,'CONFIRM')`; có tài khoản | `VIEW_OWNER_BANK_ACCOUNT` (không ghi số vào payload) |
| `listConsignmentContracts(filter?: { status?; ownerId?; vehicleId?; search? })` | sắp `updatedAt` giảm dần | — |
| `getConsignmentContract(id)` | | — |
| `createConsignmentContract(input, actor)` | chủ xe tồn tại; xe tồn tại + `CONSIGNED`; không có hợp đồng mở (§0.3 điểm 3); `effectiveTo > effectiveFrom` | `CREATE_CONSIGNMENT_CONTRACT` |
| `updateConsignmentContract(id, input, actor)` | chỉ `DRAFT` | `UPDATE_CONSIGNMENT_CONTRACT` (before/after các field đổi) |
| `submitConsignmentContract(id, actor)` | `DRAFT` | `SUBMIT_CONSIGNMENT_CONTRACT` |
| `returnConsignmentContractToDraft(id, reason, actor)` | `PENDING_APPROVAL`; lý do ≥ 3 ký tự | `RETURN_CONSIGNMENT_CONTRACT_TO_DRAFT` |
| `signConsignmentContract(id, { signedFileName }, actor)` | `PENDING_APPROVAL`; VC-BR-01 (không có hợp đồng hiệu lực khác cho xe) | `SIGN_CONSIGNMENT_CONTRACT` |
| `recordConsignmentIntake(contractId, input, actor)` | hợp đồng `SIGNED`; chưa có `INTAKE`; hai bên xác nhận; `appraisedValue` > 0 | `CREATE_CONSIGNMENT_INTAKE` |
| `activateConsignmentContract(id, actor)` | `SIGNED`; `canActivate` (VC-BR-02 — thông điệp "Chưa có biên bản nhận xe — không thể kích hoạt hợp đồng (VC-BR-02)"); VC-BR-01; hôm nay ≤ `effectiveTo` | `ACTIVATE_CONSIGNMENT_CONTRACT` |
| `suspendConsignmentContract(id, reason, actor)` | `ACTIVE`; lý do | `SUSPEND_CONSIGNMENT_CONTRACT` |
| `resumeConsignmentContract(id, reason, actor)` | `SUSPENDED`; VC-BR-01; lý do | `RESUME_CONSIGNMENT_CONTRACT` |
| `supersedeConsignmentContract(id, reason, actor)` → hợp đồng `DRAFT` mới | `DRAFT`/`PENDING_APPROVAL`/`SIGNED`; `SIGNED` đã có `INTAKE` → từ chối; lý do | `SUPERSEDE_CONSIGNMENT_CONTRACT` (bản cũ) + `CREATE_CONSIGNMENT_CONTRACT` (bản mới) |
| `listConsignmentHandoverRecords(filter?: { contractId?; vehicleId? })` | | — |

Không có `remove` (VC-BR-18). Thông điệp lỗi tiếng Việt, được trích mã `VC-BR-xx`; **không** chứa `§`, `UC-`, `AC-`,
`.md`, "Phase", "Round".

### 6.2. `hooks.ts`

Query key gốc `['consignment']` (`['consignment','owners',filter]`, `['consignment','owner',id]`,
`['consignment','contracts',filter]`, `['consignment','contract',id]`, `['consignment','handover-records',filter]`). Mọi
mutation `invalidateQueries({ queryKey: ['consignment'] })` + `['audit']` nếu tab Nhật ký dùng query key riêng (kiểm cách
`VehicleAuditTab` lấy dữ liệu — nếu đọc thẳng `listAuditRecords()` thì không cần).

### 6.3. `index.ts` (barrel) — R1

Screens (4) · `VehicleConsignmentTab` · types `VehicleOwner`, `ConsignmentContract`, `ConsignmentHandoverRecord` · storage
keys `VEHICLE_OWNERS_STORAGE_KEY`, `CONSIGNMENT_CONTRACTS_STORAGE_KEY`, `CONSIGNMENT_HANDOVER_RECORDS_STORAGE_KEY` (R2 finance
đọc). R2 bổ sung: `OWNER_PAYOUT_RECORDS_STORAGE_KEY`, `OwnerPayoutRecord`, `markOwnerPayoutRecordPaid`,
`markOwnerPayoutRecordUnpaid`, hàm thuần cần cho finance.

---

## 7. Audit action — nối **cuối** `AUDIT_ACTIONS` (khối `// Vehicle Consignment (VC) — CONSIGNMENT-PLAN.md §7 (UC-VC-14)`)

R1 (13): `CREATE_VEHICLE_OWNER`, `UPDATE_VEHICLE_OWNER`, `VIEW_OWNER_BANK_ACCOUNT`, `CREATE_CONSIGNMENT_CONTRACT`,
`UPDATE_CONSIGNMENT_CONTRACT`, `SUBMIT_CONSIGNMENT_CONTRACT`, `RETURN_CONSIGNMENT_CONTRACT_TO_DRAFT`,
`SIGN_CONSIGNMENT_CONTRACT`, `CREATE_CONSIGNMENT_INTAKE`, `ACTIVATE_CONSIGNMENT_CONTRACT`, `SUSPEND_CONSIGNMENT_CONTRACT`,
`RESUME_CONSIGNMENT_CONTRACT`, `SUPERSEDE_CONSIGNMENT_CONTRACT`. (Nhãn hiển thị cho màn Nhật ký là việc Phase 6.) `entity`: `'VehicleOwner'` / `'ConsignmentContract'` / `'ConsignmentHandoverRecord'`.

R2 (dự kiến): `GENERATE_OWNER_PAYOUT_RECORDS`, `HOLD_OWNER_PAYOUT_RECORD`, `RELEASE_OWNER_PAYOUT_RECORD`,
`ADJUST_OWNER_PAYOUT_RECORD`, `APPROVE_OWNER_PAYOUT_ADJUSTMENT`, `REJECT_OWNER_PAYOUT_ADJUSTMENT`,
`CANCEL_OWNER_PAYOUT_RECORD`, `MARK_OWNER_PAYOUT_RECORD_PAID`, `REVERT_OWNER_PAYOUT_RECORD_PAID`,
`NOTIFY_CONSIGNMENT_TERMINATION`, `TERMINATE_CONSIGNMENT_CONTRACT`, `CLOSE_CONSIGNMENT_CONTRACT`,
`CREATE_CONSIGNMENT_RETURN`, `CREATE_OWNER_PAYOUT` (finance).

---

## 8. UI — Round 1

Mọi màn có `PageHeader` + trạng thái rỗng + loading; responsive 375/768/desktop (bảng cuộn ngang riêng, card ở mobile —
mirror `ContractListScreen`/`CustomerListScreen`). Chuỗi ở `vi.consignment.*`; nhãn enum ở map `*_LABELS`
(`OWNER_TYPE_LABELS`, `CONSIGNMENT_PRORATION_RULE_LABELS`, `CONSIGNMENT_HANDOVER_TYPE_LABELS`; `CONSIGNMENT_CONTRACT_STATUS_LABELS`
đã có). Ngày `formatDate`, tiền `formatVnd`.

### 8.1. `VehicleOwnerListScreen` — `/consignment/owners` (gate trang: `VIEW`)

- Tìm kiếm (tên/SĐT/CCCD/MST/mã) + lọc loại chủ xe. Cột: Mã · Tên · Loại · SĐT · Số xe đang ký gửi (hợp đồng `ACTIVE`/
  `SUSPENDED`) · Tổng chi trả cố định/tháng (Σ `fixedMonthlyAmount` nhóm đó) · Tài khoản (đã che hoặc badge "Chưa có tài
  khoản"). Click hàng/card → chi tiết.
- Nút "Thêm chủ xe" (gate `CREATE`) → `VehicleOwnerFormSheet`.

### 8.2. `VehicleOwnerDetailScreen` — `/consignment/owners/:id`

Header: tên + loại + mã; nút "Sửa" (`CREATE`). Tab:
1. **Hồ sơ** — mọi field §2.1 (tuổi tự tính; CCCD/MST hiện đầy đủ ở đây; tài khoản qua `OwnerBankAccountField`: dạng che +
   nút "Hiện đầy đủ" khi có quyền §5, gọi `revealOwnerBankAccount` → hiện trong phiên xem, toast lỗi nếu bị từ chối).
2. **Xe & hợp đồng** — bảng hợp đồng của chủ xe (Số HĐ → link, xe → link Vehicle Detail, trạng thái, hiệu lực, mức/tháng,
   ngày chi trả) + tổng chi trả cố định/tháng của hợp đồng hiệu lực (BRD §13 "màn hình gộp").
3. **Nhật ký** — audit `entity === 'VehicleOwner' && entityId === id` (mirror `VehicleAuditTab`).

`VehicleOwnerFormSheet`: RHF + `vehicleOwnerFormSchema` (`superRefine` theo `ownerType`); field cá nhân (CCCD, ngày sinh,
giới tính — có lựa chọn "Chưa xác định") ẩn khi tổ chức và ngược lại MST; khối tài khoản ngân hàng (3 field, nhập thì đủ
3; khi sửa ô số tài khoản để trống + placeholder số đã che = giữ nguyên).

### 8.3. `ConsignmentContractListScreen` — `/consignment/contracts`

- 3 thẻ KPI từ `summarizeContracts` (hợp đồng hiệu lực · tổng chi trả cố định/tháng · sắp hết hạn trong 30 ngày).
- Lọc trạng thái + tìm (số HĐ/biển số/chủ xe). Cột: Số HĐ · Xe (biển số) · Chủ xe · Trạng thái (+ badge "Sắp hết hạn") ·
  Hiệu lực (từ – đến) · Mức chi trả/tháng · Ngày chi trả.
- Nút "Tạo hợp đồng" (`CREATE`) → `ConsignmentContractFormSheet` chế độ tạo.

### 8.4. `ConsignmentContractDetailScreen` — `/consignment/contracts/:id`

Header: số HĐ + badge trạng thái (+ "Sắp hết hạn"), link xe + chủ xe, **thanh hành động theo trạng thái + quyền**:

| Trạng thái | Nút (gate) |
| --- | --- |
| `DRAFT` | Sửa (`CREATE`) · Trình duyệt (`CREATE`) · Thay bằng bản mới (`CREATE`) |
| `PENDING_APPROVAL` | Duyệt & xác nhận đã ký (`APPROVE`) · Trả về nháp (`APPROVE`) · Thay bằng bản mới (`CREATE`) |
| `SIGNED` | Lập biên bản nhận xe (`EXECUTE`, khi chưa có) · Kích hoạt (`APPROVE` — luôn bấm được, API từ chối nếu thiếu biên bản → toast; AC-VC-001) · Thay bằng bản mới (`APPROVE`, ẩn khi đã có biên bản) |
| `ACTIVE` | Tạm ngưng (`APPROVE`) |
| `SUSPENDED` | Khôi phục (`APPROVE`) + banner "Hợp đồng tạm ngưng — không nhận lượt thuê mới" (VC-BR-04, chỉ thông tin) |
| mọi trạng thái | Xem bản nháp hợp đồng (`VIEW`) |

Tab:
1. **Tổng quan & điều khoản** — thời hạn, Notice Period, Auto Renew, Payment Term (mức/tháng, ngày chi trả, quy tắc prorate,
   "Khi tạm ngưng: vẫn chi trả đủ (mặc định)" + `TODO(OQ)`), quyền khai thác (§9C), Responsibility Matrix (7 dòng "Công ty
   chịu" — VC-BR-22), khối "Đã chốt điều khoản lúc …" khi có `termsSnapshot` (sau `SIGNED` hiển thị **từ snapshot**), lịch
   sử trạng thái (kèm lý do), liên kết bản thay thế/bị thay thế, bản ký (tên file giả lập).
2. **Biên bản nhận/trả xe** — danh sách biên bản của hợp đồng (loại, ngày, odo, nhiên liệu, `Appraised Value`, phụ kiện,
   giấy tờ gốc/sao, thiếu giấy tờ, xác nhận hai bên).
3. **Nhật ký** — audit `entity === 'ConsignmentContract' && entityId === id` + audit biên bản của hợp đồng.

Dialog: `ConsignmentContractFormSheet` (tạo/sửa `DRAFT`; chế độ tạo có chọn chủ xe + xe — chỉ liệt kê xe `CONSIGNED` không có
hợp đồng mở, rỗng thì hiện hướng dẫn "tạo xe mới với hình thức Ký gửi ở Danh sách xe"; fieldset Payment Term `disabled` khi
thiếu `CONFIG`), `ConsignmentSignDialog` (tên file bản scan bắt buộc), `ConsignmentReasonDialog` (dùng chung: trả về nháp /
tạm ngưng / khôi phục / thay bản mới), `ConsignmentIntakeDialog` (§2.3), `ConsignmentDraftPreviewDialog` (bảng trường trộn
`buildMergeFields` theo nhóm A–J + ghi chú "Mẫu chính thức do khách hàng cung cấp sau — đây là danh sách trường sẽ được điền
vào mẫu" + nút "Xuất PDF" chỉ toast — mirror `ContractPreviewDialog`; **không** viết điều khoản pháp lý). Mọi dialog RHF +
zod (§0.3 điểm 9).

### 8.5. `VehicleConsignmentTab` (export qua barrel, prop `vehicle: Vehicle`)

- Khối **Chủ xe** (của hợp đồng hiện hành): tên + loại + SĐT + tài khoản đã che (không có nút hiện đầy đủ ở đây) + link chi
  tiết chủ xe.
- Khối **Hợp đồng hiện hành** (`getCurrentContractForVehicle`): số HĐ (link), trạng thái (+ sắp hết hạn), hiệu lực, mức/tháng,
  ngày chi trả, Responsibility Matrix tóm tắt "Công ty chịu toàn bộ chi phí vận hành"; banner khi `SUSPENDED`.
- Khối **Biên bản nhận xe** của hợp đồng hiện hành: ngày, odo, `Appraised Value`.
- Bảng **Lịch sử hợp đồng của xe** (mọi trạng thái).
- Trạng thái rỗng: "Xe chưa có hợp đồng ký gửi" + link tới danh sách hợp đồng.
- R2 thêm khối "Chi trả gần nhất".

---

## 9. Nối `finance` — Round 2 (quyết định khung — bản chi tiết ở §19.7, §19 thắng khi khác)

### 9.1. Chiều import

`finance/{payment,revenue-cost}` import `@/features/consignment` (barrel). Trong `finance` vẫn giữ tầng
`core ← payment ← settlement ← revenue-cost`: phần đọc consignment dùng chung (nếu ≥ 2 thư mục con cần) đặt ở
`core/storage.ts`; luật riêng chi trả ở `payment/`; suy ra chi phí ở `revenue-cost/`. Không tạo barrel con.

### 9.2. Payment (`finance/payment`)

- Kiểu: `PaymentRequest.rentalId?`/`customerId?` + `vehicleOwnerId?`/`ownerPayoutRecordId?`/`vehicleId?`;
  `Transaction.customerId?` + `vehicleOwnerId?`/`ownerPayoutRecordId?`/`vehicleId?`/`payoutRecipient?` (snapshot tài khoản đã
  che + tên chủ tài khoản). Ràng buộc: `type === 'OWNER_PAYOUT'` ⇔ có `vehicleOwnerId`, không `customerId`/`rentalId`
  (`PM-BR-16`, `PM-BR-24`).
- `createOwnerPayout(recordId, actor)` (gate UI `CONSIGNMENT.CONFIRM`): record `SCHEDULED` (VC-BR-10, AC-VC-007), chủ xe có tài
  khoản, chưa có lệnh chi mở → `PaymentRequest` `CONSIGNMENT`/`PAYOUT` + `Transaction` `OWNER_PAYOUT` `OUT` `PENDING`
  `BANK_TRANSFER` (`TODO(OQ: Payment-BRD.md §27 Q24 — phương thức chi)`).
- Xác nhận/thất bại/huỷ/đảo đi qua hàm sẵn có (`confirmTransaction`/`failTransaction`/`voidTransaction`/
  `reverseTransaction`); helper đồng bộ (mirror `syncFinanceAfterPaymentChange`) gọi `markOwnerPayoutRecordPaid` /
  `markOwnerPayoutRecordUnpaid` trong callback.
- Rà mọi chỗ giả định giao dịch có khách: Công nợ khách hàng, tab Thanh toán của Rental, bộ lọc/hiển thị sổ giao dịch (cột
  đối tượng = tên chủ xe), quỹ tiền mặt (chi trả chỉ `BANK_TRANSFER` nên không vào quỹ), báo cáo theo khách (Report 03),
  `CashEntry.customerId` (→ optional). `OWNER_PAYOUT` **không** phải dòng liên quan doanh thu (`revenueRelated = false` — đã
  đúng vì không nằm trong `REVENUE_CASH_OUT_TYPES`; kiểm lại).
- Màn **Chi trả chủ xe** (`finance/payment/screens/OwnerPayoutScreen.tsx`, mount `/consignment/owner-payouts`, nav nhóm 7 mục
  4, gate `CONSIGNMENT.VIEW`): công nợ theo chủ xe (đến hạn − đã chi, cảnh báo quá hạn — BRD §14), danh sách khoản chờ chi,
  nút "Tạo lệnh chi" (`CONSIGNMENT.CONFIRM`), xác nhận/đảo dùng dialog sẵn có của sổ giao dịch; nhận `?record=<id>` để mở
  sẵn khoản được chọn từ màn Lịch chi trả.

### 9.3. Revenue & Cost (`finance/revenue-cost`)

- `deriveConsignmentPayoutCostEntries(records)` → `CostEntry` `CONSIGNMENT_PAYOUT`, `DIRECT`, `source: 'SYSTEM'`,
  `sourceRef.ownerPayoutRecordId`, `costDate` = ngày 1 của kỳ, `amount` = `amountPayable`, bỏ `CANCELLED` (giữ `ON_HOLD` —
  nghĩa vụ hợp đồng vẫn còn; diễn giải ghi trong code); nối vào `listCostEntries` đúng chỗ comment chừa sẵn.
- Gỡ banner `profitConsignmentBanner` + `TODO(Phase 5)` ở `VehicleProfitTab.tsx`, `FinanceReportScreen.tsx`, `reportModel.ts`
  (sửa docstring `costPaid`); **giữ** `TODO(OQ: RevenueCost-BRD.md §28 Q18 …)`.

### 9.4. Ảnh hưởng số liệu Phase 4 (bắt buộc nêu trong DoD R2)

- **Không đổi**: doanh thu (Revenue Line), công nợ khách, 3 số kiểm chứng Phase 4.4 (`rt_026` chênh 975.000 · tổng 12 tháng
  chênh ghi nhận ↔ thực thu −45.760.000 · 7.050.000) — vì chi trả chủ xe không gắn khách/lượt thuê. Mã `GD-…` của giao dịch
  cũ giữ nguyên (seed chi trả chạy **sau** mọi bước seed finance cũ).
- **Đổi đúng bằng payout**: với mỗi xe ký gửi X và kỳ K: chi phí trực tiếp(X,K) tăng = lợi nhuận(X,K) giảm =
  Σ `amountPayable` các record không `CANCELLED` có `costDate` ∈ K; `costPaid` (đối chiếu dòng tiền) kỳ K = Σ giao dịch
  `OWNER_PAYOUT` hiệu lực (`CONFIRMED`, không bị đảo) có ngày xác nhận ∈ K.
- **Cảnh báo demo**: doanh thu seed mỏng (39 lượt thuê) so với chi phí cố định ~14 xe → lợi nhuận đội xe sẽ **âm sâu** sau R2.
  Đúng bản chất mô hình `FIXED_MONTHLY`, không phải lỗi. Nếu chủ dự án muốn số đẹp khi demo → task riêng bổ sung lịch sử lượt
  thuê (ngoài Phase 5).

---

## 10. Seed — Round 1 (`features/consignment/seed.ts`, `SEED_VERSION` 19 → 20)

Quy tắc: ngày **tương đối hôm nay** (helper `dayKey(offset)` theo ngày địa phương + `atTime(dayKey, h)`), thứ tự thời gian
hợp lệ (tạo ≤ trình ≤ ký ≤ biên bản ≤ kích hoạt ≤ tạm ngưng/kết thúc ≤ hôm nay), **dựng bằng hàm thuần** của `model.ts`
(`buildTermsSnapshot`, `nextSequenceCode`…) — không gõ tay số tổng/trạng thái suy ra; snapshot đọc xe thật từ
`VEHICLES_STORAGE_KEY` (seed `vehicles` chạy trước). Không ghi audit seed. Không sửa bản ghi của feature khác.

### 10.1. Chủ xe (10)

| id | Loại | Tên (gợi ý) | Ghi chú demo |
| --- | --- | --- | --- |
| `own_001` | Cá nhân | Trần Minh Khang (Nam, sinh 1975) | 3 xe — `veh_001/002/003` |
| `own_002` | Cá nhân | Lê Thị Thu Hà (Nữ, 1982) | `veh_004/005` |
| `own_003` | Tổ chức | Công ty TNHH Vận tải Phú Gia (MST) | 3 xe VIP — `veh_006/011/014` |
| `own_004` | Cá nhân | Phạm Quốc Bảo — **không khai giới tính** (tuỳ chọn) | chủ cũ `veh_007` (đã chấm dứt) |
| `own_005` | Cá nhân | Võ Hoàng Nam | `veh_008/009` |
| `own_006` | Cá nhân | Đặng Thị Mai | `veh_010` |
| `own_007` | Tổ chức | Công ty CP Dịch vụ Ô tô Sài Gòn Xanh | `veh_012/015` |
| `own_008` | Cá nhân | Huỳnh Văn Tài | `veh_013` (đã đóng → ký lại) |
| `own_009` | Cá nhân | Ngô Thanh Tùng — **chưa có tài khoản ngân hàng** | `veh_016` (R2 demo tạm giữ chi trả) |
| `own_010` | Cá nhân | Bùi Gia Huy | chủ mới `veh_007` (đang soạn hợp đồng) |

### 10.2. Hợp đồng (19) — mức theo hạng xe: `VIP_LUXURY` 15.000.000 · `STANDARD` 8.000.000–9.000.000 · `TWO_SEATER` 5.000.000

| # | Xe | Chủ | Trạng thái | Hiệu lực (offset ngày) | Mức · Payment Day · rule | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `veh_001` | 001 | `ACTIVE` | −300 → +430 | 15tr · 5 · prorate | Auto Renew bật |
| 2 | `veh_002` | 001 | `ACTIVE` | −345 → **+20** | 9tr · 5 | **Sắp hết hạn** (VC-BR-19) |
| 3 | `veh_003` | 001 | `ACTIVE` | −280 → +450 | 5tr · 5 | |
| 4 | `veh_004` | 002 | `ACTIVE` | −270 → +460 | 9tr · 10 | |
| 5 | `veh_005` | 002 | `ACTIVE` | −250 → +480 | 8tr · 10 | |
| 6 | `veh_006` | 003 | `ACTIVE` | −320 → +410 | 15tr · 15 | |
| 7 | `veh_011` | 003 | `ACTIVE` | −200 → +530 | 15tr · 15 | `FULL_MONTH` (demo rule thứ 2) |
| 8 | `veh_014` | 003 | `ACTIVE` | −190 → +540 | 15tr · 15 | |
| 9 | `veh_008` | 005 | `ACTIVE` | −230 → +500 | 9tr · **31** | demo kẹp ngày cuối tháng (R2) |
| 10 | `veh_009` | 005 | `SUSPENDED` | −220 → +510 | 9tr · 31 | tạm ngưng −12 ngày, lý do "tranh chấp điều khoản với chủ xe, chờ làm rõ" |
| 11 | `veh_010` | 006 | `ACTIVE` | −210 → +520 | 5tr · 5 | |
| 12 | `veh_012` | 007 | `ACTIVE` | −240 → +490 | 9tr · 20 | |
| 13 | `veh_015` | 007 | `ACTIVE` | −160 → +570 | 8tr · 20 | |
| 14 | `veh_016` | 009 | `ACTIVE` | **ngày 15 của tháng (hiện tại − 2)** → +1 năm | 5tr · 5 | **kích hoạt giữa tháng** → R2 prorate tháng đầu |
| 15 | `veh_007` | 004 | `TERMINATED` | −400 → +330, kết thúc −35 | 9tr · 10 | chủ cũ bán xe; có `RETURN` −35 (chỉ seed — R1 không có thao tác chấm dứt; R2 thêm `endedDate`/`endReason`, R1 lưu lý do trong `statusHistory`) |
| 16 | `veh_007` | 010 | `DRAFT` | +7 → +372 | 9tr · 10 | tạo −3 |
| 17 | `veh_013` | 008 | `CLOSED` | −430 → −66, đóng −60 | 5tr · 5 | có `RETURN` −60 (xe về chủ → `INACTIVE` ở VM, khớp seed xe) |
| 18 | `veh_013` | 008 | `SUPERSEDED` | +5 → +370 | 4.5tr · 5 | tạo −20, thay −10 (nhập sai mức) → #19 |
| 19 | `veh_013` | 008 | `PENDING_APPROVAL` | +5 → +370 | 5tr · 5 | tạo −10, trình −2; `supersedesContractId` = #18 |

- `SIGNED` không seed (tới được bằng 1 thao tác "Duyệt & xác nhận đã ký" trên #19 → rồi lập biên bản → kích hoạt: luồng demo
  đầy đủ UC-VC-04 + AC-VC-001).
- Hợp đồng đã qua `SIGNED` (#1–15, #17) có `termsSnapshot` + `termVersions[0]` + `signedCopy`, `statusHistory` đủ các mốc,
  `activatedAt` = ngày `effectiveFrom` 09:00 (riêng #14 = ngày 15 tháng hiện tại − 2).
- Ràng buộc kiểm trong seed (chạy hàm guard trên dữ liệu seed, `throw` nếu vi phạm — tránh sai âm thầm): mỗi xe ≤ 1 hợp đồng
  `EFFECTIVE`, ≤ 1 hợp đồng `OPEN`; mọi lượt thuê lịch sử của xe nằm sau `effectiveFrom` hợp đồng tương ứng (đã đối chiếu tay:
  sớm nhất `rt_031` `veh_001` −160 > −300; `rt_025` `veh_016` −30 > ngày 15 tháng −2).
- `veh_007` (`MAINTENANCE`) và `veh_013` (`INACTIVE`) là 2 xe "giữa hai hợp đồng" — vẫn `ownershipType = CONSIGNED` ở VM (đồng
  bộ VC-BR-03 là roadmap — §1.5).

### 10.3. Biên bản (18)

- 16 `INTAKE` cho #1–15, #17: `handoverAt` = ngày `effectiveFrom` − 1, 09:00 (riêng #14 = ngày 14 tháng hiện tại − 2); `odoKm`
  < `currentKm` của xe; `appraisedValue` theo hạng (VIP 1.100.000.000–1.300.000.000 · STANDARD 550.000.000–700.000.000 ·
  TWO_SEATER 300.000.000–350.000.000); 1 biên bản (#5) có `missingDocumentsNote` (UC-VC-04 A2 — "Thiếu bản gốc sổ bảo hiểm,
  chủ xe cam kết bổ sung").
- 2 `RETURN`: #15 (−35) và #17 (−60), `appraisedValue` bỏ trống.

---

## 11. Business rule cần trích dẫn trong code (comment 1 dòng tại chỗ)

VC-BR-01 (guard xe) · VC-BR-02 / AC-VC-001 (`canActivate`) · VC-BR-05 (snapshot) · VC-BR-15 (xác nhận hai bên ở biên bản) ·
VC-BR-16 (`appraisedValue`) · VC-BR-17 (audit) · VC-BR-18 (không xoá) · VC-BR-19 (`isExpiringSoon`) · VC-BR-22
(Responsibility Matrix) · CR-2026-050 (`FIXED_MONTHLY`) · CR-2026-051 (1 hợp đồng = 1 xe; `Ngày sinh`/`Giới tính` tuỳ chọn) ·
CR-2026-049 (merge-field, `TODO(OQ)` mẫu `.docx`) · BRD §21 (che số tài khoản).

---

## 12. Open Question / giả định — xử lý bằng giả định tạm + `TODO(OQ)` (không tự chốt)

| # | Điểm | Giả định demo | Round |
| --- | --- | --- | --- |
| 1 | Mẫu hợp đồng `.docx` chưa có (CR-2026-049, BRD §23 Q18) | Bảng trường trộn giả lập, không viết điều khoản | R1 |
| 2 | Ngưỡng nhắc −30/−3 cấu hình được (BRD §23 Q20) | Hằng số | R1/R2 |
| 3 | Vai trò được xem đầy đủ số tài khoản (BRD §21) | `CREATE` hoặc `CONFIRM` (§0.4 điểm 14) | R1 |
| 4 | Operation Staff ✗ xem nhưng ✓ biên bản (BRD §18) | Giữ đúng chữ — OPS không vào nhóm 7 (§0.4 điểm 2b) | R1 |
| 5 | `Manager`/`Sales` tạo Owner Payout = `TBD` (BRD §18, UseCase §24 câu 12) | `TBD` → `can()` = false | R2 |
| 6 | Hợp đồng `SUSPENDED` "trừ khi Terms Snapshot ghi khác" | Luôn trả đủ | R1 hiển thị / R2 |
| 7 | `Due Date` tháng kỳ hay tháng sau (§0.4 điểm 3) | Tháng sau (AC-VC-013) | R2 |
| 8 | Làm tròn prorate | `Math.round` về đồng | R2 |
| 9 | `Payment Day` vượt số ngày tháng | Ngày cuối tháng | R2 |
| 10 | `Recognition Date` `CONSIGNMENT_PAYOUT` (`RevenueCost-BRD.md` §28 Q19) | Theo kỳ | R2 |
| 11 | Xe ký gửi 1 hay 2 góc nhìn lợi nhuận (`RevenueCost-BRD.md` §28 Q18) | Góc công ty (a) — giữ `TODO(OQ)` | R2 |
| 12 | Chung sổ giao dịch hay tách (`Payment-BRD.md` §27 Q23) | Chung sổ (khớp 4.3 đã lọc `OWNER_PAYOUT` ở `costPaid`) | R2 |
| 13 | Phương thức chi (`Payment-BRD.md` §27 Q24) | Chỉ `BANK_TRANSFER` | R2 |
| 14 | Duyệt `ON_HOLD` ("cần lý do + duyệt" — không nói ai duyệt khi Manager tự làm) | Người có `EDIT` thực hiện trực tiếp, bắt buộc lý do | R2 |
| 15 | Ai duyệt `Adjustment` | Người có `APPROVE` nhập → hiệu lực ngay; Accountant nhập → chờ người có `APPROVE` duyệt | R2 |
| 16 | `Ownership Type` tự đặt/gỡ (VC-BR-03) + chặn lượt thuê mới (VC-BR-04) | Roadmap §13 — chỉ cảnh báo | R1/R2 |

---

## 13. Roadmap (ngoài phạm vi Phase 5 — ghi để không quên)

1. VC-BR-03 / VM-RULE-015: `vehicles/api.ts` export hàm đặt/gỡ `ownershipType` do VC gọi khi `ACTIVE`/`CLOSED`/`TERMINATED`;
   `VehicleFormSheet.tsx` khoá field (gỡ `TODO(OQ: VM-RULE-015)`). Cần người dùng duyệt ngoại lệ ghi vào `vehicles`.
2. VC-BR-04: `rentals` chặn xác nhận lượt thuê mới cho xe thuộc hợp đồng `SUSPENDED`/`TERMINATED`/`CLOSED` hoặc đã có thông
   báo chấm dứt (AC-VC-011).
3. Phase 6: sự kiện `CONSIGNMENT_CONTRACT_EXPIRING`/`CONSIGNMENT_PAYMENT_DUE` ở Trung tâm thông báo + Dashboard; nhãn các audit
   action VC ở màn Nhật ký; cấu hình ngưỡng nhắc ở Cấu hình hệ thống.
4. `maintenance/model.ts` ghi chú baseline km có thể lấy `odoKm` biên bản `INTAKE` — chỉ khi `MT` yêu cầu.

---

## 14. File dự kiến — Round 1

**Tạo:**
- `src/features/consignment/model.ts` · `api.ts` · `hooks.ts` · `seed.ts` · `index.ts`
- `src/features/consignment/components/`: `VehicleOwnerFormSheet.tsx` · `OwnerBankAccountField.tsx` ·
  `ConsignmentContractStatusBadge.tsx` · `ConsignmentContractFormSheet.tsx` · `ConsignmentSignDialog.tsx` ·
  `ConsignmentReasonDialog.tsx` · `ConsignmentIntakeDialog.tsx` · `ConsignmentDraftPreviewDialog.tsx` ·
  `ConsignmentContractOverviewTab.tsx` · `ConsignmentHandoverRecordsTab.tsx` · `ConsignmentAuditTab.tsx` ·
  `VehicleConsignmentTab.tsx` (+ card mobile nếu cần: `VehicleOwnerCard.tsx`, `ConsignmentContractCard.tsx`)
- `src/features/consignment/screens/`: `VehicleOwnerListScreen.tsx` · `VehicleOwnerDetailScreen.tsx` ·
  `ConsignmentContractListScreen.tsx` · `ConsignmentContractDetailScreen.tsx`

**Sửa:** `src/shared/domain/enums.ts` · `src/shared/domain/permissions.ts` · `src/shared/i18n/vi.ts` · `src/app/paths.ts` ·
`src/app/routes.tsx` · `src/shared/fixtures/registerSeeds.ts` · `src/shared/fixtures/seedAll.ts` ·
`src/features/vehicles/screens/VehicleDetailScreen.tsx` (ngoại lệ §0.2).

**Cấm:** `src/features/finance/**` · mọi file `vehicles` khác · `rentals/**` · `contracts/**` · các feature khác ·
`shared/layout/nav.tsx` · `shared/ui/**` · `docs/**` · `CHANGELOG.md`.

---

## 15. Definition of Done

### 15.1. Round 1

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới.
2. `git diff --stat` chỉ gồm file ở §14; `git diff src/features/finance` rỗng; `VehicleDetailScreen.tsx` chỉ đổi đúng 4 điểm §0.2.
3. Seed (`SEED_VERSION` 20, reset demo): 10 chủ xe · 19 hợp đồng phân bố đúng §10.2 (13 `ACTIVE`, 1 `SUSPENDED`, 1 `DRAFT`,
   1 `PENDING_APPROVAL`, 1 `SUPERSEDED`, 1 `CLOSED`, 1 `TERMINATED`) · 18 biên bản (16 `INTAKE`, 2 `RETURN`); guard seed §10.2
   chạy không lỗi; `veh_002` hiện "Sắp hết hạn"; mọi ngày tương đối hôm nay, không có ngày tạo ở tương lai.
4. Luồng (thao tác thật trên UI với `MANAGER`): #19 Duyệt & xác nhận đã ký → `SIGNED` (snapshot hiện "Đã chốt điều khoản lúc
   …", nút Sửa biến mất) → bấm Kích hoạt **trước** khi lập biên bản → toast từ chối VC-BR-02 (AC-VC-001) → lập biên bản nhận xe
   → Kích hoạt → `ACTIVE`, tab xe `veh_013` hiện hợp đồng mới; #16 Sửa → Trình duyệt → Trả về nháp (lý do bắt buộc, hiện trong
   lịch sử trạng thái) → Thay bằng bản mới → bản cũ `SUPERSEDED` + bản mới `DRAFT` liên kết hai chiều; #10 Khôi phục → `ACTIVE`,
   tạm ngưng lại; tạo hồ sơ chủ xe cá nhân không giới tính + tổ chức; tạo xe mới `CONSIGNED` ở Danh sách xe → tạo hợp đồng cho
   xe đó (picker không liệt kê xe đã có hợp đồng mở). Guard VC-BR-01 + §0.3 điểm 3 có mặt ở **API** (`create`/`sign`/
   `activate`/`resume`) dù UI đã lọc — review đọc code xác nhận.
5. Phân quyền (đổi vai trò nhanh): `OPERATION_STAFF` không thấy nhóm 7 và tab "Chủ xe & Ký gửi"; `ACCOUNTANT` xem được, không có
   nút tạo/sửa/duyệt, **có** nút hiện đầy đủ số tài khoản (quyền `CONFIRM`); `SALES` có đúng các nút như `MANAGER`;
   `DISPATCHER` không thấy nhóm 7. Không có `if (role === …)`.
6. Che dữ liệu: số tài khoản luôn che ở danh sách/tab xe/bảng trường trộn; "Hiện đầy đủ" ghi đúng 1 audit
   `VIEW_OWNER_BANK_ACCOUNT` mỗi lần và payload không chứa số; payload audit tạo/sửa chủ xe có số tài khoản + CCCD/MST đã che.
7. Mọi hàm ghi có `appendAudit`; mọi đọc/guard nằm trong callback `fakeRequest`; schema zod ở `model.ts` được dùng qua
   `zodResolver` ở mọi form/dialog.
8. Chuỗi UI/lỗi/audit summary không chứa `§`, `UC-`, `AC-`, `.md`, `Phase`, `Round` (`grep` trong `features/consignment` +
   khối `vi.consignment`).
9. Responsive 375/768: danh sách → card, bảng cuộn ngang riêng, header chi tiết + thanh nút xuống dòng không tràn.
10. Số liệu Phase 4 không đổi (không file `finance` nào bị sửa).

### 15.2. Round 2 (khung — DoD chi tiết thay thế ở §19.11)

1. 6 ca §4 chạy đúng bằng hàm thuần (harness tạm ngoài repo, ghi kết quả trong báo cáo bàn giao).
2. Prorate seed: hợp đồng #14 (`veh_016`) — record tháng đầu = `round(5.000.000 × (daysInMonth − 15 + 1) / daysInMonth)`; `dev`
   ghi số thực tế + phép tính.
3. Một kỳ K, một xe X: Σ `amountPayable` record (không `CANCELLED`) = Σ CostEntry `CONSIGNMENT_PAYOUT` (X,K) ở `/finance/costs`
   = lợi nhuận (X,K) trước R2 − sau R2 ở tab Lợi nhuận + báo cáo; tổng 12 tháng toàn đội xe tương tự; `costPaid` = Σ
   `OWNER_PAYOUT` hiệu lực trong kỳ.
4. 3 số kiểm chứng Phase 4.4 giữ nguyên; mã `GD-…` giao dịch cũ không đổi.
5. Đảo một giao dịch chi → record về `SCHEDULED`, Cost không đổi, `costPaid` giảm đúng số đó.

---

## 16. Danh sách file `dev` đọc trước khi code — Round 1 (đúng danh sách, không scan rộng)

**Nghiệp vụ:**
1. `docs/CONSIGNMENT-PLAN.md` — §0–§8, §10–§12, §14, §15 (bắt buộc toàn bộ các mục này).
2. `../thien-bao-car-docs/modules/VehicleConsignment-BRD.md` — §6.1–§6.4, §7.2, §9, §12, §17 (VC-BR-01/02/05/15/16/17/18/19/22),
   §18, §19 (AC-VC-001/002), §21.
3. `../thien-bao-car-docs/modules/VehicleConsignment-UseCase.md` — §7 (UC-VC-03), §8 (UC-VC-04), §9 (UC-VC-05), §14.3 (tạm
   dừng), §18 (UC-VC-14).
4. `../thien-bao-car-docs/WebappQuanTri.md` — §12.2–§12.4.
5. `../thien-bao-car-docs/modules/VehicleManagement-BRD.md` — §12.3, §12.4 (dòng 406–412).

**Code tham chiếu (pattern):**
6. `CONVENTIONS.md`, `docs/ARCHITECTURE.md`.
7. `src/shared/domain/enums.ts` — khối `OWNER_TYPES`/`CONSIGNMENT_CONTRACT_STATUSES`/`PAYOUT_STATUSES` (~dòng 358–378) + cuối
   `AUDIT_ACTIONS` (~dòng 560–594).
8. `src/shared/domain/permissions.ts` — đầu file (kiểu, `likeManager`) + khối "Nhóm 7" (~dòng 465–516).
9. `src/shared/i18n/vi.ts` — khối `vi.contracts` (mẫu), `vi.vehicles.consignmentPlaceholder` (~dòng 380), các map
   `CONSIGNMENT_CONTRACT_STATUS_LABELS`/`PAYOUT_STATUS_LABELS` (~dòng 2133–2148).
10. `src/shared/lib/audit.ts`, `fakeNetwork.ts`, `storage.ts`, `datetime.ts`, `money.ts`, `id.ts`.
11. `src/features/contracts/` — `api.ts` (khung fakeRequest + audit), `screens/ContractListScreen.tsx`,
    `screens/ContractDetailScreen.tsx`, `components/ContractSignDialog.tsx` (RHF + upload giả lập),
    `components/ContractPreviewDialog.tsx`, `components/ContractStatusBadge.tsx`, `components/ContractAuditTab.tsx`.
12. `src/features/customers/components/CustomerFormSheet.tsx` (RHF Sheet + Select giới tính) + `customers/model.ts` (schema,
    regex SĐT).
13. `src/features/incidents/api.ts` — chỉ khối `ActorInfo` (~dòng 315) + 1 hàm `create` (mẫu actor/audit).
14. `src/features/vehicles/screens/VehicleDetailScreen.tsx` (file được sửa), `vehicles/model.ts` (kiểu `Vehicle`),
    `vehicles/api.ts` (dòng 1–20: `VEHICLES_STORAGE_KEY`), `vehicles/hooks.ts`, `vehicles/components/VehicleAuditTab.tsx`.
15. `src/app/paths.ts`, `src/app/routes.tsx`, `src/shared/fixtures/registerSeeds.ts`, `src/shared/fixtures/seedAll.ts`.
16. `src/features/finance/revenue-cost/model.ts` — **chỉ** hàm `toLocalDateKey` (để mirror; không import).

---

## 17. Thứ tự làm đề xuất cho `dev` (Round 1)

1. `enums.ts` (3 enum + 13 audit action) → `permissions.ts` (khối Nhóm 7) → nhãn enum + khung `vi.consignment` ở `vi.ts`.
2. `model.ts` (kiểu, hằng, hàm thuần, schema) → `api.ts` → `hooks.ts` → `index.ts`.
3. `seed.ts` + `registerSeeds.ts` + `SEED_VERSION` → chạy `npm run dev`, reset demo, kiểm số lượng/guard seed.
4. Màn Hồ sơ chủ xe (list → detail → form) → màn Hợp đồng (list → detail → các dialog theo thứ tự vòng đời).
5. `VehicleConsignmentTab` + sửa `VehicleDetailScreen.tsx`; `paths.ts`/`routes.tsx`.
6. Xoá `vi.vehicles.consignmentPlaceholder`; chạy 3 cổng + grep §15 mục 1, 8.

---

## 18. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 23/10/2026 | `tech-lead` lập + tự duyệt kế hoạch (3 round); giao `dev` Round 1. |
| 23/10/2026 | Round 1 `DONE` — review `tech-lead` đạt vòng 1, không Blocker. Lệch nhỏ được chấp nhận: thêm `ConsignmentField.tsx` (ngoài §14); `index.ts` chưa export hook/hàm thuần (R2 bổ sung khi `finance` cần); đối chiếu lượt thuê ↔ `effectiveFrom` làm ở harness (seed không đọc `rentals` — §0.2). Nợ "Nên sửa" mang sang R2: gate trang `VIEW` ở 4 màn (hiện chỉ gate qua nav), chuyển sang bản mới sau "Thay bằng bản mới", chặn `handoverAt` ở tương lai trong biên bản nhận xe. |
| 23/10/2026 | Round 2 chi tiết hoá ở §19 (người dùng đồng ý đề xuất, gộp 4 nợ "Nên sửa" R1), `tech-lead` tự duyệt; giao `dev`. |
| 23/10/2026 | Round 2 `DONE` — review `tech-lead` đạt vòng 1, không Blocker. Số liệu khớp 100% §19.11 (Σ chi trả 12 tháng 1.269.283.178; chi phí trực tiếp 09/2026 145.980.000 / 10/2026 154.080.000; 145 khoản 126 `PAID`/14 `SCHEDULED`/5 `ON_HOLD`; 129 giao dịch / 128 lệnh chi `OWNER_PAYOUT`; doanh thu Phase 4 giữ nguyên). Lệch được chấp nhận: 3 file `finance` sửa thêm vì `tsc` (`CashDrawerScreen`, `TransactionLedgerScreen` — cột "Đối tượng", `reportModel` guard Report 03); `materializeDrafts` sinh id trong `payoutModel.ts` (tiền lệ `buildReversalPair`); thêm `previewConsignmentContractEnd`/`formatPeriod`/`sumApprovedAdjustments`, schema factory `make…Schema`; nút Chấm dứt chỉ hiện khi trả trước hạn. **Nợ "Nên sửa" mang sang R3:** (1) **vòng import runtime mới** `consignment/api.ts` → `incidents/api.ts` → `handover-return/api.ts` → barrel `rentals` → `RentalDetailScreen` → barrel `finance` → `TransactionLedgerScreen` → barrel `consignment` (SCC 123 file; HEAD trước R2 = 0 vòng) — **lỗi ở chính §19.5.3** (chỉ định deep import `incidents/api` mà không soát `incidents/api` kéo `rentals` barrel); app build + chạy dev/preview không lỗi khởi tạo, nhưng phải gỡ: đọc `INCIDENTS_STORAGE_KEY` từ một module lá (vd. `incidents/storageKeys.ts`, ngoại lệ có kiểm soát) và mở rộng `import-graph.mjs` ra toàn `src/`; (2) tab Nhật ký hợp đồng (`ConsignmentAuditTab`) chưa gộp audit entity `OwnerPayoutRecord` của hợp đồng (vẫn ghi đủ, xem được ở nhật ký hệ thống). |

---

## 19. Round 2 — chi tiết (`APPROVED` 23/10/2026)

Lịch chi trả hàng tháng (Owner Payout Record) + chấm dứt / đóng / mất xe + biên bản trả xe `RETURN` + nối `finance`
(`OWNER_PAYOUT` ở Payment, Cost `CONSIGNMENT_PAYOUT` ở Revenue & Cost, màn "Chi trả chủ xe") + 4 nợ "Nên sửa" của R1.
**Số liệu Phase 4 phía chi phí/lợi nhuận/đối chiếu sẽ đổi** (đã báo người dùng — §19.11 ghi số trước/sau). `SEED_VERSION`
20 → 21.

**Nguồn nghiệp vụ R2:** `VehicleConsignment-BRD.md` §6.6, §6.7, §7.2 (nhánh `TERMINATED`/`CLOSED`), §7.3, §10, §11 (dòng
"Mất xe"), §13, §14, §14a (dòng 2), §15, §17 (VC-BR-10/12/13/14/15/16/17/20/21), §18, §19 (AC-VC-007/011/013/014/015), §20
EX-04. `VehicleConsignment-UseCase.md` §4.3, §10 (UC-VC-06), §12.4 (UC-VC-08 A1/A2), §13 (UC-VC-09), §15 (UC-VC-11), §16
(UC-VC-12). `Payment-BRD.md` dòng 132, 160–186 (cây entity), 237 + 243 (§8 `OWNER_PAYOUT`), `PM-BR-16`, `PM-BR-24`, §27
Q23–Q24. `RevenueCost-BRD.md` `RV-BR-19`, §28 Q18–Q19. `WebappQuanTri.md` §12.2–§12.5.

### 19.1. Diễn giải / giả định mới (nối tiếp §0.4 — ghi cho BA, không tự sửa tài liệu)

| # | Điểm | Cách làm trong demo | Nguồn / lý do |
| --- | --- | --- | --- |
| 15 | `TERMINATED` có cần chi dứt điểm mọi khoản trước không? UC-VC-11 A2 "không đóng Agreement cho tới khi mọi Record `PAID`", nhưng UC-VC-12 bước 3→5 chuyển `TERMINATED` **rồi** mới chi dứt điểm; BRD §7.2 chỉ ghi "đã chi trả kỳ cuối" cho `CLOSED` | `CLOSED` **bắt buộc** mọi Record không huỷ đã `PAID`; `TERMINATED` (chấm dứt trước hạn / mất xe) **không** chặn — khoản còn lại chi sau, vẫn hiện ở công nợ chủ xe | BRD §7.2 nguyên văn từng nhánh |
| 16 | Ngày kết thúc tính tiền (`endedDate`) | `TERMINATED` thường = **ngày của biên bản `RETURN`** (AC-VC-011: giữ hợp đồng tới khi xe được trả); mất xe = `Event Date` (AC-VC-015); `CLOSED` = `effectiveTo` | AC-VC-011/015, BRD §10 |
| 17 | Ngày thông báo chấm dứt | Cho **nhập lùi** (thông báo nhận ngoài hệ thống), `effectiveFrom ≤ noticeDate ≤ hôm nay`; ngày dự kiến kết thúc `plannedEndDate ≥ noticeDate + noticePeriodDays` (VC-BR-14) và `< effectiveTo` (bằng/ sau `effectiveTo` = hết hạn tự nhiên → dùng "Đóng hợp đồng") | BA đề xuất — để demo được Notice Period mà không phải chờ |
| 18 | Lượt thuê nào chặn việc trả xe về chủ (VC-BR-14) | **Chặn** khi xe còn lượt thuê `CONFIRMED`/`CONTRACT_CREATED`/`READY_FOR_HANDOVER`/`HANDED_OVER`/`IN_RENTAL`; `DRAFT` chỉ cảnh báo; trạng thái còn lại (xe đã về) bỏ qua. Chỉ **đọc** `rentals` — không tự huỷ/đổi xe | BA đề xuất; xử lý lượt thuê làm ở màn Lượt thuê (RM §54) |
| 19 | Kết thúc giữa tháng khi Record kỳ đó/kỳ sau đã có | Record bị ảnh hưởng `SCHEDULED`/`ON_HOLD` chưa có lệnh chi → `CANCELLED`; Record thay thế prorate (UC-VC-06 A1) **kế thừa** trạng thái `ON_HOLD` + lý do + danh sách điều chỉnh. Nếu Record bị ảnh hưởng đã `PAID` hoặc đang có lệnh chi chờ → **từ chối**, yêu cầu đảo/huỷ giao dịch trước | BA đề xuất — tránh chi thừa âm thầm |
| 20 | Ngưỡng `Amount Payable` sau điều chỉnh | Phải **> 0** (BRD §14 "luôn ≥ 0"; bằng 0 thì không có gì để chi và Record kẹt `SCHEDULED`, chặn cả "Đóng hợp đồng") | BA đề xuất |
| 21 | Ai duyệt `Adjustment` (UC-VC-08 A2 "Manager nhập … + duyệt") | Người có `EDIT` **và** `APPROVE` (SA/Manager) nhập → hiệu lực ngay (tự duyệt); Accountant (`EDIT`, không `APPROVE`) nhập → `PENDING_APPROVAL`, chờ người có `EDIT`+`APPROVE` duyệt/từ chối. Sales (`APPROVE` nhưng ✗ `EDIT`) **không** duyệt — giữ đúng chữ BRD §18. Mỗi Record tối đa 1 điều chỉnh chờ duyệt | Thay §12 dòng 15 |
| 22 | "Tác vụ nền đầu mỗi tháng" (UC-VC-06 §10.3) | Prototype không có tác vụ nền: (a) nút **"Sinh lịch chi trả đến tháng này"** (`EDIT`) — idempotent; (b) tự sinh khi **Kích hoạt** hợp đồng (bù các kỳ từ ngày bắt đầu tới tháng hiện tại); (c) tự tính lại khi kết thúc hợp đồng (điểm 19) | UC-VC-06 §10.3 "hoặc khi hợp đồng chuyển ACTIVE / TERMINATED" |
| 23 | "Tạo lại Owner Payout đúng" sau chi sai (UC-VC-09 A1) | Lệnh chi (`PaymentRequest`) mà giao dịch `FAILED`/`VOIDED`/`REVERSED` → yêu cầu đó `CANCELLED`, Record gỡ liên kết (đảo sau `PAID` → Record về `SCHEDULED` — VC-BR-13); tạo lệnh chi mới = yêu cầu + giao dịch mới. Mỗi Record **tối đa 1** yêu cầu chưa huỷ | Kỹ thuật, khớp PM-BR-03/05 |
| 24 | "Thông báo chi trả cho chủ xe" (UC-VC-08 bước 1, Phase 1 gửi thủ công) | Không dựng (Notification là Phase 6) — chỉ hiện "Đã chi" + mã giao dịch | Ngoài phạm vi R2 |
| 25 | Xe mất → Vehicle Management đặt `INACTIVE` (UC-VC-12 bước 3) | **Không** ghi `vehicles` (roadmap §13) — dialog/banner nhắc "cập nhật trạng thái xe ở Danh sách xe" | §0.2 |

### 19.2. Phạm vi R2

**Trong phạm vi**

| # | Hạng mục | Nguồn |
| --- | --- | --- |
| R2-1 | Enum/nhãn/audit action R2 (§19.3) + `storage.ts` dùng chung trong feature (§19.4.0) | §0.1 F2/F4 |
| R2-2 | Entity `OwnerPayoutRecord` + hàm thuần sinh lịch/prorate/kết thúc/công nợ (`payoutModel.ts`) | BRD §6.6/§10/§13, VC-BR-21 |
| R2-3 | API lịch chi trả: sinh lịch (nút + khi kích hoạt), tạm giữ/bỏ tạm giữ, điều chỉnh + duyệt/từ chối, + 4 hàm đồng bộ cho `finance` | UC-VC-06/08/09, VC-BR-10/13/17 |
| R2-4 | Chấm dứt (thông báo → biên bản `RETURN` → `TERMINATED`), Đóng (`CLOSED`), Mất xe (`TERMINATED` ngay, không cần `RETURN`) | UC-VC-11/12, VC-BR-14/15/16, AC-VC-011/015 |
| R2-5 | UI VC: màn **Lịch chi trả hàng tháng** `/consignment/payouts` (thay `ComingSoon`), tab "Lịch chi trả" ở chi tiết hợp đồng + chi tiết chủ xe, khối "Chi trả gần nhất" ở tab xe, Sheet chi tiết Record, 6 dialog mới | WebappQuanTri §12.2, BRD §13/§21 "minh bạch" |
| R2-6 | `finance/payment`: kiểu `PaymentRequest`/`Transaction` nới cho chủ xe; `createOwnerPayout`; đồng bộ trạng thái Record khi xác nhận/thất bại/huỷ/đảo; màn **Chi trả chủ xe** `/consignment/owner-payouts` (công nợ chủ xe + khoản chờ chi + đã chi); sổ giao dịch hiện đúng đối tượng | BRD §14, PM-BR-16/24, UC-VC-09 |
| R2-7 | `finance/revenue-cost`: Cost `CONSIGNMENT_PAYOUT` suy ra từ Record; gỡ banner + `TODO(Phase 5)`; giữ `TODO(OQ: … §28 Q18 …)` | RV-BR-19, VC-BR-12 |
| R2-8 | Seed lịch chi trả lịch sử + giao dịch chi khớp (§19.9); `SEED_VERSION` 21 | §10 |
| R2-9 | 4 nợ "Nên sửa" R1: gate trang `VIEW`; điều hướng sang bản mới sau "Thay bằng bản mới"; chặn `handoverAt` tương lai (UI + API, cả `RETURN`); zod bắt "nhập ngân hàng/chủ tài khoản mà thiếu số tài khoản" | §18 |

**Ngoài phạm vi R2** (không làm dù tiện tay): đề nghị ký gửi & thẩm định, phụ lục/gia hạn/Auto Renew (R3); đồng bộ
`Ownership Type` + đặt xe `INACTIVE` + chặn lượt thuê mới (VC-BR-03/04 — roadmap §13, **không ghi `vehicles`/`rentals`**);
sự kiện Notification VC-BR-19/20 (chỉ badge); thông báo chi trả gửi chủ xe; huỷ thông báo chấm dứt; sửa/xoá biên bản; xoá
Record (không có `remove`); chi trả tự động qua API ngân hàng/SePay (chi tay `BANK_TRANSFER`); phí phạt chấm dứt, bồi thường mất
xe, thuế TNCN (ngoài hệ thống); bổ sung lịch sử lượt thuê để "số đẹp" (task riêng nếu chủ dự án muốn).

### 19.3. Enum / nhãn / audit (`shared/domain/enums.ts`, `shared/i18n/vi.ts`)

| Thay đổi | Giá trị | Nguồn |
| --- | --- | --- |
| `PAYOUT_STATUSES` nối cuối | `'CANCELLED'` (nhãn "Đã huỷ") | BRD §6.6/§7.3 (F2) |
| `PAYMENT_REQUEST_SOURCES` nối cuối | `'CONSIGNMENT'` (nhãn "Ký gửi") — sửa comment "thuộc Phase 5, chưa thêm" | `Payment-BRD.md` dòng 186/243 (F4) |
| `PAYMENT_REQUEST_PURPOSES` nối cuối | `'PAYOUT'` — sửa comment | idem |
| Mới `CONSIGNMENT_END_REASONS` | `['EXPIRED','EARLY_TERMINATION','VEHICLE_LOSS']` | BA đề xuất (BRD §7.2/§15/§11) |
| Mới `CONSIGNMENT_TERMINATION_REQUESTERS` | `['OWNER','COMPANY']` | BRD §15 "chủ xe hoặc công ty" |
| Mới `OWNER_PAYOUT_ADJUSTMENT_STATUSES` | `['PENDING_APPROVAL','APPROVED','REJECTED']` | BA đề xuất (UC-VC-08 A2 "nhập + duyệt") |
| `AUDIT_ACTIONS` nối cuối (khối `// Vehicle Consignment (VC) — Round 2`) | `GENERATE_OWNER_PAYOUT_RECORDS`, `HOLD_OWNER_PAYOUT_RECORD`, `RELEASE_OWNER_PAYOUT_RECORD`, `ADJUST_OWNER_PAYOUT_RECORD`, `APPROVE_OWNER_PAYOUT_ADJUSTMENT`, `REJECT_OWNER_PAYOUT_ADJUSTMENT`, `CANCEL_OWNER_PAYOUT_RECORD`, `LINK_OWNER_PAYOUT_RECORD`, `UNLINK_OWNER_PAYOUT_RECORD`, `MARK_OWNER_PAYOUT_RECORD_PAID`, `REVERT_OWNER_PAYOUT_RECORD_PAID`, `NOTIFY_CONSIGNMENT_TERMINATION`, `CREATE_CONSIGNMENT_RETURN`, `TERMINATE_CONSIGNMENT_CONTRACT`, `CLOSE_CONSIGNMENT_CONTRACT`, `CREATE_OWNER_PAYOUT` (16) | VC-BR-17, UC-VC-14 |

Nhãn mới: `CONSIGNMENT_END_REASON_LABELS`, `CONSIGNMENT_TERMINATION_REQUESTER_LABELS`, `OWNER_PAYOUT_ADJUSTMENT_STATUS_LABELS`.
Chuỗi: `vi.consignment.payouts.*` / `vi.consignment.termination.*` (VC) và `vi.finance.ownerPayout.*` (màn finance). **Xoá**
`vi.finance.revenueCost.profitConsignmentBanner` (thay bằng ghi chú trung tính — §19.7.3).

### 19.4. Data model

#### 19.4.0. `consignment/storage.ts` (mới — tách cơ học từ `api.ts`)

Chuyển 3 storage key + 3 cặp `read…/write…` + `readVehicles` đang `private` trong `api.ts` sang `storage.ts`, thêm
`OWNER_PAYOUT_RECORDS_STORAGE_KEY = 'ownerPayoutRecords'` + `readPayoutRecords/writePayoutRecords`. Lý do: `api.ts` (hợp đồng —
kết thúc phải ghi Record) và `payoutApi.ts` (Record) cùng cần storage mà **không** import lẫn nhau (không tạo vòng). Barrel + `seed.ts`
lấy key từ `./storage`. Không đổi tên key/giá trị.

#### 19.4.1. `OwnerPayoutRecord` (`payoutModel.ts`, storage `ownerPayoutRecords`) — BRD §6.6

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` · `code` | `string` | `opr_…` · `CTCX-000001` tuần tự |
| `contractId` · `ownerId` · `vehicleId` | `string` | Copy từ hợp đồng |
| `period` | `YYYY-MM` | Tháng được trả cho |
| `coverageFrom` · `coverageTo` | `YYYY-MM-DD` | Phần của kỳ nằm trong `[payoutStart, payoutEnd]` (§4) |
| `daysCovered` · `daysInMonth` | `number` | "Proration" BRD §6.6 hiển thị dạng `11/30` |
| `termVersionNo` · `fixedMonthlyAmount` · `paymentDay` · `prorationRule` | | Lấy từ `termVersions` hiệu lực tại `coverageFrom` (VC-BR-05, AC-VC-012) — **không** đọc `contract.paymentTerm` |
| `baseAmount` | `number` | §4 (`Math.round`, `TODO(OQ)` làm tròn — §0.4 điểm 10) |
| `adjustments` | `OwnerPayoutAdjustment[]` | `{ id; amount (nguyên ≠ 0, có dấu); note; status: OwnerPayoutAdjustmentStatus; requestedByName; requestedByRole; requestedAt; decidedByName?; decidedAt?; decisionNote? }` |
| `amountPayable` | `number` | = `baseAmount + Σ adjustments APPROVED` (> 0 — §19.1 điểm 20). Chỉ ghi qua `deriveAmountPayable` |
| `dueDate` | `YYYY-MM-DD` | `Payment Day` của tháng **sau** kỳ, kẹp ngày cuối tháng (§0.4 điểm 3, 9) |
| `status` | `PayoutStatus` | `SCHEDULED`/`ON_HOLD`/`PAID`/`CANCELLED` |
| `holdReason?` · `cancelReason?` | `string` | |
| `replacesRecordId?` · `replacedByRecordId?` | `string` | UC-VC-06 A1 |
| `payout?` | `{ paymentRequestId; transactionId; transactionCode; linkedAt; paidAt? }` | "Linked Owner Payout" BRD §6.6 — có = đang có lệnh chi; `paidAt` có ⇔ `status = PAID` |
| `statusHistory` | `{ from?; to; at; byName; reason? }[]` | Mọi chuyển trạng thái |
| `payoutLog` | `{ at; byName; event: 'LINKED' \| 'PAID' \| 'UNLINKED' \| 'REVERTED'; transactionCode; note? }[]` | Minh bạch VC-BR-13 trên màn VC |
| `createdByName` · `createdAt` · `updatedAt` | | |

#### 19.4.2. `ConsignmentContract` — thêm field (R1 đã hẹn ở §2.2)

`terminationNotice?: { requestedBy: ConsignmentTerminationRequester; noticeDate; plannedEndDate; reason; recordedByName; recordedAt }` ·
`endedDate?` (`YYYY-MM-DD`) · `endReason?: ConsignmentEndReason` · `returnRecordId?` ·
`lossInfo?: { eventDate; incidentId?; note; recordedByName; recordedAt }`. `CONTRACT_TRANSITIONS`: `ACTIVE → SUSPENDED/TERMINATED/CLOSED`,
`SUSPENDED → ACTIVE/TERMINATED/CLOSED`.

Biên bản `RETURN` (`ConsignmentHandoverRecord`, entity sẵn có): `appraisedValue` bỏ trống; `documentsReceived` dùng để ghi
**giấy tờ gốc trả lại chủ xe** (nhãn UI đổi theo `type`).

#### 19.4.3. Hàm thuần — `payoutModel.ts` (mọi hàm nhận `todayKey`/`uptoPeriod` làm tham số, không tự gọi `new Date()`)

| Hàm | Mục đích |
| --- | --- |
| `periodOf(dateKey)` · `daysInMonthOf(period)` · `nextPeriod(period)` · `periodRange(from, to)` | Tiện ích kỳ |
| `calcDueDate(period, paymentDay)` | §4 dòng `dueDate` |
| `resolveTermVersion(contract, dateKey)` | Bản mới nhất có `effectiveFrom ≤ dateKey`; không có → bản đầu |
| `calcPayoutWindow(contract)` → `{ start; end } \| undefined` | `start = max(effectiveFrom, ngày địa phương activatedAt)`; `end = min(effectiveTo, endedDate ?? effectiveTo)`; chưa từng kích hoạt → `undefined` |
| `calcPeriodPayout(contract, period)` → bản nháp Record \| `undefined` | Đúng §4 (cả `FULL_MONTH`) |
| `buildExpectedPayouts(contract, uptoPeriod)` | Mọi kỳ từ `start` tới `min(uptoPeriod, kỳ của end)` — dùng chung seed + sinh lịch |
| `planPayoutGeneration(contracts, records, uptoPeriod)` | Hợp đồng `ACTIVE`/`SUSPENDED` (BRD §10 — `SUSPENDED` vẫn trả đủ, `TODO(OQ)` "trừ khi Terms Snapshot ghi khác") × kỳ **chưa có Record không huỷ** → danh sách bản nháp (VC-BR-21: mỗi hợp đồng mỗi kỳ **một** Record) |
| `planContractEnd(contract, records, endedDate)` → `{ cancel: Record[]; create: draft[] } \| { error: string }` | §19.1 điểm 19: kỳ > kỳ(endedDate) → huỷ; kỳ của endedDate → huỷ + bản thay thế nếu `amount`/`coverageTo` đổi; bù kỳ còn thiếu tới kỳ(endedDate); Record bị ảnh hưởng đã `PAID`/có `payout` → `error` |
| `deriveAmountPayable(record)` | §19.4.1 |
| `canHold` · `canRelease` · `canAdjust` · `canDecideAdjustment` | Guard trạng thái (không có `payout`, không `PAID`/`CANCELLED`) |
| `getOwnerPayoutBlocker(record, owner)` → `string \| undefined` | VC-BR-10 / AC-VC-007: `SCHEDULED`, chưa có `payout`, không có điều chỉnh chờ duyệt, chủ xe có tài khoản, `amountPayable > 0`. **Dùng chung** API `finance` + UI |
| `applyOwnerPayoutLinked/Paid/Unlinked/Reverted(record, info)` | Biến đổi thuần (không storage, không audit) — dùng bởi 4 hàm đồng bộ §19.5 **và** seed finance §19.9 |
| `isPayoutDueSoon(record, todayKey)` (0 ≤ `dueDate − today` ≤ 3, `SCHEDULED`/`ON_HOLD`) · `isPayoutOverdue` (`dueDate < today`, `SCHEDULED`/`ON_HOLD`) | VC-BR-20 badge |
| `summarizeOwnerPayables(records, todayKey)` → theo chủ xe `{ ownerId; dueUnpaid; onHold; overdueCount; overdueAmount; paidTotal; nextDueDate? }` | BRD §14 "công nợ chủ xe" — `dueUnpaid` = Σ `amountPayable` Record `dueDate ≤ hôm nay` chưa `PAID`/`CANCELLED` (tách `ON_HOLD`) |
| `canCloseContract(contract, records, returnRecord, todayKey)` → lý do chặn \| `undefined` | `effectiveTo ≤ hôm nay` + có `RETURN` + mọi Record không huỷ `PAID` (UC-VC-11 A2) + không thiếu kỳ |
| `listBlockingRentals(rentals, vehicleId)` / `listDraftRentals` | §19.1 điểm 18 (nhận mảng `Rental` — kiểu `import type` từ `@/features/rentals/model`) |
| Schema zod: `ownerPayoutAdjustmentSchema`, `terminationNoticeSchema`, `consignmentReturnFormSchema`, `vehicleLossSchema` | RHF + `zodResolver` |

### 19.5. API

#### 19.5.1. `payoutApi.ts` (mới) — mọi hàm `fakeRequest`, đọc/guard/ghi **trong** callback, `appendAudit` entity `'OwnerPayoutRecord'`

| Hàm | Guard | Audit |
| --- | --- | --- |
| `listOwnerPayoutRecords(filter?: { contractId?; ownerId?; vehicleId?; period?; status? })` | sắp `period` giảm dần, `code` | — |
| `getOwnerPayoutRecord(id)` | | — |
| `generateOwnerPayoutRecords(actor)` → `{ created: number; upToPeriod }` | `planPayoutGeneration` tới kỳ hiện tại; 0 bản → không ghi, không audit | `GENERATE_OWNER_PAYOUT_RECORDS` (entityId `batch:<period>`, after = danh sách mã) |
| `holdOwnerPayoutRecord(id, reason, actor)` | `canHold`; lý do ≥ 3 | `HOLD_OWNER_PAYOUT_RECORD` |
| `releaseOwnerPayoutRecord(id, reason, actor)` | `ON_HOLD` | `RELEASE_OWNER_PAYOUT_RECORD` |
| `requestOwnerPayoutAdjustment(id, { amount; note }, actor)` | `canAdjust`; không có điều chỉnh chờ duyệt; kết quả > 0. Tự duyệt khi `can(actor.role,'CONSIGNMENT','EDIT') && can(…,'APPROVE')` — **ngoại lệ thứ 2 của F11** (quyết định luồng duyệt, không phải chặn quyền; comment tại chỗ) | `ADJUST_OWNER_PAYOUT_RECORD` (+ `APPROVE_…` nếu tự duyệt) |
| `decideOwnerPayoutAdjustment(id, adjustmentId, { decision; note? }, actor)` | `canDecideAdjustment`; từ chối cần lý do ≥ 3; duyệt → kết quả > 0 | `APPROVE_…`/`REJECT_OWNER_PAYOUT_ADJUSTMENT` |

**4 hàm đồng bộ cho `finance`** (export qua barrel; **đồng bộ, không `fakeRequest`** — gọi trong callback của finance, mirror tinh
thần `markSettlementOpened`; mỗi hàm đọc storage mới nhất, `throw` nếu sai trạng thái, ghi + `appendAudit`):
`linkOwnerPayoutRecord(recordId, { paymentRequestId; transactionId; transactionCode }, actor, now)` (Record `SCHEDULED`, chưa có
`payout`) · `markOwnerPayoutRecordPaid(recordId, { transactionId; paidAt }, actor, now)` (`payout.transactionId` khớp →
`PAID`) · `unlinkOwnerPayoutRecord(recordId, { transactionId; reason }, actor, now)` (giao dịch `FAILED`/`VOIDED` → gỡ `payout`,
giữ `SCHEDULED`) · `revertOwnerPayoutRecordPaid(recordId, { transactionId; reason }, actor, now)` (`PAID` → `SCHEDULED`, gỡ
`payout` — VC-BR-13).

#### 19.5.2. `api.ts` (sửa) — hợp đồng

| Hàm | Guard | Ghi Record | Audit |
| --- | --- | --- | --- |
| `activateConsignmentContract` (sửa) | như R1 | `buildExpectedPayouts(…, kỳ hiện tại)` cho hợp đồng vừa kích hoạt | + `GENERATE_OWNER_PAYOUT_RECORDS` nếu có bản mới |
| `recordConsignmentIntake` (sửa) | **+ `handoverAt ≤ now`** (nợ R1 #3) | — | như R1 |
| `notifyConsignmentTermination(id, { requestedBy; noticeDate; plannedEndDate; reason }, actor)` | `ACTIVE`/`SUSPENDED`; chưa có notice; §19.1 điểm 17 (thông điệp trích VC-BR-14) | — | `NOTIFY_CONSIGNMENT_TERMINATION` |
| `listVehicleRentalsForConsignment(vehicleId)` → `{ id; status; pickupDateTime; expectedReturnDateTime; customerId }[]` | đọc `RENTALS_STORAGE_KEY` (deep import `@/features/rentals/api`) | — | — |
| `listVehicleIncidentsForConsignment(vehicleId)` → `{ id; incidentCode; status; reportedAt }[]` | đọc `INCIDENTS_STORAGE_KEY` (deep import `@/features/incidents/api`) | — | — |
| `recordConsignmentReturn(contractId, input, actor)` | `ACTIVE`/`SUSPENDED`; chưa có `RETURN`; (có notice **và** ngày trả ≥ `plannedEndDate`) **hoặc** ngày trả ≥ `effectiveTo`; `handoverAt ≤ now` và ≥ `handoverAt` của `INTAKE`; `odoKm ≥ odo INTAKE`; không còn lượt thuê chặn (VC-BR-14); hai bên xác nhận (VC-BR-15) | — | `CREATE_CONSIGNMENT_RETURN` |
| `terminateConsignmentContract(id, actor)` | `ACTIVE`/`SUSPENDED`; có notice; có `RETURN` (VC-BR-15); `endedDate` = ngày của `RETURN`; `planContractEnd` không lỗi | huỷ/tạo theo `planContractEnd` | `TERMINATE_…` + `CANCEL_OWNER_PAYOUT_RECORD` từng bản + `GENERATE_…` nếu tạo |
| `closeConsignmentContract(id, actor)` | `ACTIVE`/`SUSPENDED`; `canCloseContract` (thông điệp nêu số khoản chưa chi + tổng tiền); `endedDate = effectiveTo` | — (không tự sinh; người dùng bấm "Sinh lịch" + chi trước) | `CLOSE_CONSIGNMENT_CONTRACT` |
| `recordConsignmentVehicleLoss(id, { eventDate; incidentId?; note }, actor)` | `ACTIVE`/`SUSPENDED`; `payoutStart ≤ eventDate ≤ hôm nay`; `incidentId` (nếu có) thuộc đúng xe; `planContractEnd` không lỗi. **Không** cần `RETURN` | huỷ/tạo theo `planContractEnd` | `TERMINATE_…` (summary "mất xe") + `CANCEL_…`/`GENERATE_…` |

Thông điệp lỗi/summary: tiếng Việt, trích `VC-BR-xx` khi hữu ích, **không** chứa `§`/`UC-`/`AC-`/`.md`/`Phase`/`Round`.

#### 19.5.3. `hooks.ts` / `index.ts`

Query key con dưới `['consignment']`: `'payout-records'`, `'payout-record'`, `'vehicle-rentals'`, `'vehicle-incidents'`; export
`CONSIGNMENT_QUERY_KEY = ['consignment'] as const` (finance dùng để invalidate). Mutation VC invalidate `['consignment']` (số liệu
`finance` tự làm mới vì query analytics `staleTime: 0` + refetch khi mount — tiền lệ `invalidateFinanceAll`).

Barrel R2 thêm: `OwnerPayoutScheduleScreen`, `OwnerBankAccountField`, `OwnerPayoutStatusBadge`, type `OwnerPayoutRecord`,
`OWNER_PAYOUT_RECORDS_STORAGE_KEY` (+ 3 key cũ chuyển nguồn sang `./storage`), `CONSIGNMENT_QUERY_KEY`, hooks
`useOwnerPayoutRecords`/`useVehicleOwners`/`useConsignmentContracts`, 4 hàm đồng bộ §19.5.1, hàm thuần
`getOwnerPayoutBlocker`/`applyOwnerPayoutLinked`/`applyOwnerPayoutPaid`/`applyOwnerPayoutReverted`/`isPayoutDueSoon`/
`isPayoutOverdue`/`summarizeOwnerPayables`/`maskAccountNumber`. Ghi comment khối "Round 2 — chỉ `features/finance` dùng".

**Chiều import (bắt buộc):** `consignment` **không** import `@/features/finance` và **không** import barrel `@/features/rentals` /
`@/features/incidents` (barrel `rentals` → `RentalDetailScreen` → `finance` → `consignment` sẽ thành **vòng mới**) — chỉ deep import
`@/features/rentals/api` + `@/features/incidents/api` (storage key) và `import type` từ `…/model` (tiền lệ deep-import `vehicles/api`).
Bảng §0.2 đã sửa theo điều này.

### 19.6. UI phía VC (`react-hook-form` + `zodResolver`, chuỗi ở `vi.consignment.*`, responsive 375/768)

1. **Gate trang (nợ R1 #1)**: component `ConsignmentNoPermission` + mẫu "wrapper kiểm quyền → component nội dung" (mirror
   `FinanceReportScreen` — không vi phạm rules-of-hooks, không tải dữ liệu khi thiếu quyền) cho **5** màn VC (4 màn R1 + màn mới).
2. **`OwnerPayoutScheduleScreen`** `/consignment/payouts` (gate `VIEW`): PageHeader + nút "Sinh lịch chi trả đến tháng này"
   (`EDIT`, toast số khoản mới). 4 thẻ KPI: phải trả kỳ đang chọn · quá hạn (số + tiền, toàn bộ) · tạm giữ (số + tiền) · sắp tới hạn
   ≤ 3 ngày. Bộ lọc: kỳ (mặc định kỳ hiện tại, có "Tất cả kỳ"), trạng thái, chủ xe, tìm số HĐ/biển số. Khối **"Tổng phải trả theo chủ
   xe"** của kỳ đang chọn (BRD §13 màn gộp). Bảng/card `OwnerPayoutRecordTable`: Mã · Kỳ · Chủ xe · Xe · Số HĐ · Tỷ lệ
   (`11/30`) · Mức/tháng · Điều chỉnh · Phải trả · Hạn chi (+ badge "Sắp tới hạn"/"Quá hạn") · Trạng thái (+ "Đang có lệnh chi
   GD-…"). Click → `OwnerPayoutRecordSheet`.
3. **`OwnerPayoutRecordSheet`**: diễn giải công thức (`9.000.000 × 11/30 = 3.300.000` + điều chỉnh = phải trả), phiên bản điều
   khoản, hạn chi, lý do tạm giữ/huỷ, liên kết bản thay thế/bị thay, danh sách điều chỉnh (trạng thái, người nhập/duyệt),
   `statusHistory`, `payoutLog`. Nút: Tạm giữ / Bỏ tạm giữ (`EDIT`, `ConsignmentReasonDialog`), Điều chỉnh (`EDIT`,
   `OwnerPayoutAdjustmentDialog` — số có dấu + ghi chú; hiện "sẽ chờ duyệt" khi người nhập thiếu `APPROVE`), Duyệt/Từ chối điều chỉnh
   (`EDIT` && `APPROVE`), link **"Đi tới chi trả"** → `paths.consignmentOwnerPayouts + '?record=<id>'` (hiện khi `CONFIRM`; bị
   chặn thì hiện lý do từ `getOwnerPayoutBlocker`).
4. **Chi tiết hợp đồng**: thêm tab **"Lịch chi trả"** (Record của hợp đồng, kể cả `CANCELLED` mờ). Thanh hành động thêm (theo
   trạng thái + quyền): "Thông báo chấm dứt" (`APPROVE`, chưa có notice) · "Lập biên bản trả xe" (`EXECUTE`, đủ điều kiện §19.5.2) ·
   "Chấm dứt hợp đồng" (`APPROVE`, có notice + `RETURN`) · "Đóng hợp đồng" (`APPROVE`, `effectiveTo ≤ hôm nay` + `RETURN`) ·
   "Ghi nhận mất xe" (`APPROVE`). Banner: đã thông báo chấm dứt (bên yêu cầu, ngày thông báo, ngày dự kiến kết thúc, "không nhận lượt
   thuê mới — chỉ thông tin"); `TERMINATED`/`CLOSED` (lý do kết thúc, ngày kết thúc); **mất xe**: khối "Tài liệu tham chiếu bồi
   thường" — `Appraised Value` + mã/ngày biên bản nhận xe + "bảo hiểm do công ty mua" + "bồi thường chủ xe do hai bên thoả thuận ngoài
   hệ thống" (VC-BR-16, AC-VC-015) + nút "Xuất PDF" chỉ toast + nhắc cập nhật trạng thái xe ở Danh sách xe. **Nợ R1 #2**: "Thay bằng
   bản mới" thành công → `navigate(paths.consignmentContractDetail(created.id))`.
5. **Dialog mới**: `ConsignmentTerminationNoticeDialog` (bên yêu cầu, ngày thông báo, ngày dự kiến kết thúc — hiện ngày sớm nhất
   hợp lệ theo Notice Period, lý do + `VehicleRentalImpactList`) · `ConsignmentReturnDialog` (mirror `ConsignmentIntakeDialog`: odo,
   nhiên liệu, hiện trạng, checklist, phụ kiện, giấy tờ gốc trả lại, ảnh/video giả lập, đại diện công ty, 2 xác nhận; **không** có
   định giá; `VehicleRentalImpactList` + chặn nút khi còn lượt thuê chặn) · `ConsignmentVehicleLossDialog` (ngày sự kiện, sự cố liên
   quan tuỳ chọn, ghi chú, hiện `Appraised Value` tham chiếu + xem trước khoản tháng cuối) · `ConsignmentEndDialog` (xác nhận
   Chấm dứt/Đóng: xem trước `planContractEnd` — kỳ cuối `x/y` ngày, số khoản bị huỷ, khoản thay thế, số khoản còn chưa chi) ·
   `OwnerPayoutAdjustmentDialog` · `VehicleRentalImpactList` (danh sách lượt thuê của xe: chặn / cảnh báo, link chi tiết lượt thuê).
   **Nợ R1 #3**: `handoverAt` ở `ConsignmentIntakeDialog` + `ConsignmentReturnDialog` — schema chặn thời điểm tương lai.
6. **Chi tiết chủ xe**: tab **"Lịch chi trả"** (Record của chủ xe + dòng tổng `summarizeOwnerPayables` của chủ xe đó).
   **Nợ R1 #4**: `vehicleOwnerFormSchema` thêm `hasExistingBankAccount: z.boolean().optional()` — nhập ngân hàng/chủ tài khoản mà
   không có số tài khoản (và chưa có tài khoản cũ) → lỗi ở ô số tài khoản; API `create` kiểm lại cùng luật.
7. **`VehicleConsignmentTab`**: khối **"Chi trả gần nhất"** (3 kỳ mới nhất không huỷ của hợp đồng hiện hành: kỳ, phải trả, hạn, trạng
   thái) + link màn Lịch chi trả.
8. `ConsignmentHandoverRecordsTab` hiện được biên bản `RETURN` (nhãn "giấy tờ trả lại", không có định giá).

### 19.7. Điểm nối `finance` — từng file (tầng `core ← payment ← settlement ← revenue-cost`, không barrel con, không vòng)

#### 19.7.1. `finance/core`

- `types.ts`: `PaymentRequest.rentalId?`/`customerId?` (optional) + `vehicleOwnerId?`/`ownerPayoutRecordId?`/`vehicleId?`/
  `consignmentContractId?`; `Transaction.customerId?` + `vehicleOwnerId?`/`ownerPayoutRecordId?`/`vehicleId?`/`payoutRecipient?`
  (chuỗi **đã che** "••••6789 — Ngân hàng — Chủ TK"). JSDoc trích `PM-BR-16`/`PM-BR-24`: `type === 'OWNER_PAYOUT'` ⇔ có
  `vehicleOwnerId`, không `customerId`/`rentalId`.
- Mọi chỗ `tsc` báo lỗi do optional: thêm narrowing/guard **đúng nghĩa** (không `!`/`as` ép kiểu): đường thu/hoàn của khách
  (`recordTransaction`, `createRefundTransaction`, settlement…) từ chối yêu cầu `source === 'CONSIGNMENT'` ngay đầu hàm ("Lệnh chi
  trả chủ xe — thao tác ở màn Chi trả chủ xe"); UI hiển thị `customerId ?? '—'`.

#### 19.7.2. `finance/payment`

- `model.ts`: **sửa `calcRequestProgress`** — chiều mong đợi `OUT` cho `purpose` `REFUND` **và** `PAYOUT` (hiện tại `PAYOUT` sẽ bị
  tính như thu — lỗi âm thầm). **Sửa `buildReversalPair`**: giao dịch đối ứng chép cả `vehicleOwnerId`/`ownerPayoutRecordId`/
  `vehicleId`/`payoutRecipient` (hiện chỉ chép `customerId`/`rentalId`…). `ownerPayoutCreateFormSchema` (`reference?`, `note?` — `useState` + `safeParse`, ngoại lệ §7).
- `api.ts`: `createOwnerPayout(recordId, input, actor)` — trong callback: đọc Record/chủ xe/hợp đồng qua storage key của barrel
  `consignment`; `getOwnerPayoutBlocker` (VC-BR-10/AC-VC-007 — thông điệp "Chỉ tạo lệnh chi từ khoản chi trả đã lên lịch (VC-BR-10)");
  chặn nếu Record đã có yêu cầu chưa huỷ; tạo `PaymentRequest` `CONSIGNMENT`/`PAYOUT`/`OWNER_PAYOUT` (`expectedAmount = amountPayable`,
  gắn chủ xe/Record/xe/hợp đồng, `note` "Chi trả chủ xe kỳ MM/YYYY — HĐ …") + `Transaction` `OWNER_PAYOUT` `OUT` `PENDING`
  `BANK_TRANSFER` (`TODO(OQ: Payment-BRD.md §27 Q24 — phương thức chi)`, `payoutRecipient` đã che, **không** `customerId`/`rentalId`,
  không gắn quỹ) → `linkOwnerPayoutRecord` → audit `CREATE_OWNER_PAYOUT` (entity `Transaction`). `confirmTransaction`/`failTransaction`/
  `voidTransaction`/`reverseTransaction`: sau khi ghi, nếu `before.type === 'OWNER_PAYOUT'` → `syncOwnerPayoutAfterPaymentChange`.
  `confirmTransaction` với `OWNER_PAYOUT`: không cho sửa số (nhánh `OUT` sẵn có), không kiểm quỹ (không phải `CASH`).
- `ledger.ts`: `syncOwnerPayoutAfterPaymentChange(transactionId, actor, now)` — tính lại `status` yêu cầu (`deriveRequestStatus`);
  `CONFIRMED` → `markOwnerPayoutRecordPaid`; `FAILED`/`VOIDED` → yêu cầu `CANCELLED` (+ `cancelReason`) + `unlinkOwnerPayoutRecord`;
  `REVERSED` → yêu cầu `CANCELLED` + `revertOwnerPayoutRecordPaid` (§19.1 điểm 23). Chạy trong **cùng callback** (nguyên tử).
- `hooks.ts`: `useCreateOwnerPayout`; `useConfirmTransaction`/`useFailTransaction`/`useVoidTransaction`/`useReverseTransaction` +
  `useCreateOwnerPayout` invalidate thêm `CONSIGNMENT_QUERY_KEY`.
- `screens/OwnerPayoutScreen.tsx` (mới, mount `/consignment/owner-payouts`, gate trang `CONSIGNMENT.VIEW`; dữ liệu qua hook barrel
  `consignment` + `useTransactions({ type: 'OWNER_PAYOUT' })` + `useVehicles` deep như tiền lệ finance):
  (a) **Công nợ chủ xe** (BRD §14): bảng theo chủ xe từ `summarizeOwnerPayables` — đến hạn chưa chi · tạm giữ · quá hạn (badge
  cảnh báo) · đã chi (Σ giao dịch `OWNER_PAYOUT` hiệu lực) · hạn kế tiếp; (b) **Khoản chờ chi** (Record `SCHEDULED`, sắp theo
  `dueDate`): nút **"Tạo lệnh chi"** (`CONSIGNMENT.CONFIRM`, ẩn/khoá + lý do khi `getOwnerPayoutBlocker`) → `OwnerPayoutCreateDialog`
  (số tiền chỉ đọc, người nhận đã che + `OwnerBankAccountField` "Hiện đầy đủ" có meta-audit, mã tham chiếu/ghi chú tuỳ chọn); Record
  đang có lệnh chi → hiện mã GD + mở `TransactionDetailSheet` sẵn có (xác nhận `PAYMENT.CONFIRM` / huỷ `PAYMENT.VOID`); (c) **Đã
  chi gần đây** (giao dịch `OWNER_PAYOUT` `CONFIRMED`/`REVERSED`, mở `TransactionDetailSheet` — đảo theo `PAYMENT.REVERSE`, lưu ý
  Accountant `TBD`). `?record=<id>` → cuộn tới + mở sẵn dialog tạo lệnh chi nếu tạo được.
- `components/OwnerPayoutCreateDialog.tsx` (mới). `TransactionDetailSheet.tsx` + `ReceiptDialog.tsx`: nhãn đối tượng "Chủ xe"
  + tên chủ xe (link chi tiết chủ xe) khi `vehicleOwnerId`, hiện `payoutRecipient` + kỳ/Record. `TransactionLedgerScreen.tsx`: cột
  "Khách hàng" → "Đối tượng" (tên khách **hoặc** tên chủ xe). `CashDrawerScreen.tsx`/`CustomerReceivablesScreen.tsx`: chỉ sửa kiểu nếu
  `tsc` yêu cầu. `seed.ts`: bước `seedOwnerPayouts` (§19.9.2).
- `deriveCustomerBalances`, Report 03 (khách), quỹ tiền mặt: **không** được đếm `OWNER_PAYOUT` (không có `customerId`/`rentalId`,
  không `CASH`) — kiểm, không cần sửa logic.

#### 19.7.3. `finance/revenue-cost`

- `model.ts`: `CostEntry.sourceRef` + `ownerPayoutRecordId?`/`consignmentContractId?`; `CashEntry.customerId?`;
  `deriveConsignmentPayoutCostEntries(records)` → `CONSIGNMENT_PAYOUT`, `DIRECT`, `source: 'SYSTEM'`, `costDate = '<period>-01'`,
  `amount = amountPayable`, `vehicleId`, `sourceLabel` = mã Record · kỳ; **bỏ `CANCELLED`**, giữ `ON_HOLD`/`SCHEDULED`/`PAID` (ghi
  nhận dồn tích theo nghĩa vụ hợp đồng — comment tại chỗ, `RV-BR-19`, §0.4 điểm 4).
- `api.ts` `listCostEntries`: thay comment chừa chỗ bằng dòng nối nguồn (đọc `OWNER_PAYOUT_RECORDS_STORAGE_KEY` của barrel
  `consignment`). `reportModel.ts`: sửa docstring `buildReconciliation` (bỏ `TODO(Phase 5)`, `costPaid` = Σ `OWNER_PAYOUT` hiệu lực
  theo ngày xác nhận — logic giữ nguyên); `ensure(cash.customerId)` ở Report 03 thêm guard kiểu.
- `VehicleProfitTab.tsx` + `FinanceReportScreen.tsx`: **gỡ banner** + `TODO(Phase 5)`; thay bằng ghi chú trung tính (muted)
  `vi.finance.revenueCost.profitConsignmentIncludedNote` "Chi phí trực tiếp đã gồm khoản chi trả cố định hàng tháng cho chủ xe
  ký gửi." (hiện khi xe/đội xe có xe ký gửi); **giữ** `TODO(OQ: RevenueCost-BRD.md §28 Q18 …)`.
- `CostEntryTable.tsx`: dòng `CONSIGNMENT_PAYOUT` link tới chi tiết hợp đồng (`paths.consignmentContractDetail`).

#### 19.7.4. Gốc `finance` + app

`finance/index.ts` export `OwnerPayoutScreen`; `finance/seed.ts` đăng ký `seedOwnerPayouts` **cuối cùng** (sau
`seedRevenueCost`). `app/paths.ts` + `consignmentOwnerPayouts: '/consignment/owner-payouts'`; `app/routes.tsx`: `/consignment/payouts`
→ `OwnerPayoutScheduleScreen` (bỏ `ComingSoon`), `/consignment/owner-payouts` → `OwnerPayoutScreen`; `shared/layout/nav.tsx` mục thứ
4 "Chi trả chủ xe" (`CONSIGNMENT`/`VIEW`) — F9. `permissions.ts` **không** đổi.

### 19.8. Công thức + bảng tính tay (bổ sung §4)

```text
Kết thúc giữa tháng (UC-VC-06 A1):  endedDate = 12/09/2026, Record 09/2026 trọn tháng 8.000.000 (SCHEDULED)
  → Record cũ CANCELLED (cancelReason) + Record mới 01/09–12/09: round(8.000.000 × 12/30) = 3.200.000, replacesRecordId = cũ
  → Record 10/2026 (nếu đã sinh, chưa chi) CANCELLED, không sinh thay thế               (AC-VC-015)
Điều chỉnh: baseAmount 9.000.000 + (−1.000.000 APPROVED) = amountPayable 8.000.000; điều chỉnh PENDING không tính
Đến hạn / quá hạn (today 22/10/2026): dueDate 25/10 → "Sắp tới hạn" (3 ngày); dueDate 05/10 chưa PAID → "Quá hạn"
```

6 ca §4 + 3 ca trên (chấm dứt giữa tháng có Record trọn tháng sẵn · điều chỉnh duyệt/chờ · kết thúc khi kỳ đã `PAID` → lỗi) phải
chạy bằng hàm thuần trong harness (§19.11 mục 2).

### 19.9. Seed (`SEED_VERSION` 20 → 21)

#### 19.9.1. `consignment/seed.ts` (chạy trước finance — không ghi audit)

1. R1 bổ sung field R2: #15 (`veh_007`, `TERMINATED`): `endReason = EARLY_TERMINATION`, `endedDate = dayKey(−35)`,
   `terminationNotice = { requestedBy: OWNER, noticeDate = endedDate − noticePeriodDays, plannedEndDate = endedDate, reason }`,
   `returnRecordId`. #17 (`veh_013`, `CLOSED`): `endReason = EXPIRED`, `endedDate = effectiveTo`, `returnRecordId`.
2. Record cho mọi hợp đồng đã kích hoạt (#1–15, #17) = `buildExpectedPayouts(contract, kỳ hiện tại)` (**cùng hàm** runtime), mã
   `CTCX-…` theo thứ tự (hợp đồng, kỳ), id `opr_001…`, `createdAt` = max(ngày 1 của kỳ 08:00, `activatedAt`), `createdByName`
   "Hệ thống". Mọi Record khởi tạo `SCHEDULED`.
3. Quy tắc trạng thái/điều chỉnh (theo luật, không gõ tay từng bản): (a) chủ xe `own_009` (chưa có tài khoản) → **mọi** Record
   `ON_HOLD` "Chủ xe chưa cung cấp tài khoản ngân hàng"; (b) #10 (`SUSPENDED` −12) → Record có `dueDate ≥` ngày tạm ngưng →
   `ON_HOLD` "Tạm giữ do tranh chấp điều khoản, chờ làm rõ"; (c) #12 kỳ (hiện tại − 1): điều chỉnh `−1.000.000` `APPROVED` ("Hai bên
   thống nhất giảm do xe nằm xưởng 5 ngày vì lỗi công ty" — Accountant nhập, Manager duyệt); (d) #13 kỳ hiện tại: điều chỉnh
   `+500.000` `PENDING_APPROVAL` (Accountant nhập "Hỗ trợ phí gửi xe theo thoả thuận"). Mọi mốc thời gian `createdAt ≤ mốc ≤ now`.
4. Bước kiểm (`throw`): mỗi hợp đồng `ACTIVE`/`SUSPENDED` có đúng 1 Record không huỷ cho mỗi kỳ từ `payoutStart` tới kỳ hiện tại;
   không Record nào có kỳ > kỳ hiện tại; `amountPayable === deriveAmountPayable(r)`; #15/#17 không có Record sau kỳ của `endedDate`.

#### 19.9.2. `finance/payment/seed.ts` — bước mới `seedOwnerPayouts` (chạy **cuối** finance; không audit)

1. Với mỗi Record `SCHEDULED` có `dueDate < hôm nay` và chủ xe có tài khoản: `PaymentRequest` + `Transaction` `OWNER_PAYOUT`
   `BANK_TRANSFER` (`performedAt` = `dueDate − 2` 09:00, `confirmedAt` = `dueDate` 14:00, người thực hiện = kế toán seed
   `PM_ACCOUNTANT_*`), rồi biến đổi Record bằng `applyOwnerPayoutLinked` + `applyOwnerPayoutPaid` (hàm thuần của barrel
   `consignment` — **cùng logic** runtime) và ghi lại `OWNER_PAYOUT_RECORDS_STORAGE_KEY` (ngoại lệ seed có kiểm soát: bước seed của
   `finance` ghi storage `consignment` qua key + hàm thuần do `consignment` export, không tự dựng object Record).
2. Ngoại lệ có chủ đích: **#1 kỳ (hiện tại − 3)** — giao dịch A `CONFIRMED` → đảo (`buildReversalPair`, "Chuyển nhầm sang tài khoản
   cũ của chủ xe") lúc `dueDate + 1` 10:00, yêu cầu A `CANCELLED`, Record `applyOwnerPayoutReverted`; giao dịch B (yêu cầu mới)
   `CONFIRMED` `dueDate + 2` 14:00 → Record `PAID` theo B (demo VC-BR-13). **#6 kỳ (hiện tại − 1)** — chỉ tạo giao dịch `PENDING`
   (`performedAt = min(dueDate − 2, hôm nay − 1)` 09:00, ≥ `createdAt` của Record) + `applyOwnerPayoutLinked` → demo "Xác nhận đã chi".
3. Mã `GD-…` mới nối tiếp sau toàn bộ mã cũ (`nextSequenceCode`), cấp theo thứ tự thời gian `performedAt`; **mã giao dịch cũ không
   đổi**. `PaymentRequest.status` suy bằng `deriveRequestStatus` (sau khi sửa `calcRequestProgress`), không gõ tay.
4. Bước kiểm (`throw`): mỗi Record `PAID` có đúng 1 giao dịch `OWNER_PAYOUT` hiệu lực, số tiền = `amountPayable`; không giao dịch
   `OWNER_PAYOUT` nào có `customerId`/`rentalId`/`method ≠ BANK_TRANSFER`; mọi mốc ≤ now.

Số lượng dự kiến (today 22/10/2026 — §19.11): **145 Record** (126 `PAID` · 14 `SCHEDULED` gồm 1 đang có lệnh chi · 5 `ON_HOLD` · 0
`CANCELLED`) · **129 giao dịch** `OWNER_PAYOUT` mới (126 hiệu lực + 1 bị đảo + 1 đối ứng + 1 `PENDING`) · **128 yêu cầu** (126
`FULFILLED` + 1 `CANCELLED` + 1 `OPEN`). Quỹ tiền mặt không đổi.

### 19.10. File tạo / sửa / cấm

**Tạo:** `src/features/consignment/{storage,payoutModel,payoutApi}.ts` · `consignment/components/`: `ConsignmentNoPermission.tsx`,
`OwnerPayoutStatusBadge.tsx`, `OwnerPayoutRecordTable.tsx`, `OwnerPayoutRecordSheet.tsx`, `OwnerPayoutAdjustmentDialog.tsx`,
`ConsignmentTerminationNoticeDialog.tsx`, `ConsignmentReturnDialog.tsx`, `ConsignmentVehicleLossDialog.tsx`,
`ConsignmentEndDialog.tsx`, `VehicleRentalImpactList.tsx` · `consignment/screens/OwnerPayoutScheduleScreen.tsx` ·
`src/features/finance/payment/screens/OwnerPayoutScreen.tsx` · `finance/payment/components/OwnerPayoutCreateDialog.tsx`.

**Sửa:** `consignment/{model,api,hooks,seed,index}.ts`; `consignment/components/{VehicleConsignmentTab,ConsignmentContractOverviewTab,
ConsignmentHandoverRecordsTab,ConsignmentIntakeDialog,VehicleOwnerFormSheet}.tsx`; 4 screen R1; `finance/core/types.ts`;
`finance/payment/{model,api,ledger,hooks,seed}.ts`; `finance/payment/components/{TransactionDetailSheet,ReceiptDialog}.tsx`;
`finance/payment/screens/TransactionLedgerScreen.tsx` (+ `CashDrawerScreen`/`CustomerReceivablesScreen`/file `settlement`/
`RefundCreateDialog`… **chỉ** khi `tsc` báo do kiểu optional); `finance/revenue-cost/{model,api,reportModel}.ts`;
`finance/revenue-cost/components/{VehicleProfitTab,CostEntryTable,CustomerReportPanel?}.tsx`;
`finance/revenue-cost/screens/FinanceReportScreen.tsx`; `finance/{index,seed}.ts`; `shared/domain/enums.ts`;
`shared/i18n/vi.ts`; `app/paths.ts`; `app/routes.tsx`; `shared/layout/nav.tsx`; `shared/fixtures/seedAll.ts` (21).

**Cấm:** `features/vehicles/**` · `features/rentals/**` · `features/incidents/**` (chỉ được **đọc** qua deep import `api`/`model`
type) · mọi feature khác · `shared/domain/permissions.ts` · `shared/ui/**` · `shared/fixtures/registerSeeds.ts` · `docs/**` ·
`CHANGELOG.md`.

### 19.11. Definition of Done — Round 2

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới; `git diff --stat` ⊆ §19.10.
2. **Harness** (copy `seed-harness.mjs` v2 của scratchpad `finance-refactor` sang scratchpad mới, giữ `FIXED_NOW =
   2026-10-22T10:00+07:00` + reset RNG, chạy **trước** (`HEAD` = `19d78d6`, qua `git worktree` ở scratchpad — **không** `git stash`)
   và **sau**): (a) 6 ca §4 + 3 ca §19.8 ra đúng số; (b) bảng số trước/sau ở mục 3–5; (c) `import-graph.mjs` 0 vòng trong `finance`
   + `grep -rn "@/features/finance\|@/features/rentals'\|@/features/incidents'" src/features/consignment` rỗng.
3. **Không đổi** (trước = sau): doanh thu ghi nhận 12 tháng 63.750.000 · thực thu 109.510.000 · chênh −45.760.000 · `rt_026` 975.000 ·
   doanh thu tháng trước 7.050.000 · 27 Revenue Line · công nợ khách hàng · mã `GD-…` cũ.
4. **Đổi đúng bằng payout** (số dự kiến `tech-lead` tính bằng script độc lập theo luật §4/§19.9 — `dev` phải ra **đúng** hoặc giải
   thích chênh): Σ Cost `CONSIGNMENT_PAYOUT` 12 tháng (11/2025–10/2026) **1.269.283.178** = mức tăng chi phí trực tiếp = mức giảm lợi
   nhuận vận hành 12 tháng; kỳ 09/2026 **140.100.000** (chi phí trực tiếp tháng trước 5.880.000 → **145.980.000**, lợi nhuận vận hành
   1.170.000 → **−138.930.000**); kỳ 10/2026 **136.000.000** (chi phí trực tiếp 18.080.000 → **154.080.000**, lợi nhuận −5.930.000 →
   **−141.930.000**); `costPaid` đối chiếu 12 tháng 0 → **1.106.541.243** (123 giao dịch hiệu lực xác nhận trong kỳ); Cost Entry
   70 → **215**; Cash Entry 64 → **190**; lợi nhuận 12 tháng `veh_001` giảm đúng **152.903.226**. Với **mọi** xe X, kỳ K: Σ
   `amountPayable` Record (không huỷ) = Σ Cost `CONSIGNMENT_PAYOUT` (X, K) ở `/finance/costs` = lợi nhuận(X,K) trước − sau.
5. Prorate seed: #14 (`veh_016`) kỳ 08/2026 = `round(5.000.000 × 17/31)` = **2.741.935**; #15 kỳ 09/2026 = 5.100.000 (17/30); #17 kỳ
   08/2026 = 2.741.935 (17/31); #7 (`FULL_MONTH`) kỳ đầu = 15.000.000.
6. Luồng (đọc code + harness gọi API; người dùng tự bấm thử sau bàn giao): kích hoạt #19 sinh Record kỳ đúng; sinh lịch lần 2 → 0
   bản mới; tạo lệnh chi từ Record chưa sinh/`ON_HOLD`/có điều chỉnh chờ duyệt/chủ xe thiếu tài khoản → bị từ chối (AC-VC-007);
   tạo lệnh chi → xác nhận → Record `PAID`, Cost không đổi, `costPaid` tăng; đảo → Record `SCHEDULED`, yêu cầu `CANCELLED`, Cost
   không đổi, `costPaid` giảm đúng số đó; huỷ/thất bại → gỡ liên kết; #2 (`veh_002`, không còn lượt thuê chặn) thông báo chấm dứt (ngày
   thông báo lùi ≥ 30 ngày) → biên bản trả xe → Chấm dứt: Record tháng hiện tại huỷ + bản prorate tới ngày trả; trả xe khi còn lượt
   thuê chặn (vd `veh_004`) → bị từ chối (VC-BR-14); mất xe giữa tháng → AC-VC-015; "Đóng" khi còn khoản chưa chi → từ chối nêu số
   khoản; guard có mặt ở **API**, không chỉ UI.
7. Phân quyền: `OPERATION_STAFF` gõ URL `/consignment/owners/own_001` (và 4 URL còn lại) → màn không có quyền, không tải dữ liệu;
   `ACCOUNTANT` sinh lịch/tạm giữ/điều chỉnh (chờ duyệt)/tạo lệnh chi/xác nhận được, không chấm dứt/đóng; `MANAGER` duyệt điều chỉnh,
   **không** có nút tạo lệnh chi (`CONFIRM` = `TBD`); `SALES` không điều chỉnh/duyệt điều chỉnh, có chấm dứt/đóng/mất xe. Không có
   `if (role === …)`.
8. Mọi hàm ghi (kể cả 4 hàm đồng bộ) có `appendAudit`; payload chủ xe/giao dịch không chứa số tài khoản đầy đủ; mọi đọc/guard trong
   callback `fakeRequest`; schema dùng thật (RHF+`zodResolver` ở VC, `safeParse` ở finance); chuỗi UI/lỗi/audit không chứa `§`,
   `UC-`, `AC-`, `.md`, `Phase`, `Round`; ngày nghiệp vụ là ngày địa phương `YYYY-MM-DD`.
9. Không còn `TODO(Phase 5)` trong `src/` ngoài `vehicles`/`maintenance` (roadmap); `TODO(OQ: RevenueCost-BRD.md §28 Q18 …)` còn.

### 19.12. Danh sách file `dev` đọc trước — Round 2 (đúng danh sách, không scan rộng)

**Nghiệp vụ:** (1) `docs/CONSIGNMENT-PLAN.md` §0.2–§0.4, §2.2, §3, §4, §9, **§19 toàn bộ**; (2) `VehicleConsignment-BRD.md` §6.6,
§6.7, §7.2, §7.3, §10, §11 (dòng mất xe), §13, §14, §15, §17, §18, §19 (AC-VC-007/011/013/014/015); (3) `VehicleConsignment-UseCase.md`
§10, §12.4, §13, §15, §16; (4) `Payment-BRD.md` dòng 130–190, 230–245, 490–505; (5) `RevenueCost-BRD.md` dòng `RV-BR-19`.

**Code:** (6) `src/features/consignment/` — `model.ts`, `api.ts`, `seed.ts`, `hooks.ts`, `index.ts`, `screens/ConsignmentContractDetailScreen.tsx`,
`components/ConsignmentIntakeDialog.tsx`, `components/ConsignmentReasonDialog.tsx`, `components/VehicleConsignmentTab.tsx`,
`components/OwnerBankAccountField.tsx`; (7) `src/features/finance/core/{types,storage,hooks}.ts`; (8) `finance/payment/api.ts`,
`ledger.ts`, `model.ts` (dòng 80–180, 440–490, 684–695), `hooks.ts`, `seed.ts` (dòng 1–60 + cuối file), `components/TransactionDetailSheet.tsx`,
`screens/CustomerReceivablesScreen.tsx` (mẫu màn công nợ); (9) `finance/revenue-cost/api.ts` (dòng 1–110), `model.ts` (dòng 40–170,
400–500), `reportModel.ts` (dòng 440–510), `components/VehicleProfitTab.tsx`, `components/CostEntryTable.tsx`,
`screens/FinanceReportScreen.tsx` (dòng 80–100, 380–400); (10) `finance/seed.ts`, `finance/core/seedHelpers.ts`;
(11) `src/features/rentals/api.ts` dòng 1–40 + `incidents/api.ts` dòng 1–40 (chỉ để lấy storage key); (12) `shared/domain/enums.ts`
(khối Payment ~180–215, VC ~370–395, cuối `AUDIT_ACTIONS`), `shared/domain/permissions.ts` khối Nhóm 7 + `PAYMENT`;
(13) `app/paths.ts`, `app/routes.tsx`, `shared/layout/nav.tsx`, `shared/fixtures/seedAll.ts`; (14) scratchpad
`finance-refactor/seed-harness.mjs` + `import-graph.mjs`.

### 19.13. Thứ tự làm đề xuất

1. `enums.ts` + nhãn `vi.ts` → `consignment/storage.ts` (tách cơ học, chạy `tsc`) → `payoutModel.ts` (+ harness 9 ca ngay) →
   `payoutApi.ts` → sửa `api.ts` (kết thúc/trả xe/mất xe/kích hoạt sinh lịch/guard `handoverAt`) → `hooks.ts` → `index.ts`.
2. `consignment/seed.ts` (field R2 + Record + bước kiểm).
3. `finance/core/types.ts` + sửa `calcRequestProgress` → `payment/api.ts`/`ledger.ts`/`hooks.ts` → `payment/seed.ts` bước
   `seedOwnerPayouts` + `finance/seed.ts` → `SEED_VERSION` 21 → harness "sau" (đối chiếu §19.11 mục 3–5 **trước** khi làm UI).
4. `revenue-cost` (Cost + gỡ banner + docstring).
5. UI VC: gate 5 màn → `OwnerPayoutScheduleScreen` + Sheet + bảng → tab Lịch chi trả (hợp đồng, chủ xe) → dialog chấm dứt/trả xe/
   kết thúc/mất xe → khối tab xe → 4 nợ R1 còn lại.
6. UI finance: `OwnerPayoutScreen` + dialog → sổ giao dịch/sheet/biên lai → `paths`/`routes`/`nav`.
7. 3 cổng + các `grep` §19.11 + bảng số trước/sau trong báo cáo bàn giao.
