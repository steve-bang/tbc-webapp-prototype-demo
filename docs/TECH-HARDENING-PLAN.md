# Kế hoạch — Vòng kỹ thuật sau Phase 6: Route guard · N4 · N8 (múi giờ) · Gỡ vòng import (Phase 6.1)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** **`APPROVED`** (23/10/2026 — người dùng duyệt cả 6 điểm §10 theo đề xuất; các Round
chạy liên tục R1 → R2 → R3a → R3b, không dừng chờ duyệt giữa chừng) · **R1 — `DONE`** (23/10/2026, brief §11, review `tech-lead` đạt vòng 1, không Blocker — §11.9) · R2, R3a, R3b — chờ
(brief viết sau khi Round trước `DONE`) · R2b — tuỳ chọn, sau R3b.

Vòng này **không thêm tính năng nghiệp vụ mới**. Nó trả 4 khoản nợ kỹ thuật ghi ở `docs/DASHBOARD-PLATFORM-PLAN.md` §18.9 (N4),
§19.9 (N8), §22.10 (tổng kết Phase 6), `docs/IMPLEMENTATION-PLAN.md` (Phase 2: lỗ hổng route guard; Phase 5: SCC 96–98 file)
và `docs/ARCHITECTURE.md` §5:

| # | Việc | Round đề xuất | Rủi ro | Số file ước lượng |
| --- | --- | --- | --- | --- |
| 1 | **Route guard theo quyền** — chặn ở tầng route, không chỉ ẩn menu | R1 | Thấp | ~6 (+ 2 docs) |
| 2 | **N4** — đồng bộ `Vehicle Status` khi Huỷ giao/nhận xe trên Webapp (`UC-VH-14`/`UC-VR-19`) | R1 | Thấp–vừa (giả định OQ) | ~8 |
| 3 | **Gỡ vòng import** — SCC 98 file → **0** | R2 | Vừa (cơ học, đo được) | ~37 (+ 3 cấu hình/docs) |
| 4 | **N8** — cố định múi giờ `Asia/Ho_Chi_Minh` (`SA-BR-14`), không phụ thuộc giờ trình duyệt | R3a + R3b | Cao (rộng: 69 file) | ~29 + ~40 |

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/VehicleHandover-BRD.md` §19 (chỉnh sửa/huỷ Handover), `VH-BR-10`, EX-05 ·
`VehicleHandover-UseCase.md` §18 (`UC-VH-14`) · `VehicleReturn-BRD.md` §22.2, `VR-BR-11`, `VR-BR-18`, `VR-BR-20` ·
`VehicleReturn-UseCase.md` §23 (`UC-VR-19`) · `SystemAdministration-BRD.md` §9 (dòng 155, 245), `SA-BR-14` ·
`WebappQuanTri.md` §13.1 (dòng 845–846, 926 — "múi giờ hiển thị thống nhất theo cấu hình toàn cục, mặc định UTC+7") ·
ma trận quyền tóm tắt từng nhóm `WebappQuanTri.md` §6.4–§13 (đã chép vào `src/shared/domain/permissions.ts` — **không đổi** ở vòng này).

**Nguồn kỹ thuật:** `CONVENTIONS.md` §3, §4, §6, §10 · `docs/ARCHITECTURE.md` §2, §5, §7 · `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md`
§0.3–§0.5 (lý do N4 bị hoãn) · `docs/DASHBOARD-PLATFORM-PLAN.md` §0.2 (D1, D11), §11 Q20, §18.9 (N1, N3, N4), §19.9 (L7, N8),
§20.9 (L1 — cách đo tải đầu), §22.10.

**Script đo/phân tích** (không thuộc repo) ở `/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/hardening/`
(dưới đây viết tắt `$SP/hardening`, `SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`,
`REPO=/home/user/tbc-webapp-prototype-demo`):

| Script | Việc |
| --- | --- |
| `graph.mjs` | Dựng đồ thị import runtime (bỏ `import type`, bỏ `import()` động) — cùng quy tắc với `consignment-r3/sccfiles.mjs`. |
| `scc-edges.mjs <repo>` | Liệt kê cạnh chéo feature bên trong SCC. |
| `sim-split.mjs <repo>` | Mô phỏng tách barrel `index.ts` (data) + `ui.ts` (UI) ở mức symbol → in SCC còn lại. `GOM=1 sim-split2.mjs` mô phỏng thêm việc gom import sâu. |
| `sim-edge.mjs <repo> 'a.ts=>b.ts'…` | Mô phỏng thêm cạnh import → SCC. |
| `deep-imports.mjs` / `deep-symbols.mjs` | Import sâu chéo feature (89 cạnh / 50 file / 43 symbol). |
| `route-matrix.mjs <repo>` | Ma trận route × vai trò theo `permissions.ts`. |
| `n4-peek.mjs <repo>` | Biên bản giao/nhận có thể huỷ trên seed + trạng thái xe. |
| `tz-scan.mjs <repo> [-v]` | Quét điểm phụ thuộc giờ trình duyệt (7 nhóm, tách seed/không seed). |
| `dump-seed.mjs <repo> <out.json>` + `diff-seed.mjs a.json b.json` | Chụp toàn bộ `localStorage` sau seed (harness `FIXED_NOW`) và so sánh từng bản ghi. |
| `initial-load.mjs <repo>` | Tổng JS tải đầu `/dashboard` (entry + mọi `modulepreload` trong `dist/index.html`) — trần D11 ≤ 1.870.000 B. |
| `run-harness.sh <repo> <TZ> <outDir> [baselineDir]` | Chạy 6 harness phase6 + `verify` + `sizes` dưới một TZ, so với baseline (bỏ dòng thời gian `ms`). |
| `baseline/` · `base-hcm.json` · `base-utc.json` · `base-ny.json` | Kết quả đo trên HEAD `ef42332` (mốc so sánh cho mọi Round). |

---

## 0. Hiện trạng (đo trên HEAD `ef42332`, working tree sạch, harness `FIXED_NOW` 22/10/2026 10:00 +07)

| Hạng mục | Số đo |
| --- | --- |
| 3 cổng | `tsc -b` / `oxlint` / `build` sạch (2 cảnh báo `oxlint` cũ). |
| Tải đầu `/dashboard` | **1.857.015 B** (9 file) — trần 1.870.000 B, **dư 12.985 B**. |
| SCC | **1 SCC, 98 file** — `sccfiles.mjs` khớp 100% `consignment-r3/scc-target.txt`. Theo feature: `finance` 54, `incidents` 12, `calendar` 9, `handover-return` 8, `rentals` 5, `vehicles` 5, `customers` 3, `contracts` 2. `evalorder` `/src/app/routes.tsx` OK. |
| Seed | `sizes.mjs` `TOTAL` **1.837.906** ký tự, 29 key, `SEED_VERSION` 26. |
| Seed theo TZ (`dump-seed` + `diff-seed`) | HCM chạy 2 lần: **0** khác biệt (tất định). **HCM vs UTC: 2.818 bản ghi khác** (20/29 key). **HCM vs New_York: 2.830 khác, khác cả số lượng** (324 lượt thuê thay vì 323 — do DST). |
| Harness theo TZ (`baseline/`) | HCM: `notif-r2`/`audit-r3`/`platform-r4a`/`polish-r4b` ALL PASS · `audit-seed-timeline` errors 0 · `verify` errors 0 · `signals-r1` 30 tín hiệu. **UTC: `signals-r1` 28 tín hiệu (HANDOVER_UPCOMING 3 thay vì 5) · `notif-r2` FAILS 8 · `verify` errors 18**. |
| Dữ liệu giờ sáng sớm | 1.608/8.849 mốc ISO trên seed rơi vào 00:00–06:59 +07 — mọi chỗ cắt `iso.slice(0, 10)` cho ra **ngày UTC = hôm trước**. Ví dụ thật: `rt_019` giao 22/10 06:00 (+07) = `2026-10-21T23:00Z` → Dashboard đếm là "giao hôm nay" (dùng `format` giờ máy), nhưng Bảng điều phối (`DispatchBoardScreen.tsx:82–89` cắt chuỗi UTC) **không** đếm. Lỗi này có **ngay cả** khi máy ở HCM. |
| Route guard | Không có. 20 route nghiệp vụ, chỉ **9** màn tự chặn trong screen (bảng §1.1). |
| N4 | `cancelHandover`/`cancelReturn` (`handover-return/api.ts:132`, `:237`) chỉ đổi trạng thái lượt; dialog hiện cảnh báo "hệ thống chưa tự động hoàn tác" (`vi.ts:1728`). |

---

## 1. Việc 1 — Route guard theo quyền

### 1.1. Rà toàn bộ route (`route-matrix.mjs`)

`Y` = `true`, `TBD` = ô Open Question (`can()` coi như `false`), `-` = `false`. Cột "Tự chặn" = màn đã có trạng thái "không có quyền" trong screen.

| Route | Quyền guard đề xuất | Tự chặn | ADMIN | MANAGER | DISPATCHER | SALES | OPERATION | ACCOUNTANT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/`, `/dashboard` | — (không guard, CR-2026-032 trang mặc định; màn tự lọc widget) | — | Y | Y | Y | Y | Y | Y |
| `/calendar` | `CALENDAR.VIEW` | không | Y | Y | Y | Y | **TBD** | Y |
| `/vehicles`, `/vehicles/:id` | `VEHICLE.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/maintenance` | `MAINTENANCE.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/customers`, `/customers/:id` | `CUSTOMER.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/schedule/dispatch` | `ASSIGNMENT.VIEW` | không | Y | Y | Y | Y | **TBD** | **-** |
| `/employees` | `EMPLOYEE.VIEW` | không | Y | Y | Y | Y | **-** | **-** |
| `/employees/:id` | `EMPLOYEE.VIEW` | **có** | Y | Y | Y | Y | - | - |
| `/rentals`, `/rentals/:id` | `RENTAL.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/contracts`, `/contracts/:id` | `CONTRACT.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/handover-return` | `HANDOVER_RETURN.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/incidents`, `/incidents/:id` | `INCIDENT.VIEW` | không | Y | Y | **-** | Y | Y | Y |
| `/finance/settlement` | `SETTLEMENT.VIEW` | không | Y | Y | **-** | Y | **-** | Y |
| `/finance/transactions` · `/cash-drawer` · `/receivables` | `PAYMENT.VIEW` | không | Y | Y | **-** | Y | **-** | Y |
| `/finance/costs` | `FINANCE_REPORT.VIEW` | không | Y | Y | **-** | Y | **-** | Y |
| `/finance/reports` | `FINANCE_REPORT.VIEW` | **có** | Y | Y | - | Y | - | Y |
| `/consignment/owners[/:id]` · `/contracts[/:id]` · `/payouts` · `/owner-payouts` | `CONSIGNMENT.VIEW` | **có** (6 màn) | Y | Y | - | Y | - | Y |
| `/consignment/proposals[/:id]` | `CONSIGNMENT.ASSESS` | **có** | Y | Y | - | Y | Y | - |
| `/platform/system-config` · `/permissions` | `SYSTEM_ADMIN.VIEW` | **có** | Y | - | - | - | - | - |
| `/platform/audit` | `AUDIT.VIEW` | **có** (`scopeForRole`) | Y | Y | TBD | Y | - | Y |
| `/platform/notifications` | `NOTIFICATION.VIEW` | không | Y | Y | Y | Y | Y | Y |

