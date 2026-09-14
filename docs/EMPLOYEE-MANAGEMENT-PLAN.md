# Kế hoạch triển khai — Trang Quản lý Nhân viên (Employee Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (14/09/2026, chủ dự án phê duyệt) — đã giao
`dev` implement theo đúng phạm vi §1–§9 và Definition of Done §11.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/EmployeeAssignment-BRD.md` (v1.4) +
`EmployeeAssignment-UseCase.md` (v1.4) + `../thien-bao-car-docs/WebappQuanTri.md` §8.2/§8.4.
**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase 1),
`docs/PAGE-IMPLEMENTATION-PRIORITY.md` (P1.1). Đối chiếu mã hiện có: `src/shared/domain/enums.ts`,
`src/shared/domain/permissions.ts`, `src/app/paths.ts` (đã khai `/employees` + `/employees/:id`),
`src/features/auth/model.ts` (`DEMO_ACCOUNTS`).

---

## 1. Phạm vi

### 1.1. Trong phạm vi (Phase 1 webapp — page `/employees`)

Toàn bộ **hồ sơ nhân viên** theo `EmployeeAssignment-BRD.md` §6–§8: tạo/xem/sửa hồ sơ, tìm kiếm &
lọc, gắn tài khoản đăng nhập + chọn vai trò, quản lý trạng thái làm việc, audit. Tương ứng
`UC-EA-01`, `UC-EA-02`, `UC-EA-03`, `UC-EA-04`, `UC-EA-20`.

### 1.2. Ngoài phạm vi lần này — vì sao

| Nhóm | Lý do hoãn |
| --- | --- |
| **Assignment** (`UC-EA-06` → `UC-EA-19`: phân công giao/nhận, trùng lịch, đổi người, bảng khối lượng, hiệu suất, dashboard App nhân viên) | Assignment gắn với **Rental** (`Planned Window` = pickup/return time của Rental) — Rental chưa tồn tại trong Phase 1 webapp (là Phase 2, xem `docs/IMPLEMENTATION-PLAN.md`). Xây trước sẽ phải giả lập dữ liệu Rental giả, trái nguyên tắc "không mock tĩnh". Đã chốt trong `docs/PAGE-IMPLEMENTATION-PRIORITY.md` P1.1 ("Không làm Employee Detail ở Phase 1"). |
| **Đánh dấu nghỉ / không sẵn dùng** (`UC-EA-05`) | Phụ thuộc lịch Assignment để hiển thị "các việc cần đổi người" (`EA-BR-18`) — cùng lý do trên, hoãn sang khi Assignment build. |
| **Trang chi tiết nhân viên** (`/employees/:id`) | Backlog Phase 1 chỉ yêu cầu **list**; Detail sẽ hiển thị lịch sử assignment + hiệu suất — chưa có dữ liệu nguồn. Giữ `ComingSoon`. |
| **Cấu hình quy tắc phân công** (`UC-EA-19`) | Thuộc phạm vi cấu hình Assignment, không phải hồ sơ nhân viên. |

Route `/employees/:id` **giữ `ComingSoon`**. Menu điều hướng chỉ có 1 mục "Hồ sơ nhân viên".

---

## 2. Actors & phân quyền (bám `permissions.ts` đã scaffold sẵn)

`permissions.ts` đã có 3 entry cho `EMPLOYEE` từ Phase 0 — dùng nguyên, **không tạo thêm resource
mới**:

| Resource.Action | SYSTEM_ADMIN | MANAGER | DISPATCHER | SALES | OPERATION_STAFF | ACCOUNTANT | Nguồn |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| `EMPLOYEE.VIEW` | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | WebappQuanTri §8.4 |
| `EMPLOYEE.EDIT` | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | WebappQuanTri §8.4 — Tạo/sửa hồ sơ |
| `EMPLOYEE.CONFIG` | ✓ | `TBD` | ✗ | `TBD` | ✗ | ✗ | WebappQuanTri §8.4 — Gắn tài khoản / chọn vai trò |

Quy tắc dùng trong UI:

- Nút **Thêm nhân viên** / **Sửa** → gate `can('EMPLOYEE', 'EDIT')`.
- Danh sách (xem) → gate `can('EMPLOYEE', 'VIEW')`; menu Sidebar đã tự lọc theo entry này (Phase 0).
- Khối **"Tài khoản đăng nhập"** trong form (chọn username, gán vai trò, khoá/mở tài khoản) → gate
  `can('EMPLOYEE', 'CONFIG')`. Với `MANAGER`/`SALES` giá trị là `'TBD'` → `can()` trả `false` (an
  toàn) nhưng UI phải **phân biệt "ẩn hẳn" và "disabled + tooltip"**: hiển thị khối này **disabled**
  kèm tooltip "Quyền chưa chốt — WebappQuanTri §8.4 (`EA-BRD §26 Q19/Q20`)" thay vì ẩn hoàn toàn, để
  BA/khách nhìn thấy đây là việc còn treo (đúng tinh thần `CLAUDE.md` §2.2 của repo).
- `ACCOUNTANT`/`OPERATION_STAFF`/`DISPATCHER` không có nút Sửa (theo bảng trên).

**Đối chiếu vai trò `SALES`:** CR-2026-035 nói Phase 1 `SALES` ≈ `MANAGER` toàn bộ resource nghiệp
vụ — bảng trên đã phản ánh đúng (`SALES.EDIT = true`, `SALES.CONFIG = 'TBD'` giống Manager).

---

## 3. Data model

### 3.1. `Employee` (feature `employees`, module `EA`)

| Field | Kiểu | Bắt buộc | Ghi chú / mã nguồn |
| --- | --- | --- | --- |
| `id` | `string` | ✓ | id nội bộ |
| `employeeCode` | `string` | ✓ (tự sinh) | `NV-001`, `NV-002`… — `UC-EA-01` §5.4 bước 5 |
| `fullName` | `string` | ✓ | |
| `phone` | `string` | ✓ | **duy nhất toàn hệ thống** — `EA-BR-05` |
| `email` | `string?` | | |
| `role` | `Role` | ✓ | từ `ROLES` (`enums.ts`) — danh mục do `SystemAdministration` sở hữu |
| `status` | `EmployeeStatus` | ✓ | xem §4 |
| `hireDate` | `string? (ISO date)` | | |
| `assignedArea` | `string?` | | hỗ trợ điều phối theo địa bàn — dữ liệu chuẩn bị sẵn cho Phase 2 |
| `note` | `string?` | | |
| `account` | `UserAccount?` | | nhúng trực tiếp, **không** tách store riêng — xem §3.2 |
| `createdAt` / `updatedAt` | `string (ISO)` | ✓ | |

### 3.2. `UserAccount` (nhúng trong `Employee`, quan hệ 0..1 — `EA-BR-01`)

| Field | Kiểu | Ghi chú |
| --- | --- | --- |
| `userId` | `string` | liên kết `DEMO_ACCOUNTS` khi seed khớp 5 vai trò có sẵn |
| `username` | `string` | định danh đăng nhập (SĐT/email/username — CR-2026-034) |
| `accountStatus` | `AccountStatus` | `ACTIVE` / `LOCKED` / `DISABLED` (`enums.ts` đã có) |

**Bản chất tài khoản (xác thực, phiên đăng nhập) thuộc `SystemAdministration`** — module này chỉ
*yêu cầu tạo* và *hiển thị trạng thái liên kết* (đúng ranh giới BRD §1.2/§7.1). Không tự dựng cơ chế
đăng nhập riêng.

### 3.3. Hàm thuần (`model.ts`)

- `nextEmployeeCode(list)` — sinh mã tiếp theo.
- `isPhoneTaken(list, phone, exceptId?)` — validate `EA-BR-05`.
- `canTransitionStatus(from, to)` — xem ma trận §4.
- `accountStatusFor(employeeStatus)` — suy `AccountStatus` từ `EmployeeStatus` khi đổi trạng thái
  (`SUSPENDED`/`INACTIVE` → khoá — `EA-BR-02`).
- Zod schema `employeeFormSchema` — lỗi tiếng Việt, trích mã rule khi hữu ích.

---

## 4. Trạng thái làm việc

**Vấn đề cần quyết định trước khi giao `dev`:** `EA-BRD` §8 định nghĩa **4 trạng thái**
(`ACTIVE / ON_LEAVE / SUSPENDED / INACTIVE`), nhưng `enums.ts` hiện tại (Phase 0 scaffold) chỉ có
**3 giá trị** (`EMPLOYEE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED']` — thiếu `ON_LEAVE`), và
`WebappQuanTri.md` §8.2 cũng chỉ liệt kê 3. Vì `ON_LEAVE` gắn chặt với luồng Assignment (`EA-BR-03`,
`EA-BR-18` — "đang có assignment chưa hoàn thành") mà Assignment ngoài phạm vi lần này (§1.2), đề
xuất: **giữ nguyên 3 trạng thái hiện có ở `enums.ts` cho page này**, thêm
`// TODO(OQ: EA-BRD §8 vs WebappQuanTri §8.2 — ON_LEAVE chưa vào enums.ts, chờ Phase 2 Assignment)`
tại đúng chỗ khai báo. **Không tự thêm `ON_LEAVE` bây giờ** — sẽ cần sửa lại `canTransitionStatus` và
UI khi Assignment build, best để cùng lúc.

