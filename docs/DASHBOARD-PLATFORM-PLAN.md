# Kế hoạch triển khai — Dashboard & Nền tảng (Thông báo · Nhật ký thao tác · Quản trị hệ thống) (Phase 6)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (23/10/2026 — người dùng duyệt cả 7 điểm §16 theo đề xuất,
ghi ở §16; câu 4 chuyển lên **Round 1**) · **Round 1 — `DONE`** (23/10/2026, brief §18, review `tech-lead` đạt vòng 1, không Blocker — kết quả + phán quyết 10 lệch §18.9) · **Round 2 — `DONE`** (23/10/2026, brief §19, review `tech-lead` đạt vòng 1, không Blocker — kết quả + phán quyết §19.9; quyết định bundle D11 áp cho R3/R4). Các Open Question nghiệp vụ
xử lý bằng giả định tạm + `TODO(OQ)` ở §11 (không tự chốt).

Kế hoạch chi tiết **Phase 6** (`docs/IMPLEMENTATION-PLAN.md` mục "Phase 6 — Hoàn thiện nền tảng & polish"). Chia **4 round**:

- **Round 1 — Tín hiệu cảnh báo + Dashboard.** Các module nguồn (`VM`/`MT`/`RM`/`CT`/`PM`/`DI`/`EA`/`VC`) cung cấp hàm thuần
  phát hiện "tín hiệu cảnh báo" theo ngưỡng của chính module đó; `features/notifications` gom thành danh sách cảnh báo
  **tính động, không lưu**; `features/dashboard` hiển thị KPI vận hành + widget KPI tài chính (do `finance` sở hữu) + bảng
  cảnh báo. Thay `ComingSoon` ở `/dashboard`. Kèm đồng bộ `Vehicle Status` seed của 3 xe đang có lượt
  `HANDED_OVER`/`IN_RENTAL` (quyết định §16 câu 4).
- **Round 2 — Trung tâm thông báo (`NT`, kênh `IN_APP_WEBAPP`).** Chốt tín hiệu thành `Notification Event` có lưu (khử
  trùng EX-02, tự `CANCELLED` khi hết ý nghĩa, snapshot nội dung theo Template v1), Inbox "Thông báo của tôi", đánh dấu đã
  đọc, chuông + số chưa đọc ở Topbar. Thay `ComingSoon` ở `/platform/notifications`.
- **Round 3 — Nhật ký thao tác (`AL`).** Mở rộng Audit Record (module / severity / actor type / correlation, không phá bản
  ghi cũ), trần dung lượng theo ký tự, màn tra cứu toàn hệ thống (lọc, phân trang, chi tiết Old/New, che dữ liệu nhạy cảm
  + meta-audit), xuất CSV, seed nhật ký mẫu, audit đăng xuất; sửa nợ tab Nhật ký ký gửi. Thay `ComingSoon` ở
  `/platform/audit`.
- **Round 4 — Quản trị hệ thống (`SA`) + polish.** Màn "Vai trò & quyền" (đọc `listPermissionMatrix()`, làm nổi ô `TBD`),
  "Cấu hình hệ thống" (thông tin công ty, múi giờ, đồng hồ dung lượng dữ liệu demo, nút Reset), phân trang các danh sách
  dài, gom chuỗi UI còn hardcode vào `vi.ts`, rà responsive theo checklist, viết lại `README.md`, màn **Chi tiết nhân viên**
  (`/employees/:id` — quyết định §16 câu 6). Thay 3 `ComingSoon` còn lại.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/WebappQuanTri.md` §5.1–§5.4 (trang chính, Dashboard, điều hướng), §13.1–§13.3
(nền tảng `SA`/`AL`/`NT`), §15 (NFR), §17.3 (OQ còn treo) · `modules/Notification-BRD.md` §4, §6–§16, §20 (`NT-BR-01…15`,
`AC-NT-001…009`) · `modules/AuditLog-BRD.md` §6–§13, §15, §16, §22 (`AL-BR-01…15`, `AC-AL-001…013`) ·
`modules/SystemAdministration-BRD.md` §6, §9, §10, §12, §13, §19 (`SA-BR-01…15`) · `modules/RevenueCost-BRD.md` §17
(Dashboard — KPI tài chính thuộc `RV`) · `BusinessRequirementDocument.md` §45 (Notification), §46 (Dashboard) ·
`modules/RentalCalendar-BRD.md` §21 (danh sách sắp đến hạn / quá hạn trả) + Q16 · `modules/Payment-BRD.md` §27 Q9 (hạn thanh
toán — OQ) · `modules/VehicleConsignment-BRD.md` `VC-BR-19/20` + CR-2026-051 (ngưỡng nhắc −30/−3 ngày, Phase 1 gửi Admin).
CR liên quan: `CR-2026-025` (NT), `CR-2026-032` (Dashboard là trang mặc định), `CR-2026-035` (`SALES` ≈ `MANAGER`),
`CR-2026-037` (Manager xem/xuất Audit toàn hệ thống), `CR-2026-041/042/046` (cảnh báo giấy tờ xe theo `Warning Lead Days`),
`CR-2026-048` (lợi nhuận vận hành = doanh thu − chi phí trực tiếp).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/FINANCE-REFACTOR-PLAN.md` (tầng `finance`),
`docs/REVENUE-COST-PLAN.md` (mẫu format + hàm `RV`), `docs/DEMO-DATA-PLAN.md` §6/§10 (ngân sách dung lượng, nợ N1),
`docs/CONSIGNMENT-PLAN.md` §18/§20 (nợ tab Nhật ký, SCC). Harness đo ở scratchpad (không thuộc repo):
`/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/phase6/` (`sizes.mjs`, `signals.mjs`, `reach.mjs`).

---

## 0. Bối cảnh & quyết định thiết kế

### 0.1. Hiện trạng (đo trên HEAD `924e885`, harness `FIXED_NOW` 22/10/2026 10:00 +07)

| Hạng mục | Hiện trạng |
| --- | --- |
| Route Phase 6 | `/dashboard`, `/platform/system-config`, `/platform/permissions`, `/platform/audit`, `/platform/notifications` đều là `ComingSoon` (`src/app/routes.tsx`). Thư mục `features/dashboard`, `features/audit`, `features/notifications` **chưa tồn tại**. |
| Audit | `shared/lib/audit.ts`: `AuditRecord` 10 trường, trần **500 bản ghi** (đếm số, không đếm ký tự), **không có seed** (key `audit` rỗng sau seed). 227 lời gọi `appendAudit` ở ~25 file, 25 giá trị `entity` khác nhau. 6 tab "Nhật ký thao tác" theo đối tượng đã có (Vehicle/Rental/Contract/Incident/Settlement/Consignment). Đăng xuất **không** ghi audit (lệch `SA-BR-08`). |
| Enum NT | `NOTIFICATION_EVENT_TYPES` (scaffold Phase 0) **lệch** Event Catalog `Notification-BRD.md` §7: có 6 mã không có trong tài liệu (`CONTRACT_EXPIRY`, `PARTNER_PAYMENT_DUE`, `RENTAL_PICKUP_SOON`, `RENTAL_RETURN_SOON`, `RENTAL_RETURN_OVERDUE`, `PAYMENT_OVERDUE`), thiếu 11 mã của tài liệu. **Không chỗ nào dùng** (grep: 0 tham chiếu ngoài `enums.ts`). |
| Quyền | `AUDIT.VIEW`: `SALES` = `false`, `ACCOUNTANT` = `false`, nguồn ghi "BA đề xuất — chưa có bảng riêng" — **sai so với tài liệu**: `AuditLog-BRD.md` §16 có bảng (Accountant ✓ giới hạn tài chính; CR-2026-035 `SALES` ≈ `MANAGER`; CR-2026-037). Chưa có `AUDIT.EXPORT`. `NOTIFICATION` chỉ có `VIEW` (mọi vai trò). `SYSTEM_ADMIN` có `VIEW`/`CONFIG` (chỉ Admin). |
| Tín hiệu cảnh báo có thể tính từ seed | Giấy tờ xe: 1 đăng kiểm sắp hết hạn + 1 bảo hiểm **đã hết hạn** · bảo dưỡng: 2 quá hạn + 1 sắp đến hạn · 7 lượt sắp giao (≤ 48h) / 5 (≤ 24h), 1 sắp nhận · 0 quá hạn trả · 1 hợp đồng `GENERATED` · 7 sự cố chưa ở trạng thái kết thúc (định nghĩa §4.1) · 4 phân công `ASSIGNED` · 1 hợp đồng ký gửi sắp hết hạn · 3 khoản chi trả chủ xe quá hạn → **27 tín hiệu đã đo** (`signals.mjs`) + `PAYMENT_INCOMPLETE` chưa đo (ước 5–15) ⇒ tổng ước **~35–45**. |
| Lệch dữ liệu seed | Xe của 4 lượt `HANDED_OVER`/`IN_RENTAL` (`rt_016…rt_019`): chỉ `veh_018` là `RENTED`, 3 xe còn lại (`veh_010`, `veh_001`, `veh_017`) `AVAILABLE` — trái `VH-BR-10` (giao xe xong → Vehicle `RENTED`) → KPI "Đang thuê" = 1 trong khi "Lượt thuê đang diễn ra" = 4. **Sửa ở R1** (§16 câu 4, §18.2 mục 9). |
| Dung lượng | **1.822.111 / 1.850.000** ký tự (nợ N1 của 5.1 — còn ~27,9 nghìn). Lớn nhất: `transactions` 499k, `settlements` 410k, `paymentRequests` 298k, `rentals` 257k. |
| Vòng import | SCC **98 file** (`scratchpad/consignment-r3/scc-target.txt`, đo lại bằng `sccfiles.mjs` — khớp 100%). Barrel `vehicles`/`rentals`/`contracts`/`incidents`/`finance`/`calendar`/`customers`/`handover-return` **nằm trong SCC**. |
| Bundle | Chunk chính `index-*.js` **1.788,69 kB** (gzip 443 kB); `recharts` tách ở `FinanceTrendChart-*.js` 397 kB. |
| Chuỗi UI hardcode | `shared/layout/nav.tsx` 19 nhãn, `app/routes.tsx` 5 tiêu đề `ComingSoon`, ~11 text JSX + 2 toast rải rác ở component. `README.md` vẫn là mặc định của Vite. |

### 0.2. Quyết định thiết kế (kỹ thuật — không phải quyết định nghiệp vụ)

