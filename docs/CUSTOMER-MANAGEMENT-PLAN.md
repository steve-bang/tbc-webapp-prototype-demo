# Kế hoạch triển khai — Trang Quản lý Khách hàng (Customer Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `PENDING_APPROVAL` — chờ phê duyệt trước khi giao
`dev` implement. **Không code** — tài liệu này chỉ lên kế hoạch.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/CustomerManagement-BRD.md` (v1.3) +
`CustomerManagement-UseCase.md` (v1.1) + `../thien-bao-car-docs/WebappQuanTri.md` §7.
**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase 1),
`docs/PAGE-IMPLEMENTATION-PRIORITY.md` (P1.2/P1.3). Đối chiếu mã hiện có: `src/shared/domain/enums.ts`
(dòng 46-47 `DocumentStatus`, 61-62 `CUSTOMER_STATUSES`, 217+ `AUDIT_ACTIONS`),
`src/shared/domain/permissions.ts` (dòng 128-144, 3 entry `CUSTOMER.VIEW/EDIT/BLOCK` đã scaffold sẵn
từ Phase 0), `src/shared/i18n/vi.ts` (dòng 156-165, `DOCUMENT_STATUS_LABELS`/`CUSTOMER_STATUS_LABELS`
đã có sẵn), và **`src/features/employees/` — pattern mẫu bắt buộc bám theo** (feature vừa xong, 2
vòng review, đã sửa xong bug theme Tailwind).

---

## 1. Phạm vi & cách chia round

### 1.1. Tách 2 round giao `dev` (khác Employee — chỉ 1 round)

`docs/PAGE-IMPLEMENTATION-PRIORITY.md` đã tách sẵn **P1.2 (Customer list)** và **P1.3 (Customer
Detail)** thành 2 mục ưu tiên độc lập, với "Thứ tự build: Customer list → Customer Detail". Lý do
giữ nguyên tách round thay vì gộp:

1. Đi ngược tách round đã chốt sẵn trong tài liệu là tự ý gộp phạm vi.
2. Round 2 (Detail) thao tác trực tiếp trên `customer.documents` và các field model — nếu review
   Round 1 phát hiện cần đổi model (khả năng cao vì nhiều điểm BRD "chưa chốt chính thức", xem §2),
   sửa chỉ ảnh hưởng 1 screen thay vì lan sang cả 2.
3. Employee (chỉ có List, không có Detail) đã mất 2 vòng review. Customer List+Detail gộp chung sẽ
   tăng diện tích review, khó cô lập nguyên nhân khi có Blocker.
4. Detail có nhiều quyết định UX chưa có tiền lệ (tab placeholder, tab Tín nhiệm không số liệu giả)
   — nên review tách riêng khỏi rủi ro CRUD cơ bản của List.

**Điều kiện chuyển Round 2**: Round 1 phải qua review `tech-lead` đạt (hết Blocker) trước. Round 2
import thẳng model/hooks/`CustomerFormSheet` từ barrel `@/features/customers`, không viết lại.

### 1.2. Trong phạm vi

- **Round 1**: `Customer` model + `api.ts` (`list/getById/create/update/block/unblock`, không có
  `remove` khách) + `hooks.ts` + `seed.ts` (8–10 khách) + `CustomerListScreen` (`/customers`: tìm
  kiếm tên/SĐT/CCCD, lọc trạng thái, tạo/sửa qua Sheet, Khoá/Mở khoá). Tương ứng `UC-CM-01, 02, 03,
  05, 06, 14`.
- **Round 2**: `CustomerDetailScreen` (`/customers/:id`, 6 tab — xem §6) + `CustomerDocument` CRUD
  (`addDocument/updateDocument/removeDocument`). Tương ứng `UC-CM-04, 07`.

### 1.3. Ngoài phạm vi — vì sao

| Nhóm | Lý do hoãn |
| --- | --- |
| Rental/Payment/Incident History thật (`UC-CM-08, 09, 10`) | Module nguồn (`RM`/`PM`/`DI`) chưa tồn tại Phase 1 webapp — placeholder rõ ràng, không mock số liệu. |
| Customer Rating/Risk Score (`CM §20`, `UC-CM-12`) | BRD minh thị "chưa có công thức, Phase 1 chỉ cung cấp dữ liệu thô". |
| Deactivate → `INACTIVE` (`UC-CM-13`) | Yêu cầu kiểm tra active rental trước khi chuyển — phụ thuộc `Rental` chưa tồn tại. Xem §2. |
| Cọc xe máy / thông tin xe máy nhận giữ (`CM-R11`, CR-2026-003) | Gắn với một lượt thuê cụ thể (`Rental`), ngoài phạm vi hoàn toàn. |
| Field-level masking cho CCCD/dữ liệu nhạy cảm (`CM-R10`) | Không có cơ chế trong `permissions.ts` hiện tại (`CUSTOMER.VIEW = true` mọi role) — mâu thuẫn thật với BRD, ghi `TODO(OQ)`, không tự chế cơ chế mask mới. |
| Import/Export, merge duplicate (`BRD §31 Q12-14`) | Open Question, ngoài scope Phase 1. |
| Ảnh CCCD/GPLX/tài liệu thật | Chỉ lưu metadata — xem §3.2. |

---

## 2. Quyết định enum `CUSTOMER_STATUSES`

**Giữ nguyên 2 giá trị hiện có trong `enums.ts`: `['ACTIVE', 'BLOCKED']` — không tự thêm
`INACTIVE`.**

`CustomerManagement-BRD.md` §9 **đề xuất** (chưa chốt) 3 trạng thái `ACTIVE/INACTIVE/BLOCKED`.
Nhưng `UC-CM-13` (Deactivate — chính là luồng đưa khách vào `INACTIVE`) bước 5 yêu cầu **kiểm tra
active rental** trước khi cho phép, và Alternative Flow A1 để ngỏ "Business cần quyết định: không
cho deactivate / cho deactivate nhưng rental vẫn tiếp tục" — đây là điều kiện phụ thuộc `Rental`
(Phase 2, chưa tồn tại ở Phase 1 webapp). Đối xứng với cách đã xử lý `ON_LEAVE` ở
`docs/EMPLOYEE-MANAGEMENT-PLAN.md` §4: giữ enum hiện có, không tự thêm giá trị gắn với luồng nghiệp
vụ chưa build được. `docs/PAGE-IMPLEMENTATION-PRIORITY.md` mục 2 cũng chỉ mô tả seed "8–10 khách,
≥1 `BLOCKED`" — không nhắc `INACTIVE`.

Thêm comment tại khai báo:

```ts
/**
 * Khách hàng — `CustomerManagement-BRD.md` §9/§10 (2 giá trị đang dùng).
 * TODO(OQ: CM-BRD §9 đề xuất thêm `INACTIVE` — "ngừng sử dụng dịch vụ";
 * UC-CM-13 (Deactivate) yêu cầu kiểm tra active rental trước khi chuyển,
 * phụ thuộc `Rental` (Phase 2, chưa tồn tại). Không tự thêm `INACTIVE` bây
 * giờ — sửa cùng lúc với luồng kiểm tra active rental khi Rental build.)
 */
