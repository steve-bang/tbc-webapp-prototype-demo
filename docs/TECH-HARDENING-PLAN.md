# Kế hoạch — Vòng kỹ thuật sau Phase 6: Route guard · N4 · N8 (múi giờ) · Gỡ vòng import (Phase 6.1)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** **`APPROVED`** (23/10/2026 — người dùng duyệt cả 6 điểm §10 theo đề xuất; các Round
chạy liên tục R1 → R2 → R3a → R3b, không dừng chờ duyệt giữa chừng) · **R1 — `DONE`** (23/10/2026, brief §11, review `tech-lead` đạt vòng 1, không Blocker — §11.9) · **R2 — `DONE`** (23/10/2026, brief §12, review đạt vòng 1, không Blocker — §12.9; SCC 98 → 0) · **R3a — `DONE`** (23/10/2026, brief §13, review đạt vòng 1, không Blocker — §13.9) · **R3b — `DONE`** (23/10/2026, brief §14, review đạt vòng 1, không Blocker — §14.9) · **PHASE 6.1 — `DONE`** (23/10/2026; tổng kết §14.10)
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
   R3 thay các hàm lịch `date-fns` bằng helper date key nên kỳ vọng ±0).
   **Sau R2 (§12.9 L1 — thực tế 1.869.188 B, dư 812 B):** R3a+R3b vẫn ≤ **1.870.000** (trần D11 không đổi — nâng trần là quyết định của người dùng).
   R3 phải tự bù phần helper bằng cách bỏ hàm `date-fns` thay thế được; vượt trần → dừng, báo `tech-lead` (phương án ở §12.9). Vượt ngân sách Round nhưng còn dưới trần → báo lại, không tự tải lười thêm.
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

## 12. Round 2 — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 12.1. Bối cảnh

R1 đã `DONE` (commit `a897c94`). Cả `src/` hiện có **một vòng import lớn (SCC) gồm 98 file**. Nguyên nhân duy nhất (§3.1): barrel `features/<x>/index.ts`
trộn **dữ liệu** (type, `api`, `model`, `hooks`, storage key) với **màn hình/component**. Ví dụ `finance/payment/ledger.ts` cần `RENTALS_STORAGE_KEY` →
`rentals/index.ts` → `RentalDetailScreen` → `finance/index.ts` → … → `ledger.ts`. Mô phỏng ở mức symbol (§3.3): chỉ cần tách mỗi barrel thành 2 điểm nhập là
**SCC = 0**.

Round này là **refactor thuần cơ học, không đổi hành vi**. Diff chỉ gồm dòng `export`/`import`, file `ui.ts` mới và cấu hình lint. Thước đo "không đổi hành vi"
là: dump seed và output toàn bộ harness **y hệt** baseline chụp ở commit R1 (`$SP/hardening/baseline-r1/`, `base-r1-{hcm,utc}.json`).

Người dùng đã duyệt **E2** (2 điểm nhập), **E3** (`import/no-cycle`), **E4** (xoá `audit/index.ts`, `dashboard/index.ts`) — §10 câu 4.

### 12.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §12.5)

1. **Quy tắc tách** áp cho **cả 15 feature** (H6):
   - `features/<x>/index.ts` — **chỉ** dữ liệu: `export type`, hàm/hằng từ `model`/`api`/`hooks`/`storage`/`*Model.ts`/`*Api.ts`. **Không** export gì từ
     `screens/`, `components/`, `lazyScreens.ts`, `lazyWidgets.ts`.
   - `features/<x>/ui.ts` (**mới**) — **chỉ** màn hình và component: mọi export hiện có trong `index.ts` trỏ tới `screens/`, `components/`, `lazyScreens.ts`,
     `lazyWidgets.ts`. Giữ **nguyên tên**, giữ bản **lazy** ở đúng chỗ đang lazy (không chuyển sang import tĩnh, không thêm lazy mới).
   - Mỗi `ui.ts` mở đầu bằng comment 1 dòng: `// Điểm nhập UI của feature (màn hình + component) — TECH-HARDENING-PLAN.md §3.2 (E2). Code không phải UI không import file này.`
   - Mỗi export chuyển sang `ui.ts` **giữ nguyên comment nguồn** đi kèm (vd. `// CONSIGNMENT-PLAN.md §19.7 …`).
   - `type` export kèm theo màn (nếu có) để lại `index.ts`.
2. **Danh sách tách** (đếm từ `index.ts` hiện tại — `dev` đối chiếu lại):

   | Feature | Chuyển sang `ui.ts` |
   | --- | --- |
   | `audit` | `AuditLogScreen` (lazy) → **xoá `index.ts`** (E4) |
   | `auth` | `LoginScreen`, `SystemConfigScreen`/`PermissionMatrixScreen` (lazy), `RequirePermission` |
   | `calendar` | `CalendarScreen`, `DispatchBoardScreen` |
   | `consignment` | `VehicleConsignmentTab`, `OwnerBankAccountField`, `OwnerPayoutStatusBadge`, 7 screen |
   | `contracts` | `ContractListScreen`, `ContractDetailScreen` |
   | `customers` | `CustomerListScreen`, `CustomerDetailScreen` |
   | `dashboard` | `DashboardScreen` → **xoá `index.ts`** (E4) |
   | `employees` | `EmployeeListScreen`, `EmployeeDetailScreen` (lazy) |
   | `finance` | `SettlementListScreen`, `SettlementWorksheet`, `TransactionLedgerScreen`, `CashDrawerScreen`, `RentalPaymentTab`, `CustomerReceivablesScreen`, `CostRecordsScreen`, `VehicleRevenueTab`, `VehicleCostTab`, `VehicleProfitTab`, `FinanceReportScreen` (lazy), `OwnerPayoutScreen`, `DashboardFinanceWidget` (lazy) |
   | `handover-return` | `HandoverReturnListScreen` |
   | `incidents` | `IncidentListScreen`, `IncidentDetailScreen` |
   | `maintenance` | `MaintenanceScreen` |
   | `notifications` | `NotificationBell`, `NotificationCenterScreen` (lazy) |
   | `rentals` | `RentalListScreen`, `RentalDetailScreen` |
   | `vehicles` | `VehicleListScreen`, `VehicleDetailScreen` |

3. **Sửa importer — đúng 7 file** (danh sách đo bằng `$SP/hardening/sim-split.mjs`):
   - `src/app/routes.tsx` — mọi màn + `NotificationBell` + `RequirePermission` lấy từ `@/features/<x>/ui` (15 feature).
   - `src/features/dashboard/screens/DashboardScreen.tsx` — `DashboardFinanceWidget` từ `@/features/finance/ui`.
   - `src/features/rentals/screens/RentalDetailScreen.tsx` — `RentalPaymentTab`, `SettlementWorksheet` từ `@/features/finance/ui`.
   - `src/features/vehicles/screens/VehicleDetailScreen.tsx` — 3 tab tài chính từ `@/features/finance/ui`, `VehicleConsignmentTab` từ `@/features/consignment/ui`.
   - `src/features/finance/payment/components/OwnerPayoutCreateDialog.tsx` — `OwnerBankAccountField` từ `@/features/consignment/ui`. Các `type` vẫn lấy từ `@/features/consignment`.
   - `src/features/finance/payment/screens/OwnerPayoutScreen.tsx` — phần component (`OwnerPayoutStatusBadge`, `OwnerBankAccountField` nếu có) từ `@/features/consignment/ui`. Phần dữ liệu giữ `@/features/consignment`.
   - Nếu `tsc -b` báo thêm importer ngoài danh sách → sửa theo cùng quy tắc và ghi vào "lệch plan".