| # | Quyết định | Lý do |
| --- | --- | --- |
| D1 | **Mô hình "quét" (pull), không "đẩy" (push):** module nguồn **không** import `features/notifications`. Mỗi module nguồn export một **hàm thuần** `collect…Signals(data…, now)` (ngưỡng do chính module đó sở hữu — `NT-BR-02`, CR-2026-046); `notifications/api.ts` đọc dữ liệu nguồn qua storage key export ở barrel rồi gọi các hàm đó. | `Notification-BRD.md` §11 cho phép "các module nguồn tự quét rồi gọi Notification, tuỳ thiết kế kỹ thuật". Đẩy từ `api.ts` nguồn sang `notifications` sẽ tạo cạnh mới từ 8 feature (đa số trong SCC) → nguy cơ nở SCC. Kéo từ một feature **lá** không thêm cạnh nào vào SCC. |
| D2 | **Bảng cảnh báo Dashboard = danh sách tín hiệu của `notifications`** (`useOperationalSignals()`), Dashboard **không** tự lấy dữ liệu cảnh báo. Chiều import một chiều `dashboard → notifications`, không có chiều ngược. | `NT-BR-01` (mọi cảnh báo đi qua Notification chuẩn hoá); backlog: "Trung tâm thông báo sinh từ các cảnh báo ở Dashboard" — một định nghĩa duy nhất cho cả hai màn. |
| D3 | **KPI tài chính trên Dashboard là component do `finance` export** (`DashboardFinanceWidget`, thư mục `revenue-cost/`), dùng lại `summarizePeriod`/`buildVehiclePerformance`/`deriveCustomerBalances`/`FinanceKpiCards` sẵn có. Dashboard chỉ mount + gate quyền. | `RevenueCost-BRD.md` §17: "Module này sở hữu phần KPI tài chính; các KPI khác là widget tham chiếu". Tránh export hàng loạt hook/hàm `finance` qua barrel. |
| D4 | **Round 1 không lưu gì** (tín hiệu tính động). Round 2 mới chốt thành `Notification Event` có lưu, **lúc chạy** (không seed) — chi phí dung lượng nằm trong ngân sách thao tác demo, không trong ngân sách seed. | Nợ N1: ngân sách seed chỉ còn ~27,9 nghìn ký tự. |
| D5 | **Chuông thông báo gắn qua "slot"**: `AppShell` nhận prop `topbarSlot?: ReactNode`, truyền xuống `Topbar`; `app/routes.tsx` truyền `<NotificationBell />`. `shared/layout` **không** import `features/notifications`. | `docs/ARCHITECTURE.md` §1: `shared` không phụ thuộc ngược `features` (ngoại lệ duy nhất hiện có là `features/auth`). |
| D6 | **Màn `SA` đặt trong `features/auth`** (thêm `api.ts`/`hooks.ts`/`seed.ts`/2 screen) — không tạo thư mục feature mới. | Bảng ánh xạ `CLAUDE.md` §2: "Nền tảng `SA` → `auth`". `auth` không chạm SCC (`reach.mjs`: 0). |
| D7 | **Audit Record mở rộng bằng trường tuỳ chọn** (`module?`, `severity?`, `actorType?`, `correlationId?`, `reason?`); bản ghi cũ không có `module` được **suy ra** từ `entity` qua bảng ánh xạ ở `features/audit/model.ts`. **Không** sửa 227 lời gọi `appendAudit` hiện có. | Giữ diff nhỏ, không đụng các feature trong SCC; Correlation ID chỉ có ở bản ghi mới/seed (ghi rõ ở §11). |
| D8 | **Trần audit theo ký tự** (`AUDIT_MAX_CHARS`) thay trần 500 bản ghi; `writeJson` trả `boolean` để audit/thông báo tự cắt bớt bản ghi cũ và ghi lại khi `localStorage` đầy (thay vì im lặng mất dữ liệu). | §9 — biến "ngân sách thao tác demo 0,75 triệu ký tự" (5.1) từ giả định thành giới hạn được thực thi. |
| D9 | **Biểu đồ "doanh thu theo ngày (30 ngày)" trên Dashboard vẽ bằng thanh CSS** (`bg-primary`, chiều cao theo tỉ lệ), **không** dùng `recharts`. | Dashboard là trang mặc định → nằm ở chunk chính; `recharts` (397 kB) phải tiếp tục ở chunk lười. |
| D11 | **Tải lười mọi màn `/platform/*` + màn mới của R3/R4** (chốt 23/10/2026 khi review R2 — chunk chính còn dư 1,75 kB). Mỗi feature có `screens/lazyScreens.ts` theo mẫu `finance/revenue-cost/screens/lazyScreens.ts`; barrel export bản lazy; `app/routes.tsx` bọc `<Suspense>`. R3: chuyển `NotificationCenterScreen` sang lazy (việc đầu tiên) + `AuditLogScreen` lazy. R4: `SystemConfigScreen`, `PermissionMatrixScreen`, màn Chi tiết nhân viên lazy. Chuông `NotificationBell` giữ tĩnh. Trần chunk chính giữ **≤ 1.830 kB** cho R3/R4. | Trang mặc định (Dashboard) và Topbar phải nằm trong chunk chính; các màn nền tảng ít dùng không cần. Rẻ, có tiền lệ. |
| D10 | `NOTIFICATION_EVENT_TYPES` **thay toàn bộ** bằng đúng 18 mã của `Notification-BRD.md` §7 (giữ thứ tự tài liệu). | Ngoại lệ có tiền lệ (`INCIDENT_STATUSES` — `DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §0.1): sửa scaffold Phase 0 cho khớp tài liệu, mảng chưa được dùng ở đâu nên không phá dữ liệu. Ghi rõ comment. |

### 0.3. Không thuộc phạm vi Phase 6 (lý do)

| Hạng mục | Lý do |
| --- | --- |
| "Trang chính — lịch lưới xe × ngày" | `WebappQuanTri.md` §5.1/§5.2: trang mặc định là **Dashboard** (CR-2026-032); lưới xe × ngày là **chế độ Month của Rental Calendar** — đã làm ở Phase 2 (`CalendarMonthGrid.tsx`). Không làm lại. |
| Gửi kênh ngoài (`SMS`/`EMAIL`/`ZALO_ZNS`/`PUSH_MOBILE`), `IN_APP_STAFF` | Phase 2+ / thuộc App nhân viên (`NT` §8, `CLAUDE.md` §3). Bản demo chỉ `IN_APP_WEBAPP`. |
| Soạn/sửa Template (UC-NT-04), cấu hình ngưỡng tại NT (UC-NT-08), báo cáo gửi toàn hệ thống (UC-NT-09), huỷ thủ công một Event | Ai được làm còn `TBD` (`NT` §14, §20 Q3/Q4). Chỉ thêm entry quyền để màn "Vai trò & quyền" hiện rõ ô `TBD` (§7). |
| Quản lý tài khoản đăng nhập (UC-SA-01…08) | Đã có ở `features/employees` (Phase 1: cấp/khoá/mở tài khoản, đổi vai trò). Không làm lại ở `/platform`. |
| Sửa ma trận Role × Permission trên UI (UC-SA-09) | `SA` §19 Q10 chưa chốt "có cho tuỳ chỉnh không" → màn **chỉ đọc**. |
| Nối hợp đồng/biên lai đọc "Thông tin công ty" từ cấu hình | `contracts`/`consignment` (SCC) đang dùng hằng `COMPANY_NAME`; nối vào sẽ thêm cạnh mới vào SCC + phải làm snapshot `SA-BR-11`. Ghi `TODO` + roadmap. |
| Gắn `correlationId` cho 227 lời gọi `appendAudit` cũ; chuỗi băm chống giả mạo; retention/lưu trữ lạnh | Ngoài quy mô demo; `AL` §22 Q6–Q8 còn treo. |
| `LOGIN_FAILED`, khoá do sai mật khẩu (SA-BR-07) | Bản demo chấp nhận mọi mật khẩu. |
| Màn "Chi tiết nhân viên" (`/employees/:id` vẫn `ComingSoon`) | Nợ Phase 1, không thuộc nhóm nền tảng. Xem §16 câu 6. |
| Gỡ SCC 96–98 file; `VC-BR-03/04` | Theo chỉ đạo: cần người dùng duyệt riêng. Phase 6 chỉ cam kết **không làm SCC lớn thêm**. |

---

## 1. Phạm vi từng Round

### 1.1. Round 1 — Tín hiệu cảnh báo + Dashboard

**Trong phạm vi**

1. `shared/domain/enums.ts`: thay `NOTIFICATION_EVENT_TYPES` (D10); nối `NOTIFICATION_PRIORITIES`, `NOTIFICATION_SOURCE_MODULES`,
   `DASHBOARD_ALERT_GROUPS` (§3.1).
2. `shared/domain/alerts.ts` (mới): type `OperationalSignal` dùng chung (§3.1).
3. Hàm thuần `collect…Signals` trong `model.ts` của 7 feature nguồn + export qua barrel (§4.1); export thêm storage key cần
   đọc (§5.3).
4. `features/notifications`: `model.ts` (bảng định tuyến người nhận — dùng ở R2, khai trước; nhóm tín hiệu theo
   `DASHBOARD_ALERT_GROUPS`), `api.ts` `listOperationalSignals()` (đọc storage, gọi collector, **không ghi**), `hooks.ts`
   `useOperationalSignals()`, `index.ts`.
5. `features/finance`: `buildDashboardFinanceSummary()` (hàm thuần, `revenue-cost/model.ts`) + `DashboardFinanceWidget`
   (`revenue-cost/components/`) + export qua barrel.
6. `features/dashboard`: `model.ts` (KPI vận hành — hàm thuần), `screens/DashboardScreen.tsx`, `components/`, `index.ts`.
   Route `/dashboard` mount `DashboardScreen`.
7. `vehicles` barrel export thêm `useVehicles` (KPI vận hành).
8. `features/vehicles/seed.ts`: `veh_001`, `veh_010`, `veh_017` → `status: 'RENTED'` (`VH-BR-10`); `SEED_VERSION` 23 → **24**
   (§16 câu 4).

**Ngoài phạm vi R1:** lưu Notification Event, Inbox, chuông (R2); mọi thay đổi `audit.ts` (R3); không sửa
`DispatchBoardScreen` dù có logic "sắp giao/sắp nhận" tương tự (giữ cùng cửa sổ 24h — comment đối chiếu, không refactor
file trong SCC); không thêm cơ chế đồng bộ `Vehicle Status` lúc chạy (VH-BR-10/VR-BR-11 do App nhân viên thực thi — roadmap
§18.2 mục 9).

### 1.2. Round 2 — Trung tâm thông báo

**Trong phạm vi**

1. `shared/lib/storage.ts`: `writeJson()` trả `boolean` (không đổi hành vi với caller cũ); thêm `measureAppStorage()` (§9).
2. `features/notifications`: entity `NotificationEvent` lưu ở key `notifications` (§3.2); `syncNotifications(now)` —
   khử trùng theo `dedupeKey` (EX-02), tạo mới / chuyển `CANCELLED` khi tín hiệu biến mất (AC-NT-008, `NT-BR-14`), snapshot
   tiêu đề + nội dung theo Template v1 (`NT-BR-09`, AC-NT-007), trần `NOTIFICATIONS_MAX_CHARS`; `listMyNotifications`,
   `markRead`, `markAllRead`; audit (§6).
3. `NotificationCenterScreen` (Inbox: lọc loại sự kiện / mức ưu tiên / đã đọc / khoảng thời gian / module nguồn — `NT` §10;
   bấm → đánh dấu đã đọc + mở đối tượng nguồn), `NotificationBell` (số chưa đọc). `AppShell`/`Topbar` thêm `topbarSlot`
   (D5). Route `/platform/notifications`.
4. `notifications/seed.ts`: bước seed **xoá** key `notifications` (để reseed không để lại sự kiện trỏ id cũ) — không sinh
   dữ liệu giả; sự kiện sinh ở lần đồng bộ đầu tiên.
5. `permissions.ts`: thêm entry `NOTIFICATION` theo `NT` §14 (§7).

**Ngoài phạm vi R2:** Template editor, cấu hình ngưỡng, báo cáo gửi, huỷ thủ công (§0.3); `IN_APP_STAFF`.

### 1.3. Round 3 — Nhật ký thao tác

**Trong phạm vi**

1. `shared/lib/audit.ts`: trường tuỳ chọn (D7) + `AUDIT_MAX_CHARS` (D8) + tự cắt khi ghi thất bại.
2. `enums.ts`: nối `AUDIT_MODULES`, `AUDIT_SEVERITIES`, `AUDIT_ACTOR_TYPES`; nối action mới vào **cuối** `AUDIT_ACTIONS` (§6).
3. `features/audit`: `model.ts` (ánh xạ entity → module, phạm vi tài chính cho `ACCOUNTANT`, quy tắc che, lọc, dựng dòng CSV),
   `api.ts` (`listAuditRecords` có lọc + phân trang, `exportAuditCsv`, `revealSensitive` — ghi meta-audit), `hooks.ts`,
   `screens/AuditLogScreen.tsx`, `components/AuditRecordDetailSheet.tsx`, `seed.ts`, `index.ts`. Route `/platform/audit`.
4. `shared/ui/pagination.tsx` (mới, theo pattern shadcn) — dùng ở màn Nhật ký; R4 áp cho danh sách dài.
5. `features/auth/store.ts`: ghi audit `LOGOUT` (`SA-BR-08`).
6. `permissions.ts`: sửa `AUDIT.VIEW`, thêm `AUDIT.EXPORT` (§7).
7. Nợ Phase 5 R3: `ConsignmentAuditTab` chỉ tải khoản chi trả/biên bản khi có `contractId` (§10).
8. `SEED_VERSION` 24 → **25** (seed nhật ký mẫu).

**Ngoài phạm vi R3:** sửa các tab Nhật ký theo đối tượng hiện có (chỉ hưởng lợi từ seed); gắn `correlationId` vào lời gọi cũ.

### 1.4. Round 4 — Quản trị hệ thống + polish

**Trong phạm vi**

1. `features/auth`: `SystemConfig` (model + api + hooks + seed key `systemConfig`), `SystemConfigScreen`,
   `PermissionMatrixScreen`; route `/platform/system-config`, `/platform/permissions`. `SEED_VERSION` 25 → **26**.
2. Phân trang (component R3) cho: Danh sách lượt thuê, Sổ giao dịch, Danh sách quyết toán, Lịch chi trả hàng tháng (ký
   gửi), Danh sách khách — xem §10 mục 1.
3. Gom chuỗi: `nav.tsx` (19 nhãn), `routes.tsx` (tiêu đề còn lại), text JSX + toast hardcode (§0.1) vào `vi.ts`.
4. Rà responsive **bằng đọc code** theo checklist §12.4 (không chạy trình duyệt — quyết định 14/09/2026).
5. Viết lại `README.md`.
6. Màn **Chi tiết nhân viên** (`/employees/:id`, nợ Phase 1 — §16 câu 6): phạm vi chi tiết `tech-lead` viết khi giao R4
   (bám `EmployeeAssignment-BRD.md` + `WebappQuanTri.md` §8.2; tái dùng `features/employees`).
7. ~~Đồng bộ `Vehicle Status` seed~~ — **chuyển lên R1** (§16 câu 4).

---

## 2. Ranh giới kiến trúc

### 2.1. Đồ thị import mục tiêu (mũi tên = "import")

```text
app/routes.tsx ──► features/dashboard ──► features/notifications ──► barrel nguồn (vehicles, maintenance, rentals,
     │                     │                                          contracts, incidents, employees, consignment, finance)
     │                     ├──► @/features/finance  (DashboardFinanceWidget)
     │                     └──► @/features/vehicles, @/features/rentals (KPI vận hành)
     ├──► features/notifications (NotificationCenterScreen, NotificationBell → truyền vào AppShell qua topbarSlot)
     ├──► features/audit ──► shared/lib/audit (KHÔNG import barrel feature nào)
     └──► features/auth  (SystemConfigScreen, PermissionMatrixScreen)

shared/layout/AppShell ──► Topbar(topbarSlot)        — không import features/notifications
features/<nguồn>       ──✗──► features/notifications | dashboard | audit   (CẤM)
features/notifications ──✗──► features/dashboard                           (CẤM — chỉ chiều dashboard → notifications)
```

Bất biến kiểm bằng máy ở mọi round (DoD): `sccfiles.mjs` cho ra **đúng** `scc-target.txt` (98 file, không file mới nào
của `dashboard`/`notifications`/`audit`/`auth`). `reach.mjs` đã xác nhận các file sẽ được re-export thêm qua barrel
(`vehicles/hooks.ts`, `vehicles/api.ts`, `maintenance/model.ts`, `employees/hooks.ts`, `consignment/model.ts`,
`consignment/payoutModel.ts`, `rentals/model.ts`, `incidents/model.ts`) **không** đi ngược vào SCC; các file `finance`/
`contracts` liên quan đã nằm sẵn trong SCC → re-export không làm SCC lớn thêm.

### 2.2. Ngoại lệ kiến trúc cần người dùng duyệt (§16 câu 1)

| # | Ngoại lệ | Phạm vi | Vì sao chấp nhận được |
| --- | --- | --- | --- |
| E1 | `notifications/api.ts` đọc thẳng storage của 8 feature khác (qua storage key export ở barrel — **không** deep import) | 1 file | Tiền lệ `finance` (RENTAL-SETTLEMENT-PLAN.md §0.2, CONSIGNMENT-PLAN.md §18.5) — giống "dịch vụ nền quét dữ liệu" phía server. Khi có backend: thay bằng một endpoint, không đổi `hooks.ts`/UI. |
| E2 | Mở rộng barrel của 8 feature nguồn (storage key + hàm `collect…Signals` + `useVehicles`) — liệt kê đủ ở §5.3, mỗi dòng có comment trỏ plan này | 8 file `index.ts` | Chỉ thêm export, không đổi export cũ; đã kiểm không nở SCC (§2.1). |
| E3 | Mô hình quét (D1) thay vì module nguồn "đẩy sự kiện" | — | `NT` §11 cho phép; tránh vòng import. Hệ quả: sự kiện "giao dịch" như `EMPLOYEE_ASSIGNMENT` cũng suy từ trạng thái hiện tại (phân công `ASSIGNED`), không phát đúng lúc bấm "Phân công". |
| E4 | `AppShell`/`Topbar` thêm prop `topbarSlot` (đổi API nhỏ của `shared/layout`) | 2 file | Giữ `shared` không phụ thuộc `features` (D5). |
| E5 | Sửa hạ tầng dùng chung `shared/lib/audit.ts` + `shared/lib/storage.ts` | 2 file | D7/D8 — tương thích ngược (trường tuỳ chọn, `writeJson` vẫn gọi được như cũ). |
| E6 | Thay (không nối) mảng `NOTIFICATION_EVENT_TYPES` | 1 khối enum | D10 — sửa scaffold sai tài liệu, chưa được dùng. |
| E7 | Màn `SA` trong `features/auth` (feature được `shared/layout` import) | `auth` | D6; `auth` không chạm SCC. |

---

## 3. Data model

### 3.1. Round 1 — tín hiệu (không lưu)

`shared/domain/enums.ts` (mỗi khối có comment nguồn):

```text
NOTIFICATION_EVENT_TYPES   — đúng 18 mã Notification-BRD.md §7, đúng thứ tự:
  RENTAL_UPCOMING, HANDOVER_UPCOMING, RETURN_UPCOMING, EMPLOYEE_ASSIGNMENT, CONTRACT_INCOMPLETE, PAYMENT_INCOMPLETE,
  VEHICLE_INSPECTION_EXPIRING, VEHICLE_INSURANCE_EXPIRING, VEHICLE_DOCUMENT_EXPIRING, CUSTOMER_BOOKING_SUCCESS,
  RETURN_TIME_CONFIRMATION_REQUEST, VEHICLE_BREAKDOWN_BEFORE_HANDOVER, CONSIGNMENT_CONTRACT_EXPIRING,
  CONSIGNMENT_PAYMENT_DUE, MAINTENANCE_DUE, VEHICLE_OVERUSE, TASK_ASSIGNMENT, OPERATION_ALERT_OTHER
NOTIFICATION_PRIORITIES    — LOW, NORMAL, HIGH, URGENT                         (NT §6.1)
NOTIFICATION_SOURCE_MODULES — VM, MT, RM, CT, PM, DI, EA, VC                    (NT §6.1 "Source Module")
DASHBOARD_ALERT_GROUPS     — VEHICLE_DOCUMENT, UPCOMING_HANDOVER, UPCOMING_RETURN, OVERDUE_RETURN, PAYMENT_INCOMPLETE,
                             INCIDENT_OPEN, CONTRACT_UNSIGNED, MAINTENANCE_DUE, VEHICLE_OVERUSE, CONSIGNMENT
                             (WebappQuanTri.md §5.3 "Cảnh báo" — BA/tech-lead đặt mã nhóm hiển thị, không phải enum nghiệp vụ)
NOTIFICATION_DELIVERY_STATUSES — giữ nguyên (đã đúng NT §6.4)
```

`shared/domain/alerts.ts` (mới — type dùng chung, không import `features`):

```text
OperationalSignal
 ├── dedupeKey        `${eventType}:${entityType}:${entityId}:${dueRef ?? ''}`  (NT EX-02)
 ├── eventType        NotificationEventType
 ├── sourceModule     NotificationSourceModule
 ├── group?           DashboardAlertGroup — thiếu = không vào Dashboard (vd. EMPLOYEE_ASSIGNMENT) — lệch L2 §18.9
 ├── resource         Resource   — để lọc theo quyền VIEW (người xem không có quyền → không thấy tín hiệu)
 ├── entityType / entityId / entityLabel   ("Xe 51A-123.45", "Lượt thuê rt_017")
 ├── priority         NotificationPriority
 ├── dueRef?          ISO — mốc nghiệp vụ (Expiry Date, Pickup/Return DateTime, dueDate…)
 ├── payload          Record<string, string | number> — biến cho Template (biển số, số ngày còn lại, số tiền…)
 ├── link             đường dẫn mở đối tượng nguồn (dùng `paths` + `?tab=` nếu màn đích hỗ trợ)
 └── recipientUserIds? string[] — người nhận cụ thể (vd. nhân viên được phân công); vai trò nhận do NT định tuyến (§4.2)
```

### 3.2. Round 2 — `NotificationEvent` (lưu, key `notifications`)

Gộp Event + Delivery (`NT` §6.1/§6.4) thành **một bản ghi gọn** vì Phase 1 chỉ có một kênh (`IN_APP_WEBAPP`) và mỗi vai trò
demo chỉ có một tài khoản; trạng thái đọc theo từng người nhận lưu trong `readBy`.

```text
NotificationEvent
 ├── id                 generateId('NT')
 ├── dedupeKey          (từ tín hiệu — duy nhất trong các bản ghi chưa CANCELLED)
 ├── eventType / sourceModule / entityType / entityId / entityLabel / priority / dueRef / link / resource
 ├── title / body       snapshot đã dựng từ Template v1 tại thời điểm tạo (NT-BR-09)
 ├── templateVersion    1
 ├── recipientRoles     Role[]            (NT-BR-08)
 ├── recipientUserIds   string[]
 ├── channel            'IN_APP_WEBAPP'
 ├── deliveryStatus     SENT | CANCELLED  (IN_APP coi là SENT ngay khi tạo — NT §6.5; PENDING/FAILED/RETRY không dùng ở demo)
 ├── triggerAt          thời điểm đồng bộ tạo ra
 ├── cancelledAt?       khi tín hiệu không còn (NT-BR-14 — không xoá vật lý trong trần dung lượng)
 └── readBy             Record<userId, ISO>  (AC-NT-004)
```

### 3.3. Round 3 — Audit Record (mở rộng, tương thích ngược)

```text
AuditRecord (shared/lib/audit.ts) — 10 trường cũ giữ nguyên + tuỳ chọn:
 ├── module?        AuditModule     — thiếu thì suy ra từ entity (features/audit/model.ts)
 ├── severity?      AuditSeverity   — thiếu thì coi INFO
 ├── actorType?     AuditActorType  — thiếu thì USER
 ├── correlationId? string          — chỉ bản ghi mới/seed (AL-BR-04)
 └── reason?        string          (AL-BR-03)
```

`enums.ts` nối: `AUDIT_MODULES` = `VEHICLE, CUSTOMER, RENTAL, HANDOVER, RETURN, INCIDENT, SETTLEMENT, PAYMENT, CONTRACT,
EMPLOYEE, REVENUE_COST, AUTH, AUDIT` (đúng `AL` §6) + nối thêm có comment `BA đề xuất`: `NOTIFICATION` (`NT-BR-13` đã dùng
mã này), `MAINTENANCE`, `CALENDAR`, `CONSIGNMENT`, `SYSTEM_ADMIN`. `AUDIT_SEVERITIES` = `INFO, NOTICE, SENSITIVE, SECURITY`.
`AUDIT_ACTOR_TYPES` = `USER, SYSTEM`.

Bảng ánh xạ entity → module (25 entity hiện có, `features/audit/model.ts`): `Vehicle`/`VehicleDocument` → `VEHICLE` ·
`MaintenanceRule`/`MaintenanceRecord`/`SparePartRecord` → `MAINTENANCE` · `Customer` → `CUSTOMER` · `VehicleBlock` →
`CALENDAR` · `Employee`/`Assignment` → `EMPLOYEE` · `UserAccount` → `AUTH` · `Rental` → `RENTAL` · `Contract` →
`CONTRACT` · `HandoverRecord` → `HANDOVER` · `ReturnRecord` → `RETURN` · `Incident` → `INCIDENT` · `Settlement` →
`SETTLEMENT` · `Transaction`/`PaymentRequest`/`CashDrawerSubmission` → `PAYMENT` · `CostRecord`/`FinanceReport` →
`REVENUE_COST` · `VehicleOwner`/`ConsignmentProposal`/`ConsignmentContract`/`ConsignmentHandoverRecord`/`OwnerPayoutRecord`
→ `CONSIGNMENT` · `NotificationEvent` → `NOTIFICATION` · `AuditLog` → `AUDIT` · `SystemConfig` → `SYSTEM_ADMIN` · entity lạ
→ hiển thị `entity` thô (không throw). `dev` **grep lại** toàn bộ `entity:` (kể cả giá trị động) trước khi chốt bảng.

### 3.4. Round 4 — `SystemConfig` (key `systemConfig`)

`SystemAdministration-BRD.md` §6.3/§10: `companyName`, `address`, `taxCode`, `representative`, `phone`, `email`,
`logoNote` (placeholder — demo không upload ảnh), `timezone` (cố định `Asia/Ho_Chi_Minh` / UTC+7 — `SA-BR-14`, chỉ đọc),
`currency` (cố định `VND`, chỉ đọc), `updatedAt`, `updatedBy`. `TODO(OQ: SystemAdministration-BRD.md §19 Q8)` danh sách
trường; `TODO(OQ: §19 Q9)` một pháp nhân.

---

## 4. Hàm thuần

### 4.1. Collector ở module nguồn (R1) — ngưỡng thuộc module nguồn, NT chỉ gom

| Feature / file | Hàm (export qua barrel) | Event Type → nhóm Dashboard | Ngưỡng / quy tắc (comment tại chỗ) |
| --- | --- | --- | --- |
| `vehicles/model.ts` | `collectVehicleDocumentSignals(vehicles, now)` | `INSPECTION` → `VEHICLE_INSPECTION_EXPIRING`; `INSURANCE` → `VEHICLE_INSURANCE_EXPIRING`; loại khác có `expiryDate` → `VEHICLE_DOCUMENT_EXPIRING` · nhóm `VEHICLE_DOCUMENT` | `documentExpiryStatus(expiryDate, warningLeadDays)` ≠ `VALID` (CR-2026-046, mặc định 30). `EXPIRED` → `HIGH`, `EXPIRING_SOON` → `NORMAL`. Bỏ xe `INACTIVE`. Chỉ cảnh báo, không chặn (CR-2026-041). |
| `maintenance/model.ts` | `collectMaintenanceDueSignals(vehicles, rules, records)` | `MAINTENANCE_DUE` · `MAINTENANCE_DUE` | `applicableRule` + `nextDueKm` + `maintenanceDueStatus` (`DEFAULT_DUE_SOON_WARNING_KM` 500 — đã có `TODO(OQ: MT §19 Q2)`). `OVERDUE` → `HIGH`. |
| `rentals/model.ts` | `collectRentalTimeSignals(rentals, vehicles, now)` | Giao trong cửa sổ → `HANDOVER_UPCOMING` · `UPCOMING_HANDOVER`; trả trong cửa sổ → `RETURN_UPCOMING` · `UPCOMING_RETURN`; quá `expectedReturnDateTime` còn đang thuê → `OPERATION_ALERT_OTHER` (payload `kind: RETURN_OVERDUE`) · `OVERDUE_RETURN` | `UPCOMING_WINDOW_HOURS = 24` — `TODO(OQ: RentalCalendar-BRD.md §21 + câu hỏi 16)`; trước giao = `CONFIRMED`/`CONTRACT_CREATED`/`READY_FOR_HANDOVER`; đang thuê = `HANDED_OVER`/`IN_RENTAL` (khớp `DispatchBoardScreen` — ghi comment đối chiếu). Quá hạn trả → `URGENT`. **Không** phát `RENTAL_UPCOMING` (§11 Q12). |
| `contracts/model.ts` | `collectContractSignals(contracts, rentals)` | `CONTRACT_INCOMPLETE` · `CONTRACT_UNSIGNED` | Hợp đồng `GENERATED` (chưa `SIGNED`) của lượt không `CANCELLED`/`NO_SHOW`. Nếu lượt đã `HANDED_OVER`+ mà hợp đồng vẫn `GENERATED` → `HIGH`. `TODO(OQ)` định nghĩa "thiếu bản ký" (§11 Q14). |
| `finance/payment/model.ts` | `collectPaymentSignals(rentals, requests, txns, settlements)` | `PAYMENT_INCOMPLETE` · `PAYMENT_INCOMPLETE` | Chỉ lượt **chưa** `COMPLETED`/`CANCELLED`/`NO_SHOW` (≤ ~26 lượt — giữ nhanh). Mốc `BOOKING` chưa thu đủ khi lượt ≥ `CONFIRMED`; mốc `HANDOVER` chưa thu đủ khi lượt `HANDED_OVER`/`IN_RENTAL` (dùng `buildPaymentSchedule`; bỏ dòng vật bảo đảm `MOTORBIKE` — PM-BR-22). **Không** tính "quá hạn" — `TODO(OQ: Payment-BRD.md §27 Q9)`. |
| `incidents/model.ts` | `collectIncidentSignals(incidents, vehicles)` | `OPERATION_ALERT_OTHER` (payload `kind: INCIDENT_OPEN`) · `INCIDENT_OPEN` | "Chưa xử lý" = trạng thái **không** thuộc `CLOSED`/`CANCELLED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION` (§11 Q13). Mức ưu tiên theo `severity` của sự cố. |
| `employees/model.ts` | `collectAssignmentSignals(assignments, employees, rentals)` | `EMPLOYEE_ASSIGNMENT` · (không vào Dashboard) | Phân công `ASSIGNED` có `plannedWindowEnd ≥ now`; `recipientUserIds` = `account.userId` của người được giao (§11 Q12). |
| `consignment/payoutModel.ts` | `collectConsignmentSignals(contracts, payoutRecords, todayKey)` | `CONSIGNMENT_CONTRACT_EXPIRING` (`isExpiringSoon`, VC-BR-19); `CONSIGNMENT_PAYMENT_DUE` (`isPayoutDueSoon` → `NORMAL`, `isPayoutOverdue` → `URGENT`, VC-BR-20) · `CONSIGNMENT` | Dùng nguyên hằng `CONSIGNMENT_EXPIRY_REMINDER_DAYS`/`…_PAYMENT_DUE_REMINDER_DAYS` (đã có `TODO(OQ)` cấu hình được — CR-2026-051). |

`VEHICLE_OVERUSE`: **không** phát (ngưỡng chưa có — `TODO(OQ: Notification-BRD.md §20 Q7)`); nhóm Dashboard
`VEHICLE_OVERUSE` hiển thị dòng "Chưa có ngưỡng — chờ chốt" thay vì số. `RETURN_TIME_CONFIRMATION_REQUEST`,
`VEHICLE_BREAKDOWN_BEFORE_HANDOVER`, `CUSTOMER_BOOKING_SUCCESS`, `TASK_ASSIGNMENT`, `RENTAL_UPCOMING`: không phát ở Phase 6
(lý do §11).

Mỗi collector: thuần, nhận `now`/`todayKey` làm tham số (không gọi `new Date()` bên trong), trả `OperationalSignal[]`,
`dedupeKey` ổn định (cùng dữ liệu → cùng key).

### 4.2. `features/notifications/model.ts`

- `RECIPIENT_ROUTING: Record<NotificationEventType, Role[]>` — **BA đề xuất**, `TODO(OQ: Notification-BRD.md §6.2/§20 Q3, Q6)`.
  Đề xuất mặc định: giấy tờ xe + bảo dưỡng → `SYSTEM_ADMIN`, `MANAGER`, `SALES`; giao/nhận sắp tới + quá hạn trả →
  `MANAGER`, `SALES`, `DISPATCHER`; hợp đồng chưa ký + thanh toán chưa đủ → `MANAGER`, `SALES`, `ACCOUNTANT` (chỉ thanh
  toán); sự cố đang mở → `MANAGER`, `SALES`; hợp đồng ký gửi sắp hết hạn → `SYSTEM_ADMIN` (CR-2026-051); chi trả chủ xe →
  `SYSTEM_ADMIN`, `ACCOUNTANT`; phân công → theo `recipientUserIds` + `DISPATCHER`. **Ràng buộc kiểm bằng code (DoD):** mọi
  vai trò trong bảng phải `can(role, signal.resource, 'VIEW') === true` — nếu không, bỏ vai trò đó (không cấp quyền ngầm).
- `isRecipient(event, user)` — `NT-BR-12`.
- `renderTemplate(eventType, payload)` → `{ title, body }` từ `vi.notifications.templates.<eventType>` (thay `{{biến}}`), v1.
- `groupSignalsForDashboard(signals, can)` — lọc theo `can(role, resource, 'VIEW')`, gom theo `group`, sắp ưu tiên → mốc.
- `planSync(existing, signals, now)` (R2) → `{ toCreate, toCancel }` — thuần, để kiểm bằng harness.
- `pruneToBudget(events, maxChars)` (R2) — bỏ trước: `CANCELLED` cũ nhất → đã đọc bởi mọi người nhận cũ nhất → cũ nhất.

### 4.3. `features/dashboard/model.ts` (R1)

`buildOperationalKpis({ vehicles, rentals, now })` → tổng xe, `AVAILABLE`, `RENTED`, `MAINTENANCE`, `INACTIVE` (theo
`Vehicle Status` — `VM`), lượt giao hôm nay, lượt nhận hôm nay (ngày theo giờ địa phương, bỏ `CANCELLED`/`NO_SHOW` — cùng
quy tắc `DispatchBoardScreen`), lượt thuê đang diễn ra (`HANDED_OVER` + `IN_RENTAL`) — `WebappQuanTri.md` §5.3, master §46.

### 4.4. `finance/revenue-cost/model.ts` (R1) — `buildDashboardFinanceSummary(input)`

Trả: doanh thu / chi phí trực tiếp / lợi nhuận vận hành **tháng này** và **tháng trước** (`summarizePeriod`,
`resolvePeriodPreset('THIS_MONTH' | 'LAST_MONTH')`, chính sách `ON_SETTLEMENT` — CR-2026-048, nhãn "ước tính" RV-BR-09),
thêm cặp **hôm nay / hôm qua** (`RV` §17.1 "hôm nay / tháng này" — UI có nút chuyển), công nợ phải thu (Σ `outstanding > 0`
của `deriveCustomerBalances`), doanh thu theo ngày 30 ngày (`enumeratePeriodBuckets(LAST_30_DAYS, 'DAY')`), top 5 xe theo
lợi nhuận và 5 xe lợi nhuận thấp nhất trong 30 ngày (`buildVehiclePerformance`) — `TODO(OQ: RevenueCost-BRD.md §17.1/§28
Q14)` tiêu chí "xe hiệu quả thấp". Mọi số do hàm tính; widget chỉ hiển thị.

### 4.5. `features/audit/model.ts` (R3)

`resolveModule(record)` · `filterAuditRecords(records, filter)` (module, action, actor, actorType, entity type + id, khoảng
thời gian, severity, correlationId — `AL` §9.1) · `scopeForRole(role)` → `ALL` hoặc `FINANCE` (`ACCOUNTANT`: `SETTLEMENT`,
`PAYMENT`, `REVENUE_COST` + entity `OwnerPayoutRecord` — `TODO(OQ: AuditLog-BRD.md §16 "giới hạn tài chính")`) ·
`maskValue(path, value, role, revealed)` — quy tắc `AL` §11: CCCD/hộ chiếu/GPLX/SĐT che giữa (`0123****89`), số tài khoản
che trừ `SYSTEM_ADMIN`/`ACCOUNTANT`; `MANAGER`/`SALES`/`SYSTEM_ADMIN` xem đầy đủ **sau khi bấm "Hiện đầy đủ"** (ghi
meta-audit `SENSITIVE` — `AL-BR-08`, CR-2026-037); danh sách tên trường nhạy cảm đặt ở một hằng có
`TODO(OQ: AuditLog-BRD.md §22 Q4)` (`dev` grep tên field thật ở `customers`/`employees`/`consignment`/`finance`) ·
`buildAuditCsvRows(records, filter, exporter)` — kèm dòng đầu: tiêu chí lọc, thời điểm xuất, người xuất, số bản ghi (`AL` §10),
giới hạn `AUDIT_EXPORT_MAX_ROWS = 2000` (vượt → yêu cầu thu hẹp lọc).

---

## 5. API / hooks / barrel

### 5.1. `features/notifications`

| Hàm `api.ts` (bọc `fakeRequest`) | Round | Ghi chú |
| --- | --- | --- |
| `listOperationalSignals()` | R1 | Đọc storage nguồn (§5.3), gọi 8 collector với `now`, trả `OperationalSignal[]`. **Không ghi.** |
| `syncNotifications(now)` (nội bộ, đồng bộ) | R2 | `planSync` → ghi tạo mới / `CANCELLED`; `pruneToBudget`; audit tóm tắt (§6). Gọi ở đầu `listMyNotifications`. |
| `listMyNotifications(user, filter)` | R2 | Đồng bộ rồi lọc `isRecipient` + bộ lọc Inbox. |
| `markRead(id, user)` / `markAllRead(user)` | R2 | Ghi `readBy`. Mở thông báo nhóm tài chính (`PAYMENT_INCOMPLETE`, `CONSIGNMENT_PAYMENT_DUE`) → audit (AC-NT-009). |

Hooks: `useOperationalSignals()` (R1); `useMyNotifications(filter)`, `useUnreadNotificationCount()` (`refetchInterval`
60 giây + refetch khi focus — vì feature khác không invalidate key `notifications`), `useMarkNotificationRead()`,
`useMarkAllNotificationsRead()` (R2). Barrel: `useOperationalSignals`, `groupSignalsForDashboard`, `renderTemplate`, type `OperationalSignal`,
type `DashboardAlertGroupView` (R1 — lệch L3 §18.9); `NotificationCenterScreen`, `NotificationBell` (R2).

### 5.2. `features/audit` (R3) và `features/auth` (R4)

- `audit/api.ts`: `listAuditRecordsPage(filter, page, pageSize, viewer)` (áp `scopeForRole`, trả `{ items, total }`; ghi
  meta-audit `VIEW_AUDIT_LOG` **một lần mỗi lần mở màn** — không ghi mỗi lần đổi bộ lọc, §11 Q8), `getAuditRecord(id, viewer)`,
  `revealAuditSensitive(id, viewer)`, `exportAuditCsv(filter, viewer)` (ghi `EXPORT`, `module = AUDIT` — `AL` §10). Barrel:
  `AuditLogScreen`.
- `auth/api.ts` (mới): `getSystemConfig()`, `updateSystemConfig(input, actor)` (audit `CONFIG_CHANGE`, before/after —
  `SA-BR-09`). `auth/hooks.ts`: `useSystemConfig`, `useUpdateSystemConfig`. Barrel thêm `SystemConfigScreen`,
  `PermissionMatrixScreen`.

### 5.3. Export thêm ở barrel nguồn (E2) — đúng danh sách, mỗi dòng comment `DASHBOARD-PLATFORM-PLAN.md §5.3`

| Barrel | Thêm (R1 trừ khi ghi khác) |
| --- | --- |
| `@/features/vehicles` | `VEHICLES_STORAGE_KEY`, `useVehicles`, `collectVehicleDocumentSignals` |
| `@/features/maintenance` | `MAINTENANCE_RULES_STORAGE_KEY`, `collectMaintenanceDueSignals` (records key đã export) |
| `@/features/rentals` | `collectRentalTimeSignals` (`RENTALS_STORAGE_KEY`, `useRentals` đã export) |
| `@/features/contracts` | `CONTRACTS_STORAGE_KEY`, `collectContractSignals` |
| `@/features/incidents` | `collectIncidentSignals` (`INCIDENTS_STORAGE_KEY` đã export) |
| `@/features/employees` | `EMPLOYEES_STORAGE_KEY`, `ASSIGNMENTS_STORAGE_KEY`, `collectAssignmentSignals` |
| `@/features/consignment` | `collectConsignmentSignals` (storage key đã export) |
| `@/features/finance` | `PAYMENT_REQUESTS_STORAGE_KEY`, `TRANSACTIONS_STORAGE_KEY`, `SETTLEMENTS_STORAGE_KEY`, `collectPaymentSignals`, `DashboardFinanceWidget` (bản **lazy** — `revenue-cost/components/lazyWidgets.ts`, nơi dùng bọc `<Suspense>`; lệch L1 §18.9) |

Không thêm export nào khác. Cần thêm → dừng, báo `tech-lead` (phải chạy lại `reach.mjs` + `sccfiles.mjs`).

---

## 6. Audit action mới — nối **cuối** `AUDIT_ACTIONS`

| Round | Action | Dùng khi | Nguồn |
| --- | --- | --- | --- |
| R2 | `SYNC_NOTIFICATIONS` | Một bản ghi **tóm tắt** mỗi lần đồng bộ có tạo/huỷ ≥ 1 sự kiện (`actorType = SYSTEM`, `module = NOTIFICATION`, summary "Tạo N, huỷ M thông báo") — không ghi từng sự kiện để tiết kiệm dung lượng | `NT-BR-13` (BA đề xuất gộp) |
| R2 | `VIEW_SENSITIVE_NOTIFICATION` | Mở thông báo nhóm tài chính | AC-NT-009 |
| R3 | `LOGOUT` | Đăng xuất (`auth/store.ts`) | `AL` §6, `SA-BR-08` |
| R3 | `VIEW_AUDIT_LOG` | Mở màn Nhật ký thao tác (meta-audit) | `AL-BR-06` |
| R3 | `VIEW_AUDIT_SENSITIVE_VALUE` | Bấm "Hiện đầy đủ" (`severity = SENSITIVE`) | `AL-BR-08` |
| R4 | `CONFIG_CHANGE` | Lưu Cấu hình hệ thống | `AL` §6 (mã nguyên văn), `SA-BR-09` |

Xuất nhật ký dùng `EXPORT` sẵn có (`module = AUDIT`). `vi.ts` thêm `AUDIT_ACTION_LABELS: Record<AuditAction, string>` —
**đủ mọi giá trị** (TS ép đủ) — đây là việc "nhãn hiển thị cho màn Nhật ký" mà `CONSIGNMENT-PLAN.md` dòng 484 để lại cho
Phase 6.

---

## 7. `permissions.ts` (ô `TBD` giữ nguyên `'TBD'`)

| Round | Resource × Action | SYSTEM_ADMIN | MANAGER | SALES | DISPATCHER | OPERATION_STAFF | ACCOUNTANT | `source` |
| --- | --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| R2 (giữ) | `NOTIFICATION.VIEW` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | sửa thành `Notification-BRD.md §14 — Xem Trung tâm thông báo của mình / Đánh dấu đã đọc` |
| R2 (mới) | `NOTIFICATION.CONFIG` | ✓ | ✗ | ✗ | TBD | ✗ | ✗ | `NT §14 — Cấu hình danh mục sự kiện / ngưỡng / kênh` |
| R2 (mới) | `NOTIFICATION.EDIT` | ✓ | TBD | ✗ | TBD | ✗ | ✗ | `NT §14 — Soạn / sửa Template` |
| R2 (mới) | `NOTIFICATION.VOID` | ✓ | TBD | ✗ | TBD | ✗ | ✗ | `NT §14 — Huỷ (CANCELLED) một Notification Event` |
| R2 (mới) | `NOTIFICATION.EXPORT` | ✓ | TBD | ✗ | TBD | ✗ | TBD | `NT §14 — Xem báo cáo gửi thông báo toàn hệ thống` |
| R3 (sửa) | `AUDIT.VIEW` | ✓ | ✓ | ✓ | TBD | ✗ | ✓ | `AuditLog-BRD.md §16 + CR-2026-035/037 — Accountant giới hạn tài chính; OPERATION_STAFF ✗ (AL-BR-12)` |
| R3 (mới) | `AUDIT.EXPORT` | ✓ | ✓ | ✓ | TBD | ✗ | TBD | `AL §16 — Xuất nhật ký (CR-2026-037; Accountant TBD — §22 Q11)` |

Ghi chú bắt buộc trong comment: (a) cột `DISPATCHER` không có trong bảng `NT` §14 / `AL` §16 → `TBD`; (b) `NT` §14 ghi `SALES`
= ✗ cho báo cáo/huỷ/template trong khi CR-2026-035 nói `SALES` ≈ `MANAGER` — **giữ đúng chữ tài liệu (✗)**, ghi
`TODO(OQ)` cho BA (§11 Q2); (c) đổi `AUDIT.VIEW` làm `SALES`/`ACCOUNTANT` **thấy thêm** menu "Nhật ký thao tác" — đây là
sửa cho khớp tài liệu (§16 câu 2). Các entry `NOTIFICATION.CONFIG/EDIT/VOID/EXPORT` **không có UI dùng** ở Phase 6 — chỉ để
màn "Vai trò & quyền" hiện rõ quyết định còn treo.

---

## 8. UI & route

### 8.1. Dashboard (R1) — `/dashboard` (`WebappQuanTri.md` §5.3, chỉ đọc)

- `PageHeader`: tiêu đề + "Cập nhật lúc HH:mm" + nút làm mới (invalidate các query Dashboard dùng).
- **KPI vận hành** (gate `VEHICLE.VIEW` cho 5 ô xe, `RENTAL.VIEW` cho 3 ô lượt): thẻ số; bấm → màn danh sách tương ứng
  (không thêm query param mới cho màn đích).
- **KPI tài chính** (gate `FINANCE_REPORT.VIEW`): `<DashboardFinanceWidget />` — 4 thẻ (doanh thu so kỳ trước, chi phí trực
  tiếp, lợi nhuận vận hành "ước tính", công nợ phải thu), nút chuyển Hôm nay / Tháng này, thanh CSS 30 ngày (D9), 2 bảng
  nhỏ top/thấp 5 xe → link Báo cáo tài chính.
- **Cảnh báo**: 10 nhóm `DASHBOARD_ALERT_GROUPS`, mỗi nhóm: nhãn, số lượng, tối đa 5 dòng (nhãn đối tượng + mốc + badge ưu
  tiên, bấm → `link`), "Xem tất cả" → Trung tâm thông báo (R2; R1 chưa có thì ẩn). Nhóm người xem không có quyền `VIEW` →
  ẩn hẳn. Nhóm rỗng → "Không có cảnh báo". `VEHICLE_OVERUSE` → dòng "Chưa có ngưỡng cảnh báo — chờ chốt (OQ)".
- Trạng thái rỗng toàn trang cho vai trò không có quyền nào (vd. `OPERATION_STAFF` chỉ thấy KPI xe).

### 8.2. Trung tâm thông báo (R2) — `/platform/notifications` (gate `NOTIFICATION.VIEW`)

Danh sách thẻ (tiêu đề, nội dung, đối tượng, thời điểm, badge ưu tiên, chấm chưa đọc), bộ lọc 5 tiêu chí `NT` §10, tab
"Đang hiệu lực" / "Đã hết hiệu lực" (`CANCELLED`), nút "Đánh dấu tất cả đã đọc", bấm thẻ → `markRead` + điều hướng `link`.
Chuông ở Topbar: icon + badge số chưa đọc (ẩn khi 0) → link màn này; `TODO(OQ: Notification-BRD.md §20 Q5)`. Topbar ở
~375px: chuông không đẩy vỡ hàng (`min-w-0`/`shrink-0` — gotcha `ARCHITECTURE.md` §6).

### 8.3. Nhật ký thao tác (R3) — `/platform/audit` (gate `AUDIT.VIEW`)

Bộ lọc (`AL` §9.1), bảng phân trang 25 dòng (thời điểm, người + vai trò/`SYSTEM`, module, hành động (nhãn), đối tượng,
tóm tắt, severity), sheet chi tiết: Old/New dạng bảng khoá–giá trị đã che, correlation → "Xem thao tác liên quan" (lọc theo
`correlationId`, chỉ hiện khi có), nút "Hiện đầy đủ" (chỉ vai trò được xem đầy đủ), nút "Xuất CSV" (gate `AUDIT.EXPORT`,
dùng `shared/lib/csv.ts` sẵn có). Banner nhỏ: "Nhật ký chỉ ghi thêm, không sửa/xoá (AL-BR-01)". Không có nút sửa/xoá ở bất
kỳ đâu.

### 8.4. Vai trò & quyền (R4) — `/platform/permissions` (gate `SYSTEM_ADMIN.VIEW`)

Bảng nhóm theo resource; dòng = action; 6 cột vai trò (✓ / ✗ / `TBD` nổi màu `status-pending` / "—" chưa khai); cột nguồn
(tooltip hoặc dòng phụ ở màn hẹp); bộ lọc resource + công tắc "Chỉ dòng có `TBD`"; tổng số ô `TBD`; chú thích "`TBD` =
chưa quyết định, không phải cấm — hệ thống tạm coi như chưa cấp" + "`SALES` Phase 1 ≈ `MANAGER` (CR-2026-035)". **Chỉ
đọc** — `TODO(OQ: SystemAdministration-BRD.md §19 Q10)`.

### 8.5. Cấu hình hệ thống (R4) — `/platform/system-config` (xem: `SYSTEM_ADMIN.VIEW`, sửa: `SYSTEM_ADMIN.CONFIG`)

Form thông tin công ty (`react-hook-form` + `zod`, `auth/model.ts`); múi giờ + tiền tệ chỉ đọc; ghi chú `SA-BR-11` ("không
ảnh hưởng hợp đồng/biên lai đã sinh; bản demo: hợp đồng chưa đọc cấu hình này — `TODO`"); thẻ **Dữ liệu demo**: đồng hồ
dung lượng (`measureAppStorage()` — tổng ký tự, % so 2,6 triệu giả định WebKit, top 5 key) + nút "Reset dữ liệu demo" (gọi
`resetDemoData()` như Topbar).

### 8.6. Route & menu

`app/routes.tsx`: thay 5 `ComingSoon` (dashboard R1, notifications R2, audit R3, system-config + permissions R4);
`<AppShell topbarSlot={<NotificationBell />} />` (R2). `nav.tsx` không đổi `resource/action` (đã đúng); R4 chuyển nhãn sang
`vi.ts`.

---

## 9. Seed & ngân sách dung lượng `localStorage`

### 9.1. Số đo & phương án (đo bằng `phase6/sizes.mjs`, harness `FIXED_NOW` 22/10/2026)

| Hạng mục | Hiện tại | Sau Phase 6 (dự kiến) | Phương án |
| --- | ---: | ---: | --- |
| Seed (sau `seedAll`) | 1.822.111 | **≤ 1.840.000** | Giữ trần **1,85 triệu** (không nới, không giảm `DEMO_SCALE`). |
| — Tín hiệu / cảnh báo Dashboard (R1) | 0 | **0** | Sinh động, không lưu (D4). |
| — `notifications` (R2) | — | **0 ở seed** | Bước seed chỉ xoá key; sự kiện sinh lúc chạy. |
| — Nhật ký mẫu `audit` (R3) | 0 | **≤ 17.000** | 50 bản ghi gọn, **không** `before`/`after` (mẫu 50 bản ghi đo được **15.831** ký tự ≈ 317/bản ghi). |
| — `systemConfig` (R4) | — | **≤ 800** | Một object. |
| Lúc chạy: `notifications` | — | ~19–24 nghìn sau lần đồng bộ đầu (35–45 sự kiện × ~540 ký tự — mẫu 40 sự kiện đo được 21.491) | Trần `NOTIFICATIONS_MAX_CHARS = 80.000` (~150 sự kiện), cắt theo `pruneToBudget`. |
| Lúc chạy: `audit` | 0 → tối đa 500 bản ghi (không giới hạn ký tự — một bản ghi `before/after` Settlement ~1,6 nghìn) | ≤ **400.000** | Trần `AUDIT_MAX_CHARS = 400.000` thay trần 500 bản ghi (D8). |
| Lúc chạy: dữ liệu nghiệp vụ tạo thêm khi demo | — | ~100.000 dự phòng | — |

**Tổng xấu nhất** = 1,85 tr (seed) + 0,40 tr (audit) + 0,08 tr (thông báo) + 0,10 tr (thao tác) = **2,43 triệu ký tự** ≈ 93%
quota WebKit giả định (~2,6 tr, `DEMO-DATA-PLAN.md` D13) · ≈ 47% Chrome/Firefox (~5,2 tr). Khoản 0,75 triệu "dành cho thao tác
demo" của 5.1 nay được **chia và thực thi**: 0,40 audit + 0,08 thông báo + 0,10 nghiệp vụ + ~0,17 dư. Nếu trình duyệt vẫn báo
đầy: `writeJson` trả `false` → audit/thông báo tự cắt 20% bản ghi cũ nhất rồi ghi lại một lần (D8); người trình bày thấy dung
lượng ở Cấu hình hệ thống (R4) và bấm Reset.

**Phương án dự phòng (không dùng nếu đo đạt):** nếu seed vượt 1,85 tr sau R3/R4 → giảm số bản ghi nhật ký mẫu (tối thiểu 30)
trước; **không** đụng `DEMO_SCALE` (sẽ làm lệch các số đã chốt ở 5.1).

### 9.2. Seed

| Round | Bước seed | Vị trí trong `registerSeeds.ts` | Nội dung |
| --- | --- | --- | --- |
| R2 | `notifications/seed.ts` | Sau `finance` | `writeJson('notifications', [])` — không sinh dữ liệu giả (sự kiện suy ra từ dữ liệu thật ở lần đồng bộ đầu). Không bump `SEED_VERSION` (chưa có cấu trúc nào đổi; key mới mặc định rỗng). |
| R1 | `vehicles/seed.ts` (sửa) | giữ nguyên | 3 trường `status` → `RENTED` (`veh_001`/`veh_010`/`veh_017`). Không thêm ký tự đáng kể (+12 ký tự). `SEED_VERSION` 23 → **24**. |
| R3 | `audit/seed.ts` | **Cuối cùng** | `seedAuditRecords(...)`: ~50 bản ghi trong 7 ngày gần nhất, tham chiếu **id thật** đọc từ storage qua barrel (lượt `rt_016…rt_023`, giao dịch/quyết toán gần nhất, sự cố, hợp đồng ký gửi, xe, khách); actor là 6 tài khoản demo + vài bản ghi `SYSTEM`; có `module`/`severity`; 2 chuỗi có chung `correlationId` (vd. hoàn tất quyết toán → xác nhận giao dịch → hoàn tất lượt) để demo "Xem thao tác liên quan"; vài bản ghi `LOGIN`/`LOGOUT`. **Không** `before`/`after`. `SEED_VERSION` 24 → **25**. |
| R4 | `auth/seed.ts` | **Đầu tiên** (không phụ thuộc) | `systemConfig` với tên công ty = `COMPANY_NAME` hiện có, các trường khác placeholder rõ ràng ("[Địa chỉ công ty]"…). `SEED_VERSION` 25 → **26**. |

Seed nhật ký mẫu là **dữ liệu giả lập demo** (ghi rõ trong comment + summary không bịa số tiền khác dữ liệu thật). Không gọi
`appendAudit` trong seed (tiền lệ).

---

## 10. Nợ cũ — quyết định gộp

| # | Nợ | Gộp vào | Lý do |
| --- | --- | --- | --- |
| 1 | **Phân trang danh sách dài** (lượt thuê 323, giao dịch 904, quyết toán 299, lịch chi trả 145, khách 57) — `DEMO-DATA-PLAN.md` §6/§10 | **R3 tạo component** `shared/ui/pagination.tsx` (màn Nhật ký cần trước) · **R4 áp dụng** cho 5 màn | Cùng một component; áp cho các màn trong SCC chỉ thêm import `shared/ui` (không thêm cạnh feature). Phân trang **phía client** (dữ liệu vẫn tải đủ — vấn đề là chi phí render), 25 dòng/trang, về trang 1 khi đổi bộ lọc; tổng/đếm của màn vẫn tính trên toàn bộ dữ liệu đã lọc. Có thể tách thành task độc lập làm trước nếu người dùng muốn (§16 câu 5). |
| 2 | **`ConsignmentAuditTab` tải thừa** (`useOwnerPayoutRecords(undefined)` + `useConsignmentHandoverRecords(undefined)` khi không có `contractId`) — `CONSIGNMENT-PLAN.md` §18/§20 | **R3** | Cùng chủ đề nhật ký. Sửa: thêm tham số `options?: { enabled?: boolean }` cho 2 hook (mặc định `true` — không đổi caller khác), tab truyền `enabled: !!contractId`. Không đổi import graph. |
| 3 | Đăng xuất không ghi audit | R3 | `SA-BR-08`. |
| 4 | `AUDIT.VIEW` sai tài liệu | R3 | §7. |
| 5 | Enum `NOTIFICATION_EVENT_TYPES` sai tài liệu | R1 | D10. |
| 6 | Chuỗi UI hardcode (`nav.tsx`, `routes.tsx`, ~11 JSX, 2 toast) | R4 | Mục backlog Phase 6. Chuỗi lỗi trong `api.ts` các feature cũ **không** gộp (không phải chuỗi component). |
| — | SCC 96–98 file · `VC-BR-03/04` · `createdAt` tương lai của `rt_001…rt_029` · biên lai `BL-` lịch sử (N2) | **Không gộp** | Theo chỉ đạo / cần sửa bản ghi cũ. |

---

## 11. Open Question — giả định tạm + `TODO(OQ)` (không tự chốt)

| # | Câu hỏi (nguồn) | Giả định tạm ở Phase 6 | `TODO(OQ: …)` đặt tại |
| --- | --- | --- | --- |
| Q1 | Ai soạn Template; Manager có sửa không (`NT` §20 Q3, §14) | Template cố định trong `vi.ts`, `templateVersion = 1`, không có màn soạn | `notifications/model.ts` `renderTemplate` |
| Q2 | `SALES` = ✗ ở `NT` §14 (báo cáo/huỷ/template) mâu thuẫn CR-2026-035 (`SALES` ≈ `MANAGER`) | Giữ đúng chữ `NT` §14 (✗); báo BA | `permissions.ts` 4 entry `NOTIFICATION` |
| Q3 | Ngưỡng nhắc cho nhóm sự kiện ngoài giấy tờ xe (`NT` §20 Q4) | Dùng hằng của module nguồn: 24h (giao/nhận), 500 km (bảo dưỡng), −30/−3 ngày (ký gửi) | Từng collector |
| Q4 | Có badge số chưa đọc toàn Webapp không (`NT` §20 Q5) | Có — chuông ở Topbar | `NotificationBell` |
| Q5 | Phạm vi người nhận (`NT` §20 Q6) + vai trò nhận từng loại (`NT` §6.2) | Chỉ nội bộ; bảng định tuyến BA đề xuất §4.2 | `RECIPIENT_ROUTING` |
| Q6 | Ngưỡng `VEHICLE_OVERUSE` (`NT` §20 Q7) | Không phát; Dashboard hiện "chờ chốt" | `collect…`/Dashboard nhóm `VEHICLE_OVERUSE` |
| Q7 | Danh sách trường nhạy cảm & quy tắc che (`AL` §22 Q4, `WebappQuanTri.md` §17.3 #3) | Theo bảng `AL` §11 (CCCD/hộ chiếu/GPLX, SĐT, số tài khoản) | `audit/model.ts` hằng `SENSITIVE_FIELDS` |
| Q8 | Meta-audit khi **xem/tìm** nhật ký có bắt buộc từng lần không (`AL-BR-06`, §22 Q1) | Ghi một lần mỗi lần mở màn + mỗi lần xuất + mỗi lần "Hiện đầy đủ" — không ghi mỗi lần đổi bộ lọc (tránh phình nhật ký) | `audit/api.ts` |
| Q9 | Accountant "giới hạn tài chính" gồm những module nào; Accountant có xuất không (`AL` §16, §22 Q11) | `SETTLEMENT`/`PAYMENT`/`REVENUE_COST` + `OwnerPayoutRecord`; xuất = `TBD` (không thấy nút) | `audit/model.ts` `scopeForRole`; `permissions.ts` |
| Q10 | Retention (`AL` §22 Q6) | Trần ký tự 400k là giới hạn kỹ thuật của bản demo (không phải chính sách) | `shared/lib/audit.ts` |
| Q11 | Trường thông tin công ty; nhiều pháp nhân; tuỳ chỉnh ma trận quyền (`SA` §19 Q8/Q9/Q10) | Trường theo `SA` §10; một pháp nhân; ma trận chỉ đọc | `auth/model.ts`, `PermissionMatrixScreen` |
| Q12 | Ranh giới `RENTAL_UPCOMING` vs `HANDOVER_UPCOMING`, `EMPLOYEE_ASSIGNMENT` vs `TASK_ASSIGNMENT` (`NT` §7 trùng ý) | Chỉ phát `HANDOVER_UPCOMING`/`RETURN_UPCOMING` và `EMPLOYEE_ASSIGNMENT`; không phát `RENTAL_UPCOMING`/`TASK_ASSIGNMENT` | `rentals/model.ts`, `employees/model.ts` |
| Q13 | "Quá hạn trả" và "sự cố chưa xử lý" chưa có mã Event riêng (`NT` §7 khuyến khích đặt mã riêng khi lặp lại) | Dùng `OPERATION_ALERT_OTHER` + `payload.kind`; đề xuất BA mã `RETURN_OVERDUE`/`INCIDENT_UNRESOLVED`. "Chưa xử lý" = mọi trạng thái trừ 4 trạng thái kết thúc | `rentals/model.ts`, `incidents/model.ts` |
| Q14 | "Hợp đồng thiếu bản ký" (`WebappQuanTri.md` §5.3, `RV` §17.3) nghĩa là gì | Hợp đồng `GENERATED` chưa `SIGNED` của lượt còn hiệu lực | `contracts/model.ts` |
| Q15 | Cửa sổ "sắp đến hạn" (`RentalCalendar-BRD.md` §21, câu hỏi 16) | 24 giờ (khớp Bảng điều phối) | `rentals/model.ts` `UPCOMING_WINDOW_HOURS` |
| Q16 | Hạn thanh toán để tính "Payment quá hạn" (`Payment-BRD.md` §27 Q9) | Không tính quá hạn; cảnh báo "chưa thu đủ theo mốc" (`PAYMENT_INCOMPLETE`) | `finance/payment/model.ts` |
| Q17 | Tiêu chí "xe hiệu quả thấp" + kỳ của top xe (`RV` §17.1, §28 Q14) | 5 xe lợi nhuận vận hành thấp nhất 30 ngày qua | `revenue-cost/model.ts` |
| Q18 | Người nhận nhắc ký gửi (CR-2026-051: "Phase 1 gửi Admin") — Accountant có nhận nhắc chi trả không (AC-NT-009 lấy Accountant làm ví dụ) | Hợp đồng sắp hết hạn → Admin; chi trả → Admin + Accountant | `RECIPIENT_ROUTING` |
| Q19 | Cột `DISPATCHER` không có trong `NT` §14 / `AL` §16 | `TBD` | `permissions.ts` |
| Q20 | `DISPATCHER` không có quyền `RENTAL.VIEW` (`WebappQuanTri.md` §9.4 không có cột Dispatcher — `permissions.ts` chép đúng) → bị loại khỏi người nhận `HANDOVER_UPCOMING`/`RETURN_UPCOMING`/quá hạn trả và không thấy 3 nhóm cảnh báo lượt thuê trên Dashboard, dù là vai trò điều phối (phát hiện ở review R1) | Giữ nguyên quyền (không cấp ngầm); `recipientRolesFor` tự loại vai trò thiếu `VIEW` | BA bổ sung cột Dispatcher cho `RM` §39 / `WebappQuanTri.md` §9.4 |

Tất cả Q1–Q19 cần BA đưa vào danh sách Open Question của module tương ứng nếu chưa có (đặc biệt Q2, Q12, Q13, Q14, Q18 là
**điểm tài liệu chưa nhất quán** phát hiện khi lập plan — không tự sửa tài liệu).

---

## 12. Definition of Done

### 12.1. Chung mọi round

1. `npx tsc -b` · `npx oxlint` · `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. **SCC không đổi:** `node <scratchpad>/consignment-r3/sccfiles.mjs /home/user/tbc-webapp-prototype-demo | diff - <scratchpad>/consignment-r3/scc-target.txt`
   → rỗng. `node <scratchpad>/tl-verify/evalorder.mjs /home/user/tbc-webapp-prototype-demo /src/app/routes.tsx` → `OK`.
3. Không import sâu chéo feature trong file **mới**; barrel chỉ thêm đúng danh sách §5.3.
4. Chunk chính ≤ **1.830 kB** sau mỗi round (baseline 1.788,69 kB) và ≤ **1.900 kB** cuối Phase 6; `recharts` không nằm trong
   chunk chính.
5. Mọi chuỗi UI mới ở `vi.ts`; mọi enum mới khớp tài liệu; mọi `create/update` mới gọi `appendAudit`; không dùng `localStorage`
   trực tiếp.
6. `phase6/sizes.mjs` → seed ≤ **1.850.000** ký tự (dán số vào báo cáo bàn giao). `demo-data/verify.mjs` → `errors: 0`,
   chạy với snapshot `phase6/before-r1.json` (= `demo-data/before.json` + 3 xe `RENTED` — thay đổi duy nhất được phép trên
   bản ghi cũ ở Phase 6).

### 12.2. Round 1

- 8 collector thuần, không gọi `new Date()`/`Math.random` bên trong; `dedupeKey` ổn định.
- Harness (dev viết vào scratchpad, `FIXED_NOW` 22/10/2026): số tín hiệu theo nhóm khớp bảng §0.1 (±0 cho giấy tờ, bảo
  dưỡng, hợp đồng, ký gửi; giao/nhận theo cửa sổ 24h), `listOperationalSignals` thuần tính ≤ **50 ms**.
- Kiểm định tuyến: mọi vai trò trong `RECIPIENT_ROUTING` có `VIEW` trên `resource` của tín hiệu (assert trong harness).
- Dashboard: KPI vận hành khớp hàm thuần; KPI tài chính tháng 10/2026 & 09/2026 khớp `metrics.mjs` của 5.1 (doanh thu
  231.150.000 / 268.900.000; LN vận hành +76.570.000 / +122.920.000) **hoặc** giải thích lệch do mốc giờ; vai trò không có
  `FINANCE_REPORT.VIEW` không thấy widget tài chính; `SEED_VERSION` = 24 và chỉ 3 trường `status` xe đổi.

### 12.3. Round 2

- Lần đồng bộ đầu tạo 35–45 sự kiện; gọi lại ngay → tạo 0 (khử trùng); làm một tín hiệu biến mất (vd. sửa ngày hết hạn
  giấy tờ trong harness) → đúng 1 sự kiện `CANCELLED`, không xoá.
- Inbox mỗi vai trò chỉ thấy sự kiện của mình (`NT-BR-12`); `markRead` giảm số chuông; `markAllRead` đưa về 0.
- Kích thước key `notifications` sau đồng bộ đầu ≤ 30.000; `pruneToBudget` giữ ≤ 80.000 với 300 sự kiện giả trong harness.
- `writeJson` trả `false` khi `setItem` ném lỗi (harness giả `QuotaExceededError`) và mọi caller cũ vẫn biên dịch.
- `shared/layout` không import `features/notifications` (grep).

### 12.4. Round 3

- Bản ghi audit cũ (không `module`) hiển thị đúng module suy ra; 25 entity đều có ánh xạ.
- `ACCOUNTANT` chỉ thấy bản ghi phạm vi tài chính; `OPERATION_STAFF` không thấy menu; `SALES` thấy và xuất được.
- "Hiện đầy đủ" ghi đúng 1 bản ghi `VIEW_AUDIT_SENSITIVE_VALUE` (`SENSITIVE`); xuất CSV ghi đúng 1 bản ghi `EXPORT`
  (`module = AUDIT`), file có dòng tiêu chí lọc + người xuất + số bản ghi.
- Trần: ghi 2.000 bản ghi lớn trong harness → key `audit` ≤ 400.000 ký tự, bản ghi mới nhất còn.
- Seed nhật ký mẫu: 45–55 bản ghi, ≤ 17.000 ký tự, mọi `entityId` tồn tại trong storage, `SEED_VERSION` = 25.
- `ConsignmentAuditTab` không gọi API khoản chi trả/biên bản khi không có `contractId` (đọc code + đếm lời gọi trong harness).

### 12.5. Round 4

- Màn "Vai trò & quyền" hiện **đủ** entry của `listPermissionMatrix()` và đếm đúng số ô `TBD`.
- Lưu cấu hình ghi `CONFIG_CHANGE` có `before`/`after`; người không có `SYSTEM_ADMIN.CONFIG` thấy form chỉ đọc.
- 5 màn danh sách có phân trang; số tổng/đếm của màn không đổi so với trước khi phân trang.
- `grep` lại các chuỗi hardcode ở §0.1 → 0 (trừ comment); `README.md` viết lại (cách chạy, reset dữ liệu demo, thêm feature
  theo pattern, lệnh 3 cổng).
- Checklist responsive (đọc code): mọi bảng mới nằm trong `overflow-x-auto`; hàng `flex` có text dài có `min-w-0` +
  `truncate`; lưới KPI `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; Topbar với chuông không tràn ở 375px (tính tổng bề rộng
  phần tử cố định ≤ 375px).
- `SEED_VERSION` = 26; seed ≤ 1.850.000.

---

## 13. File dự kiến tạo / sửa

| Round | Tạo mới | Sửa |
| --- | --- | --- |
| R1 | `shared/domain/alerts.ts` · `features/notifications/{model,api,hooks,index}.ts` · `features/dashboard/{model.ts,index.ts,screens/DashboardScreen.tsx,components/OperationalKpiCards.tsx,components/AlertPanel.tsx}` · `features/finance/revenue-cost/components/DashboardFinanceWidget.tsx` | `shared/domain/enums.ts` · `shared/i18n/vi.ts` · `features/{vehicles,maintenance,rentals,contracts,incidents,employees,consignment}/model.ts` (+ `consignment/payoutModel.ts` nếu cần) · `features/finance/payment/model.ts` · `features/finance/revenue-cost/model.ts` · 8 barrel `index.ts` (§5.3) · `features/vehicles/seed.ts` · `shared/fixtures/seedAll.ts` · `app/routes.tsx` |
| R2 | `features/notifications/{seed.ts,screens/NotificationCenterScreen.tsx,components/NotificationBell.tsx,components/NotificationCard.tsx}` | `shared/lib/storage.ts` · `shared/layout/{AppShell,Topbar}.tsx` · `features/notifications/{model,api,hooks,index}.ts` · `shared/domain/{enums,permissions}.ts` · `shared/i18n/vi.ts` · `shared/fixtures/registerSeeds.ts` · `app/routes.tsx` |
| R3 | `features/audit/{model,api,hooks,seed,index}.ts` · `features/audit/screens/AuditLogScreen.tsx` · `features/audit/components/{AuditFilterBar,AuditRecordDetailSheet}.tsx` · `shared/ui/pagination.tsx` | `shared/lib/audit.ts` · `shared/domain/{enums,permissions}.ts` · `shared/i18n/vi.ts` · `features/auth/store.ts` · `features/consignment/{hooks.ts,components/ConsignmentAuditTab.tsx}` · `shared/fixtures/{registerSeeds,seedAll}.ts` · `app/routes.tsx` |
| R4 | `features/auth/{api,hooks,seed}.ts` · `features/auth/screens/{SystemConfigScreen,PermissionMatrixScreen}.tsx` | `features/auth/{model,index}.ts` · `shared/layout/nav.tsx` · `app/routes.tsx` · `shared/i18n/vi.ts` · 5 màn danh sách (§10 mục 1) · các file có chuỗi hardcode (§0.1) · `shared/fixtures/{registerSeeds,seedAll}.ts` · `README.md` · màn Chi tiết nhân viên (`features/employees`, file chốt khi giao R4) |

Docs (`tech-lead` cập nhật khi bàn giao từng round): file này, `docs/IMPLEMENTATION-PLAN.md`, `CHANGELOG.md`; R1 thêm
`docs/ARCHITECTURE.md` §2 (mô tả `dashboard`/`notifications` + mô hình quét) và §5 (slot Topbar) sau khi được duyệt.

---

## 14. Danh sách file `dev` đọc trước khi code (đọc đúng danh sách, không scan rộng)

### 14.1. Round 1

1. File này (toàn bộ) + `CONVENTIONS.md` §2–§4, §6, §8, §10, §11 + `docs/ARCHITECTURE.md` §1–§3, §6.
2. `../thien-bao-car-docs/WebappQuanTri.md` §5.3 · `modules/Notification-BRD.md` §6.1, §7, §9, §13 · `modules/RevenueCost-BRD.md`
   §17 · `modules/RentalCalendar-BRD.md` §21.
3. `src/shared/domain/enums.ts` dòng 420–440 · `src/shared/domain/permissions.ts` dòng 1–80, 420–445, 520–575.
4. `src/shared/lib/documentStatus.ts` · `src/features/vehicles/model.ts` dòng 1–110 · `src/features/maintenance/model.ts` dòng
   80–140 · `src/features/rentals/model.ts` (type `Rental` + hằng trạng thái) · `src/features/calendar/model.ts` dòng 45–65 ·
   `src/features/calendar/screens/DispatchBoardScreen.tsx` dòng 75–115 (đối chiếu cửa sổ 24h) · `src/features/contracts/model.ts`
   (type `Contract`) · `src/features/incidents/model.ts` (type `Incident`) · `src/features/employees/model.ts` dòng 1–60 (type
   `Employee`/`Assignment`) · `src/features/consignment/model.ts` dòng 225–240, 350–365 · `src/features/consignment/payoutModel.ts`
   dòng 555–575.
5. `src/features/finance/payment/model.ts` dòng 210–335 (`buildPaymentSchedule`, `deriveRentalPaymentSummary`), 563–600
   (`deriveCustomerBalances`) · `src/features/finance/revenue-cost/model.ts` dòng 150–265, 536–680 ·
   `src/features/finance/revenue-cost/components/FinanceKpiCards.tsx` · `src/features/finance/revenue-cost/screens/FinanceReportScreen.tsx`
   dòng 95–140 (mẫu ghép hook) · `src/features/finance/core/storage.ts`.
6. 8 barrel: `src/features/{vehicles,maintenance,rentals,contracts,incidents,employees,consignment,finance}/index.ts`.
7. `src/app/routes.tsx` · `src/shared/layout/PageHeader.tsx` · `src/shared/i18n/vi.ts` (chỉ khối `nav` dòng 100–120 + một khối
   feature mẫu để bám cấu trúc).

### 14.2. Round 2 (bổ sung)

`modules/Notification-BRD.md` §6.4–§6.5, §10, §14–§16 · `src/shared/lib/storage.ts` · `src/shared/lib/audit.ts` ·
`src/shared/layout/{AppShell,Topbar}.tsx` · `src/shared/fixtures/{registerSeeds,seedAll}.ts` · `src/features/auth/{store,usePermission}.ts`.

### 14.3. Round 3 (bổ sung)

`modules/AuditLog-BRD.md` §6–§11, §15–§16 · `src/shared/lib/{audit,csv}.ts` · `src/features/vehicles/components/VehicleAuditTab.tsx`
(mẫu hiển thị) · `src/features/consignment/hooks.ts` dòng 60–90, 215–230 · `src/features/consignment/components/ConsignmentAuditTab.tsx` ·
`src/features/auth/store.ts` · `src/shared/ui/table.tsx` · một `seed.ts` mẫu đọc storage qua barrel:
`src/features/finance/revenue-cost/seed.ts` dòng 1–70.

### 14.4. Round 4 (bổ sung)

`modules/SystemAdministration-BRD.md` §6.3, §9–§10, §12–§13 · `src/features/auth/{model,index}.ts` ·
`src/shared/fixtures/resetDemoData.ts` · `src/shared/layout/{nav.tsx,Topbar.tsx}` · 5 màn danh sách ở §10 mục 1 (chỉ phần
render bảng).

---

## 15. Thứ tự làm đề xuất (Round 1)

1. Enum (D10) + `shared/domain/alerts.ts` + khung `vi.ts` (nhãn Event Type, nhóm cảnh báo, ưu tiên, Template v1).
2. 8 collector + export barrel (§5.3) → chạy `sccfiles.mjs` ngay sau bước này.
3. `notifications/{model,api,hooks,index}` + harness đếm tín hiệu.
4. `buildDashboardFinanceSummary` + `DashboardFinanceWidget` (đối chiếu số 5.1).
5. `dashboard/*` + route; 3 cổng + SCC + evalorder + kích thước chunk.

Brief giao việc R1 đầy đủ: **§18**. Brief R2: **§19**. Round 3–4: `tech-lead` viết mục chi tiết giao việc (§21+ — chèn trước mục Lịch sử) khi round trước `DONE`, theo khuôn `REVENUE-COST-PLAN.md` §19/§20.

---

## 16. Quyết định của người dùng — **đã chốt 23/10/2026** (chấp nhận cả 7 đề xuất của `tech-lead`)

| # | Câu hỏi | Quyết định |
| --- | --- | --- |
| 1 | 7 ngoại lệ kiến trúc E1–E7 (§2.2) | **Duyệt cả 7.** |
| 2 | Sửa `AUDIT.VIEW` theo `AuditLog-BRD.md` §16 + CR-2026-035/037 (`SALES`/`ACCOUNTANT` thấy thêm menu Nhật ký) | **Đồng ý** — làm ở **R3** như plan. |
| 3 | Bảng định tuyến người nhận (§4.2, Q5/Q18) | **Dùng làm giả định tạm** (giữ `TODO(OQ)`). |
| 4 | Lệch `Vehicle Status` seed (3 xe đang có lượt `HANDED_OVER`/`IN_RENTAL` vẫn `AVAILABLE`) | **Sửa, chuyển lên R1.** Mức sửa do `tech-lead` quyết: chỉ sửa **3 trường `status` trong `vehicles/seed.ts`** (`VH-BR-10` — trạng thái App nhân viên sẽ tạo ra khi giao xe xong); **không** thêm cơ chế đồng bộ lúc chạy vì Webapp không có thao tác hoàn tất giao/nhận (thuộc App — `CLAUDE.md` §3). Bump `SEED_VERSION` 23 → 24. Chi tiết §18.2 mục 9. |
| 5 | Vị trí phân trang | **Giữ R3 (component) + R4 (áp dụng).** |
| 6 | Màn Chi tiết nhân viên `/employees/:id` | **Đưa vào R4.** |
| 7 | Thứ tự round | **R1 Dashboard làm trước.** |

## 17. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Thêm export barrel làm nở SCC | Danh sách cố định §5.3 + `reach.mjs` đã kiểm + DoD `sccfiles.mjs` = target. |
| Đồng bộ thông báo chạy mỗi lần mở chuông → chậm | Collector thuần, lọc lượt đã kết thúc trước; DoD ≤ 50 ms; chuông `refetchInterval` 60 giây. |
| `localStorage` đầy khi demo dài | Trần ký tự cho audit/thông báo + `writeJson` báo thất bại + đồng hồ dung lượng + nút Reset. |
| Số KPI tài chính Dashboard lệch Báo cáo tài chính | Dùng đúng hàm `RV` + cùng preset kỳ; DoD đối chiếu số 5.1. |
| Seed tương đối "hôm nay" → số tín hiệu khác khi demo ngày khác | DoD đo ở `FIXED_NOW`; UI có trạng thái rỗng từng nhóm. |
| Tài liệu NT/AL đổi sau (chốt OQ) | Mọi giả định tập trung ở hằng/bảng có `TODO(OQ)` (§11) — sửa một chỗ. |

---

## 18. Round 1 — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

### 18.1. Bối cảnh

Dashboard (`/dashboard`) là trang mặc định sau đăng nhập (`WebappQuanTri.md` §5.1, CR-2026-032) nhưng đang là `ComingSoon`.
R1 dựng Dashboard thật, **chỉ đọc**, tính từ dữ liệu đã seed: KPI vận hành, KPI tài chính, bảng cảnh báo. Cảnh báo được định
nghĩa **một lần** dưới dạng "tín hiệu" (`OperationalSignal`) ở chính module nguồn (ngưỡng thuộc module nguồn — `NT-BR-02`),
gom ở `features/notifications` (hub — `NT-BR-01`); R2 sẽ chốt các tín hiệu này thành thông báo có lưu. R1 **không lưu gì mới**
ngoài 3 trường `status` xe.

### 18.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §18.6)

1. **`shared/domain/enums.ts`** — thay khối `NOTIFICATION_EVENT_TYPES` bằng đúng 18 mã §3.1 (thứ tự tài liệu), comment:
   `// Notification-BRD.md §7 — sửa scaffold Phase 0 cho khớp tài liệu (mảng chưa được dùng — DASHBOARD-PLATFORM-PLAN.md D10).`
   Nối cuối file (mỗi khối comment nguồn): `NOTIFICATION_PRIORITIES`, `NOTIFICATION_SOURCE_MODULES`, `DASHBOARD_ALERT_GROUPS`
   (§3.1). Không đụng `NOTIFICATION_DELIVERY_STATUSES`.
2. **`shared/domain/alerts.ts`** (mới) — `interface OperationalSignal` đúng §3.1 + `function signalDedupeKey(...)`. Chỉ import
   từ `./enums` và `./permissions` (type).
3. **Collector ở module nguồn** — 8 hàm thuần đúng bảng §4.1, đặt ở `model.ts` của feature (finance: `payment/model.ts`;
   consignment: đặt ở **`payoutModel.ts`** — file này đã import `./model` nên dùng được cả `isExpiringSoon` lẫn
   `isPayoutDueSoon`/`isPayoutOverdue`; không thêm import `model.ts` → `payoutModel.ts`). Chữ ký:
   ```text
   collectVehicleDocumentSignals(vehicles: Vehicle[], now: Date): OperationalSignal[]
   collectMaintenanceDueSignals(vehicles: Vehicle[], rules: MaintenanceRule[], records: MaintenanceRecord[]): OperationalSignal[]
   collectRentalTimeSignals(rentals: Rental[], vehicles: Vehicle[], now: Date): OperationalSignal[]
   collectContractSignals(contracts: Contract[], rentals: Rental[]): OperationalSignal[]
   collectPaymentSignals(rentals: Rental[], requests: PaymentRequest[], txns: Transaction[], settlements: Settlement[]): OperationalSignal[]
   collectIncidentSignals(incidents: Incident[], vehicles: Vehicle[]): OperationalSignal[]
   collectAssignmentSignals(assignments: Assignment[], employees: Employee[], rentals: Rental[], now: Date): OperationalSignal[]
   collectConsignmentSignals(contracts: ConsignmentContract[], payoutRecords: OwnerPayoutRecord[], todayKey: string): OperationalSignal[]
   ```
   - Nhận `Vehicle[]` để dựng nhãn "Xe <biển số>" — **chỉ `import type`** từ feature khác nếu model đó chưa import (type import
     không tạo cạnh runtime). Không import runtime barrel feature khác trong collector.
   - Hằng mới: `UPCOMING_WINDOW_HOURS = 24` (`rentals/model.ts`, `TODO(OQ: RentalCalendar-BRD.md §21 — câu hỏi 16)`, comment
     đối chiếu `DispatchBoardScreen`); tập trạng thái kết thúc sự cố (`incidents/model.ts`, `TODO(OQ)` Q13).
   - `link`: `paths.vehicleDetail(id)`, `paths.rentalDetail(id)` (+ `?tab=…` **chỉ** vì `RentalDetailScreen` đã đọc `tab` —
     không sửa màn đích nào), `paths.contractDetail`, `paths.incidentDetail`, `paths.consignmentContractDetail`,
     `paths.consignmentPayouts`, `paths.maintenance`.
   - `resource` của tín hiệu: giấy tờ xe → `VEHICLE` (resource `VEHICLE_DOCUMENT` chưa có entry `VIEW` trong `permissions.ts`) · bảo dưỡng `MAINTENANCE` · giao/nhận/quá hạn `RENTAL` ·
     hợp đồng `CONTRACT` · thanh toán `PAYMENT` · sự cố `INCIDENT` · phân công `ASSIGNMENT` · ký gửi `CONSIGNMENT`.
   - Nhãn/biến Template: chỉ đưa **dữ liệu** vào `payload` (biển số, số ngày còn lại, số tiền…); câu chữ hiển thị lấy ở `vi.ts`.
4. **Export barrel** — đúng bảng §5.3 (cột R1), mỗi dòng comment `// DASHBOARD-PLATFORM-PLAN.md §5.3`. Sau bước này chạy
   ngay `sccfiles.mjs` (§18.5 lệnh 4). Cần export khác → **dừng, báo `tech-lead`**.
5. **`features/notifications`** — `model.ts` (`RECIPIENT_ROUTING` §4.2 — khai trước cho R2, có `TODO(OQ: Notification-BRD.md
   §6.2/§20 Q3, Q6)`; `groupSignalsForDashboard`), `api.ts` (`listOperationalSignals()` bọc `fakeRequest`: đọc storage qua key
   export ở barrel, `now = new Date()` một lần, gọi 8 collector, **không ghi**), `hooks.ts` (`useOperationalSignals()`, query key
   `['notifications','signals']`), `index.ts` (export `useOperationalSignals`, `groupSignalsForDashboard`, type
   `OperationalSignal`). Không `screens/`, không `seed.ts` ở R1.
6. **`features/finance`** — `buildDashboardFinanceSummary(input)` trong `revenue-cost/model.ts` (§4.4; nhận `today: Date` làm
   tham số) + `revenue-cost/components/DashboardFinanceWidget.tsx` (ghép hook theo mẫu `FinanceReportScreen.tsx` dòng 95–140,
   tái dùng `FinanceKpiCards` nếu vừa, thanh CSS 30 ngày — **không** import `recharts`/`FinanceTrendChart*`), export qua barrel
   `@/features/finance`. Widget tự gate `FINANCE_REPORT.VIEW` (trả `null` nếu không có quyền).
7. **`features/dashboard`** — `model.ts` (`buildOperationalKpis` §4.3), `components/OperationalKpiCards.tsx`,
   `components/AlertPanel.tsx`, `screens/DashboardScreen.tsx` (§8.1), `index.ts` (export `DashboardScreen`). Chỉ import:
   `@/features/notifications`, `@/features/finance`, `@/features/vehicles`, `@/features/rentals`, `@/features/auth`, `@/app/paths`,
   `@/shared/*`. Nút "Xem tất cả" ở bảng cảnh báo **ẩn** ở R1 (Inbox là R2).
8. **`app/routes.tsx`** — `/dashboard` mount `DashboardScreen` (bỏ `ComingSoon` của dòng này, giữ các dòng `ComingSoon` khác).
9. **Đồng bộ `Vehicle Status` seed** (quyết định §16 câu 4) — `features/vehicles/seed.ts`: `veh_001`, `veh_010`, `veh_017`
   `status: 'AVAILABLE'` → `'RENTED'`, comment 1 dòng mỗi chỗ: `// VH-BR-10 — đang có lượt <rt_xxx> HANDED_OVER/IN_RENTAL (DASHBOARD-PLATFORM-PLAN.md §16 câu 4)`
   (`veh_010`↔`rt_016`, `veh_001`↔`rt_017`, `veh_017`↔`rt_019`). **Không** đổi trường nào khác, **không** thêm/bớt lời gọi
   `Math.random` (thứ tự sinh id cũ phải giữ). `shared/fixtures/seedAll.ts`: `SEED_VERSION` 23 → **24**. Không thêm logic đồng
   bộ lúc chạy (roadmap: khi Webapp có thao tác huỷ giao/nhận làm đổi trạng thái lượt — `cancelHandover`/`cancelReturn` — cần
   rà `VH-BR-10`/`VR-BR-11` cho `Vehicle Status`; ngoài R1).
10. **`shared/i18n/vi.ts`** — khối `vi.dashboard` (tiêu đề, mô tả, nhãn KPI, nhãn nhóm cảnh báo, trạng thái rỗng, "chờ chốt"
    cho `VEHICLE_OVERUSE`), `vi.notifications` (khung: nhãn ưu tiên + `templates.<EventType>` `{ title, body }` có `{{biến}}` cho
    các Event Type R1 phát), `NOTIFICATION_EVENT_TYPE_LABELS: Record<NotificationEventType, string>` (đủ 18),
    `NOTIFICATION_PRIORITY_LABELS`; widget tài chính dùng/ thêm khoá trong `vi.finance`.

### 18.3. Ngoài phạm vi R1 (không làm dù "tiện tay")

Lưu thông báo, Inbox, chuông, `topbarSlot`, `writeJson` trả `boolean`, `measureAppStorage` (R2) · mọi sửa `shared/lib/audit.ts`,
`permissions.ts` (`AUDIT`/`NOTIFICATION`), `AUDIT_ACTIONS` (R3) · màn `/platform/*` (R2–R4) · phân trang (R3/R4) · refactor
`DispatchBoardScreen` hoặc bất kỳ screen/component nào nằm trong SCC · sửa màn đích để hỗ trợ `?tab=` · thêm query param lọc cho
màn danh sách · đụng `rentals/seed.ts`, `finance/**/seed.ts`, `consignment/seed.ts` · sửa `docs/` (việc của `tech-lead`) ·
commit/push.

### 18.4. Quy tắc bắt buộc

1. Không file nào trong 8 feature nguồn import `@/features/notifications` hoặc `@/features/dashboard`; `notifications` không
   import `dashboard`; `shared/**` không import feature mới.
2. Collector **thuần**: không `new Date()`/`Date.now()`/`Math.random`/`readJson` bên trong; cùng input → cùng output, cùng
   `dedupeKey`.
3. Ngưỡng nằm ở module nguồn, tái dùng hàm/hằng có sẵn (`documentExpiryStatus`, `maintenanceDueStatus`, `isExpiringSoon`,
   `isPayoutDueSoon`, `isPayoutOverdue`, `buildPaymentSchedule`) — **không** viết lại công thức.
4. Comment mã tài liệu 1 dòng tại hằng/logic (`CR-2026-046`, `VC-BR-19/20`, `PM-BR-22`, `VH-BR-10`, `RV-BR-09`, `CR-2026-048`…);
   mọi giả định §11 liên quan R1 (Q3, Q5, Q6, Q12–Q18) có `TODO(OQ: …)` đúng chỗ ghi ở §11.
5. Mọi số trên Dashboard do hàm thuần tính; component chỉ hiển thị. Quyền qua `usePermission()`/`can()`, không `role === …`.
6. Màu/khoảng cách bằng token theme; thanh biểu đồ dùng `bg-primary`; bảng trong `overflow-x-auto`; lưới KPI
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`; text dài trong hàng flex có `min-w-0` + `truncate`.
7. Không `console.log`, không `any`, không TS `enum`, không `*/` kẹt trong comment.

### 18.5. Definition of Done R1 — chạy đủ và dán kết quả vào báo cáo

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

1. `npx tsc -b` · `npx oxlint` · `npm run build` — sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` — rỗng.
3. Chunk chính `dist/assets/index-*.js` ≤ **1.830 kB** (baseline 1.788,69 kB); không có `recharts` trong chunk chính (chunk
   `FinanceTrendChart-*` vẫn tách riêng).
4. `node $SP/consignment-r3/sccfiles.mjs $REPO | diff - $SP/consignment-r3/scc-target.txt` → **rỗng** (SCC vẫn 98 file, không file
   nào của `dashboard`/`notifications`).
5. `node $SP/tl-verify/evalorder.mjs $REPO /src/app/routes.tsx` → `OK`.
6. `TZ=Asia/Ho_Chi_Minh node $SP/phase6/sizes.mjs $REPO` → `TOTAL` ≤ **1.850.000** (dự kiến 1.822.1xx).
7. `TZ=Asia/Ho_Chi_Minh node $SP/demo-data/verify.mjs $REPO $SP/phase6/before-r1.json` → `errors: 0` (snapshot này = snapshot 5.1
   + đúng 3 xe `RENTED`; mọi thay đổi khác trên bản ghi cũ sẽ báo lỗi).
8. Harness R1 (`dev` tự viết `$SP/phase6/signals-r1.mjs`, dùng `boot()` của `$SP/demo-data/lib.mjs`, `FIXED_NOW` 22/10/2026 10:00
   +07; tham khảo `$SP/phase6/signals.mjs` + `$SP/phase6/expect-r1.mjs`): gọi `listOperationalSignals` logic (gọi trực tiếp 8
   collector với dữ liệu từ store + `new Date(FIXED_NOW)`) và in số tín hiệu theo `eventType`/`group`. Kỳ vọng:
   - `VEHICLE_INSPECTION_EXPIRING` 1 · `VEHICLE_INSURANCE_EXPIRING` 1 (đã hết hạn, `HIGH`) · `MAINTENANCE_DUE` 3 (2 `HIGH`).
   - `HANDOVER_UPCOMING` 5 (`rt_006`, `rt_007`, `rt_012`, `rt_014`, `rt_015`) · `RETURN_UPCOMING` 0 · quá hạn trả 0.
   - `CONTRACT_INCOMPLETE` 1 (`ct_001` / `rt_012`) · sự cố chưa xử lý 7 · `EMPLOYEE_ASSIGNMENT` 4 (`asg_001…asg_004`).
   - `CONSIGNMENT_CONTRACT_EXPIRING` 1 · `CONSIGNMENT_PAYMENT_DUE` 3 (quá hạn, `URGENT`) · `PAYMENT_INCOMPLETE` — **báo số đo
     được** + danh sách `rentalId` + mốc, giải thích từng lượt.
   - Gọi 2 lần → cùng tập `dedupeKey`. Thời gian tính thuần (không gồm `fakeRequest`) ≤ **50 ms**.
   - Assert: mọi vai trò trong `RECIPIENT_ROUTING[eventType]` của các Event Type đã phát có `can(role, resource, 'VIEW') === true`;
     in vai trò nào bị loại (nếu có) — **không** sửa `permissions.ts` để cho qua.
9. KPI vận hành (cùng harness): tổng xe 18 · `AVAILABLE` 12 · `RENTED` 4 · `MAINTENANCE` 1 · `INACTIVE` 1 · lượt giao hôm nay 5
   (`rt_006`, `rt_007`, `rt_014`, `rt_017`, `rt_019` — theo ngày địa phương, gồm cả lượt đã giao trong ngày; nếu `dev` cho rằng
   nên chỉ đếm lượt **chưa** giao thì báo lại, không tự đổi) · lượt nhận hôm nay 0 · lượt đang diễn ra 4.
10. KPI tài chính (cùng harness, gọi `buildDashboardFinanceSummary` với `today = new Date(FIXED_NOW)`): tháng 10/2026 doanh thu
    **231.150.000**, LN vận hành **+76.570.000**; tháng 09/2026 **268.900.000** / **+122.920.000** (số 5.1 — `DEMO-DATA-PLAN.md`
    §10). Lệch → giải thích (vd. mốc giờ), không chỉnh số.
11. `git status` chỉ gồm file thuộc §13 dòng R1; không file `docs/`.

**Không yêu cầu** test trình duyệt (quyết định 14/09/2026) — người dùng tự kiểm.

### 18.6. Thứ tự làm

1. Mục 1–2 (enum + `alerts.ts`) → `npx tsc -b`.
2. Mục 3–4 (collector + barrel) → **DoD 4 + 5 ngay**.
3. Mục 9 (seed xe + `SEED_VERSION`) → DoD 6 + 7.
4. Mục 5 (`notifications`) + harness DoD 8.
5. Mục 6 (`finance` widget) + DoD 10.
6. Mục 7–8, 10 (Dashboard + route + i18n) + DoD 9.
7. Chạy lại toàn bộ DoD 1–11.

### 18.7. File `dev` đọc trước (đúng danh sách — không scan rộng `src/` hay `../thien-bao-car-docs/modules/`)

Danh sách §14.1 (mục 1–7) **cộng**: `src/features/vehicles/seed.ts` dòng 70–420 (chỉ để định vị 3 dòng `status`) ·
`src/shared/fixtures/seedAll.ts` · `src/app/paths.ts` · `src/features/rentals/screens/RentalDetailScreen.tsx` dòng 35–50 (cách đọc
`?tab=`) · `$SP/demo-data/lib.mjs` + `$SP/phase6/{signals,expect-r1,sizes}.mjs` (mẫu harness). Đọc thêm ngoài danh sách chỉ khi
thiếu thông tin thật sự — ghi lý do trong báo cáo.

### 18.8. Báo cáo bàn giao `dev` phải có

Danh sách file đổi (khớp `git status`) · output rút gọn DoD 1–10 (kích thước chunk, diff SCC rỗng, `evalorder`, `TOTAL` dung lượng,
`verify.mjs`, bảng số tín hiệu + `PAYMENT_INCOMPLETE` chi tiết, KPI vận hành, KPI tài chính) · mọi chỗ lệch plan + lý do · các
`TODO(OQ)` đã đặt (file:dòng).

---

### 18.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` tự chạy lại DoD: 3 cổng sạch (`oxlint` chỉ còn 2 cảnh báo cũ ở `shared/ui/badge.tsx`/`button.tsx`, không phát sinh
mới) · không `*/` kẹt · chunk chính **1.810,71 kB** (≤ 1.830), `recharts` không vào chunk chính, `DashboardFinanceWidget` chunk
lười 5,66 kB · `sccfiles.mjs` = `scc-target.txt` (98 file) · `evalorder` OK · seed **1.822.102** ký tự · `verify.mjs` với
`before-r1.json` → `errors: 0` · `signals-r1.mjs` (gọi thật `collectAllSignals`/`buildOperationalKpis`/`buildDashboardFinanceSummary`
của app) khớp `expect-r1.mjs`: **30 tín hiệu** (giấy tờ 2, bảo dưỡng 3, sắp giao 5, hợp đồng chưa ký 1, chưa thu đủ 4 — mốc
`BOOKING` của `rt_007` (có giao dịch `PENDING`)/`rt_009`/`rt_010`/`rt_011`, sự cố 7, phân công 4, ký gửi 4), tính 9–14 ms, `dedupeKey`
ổn định; KPI vận hành 18/12/4/1/1, giao hôm nay 5, nhận 0, đang thuê 4; KPI tài chính 10/2026 231.150.000 / +76.570.000, 09/2026
268.900.000 / +122.920.000 (khớp 5.1); công nợ phải thu 775.000.