export const CUSTOMER_STATUSES = ['ACTIVE', 'BLOCKED'] as const
```

Hệ quả: chỉ **một hành động đổi trạng thái theo cặp nhị phân** — **Khoá khách**
(`ACTIVE → BLOCKED`) và **Mở khoá** (`BLOCKED → ACTIVE`) — không cần dialog "chọn trạng thái" nhiều
lựa chọn như `EmployeeStatusDialog` (hợp lý vì Employee có 3 giá trị/nhiều hướng chuyển).

---

## 3. Data model

### 3.1. `Customer` (feature `customers`, module `CM`)

| Field | Kiểu | Bắt buộc | Ghi chú / mã nguồn |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | `generateId('cus')` — **không có `customerCode`** riêng (khác Employee: `UC-EA-01` minh thị yêu cầu sinh mã, `CustomerManagement` không có yêu cầu tương đương — không tự bịa field không có căn cứ tài liệu). Định danh hiển thị chính trên UI = SĐT + CCCD (`UC-CM-01`). |
| `fullName` | `string` | ✓ | BRD §7.1, `UC-CM-03` |
| `dob` | `string? (ISO date)` | | BRD §7.1 |
| `gender` | `'MALE' \| 'FEMALE' \| 'OTHER'?` | | BRD §7.1 không liệt kê giá trị cụ thể — khai literal union **riêng trong `customers/model.ts`** (type riêng feature theo `CONVENTIONS.md` §2), không đẩy lên `enums.ts` dùng chung. |
| `phone` | `string` | ✓ | BRD §7.1/§14 — không unique cứng riêng lẻ như `EA-BR-05`, chỉ dùng trong check trùng kết hợp (§4). |
| `email` | `string?` | | BRD §7.1 |
| `address` | `string?` | | BRD §7.1 |
| `note` | `string?` | | BRD §7.1 |
| `idType` | `'ID_CARD' \| 'PASSPORT'?` | | BRD §7.2 — optional (BRD §31 Q2 "có cho phép khách không CCCD?" chưa chốt). |
| `idNumber` | `string` | ✓ (ở form) | BRD §14 "ID Number **hoặc** thông tin định danh phù hợp policy" — không tuyệt đối bắt buộc theo văn bản, nhưng **bắt buộc ở form tạo mới** để giữ đơn giản Phase 1 (đúng tinh thần `AC-CM-001`). `TODO(OQ: CM-BRD §31 Q1/Q2)` tại chỗ validate. |
| `idIssueDate` / `idIssuePlace` / `idExpiryDate` | `string?` | | BRD §7.2 |
| `licenseNumber` / `licenseClass` / `licenseIssueDate` / `licenseExpiryDate` | `string?` | | BRD §7.3 — optional (BRD §31 Q5 "bắt buộc GPLX?" chưa chốt). |
| `status` | `CustomerStatus` | ✓ | xem §2 |
| `blockReason` | `string?` | | Lý do khoá gần nhất, hiển thị ngay ở badge/tooltip — **không thay thế** audit log (audit vẫn là nguồn đầy đủ). `CM-R03`/`AC-CM-006`. |
| `documents` | `CustomerDocument[]` | ✓ (mặc định `[]`) | xem §3.2 |
| `createdAt` / `updatedAt` | `string (ISO)` | ✓ | |

**Field KHÔNG lưu trên model (và lý do):**

- **Field tổng hợp phụ thuộc Rental/Payment/Incident** (`Active Rental`, `Outstanding Payment`,
  `Total rentals`, v.v. — BRD §15/§21, `UC-CM-01` cột danh sách) — đều là *computed*, module nguồn
  chưa tồn tại Phase 1. UI hiển thị "Chưa có dữ liệu" thay vì field cứng bằng 0 (tránh state giả
  phải đồng bộ tay, và tránh hiểu nhầm "0 sự cố = khách tốt").
- **Customer Rating/Risk Score** (BRD §20) — xem §1.3.
- **Cà vẹt xe máy / thông tin xe máy nhận giữ** (`CM-R11`) — gắn với một lượt thuê cụ thể, không
  phải thuộc tính tĩnh của hồ sơ khách.
- **Verification status** (`UNVERIFIED/PENDING_REVIEW/VERIFIED/REJECTED`, BRD §12) — thuộc vòng đời
  của **App khách hàng tự phục vụ** (Phase sau, module `Customer Self-Service` riêng theo
  `WebappQuanTri.md` §7.5). Khách do nhân viên nội bộ tạo trên Webapp không đi qua vòng đời này.

### 3.2. `CustomerDocument` (nhúng mảng trong `Customer`, `CM §22`/`UC-CM-07`)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | `string` | `generateId('doc')` |
| `documentType` | `CustomerDocumentType` | **Thêm mới `CUSTOMER_DOCUMENT_TYPES` vào `enums.ts`** — 4 giá trị đúng `UC-CM-07`: `ID_CARD \| PASSPORT \| DRIVER_LICENSE \| OTHER`. |
| `documentNumber` | `string` | |
| `issueDate` / `expiryDate` | `string?` | `expiryDate` dùng tính `DocumentStatus`. |
| `note` | `string?` | |
| `fileMeta` | `{ fileName: string; uploadedAt: string; uploadedBy: string }?` | **Chỉ metadata — không lưu file/ảnh thật** (không backend thật, tránh phình `localStorage` với base64). Nếu dùng `<input type="file">` cho UX, chỉ lấy `file.name`, không đọc nội dung. |
| `createdAt` / `updatedAt` | `string` | |

Tái dùng **nguyên** `DocumentStatus`/`DOCUMENT_STATUSES`/`DOCUMENT_STATUS_LABELS` đã có sẵn trong
`enums.ts`/`vi.ts` (`VALID`/`EXPIRING_SOON`/`EXPIRED`) — không tạo type trùng.

---

## 4. Hàm thuần (`model.ts`)

```ts
/**
 * CM §8 — định danh duy nhất, đề xuất Phone + ID Number ("chưa chốt chính
 * thức", BRD §31 Q1). Diễn giải Phase 1: trùng khi khớp SĐT HOẶC khớp số
 * CCCD/Passport với khách khác (OR trên từng field — khớp đúng ví dụ BRD §8
 * "chỉ CCCD trùng đã đủ coi là duplicate"). Hard-block (throw), không làm
 * luồng "cảnh báo rồi cho xác nhận vượt qua" đầy đủ của `UC-CM-03` A2 — rút
 * gọn có chủ đích cho demo, giống `isPhoneTaken` của Employee.
 * TODO(OQ: CM-BRD §31 Q1 — AND/OR hay ưu tiên field nào chưa chốt chính thức).
 */
