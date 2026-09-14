# Kế hoạch triển khai — Trang Bảo dưỡng & Phụ tùng (Vehicle Maintenance)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `DONE` (14/09/2026) — `dev` implement xong, review
`tech-lead` đạt ngay vòng 1 (không Blocker). Chi tiết bàn giao ở `CHANGELOG.md` 2026-09-14 mục
`Added`.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/VehicleMaintenance-BRD.md` (v1.1) +
`VehicleMaintenance-UseCase.md` (v1.1) + `../thien-bao-car-docs/WebappQuanTri.md` §6.2–§6.6 (Nhóm 1
— Xe & vòng đời, phần Bảo dưỡng/Phụ tùng). **Nguồn kỹ thuật:** `CONVENTIONS.md`,
`docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase 1), `docs/PAGE-IMPLEMENTATION-PRIORITY.md`
(P1.5). Đối chiếu mã hiện có: `src/shared/domain/enums.ts` (`COST_CATEGORIES` đã có `'MAINTENANCE'`,
`NOTIFICATION_EVENT_TYPES` đã có `'MAINTENANCE_DUE'`/`'VEHICLE_OVERUSE'` — cả hai chưa dùng ở Phase
1 vì Notification chưa build, chỉ ghi nhận comment), `src/shared/domain/permissions.ts`
(`MAINTENANCE.VIEW/CREATE/CONFIG` đã scaffold sẵn), và `src/features/vehicles/` (pattern mẫu gần
nhất + nguồn `Vehicle.currentKm`).

---

## 0. Cảnh báo quan trọng — mâu thuẫn tài liệu, đã xử lý

`VehicleMaintenance-BRD.md` (v1.1) §11 + `MT-BR-09` nói Maintenance/Spare Parts Record của xe
`CONSIGNED` **là chứng từ khấu trừ (Deduction)** trên bảng đối soát chủ xe. Đây là nội dung **CŨ**
— tài liệu này chưa được cập nhật version dù `CR-2026-050` (mô hình `FIXED_MONTHLY`, đã APPLIED)
**bãi bỏ hoàn toàn khái niệm khấu trừ**. `WebappQuanTri.md` §6.5 (tổng hợp mới hơn, có thẩm quyền
cao hơn theo quy ước tài liệu — `CLAUDE.md` kho tài liệu §1) xác nhận rõ: *"Chi phí bảo dưỡng (`MT`)
→ Cost Record `Category = MAINTENANCE` ở `RevenueCost`; với xe ký gửi **công ty vẫn chịu toàn bộ,
không khấu trừ chủ xe** (mô hình `FIXED_MONTHLY` — CR-2026-050)."*

**Quyết định: KHÔNG dựng bất kỳ logic Deduction/khấu trừ chủ xe nào trong feature này.**
`MaintenanceRecord`/`SparePartRecord` chỉ là lịch sử hoạt động + chi phí — không có field/quan hệ
nào trỏ tới "Owner Statement" hay "Deduction". Nếu sau này `VehicleConsignment` (Phase 5) cần đọc dữ
liệu này, đó là việc của module đó tham chiếu vào, không phải `Maintenance` sở hữu khái niệm khấu
trừ.

---

## 1. Phạm vi

### 1.1. Trong phạm vi

- Model `MaintenanceRule`, `MaintenanceRecord`, `SparePartRecord` (§2) — 3 entity độc lập, mỗi loại
  một storage key riêng (không nhúng trong `Vehicle`, khác `VehicleDocument`, vì `MaintenanceRule`
  có thể áp dụng theo `VEHICLE_MODEL` — nhiều xe cùng lúc).
- `api.ts`/`hooks.ts` cho cả 3 entity.
- `seed.ts`: đủ Rule cho các dòng xe phổ biến trong seed `vehicles` + Record lịch sử đa dạng đủ
  demo cả 3 trạng thái `OK`/`DUE_SOON`/`OVERDUE` + Spare Parts Record mẫu.
- Màn **Bảo dưỡng & phụ tùng** (`/maintenance`) — 1 trang, 2 tab (Maintenance · Spare Parts, đúng
  CR-2026-039 "giữ một module, UI tách 2 tab"):
  - Tab **Maintenance**: danh sách "đến hạn" toàn đội xe (mục tiêu chính theo
    `docs/PAGE-IMPLEMENTATION-PRIORITY.md`) + khu vực quản lý `MaintenanceRule` (tạo/vô hiệu hoá) +
    ghi nhận `MaintenanceRecord` mới + xem lịch sử theo xe.
  - Tab **Spare Parts**: lịch sử `SparePartRecord` toàn đội xe, lọc theo xe, ghi nhận mới.
