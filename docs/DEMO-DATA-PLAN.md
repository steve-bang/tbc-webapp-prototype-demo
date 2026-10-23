# Kế hoạch — Dữ liệu demo: lịch sử lượt thuê 12 tháng (Phase 5.1)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (23/10/2026 — `tech-lead` tự duyệt theo giao việc: người dùng
nói "Giao tech-lead bổ sung lịch sử lượt thuê trước" (trước Phase 6). Không có quyết định nghiệp vụ mới — mọi con số mục
tiêu là **giả định dữ liệu demo** (§1), các điểm chạm Open Question xử lý bằng cách **tránh** (§0.2), không tự chốt) ·
**Đã giao `dev`** (23/10/2026) · **`DONE`** (23/10/2026 — review `tech-lead` đạt vòng 1, không Blocker; 3 chỗ lệch plan được
chấp nhận — §10).

> **Dữ liệu giả lập phục vụ demo — KHÔNG phải số liệu kinh doanh thật của Thiên Bảo Car.** Hệ số khai thác, giá, cơ cấu
> khách, mùa vụ dưới đây do `tech-lead` đặt để màn tài chính trông giống một doanh nghiệp cho thuê xe tự lái đang vận
> hành; khách hàng/BA không cần duyệt từng con số.

**Nguồn:** `../thien-bao-car-docs/WebappQuanTri.md` §10–§11 (lượt thuê, tài chính) · `RentalManagement-BRD.md` §17/§18
(snapshot giá, cọc 2 phần — CR-2026-003/060), RM-BR-04/RM-BR-23 (chống trùng lịch + buffer 90 phút), RM §51 (khung
21:00 — CR-2026-005) · `VehicleManagement` CR-2026-008 (Vehicle Class → `Price Per KM`) · `VehicleConsignment-BRD.md`
(chỉ khai thác xe ký gửi khi hợp đồng hiệu lực, không khi `SUSPENDED`) · `RevenueCost-BRD.md` §12/§16 (Utilization,
Report 02), §28 Q10 (mẫu số "ngày khả dụng" — OQ) · `BusinessRequirementDocument.md` §51 Q53 (nhánh "thuê tháng" — OQ).
**Kỹ thuật:** `CONVENTIONS.md` §4, `docs/REVENUE-COST-PLAN.md` §9.2 (tiền lệ seed lịch sử phương án B — `rt_030…rt_039`,
`seedRevenueHistory`), `docs/FINANCE-REFACTOR-PLAN.md` (tầng `finance`), `docs/CONSIGNMENT-PLAN.md` §19.11/§20.12 (số
chi trả chủ xe hiện có).

---

## 0. Bối cảnh & quyết định thiết kế (tự duyệt)

### 0.1. Vấn đề

Sau Phase 5, chi phí trực tiếp 12 tháng ≈ **1,30 tỷ** (gần hết là chi trả cố định cho xe ký gửi `CONSIGNMENT_PAYOUT`,
~146–155 triệu/tháng ở các tháng gần đây) nhưng doanh thu 12 tháng chỉ **63,75 triệu** từ 15 quyết toán → lợi nhuận vận
hành **âm ở cả 12/12 tháng** (tháng trước −138,9 triệu, tháng này −142,4 triệu), Utilization đội xe 12 tháng **1,3%**. Màn
Báo cáo tài chính / Hiệu quả xe / tab Lợi nhuận Vehicle Detail vì vậy không trình khách được.

### 0.2. Quyết định