export function findDuplicateCustomer(
  list: Customer[],
  input: { phone: string; idNumber?: string },
  exceptId?: string,
): { customer: Customer; matchedField: 'phone' | 'idNumber' } | undefined

/**
 * CM §23/CM-R09 — hiệu lực giấy tờ. `warningDays` chưa có ngưỡng chính thức
 * (BRD §23 "cần Business xác nhận") — BA đề xuất tạm 30 ngày cho demo, KHÁC
 * ngưỡng CR-2026-046 của VehicleManagement (module khác, không dùng chung
 * số). TODO(OQ: CM-BRD §23). Viết trong `customers/model.ts` — nếu
 * `features/vehicles` sau này cần logic tương tự, cân nhắc rút thành
 * `shared/lib/documentStatus.ts` dùng chung lúc đó, KHÔNG làm ở round này.
 */
export function documentExpiryStatus(
  expiryDate: string | undefined,
  today?: Date,
  warningDays?: number, // default 30
): DocumentStatus // 'VALID' nếu không có expiryDate

export function canBlock(status: CustomerStatus): boolean // status === 'ACTIVE'
export function canUnblock(status: CustomerStatus): boolean // status === 'BLOCKED'

export const customerFormSchema = z.object({ /* fullName, phone, idNumber bắt buộc; các field còn lại optional */ })
export type CustomerFormValues = z.infer<typeof customerFormSchema>