**Phán quyết 10 chỗ lệch (chấp nhận cả 10):**

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | Widget export qua `lazyWidgets.ts` (`React.lazy`) | **Chấp nhận** — import tĩnh làm nở SCC; cùng tiền lệ `lazyScreens.ts`, giảm chunk chính. §5.3 đã sửa. |
| L2 | `OperationalSignal.group` tuỳ chọn | **Chấp nhận** — `EMPLOYEE_ASSIGNMENT` chỉ dành cho Inbox (R2). §3.1 đã sửa. |
| L3 | Barrel `notifications` export thêm `renderTemplate`, `DashboardAlertGroupView` | **Chấp nhận** — `AlertPanel` cần dựng nội dung từ Template; chiều `dashboard → notifications` giữ nguyên. §5.1 đã sửa. |
| L4 | Bảo dưỡng không có `dueRef` | **Chấp nhận** — ngưỡng theo km, không theo ngày; `dedupeKey` gồm `category:nextDueKm`. |
| L5 | Bảo dưỡng bỏ xe `INACTIVE` | **Chấp nhận** — nhất quán với tín hiệu giấy tờ. |
| L6 | Thanh toán bỏ lượt có Settlement `COMPLETED` và lượt `DRAFT` | **Chấp nhận** — `DRAFT` chưa xác nhận nên chưa có mốc thu; Settlement đã chốt thuộc công nợ (đã ở thẻ "Công nợ phải thu"). |
| L7 | Phân công bỏ lượt thiếu/`CANCELLED`/`NO_SHOW` | **Chấp nhận** — không nhắc việc cho lượt không còn hiệu lực. |
| L8 | "Đang thuê" chỉ `HANDED_OVER`/`IN_RENTAL` (khác widget `DispatchBoardScreen`) | **Chấp nhận** — đúng §4.1; có comment đối chiếu. Lệch của `DispatchBoardScreen` để nguyên (ngoài phạm vi). |
| L9 | Tín hiệu ký gửi dùng `contractNo`/`code` | **Chấp nhận** — đối tượng nguồn là hợp đồng/khoản chi trả, không phải xe. |
| L10 | Nút "Làm mới" gọi `invalidateQueries()` toàn bộ | **Chấp nhận** — Dashboard tổng hợp từ ~13 query của nhiều feature; chi phí chấp nhận được ở bản demo. |

