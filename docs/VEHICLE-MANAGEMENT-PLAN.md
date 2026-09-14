# Kế hoạch triển khai — Trang Quản lý Xe (Vehicle Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** **Round 1 (List) `DONE`** (14/09/2026). **Round 2
(Detail) `PENDING_APPROVAL`** (14/09/2026) — kế hoạch chi tiết đầy đủ ở §8 (thay thế bản phác thảo
cũ), chờ phê duyệt trước khi giao `dev`. `features/maintenance` đã `DONE`, tab Bảo dưỡng nối được
dữ liệu thật ngay theo đúng thứ tự đã chốt.

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

## 8. Round 2 — Vehicle Detail (`/vehicles/:id`) — kế hoạch đầy đủ

`features/maintenance` đã `DONE` (xem `docs/MAINTENANCE-MANAGEMENT-PLAN.md`) — đúng thứ tự đã chốt
ở §0, giờ lên kế hoạch chi tiết Round 2. **Điểm thuận lợi lớn:** mọi hook dữ liệu cần thiết **đã có
sẵn** từ Round 1 + `maintenance` — Round 2 gần như thuần dựng UI/tab, **không cần API mới cho
`Vehicle`** (chỉ 1 refactor nhỏ ở component có sẵn — xem §8.4).

### 8.1. Phạm vi Round 2

**Trong phạm vi:** màn `VehicleDetailScreen` (`/vehicles/:id`), 12 tab tối đa theo đúng BRD §12.1
(11 tab cố định + 1 tab điều kiện) — bảng chi tiết ở §8.3. Route thay `ComingSoon`.

**Ngoài phạm vi — vì sao:** mọi nội dung "thật" phụ thuộc module chưa tồn tại
(`RentalManagement`/`DamageIncident`/`RevenueCost`/`VehicleConsignment`/`TrafficFineIntegration`)
giữ nguyên placeholder — đúng nguyên tắc `VM-RULE-017` ("mỗi tab chỉ tổng hợp/tham chiếu dữ liệu từ
module sở hữu — không tự bịa"). Không dựng Vehicle Block (đã hoãn từ Round 1, vẫn chờ
`RentalCalendar`). Không thêm action mới cho `Vehicle` ngoài Sửa/Đổi trạng thái đã có từ Round 1.

### 8.2. Mẫu tham chiếu bắt buộc: `CustomerDetailScreen.tsx`

`src/features/customers/screens/CustomerDetailScreen.tsx` (đã xong, review đạt) là **khuôn mẫu gần
như 1:1** cho `VehicleDetailScreen`: header cố định (tên/badge/hành động) + `Tabs`/`TabsList`/
`TabsContent`, dùng `CustomerDetailPlaceholder` cho tab chưa có dữ liệu. `dev` copy đúng cấu trúc
này, đổi tên/logic cho Vehicle — **không tự sáng tạo layout khác**.

`VehicleDetailPlaceholder` — component mới, copy y hệt `CustomerDetailPlaceholder.tsx` (đổi feature
path), dùng chung cho mọi tab placeholder ở §8.3.

### 8.3. 12 tab — nguồn dữ liệu & nội dung