export const customerDocumentFormSchema = z.object({ /* documentType, documentNumber bắt buộc */ })
export type CustomerDocumentFormValues = z.infer<typeof customerDocumentFormSchema>

/** UC-CM-06/AC-CM-006 — bắt buộc lý do cho cả khoá lẫn mở khoá (áp dụng nhất
 * quán 2 chiều dù BRD chỉ nói rõ chiều khoá — an toàn hơn, giống tinh thần
 * EA-BR khi Employee có action nhạy cảm tương tự). */
export const blockReasonSchema = z.object({ reason: z.string().trim().min(3, '...') })
```

---

## 5. Business rule cần trích dẫn

| Hành vi | Mã trích dẫn | Enforce Phase 1? |
| --- | --- | --- |
| Tạo khách, mặc định `ACTIVE` | `CM-R01`, `UC-CM-03` bước 12, `AC-CM-001` | ✓ |
| Check trùng khi tạo/sửa | `CM-R02`, `CM §8`, `AC-CM-002`, `UC-CM-03` A2 | ✓ (hard-block, rút gọn — xem §4) |
| Khoá khách | `CM §10`, `CM-R03`, `AC-CM-006`, `UC-CM-06` | ✓ bắt buộc `reason` |
| Mở khoá khách | suy ra từ `UC-CM-06` | ✓ bắt buộc `reason` (quyết định Phase 1) |
| `BLOCKED` không tạo rental mới | `CM-R03`, `AC-CM-007`, `RM §41 Case 2` | Chỉ **ghi nhận bằng comment** — `Rental` chưa tồn tại, không enforce được (giống Assignment ở Employee). |
| Không hard delete khách đã phát sinh nghiệp vụ | `CM-R05`, `UC-CM-BR-05`, §25 | ✓ — không có `remove()` cho `Customer` |
| Audit mọi thay đổi quan trọng | `CM-R06`, `UC-CM-14`, `AC-CM-009` | ✓ — `create/update/block/unblock` + document CRUD |
| Document phải có `documentType` | `UC-CM-BR-07` | ✓ zod schema |
| Document expiry phải xác định | `CM-R09`, `UC-CM-BR-08`, `CM §23` | ✓ `documentExpiryStatus()` |
| Document được phép xoá | `UC-CM-14` liệt kê "Delete Document" là audit trigger | ✓ `removeDocument()` — **ngoại lệ** so với "không remove" của Customer gốc, vì đây là metadata giấy tờ, không có ràng buộc như `CM-R05`. |
| Dữ liệu nhạy cảm hạn chế xem | `CM-R10`, `UC-CM-BR-11`, `CM §26` | **Không** — mâu thuẫn thật với `permissions.ts` hiện tại, `TODO(OQ)` tại chỗ hiển thị CCCD/địa chỉ, không tự chế cơ chế mask. |
| Cọc xe máy | `CM-R11` | Ngoài phạm vi — không field, không comment tại model. |

---

## 6. Màn hình

### 6.1. Round 1 — `CustomerListScreen` (`/customers`)

Bám nguyên khung `EmployeeListScreen`: `PageHeader` + action "Thêm khách hàng" (gate
`can('CUSTOMER','EDIT')`); tìm kiếm theo tên/SĐT/CCCD (partial match); lọc theo Trạng thái; bảng
(≥768px: Tên, SĐT, Email, CCCD (có thể rút gọn hiển thị), Trạng thái badge, ngày tạo) / card list
(<768px); 2 loại empty state. `CustomerFormSheet` tạo/sửa (react-hook-form + zod), khối trùng lặp
báo lỗi rõ ("Số điện thoại/CCCD đã được dùng bởi khách khác"). Nút **Khoá/Mở khoá** (gate
`can('CUSTOMER','BLOCK')`) mở dialog nhập lý do (tái dùng pattern `EmployeeReasonDialog`).

### 6.2. Round 2 — `CustomerDetailScreen` (`/customers/:id`) — 6 tab

Header cố định trên `Tabs` (không thuộc tab nào): tên khách, `CustomerStatusBadge`, SĐT, nút Sửa
(gate `EDIT`) + Khoá/Mở khoá (gate `BLOCK`) luôn hiện.

| # | Tab | Loại | Nội dung |
| - | --- | --- | --- |
| 1 | **Hồ sơ** (mặc định) | Thật | Personal + Identity + Driver License, read-only, nút Sửa ở header mở lại `CustomerFormSheet`. |
| 2 | **Giấy tờ** | Thật (chỉ metadata) | List `CustomerDocument`: loại/số/ngày cấp-hết hạn/`DocumentStatus` badge, Thêm/Sửa/Xoá (gate `EDIT`). |
| 3 | **Lịch sử thuê** | Placeholder | "Chờ triển khai `Rental Management` (Phase 2)" — khối thông báo riêng biệt, không phải bảng rỗng giả (để không nhầm với "search/filter không ra kết quả"). |
| 4 | **Thanh toán & công nợ** | Placeholder | "Chờ `Payment`/`RentalSettlement` (Phase 4)". |
| 5 | **Sự cố** | Placeholder | "Chờ `DamageIncident` (Phase 3)". |
| 6 | **Tín nhiệm** | Không placeholder chung | Liệt kê đúng indicator theo `UC-CM-12` (Rental Count, Late Return Count, Cancellation Count, Payment Issue Count, Incident Count, Outstanding Amount), mỗi dòng = **"Chưa có dữ liệu"** (không phải `0`/`—`), kèm câu tĩnh trích tinh thần BRD: *"Phase 1 chỉ cung cấp dữ liệu/lịch sử, hệ thống không tự động kết luận khách hàng tốt/xấu (CM §20, UC-CM-12)."* |

"Current Rental" (BRD §17) gộp vào đầu tab Lịch sử thuê; "Customer Summary" (BRD §21) gộp vào tab
Tín nhiệm (cùng phụ thuộc dữ liệu chưa có — tránh 2 tab rỗng cùng lý do).

---

## 7. Responsive

**Round 1** — copy khung Employee: bảng `≥768px`/card `<768px`; bộ lọc gộp Sheet ở mobile;
`CustomerFormSheet` full-height mobile / ~480px desktop.

**Round 2:**

| Breakpoint | Layout |
| --- | --- |
| ~375px | Header card: tên/status/SĐT xếp dọc, 2 nút hành động gọn (ẩn label nếu chật). `TabsList` cuộn ngang tự nhiên (component `shared/ui/tabs.tsx` đã có sẵn `overflow-x-auto` — **không dựng dropdown chọn tab riêng**, vi phạm "chỉ dùng component `shared/ui/*` hiện có"). Rút ngắn nhãn tab: "Hồ sơ/Giấy tờ/Thuê xe/Thanh toán/Sự cố/Tín nhiệm". |
| ~768px+ | `TabsList` đủ chỗ 1 hàng; tab Hồ sơ chia 2 cột (Personal | Identity+License). |
| Mọi kích thước | Không cuộn ngang toàn trang; chỉ bảng giấy tờ tự `overflow-x-auto` nếu cần. |

---

## 8. Seed data (Round 1, `features/customers/seed.ts`)

8–10 khách:

| # | Trạng thái | Đặc điểm |
| - | --- | --- |
| 1–2 | `ACTIVE` | Đầy đủ field, có document `ID_CARD` trạng thái `VALID` |
| 3 | `ACTIVE` | `PASSPORT` thay vì `ID_CARD` |
| 4 | `ACTIVE` | Document `DRIVER_LICENSE` sắp hết hạn (trong 30 ngày) → demo badge `EXPIRING_SOON` |
| 5 | `ACTIVE` | Document đã hết hạn → demo badge `EXPIRED` |
| 6 | `ACTIVE` | Thiếu `licenseNumber`/`email` → demo hiển thị "chưa có" |
| 7 | `ACTIVE` | SĐT có tiền tố trùng khách khác → demo partial-match search |
| 8 | `BLOCKED` | Có `blockReason` cụ thể, 0 document → demo empty state tab Giấy tờ |
| 9–10 (tuỳ chọn) | `ACTIVE` | Đa dạng tên/địa chỉ có dấu để test search |

Đăng ký `registerSeedStep()`, import **sau `employees`, trước `vehicles`** trong
`shared/fixtures/registerSeeds.ts` (đúng thứ tự `docs/IMPLEMENTATION-PLAN.md`), bump `SEED_VERSION`.

---

## 9. API / hooks / audit

`api.ts` (namespace storage `customers`, mọi hàm bọc `fakeRequest()`):

- `list(filter?: { search?, status? })`, `getById(id)`
- `create(input)` / `update(id, input)` — gọi `findDuplicateCustomer`, throw nếu trùng
- `block(id, reason)` / `unblock(id, reason)` — validate `canBlock`/`canUnblock`
- `addDocument(customerId, input)` / `updateDocument(customerId, docId, input)` /
  `removeDocument(customerId, docId)`
- **Không có `remove()` cho Customer** (`CM-R05`)

Mọi mutation gọi `appendAudit()` với action rõ ràng — **thêm mới vào `AUDIT_ACTIONS`** (nối cuối
mảng, không chèn giữa): Round 1: `CREATE_CUSTOMER, UPDATE_CUSTOMER, BLOCK_CUSTOMER,
UNBLOCK_CUSTOMER`; Round 2: `ADD_CUSTOMER_DOCUMENT, UPDATE_CUSTOMER_DOCUMENT,
DELETE_CUSTOMER_DOCUMENT`.

`hooks.ts`: `useActor()` (tái dùng pattern Employee) + 1 hook `useQuery`/`useMutation` cho mỗi hàm
trên, `invalidateQueries(['customers', ...])` sau mutation.

---

## 10. i18n

Thêm `vi.customers.*` trong `shared/i18n/vi.ts` theo đúng cấu trúc `vi.employees.*` (title, field
labels, thông báo lỗi, placeholder tìm kiếm, nhãn bộ lọc, 2 empty state, text 3 tab placeholder, text
tab Tín nhiệm). Thêm `CUSTOMER_DOCUMENT_TYPE_LABELS`. Tái dùng nguyên `CUSTOMER_STATUS_LABELS`/
`DOCUMENT_STATUS_LABELS` đã có.

---

## 11. Thay đổi ở file dùng chung (không thuộc `features/customers/`)

- `enums.ts`: thêm `CUSTOMER_DOCUMENT_TYPES`; comment `TODO(OQ)` tại `CUSTOMER_STATUSES` (§2); nối
  7 action mới vào cuối `AUDIT_ACTIONS` (§9).
- `vi.ts`: thêm `vi.customers.*` + `CUSTOMER_DOCUMENT_TYPE_LABELS`.
- `permissions.ts`: **không sửa** — 3 entry `CUSTOMER.VIEW/EDIT/BLOCK` đã đúng, dùng nguyên.
- `shared/fixtures/registerSeeds.ts`: import `seedCustomers` đúng vị trí (Round 1).
- `app/routes.tsx`: bỏ `ComingSoon` cho `/customers` (Round 1) rồi `/customers/:id` (Round 2).
- `docs/IMPLEMENTATION-PLAN.md`: tick theo từng round.

---

## 12. Mã requirement cần trích trong code

`CM-R01, R02, R03, R05, R06, R09` · `UC-CM-01, 02, 03, 05, 06, 07, 12, 14` · `AC-CM-001, 002, 006,
007, 009` · `CR-2026-035` (`SALES` ≈ `MANAGER`, đã encode qua `likeManager()` trong `permissions.ts`
— không cần sửa gì thêm).

---

## 13. Definition of Done

**Cả 2 round**: `npx tsc -b` + `npx oxlint` + `npm run build` sạch (không cần Playwright — quyết
định 14/09/2026); `grep -rn '\*/[a-zA-Z]' src/` rỗng.