4. **`.oxlintrc.json`** (E3): `"plugins": ["react", "typescript", "oxc", "import"]`; thêm rule `"import/no-cycle": ["error", { "ignoreTypes": true }]`.
   Đã thử trên HEAD R1: bật plugin `import` chỉ sinh lỗi `no-cycle` (196 lỗi), không sinh cảnh báo loại khác. Sau khi tách barrel mà `no-cycle` vẫn báo
   (vd. vòng qua `import()` động của `lazyScreens`, hoặc vòng type-only mà `ignoreTypes` không bỏ được): **không** tắt rule, **không** sửa logic để né. Dừng lại,
   báo danh sách file + chuỗi vòng cho `tech-lead` quyết.

### 12.3. Ngoài phạm vi R2 (không làm dù "tiện tay")

Gom 89 import sâu chéo feature vào barrel (R2b — tuỳ chọn, sau R3b) · đổi import E1 `handover-return/api.ts → @/features/vehicles/api` · đổi nội dung bất kỳ hàm,
component, màn hình nào · thêm/bớt tải lười · đổi thứ tự `registerSeeds.ts` · đổi seed / `SEED_VERSION` (giữ 26) · đổi `permissions.ts`, `routeAccess.ts` · sửa ngày giờ (R3) ·
sửa `CONVENTIONS.md` / `docs/` (`tech-lead` làm khi bàn giao) · chạy trình duyệt.

### 12.4. Quy tắc bắt buộc

- `CONVENTIONS.md` §3, §11; `docs/ARCHITECTURE.md` §2, §7 (quy tắc tải lười: bản lazy vẫn là bản được export).
- Diff `src/` chỉ gồm: dòng `export … from` / `import … from`, comment đi kèm export, file `ui.ts` mới, 2 file `index.ts` bị xoá. Bất kỳ dòng nào khác → ghi lý do trong báo cáo.
- Code không phải UI (`api.ts`, `model.ts`, `hooks.ts`, `seed.ts`, `storage.ts`, `*Model.ts`, `*Api.ts`, `ledger.ts`, `seedHelpers.ts`) **không** import `@/features/<x>/ui`.
- `shared/` không import `@/features/<x>/ui`.
- Gặp chỗ plan không khớp code → làm theo ý plan, ghi "lệch plan". Không có quyết định nghiệp vụ nào trong Round này.

### 12.5. Thứ tự làm

1. Tạo 15 `ui.ts` và chuyển export như mục 2 (`index.ts` bỏ dòng tương ứng; xoá `audit/index.ts`, `dashboard/index.ts`).
2. Sửa 7 importer (mục 3), rồi chạy `npx tsc -b` cho tới khi sạch.
3. Chạy DoD 3 + 4 (SCC phải = 0) **trước** khi bật lint.
4. Bật `import/no-cycle` (mục 4), rồi chạy `npx oxlint`.
5. Chạy toàn bộ DoD 1–9.

### 12.6. Definition of Done R2 — chạy đủ và dán kết quả vào báo cáo