Kết luận: **18 ô in đậm** (vai trò × nhóm route) là chỗ hiện gõ thẳng URL vẫn vào được màn mà vai trò không có quyền (`DISPATCHER`
vào được 10 nhóm màn xe/khách/lượt thuê/tài chính; `OPERATION_STAFF` vào được 3 màn tài chính, Hồ sơ nhân viên + 2 ô `TBD`; `ACCOUNTANT`
vào được Bảng điều phối và Hồ sơ nhân viên). Quyền guard **lấy đúng** `resource`/`action` mà `shared/layout/nav.tsx` đang dùng để ẩn menu (nhất quán menu ↔ route);
route chi tiết `/:id` dùng cùng quyền với danh sách. `/platform/audit` dùng `AUDIT.VIEW` — khớp `scopeForRole` (`DISPATCHER`,
`OPERATION_STAFF` = `NONE`).

### 1.2. Thiết kế

> **Chốt ở brief §11 (ưu tiên khi khác mục này):** bảng guard đặt ở `src/app/routeAccess.ts` (`ROUTE_ACCESS`, nguồn duy nhất, `routes.tsx` tham chiếu);
> phương án B làm bằng `linkFallback` + `resolveLink` theo người xem (ghi chú §10).

- **`features/auth/components/RequirePermission.tsx`** — layout route: `({ resource, action }) => can(resource, action) ? <Outlet /> : <NoPermissionState />`.
  Dùng `usePermission()` (CONVENTIONS §6), không so sánh `role`. Đặt trong `auth` vì `auth` sở hữu `usePermission`; export qua barrel `auth`
  (từ R2 chuyển sang `auth/ui.ts`). Không gọi api, không chuyển hướng: giữ nguyên URL (nhất quán với 9 màn tự chặn; đổi vai trò nhanh ở
  Topbar sang vai trò có quyền thì màn hiện lại ngay).
- **`shared/layout/NoPermissionState.tsx`** — trạng thái chung: `PageHeader` tiêu đề "Không có quyền truy cập" + mô tả + nút "Về Tổng quan"
  (`paths.dashboard`). Chỉ dùng `shared/ui` + `vi` + `app/paths` (đã có tiền lệ ở `nav.tsx`) — `shared` không import `features`.
- **`app/routes.tsx`** — bọc theo nhóm quyền, ví dụ:

  ```text
  <Route element={<RequirePermission resource="VEHICLE" action="VIEW" />}>
    <Route path={paths.vehicles} … />  <Route path="/vehicles/:id" … />
  </Route>
  ```

  18 nhóm guard (18 cặp `resource.action`) theo bảng §1.1. `/`, `/dashboard`, `/login`, `*` không guard. Route tải lười: guard nằm **ngoài** `<Suspense>` → vai trò
  không có quyền **không tải** chunk lười.
- **Giữ nguyên** 9 chỗ tự chặn trong screen (phòng thủ 2 lớp, không đổi file trong SCC). Không đổi `permissions.ts`.
- **Liên kết sẽ bị chặn sau guard** (rà bằng harness §1.4 mục 3): tín hiệu `EMPLOYEE_ASSIGNMENT` (`employees/model.ts:306`) gửi **chỉ**
  `DISPATCHER` nhưng trỏ `/rentals/:id?tab=assignment` (cần `RENTAL.VIEW` — `DISPATCHER` không có, OQ Q20). Tương tự link lượt thuê ở
  `EmployeeDetailScreen.tsx:121`. Hai phương án ở §10 câu 2 (đề xuất: tín hiệu trỏ `paths.dispatchBoard`; link ở Chi tiết nhân viên chỉ
  là liên kết khi `can('RENTAL','VIEW')`, ngược lại hiện mã lượt dạng chữ).

### 1.3. File

| File | Thay đổi |
| --- | --- |
| `src/features/auth/components/RequirePermission.tsx` | **Mới** (~25 dòng). |
| `src/features/auth/index.ts` | `+ export { RequirePermission }`. |
| `src/shared/layout/NoPermissionState.tsx` | **Mới**. |
| `src/app/routes.tsx` | Bọc 18 nhóm guard. |
| `src/shared/i18n/vi.ts` | `vi.common.noPermissionTitle` / `noPermissionDescription` / `backToDashboard`. |
| `src/features/employees/model.ts` (dòng 306) + `screens/EmployeeDetailScreen.tsx` (dòng 121) | Chỉ khi người dùng chọn phương án B (§10 câu 2). |
| `docs/ARCHITECTURE.md` §5 · `CONVENTIONS.md` §3, §6 | Bỏ câu "chưa có chặn ở tầng route"; quy tắc: **route mới phải nằm trong một `RequirePermission`** (trừ Dashboard). `tech-lead` sửa khi bàn giao. |

### 1.4. DoD (ngoài DoD chung §8)

1. Harness `$SP/hardening/guard-r1.mjs` (`dev` viết): **phân tích tĩnh** `src/app/routes.tsx` bằng TypeScript compiler API
   (`$REPO/node_modules/typescript`) → bảng `path → (resource, action)`; so khớp **100%** bảng §1.1 (34 path cụ thể dưới `AppShell` ngoài `/` và `/dashboard`, kể cả `/:id`).
   Mọi `<Route>` con của `AppShell` trừ `/` và `/dashboard` phải nằm dưới đúng 1 `RequirePermission`.
2. Cùng harness: với mỗi mục `nav.tsx` có `resource`/`action`, quyền guard của path đó **trùng** quyền nav (in danh sách lệch — kỳ vọng 0).
3. Cùng harness: chạy `collectAllSignals` trên seed (`boot()`), với mỗi tín hiệu × mỗi vai trò nhận (`RECIPIENT_ROUTING`/hàm định tuyến
   hiện có) → tách path khỏi `link` → tra guard → `can(role, …)`. Kỳ vọng: **0 vi phạm** (phương án B) hoặc **đúng 4 vi phạm**
   `EMPLOYEE_ASSIGNMENT`/`DISPATCHER` (phương án A, ghi rõ trong báo cáo).
4. In ma trận role × route (6 × 34) = kết quả guard; khớp bảng §1.1 (`TBD` → bị chặn).

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026). Đã thử render SSR `AppRoutes` từ harness — không khả thi gọn (React/Router
bị nạp 2 bản qua Vite SSR, `ERR_AMBIGUOUS_MODULE_SYNTAX`), nên DoD dùng phân tích tĩnh + tra `can()`.

---

## 2. Việc 2 — N4: đồng bộ `Vehicle Status` khi Huỷ giao/nhận xe

### 2.1. Tài liệu nói gì

- `UC-VH-14` §18.4 bước 4: Rental quay lại `CONFIRMED`/`READY_FOR_HANDOVER`; **"Vehicle Status quay lại `AVAILABLE` (nếu không có ràng buộc
  khác)"**; xoá `Actual Pickup`/`Start Odometer`; **khôi phục `Vehicle.Current Odometer` về giá trị trước đó**. Hậu điều kiện: "Rental/Vehicle trở
  về trạng thái trước khi giao".
- `UC-VR-19` §23.4 bước 4: Rental quay lại `IN_RENTAL`; **"Vehicle Status quay lại `RENTED`"** (không điều kiện); gỡ Additional Charge; khôi phục
  `Current Odometer`. `VR-BR-18`: "hoàn tác toàn bộ cập nhật Rental/Vehicle/charges". `VR-BR-11`/`VR-BR-20`: Return hoàn tất đặt xe
  `AVAILABLE` **hoặc** `MAINTENANCE` (hư hỏng ảnh hưởng an toàn).
- `VehicleHandover-BRD.md` §19.2 / `VehicleReturn-BRD.md` §22.2: "Chính sách chỉnh sửa/huỷ sau hoàn tất **cần khách hàng xác nhận**" (OQ sẵn có).
- **"Ràng buộc khác" không được định nghĩa** ở đâu → OQ-N4-1 (§9). Tài liệu cũng không nói ca xe đã được giao cho lượt khác sau khi nhận.

### 2.2. Bảng quyết định (giả định tạm — `TODO(OQ)` tại code, §9)

"Lượt khác đang giữ xe" = một Rental **khác** cùng `vehicleId` ở `HANDED_OVER` hoặc `IN_RENTAL`.

**Huỷ giao xe** (`cancelHandover`, sau `revertHandoverCancelled`):

| Trạng thái xe lúc huỷ | Lượt khác đang giữ xe | Kết quả | Căn cứ |
| --- | --- | --- | --- |
| `RENTED` | không | → `AVAILABLE` | `UC-VH-14` bước 4 |
| `RENTED` | có | giữ `RENTED` | "ràng buộc khác" — xe vẫn ở lượt khác (OQ-N4-1) |
| `MAINTENANCE` | — | giữ `MAINTENANCE` | "ràng buộc khác" — xe đã được đặt bảo dưỡng sau khi giao (OQ-N4-1) |
| `INACTIVE` | — | giữ `INACTIVE` | `VM`: `INACTIVE` là trạng thái cuối, một chiều |
| `AVAILABLE` | — | không đổi (no-op, không ghi audit xe) | đã đúng đích |

**Huỷ nhận xe** (`cancelReturn`):

| Trạng thái xe lúc huỷ | Lượt khác đang giữ xe | Kết quả | Căn cứ |
| --- | --- | --- | --- |
| `AVAILABLE` | không | → `RENTED` | `UC-VR-19` bước 4 |
| `MAINTENANCE` | không | → `RENTED` | `UC-VR-19` không điều kiện; `MAINTENANCE` có thể do chính Return đặt (`VR-BR-20`) (OQ-N4-3) |
| bất kỳ | **có** | **chặn huỷ** (ném lỗi trước mọi ghi, không đổi gì) | Hoàn tác sẽ tạo 2 lượt "đang thuê" cùng một xe (trái chống trùng lịch RM) (OQ-N4-2) |
| `INACTIVE` | không | giữ `INACTIVE`, vẫn cho huỷ biên bản | trạng thái cuối (OQ-N4-3) |
| `RENTED` | không | không đổi (no-op) | đã đúng đích |

`Current Odometer`: **ngoài phạm vi** — hệ thống không lưu "giá trị trước đó" (OQ-N4-4); dialog giữ cảnh báo kiểm tra Odometer thủ công
(bỏ phần "trạng thái"). Seed **không đổi** (`SEED_VERSION` giữ 26) — trên seed hiện tại không có ca "lượt khác giữ xe"/`MAINTENANCE` (đo
`n4-peek.mjs`: 4 biên bản giao huỷ được — `ho_001…ho_004`, 4 biên bản nhận huỷ được — `rr_001…rr_004`), harness tự dựng các ca này.

### 2.3. Thiết kế & ranh giới import