- Hàm thuần tính `Next Due KM` + trạng thái `OK`/`DUE_SOON`/`OVERDUE` trong `maintenance/model.ts`.

### 1.2. Ngoài phạm vi — vì sao

| Nhóm | Lý do hoãn |
| --- | --- |
| **Logic Deduction/khấu trừ chủ xe** | Xem §0 — đã bị CR-2026-050 bãi bỏ, không dựng dù BRD gốc còn nhắc. |
| **Tồn kho phụ tùng** (số lượng còn trong kho) | BRD §4.2 minh thị Out of Scope Phase 1 — `SparePartRecord` chỉ là lịch sử thay thế, không phải quản lý kho. |
| **Bước duyệt chi phí** (giống `DamageIncident`) | Open Question §19 Q5, chưa chốt — Record tạo xong là ghi nhận luôn, không có workflow duyệt. |
| **Kênh gửi cảnh báo thật** (Notification) | `MAINTENANCE_DUE`/`VEHICLE_OVERUSE` đã có trong `NOTIFICATION_EVENT_TYPES` nhưng module `Notification` (Phase 6) chưa build — Phase 1 chỉ hiển thị trạng thái `DUE_SOON`/`OVERDUE` ngay trên UI, không "gửi" đi đâu. |
| **`VEHICLE_OVERUSE`** (cảnh báo vượt km/tháng) | Thuộc phạm vi khác (theo dõi vận hành so với `Allowed KM` tính phí khách — `RentalManagement`), không phải Maintenance. Không đụng tới. |
| **Ràng buộc chi phí MT không trùng Incident** (`MT-BR-08`) | Cần đối chiếu `DamageIncident` (Phase 3, chưa tồn tại) — chỉ ghi nhận bằng comment, chưa enforce được. |
| **Nối vào tab Maintenance+SpareParts của Vehicle Detail** | Đó là Round 2 của `features/vehicles` (`docs/VEHICLE-MANAGEMENT-PLAN.md` §0/§8) — việc **tiếp theo sau** feature này, không phải bây giờ. |

---

## 2. Data model

### 2.1. `MaintenanceRule` (feature `maintenance`, module `MT`)

| Field | Kiểu | Bắt buộc | Nguồn / ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | `generateId('mtrule')` |
| `category` | `string` | ✓ | BRD §6.1 — tên hạng mục bảo dưỡng (vd "Thay dầu", "Thay lốp"); free text Phase 1, không có danh mục cố định (BRD không liệt kê danh mục chuẩn) |
| `thresholdKm` | `number` | ✓ | Số km giữa 2 lần bảo dưỡng cùng hạng mục |
| `appliesTo` | `MaintenanceRuleAppliesTo` | ✓ | **Enum mới** `'SPECIFIC_VEHICLE' \| 'VEHICLE_MODEL'` |
| `vehicleId` | `string?` | Bắt buộc nếu `appliesTo === 'SPECIFIC_VEHICLE'` | Trỏ `Vehicle.id` |
| `vehicleModel` | `string?` | Bắt buộc nếu `appliesTo === 'VEHICLE_MODEL'` | So khớp `Vehicle.model` (chuỗi, so đúng như đã nhập ở `features/vehicles`) |
| `active` | `boolean` | ✓ | Mặc định `true`. Vô hiệu hoá thay vì xoá — `MT-BR-11` |
| `createdAt`/`updatedAt` | `string (ISO)` | ✓ | |

**Ưu tiên khi có nhiều Rule cùng `category` áp dụng cho 1 xe** (`MT-BR-02`): Rule
`SPECIFIC_VEHICLE` (`vehicleId` khớp) được ưu tiên hơn Rule `VEHICLE_MODEL` (`vehicleModel` khớp
`Vehicle.model`) cùng `category`.

### 2.2. `MaintenanceRecord`