1. `npx tsc -b` · `npx oxlint` (**có** `import/no-cycle`) · `npm run build` sạch (chỉ 2 cảnh báo `only-export-components` cũ). `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `node $SP/hardening/initial-load.mjs $REPO` (sau build) → `INITIAL_JS` ≤ **1.864.679** (R1 1.863.679 + 1.000). Báo chênh lệch so với 1.863.679.
3. `node $SP/consignment-r3/sccfiles.mjs $REPO` → **rỗng**. `node $SP/hardening/scc-edges.mjs $REPO | tail -1` → `SCC count 0 sizes []`.
4. `evalorder` OK cho từng file: `/src/app/routes.tsx`, mọi `/src/features/<x>/index.ts` còn lại (13), mọi `/src/features/<x>/ui.ts` (15). Ví dụ:
   `for f in $REPO/src/features/*/index.ts $REPO/src/features/*/ui.ts $REPO/src/app/routes.tsx; do node $SP/tl-verify/evalorder.mjs $REPO "${f#$REPO}"; done`
   → 29 dòng `OK`.
5. Kiểm tĩnh (cả 3 phải rỗng):
   - `grep -nE "(screens|components)/|lazyScreens|lazyWidgets" $REPO/src/features/*/index.ts`
   - `grep -rnE "from '@/features/[a-z-]+/ui'" $REPO/src/features $REPO/src/shared --include=api.ts --include=model.ts --include=hooks.ts --include=seed.ts --include=storage.ts --include='*Model.ts' --include='*Api.ts' --include=ledger.ts --include=seedHelpers.ts`
   - `grep -rnE "from '@/features/[a-z-]+/ui'" $REPO/src/shared`
6. **Hành vi y hệt — seed:** `TZ=Asia/Ho_Chi_Minh node $SP/hardening/dump-seed.mjs $REPO $SP/hardening/r2-hcm.json && node $SP/hardening/diff-seed.mjs $SP/hardening/base-r1-hcm.json $SP/hardening/r2-hcm.json`
   → `TOTAL diff records 0`. Làm lại với `TZ=UTC` so với `base-r1-utc.json` → 0.
7. **Hành vi y hệt — harness:** `bash $SP/hardening/run-harness.sh $REPO Asia/Ho_Chi_Minh $SP/hardening/r2-out $SP/hardening/baseline-r1` và cùng lệnh với `UTC`
   → **16/16 dòng `diff=0`** (dưới UTC `notif-r2` FAILS 8 và `signals-r1` 28 là nợ N8 có sẵn trong baseline — phải giữ y hệt).
8. Harness R1 vẫn ALL PASS: `TZ=Asia/Ho_Chi_Minh node $SP/hardening/guard-r1.mjs $REPO` và `TZ=Asia/Ho_Chi_Minh node $SP/hardening/n4-r1.mjs $REPO`. Nếu 2 harness này
   import đường dẫn barrel cũ (vd. `@/features/auth` cho màn) thì sửa import trong harness (ngoài repo) và ghi lại.
9. `git status`: 15 `ui.ts` mới · 13 `index.ts` sửa · 2 `index.ts` xoá (`audit`, `dashboard`) · 7 importer (mục 3) · `.oxlintrc.json`. Không file `docs/`. Báo số file (kỳ vọng 37 + 1).

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026).

### 12.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §3 (toàn bộ), §6 (H6), §8, §10 câu 4, §11.9 (L1 — ngân sách tải đầu), §12.
2. `CONVENTIONS.md` §3, §11 · `docs/ARCHITECTURE.md` §2, §7.
3. 15 file `src/features/<x>/index.ts` (toàn file) · `src/features/*/screens/lazyScreens.ts` (4 file) · `src/features/finance/revenue-cost/{screens/lazyScreens.ts,components/lazyWidgets.ts}`.
4. 7 importer ở mục 3 (chỉ khối `import` đầu file) · `.oxlintrc.json`.
5. Script: `$SP/hardening/{sim-split.mjs,scc-edges.mjs,graph.mjs,run-harness.sh,dump-seed.mjs,diff-seed.mjs,initial-load.mjs}` · `$SP/tl-verify/evalorder.mjs`.

Không cần đọc tài liệu nghiệp vụ ở `../thien-bao-car-docs/` — Round này không chạm nghiệp vụ.

### 12.8. Báo cáo bàn giao `dev` phải có

Danh sách file đổi (khớp `git status`, có số đếm) · output rút gọn DoD 1–8 (tải đầu + chênh lệch, SCC, 29 dòng `evalorder`, 3 lệnh grep, `diff-seed` HCM/UTC, bảng `run-harness` HCM + UTC,
`guard-r1`/`n4-r1`) · bảng "feature → export đã chuyển sang `ui.ts`" (đối chiếu mục 2) · mọi dòng diff không phải `export`/`import` + lý do · mọi chỗ lệch plan.

### 12.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: `tsc -b`/`oxlint` (có `import/no-cycle`, 0 lỗi)/`build` sạch · `sccfiles.mjs` rỗng, `scc-edges` `SCC count 0` · `run-harness` HCM + UTC **16/16 `diff=0`** so
`baseline-r1` · `diff-seed` HCM 0 · `guard-r1` ALL PASS · `n4-r1` ALL PASS (sau khi sửa C10). Đọc diff: chỉ dòng `export`/`import`/comment; `index.ts` không còn export UI; bản lazy giữ nguyên.

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | Tải đầu **1.869.188 B** (+5.509 so với R1; vượt ngân sách R2 4.509 B; dư 812 B dưới trần) | **Chấp nhận (b).** Đo nguyên nhân (`$SP/hardening/initial-modules.mjs`, build `--sourcemap` R1 vs R2): **tập module nguồn trong tải đầu y hệt — 0 thêm, 0 bớt**; không module lazy nào bị kéo vào tải đầu. Phần tăng là chi phí ranh giới chunk: Rolldown chia tải đầu từ 10 thành 16 file (`hooks` 131 kB, `cn`, `button`, `model`×2, `sheet`, `x`, `auth` 25 B…) vì đồ thị phụ thuộc giữa chunk lười và chunk chính đổi khi barrel không còn trộn màn hình → thêm câu lệnh import/export giữa chunk và tên export không bị rút gọn. **gzip chỉ +660 B** (464.409 → 465.069). Không có sửa nhỏ nào trong phạm vi R2 trả về số cũ (lựa chọn (a) không áp dụng). Không nâng trần (c). Hệ quả cho R3: §8 mục 2. Đòn bẩy dự phòng nếu R3 vượt: tải lười thêm một phần ít dùng của chunk chính hoặc cấu hình `build.rolldownOptions.output.codeSplitting` gom chunk tải đầu — cả hai cần `tech-lead` duyệt trước; nâng trần D11 cần người dùng. |
| L2 | `n4-r1` C10 FAIL (so target 98 file cũ) | **Chấp nhận** — harness lỗi thời. `tech-lead` sửa C10 thành "`sccfiles.mjs` rỗng" (bản cũ `n4-r1.mjs.bak-r2`) → ALL PASS. |
| L3 | 6 importer thay vì 7 | **Chấp nhận** — `OwnerPayoutCreateDialog.tsx`/`OwnerPayoutScreen.tsx` đếm theo file; `tsc` không báo thêm. |
| L4 | Xoá comment nguồn mồ côi trong `index.ts` của `calendar`, `employees`, `finance` | **Chấp nhận** — comment đi kèm export đã chuyển sang `ui.ts`. |

`tech-lead` sửa `$SP/hardening/run-harness.sh` nhận đường dẫn tương đối. Cập nhật `CONVENTIONS.md` §3 (2 điểm nhập, `import/no-cycle`) và `docs/ARCHITECTURE.md`
§2, §7. Baseline mới ở commit R2: `$SP/hardening/baseline-r2/`, `base-r2-{hcm,utc}.json`.

## 13. Round 3a — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 13.1. Bối cảnh

R2 đã `DONE` (commit `9bcb814`, SCC = 0). Nợ **N8**: app tính ngày/giờ theo **giờ trình duyệt**, trái `SA-BR-14` ("timestamp toàn hệ thống dùng một múi
giờ thống nhất, mặc định UTC+7") và `WebappQuanTri.md` §13 ("múi giờ hiển thị thống nhất theo cấu hình toàn cục"). Số đo trên baseline R2 (§0, §4):

- Seed sinh ra khác nhau theo giờ máy: HCM vs UTC lệch 2.818 bản ghi; HCM vs New_York lệch 2.830 bản ghi và còn khác **số lượng** (285 lượt thuê mới thay vì 284).
- Harness dưới UTC: `signals-r1` 28 tín hiệu (đúng là 30), `notif-r2` FAILS 8, `verify` errors 18. Dưới New_York: `notif-r2` FAILS 11.

Round 3a làm **nền + dữ liệu + logic** (§4.3): helper múi giờ cố định trong `shared/lib/datetime.ts`, cùng 13 file seed và 15 file logic `.ts`. Kết quả phải là:
seed và mọi harness **giống hệt nhau dưới mọi giờ máy**, và **giống hệt baseline HCM** của R2. **Không** sửa file `.tsx` — đó là việc của R3b.

Người dùng đã duyệt (§10 câu 5): (a) tự viết helper, **không** thêm thư viện; (b) chấp nhận đổi hành vi do sửa lỗi cắt ngày theo UTC; (c) `SEED_VERSION` 26 → **27**.

### 13.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §13.5)

1. **`src/shared/lib/datetime.ts` — helper múi giờ cố định** (API như §4.2; comment đầu file trích `SA-BR-14` + `TECH-HARDENING-PLAN.md` §4):
   - `SYSTEM_TIME_ZONE = 'Asia/Ho_Chi_Minh'`, `SYSTEM_UTC_OFFSET_MINUTES = 420`. Comment: không có giờ mùa hè từ 1975 nên offset cố định là chính xác;
     `TODO(OQ: TECH-HARDENING-PLAN.md §9 OQ-N8-1)` — múi giờ có cấu hình được không.
   - Hàm thuần **không** dùng `Intl` và **không** dùng getter/setter giờ địa phương (`getHours`/`setDate`/`new Date(y, m, d)`…). Chỉ được dùng `Date.UTC`, `getUTC*`,
     `getTime`, `toISOString`. Ví dụ: `zonedParts(value)` = `getUTC*` của `new Date(ms + offset)`.
   - Hàm cần có:
     - `zonedParts`
     - `toDateKey(value: string | Date)` — nhận `'YYYY-MM-DD'` thì trả nguyên văn
     - `toMonthKey`, `todayKey(now = new Date())`
     - `zonedDateTimeToIso(dateKey, hour, minute = 0)`
     - `startOfDayIso`, `endOfDayIso`
     - `addDaysToKey`, `addMonthsToKey`, `dayDiff(fromKey, toKey)`
     - `startOfWeekKey(key, weekStartsOn = 1)`, `startOfMonthKey`, `endOfMonthKey`, `eachDayKey(fromKey, toKey)`
     - `isoToDateTimeInput(iso)` ↔ `dateTimeInputToIso(value)`
   - `formatDate` / `formatDateTime` / `formatTime` **giữ nguyên chữ ký và định dạng** (`dd/MM/yyyy`, `dd/MM/yyyy HH:mm`, `HH:mm`) nhưng tự định dạng từ
     `zonedParts`. `formatDate` nhận được cả date key. `formatRelative` giữ `date-fns` (khoảng cách tuyệt đối, không phụ thuộc múi giờ).
   - Các hàm cũ `isSameCalendarDay`, `todayIso`, `addDaysIso`, `daysBetween` giữ chữ ký, đổi ruột theo +07 (`addDaysIso`: cộng ngày theo lịch +07, giữ giờ:phút +07).
2. **Gom helper trùng:**
   - `finance/payment/seed.ts` `localDateKey`/`shiftKey` → dùng helper.
   - `finance/revenue-cost/model.ts` `toLocalDateKey`/`dateKeyOf` và `consignment/model.ts` `toLocalDateKey`/`dayDiff`: **giữ tên export** (có nơi `.tsx` đang
     dùng — R3a không sửa `.tsx`) nhưng thân hàm gọi helper `datetime.ts`. Comment: "giữ tên cho tương thích — gộp ở R3b nếu không còn nơi dùng".
3. **15 file logic `.ts`** (danh sách từ `tz-scan.mjs`):
   `shared/lib/documentStatus.ts` · `features/finance/revenue-cost/{model,reportModel}.ts` · `features/consignment/{model,payoutModel,addendumModel,addendumApi}.ts` ·
   `features/calendar/model.ts` · `features/dashboard/model.ts` · `features/notifications/model.ts` · `features/audit/model.ts` · `features/auth/api.ts` ·
   `features/rentals/api.ts` · `features/vehicles/model.ts` · `features/handover-return/model.ts`.
   Thay mọi điểm thuộc 6 nhóm ở §4.1 (`LOCAL_GETSET`, `DATEFNS_CAL`, `FORMAT_FNS`, `UTC_SLICE`, `LOCAL_CTOR`, chuyển đổi `datetime-local` trong `.ts`) bằng helper:
   - `iso.slice(0, 10)` lấy ngày → `toDateKey(iso)`; `slice(0, 7)` → `toMonthKey`. **Ngoại lệ:** giá trị **đã là** date key thuần (`'YYYY-MM-DD'`) thì cắt chuỗi
     vẫn đúng — giữ nguyên, kèm comment `// date key — không phụ thuộc múi giờ`.
   - `format(x, 'yyyy-MM-dd')` → `toDateKey`; `differenceInCalendarDays` → `dayDiff` trên date key; `startOfWeek`/`addMonths`/`eachDayOfInterval`… → helper.
   - Bỏ import `date-fns` ở file nào không còn dùng.
   - **Giữ nguyên chữ ký mọi hàm export** — `.tsx` không phải sửa.
