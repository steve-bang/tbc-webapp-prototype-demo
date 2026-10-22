# Kế hoạch Phase 4.4 — Refactor tách `features/finance` theo module (RS / PM / RV)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `DONE` (22/10/2026 — review `tech-lead` đạt vòng 1, không Blocker; kết quả ở §9) · `APPROVED` (22/10/2026 — người dùng chọn làm 4.4 trước Phase 5 và
uỷ quyền "làm"; `tech-lead` tự duyệt vì cấu trúc chọn **không** đổi tên export công khai, storage key, query key hay
hành vi — đúng điều kiện tự quyết người dùng đã đặt) · **Giao `dev`:** 22/10/2026, một lượt, làm theo thứ tự bước §4.

**Bản chất:** refactor thuần — **không đổi hành vi**. Không đổi storage key, query key, tên audit action,
`SEED_VERSION` (19), dữ liệu seed, thứ tự seed, tên export của barrel `@/features/finance`. Mục tiêu: file nhỏ để
review được, và Phase 5 (`OWNER_PAYOUT` ở Payment, `CONSIGNMENT_PAYOUT` ở Revenue & Cost) có chỗ đặt rõ ràng.

**Nguồn:** `CONVENTIONS.md` §3-§5/§7/§11 · `docs/ARCHITECTURE.md` §2-§4 · code `src/features/finance/*` tại commit
`14eb623` · `docs/IMPLEMENTATION-PLAN.md` Phase 4.3 (nợ h) + 4.1 Round 2 (3 nợ nhỏ) · `docs/REVENUE-COST-PLAN.md` §13
câu 4 (quyết định tách là task riêng sau 4.3).

---

## 0. Phân tích phụ thuộc hiện tại — vì sao cần tầng `core`

Số liệu đo trên `14eb623`: `model.ts` 2.944 dòng · `api.ts` 2.411 · `seed.ts` 1.611 · `hooks.ts` 474 · 50 component ·
7 screen. RS và PM **phụ thuộc hai chiều ở mọi tầng**, không thể chỉ cắt 3 thư mục dọc:

| Tầng | RS cần PM | PM cần RS |
| --- | --- | --- |
| model | `calcPaidToDate`/`calcDepositHeld`/`calcSettlementCollectOutstanding` dùng `PaymentRequest`/`Transaction` + `calcRequestProgress`/`calcLedgerDepositHeld` | builder `buildSettlementPaymentRequest`/`buildPscPaymentRequest`/`buildOffsetTransaction` nhận `Settlement`/`PostSettlementCharge`; `deriveRentalPaymentSummary` gọi `calcSettlementTotals` |
| api | `openSettlement`/`resync`/`createPaymentRequest`/`completeSettlement`/`createPostSettlementCharge`/`adjustSettlement`/`reverseSettlement` đọc-ghi `paymentRequests`/`transactions`, gọi `applyDepositOffsetInCallback` + `syncFinanceAfterPaymentChange` | `syncFinanceAfterPaymentChange` ghi ngược `settlements` + tự đóng PSC; `recordTransaction`/`createRefundTransaction` gọi `readRentalOrThrow` + `isPscOnHold` |
| UI | `SettlementWorksheet`/`PostSettlementChargeSection`/`SettlementCompleteDialog` dùng `usePaymentRequests`/`useTransactions`, `PaymentRequestStatusBadge` | `RentalPaymentTab`/`CustomerReceivablesScreen` dùng `useSettlementByRental`/`useSettlements`/`usePostSettlementCharges`, `isPscOnHold` |

RV chỉ **đọc** RS + PM (không ai đọc RV) → RV luôn nằm trên cùng.

**Kết luận thiết kế:** xếp tầng một chiều **`core` ← `payment` ← `settlement` ← `revenue-cost`**, gốc `finance/`
(`index.ts`, `seed.ts`) là composition root nằm trên tất cả.

- **Payment ở dưới Settlement** (không phải ngược lại) vì đây là chiều có ít thứ phải hạ xuống `core` nhất, và khớp
  ranh giới nghiệp vụ: Payment là **sổ giao dịch** (tầng dưới), Settlement **điều phối** yêu cầu thu/hoàn vào sổ đó
  (`Payment-BRD.md` — "thực thi Payment Request của Settlement"). Chiều "Payment đẩy Payment Status ngược lại" vẫn
  giữ nguyên logic, chỉ đi qua storage + kiểu của `core` (không import `settlement`).
- **`core` chỉ chứa thứ thật sự dùng chung bởi ≥ 2 module và cần nằm dưới `payment`**: kiểu entity được lưu của
  RS + PM, storage key + hàm đọc/ghi, `calcSettlementTotals` (con số Final Amount mà cả RS và PM cần), `isPscOnHold`,
  `NUMERIC_RE`, truy vấn **đọc** Settlement/PSC (api + hook) mà UI Payment cần, helper invalidate/`useActor`, hằng số
  & hàm ngày dùng chung của seed. Mọi luật nghiệp vụ riêng của từng module vẫn ở thư mục module.
- Phương án đã loại: (a) 3 thư mục dọc thuần + cho phép import hai chiều → vòng import thư mục; (b) đảo phụ thuộc
  bằng đăng ký callback → đổi luồng gọi, rủi ro hành vi, trái "refactor thuần"; (c) tách theo tầng
  (`data/` + `ui/`) → mất lát cắt module, Phase 5 không có chỗ đặt rõ.