| # | Quyết định | Lý do |
| --- | --- | --- |
| D1 | **Chỉ thêm dữ liệu seed**, không sửa model/api/hooks/UI/barrel/`registerSeeds.ts`. | Ràng buộc giao việc. |
| D2 | `rentals/seed.ts` **chỉ nối thêm** (git diff không có dòng `-`): một hàm sinh tất định đặt sau `seedRentals`-input cũ, gọi `inputs.push(...)` ngay trước `writeJson(...)`. | Tiền lệ R1 Phase 4.3. |
| D3 | Bước tài chính cho lượt mới là **bước seed mới chạy CUỐI CÙNG** (đăng ký sau `seedOwnerPayouts`), hàm mới trong `finance/revenue-cost/seed.ts`; **không sửa** `seedRevenueHistory`/`seedRevenueCost`/`seedOwnerPayouts`. | Giữ nguyên mã `GD-`/`CK-` cũ (kể cả của chi trả chủ xe) và chuỗi `generateId` của mọi bản ghi cũ — harness so sánh "bản ghi cũ bằng hệt" được (§5.2). |
| D4 | Bộ sinh khách + lượt thuê dùng **PRNG cục bộ có hạt giống cố định** (vd `mulberry32(20261023)`), **cấm `Math.random`/`generateId`** trong `customers/seed.ts` và `rentals/seed.ts`. | `vehicles/seed.ts` (chạy sau `customers`) dùng `Math.random` — tiêu thụ thêm số ngẫu nhiên sẽ làm đổi id/số giấy tờ xe cũ. |
| D5 | Thời lượng mỗi lượt **2–14 ngày**, không có lượt ≥ 28 ngày. | Tránh nhánh "thuê tháng" còn là OQ (`BusinessRequirementDocument.md` §51 Q53 — `calcAllowedKm` có `TODO(OQ)`). Comment `TODO(OQ: BRD §51 Q53)` tại hằng số giới hạn. |
| D6 | Giá = **đúng mức theo hạng xe đang dùng ở seed hiện có**: `VIP_LUXURY` 1.800.000 · `STANDARD` 900.000 · `TWO_SEATER` 500.000/ngày; `Price Per KM`/`Allowed KM` do `buildRental` tự snapshot (CR-2026-008, RM-BR-24). **Không giảm giá, không phụ phí, không phí giao** trên Rental. | Giảm giá làm Final < số đã thu (lịch 30/70 tính trên `baseAmount`) → phải dựng luồng hoàn tiền thừa; chính sách giá thuê dài ngày cũng chưa có trong tài liệu. |
| D7 | Cọc: **~20% `CASH_20M`** (thu cọc khi giao + hoàn cọc đủ 20 triệu sau quyết toán, có duyệt vì > ngưỡng `REFUND_APPROVAL_THRESHOLD`) · **~80% `MOTORBIKE`** (mô tả xe máy **riêng theo từng khách**, giá trị ≥ 15 triệu — CR-2026-003). | Cọc hợp lý mà không bùng nổ kích thước dữ liệu (§6). |
| D8 | Khoản phát sinh: ~8% lượt **`MOTORBIKE`** có 1 dòng `MANUAL_OTHER` 150.000–300.000đ (vệ sinh/khử mùi/rửa xe) thu đủ qua yêu cầu `COLLECT` — đúng đường `seedRevenueHistory` đã dùng. Không áp cho `CASH_20M`. | Với `CASH_20M` khoản thiếu sẽ đối trừ cọc → cần `OFFSET` + hoàn phần còn lại, phức tạp không cần thiết. |
| D9 | Mọi giao dịch mới `BANK_TRANSFER`, `CONFIRMED`; **không** tạo `CASH`. | Giữ nguyên số quỹ AC-PM-009 (Quỹ tiền mặt). |
| D10 | Thêm **48 khách** `cus_010…cus_057` (nối cuối mảng ở `customers/seed.ts`, chỉ thêm). | 8 khách hiện có thì mỗi người ~35 lượt/năm — vô lý ở Report 03 Khách hàng. Pool khách cũ cho lượt mới chỉ gồm khách `ACTIVE` **có GPLX B2 còn hạn**: `cus_001`, `cus_002`, `cus_004`, `cus_009` (loại `cus_003` hộ chiếu không GPLX, `cus_005` GPLX đã hết hạn, `cus_006` không GPLX, `cus_007` GPLX A1, `cus_008` `BLOCKED`). |
| D11 | **Không** sinh hợp đồng/biên bản giao-nhận/phân công/sự cố cho lượt mới; **không** thêm Cost Record. | Tiền lệ 4.3 (tab Hợp đồng/Giao-nhận của các lượt lịch sử để trống — đã chấp nhận). Không thấy màn nào hiển thị *sai* vì thiếu chúng (chỉ trống). Chi phí giữ nguyên để so trước/sau rõ ràng. |
| D12 | Lượt mới **không trả xe muộn hơn hôm nay − 3 ngày** (mọi mốc quyết toán/hoàn cọc đều trong quá khứ). | "Không mốc nào ở tương lai". |
| D13 | Ngưỡng kích thước `localStorage` thiết kế theo **WebKit/Safari** (giả định thận trọng: quota 5 MB, tính 2 byte/ký tự ⇒ ~2,6 triệu ký tự), không theo Chrome/Firefox (~5,2 triệu ký tự). | Khách có thể xem demo trên Mac/iPad. |

### 0.3. Nợ cũ — không gộp

Nợ (b) (`createdAt` tương lai của lượt `rt_001…rt_029` + giao dịch BOOKING `GD-000003/4/8/9`) **không sửa được** mà không
đổi bản ghi cũ → **giữ treo**. Nợ tab Nhật ký (Phase 5 R3), SCC 96 file, phân trang danh sách — ngoài phạm vi.

---

## 1. Mục tiêu số liệu (giả định demo) + lý do

1. **Đội xe đang tăng trưởng nhờ ký gửi**: hợp đồng ký gửi bắt đầu rải rác từ −345 tới ~−68 ngày → doanh thu tăng dần
   theo tháng (biểu đồ xu hướng có hướng đi lên, khớp câu chuyện ~90/100 xe là ký gửi).
2. **Hệ số khai thác trong thời gian hợp đồng hiệu lực ~40–45%** (12 tháng), **~45–55% ở tháng gần nhất**. Báo cáo 12 tháng
   hiển thị Utilization đội xe **~28–33%** vì mẫu số "ngày khả dụng" tính cả ngày trước khi xe vào ký gửi
   (`calcAvailableDays` từ `vehicle.createdAt` — `TODO(OQ: RevenueCost-BRD.md §28 Q10)`, không sửa logic). Không đẩy
   lên 55–70% vì sẽ cần ~430+ lượt → vượt ngân sách dung lượng §6.
3. **Lợi nhuận vận hành (doanh thu − chi phí trực tiếp) dương ở ≥ 11/12 tháng**, biên ~30–40% trên 12 tháng; tháng
   trước dương rõ; "tháng này" ≥ 0 (tháng đang chạy nhưng chi trả chủ xe ghi nhận đủ tháng — vì vậy có bước lấp khe gần
   đây ở §3.2 bước 2).