4. **13 file seed** (`features/{rentals,consignment,contracts,customers,employees,calendar,handover-return,incidents,maintenance,vehicles,audit}/seed.ts`,
   `features/finance/payment/seed.ts`, `features/finance/core/seedHelpers.ts`):
   - Mọi `dt(daysOffset, hour, minute)` → `zonedDateTimeToIso(addDaysToKey(todayKey(now), daysOffset), hour, minute)`.
   - Mọi `isoDateOffset(days)` → `addDaysToKey(todayKey(now), days)`.
   - `new Date(y, m, d)` / `setDate` / `getMonth` → helper date key.
   - `now` lấy đúng như hiện tại (`new Date()` — harness cố định bằng `FIXED_NOW`).
   - Thứ tự và số lần gọi `Math.random()` / `generateId()` **không được đổi** — seed HCM phải trùng từng bản ghi.
5. **`src/shared/fixtures/seedAll.ts`:** `SEED_VERSION` 26 → **27**, comment 1 dòng (`TECH-HARDENING-PLAN.md` §13 — seed không còn phụ thuộc giờ máy; máy
   ngoài UTC+7 cần seed lại).
6. Nếu đạt DoD 6–7 đòi sửa thêm file `.ts` không phải UI ngoài danh sách mục 3–4 → được sửa, ghi vào "lệch plan". **Không** sửa `.tsx`.

### 13.3. Ngoài phạm vi R3a (không làm dù "tiện tay")

- Mọi file `.tsx` (R3b): lưới lịch, bộ lọc ngày, giá trị mặc định "hôm nay" của dialog, `SystemConfigScreen`.
- Đổi định dạng hiển thị; đổi `formatRelative`.
- Thêm thư viện (`@date-fns/tz`, `date-fns-tz`…).
- Đổi cấu trúc entity / giá trị đã lưu: mốc vẫn là ISO `…Z`, date key vẫn là `'YYYY-MM-DD'`.
- Sửa harness `phase6/*`, `demo-data/*` cho "qua" (harness phụ thuộc TZ thì báo `tech-lead`, không tự sửa).
- Tải lười thêm / đổi cấu hình build.
- Sửa `docs/`.

### 13.4. Quy tắc bắt buộc

- `CONVENTIONS.md` §1 (ngày giờ qua `shared/lib/datetime.ts`), §2, §10, §11.
- Mỗi chỗ đổi hành vi **trong HCM** phải kèm comment `// N8 — <mô tả>`. Đây là loại sửa lỗi cắt ngày UTC với mốc 00:00–06:59 +07, ví dụ `calendar/model.ts` cắt
  `pickupDateTime.slice(0, 10)`. Đồng thời liệt kê **từng điểm** trong báo cáo mục "đổi hành vi trong HCM". Harness ở `FIXED_NOW` 10:00 không bắt được loại thay đổi
  này nên danh sách là bắt buộc.
- Trần tải đầu D11 **1.870.000 B** là cứng. Hiện còn dư 812 B (§12.9 L1). Bù phần helper bằng cách bỏ hàm `date-fns` thay thế được. Vượt trần → **dừng, báo
  `tech-lead`**; không tự tải lười, không đổi `vite.config.ts`.
- Gặp quyết định nghiệp vụ mới → dừng, báo lại.

### 13.5. Thứ tự làm

1. Mục 1 (`datetime.ts`), rồi tự kiểm nhanh helper bằng một script scratchpad: chạy dưới `TZ=UTC`/`America/New_York`/`Asia/Ho_Chi_Minh`, các ca biên 06:59/07:00 +07, cuối tháng, năm nhuận.
2. Mục 4 + 5 (seed + `SEED_VERSION`) → DoD 6 (dump 3 TZ).
3. Mục 2 + 3 (logic) → DoD 7 (harness 3 TZ) + DoD 8.
4. Build → DoD 2. Chạy toàn bộ DoD 1–10.

### 13.6. Definition of Done R3a — chạy đủ và dán kết quả vào báo cáo

