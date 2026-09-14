# Changelog

Nhật ký thay đổi ở mức dự án (planning + implementation) cho `tbc-webapp-prototype-demo`. Khác với
`docs/IMPLEMENTATION-PLAN.md` (backlog sống theo Phase) — file này ghi **theo mốc thời gian**, ngắn
gọn, phục vụ nhìn nhanh "gần đây đã đổi gì". Không thay thế Change Request Register của kho tài liệu
nghiệp vụ (`../thien-bao-car-docs/CHANGE-REQUESTS.md`) — CR là phản hồi nghiệp vụ từ khách hàng, file
này là nhật ký thay đổi của riêng repo webapp (kế hoạch, code, cấu trúc).

Định dạng: `### YYYY-MM-DD` rồi danh sách gạch đầu dòng, nhóm theo `Planned` (kế hoạch, chưa code) /
`Added` / `Changed` / `Fixed`.

---

### 2026-09-14

**Planned**

- Thêm [`docs/VEHICLE-MANAGEMENT-PLAN.md`](docs/VEHICLE-MANAGEMENT-PLAN.md): kế hoạch triển khai
  **Round 1 (Vehicle List)** của trang **Quản lý xe** (`/vehicles`, module `VM`) — page nặng nhất
  Phase 1. Đối chiếu `VehicleManagement-BRD.md` v1.12 + `WebappQuanTri.md` §6; mọi enum liên quan
  (`VEHICLE_STATUSES`/`VEHICLE_CLASSES`/`OWNERSHIP_TYPES`/`VEHICLE_DOCUMENT_TYPES`/
  `DOCUMENT_STATUSES`/`CONDITION_EVENT_TYPES`) **đã scaffold sẵn khớp BRD từ Phase 0**, dùng nguyên.
  Quyết định kiến trúc quan trọng: **tách `documentExpiryStatus()` thành hàm dùng chung** ở
  `shared/lib/documentStatus.ts` (dùng cho cả `vehicles` lẫn refactor `customers`), thay vì mỗi
  feature tự viết lại — đúng ngưỡng `Warning Lead Days` cấu hình theo từng bản ghi (CR-2026-046, đã
  chốt chính thức, khác Customer phải tạm ước lượng 30 ngày). **Round 2 (Vehicle Detail nhiều tab)
  cố ý chưa lên kế hoạch chi tiết** — đúng thứ tự build đã chốt (Vehicle list → Maintenance list →
  Vehicle Detail), để tab Maintenance+SpareParts nối dữ liệu thật ngay. Vehicle Block (CR-2026-015)
  và ảnh xe ngoài phạm vi Round 1 — nêu rõ lý do trong plan. Trạng thái: `PENDING_APPROVAL` — chờ
  phê duyệt trước khi giao `dev` implement Round 1.
- Thêm [`docs/CUSTOMER-MANAGEMENT-PLAN.md`](docs/CUSTOMER-MANAGEMENT-PLAN.md): kế hoạch triển khai
  trang **Quản lý khách hàng** (`/customers`, `/customers/:id`, module `CM`) — **tách 2 round**
  (List rồi Detail, đúng thứ tự đã chốt trong `docs/PAGE-IMPLEMENTATION-PRIORITY.md`). Đối chiếu
  `CustomerManagement-BRD.md` v1.3 + `-UseCase.md` v1.1; giữ nguyên enum `CUSTOMER_STATUSES` 2 giá
  trị (không thêm `INACTIVE` vì `UC-CM-13` phụ thuộc kiểm tra active rental — `Rental` chưa tồn
  tại); tab Tín nhiệm ở Detail chỉ hiển thị indicator "Chưa có dữ liệu", không tự tính điểm/mock số
  (đúng tinh thần BRD §20). Trạng thái: `PENDING_APPROVAL` — chờ phê duyệt trước khi giao `dev`
  implement Round 1.
