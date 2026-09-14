# Kế hoạch triển khai — Trang Quản lý Xe (Vehicle Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `PENDING_APPROVAL` — chờ phê duyệt trước khi giao
`dev` implement. **Không code** — tài liệu này chỉ lên kế hoạch.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/VehicleManagement-BRD.md` (v1.12) +
`VehicleManagement-UseCase.md` (SRS-VM-*, lưu ý header không chuẩn — xem `CLAUDE.md` kho tài liệu
mục "Known inconsistencies") + `../thien-bao-car-docs/WebappQuanTri.md` §6 (Nhóm 1 — Xe & vòng đời).
**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase 1),
`docs/PAGE-IMPLEMENTATION-PRIORITY.md` (P1.4/P1.5/P1.6). Đối chiếu mã hiện có: `src/shared/domain/enums.ts`
(`VEHICLE_STATUSES`, `VEHICLE_CLASSES`, `OWNERSHIP_TYPES`, `VEHICLE_DOCUMENT_TYPES`,
`DOCUMENT_STATUSES`, `CONDITION_EVENT_TYPES` — **tất cả đã scaffold sẵn từ Phase 0, đúng khớp BRD**),
`src/shared/domain/permissions.ts` (`VEHICLE.VIEW/EDIT/BLOCK/EXPORT` đã có sẵn), và
`src/features/customers/` (pattern mẫu gần nhất — đặc biệt cơ chế `DocumentStatus`/document CRUD).

---

## 0. Điểm mấu chốt cần đọc trước — thứ tự xây dựng liên-feature

`docs/PAGE-IMPLEMENTATION-PRIORITY.md` đã chốt thứ tự build Phase 1: **Vehicle list (P1.4) →
Maintenance list (P1.5) → Vehicle Detail (P1.6)**. Lý do: tab **Maintenance + Spare Parts** trong
Vehicle Detail cần dữ liệu thật từ `features/maintenance` — xây trước sẽ phải giả lập, trái nguyên
tắc "không mock tĩnh".

**Vì vậy tài liệu này chỉ lên kế hoạch chi tiết đầy đủ cho `features/vehicles` — Round 1 (Vehicle
List + Document CRUD, tương ứng P1.4).** Round 2 (Vehicle Detail, P1.6) được **phác thảo ở §8** đủ
để hình dung toàn cảnh, nhưng **chưa chốt chi tiết thi công** — sẽ lên kế hoạch đầy đủ riêng sau khi
`features/maintenance` (task kế tiếp trong backlog, task #4) hoàn thành. Đây là quyết định về trình
tự, không phải cắt giảm phạm vi: Vehicle Detail vẫn đầy đủ như BRD mô tả, chỉ dời thời điểm chi tiết
hoá.

**Khuyến nghị trình tự 3 bước cho tech-lead/người dùng:**
1. **Bước này**: `features/vehicles` Round 1 (Vehicle List).
2. **Tiếp theo**: `features/maintenance` (Bảo dưỡng & phụ tùng) — dùng `Vehicle.currentKm` đã có từ
   bước 1.
3. **Sau đó**: `features/vehicles` Round 2 (Vehicle Detail) — lên kế hoạch chi tiết riêng lúc đó,
   nối thẳng dữ liệu Maintenance thật.

---

## 1. Phạm vi Round 1 (Vehicle List)

### 1.1. Trong phạm vi

- Model `Vehicle` + `VehicleDocument` (§2).
- `api.ts`: `list/getById/create/update/changeStatus` (không có `remove` — xem §4) +
  `addDocument/updateDocument` (không có xoá document — xem §2.2).
- `hooks.ts` tương ứng.
- `seed.ts`: 15–20 xe (~90% `CONSIGNED`) + document mẫu đủ 3 trạng thái hạn.
- Màn **Danh sách xe** (`/vehicles`): tìm kiếm biển số/hãng/dòng, lọc trạng thái/hãng/`Vehicle
  Class`/`Ownership Type`, tạo/sửa xe qua Sheet.
- **Quản lý giấy tờ xe** (`VehicleDocument`): Dialog/Sheet riêng mở từ hàng trong List (chưa có
  Vehicle Detail ở round này) — component này **sẽ được tái dùng nguyên** trong tab Documents của
  Vehicle Detail ở Round 2, không viết lại.
- Đổi trạng thái xe (`AVAILABLE ⇄ MAINTENANCE`, `→ INACTIVE`) — action đơn giản, audit đầy đủ.
- **Extract hàm dùng chung `documentExpiryStatus()`** ra `shared/lib/documentStatus.ts`, refactor
  `features/customers/model.ts` dùng lại thay vì bản riêng — xem §3.

### 1.2. Ngoài phạm vi Round 1 — vì sao

| Nhóm | Lý do hoãn |
| --- | --- |
| **Vehicle Detail** (mọi tab) | Round 2 — xem §0/§8. Route `/vehicles/:id` giữ `ComingSoon`. |
| **Vehicle Block** (khoá lịch xe, CR-2026-015) | `docs/PAGE-IMPLEMENTATION-PRIORITY.md` mục Vehicle List **không liệt kê** Vehicle Block trong scope P1.4; cơ chế này gắn chặt với `RentalCalendar` (CR-2026-017 — tạo/gỡ khoá **trực tiếp trên màn lịch**) và kiểm tra availability của `RentalManagement` — cả hai đều Phase 2, chưa tồn tại. Xây Block riêng lẻ bây giờ sẽ là tính năng "treo" không có nơi enforce. Hoãn sang khi `RentalCalendar` build. |
| **Ảnh xe** (Exterior/Interior — BRD §20) | Không có backend lưu file thật (giống lý do "chỉ metadata" ở `CustomerDocument` Round 1 trước). Field `fileMeta` (tên file) có trong `VehicleDocument`, nhưng ảnh xe (không phải giấy tờ) không có trong scope P1.4 của `PAGE-IMPLEMENTATION-PRIORITY.md`. |
| **Rental/Incident/Revenue/Cost History** | Thuộc Vehicle Detail, module nguồn (`RM`/`DI`/`RV`) chưa tồn tại. |
| **Ràng buộc "1 document `VALID`/loại tại một thời điểm"** | BRD §16.1/§26 Q20 ghi rõ đây là **đề xuất BA, chưa chốt với khách**. Không tự enforce — cho phép nhiều document cùng loại tồn tại song song (đúng với "cho phép nhiều bản ghi lịch sử" đã chốt). |

---

## 2. Data model

### 2.1. `Vehicle` (feature `vehicles`, module `VM`)

| Field | Kiểu | Bắt buộc | Nguồn / ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | `generateId('veh')` |
| `plate` | `string` | ✓ | **Duy nhất toàn hệ thống** — `VM-RULE-001`, BRD §8 |
| `brand` | `string` | ✓ | BRD §7 "Brand" |
| `model` | `string` | ✓ | BRD §7 "Model" |
| `manufacturingYear` | `number?` | | BRD §7 |
| `color` | `string?` | | BRD §7 |
| `vehicleClass` | `VehicleClass` | ✓ | `VEHICLE_CLASSES` đã có (`VIP_LUXURY`/`STANDARD`/`TWO_SEATER`), mặc định `STANDARD` — `VM-RULE-011`, CR-2026-008 |
| `ownershipType` | `OwnershipType` | ✓ | `OWNERSHIP_TYPES` đã có (`OWNED`/`CONSIGNED`) — **lưu ý đặt tên:** BRD gốc viết `COMPANY_OWNED`, nhưng `WebappQuanTri.md` §6.2 (tài liệu tổng hợp có thẩm quyền cao hơn theo `CLAUDE.md` repo docs §1) **và** `enums.ts` đã scaffold đều dùng `OWNED` — giữ nguyên `OWNED`, không đổi. Mặc định `OWNED`. |
| `bankFinanced` | `boolean` | ✓ | mặc định `false` — `VM-RULE-018`, CR-2026-042 |
| `currentKm` | `number` | ✓ | BRD §7 "Current Odometer" — **field này `features/maintenance` (task tiếp theo) sẽ đọc để tính Next Due KM**, không đổi tên/shape sau này |
| `fuelLevel` | `number?` | | BRD §7, đơn vị % (0-100) hoặc vạch — theo pattern đã có ở module khác nếu có, nếu không thì % đơn giản |
| `status` | `VehicleStatus` | ✓ | `VEHICLE_STATUSES` đã có, mặc định `AVAILABLE` |
| `note` | `string?` | | BRD §7 |
| `documents` | `VehicleDocument[]` | ✓ (mặc định `[]`) | §2.2 |
| `createdAt`/`updatedAt` | `string (ISO)` | ✓ | |

**Field KHÔNG lưu trên model (và lý do):**

- **`Registration Number`/`Registration Expiry Date`/`Insurance Provider`/`Policy Number` cấp độ
  Vehicle** — BRD §16 tự ghi rõ các field này **đã được thay thế** bởi entity `Vehicle Document`
  thống nhất từ CR-2026-026; giữ mô tả cũ "làm tham chiếu lịch sử" chứ không còn là field thật. Model
  Round 1 **chỉ dùng `VehicleDocument`**, không duplicate field.
- **Ảnh xe** — ngoài phạm vi (§1.2).
- **`Statistics` (BRD §12 — tổng lượt thuê, doanh thu, chi phí, sự cố, estimated profit)** — toàn bộ
  computed từ `RM`/`DI`/`RV`, chưa tồn tại Phase 1 webapp. Không lưu field giả trên `Vehicle`.
- **Số VIN/Chassis/Engine Number** — BRD §26 Q5 là Open Question chưa chốt, chưa có yêu cầu field cụ
  thể. Không tự thêm.

### 2.2. `VehicleDocument` (nhúng mảng trong `Vehicle`, `VM §16.1`)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | `generateId('vdoc')` |
| `documentType` | `VehicleDocumentType` | `VEHICLE_DOCUMENT_TYPES` đã có sẵn 5 giá trị đúng BRD (`VEHICLE_REGISTRATION`/`INSPECTION`/`INSURANCE`/`MORTGAGE_RECEIPT`/`OTHER`) — dùng nguyên |
| `documentNumber` | `string?` | `VEHICLE_REGISTRATION` không thế chấp có thể không cần số rõ ràng — để optional chung |
| `issueDate` | `string? (ISO date)` | |
| `expiryDate` | `string? (ISO date)` | **`VEHICLE_REGISTRATION` để trống nếu xe không thế chấp** (BRD §16.1) — validate ở form: chỉ bắt buộc nhập khi `documentType !== 'VEHICLE_REGISTRATION'` HOẶC (`=== 'VEHICLE_REGISTRATION'` VÀ `vehicle.bankFinanced === true`) |
| `warningLeadDays` | `number` | **Field mới theo CR-2026-046** — Admin nhập khi tạo/sửa, mặc định `30`. Đây là ngưỡng cảnh báo **của riêng bản ghi này**, không phải hằng số toàn cục |
| `note` | `string?` | CR-2026-041, ghi chú tự do mọi loại |
| `fileMeta` | `{ fileName: string; uploadedAt: string; uploadedBy: string }?` | Chỉ metadata, không lưu file thật (đúng lý do đã áp dụng cho `CustomerDocument`) |
| **Field riêng theo loại** (`documentType`-specific, optional, chỉ hiện đúng loại trong form): | | |
| `registeredOwnerName` | `string?` | Chỉ `VEHICLE_REGISTRATION` |
| `inspectionCenter` | `string?` | Chỉ `INSPECTION` |
| `insuranceProvider` / `policyNumber` | `string?` | Chỉ `INSURANCE` |
| `issuingBank` / `heldRegistrationNumber` | `string?` | Chỉ `MORTGAGE_RECEIPT` |
| `createdAt`/`updatedAt` | `string` | |

**Không có `removeDocument()`** — khác `CustomerDocument` (round trước cho phép xoá). BRD §16.1 nói
rõ: *"cho phép nhiều bản ghi lịch sử... bản cũ hết hạn chuyển `EXPIRED`, **không xoá**"* — đây là
business rule minh thị, không phải suy diễn. Chỉ có `addDocument`/`updateDocument`.

---

## 3. Hàm thuần — tách `documentExpiryStatus()` thành dùng chung

**Quyết định kiến trúc quan trọng của Round này:** khi implement `features/customers` Round 1, hàm
`documentExpiryStatus()` được viết riêng trong `customers/model.ts` với ghi chú *"nếu vehicles cần
logic tương tự, cân nhắc rút ra `shared/lib/documentStatus.ts` dùng chung lúc đó"*. **Thời điểm đó
là bây giờ.**

```ts
// src/shared/lib/documentStatus.ts (MỚI)
/**
 * Tính trạng thái hiệu lực giấy tờ theo Expiry Date − Warning Lead Days.
 * Dùng chung cho CustomerDocument (customers/model.ts) và VehicleDocument
 * (vehicles/model.ts) — công thức giống hệt nhau, chỉ khác nguồn threshold:
 * Customer dùng hằng số tạm (TODO OQ), Vehicle dùng field warningLeadDays
 * cấu hình theo từng bản ghi (CR-2026-046, đã chốt chính thức).
 * `docs/PAGE-IMPLEMENTATION-PRIORITY.md` mục 4: Dashboard (Phase 6) sẽ tái
 * dùng hàm này — không viết lại lúc đó.
 */