### Chuyển trạng thái hợp lệ (rút gọn 3 giá trị)

```text
ACTIVE ⇄ SUSPENDED
ACTIVE / SUSPENDED → INACTIVE   (một chiều — không quay lại, EA-BR-06/UC-EA-04 A1)
```

| Status | Đăng nhập? | Ý nghĩa | `AccountStatus` tương ứng |
| --- | --- | --- | --- |
| `ACTIVE` | Có | Đang làm việc | `ACTIVE` |
| `SUSPENDED` | Không | Tạm đình chỉ | `LOCKED` — `EA-BR-02` |
| `INACTIVE` | Không | Đã nghỉ việc | `DISABLED` — `EA-BR-02` |

**Cảnh báo khi đổi trạng thái (`EA-BR-18`):** BRD yêu cầu cảnh báo danh sách assignment cần đổi
người khi chuyển trạng thái mà nhân viên còn việc chưa hoàn thành. Vì Assignment chưa tồn tại, dialog
đổi trạng thái ở page này **bỏ qua bước cảnh báo này** (không có gì để cảnh báo) nhưng vẫn giữ ô nhập
**lý do đổi trạng thái bắt buộc** (dùng chung cho audit, và sẽ tái dùng khi Assignment build) —
tránh phải đổi lại contract của dialog sau này.