4. **Tương phản giữa các xe**: 2 xe **lỗ** rõ (`veh_006` VIP khai thác thấp ~15–25% — khớp chuyện tai nạn/khóa lịch;
   `veh_015` khai thác ~25–30%), 2–3 xe quanh hoà vốn (`veh_007`/`veh_013`/`veh_016`), xe công ty `veh_017`/`veh_018` và
   VIP `veh_001`/`veh_011` lãi nhất.
5. **Mùa vụ nhẹ** theo tháng dương lịch (Tết, hè, lễ 30/4 cao; tháng 3, tháng 11 thấp).

---

## 2. Bảng số trước / sau dự kiến

Đo bằng harness Vite SSR tất định (`FIXED_NOW` = 22/10/2026 10:00 +07, RNG LCG đặt lại trước `forceReseed()`):
`/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/demo-data/metrics.mjs`. Cột "Sau" là **dự kiến**
từ mô phỏng (`sim.mjs` cùng thư mục, `SCALE` 0,7–0,8) — số thật chốt ở review; DoD (§8) dùng **khoảng**.

| Chỉ số | Trước (`33e8209`, `SEED_VERSION` 22) | Sau (dự kiến) |
| --- | ---: | ---: |
| Doanh thu 12 tháng (ghi nhận) | 63.750.000 | ~1,9–2,1 tỷ |
| Chi phí trực tiếp 12 tháng | 1.301.543.178 | **không đổi** |
| Chi phí gián tiếp 12 tháng | 62.500.000 | **không đổi** |
| Lợi nhuận vận hành 12 tháng | −1.237.793.178 | ~+0,6…+0,8 tỷ |
| Sau chi phí gián tiếp 12 tháng | −1.300.293.178 | ~+0,55…+0,75 tỷ |
| Tháng trước (09/2026): doanh thu / LN vận hành | 7.050.000 / −138.930.000 | ~200–290 tr / +50…+140 tr |
| Tháng này (10/2026, tới 22/10): doanh thu / LN vận hành | 12.150.000 / −142.430.000 | ~150–260 tr / ≥ 0 |
| Số tháng LN vận hành > 0 (12 tháng) | 0/12 | ≥ 11/12 |
| Utilization đội xe 12 tháng (Report 02) | 1,3% | ~28–33% |
| Utilization đội xe tháng trước | 2,4% | ~40–55% |
| Lượt thuê / Settlement | 39 / 15 | ~280–330 / ~255–305 |
| Payment Request / Giao dịch | 209 / 201 | ~830–900 / ~820–900 |
| Khách hàng | 9 | 57 |
| `rt_026` chênh lệch đối chiếu 12 tháng | 975.000 | **975.000 (không đổi)** |
| Dung lượng `localStorage` (ký tự, key+value) | 585.198 (~22% WebKit) | ~1,65–1,80 triệu (≤ 70% WebKit, ≤ 35% Chrome) |
| Thời gian seed (harness Node, lần đầu / lần 2) | 59 ms / 31 ms | ~300–800 ms / ≤ 500 ms |
| Thời gian tính thuần báo cáo 12 tháng (parse storage + suy Revenue Line/Cost/Cash + Report 02 + đối chiếu) | 19 ms | ~60–150 ms |

Ước lượng dung lượng từ bản ghi thật hiện có: Rental 814 ký tự · Settlement 1.285 · Payment Request 301 · Giao dịch 524
· giao dịch hoàn cọc 737 · khách 573 ⇒ lượt `MOTORBIKE` ≈ 3,75 nghìn ký tự, `CASH_20M` ≈ 5,8 nghìn; trộn 80/20 + phát
sinh ≈ **4,2 nghìn/lượt**.

---

## 3. Cách sinh (tất định)

### 3.1. Khách — `features/customers/seed.ts` (chỉ thêm)

Hàm `buildDemoCustomers(): Customer[]` đặt trên `seedCustomers`, gọi `customers.push(...buildDemoCustomers())` ngay trước
`writeJson(CUSTOMERS_STORAGE_KEY, customers)`. 48 khách `cus_010…cus_057`, sinh bằng phép số học trên chỉ số (không
random):

- Họ tên tiếng Việt ghép từ danh sách họ / tên đệm / tên theo giới tính (không trùng họ tên); `gender`, `dob` 1975–2002.
- `phone` 10 số đầu `09x/03x/07x/08x` **không trùng** khách cũ và nhau; `email` ASCII `<slug>@example.com` (tuỳ chọn).
- `idType: 'ID_CARD'`, `idNumber` 12 số (`079` + mã giới tính/thế kỷ + 2 số năm sinh + 6 số) không trùng; `idIssueDate`
  2021–2024, `idIssuePlace` "Cục CS QLHC về TTXH"; `idExpiryDate` ≥ 2036.
- `licenseClass: 'B2'`, `licenseNumber` 12 số không trùng, `licenseIssueDate` 2019–2024, `licenseExpiryDate` = cấp + 10
  năm (**≥ hôm nay + 1 năm** để không làm nhiễu cảnh báo giấy tờ sắp hết hạn).
- `status: 'ACTIVE'`, `documents: []`, `address` xoay vòng các quận TP.HCM, `createdAt` = `updatedAt` = ngày hôm nay −(380 +
  3·k) lúc 09:00 (mọi khách mới tạo **trước** toàn bộ lịch sử).

### 3.2. Lượt thuê — `features/rentals/seed.ts` (chỉ nối thêm)

Đặt hằng số + hàm sinh **dưới** `seedRentals` cũ hoặc trên nó (không sửa dòng cũ); trong `seedRentals`, thêm đúng một dòng
`inputs.push(...buildDemoHistoryInputs(inputs))` giữa `]` và `writeJson(...)`.