- **Hàm thuần** ở `handover-return/model.ts`: `vehicleStatusAfterHandoverCancel(vehicle, rentals, rentalId)` và
  `vehicleStatusAfterReturnCancel(vehicle, rentals, rentalId)` → `{ next: VehicleStatus | null; blocked?: true; note: <mã lý do> }`. Chỉ
  `import type` từ `vehicles`/`rentals` (không tạo cạnh runtime).
- **Hàm ghi mới** ở `vehicles/api.ts`: `applySystemStatusChange(vehicleId, to, context: { rentalId, cause: 'CANCEL_HANDOVER' | 'CANCEL_RETURN' }, actor)` —
  chuyển trạng thái **do hệ thống** (bỏ qua ma trận chuyển tay `STATUS_TRANSITIONS`, vì `RENTED` không có thao tác tay — `vehicles/model.ts:84`),
  bọc `fakeRequest`, gọi `appendAudit` với action mới **`SYSTEM_CHANGE_VEHICLE_STATUS`** nối **cuối** `AUDIT_ACTIONS` (+ nhãn ở
  `shared/i18n/auditLabels.ts`; entity `Vehicle` đã ánh xạ module `VM`). `before`/`after` = status cũ/mới, `summary` nêu mã lượt + biên bản.
- **`handover-return/api.ts`**: kiểm tra (gồm chặn OQ-N4-2) **trước** mọi ghi; sau `revertHandoverCancelled`/`revertReturnCancelled` gọi
  `applySystemStatusChange` khi `next !== null`. Đọc lượt thuê bằng `list({ vehicleId })` của `@/features/rentals/api` (import **đã có** ở
  dòng 6) và xe bằng `@/features/vehicles/api` (**cạnh mới**).
- **Ranh giới import (đã mô phỏng `sim-edge.mjs`):** dùng `@/features/vehicles/api` (import sâu theo tiền lệ `rentals/api.ts:6`,
  `contracts/api.ts`) → `vehicles/api.ts` **nằm ngoài SCC** và không đi tới file nào trong SCC → SCC giữ **98 file, danh sách y hệt**.
  Nếu dùng barrel `@/features/vehicles` thì vẫn 98 file nhưng **thêm 1 cạnh bên trong SCC** (cả hai đầu đều trong SCC) — không chọn. R2 sẽ
  chuyển import này về barrel dữ liệu.
- **`handover-return/hooks.ts`**: `useCancelHandover`/`useCancelReturn` invalidate thêm `['vehicles']` và `['notifications']` (KPI Dashboard,
  tín hiệu).
- **Dialog** `HandoverCancelDialog.tsx`/`ReturnCancelDialog.tsx`: thay cảnh báo `vi.ts:1728` bằng mô tả hành vi mới (xe tự cập nhật theo bảng
  §2.2; Odometer vẫn kiểm tra thủ công). Lỗi chặn OQ-N4-2 hiển thị qua toast lỗi sẵn có.

### 2.4. File

`src/features/handover-return/{api,model,hooks}.ts` · `src/features/handover-return/components/{HandoverCancelDialog,ReturnCancelDialog}.tsx` ·
`src/features/vehicles/api.ts` · `src/shared/domain/enums.ts` (1 audit action, nối cuối) · `src/shared/i18n/{vi,auditLabels}.ts`.
Ngoài phạm vi: `rentals/*`, `permissions.ts`, seed, `Current Odometer`, Additional Charge, Settlement đã mở (hành vi cũ giữ nguyên).

### 2.5. DoD (ngoài DoD chung §8)

Harness `$SP/hardening/n4-r1.mjs` (`dev` viết, `boot()` + `load()` gọi thẳng `api.ts`, `actor` MANAGER). Mỗi ca chạy trên seed mới
(`boot()` lại hoặc khôi phục store); ca cần điều kiện thì sửa trực tiếp `store` trước khi gọi:

| Ca | Thao tác | Kỳ vọng |
| --- | --- | --- |
| C1 | huỷ `ho_001` (`rt_016`, `veh_010` `RENTED`) | `veh_010` → `AVAILABLE`; `rt_016` → `READY_FOR_HANDOVER`; audit thêm đúng 3: `CANCEL_HANDOVER`, `REVERT_HANDOVER_CANCELLED`, `SYSTEM_CHANGE_VEHICLE_STATUS` (`RENTED→AVAILABLE`). |
| C2 | như C1, trước đó đặt 1 lượt khác của `veh_010` sang `IN_RENTAL` | `veh_010` giữ `RENTED`; không có audit xe. |
| C3 / C4 | như C1, `veh_010` = `MAINTENANCE` / `INACTIVE` | giữ nguyên; không audit xe; biên bản vẫn `CANCELLED`. |
| C5 | huỷ `rr_001` (`rt_020`, `veh_009` `AVAILABLE`) | `veh_009` → `RENTED`; `rt_020` → `IN_RENTAL`; audit xe `AVAILABLE→RENTED`. |
| C6 | như C5, trước đó đặt 1 lượt khác của `veh_009` sang `IN_RENTAL` | **ném lỗi**; `rr_001` vẫn `COMPLETED`, `rt_020` vẫn `RETURNED`, xe không đổi, **số audit không đổi**. |
| C7 / C8 | như C5, `veh_009` = `MAINTENANCE` / `INACTIVE` | `RENTED` / giữ `INACTIVE` (huỷ vẫn thành công). |
| C9 | gọi lại hàm thuần với mọi tổ hợp bảng §2.2 | đúng từng dòng. |
| C10 | `sccfiles.mjs` | **= `scc-target.txt`** (98 file, không đổi). |

---

## 3. Việc 3 — Gỡ vòng import (SCC 98 → 0)

### 3.1. Nguyên nhân (`scc-edges.mjs`)

Cả 98 file nằm trong **một** SCC. Cạnh tạo vòng theo đúng một khuôn: **barrel trộn "dữ liệu" với "màn hình"**.

```text
finance/payment/ledger.ts ──(cần RENTALS_STORAGE_KEY)──▶ rentals/index.ts
rentals/index.ts ──(export RentalDetailScreen)──▶ rentals/screens/RentalDetailScreen.tsx
RentalDetailScreen.tsx ──(cần RentalPaymentTab)──▶ finance/index.ts ──▶ finance/payment/… ──▶ ledger.ts   (khép vòng)
```

Cùng khuôn ở `vehicles/index.ts → VehicleDetailScreen → finance/index.ts (VehicleProfitTab…) → revenue-cost/model.ts → vehicles/index.ts`,
`incidents/index.ts → IncidentListScreen → … → handover-return/api.ts`, `calendar/index.ts → CalendarScreen → rentals/index.ts`,
`customers/index.ts → CustomerDetailScreen → CustomerRentalHistoryTab → rentals/index.ts`, và `finance/index.ts` gom 13 screen/component
của cả 3 thư mục con. **Lớp dữ liệu (api/model/hooks/storage) không có vòng nào** — các module dữ liệu chỉ phụ thuộc nhau một chiều;
vòng chỉ xuất hiện vì một feature lấy *dữ liệu* của feature khác qua barrel mà barrel đó còn kéo theo *màn hình*.

Import sâu chéo feature (89 cạnh / 50 file, phần lớn `…/hooks.ts` `useVehicles`/`useCustomers`) **không** góp phần tạo vòng sau khi tách
barrel (mô phỏng §3.3).

### 3.2. Chiến lược — mỗi feature 2 điểm nhập công khai

| Điểm nhập | Chứa | Ai import |
| --- | --- | --- |
| `features/<x>/index.ts` | type, hàm thuần `model`, hàm `api`, hook, storage key, collector tín hiệu — **không** component | mọi feature khác, `shared/layout` (`auth`) |
| `features/<x>/ui.ts` (**mới**) | screen (kể cả bản lazy từ `lazyScreens.ts`) + component nhúng sang feature khác (tab, badge, dialog, widget, `RequirePermission`) | `app/routes.tsx` và screen/component của feature khác |

Quy tắc mới (sửa `CONVENTIONS.md` §3 + `docs/ARCHITECTURE.md` §2/§7): `index.ts` **không bao giờ** export từ `screens/`/`components/`;
code không phải UI (`api.ts`, `model.ts`, `hooks.ts`, `seed.ts`, `storage.ts`) **không bao giờ** import `@/features/<x>/ui`. Không cần dời màn sang
`app/`, không cần thêm `lazyScreens` mới (giữ 4 file hiện có, chuyển export sang `ui.ts`). Feature chỉ có export UI (`audit`, `dashboard`)
→ `index.ts` bị xoá (hoặc để trống có comment — §10 câu 4).

### 3.3. Mô phỏng (`sim-split.mjs`, mức symbol)

- Tách 15 barrel theo §3.2 → **SCC = 0** (không còn vòng nào, kể cả vòng nhỏ).
- Importer phải đổi sang `ui.ts`: **21 dòng import ở 7 file** — `app/routes.tsx` (15 feature), `dashboard/screens/DashboardScreen.tsx`
  (`finance/ui`), `finance/payment/components/OwnerPayoutCreateDialog.tsx` + `finance/payment/screens/OwnerPayoutScreen.tsx` (`consignment/ui`),
  `rentals/screens/RentalDetailScreen.tsx` (`finance/ui`), `vehicles/screens/VehicleDetailScreen.tsx` (`finance/ui`, `consignment/ui`).
- Gom thêm 89 import sâu vào barrel (`GOM=1 sim-split2.mjs`) → vẫn **SCC = 0** → gom import sâu là **tuỳ chọn** (R2b, §10 câu 4), không cần cho mục
  tiêu SCC. Nếu làm: +43 symbol vào các barrel, sửa 50 file.

### 3.4. Chống tái phát

`oxlint` 1.82 có `import/no-cycle` (đã thử: `npx oxlint --import-plugin -A all -D import/no-cycle src` → 196 lỗi trên HEAD). Đề xuất bật trong
`.oxlintrc.json` (`"plugins": [..., "import"]`, `"import/no-cycle": ["error", { "ignoreTypes": true }]`) **sau khi** SCC = 0 — cổng `npx oxlint`
sẵn có sẽ chặn vòng mới mà không cần script scratchpad (§10 câu 4). Nếu sau khi tách `no-cycle` vẫn báo (vd. vòng chỉ qua `import type`
mà `ignoreTypes` không bỏ được), `dev` báo danh sách — không tự tắt rule.

### 3.5. File (~37 + 3)

| Nhóm | File |
| --- | --- |
| `ui.ts` mới (15) | `audit`, `auth`, `calendar`, `consignment`, `contracts`, `customers`, `dashboard`, `employees`, `finance`, `handover-return`, `incidents`, `maintenance`, `notifications`, `rentals`, `vehicles` |
| `index.ts` sửa (13) / xoá (2) | 13 feature còn export dữ liệu; `audit/index.ts`, `dashboard/index.ts` (chỉ có screen) |
| Importer (7) | danh sách §3.3 |
| Tuỳ chọn | `handover-return/api.ts` — đổi import N4 `@/features/vehicles/api` → `@/features/vehicles` (sau tách, barrel dữ liệu không còn trong vòng) |
| Cấu hình/docs | `.oxlintrc.json` (nếu duyệt) · `CONVENTIONS.md` §3 · `docs/ARCHITECTURE.md` §2, §7 (docs do `tech-lead` sửa khi bàn giao) |