**Nợ ghi nhận (không chặn):**

- **N1 —** `DashboardFinanceWidget.tsx` deep-import `@/features/customers/hooks` và `@/features/vehicles/hooks` (theo tiền lệ
  `FinanceReportScreen`/`CustomerReceivablesScreen`, có comment). Gom khi gỡ SCC (việc cần người dùng duyệt riêng).
- **N2 —** Collector ở `model.ts` import `@/app/paths` (hằng thuần, không tạo vòng) và đưa chuỗi đã định dạng (ngày, nhãn loại
  giấy tờ/mốc) vào `payload` — chấp nhận vì R2 chụp nội dung lúc tạo (`NT-BR-09`); nếu sau này cần đa ngôn ngữ thì chuyển định dạng
  sang `renderTemplate`.
- **N3 —** `DISPATCHER` thiếu `RENTAL.VIEW` → Open Question §11 Q20 cho BA (không tự sửa quyền).
- **N4 —** Thao tác huỷ giao/nhận trên Webapp (`cancelHandover`/`cancelReturn`) đổi trạng thái lượt mà không đổi `Vehicle Status`
  (`VH-BR-10`/`VR-BR-11`) — roadmap, ngoài Phase 6 trừ khi người dùng yêu cầu.

---

## 19. Round 2 — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