---

## 5. Màn hình & UI

### 5.1. `EmployeeListScreen` (`/employees`)

- `PageHeader` — tiêu đề "Hồ sơ nhân viên", mô tả ngắn, action **"Thêm nhân viên"** (gate
  `EMPLOYEE.EDIT`).
- Thanh công cụ: ô tìm kiếm (tên / SĐT / `employeeCode` — `UC-EA-02`) + 3 bộ lọc: **Vai trò**,
  **Trạng thái làm việc**, **Khu vực phụ trách**.
- Bảng (desktop ≥768px): Mã NV · Họ tên · SĐT · Vai trò (badge) · Trạng thái (badge màu token: xanh
  `ACTIVE`, xám `INACTIVE`, đỏ/cam `SUSPENDED`) · Tài khoản (username hoặc "Chưa có") · Khu vực ·
  cột hành động (Sửa / Đổi trạng thái, gate `EMPLOYEE.EDIT`).
- **Card list** (mobile <768px, xem §6): mỗi nhân viên 1 card thay vì hàng bảng.
- Trạng thái rỗng: khi không có kết quả tìm kiếm/lọc → thông báo + gợi ý xoá bộ lọc; khi hoàn toàn
  chưa có nhân viên (không xảy ra sau seed, nhưng vẫn cần) → gợi ý "Thêm nhân viên".

### 5.2. `EmployeeFormSheet` (tạo/sửa — `UC-EA-01`)

Field theo §3.1, chia 2 khối rõ ràng:

1. **Thông tin nhân viên** — luôn hiện, gate tổng thể `EMPLOYEE.EDIT`: họ tên*, SĐT* (validate trùng
   theo `isPhoneTaken`, lỗi "Số điện thoại đã được dùng bởi NV-xxx"), email, vai trò* (select từ
   `ROLES`), ngày vào làm, khu vực phụ trách, ghi chú.
2. **Tài khoản đăng nhập** — khối riêng, **disabled + tooltip nếu không có `EMPLOYEE.CONFIG`** (xem
   §2): switch "Tạo tài khoản đăng nhập" (`UC-EA-03`) → hiện field `username`; nếu nhân viên đã có
   tài khoản, hiện trạng thái (`ACTIVE`/`LOCKED`/`DISABLED`) + nút khoá/mở (cũng gate `CONFIG`, và
   chặn tự khoá tài khoản chính mình — `EA-BR-04`, so `session.userId` với `employee.account.userId`).

Khi tạo mới: `employeeCode` tự sinh, `status = ACTIVE` mặc định (`UC-EA-01` §5.4 bước 5).
Khi đổi **vai trò** hoặc **trạng thái** trên nhân viên đã tồn tại → yêu cầu xác nhận riêng (không
lẫn vào submit form thường) vì đây là hành động cần audit tách biệt (`UC-EA-01` §5.5 bước 3).

### 5.3. `EmployeeStatusDialog` (đổi trạng thái riêng — `UC-EA-04`)