Không đổi: nội dung bất kỳ hàm/màn nào, seed, `permissions.ts`, thứ tự `registerSeeds.ts`. Diff chỉ gồm dòng `export`/`import`.

### 3.6. DoD (ngoài DoD chung §8)

1. `node $SP/consignment-r3/sccfiles.mjs $REPO` → **rỗng** (0 file). `node $SP/hardening/scc-edges.mjs $REPO` → `SCC count 0`.
2. `npx oxlint` sạch **với** `import/no-cycle` bật (nếu §10 câu 4 duyệt).
3. `evalorder` OK cho `/src/app/routes.tsx` **và từng** `/src/features/<x>/index.ts`, `/src/features/<x>/ui.ts` (nạp riêng lẻ — bắt lỗi TDZ khi
   barrel bị nạp một mình).
4. Kiểm tĩnh: không `index.ts` nào chứa `from './screens` / `from './components` / `/screens/` / `/components/`; không file `api|model|hooks|seed|storage*.ts`
   nào import `@/features/*/ui` (lệnh grep ghi trong brief).
5. **Hành vi y hệt:** `dump-seed.mjs` dưới HCM **trùng 100%** dump của commit R1 (`diff-seed` → `TOTAL diff records 0`), dưới UTC trùng dump UTC
   của commit R1; `run-harness.sh` HCM và UTC: mọi file `diff=0` so với baseline chụp ở commit R1.
6. Tải đầu `/dashboard` ≤ 1.870.000 B, báo chênh lệch so với R1 (kỳ vọng ±1 kB — tách barrel không đổi tập module tải đầu).

---

## 4. Việc 4 — N8: cố định múi giờ `Asia/Ho_Chi_Minh` (`SA-BR-14`)

### 4.1. Phạm vi (`tz-scan.mjs`, 69 file / 205 dòng, không tính `vi.ts`)

| Nhóm | Dòng | Dòng ở seed | File | Ví dụ |
| --- | --- | --- | --- | --- |
| `LOCAL_GETSET` — `getHours/setDate/getMonth…` | 40 | 32 | 18 | `dt()` ở 7 seed: `d.setDate(…); d.setHours(h, m)` |
| `DATEFNS_CAL` — `startOfWeek/isToday/addMonths/eachDayOfInterval…` | 33 | 0 | 8 | lưới lịch Tuần/Tháng, Bảng điều phối |
| `FORMAT_FNS` — `format()` của date-fns | 20 | 0 | 11 | `datetime.ts`, `dashboard/model.ts:27–36`, `notifications/model.ts:49` |
| `UTC_SLICE` — `toISOString().slice(0,10)` / `iso.slice(0,10)` | 35 | 5 | 20 | `calendar/model.ts:72–123`, `DispatchBoardScreen.tsx:82–89` — **lệch ngày cả khi máy ở HCM** (§0) |
| `LOCAL_CTOR` — `new Date(y, m, d…)` | 30 | 7 | 21 | `finance/payment/seed.ts:894–928`, `revenue-cost/model.ts` |
| `INPUT` — `type="date"` / `datetime-local` | 46 | 0 | 29 | giá trị mặc định "hôm nay", chuyển `datetime-local` ↔ ISO |
| `INTL` | 1 | 0 | 1 | `SystemConfigScreen.tsx:86` (cảnh báo giờ trình duyệt — R4a) |

Theo lớp: **13 file seed** + **16 file logic `.ts`** (`datetime.ts`, `documentStatus.ts`, `revenue-cost/{model,reportModel}.ts`,
`consignment/{model,payoutModel,addendumModel,addendumApi}.ts`, `calendar/model.ts`, `dashboard/model.ts`, `notifications/model.ts`,
`audit/model.ts`, `auth/api.ts`, `rentals/api.ts`, `vehicles/model.ts`, `handover-return/model.ts`) + **40 file `.tsx`**. Đã có 3 bản
"date key địa phương" viết tay trùng nhau (`finance/payment/seed.ts:894 localDateKey`, `revenue-cost/model.ts:188 toLocalDateKey`,
`consignment/model.ts:252 toLocalDateKey` + `dayDiff`) — gom về một chỗ.

### 4.2. Thiết kế — mở rộng `shared/lib/datetime.ts`, offset cố định, không thêm thư viện

```text
SYSTEM_TIME_ZONE = 'Asia/Ho_Chi_Minh'            // SA-BR-14 — hiển thị ở Cấu hình hệ thống
SYSTEM_UTC_OFFSET_MINUTES = 420                  // UTC+7, không có giờ mùa hè (từ 1975) → phép tính thuần, không cần Intl
zonedParts(value) → { year, month, day, hour, minute, second, weekday }   // = getUTC*(ms + offset)
toDateKey(value) → 'YYYY-MM-DD'   toMonthKey(value) → 'YYYY-MM'   todayKey(now = new Date())
zonedDateTimeToIso(dateKey, hour, minute = 0) → ISO 'Z'      // thay setHours()+toISOString() ở seed
startOfDayIso(dateKey) / endOfDayIso(dateKey)
addDaysToKey · addMonthsToKey · dayDiff(fromKey, toKey) · startOfWeekKey(key, weekStartsOn = 1) · startOfMonthKey · endOfMonthKey · eachDayKey(from, to)
isoToDateTimeInput(iso) ↔ dateTimeInputToIso(value)          // <input type="datetime-local"> luôn hiểu theo +07
formatDate / formatDateTime / formatTime (giữ chữ ký) — tự định dạng từ zonedParts; formatRelative giữ date-fns (không phụ thuộc TZ)
formatWeekdayShort(dateKey) — nhãn "T2…CN" lấy từ vi.ts (thay format(d, 'EEEEEE dd/MM', { locale }))
```

- **Lưu trữ không đổi:** mọi mốc vẫn là ISO `…Z` (UTC); chỉ **cách cắt ngày / hiển thị / nhập liệu** đổi sang +07. Không đổi cấu trúc entity.
- **Vì sao tự viết, không `@date-fns/tz`** (D-N8-1): `Asia/Ho_Chi_Minh` không có DST → phép cộng offset là chính xác tuyệt đối; tự viết ước
  ~1,5 kB, `@date-fns/tz` 1.5.0 (`TZDate` + `tz`) đo bằng `rolldown --minify` = **4.838 B** (37% phần dư tải đầu) và dùng `Intl` mỗi phép tính
  (seed sinh ~9.000 mốc). API helper giữ được nếu sau này cần múi giờ cấu hình được (OQ-N8-1) — chỉ thay ruột `zonedParts`/`zonedDateTimeToIso`.
- `date-fns` vẫn giữ cho `formatDistanceToNow`/`parseISO`; các hàm lịch (`startOfWeek`, `isToday`, `eachDayOfInterval`…) thay bằng hàm trên
  date key → số import `date-fns` giảm, bundle có thể giảm nhẹ.
- **Quy tắc mới** (`CONVENTIONS.md` §1): ngoài `shared/lib/datetime.ts`, cấm `get/setHours|Date|Month|FullYear|Day`, `new Date(y, m, d)`,
  `iso.slice(0, 10|7)` để lấy ngày, `format()` của date-fns cho ngày/giờ. `tz-scan.mjs` = 0 ngoài file này là DoD cuối.
- `SystemConfigScreen`: đổi cảnh báo "bản demo tính theo giờ trình duyệt" thành thông tin "Hệ thống luôn tính theo Asia/Ho_Chi_Minh
  (UTC+7); trình duyệt của bạn: X".

### 4.3. Chia giai đoạn

| Round | Phạm vi | Vì sao tách | DoD then chốt |
| --- | --- | --- | --- |
| **R3a — Nền + dữ liệu/logic** | `datetime.ts` (helper) + **13 seed** + **15 file logic `.ts` khác** (29 file). Gom 3 helper trùng. | Seed gọi hàm của `model.ts` (vd. `toLocalDateKey`, `buildExpectedPayouts`) — phải đổi cùng lúc thì seed mới độc lập TZ. Không đụng `.tsx` → dễ review. | Dump seed **HCM = UTC = New_York = dump HCM của commit R2** (`diff-seed` 0); `run-harness.sh` UTC và New_York **`diff=0` so với baseline HCM** (hết `notif-r2` FAILS 8, `verify` errors 18, `signals-r1` 28). |
| **R3b — Giao diện** | **40 file `.tsx`**: lưới lịch Tuần/Tháng + `CalendarScreen`, Bảng điều phối, bộ lọc ngày (`HandoverReturnListScreen`, `VehicleConditionTimelineTab`, `RentalFilters`, `AuditFilterBar`…), giá trị mặc định "hôm nay" của ~20 dialog, `datetime-local` (8 file), `SystemConfigScreen`. | Thay đổi hiển thị, không có harness số liệu → tách để review đọc diff kỹ. | `tz-scan.mjs` = **0** ngoài `shared/lib/datetime.ts`; grep `toISOString().slice` = 0; harness HCM `diff=0`. |

Thứ tự trong R3a: `datetime.ts` → 3 helper trùng chuyển thành re-export/xoá → logic `.ts` → seed (`seedHelpers.dt`, các `dt()`/`isoDateOffset()`
cục bộ) → dump 3 TZ → harness 3 TZ.

### 4.4. Rủi ro lệch số liệu seed & harness

| Rủi ro | Khả năng | Phát hiện / giảm thiểu |
| --- | --- | --- |
| Seed HCM đổi vì helper mới tính khác `setHours` địa phương | Thấp (offset HCM cố định) | DoD R3a: dump HCM **trùng từng bản ghi** dump commit R2 → mọi số 5.1/Phase 6 (doanh thu 1,78 tỷ, LN +481,8 tr, 30 tín hiệu…) giữ nguyên. |
| Sửa `UTC_SLICE` đổi hành vi **trong HCM** (cố ý — sửa lỗi) | Chắc chắn, phạm vi nhỏ | Chỉ ảnh hưởng mốc 00:00–06:59 +07. Trên seed: `rt_019`/`ho_004` (giao 06:00). Thay đổi thấy được: Bảng điều phối đếm `rt_019` là giao hôm nay; lưới lịch/khoá xe/bộ lọc ngày xếp lượt này đúng ngày 22/10. Không thuộc harness số liệu. `dev` liệt kê mọi điểm như vậy trong báo cáo. |
| Người dùng đang mở demo ở máy khác HCM giữ seed cũ (sinh theo giờ máy) | Có | Đề xuất bump `SEED_VERSION` 26 → 27 ở R3a để tự seed lại (§10 câu 5). Seed HCM không đổi nên an toàn. |
| Ranh giới ngày trong `model.ts` dùng `now` của harness (`FIXED_NOW` 10:00 +07) — không phủ ca 00:00–06:59 | Có | Harness R3a thêm lượt chạy với `FIXED_NOW` = 22/10/2026 **06:30 +07** (= 21/10 23:30 UTC) chỉ cho `signals-r1` + KPI Dashboard: kỳ vọng "hôm nay" = 22/10 dưới mọi TZ. |
| Harness tự dùng giờ máy (`verify.mjs` dùng `toLocaleDateString('sv-SE', { timeZone })` — đã đúng; `signals-r1` so `dedupeKey`) | Thấp | Chạy `run-harness.sh` dưới 3 TZ; nếu harness (không phải app) phụ thuộc TZ, sửa harness — báo lại. |
| Chuỗi hiển thị đổi nhỏ (vd. `formatRelative`) | Thấp | `formatRelative` giữ date-fns; `formatDate/Time` giữ định dạng `dd/MM/yyyy HH:mm`. |
| Bundle | Thấp | Ngân sách §8; tự viết thay vì thêm thư viện. |