---

## 1. Cấu trúc đích

```text
src/features/finance/
├── index.ts                 barrel công khai — DUY NHẤT nơi feature khác/route import (tên export giữ nguyên §3.6)
├── seed.ts                  composition root của seed: import 5 step + registerSeedStep đúng thứ tự cũ (§3.4)
├── core/                    tầng dưới cùng — dùng chung RS + PM (+ RV đọc)
│   ├── types.ts             kiểu entity lưu trữ RS + PM, ActorInfo, FinanceStringKey
│   ├── storage.ts           5 storage key RS + PM + hàm readAll…/writeAll… + readRentalOrThrow
│   ├── model.ts             calcSettlementTotals, isPscOnHold, NUMERIC_RE
│   ├── api.ts               đọc Settlement/PSC: listSettlements, getSettlementByRentalId, listPostSettlementCharges (+ filter)
│   ├── hooks.ts             useActor, ANALYTICS_QUERY_KEY, invalidateFinanceAll/invalidateSettlements/invalidatePayment,
│   │                        useSettlements, useSettlementByRental, usePostSettlementCharges
│   └── seedHelpers.ts       dt, hoursAfter, ACCOUNTANT, MANAGER, PM_ACCOUNTANT_*, PM_STAFF_*
├── payment/                 PM — sổ giao dịch
│   ├── model.ts · ledger.ts · api.ts · hooks.ts · seed.ts
│   ├── components/          14 component (§3.5)
│   └── screens/             TransactionLedgerScreen, CashDrawerScreen, CustomerReceivablesScreen
├── settlement/              RS — quyết toán + Post-Settlement Charge
│   ├── model.ts · api.ts · hooks.ts · seed.ts
│   ├── components/          18 component (§3.5)
│   └── screens/             SettlementListScreen
└── revenue-cost/            RV — phân tích
    ├── model.ts             lõi RV (kỳ, doanh thu, chi phí, thực thu, tổng hợp, hiệu quả xe) + form Cost Record + mã báo cáo
    ├── reportModel.ts       hàm thuần CHỈ màn Báo cáo tài chính dùng (chunk lazy) — §3.1
    ├── api.ts · hooks.ts · seed.ts
    ├── components/          18 component (§3.5)
    └── screens/             CostRecordsScreen, FinanceReportScreen, lazyScreens.ts
```

Gốc `finance/` sau refactor **chỉ còn** `index.ts` + `seed.ts`. Không tạo `index.ts` con trong thư mục con (§2).

---

## 2. Quy tắc phụ thuộc & import

**Cạnh thư mục được phép** (thư mục = cấp 1 dưới `finance/`):

| Từ \ được import | `core` | `payment` | `settlement` | `revenue-cost` | gốc (`index.ts`/`seed.ts`) |
| --- | --- | --- | --- | --- | --- |
| `core` | ✓ (nội bộ) | ✗ | ✗ | ✗ | ✗ |
| `payment` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `settlement` | ✓ | ✓ | ✓ | ✗ | ✗ |
| `revenue-cost` | ✓ | ✓ | ✓ | ✓ | ✗ |
| gốc | ✓ | ✓ | ✓ | ✓ | — |

1. **Import trực tiếp file đích bằng đường dẫn tương đối** (`../../core/hooks`, `../payment/model`), **không** tạo
   barrel con `index.ts` trong `core/`/`payment/`/`settlement/`/`revenue-cost/`. Lý do: barrel con kéo theo mọi
   component (kể cả `FinanceTrendChart`/`recharts`) vào chunk chính khi chỉ cần một hàm, phá lazy-load R3; và mỗi
   symbol chỉ có **một** nơi định nghĩa để grep/review.
2. **Không re-export trung gian** (ví dụ `settlement/model.ts` không `export type { Settlement } from '../core/types'`).
   Ngoại lệ duy nhất: barrel công khai `finance/index.ts`. Re-export tạm trong file gốc cũ chỉ được dùng **giữa các
   bước** §4 và phải xoá hết ở bước B4.
3. **Không file nào trong `finance/` import `@/features/finance`** (tự import barrel) hay import ngược file gốc.
4. Feature khác **chỉ** import `@/features/finance`; ngoại lệ có sẵn giữ nguyên: `shared/fixtures/registerSeeds.ts`
   import `@/features/finance/seed`. Import sâu sẵn có **từ trong** `finance` ra feature khác
   (`@/features/vehicles/hooks`, `@/features/customers/hooks`) giữ nguyên — không thuộc phạm vi 4.4.
5. `revenue-cost/reportModel.ts` **chỉ** được import bởi file nằm trong chunk lazy của màn Báo cáo
   (`FinanceReportScreen` + các panel/thẻ chỉ màn đó dùng). File nằm trong chunk chính (`VehicleRevenueTab`/
   `VehicleCostTab`/`VehicleProfitTab`/`CostRecordsScreen`/`revenue-cost/api.ts`/`hooks.ts`…) **không** được import nó.
6. Kiểm bằng `import-graph.mjs` (§6) — 0 vòng file, 0 vòng thư mục, cạnh thư mục ⊆ bảng trên.

---

## 3. Bản đồ di chuyển

Số dòng tham chiếu file tại `14eb623`. **Cắt-dán nguyên khối, giữ nguyên JSDoc/comment `TODO(OQ)`/mã requirement** đi
kèm. Thay đổi cơ học được phép ở §3.7 — ngoài ra không sửa thân hàm.

