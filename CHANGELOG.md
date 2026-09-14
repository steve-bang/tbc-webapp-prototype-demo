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

- Thêm [`docs/MAINTENANCE-MANAGEMENT-PLAN.md`](docs/MAINTENANCE-MANAGEMENT-PLAN.md): kế hoạch triển
  khai trang **Bảo dưỡng & phụ tùng** (`/maintenance`, module `MT`) — 1 trang 2 tab (Maintenance ·
  Spare Parts, CR-2026-039). Phát hiện quan trọng: `MT-BR-09`/BRD §11 (Maintenance Record là chứng
  từ khấu trừ cho xe ký gửi) là nội dung **cũ**, đã bị **CR-2026-050** (mô hình `FIXED_MONTHLY`)
  bãi bỏ trên thực tế — `WebappQuanTri.md` §6.5 xác nhận công ty chịu toàn bộ, không khấu trừ. Plan
  **không dựng logic Deduction**. Model 3 entity độc lập (`MaintenanceRule`/`MaintenanceRecord`/
  `SparePartRecord`, không nhúng trong `Vehicle` vì Rule có thể áp theo `VEHICLE_MODEL`). Ngưỡng
  cảnh báo `DUE_SOON` (BRD chưa chốt số) tạm đề xuất 500km kèm `TODO(OQ)`. Trạng thái:
  `PENDING_APPROVAL` — chờ phê duyệt trước khi giao `dev` implement.
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

- Kế hoạch trang Bảo dưỡng & phụ tùng (`docs/MAINTENANCE-MANAGEMENT-PLAN.md`) chuyển
  `PENDING_APPROVAL` → **`APPROVED`** (chủ dự án phê duyệt) — giao agent `dev` implement.
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
- **Feature `features/vehicles` — trang Quản lý xe Round 1 (`/vehicles`, module `VM`) hoàn thành**,
  đúng phạm vi `docs/VEHICLE-MANAGEMENT-PLAN.md` §1-§13. Model `Vehicle`/`VehicleDocument` (§2);
  **hàm dùng chung mới `documentExpiryStatus()`** rút ra `shared/lib/documentStatus.ts` — dùng thẳng
  cho `vehicles`, đồng thời refactor `features/customers/model.ts` gọi vào (giữ nguyên chữ ký public
  `(expiryDate, today, warningDays)`, hành vi không đổi). Api/hooks đầy đủ audit (`CREATE_VEHICLE`/
  `UPDATE_VEHICLE`/`CHANGE_VEHICLE_STATUS`/`ADD_VEHICLE_DOCUMENT`/`UPDATE_VEHICLE_DOCUMENT` nối cuối
  `AUDIT_ACTIONS`), không có `remove()` xe hay xoá document (`VM-RULE-005`, BRD §16.1 — chỉ giữ lịch
  sử). Seed 18 xe (16 `CONSIGNED`/2 `OWNED`, đủ 3 `Vehicle Class`, 2 xe `bankFinanced` có
  `MORTGAGE_RECEIPT` hợp lệ, hạn giấy tờ `EXPIRING_SOON`/`EXPIRED` tính động theo ngày chạy demo —
  không hardcode). `VehicleListScreen` (tìm kiếm biển số/hãng/dòng, 4 bộ lọc, tạo/sửa qua
  `VehicleFormSheet`, **đổi trạng thái là action riêng** qua `VehicleStatusDialog` đúng ma trận
  `AVAILABLE ⇄ MAINTENANCE`/`→ INACTIVE` — §5.2/`AC-VM-006`) + `VehicleDocumentsDialog` (CRUD giấy tờ,
  field động theo `documentType`, viết độc lập để Round 2 tái dùng nguyên trong tab Documents),
  responsive 375/768/desktop. Qua review `tech-lead` đạt ngay vòng 1, **không Blocker** — 4 điểm dev
  tự quyết định đều xác nhận hợp lệ: nút "Đổi trạng thái" là action riêng theo đúng §5.2 (không phải
  tự mở rộng phạm vi); `vehicleDocumentFormSchema` viết thành factory `(bankFinanced) => ZodSchema`
  + `useMemo` đúng cách vì rule phụ thuộc field của xe cha chứ không phải chính document; giữ field số
  (`currentKm`/`manufacturingYear`/`fuelLevel`/`warningLeadDays`) dạng `string` + regex validate thay
  vì `z.coerce.number()` — lỗi type `Resolver<{ field: unknown }, ...>` giữa zod v4 coerce và
  `@hookform/resolvers`/`react-hook-form` generic là **có thật** (tech-lead tái hiện độc lập), cách né
  hợp lý, ghi nhận làm pattern tham khảo cho field số sau này; cảnh báo mềm "Bank Financed thiếu
  `MORTGAGE_RECEIPT`" cố tình bỏ qua đúng theo plan §4 (không enforce ở Round 1). Ghi nhận 1 điểm
  "Nên sửa" không chặn: `VehicleCard` (mobile) chưa có nút "Đổi trạng thái" như bảng desktop — để task
  sau.
