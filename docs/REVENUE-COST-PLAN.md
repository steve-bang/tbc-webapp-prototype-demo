# Kế hoạch triển khai — Phân tích tài chính (Revenue & Cost)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (22/10/2026 — người dùng duyệt, chấp nhận cả
5 đề xuất ở §13: seed lịch sử phương án B · giữ 3 round · tab Tổng quan Vehicle Detail ngoài phạm vi · giữ
nối tiếp `features/finance`, refactor tách thư mục là task riêng sau 4.3 · ghi ngoại lệ form `finance` vào
`CONVENTIONS.md` §7) · **Round 1 `DONE` (22/10/2026 — review đạt vòng 1, không Blocker)** · **Round 2 `DONE`
(22/10/2026 — chi tiết §19; review đạt vòng 1, không Blocker; nợ nhỏ ghi ở `IMPLEMENTATION-PLAN.md` Phase 4.3)** ·
**Round 3 `DONE` (22/10/2026 — chi tiết §20; đạt ở review vòng 2 — Blocker vòng 1: giải thích chênh lệch PSC "Tạm giữ" ở
màn Đối chiếu + `TODO(OQ)`, xem §0.4 điểm 18, đã sửa)** · **Trạng thái tổng: `DONE` — Phase 4.3 xong** — kế hoạch chi tiết
Phase 4.3. Chia **3 round**: Round 1 = lõi dữ liệu (Revenue Line suy
ra từ Settlement/PSC, kể cả đảo quyết toán · Cost Record nhập tay + chi phí suy ra từ Sự cố/Bảo dưỡng ·
góc nhìn thực thu) + màn **Chi phí vận hành** + nối **3 tab Doanh thu/Chi phí/Lợi nhuận ở Vehicle
Detail**; Round 2 = màn **Báo cáo tài chính** phần chính (Tổng quan theo kỳ — CR-2026-018 — + drill-down
theo xe + Report 01/02/05, biểu đồ `recharts`); Round 3 = Report 03/04/06 + đối chiếu ghi nhận ↔ thực thu +
xuất báo cáo CSV.