### 3.1 `model.ts` (2.944 dòng)

| Khối (dòng cũ) | Đích |
| --- | --- |
| 52-56 `FinanceStringKey` | `core/types.ts` |
| 58-224 kiểu RS: `SettlementLine`, `SettlementWaiver`, `DepositReconciliation`, `SettlementPaymentRequest`, `SettlementTotals`, `Settlement`, `SettlementReversal`, `PostSettlementCharge` | `core/types.ts` |
| 839-950 kiểu PM: `PaymentRequest`, `Receipt`, `Transaction`, `CashDrawerSubmission` | `core/types.ts` |
| 358-389 `calcSettlementTotals` · 633-640 `isPscOnHold` · 712 `NUMERIC_RE` (thêm `export`) | `core/model.ts` |
| 226-331 sinh dòng từ nguồn (`buildSourceLines`, `countPendingReturnIncidentItems` + hằng private) | `settlement/model.ts` |
| 391-571 đối trừ cọc, ngưỡng miễn giảm, `SETTLEMENT_TRANSITIONS`, blockers, `calcSettlementCollectOutstanding`, `mergeResyncedLines` | `settlement/model.ts` |
| 572-709 PSC/điều chỉnh/đảo (trừ `isPscOnHold`) | `settlement/model.ts` |
| 710-838 form schema RS + PSC (trừ `NUMERIC_RE` → import từ `core/model`) | `settlement/model.ts` |
| 332-357 `calcPaidToDate`, `calcDepositHeld` (đọc sổ giao dịch — `PAYMENT-PLAN.md` §10.3) | `payment/model.ts` |
| 951-1663 toàn bộ phần PM còn lại (view type `PaymentMilestoneView`/`RentalPaymentSummary`, sổ giao dịch, lịch thanh toán, Round 2, builder RS→PM, `deriveCustomerBalances`, form PM) | `payment/model.ts` |
| 1664-2289 lõi RV (chính sách ghi nhận, kiểu RV, kỳ phân tích, doanh thu, chi phí, thực thu, tổng hợp, hiệu quả xe) — **thêm `export` cho `dateKeyOf`** (reportModel cần) | `revenue-cost/model.ts` |
| 2829-2855 `sumFutureDatedCost`, `formatPercentText`, `formatChangeText` | `revenue-cost/model.ts` |
| 2856-2874 `FINANCE_REPORT_KEYS`, `FinanceReportKey`, `isFinanceReportKey`, `ReportExportFilters` (api cần) | `revenue-cost/model.ts` |
| 2902-2944 form Cost Record | `revenue-cost/model.ts` |
| 2290-2828 báo cáo §19.3 + Round 3 (Report 03/04/06, đối chiếu, dòng tiền) | `revenue-cost/reportModel.ts` |
| 2876-2900 `CsvSection`, `buildReportCsvRows`, `countCsvDataRows` | `revenue-cost/reportModel.ts` |

Kiểm tra khả thi đã chạy: không hàm nào ở 1664-2289 dùng symbol của 2290-2900 (chỉ chiều ngược lại) — `reportModel`
phụ thuộc `model`, không có vòng.

### 3.2 `api.ts` (2.411 dòng)

| Khối (dòng cũ) | Đích |
| --- | --- |
| 103-104 `SETTLEMENTS_STORAGE_KEY`, `POST_SETTLEMENT_CHARGES_STORAGE_KEY` · 1234-1236 3 key PM | `core/storage.ts` |
| 113-118 `readAll`/`writeAll` → **xuất bản tên `readAllSettlements`/`writeAllSettlements`** (§3.7 điểm 2) · 125-130 `readRentalOrThrow` · 145-150 `readAllPsc`/`writeAllPsc` · 1238-1255 read/write PM (6 hàm) | `core/storage.ts` (thêm `export`) |
| 106-111 `ActorInfo` | `core/types.ts` |
| 161-179 `SettlementFilter`, `matches`, `listSettlements`, `getSettlementByRentalId` · 903-919 `PostSettlementChargeFilter`, `listPostSettlementCharges` | `core/api.ts` |
| 119-123 `findOrThrow` · 132-143 `assertRentalInSettlement` · 152-159 `PSC_BLOCKER_MESSAGES` · 181-900 thao tác Worksheet · 920-1231 PSC/điều chỉnh/đảo quyết toán | `settlement/api.ts` |
| 1257-1365 `syncFinanceAfterPaymentChange` · 1367-1401 `applyDepositOffsetInCallback` (thêm `export`) | `payment/ledger.ts` |
| 1403-2128 toàn bộ PM còn lại | `payment/api.ts` |
| 2129-2411 RV (giữ `COST_RECORDS_STORAGE_KEY` + read/write `costRecords` tại đây — chỉ RV dùng) | `revenue-cost/api.ts` |

`payment/ledger.ts` là "đường ghi hệ thống" — không phải API cho UI; `payment/api.ts` và `settlement/api.ts` import
nó. `payment/hooks.ts` **không** dùng nó.

### 3.3 `hooks.ts` (474 dòng)