| Field | Kiểu | Bắt buộc | Nguồn / ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | `generateId('mtrec')` |
| `vehicleId` | `string` | ✓ | `MT-BR-03` |
| `date` | `string (ISO date)` | ✓ | |
| `odometerAtService` | `number` | ✓ | `MT-BR-03`; validate ≥ `odometerAtService` của Record gần nhất cùng xe (bất kể category) — đồng bộ nguyên tắc "Return Odo ≥ Handover Odo" (`UC-MT-02` A1) |
| `category` | `string` | ✓ | Free text, nên khớp `category` của một `MaintenanceRule` đang `active` cho xe đó để tính lại Next Due KM đúng — nhưng **không bắt buộc khớp** (BRD không cấm ghi Record ngoài Rule đã cấu hình) |
| `cost` | `number` | ✓ | |
| `provider` | `string?` | | |
| `note` | `string?` | | |
| `createdAt`/`createdBy` | `string` | ✓ | |

**Không có `remove()`** — `MT-BR-11` (không xoá vật lý căn cứ đã dùng). Không có `update()` — Record
là lịch sử ghi nhận (append-only), khác `VehicleDocument` (giấy tờ có thể sửa thông tin).

### 2.3. `SparePartRecord`

| Field | Kiểu | Bắt buộc | Nguồn / ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | `generateId('sprec')` |
| `vehicleId` | `string` | ✓ | |
| `partName` | `string` | ✓ | |
| `quantity` | `number` | ✓ | |
| `date` | `string (ISO date)` | ✓ | |
| `odometerAtReplacement` | `number` | ✓ | |
| `cost` | `number` | ✓ | |
| `provider` | `string?` | | |
| `note` | `string?` | | |
| `createdAt`/`createdBy` | `string` | ✓ | |

**Độc lập hoàn toàn với `MaintenanceRule`/`MaintenanceRecord`** (`MT-BR-07`) — không tham chiếu
`category` nào, không tính vào Next Due KM. Cũng không có `remove()`/`update()`.

---

## 3. Hàm thuần (`maintenance/model.ts`)

```ts
/**
 * MT §6.3 — Next Due KM = Odometer at Service (MaintenanceRecord gần nhất
 * cùng vehicleId + category) + Threshold KM (MaintenanceRule áp dụng, ưu
 * tiên SPECIFIC_VEHICLE hơn VEHICLE_MODEL — MT-BR-02).
 *
 * Khi CHƯA có MaintenanceRecord nào cho cặp (vehicleId, category): BRD
 * EX-02 nói dùng "Odometer tại Consignment Intake" — nhưng VehicleConsignment
 * (Phase 5) chưa tồn tại, không có nguồn đó. Phase 1 dùng baseline = 0
 * (Next Due KM = Threshold KM) — nghĩa là xe chưa có lịch sử cho hạng mục
 * đó sẽ hiện đến hạn ngay nếu Current KM đã vượt Threshold, đúng tinh thần
 * "cần thiết lập bảo dưỡng lần đầu sớm". TODO(OQ: VehicleMaintenance-BRD.md
 * EX-02 — baseline thật sẽ cần Consignment Intake khi VehicleConsignment
 * build, sửa lại cùng lúc).
 */
export function nextDueKm(
  rule: MaintenanceRule,
  latestRecordOdometer: number | undefined,
): number // latestRecordOdometer ?? 0, + rule.thresholdKm

/**
 * MT §6.3/§19 Q2 — ngưỡng DUE_SOON (km) BA đề xuất tạm 500km (khớp ví dụ
 * minh hoạ AC-MT-003 trong BRD, KHÔNG phải giá trị đã chốt chính thức).
 * TODO(OQ: VehicleMaintenance-BRD.md §19 Q2 — số km cụ thể chưa chốt).
 */
export const DEFAULT_DUE_SOON_WARNING_KM = 500

export type MaintenanceDueStatus = 'OK' | 'DUE_SOON' | 'OVERDUE'

export function maintenanceDueStatus(
  nextDue: number,
  currentKm: number,
  warningKm: number = DEFAULT_DUE_SOON_WARNING_KM,
): MaintenanceDueStatus
// currentKm >= nextDue → OVERDUE
// currentKm >= nextDue - warningKm → DUE_SOON
// else → OK

/** MT-BR-02 — chọn Rule active ưu tiên SPECIFIC_VEHICLE trước VEHICLE_MODEL,
 * cùng category, áp dụng cho 1 xe cụ thể. */
export function applicableRule(
  rules: MaintenanceRule[],
  vehicle: Pick<Vehicle, 'id' | 'model'>,
  category: string,
): MaintenanceRule | undefined

/** UC-MT-02 A1 — validate odometer nhập không nhỏ hơn record gần nhất cùng xe. */
export function isOdometerRegression(
  records: MaintenanceRecord[],
  vehicleId: string,
  newOdometer: number,
): boolean

export const maintenanceRuleFormSchema = z.object({ /* category, thresholdKm, appliesTo bắt buộc; vehicleId/vehicleModel theo appliesTo (.refine) */ })
export const maintenanceRecordFormSchema = z.object({ /* vehicleId, date, odometerAtService, category, cost bắt buộc */ })
export const sparePartRecordFormSchema = z.object({ /* vehicleId, partName, quantity, date, odometerAtReplacement, cost bắt buộc */ })
```