### 19.1. Bối cảnh

R1 đã có danh sách tín hiệu cảnh báo tính động (`collectAllSignals`, 30 tín hiệu trên seed ở `FIXED_NOW`) và bảng định tuyến người
nhận (`recipientRolesFor`). R2 biến các tín hiệu đó thành **Notification Event có lưu** (`Notification-BRD.md` §6, kênh duy nhất
`IN_APP_WEBAPP` — NT-BR-07): khử trùng theo `dedupeKey` (EX-02), tự `CANCELLED` khi tín hiệu biến mất (AC-NT-008, NT-BR-14 — không
xoá), chụp tiêu đề/nội dung lúc tạo theo Template v1 (NT-BR-09, AC-NT-007). Người dùng xem ở **Trung tâm thông báo**
(`/platform/notifications` — `NT` §10, UC-NT-05/06), có **chuông + số chưa đọc** trên Topbar (giả định §11 Q4), Dashboard có lại
nút "Xem tất cả". Mô hình quét (E3): đồng bộ chạy mỗi lần đọc danh sách thông báo; không module nguồn nào gọi vào `notifications`.

### 19.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §19.6)

1. **`shared/lib/storage.ts`** — `writeJson(name, value): boolean` (`true` khi `setItem` thành công, `false` khi ném lỗi — vẫn
   không ném ra ngoài). Không sửa caller cũ (65 lời gọi bỏ qua giá trị trả về vẫn biên dịch). Thêm
   `measureAppStorage(): { totalChars: number; keys: { name: string; chars: number }[] }` (tính `key.length + value.length` cho
   các key namespace `tbc_admin:*`, sắp giảm dần) — R2 chỉ dùng trong harness/không cần UI; R4 hiển thị.