| Khối (dòng cũ) | Đích |
| --- | --- |
| 34-63 `ANALYTICS_QUERY_KEY`, `invalidateFinanceAll`, `useActor` · 80-90 `invalidateSettlements` · 273-279 `invalidatePayment` (thêm `export`) | `core/hooks.ts` |
| 65-78 `useSettlements`, `useSettlementByRental` · 235-240 `usePostSettlementCharges` | `core/hooks.ts` (gọi `core/api`) |
| 92-231 + 242-271 mutation Settlement/PSC/điều chỉnh/đảo | `settlement/hooks.ts` |
| 281-410 Payment | `payment/hooks.ts` |
| 411-474 RV | `revenue-cost/hooks.ts` |

Mỗi `hooks.ts` module giữ `import * as api from './api'`; query key giữ **nguyên văn** (kể cả
`[...ANALYTICS_QUERY_KEY, …]`).

### 3.4 `seed.ts` (1.611 dòng) — thứ tự chạy giữ nguyên

| Khối (dòng cũ) | Đích |
| --- | --- |
| 49-65 `dt`, `ACCOUNTANT`, `MANAGER`, `hoursAfter` · 69-72 `PM_ACCOUNTANT_USER_ID/NAME`, `PM_STAFF_USER_ID/NAME` | `core/seedHelpers.ts` (thêm `export`) |
| 74-678 `seedPaymentRound1` · 1047-1278 `seedPaymentRound2` | `payment/seed.ts` (export, **không** tự `registerSeedStep`) |
| 679-692 `confirmAllLines` · 693-1046 `seedFinance` | `settlement/seed.ts` (export, không tự đăng ký) |
| 1282-1607 hằng `HISTORY_*`/`REVERSED_SETTLEMENT_MISTAKE`/`SYSTEM_ADMIN_NAME`, `seedRevenueHistory`, `seedRevenueCost` | `revenue-cost/seed.ts` (export, không tự đăng ký) |
| 1279-1280 + 1608-1611 `registerSeedStep(...)` | `finance/seed.ts` (gốc) |

`finance/seed.ts` gốc sau refactor:

```text
registerSeedStep(seedPaymentRound1)
registerSeedStep(seedFinance)
registerSeedStep(seedPaymentRound2)
registerSeedStep(seedRevenueHistory)
registerSeedStep(seedRevenueCost)
```

Đúng thứ tự 1279 → 1280 → 1608 → 1610 → 1611 cũ. `shared/fixtures/registerSeeds.ts` **không sửa** (vẫn
`import '@/features/finance/seed'`). Bước seed dùng hàm của tầng nào thì import từ tầng đó, đúng bảng §2
(`settlement/seed` dùng builder ở `payment/model` ✓; `revenue-cost/seed` dùng cả RS + PM ✓; `payment/seed` chỉ
dùng `payment/model` + `core` — đã kiểm: R1/R2 không gọi hàm nào của RS).

### 3.5 `components/` + `screens/` — `git mv` nguyên file

| Đích | File |
| --- | --- |
| `settlement/components/` (18) | `PostSettlementChargeDialog`, `PostSettlementChargeSection`, `SettlementAdjustmentDialog`, `SettlementApprovalDialog`, `SettlementCompleteDialog`, `SettlementCustomerAckDialog`, `SettlementDepositDialog`, `SettlementDisputeDialog`, `SettlementLineConfirmDialog`, `SettlementManualLineDialog`, `SettlementOpenDialog`, `SettlementPaymentRequestDialog`, `SettlementResolveDisputeDialog`, `SettlementReversalHistory`, `SettlementReverseDialog`, `SettlementStatusBadge`, `SettlementWaiverDialog`, `SettlementWorksheet` |
| `settlement/screens/` | `SettlementListScreen` |
| `payment/components/` (14) | `CashDrawerSubmitDialog`, `CustomerBalanceSheet`, `PaymentAdjustmentDialog`, `PaymentRequestStatusBadge`, `PaymentScheduleCreateDialog`, `ReceiptDialog`, `RefundApprovalDialog`, `RefundCreateDialog`, `RentalPaymentTab`, `TransactionConfirmDialog`, `TransactionDetailSheet`, `TransactionReasonDialog`, `TransactionRecordDialog`, `TransactionStatusBadge` |
| `payment/screens/` | `TransactionLedgerScreen`, `CashDrawerScreen`, `CustomerReceivablesScreen` |
| `revenue-cost/components/` (18) | `CostBreakdownPanel`, `CostEntryTable`, `CostRecordFormDialog`, `CostRecordReverseDialog`, `CustomerReportPanel`, `FinanceKpiCards`, `FinancePeriodPicker`, `FinanceTrendChart`, `FinanceTrendChartLazy`, `IncidentReportPanel`, `ReconciliationPanel`, `ReportExportButton`, `RevenueReportPanel`, `VehicleCostTab`, `VehicleFinanceSheet`, `VehiclePerformanceTable`, `VehicleProfitTab`, `VehicleRevenueTab` |
| `revenue-cost/screens/` | `CostRecordsScreen`, `FinanceReportScreen`, `lazyScreens.ts` |

Chỉ sửa dòng `import` trong các file này. Cạnh chéo đã biết (đều đúng chiều §2): `settlement/components` →
`payment/components/PaymentRequestStatusBadge`, `payment/hooks` (`usePaymentRequests`/`useTransactions`),
`payment/model` (`calcRequestProgress`, `isEffectiveTransaction`, `summarizePscPayments`); `payment/*` →
`core/hooks` (`useSettlementByRental`/`useSettlements`/`usePostSettlementCharges`) + `core/model`
(`isPscOnHold`); `revenue-cost/*` → `core/hooks`, `payment/hooks`, `payment/model` (`deriveCustomerBalances`,
`CustomerBalance`). `lazyScreens.ts` và `FinanceTrendChartLazy.tsx` giữ nguyên `import('./…')` tương đối (đi cùng
file đích nên không đổi).