**Round 1** (chủ dự án tự test thủ công sau bàn giao): reset demo data → 8–10 khách đúng phân bổ §8;
tìm kiếm tên/SĐT/CCCD (kể cả partial); lọc trạng thái; tạo khách mới, trùng SĐT/CCCD bị chặn rõ
ràng; sửa khách; Khoá/Mở khoá bắt buộc lý do; đổi vai trò Topbar → `ACCOUNTANT`/`OPERATION_STAFF`
xem được list nhưng đúng quyền Sửa/Khoá theo bảng permission; ở 375px bộ lọc vào Sheet, list dạng
card. Sau đạt: `docs/IMPLEMENTATION-PLAN.md` tick phần List `[x]`, xoá `ComingSoon` `/customers`.
**Bàn giao Round 2 chỉ sau khi Round 1 qua review `tech-lead` đạt.**

**Round 2**: mở Detail từ List; 6 tab đúng nội dung/placeholder §6 (đặc biệt tab Tín nhiệm không số
liệu giả); tab Giấy tờ CRUD + badge `DocumentStatus` đúng ngưỡng 30 ngày; nút Sửa/Khoá ở header nhất
quán Round 1; ở 375px tab cuộn ngang được, không vỡ layout. Sau đạt: tick nốt `docs/IMPLEMENTATION-PLAN.md`,
xoá `ComingSoon` `/customers/:id`.

---

## 14. Việc tiếp theo sau khi phê duyệt

Round 1 của tài liệu này trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work +
danh sách file cần đọc trước theo đúng format mới — xem §1, và các file liệt kê trong phần "Nguồn
kỹ thuật"/"Nguồn nghiệp vụ" ở đầu tài liệu). Sau Round 1 qua review đạt, Round 2 giao tiếp theo cùng
quy trình. Không cần lên kế hoạch lại giữa 2 round — tài liệu này đã đủ chi tiết cho cả hai.