- **Feature `features/employees` — trang Quản lý nhân viên (`/employees`, module `EA`) hoàn thành**,
  đúng phạm vi `docs/EMPLOYEE-MANAGEMENT-PLAN.md`: model `Employee`/`UserAccount`, state machine
  3 trạng thái (`ACTIVE ⇄ SUSPENDED → INACTIVE`), api/hooks đầy đủ audit (`EA-BR-01/02/04/05/06/16`),
  seed 8 nhân viên khớp `DEMO_ACCOUNTS`, 3 màn hình (`EmployeeListScreen`/`EmployeeFormSheet`/
  `EmployeeStatusDialog` + `EmployeeReasonDialog` mới cho lý do đổi vai trò/khoá tài khoản), responsive
  375/768/desktop, gate quyền `EMPLOYEE.VIEW/EDIT/CONFIG`. Qua 2 vòng review `tech-lead`: vòng 1 phát
  hiện 2 Blocker (bug namespace token Tailwind `--spacing-*` va chạm `max-w-*`/`--container-*` khiến
  dialog vỡ layout dưới 640px — đã sửa gốc ở `src/index.css`; và lỗ hổng cho mở khoá tài khoản của
  nhân viên đang `SUSPENDED`, vi phạm `EA-BR-02` — đã thêm guard), vòng 2 xác nhận đạt.
- **Feature `features/maintenance` — trang Bảo dưỡng & phụ tùng (`/maintenance`, module `MT`) hoàn
  thành**, đúng phạm vi `docs/MAINTENANCE-MANAGEMENT-PLAN.md`. 3 entity độc lập
  `MaintenanceRule`/`MaintenanceRecord`/`SparePartRecord` (không nhúng trong `Vehicle`), **cố ý
  không dựng bất kỳ logic Deduction/khấu trừ chủ xe ký gửi nào** — `MT-BR-09`/BRD §11 là nội dung cũ
  đã bị CR-2026-050 bãi bỏ trên thực tế, xác nhận không có field/hàm/tham chiếu "Owner
  Statement"/"Deduction" nào lọt vào code. Hàm thuần `nextDueKm()`/`maintenanceDueStatus()` (3
  trạng thái `OK`/`DUE_SOON`/`OVERDUE`, ngưỡng tạm 500km kèm `TODO(OQ)`) + `applicableRule()` ưu
  tiên `SPECIFIC_VEHICLE` hơn `VEHICLE_MODEL` (`MT-BR-02`). Api/hooks đầy đủ audit (4 action mới:
  `CREATE_MAINTENANCE_RULE`/`DEACTIVATE_MAINTENANCE_RULE`/`CREATE_MAINTENANCE_RECORD`/
  `CREATE_SPARE_PART_RECORD`), Rule chỉ vô hiệu hoá không xoá vật lý, Record/SparePart append-only
  không có `update()`/`remove()` (`MT-BR-11`). Seed đủ demo cả 3 trạng thái tính động theo
  `Vehicle.currentKm` thật (kể cả 1 xe chưa có Record nào — baseline = 0). Màn `MaintenanceScreen`
  2 tab (Maintenance/Spare Parts), bảng "Đến hạn" toàn đội xe + quản lý Rule (gate
  `MAINTENANCE.CONFIG`, ô `TBD` cho Manager/Sales) + lịch sử theo xe, responsive 375/768/desktop.
  Qua review `tech-lead` đạt ngay vòng 1, **không Blocker** — 5 điểm dev tự quyết định đều xác nhận
  hợp lệ: dùng odometer lớn nhất (`maxOdometer()`) thay vì bản ghi mới nhất theo ngày để derive Next
  Due KM (an toàn hơn với dữ liệu ngày sai thứ tự vì không bỏ sót giá trị odo cao nhất thực tế đã
  ghi); Dialog thật cho "Vô hiệu hoá quy tắc" (không `window.confirm`); `vehicleModel` dùng `Select`
  từ dòng xe đã có trong seed (ghi nhận nợ nhỏ: chưa tạo được Rule cho dòng xe hoàn toàn mới chưa có
  xe nào trong hệ thống — chấp nhận được ở Phase 1 demo dữ liệu cố định); `<datalist>` HTML thuần
  gợi ý category (không phải component mới, không vi phạm quy ước); độ dài `MaintenanceScreen.tsx`
  hợp lý, không cần tách thêm.
