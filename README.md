# Thiên Bảo Car — Webapp quản trị (prototype demo)

Prototype tĩnh của **Webapp quản trị** (Web Admin) thuộc hệ thống Thiên Bảo Car Management System — một trong ba ứng dụng
(Webapp quản trị · App nhân viên giao/nhận · App khách hàng, Phase sau). Dùng để BA và DEV thống nhất màn hình/quy tắc
nghiệp vụ trước khi code thật, và để demo cho khách hàng.

**Không có backend.** Toàn bộ dữ liệu là seed data lưu trong `localStorage` của trình duyệt, thao tác qua một lớp "fake API"
mô phỏng độ trễ mạng. Bối cảnh, ranh giới phạm vi và cơ chế dùng chung: xem [`CLAUDE.md`](CLAUDE.md) §1–§4.

Stack: React + Vite + TypeScript, Tailwind + shadcn/ui, TanStack Query, Zustand (chỉ session/UI), React Router.

## Yêu cầu môi trường và cài đặt

- Node.js bản LTS gần đây (đủ cho Vite và TypeScript trong `package.json`) và npm.

```bash
npm install
```

## Lệnh thường dùng

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy dev server (Vite) |
| `npx tsc -b` | Kiểm tra kiểu |
| `npx oxlint` | Lint |
| `npm run build` | Build production (gồm `tsc -b`) |

Ba lệnh `npx tsc -b`, `npx oxlint`, `npm run build` là **cổng bắt buộc**: cả ba phải sạch trước khi coi một task là xong.
Repo chưa có test runner.

## Tài khoản demo

Đăng nhập bằng tên đăng nhập + mật khẩu (không OTP — CR-2026-034). Bản demo **chấp nhận mọi mật khẩu không rỗng**. Mỗi vai
trò có một tài khoản, liệt kê ngay trên màn Đăng nhập (bấm để điền nhanh); danh sách gốc ở
`src/features/auth/model.ts`:

`admin` · `manager` · `dispatcher` · `sales` · `accountant` · `staff`

Topbar có dropdown **đổi vai trò nhanh** để xem khác biệt phân quyền (sidebar, nút hành động) ngay trong một phiên, không cần
đăng xuất. Ma trận quyền nằm ở `src/shared/domain/permissions.ts` (xem màn Nền tảng → Vai trò & quyền).

## Reset dữ liệu demo

- Nút **Reset dữ liệu demo** trên Topbar (hoặc trong màn Cấu hình hệ thống) xoá dữ liệu hiện tại và nạp lại seed ban đầu.
- Khi cấu trúc dữ liệu đổi, tăng `SEED_VERSION` trong `src/shared/fixtures/seedAll.ts` — lần mở trang kế tiếp trình duyệt tự
  seed lại.
- Chi tiết vòng đời seed/reset: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4.

## Cấu trúc thư mục (rút gọn)

```text
src/
  app/        routes, paths, providers
  features/   mỗi nhóm nghiệp vụ một thư mục (Feature First)
  shared/     ui · layout · domain (enums, permissions) · i18n · lib · fixtures
```

Sơ đồ đầy đủ các tầng và luồng dữ liệu: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §2–§3.

## Thêm một feature mới

Mỗi feature là một thư mục `src/features/<tên>/` gồm `model.ts` · `api.ts` · `hooks.ts` · `components/` · `screens/` ·
`seed.ts` · `index.ts`. Các bước chính:

1. Khai báo kiểu và schema trong `model.ts`; dùng lại enum ở `shared/domain/enums.ts`.
2. Viết `api.ts` bọc `fakeRequest()`, đọc/ghi qua `shared/lib/storage.ts`, gọi `appendAudit()` ở mọi tạo/sửa/xoá.
3. Viết `seed.ts`, đăng ký trong `shared/fixtures/registerSeeds.ts` đúng thứ tự phụ thuộc dữ liệu.
4. Viết `hooks.ts` (TanStack Query) rồi `screens/` và `components/`, chỉ dùng component từ `shared/ui`.
5. Gắn quyền (`permissions.ts`, `usePermission()`), thêm path vào `app/paths.ts`, route vào `app/routes.tsx`, mục điều hướng
   vào `shared/layout/nav.tsx`; chuỗi UI để trong `shared/i18n/vi.ts`.

Quy ước bắt buộc: [`CONVENTIONS.md`](CONVENTIONS.md) §3–§6.

## Tài liệu liên quan

- [`CLAUDE.md`](CLAUDE.md) — bối cảnh nghiệp vụ, ranh giới phạm vi, cách làm việc với agent `tech-lead` / `dev`.
- [`CONVENTIONS.md`](CONVENTIONS.md) — quy ước code bắt buộc.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — kiến trúc, luồng dữ liệu, seed/reset, theming, checklist nạp backend thật.
- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — tiến độ và backlog theo phase.
- [`CHANGELOG.md`](CHANGELOG.md) — nhật ký thay đổi.
- Kho đặc tả nghiệp vụ `../thien-bao-car-docs/` — nguồn chính là `WebappQuanTri.md`, chi tiết hơn ở `modules/`.