| # | Tab | Điều kiện hiện | Trạng thái | Nội dung |
| - | --- | --- | --- | --- |
| 1 | **Tổng quan** (mặc định) | luôn | Thật — tổng hợp thủ công (CR-2026-036) | Basic info (biển số/hãng/model/năm/màu/odo/nhiên liệu/status/ownership/bankFinanced), tóm tắt giấy tờ (đếm `EXPIRING_SOON`/`EXPIRED` từ `vehicle.documents`, tái dùng `documentExpiryStatus()`), tóm tắt bảo dưỡng (category có `Next Due KM` gần nhất — dùng `applicableRule()`/`nextDueKm()`/`maintenanceDueStatus()` từ `@/features/maintenance/model`), placeholder "—" cho lượt thuê/doanh thu/chi phí/lợi nhuận (chưa có nguồn) |
| 2 | **Chủ xe & Ký gửi** | chỉ khi `ownershipType === 'CONSIGNED'` | Placeholder | `VehicleDetailPlaceholder` — "Chờ triển khai `VehicleConsignment` (Phase 5)". **Gộp 2 tab BRD** (Owner/Partner + Consignment Contract) thành 1 — cả hai phụ thuộc cùng module chưa tồn tại, tách 2 tab rỗng không có giá trị ở Phase 1 (xem §8.5 lý do). Ẩn hẳn khi `ownershipType === 'OWNED'` |
| 3 | **Giấy tờ** | luôn | Thật | Tái dùng `VehicleDocumentsList` (§8.4 — tách ra từ `VehicleDocumentsDialog`) render trực tiếp, không bọc `Dialog` |
| 4 | **Hiện trạng xe** | luôn | Thật nhưng **rỗng hợp lệ** | `VehicleDetailPlaceholder` biến thể "chưa có dữ liệu" (không phải "chờ Phase X" — đây là do chưa phát sinh `ConditionEvent`, khác về ngữ nghĩa với các tab chờ module). Chờ `VH`/`VR`/`DI` (Phase 3) |
| 5 | **Bảo dưỡng** | luôn | Thật — `features/maintenance` đã có | `VehicleMaintenanceTab` (mới, §8.4): due status theo từng category áp dụng cho xe này (`applicableRule()` lọc theo `vehicle`), lịch sử `MaintenanceRecord` (`useMaintenanceRecords({vehicleId})`), lịch sử `SparePartRecord` (`useSparePartRecords({vehicleId})`) — 2 khối trong cùng 1 tab (khác trang `/maintenance` toàn đội xe có 2 tab riêng) |
| 6 | **Phạt nguội** | luôn | Placeholder | `VehicleDetailPlaceholder` — "Chưa có phase sở hữu rõ trong backlog — hỏi lại BA khi tới lượt build" (đúng ghi chú đã có sẵn trong `docs/PAGE-IMPLEMENTATION-PRIORITY.md` mục 6) |
| 7 | **Lịch sử thuê** | luôn | Placeholder | "Chờ `RentalManagement` (Phase 2)" |
| 8 | **Giao/nhận** | luôn | Placeholder | "Chờ `VehicleHandover`/`VehicleReturn` (Phase 2/3)" |
| 9 | **Doanh thu** | gate `can('VEHICLE','EXPORT')` | Placeholder | "Chờ `RevenueCost` (Phase 4)" |
| 10 | **Chi phí** | gate `can('VEHICLE','EXPORT')` | Placeholder | như trên |
| 11 | **Lợi nhuận** | gate `can('VEHICLE','EXPORT')` | Placeholder | như trên — **3 tab riêng, không gộp** (`CR-2026-036`, đã chốt, không tự ý đơn giản hoá) |
| 12 | **Nhật ký thao tác** | luôn | Thật | `listAuditRecords()` lọc `entity === 'Vehicle' && entityId === vehicle.id`, sắp theo `at` giảm dần, hiển thị `summary`/`actorName`/`at` |

Tab 9-11 (Revenue/Cost/Profit): nếu `can('VEHICLE','EXPORT')` là `false` (role không có View
Financial — `OPERATION_STAFF`), **ẩn hẳn cả 3 tab** khỏi `TabsList` (không phải disable) — đúng
`VM-RULE-017` "không phân quyền theo từng tab riêng lẻ, gate theo `View Financial` chung".

### 8.4. Thay đổi code cần thiết (tối thiểu)

1. **Refactor `VehicleDocumentsDialog.tsx`**: tách phần nội dung (nút Thêm + bảng + trạng thái rỗng)
   ra component mới `VehicleDocumentsList.tsx` (props: `vehicle`, `canEdit` — không có
   `open`/`onOpenChange`). `VehicleDocumentsDialog` giữ nguyên public API cũ (vẫn dùng ở
   `VehicleListScreen`), bên trong chỉ render `<Dialog><DialogContent>...<VehicleDocumentsList
   vehicle={vehicle} canEdit={canEdit} /></DialogContent></Dialog>`. Tab Giấy tờ ở Detail dùng thẳng
   `VehicleDocumentsList`, không qua Dialog. **Không đổi hành vi ở màn List** — chỉ tổ chức lại code.
2. **Mới:** `VehicleDetailPlaceholder.tsx` (copy `CustomerDetailPlaceholder.tsx`).
3. **Mới:** `VehicleMaintenanceTab.tsx` — import `useMaintenanceRules`, `useMaintenanceRecords`,
   `useSparePartRecords` từ `@/features/maintenance/hooks`; `applicableRule`, `nextDueKm`,
   `maintenanceDueStatus`, `MaintenanceDueStatus` từ `@/features/maintenance/model` (hoặc barrel nếu
   đã export đủ — kiểm tra `maintenance/index.ts` trước, thêm export nếu thiếu thay vì import sâu
   không cần thiết). Đây là **import xuyên feature hợp lệ** (đã có tiền lệ `maintenance/hooks.ts` tự
   import `useVehicles` từ `vehicles/hooks.ts`) — không vi phạm `VM-RULE-017` vì tab chỉ *hiển thị*
   dữ liệu do `MT` sở hữu, không tự tính lại logic.
4. **Mới:** `VehicleDetailScreen.tsx` (màn chính, theo mẫu §8.2), tái dùng nguyên `VehicleFormSheet`
   + `VehicleStatusDialog` đã có từ Round 1 cho 2 nút hành động ở header (Sửa/Đổi trạng thái).
5. `vehicles/index.ts`: export thêm `VehicleDetailScreen`.
6. `app/routes.tsx`: mount `VehicleDetailScreen` cho `/vehicles/:id`, bỏ `ComingSoon`.
7. `vi.ts`: mở rộng `vi.vehicles.*` với nhãn 12 tab + nội dung placeholder tương ứng, tái dùng
   `MAINTENANCE_DUE_STATUS_LABELS` đã có sẵn từ `maintenance`.

