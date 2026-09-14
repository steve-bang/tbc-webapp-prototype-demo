# CLAUDE.md

Hướng dẫn cho Claude Code (và mọi dev) khi làm việc trong repo này.

## 1. Repo này là gì

**Prototype demo tĩnh** của **Webapp quản trị** (Web Admin) — hệ thống Thiên Bảo Car Management
System. Đây là **một trong ba ứng dụng** theo `CR-2026-001` (**Webapp quản trị** · App nhân viên
giao/nhận · App khách hàng — Phase sau). Dành cho các vai trò `SYSTEM_ADMIN`, `MANAGER`,
`DISPATCHER`, `SALES`, `ACCOUNTANT` (và `OPERATION_STAFF` hạn chế).

**Không có backend thật.** Toàn bộ dữ liệu là seed data lưu trong `localStorage` của trình duyệt,
thao tác qua một lớp "fake API" mô phỏng độ trễ mạng (xem `docs/ARCHITECTURE.md` §3) để trải
nghiệm giống môi trường live. Mục đích: (1) để **BA ↔ DEV giao tiếp** — thấy trước
navigation/entity/business rule trước khi code thật + gắn API thật; (2) để **demo cho khách hàng**
hình dung giao diện trước khi ký/triển khai.

**Ba tài liệu nội bộ phải đọc trước khi code**, theo thứ tự:

1. `CLAUDE.md` (file này) — bối cảnh nghiệp vụ, ranh giới phạm vi, cơ chế dùng chung.
2. [`CONVENTIONS.md`](CONVENTIONS.md) — quy ước code bắt buộc (cấu trúc feature, fake API layer,
   phân quyền, UI, enum…).
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc, luồng dữ liệu, seed/reset, theming,
   checklist nạp backend thật.

Tiến độ & backlog theo phase: [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — đây
là **backlog sống**, cập nhật liên tục, ưu tiên hơn bất kỳ ghi chú kế hoạch nào ở nơi khác (kể cả
plan file của phiên lập kế hoạch ban đầu).

## 2. Nghiệp vụ nằm ở kho tài liệu — KHÔNG tự suy luận

Đặc tả nghiệp vụ (BRD + Use Case) nằm ở **kho anh em `../thien-bao-car-docs/`**. Tài liệu quan
trọng nhất cho repo này: **`WebappQuanTri.md`** (bản mô tả tổng hợp Web Admin theo 7 nhóm nghiệp
vụ — điều hướng, màn hình, ma trận phân quyền tóm tắt theo từng nhóm). Quy tắc bắt buộc:

1. **Mọi màn hình / hành vi phải bám một mục cụ thể trong `WebappQuanTri.md` hoặc một Use
   Case/Business Rule của module BRD tương ứng.** Trước khi thêm/sửa tính năng: đọc phần liên quan
   (§6–§12 theo từng nhóm nghiệp vụ) và, khi cần chi tiết hơn, cặp `<Module>-BRD.md` +
   `<Module>-UseCase.md` trong `../thien-bao-car-docs/modules/`.
2. **Điều chưa rõ = Open Question / `TBD`, không tự bịa quyết định nghiệp vụ.** Ô `TBD` trong ma
   trận phân quyền (`src/shared/domain/permissions.ts`) nghĩa là tài liệu **chưa quyết định**, không
   phải "cấm" — `can()` coi `TBD` như `false` (an toàn), nhưng ghi rõ nguồn trong trường `source` để
   BA/khách biết đây là việc còn treo. Khi code chạm một Open Question mới → comment `TODO(OQ: ...)`
   trỏ tới mục/mã liên quan, không tự suy diễn hành vi cuối cùng.
3. **Mã requirement là định danh ổn định** (`VM-RULE-001`, `BR-011`, `CR-2026-050`…): trích trong
   comment 1 dòng ngay tại hằng số/logic tương ứng — xem ví dụ trong `shared/domain/enums.ts` và
   `shared/domain/permissions.ts`. Việc này giúp BA đối chiếu nhanh khi review UI.
4. **Giá trị enum phải khớp từng ký tự với tài liệu** (`AVAILABLE`, `DRAFT`, `FIXED_MONTHLY`…).
   Nguồn: `src/shared/domain/enums.ts`.
5. Khi tài liệu thay đổi qua một Change Request mới → cập nhật `enums.ts`/`permissions.ts`, màn hình
   liên quan, và seed data nếu cấu trúc entity đổi (bump `SEED_VERSION`, xem `CONVENTIONS.md` §4).

### Bản đồ 7 nhóm nghiệp vụ ↔ thư mục feature

| Nhóm (`WebappQuanTri.md`) | Module (prefix) | `src/features/*` |
| --- | --- | --- |
| 1. Xe & vòng đời | `VM`, `MT` | `vehicles`, `maintenance` |
| 2. Khách hàng | `CM` | `customers` |
| 3. Lịch & điều phối | `RC`, `EA` | `calendar`, `employees` (+ dispatch board trong `calendar`) |
| 4. Lượt thuê & hợp đồng | `RM`, `CT` | `rentals`, `contracts` |
| 5. Giao/nhận & sự cố | `VH`, `VR`, `DI` | `handover-return`, `incidents` |
| 6. Tài chính | `RS`, `PM`, `RV` | `finance` |
| 7. Xe ký gửi | `VC` | `consignment` |
| Nền tảng | `SA`, `AL`, `NT` | `auth` (SA), `audit` (AL), `notifications` (NT) |

## 3. Không thuộc phạm vi repo này (theo tài liệu)

**Thực hiện** giao/nhận xe tại hiện trường (chụp ảnh/video, ghi odo lúc giao/nhận thật) — thuộc App
nhân viên (`thien-bao-car-app-prototype-demo`); Webapp chỉ **giám sát + cấu hình + xử lý tiếp**
(§10.2 `WebappQuanTri.md`). App khách hàng tự phục vụ (Phase sau, CR-2026-002). Tích hợp bên ngoài
(VETC, phạt nguội, GPS, Zalo T1+) — Phase 2+, ở bản demo chỉ nhập tay/placeholder.

## 4. Cơ chế dùng chung phải tôn trọng (từ tài liệu)

- **Snapshot giá & điều khoản**: chốt tại thời điểm xác nhận/ký; bảng giá đổi sau không ảnh hưởng
  lượt thuê cũ.
- **Ba con số tiền khác nhau**: *khách phải chịu* (Settlement) ≠ *công ty phải chịu* (Cost Record)
  ≠ *đã thu/chi thực tế* (Payment) — không gộp làm một khi dựng UI tài chính.
- **Xe ký gửi = `FIXED_MONTHLY`** (CR-2026-050): công ty giữ 100% doanh thu, trả chủ xe một khoản
  cố định hàng tháng; **không** dựng logic chia % doanh thu.
- **`SALES` Phase 1 ≈ `MANAGER`** trên mọi resource nghiệp vụ, trừ `SYSTEM_ADMIN` (resource) và
  `REVERSE` trên `SETTLEMENT` (CR-2026-035) — đã encode sẵn trong `permissions.ts` qua helper
  `likeManager()`.
- **Audit mọi thao tác tạo/sửa/xoá** — gọi `appendAudit()` (xem `CONVENTIONS.md` §4), không bỏ
  qua dù là demo.

## 5. Cấu trúc, quy ước code & kiến trúc — chi tiết ở file riêng

Không lặp lại ở đây — bắt buộc đọc:

- [`CONVENTIONS.md`](CONVENTIONS.md): cấu trúc feature (Feature First), enum/kiểu, lớp dữ liệu
  "fake API" (storage/fakeNetwork/audit/seed), state management, phân quyền, form, UI/styling,
  lint/typecheck, trích dẫn tài liệu trong code, gotcha `*/` trong comment.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): sơ đồ tầng thư mục, luồng dữ liệu, vòng đời
  seed/reset, theming, routing, checklist nạp backend thật.