### 3.6 Barrel `finance/index.ts` — tên + loại export giữ nguyên (18 tên)

```text
type  Settlement, PostSettlementCharge, Transaction, PaymentRequest   ← './core/types'
type  CostRecord                                                       ← './revenue-cost/model'
value useSettlements, usePostSettlementCharges                         ← './core/hooks'
value SettlementListScreen ← './settlement/screens/…' · SettlementWorksheet ← './settlement/components/…'
value TransactionLedgerScreen, CashDrawerScreen, CustomerReceivablesScreen ← './payment/screens/…'
value RentalPaymentTab ← './payment/components/…'
value CostRecordsScreen ← './revenue-cost/screens/…'
value VehicleRevenueTab, VehicleCostTab, VehicleProfitTab ← './revenue-cost/components/…'
value FinanceReportScreen ← './revenue-cost/screens/lazyScreens'   (GIỮ bản lazy — không export tĩnh FinanceReportScreen.tsx)
```

`rentals/screens/RentalDetailScreen.tsx`, `vehicles/screens/VehicleDetailScreen.tsx`, `app/routes.tsx` **không sửa**.

### 3.7 Thay đổi cơ học được phép (ngoài ra không sửa thân hàm)

1. Thêm từ khoá `export` cho symbol trước đây private nay cần dùng chéo file (danh sách ở §3.1-§3.4).
2. Đổi tên **xuất bản** `readAll`/`writeAll` (Settlement) thành `readAllSettlements`/`writeAllSettlements` ở
   `core/storage.ts`; nơi dùng **import kèm alias** để thân hàm giữ nguyên chữ:
   `import { readAllSettlements as readAll, writeAllSettlements as writeAll } from '../core/storage'`
   (`settlement/api.ts`, `payment/ledger.ts`, `core/api.ts`, `revenue-cost/api.ts`).
3. Sửa đường dẫn import; tách/gộp danh sách import; `import type` cho import chỉ dùng kiểu (`verbatimModuleSyntax`).
4. Comment đầu file mới (1-3 dòng: file thuộc module nào, nguồn kế hoạch) — được thêm; comment có sẵn đi kèm khối thì
   giữ nguyên. Comment đang trỏ "`api.ts`/`model.ts`" cũ có thể giữ nguyên (không bắt buộc sửa).
5. Re-export tạm trong file gốc cũ giữa các bước §4 (xoá hết ở B4).

---

## 4. Các bước (giao `dev` một lượt, làm theo thứ tự; cuối mỗi bước 3 cổng sạch)

- **B0 — Baseline (tech-lead ĐÃ chạy trên `14eb623`, kết quả ở scratchpad §6.1).** `dev` chỉ xác nhận thư mục baseline
  tồn tại; không tự tạo lại trừ khi thiếu (khi đó dùng `git worktree` của `14eb623`, §6.1).
- **B1 — Dựng `core/`** (6 file) bằng cách cắt khối từ `model/api/hooks/seed` cũ; file cũ import lại từ `core` (re-export
  tạm nếu component còn import từ `../model`). 3 cổng.
- **B2 — Tách `payment/`**: `model.ts`, `ledger.ts`, `api.ts`, `hooks.ts`, `seed.ts`; `git mv` 14 component + 3 screen.
  3 cổng.
- **B3 — Tách `settlement/`**: `model.ts`, `api.ts`, `hooks.ts`, `seed.ts`; `git mv` 18 component + 1 screen. 3 cổng.
- **B4 — Tách `revenue-cost/`** (`model.ts` + `reportModel.ts` + `api.ts` + `hooks.ts` + `seed.ts`; `git mv` 18 component +
  3 file screens); viết lại `finance/seed.ts` gốc (§3.4) + `finance/index.ts` (§3.6); **xoá** `finance/model.ts`,
  `api.ts`, `hooks.ts`, thư mục `components/`, `screens/` cũ và mọi re-export tạm. 3 cổng.
- **B5 — Chứng minh không đổi hành vi** (§6 mục 1-7) — **trước** khi gộp nợ, để bằng chứng không lẫn thay đổi khác.
  Lưu output vào `<scratchpad>/after-refactor/`.
- **B6 — Gộp nợ** (§5): 4 mục, mỗi mục chỉ chạm file đã di chuyển. Chạy lại 3 cổng + harness (snapshot vẫn y hệt — nợ
  không chạm seed) + `moved-lines-diff` (chỉ thêm đúng các dòng của §5). Lưu vào `<scratchpad>/after-debt/`.

---

## 5. Nợ gộp / không gộp

**Gộp (B6) — không đổi hành vi nghiệp vụ, chạm đúng file đang di chuyển:**