2. **`shared/domain/enums.ts`** — nối **cuối** `AUDIT_ACTIONS` (khối comment `// Notification (NT) — DASHBOARD-PLATFORM-PLAN.md §6`):
   `'SYNC_NOTIFICATIONS'`, `'VIEW_SENSITIVE_NOTIFICATION'`.
3. **`shared/domain/permissions.ts`** — đúng bảng §7 dòng R2: sửa `source` của `NOTIFICATION.VIEW`; thêm `NOTIFICATION.CONFIG`,
   `NOTIFICATION.EDIT`, `NOTIFICATION.VOID`, `NOTIFICATION.EXPORT` (giữ `'TBD'` đúng ô; `SALES` = `false` theo chữ `NT` §14 kèm
   `TODO(OQ)` Q2; `DISPATCHER` = `'TBD'` kèm ghi chú Q19). **Không** dùng `likeManager()` cho 4 entry này. Không sửa entry khác.
4. **`features/notifications/model.ts`** (nối tiếp R1):
   - `interface NotificationEvent` đúng §3.2 (`deliveryStatus: 'SENT' | 'CANCELLED'` — lấy từ `NotificationDeliveryStatus`,
     `channel: 'IN_APP_WEBAPP'`, `templateVersion: number` = `vi.notifications.templateVersion`, `readBy: Record<string, string>`).
   - `isRecipient(event, user: { userId; role })` — `recipientRoles.includes(role) || recipientUserIds.includes(userId)` (NT-BR-12;
     EX-03: theo vai trò **hiện tại**). Người nhận trực tiếp (`recipientUserIds`) **không** lọc theo quyền `VIEW` của vai trò (đúng
     NT-BR-12 — vd. `OPERATION_STAFF` nhận phân công của chính mình dù `ASSIGNMENT.VIEW` = `TBD`); người nhận theo vai trò đã được
     `recipientRolesFor` lọc từ R1.
   - `planSync(existing: NotificationEvent[], signals: OperationalSignal[], now: Date): { toCreate: NewNotificationEvent[]; toCancelIds: string[] }`
     — **thuần, không sinh id** (`NewNotificationEvent` = `Omit<NotificationEvent, 'id'>`). Quy tắc: event "đang hiệu lực" =
     `deliveryStatus === 'SENT'`; tín hiệu có `dedupeKey` chưa có event đang hiệu lực → tạo (kể cả khi trước đó đã có event
     `CANCELLED` cùng key — tạo bản mới, giữ bản cũ); event đang hiệu lực mà `dedupeKey` không còn trong `signals` → huỷ. Tạo:
     `title`/`body` = `renderTemplate(...)`, `recipientRoles` = `recipientRolesFor(signal)`, `recipientUserIds` = `signal.recipientUserIds ?? []`,
     `triggerAt` = `now.toISOString()`, `readBy` = `{}`, sao chép `eventType/sourceModule/entityType/entityId/entityLabel/priority/dueRef/link/resource/dedupeKey`
     (`group` **không** lưu — Dashboard vẫn đọc tín hiệu R1). Tín hiệu không có người nhận nào → bỏ qua (không tạo event mồ côi).
   - `pruneToBudget(events, maxChars): NotificationEvent[]` — thuần; nếu `JSON.stringify(events).length > maxChars` bỏ lần lượt:
     (1) `CANCELLED`, cũ nhất theo `cancelledAt` trước; (2) event đang hiệu lực đã có ít nhất một người đọc (`readBy` khác rỗng),
     cũ nhất theo `triggerAt` trước; (3) mọi event còn lại, cũ nhất theo `triggerAt` trước — dừng khi ≤ `maxChars`. Hằng
     `NOTIFICATIONS_MAX_CHARS = 80_000` (§9.1) — comment: giới hạn kỹ thuật bản demo, không phải chính sách lưu trữ (NT-BR-14).
   - `filterNotifications(events, filter)` — thuần; `filter`: `tab: 'ACTIVE' | 'CANCELLED'`, `eventType?`, `priority?`,
     `readState?: 'ALL' | 'UNREAD' | 'READ'` (theo `userId`), `sourceModule?`, `from?`/`to?` (`yyyy-MM-dd`, so ngày địa phương của
     `triggerAt`) — `NT` §10. Sắp: chưa đọc trước → ưu tiên (URGENT→LOW) → `triggerAt` mới trước.
   - `isSensitiveNotification(event)` — `eventType` ∈ { `PAYMENT_INCOMPLETE`, `CONSIGNMENT_PAYMENT_DUE` } (AC-NT-009, §5.1).
   - `countUnread(events, user)` — event đang hiệu lực, `isRecipient`, chưa có `readBy[userId]`.