Dialog riêng ngoài form sửa (không gộp vào Sheet) — chọn trạng thái mới (chỉ hiện lựa chọn hợp lệ
theo `canTransitionStatus`), **bắt buộc nhập lý do**, xác nhận → gọi `changeStatus()`.

### 5.4. Bảng ánh xạ Use Case → thành phần UI

| Use Case | Thành phần |
| --- | --- |
| `UC-EA-01` (tạo/xem/sửa) | `EmployeeListScreen` + `EmployeeFormSheet` |
| `UC-EA-02` (tìm kiếm & lọc) | thanh công cụ trong `EmployeeListScreen` |
| `UC-EA-03` (gắn tài khoản & vai trò) | khối "Tài khoản đăng nhập" trong `EmployeeFormSheet` |
| `UC-EA-04` (trạng thái làm việc) | `EmployeeStatusDialog` |
| `UC-EA-20` (audit) | mọi hành động ở trên gọi `appendAudit()` |

---

## 6. Responsive (bắt buộc theo `CONVENTIONS.md` §8 — 375px / 768px / desktop)

| Breakpoint | Layout |
| --- | --- |
| **~375px (điện thoại)** | `EmployeeListScreen`: card list dọc (không bảng — bảng buộc cuộn ngang xấu ở màn hẹp); thanh công cụ: ô tìm kiếm full-width, 3 bộ lọc gộp vào **1 nút "Bộ lọc" mở `Sheet` từ dưới lên** (tránh 3 dropdown chen chúc theo hàng ngang). `PageHeader` action "Thêm nhân viên" thu gọn thành icon button + label ẩn nếu cần. `EmployeeFormSheet` mở **full-height** (không phải panel hẹp bên phải). |
| **~768px (tablet)** | Bảng hiện được nhưng ẩn bớt cột phụ (Khu vực) vào một cột "..." (popover) nếu chật; 3 bộ lọc hiện dạng hàng ngang cuộn ngang riêng nếu cần (`overflow-x-auto` cho riêng thanh lọc, không phải cả trang). `EmployeeFormSheet` panel rộng ~90vw. |
| **Desktop (≥1024px)** | Bảng đầy đủ cột như §5.1; 3 bộ lọc + tìm kiếm cùng hàng; `EmployeeFormSheet` panel cố định (~480px width theo pattern `shared/ui/sheet`). |
| **Mọi kích thước** | Trang không bao giờ cuộn ngang toàn trang; chỉ bảng (khi ở dạng bảng) tự cuộn trong `overflow-x-auto`. Test cụ thể: đổi vai trò ở Topbar (gotcha `min-w-0`/`truncate` đã ghi ở `docs/ARCHITECTURE.md` §6) không được vỡ layout khi tên vai trò dài. |

Quyết định card-list vs table theo breakpoint dùng Tailwind responsive class có sẵn trong
`shared/ui/*` (component `Table` giữ cho ≥768px, viết thêm 1 component nhỏ `EmployeeCard` dùng dưới
768px) — **không viết logic responsive bằng JS đo `window.innerWidth`**, dùng CSS (`hidden md:block`
/ `md:hidden`) theo đúng pattern Tailwind đã dùng trong `AppShell`/`Sidebar`.

---

## 7. Seed data (`features/employees/seed.ts`)

8 nhân viên — **5 khớp `DEMO_ACCOUNTS`** (`features/auth/model.ts`: admin, manager, dispatcher,
sales, accountant — liên kết `userId` để không lệch dữ liệu giữa auth và employees) + **3
`OPERATION_STAFF`** không/có tài khoản khác nhau để phủ đủ nhánh UI:

| # | Vai trò | Trạng thái | Tài khoản | Khu vực |
| - | --- | --- | --- | --- |
| 1–5 | khớp 5 `DEMO_ACCOUNTS` | `ACTIVE` | có, `ACTIVE` | đa dạng |
| 6 | `OPERATION_STAFF` | `ACTIVE` | có (`usr_staff`), `ACTIVE` | Quận 1 |
| 7 | `OPERATION_STAFF` | `SUSPENDED` | có, `LOCKED` (đồng bộ §4) | Quận 7 |
| 8 | `OPERATION_STAFF` | `INACTIVE` | **không có** tài khoản | — |

Đăng ký qua `registerSeedStep()`, import **đầu tiên** trong `shared/fixtures/registerSeeds.ts`
(đúng thứ tự phụ thuộc — nhân viên là danh mục nền đầu tiên); bump `SEED_VERSION`.

---

## 8. API / hooks / audit

`api.ts` (namespace storage `employees`, mọi hàm bọc `fakeRequest()`):