1. `npx tsc -b` · `npx oxlint` (có `import/no-cycle`) · `npm run build` sạch (2 cảnh báo cũ). `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `node $SP/hardening/initial-load.mjs $REPO` → `INITIAL_JS` ≤ **1.870.000**. Báo chênh lệch so với 1.869.188.
3. `node $SP/consignment-r3/sccfiles.mjs $REPO` rỗng · `evalorder` OK cho `/src/app/routes.tsx` và `/src/shared/lib/datetime.ts`.
4. `node $SP/hardening/tz-scan.mjs $REPO -v | grep -vE '\.tsx$'`: ngoài bảng tổng chỉ còn dòng `shared/lib/datetime.ts`. Dòng `.ts` còn lại (nếu có) → giải thích từng dòng
   (vd. date key thuần — dương tính giả).
5. `grep -rn "toISOString()\.slice" $REPO/src --include=*.ts` rỗng · `grep -rln "from 'date-fns'" $REPO/src --include=*.ts`: in danh sách, chỉ còn file thật sự cần (dự kiến `datetime.ts` cho `formatRelative`).
6. **Seed độc lập múi giờ:** với `Z` ∈ {`Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`}:
   `TZ=$Z node $SP/hardening/dump-seed.mjs $REPO $SP/hardening/r3a-$Z.json` (thay `/` bằng `_` trong tên file), rồi
   `node $SP/hardening/diff-seed.mjs $SP/hardening/base-r2-hcm.json <file>` → **`TOTAL diff records 0` cả 3**. Tức seed mọi múi giờ = seed HCM của R2.
7. **Harness độc lập múi giờ:**
   - `bash $SP/hardening/run-harness.sh $REPO <Z> $SP/hardening/r3a-<Z> $SP/hardening/baseline-r2 Asia/Ho_Chi_Minh` cho cả 3 `Z`. Đối số thứ 5 = so với baseline **HCM**.
   - Kết quả: **24/24 dòng `diff=0`**. Tức dưới UTC/New_York: `signals-r1` = 30, `notif-r2` ALL PASS, `verify` errors 0, `sizes` `TOTAL 1837906`.
   - Ngoại lệ được phép: dòng in thời gian chạy (`ms`) đã bị bỏ khi so.
   - Nếu `audit-r3` lệch ở dòng "≥ 6 module" chỉ do **thứ tự** liệt kê → báo, không sửa harness.
8. **Harness biên ngày** `$SP/hardening/tz-r3a.mjs` (`dev` viết). Dựa trên `boot()` của `$SP/demo-data/lib.mjs`, nhưng cho phép truyền `FIXED_NOW` = **2026-10-22 06:30 +07**
   (= 21/10 23:30 UTC). In:
   - `todayKey()`;
   - KPI vận hành Dashboard (`features/dashboard/model.ts`): giao/nhận hôm nay, đang diễn ra;
   - số tín hiệu theo `eventType` (`collectAllSignals`);
   - `formatDateTime` của 3 mốc mẫu.

   Chạy dưới 3 TZ → **output giống hệt nhau**, và `todayKey` = `2026-10-22`. Lưu output HCM vào `$SP/hardening/tz-r3a-expected.txt`.
9. Harness R1 vẫn ALL PASS: `guard-r1.mjs`, `n4-r1.mjs` (TZ HCM).
10. `git status`: `shared/lib/datetime.ts`, `shared/fixtures/seedAll.ts`, 13 seed, ≤ 15 file logic `.ts` (+ file mục 6 nếu có). **Không có `.tsx`**, không file `docs/`. Báo số file.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026).

### 13.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §0 (dòng "Seed theo TZ", "Dữ liệu giờ sáng sớm"), §4 (toàn bộ), §8, §9 (OQ-N8-1, OQ-N8-2), §10 câu 5, §12.9 (L1), §13.
2. `CONVENTIONS.md` §1, §2, §4, §10, §11.
3. Nghiệp vụ (chỉ dòng): `../thien-bao-car-docs/modules/SystemAdministration-BRD.md` dòng 155, 245, 283 · `../thien-bao-car-docs/WebappQuanTri.md` dòng 845–846, 926.
4. `src/shared/lib/datetime.ts` · `src/shared/fixtures/seedAll.ts` · 13 seed + 15 file logic ở mục 3–4. Đọc quanh dòng mà `node $SP/hardening/tz-scan.mjs $REPO -v` chỉ ra; dùng thêm
   `grep -nE "getHours|getDate\(|getMonth|getFullYear|getDay\(|set(Hours|Date|Month)|new Date\([^)]*,|slice\(0, ?(7|10)\)|format\(|startOf|endOf|differenceIn|eachDay|isToday|isSame|addDays|addMonths|subMonths" <file>`.
5. Harness: `$SP/demo-data/lib.mjs` · `$SP/hardening/{tz-scan.mjs,dump-seed.mjs,diff-seed.mjs,run-harness.sh,initial-load.mjs}` · `$SP/phase6/tzdiff.mjs` (mẫu so tín hiệu theo TZ).

### 13.8. Báo cáo bàn giao `dev` phải có

- Danh sách file đổi (khớp `git status`, có số đếm) và API `datetime.ts` cuối cùng.
- Output rút gọn DoD 1–9:
  - tải đầu + chênh lệch;
  - `tz-scan`;
  - 2 lệnh grep;
  - `diff-seed` × 3;
  - bảng `run-harness` 3 TZ (24 dòng);
  - `tz-r3a` 3 TZ;
  - `guard-r1` / `n4-r1`.
- Mục **"đổi hành vi trong HCM"**: liệt kê từng điểm, kèm ví dụ dữ liệu bị ảnh hưởng trên seed (vd. `rt_019` giao 06:00).
- Mọi chỗ lệch plan.

### 13.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: 3 cổng sạch · tải đầu **1.862.120 B** (−7.068 B so với R2 — bỏ `date-fns` khỏi 16 file `.ts`; dư 7.880 B dưới trần) · SCC rỗng ·
`tz-scan` (file `.ts`) chỉ còn `datetime.ts` · `date-fns` chỉ còn ở `datetime.ts` (`formatRelative`) · `diff-seed` HCM và New_York so `base-r2-hcm` = **0** ·
`run-harness` New_York so baseline **HCM** 8/8 `diff=0` (`signals-r1` 30, `notif-r2` ALL PASS, `verify` 0). Đọc diff: 32 file `src/` (không `.tsx`), 6 chú thích
`// N8 —` đúng chỗ đổi hành vi trong HCM; `datetime.ts` chỉ dùng `Date.UTC`/`getUTC*`/`Date.parse`, date key được hiểu là 00:00 +07.

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | Thêm `dateTimeToMs` (chuỗi `datetime-local` không có `Z` → hiểu theo +07; ISO → `Date.parse`) | **Chấp nhận** — cần cho `rentalDurationDays` nhận giá trị form lẫn ISO mà không phụ thuộc giờ máy. |
| L2 | `export` `quarterRange`/`yearRange` ở `revenue-cost/model.ts` | **Chấp nhận** — hàm thuần, không đổi chữ ký cũ. |
| L3 | Đổi vài chỗ chỉ để `tz-scan` không báo nhầm | **Chấp nhận** — chỉ đổi cách viết, không đổi hành vi (harness 3 TZ `diff=0`). |
| L4 | Giữ `.slice(0, 7)` trên date key, có comment | **Chấp nhận** — đúng ngoại lệ §13.2 mục 3. |
| L5 | 2 file ngoài danh sách (`rentals/model.ts`, `settlement/model.ts` — bỏ `parseISO`) | **Chấp nhận** — §13.2 mục 6. |
| L6 | **Khoảng lệch tạm giữa R3a và R3b:** `.tsx` (vd. `ConsignmentIntakeDialog`/`ConsignmentReturnDialog` `new Date(values.handoverAt)`, khoá ngày ở lưới lịch, giá trị mặc định "hôm nay") vẫn theo giờ trình duyệt trong khi logic `.ts` đã theo +07 | **Chấp nhận, không sửa trong R3a** — chỉ ảnh hưởng trình duyệt ngoài UTC+7 (máy demo ở HCM không đổi), R3b chạy ngay sau và sửa đúng các chỗ này trước tiên (§14.2 mục 1). Giữ R3a "không `.tsx`" để review đọc được ranh giới. |

**Đổi hành vi trong HCM** (`dev` liệt kê, chỉ mốc 00:00–06:59 +07; trên seed chỉ `rt_019` giao 22/10 06:00): `calendar/model.ts` 3 hàm (lưới lịch, chồng lấp khoá xe, lượt bị ảnh
hưởng bởi khoá) · bộ lọc ngày `rentals/api.ts` · `signedDate` mặc định `contracts/seed.ts` (seed không đổi) · `isFutureDateTime` ở `consignment/model.ts`/`payoutModel.ts`.
`tech-lead` cập nhật `CONVENTIONS.md` §1 (quy tắc múi giờ). Baseline mới: `$SP/hardening/baseline-r3a/` (3 TZ) + `base-r3a-hcm.json`.

## 14. Round 3b — brief giao việc cho `dev` (`APPROVED` 23/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 14.1. Bối cảnh

R3a đã `DONE` (commit `da97bd9`). Từ R3a, seed và logic `.ts` đã theo UTC+7 cố định (`SA-BR-14`). Seed và 8 harness cho kết quả giống hệt nhau dưới HCM, UTC và New_York.

Phần **giao diện** (`.tsx`) vẫn đang tính theo giờ trình duyệt. `tz-scan` còn **41 file / 106 dòng**. Vì thế đang có **khoảng lệch tạm** đã được chấp nhận ở §13.9 L6:
khi trình duyệt không ở UTC+7, `.tsx` và logic tính theo hai múi giờ khác nhau. Các chỗ lệch cụ thể:

- `ConsignmentIntakeDialog` / `ConsignmentReturnDialog`: `new Date(values.handoverAt)` đọc ô `datetime-local` theo giờ máy.
- Khoá ngày của lưới lịch Tuần/Tháng: `format(d, 'yyyy-MM-dd')` theo giờ máy, trong khi `calendar/model.ts` đã dùng +07.
- Giá trị mặc định "hôm nay" của khoảng 20 dialog (`new Date().toISOString().slice(0, 10)` / `format(new Date(), …)`) — cắt ngày UTC nên sai vào 00:00–06:59 ngay cả ở HCM.
- Bảng điều phối (`DispatchBoardScreen.tsx:82–89`): đếm "hôm nay" bằng cắt chuỗi UTC — `rt_019` (giao 06:00) không được đếm.

R3b chuyển toàn bộ `.tsx` sang helper `shared/lib/datetime.ts`. Đây là Round cuối của Phase 6.1; R2b là tuỳ chọn, chỉ làm khi người dùng yêu cầu.
Người dùng đã chấp nhận việc đổi hành vi do sửa lỗi cắt ngày UTC (§10 câu 5).

### 14.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §14.5)

1. **Ưu tiên 1 — đóng khoảng lệch L6** (làm trước, chạy `tsc` ngay):
   - **Ô `datetime-local` (8 file):** `RentalFormSheet`, `RentalQuickCreateGate`, `HandoverEditDialog`, `ReturnEditDialog`, `ConsignmentIntakeDialog`,
     `ConsignmentReturnDialog`, và 2 file `.ts` đã có helper (`rentals/model.ts`, `consignment/model.ts`).
     - Hiển thị: dùng `isoToDateTimeInput(iso)`.
     - Đọc: dùng `dateTimeInputToIso(value)`.
     - Giá trị mặc định "bây giờ": `isoToDateTimeInput(new Date().toISOString())`.
     - Bỏ `new Date(<giá trị datetime-local>)` và `format(new Date(), "yyyy-MM-dd'T'HH:mm")`.
   - **Lịch:** `CalendarScreen`, `CalendarWeekGrid`, `CalendarMonthGrid`, `DispatchBoardScreen`.
     - Khoá ngày, ngày đầu tuần/tháng, danh sách ngày trong lưới, chuyển tuần/tháng, "hôm nay" đều dùng helper date key.
     - Phần tính danh sách ngày hiện viết trong component → **tách thành hàm thuần ở `features/calendar/model.ts`**:
       - `weekDayKeys(anchorKey)` → 7 date key, bắt đầu thứ Hai;
       - `monthGridKeys(monthKey)` → các ô lưới tháng (gồm ngày đệm đầu/cuối, đúng số ô hiện tại);
       - `shiftAnchor(anchorKey, view, step)`.
       Component chỉ gọi các hàm này.
     - Nhãn thứ "T2…CN" + `dd/MM` thay `format(d, 'EEEEEE dd/MM', { locale })`: thêm `formatWeekdayShort(dateKey)` vào `datetime.ts`, chuỗi thứ lấy từ `vi.ts`.
       Nếu `vi.ts` đã có mảng tên thứ thì dùng lại.
     - `<input type="month">` của `CalendarScreen`: giá trị dùng `toMonthKey`.
2. **Giá trị mặc định "hôm nay" và giới hạn `max`/`min` của `<input type="date">`:**
   - Mọi `new Date().toISOString().slice(0, 10)`, `format(new Date(), 'yyyy-MM-dd')` → `todayKey()`.
   - Ước tính các file: `IncidentStartRepairDialog`, `IncidentCompleteRepairDialog`, `MaintenanceRecordFormDialog`, `SparePartRecordFormDialog`,
     `ContractSignDialog`, `CostRecordFormDialog`, `CustomerFormSheet`, `CustomerDocumentFormDialog`, `VehicleDocumentFormDialog`, `VehicleBlockFormDialog`,
     `ConsignmentContractFormSheet`, `ConsignmentAddendumDialog`, `ConsignmentTerminationNoticeDialog`, `ConsignmentVehicleLossDialog`, `VehicleOwnerFormSheet`,
     `EmployeeFormSheet`. Đối chiếu bằng `tz-scan.mjs -v`.
3. **Bộ lọc ngày và hiển thị ngày:**
   - Mọi `iso.slice(0, 10)` dùng để so sánh hoặc hiển thị → `toDateKey(iso)` hoặc `formatDate`.
   - Áp cho: `HandoverReturnListScreen`, `VehicleConditionTimelineTab`, `RentalFilters`, `RentalListScreen`, `RentalCancelDialog`, `IncidentCreateDialog`,
     `AuditFilterBar`, `NotificationCenterScreen`, `FinancePeriodPicker`, `FinanceReportScreen`, `CostRecordsScreen`, `DashboardFinanceWidget`, `OwnerPayoutScreen`.
   - Bộ lọc kiểu "từ ngày … đến ngày …" trên mốc ISO: so date key +07, không so chuỗi UTC.
4. **Dọn tương thích của R3a:**
   - 4 file `.tsx` `consignment` còn gọi `toLocalDateKey` (`OwnerPayoutRecordSheet`, `ConsignmentEndDialog`, `ConsignmentVehicleLossDialog`, `ConsignmentAddendumDialog`)
     → chuyển sang `toDateKey`/`todayKey` của `datetime.ts`.
   - Sau đó, wrapper `toLocalDateKey`/`dateKeyOf` ở `consignment/model.ts` và `revenue-cost/model.ts` nào **không còn nơi dùng** thì xoá. Wrapper còn nơi dùng
     (kể cả trong `.ts`) thì đổi nơi dùng sang helper rồi xoá wrapper. Barrel nào có export các wrapper này thì bỏ dòng export.
5. **`SystemConfigScreen`** (`WebappQuanTri.md` §13 dòng 926): thay cảnh báo "bản demo tính theo giờ trình duyệt" (`vi.systemConfig.timezoneWarning`) bằng dòng thông tin:
   "Hệ thống luôn tính ngày giờ theo Asia/Ho_Chi_Minh (UTC+7); trình duyệt của bạn: {tz}". Vẫn hiện múi giờ trình duyệt (`Intl` — **dương tính giả được phép duy nhất**
   của `tz-scan` nhóm `INTL`). Bỏ biến `timezoneMismatch` nếu không còn dùng. Hằng múi giờ lấy `SYSTEM_TIME_ZONE` từ `datetime.ts`, không khai lại.
6. Bỏ mọi import `date-fns` / `date-fns/locale` khỏi `.tsx`. Sau R3b, `date-fns` chỉ còn ở `shared/lib/datetime.ts` (`formatRelative`).

### 14.3. Ngoài phạm vi R3b (không làm dù "tiện tay")

- Đổi định dạng hiển thị (giữ `dd/MM/yyyy`, `dd/MM/yyyy HH:mm`).
- Đổi `formatRelative`.
- Thêm thư viện.
- Đổi seed (`SEED_VERSION` giữ **27**) hoặc cấu trúc entity.
- Đổi logic `.ts` ngoài mục 1 (hàm lịch mới), mục 4 (xoá wrapper) và `datetime.ts` (thêm `formatWeekdayShort`).
- Đổi layout, giao diện lịch, kéo-thả (Phase 2 Round 3 vẫn tạm hoãn).
- R2b.
- Sửa harness `phase6/*`, `demo-data/*`.
- Sửa `docs/`.

### 14.4. Quy tắc bắt buộc