**Không cần sửa** `api.ts`/`hooks.ts` của `vehicles` (đã đủ `useVehicle(id)` từ Round 1), không cần
audit action mới (Nhật ký thao tác chỉ đọc, không ghi thêm), không sửa `permissions.ts` (`VIEW`/
`EDIT`/`EXPORT` đã đủ).

### 8.5. Quyết định: gộp tab Owner/Partner + Consignment Contract

BRD §12.1 liệt kê 2 tab riêng (`Owner/Partner`, `Consignment Contract`). Ở Round 2, **cả hai đều là
placeholder thuần** (module `VehicleConsignment` chưa tồn tại — Phase 5) — tách 2 tab rỗng cùng nội
dung "chờ Phase 5" không có giá trị thông tin, chỉ làm `TabsList` dài thêm không cần thiết (đã 11
tab cố định). Gộp thành 1 tab **"Chủ xe & Ký gửi"**. Khi `VehicleConsignment` build (Phase 5) và cần
2 khu vực riêng (hồ sơ chủ xe vs hợp đồng), tách lại thành 2 tab lúc đó — quyết định này **không
ảnh hưởng dữ liệu**, chỉ là tổ chức UI tạm thời cho giai đoạn placeholder.

### 8.6. Responsive

Bám nguyên khung `CustomerDetailScreen`: header card `flex-col` mobile → `flex-row` desktop.
`TabsList` 12 tab **chắc chắn cần cuộn ngang ở mọi kích thước màn hình** (không chỉ mobile) — dùng
nhãn tab ngắn gọn 1-2 từ (bảng §8.3 cột "Tab" đã viết đúng độ dài mong muốn). Nội dung mỗi
`TabsContent` responsive theo chuẩn đã dùng (card/table chuyển đổi theo breakpoint) — hầu hết tab
placeholder không cần responsive đặc biệt (1 khối căn giữa).

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

## 14. Việc tiếp theo sau khi phê duyệt (Round 1 — đã xong, giữ nguyên lịch sử)

Round 1 của tài liệu này trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work + danh
sách file cần đọc trước theo format chuẩn). Sau khi Round 1 xong và qua review `tech-lead` đạt
(4 bước chuẩn: `tech-lead` bàn giao commit + docs + push khi đạt), **task tiếp theo trong backlog là
`features/maintenance`** (không phải Round 2 của trang này) — đúng thứ tự đã chốt ở §0. ✅ Cả hai đã
xong (14/09/2026) — xem §15/§16 cho Round 2.

---

## 15. Definition of Done (Round 2)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch (không cần Playwright).
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. `VehicleListScreen`/`VehicleDocumentsDialog` (Round 1) không bị phá vỡ sau refactor tách
   `VehicleDocumentsList` (§8.4 mục 1) — hành vi mở "Giấy tờ" từ List vẫn y hệt cũ.
4. *(Chủ dự án tự test thủ công sau bàn giao)*: mở Detail từ 1 xe trong List; đủ 11-12 tab đúng nội
   dung §8.3 (12 khi xe `CONSIGNED`, 11 khi `OWNED` — tab "Chủ xe & Ký gửi" ẩn đúng); tab Tổng quan
   hiển thị đúng tóm tắt giấy tờ + bảo dưỡng (số liệu thật, không giả); tab Bảo dưỡng hiển thị đúng
   due status/lịch sử của **đúng xe đang xem** (không lẫn xe khác); tab Giấy tờ CRUD hoạt động y hệt
   Dialog cũ ở List; tab Nhật ký thao tác chỉ hiện đúng audit của xe này; 3 tab Doanh thu/Chi
   phí/Lợi nhuận ẩn hoàn toàn khi đổi vai trò Topbar sang `OPERATION_STAFF`, hiện lại khi
   `ACCOUNTANT`/`MANAGER`; nút Sửa/Đổi trạng thái ở header hoạt động đồng nhất Round 1; ở 375px
   `TabsList` cuộn ngang được, không cuộn ngang toàn trang.
5. `docs/IMPLEMENTATION-PLAN.md` tick `[x]` toàn bộ dòng `features/vehicles` (gộp Round 1 + 2), xoá
   `ComingSoon` route `/vehicles/:id`.

---

## 16. Việc tiếp theo sau khi phê duyệt Round 2

Round 2 trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work + danh sách file cần
đọc trước). Sau khi qua review `tech-lead` đạt (4 bước chuẩn), **`features/vehicles` hoàn thành toàn
bộ** — đây là feature cuối cùng còn lại của Phase 1 theo `docs/IMPLEMENTATION-PLAN.md`. Việc tiếp
theo sau đó là bắt đầu Phase 2 (Lịch & lượt thuê).