**Không đưa `nextDueKm`/`maintenanceDueStatus` lên `shared/lib/`** — khác `documentExpiryStatus()`
(so ngày, đã dùng chung cho `customers` + `vehicles`), hàm này so **km** và hiện **chưa có feature
nào khác cần dùng lại**. Nếu Vehicle Detail (Round 2 của `vehicles`) cần, lúc đó import thẳng từ
`@/features/maintenance/model` — không cần trừu tượng hoá sớm.

---

## 4. Business rule cần trích dẫn

| Hành vi | Mã trích dẫn | Enforce? |
| --- | --- | --- |
| Rule có đủ Category/Threshold KM/Applies To | `MT-BR-01` | ✓ zod schema |
| Rule `SPECIFIC_VEHICLE` ưu tiên hơn `VEHICLE_MODEL` cùng category | `MT-BR-02` | ✓ `applicableRule()` |
| Record đủ Vehicle/Date/Odometer/Category/Cost | `MT-BR-03` | ✓ zod schema |
| Next Due KM tính lại mỗi khi có Record mới cùng category | `MT-BR-04` | ✓ tính động (không lưu cache), luôn derive từ Record mới nhất |
| Tạo sự kiện `MAINTENANCE_DUE` khi DUE_SOON/OVERDUE | `MT-BR-05` | Không enforce — Notification chưa build, chỉ hiển thị trạng thái trên UI |
| Ngưỡng cảnh báo do Maintenance sở hữu, không phải Notification | `MT-BR-06` | ✓ `DEFAULT_DUE_SOON_WARNING_KM` định nghĩa trong `maintenance/model.ts` |
| Spare Parts độc lập với Rule/Record | `MT-BR-07` | ✓ không có field tham chiếu chéo |
| Chi phí MT không trùng Incident | `MT-BR-08` | Chỉ ghi nhận bằng comment — `DamageIncident` chưa tồn tại |
| Deduction cho xe CONSIGNED | `MT-BR-09` | **Không áp dụng — xem §0** |
| Mọi tạo/vô hiệu hoá được audit | `MT-BR-10` | ✓ |
| Không xoá vật lý, chỉ vô hiệu hoá Rule | `MT-BR-11` | ✓ — Rule có `active`, Record/SparePart không có xoá/sửa gì cả (không cần vô hiệu hoá vì đã append-only) |

---

## 5. Màn hình

### 5.1. `MaintenanceScreen` (`/maintenance`) — `Tabs` 2 tab

Header cố định: `PageHeader` "Bảo dưỡng & phụ tùng" + bộ lọc theo xe (áp dụng cho cả 2 tab, dùng
chung 1 `Select` xe phía trên `TabsList` — đúng yêu cầu "lọc theo xe" của
`docs/PAGE-IMPLEMENTATION-PRIORITY.md`).

**Tab Maintenance:**
- Bảng "Đến hạn" — mỗi dòng = 1 cặp (xe, category có Rule active): biển số/hãng (join từ
  `useVehicles()`), category, Next Due KM, Current KM, trạng thái badge (`OK`/`DUE_SOON`/`OVERDUE`
  — màu tương ứng token status có sẵn). Sắp xếp mặc định: `OVERDUE` trước, rồi `DUE_SOON`, rồi `OK`.
  Lọc theo xe (dùng bộ lọc chung) thu hẹp danh sách.
- Nút "Thêm bản ghi bảo dưỡng" (gate `can('MAINTENANCE','CREATE')`) mở `MaintenanceRecordFormDialog`
  — chọn xe, ngày, odometer, category (gợi ý từ Rule active của xe đó, cho phép nhập tự do), chi
  phí, provider, ghi chú.