- `CONVENTIONS.md` §1 (quy tắc múi giờ — nay áp cho cả `.tsx`), §2, §8, §10, §11.
- Mỗi chỗ đổi hành vi **trong HCM** (cắt ngày UTC → +07) phải có comment `// N8 — …` **và** được liệt kê trong báo cáo. Ví dụ: Bảng điều phối đếm `rt_019`;
  mặc định "hôm nay" của dialog đúng ngày khi mở lúc 00:00–06:59.
- Chuỗi giao diện mới đặt ở `vi.ts`.
- Trần tải đầu **1.870.000 B** là cứng (hiện 1.862.120). Kỳ vọng giảm, vì lịch nằm trong chunk chính và bỏ được `date-fns`. Vượt trần → dừng, báo `tech-lead`.
- Gặp quyết định nghiệp vụ mới → dừng, báo lại.

### 14.5. Thứ tự làm

1. Mục 1: ô `datetime-local` → `tsc`.
2. Mục 1: lịch, gồm 3 hàm thuần mới → DoD 6.
3. Mục 2–3, rồi mục 4, rồi mục 5–6.
4. Chạy toàn bộ DoD 1–9.

### 14.6. Definition of Done R3b — chạy đủ và dán kết quả vào báo cáo

1. `npx tsc -b` · `npx oxlint` (có `import/no-cycle`) · `npm run build` sạch (2 cảnh báo cũ). `grep -rn '\*/[a-zA-Z]' src/` rỗng. SCC rỗng
   (`node $SP/consignment-r3/sccfiles.mjs $REPO`). `evalorder` OK cho `/src/app/routes.tsx`.
2. `node $SP/hardening/initial-load.mjs $REPO` → `INITIAL_JS` ≤ **1.870.000**. Báo chênh lệch so với 1.862.120.
3. `node $SP/hardening/tz-scan.mjs $REPO -v`:
   - Nhóm `LOCAL_GETSET`, `DATEFNS_CAL`, `FORMAT_FNS`, `UTC_SLICE`, `LOCAL_CTOR` đều **0 dòng ngoài `shared/lib/datetime.ts`**.
   - `INTL` chỉ còn `SystemConfigScreen.tsx` (hiển thị múi giờ trình duyệt).
   - `INPUT` là thẻ `<input type="date|datetime-local">` hợp lệ: liệt kê, và xác nhận mọi giá trị đi qua helper (mục 7).
   - Dòng nào còn ngoài các ngoại lệ trên → giải thích từng dòng.
4. Kiểm tĩnh:
   - `grep -rln "from 'date-fns" $REPO/src` → **chỉ** `src/shared/lib/datetime.ts`.
   - `grep -rn "toISOString()\.slice" $REPO/src` → rỗng.
   - `grep -rn "toLocalDateKey\|dateKeyOf" $REPO/src` → rỗng.
5. **Không đổi dữ liệu/logic:**
   - `TZ=Asia/Ho_Chi_Minh node $SP/hardening/dump-seed.mjs $REPO $SP/hardening/r3b-hcm.json` → `diff-seed` so `base-r3a-hcm.json` = **0**.
   - `run-harness.sh` dưới 3 TZ so `$SP/hardening/baseline-r3a` với đối số thứ 5 `Asia/Ho_Chi_Minh` → **24/24 `diff=0`**.
   - `tz-r3a.mjs` dưới 3 TZ → khớp `$SP/hardening/tz-r3a-expected.txt`.
   - `guard-r1.mjs`, `n4-r1.mjs` ALL PASS.
6. **Harness lịch** `$SP/hardening/tz-r3b.mjs` (`dev` viết; gọi thẳng `features/calendar/model.ts` qua `boot()`/`load()`). Chạy dưới 3 TZ, output **giống hệt nhau**:
   - `weekDayKeys('2026-10-22')` = `2026-10-19 … 2026-10-25`.
   - `monthGridKeys('2026-10')`: in số ô, ô đầu, ô cuối — phải khớp số ô lưới tháng **trước** khi sửa (ghi số đo trước/sau vào báo cáo).
   - `monthGridKeys('2024-02')` gồm `2024-02-29`.
   - `shiftAnchor` tuần ±1, tháng ±1 (`2026-01-31` + 1 tháng).
   - `formatWeekdayShort('2026-10-19')` = nhãn thứ Hai.
   - `rentalsByVehicleInRange` cho tuần 19–25/10 có `rt_019` ở ngày `2026-10-22`.
   - Đếm "giao hôm nay" theo cách mới của Bảng điều phối, nếu đã tách thành hàm thuần. Nếu không tách được thì giải thích; đếm với `FIXED_NOW` 06:30 +07 phải tính `rt_019`.
7. **Bảng rà ô nhập** trong báo cáo, mỗi file `INPUT` một dòng: file · kiểu ô · nguồn giá trị hiển thị · cách đọc lại · mặc định. Mọi `datetime-local` phải đi qua
   `isoToDateTimeInput`/`dateTimeInputToIso`; mọi mặc định "hôm nay" qua `todayKey()`.
8. `SEED_VERSION` vẫn 27. Không file `docs/`.
9. `git status`: liệt kê, có số đếm (dự kiến ~40 `.tsx` + `datetime.ts` + `calendar/model.ts` + `vi.ts` + 2 file model xoá wrapper + barrel nếu có).

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026). Người dùng sẽ tự kiểm lịch Tuần/Tháng, Bảng điều phối và các dialog ngày giờ.

### 14.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §4 (toàn bộ), §8, §10 câu 5, §13.9 (L6, danh sách "đổi hành vi trong HCM"), §14.
2. `CONVENTIONS.md` §1, §8, §10, §11.
3. Nghiệp vụ (chỉ dòng): `../thien-bao-car-docs/WebappQuanTri.md` dòng 845–846, 926 · `../thien-bao-car-docs/modules/SystemAdministration-BRD.md` dòng 245, 283.
4. `src/shared/lib/datetime.ts` (toàn file) · `src/features/calendar/model.ts` · 41 file trong `node $SP/hardening/tz-scan.mjs $REPO -v` (dòng `.tsx`, chỉ đọc quanh dòng bị chỉ ra)
   · `src/features/consignment/model.ts` + `src/features/finance/revenue-cost/model.ts` (chỉ khối wrapper) · `src/shared/i18n/vi.ts` (khối `systemConfig`, `calendar`).
5. Harness: `$SP/demo-data/lib.mjs` · `$SP/hardening/{tz-scan.mjs,tz-r3a.mjs,tz-r3a-expected.txt,run-harness.sh,dump-seed.mjs,diff-seed.mjs,initial-load.mjs}`.

### 14.8. Báo cáo bàn giao `dev` phải có

- Danh sách file đổi (khớp `git status`, có số đếm).
- Output rút gọn DoD 1–7:
  - tải đầu + chênh lệch;
  - `tz-scan`, phân loại các dòng còn lại;
  - 3 lệnh grep;
  - `diff-seed`;
  - bảng `run-harness` 3 TZ;
  - `tz-r3a`, `tz-r3b` 3 TZ;
  - `guard-r1` / `n4-r1`.
- Bảng rà ô nhập (DoD 7).
- Danh sách **"đổi hành vi trong HCM"**.
- Mọi chỗ lệch plan.