**Nguồn nghiệp vụ (bản chuẩn):** `../thien-bao-car-docs/modules/RevenueCost-BRD.md` (v1.8 — toàn bộ, đặc
biệt §6-§19, §21-§24, §28). `RevenueCost-UseCase.md` (v1.3) **chỉ dùng** cho luồng bước UC-RV-01/02/03/04/
05/08/11/12/13 và danh mục audit action §20.3 khi BRD không mô tả chi tiết — **không bám UseCase cho ma
trận quyền, mã `RV-BR-19/20`, đánh số Open Question** (§0.4). `WebappQuanTri.md` §5.3, §6.2 (tab Vehicle
Detail), §6.5, §11.2-§11.7. `CR-2026-018/035/036/047/048/050`. Phía nguồn: `RentalSettlement-BRD.md` §12,
§17-§18 (RS-BR-12/13/14) · `Payment-BRD.md` §8, §13 · `DamageIncident-BRD.md` DI-BR-18.

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/PAYMENT-PLAN.md` +
`docs/RENTAL-SETTLEMENT-PLAN.md` (mẫu format + quyết định Phase 4.1/4.2), code hiện có
`src/features/finance/*` (Settlement + Payment, `SEED_VERSION` = 17), `src/shared/domain/enums.ts`
(`COST_CATEGORIES` **scaffold sai** + `ALLOCATION_TYPES` đúng — §0.1), `src/shared/domain/permissions.ts`
(`FINANCE_REPORT.VIEW/CREATE/CONFIG` đã có — §5).

---

## 0. Cảnh báo & quyết định thiết kế — đọc trước khi code

### 0.1. Phát hiện khi đối chiếu tài liệu với code thật

| # | Phát hiện | Xử lý trong plan này |
| --- | --- | --- |
| F1 | `COST_CATEGORIES` trong `enums.ts` (scaffold Phase 0) = `['MAINTENANCE','INCIDENT','CONSIGNMENT_PAYOUT','DELIVERY_FEE','FUEL','OTHER']` — **sai** so với BRD §6.2/§9 (12 giá trị; `DELIVERY_FEE`/`FUEL` là **danh mục doanh thu**, không phải chi phí). Đã grep: **không nơi nào trong `src/` dùng** `COST_CATEGORIES`/`CostCategory` ngoài chính định nghĩa | Sửa đúng theo BRD (§2.5) — sửa scaffold demo cho khớp tài liệu, không phải quyết định nghiệp vụ mới (tiền lệ `SETTLEMENT_STATUSES` ở 4.1) |
| F2 | Chưa có enum danh mục doanh thu (`Revenue Line Category`, BRD §6.1) | Thêm `REVENUE_CATEGORIES` (§2.5) |
| F3 | Chỉ còn **1** `TODO(Phase 4.3)` trong code: `finance/api.ts` dòng ~1201 trong `reverseSettlement()` — "gỡ chốt doanh thu kỳ gốc (UC-RS-16 bước 2)". Ngoài ra `finance/seed.ts` dòng ~377 có `TODO(OQ: Payment-BRD.md §4.2 — phí SePay … → Phase 4.3 RV)` | Xử lý ở §8 — **không cần ghi gì khi đảo** vì Revenue Line suy ra từ `reversals[]` (§0.3 điểm 2); thay TODO bằng comment giải thích. TODO SePay giữ nguyên dạng `TODO(OQ)`, sửa lời dẫn (§8.2) |
| F4 | `MaintenanceRecord`/`SparePartRecord` (`features/maintenance`) **có field `cost` + `date`**, append-only. `WebappQuanTri.md` §6.5/§11.5 + CR-2026-048 (lợi nhuận vận hành gồm "bảo dưỡng, phụ tùng") → là nguồn Cost Record `MAINTENANCE` | Suy ra Cost Entry `MAINTENANCE`, `Source = SYSTEM` (§2.3). Barrel `maintenance` chưa export storage key → thêm 1 dòng re-export read-only (§0.2) |
| F5 | `Incident` có `companyCost`/`insuranceCovered`/`customerCharge`/`closedAt` nhưng **không có** `approvedAt` và không có field "deductible" riêng | Cost Date của chi phí sự cố = `reportedAt` (diễn giải §0.4 điểm 10 + `TODO(OQ)`); deductible coi như đã nằm trong `companyCost` (DI BRD §15 dòng "Deductible mặc định tính vào Company Cost") |
| F6 | Dữ liệu doanh thu seed hiện **rất mỏng**: chỉ **3** Rental `COMPLETED` (`rt_024/025/026`, Settlement `COMPLETED` ở −27/−17/−12 ngày) + 3 PSC; không có Settlement nào từng bị đảo. Báo cáo "theo kỳ", biểu đồ 30 ngày/12 tháng, Top xe sẽ gần như trống khi demo | **Đã chốt phương án B (§13 câu 1):** nối 10 Rental lịch sử vào `rentals/seed.ts` (ngoại lệ có kiểm soát thứ 2 của 4.3 — §0.2) + Settlement/Payment tương ứng (§9.2) |
| F7 | `recharts` **đã có** trong `package.json` (`^3.10.1`) nhưng chưa nơi nào dùng | Không cần thêm dependency. Lần đầu dùng → bundle tăng; nếu `npm run build` cảnh báo chunk > 500 kB thì đó là **warning**, không phải lỗi cổng (§11 Round 2) |
| F8 | `permissions.ts`: `FINANCE_REPORT.CREATE` có `MANAGER: 'TBD'` nhưng `SALES: true` — chép đúng `WebappQuanTri.md` §11.4, nhưng **mâu thuẫn CR-2026-035** (`SALES` ≈ `MANAGER`). Chưa có entry Sửa/Xoá chi phí, Xuất báo cáo | Không sửa entry cũ; thêm 3 entry mới (§5); ghi cho BA (§0.4 điểm 4) |
| F9 | Mã Open Question trong `IMPLEMENTATION-PLAN.md` mục Phase 4.3 **ghi lẫn số của BRD §28 và UseCase §26** (hai danh sách đánh số khác nhau từ câu 9): (15) Period Close ghi "Q10-12" → đúng là **BRD Q11 + Q13** (Q12 là nợ xấu, Q10 là "số ngày khả dụng"); (16) báo cáo/KPI ghi "Q13-16" → đúng là **Q14-Q16** (Q13 là "ai chốt kỳ"). (17) Q10 và (18) Q4 đúng | Sửa lại trong `IMPLEMENTATION-PLAN.md` cùng lần lập plan này; bảng OQ §12 dùng **số BRD §28** |
| F10 | `VehicleOverviewTab.tsx` (tab Tổng quan của Vehicle Detail) cũng có 3 ô Doanh thu/Chi phí/Lợi nhuận đang `—`, và **không** gate `VEHICLE.EXPORT` (tab này hiện cho cả `OPERATION_STAFF`) | **Đã chốt: ngoài phạm vi 4.3** (§13 câu 3) — chỉ nối 3 tab riêng như backlog; `VehicleOverviewTab.tsx` không đụng |

### 0.2. Ranh giới kiến trúc — đụng gì, không đụng gì

| Khu vực | Được phép | Không được phép |
| --- | --- | --- |
| `features/finance/*` | Nối tiếp `model.ts` · `api.ts` · `hooks.ts` · `seed.ts` · `index.ts` (khối mới `// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §x ====`) + component/screen mới. Sửa có kiểm soát: comment `TODO(Phase 4.3)` trong `reverseSettlement` (§8.1); 2 helper invalidate trong `hooks.ts` thêm key analytics (§6.2); dọn nợ rẻ §10 | Đổi hành vi bất kỳ hàm Settlement/Payment nào (đảo quyết toán **không** cần ghi thêm gì — §0.3 điểm 2) |
| **`features/vehicles/screens/VehicleDetailScreen.tsx`** — **ngoại lệ có kiểm soát (lần đầu mở vùng `vehicles/*`)** | **Chỉ**: (1) thêm 1 dòng import `{ VehicleRevenueTab, VehicleCostTab, VehicleProfitTab } from '@/features/finance'`; (2) thay đúng 3 `<VehicleDetailPlaceholder note={vi.vehicles.revenuePlaceholder/costPlaceholder/profitPlaceholder} />` bằng `<VehicleRevenueTab vehicle={vehicle} />` / `<VehicleCostTab vehicle={vehicle} />` / `<VehicleProfitTab vehicle={vehicle} />`; (3) sửa docstring đầu component cho khớp (3 tab tài chính lấy từ `features/finance`). **Giữ nguyên** gate `canViewFinancial = can('VEHICLE','EXPORT')` (CR-2026-036) và vị trí 3 `TabsTrigger` | Đổi tab khác, đổi thứ tự tab, đổi gate quyền, xoá `VehicleDetailPlaceholder` (vẫn dùng cho tab Ký gửi/Phạt nguội), import gì khác từ `finance` |
| `features/vehicles/{model,api,hooks,seed,index}.ts` + mọi component `vehicles/components/*` (kể cả `VehicleOverviewTab.tsx`, `VehicleDetailPlaceholder.tsx`) | **Không đụng một ký tự** (tiền lệ `rentals/RentalDetailScreen.tsx` ở 4.1/4.2: chỉ sửa đúng file màn hình) | — |
| **`features/rentals/seed.ts` — ngoại lệ có kiểm soát MỚI (đã duyệt 22/10/2026, §13 câu 1 — phương án B)** | **Chỉ** nối thêm 10 phần tử `SeedRentalInput` `rt_030`…`rt_039` vào **cuối** mảng `inputs` (sau `rt_029`, có 1 dòng comment khối dẫn §9.2), dựng qua `buildRental` sẵn có. Diff của file này phải **chỉ là dòng thêm** (`git diff` không có dòng `-`) | Sửa 29 bản ghi cũ; sửa `SeedRentalInput`/`buildRental`/`dt`/`beforeIso` (kể cả thêm field `actualPickupDateTime`/`actualReturnDateTime` — `buildRental` không hỗ trợ, chấp nhận Rental lịch sử không có mốc thực tế; hàm thuần đã fallback về lịch dự kiến — §0.4 điểm 13); sửa `rentals/{model,api,hooks,index}.ts` |
| `features/maintenance/index.ts` | Thêm **1 dòng** re-export read-only: `export { MAINTENANCE_RECORDS_STORAGE_KEY, SPARE_PART_RECORDS_STORAGE_KEY } from './api'` (mirror `incidents/index.ts` ở 4.1) | Sửa file khác của `maintenance` |
| `features/calendar/index.ts` | Thêm **1 dòng** re-export read-only `export { useVehicleBlocks } from './hooks'` (cần cho Utilization — §3.5) | Sửa file khác của `calendar` |
| `features/incidents/*` · `handover-return/*` · `customers/*` · `employees/*` · `contracts/*` | Chỉ **đọc** qua export đã có (`INCIDENTS_STORAGE_KEY`, `useIncidents`, `Incident`, `RENTALS_STORAGE_KEY`, `useRentals`, `Rental`…). `useVehicles`/`useCustomers` deep-import `@/features/<x>/hooks` theo tiền lệ đã chấp nhận (`SettlementListScreen.tsx`) | Sửa bất kỳ file nào |
| `shared/domain/enums.ts` | Sửa `COST_CATEGORIES` (F1); thêm enum mới §2.5; nối audit action §7 vào **cuối** `AUDIT_ACTIONS` | Sửa enum khác; chèn giữa |
| `shared/domain/permissions.ts` | Thêm đúng 3 entry §5 | Sửa entry hiện có (kể cả `FINANCE_REPORT.CREATE` — F8) |
| `shared/i18n/vi.ts` | Khối `vi.finance.revenueCost.*` + label map mới; **xoá** 3 khoá mồ côi `vi.vehicles.revenuePlaceholder/costPlaceholder/profitPlaceholder` (R1) | Sửa khoá của feature khác (ngoài 3 khoá vừa nêu) |
| `shared/lib/` | Round 3: thêm `csv.ts` (`toCsv` + `downloadCsv`, có BOM UTF-8 cho Excel) | Sửa file `shared/lib` hiện có |
| `app/paths.ts` · `app/routes.tsx` · `shared/layout/nav.tsx` | R1: path + route + mục menu `financeCosts` = `/finance/costs` ("Chi phí vận hành", nhóm 6, gate `FINANCE_REPORT.VIEW`) — màn hình có trong `WebappQuanTri.md` §11.2. R2: thay `ComingSoon` của `/finance/reports` | `/dashboard` (Phase 6) |

**Phụ thuộc vòng import (đã kiểm):** `vehicles/screens/VehicleDetailScreen.tsx` → barrel `finance`;
`finance` → `@/features/vehicles/hooks` (deep, như hiện có) + `import type { Vehicle } from '@/features/vehicles'`
(**chỉ `import type`** — bị xoá khi biên dịch). Cấm `finance` import **giá trị runtime** từ barrel
`@/features/vehicles` để không tạo vòng barrel ↔ barrel.

**Vị trí code:** nối tiếp vào file hiện có theo bảng `CONVENTIONS.md` §3. `api.ts` (~2.100 dòng) và
`model.ts` (~1.600 dòng) sẽ dài thêm ~600–800 dòng mỗi file. **Đã chốt (§13 câu 4):** 4.3 giữ nối tiếp
vào file hiện có; tách `features/finance` thành thư mục con theo module (RS/PM/RV) là **task refactor riêng
sau 4.3** (backlog `IMPLEMENTATION-PLAN.md` Phase 4.4) — `dev` **không** tự tách/di chuyển code cũ trong 4.3.

**Pattern form (đã chốt §13 câu 5 — ngoại lệ ghi ở `CONVENTIONS.md` §7):** dialog mới dùng **`useState` +
`zod.safeParse()`** giống mọi dialog `finance` hiện có (không trộn `react-hook-form`). Schema đặt ở
`model.ts` và **bắt buộc được dùng thật** trong dialog (không validate inline song song rồi bỏ schema).

**Chuỗi hiển thị:** mọi chuỗi UI + thông báo lỗi trong `vi.ts`/`api.ts` **không chứa tham chiếu tài liệu
nội bộ** (`§…`, `UC-…`, `AC-…`, tên file `.md`, "Phase 4.3"). Được phép trích mã business rule dạng
`RV-BR-04` khi hữu ích (`CONVENTIONS.md` §7). Mã tài liệu đặt trong **comment code**, không trong chuỗi.

### 0.3. Quyết định thiết kế lõi (kỹ thuật — không phải quyết định nghiệp vụ)

1. **Revenue Line KHÔNG lưu — là view suy ra** (`deriveRevenueLines`) từ `settlements` + `postSettlementCharges`.
   Lý do: (a) Settlement `COMPLETED` đã đóng băng số (RS-BR-12: `lines`/`waivers`/`completedTotals`/
   `completedAt`), lưu thêm Revenue Line chỉ tạo nguồn sự thật thứ hai dễ lệch; (b) Period Close **không
   làm** ở bản demo (OQ §12 — UC-RV-15 A1 "số liệu luôn sống") nên không cần "đóng băng" bản sao; (c) khi có
   backend, đây sẽ là bảng/endpoint phía server — `api.ts` vẫn giữ chữ ký `listRevenueLines()`.
2. **Đảo quyết toán (EX-02 BRD / UC-RV-01 A2) xử lý thuần bằng suy ra, KHÔNG ghi thêm gì lúc đảo:**
   `reverseSettlement()` (4.1 R2) đã lưu **bản `COMPLETED` ngay trước khi đảo** vào `Settlement.reversals[i].snapshot`
   (gồm `lines`, `waivers`, `completedAt`) và xoá `completedAt` của bản hiện tại. Do đó với mỗi Settlement:
   ```text
   Với mỗi reversal r trong reversals[] (theo thứ tự):
       dòng của r.snapshot           → Recognition Date = r.snapshot.completedAt   (kỳ gốc — KHÔNG đổi)
       dòng đối ứng (âm, nature REVERSAL) → Recognition Date = r.reversedAt     (kỳ đảo — "ghi âm ở kỳ hiện tại")
   Nếu Settlement hiện tại status = COMPLETED:
       dòng của bản hiện tại         → Recognition Date = completedAt              (quyết toán lại → Revenue Line mới)
   ```
   Kỳ gốc giữ nguyên số (RV-BR-12 tinh thần), kỳ đảo có dòng âm, kỳ quyết toán lại có dòng mới — đúng
   3 bước EX-02. Đảo nhiều lần vẫn đúng (mỗi reversal tự cân bằng).
3. **Id Revenue Line tất định** (`rvl:<settlementId>:<reversalId|current>:<lineId|waiverId>[:rev]`,
   `rvl:psc:<pscId>`) — không `generateId()` vì không lưu; React key ổn định giữa các lần suy ra.
4. **Cost Record lưu riêng CHỈ cho `Source = MANUAL`** (storage key `costRecords`) — vì có vòng đời
   nhập/sửa/huỷ + audit (RV-BR-10/16). Chi phí `INCIDENT` (từ `Incident.companyCost`) và `MAINTENANCE`
   (từ `MaintenanceRecord`/`SparePartRecord`) **suy ra** khi đọc — không sao chép (RV-BR-04/11: sửa ở module
   nguồn, module này chỉ đọc). Hàm đọc phân tích trả về một kiểu thống nhất **`CostEntry`** (§2.3).
5. **Phân bổ theo kỳ (AC-RV-004; BRD §28 Q6 đã chốt "rải theo kỳ hiệu lực" — CR-2026-048):** Cost Record
   nhập tay có `spreadMonths` (1 = không rải). Lưu **một** bản ghi; khi đọc, `expandCostRecord()` tách thành
   `spreadMonths` lát theo tháng (chia nguyên, phần dư dồn lát cuối). Chọn "một Cost Record với thông tin
   phân bổ" trong 2 cách UC-RV-03 bước 3 cho phép → sửa/huỷ một lần, không phải 12 lần.
6. **Góc nhìn thực thu (cash — CR-2026-048, RV-BR-14) suy ra từ sổ giao dịch** (`deriveCashEntries`), dùng
   đúng `isEffectiveTransaction()` của Payment (loại cả cặp đảo) để con số "thực thu" ở báo cáo **trùng** với
   Sổ giao dịch/Công nợ — không tạo định nghĩa thứ hai. Phân loại giao dịch "liên quan doanh thu" ở §3.4.
7. **Chính sách ghi nhận cố định** `REVENUE_RECOGNITION_POLICY = 'ON_SETTLEMENT'` (hằng số, comment
   `CR-2026-048`). **Không** dựng màn cấu hình chính sách (UC-RV-06) / danh mục & phân bổ (UC-RV-07) —
   đã chốt Phase 1 không đổi chính sách, không phân bổ gián tiếp (BRD §7/§10.2); danh mục chi phí còn OQ.
8. **Mọi hàm tổng hợp báo cáo là hàm thuần trong `model.ts`**, nhận mảng đã tải (revenue lines, cost entries,
   cash entries, rentals, vehicles, incidents, blocks…) + `FinancePeriod`. Screen gọi các hook rồi
   `useMemo(() => buildXxx(...))`. Không thêm "endpoint báo cáo" gộp vì sẽ phải đọc storage của `vehicles`
   (barrel không export key, vùng cấm).
9. **Kỳ phân tích = ngày địa phương** (`FinancePeriod = { from: 'YYYY-MM-DD'; to: 'YYYY-MM-DD' }`, bao gồm cả 2
   đầu). Mọi ISO datetime quy về ngày địa phương bằng `toLocalDateKey(iso)` (date-fns `format(parseISO(iso),
   'yyyy-MM-dd')`) trước khi so — tránh lệch ngày do UTC. RV-BR-03: chỉ dùng `Recognition Date`/`Cost Date`,
   **không** dùng `createdAt`.
10. **Không ghi audit cho Revenue Line / Cost Entry suy ra** (UC-RV-16 liệt kê `REVENUE_LINE_CREATE/REVERSE`,
    `COST_INCIDENT_SYNC`): vì không có bản ghi nào được tạo — sự kiện gốc (`COMPLETE_SETTLEMENT`,
    `REVERSE_SETTLEMENT`, `CREATE_POST_SETTLEMENT_CHARGE`, `SET_INCIDENT_LIABILITY`, `CREATE_MAINTENANCE_RECORD`…)
    **đã được audit** ở module nguồn. Ghi cho BA (§0.4 điểm 8). Chỉ audit thao tác người dùng của module
    này: nhập/sửa/huỷ chi phí, xuất báo cáo.

### 0.4. Điểm tài liệu chưa nhất quán / diễn giải — ghi lại cho BA, không tự sửa tài liệu

1. **Trùng mã `RV-BR-19` khác nghĩa:** BRD §21 `RV-BR-19` = `CONSIGNMENT_PAYOUT` (CR-2026-050); UseCase §21
   `RV-BR-19` = "đổi chính sách ghi nhận áp dụng từ kỳ mới". `RV-BR-20` (không xoá Cost Record đã dùng trong
   báo cáo đã xuất) **chỉ có ở UseCase**. Code trích `RV-BR-19` theo nghĩa **BRD**; quy tắc "không xoá" trích
   `RevenueCost-BRD.md §25.4` trong comment.
2. **Đánh số Open Question BRD §28 ≠ UseCase §26** (UseCase dồn số từ câu 9) — đã gây ghi sai mã ở backlog
   (F9). Plan dùng số BRD.
3. **Ma trận quyền BRD §22 ≠ UseCase §22:** "Chốt kỳ" — Accountant `TBD` (BRD) vs ✓ (UseCase); UseCase tách
   "Mở lại kỳ" chỉ Admin; UseCase thêm dòng "Đối chiếu doanh thu ↔ dòng tiền" (✓/✓/✓/✗); "Cấu hình phân bổ"
   Manager `TBD` (BRD) vs ✗ (UseCase). Bám **BRD**; dòng "Đối chiếu" dùng chung `FINANCE_REPORT.VIEW` (giá trị
   trùng).
4. **`SALES` ở "Nhập chi phí thủ công":** `WebappQuanTri.md` §11.4 ghi `SALES ✓` trong khi `MANAGER TBD` — trái
   CR-2026-035 (`SALES` ≈ `MANAGER`). `permissions.ts` đang chép nguyên (`FINANCE_REPORT.CREATE`, SALES `true`).
   3 entry mới (§5) theo đúng CR-2026-035 qua `likeManager()` → hệ quả demo: **`SALES` nhập được chi phí nhưng
   không sửa/huỷ được** (EDIT/DELETE = `TBD`). Cần BA chốt một trong hai.
5. **Danh mục nhập tay:** UC-RV-03 liệt kê 8 loại (có `MAINTENANCE`, không có `VETC`/`TRAFFIC_FINE`); BRD §9
   ghi `VETC`/`TRAFFIC_FINE` nguồn "Return / Manual". Bám **BRD**: cho nhập tay 10 loại = 12 trừ `INCIDENT`
   (RV-BR-04) và `CONSIGNMENT_PAYOUT` (RV-BR-19 BRD). (Return demo không có trường "VETC/phạt công ty chịu" nên
   phần công ty chịu chỉ đi đường nhập tay.)
6. **`MAINTENANCE` vừa suy ra vừa nhập tay:** suy ra từ `MaintenanceRecord` + `SparePartRecord` (`Source =
   SYSTEM` — `WebappQuanTri.md` §6.5/§11.5); vẫn cho nhập tay `MAINTENANCE` (UC-RV-03) cho khoản chưa ghi ở màn
   Bảo dưỡng, form hiện cảnh báo chống trùng. Phụ tùng gộp vào `MAINTENANCE` (BRD không có loại riêng). BA xác
   nhận.
7. **"Xoá" Cost Record nhập tay = huỷ mềm (`status = REVERSED`, bắt buộc lý do), không xoá vật lý:** BRD §18
   cho "sửa/xoá trước chốt kỳ" nhưng BRD §25.4 + UseCase `RV-BR-20` cấm xoá bản ghi đã dùng trong báo cáo đã
   xuất, và demo không theo dõi "đã xuất bản ghi nào". Dùng giá trị `ACTIVE`/`REVERSED` của UseCase §4.1
   (bỏ `IN_CLOSED_PERIOD` vì không làm Period Close).
8. **Audit action:** dùng đúng tên UseCase §20.3 (`COST_MANUAL_CREATE`, `COST_MANUAL_UPDATE`, `REPORT_EXPORT`)
   + **BA đề xuất** `COST_MANUAL_REVERSE` cho huỷ mềm. Không phát `REVENUE_LINE_CREATE/REVERSE`,
   `COST_INCIDENT_SYNC` (dữ liệu suy ra — §0.3 điểm 10).
9. **Ánh xạ khoản mục quyết toán → danh mục doanh thu** (BRD §8 chỉ mô tả theo nguồn): `MISSING_ACCESSORY →
   DAMAGE_RECOVERY`; `RETURN_OTHER`/`MANUAL_OTHER → OTHER`; `CONTRACT_DISCOUNT →` giảm trừ `BASE_RENTAL` (BRD §8:
   "tiền thuê gốc **đã trừ discount**"); `RETURN_DISCOUNT` + waiver `GOODWILL_CREDIT →` giảm trừ `OTHER`; waiver
   `WAIVE_LINE`/`PARTIAL_DISCOUNT →` giảm trừ đúng danh mục của dòng bị miễn (RV-BR-06 "trừ vào Category liên
   quan"). PSC: `TRAFFIC_FINE → FINE_RECOVERY`, `VETC → VETC_RECOVERY`, `INCIDENT → DAMAGE_RECOVERY`,
   `ADJUSTMENT`/`OTHER → OTHER`; `REFUND` = dòng âm (UC-RV-05 bước 2).
10. **Chi phí sự cố:** tính khi `Incident.status ∈ {APPROVED, IN_REPAIR, REPAIRED, CLOSED, WRITTEN_OFF}` và
    `companyCost > 0` (đã "chốt" phần công ty chịu); loại `OPEN/ASSESSING/WAITING_APPROVAL` (chưa chốt),
    `DISPUTED` (đang tranh chấp), `CANCELLED/CLOSED_NO_ACTION`. **Cost Date = `reportedAt`** (UC-RV-02 bước 2
    "ngày chốt / ngày phát sinh theo cấu hình" — không có cấu hình, Incident không có `approvedAt`) →
    `TODO(OQ)`. Rental gắn theo `incident.rentalId` nếu có.
11. **Lợi nhuận cấp kỳ vs cấp xe:** CR-2026-048 chốt lợi nhuận **vận hành theo xe** = Doanh thu − Chi phí
    trực tiếp. Màn Tổng quan theo kỳ hiển thị: Doanh thu · Chi phí trực tiếp · **Lợi nhuận vận hành** (= Σ các
    xe) · Chi phí gián tiếp (hiển thị riêng — AC-RV-009) · "Còn lại sau chi phí chung" (= vận hành − gián tiếp).
    BA xác nhận cách trình bày 2 tầng.
12. **Thực thu "liên quan doanh thu" (BRD §15):** IN = `RENTAL_PAYMENT`, `ADDITIONAL_CHARGE` (gồm `OFFSET` — cọc
    được cấn vào khoản phải thu), `POST_SETTLEMENT_COLLECT`; trừ OUT `OVERPAYMENT_REFUND`, `GOODWILL_REFUND`;
    `ADJUSTMENT` cộng/trừ theo `direction`; **loại** `DEPOSIT`/`DEPOSIT_REFUND` (cọc giữ hộ, không phải doanh thu —
    cùng logic `PAYMENT-PLAN.md` §0.3 điểm 5). Ngày = `confirmedAt ?? performedAt`. Report 06 (dòng tiền vận hành)
    thì tính **mọi** giao dịch thực, **trừ** `method = OFFSET` (không có dòng tiền).
13. **`Rental Count` / `Rental Days` (BRD §12):** `Rental Count` = số Settlement `COMPLETED` có `completedAt` trong
    kỳ (khớp mốc ghi nhận doanh thu). `Rental Days` = số **ngày lịch** trong kỳ mà xe thực sự đang được thuê
    (từ `actualPickupDateTime ?? pickupDateTime` tới `actualReturnDateTime ?? min(expectedReturnDateTime, hôm nay)`,
    chỉ Rental đã giao xe — status ≥ `HANDED_OVER`, trừ `CANCELLED`/`NO_SHOW`) — để `Utilization ≤ 100%`.
14. **"Thực chi" (BRD §15):** chi phí nhập tay không liên kết giao dịch (RV-BR-17) nên phía chi phí không đối
    chiếu được theo bản ghi; R3 hiển thị "Thực chi theo sổ giao dịch" = Σ OUT hiệu lực loại `OWNER_PAYOUT`
    (Phase 5 — hiện 0) kèm ghi chú.
15. **Report 03 "trong kỳ" vs công nợ (BRD §13):** BRD ghi "Trong kỳ, cho mỗi Customer" cho cả 6 cột, nhưng
    `Outstanding` là **số dư tại một thời điểm**, không phải số phát sinh theo kỳ. Diễn giải (R3 — §20.3): `Revenue`,
    `Rental Count`, `Total Spending`, `Collected`, `Incident Count` tính **theo kỳ**; `Outstanding` = **số dư hiện tại**
    (cùng hàm `deriveCustomerBalances` của màn Công nợ khách hàng), ghi rõ trên UI + CSV. BA xác nhận.
16. **Report 06 ≠ thẻ "Thực thu":** Report 06 (BRD §16) là **mọi** dòng tiền thật (gồm cọc thu/hoàn, chi trả chủ xe;
    loại `OFFSET`), còn "Thực thu" (BRD §15) chỉ gồm giao dịch liên quan doanh thu (gồm cả `OFFSET` — cọc cấn vào khoản
    phải thu). Hai con số khác nhau theo định nghĩa; R3 hiển thị **dòng cầu nối** để đối chiếu được (§20.3).
17. **Dữ liệu cá nhân trong báo cáo/xuất file:** BRD RV không liệt kê trường cá nhân cho Report 03 (chỉ "Khách");
    danh sách trường nhạy cảm & quy tắc che còn treo (`AuditLog-BRD.md` §22 Q4, `CustomerManagement-BRD.md` §31 Q17).
    Giả định an toàn: màn + CSV chỉ có **mã khách + họ tên + trạng thái**, không SĐT/CCCD/GPLX/email/địa chỉ; audit xuất
    không chứa dữ liệu cá nhân (§20.2).
18. **PSC "Tạm giữ" (sự cố đang tranh chấp) có được ghi nhận doanh thu không? (phát hiện ở review R3):** RV-BR-07 /
    AC-RV-007 / UC-RS-14 bước 5 ghi PSC vào doanh thu **theo kỳ phát sinh** (demo: `psc.createdAt`); UC-RS-14 A1 chỉ nói
    "khách không đồng ý → khoản tạm giữ", **không** nói có hoãn ghi nhận doanh thu hay không (AC-RS-007 loại dòng
    `DISPUTED` khỏi Final Amount nhưng là dòng **trong** Settlement, không phải PSC; `RentalSettlement-BRD.md` §28 Q13
    "khoản tranh chấp giữ trong Settlement hay tách ra Post-Settlement" còn mở). Hệ quả seed: `psc_003` 900.000 (gắn
    `inc_010` `DISPUTED`) **được** ghi nhận doanh thu → màn Đối chiếu lượt `rt_026` có chênh lệch gồm 900.000 này, trong
    khi màn Công nợ khách hàng để khoản này ở cột "Tạm giữ", **không** cộng vào "Đang nợ". Demo **giữ hành vi R1** (bám
    đúng chữ tài liệu), UI Đối chiếu giải thích chênh lệch + `TODO(OQ)`. BA xác nhận: hoãn ghi nhận doanh thu PSC tới khi
    hết tranh chấp, hay ghi nhận ngay rồi điều chỉnh (PSC `REFUND`) nếu khách thắng tranh chấp.

---

## 1. Phạm vi & chia Round

### 1.1. Vì sao chia 3 round

Phase 4.3 có 3 khối khác bản chất: **lõi dữ liệu** (suy ra Revenue/Cost — nơi dễ sai số nhất, phải đúng
trước khi vẽ gì), **màn báo cáo chính** khách đã xác nhận (CR-2026-018 — Tổng quan + drill-down, lần đầu dùng
`recharts`), và **báo cáo phụ** (khách hàng/sự cố/dòng tiền/đối chiếu/xuất — BRD §16 tự ghi "danh sách báo cáo
cuối cùng cần khách xác nhận", OQ Q14). Round 1 đặt Vehicle Detail cùng lõi dữ liệu vì 3 tab xe chính là
"Report 02 cho một xe" — kiểm chứng công thức trên dữ liệu thật trước khi làm báo cáo toàn đội xe.

### 1.2. Trong phạm vi — Round 1 (lõi dữ liệu + Chi phí vận hành + 3 tab Vehicle Detail)

- Sửa `COST_CATEGORIES`; enum mới §2.5; 3 permission §5; 4 audit action §7 (R1 dùng 3).
- Model: `RevenueLine` (suy ra), `CostRecord` (lưu — chỉ MANUAL), `CostEntry` (view thống nhất), `CashEntry`
  (suy ra), `FinancePeriod` + preset; hàm thuần §3.1-§3.5.
- API/hooks: `listRevenueLines`, `listCostRecords`, `listCostEntries`, `listCashEntries`, `createCostRecord`,
  `updateCostRecord`, `reverseCostRecord` (§6).
- Màn **Chi phí vận hành** `/finance/costs` (`CostRecordsScreen`) + `CostRecordFormDialog` + `CostRecordReverseDialog`.
- 3 tab `VehicleRevenueTab` / `VehicleCostTab` / `VehicleProfitTab` (bảng, **chưa biểu đồ**) + sửa
  `VehicleDetailScreen.tsx` đúng phạm vi §0.2.
- `FinancePeriodPicker` (component dùng chung trong feature).
- Xử lý `TODO(Phase 4.3)` đảo quyết toán (§8.1) + sửa lời dẫn TODO SePay (§8.2).
- Seed: Cost Record nhập tay + lịch sử 10 Rental/Settlement/Payment (phương án B — đã chốt) + 1 Settlement từng
  bị đảo; `SEED_VERSION` 17 → **18** (§9).
- Dọn nợ rẻ §10.

### 1.3. Trong phạm vi — Round 2 (Báo cáo tài chính — phần chính)

- `/finance/reports` → `FinanceReportScreen` (thay `ComingSoon`), tab **Tổng quan** (KPI kỳ + so kỳ trước, biểu
  đồ doanh thu/chi phí theo ngày/tuần/tháng, bảng theo xe click drill-down) · **Doanh thu** (Report 01 + cơ cấu
  danh mục + dòng giảm trừ RV-BR-06 + cảnh báo đối chiếu EX-07 UseCase) · **Hiệu quả xe** (Report 02 đầy đủ, sắp
  xếp) · **Chi phí** (Report 05 + biểu đồ theo loại + bật/tắt "loại chi phí bất thường").
- `VehicleFinanceSheet` (drill-down — tái dùng 3 tab của R1 trong Sheet, truyền kỳ đang chọn) + link "Mở hồ sơ xe".
- Thêm biểu đồ tháng vào `VehicleProfitTab` (dùng lại component biểu đồ).
- Banner "chưa gồm chi trả chủ xe ký gửi" (§4.4).
- **Chi tiết hoá + 3 việc gộp (invalidate thực thu · sửa cờ "Đóng kèm công nợ" · kiểu khoá i18n) — xem §19.**

### 1.4. Trong phạm vi — Round 3 (Báo cáo phụ + đối chiếu + xuất)

- Tab **Khách hàng** (Report 03, tái dùng `deriveCustomerBalances`), **Sự cố** (Report 04), **Đối chiếu & dòng
  tiền** (BRD §15 accrual ↔ cash + Report 06 theo phương thức, drill-down chênh lệch → `/finance/receivables`).
- **Xuất CSV** mọi tab báo cáo (`shared/lib/csv.ts`), gate `FINANCE_REPORT.EXPORT`, audit `REPORT_EXPORT`.

### 1.5. Ngoài phạm vi cả 3 round — lý do

| Hạng mục | Lý do | Ở đâu sau |
| --- | --- | --- |
| Chốt kỳ / mở lại kỳ (UC-RV-15), trạng thái `IN_CLOSED_PERIOD`, điều chỉnh sau chốt kỳ (EX-03) | OQ BRD §28 Q11/Q13 — chưa chốt có làm Phase 1 không. Giả định UC-RV-15 A1 "số liệu luôn sống" | Roadmap §14 |
| Cấu hình chính sách ghi nhận (UC-RV-06), danh mục chi phí & phân bổ gián tiếp (UC-RV-07) | Chính sách đã chốt `ON_SETTLEMENT`; phân bổ gián tiếp = Phase sau (CR-2026-048); danh mục = OQ Q4 | Roadmap |
| Khấu hao / chi phí sở hữu xe (BRD §11) | CR-2026-048: Phase 1 không đưa vào lợi nhuận vận hành | Phase sau |
| Nợ xấu / doanh thu không đòi được (EX-06) | OQ Q12 | Roadmap |
| Cost Record `CONSIGNMENT_PAYOUT` + Owner Payout | Phase 5 `features/consignment` (CR-2026-050) — 4.3 chỉ có giá trị enum + chỗ trống trong hàm suy ra (§3.2) | Phase 5 |
| Phí giao dịch SePay thành chi phí tự động | Mô hình phí chưa chốt (PM §4.2); Webapp không có cổng thật | Giữ `TODO(OQ)` |
| Dashboard KPI tài chính + cảnh báo (BRD §17, UC-RV-14) | Thuộc Phase 6 "Dashboard thật" — tái dùng hàm thuần của 4.3 | Phase 6 |
| Xuất PDF / Excel `.xlsx` thật | Cần thư viện mới; CSV mở bằng Excel đủ cho demo | Khi có backend |
| 3 ô Doanh thu/Chi phí/Lợi nhuận ở tab Tổng quan Vehicle Detail | F10 — mở rộng ngoại lệ `vehicles/*` + cần gate quyền. **Đã chốt ngoài phạm vi 4.3** (§13 câu 3) | Task riêng sau (nếu người dùng yêu cầu) |
| Tab "Thanh toán" ở Customer Detail | Không thuộc RV | Roadmap `PAYMENT-PLAN.md` §15.2 |
| Phân tích theo nhân viên / hạng xe (`WebappQuanTri.md` §11.7) | Open Question nhóm, chưa có trong BRD | — |

---

## 2. Data model (`features/finance/model.ts`, khối `// ==== Revenue & Cost (RV) ====`)

### 2.1. `RevenueLine` — **view suy ra, KHÔNG lưu** (BRD §6.1)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | Tất định (§0.3 điểm 3) |
| `category` | `RevenueCategory` | §2.5 |
| `amount` | `number` | Số nguyên **có dấu** (đồng). Dòng giảm trừ/đảo là số âm |
| `nature` | `RevenueLineNature` | `CHARGE` (khoản thu) · `REDUCTION` (miễn giảm/chiết khấu — RV-BR-06) · `REVERSAL` (đối ứng khi đảo quyết toán — EX-02) |
| `recognitionDate` | `string` (ISO) | `completedAt` / `reversedAt` / `psc.createdAt` |
| `isAdjustment` | `boolean` | BRD §6.1 "Adjustment?" — `true` với dòng PSC và dòng `REVERSAL` |
| `rentalId` · `vehicleId` · `customerId` | `string` | Copy từ Settlement/PSC |
| `sourceType` | `'SETTLEMENT' \| 'POST_SETTLEMENT_CHARGE'` | BRD "Source Ref" |
| `sourceId` | `string` | `settlementId` / `pscId` |
| `settlementLineId?` · `waiverId?` · `reversalId?` | `string` | Truy vết dòng nguồn |
| `note?` | `string` | Nhãn dòng nguồn / lý do waiver / lý do đảo |

### 2.2. `CostRecord` — **entity mới, lưu**, storage key `costRecords` (chỉ `Source = MANUAL`) — BRD §6.2, §18

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | `generateId('cst')` |
| `code` | `string` | `CP-000001` tuần tự (`nextSequenceCode('CP', …)` trong callback `fakeRequest`) |
| `category` | `CostCategory` | ∈ `MANUAL_COST_CATEGORIES` (§2.5) — chặn `INCIDENT` (RV-BR-04), `CONSIGNMENT_PAYOUT` (RV-BR-19) ở cả schema **và** API |
| `amount` | `number` | Nguyên dương (BRD §25.1) |
| `costDate` | `string` | `YYYY-MM-DD`, ≤ hôm nay (BA đề xuất — không nhập chi phí tương lai; phần rải sang tháng sau sinh từ `spreadMonths`) |
| `allocationType` | `AllocationType` | `DIRECT` / `INDIRECT` |
| `vehicleId?` | `string` | **Bắt buộc** khi `DIRECT`; **cấm** khi `INDIRECT` (BRD §9 BR) |
| `rentalId?` | `string` | Tuỳ chọn, chỉ khi `DIRECT`; phải là Rental của đúng `vehicleId` (kiểm trong API qua `RENTALS_STORAGE_KEY`) |
| `spreadMonths` | `number` | Nguyên 1..36, mặc định 1 (§0.3 điểm 5) |
| `isUnusual` | `boolean` | "Chi phí bất thường / một lần" (UC-RV-03 A3, EX-04) |
| `evidenceNote?` | `string` | Chứng từ — demo là ghi chú text (số hoá đơn), như `PostSettlementCharge.evidenceNote` |
| `note?` | `string` | |
| `status` | `CostRecordStatus` | `ACTIVE` / `REVERSED` (§0.4 điểm 7) |
| `reverseReason?` · `reversedByName?` · `reversedAt?` | | Bắt buộc khi `REVERSED` |
| `enteredByName` · `enteredByRole` · `enteredAt` | | BRD §6.2 "Entered By / Entered At" (= `createdAt`) |
| `updatedByName?` · `updatedAt` | | |

`Source`/`Source Ref` không lưu (luôn `MANUAL`) — có trong `CostEntry`.

### 2.3. `CostEntry` — **view thống nhất cho phân tích, KHÔNG lưu**

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | Tất định: `cst:<costRecordId>:<sliceIndex>`, `inc:<incidentId>`, `mtr:<recordId>`, `spr:<recordId>` |
| `category` · `allocationType` | | `INCIDENT`→`DIRECT`; bảo dưỡng/phụ tùng → `MAINTENANCE`/`DIRECT` |
| `amount` | `number` | Dương |
| `costDate` | `string` (`YYYY-MM-DD`) | Lát thứ i = `costDate` + i tháng (kẹp ngày cuối tháng) |
| `vehicleId?` · `rentalId?` | | |
| `source` | `CostSource` | `MANUAL` / `INCIDENT` / `SYSTEM` (BRD §6.2) |
| `sourceRef` | `{ costRecordId? ; incidentId? ; maintenanceRecordId? ; sparePartRecordId? }` | Để UI link về bản ghi nguồn |
| `sourceLabel` | `string` | VD mã sự cố `SC-0003`, hạng mục bảo dưỡng, mã `CP-000004` |
| `isUnusual` | `boolean` | Suy ra luôn `false` |
| `slice?` | `{ index: number; total: number }` | Chỉ khi `spreadMonths > 1` — UI hiện "Phân bổ 3/12" |

### 2.4. `CashEntry` (suy ra) và `FinancePeriod`

- `CashEntry { transactionId; code; date (ISO = confirmedAt ?? performedAt); direction; signedAmount; type; method;
  rentalId?; customerId; revenueRelated: boolean }` — chỉ từ giao dịch `isEffectiveTransaction()`.
- `FinancePeriod { from: string; to: string }` (`YYYY-MM-DD`, bao gồm 2 đầu) +
  `FINANCE_PERIOD_PRESETS = ['THIS_MONTH','LAST_MONTH','LAST_30_DAYS','THIS_QUARTER','THIS_YEAR','LAST_12_MONTHS','CUSTOM']`
  (hằng số UI, đặt ở `model.ts` — **không** đưa vào `enums.ts` vì không phải enum nghiệp vụ).
- `ReportGranularity = 'DAY' | 'WEEK' | 'MONTH'` (BRD §14; "quý" phủ bằng preset kỳ).

### 2.5. Enum (`shared/domain/enums.ts`) — mỗi khối có comment nguồn

| Enum | Giá trị (khớp từng ký tự) | Nguồn |
| --- | --- | --- |
| `COST_CATEGORIES` (**sửa**, giữ tên export) | `INCIDENT`, `VETC`, `TRAFFIC_FINE`, `MAINTENANCE`, `INSURANCE`, `INSPECTION`, `PARKING`, `REPOSITION_FUEL`, `CLEANING`, `OPERATIONS`, `OTHER`, `CONSIGNMENT_PAYOUT` | `RevenueCost-BRD.md` §6.2/§9 (`INSPECTION` — CR-2026-042; `CONSIGNMENT_PAYOUT` — CR-2026-050). Comment ghi lý do sửa scaffold (F1) + `TODO(OQ: RevenueCost-BRD.md §28 Q4 — danh mục chi phí chuẩn chưa chốt; demo dùng nguyên danh mục BRD §9)` |
| `REVENUE_CATEGORIES` (mới) | `BASE_RENTAL`, `EXTRA_KM`, `FUEL`, `OVERTIME`, `DAMAGE_RECOVERY`, `VETC_RECOVERY`, `FINE_RECOVERY`, `DELIVERY_FEE`, `OTHER` | BRD §6.1/§8 |
| `COST_SOURCES` (mới) | `INCIDENT`, `MANUAL`, `SYSTEM` | BRD §6.2 |
| `REVENUE_RECOGNITION_POLICIES` (mới) | `ON_BOOKING`, `ON_HANDOVER`, `ON_SETTLEMENT`, `ON_PAYMENT` | BRD §7 (chỉ dùng làm kiểu cho hằng số `ON_SETTLEMENT` + nhãn ở header báo cáo) |
| `COST_RECORD_STATUSES` (mới) | `ACTIVE`, `REVERSED` | UseCase §4.1 (bỏ `IN_CLOSED_PERIOD` — §0.4 điểm 7) |
| `REVENUE_LINE_NATURES` (mới) | `CHARGE`, `REDUCTION`, `REVERSAL` | BA đề xuất — BRD §6.1/§8 BR/EX-02 chỉ mô tả hành vi |
| `ALLOCATION_TYPES` | giữ nguyên `DIRECT`, `INDIRECT` | đã đúng |

`MANUAL_COST_CATEGORIES` = `COST_CATEGORIES` trừ `INCIDENT`, `CONSIGNMENT_PAYOUT` — hằng số dẫn xuất ở
`model.ts` (không phải enum mới). Label map trong `vi.ts`: `REVENUE_CATEGORY_LABELS`, `COST_CATEGORY_LABELS`,
`COST_SOURCE_LABELS`, `ALLOCATION_TYPE_LABELS`, `COST_RECORD_STATUS_LABELS`, `REVENUE_LINE_NATURE_LABELS`,
`REVENUE_RECOGNITION_POLICY_LABELS`.

---

## 3. Hàm thuần (`features/finance/model.ts`)

### 3.1. Doanh thu — R1

```text
SETTLEMENT_TO_REVENUE_CATEGORY: Record<SettlementLineCategory, RevenueCategory>   (§0.4 điểm 9)
  BASE_RENTAL→BASE_RENTAL · CONTRACT_DISCOUNT→BASE_RENTAL · EXTRA_KM→EXTRA_KM · FUEL_DEFICIT→FUEL
  OVERTIME→OVERTIME · DELIVERY_FEE→DELIVERY_FEE · DAMAGE→DAMAGE_RECOVERY · INCIDENT→DAMAGE_RECOVERY
  MISSING_ACCESSORY→DAMAGE_RECOVERY · VETC→VETC_RECOVERY · TRAFFIC_FINE→FINE_RECOVERY
  RETURN_DISCOUNT→OTHER · RETURN_OTHER→OTHER · MANUAL_OTHER→OTHER
PSC_SOURCE_TO_REVENUE_CATEGORY: Record<PostSettlementChargeSource, RevenueCategory>
  TRAFFIC_FINE→FINE_RECOVERY · VETC→VETC_RECOVERY · INCIDENT→DAMAGE_RECOVERY · ADJUSTMENT→OTHER · OTHER→OTHER
REVENUE_RECOGNITION_POLICY = 'ON_SETTLEMENT'   // CR-2026-048 — RevenueCost-BRD.md §7
```

- `buildSettlementRevenueLines(s: { id; rentalId; vehicleId; customerId; lines; waivers }, recognitionDate, idScope)`
  — **dùng đúng điều kiện lọc của `calcSettlementTotals()`** để Σ khớp `finalAmount`:
  - dòng `direction = CHARGE` & status `CONFIRMED`/`WAIVED` → `CHARGE` +`actualAmount`;
  - dòng `WAIVED` → thêm `REDUCTION` −`actualAmount` cùng danh mục (AC-RV-002 — giữ số gốc, hiện rõ khoản miễn);
  - dòng `direction = DISCOUNT` & `CONFIRMED` → `REDUCTION` −`actualAmount` (danh mục theo bảng trên);
  - waiver `PARTIAL_DISCOUNT` (có `lineId`) / `GOODWILL_CREDIT`, status `APPROVED`/`PENDING_APPROVAL`
    (giống `calcSettlementTotals`; ở `COMPLETED` không còn PENDING do blocker `WAIVER_PENDING`) → `REDUCTION`
    −`amount`, danh mục = danh mục dòng `lineId` hoặc `OTHER`;
  - **không** sinh dòng từ waiver `WAIVE_LINE` (đã tính qua dòng `WAIVED` — tránh trùng, mirror
    `calcSettlementTotals`); bỏ dòng `DRAFT`/`DISPUTED`.
- `deriveRevenueLines(settlements, pscs): RevenueLine[]` — theo §0.3 điểm 2 (reversals → snapshot + đối ứng;
  bản hiện tại nếu `COMPLETED`) + PSC (`RECEIVABLE` +, `REFUND` −, `recognitionDate = createdAt`, `isAdjustment`).
  Bỏ qua snapshot thiếu `completedAt` (phòng thủ). Comment: `// TODO(OQ: RevenueCost-BRD.md §28 Q12 — nợ xấu
  EX-06: Settlement completedWithDebt vẫn ghi nhận đủ doanh thu, chưa có chính sách giảm trừ.)`
- `checkSettlementRevenueReconciliation(settlement, lines): { expected: number; recognized: number; diff: number }`
  — `expected = completedTotals.finalAmount`; dùng ở R2 (cảnh báo "lệch nguồn", EX-07 UseCase).

### 3.2. Chi phí — R1

- `MANUAL_COST_CATEGORIES` (§2.5).
- `expandCostRecord(record: CostRecord): CostEntry[]` — `ACTIVE` mới sinh; `REVERSED` → `[]`. Chia
  `floor(amount / n)`, lát cuối = phần còn lại (Σ lát = `amount`, BRD §25.1 số nguyên).
- `deriveIncidentCostEntries(incidents)` — §0.4 điểm 10. Comment `// RV-BR-04 / DI-BR-18 — Company Cost` +
  `// TODO(OQ: RevenueCost-UseCase.md UC-RV-02 bước 2 — Cost Date = ngày chốt hay ngày phát sinh; demo dùng reportedAt)`.
- `deriveMaintenanceCostEntries(records: MaintenanceRecord[], spareParts: SparePartRecord[])` — bỏ bản ghi `cost ≤ 0`.
- **Chỗ trống `CONSIGNMENT_PAYOUT`**: comment trong `listCostEntries` (§6.1) `// Phase 5 (features/consignment) —
  Owner Payout Record → CostEntry CONSIGNMENT_PAYOUT, DIRECT, Recognition Date = tháng chi trả (RV-BR-19, CR-2026-050).`
  **Không** viết hàm/dữ liệu giả.
- `costRecordFormSchema` (zod — `safeParse` trong dialog): category ∈ `MANUAL_COST_CATEGORIES`; amount chuỗi số
  nguyên dương; costDate bắt buộc ≤ hôm nay; allocationType; `superRefine`: `DIRECT ⇒ vehicleId`, `INDIRECT ⇒
  không vehicleId/rentalId`; `spreadMonths` 1..36; `note`/`evidenceNote` tuỳ chọn; `isUnusual`.
- `costRecordReverseFormSchema`: `reason` trim ≥ 5 ký tự (BA đề xuất, mirror lý do ở các dialog finance khác).

### 3.3. Kỳ phân tích — R1

`toLocalDateKey(iso)`, `isDateInPeriod(dateOrIso, period)`, `resolvePeriodPreset(preset, today): FinancePeriod`,
`previousPeriod(period): FinancePeriod` (cùng độ dài, liền trước — BRD §14 "so với kỳ trước"),
`enumeratePeriodBuckets(period, granularity)` (khoá ngày `yyyy-MM-dd` / tuần ISO bắt đầu thứ Hai / `yyyy-MM`).

### 3.4. Thực thu — R1 (dùng ở R2/R3)

`deriveCashEntries(txns: Transaction[]): CashEntry[]` theo §0.3 điểm 6 + §0.4 điểm 12. Hằng số
`REVENUE_CASH_IN_TYPES`, `REVENUE_CASH_OUT_TYPES` comment `// RevenueCost-BRD.md §15 — revenue-related`.

### 3.5. Tổng hợp — R1 (dùng cho 3 tab xe; R2 dùng lại cho toàn đội xe)

```text
summarizePeriod(revenueLines, costEntries, period) →
  revenue          = Σ RevenueLine.amount (recognitionDate ∈ kỳ)              // AC-RV-006
  reductions       = Σ amount của nature REDUCTION (số âm, hiện riêng)         // RV-BR-06
  directCost       = Σ CostEntry DIRECT (costDate ∈ kỳ)
  indirectCost     = Σ CostEntry INDIRECT (costDate ∈ kỳ)                      // AC-RV-009 — không vào lợi nhuận xe
  operatingProfit  = revenue − directCost                                      // CR-2026-048 — Phase 1
  afterIndirect    = operatingProfit − indirectCost                            // §0.4 điểm 11
  (tuỳ chọn excludeUnusual: bỏ CostEntry isUnusual — EX-04)

calcRentalDaysInPeriod(rental, period, today)                                  // §0.4 điểm 13
calcAvailableDays(vehicle, blocks, period, today) =
    số ngày của (kỳ ∩ [ngày tạo xe, hôm nay])
  − số ngày trong đó bị Vehicle Block (ACTIVE hoặc RELEASED; đến endDate ?? releasedAt ?? hôm nay)
  // RV-BR-15 — TODO(OQ: RevenueCost-BRD.md §28 Q10 — "số ngày khả dụng" chưa chốt; demo trừ ngày khoá lịch,
  //   chưa trừ thời gian MAINTENANCE/INACTIVE vì không có lịch sử trạng thái xe)

buildVehiclePerformance({ vehicles, rentals, settlements, revenueLines, costEntries, incidents, blocks, period, today })
  → mỗi xe: { vehicleId, revenue, directCost, estimatedProfit, rentalCount, rentalDays, availableDays,
              utilization (null nếu availableDays = 0), incidentCount (reportedAt ∈ kỳ) }
  Xe không có phát sinh trong kỳ vẫn có dòng (Utilization = 0%) — EX-05: xe INACTIVE vẫn hiện nếu có phát sinh.

buildMonthlyVehicleSeries(...) → bảng theo tháng cho tab Lợi nhuận (R1 bảng, R2 thêm biểu đồ)
```

`utilization` làm tròn 1 chữ số thập phân khi hiển thị (AC-RV-014: 20/25 = 80%).

### 3.6. Round 2-3 (khai báo trước để `dev` biết đích)

`buildTimeSeries(revenueLines, costEntries, period, granularity)` (Report 01 + biểu đồ Tổng quan, kèm Số lượt +
Doanh thu TB/lượt) · `buildRevenueByCategory` · `buildCostBreakdown(costEntries, period)` (Report 05: loại · số
bản ghi · tổng · % · trực tiếp/gián tiếp) · `buildCustomerReport({customers, settlements, revenueLines,
incidents, balances, period})` (Report 03; `Collected`/`Outstanding` lấy **hiện tại** từ `deriveCustomerBalances` —
ghi rõ trên UI "số dư hiện tại, không theo kỳ") · `buildIncidentReport(incidents, period)` (Report 04) ·
`buildReconciliation(revenueLines, cashEntries, costEntries, period)` (BRD §15) · `buildCashflow(cashEntries,
period, granularity)` (Report 06 theo `method`, loại `OFFSET`).

---

## 4. Business rule cần trích dẫn trong code (comment 1 dòng tại chỗ)

| Mã | Chỗ đặt |
| --- | --- |
| `CR-2026-048` / BRD §7 | `REVENUE_RECOGNITION_POLICY`, `deriveRevenueLines` (Recognition Date = `completedAt`) |
| `RV-BR-03` | `isDateInPeriod` (không dùng `createdAt`) |
| `RV-BR-04` · `RV-BR-11` | `MANUAL_COST_CATEGORIES`, guard API, `deriveIncidentCostEntries` |
| `RV-BR-05` | `SETTLEMENT_TO_REVENUE_CATEGORY` (`*_RECOVERY` là doanh thu gross, không trừ chi phí) |
| `RV-BR-06` | nature `REDUCTION` trong `buildSettlementRevenueLines` |
| `RV-BR-07` | phần PSC trong `deriveRevenueLines` |
| `RV-BR-08` · `AC-RV-009` | `summarizePeriod` (gián tiếp không vào lợi nhuận xe) |
| `RV-BR-09` | nhãn "Ước tính quản trị" cạnh mọi con số Lợi nhuận (UseCase §28 khuyến nghị BA) |
| `RV-BR-10` · BRD §25.4 | `reverseCostRecord` (huỷ mềm) |
| `RV-BR-14` | `deriveCashEntries` |
| `RV-BR-15` | `calcAvailableDays` |
| `RV-BR-16` | mọi `appendAudit` của module |
| `RV-BR-17` | comment `createCostRecord` ("không tự tạo giao dịch Payment") + 1 dòng gợi ý trong form |
| `RV-BR-18` | không cần code — `OPERATION_STAFF` không có `FINANCE_REPORT.VIEW`/`VEHICLE.EXPORT` |
| `RV-BR-19` (nghĩa BRD) | chỗ trống `CONSIGNMENT_PAYOUT` (§3.2), banner xe ký gửi |
| EX-02 BRD | `deriveRevenueLines` (khối reversals) + comment thay `TODO(Phase 4.3)` |

---

## 5. `permissions.ts` — thêm 3 entry (khối "Nhóm 6 — Tài chính", sau `FINANCE_REPORT.CONFIG`), giữ nguyên entry cũ

| Resource.Action | ADMIN | MANAGER | ACCOUNTANT | SALES | OPERATION | `source` |
| --- | :---: | :---: | :---: | :---: | :---: | --- |
| `FINANCE_REPORT.VIEW` *(đã có)* | ✓ | ✓ | ✓ | ✓ | ✗ | Xem báo cáo/hiệu quả xe/đối chiếu — dùng cho route `/finance/reports` + `/finance/costs` |
| `FINANCE_REPORT.CREATE` *(đã có — không sửa)* | ✓ | TBD | ✓ | ✓ | ✗ | Nhập chi phí thủ công (§0.4 điểm 4) |
| **`FINANCE_REPORT.EDIT`** (mới) | ✓ | TBD | ✓ | TBD (`likeManager`) | ✗ | `RevenueCost-BRD.md §22 — Sửa / xóa chi phí thủ công (trước chốt kỳ)` |
| **`FINANCE_REPORT.DELETE`** (mới) | ✓ | TBD | ✓ | TBD (`likeManager`) | ✗ | cùng dòng BRD §22 — dùng cho "Huỷ chi phí" (huỷ mềm §0.4 điểm 7) |
| **`FINANCE_REPORT.EXPORT`** (mới, dùng R3) | ✓ | ✓ | ✓ | ✓ (`likeManager`) | ✗ | `RevenueCost-BRD.md §22 — Xuất báo cáo` |
| `FINANCE_REPORT.CONFIG` *(đã có)* | ✓ | ✗ | ✗ | ✗ | ✗ | Không dùng ở 4.3 (không có màn cấu hình) |
| `VEHICLE.EXPORT` *(đã có — "View Financial")* | ✓ | ✓ | ✓ | ✓ | ✗ | Gate 3 tab Vehicle Detail — **không đổi** (CR-2026-036) |

Không thêm entry "Chốt kỳ / mở lại kỳ", "Điều chỉnh sau chốt kỳ", "Cấu hình phân bổ" — không có màn tương ứng
(Period Close ngoài phạm vi). `DISPATCHER` không khai → `false` (BRD §5 không liệt kê). Nút trong UI ẩn hẳn khi
thiếu quyền (pattern hiện có), không chỉ disable.

---

## 6. API / hooks / barrel

### 6.1. `features/finance/api.ts` — khối `// ==== Revenue & Cost (RV) — REVENUE-COST-PLAN.md §6 ====`

Mọi hàm bọc `fakeRequest()`; đọc/ghi storage + guard **trong** callback.

| Hàm | R | Hành vi |
| --- | --- | --- |
| `listRevenueLines(filter?: { vehicleId?; customerId?; rentalId? })` | 1 | Đọc `settlements` + `postSettlementCharges` → `deriveRevenueLines` → lọc. Không lọc kỳ ở API (hàm thuần lọc — cần so kỳ trước) |
| `listCostRecords(filter?: { vehicleId?; includeReversed? })` | 1 | Bản ghi nhập tay đã lưu, sắp `costDate` giảm dần |
| `listCostEntries(filter?: { vehicleId? })` | 1 | `expandCostRecord` (ACTIVE) + `deriveIncidentCostEntries` (`INCIDENTS_STORAGE_KEY`) + `deriveMaintenanceCostEntries` (2 key re-export từ barrel `maintenance`) + comment chỗ trống `CONSIGNMENT_PAYOUT` |
| `listCashEntries(filter?: { customerId? })` | 1 | `transactions` → `deriveCashEntries` |
| `createCostRecord(input, actor)` | 1 | Guard: category ∈ `MANUAL_COST_CATEGORIES` ("Chi phí sự cố/chi trả chủ xe được ghi nhận tự động, không nhập tay"), amount nguyên dương, costDate ≤ hôm nay, ràng buộc DIRECT/INDIRECT, `rentalId` thuộc `vehicleId`, `spreadMonths` 1..36. Sinh `code`. Audit `COST_MANUAL_CREATE` (`entity: 'CostRecord'`, `after` = bản ghi). **Không** tạo giao dịch Payment (RV-BR-17) |
| `updateCostRecord(id, input, actor)` | 1 | Chỉ `ACTIVE`. Cùng guard. Audit `COST_MANUAL_UPDATE` với `before`/`after` các field đổi (AC-RV-013). `reason` tuỳ chọn — `TODO(OQ: RevenueCost-UseCase.md UC-RV-04 bước 2 — "lý do nếu thay đổi lớn", chưa có ngưỡng)` |
| `reverseCostRecord(id, reason, actor)` | 1 | Chỉ `ACTIVE`; reason bắt buộc → `REVERSED` + `reverseReason/reversedByName/reversedAt`. Audit `COST_MANUAL_REVERSE`. `TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 — chưa làm Period Close; mọi bản ghi coi như thuộc kỳ đang mở, RV-BR-10)` |
| `recordReportExport(input: { reportKey; from; to; rowCount }, actor)` | 3 | Chỉ ghi audit `REPORT_EXPORT` (`entity: 'FinanceReport'`, BRD §25.3 "ai xuất, kỳ nào") — file CSV tạo phía client |

Export `COST_RECORDS_STORAGE_KEY = 'costRecords'` (dùng ở seed). Không có `remove()` vật lý.

### 6.2. `hooks.ts`

- Query key gốc **`['finance','analytics']`**: `useRevenueLines(filter)`, `useCostRecords(filter)`,
  `useCostEntries(filter)`, `useCashEntries(filter)`.
- Mutation `useCreateCostRecord` / `useUpdateCostRecord` / `useReverseCostRecord` (R1), `useRecordReportExport`
  (R3) → invalidate `['finance','analytics']`.
- **Sửa có kiểm soát** 2 helper hiện có `invalidateFinanceAll` + `invalidateSettlements`: thêm
  `queryClient.invalidateQueries({ queryKey: ['finance','analytics'] })` — để hoàn tất/đảo quyết toán, PSC, giao
  dịch làm mới số liệu phân tích. Mutation của `incidents`/`maintenance` không invalidate được (vùng cấm) —
  chấp nhận: query analytics dùng mặc định `staleTime: 0` + refetch khi mount (Radix `TabsContent` unmount tab
  ẩn, chuyển màn cũng mount lại) → luôn tải lại khi mở. Ghi comment.

### 6.3. `index.ts` (barrel)

R1: `VehicleRevenueTab`, `VehicleCostTab`, `VehicleProfitTab`, `CostRecordsScreen`; `export type { CostRecord }`.
R2: `FinanceReportScreen`. Không export hàm thuần cho Phase 6 lúc này (thêm khi Dashboard cần — YAGNI).

---

## 7. Audit action mới — nối **cuối** `AUDIT_ACTIONS` (khối `// Revenue & Cost (RV) — REVENUE-COST-PLAN.md §7 (UC-RV-16 §20.3)`)

`COST_MANUAL_CREATE`, `COST_MANUAL_UPDATE`, `COST_MANUAL_REVERSE` (BA đề xuất — §0.4 điểm 8), `REPORT_EXPORT`
(thêm ngay R1 cho trọn khối; dùng ở R3). Tên giữ đúng UseCase §20.3 (dạng `NOUN_VERB`, khác thói quen
`VERB_NOUN` của repo — ưu tiên khớp tài liệu, `CLAUDE.md` §2 điểm 4).

---

## 8. Xử lý đảo quyết toán + mọi `TODO(Phase 4.3`

### 8.1. `finance/api.ts` `reverseSettlement()` (dòng ~1201)

Thay dòng `// TODO(Phase 4.3): gỡ chốt doanh thu kỳ gốc (UC-RS-16 bước 2).` bằng comment giải thích (không
thêm logic):

```text
// UC-RS-16 bước 2 / RevenueCost-BRD.md EX-02 — doanh thu không lưu riêng: deriveRevenueLines() đọc
// reversals[].snapshot (giữ kỳ gốc) và sinh dòng đối ứng âm tại reversedAt; quyết toán lại sinh dòng mới
// (REVENUE-COST-PLAN.md §0.3 điểm 2). Không cần ghi gì thêm ở đây.
```

DoD: `grep -rn 'TODO(Phase 4.3' src/` → **0 kết quả**.

### 8.2. `finance/seed.ts` dòng ~377 (`TODO(OQ: Payment-BRD.md §4.2 …→ Phase 4.3 RV …)`)

Giữ là `TODO(OQ)` (mô hình phí chưa chốt), sửa phần lời dẫn: "phí = chi phí công ty; khi chốt mô hình phí,
ghi nhận thành Cost Record (đề xuất `OPERATIONS`/`INDIRECT` hoặc theo giao dịch) — Phase 4.3 không tự sinh vì
chưa có mức phí, CR-2026-047". Không tạo seed chi phí SePay.

### 8.3. Kiểm chứng bắt buộc (dev tự tính tay ghi trong báo cáo bàn giao)

Với Settlement seed từng bị đảo (§9.2 mục 3): Σ doanh thu của Rental đó trên **toàn thời gian** = Final
Amount bản cuối; kỳ chứa `completedAt` bản 1 vẫn hiện số bản 1; kỳ chứa `reversedAt` có dòng âm.

---

## 9. Seed + `SEED_VERSION`

`SEED_VERSION` 17 → **18** (R1 — thêm entity `costRecords` + dữ liệu lịch sử). R2/R3 không đổi cấu trúc → không
bump trừ khi sửa seed. Mọi ngày **tương đối theo hôm nay** (dùng `dt()`/helper sẵn có), **thứ tự thời gian hợp
lệ**: `enteredAt ≥ costDate`; `reversedAt > enteredAt`; không mốc nào ở tương lai (trừ lát phân bổ suy ra);
Rental lịch sử: `createdAt < pickup < actualReturn < settlement.openedAt < completedAt`; giao dịch thanh toán nằm
đúng mốc đặt xe/giao xe của Rental đó.

**Cấu trúc seed trong `finance/seed.ts` (chốt khi giao Round 1):** 4 hàm hiện có (`seedPaymentRound1`,
`seedFinance`, `seedPaymentRound2` + các closure bên trong như `scheduleFor`/`addTxn`/`fulfillBooking`/
`fulfillHandover70`) **giữ nguyên, không hoist/refactor**. Thêm 2 hàm mới ở cuối file, đăng ký **sau**
`registerSeedStep(seedPaymentRound2)` theo thứ tự: `registerSeedStep(seedRevenueHistory)` (§9.2) →
`registerSeedStep(seedRevenueCost)` (§9.1). `seedRevenueHistory` đọc lại storage đã ghi (rentals, payment
requests, transactions, settlements), **nối thêm** bản ghi mới rồi ghi lại; helper dùng riêng (lập lịch, thêm
giao dịch, mã `GD-`/`CK-` tuần tự) viết **cục bộ trong hàm mới**, mirror closure cũ — mã tuần tự tính trên
**toàn bộ** giao dịch đã có trong storage + mới thêm để không trùng.

### 9.1. Cost Record nhập tay (`seedRevenueCost()` trong `finance/seed.ts`, chạy **sau** `seedRevenueHistory`)

~14 bản ghi, phủ đủ các ý demo:

| # | Category / Allocation | Ý demo |
| --- | --- | --- |
| 1 | `INSURANCE` DIRECT, 6.000.000, `spreadMonths 12`, costDate ≈ −200 ngày, xe `OWNED` | AC-RV-004 (500.000/tháng) |
| 2 | `INSURANCE` DIRECT, xe `CONSIGNED`, spread 12 | Công ty chịu bảo hiểm xe ký gửi (CR-2026-050) |
| 3-4 | `INSPECTION` DIRECT, spread 12 (2 xe) | Đăng kiểm rải theo kỳ (Q6 đã chốt) |
| 5-7 | `PARKING` INDIRECT, 3 tháng gần nhất | Chi phí gián tiếp hiện riêng (AC-RV-009) |
| 8-9 | `OPERATIONS` INDIRECT (thuê mặt bằng 2 tháng) | |
| 10 | `OPERATIONS` INDIRECT, lớn, `isUnusual = true` ("sửa mái che bãi xe") | EX-04 |
| 11 | `REPOSITION_FUEL` DIRECT gắn `rentalId` thật | Gắn lượt thuê |
| 12 | `CLEANING` DIRECT | |
| 13 | `VETC` DIRECT (phần công ty chịu) + `TRAFFIC_FINE` DIRECT | RV-BR-05 khác doanh thu thu hồi |
| 14 | `OTHER` DIRECT, **`REVERSED`** (lý do "nhập trùng hoá đơn") | Huỷ mềm + audit |

Mỗi bản ghi seed **không** gọi `appendAudit` (seed các feature khác cũng không audit dữ liệu mẫu — giữ nhất quán;
dev kiểm lại `finance/seed.ts` hiện có để làm theo đúng cách đó).

Gợi ý xe (để không phải dò seed `vehicles`): `OWNED` = `veh_017` (STANDARD), `veh_018` (VIP_LUXURY); còn lại
`CONSIGNED`. #1 → `veh_017`; #2 → `veh_001`; #3-4 → `veh_017`, `veh_011`; #11 → gắn một Rental lịch sử của đúng
xe đó (vd `rt_035`/`veh_017`); #12 → `veh_003`; #13 → `veh_018` (VETC), `veh_004` (TRAFFIC_FINE); #14 → `veh_005`.

### 9.2. Lịch sử doanh thu — phương án B (**đã chốt** 22/10/2026, §13 câu 1)

1. `rentals/seed.ts`: nối 10 Rental `COMPLETED` `rt_030`…`rt_039` vào cuối mảng `inputs` (pickup từ −170 tới
   −35 ngày, 2–6 ngày/lượt, ≥ 8 xe khác nhau phủ cả `OWNED`/`CONSIGNED` và 3 `Vehicle Class`, khách `ACTIVE`,
   **`securityDepositType = MOTORBIKE`** + `securityDepositAssetNote: MOTORBIKE_NOTE`, **không**
   discount/additional charges/delivery fee — để Final Amount = `baseAmount` và cân bằng ngay bằng 30% + 70%,
   không cần luồng cọc/hoàn). `rentalRate` theo mức hạng xe đang dùng trong seed hiện có (VIP_LUXURY 1.800.000 ·
   STANDARD 900.000 · TWO_SEATER 500.000); `vehicleClass` phải khớp hạng của xe. Không trùng lịch với Rental hiện
   có của cùng xe (hiện có đều ≥ −30 ngày) và tránh Vehicle Block seed (`veh_006` −40…−35, `veh_002` −20…−15).
   **Không** có `actualPickupDateTime`/`actualReturnDateTime` (`buildRental` không hỗ trợ, không được sửa —
   §0.2). Lịch đề xuất (dev được chỉnh ngày nếu cần, giữ ràng buộc trên):

   | Rental | Xe (hạng · sở hữu) | Khách | Pickup → hạn trả (ngày tương đối, 09:00 → 21:00) | Ghi chú |
   | --- | --- | --- | --- | --- |
   | `rt_030` | `veh_017` STANDARD · OWNED | `cus_001` | −170 → −167 | |
   | `rt_031` | `veh_001` VIP_LUXURY · CONSIGNED | `cus_002` | −160 → −156 | |
   | `rt_032` | `veh_003` TWO_SEATER · CONSIGNED | `cus_003` | −150 → −148 | |
   | `rt_033` | `veh_018` VIP_LUXURY · OWNED | `cus_004` | −135 → −130 | |
   | `rt_034` | `veh_004` STANDARD · CONSIGNED | `cus_005` | −120 → −117 | + `MANUAL_OTHER` (mục 2) |
   | `rt_035` | `veh_017` STANDARD · OWNED | `cus_007` | −100 → −96 | Cost Record #11 gắn vào |
   | `rt_036` | `veh_010` TWO_SEATER · CONSIGNED | `cus_009` | −85 → −82 | |
   | `rt_037` | `veh_013` TWO_SEATER · CONSIGNED (nay `INACTIVE`) | `cus_006` | −75 → −72 | + `MANUAL_OTHER` (mục 2); minh hoạ EX-05 |
   | `rt_038` | `veh_011` VIP_LUXURY · CONSIGNED | `cus_001` | −65 → −62 | **Settlement từng bị đảo** (mục 3) |
   | `rt_039` | `veh_005` STANDARD · CONSIGNED | `cus_002` | −45 → −41 | |

2. `finance/seed.ts` (`seedRevenueHistory`): với mỗi Rental lịch sử — Payment Request mốc `BOOKING`/`HANDOVER`
   dựng bằng `buildScheduleRequests(rental, …, rental.createdAt)` + giao dịch `RENTAL_PAYMENT` `CONFIRMED` đủ 30%
   (BOOKING, vài giờ sau `createdAt`) / 70% (HANDOVER, trước `pickupDateTime` ~2 giờ) — helper cục bộ mirror
   `scheduleFor`/`addTxn`/`fulfillBooking`/`fulfillHandover70` (không gọi được closure cũ, không hoist chúng)
   → Settlement `COMPLETED` dựng bằng `buildSourceLines` (không có Return → chỉ dòng `BASE_RENTAL`) +
   `calcSettlementTotals` + `calcDepositReconciliation` (balance 0, không cần yêu cầu thu/hoàn). Để có thêm danh
   mục `OTHER`: 2 trong 10 lượt (`rt_034`, `rt_037`) có thêm dòng `MANUAL` `MANUAL_OTHER` (vd "phí vệ sinh") + yêu
   cầu `COLLECT` + giao dịch thu đủ (balance về 0). Id Settlement theo tiền lệ: `stl_030`…`stl_039`. Cuối hàm đồng
   bộ `PaymentRequest.status` qua `deriveRequestStatus` và `Settlement.paymentStatus` qua
   `deriveRentalPaymentSummary` (mirror khối "Đồng bộ cuối" của `seedPaymentRound2` — không gõ tay trạng thái). **Không** dùng waiver ở lượt lịch sử (miễn giảm sau khi đã thu đủ 100% sẽ sinh
   `OVERPAYMENT_REFUND` — luồng hoàn tiền không cần cho mục đích báo cáo).
3. **1 Settlement từng bị đảo** (`rt_038` — minh hoạ EX-02): bản 1 `COMPLETED` ≈ −60 ngày có thêm dòng
   `MANUAL_OTHER` 300.000 nhập nhầm + yêu cầu `COLLECT` (Settlement + `PaymentRequest` liên kết
   `settlementRequestId`, chưa thu → bản 1 `completedWithDebt: true`) → đảo ≈ −58 ngày bởi `SYSTEM_ADMIN` (dựng
   bằng `buildReversalReset`, lý do vd "Nhập nhầm phí phát sinh"; yêu cầu → `CANCELLED`) → bỏ dòng nhầm, chốt lại,
   bản 2 `COMPLETED` ≈ −57 ngày (balance 0). Rental `COMPLETED`. Kết quả kỳ vọng (§8.3): Σ doanh thu toàn thời
   gian của `rt_038` = `baseAmount`; ngày −60 có +baseAmount `BASE_RENTAL` và +300.000 `OTHER` (nature `CHARGE`);
   ngày −58 có 2 dòng `REVERSAL` −baseAmount `BASE_RENTAL` và −300.000 `OTHER`; ngày −57 có +baseAmount `BASE_RENTAL`.
4. Hệ quả chấp nhận: 10 Rental lịch sử **không có** hợp đồng/biên bản giao-nhận/phân công (Rental Detail các tab
   đó trống) — dữ liệu chỉ phục vụ báo cáo; ghi vào docstring seed.

(Phương án A — không đụng `rentals/seed.ts`, đảo một trong 3 Settlement `COMPLETED` hiện có — **không chọn**.)

---

## 10. Nợ kỹ thuật còn treo từ 4.1/4.2 — quyết định

| Nợ | Quyết định |
| --- | --- |
| Thông báo lỗi `api.ts` lộ tham chiếu tài liệu: `(BRD §9)` dòng ~1532; `(UC-RS-17)` ~288; `(…/AC-RS-003)` ~292; `(…, AC-RS-009)` ~844; `(UC-RS-15)` ~920; `(AC-RS-013)` ~1099 | **Gộp vào R1** (rẻ, cùng file): bỏ phần `UC-`/`AC-`/`§`, giữ mã `RS-BR-xx`/`PM-BR-xx` nếu có; riêng ~1532 thay "(BRD §9)" bằng mã BR đúng (`PM-BR-22`) hoặc bỏ. Không đổi logic |
| `postSettlementChargeCloseFormSchema` không còn dùng (đóng PSC thủ công đã bỏ ở 4.2 R2) | **Gộp vào R1**: xoá schema + type (đã grep: không nơi dùng) |
| `postSettlementChargeFormSchema` viết ra nhưng `PostSettlementChargeDialog` validate inline | **Không gộp** — nối schema vào dialog đã review = rủi ro hành vi; để task dọn riêng |
| Form pattern finance (`useState` + `safeParse`) lệch `CONVENTIONS.md` §7 (`react-hook-form`) | **Không đổi code**; 4.3 tiếp tục pattern finance cho nhất quán. **Đã xử lý (§13 câu 5):** `CONVENTIONS.md` §7 có dòng ngoại lệ cho `features/finance` (22/10/2026) — hết lệch quy ước |
| `assertRentalInSettlement` thông điệp cố định; `usePostSettlementCharges({ settlementId: undefined })` tải toàn bộ | Không gộp (ngoài RV) |

---

## 11. UI

### 11.1. Round 1 — `CostRecordsScreen` (`/finance/costs`, menu "Chi phí vận hành", gate `FINANCE_REPORT.VIEW`)

- `PageHeader` (tiêu đề + mô tả "Chi phí nhập tay và chi phí ghi nhận tự động từ sự cố, bảo dưỡng" + nút
  **Thêm chi phí** khi `FINANCE_REPORT.CREATE`).
- `FinancePeriodPicker` (mặc định `THIS_MONTH`) + bộ lọc Nguồn (Tất cả/Nhập tay/Sự cố/Bảo dưỡng) · Loại ·
  Phân bổ · Xe · checkbox "Hiện bản đã huỷ".
- 3 thẻ tổng: Chi phí trực tiếp · Chi phí gián tiếp · Tổng.
- Bảng `CostEntry` (desktop) / card (mobile): Ngày · Mã/Nguồn (link `/incidents/:id` hoặc `/maintenance`) ·
  Loại · Phân bổ · Xe (biển số) · Lượt thuê (link) · Số tiền · nhãn "Phân bổ i/n" · "Bất thường" · hành động
  (chỉ dòng `MANUAL` `ACTIVE`): **Sửa** (`FINANCE_REPORT.EDIT`) · **Huỷ** (`FINANCE_REPORT.DELETE`). Dòng nguồn
  `INCIDENT`/`SYSTEM` hiện chú thích "Sửa ở module nguồn" (RV-BR-11). Bản `REVERSED` gạch ngang + lý do.
- `CostRecordFormDialog` (tạo/sửa): Loại (chỉ `MANUAL_COST_CATEGORIES`) · Số tiền · Ngày chi phí · Phân bổ
  (radio DIRECT/INDIRECT) · Xe (bắt buộc khi DIRECT, `useVehicles`) · Lượt thuê (tuỳ chọn, chỉ Rental của xe đã
  chọn, `useRentals`) · Rải đều (số tháng, gợi ý 12 khi Loại = INSURANCE/INSPECTION) · Bất thường · Chứng từ ·
  Ghi chú. Gợi ý cố định: "Không tự tạo giao dịch chi — tạo ở Sổ giao dịch nếu cần" (RV-BR-17); khi Loại =
  MAINTENANCE: "Chi phí đã ghi ở màn Bảo dưỡng được tính tự động — chỉ nhập khoản chưa ghi ở đó".
- `CostRecordReverseDialog`: lý do bắt buộc.
- Trạng thái rỗng có thông điệp + (nếu có quyền) nút Thêm chi phí.

### 11.2. Round 1 — 3 tab Vehicle Detail (component trong `features/finance/components/`, prop `vehicle: Vehicle`)

Mỗi tab có `FinancePeriodPicker` riêng, mặc định `LAST_12_MONTHS`; dòng nhãn "Ghi nhận doanh thu khi quyết toán
hoàn tất" (`REVENUE_RECOGNITION_POLICY`).

- **`VehicleRevenueTab`**: thẻ Doanh thu kỳ · Số lượt hoàn tất · Giảm trừ (miễn giảm/chiết khấu, số âm). Bảng
  Revenue Line: Ngày ghi nhận · Lượt thuê (link `/rentals/:id`) · Loại · Bản chất (Thu / Giảm trừ / Đảo quyết
  toán) · Số tiền · Nguồn (Quyết toán / Phát sinh sau quyết toán).
- **`VehicleCostTab`**: thẻ Chi phí trực tiếp kỳ + cơ cấu theo loại (danh sách). Bảng `CostEntry` lọc
  `vehicleId` (như §11.1 nhưng không cột Xe). Nút **Thêm chi phí cho xe này** (`FINANCE_REPORT.CREATE`) mở
  `CostRecordFormDialog` khoá sẵn DIRECT + xe.
- **`VehicleProfitTab`**: Doanh thu · Chi phí trực tiếp · **Lợi nhuận ước tính** (nhãn "Ước tính quản trị" —
  RV-BR-09) · Số lượt · Số ngày thuê · Ngày khả dụng · Utilization · Số sự cố (đúng một dòng Report 02). Bảng theo
  tháng (Doanh thu/Chi phí/Lợi nhuận). Xe `CONSIGNED`: banner "Chưa gồm khoản chi trả cố định hàng tháng cho chủ
  xe — sẽ có khi triển khai Xe ký gửi" (`TODO(Phase 5)` trong comment).

### 11.3. Round 2 — `FinanceReportScreen` (`/finance/reports`)

`PageHeader` + `FinancePeriodPicker` (mặc định `THIS_MONTH`) + chọn độ chi tiết Ngày/Tuần/Tháng + `Tabs`
(`TabsList className="max-w-full"` cuộn ngang như Vehicle Detail):

- **Tổng quan** (CR-2026-018): 4-6 thẻ KPI (Doanh thu ghi nhận · Thực thu · Chi phí trực tiếp · Lợi nhuận vận
  hành · Chi phí gián tiếp · Còn lại sau chi phí chung), mỗi thẻ có "so kỳ trước" (± %); biểu đồ cột Doanh thu +
  Chi phí theo mốc (`recharts` `ComposedChart`/`BarChart` trong `ResponsiveContainer`); bảng theo xe (Biển số ·
  Doanh thu · Chi phí TT · Lợi nhuận · Utilization) — click hàng mở `VehicleFinanceSheet`.
- **Doanh thu** (Report 01): bảng Mốc · Doanh thu · Số lượt · TB/lượt + biểu đồ; cơ cấu theo danh mục; danh sách
  dòng giảm trừ; cảnh báo nếu `checkSettlementRevenueReconciliation` lệch ≠ 0.
- **Hiệu quả xe** (Report 02): bảng đủ cột BRD §16, sắp theo Lợi nhuận/Doanh thu/Utilization, nhãn "ước tính
  quản trị", banner xe ký gửi (§4).
- **Chi phí** (Report 05): bảng Loại · Số bản ghi · Tổng · % · Trực tiếp/Gián tiếp + biểu đồ; switch "Loại chi
  phí bất thường" (EX-04); link sang `/finance/costs`.
- `TODO(OQ: RevenueCost-BRD.md §28 Q14/Q15 — danh mục báo cáo & KPI chưa chốt; demo dựng theo BRD §16)` ở đầu screen.
- Màu biểu đồ: **chỉ** `var(--color-primary)`, `var(--color-status-info)`, `var(--color-status-pending)`,
  `var(--color-status-error)`… truyền vào prop `fill`/`stroke` — không hex. Trục/tooltip định dạng `formatVnd`.

### 11.4. Round 3 — tab bổ sung + Xuất

- **Khách hàng** (Report 03) · **Sự cố** (Report 04 — cột Chi phí thực tế/Khách chịu/Công ty chịu/Bảo hiểm/
  Trạng thái) · **Đối chiếu & dòng tiền** (BRD §15: Doanh thu ghi nhận vs Thực thu → Chênh lệch "công nợ phải thu
  / thu trước", Chi phí ghi nhận vs Thực chi (§0.4 điểm 14); Report 06 theo phương thức; link
  `/finance/receivables`).
- Nút **Xuất CSV** trên mỗi tab (`FINANCE_REPORT.EXPORT`): file gồm dòng tiêu đề báo cáo + kỳ + thời điểm + người
  xuất (UC-RV-13 bước 3) → gọi `useRecordReportExport` (audit) → `downloadCsv`.

### 11.5. Responsive

Thẻ KPI `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`; bảng bọc `overflow-x-auto` (chỉ bảng cuộn ngang); bảng dài
có bản card ở `< sm` như `TransactionLedgerScreen`; `FinancePeriodPicker` xuống dòng (`flex-wrap`, `min-w-0`);
biểu đồ `ResponsiveContainer width="100%"` chiều cao cố định 240–280px; Sheet drill-down full width trên mobile.
Kiểm ở ~375px / ~768px / desktop (người dùng tự test — `dev` chỉ cần build sạch).

---

## 12. Open Question — xử lý bằng giả định tạm + `TODO(OQ)` (không tự chốt)

Số câu theo **`RevenueCost-BRD.md` §28** (đã verify trực tiếp).

| # backlog | Câu hỏi (BRD §28) | Giả định tạm cho demo | Vị trí `TODO(OQ)` |
| --- | --- | --- | --- |
| 15 | **Q11** có làm Period Close Phase 1 không · **Q13** ai chốt/mở lại | Không làm — số liệu "sống" (UC-RV-15 A1); Cost Record nhập tay sửa/huỷ được bất kỳ lúc nào | `api.ts` `updateCostRecord`/`reverseCostRecord`; dòng chú thích "Số liệu chưa chốt kỳ" ở header báo cáo (R2) |
| 16 | **Q14** danh sách báo cáo & tần suất · **Q15** KPI dashboard · **Q16** ai được xem | Dựng Tổng quan + Report 01–06 theo BRD §16; KPI dashboard để Phase 6; quyền xem theo §22 (+ `SALES` ≈ `MANAGER`) | Đầu `FinanceReportScreen.tsx` (R2); comment tại 3 entry mới `permissions.ts` |
| 17 | **Q10** cách xác định "số ngày khả dụng" | Ngày trong kỳ (từ khi tạo xe tới hôm nay) trừ ngày bị Vehicle Block; chưa trừ thời gian `MAINTENANCE`/`INACTIVE` | `calcAvailableDays` |
| 18 | **Q4** danh mục chi phí chuẩn | Dùng nguyên 12 loại BRD §9, không có màn cấu hình | `enums.ts` khối `COST_CATEGORIES` |
| — | **Q12** nợ xấu (EX-06) | Không giảm trừ; Settlement `completedWithDebt` vẫn ghi nhận đủ | `deriveRevenueLines` |
| — | **Q18** xe ký gửi hiển thị 1 hay 2 góc nhìn | Phase 5; 4.3 chỉ banner "chưa gồm chi trả chủ xe" | `VehicleProfitTab` + tab Hiệu quả xe |
| — | UC-RV-02 bước 2 — Cost Date chi phí sự cố | `reportedAt` | `deriveIncidentCostEntries` |
| — | UC-RV-04 bước 2 — "lý do nếu thay đổi lớn" | Lý do sửa tuỳ chọn | `updateCostRecord` |
| — | `Payment-BRD.md` §4.2 — mô hình phí SePay | Không sinh chi phí | `finance/seed.ts` (sửa lời dẫn §8.2) |

---

## 13. Quyết định của người dùng — **đã chốt 22/10/2026** (chấp nhận cả 5 đề xuất của `tech-lead`)

1. **Seed lịch sử (F6) — đã chốt phương án B.** Ngoại lệ có kiểm soát mới: nối 10 Rental lịch sử `COMPLETED`
   `rt_030`…`rt_039` vào cuối `rentals/seed.ts` (chỉ thêm, không sửa bản cũ, không sửa `buildRental`) +
   Settlement/Payment tương ứng ở `finance/seed.ts` (§9.2). Chấp nhận các lượt này không có hợp đồng/biên bản
   giao-nhận/phân công. Phương án A (không đụng `rentals/seed.ts`) không chọn.
2. **Chia round — đã chốt giữ 3 round** như §1 (không gộp R2+R3).
3. **Tab Tổng quan Vehicle Detail (F10) — đã chốt ngoài phạm vi 4.3.** Không đụng
   `vehicles/components/VehicleOverviewTab.tsx`; 3 ô ở tab Tổng quan vẫn `—`.
4. **`features/finance` ngày càng lớn — đã chốt giữ nối tiếp trong 4.3**; tách thư mục con RS/PM/RV là task
   refactor riêng **sau** 4.3 (đã thêm backlog Phase 4.4 trong `IMPLEMENTATION-PLAN.md`, chưa làm, cần plan +
   duyệt riêng vì là thay đổi kiến trúc).
5. **`CONVENTIONS.md` §7 — đã chốt ghi 1 dòng ngoại lệ** cho `features/finance`: `useState` + `zod.safeParse()`,
   schema đặt ở `model.ts` và bắt buộc dùng thật trong dialog (đã ghi 22/10/2026).
6. Không cần thêm dependency (`recharts` đã có — F7) — thông tin, không cần quyết.

---

## 14. File dự kiến tạo / sửa

### 14.1. Round 1

| Thao tác | File |
| --- | --- |
| Sửa | `src/shared/domain/enums.ts` (sửa `COST_CATEGORIES`; 5 enum mới; 4 audit action cuối mảng) |
| Sửa | `src/shared/domain/permissions.ts` (3 entry) |
| Sửa | `src/shared/i18n/vi.ts` (khối `vi.finance.revenueCost.*`, 7 label map, xoá 3 khoá placeholder `vi.vehicles.*`) |
| Sửa | `src/features/finance/model.ts` · `api.ts` · `hooks.ts` · `seed.ts` · `index.ts` |
| Tạo | `src/features/finance/components/FinancePeriodPicker.tsx` · `CostRecordFormDialog.tsx` · `CostRecordReverseDialog.tsx` · `CostEntryTable.tsx` (dùng chung màn Chi phí + tab Chi phí) · `VehicleRevenueTab.tsx` · `VehicleCostTab.tsx` · `VehicleProfitTab.tsx` |
| Tạo | `src/features/finance/screens/CostRecordsScreen.tsx` |
| Sửa | `src/app/paths.ts` (`financeCosts`) · `src/app/routes.tsx` (route `/finance/costs`) · `src/shared/layout/nav.tsx` (mục "Chi phí vận hành") |
| Sửa (ngoại lệ) | `src/features/vehicles/screens/VehicleDetailScreen.tsx` — đúng phạm vi §0.2 |
| Sửa (1 dòng) | `src/features/maintenance/index.ts` · `src/features/calendar/index.ts` |
| Sửa (ngoại lệ — phương án B đã chốt) | `src/features/rentals/seed.ts` — chỉ nối `rt_030`…`rt_039` (diff chỉ có dòng thêm) |
| Sửa | `src/shared/fixtures/seedAll.ts` (`SEED_VERSION` 18) |

### 14.2. Round 2

Tạo `screens/FinanceReportScreen.tsx`, `components/FinanceKpiCards.tsx`, `FinanceTrendChart.tsx`,
`VehiclePerformanceTable.tsx`, `CostBreakdownPanel.tsx`, `RevenueReportPanel.tsx`, `VehicleFinanceSheet.tsx`;
sửa `VehicleProfitTab.tsx` (thêm biểu đồ), `model.ts` (§3.6 phần R2), `index.ts`, `vi.ts`, `app/routes.tsx`
(thay `ComingSoon` `/finance/reports`).

### 14.3. Round 3

Tạo `src/shared/lib/csv.ts`, `components/CustomerReportPanel.tsx`, `IncidentReportPanel.tsx`,
`ReconciliationPanel.tsx`, `ReportExportButton.tsx`; sửa `model.ts` (§3.6 phần R3), `api.ts`/`hooks.ts`
(`recordReportExport`), `FinanceReportScreen.tsx`, `vi.ts`.

---

## 15. Definition of Done

### 15.1. Round 1

- [ ] `npx tsc -b`, `npx oxlint`, `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới;
      `grep -rn 'TODO(Phase 4.3' src/` = 0.
- [ ] `COST_CATEGORIES` đúng 12 giá trị BRD; 5 enum mới khớp §2.5 từng ký tự, có comment nguồn; 4 audit action ở
      cuối `AUDIT_ACTIONS`.
- [ ] Settlement `COMPLETED` → Revenue Line đúng danh mục, Recognition Date = `completedAt` (AC-RV-001); waiver
      hiện dòng giảm trừ (AC-RV-002); PSC ghi nhận theo ngày tạo PSC, kỳ gốc không đổi (AC-RV-007); Σ Revenue
      Line của một Settlement = `completedTotals.finalAmount`.
- [ ] Settlement từng bị đảo: kỳ gốc giữ số, kỳ đảo có dòng âm, bản quyết toán lại có dòng mới (§8.3).
- [ ] Chi phí sự cố tự động từ `companyCost` (AC-RV-003), không nhập tay được `INCIDENT`/`CONSIGNMENT_PAYOUT`
      (chặn cả UI lẫn API); bảo dưỡng/phụ tùng hiện là `MAINTENANCE`/`SYSTEM`.
- [ ] Nhập `INSURANCE` 6.000.000 rải 12 tháng → mỗi tháng 500.000 (AC-RV-004); tạo/sửa/huỷ đều có audit với
      before/after (AC-RV-013); huỷ là mềm, có lý do.
- [ ] 3 tab Vehicle Detail hiển thị số thật, ẩn hẳn khi thiếu `VEHICLE.EXPORT`; `VehicleDetailScreen.tsx` diff
      chỉ gồm import + 3 thay thế + docstring; không file nào khác trong `vehicles/*` đổi.
- [ ] Lợi nhuận xe = Doanh thu − Chi phí trực tiếp, chi phí gián tiếp không trừ vào xe (AC-RV-009); Utilization
      đúng công thức §3.5 (AC-RV-014).
- [ ] Không chuỗi UI/thông báo lỗi nào chứa `§`, `UC-`, `AC-`, tên file tài liệu; nợ §10 (2 mục gộp) đã xử lý.
- [ ] Seed theo §9 (chronology hợp lệ), `SEED_VERSION` = 18; nút Reset demo chạy lại sạch.
- [ ] Đổi vai trò: `OPERATION_STAFF` không thấy menu Chi phí vận hành/Báo cáo, không thấy 3 tab; `MANAGER`
      không thấy nút Sửa/Huỷ (TBD), `ACCOUNTANT` thấy đủ.

### 15.2. Round 2

- [ ] 3 cổng sạch; `/finance/reports` không còn `ComingSoon`.
- [ ] Tổng quan: KPI + so kỳ trước + biểu đồ + bảng theo xe; click xe mở drill-down đúng kỳ (CR-2026-018).
- [ ] Report 01/02/05 khớp số với tab Vehicle Detail cùng kỳ; Σ lợi nhuận các xe = Lợi nhuận vận hành kỳ.
- [ ] Biểu đồ chỉ dùng biến màu theme; bố cục không vỡ ở 375/768.

### 15.3. Round 3

(DoD chi tiết thay thế ở §20.7.)

- [ ] 3 cổng sạch; Report 03/04/06 + Đối chiếu đúng BRD §13/§15/§16 (AC-RV-008: chênh lệch = công nợ phải thu).
- [ ] Xuất CSV mở được bằng Excel (tiếng Việt không lỗi font — BOM), mỗi lần xuất có audit `REPORT_EXPORT`; nút
      ẩn khi thiếu `FINANCE_REPORT.EXPORT`.

---

## 16. Danh sách file `dev` đọc trước khi code (đọc đúng danh sách, không scan rộng)

### 16.1. Round 1

1. File này (toàn bộ §0-§10, §11.1-§11.2, §12, §14.1, §15.1).
2. `../thien-bao-car-docs/modules/RevenueCost-BRD.md` §6-§12, §18, §21, §22, §23 (AC-RV-001…004, 007, 009, 013, 014), §24 EX-02/EX-04/EX-05.
3. `../thien-bao-car-docs/modules/RevenueCost-UseCase.md` §4.1, §5 (UC-RV-01), §6 (UC-RV-02), §7 (UC-RV-03), §8 (UC-RV-04), §9 (UC-RV-05), §20.3.
4. `src/features/finance/model.ts` dòng 1-372 (Settlement/PSC types, `buildSourceLines`, `calcSettlementTotals`), 618-672 (`buildReversalReset`), 837-950 (`Transaction`, `isEffectiveTransaction`), 1376-1490 (`deriveCustomerBalances` — tham khảo), 1540-1621 (`nextSequenceCode`, schema mẫu).
5. `src/features/finance/api.ts` dòng 1-160 (helper đọc/ghi + `ActorInfo`), 1082-1207 (`reverseSettlement`), 1209-1240 (key Payment); các dòng lỗi liệt kê ở §10.
6. `src/features/finance/hooks.ts` dòng 1-80; `src/features/finance/index.ts`.
7. `src/features/finance/components/TransactionReasonDialog.tsx` (mẫu dialog `useState` + `safeParse`) và `screens/TransactionLedgerScreen.tsx` (mẫu màn list + filter + card mobile).
8. `src/features/finance/seed.ts` dòng 1-120 (import, `dt`, `scheduleFor`, `addTxn`), 330-420 (`fulfillBooking`/`fulfillHandover70`, TODO SePay ~377), 674-1035 (`seedFinance` — mẫu dựng Settlement `COMPLETED`, vd `stl_024` ~790-840), 1244-1271 (khối "Đồng bộ cuối" + thứ tự `registerSeedStep`).
9. `src/features/vehicles/screens/VehicleDetailScreen.tsx` (toàn bộ — file ngoại lệ) + `src/features/vehicles/components/VehicleRentalHistoryTab.tsx` (mẫu tab read-only).
10. `src/features/incidents/model.ts` dòng 20-90 (`Incident`); `src/features/incidents/index.ts`.
11. `src/features/maintenance/model.ts` dòng 28-62; `src/features/maintenance/index.ts`; `src/features/maintenance/api.ts` dòng 1-35.
12. `src/features/calendar/model.ts` dòng 1-40 (`VehicleBlock`); `src/features/calendar/hooks.ts` dòng 1-25; `src/features/calendar/index.ts`.
13. `src/features/rentals/index.ts`; `src/features/rentals/model.ts` dòng 1-80 (`Rental`); `src/features/rentals/seed.ts` dòng 1-110 (`dt`, `SeedRentalInput`, `buildRental`, `MOTORBIKE_NOTE`) + 420-505 (cuối mảng `inputs`).
14. `src/shared/domain/enums.ts` dòng 180-320, 426-548; `src/shared/domain/permissions.ts` dòng 60-80, 323-446.
15. `src/shared/i18n/vi.ts` dòng 1001-1010 (đầu khối `finance`), 365-410 (`vi.vehicles` tab/placeholder), 1939-1955 (label map cuối file).
16. `src/app/paths.ts`, `src/app/routes.tsx`, `src/shared/layout/nav.tsx` dòng 90-120; `src/shared/fixtures/seedAll.ts`; `src/shared/lib/datetime.ts`, `money.ts`.

### 16.2. Round 2 (bổ sung)

`RevenueCost-BRD.md` §14, §16, §17; `RevenueCost-UseCase.md` §12, §14, §16; `WebappQuanTri.md` §11.2; tài liệu
`recharts` v3 (`ResponsiveContainer`, `ComposedChart`, `Bar`, `Line`, `Tooltip`) — chỉ khi cần; các component R1.

### 16.3. Round 3 (bổ sung)

`RevenueCost-BRD.md` §13, §15, §16 (Report 03/04/06), §25.3; `RevenueCost-UseCase.md` §13, §15, §17;
`src/features/finance/model.ts` `deriveCustomerBalances` (dòng 1376-1490); `src/features/finance/screens/CustomerReceivablesScreen.tsx`.

---

## 17. Thứ tự làm đề xuất cho `dev` (Round 1)

1. `enums.ts` (sửa + thêm) → `vi.ts` label map → `permissions.ts`.
2. `model.ts`: types §2 → hàm kỳ §3.3 → doanh thu §3.1 → chi phí §3.2 → thực thu §3.4 → tổng hợp §3.5 → schema.
3. Re-export 1 dòng ở `maintenance/index.ts`, `calendar/index.ts`.
4. `api.ts` §6.1 + thay comment §8.1 + dọn chuỗi lỗi §10 → `hooks.ts` §6.2 → `index.ts`.
5. Seed §9 (`rentals/seed.ts` 10 lượt lịch sử → `seedRevenueHistory` → `seedRevenueCost`) → `SEED_VERSION` 18 → kiểm
   số §8.3 bằng tính tay.
6. Component: `FinancePeriodPicker` → `CostEntryTable` → 2 dialog → `CostRecordsScreen` + path/route/nav.
7. 3 tab xe → sửa `VehicleDetailScreen.tsx` → xoá 3 khoá placeholder `vi.vehicles.*`.
8. 3 cổng `tsc -b` / `oxlint` / `build` + 3 lệnh grep ở §15.1.

Phụ thuộc: Round 2 cần Round 1 `DONE` (dùng `CostEntry`/`RevenueLine`/`buildVehiclePerformance` và 3 tab xe cho
drill-down); Round 3 cần Round 2 (khung `FinanceReportScreen`).

---

## 18. Roadmap (ngoài phạm vi, ghi để không quên)

- Period Close (UC-RV-15) khi OQ Q11/Q13 chốt → thêm entity `FinancePeriodClose`, trạng thái `IN_CLOSED_PERIOD`,
  điều chỉnh kỳ sau (EX-03, UC-RV-01 A3) — lúc đó **phải đóng băng** Revenue Line kỳ đã chốt (lưu snapshot), không
  còn suy ra thuần.
- Phase 5: `CONSIGNMENT_PAYOUT` từ Owner Payout Record; góc nhìn xe ký gửi (OQ Q18).
- Phase 6: Dashboard dùng `summarizePeriod`/`buildVehiclePerformance`/`buildTimeSeries` (export qua barrel khi đó).
- Phân bổ chi phí gián tiếp + khấu hao (Phase sau, CR-2026-048).
- Chính sách nợ xấu (OQ Q12).
- Refactor tách `features/finance` theo module (§13 câu 4 — đã chốt làm sau 4.3; backlog `IMPLEMENTATION-PLAN.md`
  Phase 4.4).

---

## 19. Round 2 — chi tiết giao việc (`APPROVED` 22/10/2026, `tech-lead` tự duyệt theo plan tổng)

Phạm vi = §1.3 + **3 việc gộp** (§19.2). Không đổi cấu trúc entity; chỉ đổi **giá trị** cờ `completedWithDebt` của
seed → `SEED_VERSION` 18 → **19** (để trình duyệt đang chạy bản cũ tự seed lại).

### 19.1. Trong / ngoài phạm vi

**Trong phạm vi**

1. Màn **Báo cáo tài chính** `/finance/reports` (`FinanceReportScreen`, thay `ComingSoon`): thanh công cụ chung
   (`FinancePeriodPicker` mặc định `THIS_MONTH` · độ chi tiết Ngày/Tuần/Tháng · switch "Loại chi phí bất thường"
   — EX-04) + 4 tab **Tổng quan** · **Doanh thu** (Report 01) · **Hiệu quả xe** (Report 02) · **Chi phí** (Report 05).
2. `VehicleFinanceSheet` — drill-down theo xe (CR-2026-018), tái dùng 3 tab R1 với kỳ đang chọn.
3. Biểu đồ `recharts` (component dùng chung `FinanceTrendChart`) ở Tổng quan, Doanh thu, Chi phí và **tab Lợi nhuận
   Vehicle Detail** (`VehicleProfitTab` — file thuộc `finance/components`, **không** phải ngoại lệ `vehicles/*`).
4. 3 việc gộp §19.2.

**Ngoài phạm vi** (giữ nguyên quyết định §1.4/§1.5): Report 03/04/06, view đối chiếu accrual ↔ cash, Xuất CSV
(Round 3); Dashboard (Phase 6); Period Close; mọi thay đổi `vehicles/*` (kể cả `VehicleDetailScreen.tsx` —
R2 **không** cần đụng: prop mới của 3 tab là tuỳ chọn); `rentals/*`, `incidents/*`, `maintenance/*`, `calendar/*`,
`customers/*`; `enums.ts`, `permissions.ts` (không cần entry mới — dùng `FINANCE_REPORT.VIEW` + `VEHICLE.EXPORT` sẵn
có); `app/paths.ts`, `shared/layout/nav.tsx` (path + mục menu "Báo cáo tài chính" đã có); `shared/lib/*`,
`shared/ui/*` (`sheet`, `switch`, `tabs`, `card` đã có); `package.json`. Nợ (b) và góp ý "lọc lượt
`CANCELLED`/`NO_SHOW` ở form chi phí" — **không gộp** (§19.2 điểm 4-5).

### 19.2. Ba việc gộp + quyết định về nợ treo

1. **Bắt buộc — invalidate thực thu:** `finance/hooks.ts` `invalidatePayment()` thêm
   `queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY })` (KPI "Thực thu" đọc `useCashEntries`; các
   mutation chỉ gọi `invalidatePayment` — lập lịch, biên lai, quỹ — phải làm mới góc nhìn thực thu).
2. **Nợ (a) — cờ "Đóng kèm công nợ" (`completedWithDebt`) tính sai.** Hiện `completeSettlement()` gán
   `completedWithDebt = depositReconciliation.balanceDue > 0` — `balanceDue` là số **lúc đối trừ cọc**, không trừ phần
   khách đã nộp qua yêu cầu `COLLECT` trước khi đóng. Đối chiếu `RentalSettlement-BRD.md`:
   - §15: `Balance Due > 0 → Tạo "Yêu cầu thu" → Payment ghi nhận → Khi Payment xác nhận đã thu đủ → cập nhật Paid To
     Date, Balance Due = 0`; AC-RS-008 cùng nội dung.
   - EX-02: `Balance Due > 0, khách chưa nộp đủ → … → Nếu cho nợ → COMPLETED với công nợ`.
   - §16.1: điều kiện đóng `Balance Due = 0 (hoặc được phép ghi công nợ)`.

   ⇒ "Đóng kèm công nợ" = **tại thời điểm đóng, khách còn chưa nộp đủ** phần Balance Due đã chuyển Payment thu. Suy ra
   trực tiếp từ BRD — **không phải quyết định nghiệp vụ mới**; giả định OQ RS §28 Q11 giữ nguyên (cho đóng khi đã
   tạo yêu cầu thu, không hạn mức). Cờ vẫn là **sự kiện lịch sử lúc đóng** (không tự xoá khi khách trả sau — trạng
   thái thanh toán hiện tại đã có ở `paymentStatus`).

   Hàm thuần mới (`model.ts`, cạnh `getCompletionBlockers`):

   ```text
   calcSettlementCollectOutstanding(settlement, paymentRequests, txns, asOf?) → number
     Σ trên mỗi spr ∈ settlement.paymentRequests với spr.type = COLLECT và spr.status = REQUESTED:
         pr = paymentRequests.find(p.settlementRequestId = spr.id và p.status ≠ CANCELLED)
         nếu không có pr  → + spr.amount                       (chưa sang Payment = chưa thu đồng nào)
         ngược lại        → + calcRequestProgress(pr, txnsAsOf).remaining
     txnsAsOf = asOf ? txns lọc (confirmedAt ?? performedAt) ≤ asOf : txns       (so bằng thời điểm, không so chuỗi)
   completedWithDebt = calcSettlementCollectOutstanding(...) > 0
   ```

   Dùng ở 3 nơi: (i) `api.ts` `completeSettlement` — đọc `readAllPaymentRequests()`/`readAllTransactions()` **trong**
   callback `fakeRequest`, không `asOf`; đồng thời bỏ đuôi `— OQ RS §28 Q11` khỏi `summary` audit (chuỗi người dùng
   thấy ở Nhật ký); (ii) `SettlementCompleteDialog` — cảnh báo "sẽ đóng kèm công nợ" hiện khi outstanding > 0 (thay
   `balanceDue > 0`), dữ liệu qua `usePaymentRequests({ rentalId })` + `useTransactions({ rentalId })` (gọi hook
   **trước** `if (!settlement) return null`; khi đang tải coi như chưa thu — cảnh báo thận trọng); sửa chuỗi
   `vi.finance.completeWithDebtWarning` bỏ `(OQ RS §28 Q11)`; (iii) seed — mọi Settlement `COMPLETED` (kể cả
   `reversals[].snapshot`) tính cờ bằng hàm này với `asOf = completedAt`, không gõ `true/false`.

   Kết quả kỳ vọng trên seed: `stl_034`/`stl_037` → `false` (giao dịch thu `COLLECT` ở `openedAt + 5h` < `completedAt
   = openedAt + 6h`); `stl_026` → **vẫn `true`** (lúc đóng chưa có `PaymentRequest`/giao dịch nào; khoản thu một phần ở
   `completedAt + 20h`); `stl_038` bản hiện tại → `false`, snapshot bản 1 → `true`; `stl_024`/`stl_025` → `false`
   (không có `COLLECT`). Badge chỉ còn ở `stl_026`.

   Hệ quả với góp ý R1 "dời giao dịch `COLLECT` `stl_034/037` ra sau `completedAt`": **không làm** — sau khi sửa cờ,
   câu chuyện "khách nộp đủ phần phát sinh rồi mới đóng lượt" (giao dịch trước `completedAt`) đã nhất quán, và trong
   app thật thu `COLLECT` được khi Rental còn `SETTLEMENT` (`isRequestActionable`).
3. **Nợ (c) — kiểu khoá i18n:** ở `PostSettlementChargeDialog.tsx` và `SettlementCompleteDialog.tsx` thay
   `Exclude<keyof typeof vi.finance, 'payment' | 'receivables' | 'revenueCost'>` bằng kiểu khai báo cục bộ
   `type FinanceStringKey = { [K in keyof typeof vi.finance]: (typeof vi.finance)[K] extends string ? K : never }[keyof typeof vi.finance]`
   (sửa comment đi kèm). Thêm namespace `vi.finance.reports` sau đó không phải sửa 2 file này.
4. **Nợ (b) — không gộp:** sửa `createdAt` tương lai buộc đụng `buildRental`/bản ghi cũ `rentals/seed.ts` (cấm, §0.2).
5. **Góp ý R1 "form chi phí lọc lượt `CANCELLED`/`NO_SHOW`" — không gộp:** BRD §9/§18 không giới hạn; lượt `NO_SHOW`
   vẫn có thể phát sinh chi phí thật (điều xe tới điểm giao) — giữ nguyên hành vi R1.

### 19.3. Hàm thuần R2 (`model.ts`, nối tiếp khối RV) — mọi số tổng do hàm tính, UI chỉ hiển thị

```text
TimeSeriesPoint { bucket; revenue; directCost; indirectCost; operatingProfit; cashIn; rentalCount;
                  avgRevenuePerRental: number | null }
buildTimeSeries({ revenueLines, costEntries, cashEntries, settlements, period, granularity }) → TimeSeriesPoint[]
  buckets = enumeratePeriodBuckets(period, granularity); chỉ lấy bản ghi có ngày ∈ kỳ (isDateInPeriod) rồi nhóm bucketKeyOf
  revenue      = Σ RevenueLine.amount theo recognitionDate                       // AC-RV-006, RV-BR-03
  directCost / indirectCost = Σ CostEntry theo costDate, tách allocationType     // AC-RV-009
  operatingProfit = revenue − directCost                                         // CR-2026-048
  cashIn       = Σ CashEntry.signedAmount với revenueRelated, theo date          // RV-BR-14
  rentalCount  = số Settlement COMPLETED có completedAt trong bucket (= countCompletedSettlements)
  avgRevenuePerRental = rentalCount > 0 ? round(revenue / rentalCount) : null    // Report 01 "Doanh thu TB/lượt"
  BẤT BIẾN: Σ các bucket = summarizePeriod(...) cùng kỳ (revenue, directCost, indirectCost)

sumRevenueCash(cashEntries, period) → number                                    // KPI "Thực thu"
calcChangeRatio(current, previous) → number | null   // previous = 0 → null; ngược lại (current − previous) / |previous|
comparisonPeriodOf(selection: PeriodSelection) → FinancePeriod                   // BRD §14 "so với kỳ trước"
  THIS_MONTH / LAST_MONTH → tháng lịch liền trước tháng của period.from; THIS_QUARTER → quý liền trước;
  THIS_YEAR → năm liền trước; còn lại (LAST_30_DAYS, LAST_12_MONTHS, CUSTOM) → previousPeriod(period)
suggestGranularity(period) → ReportGranularity   // ≤ 31 ngày DAY · ≤ 92 ngày WEEK · còn lại MONTH (gợi ý khi đổi kỳ)

RevenueCategoryRow { category; charge; reduction (≤ 0); reversal; net; share: number | null }
buildRevenueByCategory(revenueLines, period) → RevenueCategoryRow[]   // nature CHARGE/REDUCTION/REVERSAL, sắp net giảm dần
  BẤT BIẾN: Σ net = summarizePeriod.revenue; Σ reduction = summarizePeriod.reductions          // RV-BR-06, AC-RV-002

CostBreakdownRow { category; count; total; share: number | null; directTotal; indirectTotal }
buildCostBreakdown(costEntries, period) → { rows: CostBreakdownRow[]; total }   // Report 05; count = số CostEntry trong kỳ
  BẤT BIẾN: total = directCost + indirectCost của summarizePeriod cùng kỳ; share = total dòng / total (null nếu total = 0)

findRevenueReconciliationIssues(settlements, revenueLines, period) → { settlementId; rentalId; expected; recognized; diff }[]
  Settlement COMPLETED có completedAt ∈ kỳ và checkSettlementRevenueReconciliation(...).diff ≠ 0   // EX-07 UseCase

selectReportVehicleRows(rows: VehiclePerformanceRow[], vehicles) → VehiclePerformanceRow[]
  giữ mọi xe không INACTIVE; xe INACTIVE chỉ giữ nếu có phát sinh (revenue ≠ 0 / directCost ≠ 0 / rentalCount / incidentCount)  // EX-05
  BẤT BIẾN: Σ estimatedProfit các dòng = summarizePeriod.operatingProfit (mọi Revenue Line/Cost DIRECT đều gắn xe)
sortVehicleRows(rows, key: 'PROFIT' | 'REVENUE' | 'UTILIZATION') → giảm dần (utilization null xếp cuối)
```

Switch "Loại chi phí bất thường" (EX-04) xử lý **một lần** ở màn: `costEntriesForReport = exclude ? costEntries.filter(c
=> !c.isUnusual) : costEntries`, rồi truyền vào mọi hàm (KPI, biểu đồ, Hiệu quả xe, Chi phí) — không thêm tham số
riêng cho từng hàm. Mặc định **tắt** (tính đủ).

### 19.4. UI

- **`FinanceReportScreen`** (`screens/`): kiểm `can('FINANCE_REPORT','VIEW')` — thiếu quyền thì `PageHeader` + thông
  điệp không có quyền (AC-RV-012, truy cập thẳng URL), không gọi dữ liệu nào khác. `PageHeader` (tiêu đề "Báo cáo tài
  chính", mô tả) + dòng ghi chú: "Ghi nhận doanh thu khi quyết toán hoàn tất" (`REVENUE_RECOGNITION_POLICY_LABELS`) ·
  "Số liệu chưa chốt kỳ — có thể thay đổi khi phát sinh điều chỉnh" (`// TODO(OQ: RevenueCost-BRD.md §28 Q11/Q13 …)`).
  Comment đầu file `// TODO(OQ: RevenueCost-BRD.md §28 Q14/Q15/Q16 — danh mục báo cáo, KPI, người xem chưa chốt; dựng
  theo BRD §16)`. Dữ liệu: `useRevenueLines()`, `useCostEntries()`, `useCashEntries()`, `useSettlements()`,
  `useRentals()` (barrel `rentals`), `useIncidents()` (barrel `incidents`), `useVehicleBlocks()` (barrel `calendar`),
  `useVehicles` + `useCustomers` (deep import `hooks` — tiền lệ đã chấp nhận). `today = new Date()` một lần qua
  `useMemo`. Khi đổi kỳ: đặt lại độ chi tiết theo `suggestGranularity` (người dùng vẫn đổi tay được).
- **Tổng quan** (CR-2026-018): `FinanceKpiCards` — 7 thẻ: Doanh thu ghi nhận · Thực thu · Chi phí trực tiếp · **Lợi
  nhuận vận hành** (badge "Ước tính quản trị" — RV-BR-09) · Chi phí gián tiếp · Còn lại sau chi phí chung · Số lượt hoàn
  tất; mỗi thẻ: số kỳ này + "so kỳ trước" (`calcChangeRatio` ±x,x% hoặc "—", kèm khoảng ngày kỳ so sánh ở tooltip/
  dòng phụ). Màu ± trung tính (`text-muted-foreground`), không tô xanh/đỏ. Biểu đồ `FinanceTrendChart` (cột Doanh thu
  + cột Chi phí trực tiếp + đường Lợi nhuận vận hành). Bảng theo xe (`VehiclePerformanceTable variant="compact"`:
  Biển số · Doanh thu · Chi phí TT · Lợi nhuận · Utilization, sắp Lợi nhuận giảm dần) — click hàng mở
  `VehicleFinanceSheet`. Dòng chú thích AC-RV-009 (`vi.finance.revenueCost.estimateNote` dùng lại).
- **Doanh thu** (`RevenueReportPanel`, Report 01): lọc Xe + Khách (Select có "Tất cả"; lọc `revenueLines` và
  `settlements` theo `vehicleId`/`customerId` trước khi gọi `buildTimeSeries`); biểu đồ cột doanh thu; bảng Mốc ·
  Doanh thu · Số lượt · TB/lượt + dòng tổng; bảng cơ cấu theo danh mục (Danh mục · Thu · Giảm trừ · Đảo quyết toán ·
  Thuần · %); danh sách dòng giảm trừ (Ngày · Lượt thuê link `/rentals/:id` · Danh mục · Số tiền · Ghi chú); nếu
  `findRevenueReconciliationIssues` ≠ rỗng → khối cảnh báo liệt kê lượt + số lệch (seed kỳ vọng rỗng).
- **Hiệu quả xe** (`VehiclePerformanceTable variant="full"`, Report 02): Biển số · Hạng · Sở hữu · Số lượt · Ngày thuê
  · Ngày khả dụng · Utilization (1 chữ số thập phân) · Doanh thu · Chi phí TT · Lợi nhuận ước tính · Sự cố; Select sắp
  xếp Lợi nhuận/Doanh thu/Utilization; dòng tổng; banner xe ký gửi khi có xe `CONSIGNED` trong bảng (dùng lại
  `vi.finance.revenueCost.profitConsignmentBanner`; `// TODO(Phase 5)` + `// TODO(OQ: RevenueCost-BRD.md §28 Q18 …)`);
  click hàng → Sheet. Mobile `< sm`: card thay bảng.
- **Chi phí** (`CostBreakdownPanel`, Report 05): bảng Loại · Số bản ghi · Tổng · % · Trực tiếp · Gián tiếp + dòng tổng;
  biểu đồ cột ngang theo loại (`BarChart layout="vertical"`); link "Xem chi tiết chi phí" → `/finance/costs`.
- **`VehicleFinanceSheet`** (`components/`): `Sheet` phải, `w-full sm:max-w-3xl overflow-y-auto`; tiêu đề biển số +
  hãng/dòng; link "Mở hồ sơ xe" → `paths.vehicleDetail(id)`; bên trong `Tabs` Doanh thu / Chi phí / Lợi nhuận render
  `VehicleRevenueTab`/`VehicleCostTab`/`VehicleProfitTab` với prop mới `initialSelection` = kỳ đang chọn của báo cáo
  (`key` theo `vehicleId + from + to` để reset). Gate: chỉ cho mở khi `can('VEHICLE','EXPORT')` (CR-2026-036 — cùng
  gate 3 tab ở Vehicle Detail); thiếu quyền thì hàng không click được.
- **3 tab R1**: thêm prop tuỳ chọn `initialSelection?: PeriodSelection` (mặc định giữ `LAST_12_MONTHS` — Vehicle
  Detail không đổi hành vi). `VehicleProfitTab` thêm `FinanceTrendChart` theo tháng (dữ liệu `buildMonthlyVehicleSeries`)
  phía trên bảng tháng.
- **`FinanceTrendChart`** (`components/`): `ResponsiveContainer width="100%" height={260}` + `ComposedChart`; props
  `{ data: { bucket; revenue; directCost; profit }[]; granularity }`; màu **chỉ** `var(--color-primary)` (doanh thu),
  `var(--color-status-pending)` (chi phí), `var(--color-status-done)` (lợi nhuận); trục Y rút gọn bằng
  `Intl.NumberFormat('vi-VN', { notation: 'compact' })` khai báo trong component; tooltip `formatVnd`; nhãn mốc: Ngày
  `dd/MM` · Tuần "Tuần dd/MM" (chuỗi "Tuần" ở `vi.ts`) · Tháng `MM/yyyy`. Rỗng (mọi giá trị 0) → thông điệp trạng
  thái rỗng thay vì trục trống.
- Chuỗi mới: namespace `vi.finance.reports.*` (sau §19.2 điểm 3 không phải sửa kiểu ở 2 dialog). Không chuỗi nào chứa
  `§`, `UC-`, `AC-`, `.md`, "Phase".
- Responsive §11.5.

### 19.5. File

| Thao tác | File |
| --- | --- |
| Tạo | `src/features/finance/screens/FinanceReportScreen.tsx` · `components/FinanceKpiCards.tsx` · `FinanceTrendChart.tsx` · `VehiclePerformanceTable.tsx` · `RevenueReportPanel.tsx` · `CostBreakdownPanel.tsx` · `VehicleFinanceSheet.tsx` |
| Sửa | `src/features/finance/model.ts` (hàm §19.3 + `calcSettlementCollectOutstanding`) · `api.ts` (`completeSettlement` — chỉ cờ + chuỗi audit) · `hooks.ts` (`invalidatePayment`) · `seed.ts` (cờ `completedWithDebt` tính bằng hàm) · `index.ts` (`FinanceReportScreen`) |
| Sửa | `components/SettlementCompleteDialog.tsx` (kiểu khoá + cảnh báo) · `PostSettlementChargeDialog.tsx` (chỉ kiểu khoá) · `VehicleRevenueTab.tsx` / `VehicleCostTab.tsx` (prop `initialSelection`) · `VehicleProfitTab.tsx` (prop + biểu đồ) |
| Sửa | `src/shared/i18n/vi.ts` (`vi.finance.reports.*`; sửa `completeWithDebtWarning`) · `src/app/routes.tsx` (thay `ComingSoon` `/finance/reports`; giữ import `ComingSoon` vì route khác còn dùng) · `src/shared/fixtures/seedAll.ts` (`SEED_VERSION` 19) |
| **Cấm** | mọi file `features/vehicles/*`, `rentals/*`, `incidents/*`, `maintenance/*`, `calendar/*`, `customers/*`; `enums.ts`, `permissions.ts`, `paths.ts`, `nav.tsx`, `shared/lib/*`, `shared/ui/*`, `package.json`; mọi file `docs/*`, `CHANGELOG.md` |

### 19.6. Definition of Done — Round 2

- [ ] `npx tsc -b`, `npx oxlint`, `npm run build` sạch (cảnh báo chunk > 500 kB do `recharts` chấp nhận — §0.1 F7,
      ghi rõ trong báo cáo); `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới.
- [ ] `/finance/reports` không còn `ComingSoon`; `OPERATION_STAFF` vào thẳng URL thấy thông điệp không có quyền.
- [ ] **Tính tay kiểm chứng (ghi số cụ thể vào báo cáo bàn giao):** chọn preset **Tháng trước** — (a) liệt kê Revenue
      Line có `recognitionDate` trong tháng (theo Settlement/PSC seed) → Σ = thẻ Doanh thu ghi nhận = Σ cột Doanh thu
      bảng theo xe = Σ bucket biểu đồ = Σ cột Thuần ở cơ cấu danh mục; (b) liệt kê CostEntry trong tháng (lát Cost Record
      nhập tay + sự cố + bảo dưỡng) → Σ DIRECT = thẻ Chi phí trực tiếp, Σ INDIRECT = thẻ Chi phí gián tiếp, tổng = dòng
      tổng Report 05; (c) Σ Lợi nhuận các xe = thẻ Lợi nhuận vận hành; (d) bật "Loại chi phí bất thường" ở kỳ chứa
      khoản `OPERATIONS` 22.000.000 (≈ −35 ngày) → Chi phí gián tiếp giảm đúng 22.000.000, các thẻ khác không đổi.
- [ ] Report 02 một xe (vd `veh_017`, `LAST_12_MONTHS`) khớp từng số với tab Lợi nhuận Vehicle Detail cùng kỳ; drill-down
      mở đúng kỳ báo cáo đang chọn (CR-2026-018); Vehicle Detail mở trực tiếp vẫn mặc định 12 tháng gần nhất.
- [ ] "So kỳ trước": Tháng này ↔ tháng lịch trước; 30 ngày qua ↔ 30 ngày liền trước; kỳ trước bằng 0 → "—".
- [ ] **Badge "Đóng kèm công nợ":** không còn ở `stl_034`/`stl_037` (và `stl_038` bản hiện tại); **vẫn hiện** ở
      `stl_026`; ghi trong báo cáo giá trị `completedWithDebt` của cả 13 Settlement `COMPLETED` + snapshot `stl_038` bản 1
      (`true`) — tất cả do `calcSettlementCollectOutstanding` tính. Cảnh báo trong dialog đóng lượt dùng cùng hàm.
- [ ] Ghi/xác nhận/huỷ giao dịch trong Sổ giao dịch → quay lại Báo cáo, thẻ Thực thu cập nhật (invalidate §19.2 điểm 1).
- [ ] Biểu đồ chỉ dùng biến màu theme (không hex — `grep -rn '#[0-9a-fA-F]\{3,6\}' src/features/finance` không có kết
      quả mới); không chuỗi UI/lỗi/audit mới nào chứa `§`/`UC-`/`AC-`/`.md`/"Phase"; 2 dialog dùng kiểu
      `FinanceStringKey`; `vehicles/*` không có diff.

### 19.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §0.2-§0.4, §3.5-§3.6, §4, §11.3, §11.5, §12 và **§19 toàn bộ**.
2. `../thien-bao-car-docs/modules/RevenueCost-BRD.md` §12, §14, §16 (Report 01/02/05), §23 AC-RV-005/006/009/012/014,
   §24 EX-04/EX-05; `RevenueCost-UseCase.md` §12 (UC-RV-08), §14 (UC-RV-10), §16 (UC-RV-12), §24 EX-07.
3. `../thien-bao-car-docs/modules/RentalSettlement-BRD.md` §15, §16.1, §23 AC-RS-008/010, §24 EX-02 (nợ a).
4. `../thien-bao-car-docs/WebappQuanTri.md` §11.2 (gạch "Báo cáo tài chính").
5. `src/features/finance/model.ts` dòng 100-175 (`SettlementPaymentRequest`, `Settlement`), 467-492
   (`getCompletionBlockers`), 1019-1044 (`calcRequestProgress`), 1239-1256 (`buildSettlementPaymentRequest`), 1716-1840
   (kỳ phân tích), 1957-1962, 2080-2254 (tổng hợp R1).
6. `src/features/finance/api.ts` dòng 842-892 (`completeSettlement`), 1231-1242 (đọc Payment storage).
7. `src/features/finance/hooks.ts` dòng 30-62, 270-300, 405-463.
8. `src/features/finance/seed.ts` dòng 913-968 (`stl_026`), 1193-1218, 1277-1517 (`seedRevenueHistory`).
9. `src/features/finance/components/SettlementCompleteDialog.tsx`, `PostSettlementChargeDialog.tsx` dòng 1-40,
   `VehicleProfitTab.tsx`, `VehicleRevenueTab.tsx`, `VehicleCostTab.tsx` dòng 1-40, `FinancePeriodPicker.tsx`,
   `screens/CostRecordsScreen.tsx` (mẫu màn có kỳ + bảng/card).
10. `src/shared/i18n/vi.ts` dòng 1150-1160, 1495-1640 (`vi.finance.revenueCost`); `src/app/routes.tsx`;
    `src/shared/ui/sheet.tsx`, `switch.tsx`; `src/features/vehicles/model.ts` dòng 40-70 (chỉ đọc `Vehicle`).
11. Tài liệu `recharts` v3 (`ResponsiveContainer`, `ComposedChart`, `BarChart`, `Bar`, `Line`, `XAxis`, `YAxis`,
    `Tooltip`, `Legend`) — chỉ khi cần.

### 19.8. Thứ tự làm

1. Nợ (c) kiểu khoá → `vi.ts` (sửa chuỗi cảnh báo + khung `reports`). 2. `calcSettlementCollectOutstanding` →
`completeSettlement` → `SettlementCompleteDialog` → seed (cờ) → `SEED_VERSION` 19. 3. `invalidatePayment`. 4. Hàm
§19.3. 5. `FinanceTrendChart` → `FinanceKpiCards` → `VehiclePerformanceTable` → `VehicleFinanceSheet` (+ prop
`initialSelection` 3 tab, biểu đồ tab Lợi nhuận) → `RevenueReportPanel` → `CostBreakdownPanel` → `FinanceReportScreen`
→ `index.ts` → `routes.tsx`. 6. 3 cổng + grep + tính tay §19.6.

---

## 20. Round 3 — chi tiết giao việc (`APPROVED` 22/10/2026, `tech-lead` tự duyệt theo plan tổng)

Phạm vi = §1.4 + **gộp nợ (d)(e)(f)(g)** từ review Round 2 (§20.4). Không đổi cấu trúc entity, không sửa seed →
**không** bump `SEED_VERSION` (giữ 19). Không cần enum/permission mới: `REPORT_EXPORT` (`AUDIT_ACTIONS`) và
`FINANCE_REPORT.EXPORT` (ADMIN/MANAGER/ACCOUNTANT ✓, SALES ✓ qua `likeManager()`, OPERATION ✗ — BRD §22 "Xuất báo cáo")
đã có từ R1.

### 20.1. Trong / ngoài phạm vi

**Trong phạm vi**

1. `/finance/reports` thêm 3 tab (tổng 7): **Khách hàng** (Report 03 — `CustomerReportPanel`) · **Sự cố** (Report 04 —
   `IncidentReportPanel`) · **Đối chiếu & dòng tiền** (BRD §15 accrual ↔ cash + Report 06 — `ReconciliationPanel`).
2. **Xuất CSV** cho **cả 7 tab** (nút trong từng tab, `ReportExportButton`), gate `FINANCE_REPORT.EXPORT` (ẩn hẳn khi
   thiếu quyền), mỗi lần xuất ghi **đúng 1** audit `REPORT_EXPORT` qua `recordReportExport` (`api.ts`) rồi mới tải file.
3. `shared/lib/csv.ts` (`toCsv`, `downloadCsv`) — đã dự kiến ở §0.2/§14.3.
4. Nợ (d) lazy-load + (e) ghi chú chi phí phân bổ ngày tương lai + (f) gom `FinanceStringKey` + (g) chú thích `asOf` (§20.4).

**Ngoài phạm vi:** Xuất PDF/`.xlsx` (§1.5); Dashboard (Phase 6); Period Close; mọi file `vehicles/*`, `rentals/*`,
`incidents/*`, `customers/*`, `maintenance/*`, `calendar/*`; `enums.ts`, `permissions.ts`, `paths.ts`, `nav.tsx`; mọi
`seed.ts` + `seedAll.ts`; `shared/ui/*`; `package.json`, `vite.config.*` (không `manualChunks` — tách vendor chung là quyết
định build riêng, không thuộc nợ (d)); nợ (b) (phải sửa bản ghi cũ `rentals/seed.ts` — cấm §0.2).

### 20.2. Quyết định đã chốt khi lập Round 3 (kỹ thuật / suy trực tiếp từ tài liệu — không phải quyết định nghiệp vụ mới)

| # | Điểm | Quyết định | Căn cứ |
| --- | --- | --- | --- |
| 1 | Định dạng CSV | **UTF-8 có BOM** (`﻿`, để Excel đọc đúng tiếng Việt), phân cách **dấu phẩy**, xuống dòng **CRLF**, ô có `,` `"` CR/LF bọc `"…"` và nhân đôi `"`. **Không** dòng `sep=` (Excel bỏ qua BOM khi có dòng này → lỗi font). Tiền = **số nguyên đồng không dấu phân cách** (Excel cộng được, không lệch locale); ngày = chuỗi `dd/MM/yyyy`; tỷ lệ % = chuỗi như trên màn (vd `80,0%`), `null` → ô trống. Chống CSV-injection: ô **chuỗi** bắt đầu bằng `=` `+` `-` `@` TAB CR → thêm tiền tố `'` (số âm là ô số, không bị đổi). Rủi ro ghi nhận: Excel đặt vùng "Việt Nam" (phân cách danh sách `;`) có thể cần Data → From Text/CSV — chấp nhận cho demo | Kỹ thuật; UC-RV-13 chỉ yêu cầu "file kèm tiêu đề, kỳ, bộ lọc, thời điểm, người xuất" |
| 2 | Nội dung file | Khối đầu (mỗi dòng 2 ô nhãn · giá trị): Tên báo cáo · Kỳ `dd/MM/yyyy – dd/MM/yyyy` · Bộ lọc (hoặc "Không") · Ghi nhận doanh thu khi quyết toán hoàn tất · Số liệu chưa chốt kỳ · Xuất lúc `dd/MM/yyyy HH:mm` · Người xuất (họ tên + nhãn vai trò). Sau đó 1 dòng trống, rồi từng **phần** (tiêu đề phần · dòng tên cột · các dòng dữ liệu · dòng tổng nếu có), cách nhau 1 dòng trống. Cột = **đúng cột đang hiển thị** trên màn của tab đó | UC-RV-13 bước 3 |
| 3 | Dữ liệu cá nhân | Report 03 (màn + CSV) chỉ có **Mã khách (`customer.id`) + Họ tên + Trạng thái khách**; **không** SĐT/CCCD/GPLX/email/địa chỉ. Audit xuất **không** chứa tên/SĐT khách — chỉ mã báo cáo, kỳ, số dòng, bộ lọc dạng id/enum/boolean | BRD §16 Report 03 chỉ ghi "Khách"; §0.4 điểm 17; `TODO(OQ: AuditLog-BRD.md §22 Q4 / CustomerManagement-BRD.md §31 Q17)` |
| 4 | Ai được xuất | Đúng ma trận `FINANCE_REPORT.EXPORT` sẵn có — không thêm/sửa entry | BRD §22 + CR-2026-035 |
| 5 | Report 03 công nợ | `Outstanding` = số dư **hiện tại**; các cột khác theo kỳ | §0.4 điểm 15 |
| 6 | Report 06 vs Thực thu | Hiển thị **cầu nối** `Ròng Report 06 = Thực thu liên quan doanh thu − phần cấn trừ cọc (OFFSET) + dòng tiền ngoài doanh thu (cọc thu/hoàn, chi trả chủ xe)` | §0.4 điểm 16 |
| 7 | Định dạng xuất | Chỉ CSV (UC-RV-13 nêu PDF/Excel) | §1.5; `TODO(OQ: RevenueCost-BRD.md §28 Q14 …)` |

Không có điểm nào cần dừng hỏi người dùng.

### 20.3. Hàm thuần R3 (`model.ts`, nối tiếp khối RV) — mọi số do hàm tính; màn hiển thị và CSV dùng **cùng** kết quả

```text
// ---- dùng chung ----
isIncidentCostCounted(i: Incident) → boolean
  = INCIDENT_COST_STATUSES.includes(i.status) && (i.companyCost ?? 0) > 0
  deriveIncidentCostEntries() đổi sang gọi helper này — KHÔNG đổi hành vi (refactor 1 dòng)

// ---- Report 03 — BRD §13/§16, UC-RV-09 ----
CustomerReportRow { customerId; revenue; rentalCount; totalSpending; collected; outstandingNow; incidentCount }
buildCustomerReport({ revenueLines, settlements, cashEntries, incidents, rentals, balances: CustomerBalance[], period })
  → { rows; totals }
  revenue       = Σ RevenueLine.amount có customerId, recognitionDate ∈ kỳ                       // RV-BR-03
  rentalCount   = số Settlement COMPLETED của khách có completedAt ∈ kỳ (cùng điều kiện countCompletedSettlements)
  totalSpending = Σ completedTotals.finalAmount của đúng các Settlement trên                      // "Σ Final Amount đã ghi nhận"
  collected     = Σ CashEntry.signedAmount có revenueRelated, customerId, date ∈ kỳ               // RV-BR-14
  outstandingNow= balances.find(customerId)?.outstanding ?? 0                                      // §0.4 điểm 15 — hiện tại
  incidentCount = số Incident có rentalId → rental.customerId = khách, reportedAt ∈ kỳ
  Dòng có mặt khi: có ≥1 RevenueLine trong kỳ, hoặc rentalCount > 0, hoặc có CashEntry revenueRelated trong kỳ,
    hoặc incidentCount > 0, hoặc outstandingNow > 0. Không lọc theo khách còn tồn tại (tên thiếu → "—").
  BẤT BIẾN (không lọc trạng thái): Σ revenue = summarizePeriod.revenue · Σ collected = sumRevenueCash(kỳ) (= thẻ Thực thu)
    · Σ rentalCount = countCompletedSettlements(kỳ) · Σ outstandingNow = thẻ "Đang nợ" màn Công nợ khách hàng
sortCustomerRows(rows, key: 'REVENUE' | 'OUTSTANDING') → giảm dần                                 // UC-RV-09 bước 3
  Lọc trạng thái khách (Tất cả / ACTIVE / BLOCKED) làm ở panel trước khi sắp — tổng = Σ các dòng đang hiển thị.

// ---- Report 04 — BRD §16, nguồn Damage & Incident ----
IncidentReportRow { incidentId; incidentCode; vehicleId; rentalId?; reportedAt; status; actualCost: number | null;
                    customerCharge: number | null; companyCost: number | null; insuranceCovered: number | null; countedAsCost }
buildIncidentReport(incidents, period) → { rows (reportedAt giảm dần); totals }
  kỳ theo reportedAt (cùng mốc Cost Date chi phí sự cố — TODO(OQ) UC-RV-02 sẵn có); mọi trạng thái đều hiện
  actualCost = actualCostParts + actualCostLabor + actualCostOther (coi thiếu = 0) nếu ≥1 trường có giá trị, ngược lại null
  countedAsCost = isIncidentCostCounted(i)
  totals: Σ actualCost · Σ customerCharge · Σ companyCost · Σ insuranceCovered · countedCompanyCost = Σ companyCost của dòng countedAsCost
  BẤT BIẾN: totals.countedCompanyCost = dòng INCIDENT của Report 05 cùng kỳ (= Σ CostEntry source INCIDENT trong kỳ)

// ---- Đối chiếu — BRD §15, UC-RV-11, AC-RV-008 ----
ReconciliationResult { revenueAccrual; revenueCash; revenueDiff; costRecognized; costPaid; costDiff;
                       rentalRows: { rentalId: string | null; customerId?; accrual; cash; diff }[] }
buildReconciliation({ revenueLines, cashEntries, costEntries, period }) →
  s = summarizePeriod(revenueLines, costEntries, period)
  revenueAccrual = s.revenue ; revenueCash = sumRevenueCash(cashEntries, period)
  revenueDiff    = revenueAccrual − revenueCash      // > 0 công nợ phải thu · < 0 thu trước
  costRecognized = s.directCost + s.indirectCost
  costPaid       = Σ (−signedAmount) CashEntry type OWNER_PAYOUT, date ∈ kỳ    // §0.4 điểm 14 — hiện 0, TODO(Phase 5)
  costDiff       = costRecognized − costPaid
  rentalRows: nhóm theo rentalId (CashEntry không gắn lượt → nhóm null "Không gắn lượt thuê") —
     accrual = Σ RevenueLine trong kỳ của lượt; cash = Σ CashEntry revenueRelated trong kỳ của lượt; giữ diff ≠ 0;
     sắp |diff| giảm dần
  BẤT BIẾN: Σ rentalRows.diff = revenueDiff

// ---- Report 06 — BRD §16, dòng tiền vận hành ----
CashflowPoint { bucket; cashIn; cashOut (số dương); net }
CashflowMethodRow { method; cashIn; cashOut; net }
buildCashflow({ cashEntries, period, granularity }) → { points; byMethod; totals: { cashIn; cashOut; net };
                                                        bridge: { revenueCash; offsetRevenue; nonRevenueNet } }
  phạm vi = CashEntry date ∈ kỳ và method ≠ OFFSET (OFFSET không có dòng tiền — §0.4 điểm 12); mọi type
  points theo enumeratePeriodBuckets/bucketKeyOf (giống buildTimeSeries); byMethod chỉ phương thức có phát sinh
  bridge.revenueCash   = sumRevenueCash(cashEntries, period)
  bridge.offsetRevenue = Σ signedAmount CashEntry date ∈ kỳ, revenueRelated, method = OFFSET
  bridge.nonRevenueNet = Σ signedAmount CashEntry date ∈ kỳ, !revenueRelated, method ≠ OFFSET
  BẤT BIẾN: Σ points = Σ byMethod = totals ; totals.net = revenueCash − offsetRevenue + nonRevenueNet

// ---- Nợ (e) ----
sumFutureDatedCost(costEntries, period, today: Date) → number
  = Σ amount CostEntry có costDate ∈ kỳ và costDate > ngày địa phương của today
  (KHÔNG đổi quy tắc ghi nhận theo Cost Date — RV-BR-03, AC-RV-004; chỉ để hiện chú thích)

// ---- Xuất ----
FINANCE_REPORT_KEYS = ['OVERVIEW','REVENUE','VEHICLE_PERFORMANCE','COST_BREAKDOWN','CUSTOMER','INCIDENT','RECONCILIATION'] as const
  (hằng số UI ở model.ts — không phải enum nghiệp vụ, không đưa vào enums.ts)
ReportExportFilters { vehicleId?; customerId?; customerStatus?: CustomerStatus; granularity?: ReportGranularity;
                      sortKey?: string; excludeUnusual?: boolean }          // chỉ id/enum/boolean — không tên, không SĐT
CsvSection { title: string; headers: string[]; rows: CsvCell[][]; totalRow?: CsvCell[] }
buildReportCsvRows(meta: { metaLines: [string, string][] }, sections: CsvSection[]) → CsvCell[][]
  (meta đã là chuỗi tiếng Việt do component truyền từ vi.ts; hàm chỉ ghép khối đầu + dòng trống + các phần)
countCsvDataRows(sections) = Σ sections.rows.length   (không tính khối đầu, dòng tên cột, dòng tổng) → `rowCount` của audit
```

`CsvCell = string | number | null | undefined` khai ở `shared/lib/csv.ts`.

### 20.4. Nợ gộp

1. **(d) Lazy-load — bắt buộc.** Đã đo trước khi giao (`npm run build`, HEAD `0934efc`): **1 chunk JS duy nhất
   `index-*.js` 1.863,27 kB (gzip 483,60 kB)** + cảnh báo > 500 kB. `recharts` chỉ được import tĩnh ở
   `FinanceTrendChart.tsx` và `CostBreakdownPanel.tsx`; nhưng `FinanceTrendChart` được `VehicleProfitTab` dùng →
   barrel `finance` → `VehicleDetailScreen` (bundle chính). Vì vậy **chỉ lazy route là không đủ**, và `lazy(() =>
   import('@/features/finance'))` ở `routes.tsx` cũng **không tách được** (barrel đã import tĩnh). Cách làm:
   - `src/features/finance/screens/lazyScreens.ts` (mới): `export const FinanceReportScreen = lazy(() =>
     import('./FinanceReportScreen').then((m) => ({ default: m.FinanceReportScreen })))`.
   - `finance/index.ts`: dòng export `FinanceReportScreen` trỏ sang `./screens/lazyScreens` (**bỏ** export tĩnh từ
     `./screens/FinanceReportScreen` — giữ nguyên tên export, `routes.tsx` không phải đổi import, không deep import).
   - `app/routes.tsx`: bọc element route `financeReports` bằng `<Suspense fallback={…}>` (fallback = `<p
     className="text-muted-foreground text-sm">{vi.common.loading}</p>` viết inline, không tạo component mới ở `app/`).
   - `components/FinanceTrendChartLazy.tsx` (mới): `lazy(() => import('./FinanceTrendChart').then(…))` + `Suspense`
     fallback khung cùng chiều cao (`h-65` = 260px, không dùng giá trị tuỳ ý); props lấy bằng `ComponentProps<typeof
     FinanceTrendChart>` với `import type`. **Chỉ** `VehicleProfitTab` đổi sang bản lazy; `RevenueReportPanel` /
     `FinanceReportScreen` / `CostBreakdownPanel` giữ import tĩnh (đã nằm trong chunk lazy).
   - Kỳ vọng: chunk chính không còn mã `recharts` (kiểm `grep -c 'recharts-surface' dist/assets/index-*.js` = 0) + có chunk
     riêng cho màn báo cáo / biểu đồ. Cảnh báo > 500 kB **có thể vẫn còn** (phần còn lại của app) — chấp nhận, ghi số.
2. **(e) Chi phí phân bổ ngày tương lai — bắt buộc. Phương án: chú thích, không đổi dữ liệu.** Khi `sumFutureDatedCost
   (…) > 0` (dùng đúng danh sách cost entry đang tính — sau công tắc "bất thường"), hiện 1 dòng nhỏ `text-muted-foreground`:
   "Gồm {số tiền} chi phí phân bổ theo tháng có ngày ghi nhận sau hôm nay (mỗi tháng một phần theo ngày phân bổ)." Ở 3 chỗ:
   dưới thẻ KPI tab Tổng quan · đầu `CostBreakdownPanel` · dưới 3 thẻ tổng `CostRecordsScreen`. **Không** đổi ngày lát
   (`expandCostRecord`) — giữ RV-BR-03/AC-RV-004.
3. **(f) `FinanceStringKey` — gộp (rẻ).** Khai **một lần** ở `model.ts` (`import type { vi } from '@/shared/i18n/vi'` +
   `export type FinanceStringKey = …` y nguyên định nghĩa hiện có); 2 dialog xoá khai báo cục bộ, `import type` từ `../model`.
4. **(g) — gộp dạng chú thích (rẻ):** JSDoc `calcSettlementCollectOutstanding` thêm 1 câu: `asOf` lọc giao dịch theo
   thời điểm nhưng trạng thái hiệu lực (đảo/huỷ) lấy theo hiện tại — đủ cho cờ lịch sử + seed; muốn dùng như "số dư tại
   ngày X" phải xét thêm `reversedAt`. Không đổi logic.
5. **(b) — không gộp** (vùng cấm `rentals/seed.ts` bản ghi cũ).

### 20.5. UI

- **`FinanceReportScreen`**: thêm 3 query `usePostSettlementCharges()`, `usePaymentRequests()`, `useTransactions()` (gộp
  vào `queries` loading/error); `onHoldPscIds` + `balances = deriveCustomerBalances(…)` tính **y như**
  `CustomerReceivablesScreen` (cùng tham số) để Report 03 khớp màn Công nợ. 7 `TabsTrigger` (`TabsList className=
  "max-w-full"` đã cuộn ngang). Tab Tổng quan và Hiệu quả xe: nút xuất đặt đầu tab, sections dựng từ **chính**
  `kpiCurrent`/`kpiPrevious`/`series`/`overviewRows`/`sortedRows` đang render. Ghi chú (e) dưới `FinanceKpiCards`.
- **`ReportExportButton`** (`components/`): props `{ reportKey; period; filters?: ReportExportFilters; filterLabels:
  string[]; getSections: () => CsvSection[] }`. Ẩn khi `!can('FINANCE_REPORT','EXPORT')`. Click: `sections =
  getSections()` → `rowCount = countCsvDataRows(sections)` → `await recordExport.mutateAsync({ reportKey, from, to,
  rowCount, filters })` → **thành công mới** `downloadCsv(fileName, toCsv(buildReportCsvRows(…)))` + `toast.success`;
  lỗi → `toast.error(err.message)` và **không** tải file. Disabled khi đang pending. Người xuất lấy từ session (họ tên +
  `ROLE_LABELS`). Tên file ASCII: `bao-cao-<slug>_<from>_<to>.csv` (slug theo `reportKey`, vd `khach-hang`, `doi-chieu-dong-tien`
  — map trong component/`vi.ts`, không chứa `§`/`UC-`/`AC-`/`Phase`). Comment `// TODO(OQ: RevenueCost-BRD.md §28 Q14 —
  định dạng xuất PDF/Excel chưa chốt; demo xuất CSV mở bằng Excel)`.
- **Sections từng tab** (cột = cột trên màn):
  | Tab | Phần |
  | --- | --- |
  | Tổng quan | KPI (Chỉ số · Kỳ này · Kỳ so sánh · Thay đổi) 7 dòng · Theo mốc (Mốc · Doanh thu · Chi phí trực tiếp · Lợi nhuận vận hành) · Theo xe (bảng compact) |
  | Doanh thu | Theo mốc (+ dòng tổng) · Cơ cấu danh mục · Dòng giảm trừ — **sau** bộ lọc Xe/Khách của panel (bộ lọc ghi vào `filters` + `filterLabels`) |
  | Hiệu quả xe | Bảng full theo `sortKey` đang chọn + dòng tổng (`sumVehicleRows`) |
  | Chi phí | Bảng Report 05 + dòng tổng |
  | Khách hàng | Report 03 sau lọc trạng thái + sắp xếp + dòng tổng |
  | Sự cố | Report 04 + dòng tổng |
  | Đối chiếu & dòng tiền | Đối chiếu (6 chỉ số) · Chênh lệch theo lượt thuê · Dòng tiền theo mốc (+ tổng) · Theo phương thức (+ tổng) · Cầu nối |
- **`CustomerReportPanel`**: lọc trạng thái (Tất cả/Hoạt động/Bị khoá — `CUSTOMER_STATUS_LABELS`) + sắp (Doanh thu/Công
  nợ). Bảng: Mã khách · Khách (link `paths.customerDetail`) · Trạng thái · Số lượt · Doanh thu · Tổng chi tiêu · Thực
  thu trong kỳ · Còn phải thu (hiện tại) · Số sự cố + dòng tổng; chú thích "Còn phải thu là số dư hiện tại, không theo
  kỳ" + link `/finance/receivables`. Mobile `< sm`: card. Comment `TODO(OQ)` dữ liệu cá nhân (§20.2 điểm 3).
- **`IncidentReportPanel`**: Ngày báo · Mã sự cố (link `paths.incidentDetail`) · Xe (biển số) · Lượt thuê (link) · Chi phí
  thực tế · Khách chịu · Công ty chịu · Bảo hiểm · Trạng thái (`INCIDENT_STATUS_LABELS`) · Tính vào chi phí (Có/Chưa) +
  dòng tổng; chú thích "Chỉ sự cố đã chốt phần công ty chịu mới được tính vào chi phí". Ô `null` hiện "—".
- **`ReconciliationPanel`**: 2 khối thẻ — Doanh thu ghi nhận · Thực thu · Chênh lệch (nhãn "Công nợ phải thu" khi > 0,
  "Thu trước" khi < 0, "Khớp" khi 0) và Chi phí ghi nhận · Thực chi · Chênh lệch (chú thích: chi phí nhập tay không gắn
  giao dịch; thực chi hiện chỉ gồm chi trả chủ xe — sẽ có khi triển khai Xe ký gửi); bảng chênh lệch theo lượt (Lượt thuê
  link · Khách (họ tên) · Ghi nhận · Thực thu · Chênh lệch) + link "Xem công nợ khách hàng"; Report 06 bảng theo mốc
  (Mốc · Thu · Chi · Ròng + tổng) + bảng theo phương thức (`PAYMENT_METHOD_LABELS`) + khối cầu nối 4 dòng. Chú thích
  "Công cụ quản trị, không phải báo cáo lưu chuyển tiền tệ" (BRD §15). **Không** biểu đồ mới (giữ chunk nhỏ).
- **`RevenueReportPanel` / `CostBreakdownPanel`**: chỉ thêm nút xuất (+ ghi chú (e) ở `CostBreakdownPanel`, nhận thêm
  prop `today`); không đổi cách tính hiện có.
- Chuỗi mới: `vi.finance.reports.*` (nhãn tab, cột, chú thích, nhãn khối đầu CSV, tên báo cáo, slug, thông báo xuất).
  Không chuỗi nào (UI, tên file, tiêu đề cột, thông báo lỗi, `summary` audit) chứa `§`, `UC-`, `AC-`, `.md`, "Phase".
- Responsive §11.5; số liệu tiền `formatVnd` trên màn (CSV: số nguyên — §20.2 điểm 1).

### 20.6. File

| Thao tác | File |
| --- | --- |
| Tạo | `src/shared/lib/csv.ts` · `src/features/finance/screens/lazyScreens.ts` · `components/FinanceTrendChartLazy.tsx` · `ReportExportButton.tsx` · `CustomerReportPanel.tsx` · `IncidentReportPanel.tsx` · `ReconciliationPanel.tsx` |
| Sửa | `src/features/finance/model.ts` (§20.3 + `FinanceStringKey` + JSDoc (g) + `isIncidentCostCounted`) · `api.ts` (`recordReportExport`) · `hooks.ts` (`useRecordReportExport`) · `index.ts` (export lazy) |
| Sửa | `screens/FinanceReportScreen.tsx` · `screens/CostRecordsScreen.tsx` (chỉ ghi chú (e)) · `components/RevenueReportPanel.tsx` · `CostBreakdownPanel.tsx` · `VehicleProfitTab.tsx` (chỉ đổi sang chart lazy) · `PostSettlementChargeDialog.tsx` + `SettlementCompleteDialog.tsx` (chỉ kiểu `FinanceStringKey`) |
| Sửa | `src/shared/i18n/vi.ts` (`vi.finance.reports.*`) · `src/app/routes.tsx` (`Suspense` route báo cáo) |
| **Cấm** | mọi file ngoài 2 dòng trên, đặc biệt `features/vehicles/*`, `rentals/*`, `incidents/*`, `customers/*`, `maintenance/*`, `calendar/*`; `enums.ts`, `permissions.ts`, `paths.ts`, `nav.tsx`; mọi `seed.ts`, `seedAll.ts`, `registerSeeds.ts`; `shared/ui/*`, các file `shared/lib/*` hiện có; `package.json`, `vite.config.*`; `docs/*`, `CHANGELOG.md`, `CONVENTIONS.md` |

### 20.7. Definition of Done — Round 3

- [x] `npx tsc -b`, `npx oxlint` (không warning mới — kể cả `only-export-components`), `npm run build` sạch;
      `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới.
- [x] **Kích thước chunk:** ghi bảng trước (1.863,27 kB / gzip 483,60 kB, 1 chunk) và sau (mọi chunk JS + gzip);
      `grep -c 'recharts-surface' dist/assets/index-*.js` = 0 và > 0 ở một chunk khác.
- [x] **Tính tay — Report 06 ↔ thẻ Thực thu:** kỳ **Tháng trước** — liệt kê giao dịch hiệu lực có ngày trong kỳ (mã `GD-`,
      type, method, số tiền) → `bridge.revenueCash` = thẻ Thực thu tab Tổng quan cùng kỳ; `totals.net` = `revenueCash −
      offsetRevenue + nonRevenueNet` (ghi 3 số); Σ theo mốc = Σ theo phương thức = dòng tổng.
- [x] **Tính tay — đối chiếu 1 lượt:** `rt_026`/`stl_026` (lượt "đóng kèm công nợ") kỳ **12 tháng gần nhất** — Ghi nhận
      (Σ Revenue Line) − Thực thu (Σ giao dịch liên quan doanh thu của lượt, kể cả `OFFSET`) = Chênh lệch hiển thị; so với
      số dư của lượt ở màn Công nợ khách hàng và giải thích nếu khác. Σ chênh lệch các lượt = Chênh lệch tổng.
- [x] **Tính tay — Report 03:** kỳ **Tháng trước**, lọc Tất cả: Σ Doanh thu = thẻ Doanh thu ghi nhận; Σ Thực thu = thẻ Thực
      thu; Σ Số lượt = thẻ Số lượt hoàn tất; Σ Còn phải thu = thẻ "Đang nợ" màn Công nợ khách hàng.
- [x] **Tính tay — Report 04:** kỳ **12 tháng gần nhất** — Σ Công ty chịu của dòng "Tính vào chi phí" = dòng `INCIDENT` Report
      05 cùng kỳ.
- [x] **CSV:** với Report 04 (kỳ 12 tháng gần nhất) ghi số dòng dữ liệu + tổng cột Công ty chịu dự kiến của file, chỉ ra
      rằng file dựng từ **cùng biến** `rows`/`totals` mà bảng render (dẫn dòng code); BOM + phân cách + chống injection
      đúng §20.2 điểm 1; tên file + tiêu đề cột không chứa `§`/`UC-`/`AC-`/`.md`/"Phase".
- [x] **Audit:** mỗi lần bấm xuất thành công = **đúng 1** `REPORT_EXPORT` (`entity: 'FinanceReport'`, `after` = `{ reportKey,
      from, to, rowCount, filters }`, `summary` tiếng Việt có tên báo cáo + kỳ + số dòng); không chứa họ tên/SĐT/CCCD khách;
      lỗi `fakeRequest` → không tải file; đọc/guard (reportKey hợp lệ, `from ≤ to` dạng `yyyy-MM-dd`, `rowCount` nguyên ≥ 0)
      **trong** callback `fakeRequest`.
- [x] Nút xuất ẩn khi thiếu `FINANCE_REPORT.EXPORT` (đổi vai trò `OPERATION_STAFF`: không vào được báo cáo; 4 vai trò
      còn lại thấy nút).
- [x] (e) ghi chú hiện ở 3 chỗ khi kỳ Tháng này có lát phân bổ ngày sau hôm nay (vd lát của `cst_002`/`cst_003`), ẩn khi = 0;
      số liệu các thẻ không đổi so với trước khi sửa. (f) `FinanceStringKey` chỉ còn 1 khai báo. `deriveIncidentCostEntries`
      cho kết quả y như cũ.
- [x] Không diff ngoài danh sách §20.6 (`git status`); không `git stash`; không commit.

### 20.8. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §0.2-§0.4 (đặc biệt điểm 12, 14-17), §3.4, §11.4-§11.5, §12, §19.3 (hàm R2 dùng lại) và **§20 toàn bộ**.
2. `../thien-bao-car-docs/modules/RevenueCost-BRD.md` §13, §15, §16 (Report 03/04/06), §22 (dòng "Xuất báo cáo"), §23
   AC-RV-008/012, §25.3-§25.4, §28 Q14; `RevenueCost-UseCase.md` §13 (UC-RV-09), §15 (UC-RV-11), §17 (UC-RV-13).
3. `../thien-bao-car-docs/modules/AuditLog-BRD.md` §11 (che dữ liệu nhạy cảm — chỉ để hiểu giả định §20.2 điểm 3).
4. `src/features/finance/model.ts` dòng 495-517 (`calcSettlementCollectOutstanding`), 1299-1321 (`buildOffsetTransaction`),
   1405-1515 (`deriveCustomerBalances`), 1656-1760 (type RV), 1779-1860 (kỳ/bucket), 2009-2034, 2073-2135, 2312-2505 (R2).
5. `src/features/finance/api.ts` dòng 1-40, 100-110 (`ActorInfo`), 2325-2353 (`reverseCostRecord` — mẫu `fakeRequest` + audit).
6. `src/features/finance/hooks.ts` dòng 30-60 (`ANALYTICS_QUERY_KEY`, `useActor`), 405-465.
7. `src/features/finance/screens/FinanceReportScreen.tsx` (toàn bộ), `CustomerReceivablesScreen.tsx` dòng 1-75,
   `CostRecordsScreen.tsx` (khối 3 thẻ tổng); `components/RevenueReportPanel.tsx`, `CostBreakdownPanel.tsx`,
   `VehicleProfitTab.tsx`, `FinanceTrendChart.tsx`, `VehiclePerformanceTable.tsx` dòng 1-40, `CashDrawerSubmitDialog.tsx`
   dòng 40-60 (mẫu `toast`), 2 dialog có `FinanceStringKey` (dòng 1-30); `src/features/finance/index.ts`.
8. `src/features/incidents/model.ts` dòng 20-90 (`Incident`); `src/features/customers/model.ts` dòng 33-57 (`Customer`).
9. `src/shared/i18n/vi.ts` dòng 60-75 (`vi.common`), 1618-1700 (`vi.finance.reports`), các label map `ROLE_LABELS`,
   `CUSTOMER_STATUS_LABELS`, `INCIDENT_STATUS_LABELS`, `PAYMENT_METHOD_LABELS`; `src/shared/lib/audit.ts`,
   `fakeNetwork.ts`, `money.ts`, `datetime.ts`; `src/app/routes.tsx`, `src/app/paths.ts`; `.oxlintrc.json`.

### 20.9. Thứ tự làm

1. (f) `FinanceStringKey` → (g) JSDoc → `isIncidentCostCounted`. 2. `shared/lib/csv.ts`. 3. Hàm §20.3 trong `model.ts`.
4. `recordReportExport` → `useRecordReportExport`. 5. `vi.ts`. 6. `ReportExportButton` → `CustomerReportPanel` →
`IncidentReportPanel` → `ReconciliationPanel` → nút xuất ở `RevenueReportPanel`/`CostBreakdownPanel` → `FinanceReportScreen`
(3 tab, nút xuất 2 tab, ghi chú (e)) → ghi chú (e) `CostRecordsScreen`. 7. (d): `FinanceTrendChartLazy` + `VehicleProfitTab`
→ `lazyScreens.ts` → `index.ts` → `routes.tsx`. 8. 3 cổng + grep + đo chunk + tính tay §20.7.