1. **Nợ (h) — một helper định dạng %.** Thay 5 helper cục bộ trùng công thức bằng `formatPercentText`/
   `formatChangeText` (`revenue-cost/model.ts`), giữ đúng chuỗi thay thế khi `null`:
   - `VehiclePerformanceTable.formatUtilization(v)` và `VehicleProfitTab.formatUtilization(v)` →
     `formatPercentText(v, vi.finance.revenueCost.profitNotAvailable)`;
   - `RevenueReportPanel.formatShare(s)` → `formatPercentText(s, vi.finance.reports.compareNone)`;
   - `CostBreakdownPanel` ô `%` (dòng ~88, biểu thức inline) → `formatPercentText(row.share, t.compareNone)`;
   - `FinanceKpiCards.formatChange(r)` → `formatChangeText(r, vi.finance.reports.compareNone)`.
   Công thức đã đối chiếu giống từng ký tự (`Math.round(x*1000)/10` + `toLocaleString('vi-VN')`; bản "change" có
   `maximumFractionDigits: 1` + dấu ±) → chuỗi hiển thị không đổi. Sửa JSDoc của 2 helper: bỏ "(dùng khi dựng
   CSV)", ghi là helper chung cho màn + CSV. Helper đặt ở `model.ts` (không phải `reportModel.ts`) vì
   `VehicleProfitTab` thuộc chunk chính.
2. **Nợ 4.1 — `assertRentalInSettlement` cùng đuôi câu cho 12 hàm.** Thêm tham số
   `actionText = 'cập nhật quyết toán'`; `submitForCustomer` truyền `'gửi khách xác nhận'` (chuỗi lỗi của hàm này
   **giữ y hệt**); 11 hàm còn lại dùng mặc định → thông báo thành "… — không thể cập nhật quyết toán". **Đây là thay
   đổi chuỗi lỗi có chủ đích** (sửa câu sai ngữ cảnh), không đổi điều kiện chặn.
3. **Nợ 4.1 — `usePostSettlementCharges({ settlementId: undefined })` tải toàn bộ PSC.** Thêm tham số thứ hai
   `options?: { enabled?: boolean }` (truyền thẳng `enabled` vào `useQuery`, **query key giữ nguyên**);
   `SettlementWorksheet` gọi `usePostSettlementCharges({ settlementId: settlement?.id }, { enabled: !!settlement })`.
   `dev` xác nhận khi `settlement` chưa có thì Worksheet không render gì dùng `pscs` (nếu có chỗ dùng → dừng, báo lại,
   không gộp mục này). Chữ ký mới tương thích ngược — barrel export tên không đổi.
4. **Nợ 4.1 — nối `postSettlementChargeFormSchema` vào `PostSettlementChargeDialog`** (`CONVENTIONS.md` §7 bắt buộc
   dùng schema thật). Dialog gọi `safeParse({ source, type: fixedType ?? type, incidentId, amount, reason,
   evidenceNote })`, lỗi → `setError(result.error.issues[0].message)`; **sau** khi parse đạt mới kiểm `blocker` (giữ
   `if (isIncident && blocker) setError(vi.finance[PSC_BLOCKER_LABELS[blocker]])`). Bỏ 4 kiểm tra inline trùng schema.
   Để chuỗi hiển thị **không đổi**: sửa message `reason` trong schema từ `'Lý do là bắt buộc (tối thiểu 3 ký tự) —
   UC-RS-21'` thành `'Lý do là bắt buộc (tối thiểu 3 ký tự)'` (schema chưa được dùng ở đâu khác — đã grep). Thứ tự
   báo lỗi giữ nguyên: đã thử zod 4.6 — issue của trường (`reason`) đứng trước issue của `superRefine`
   (`incidentId`/`amount`/`type`), nên `issues[0]` cho đúng thứ tự cũ reason → sự cố/số tiền → loại khoản → blocker.

**Không gộp:**

- **Nợ (b)** seed `rentals` `createdAt` tương lai — phải sửa bản ghi cũ `rentals/seed.ts`, ngoài `finance`, đổi dữ liệu
  seed (phá bằng chứng snapshot y hệt).
- **Nợ (i)** bundle chính 1,46 MB — quyết định build (`manualChunks`), không phải refactor module.
- Mọi thay đổi nghiệp vụ, đổi tên export công khai, đổi storage/query key, đổi enum/permission/i18n.
- Sửa các message schema khác còn đuôi `— UC-RS-xx` (không thuộc 4 nợ trên; để task dọn chuỗi riêng nếu cần).

---

## 6. Definition of Done — bằng chứng không đổi hành vi

### 6.1 Công cụ & baseline (scratchpad của `tech-lead`, không thuộc repo)

Thư mục: `/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/finance-refactor/` (gọi tắt `$S`).