- Thêm [`docs/EMPLOYEE-MANAGEMENT-PLAN.md`](docs/EMPLOYEE-MANAGEMENT-PLAN.md): kế hoạch triển khai
  chi tiết trang **Quản lý nhân viên** (`/employees`, module `EA`) — phạm vi Phase 1 (hồ sơ, tài
  khoản/vai trò, trạng thái làm việc, tìm kiếm/lọc, audit), có thiết kế responsive đầy đủ
  (375px / 768px / desktop), đối chiếu `EmployeeAssignment-BRD.md` + `-UseCase.md` v1.4 và ma trận
  quyền `EMPLOYEE.*` đã scaffold sẵn trong `permissions.ts`. Assignment (phân công giao/nhận, trùng
  lịch, hiệu suất) nêu rõ **ngoài phạm vi lần này** — hoãn sang khi module `Rental` (Phase 2) có dữ
  liệu. Trạng thái: `PENDING_APPROVAL` — chờ phê duyệt trước khi giao agent `dev` implement.

**Changed**

- Kế hoạch trang Quản lý xe (`docs/VEHICLE-MANAGEMENT-PLAN.md`) Round 1 chuyển `PENDING_APPROVAL`
  → **`APPROVED`** (chủ dự án phê duyệt) — giao agent `dev` implement Round 1 (Vehicle List). Round 2
  (Vehicle Detail) vẫn chưa lên kế hoạch chi tiết, chờ `features/maintenance` xong trước.
- Kế hoạch trang Quản lý khách hàng (`docs/CUSTOMER-MANAGEMENT-PLAN.md`) chuyển `PENDING_APPROVAL`
  → **`APPROVED`** (chủ dự án phê duyệt) — giao agent `dev` implement **Round 1** (List); Round 2
  (Detail) chờ Round 1 qua review đạt + xác nhận tiếp.
- Kế hoạch trang Quản lý nhân viên (`docs/EMPLOYEE-MANAGEMENT-PLAN.md`) chuyển `PENDING_APPROVAL` →
  **`APPROVED`** (chủ dự án phê duyệt) — giao agent `dev` implement theo đúng phạm vi đã lên kế hoạch.
- **Quy trình bàn giao `dev` → coi task xong**: bỏ yêu cầu `dev` tự test bằng Playwright/trình
  duyệt trước khi báo task xong. Từ nay 3 cổng bắt buộc duy nhất là `npx tsc -b`, `npx oxlint`,
  `npm run build` sạch — chủ dự án tự thao tác thật trong trình duyệt để test thủ công sau khi nhận
  bàn giao. Cập nhật `CLAUDE.md` §5/§7, `.claude/agents/dev.md`, `.claude/agents/tech-lead.md`, và
  `docs/EMPLOYEE-MANAGEMENT-PLAN.md` §11 cho khớp.
- **Quy trình `tech-lead` chia task cho `dev`**: mỗi task giờ bắt buộc có **Phạm vi công việc**
  (trong phạm vi / ngoài phạm vi, tránh `dev` tự mở rộng) và **danh sách file cần đọc trước** với
  đường dẫn cụ thể (tài liệu nghiệp vụ đúng mục/section + code tham chiếu liên quan) — mục tiêu để
  `dev` đọc thẳng đúng file ngay từ đầu, không tự scan toàn bộ `src/` hoặc toàn bộ
  `../thien-bao-car-docs/modules/` để tìm ngữ cảnh. Cập nhật `.claude/agents/tech-lead.md` (mục chia
  task) và `.claude/agents/dev.md` (thứ tự đọc file trước khi code).
- **Quy trình `tech-lead` review code**: chỉ đánh giá đúng phần `dev` đã sửa/thêm/xoá (qua
  `git status`/`git diff`) — không tự ý scan toàn bộ file khác trong dự án để "tìm thêm vấn đề".
  Vẫn được chạy 3 cổng bắt buộc (`tsc -b`/`oxlint`/`npm run build`) và mở đúng dòng/entry cụ thể mà
  diff tham chiếu tới khi cần xác nhận khớp. Cập nhật `.claude/agents/tech-lead.md` (mục review
  code).