5. **`features/notifications/api.ts`** (nối tiếp R1 — `listOperationalSignals()` giữ nguyên):
   - `export const NOTIFICATIONS_STORAGE_KEY = 'notifications'`.
   - `export function syncNotifications(now: Date): { created: number; cancelled: number }` — **đồng bộ, không bọc `fakeRequest`**
     (export ở `api.ts` để harness gọi; **không** export qua barrel): đọc event + `collectAllSignals(readSources(), now)` → `planSync` →
     gán `id = generateId('NT')` → set `CANCELLED` + `cancelledAt` → `pruneToBudget` → `writeJson`; nếu `writeJson` trả `false`: cắt
     thêm 20% số event theo thứ tự ưu tiên bỏ của `pruneToBudget` rồi ghi lại **một lần** (D8). Nếu `created + cancelled > 0` →
     **một** `appendAudit` `SYNC_NOTIFICATIONS`, `entity: 'NotificationEvent'`, `entityId: 'batch'`, `summary` từ `vi`
     ("Hệ thống tạo N, huỷ M thông báo"), actor hằng `SYSTEM_ACTOR` (`actorUserId: 'system'`, `actorName: vi.notifications.systemActor`,
     `actorRole: 'SYSTEM'`) — `TODO(Phase 6 R3)`: chuyển sang `actorType: 'SYSTEM'` khi `AuditRecord` có trường này.
   - `listMyNotifications(user, filter)` → `fakeRequest`: `syncNotifications(new Date())` rồi `filterNotifications(events.filter(isRecipient))`.
   - `getUnreadCount(user)` → `fakeRequest`: sync rồi `countUnread`.
   - `markNotificationRead(id, user)` → chỉ ghi khi `isRecipient` và chưa đọc: `readBy[userId] = now`; nếu `isSensitiveNotification`
     → `appendAudit` `VIEW_SENSITIVE_NOTIFICATION` (entity `NotificationEvent`, actor = user) — **chỉ lần đọc đầu** (mở lại không ghi).
   - `markAllNotificationsRead(user)` → đánh dấu mọi event đang hiệu lực mà user là người nhận và chưa đọc; **không** ghi audit cho
     từng event nhạy cảm (đánh dấu hàng loạt ≠ mở chi tiết — AC-NT-009); trả số event đã đánh dấu.
   - Cả 2 hàm đánh dấu: không tồn tại / không phải người nhận → ném `Error` (chuỗi trong `vi`).
6. **`features/notifications/hooks.ts`** — `useMyNotifications(filter)`, `useUnreadNotificationCount()` (`refetchInterval: 60_000`,
   `refetchOnWindowFocus: true`), `useMarkNotificationRead()`, `useMarkAllNotificationsRead()`; user lấy từ `useSessionStore` của
   `@/features/auth`. Query key gốc `['notifications', …]`; mutation thành công → `invalidateQueries({ queryKey: ['notifications'] })`.
7. **`features/notifications/components/`** — `NotificationBell.tsx` (icon `Bell`, badge số chưa đọc — ẩn khi 0, hiển thị `99+`
   khi > 99, `Link` tới `paths.platformNotifications`, `aria-label`/`title` từ `vi`, `shrink-0`; comment
   `TODO(OQ: Notification-BRD.md §20 Q5)`), `NotificationCard.tsx` (tiêu đề, nội dung, nhãn đối tượng, thời điểm `formatRelative` +
   tooltip `formatDateTime`, badge ưu tiên dùng lại bảng màu `AlertPanel`, chấm chưa đọc; bấm → `markRead` rồi `navigate(event.link)`).
8. **`features/notifications/screens/NotificationCenterScreen.tsx`** — §8.2: `PageHeader` (tiêu đề, mô tả, nút "Đánh dấu tất cả đã
   đọc" — vô hiệu khi 0 chưa đọc), `Tabs` "Đang hiệu lực" / "Đã hết hiệu lực", bộ lọc 5 tiêu chí (Select loại sự kiện = nhãn
   `NOTIFICATION_EVENT_TYPE_LABELS`, mức ưu tiên, đã đọc, module nguồn, khoảng ngày bằng 2 `Input type="date"`), danh sách thẻ, trạng
   thái rỗng theo tab. Event `CANCELLED` hiển thị mờ, không chấm chưa đọc, vẫn bấm mở được (không đánh dấu đọc). Không phân trang ở R2
   (~30 sự kiện; phân trang là R3/R4).
9. **`features/notifications/seed.ts`** — `registerSeedStep(() => writeJson(NOTIFICATIONS_STORAGE_KEY, []))` + comment lý do (§9.2: không
   sinh dữ liệu giả; tránh sự kiện trỏ id cũ sau reseed). `shared/fixtures/registerSeeds.ts`: `import '@/features/notifications/seed'`
   **sau** `finance` (cuối danh sách hiện tại) + 1 dòng ghi chú. **Không** bump `SEED_VERSION` (vẫn 24).