| File | Vai trò |
| --- | --- |
| `seed-harness.mjs` | Vite SSR + `localStorage` giả + `Date` cố định (22/10/2026 10:00 +07) + `Math.random` có hạt giống → chạy toàn bộ seed, ghi `seed-snapshot.json` (mọi key `tbc_admin:*`), `seed-finance.json`, `numbers.json`. Tham số `old`/`new` chọn đường dẫn module RV (`new` = `revenue-cost/{api,model,reportModel}.ts` đúng §3.1). **Bản v2 (dùng bản này):** đặt lại `rngState = 20261022` ngay trước `forceReseed()`. Lý do: bản v1 (`seed-harness-v1-noreset.mjs`) chỉ tất định *trong cùng một cây thư mục* — `Math.random` bị tiêu thụ lúc nạp module (số lần đổi theo đồ thị module + đường dẫn tuyệt đối), nên chạy `14eb623` ở thư mục khác hoặc sau khi đổi cấu trúc file cũng ra khác `before/`. Đặt lại hạt giống trước `forceReseed()` chỉ loại nhiễu lúc nạp; **mọi lời gọi `Math.random`/`generateId` trong các bước seed vẫn chạy trên cùng một chuỗi số** nên khác biệt về thứ tự gọi trong seed vẫn lộ ra. |
| `barrel-exports.mjs` | Liệt kê tên + loại (value/type) export của `finance/index.ts` qua TypeScript API. |
| `import-graph.mjs` | Đồ thị import (tính cả `import type`, `export … from`, `import()`): vòng file, cạnh + vòng thư mục, import sâu từ ngoài `finance`. Exit 1 nếu vi phạm. |
| `moved-lines-diff.mjs` | So multiset dòng code (bỏ câu import, bỏ tiền tố `export`) giữa `14eb623` và working tree → in dòng chỉ có ở một phía. |
| `keys.sh` | In storage key, query key, audit action, số lời gọi `appendAudit`, `SEED_VERSION`, thứ tự `registerSeedStep` (đã kiểm: tái tạo đúng `before/keys.txt`). |
| `before-reset/` | Baseline seed của harness v2 trên `14eb623`: `seed-snapshot.json`, `seed-finance.json`, `numbers.json` — **dùng thư mục này để so seed**. `tech-lead` đã tái tạo độc lập trên worktree `14eb623` ở đường dẫn khác → byte-giống nhau. |
| `before/` | Baseline `14eb623` (seed theo harness v1 — **không dùng để so seed nữa**): `seed-snapshot.json`, `seed-finance.json`, `numbers.json`, `barrel-exports.txt` (18 tên), `keys.txt` (storage key, query key, audit action, `appendAudit` = 43 lời gọi, `SEED_VERSION` 19, thứ tự `registerSeedStep`), `build.txt`. |

Nếu `$S/before/` mất: `git worktree add <tmp>/wt 14eb623 && ln -s <repo>/node_modules <tmp>/wt/node_modules`, chạy lại
harness + 2 script trên worktree, xoá worktree sau khi xong.

### 6.2 Tiêu chí (tất cả bắt buộc)

1. **3 cổng sạch**: `npx tsc -b` 0 lỗi · `npx oxlint` không thêm cảnh báo (baseline: đúng 2 cảnh báo có sẵn ở
   `shared/ui/badge.tsx`/`button.tsx`) · `npm run build` thành công.
2. **Barrel không đổi**: `node $S/barrel-exports.mjs <repo> | diff - $S/before/barrel-exports.txt` → rỗng (18 dòng,
   cùng loại value/type).
3. **Seed y hệt**: `TZ=Asia/Ho_Chi_Minh node $S/seed-harness.mjs <repo> new $S/after-refactor` →
   `cmp $S/before-reset/seed-snapshot.json $S/after-refactor/seed-snapshot.json` giống hệt (toàn bộ localStorage, không chỉ
   finance). Lặp lại sau B6 vào `$S/after-debt/`.
4. **Số kiểm chứng 4.1-4.3 không đổi** (`numbers.json` giống hệt `before-reset`): đối chiếu 12 tháng `revenueDiff` =
   **−45.760.000** (= Σ chênh lệch theo lượt; ghi nhận 63.750.000 / thực thu 109.510.000) · chênh lệch `rt_026` =
   **975.000** · doanh thu "Tháng trước" = **7.050.000**.
5. **Key / audit / seed version không đổi**: `bash $S/keys.sh <repo> | diff - $S/before/keys.txt` chỉ khác ở dòng `registerSeedStep order` (đường dẫn/số dòng đổi sang
   `features/finance/seed.ts:<n>`, **thứ tự 5 tên giữ nguyên**). Storage key 6, query key, multiset `action:` và số
   lời gọi `appendAudit` (43) giống hệt; `SEED_VERSION = 19`.
6. **Không import vòng**: `node $S/import-graph.mjs <repo>` exit 0 — `FILE cycles: none`, `FOLDER cycles: none`, cạnh
   thư mục chỉ gồm các ô ✓ của bảng §2 (`payment → core`, `settlement → core|payment`, `revenue-cost →
   core|payment|settlement`, `(root) → *`), không cạnh nào đi vào `(root)`; không deep-import từ ngoài `finance`.
   `grep -rn "reportModel" src/features/finance` chỉ ra file thuộc chunk báo cáo (§2 điểm 5).
7. **Không sửa thân hàm**: `node $S/moved-lines-diff.mjs <repo> 14eb623` sau B5 chỉ được còn: (a) 2 cặp dòng định
   nghĩa đổi tên `readAll`/`writeAll` → `readAllSettlements`/`writeAllSettlements` (§3.7 điểm 2); (b) comment đầu
   file mới (§3.7 điểm 4); (c) dòng re-export/import bị script bỏ qua nên không xuất hiện. Từ khoá `export` thêm vào
   đã được chuẩn hoá nên không hiện. Sau B6 thêm đúng các dòng của 4 nợ §5. Mọi dòng khác → giải thích trong báo cáo
   hoặc hoàn tác.
8. **Chunk build**: chunk `FinanceTrendChart-*.js` (~388,38 kB) và `FinanceReportScreen-*.js` vẫn là chunk riêng; chunk
   chính `index-*.js` **≤ 1.461,98 kB** (baseline; kỳ vọng giảm nhẹ vì `reportModel` rời chunk chính). Chunk báo cáo
   được phép tăng (nhận `reportModel`). Ghi bảng kích thước trước/sau vào báo cáo.