---

## 5. Thứ tự Round đề xuất

```text
R1  Route guard + N4          (nhỏ, độc lập, giá trị demo ngay: đổi vai trò → gõ URL bị chặn; huỷ giao/nhận cập nhật xe)
 ↓  chụp lại baseline (dump HCM/UTC + run-harness HCM/UTC) ở commit R1
R2  Gỡ SCC → 0 (+ bật import/no-cycle)     (thuần cơ học, KHÔNG đổi hành vi → đo được bằng "dump + harness y hệt")
 ↓  chụp lại baseline ở commit R2
R3a N8 — helper + seed + logic             (đổi hành vi dưới TZ ≠ HCM; HCM y hệt)
 ↓
R3b N8 — giao diện                         (sửa lỗi hiển thị/nhập liệu, tz-scan = 0)
(R2b tuỳ chọn — gom 89 import sâu vào barrel; làm sau R3b hoặc bỏ)
```

Lý do đặt **R2 trước R3**: R2 là refactor không đổi hành vi, kiểm được tuyệt đối bằng dump + harness — làm khi chưa có thay đổi hành vi nào
khác thì mọi chênh lệch đều là lỗi. R3 cố ý đổi hành vi (dưới TZ khác HCM + sửa `UTC_SLICE`), nếu làm trước sẽ phải tách "lệch do refactor"
khỏi "lệch do sửa múi giờ". R3 lại chạm ~69 file, nhiều file trong SCC hiện tại — làm trên đồ thị đã sạch vòng thì không còn rủi ro thứ tự
nạp module (TDZ). R1 không phụ thuộc R2/R3; N4 dùng import sâu `vehicles/api` để không thêm cạnh vào SCC trong lúc chờ R2.

---

## 6. Quyết định kỹ thuật (`tech-lead` — không phải quyết định nghiệp vụ)

| # | Quyết định | Lý do |
| --- | --- | --- |
| H1 | Guard = layout route `RequirePermission` trong `features/auth`, khai tại `app/routes.tsx`; quyền lấy đúng như `nav.tsx`. | Tập trung 1 chỗ, `app/` vẫn mỏng (chỉ khai báo), không đổi `permissions.ts`. |
| H2 | Không chuyển hướng khi thiếu quyền — hiện `NoPermissionState`, giữ URL. | Nhất quán 9 màn tự chặn sẵn có; đổi vai trò nhanh hiện lại ngay. |
| H3 | Giữ 9 chỗ tự chặn trong screen. | Phòng thủ 2 lớp; tránh sửa file trong SCC ở R1. |
| H4 | N4: logic quyết định = hàm thuần ở `handover-return/model.ts`; ghi xe qua hàm hệ thống mới ở `vehicles/api.ts` + audit action riêng. | Phân biệt rõ đổi trạng thái tay (`CHANGE_VEHICLE_STATUS`, `AC-VM-006`) với đổi do hệ thống (`VH-BR-10`/`VR-BR-11`) trên Nhật ký thao tác. |
| H5 | N4: kiểm tra chặn trước mọi ghi. | Fake API không có transaction xuyên key (`handover-return/api.ts` comment dòng 128–130) — tránh trạng thái nửa vời. |
| H6 | SCC: tách `index.ts` (data) / `ui.ts` (UI) cho **cả 15** feature, không chỉ 8 feature trong SCC. | Một quy tắc đồng nhất dễ nhớ; chi phí thêm ~7 file nhỏ. |
| H7 | N8: tự viết offset cố định trong `shared/lib/datetime.ts`, không thêm dependency. | §4.2. |
| H8 | DoD hành vi = so sánh dump seed + output harness với baseline, không chỉ 3 cổng. | Refactor rộng không có test runner — đây là lưới an toàn duy nhất đo được. |

---

## 7. File dự kiến tạo / sửa (tổng hợp)

| Round | Tạo | Sửa | Xoá |
| --- | --- | --- | --- |
| R1 | `auth/components/RequirePermission.tsx`, `shared/layout/NoPermissionState.tsx` | `app/routes.tsx`, `auth/index.ts`, `handover-return/{api,model,hooks}.ts`, `handover-return/components/{HandoverCancelDialog,ReturnCancelDialog}.tsx`, `vehicles/api.ts`, `shared/domain/enums.ts`, `shared/i18n/{vi,auditLabels}.ts` (+ `employees/model.ts`, `employees/screens/EmployeeDetailScreen.tsx` nếu phương án B) | — |
| R2 | 15 × `features/<x>/ui.ts` | 13 × `index.ts`, 7 importer, `.oxlintrc.json` (nếu duyệt) | `audit/index.ts`, `dashboard/index.ts` (nếu duyệt) |
| R3a | — | `shared/lib/datetime.ts`, 13 seed, 15 file logic | (helper trùng thành re-export hoặc xoá) |
| R3b | — | ~40 `.tsx` | — |
| Docs (`tech-lead`, khi bàn giao mỗi Round) | — | `CONVENTIONS.md` §1, §3, §6 · `docs/ARCHITECTURE.md` §2, §5, §7 · `docs/IMPLEMENTATION-PLAN.md` · `CHANGELOG.md` · file này | — |

---

## 8. DoD chung mọi Round