### 14.9. Kết quả review & phán quyết (23/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: 3 cổng sạch · tải đầu **1.854.198 B** (−7.922 B so với R3a; dưới cả số trước Phase 6.1 1.857.015) · SCC rỗng · `date-fns` chỉ còn ở `datetime.ts` ·
`toISOString().slice`/`toLocalDateKey`/`dateKeyOf` rỗng · `diff-seed` UTC so `base-r3a-hcm` = 0 · `run-harness` UTC so baseline HCM 8/8 `diff=0` · `tz-r3b` HCM = New_York
(tuần 19–25/10, `rt_019` → ngày 22/10, Bảng điều phối 06:30 +07 có 5 dòng gồm `rt_019`). Đọc diff: ô `datetime-local` ở `HandoverEditDialog`/`ReturnEditDialog`/
`ConsignmentIntakeDialog`/`ConsignmentReturnDialog`/`RentalFormSheet` đều qua `isoToDateTimeInput`/`dateTimeInputToIso` (đóng khoảng lệch L6 §13.9); `git diff -w` chỉ khác 1 dòng
(9 dòng trống thừa bị gộp — chấp nhận).

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | `monthGridKeys` không thêm ngày đệm (lưới Tháng hiện chỉ vẽ ngày trong tháng, 31 ô trước/sau) | **Chấp nhận** — brief viết "đúng số ô hiện tại"; giữ nguyên giao diện. |
| L2 | `RentalCancelDialog`/`IncidentCreateDialog` dùng `toDateKey` (giữ định dạng `yyyy-MM-dd` như cũ) thay vì `formatDate` | **Chấp nhận** — không đổi hiển thị ngoài phạm vi. |
| L3 | 3 file `finance/revenue-cost` đổi `useMemo` → `useState` chỉ để `tz-scan` khỏi báo nhầm | **Chấp nhận** — hành vi không đổi (giá trị khởi tạo một lần như cũ). |
| L4 | Dọn wrapper sang cả file `.ts` còn dùng | **Chấp nhận** — đúng §14.2 mục 4. |
| L5 | `unwrap.mjs` gộp dòng trống | **Chấp nhận** — chỉ khoảng trắng trong file đã sửa. |

**Kiểm riêng `pickupDateTime` (mục 5 của `dev` — `RentalFormSheet` nay lưu ISO `Z` thay vì chuỗi `datetime-local` không múi giờ):** mọi nơi đọc đều đi qua
`toDateKey`/`formatDate*`/`dateTimeToMs` hoặc `new Date(x).getTime()`. Với giá trị **mới** (`Z`) — đúng mọi múi giờ. Với giá trị **cũ** không có `Z`: `Date.parse` hiểu theo
giờ máy → đúng ở HCM; ngoài HCM lệch 7 giờ. Giá trị cũ chỉ còn có thể tồn tại nếu người dùng tạo lượt thuê bằng form **sau** khi lên `SEED_VERSION` 27 (R3a, `da97bd9`) và
**trước** R3b, trên trình duyệt ngoài UTC+7 — mọi dữ liệu trước R3a đã bị seed lại (seed ghi đè key `rentals`). **Không chặn**; ghi nợ H-N3. Hộp thoại ký gửi: đọc code
xác nhận cả giá trị mặc định lẫn giá trị lưu đều qua helper +07.

**Nợ ghi nhận (không chặn):** **H-N3 —** `toMs`/`zonedParts` (`datetime.ts`) và `new Date(x).getTime()` ở `rentals/model.ts` (`hasConflict` vế `existingRentals`, collector),
`handover-return/model.ts`, `CalendarWeekGrid.tsx` hiểu chuỗi không có offset theo giờ máy — nếu cần chắc chắn với dữ liệu cũ, cho `toMs` coi chuỗi
`YYYY-MM-DDTHH:mm[:ss]` không offset là +07 và đổi các chỗ `new Date(x).getTime()` sang `dateTimeToMs` (≈ 6 dòng). `tech-lead` cập nhật `CONVENTIONS.md` §1, `docs/ARCHITECTURE.md` §6a.

### 14.10. Tổng kết Phase 6.1

| Round | Commit | Nội dung |
| --- | --- | --- |
| R1 | `a897c94` | Route guard (`routeAccess.ts` + `RequirePermission`, 18 nhóm, link theo người xem) + N4 (đồng bộ `Vehicle Status` khi huỷ giao/nhận) |
| R2 | `9bcb814` | Tách barrel `index.ts`/`ui.ts` → SCC **98 → 0**, bật `import/no-cycle` |
| R3a | `da97bd9` | Múi giờ UTC+7 cố định cho seed + logic `.ts`; `SEED_VERSION` 27 |
| R3b | (commit này) | Múi giờ UTC+7 cho giao diện `.tsx`; hàm thuần lịch; `date-fns` chỉ còn `formatRelative` |

Số cuối: tải đầu `/dashboard` **1.854.198 B** (trước Phase 6.1: 1.857.015; trần 1.870.000) · SCC **0** · seed **1.837.906** ký tự, **giống hệt dưới mọi múi giờ máy** ·
18 ô vai trò × route lọt quyền → 0 · cả 4 Round đạt vòng 1, không Blocker. Còn lại: **R2b** (gom 89 import sâu chéo feature — tuỳ chọn, chỉ làm khi người dùng yêu cầu) ·
nợ H-N1…H-N3 · OQ §9 (G1/G2, N4-1…4, N8-1/2) cần BA.

---

## 15. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 23/10/2026 | **R3b `DONE` — Phase 6.1 `DONE`** — review vòng 1 đạt, không Blocker; chấp nhận L1–L5, nợ H-N3 (§14.9); tổng kết §14.10. |
| 23/10/2026 | Brief R3b (§14) — **giao `dev`**; baseline ở commit R3a (`da97bd9`): `$SP/hardening/baseline-r3a/` (3 TZ, cả 3 giống hệt) + `base-r3a-hcm.json`. |
| 23/10/2026 | **R3a `DONE`** — review vòng 1 đạt, không Blocker; seed + harness giống hệt nhau dưới HCM/UTC/New_York; tải đầu 1.862.120 B; `SEED_VERSION` 27; chấp nhận L1–L6 (L6: khoảng lệch `.tsx` tới R3b) — §13.9. |
| 23/10/2026 | Brief R3a (§13) — **giao `dev`**; baseline ở commit R2 (`9bcb814`): `$SP/hardening/baseline-r2/` (HCM/UTC/New_York) + `base-r2-{hcm,utc,ny}.json`; `run-harness.sh` thêm đối số so baseline khác TZ. |
| 23/10/2026 | **R2 `DONE`** — review vòng 1 đạt, không Blocker; SCC 98 → 0, bật `import/no-cycle`; chấp nhận L1–L4 (L1: tải đầu 1.869.188 B do chia chunk, tập module không đổi) — §12.9. |
| 23/10/2026 | Brief R2 (§12) — **giao `dev`**; baseline mới ở commit R1 (`a897c94`): `$SP/hardening/baseline-r1/` + `base-r1-{hcm,utc}.json`. |
| 23/10/2026 | **R1 `DONE`** — review vòng 1 đạt, không Blocker; chấp nhận L1–L4 (L1: phân bổ lại ngân sách tải đầu; L3: sửa harness `platform-r4a`, chụp baseline mới `baseline-r1/`) — §11.9. |
| 23/10/2026 | **`APPROVED`** — người dùng duyệt cả 6 điểm §10. Điều chỉnh kỹ thuật phương án B (link theo người xem — `linkFallback`, vì người được giao `OPERATION_STAFF` thiếu `ASSIGNMENT.VIEW`). Viết brief R1 (§11), **giao `dev`**; dựng `hardening/{expect-guard-r1.json,asg-recipients.mjs}`. |
| 23/10/2026 | Tạo kế hoạch (`DRAFT — CHỜ NGƯỜI DÙNG DUYỆT`). Đo HEAD `ef42332`: tải đầu 1.857.015 B, SCC 98 file (mô phỏng tách barrel → 0), 18 ô vai trò × nhóm route lọt quyền, seed lệch 2.818 bản ghi giữa HCM/UTC, 69 file phụ thuộc giờ trình duyệt. Dựng script + baseline ở `$SP/hardening/`. |