export function documentExpiryStatus(
  expiryDate: string | undefined,
  warningLeadDays: number,
  today: Date = new Date(),
): DocumentStatus // 'VALID' nếu không có expiryDate
```

- `features/vehicles/model.ts`: gọi thẳng hàm này, truyền `warningLeadDays` từ chính bản ghi
  `VehicleDocument`.
- `features/customers/model.ts`: **refactor** hàm `documentExpiryStatus()` hiện có (tham số
  `warningDays = 30`) để gọi vào bản dùng chung này thay vì tự tính lại — giữ nguyên chữ ký gọi từ
  nơi khác trong `customers/` (không đổi API public của feature đó, chỉ đổi implementation nội bộ).
  Xác nhận `npx tsc -b`/`npx oxlint` vẫn sạch cho `features/customers` sau refactor.

### Hàm thuần khác trong `vehicles/model.ts`

```ts
/** VM-RULE-001, BRD §8 — biển số duy nhất toàn hệ thống. */
export function isPlateTaken(list: Vehicle[], plate: string, exceptId?: string): boolean

/** VM-RULE-003/004 — MAINTENANCE/INACTIVE không được thuê. Ghi nhận bằng
 * comment, CHƯA enforce được vì Rental chưa tồn tại (giống cách Employee
 * ghi nhận rule Assignment chưa enforce). */