10. **`features/notifications/index.ts`** — thêm `NotificationCenterScreen`, `NotificationBell` (và type `NotificationEvent`). Không export
    `syncNotifications`/`planSync`.
11. **`shared/layout/AppShell.tsx` + `Topbar.tsx`** (E4) — `AppShell({ topbarSlot }: { topbarSlot?: ReactNode })` truyền xuống
    `<Topbar topbarSlot={topbarSlot} …>`; Topbar render `topbarSlot` là phần tử **đầu tiên** trong nhóm `ml-auto` (trước nút Reset).
    Không import gì mới từ `features/`.
12. **`app/routes.tsx`** — `<Route element={<AppShell topbarSlot={<NotificationBell />} />}>`; `/platform/notifications` mount
    `NotificationCenterScreen` (bỏ `ComingSoon` dòng này, giữ 3 `ComingSoon` `/platform/*` còn lại + `/employees/:id`).
13. **`features/dashboard/components/AlertPanel.tsx`** — bật lại "Xem tất cả" (link `paths.platformNotifications`, hiện ở mọi nhóm có
    ≥ 1 tín hiệu; nhãn trong `vi.dashboard`), bỏ comment "ẩn ở Round 1".
14. **`shared/i18n/vi.ts`** — `vi.notifications`: tiêu đề/mô tả màn, nhãn tab, bộ lọc, nút, trạng thái rỗng, `systemActor`,
    `syncAuditSummary`, lỗi; `NOTIFICATION_SOURCE_MODULE_LABELS` (8 mã); `vi.dashboard.alertViewAll`.

### 19.3. Ngoài phạm vi R2 (không làm dù "tiện tay")

Template editor / cấu hình ngưỡng / báo cáo gửi / huỷ thủ công (UI dùng 4 entry quyền mới) · kênh khác `IN_APP_WEBAPP` ·
`measureAppStorage` trên UI (R4) · mọi sửa `shared/lib/audit.ts`, `AuditRecord`, `AUDIT.VIEW`, màn Nhật ký (R3) · phân trang (R3/R4) ·
sửa toast hardcode `Đã chuyển sang vai trò…` trong `Topbar.tsx` (R4 — chỉ thêm slot) · cho module nguồn gọi `notifications` · sửa
collector/ngưỡng R1 (nếu thấy sai → báo `tech-lead`) · thêm query param lọc cho Inbox từ Dashboard · sửa `docs/` · commit/push.

### 19.4. Quy tắc bắt buộc

1. Không file `shared/**` nào import `@/features/notifications`; module nguồn không import `notifications`/`dashboard`;
   `notifications` không import `dashboard`. `app/routes.tsx` là nơi duy nhất ghép chuông vào layout.
2. `planSync`, `pruneToBudget`, `filterNotifications`, `countUnread`, `isRecipient` thuần (không `new Date()`/`Math.random`/`readJson`
   bên trong); id và thời điểm do `api.ts` cấp.
3. Không xoá vật lý event trừ `pruneToBudget` (giới hạn kỹ thuật — comment NT-BR-14); không sửa `title`/`body` của event đã tạo
   (NT-BR-09); không có trạng thái nào ngoài `SENT`/`CANCELLED` được ghi.
4. Mọi lời gọi `localStorage` qua `storage.ts`; mọi ghi trạng thái nghiệp vụ có audit theo §6 (đánh dấu đọc thường **không** audit —
   chỉ ca nhạy cảm, AC-NT-009).
5. Comment mã tài liệu 1 dòng tại chỗ (`NT-BR-07/09/12/13/14`, EX-02, EX-03, AC-NT-004/008/009); giả định Q1/Q4/Q5 có `TODO(OQ)`.
6. Chuỗi UI ở `vi.ts`; token theme; chuông không làm Topbar tràn ở ~375px (`shrink-0`, badge `absolute` trên icon, không thêm chữ ở
   màn hẹp); bộ lọc dùng lưới `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`.
7. Không `console.log`, `any`, TS `enum`, `*/` kẹt trong comment.

### 19.5. Definition of Done R2 — chạy đủ và dán kết quả vào báo cáo

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

1. `npx tsc -b` · `npx oxlint` (không cảnh báo mới ngoài 2 cảnh báo cũ ở `shared/ui/badge.tsx`/`button.tsx`) · `npm run build` — sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` — rỗng. `grep -rn "features/notifications" src/shared` — chỉ còn dòng import seed ở `shared/fixtures/registerSeeds.ts` (mục 9 bắt buộc; sửa mâu thuẫn — §19.9 L2).
3. Chunk chính ≤ **1.830 kB** (sau R1: 1.810,71 kB); `recharts` không vào chunk chính. Nếu vượt: tải lười
   `NotificationCenterScreen` theo mẫu `finance/revenue-cost/screens/lazyScreens.ts` (chuông giữ tĩnh) — ghi vào báo cáo.
4. `node $SP/consignment-r3/sccfiles.mjs $REPO | diff - $SP/consignment-r3/scc-target.txt` → rỗng. `node $SP/tl-verify/evalorder.mjs $REPO /src/app/routes.tsx` → `OK`.
5. `TZ=Asia/Ho_Chi_Minh node $SP/phase6/sizes.mjs $REPO` → `TOTAL` ≤ 1.850.000 (dự kiến 1.822.1xx + key `notifications` rỗng `[]`).
   `TZ=Asia/Ho_Chi_Minh node $SP/demo-data/verify.mjs $REPO $SP/phase6/before-r2.json` → `errors: 0` (`before-r2.json` do `tech-lead`
   dựng sẵn = `before-r1.json` + `"tbc_admin:notifications": []` — thay đổi duy nhất được phép trên seed ở R2).
6. Harness `$SP/phase6/notif-r2.mjs` (`dev` tự viết; `boot()` của `$SP/demo-data/lib.mjs`, `FIXED_NOW` 22/10/2026 10:00 +07; tham
   khảo `$SP/phase6/expect-r2.mjs`), gọi **code thật** (`syncNotifications`, `planSync`, `pruneToBudget`, `countUnread`, `isRecipient`,
   các hàm `markNotificationRead`/`markAllNotificationsRead` — có thể gọi phần thân đồng bộ nếu tách hàm nội bộ, hoặc `await` bản
   `fakeRequest`). Kỳ vọng:
   - Sync lần 1: `created 30`, `cancelled 0`; key `notifications` ≤ **30.000** ký tự (báo số thật); audit +1 bản ghi `SYNC_NOTIFICATIONS`.
   - Sync lần 2 ngay sau: `0/0`, audit không tăng.
   - Số chưa đọc theo user (khớp `expect-r2.mjs`): `usr_admin` **10** · `usr_manager` **23** · `usr_dispatcher` **4** · `usr_sales` **22** ·
     `usr_accountant` **7** · `usr_staff` **2** (phân công `asg_001`/`asg_003`).
   - Đổi `expiryDate` giấy tờ đăng kiểm sắp hết hạn (xe `51A-234.56`) thành +2 năm trong store → sync: `0/1`, event cũ `CANCELLED` có
     `cancelledAt`, vẫn còn trong store; khôi phục ngày cũ → sync: `1/0`, event mới id khác, tổng 31 event (30 `SENT` + 1 `CANCELLED`).
   - `markAllNotificationsRead(usr_manager)` → manager 0, `usr_sales` vẫn 22 (đọc theo từng user — AC-NT-004).
   - `usr_accountant` đọc một event `PAYMENT_INCOMPLETE` → +1 audit `VIEW_SENSITIVE_NOTIFICATION`; đọc lại cùng event → không thêm;
     `markNotificationRead` của `usr_staff` lên event không phải của mình → ném lỗi.
   - `pruneToBudget` với 300 event giả (kết hợp `CANCELLED`/đã đọc/chưa đọc) → ≤ 80.000 ký tự, event `CANCELLED` bị bỏ trước, 20 event
     chưa đọc mới nhất còn nguyên.
   - Giả lập `setItem` ném lỗi cho key `tbc_admin:notifications` → `writeJson` trả `false`, `syncNotifications` không ném, thử ghi lại đúng 1 lần.
   - Thời gian `syncNotifications` (store đã có 30 event) ≤ **50 ms**.
7. Kiểm tĩnh quyền (cùng harness): `can('SYSTEM_ADMIN','NOTIFICATION',x)` = `true` với `CONFIG/EDIT/VOID/EXPORT`; `MANAGER` → `false`
   (`TBD`) cho `EDIT/VOID/EXPORT`, `false` (đã chốt) cho `CONFIG`; `permissionValue('MANAGER','NOTIFICATION','EDIT') === 'TBD'`.
8. `git status` chỉ gồm file thuộc §19.2; không file `docs/`.

**Không yêu cầu** test trình duyệt (quyết định 14/09/2026).

### 19.6. Thứ tự làm

1. Mục 1–3 (`storage.ts`, enum audit, quyền) → `npx tsc -b`.
2. Mục 4 (hàm thuần) + phần harness kiểm `planSync`/`pruneToBudget`/`countUnread`.
3. Mục 5–6 (`api.ts`, hooks) + harness DoD 6.
4. Mục 9 (seed) → DoD 5.
5. Mục 7–8, 10–14 (UI, slot, route, Dashboard, i18n) → DoD 1–4.
6. Chạy lại toàn bộ DoD 1–8.

### 19.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §3.2, §4.2, §5.1, §6, §7, §8.2, §9, §11 (Q1, Q2, Q4, Q5, Q19), §18.9, §19.
2. `../thien-bao-car-docs/modules/Notification-BRD.md` §6.4–§6.5, §10, §13–§16.
3. `CONVENTIONS.md` §3–§6, §8, §11 · `docs/ARCHITECTURE.md` §1, §3, §6.
4. Code R1: `src/features/notifications/{model,api,hooks,index}.ts`, `src/shared/domain/alerts.ts`,
   `src/features/dashboard/components/AlertPanel.tsx`, `src/shared/i18n/vi.ts` (khối `notifications` + `dashboard`).
5. Nền: `src/shared/lib/{storage,audit,id,fakeNetwork,datetime}.ts` · `src/shared/fixtures/{registerSeeds,seedAll}.ts` ·
   `src/shared/layout/{AppShell,Topbar,PageHeader}.tsx` · `src/features/auth/{index,store,usePermission,model}.ts` ·
   `src/shared/domain/permissions.ts` dòng 1–80, 520–575 · `src/shared/domain/enums.ts` khối `AUDIT_ACTIONS` + `NOTIFICATION_*`.
6. UI mẫu: `src/shared/ui/{tabs,select,badge,card,input}.tsx` · một màn có bộ lọc + `Select` để bám pattern:
   `src/features/finance/payment/screens/TransactionLedgerScreen.tsx` (chỉ phần bộ lọc) · `src/app/{routes,paths}.ts(x)`.
7. Harness: `$SP/demo-data/lib.mjs`, `$SP/phase6/{expect-r2,signals-r1,sizes}.mjs`.

### 19.8. Báo cáo bàn giao `dev` phải có

Danh sách file đổi (khớp `git status`) · output rút gọn DoD 1–7 (chunk chính, SCC, `evalorder`, `TOTAL`, `verify`, bảng số harness DoD 6
từng gạch, kích thước key `notifications`, thời gian sync) · mọi chỗ lệch plan + lý do · `TODO(OQ)` đã đặt (file:dòng).

---

### 19.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` tự chạy lại DoD: 3 cổng sạch (`oxlint` chỉ 2 cảnh báo cũ) · không `*/` kẹt · chunk chính **1.828,25 kB** (≤ 1.830 — dư 1,75 kB
→ quyết định D11) · `recharts` không vào chunk chính · `sccfiles.mjs` = `scc-target.txt` (98 file) · `evalorder` OK · seed **1.822.127** ký tự
(27 key, `notifications` = `[]`) · `verify.mjs` + `before-r2.json` → `errors: 0` · `notif-r2.mjs` (gọi code thật) **ALL PASS 52 kiểm**: sync
30/0 rồi 0/0, key `notifications` 18.665 ký tự, chưa đọc 10/23/4/22/7/2, huỷ/tạo lại → 31 event, đọc riêng theo user, audit nhạy cảm 1 lần,
chặn đọc hộ, prune 300 → 136 event (79.513 ký tự), ghi lỗi → thử ghi đúng 2 lần, sync 10,87 ms; quyền `NOTIFICATION` đúng §7. Đọc diff:
`shared/layout` không import `features/notifications`; `planSync`/`pruneToBudget`/`filterNotifications` thuần; không sửa `title/body` đã tạo.

**Phán quyết 7 chỗ lệch (chấp nhận cả 7):**

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | `NotificationCard` lặp bảng màu ưu tiên của `AlertPanel` (4 dòng) | **Chấp nhận** — `notifications` không được import `dashboard`. Nếu lặp lần 3 → chuyển bảng vào `notifications/model.ts` và `AlertPanel` dùng qua barrel. |
| L2 | `grep features/notifications src/shared` ra `registerSeeds.ts` | **Chấp nhận** — lỗi mâu thuẫn trong brief (§19.2 mục 9 bắt buộc import seed ở đó; `registerSeeds.ts` vốn là nơi import seed mọi feature). DoD 2 đã sửa. |
| L3 | Thêm `trimByRatio`, type `NotificationFilter`/`NotificationUser` | **Chấp nhận** — hiện thực bước "cắt 20%" (D8) thành hàm thuần dùng chung thứ tự bỏ. |
| L4 | `filterNotifications` nhận thêm `userId` | **Chấp nhận** — lọc "đã đọc/chưa đọc" và sắp "chưa đọc trước" cần biết người xem. |
| L5 | `markNotificationRead` không ném lỗi với event `CANCELLED` / đã đọc (bỏ qua êm) | **Chấp nhận** — mở lại thẻ cũ là thao tác hợp lệ; vẫn ném khi không phải người nhận/không tồn tại. |
| L6 | `seed.ts` import key từ `./api` | **Chấp nhận** — cùng feature; `registerSeeds` đã kéo barrel các feature khác qua seed `finance`, `evalorder` OK. |
| L7 | Số kỳ vọng chỉ đúng với `TZ=Asia/Ho_Chi_Minh` (không TZ: 28 tín hiệu) | **Chấp nhận — không phải lỗi collector.** Đối chiếu `dedupeKey` TZ=HCM vs UTC (`phase6/tzdiff.mjs`): khác biệt nằm ở **mốc thời gian do seed sinh ra** (seed đặt giờ theo giờ máy, vd. giao lúc 14:00 giờ địa phương), collector so mốc tuyệt đối (ms) đúng. Ghi nợ N8. |

**Kết luận múi giờ (yêu cầu điều phối viên, mục b):** collector R1/R2 **không** sai — so cửa sổ 24h bằng mốc tuyệt đối; ranh giới ngày
(`todayKey`, `documentExpiryStatus`, lọc ngày Inbox) dùng giờ trình duyệt, **giống toàn bộ app** (`shared/lib/datetime.ts`, seed). App đang ngầm giả
định "giờ trình duyệt = UTC+7" thay vì đọc múi giờ hệ thống (`SA-BR-14`) — nợ chung toàn app, không chặn R2.

**Nợ ghi nhận (không chặn):**

- **N5 —** `pruneToBudget` có thể bỏ event `SENT` chưa đọc khi > 80.000 ký tự → lần đồng bộ sau tín hiệu vẫn còn nên tạo lại (thêm 1 audit
  `SYNC_NOTIFICATIONS`). Chỉ xảy ra khi > ~150 sự kiện (seed hiện 30). Nếu gặp: bước (3) chỉ bỏ event có tín hiệu đã mất.
- **N6 —** Hai query chuông + Inbox mỗi lần đọc đều đồng bộ (đọc ~1,8 triệu ký tự JSON, ~11 ms) — chấp nhận ở demo.
- **N7 —** Bảng màu ưu tiên lặp 2 nơi (L1).
- **N8 —** Seed và ranh giới ngày phụ thuộc giờ trình duyệt; app chưa áp `SA-BR-14` (múi giờ hệ thống cố định UTC+7). Harness phải chạy với
  `TZ=Asia/Ho_Chi_Minh`. Đề xuất xử lý cùng màn Cấu hình hệ thống (R4) — chỉ hiển thị, sửa gốc là việc riêng cần duyệt.

---

## 20. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 23/10/2026 | **R2 `DONE`** — review `tech-lead` đạt vòng 1, không Blocker; chấp nhận 7 lệch L1–L7, nợ N5–N8 (§19.9); chốt D11 (tải lười màn `/platform/*` từ R3). |
| 23/10/2026 | R2 `APPROVED` (người dùng duyệt theo gợi ý `tech-lead`, gồm bật lại "Xem tất cả" ở Dashboard) — viết brief §19, **giao `dev`**. Dựng `phase6/expect-r2.mjs` (số chưa đọc kỳ vọng theo từng tài khoản demo) + `phase6/before-r2.json`. |
| 23/10/2026 | **R1 `DONE`** — review `tech-lead` đạt vòng 1, không Blocker; chấp nhận 10 lệch L1–L10, ghi nợ N1–N4 + OQ Q20 (§18.9). `SEED_VERSION` 24. |
| 23/10/2026 | Người dùng duyệt 7 điểm §16 → `APPROVED`; đồng bộ `Vehicle Status` seed chuyển lên R1 (`SEED_VERSION` R1 = 24, R3 = 25, R4 = 26); màn Chi tiết nhân viên vào R4. Viết brief R1 (§18), **giao `dev`**. Dựng `phase6/expect-r1.mjs` + `phase6/before-r1.json`. |
| 23/10/2026 | Tạo kế hoạch (`DRAFT — CHỜ NGƯỜI DÙNG DUYỆT`). Đo hiện trạng: dung lượng seed 1.822.111, SCC 98 file, chunk chính 1.788,69 kB, ~35–45 tín hiệu cảnh báo trên seed; dựng `phase6/{sizes,signals,reach}.mjs` ở scratchpad. |