1. `npx tsc -b` · `npx oxlint` · `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `node $SP/hardening/initial-load.mjs $REPO` (sau `npm run build`) → `INITIAL_JS` ≤ **1.870.000**. Ngân sách ban đầu: R1 ≤ +3.000 B · R2 ±1.000 B ·
   R3a+R3b ≤ +4.000 B. **Phân bổ lại sau R1 (§11.9 L1 — R1 thực tế 1.863.679 B):** R2 ≤ **1.864.679** · R3a+R3b ≤ **1.870.000** (trần cứng, dư ~5,3 kB;
   R3 thay các hàm lịch `date-fns` bằng helper date key nên kỳ vọng ±0). Vượt ngân sách Round nhưng còn dưới trần → báo lại, không tự tải lười thêm.
3. SCC: R1 `sccfiles.mjs | diff - $SP/consignment-r3/scc-target.txt` **rỗng**; từ R2 trở đi `sccfiles.mjs` **rỗng** (0 file).
   `node $SP/tl-verify/evalorder.mjs $REPO /src/app/routes.tsx` → `OK`.
4. `TZ=Asia/Ho_Chi_Minh node $SP/phase6/sizes.mjs $REPO` → `TOTAL` **1.837.906** (không Round nào đổi seed; R3a: giữ nguyên nếu dump trùng).
5. `bash $SP/hardening/run-harness.sh $REPO Asia/Ho_Chi_Minh <out> <baseline của commit trước>` → mọi file `diff=0`; `notif-r2`, `audit-r3`,
   `platform-r4a`, `polish-r4b` ALL PASS; `audit-seed-timeline` và `verify` (`before-r4a.json`) `errors: 0`. (Ngoại lệ được phép: R1 phương án B —
   chỉ khác `link` của 4 tín hiệu `EMPLOYEE_ASSIGNMENT` nếu harness in link; `dev` giải thích.)
6. `dump-seed.mjs` HCM → `diff-seed` với dump commit trước = **0** (R3a thêm UTC/New_York = HCM).
7. Mọi `create/update` mới gọi `appendAudit`; chuỗi UI mới ở `vi.ts`; không `localStorage` trực tiếp; không `enum`; không đổi `permissions.ts`.
8. `git status` chỉ gồm file thuộc Round (§7); không file `docs/`.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026).

---

## 9. Open Question — giả định tạm + `TODO(OQ)` (không tự chốt)

| # | Câu hỏi | Giả định tạm (đặt `TODO(OQ: …)` tại code) | Cần ai |
| --- | --- | --- | --- |
| OQ-G1 | (= `DASHBOARD-PLATFORM-PLAN.md` §11 **Q20**) `DISPATCHER` không có `RENTAL.VIEW` → sau guard không mở được `/rentals/:id` từ thông báo phân công / Chi tiết nhân viên. | Giữ nguyên quyền; xử lý điều hướng theo §10 câu 2. | BA — bổ sung cột Dispatcher `RM` §39 / `WebappQuanTri.md` §9.4 |
| OQ-G2 | 3 ô `TBD` chạm route: `CALENDAR.VIEW`/`ASSIGNMENT.VIEW` của `OPERATION_STAFF`, `AUDIT.VIEW` của `DISPATCHER`. | Guard **chặn** (`can()` coi `TBD` = `false`, CONVENTIONS §6) — nhất quán với menu đang ẩn. Hành vi mới: `OPERATION_STAFF` hết vào được `/calendar` bằng URL. | BA |
| OQ-N4-1 | `UC-VH-14`: "`AVAILABLE` (nếu không có ràng buộc khác)" — ràng buộc nào? | Lượt khác đang giữ xe, `MAINTENANCE`, `INACTIVE` → giữ nguyên trạng thái xe (bảng §2.2). | BA / khách |
| OQ-N4-2 | Huỷ nhận xe khi xe **đã giao cho lượt khác** sau khi nhận. | **Chặn huỷ** (lỗi rõ ràng, không ghi gì). Phương án khác: cho huỷ, giữ trạng thái xe, cảnh báo. | BA / khách |
| OQ-N4-3 | Huỷ nhận xe khi xe đang `MAINTENANCE` (có thể do chính Return — `VR-BR-20` — hoặc do thao tác khác) / `INACTIVE`. | `MAINTENANCE` → `RENTED` (theo `UC-VR-19` không điều kiện); `INACTIVE` giữ nguyên. | BA |
| OQ-N4-4 | Khôi phục `Current Odometer` "về giá trị trước đó" (`UC-VH-14`/`UC-VR-19`) — hệ thống không lưu giá trị trước. | Ngoài phạm vi; dialog giữ cảnh báo kiểm tra Odometer thủ công. Kèm OQ sẵn có: chính sách huỷ sau hoàn tất "cần khách hàng xác nhận" (VH §19.2, VR §22.2). | BA / khách |
| OQ-N8-1 | `SA-BR-14` "mặc định UTC+7" — múi giờ có **cấu hình được** không (SA BRD §9 dòng 155 có field `Timezone`)? | Cố định `Asia/Ho_Chi_Minh`; màn Cấu hình hệ thống chỉ đọc (như R4a). Helper gói offset 1 chỗ để đổi sau. | BA |
| OQ-N8-2 | Mọi ranh giới "ngày" nghiệp vụ (hạn thanh toán, giấy tờ hết hạn, ngày chi trả ký gửi, ngày thuê, "hôm nay" trên Dashboard) tính theo 00:00 +07? | Có — theo `SA-BR-14` + `WebappQuanTri.md` dòng 926. Không phải quyết định mới, ghi để BA xác nhận. | BA (xác nhận) |

---

## 10. Điểm người dùng cần quyết trước khi giao `dev` — **đã chốt 23/10/2026**

> **Quyết định của người dùng (23/10/2026, qua điều phối viên):** chấp nhận **cả 6 điểm theo đề xuất** —
> (1) thứ tự R1 → R2 → R3a → R3b, R2b tuỳ chọn sau R3b, các Round chạy liên tục;
> (2) `DISPATCHER` theo **phương án B** (thông báo phân công đưa tới Bảng điều phối; link lượt thuê ở Chi tiết nhân viên chỉ là liên kết khi có
> `RENTAL.VIEW`), chấp nhận guard chặn 3 ô `TBD` (OQ-G2);
> (3) N4: 4 giả định OQ-N4-1…4 (gồm chặn huỷ nhận xe khi xe đang ở lượt khác) + ngoại lệ **E1**;
> (4) R2: **E2, E3, E4**; R2b không bắt buộc;
> (5) N8: tự viết helper (không thêm thư viện), chấp nhận đổi hành vi do sửa lỗi cắt ngày UTC, `SEED_VERSION` 26 → 27 ở R3a;
> (6) ngân sách tải đầu theo Round như §8 mục 2.
>
> **Điều chỉnh kỹ thuật khi lập brief R1 (`tech-lead`, không phải quyết định nghiệp vụ mới):** đo người nhận thật của `EMPLOYEE_ASSIGNMENT`
> (`$SP/hardening/asg-recipients.mjs`) — ngoài `DISPATCHER` còn **người được giao** qua `recipientUserIds` (`usr_staff` `OPERATION_STAFF` ×2,
> `usr_manager`, `usr_admin`). `OPERATION_STAFF` có `RENTAL.VIEW` nhưng `ASSIGNMENT.VIEW` = `TBD` → nếu đổi hẳn link sang Bảng điều phối thì nhân
> viên được giao lại bị chặn. Vì vậy phương án B được thực hiện bằng **link theo người xem**: tín hiệu giữ `link` lượt thuê và thêm `linkFallback` =
> Bảng điều phối; khi người xem không qua được guard của `link` thì dùng `linkFallback` (`DISPATCHER` → Bảng điều phối, đúng ý B; người được giao →
> lượt thuê như cũ). Chi tiết §11.2 mục 3.


1. **Thứ tự & cách chia Round** (§5): R1 (guard + N4) → R2 (SCC) → R3a → R3b; R2b tuỳ chọn. *Đề xuất: duyệt.*
2. **Guard — điều hướng của `DISPATCHER`** (OQ-G1): **(A)** giữ link, `DISPATCHER` bấm thông báo phân công sẽ thấy "Không có quyền truy cập"; **(B)** tín hiệu
   `EMPLOYEE_ASSIGNMENT` trỏ Bảng điều phối (`/schedule/dispatch`, nơi `DISPATCHER` thao tác phân công), link lượt thuê ở Chi tiết nhân viên chỉ là
   liên kết khi có `RENTAL.VIEW`. Thông báo đã lưu trước đó giữ link cũ tới khi Reset dữ liệu demo. *Đề xuất: B.* Kèm: chấp nhận guard chặn 3 ô `TBD` (OQ-G2).
3. **N4 — 4 giả định** OQ-N4-1…4 (§2.2, §9), đặc biệt **chặn huỷ nhận xe khi xe đang ở lượt khác** (OQ-N4-2). Kèm **ngoại lệ kiến trúc E1**:
   `handover-return` ghi sang `vehicles` qua `@/features/vehicles/api` (import sâu theo tiền lệ `rentals/api.ts`, `contracts/api.ts`) + hàm đổi trạng
   thái do hệ thống ở `vehicles/api.ts` (bỏ qua ma trận chuyển tay) — chính là phần `HANDOVER-RETURN-MANAGEMENT-PLAN.md` §0.4 đã hoãn chờ duyệt. *Đề xuất: duyệt.*
4. **R2 — ngoại lệ/quy ước kiến trúc**: (E2) đổi quy ước "barrel là điểm import duy nhất" thành **2 điểm nhập** `index.ts` (data) + `ui.ts` (UI) cho mọi
   feature; (E3) bật `import/no-cycle` (plugin `import`) trong `.oxlintrc.json`; (E4) xoá `audit/index.ts`, `dashboard/index.ts` (chỉ còn `ui.ts`);
   (E5) **R2b** gom 89 import sâu (50 file, +43 symbol barrel) — làm hay bỏ. *Đề xuất: duyệt E2–E4; R2b để sau R3b, không bắt buộc.*
5. **N8**: (a) tự viết offset cố định thay vì thêm `@date-fns/tz` (+4.838 B); (b) chấp nhận thay đổi hành vi trong HCM do sửa lỗi cắt ngày UTC
   (mốc 00:00–06:59, vd. `rt_019` hiện đúng ngày ở Bảng điều phối/lịch); (c) bump `SEED_VERSION` 26 → 27 ở R3a để máy ở múi giờ khác tự seed lại.
   *Đề xuất: duyệt cả 3.*
6. **Ngân sách tải đầu** theo Round (§8 mục 2). *Đề xuất: duyệt.*

---

## 11. Round 1 — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 11.1. Bối cảnh

Phase 6 đã `DONE` (HEAD `ef42332`). Round này trả 2 khoản nợ nhỏ, độc lập, **không thêm tính năng nghiệp vụ**:

- **Route guard:** quyền mới chỉ ẩn menu/nút. Gõ thẳng URL vẫn mở được màn mà vai trò không có quyền — 18 ô (vai trò × nhóm route), bảng §1.1.
  Thêm chặn ở tầng route, khai **một chỗ**.
- **N4:** Huỷ biên bản giao/nhận xe trên Webapp (`cancelHandover`/`cancelReturn`) mới hoàn tác trạng thái lượt thuê, chưa hoàn tác `Vehicle Status`
  (`UC-VH-14` §18.4, `UC-VR-19` §23.4, `VR-BR-18`). Làm theo bảng giả định §2.2 — người dùng đã duyệt (§10), kèm ngoại lệ **E1**.

Không đổi `permissions.ts`, seed (`SEED_VERSION` giữ **26**), cấu trúc barrel (việc của R2), cách tính ngày giờ (việc của R3).

### 11.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §11.5)

**A. Route guard**

1. **`src/app/routeAccess.ts` (mới, thuần — chỉ import `./paths` và `import type { Action, Resource } from '@/shared/domain/permissions'`):**
   - `export const ROUTE_ACCESS = { … } as const` — **đúng 18 khoá, đúng `resource`/`action`/`paths`** như
     `$SP/hardening/expect-guard-r1.json` (`groups`). Path danh sách dùng hằng `paths.*`; path chi tiết viết dạng mẫu `'/vehicles/:id'`. Comment
     1 dòng đầu file: nguồn = `shared/layout/nav.tsx` (cùng `resource`/`action` với menu) + `TECH-HARDENING-PLAN.md` §1.1.
   - `export type RouteAccess = { resource: Resource; action: Action; paths: readonly string[] }`.
   - `export function routeAccessForPath(pathname: string): RouteAccess | undefined` — bỏ `?query`/`#hash`, so từng đoạn (`:param` khớp một
     đoạn bất kỳ không rỗng). Không dùng `react-router` (harness nạp file này qua Vite SSR).
   - `export function canAccessPath(pathname: string, check: (resource: Resource, action: Action) => boolean): boolean` — `true` nếu path không
     thuộc nhóm nào (vd. `/dashboard`), ngược lại `check(resource, action)`.
2. **`src/features/auth/components/RequirePermission.tsx` (mới):** layout route `({ access }: { access: { resource: Resource; action: Action } })`
   → `usePermission().can(access.resource, access.action) ? <Outlet /> : <NoPermissionState />`. Không gọi api, không `<Navigate>` (giữ URL — quyết
   định H2). Không `import` gì từ `@/app` (kiểu `access` khai cục bộ). Export qua `src/features/auth/index.ts`.
3. **`src/shared/layout/NoPermissionState.tsx` (mới):** `PageHeader` (tiêu đề + mô tả) + nút `Button asChild` → `<Link to={paths.dashboard}>`.
   Chỉ dùng `shared/ui`, `shared/layout/PageHeader`, `vi`, `@/app/paths` (tiền lệ `nav.tsx`). Không import `features`.
4. **`src/app/routes.tsx`:** bọc đúng 18 nhóm: `<Route element={<RequirePermission access={ROUTE_ACCESS.<khoá>} />}> …route con… </Route>`.
   - Route con giữ **tự đóng** (`<Route … />`) — harness dựa vào đó để đọc lồng nhau.
   - `<Suspense>` của màn tải lười nằm **trong** route con (guard ở ngoài → vai trò thiếu quyền không tải chunk lười).
   - `/`, `/dashboard`, `/login`, `*` **không** guard. Thứ tự route trong file giữ nguyên theo nhóm như hiện tại.