- `list(filter?: { search?, role?, status?, area? })`
- `getById(id)`
- `create(input)` — sinh `employeeCode`, validate `EA-BR-05`
- `update(id, input)` — validate `EA-BR-05` trừ chính nó
- `changeStatus(id, status, reason)` — áp `accountStatusFor`, validate `canTransitionStatus`
- `grantAccount(id, username)` / `lockAccount(id)` / `unlockAccount(id)` (`UC-EA-03`) — chặn tự khoá
  chính mình (`EA-BR-04`)
- **Không có `remove`** — `EA-BR-06` chuyển `INACTIVE` thay vì xoá vật lý

Mọi `create`/`update`/`changeStatus`/`grantAccount`/`lockAccount` gọi `appendAudit()` — action rõ
ràng (`CREATE_EMPLOYEE`/`UPDATE_EMPLOYEE`/`CHANGE_WORK_STATUS`/`GRANT_ACCOUNT`/`LOCK_ACCOUNT`, theo
đúng danh mục action của `UC-EA-20` §24.3), kèm `before`/`after`, và **`reason` bắt buộc** khi action
là đổi trạng thái hoặc khoá tài khoản (đúng `UC-EA-20` §24.3 cột Reason).

`hooks.ts`: `useEmployees(filter)`, `useEmployee(id)`, `useCreateEmployee`, `useUpdateEmployee`,
`useChangeEmployeeStatus`, `useGrantAccount`, `useLockAccount`/`useUnlockAccount` — mỗi mutation
`invalidateQueries(['employees'])` (và `['employees', id]` khi có).

---

## 9. i18n

Thêm `vi.employees.*` trong `shared/i18n/vi.ts`: tiêu đề trang, nhãn field, thông báo lỗi validate,
placeholder tìm kiếm, nhãn 3 bộ lọc, text 2 loại trạng thái rỗng, nhãn action. Tái dùng
`EMPLOYEE_STATUS_LABELS` / `ROLE_LABELS` / `ACCOUNT_STATUS_LABELS` đã có sẵn trong `enums.ts` cho
badge — không tạo map nhãn trùng lặp.

---

## 10. Mã requirement cần trích trong code (`CONVENTIONS.md` §10)

`EA-BR-01, 02, 04, 05, 06, 16` · `UC-EA-01, 02, 03, 04, 20` · `CR-2026-034` (đăng nhập tài khoản +
mật khẩu, không OTP — liên quan hiển thị username) · `CR-2026-035` (`SALES` ≈ `MANAGER`).

---

## 11. Definition of Done

1. `npx tsc -b` và `npx oxlint` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng (gotcha comment — `CONVENTIONS.md` §11).
3. Trong trình duyệt (≥1024px, ~768px, ~375px — dùng DevTools device toolbar):
   - Reset demo data → đúng 8 nhân viên, đúng phân bổ trạng thái/tài khoản ở §7.
   - Tìm kiếm theo tên/SĐT/mã, lọc theo từng bộ lọc, kết hợp nhiều bộ lọc.
   - Tạo nhân viên mới (có/không tạo tài khoản), sửa nhân viên, đổi trạng thái (đúng ma trận §4,
     lý do bắt buộc).
   - SĐT trùng → bị chặn với thông báo rõ ràng.
   - Đổi vai trò ở Topbar sang `DISPATCHER` → thấy list, không thấy nút Sửa. Sang `ACCOUNTANT` →
     mục menu vẫn hiện (có `VIEW`) nhưng không có action sửa. Sang `OPERATION_STAFF` → mục menu biến
     mất khỏi Sidebar.
   - Khối "Tài khoản đăng nhập" hiện disabled + tooltip khi vai trò hiện tại có `CONFIG = 'TBD'`
     (Manager, Sales) — xác nhận tooltip đúng nội dung.
   - Ở 375px: bộ lọc gộp vào Sheet, danh sách hiển thị dạng card, không cuộn ngang toàn trang.
4. `docs/IMPLEMENTATION-PLAN.md` mục `features/employees` tick `[x]` sau khi merge, xoá `ComingSoon`
   route `/employees` (giữ nguyên cho `/employees/:id`).

---

## 12. Việc tiếp theo sau khi phê duyệt

Tài liệu này, sau khi được phê duyệt, sẽ trở thành task brief đầy đủ giao thẳng cho agent `dev` (thay
thế task brief rút gọn trước đó) — không cần lên kế hoạch lại. `dev` implement đúng §3–§9, tự chạy
kiểm tra §11, báo cáo file đã tạo/sửa để `tech-lead` review.

**Cập nhật 14/09/2026:** Đã `APPROVED` — giao `dev` implement.