```text
Hằng số
  HISTORY_FROM = −365 · HISTORY_TO = −4           (ngày tương đối, mốc trả xe muộn nhất — chốt −4 khi review, §10 L1)
  CLASS_RATE   = VIP_LUXURY 1.800.000 · STANDARD 900.000 · TWO_SEATER 500.000
  DURATIONS    = (ngày:trọng số) 2:10 · 3:15 · 4:15 · 5:12 · 7:20 · 10:13 · 14:15      // ≤ 14 — TODO(OQ: BRD §51 Q53)
  SEASON[tháng 1..12] = 1.10 1.20 0.90 1.05 1.00 1.10 1.15 1.05 1.00 1.00 0.90 1.05
  SCALE = 0.6    (khoảng cho phép nới thành 0.55–0.85 khi review — §10 L2; dự kiến ban đầu 0.75)
  FILL_FROM = −35 (bước 2; dự kiến ban đầu −28 — §10 L2)

Bảng xe (id · hạng · cửa sổ khai thác [từ, đến] theo ngày tương đối · hệ số mục tiêu)
  — cửa sổ = thời gian hợp đồng ký gửi hiệu lực, chừa biên 2 ngày sau biên bản nhận xe / trước ngày kết thúc;
    mirror đúng consignment/seed.ts buildSpecs() — comment trỏ dòng nguồn.
  veh_001 VIP  [−298, −3] 0.60   veh_002 STD [−343, −3] 0.55   veh_003 2S  [−278, −3] 0.50
  veh_004 STD  [−268, −3] 0.55   veh_005 STD [−248, −3] 0.50   veh_006 VIP [−318, −3] 0.25
  veh_007 STD  [−365, −37] 0.45  (cg_015 TERMINATED tại −35)    veh_008 STD [−228, −3] 0.60
  veh_009 STD  [−218, −14] 0.50  (cg_010 SUSPENDED tại −12)     veh_010 2S  [−208, −3] 0.55
  veh_011 VIP  [−198, −3] 0.65   veh_012 STD [−238, −3] 0.60   veh_013 2S  [−365, −68] 0.40 (cg_017 hết hạn −66)
  veh_014 VIP  [−188, −3] 0.50   veh_015 STD [−158, −3] 0.28
  veh_016 2S   [ngày 15 của tháng (hiện tại − 2) + 2, −3] 0.30  (cg_014 bắt đầu dayOfMonth(−2, 15) — tính bằng cùng công thức)
  veh_017 STD  [−365, −3] 0.70 (xe công ty)               veh_018 VIP [−365, −3] 0.70 (xe công ty)

Ngày loại trừ theo xe (mirror seed nguồn, comment trỏ file/dòng):
  Vehicle Block quá khứ (calendar/seed.ts): veh_006 [−40, −34] · veh_002 [−20, −14] · veh_013 [−5, …)
  Ngày bảo dưỡng / thay phụ tùng (maintenance/seed.ts): veh_001 −60 · veh_017 −20 · veh_007 −15 · veh_002 −90 · veh_012 −45 ·
    veh_003 −40 · veh_009 −25 · veh_007 −15 · veh_014 −50 · veh_016 −10
  Ngày báo sự cố của mọi xe (incidents/seed.ts — kể cả sự cố gắn lượt cũ, để an toàn — §10 L3)
  Ngày gỡ Vehicle Block: veh_006 −34 · veh_002 −14 (§10 L3)
  Mọi lượt đã có trong `inputs` (rt_001…rt_039) của cùng xe — lấy trực tiếp từ tham số, KHÔNG mirror.

Thuật toán
  1. Với từng xe theo thứ tự bảng: cur = max(từ, HISTORY_FROM)
       lặp: d = rút DURATIONS; u = min(0.9, hệ số × SEASON[tháng(cur)] × SCALE)
            gap = max(0, round(d × (1 − u) / u) + (rnd∈{−1,0,1}))
            s = cur + gap; e = s + d − 1
            nếu e > min(đến, HISTORY_TO) → dừng
            nếu [s−1, e+1] chạm ngày loại trừ / lượt có sẵn của xe → cur = ngày sau vật cản + 1; lặp tiếp
            nhận ứng viên (xe, s, e); cur = e + 1
     (lượt nhận ngày s lúc 07:00–10:30, trả ngày e lúc 17:00–21:00 ⇒ rentalDurationDays = d; lượt kế tiếp sớm nhất
     sáng hôm sau ⇒ khoảng cách ≫ 90 phút — RM-BR-23)
  2. Lấp khe gần đây: với từng xe, trong [max(FILL_FROM, từ), min(đến, HISTORY_TO)] mọi khoảng trống ≥ d + 2 ngày
     thêm lượt 2–3 ngày (cách vật cản ≥ 1 ngày) — để "tháng này" không bị thiếu doanh thu do chi trả chủ xe ghi nhận đủ tháng.
  3. Sắp mọi ứng viên theo (giờ nhận, vehicleId) → gán id rt_040, rt_041, … liên tiếp theo thời gian.
  4. Gán khách theo thứ tự thời gian: rút có trọng số (khách thân thiết nặng hơn — cus_001/002/004/009 và ~10 khách mới
     đầu danh sách chiếm ~35–55% số lượt; đuôi dài 1–3 lượt/khách), bỏ qua khách đang có lượt chồng thời gian → lấy
     ứng viên kế tiếp.
  5. Cọc: rnd < 0.2 → CASH_20M, ngược lại MOTORBIKE + securityDepositAssetNote suy từ customerId (mẫu xe/biển số/năm/
     giá trị ≥ 15.000.000đ cố định cho mỗi khách, ≤ ~90 ký tự).
  6. Trả về SeedRentalInput[] { status: 'COMPLETED', rentalRate = CLASS_RATE[hạng], không discount/phụ phí/delivery }.
     buildRental (cũ, không sửa) tự tính snapshot + createdAt = pickup − 3 ngày.
```