- Khu vực "Quy tắc bảo dưỡng" (gate `can('MAINTENANCE','CONFIG')` — ẩn/disable + tooltip "Quyền
  chưa chốt" khi `TBD`, đúng pattern đã dùng ở Employee/Customer cho các ô `TBD`): danh sách Rule
  (category, threshold, áp dụng cho xe/dòng xe nào, trạng thái active), nút "Thêm quy tắc" +
  "Vô hiệu hoá" trên từng dòng active.
- Lịch sử `MaintenanceRecord` theo xe đang lọc (nếu có chọn xe) — bảng đơn giản, sắp xếp theo ngày
  giảm dần.

**Tab Spare Parts:**
- Bảng lịch sử `SparePartRecord` toàn đội xe (hoặc theo xe đang lọc): biển số, tên phụ tùng, số
  lượng, ngày, odometer, chi phí, provider.
- Nút "Thêm phụ tùng thay thế" (gate `can('MAINTENANCE','CREATE')`) mở `SparePartRecordFormDialog`.

### 5.2. Component

`MaintenanceDueBadge` (badge 3 màu), `MaintenanceRuleFormDialog`, `MaintenanceRuleList` (+ nút vô
hiệu hoá), `MaintenanceRecordFormDialog`, `SparePartRecordFormDialog`, `VehicleFilterSelect` (dùng
chung cho cả 2 tab — có thể là 1 `Select` đơn giản build mới trong feature này, không cần tách
`shared/`).

---

## 6. Responsive

Bám khung đã dùng ở `vehicles`/`customers`: bảng "Đến hạn"/lịch sử ≥768px dạng `Table`
(`overflow-x-auto`), <768px chuyển card list (mỗi dòng = 1 card, badge trạng thái nổi bật ở góc).
`Tabs` tự cuộn ngang nếu cần (component có sẵn). Dialog form full-height mobile / dialog vừa desktop
(đúng pattern `Dialog` đã dùng ở `CustomerReasonDialog`/`VehicleDocumentFormDialog`).

---

## 7. Seed data (`features/maintenance/seed.ts`)

Phụ thuộc `vehicles` đã seed (18 xe) — đọc `id`/`model`/`currentKm` từ đó khi viết seed.

- **`MaintenanceRule`**: ≥3 Rule `VEHICLE_MODEL` cho các dòng xe phổ biến nhất trong seed `vehicles`
  (category ví dụ "Thay dầu máy" threshold 5000km, "Thay lốp" threshold 40000km, "Bảo dưỡng định kỳ"
  threshold 10000km) + ≥1 Rule `SPECIFIC_VEHICLE` override cho 1 xe cụ thể (minh hoạ `MT-BR-02`) +
  ≥1 Rule `active: false` (minh hoạ vô hiệu hoá, không hiện trong danh sách "Đến hạn").
- **`MaintenanceRecord`**: đủ để demo cả 3 trạng thái — ≥1 xe có Record khiến Next Due KM còn xa
  (`OK`), ≥1 xe `DUE_SOON` (Current KM gần Next Due KM trong khoảng `DEFAULT_DUE_SOON_WARNING_KM`),
  ≥1 xe `OVERDUE` (Current KM đã vượt), và ≥1 xe **chưa có Record nào** cho 1 category có Rule áp
  dụng (demo baseline = 0, xem §3) — tất cả tính **động** dựa trên `Vehicle.currentKm` thật đã seed,
  không hardcode trạng thái.
- **`SparePartRecord`**: ≥5 bản ghi đa dạng xe/loại phụ tùng.

Đăng ký `registerSeedStep()`, import **sau `vehicles`** trong `shared/fixtures/registerSeeds.ts`
(đúng thứ tự `employees → customers → vehicles → maintenance` đã chốt), bump `SEED_VERSION`.

---

## 8. API / hooks / audit

`api.ts` — 3 namespace storage riêng (`maintenance_rules`, `maintenance_records`,
`spare_part_records`), mọi hàm bọc `fakeRequest()`:

- Rule: `list()`, `create(input)`, `deactivate(id)` — không `update()` (đổi field khác ngoài
  active/hoá không có yêu cầu rõ, giữ đơn giản: sửa sai thì vô hiệu hoá + tạo Rule mới)
- Record: `list(filter?: { vehicleId? })`, `create(input)` — không `update()`/`remove()`
- SparePart: `list(filter?: { vehicleId? })`, `create(input)` — không `update()`/`remove()`

Mọi `create`/`deactivate` gọi `appendAudit()` — **4 audit action mới** nối cuối `AUDIT_ACTIONS`:
`CREATE_MAINTENANCE_RULE`, `DEACTIVATE_MAINTENANCE_RULE`, `CREATE_MAINTENANCE_RECORD`,
`CREATE_SPARE_PART_RECORD`.

`hooks.ts`: hook TanStack Query cho mỗi hàm trên + `useVehicles()` **import trực tiếp từ
`@/features/vehicles/hooks`** (chưa export qua barrel `vehicles/index.ts`) để join biển số/hãng/
`currentKm` vào bảng "Đến hạn". `invalidateQueries` đúng key sau mọi mutation.

---

## 9. i18n

Namespace `vi.maintenance.*` hoàn toàn mới (chưa có gì sẵn, khác Customer/Vehicle vốn có sẵn vài
label map) theo đúng cấu trúc các namespace trước. Thêm `MAINTENANCE_DUE_STATUS_LABELS` (`Record<MaintenanceDueStatus, string>`: `OK: 'Còn hạn'`, `DUE_SOON: 'Sắp đến hạn'`, `OVERDUE: 'Quá hạn'`).

---

## 10. Thay đổi ở file dùng chung

- `enums.ts`: thêm `MAINTENANCE_RULE_APPLIES_TO = ['SPECIFIC_VEHICLE', 'VEHICLE_MODEL']` (enum mới,
  dùng chung convention `as const`); nối 4 audit action mới vào cuối `AUDIT_ACTIONS`. Type
  `MaintenanceDueStatus` **không** vào `enums.ts` — đây là trạng thái tính động (derived), không
  lưu persistent, khai local trong `maintenance/model.ts` (đồng nhất với cách BRD mô tả — "không lưu
  như entity riêng").
- `permissions.ts`: **không sửa** — `MAINTENANCE.VIEW/CREATE/CONFIG` đã đúng, dùng nguyên (`CONFIG`
  vẫn `TBD` cho Manager/Sales, giữ nguyên).
- `vi.ts`: thêm `vi.maintenance.*` + `MAINTENANCE_DUE_STATUS_LABELS`.
- `shared/fixtures/registerSeeds.ts`: import `seedMaintenance` sau `vehicles`.
- `app/routes.tsx`: bỏ `ComingSoon` cho `/maintenance` (route + sidebar entry đã sẵn từ Phase 0,
  không cần sửa `paths.ts`/`nav.tsx`).
- `docs/IMPLEMENTATION-PLAN.md`: tick khi xong.

---

## 11. Mã requirement cần trích trong code

`MT-BR-01, 02, 03, 04, 06, 07, 09 (bãi bỏ — xem §0), 10, 11` · `UC-MT-01, 02, 03, 04, 05` ·
`CR-2026-039, 050`.

---

## 12. Definition of Done

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch (không cần Playwright).
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. *(Chủ dự án tự test thủ công sau bàn giao)*: reset demo data → tab Maintenance hiện đúng danh
   sách "Đến hạn" với ≥1 xe mỗi trạng thái `OK`/`DUE_SOON`/`OVERDUE` (kể cả xe chưa có Record nào);
   lọc theo xe hoạt động đúng cho cả 2 tab; thêm Rule mới (cả `SPECIFIC_VEHICLE` và
   `VEHICLE_MODEL`), vô hiệu hoá Rule; thêm `MaintenanceRecord` mới → Next Due KM của xe đó cập nhật
   lại đúng; odometer nhập nhỏ hơn record gần nhất bị chặn; tab Spare Parts thêm/xem lịch sử đúng;
   đổi vai trò Topbar → `ACCOUNTANT` không thấy nút Thêm (không có `CREATE`), `OPERATION_STAFF` thấy
   nút Thêm Record/SparePart nhưng không thấy khu vực Quy tắc (không có `CONFIG`); ở 375px bảng
   chuyển card, không cuộn ngang toàn trang.
4. `docs/IMPLEMENTATION-PLAN.md` tick `[x]` cho `features/maintenance`, xoá `ComingSoon` `/maintenance`.

---

## 13. Việc tiếp theo sau khi phê duyệt

Tài liệu này trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work + danh sách file
cần đọc trước theo format chuẩn). Sau khi qua review `tech-lead` đạt (4 bước chuẩn — `tech-lead` tự
bàn giao commit + docs + push), **task tiếp theo là Round 2 của `features/vehicles`** (Vehicle
Detail) — lúc đó tab Maintenance+SpareParts sẽ nối thẳng vào dữ liệu thật của feature này, đúng thứ
tự đã chốt ở `docs/VEHICLE-MANAGEMENT-PLAN.md` §0.