5. **Link theo người xem (phương án B — §10, điều chỉnh kỹ thuật ở ghi chú §10):**
   - `src/shared/domain/alerts.ts`: thêm `linkFallback?: string` vào `OperationalSignal` (comment: "dùng khi người xem không qua được guard của
     `link` — TECH-HARDENING-PLAN.md §11.2 mục 5").
   - `src/features/notifications/model.ts`: `NotificationEvent` thêm `linkFallback?: string`; hàm dựng event chỉ chép khi tín hiệu có
     (`...(signal.linkFallback ? { linkFallback: signal.linkFallback } : {})` — event khác giữ nguyên hình dạng). Thêm hàm thuần
     `export function resolveLink(item: { link: string; linkFallback?: string }, check): string | undefined` →
     `canAccessPath(link) ? link : linkFallback && canAccessPath(linkFallback) ? linkFallback : undefined` (import `canAccessPath` từ `@/app/routeAccess`).
   - `src/features/notifications/components/NotificationCard.tsx`: dùng `resolveLink(event, can)`; `undefined` → vẫn đánh dấu đã đọc, **không** điều hướng.
   - `src/features/dashboard/components/AlertPanel.tsx`: dùng `resolveLink(signal, can)`; `undefined` → hiện dòng không có `<Link>` (giữ nguyên nội dung).
     Barrel `notifications` export thêm `resolveLink` (comment `TECH-HARDENING-PLAN.md §11.2`).
   - `src/features/employees/model.ts` (collector `EMPLOYEE_ASSIGNMENT`, quanh dòng 306): **giữ** `link` hiện tại, thêm `linkFallback: paths.dispatchBoard`
     (comment: OQ-G1 / `DASHBOARD-PLATFORM-PLAN.md` §11 Q20 — `DISPATCHER` không có `RENTAL.VIEW`).
   - `src/features/employees/screens/EmployeeDetailScreen.tsx` (dòng ~121): mã lượt là `<Link>` chỉ khi `can('RENTAL', 'VIEW')`, ngược lại `<span>`.
6. **`src/shared/i18n/vi.ts`:** `vi.common.noPermissionTitle` ("Không có quyền truy cập"), `vi.common.noPermissionDescription`, `vi.common.backToDashboard`.

**B. N4 — đồng bộ `Vehicle Status` khi huỷ giao/nhận**

7. **`src/features/handover-return/model.ts` — 2 hàm thuần** (chỉ `import type` từ `@/features/vehicles`, `@/features/rentals`):

   ```text
   type VehicleStatusDecision = { next: VehicleStatus | null; blockedByRentalId?: string; reason: 'TO_AVAILABLE' | 'TO_RENTED' | 'OTHER_ACTIVE_RENTAL' | 'KEEP_MAINTENANCE' | 'KEEP_INACTIVE' | 'ALREADY_TARGET' }
   vehicleStatusAfterHandoverCancel(vehicle, rentals, rentalId): VehicleStatusDecision
   vehicleStatusAfterReturnCancel(vehicle, rentals, rentalId): VehicleStatusDecision
   ```

   - "Lượt khác đang giữ xe" = `rentals.find(r => r.vehicleId === vehicle.id && r.id !== rentalId && (r.status === 'HANDED_OVER' || r.status === 'IN_RENTAL'))`.
   - Đúng 2 bảng §2.2. Huỷ nhận xe + có lượt khác → `{ next: null, blockedByRentalId, reason: 'OTHER_ACTIVE_RENTAL' }` (api sẽ ném lỗi).
   - Mỗi nhánh giả định có `// TODO(OQ: TECH-HARDENING-PLAN.md §9 OQ-N4-x) — …` (N4-1 ở nhánh giữ trạng thái khi huỷ giao, N4-2 ở nhánh chặn,
     N4-3 ở nhánh `MAINTENANCE`/`INACTIVE` khi huỷ nhận, N4-4 ở JSDoc: không khôi phục `Current Odometer`). Comment `UC-VH-14 §18.4` / `UC-VR-19 §23.4`.
8. **`src/features/vehicles/api.ts` — hàm mới** `applySystemStatusChange(id, to: VehicleStatus, context: { rentalId: string; recordId: string; cause: 'CANCEL_HANDOVER' | 'CANCEL_RETURN' }, actor: ActorInfo): Promise<Vehicle>`:
   - Bọc `fakeRequest`; **không** qua `canChangeStatus` (ma trận chuyển **tay** — `RENTED` không có thao tác tay); `from === to` → ném lỗi (caller không gọi khi no-op).
   - `appendAudit({ action: 'SYSTEM_CHANGE_VEHICLE_STATUS', entity: 'Vehicle', entityId, summary, before: { status }, after: { status, rentalId, recordId, cause }, actor… })`.
     `summary` lấy từ `vi` (hàm nhận biển số, trạng thái cũ/mới, mã lượt). Comment `VH-BR-10` / `VR-BR-11` / `VR-BR-18`.
9. **`src/shared/domain/enums.ts`:** nối **cuối** `AUDIT_ACTIONS` `'SYSTEM_CHANGE_VEHICLE_STATUS'` + comment 1 dòng (`TECH-HARDENING-PLAN.md §2.3 — UC-VH-14/UC-VR-19`).
   `src/shared/i18n/auditLabels.ts`: nhãn "Hệ thống đổi trạng thái xe". Nếu `features/audit/model.ts` có bảng theo action bắt buộc (TS báo) thì thêm đúng 1 dòng.
10. **`src/features/handover-return/api.ts`:**
    - Import thêm `list as listRentals` từ `@/features/rentals/api` (import sâu đã có ở dòng 6) và `getById as getVehicleById`, `applySystemStatusChange`
      từ **`@/features/vehicles/api`** (ngoại lệ E1 — **không** dùng barrel `@/features/vehicles`, §2.3). Comment 1 dòng nêu E1.
    - `cancelHandover`: sau các kiểm tra hiện có, đọc xe + `listRentals({ vehicleId })`, tính quyết định **trước mọi ghi**; giữ nguyên ghi biên bản +
      `revertHandoverCancelled`; sau đó nếu `decision.next` thì `applySystemStatusChange(…, { cause: 'CANCEL_HANDOVER' })`.
    - `cancelReturn`: tương tự; `blockedByRentalId` → `throw new Error(vi.handoverReturn.errors.cancelReturnVehicleInUse(rentalId))` **trước** khi ghi bất cứ gì.
    - Cập nhật JSDoc 2 hàm (bỏ câu "KHÔNG tự động").
11. **`src/features/handover-return/hooks.ts`:** `useCancelHandover`/`useCancelReturn` invalidate thêm `['vehicles']` và `['notifications']`.
12. **Dialog** `HandoverCancelDialog.tsx`/`ReturnCancelDialog.tsx`: đổi nội dung `vi.handoverReturn.cancelStep2VehicleNotice` (giữ khoá) thành: hệ thống tự cập nhật
    trạng thái xe theo quy tắc hoàn tác; `Current Odometer` không tự khôi phục — kiểm tra tại trang Chi tiết xe. Lỗi chặn hiển thị qua toast lỗi sẵn có
    (kiểm tra dialog đang hiện `error.message`; nếu đang hiện chuỗi cố định `cancelReturnError` thì hiện `error.message` khi có).

### 11.3. Ngoài phạm vi R1 (không làm dù "tiện tay")

Đổi `permissions.ts` / ô `TBD` · bỏ 9 chỗ tự chặn trong screen (giữ — H3) · tách barrel / sửa import sâu khác (R2) · bất kỳ sửa ngày giờ/múi giờ (R3) ·
khôi phục `Current Odometer`, gỡ Additional Charge, đụng Settlement đã mở (OQ-N4-4) · sửa `rentals/*` · đổi seed / `SEED_VERSION` · đổi `RECIPIENT_ROUTING` ·
thêm route mới · chạy trình duyệt · sửa file `docs/`.

### 11.4. Quy tắc bắt buộc

- `CONVENTIONS.md` toàn bộ; đặc biệt §1 (chuỗi UI ở `vi.ts`), §4 (`fakeRequest` + `appendAudit` + `storage.ts`), §6 (`usePermission`, không `role ===`), §10 (`TODO(OQ)`), §11 (không `*/` trong comment).
- Không tạo cạnh import mới giữa 2 file **đều** nằm trong SCC; cạnh mới duy nhất được phép giữa feature: `handover-return/api.ts → vehicles/api.ts` (E1) và
  `notifications/model.ts → app/routeAccess.ts`.
- `app/routeAccess.ts` là nguồn duy nhất của bảng guard — `routes.tsx` không tự viết `resource`/`action` dạng chữ.
- Gặp chỗ plan không khớp code (tên hàm/dòng khác) → làm theo ý plan, ghi vào báo cáo mục "lệch plan"; gặp quyết định nghiệp vụ mới → dừng, báo lại.

### 11.5. Thứ tự làm

1. Mục 1 → harness DoD 6 phần (a) chạy được ngay.
2. Mục 2–4, 6 → `npx tsc -b` + DoD 6 (b–d).
3. Mục 5 → DoD 6 (e).
4. Mục 7 → DoD 7 ca C9.
5. Mục 8–12 → DoD 7 đủ C1–C10.
6. Chạy toàn bộ DoD 1–9.

### 11.6. Definition of Done R1 — chạy đủ và dán kết quả vào báo cáo

1. `npx tsc -b` · `npx oxlint` · `npm run build` sạch (không thêm cảnh báo so với 2 cảnh báo cũ); `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `node $SP/hardening/initial-load.mjs $REPO` (sau build) → `INITIAL_JS` ≤ **1.870.000** và ≤ **1.860.015** (ngân sách R1 +3.000 B so với 1.857.015).
3. `node $SP/consignment-r3/sccfiles.mjs $REPO | diff - $SP/consignment-r3/scc-target.txt` → **rỗng** (SCC giữ đúng 98 file).
   `node $SP/tl-verify/evalorder.mjs $REPO /src/app/routes.tsx` → `OK`; thêm `… /src/app/routeAccess.ts` → `OK`.
4. `bash $SP/hardening/run-harness.sh $REPO Asia/Ho_Chi_Minh $SP/hardening/r1-hcm $SP/hardening/baseline` → **mọi dòng `diff=0`** (`notif-r2`, `audit-r3`,
   `platform-r4a`, `polish-r4b` ALL PASS; `audit-seed-timeline`, `verify` `errors: 0`; `sizes` `TOTAL 1837906`). Chạy thêm với `UTC` → `$SP/hardening/r1-utc`
   cũng `diff=0` so với `baseline` (R1 không đổi hành vi theo múi giờ; `notif-r2` FAILS 8 dưới UTC là nợ N8 có sẵn — giữ nguyên, không sửa).
5. `TZ=Asia/Ho_Chi_Minh node $SP/hardening/dump-seed.mjs $REPO $SP/hardening/r1-hcm.json && node $SP/hardening/diff-seed.mjs $SP/hardening/base-hcm.json $SP/hardening/r1-hcm.json`
   → `TOTAL diff records 0`.
6. **Harness guard** `$SP/hardening/guard-r1.mjs` (`dev` viết; `boot()` của `$SP/demo-data/lib.mjs`, `FIXED_NOW`; in `PASS`/`FAIL` từng mục + `ALL PASS`):
   - (a) `load('/src/app/routeAccess.ts')`: `ROUTE_ACCESS` khớp **từng khoá/resource/action/paths** `$SP/hardening/expect-guard-r1.json` `groups` (paths so như tập).
     `routeAccessForPath('/vehicles/veh_001?tab=x')` = nhóm `vehicles`; `'/dashboard'` → `undefined`; `'/vehicles/a/b'` → `undefined`.
   - (b) Đọc `src/app/routes.tsx` dạng văn bản: mỗi khối `<Route element={<RequirePermission access={ROUTE_ACCESS.<khoá>} />}>` … `</Route>` → tập `path`
     (giải `paths.<x>` bằng `load('/src/app/paths.ts')`) **bằng đúng** `ROUTE_ACCESS[<khoá>].paths`; đúng 18 khối, mỗi khoá 1 lần; path con của `AppShell` nằm
     ngoài mọi khối chỉ có `/` và `paths.dashboard`; tổng path được guard = **34**.
   - (c) Mọi mục `NAV_ENTRIES` (`load('/src/shared/layout/nav.tsx')`) có `resource`/`action`: `routeAccessForPath(path)` cùng `resource`/`action` → lệch **0**.
   - (d) Ma trận 6 vai trò × 18 nhóm: `canAccessPath(paths[0], (r, a) => can(role, r, a))`; in bảng; số ô bị chặn = **29** (= 18 ô lọt quyền §1.1 + 11 ô màn đã tự chặn sẵn).
   - (e) `collectAllSignals(nguồn từ store, new Date(FIXED_NOW))` (cách dựng nguồn như `$SP/hardening/asg-recipients.mjs`): với mỗi tín hiệu, người xem =
     mọi vai trò trong `recipientRolesFor(signal)` ∪ vai trò của từng `recipientUserIds` (tra tài khoản nhân viên → `DEMO_ACCOUNTS`) ∪ (nếu tín hiệu có `group`) mọi vai trò
     có `VIEW` trên `ALERT_GROUP_RESOURCE[group]`. `resolveLink(signal, can của vai trò đó)` phải **khác `undefined`** và `canAccessPath(...) === true` → vi phạm = **0**.
     `EMPLOYEE_ASSIGNMENT`: link giải được theo vai trò khớp `employeeAssignmentLinks` của file kỳ vọng (`DISPATCHER` → `/schedule/dispatch`; người được giao → `/rentals/<id>?tab=assignment`).
7. **Harness N4** `$SP/hardening/n4-r1.mjs` (`dev` viết; `boot()` một lần, chụp `new Map(store)`, **khôi phục store trước mỗi ca**; gọi thẳng
   `load('/src/features/handover-return/api.ts')`, actor `usr_manager`/`MANAGER`; ca cần điều kiện thì sửa `store` trước khi gọi): đúng 10 ca **C1–C10 bảng §2.5**,
   in `PASS`/`FAIL` từng ca + `ALL PASS`. Mỗi ca in số audit thêm vào và các `action` đó. C6 phải xác nhận **không** có thay đổi nào ở `handoverRecords`/`returnRecords`/
   `rentals`/`vehicles`/`audit` (so chuỗi JSON trước/sau). C9 gọi trực tiếp 2 hàm thuần với mọi dòng 2 bảng §2.2 (10 dòng).
8. Lệnh kiểm tĩnh: `grep -rn "role ===" src/app src/features/auth/components src/shared/layout` rỗng; `grep -n "'RENTED'\|'AVAILABLE'" src/features/handover-return/api.ts` rỗng
   (giá trị trạng thái chỉ nằm ở hàm thuần `model.ts`).
9. `git status` chỉ gồm: `src/app/{routes,routeAccess}.ts(x)`, `src/features/auth/{index.ts,components/RequirePermission.tsx}`, `src/shared/layout/NoPermissionState.tsx`,
   `src/shared/domain/{alerts,enums}.ts`, `src/shared/i18n/{vi,auditLabels}.ts`, `src/features/notifications/{model,index}.ts`, `src/features/notifications/components/NotificationCard.tsx`,
   `src/features/dashboard/components/AlertPanel.tsx`, `src/features/employees/{model.ts,screens/EmployeeDetailScreen.tsx}`, `src/features/handover-return/{api,model,hooks}.ts`,
   `src/features/handover-return/components/{HandoverCancelDialog,ReturnCancelDialog}.tsx`, `src/features/vehicles/api.ts` (+ `src/features/audit/model.ts` nếu TS buộc). Không file `docs/`.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026) — người dùng tự kiểm.

### 11.7. File `dev` đọc trước (đúng danh sách — không scan rộng `src/` hay `../thien-bao-car-docs/modules/`)

1. File này: §0, §1, §2, §6 (H1–H5), §8, §9, §10 (gồm ghi chú điều chỉnh), §11.
2. `CONVENTIONS.md` §1, §3, §4, §6, §10, §11 · `docs/ARCHITECTURE.md` §5, §7.
3. Nghiệp vụ (chỉ các mục): `../thien-bao-car-docs/modules/VehicleHandover-UseCase.md` §18 (dòng 653–686) · `../thien-bao-car-docs/modules/VehicleReturn-UseCase.md`
   §23 (dòng 864–897) · `../thien-bao-car-docs/modules/VehicleReturn-BRD.md` dòng 740–752, 820, 827–829.
4. Code — guard: `src/app/{routes.tsx,paths.ts}` · `src/shared/layout/{nav.tsx,AppShell.tsx,PageHeader.tsx}` · `src/features/auth/{index.ts,usePermission.ts}` ·
   `src/shared/domain/permissions.ts` (chỉ kiểu `Resource`/`Action` + `can`, dòng 18–62, 597–611) · `src/features/auth/screens/PermissionMatrixScreen.tsx` dòng 40–50 (mẫu trạng thái không quyền).
5. Code — link: `src/shared/domain/alerts.ts` · `src/features/notifications/{model.ts (dòng 40–260),index.ts}` · `src/features/notifications/components/NotificationCard.tsx` ·
   `src/features/dashboard/components/AlertPanel.tsx` · `src/features/employees/model.ts` dòng 280–312 · `src/features/employees/screens/EmployeeDetailScreen.tsx` dòng 100–130, 190–205.
6. Code — N4: `src/features/handover-return/{api.ts,model.ts,hooks.ts}` · `src/features/handover-return/components/{HandoverCancelDialog,ReturnCancelDialog}.tsx` ·
   `src/features/vehicles/{api.ts,model.ts dòng 80–100}` · `src/features/rentals/api.ts` dòng 40–110, 270–335 · `src/shared/domain/enums.ts` dòng 20–30, 99–113, 513–680 ·
   `src/shared/i18n/auditLabels.ts` dòng 1–40 · `src/shared/lib/audit.ts`.
7. Harness: `$SP/demo-data/lib.mjs` · `$SP/hardening/{expect-guard-r1.json,asg-recipients.mjs,n4-peek.mjs,run-harness.sh,initial-load.mjs,dump-seed.mjs,diff-seed.mjs}`.

### 11.8. Báo cáo bàn giao `dev` phải có

Danh sách file đổi (khớp `git status`) · output rút gọn DoD 1–8 (tải đầu tổng, SCC diff, `evalorder`, bảng `run-harness` HCM + UTC, `diff-seed`, `guard-r1` (a)–(e) kèm ma trận
6 × 18, `n4-r1` C1–C10 kèm audit từng ca, 2 lệnh grep) · các khoá `vi` mới · mọi chỗ lệch plan + lý do.

### 11.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: 3 cổng sạch (2 cảnh báo `oxlint` cũ) · không `*/` kẹt · SCC = `scc-target.txt` (98 file) · `evalorder` OK (`routes.tsx`, `routeAccess.ts`) ·
`guard-r1.mjs` ALL PASS (34 path / 18 khối / nav lệch 0 / 29 ô chặn / 130 cặp tín hiệu × người xem, 0 vi phạm; `EMPLOYEE_ASSIGNMENT`: `DISPATCHER` →
`/schedule/dispatch`, người được giao → lượt thuê) · `n4-r1.mjs` C1–C10 ALL PASS (C6 ném lỗi, không ghi gì, audit +0) · `diff-seed` 0 · `run-harness` HCM: 6/8 file
`diff=0`, 2 file lệch đúng như `dev` báo (L3). Đọc diff: hàm thuần N4 đúng 2 bảng §2.2, `TODO(OQ)` đủ N4-1…4; quyết định tính **trước** mọi ghi; ghi xe qua
`applySystemStatusChange` có audit riêng; import E1 sâu `vehicles/api`; `resolveLink` dùng ở cả `NotificationCard` và `AlertPanel`.

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | Tải đầu **1.863.679 B** (+6.664 B; vượt ngân sách R1 3.664 B, dưới trần 1.870.000) | **Chấp nhận — phân bổ lại ngân sách (§8 mục 2).** Tăng thật do nội dung: chunk chính +5.912 B (18 khối `RequirePermission` trong `routes.tsx`, `routeAccess.ts`, `NoPermissionState`, 2 hàm N4 + `applySystemStatusChange`, ~0,9 kB chuỗi `vi` UTF-8), `clsx` +677 B, `paths` tách chunk riêng 1.328 B (đổi chỗ, `alerts` −1.315 B). Không có phụ thuộc thừa; thu nhỏ trong R1 chỉ có cách tải lười `NoPermissionState` — không đáng. Ước tính ban đầu thiếu phần JSX bọc 18 nhóm. |
| L2 | `grep "role ==="` khớp `Topbar.tsx:77` (dấu ✓ ở dropdown đổi vai trò, có từ trước) | **Chấp nhận** — lỗi lệnh DoD: dòng này so vai trò đang chọn để đánh dấu, không phải kiểm quyền. Từ R2 lệnh loại trừ `Topbar.tsx`. |
| L3 | `notif-r2`: key `notifications` 18.665 → 18.809 ký tự (thêm `linkFallback` cho 4 event phân công), vẫn PASS · `platform-r4a`: kiểm "`CONFIG_CHANGE` là phần tử cuối" FAIL vì R1 nối action mới | **Chấp nhận.** Thay đổi đúng thiết kế. `tech-lead` sửa `$SP/phase6/platform-r4a.mjs` (bản cũ `platform-r4a.mjs.bak-r1`): kiểm `CONFIG_CHANGE` đứng ngay sau `VIEW_AUDIT_SENSITIVE_VALUE` → ALL PASS. **Chụp lại baseline** sau commit R1 ở `$SP/hardening/baseline-r1/` (HCM + UTC) + `base-r1-{hcm,utc}.json` — mốc "y hệt" của R2. |
| L4 | `consignment` tách 2 khối (`VIEW` / `ASSESS`) | **Chấp nhận** — đúng `ROUTE_ACCESS` / `expect-guard-r1.json`. |

`tech-lead` tự sửa thụt lề 6 khối `<Suspense>` trong `routes.tsx` (chỉ khoảng trắng, `git diff -w` không đổi). Cập nhật `docs/ARCHITECTURE.md` §5, `CONVENTIONS.md` §3, §6
(route mới phải nằm trong `RequirePermission`).

**Nợ ghi nhận (không chặn):** **H-N1 —** `applySystemStatusChange` ném lỗi `from === to` bằng chuỗi viết tại chỗ (cùng quy ước N12). **H-N2 —** thông báo đã lưu
trước R1 không có `linkFallback` tới khi Reset dữ liệu demo (chỉ thông báo phân công của `DISPATCHER`; bấm vào → "Không có quyền").

---

## 12. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 23/10/2026 | **R1 `DONE`** — review vòng 1 đạt, không Blocker; chấp nhận L1–L4 (L1: phân bổ lại ngân sách tải đầu; L3: sửa harness `platform-r4a`, chụp baseline mới `baseline-r1/`) — §11.9. |
| 23/10/2026 | **`APPROVED`** — người dùng duyệt cả 6 điểm §10. Điều chỉnh kỹ thuật phương án B (link theo người xem — `linkFallback`, vì người được giao `OPERATION_STAFF` thiếu `ASSIGNMENT.VIEW`). Viết brief R1 (§11), **giao `dev`**; dựng `hardening/{expect-guard-r1.json,asg-recipients.mjs}`. |
| 23/10/2026 | Tạo kế hoạch (`DRAFT — CHỜ NGƯỜI DÙNG DUYỆT`). Đo HEAD `ef42332`: tải đầu 1.857.015 B, SCC 98 file (mô phỏng tách barrel → 0), 18 ô vai trò × nhóm route lọt quyền, seed lệch 2.818 bản ghi giữa HCM/UTC, 69 file phụ thuộc giờ trình duyệt. Dựng script + baseline ở `$SP/hardening/`. |