export function canChangeStatus(from: VehicleStatus, to: VehicleStatus): boolean
// Cho phép: AVAILABLE ⇄ MAINTENANCE, AVAILABLE → INACTIVE, MAINTENANCE → INACTIVE.
// KHÔNG cho: RENTED ↔ bất kỳ (RENTED chỉ do Rental đặt tự động — Phase 2, chưa
// có action tay ở Round 1; nếu seed có xe RENTED thì chỉ để demo hiển thị,
// không có nút đổi trạng thái từ RENTED).
// INACTIVE là cuối, một chiều (giống Employee/Customer).

export const vehicleFormSchema = z.object({ /* plate, brand, model, vehicleClass, ownershipType, bankFinanced, currentKm bắt buộc; còn lại optional */ })
export type VehicleFormValues = z.infer<typeof vehicleFormSchema>

export const vehicleDocumentFormSchema = z.object({ /* documentType bắt buộc; expiryDate conditional theo rule ở §2.2; warningLeadDays bắt buộc, default 30 */ })
export type VehicleDocumentFormValues = z.infer<typeof vehicleDocumentFormSchema>
```

---

## 4. Business rule cần trích dẫn

| Hành vi | Mã trích dẫn | Enforce Round 1? |
| --- | --- | --- |
| Biển số duy nhất | `VM-RULE-001`, BRD §8, `AC-VM-002` | ✓ hard-block khi tạo/sửa |
| `Vehicle Class` mặc định `STANDARD` | `VM-RULE-011`, CR-2026-008 | ✓ |
| `Ownership Type` mặc định `OWNED` | `VM-RULE-015` | ✓ (field vẫn cho sửa tay ở Round 1 — xem ghi chú dưới) |
| MAINTENANCE/INACTIVE không nhận rental mới | `VM-RULE-003/004`, `AC-VM-003` | Chỉ **ghi nhận bằng comment** — Rental chưa tồn tại |
| Không hard delete xe đã phát sinh nghiệp vụ | `VM-RULE-005`, BRD §19 | ✓ — không có `remove()` (giống Employee/Customer, áp dụng từ đầu luôn dù Round 1 chưa có "nghiệp vụ phát sinh" nào — nhất quán kiến trúc) |
| Đổi trạng thái phải audit | `VM-RULE-007`, `AC-VM-006` | ✓ |
| Chỉ user có quyền mới sửa xe | `VM-RULE-009` | ✓ qua `can('VEHICLE','EDIT')` |
| Mỗi `VehicleDocument` có `Warning Lead Days` riêng, mặc định 30 | `VM-RULE-016`, CR-2026-046 | ✓ |
| `Bank Financed = Y` nên có `MORTGAGE_RECEIPT` hiệu lực | `VM-RULE-018`, `AC-VM-007` | **Không enforce cứng** — chỉ hiển thị cảnh báo mềm (ví dụ badge/ghi chú) nếu muốn, không bắt buộc phải làm ở Round 1 vì cảnh báo tổng hợp chính thức thuộc tab Overview (Round 2). Có thể bỏ qua hoàn toàn ở Round 1 nếu để đơn giản. |
| Giấy tờ hết hạn chỉ cảnh báo, không chặn thuê | CR-2026-041 | N/A Round 1 (không có luồng tạo rental để chặn) |
| `VEHICLE_REGISTRATION` không thế chấp → không có `Expiry Date` | BRD §16.1 | ✓ validate theo `bankFinanced` (xem §2.2) |
| Document không xoá, chỉ giữ lịch sử | BRD §16.1 | ✓ — không có `removeDocument()` |

**Về `Ownership Type` sửa tay ở Round 1:** `VM-RULE-015` nói `CONSIGNED` chỉ nên được đặt/gỡ bởi
module `VehicleConsignment`, không sửa tay ở Vehicle Management. Nhưng `VehicleConsignment` là
**Phase 5** trong `docs/IMPLEMENTATION-PLAN.md` — chưa tồn tại. Quyết định: **Round 1 vẫn cho phép
chọn `Ownership Type` trong form tạo/sửa xe** (autonomy tạm thời, cần thiết vì không có module nào
khác quản lý field này lúc này), kèm `TODO(OQ: VM-RULE-015 — field này sẽ chuyển thành read-only
tại đây khi VehicleConsignment (Phase 5) build, lúc đó chỉ sửa được qua module VC)`. Đây là rút gọn
có chủ đích, ghi rõ, không tự bịa hành vi cuối cùng.

---

## 5. Màn hình (Round 1)

### 5.1. `VehicleListScreen` (`/vehicles`)

Bám khung `CustomerListScreen`/`EmployeeListScreen` đã có: `PageHeader` + action "Thêm xe" (gate
`can('VEHICLE','EDIT')`); tìm kiếm biển số/hãng/dòng (partial match — BRD §2 "nhập `51A` → hiển thị
xe có biển số chứa `51A`"); 4 bộ lọc: Trạng thái, Hãng (suy từ danh sách xe hiện có, giống cách
Employee suy `assignedArea`), `Vehicle Class`, `Ownership Type`. Bảng (≥768px): biển số, hãng/dòng,
`Vehicle Class` badge, `Ownership Type` badge, trạng thái badge, Odo hiện tại, số giấy tờ sắp/đã hết
hạn (badge cảnh báo nhỏ nếu có) / card list (<768px). 2 loại empty state.

Mỗi hàng có 2 action: **Sửa** (mở `VehicleFormSheet`) và **Giấy tờ** (mở `VehicleDocumentsDialog` —
xem §5.3), cả hai gate `can('VEHICLE','EDIT')`.

### 5.2. `VehicleFormSheet` (tạo/sửa — bám pattern `CustomerFormSheet`)

Field theo §2.1. Khi tạo mới: `status` mặc định `AVAILABLE`, `vehicleClass` mặc định `STANDARD`,
`ownershipType` mặc định `OWNED`, `bankFinanced` mặc định tắt. Validate biển số trùng
(`isPlateTaken`). Đổi trạng thái xe làm **action riêng** (không lẫn vào form sửa thường) — mở dialog
xác nhận đơn giản (không bắt buộc lý do vì BRD không yêu cầu, khác Employee/Customer) nhưng vẫn ghi
audit đầy đủ.

### 5.3. `VehicleDocumentsDialog` (mới — Round 1, tái dùng nguyên cho tab Documents ở Round 2)

Dialog/Sheet mở từ nút "Giấy tờ" ở List: liệt kê toàn bộ `VehicleDocument` của xe (bảng: loại, số,
ngày cấp/hết hạn, `Warning Lead Days`, badge `DocumentStatus`), nút "Thêm giấy tờ" mở
`VehicleDocumentFormDialog` (form field động theo `documentType` đã chọn — §2.2), nút "Sửa" trên mỗi
dòng. **Không có nút Xoá** (§2.2/§4). Viết component này **độc lập, không phụ thuộc route Detail** —
để Round 2 import thẳng vào tab Documents mà không sửa lại.

---

## 6. Responsive

Bám nguyên khung đã dùng ở `CustomerListScreen`: bảng `≥768px`/card `<768px`; 4 bộ lọc gộp vào 1 nút
mở `Sheet` từ dưới ở mobile (nhiều hơn 3 bộ lọc của Customer — càng cần gộp trên mobile, không hiện
4 dropdown ngang hàng); `VehicleFormSheet` full-height mobile/~480px desktop. `VehicleDocumentsDialog`
dùng `Dialog` (giống `CustomerDocumentFormDialog`) — ở mobile, `DialogContent` co theo màn hình
(component `shared/ui/dialog.tsx` đã tự responsive từ khi sửa bug theme Tailwind ở Employee Round 1).

---

## 7. Seed data (`features/vehicles/seed.ts`)

15–20 xe, đa dạng theo đúng gợi ý `docs/PAGE-IMPLEMENTATION-PRIORITY.md`:

| Nhóm | Số lượng | Đặc điểm |
| --- | --- | --- |
| `CONSIGNED` | ~13-18 (90%) | Đa dạng `Vehicle Class`, đa số `AVAILABLE`, vài `MAINTENANCE`/`INACTIVE` |
| `OWNED` | ~2-3 (10%) | |
| `bankFinanced = true` | ≥2 xe | Có document `MORTGAGE_RECEIPT` hợp lệ + `VEHICLE_REGISTRATION` có `expiryDate` |
| Document `EXPIRING_SOON` | ≥1 xe | `INSPECTION` hoặc `INSURANCE` sắp hết hạn trong `warningLeadDays` — **để demo cảnh báo Dashboard Phase 6** (yêu cầu tường minh của `docs/IMPLEMENTATION-PLAN.md`), tính động theo ngày chạy demo giống cách đã làm ở `CustomerDocument` (không hardcode ngày cố định) |
| Document `EXPIRED` | ≥1 xe | |
| `Vehicle Class` | đủ 3 giá trị | Ít nhất vài xe mỗi hạng |
| `status` | đủ giá trị demo được | `AVAILABLE` đa số, vài `MAINTENANCE`, 1 `INACTIVE`; **không cần seed `RENTED`** vì Round 1 không có action liên quan (nếu muốn demo hiển thị badge `RENTED` có thể thêm 1 xe, không bắt buộc) |

Mỗi xe có ít nhất document `VEHICLE_REGISTRATION` + `INSPECTION` + `INSURANCE` (đúng field tối thiểu
BRD §7 yêu cầu khi tạo xe). Đăng ký `registerSeedStep()`, import **sau `customers`, trước
`maintenance`** (thứ tự `employees → customers → vehicles → maintenance` theo
`docs/IMPLEMENTATION-PLAN.md`), bump `SEED_VERSION`.

---

## 8. Phác thảo Round 2 (Vehicle Detail) — CHƯA chốt chi tiết, chỉ để hình dung toàn cảnh

> Sẽ lên kế hoạch đầy đủ riêng sau khi `features/maintenance` xong (xem §0). Bảng dưới **không phải
> Definition of Done** — chỉ tóm tắt hướng đi theo BRD §12.1 + `docs/PAGE-IMPLEMENTATION-PRIORITY.md`
> mục 6.

| Tab | Trạng thái dữ liệu ở Round 2 |
| --- | --- |
| Overview | Thật — tổng hợp thủ công (CR-2026-036) từ các tab khác |
| Owner/Partner · Consignment Contract | Khung rỗng "chờ Phase 5" khi `ownershipType = CONSIGNED`, ẩn hẳn khi `OWNED` |
| Documents | Thật — tái dùng `VehicleDocumentsDialog` (§5.3) render inline thay vì Dialog |
| Vehicle Condition | Thật nhưng **có thể rỗng** — chờ `ConditionEvent` từ Phase 3 (`VH`/`VR`/`DI`) |
| Maintenance · Spare Parts | Thật — **cần `features/maintenance` xong trước** |
| Traffic Fines | Placeholder — chưa có phase sở hữu rõ trong backlog 7-phase, hỏi lại BA khi tới lượt build (đã ghi chú sẵn trong `PAGE-IMPLEMENTATION-PRIORITY.md`) |
| Rental History | Placeholder — chờ Phase 2 |
| Delivery/Pickup | Placeholder — chờ Phase 2/3 |
| Revenue · Cost · Profit (3 tab) | Placeholder — chờ Phase 4, gate bằng `can('VEHICLE','EXPORT')` (đã map đúng `View Financial` trong `permissions.ts`) |
| Activity History | Thật — đọc `listAuditRecords()` lọc theo `entity = 'Vehicle'` |

---

## 9. API / hooks / audit (Round 1)

`api.ts` (namespace storage `vehicles`, mọi hàm bọc `fakeRequest()`):

- `list(filter?: { search?, status?, brand?, vehicleClass?, ownershipType? })`, `getById(id)`
- `create(input)` / `update(id, input)` — validate `isPlateTaken`
- `changeStatus(id, status)` — validate `canChangeStatus`
- `addDocument(vehicleId, input)` / `updateDocument(vehicleId, docId, input)`

Mọi mutation gọi `appendAudit()` — thêm **6 audit action mới** vào cuối `AUDIT_ACTIONS`:
`CREATE_VEHICLE`, `UPDATE_VEHICLE`, `CHANGE_VEHICLE_STATUS`, `ADD_VEHICLE_DOCUMENT`,
`UPDATE_VEHICLE_DOCUMENT`.

`hooks.ts`: hook tương ứng, `invalidateQueries(['vehicles', ...])` sau mutation.

---

## 10. i18n

Thêm `vi.vehicles.*` theo mẫu `vi.customers.*`/`vi.employees.*`. Tái dùng `DOCUMENT_STATUS_LABELS`,
`VEHICLE_STATUS_LABELS`, `VEHICLE_CLASS_LABELS` — **cả 3 đã scaffold sẵn từ Phase 0**, dùng nguyên,
không viết lại. Thêm mới 2 map còn thiếu: `OWNERSHIP_TYPE_LABELS` (`Record<OwnershipType, string>`)
và `VEHICLE_DOCUMENT_TYPE_LABELS` (`Record<VehicleDocumentType, string>`), đặt cạnh các map enum
khác theo đúng vị trí quy ước hiện có trong file.

---

## 11. Thay đổi ở file dùng chung

- **Mới:** `shared/lib/documentStatus.ts` — hàm `documentExpiryStatus()` dùng chung (§3).
- `shared/domain/enums.ts`: **không cần thêm enum mới** cho Vehicle (mọi enum đã scaffold sẵn đúng)
  — chỉ nối 6 action mới vào `AUDIT_ACTIONS`.
- `shared/i18n/vi.ts`: thêm `vi.vehicles.*` + các label map còn thiếu (§10).
- `permissions.ts`: **không sửa** — `VEHICLE.VIEW/EDIT/BLOCK/EXPORT` đã đúng. (`BLOCK` không dùng ở
  Round 1 vì Vehicle Block ngoài phạm vi — xem §1.2 — nhưng entry vẫn giữ nguyên cho Round sau.)
- `features/customers/model.ts`: refactor dùng `documentExpiryStatus()` dùng chung (§3) — **duy nhất
  thay đổi cho phép ở feature khác trong task này**, vì đây là hệ quả trực tiếp của việc extract hàm
  dùng chung, không phải mở rộng phạm vi tuỳ tiện.
- `shared/fixtures/registerSeeds.ts`: import `seedVehicles` đúng vị trí (sau `customers`).
- `app/routes.tsx`: bỏ `ComingSoon` cho `/vehicles` (giữ nguyên `/vehicles/:id`).
- `docs/IMPLEMENTATION-PLAN.md`: tick phần Vehicle List khi xong (giữ nguyên phần Vehicle Detail
  `[ ]` vì chưa làm).

---

## 12. Mã requirement cần trích trong code

`VM-RULE-001, 003, 004, 005, 007, 009, 011, 015, 016, 018` · `AC-VM-001, 002, 003, 006, 007` ·
`CR-2026-008, 042, 046`.

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch (không cần Playwright).
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. `features/customers` không bị phá vỡ sau refactor `documentExpiryStatus()` — chạy lại tsc/oxlint
   xác nhận, và kiểm tra logic không đổi hành vi (badge hạn giấy tờ Customer vẫn đúng như trước).
4. *(Chủ dự án tự test thủ công sau bàn giao)*: reset demo data → 15-20 xe đúng phân bổ §7; tìm
   kiếm biển số/hãng (partial match); 4 bộ lọc hoạt động đúng và kết hợp được; tạo/sửa xe, biển số
   trùng bị chặn; đổi trạng thái xe; mở "Giấy tờ" từ 1 hàng → thêm/sửa document, field động đúng
   theo loại giấy tờ (`VEHICLE_REGISTRATION` không thế chấp → `Expiry Date` ẩn/không bắt buộc), badge
   `VALID/EXPIRING_SOON/EXPIRED` đúng theo `Warning Lead Days` riêng từng bản ghi; đổi vai trò Topbar
   → `OPERATION_STAFF`/`ACCOUNTANT` xem được list (VIEW) nhưng không có nút Sửa/Giấy tờ; ở 375px bộ
   lọc vào Sheet, list dạng card.
5. `docs/IMPLEMENTATION-PLAN.md` tick phần Vehicle List, xoá `ComingSoon` route `/vehicles`.

---

## 14. Việc tiếp theo sau khi phê duyệt

Round 1 của tài liệu này trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work + danh
sách file cần đọc trước theo format chuẩn). Sau khi Round 1 xong và qua review `tech-lead` đạt
(4 bước chuẩn: `tech-lead` bàn giao commit + docs + push khi đạt), **task tiếp theo trong backlog là
`features/maintenance`** (không phải Round 2 của trang này) — đúng thứ tự đã chốt ở §0. Round 2
(Vehicle Detail) sẽ được lên kế hoạch chi tiết riêng sau đó.