Lệnh nhanh: `npm run dev` · `npx tsc -b` (typecheck) · `npx oxlint` (lint) · `npm run build`. Chưa có
test runner — cổng bắt buộc trước khi `dev` báo một task là xong: `npx tsc -b`, `npx oxlint`, và
`npm run build` đều sạch (không lỗi). **`dev` không cần tự kiểm tra bằng Playwright/trình duyệt** —
người dùng (chủ dự án) sẽ tự thao tác thật trong trình duyệt để test thủ công sau khi nhận bàn giao
(quyết định 14/09/2026, xem `CHANGELOG.md`).

## 6. Xác thực & phân quyền demo

Đăng nhập bằng username + password (không OTP, đúng CR-2026-034) — tài khoản demo liệt kê sẵn trên
màn Login (`features/auth/model.ts`, mỗi vai trò một tài khoản, chấp nhận mọi mật khẩu ở bản demo).
Topbar có dropdown **đổi vai trò nhanh** (`switchRole`) để demo khác biệt phân quyền giữa các role
ngay trong một phiên, không cần đăng xuất/đăng nhập lại. Khi xong một tính năng có gắn quyền, thử
đổi vai trò để xác nhận sidebar/nút hành động ẩn/hiện đúng theo `permissions.ts`.

## 7. Làm việc với agent `tech-lead` và `dev` trong repo này

Repo có 2 subagent định nghĩa ở `.claude/agents/`:

- **`tech-lead`** (`.claude/agents/tech-lead.md`): lên kế hoạch — chia backlog trong
  `docs/IMPLEMENTATION-PLAN.md` thành task cụ thể, và review code đã implement (đúng kiến trúc,
  đúng nghiệp vụ, chất lượng) trước khi coi là xong. **Không tự tay implement tính năng lớn.**
- **`dev`** (`.claude/agents/dev.md`): thực thi task được giao — implement feature/screen, nối
  seed data, sửa theo góp ý review của `tech-lead`. Tuân thủ tuyệt đối `CONVENTIONS.md` +
  `docs/ARCHITECTURE.md`. **Không tự ý đổi kiến trúc/phạm vi.**

Vòng lặp làm việc thông thường: `tech-lead` chọn phase/mục tiếp theo trong
`docs/IMPLEMENTATION-PLAN.md` → giao task rõ ràng cho `dev` → `dev` implement + tự chạy
`tsc -b`/`oxlint`/`npm run build` (không cần tự test bằng trình duyệt — người dùng tự test thủ công)
→ `tech-lead` review kết quả → lặp lại tới khi phase xong.
Khi không có agent nào được chỉ định rõ, ưu tiên đọc `docs/IMPLEMENTATION-PLAN.md` để biết việc
tiếp theo là gì thay vì tự đoán phạm vi.
