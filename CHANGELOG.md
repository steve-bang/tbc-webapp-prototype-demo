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

**Added**

- **Feature `features/employees` — trang Quản lý nhân viên (`/employees`, module `EA`) hoàn thành**,
  đúng phạm vi `docs/EMPLOYEE-MANAGEMENT-PLAN.md`: model `Employee`/`UserAccount`, state machine
  3 trạng thái (`ACTIVE ⇄ SUSPENDED → INACTIVE`), api/hooks đầy đủ audit (`EA-BR-01/02/04/05/06/16`),
  seed 8 nhân viên khớp `DEMO_ACCOUNTS`, 3 màn hình (`EmployeeListScreen`/`EmployeeFormSheet`/
  `EmployeeStatusDialog` + `EmployeeReasonDialog` mới cho lý do đổi vai trò/khoá tài khoản), responsive
  375/768/desktop, gate quyền `EMPLOYEE.VIEW/EDIT/CONFIG`. Qua 2 vòng review `tech-lead`: vòng 1 phát
  hiện 2 Blocker (bug namespace token Tailwind `--spacing-*` va chạm `max-w-*`/`--container-*` khiến
  dialog vỡ layout dưới 640px — đã sửa gốc ở `src/index.css`; và lỗ hổng cho mở khoá tài khoản của
  nhân viên đang `SUSPENDED`, vi phạm `EA-BR-02` — đã thêm guard), vòng 2 xác nhận đạt.
