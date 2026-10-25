# Kiến trúc

Đọc kèm [`CONVENTIONS.md`](../CONVENTIONS.md) (quy ước code chi tiết) và
[`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) (tiến độ theo phase).

## 1. Nguyên tắc

- **Feature First**: mỗi tính năng là một lát cắt dọc tự chứa (UI + logic + dữ liệu giả), ship và
  demo được độc lập — khớp triết lý phát triển của toàn dự án Thiên Bảo Car
  (`../thien-bao-car-docs/WebappQuanTri.md` §2.3).
- **`src/app/` mỏng**: route chỉ đọc param và lắp `<XxxScreen>` từ `src/features/*`.
- **`src/shared/` là nền tảng dùng chung**, không phụ thuộc ngược vào `features/`.
- **Không có backend thật** — mọi "gọi API" là hàm đồng bộ/bất đồng bộ đọc/ghi `localStorage`, bọc
  độ trễ giả lập để UI có trạng thái loading/error như môi trường live (xem §3).

## 2. Tầng thư mục

```
src/
├── app/                      Route tree (React Router) — chỉ mount screen
│   ├── paths.ts               hằng số path, tránh chuỗi rải rác
│   └── routes.tsx             khai toàn bộ <Route>, bọc AppShell
├── features/
│   ├── auth                  SA — đăng nhập demo theo vai trò, session (Zustand persist), usePermission(),
│   │                           Cấu hình hệ thống + Vai trò & quyền (Phase 6, màn tải lười)
│   ├── dashboard              KPI vận hành + widget KPI tài chính (finance) + bảng cảnh báo (Phase 6)
│   ├── calendar               RC — Day/Week/Month/Agenda + Vehicle Block (Phase 2)
│   ├── vehicles                VM — danh sách + Vehicle Detail nhiều tab (Phase 1)
│   ├── maintenance             MT — bảo dưỡng + phụ tùng toàn đội xe (Phase 1)
│   ├── customers                CM (Phase 1)
│   ├── employees                 EA — hồ sơ nhân viên + assignment (Phase 1/2)
│   ├── rentals                    RM — hub trung tâm (Phase 2)
│   ├── contracts                   CT (Phase 2)
│   ├── handover-return              VH + VR (Phase 3)
│   ├── incidents                     DI (Phase 3)
│   ├── finance                        RS + PM + RV (Phase 4) — chia thư mục con từ Phase 4.4:
│   │                                    core ← payment (PM) ← settlement (RS) ← revenue-cost (RV),
│   │                                    gốc chỉ index.ts + ui.ts + seed.ts (docs/FINANCE-REFACTOR-PLAN.md)
│   ├── consignment                     VC (Phase 5)
│   ├── audit                            AL — màn Nhật ký thao tác, đọc `shared/lib/audit.ts` (Phase 6)
│   └── notifications                     NT — gom tín hiệu cảnh báo từ module nguồn (mô hình quét) +
│                                           Trung tâm thông báo IN_APP_WEBAPP (Phase 6)
│       # mỗi thư mục: model.ts · api.ts · hooks.ts · components/ · screens/ · seed.ts · index.ts (dữ liệu) · ui.ts (màn/component)
│       # (audit, dashboard chỉ có ui.ts — không export dữ liệu). Không có vòng import (SCC = 0 từ Phase 6.1 R2).
└── shared/
    ├── ui/           shadcn/Radix primitives (button, input, table, dialog, sheet, tabs…)
    ├── layout/       AppShell (prop `topbarSlot` — app/routes ghép chuông thông báo), Sidebar (lọc theo quyền),
    │                 Topbar, PageHeader, nav.tsx
    ├── lib/          cn · storage (writeJson trả boolean, measureAppStorage) · fakeNetwork · id · money ·
    │                 datetime · audit (trần theo ký tự) · csv · pagination (paginate, DEFAULT_PAGE_SIZE)
    ├── domain/       enums.ts (toàn bộ enum nghiệp vụ) · permissions.ts (ma trận Role×Resource×Action)
    ├── i18n/         vi.ts — chuỗi UI + label map theo enum · auditLabels.ts / platformLabels.ts — nhãn chỉ
    │                 màn tải lười dùng (giữ ngoài JS tải đầu)
    ├── domain/alerts.ts — type OperationalSignal (tín hiệu cảnh báo dùng chung, Phase 6)
    └── fixtures/     seedAll.ts (registry + version) · registerSeeds.ts (thứ tự import) · resetDemoData.ts
```

## 3. Luồng dữ liệu ("fake API")

```
Component (screens/*)
   │  useQuery / useMutation
   ▼
features/<x>/hooks.ts  ──── TanStack Query (cache, loading, error, invalidate) ────┐
   │                                                                                │
   ▼                                                                                │
features/<x>/api.ts  ──►  fakeRequest()  (shared/lib/fakeNetwork.ts — độ trễ giả lập)
   │                                                                                │
   ▼                                                                                │
shared/lib/storage.ts  ──►  localStorage (namespace tbc_admin:*)                   │
   │                                                                                │
   └── create/update/remove ──► appendAudit()  (shared/lib/audit.ts) ◄─────────────┘
                                     │
                                     ▼
                        features/audit đọc lại để hiển thị "Nhật ký thao tác"
```

Vì `api.ts` giữ chữ ký hàm bất đồng bộ giống REST thật (`list`, `getById`, `create`, `update`,
`remove`), khi nối backend thật chỉ cần thay **nội dung bên trong** `api.ts` bằng `fetch`, bỏ lớp
`fakeRequest`, giữ nguyên `hooks.ts`/`model.ts`/UI — xem checklist ở §8.

## 4. Seed & Reset

- `main.tsx` gọi `seedIfNeeded()` một lần khi app khởi động: nếu `localStorage` chưa có
  `seedMeta` hoặc `SEED_VERSION` (`shared/fixtures/seedAll.ts`) đã đổi → chạy lại toàn bộ
  `seedSteps` đã đăng ký.
- Mỗi `features/<x>/seed.ts` tự gọi `registerSeedStep(fn)` khi được import. Thứ tự **import** ở
  `shared/fixtures/registerSeeds.ts` quyết định thứ tự **chạy** — phải theo đúng thứ tự phụ thuộc
  dữ liệu chéo (ví dụ: `employees`/`customers`/`vehicles` trước `rentals`, vì `rentals` seed cần id
  thật của các entity đó).
- Nút **"Reset dữ liệu demo"** (Topbar) gọi `resetDemoData()`: `clearAllAppData()` xoá sạch
  namespace `tbc_admin:*` (kể cả phiên đăng nhập) → `forceReseed()` → `window.location.reload()`.
  Dùng khi cần chạy demo nhiều lần liên tiếp cho nhiều khách mà không cần dev can thiệp.

## 5. Phân quyền

- Nguồn sự thật: `shared/domain/permissions.ts` — bảng tra `Role × Resource × Action`, biên soạn
  từ ma trận phân quyền tóm tắt theo từng nhóm trong `WebappQuanTri.md` (§6.4, §7.4, …), giữ
  nguyên trạng cả những ô `TBD` (Open Question).
- `usePermission()` (`features/auth`) đọc vai trò hiện tại từ session store, trả về hàm
  `can(resource, action)`.
- `shared/layout/Sidebar.tsx` lọc mục điều hướng theo `resource`/`action` khai trong
  `shared/layout/nav.tsx` (ẩn/hiện menu + nút hành động).
- **Chặn ở tầng route (Phase 6.1 R1 — `docs/TECH-HARDENING-PLAN.md` §1, §11):** bảng `app/routeAccess.ts`
  (`ROUTE_ACCESS` — 18 nhóm, cùng `resource`/`action` với `nav.tsx`) là nguồn duy nhất; `app/routes.tsx` bọc mỗi nhóm bằng layout
  route `RequirePermission` (`features/auth`). Thiếu quyền → hiện `shared/layout/NoPermissionState` ("Không có quyền truy cập"),
  **giữ nguyên URL** (đổi vai trò nhanh sang vai trò có quyền thì màn hiện lại ngay); màn tải lười không bị tải. Chỉ `/`, `/dashboard`,
  `/login` không guard. Ô `TBD` bị chặn (như `can()`). Các màn có kiểm quyền riêng bên trong vẫn giữ (phòng thủ 2 lớp). Link thông báo /
  cảnh báo chọn theo người xem qua `resolveLink()` (`features/notifications`: `link`, nếu không qua guard thì `linkFallback`).
- Topbar có dropdown **đổi vai trò nhanh** (`switchRole`) để demo khác biệt phân quyền giữa các
  role trong cùng một phiên, không cần đăng xuất/đăng nhập lại.

## 6. Theming & gotcha layout

- Toàn bộ token màu là CSS variable trong `src/index.css` (`:root`, override theo
  `prefers-color-scheme: dark` và theo `[data-theme]` nếu có toggle thủ công sau này).
- Màu thương hiệu (`--primary` ≈ xanh lá `#0B6B3A`) và màu trạng thái (`--color-status-pending` /
  `-progress` / `-done` / `-error` / `-info` / `-neutral`) **kế thừa từ App nhân viên**
  (`thien-bao-car-app-prototype-demo/src/shared/theme`) để hai app cùng một thương hiệu nhất quán
  khi demo song song.
- Dùng class Tailwind sinh từ token (`bg-primary`, `text-status-error`…), không hardcode hex trong
  component.
- **Gotcha đã gặp — không đặt khoá có tên chữ trong `@theme { --spacing-* }`** (phát hiện
  14/09/2026 khi review `features/employees`): `src/index.css` khai `--spacing-xs/sm/md/lg/xl/2xl`
  (ví dụ `--spacing-lg: 16px`). Trong Tailwind v4, các utility `max-w-*`/`w-*`/`min-w-*` tra
  **`--spacing-<tên>` trước `--container-<tên>`**, nên `max-w-lg` biên dịch thành
  `max-width: var(--spacing-lg)` = **16px** thay vì 32rem (kiểm chứng: `npm run build` →
  `dist/assets/*.css` có `.max-w-lg{max-width:var(--spacing-lg)}`). Hệ quả: `shared/ui/dialog.tsx`
  (`max-w-lg`), `shared/ui/sheet.tsx` (`sm:max-w-xl`), `shared/layout/ComingSoon.tsx` (`max-w-md` — file đã xoá ở Phase 6
  R4b) đều bị thu nhỏ sai. **Cách sửa gốc đã chốt**: bỏ hẳn 6 khoá `--spacing-<tên>` trong `@theme`
  (không có component nào dùng `p-md`/`gap-lg`/… — đã grep toàn `src/`), để Tailwind trả về thang
  `--container-*` mặc định; `--spacing: 0.25rem` (thang số `p-4`, `gap-3`…) không bị ảnh hưởng.
  **Quy tắc từ nay**: mọi token khoảng cách tự đặt phải dùng tên riêng (ví dụ `--tbc-gap-lg`),
  không chiếm namespace `--spacing-*`/`--container-*`/`--radius-*` của Tailwind; khi thấy một
  panel/dialog hẹp bất thường, kiểm tra CSS build ra trước khi workaround bằng `max-w-[…]`.
- **Gotcha đã gặp — flex item cần `min-w-0` mới `truncate` đúng**: `Topbar` ban đầu bị tràn/wrap
  chữ ở khổ ~390px vì span tên app là flex item nhưng không co lại được dưới kích thước nội dung
  (hành vi mặc định của flexbox). Thêm `min-w-0` cùng `truncate` thì mới cắt bớt đúng thay vì đẩy
  layout vỡ. Áp dụng quy tắc này cho mọi text dài nằm trong một hàng `flex` có nhiều phần tử cạnh
  nhau (Topbar, header của Card, breadcrumb…).

## 6a. Ngày giờ & múi giờ (Phase 6.1 R3 — `SA-BR-14`)

- Toàn app tính theo **một múi giờ cố định `Asia/Ho_Chi_Minh` (UTC+7)**, không theo giờ trình duyệt: mọi phép tính ngày/giờ đi qua
  `shared/lib/datetime.ts` (offset cố định, không thêm thư viện; `date-fns` chỉ còn cho `formatRelative`). Mốc lưu là ISO `…Z`; ngày lịch là date key
  `YYYY-MM-DD` theo +07.
- Lịch Tuần/Tháng và Bảng điều phối lấy danh sách ngày / dòng trong ngày từ hàm thuần `weekDayKeys`, `monthGridKeys`, `shiftAnchor`,
  `dispatchRowsForDay` (`features/calendar/model.ts`) — component chỉ hiển thị.
- Kiểm chứng (scratchpad `hardening/`): seed + harness giống hệt nhau dưới `TZ=Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`. Màn Cấu hình hệ thống hiện
  múi giờ hệ thống + múi giờ trình duyệt (chỉ thông tin). TODO(OQ: `TECH-HARDENING-PLAN.md` §9 OQ-N8-1) — múi giờ có cấu hình được không.

## 7. Routing

- React Router (`BrowserRouter` + `<Routes>`), khai tập trung ở `app/routes.tsx`, path constants ở
  `app/paths.ts`. `AppShell` là layout route bọc mọi màn hình sau đăng nhập — tự `<Navigate>` về
  `/login` nếu chưa có session (`useSessionStore`).
- Điều hướng cấp menu (7 nhóm + nền tảng) khai ở `shared/layout/nav.tsx`, đúng cấu trúc
  `WebappQuanTri.md` §5.4 — thêm màn hình mới ở đúng nhóm, không tự tạo nhóm mới trừ khi tài liệu
  đổi. Nhãn menu lấy từ `vi.nav`.
- **Tải lười màn ít dùng** (`docs/DASHBOARD-PLATFORM-PLAN.md` D11): feature có `screens/lazyScreens.ts`
  (`React.lazy(() => import('./XxxScreen').then(...))`), barrel UI `ui.ts` export **bản lazy** (giữ nguyên tên),
  `app/routes.tsx` bọc `<Suspense fallback=…>`. Đang áp cho Lịch (`/calendar` — Lịch Round 3 A), Báo cáo tài chính, Trung tâm thông báo, Nhật ký thao tác,
  Cấu hình hệ thống, Vai trò & quyền, Chi tiết nhân viên, widget tài chính Dashboard. Trần: **tổng JS tải đầu
  `/dashboard` (entry + mọi `modulepreload`) ≤ 1.870 kB**. Barrel dữ liệu `index.ts` (được `shared/layout` import, vd. `auth`)
  không còn export màn nào (Phase 6.1 R2). Lưu ý đo: tách barrel ở R2 không đổi tập module tải đầu (so sourcemap) nhưng Rolldown chia thêm
  chunk dùng chung → +5,5 kB do ranh giới chunk (gzip +0,7 kB) — `docs/TECH-HARDENING-PLAN.md` §12.9.
- **Danh sách dài phân trang phía client** (`shared/lib/pagination.ts` + `shared/ui/pagination.tsx`, 25 dòng/trang): số
  tổng/đếm tính trên toàn bộ dữ liệu đã lọc, chỉ cắt mảng hiển thị; đổi bộ lọc → về trang 1.

## 8. Nạp backend thật (khi tới giai đoạn đó)

1. Thay nội dung hàm trong từng `features/<x>/api.ts` bằng lời gọi HTTP thật, **giữ nguyên chữ
   ký** (`Promise<T>`) — `hooks.ts` và UI không cần sửa.
2. Bỏ lớp `fakeRequest()` (độ trễ/lỗi giả lập không còn cần thiết khi có network thật).
3. `shared/lib/audit.ts` chuyển từ ghi `localStorage` sang gọi API Audit Log thật (hoặc để backend
   tự ghi khi nhận request `create`/`update`/`remove` — cân nhắc bỏ `appendAudit()` phía client).
4. `shared/fixtures/seedAll.ts`/`registerSeeds.ts` không còn cần thiết cho dữ liệu nghiệp vụ (dữ
   liệu tới từ server) — có thể giữ lại một seed nhỏ cho môi trường dev/test cục bộ.
5. `permissions.ts` giữ nguyên vai trò tài liệu tham chiếu phía frontend, nhưng backend **phải**
   tự enforce quyền ở API — frontend chỉ ẩn/hiện UI, không phải cơ chế bảo mật.