- **Vòng lặp `tech-lead` ↔ `dev` chốt thành 4 bước chuẩn**: (1) `tech-lead` lên plan implement,
  (2) `dev` implement theo plan, (3) `tech-lead` review — có Blocker thì quay lại (2), hết Blocker
  thì sang (4), (4) **`tech-lead` tự add + commit source, cập nhật docs (`IMPLEMENTATION-PLAN.md`/
  plan doc riêng/`CHANGELOG.md`), rồi push lên cả nhánh làm việc và `main`** — việc commit/cập nhật
  docs/push không còn do điều phối viên làm thay sau khi review đạt. `dev` vẫn không bao giờ
  commit/push. Cập nhật `CLAUDE.md` §7, `.claude/agents/tech-lead.md` (mục review + ranh giới +
  mục mới "Khi review đạt — Bàn giao"), `.claude/agents/dev.md` (ranh giới).

**Added**

- **Feature `features/customers` — trang Quản lý khách hàng (`/customers`, `/customers/:id`,
  module `CM`) hoàn thành cả 2 round**, đúng phạm vi `docs/CUSTOMER-MANAGEMENT-PLAN.md`. **Round 1
  (List)**: model `Customer` (enum `CUSTOMER_STATUSES` giữ nguyên `ACTIVE`/`BLOCKED`, không thêm
  `INACTIVE` — `TODO(OQ)` tại khai báo), api/hooks đầy đủ audit (`CM-R01/02/03/05/06`), seed 9 khách
  (8 `ACTIVE` đa dạng field + 1 `BLOCKED` có lý do), `CustomerListScreen` (tìm kiếm tên/SĐT/CCCD,
  lọc trạng thái, tạo/sửa qua Sheet, Khoá/Mở khoá bắt buộc lý do qua `CustomerReasonDialog`).
  **Round 2 (Detail)**: `CustomerDocument` đầy đủ (enum `CUSTOMER_DOCUMENT_TYPES` mới, CRUD giấy tờ,
  `documentExpiryStatus()` ngưỡng 30 ngày tạm — `TODO(OQ: CM-BRD §23)`), `CustomerDetailScreen` 6
  tab (Hồ sơ/Giấy tờ thật, Lịch sử thuê/Thanh toán/Sự cố placeholder rõ ràng chờ Phase 2-4, Tín
  nhiệm hiển thị "Chưa có dữ liệu" cho từng indicator — không mock số liệu, đúng tinh thần BRD §20).
  Responsive 375/768/desktop cả 2 round. Qua review `tech-lead` đạt cả 2 vòng, **không Blocker lần
  nào** — mọi điểm dev tự quyết định (seed document động theo ngày, nhãn tab rút gọn thống nhất,
  Dialog cho form giấy tờ, import `paths.customerDetail()` trong feature) đều được xác nhận hợp lệ.
- **Feature `features/employees` — trang Quản lý nhân viên (`/employees`, module `EA`) hoàn thành**,
  đúng phạm vi `docs/EMPLOYEE-MANAGEMENT-PLAN.md`: model `Employee`/`UserAccount`, state machine
  3 trạng thái (`ACTIVE ⇄ SUSPENDED → INACTIVE`), api/hooks đầy đủ audit (`EA-BR-01/02/04/05/06/16`),
  seed 8 nhân viên khớp `DEMO_ACCOUNTS`, 3 màn hình (`EmployeeListScreen`/`EmployeeFormSheet`/
  `EmployeeStatusDialog` + `EmployeeReasonDialog` mới cho lý do đổi vai trò/khoá tài khoản), responsive
  375/768/desktop, gate quyền `EMPLOYEE.VIEW/EDIT/CONFIG`. Qua 2 vòng review `tech-lead`: vòng 1 phát
  hiện 2 Blocker (bug namespace token Tailwind `--spacing-*` va chạm `max-w-*`/`--container-*` khiến
  dialog vỡ layout dưới 640px — đã sửa gốc ở `src/index.css`; và lỗ hổng cho mở khoá tài khoản của
  nhân viên đang `SUSPENDED`, vi phạm `EA-BR-02` — đã thêm guard), vòng 2 xác nhận đạt.