**Kiểm `throw` trong `rentals/seed.ts`** (trước khi trả mảng): mỗi lượt mới — `rentalDurationDays === d`, `d ≤ 14`;
không chồng lượt nào khác **cùng xe** trong toàn bộ `inputs` + mới (công thức `hasConflict` có buffer 90 phút, không lọc
trạng thái); không chồng lượt khác **cùng khách**; trả xe ≤ hôm nay − 3 ngày; nằm trong cửa sổ xe và không phủ ngày loại
trừ; khách thuộc pool (§0.2 D10). Lỗi → `throw new Error('[seed rentals/demo-history] …')` (tiền lệ `consignment/seed.ts`).

### 3.3. Tài chính — `features/finance/revenue-cost/seed.ts` (hàm mới) + `finance/seed.ts` (đăng ký cuối)

Hàm mới `export function seedDemoRentalHistory(): void` (tên có thể khác nhưng rõ nghĩa), đăng ký
`registerSeedStep(seedDemoRentalHistory)` **sau** `registerSeedStep(seedOwnerPayouts)`. Lượt cần dựng = Rental `COMPLETED`
có số thứ tự ≥ 40 (`rt_040`…) — hằng số `DEMO_HISTORY_FIRST_SEQ = 40` kèm comment trỏ `rentals/seed.ts`. Helper riêng
trong hàm (cùng mẫu `seedRevenueHistory` — không tái dùng closure của nó, không sửa nó). Mỗi lượt:

```text
schedule = buildScheduleRequests(rental, ACCOUNTANT, rental.createdAt)       // BOOKING 30% · HANDOVER 70% · (+ DEPOSIT 20tr nếu CASH_20M)
GD thu BOOKING  : createdAt + 3h  · BANK_TRANSFER · CONFIRMED
GD thu HANDOVER : pickup − 2h     (+ GD DEPOSIT cùng mốc nếu CASH_20M)
openedAt        = expectedReturn + 1h
lines           = buildSourceLines({ rental, returnRecord: undefined, incidents: [] }) (+ manualLine MANUAL_OTHER nếu D8)
reconcile       = calcPaidToDate + calcDepositHeld + calcSettlementTotals(lines, []) + calcDepositReconciliation   (reconciledAt openedAt + 2h)
customerAck     = openedAt + 3h
spr (openedAt + 4h): COLLECT nếu balanceDue > 0 (chỉ lượt có D8) · DEPOSIT_REFUND nếu depositRefundable > 0 (CASH_20M)
  → buildSettlementPaymentRequest(...) ; GD thu COLLECT openedAt + 5h
completedAt     = openedAt + 6h ; completedWithDebt = calcSettlementCollectOutstanding(…, completedAt) > 0  (kỳ vọng false)
GD hoàn cọc OUT : performedAt = completedAt + 2h ; approval { APPROVED, MANAGER, decidedAt = performedAt + 0,5h }
                  (refundNeedsApproval) ; confirmedAt = performedAt + 1h ; refundRecipient "Hoàn cọc — chuyển khoản … (lượt thuê rt_xxx)"
Mã: code = nextSequenceCode('GD', mọi giao dịch đã có + mới) · reference = nextSequenceCode('CK', …) — nối tiếp, không trùng
Đồng bộ cuối: status của CHỈ các Payment Request MỚI = deriveRequestStatus(r, toàn bộ giao dịch);
              paymentStatus của CHỈ các Settlement MỚI = deriveRentalPaymentSummary(...).paymentStatus. Không đụng bản ghi cũ.
```

Không gõ tay số tổng/trạng thái. Settlement id `stl_<số thứ tự rental>` (vd `stl_040`). `customerId`/`vehicleId` lấy từ
Rental. Không gọi `appendAudit` (seed). Không `OFFSET` (không có khoản thiếu đối trừ cọc).

**Kiểm `throw` trong bước tài chính** (đầu hàm, đọc storage đã seed qua barrel/khoá **đã có cạnh import sẵn** trong
`finance`): mỗi lượt mới — nếu xe có hợp đồng ký gửi (`CONSIGNMENT_CONTRACTS_STORAGE_KEY`) thì phải nằm trọn trong một hợp
đồng `ACTIVE/SUSPENDED/TERMINATED/CLOSED` (sau ngày nhận xe; trước `endedDate ?? effectiveTo`; trước ngày `SUSPENDED` nếu có);
không phủ ngày bảo dưỡng/phụ tùng (`MAINTENANCE_RECORDS_STORAGE_KEY`/`SPARE_PART_RECORDS_STORAGE_KEY`) hay ngày báo sự
cố không thuộc lượt đó (`INCIDENTS_STORAGE_KEY`). Bắt lệch giữa bảng mirror ở §3.2 với seed nguồn khi seed nguồn đổi sau này.
Vehicle Block/khách: kiểm ở harness (§5.2) — barrel `calendar`/`customers` không export khoá storage và **không được sửa barrel**.