9. **Cấu trúc**: gốc `finance/` chỉ còn `index.ts` + `seed.ts`; không có `index.ts` con; không còn re-export tạm;
   `git status` không có file ngoài `src/features/finance/**` (riêng B6 không chạm file ngoài `finance`).
10. `grep -rn '\*/[a-zA-Z]' src/` không có kết quả mới; không `console.log`, không `any` mới.

---

## 7. Rủi ro

| Rủi ro | Kiểm soát |
| --- | --- |
| Sửa nhầm thân hàm khi cắt-dán thủ công | `moved-lines-diff.mjs` (§6.2 mục 7) + snapshot seed y hệt |
| Đổi thứ tự gọi `Math.random`/`generateId` trong seed → dữ liệu khác | Harness tất định so toàn bộ localStorage; thứ tự `registerSeedStep` cố định ở `finance/seed.ts` |
| Vòng import → lỗi TDZ lúc chạy (`Cannot access … before initialization`) chỉ lộ ở runtime | DAG §2 + `import-graph.mjs` tính cả `import type`; harness SSR nạp toàn bộ module graph |
| `recharts`/màn báo cáo rơi lại vào chunk chính | Không barrel con; `reportModel` chỉ import từ chunk lazy; so kích thước chunk (§6.2 mục 8) |
| Query key lệch → mất invalidate | Giữ nguyên văn, so `keys.txt`; helper invalidate dùng chung một nơi (`core/hooks.ts`) |
| `core` phình thành "thùng rác" về sau | Quy tắc ghi ở `CONVENTIONS.md` §3: chỉ thứ ≥ 2 module dùng VÀ phải nằm dưới `payment`; luật riêng module ở thư mục module |
| Nợ (3) đổi hành vi Worksheet khi chưa có Settlement | `dev` xác nhận không có chỗ dùng `pscs` khi `settlement` undefined; nếu có → bỏ mục này, báo lại |

---

## 8. Ngoài phạm vi

- Mọi thay đổi ngoài `src/features/finance/**` (kể cả `rentals`/`vehicles`/`app`/`shared`) — không cần, barrel giữ nguyên.
- Đổi tên component/hook/hàm công khai; đổi chữ ký hàm (trừ tham số tuỳ chọn ở nợ 2 và 3).
- Docs (`IMPLEMENTATION-PLAN.md`, `CHANGELOG.md`, `CONVENTIONS.md`, `ARCHITECTURE.md`, plan doc này) — `tech-lead` cập nhật.
- Phase 5 (`OWNER_PAYOUT`/`CONSIGNMENT_PAYOUT`): chỉ chuẩn bị chỗ đặt — `payment/` (giao dịch chi trả chủ xe) và
  `revenue-cost/api.ts` `listCostEntries` (comment Phase 5 có sẵn).

---

## 9. Kết quả (22/10/2026 — review `tech-lead` đạt vòng 1)

- `dev` làm B1-B4 trong một lượt bằng script cắt theo dải dòng §3 (không chạy 3 cổng riêng sau B1/B2/B3 — lệch §4;
  chấp nhận vì bằng chứng §6.2 đo trên trạng thái cuối, không phụ thuộc bước trung gian).
- `tech-lead` tự chạy lại toàn bộ §6.2: 3 cổng sạch (`oxlint` đúng 2 cảnh báo cũ) · barrel 18 tên diff rỗng · seed
  (harness v2) `seed-snapshot.json`/`seed-finance.json`/`numbers.json` giống hệt `before-reset/` · −45.760.000 /
  975.000 / 7.050.000 · `keys.sh` chỉ khác đường dẫn/số dòng `registerSeedStep` (thứ tự 5 tên giữ nguyên) · không vòng
  file/thư mục, cạnh đúng chiều §2 · `reportModel` chỉ 10 file chunk báo cáo · `moved-lines-diff` chỉ còn dòng của
  §3.7 + 4 nợ §5.
- Chunk: `index` 1.461,98 → **1.453,40 kB** · `FinanceReportScreen` 53,63 kB · `FinanceTrendChart` 388,38 →
  397,06 kB (nhận `reportModel`).
- 4 nợ: (h) `formatPercentText`/`formatChangeText` dùng chung màn + CSV (cùng công thức cũ); `assertRentalInSettlement`
  thêm `actionText` (mặc định "cập nhật quyết toán", 11 hàm đổi chuỗi lỗi có chủ đích, `submitForCustomer` giữ "gửi
  khách xác nhận"); `usePostSettlementCharges(filter, { enabled })`, Worksheet truyền `{ enabled: !!settlement }`;
  `PostSettlementChargeDialog` dùng `safeParse` — `tech-lead` kiểm thực nghiệm với zod 4.6.4: lỗi đầu tiên vẫn theo thứ
  tự cũ (lý do → sự cố → [chặn sự cố] / số tiền → loại khoản), chuỗi giống cũ, bỏ đuôi `— UC-RS-21`.
- Nợ nhỏ còn treo (không chặn): 60 import tương đối có đuôi `.ts` trong 18 file `finance/**` (cả repo còn lại không
  dùng đuôi) — bỏ đuôi khi chạm file; `amount` ở dialog PSC nay được `trim` trước khi kiểm (" 100" được chấp nhận,
  trước đây bị từ chối) — chấp nhận được.