---

## 4. File sửa / cấm

| File | Thay đổi |
| --- | --- |
| `src/features/customers/seed.ts` | Thêm hàm sinh 48 khách + 1 dòng `customers.push(...)` (chỉ thêm). |
| `src/features/rentals/seed.ts` | Thêm hằng số + hàm sinh + kiểm `throw` + 1 dòng `inputs.push(...)`; có thể thêm tên import từ `./model` (vd `TURNAROUND_BUFFER_MINUTES`). **`git diff` không có dòng `-`.** |
| `src/features/finance/revenue-cost/seed.ts` | Thêm hàm `seedDemoRentalHistory` (+ import cần thiết). Không sửa 2 hàm cũ. |
| `src/features/finance/seed.ts` | Import + `registerSeedStep(seedDemoRentalHistory)` cuối file (comment trỏ plan này). |
| `src/shared/fixtures/seedAll.ts` | `SEED_VERSION` 22 → 23. |

**Cấm sửa:** mọi file khác — model/api/hooks/components/screens/`index.ts` của mọi feature, `registerSeeds.ts`, `enums.ts`,
`permissions.ts`, `vi.ts`, `docs/**`, `CHANGELOG.md`.

---

## 5. Kiểm chứng

### 5.1. Cổng bắt buộc

`npx tsc -b` · `npx oxlint` · `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng; `git diff src/features/rentals/seed.ts`
không có dòng bắt đầu bằng `-` (trừ header `---`).

### 5.2. Harness (scratchpad — không thuộc repo)

Thư mục `/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/demo-data/`:

- `verify.mjs` — `TZ=Asia/Ho_Chi_Minh node verify.mjs /home/user/tbc-webapp-prototype-demo` → in `errors: 0`. Kiểm: (1) **mọi
  bản ghi cũ bằng hệt** snapshot `before.json` (chụp ở `33e8209`, tiền tố mảng từng key); (2) khách mới hợp lệ/không trùng
  SĐT-CCCD-GPLX; (3) lượt mới: `COMPLETED`, khách `ACTIVE` có GPLX B2 còn hạn tại ngày trả, giá đúng hạng, 1–14 ngày,
  không discount/phụ phí, thứ tự mốc, trả ≤ hôm nay − 3, giờ nhận 7–20h / trả ≤ 21:00, không trùng lịch xe (buffer 90'),
  không chồng lượt cùng khách, không đè Vehicle Block, không phủ ngày bảo dưỡng/phụ tùng/sự cố, xe ký gửi trong hợp đồng
  hiệu lực & không trong `SUSPENDED`; (4) tài chính: đúng 1 Settlement `COMPLETED`/lượt, Σ Revenue Line = Final Amount,
  không `completedWithDebt`, `paymentStatus` `PAID`/`REFUNDED`, mọi yêu cầu mới `FULFILLED`, giao dịch mới chỉ
  `BANK_TRANSFER`/`ONLINE_GATEWAY` + `CONFIRMED`, hoàn > ngưỡng có duyệt đúng thứ tự, mã `GD-` mới liên tiếp sau mã cũ, `GD-`/
  `CK-` không trùng, không mốc `*At`/`*DateTime` nào ở tương lai. Trên `33e8209` đã chạy: `errors: 0`, 0 bản ghi mới.
- `metrics.mjs` — `TZ=Asia/Ho_Chi_Minh node metrics.mjs /home/user/tbc-webapp-prototype-demo <out.json>` → bảng §2 (12 tháng,
  từng tháng, từng xe, Utilization, dung lượng, thời gian seed/tính). Số trước: `before-metrics.json`.
- `sim.mjs` — mô phỏng chọn `SCALE` (chỉ tham khảo).

---

## 6. Quy mô & hiệu năng

- Ngân sách dung lượng: tổng `localStorage` **≤ 1,85 triệu ký tự** (≈ 71% quota WebKit giả định ~2,6 triệu ký tự; ≈ 35% Chrome
  ~5,2 triệu), chừa ≥ 0,75 triệu ký tự cho thao tác demo (mỗi Audit Record ~0,5 nghìn ký tự). Chọn **~250–290 lượt mới** cho
  vừa ngân sách — đây là lý do không đẩy Utilization lên 55–70% (§1.2).
- Seed: `nextSequenceCode` quét toàn bộ mã mỗi lần gọi (O(n²) ~ 1 triệu phép so khớp) + `allRequests()/allTxns()` sao chép
  mảng — ước 0,3–0,8 s lần đầu trên Node; ngưỡng **≤ 1,5 s** (harness, lần đầu). Nếu vượt: được dùng một bộ đếm cục bộ khởi
  tạo **một lần** từ `nextSequenceCode` rồi tăng dần (vẫn cùng định dạng), không đổi hàm app.
- Tính báo cáo: các hàm `RV` duyệt tuyến tính; ngưỡng **≤ 300 ms** thời gian tính thuần (không gồm độ trễ giả lập
  `fakeRequest` 250–450 ms/lời gọi).
- Rủi ro UI (ngoài phạm vi, ghi cho Phase 6): các danh sách **không phân trang** — Lượt thuê ~330 dòng, Sổ giao dịch ~850
  dòng, Payment Request ~870 dòng sẽ render chậm hơn (ước vài trăm ms trên máy yếu). Không sửa ở task này; đề xuất Phase 6
  thêm phân trang / lọc kỳ mặc định.

---

## 7. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Bảng cửa sổ/ngày loại trừ mirror lệch seed nguồn khi seed nguồn đổi sau này | Kiểm `throw` ở bước tài chính (hợp đồng/bảo dưỡng/sự cố) + `verify.mjs` (block/khách). |
| Tiêu thụ `Math.random` làm đổi id cũ | D4 + `verify.mjs` mục (1) bắt mọi thay đổi bản ghi cũ. |
| Số liệu ngẫu nhiên lệch mục tiêu | Thuật toán khoảng cách theo kỳ vọng (không phân phối mũ) + `SCALE` chỉnh được + DoD theo khoảng. |
| "Tháng này" âm do chi trả chủ xe ghi nhận đủ tháng | Bước 2 lấp khe gần đây; DoD cho phép ≥ −30 triệu nếu không đạt ≥ 0 sau khi chỉnh `SCALE`. |
| Dung lượng vượt ngân sách | Giảm `SCALE` trước; tỷ lệ `CASH_20M` không xuống dưới 15%. |
| Ngày tháng tương đối: chạy demo ở ngày khác → tháng/mùa vụ dịch theo | Chấp nhận (mọi seed đều tương đối hôm nay); khoảng DoD đủ rộng. |

---

## 8. Definition of Done

1. Cổng §5.1 sạch; `SEED_VERSION` = 23; chỉ 5 file ở §4 thay đổi (`git status`).
2. `verify.mjs` → `errors: 0`.
3. `metrics.mjs` (harness `FIXED_NOW` 22/10/2026) rơi vào các khoảng:
   - Lượt mới **240–290**; khách 57; tỷ lệ `CASH_20M` 15–25%; ~6–10% lượt `MOTORBIKE` có dòng `MANUAL_OTHER`.
   - Doanh thu 12 tháng **1,7–2,3 tỷ**; LN vận hành 12 tháng **+0,45…+0,9 tỷ**; **≥ 11/12** tháng LN vận hành > 0; tháng
     trước > +30 triệu; tháng này ≥ 0 (tối thiểu ≥ −30 triệu, ghi rõ nếu dùng ngưỡng này).
   - Utilization đội xe 12 tháng **25–35%**; tháng trước **38–60%**.
   - ≥ 2 xe LN 12 tháng < 0 (gồm `veh_006`); `veh_017`, `veh_018` nằm trong 5 xe LN cao nhất.
   - Chi phí trực tiếp/gián tiếp 12 tháng **bằng đúng số trước**; `rt_026` chênh lệch 12 tháng = **975.000**.
   - Dung lượng ≤ **1,85 triệu** ký tự; seed lần đầu ≤ **1,5 s**; tính thuần ≤ **300 ms**.
4. Báo cáo của `dev`: bảng số thật theo §2 (dán output `metrics.mjs` rút gọn), giá trị `SCALE` cuối, danh sách file + xác nhận
   diff `rentals/seed.ts` không có dòng `-`.

---

## 9. Danh sách file `dev` đọc trước khi code (đúng danh sách, không scan rộng)

1. `docs/DEMO-DATA-PLAN.md` (file này — toàn bộ).
2. `CONVENTIONS.md` §2, §4, §10, §11.
3. `src/features/rentals/seed.ts` (toàn bộ — 630 dòng) + `src/features/rentals/model.ts` dòng 75–230 (hằng số giá/buffer,
   `rentalDurationDays`, `hasConflict`).
4. `src/features/customers/seed.ts` (toàn bộ) + `src/features/customers/model.ts` dòng 10–70 (type `CustomerDocument`/`Customer`).
5. `src/features/finance/revenue-cost/seed.ts` dòng 1–262 (`seedRevenueHistory` — mẫu cần bám) + `src/features/finance/seed.ts`.
6. `src/features/finance/core/seedHelpers.ts` (`dt`, `hoursAfter`, hằng số người thao tác).
7. `src/features/finance/payment/model.ts`: `calcPaidToDate`/`calcDepositHeld` (dòng 37–60), `buildScheduleRequests` (113–150),
   `deriveRequestStatus` (172–), `deriveRentalPaymentSummary` (282–), `refundNeedsApproval` + `SETTLEMENT_REQUEST_MAPPING`
   (355–404), `nextSequenceCode` (712–720).
8. `src/features/finance/payment/seed.ts` dòng 720–785 (mẫu giao dịch hoàn cọc `DEPOSIT_REFUND` có duyệt — **chỉ** đường
   `CONFIRMED`, không bắt chước GD `FAILED`).
9. `src/features/finance/settlement/model.ts`: `buildSourceLines` (61–), `calcDepositReconciliation` (152–161),
   `calcSettlementCollectOutstanding` (259–).
10. Seed nguồn để mirror cửa sổ/ngày loại trừ: `src/features/consignment/seed.ts` dòng 56–80 + 280–345 (`buildSpecs`) ·
    `src/features/calendar/seed.ts` · `src/features/maintenance/seed.ts` (các `isoDateOffset`) · `src/features/incidents/seed.ts`
    (các `reportedAt`).
11. `src/features/consignment/index.ts`, `src/features/maintenance/index.ts`, `src/features/incidents/index.ts` — chỉ dòng
    export khoá storage (cho kiểm `throw` ở bước tài chính).
12. `src/shared/fixtures/seedAll.ts`.

---

## 10. Kết quả thực tế & phán quyết lệch plan (review 23/10/2026)

Số đo bằng `metrics.mjs` (harness `FIXED_NOW` 22/10/2026, `tech-lead` chạy lại khớp báo cáo `dev`); `verify.mjs` → `errors: 0`
(284 lượt mới · 48 khách · 284 Settlement · 703 Payment Request · 703 giao dịch · `CASH_20M` 20%).

| Chỉ số | Trước | Sau (thực tế) | DoD §8 |
| --- | ---: | ---: | --- |
| Doanh thu 12 tháng | 63.750.000 | 1.783.300.000 | đạt (1,7–2,3 tỷ) |
| Chi phí trực tiếp / gián tiếp 12 tháng | 1.301.543.178 / 62.500.000 | không đổi | đạt |
| LN vận hành 12 tháng | −1.237.793.178 | +481.756.822 | đạt (+0,45…+0,9 tỷ) |
| Sau chi phí gián tiếp 12 tháng | −1.300.293.178 | +419.256.822 | — |
| Tháng 09/2026: doanh thu / LN vận hành | 7.050.000 / −138.930.000 | 268.900.000 / +122.920.000 | đạt |
| Tháng 10/2026: doanh thu / LN vận hành | 12.150.000 / −142.430.000 | 231.150.000 / +76.570.000 | đạt (≥ 0) |
| Số tháng LN vận hành > 0 | 0/12 | 11/12 (04/2026: −18.050.000) | đạt |
| Utilization 12 tháng / tháng trước | 1,3% / 2,4% | 25,3% / 47,0% | đạt (sát cận dưới 25%) |
| Xe lỗ 12 tháng | — | 10 xe (gồm `veh_006` −64,3 tr; 5 xe chỉ lỗ < 2 tr) | đạt (≥ 2) |
| `veh_017` / `veh_018` | — | top 2 LN (+141,7 tr / +302,1 tr) | đạt |
| `rt_026` chênh lệch 12 tháng | 975.000 | 975.000 | đạt |
| Lượt thuê / Settlement / Payment Request / Giao dịch / Khách | 39 / 15 / 209 / 201 / 9 | 323 / 299 / 912 / 904 / 57 | đạt |
| Dung lượng `localStorage` | 585.198 | 1.822.111 ký tự | đạt (≤ 1,85 tr — dư ~1,5%) |
| Seed lần đầu / tính thuần | 59 ms / 19 ms | 734–870 ms / 48–70 ms | đạt |

**Phán quyết 3 chỗ lệch (chấp nhận cả 3):**

- **L1 — `HISTORY_TO = −4`** thay −3: đúng — trả xe 17:00–21:00 ngày −3 muộn hơn "now − 3 ngày" khi seed chạy trước 17h, vi
  phạm D12. −4 là cách sửa tối thiểu.
- **L2 — `SCALE = 0,6` (ngoài 0,65–0,85) + `FILL_FROM = −35`**: chấp nhận, nới khoảng thành 0,55–0,85. Ràng buộc chặt là
  ngân sách lượt (≤ 290) + dung lượng (≤ 1,85 tr) chứ không phải hệ số; mọi chỉ số DoD vẫn đạt. Hệ quả: Utilization 12 tháng
  25,3% sát cận dưới, nhiều xe quanh hoà vốn hơn dự kiến (10 xe âm thay vì 2 lỗ + 2–3 hoà vốn) — vẫn đúng câu chuyện "vài
  xe lỗ rõ, vài xe lãi rõ".
- **L3 — thêm ngày loại trừ** (ngày gỡ Vehicle Block `veh_006`/`veh_002` + ngày báo sự cố của mọi xe): thận trọng hơn plan, không
  đổi ngữ nghĩa — chấp nhận.

**Nợ ghi nhận (không chặn):**

- **N1 — Dung lượng sát trần**: còn ~28 nghìn ký tự tới ngân sách 1,85 tr (vẫn ~70% quota WebKit giả định, ~0,78 tr ký tự cho
  thao tác demo). Mọi seed mới sau này phải đo lại `storageChars`; nếu cần thêm dữ liệu → giảm `DEMO_SCALE` trước.
- **N2 — Giao dịch hoàn cọc `CASH_20M` của lượt lịch sử không có biên lai `BL-`** — nhất quán với giao dịch thu của lượt lịch sử cũ
  (`seedRevenueHistory`) cũng không có. Chỉ ảnh hưởng nếu demo bấm xem biên lai của các giao dịch này.
- **N3 — Số liệu nhạy với tham số/ngày chạy** (seed tương đối hôm nay): chạy demo ở ngày khác số tháng/xe lỗ dịch nhẹ; khoảng DoD
  đủ rộng. Nếu cần chỉnh lại, đo bằng `metrics.mjs` trước khi đổi `DEMO_SCALE`/`DEMO_FILL_FROM`.
- Rủi ro UI danh sách không phân trang (§6) — chuyển Phase 6.

---

## 11. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 23/10/2026 | Review `tech-lead` đạt vòng 1 (không Blocker) → `DONE`; chấp nhận 3 chỗ lệch L1–L3, ghi số thực tế + nợ N1–N3 (§10). |
| 23/10/2026 | Tạo kế hoạch, `APPROVED` (`tech-lead` tự duyệt theo giao việc của người dùng), giao `dev`. Đo số trước + dựng `verify.mjs`/`metrics.mjs`/`sim.mjs` ở scratchpad. |
