# CONVENTIONS.md — Quy ước code

Đọc kèm [`CLAUDE.md`](CLAUDE.md) (kỷ luật đọc tài liệu nghiệp vụ) và
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (kiến trúc & luồng dữ liệu). File này là quy ước
**bắt buộc** cho mọi code viết trong repo — agent `dev` và `tech-lead` đều phải tuân thủ khi
implement/review.

---

## 1. Ngôn ngữ

- **Chuỗi UI: tiếng Việt**, tập trung ở `src/shared/i18n/vi.ts` (`vi.<nhóm>.<khóa>` hoặc các map
  `*_LABELS` cho enum). Không hardcode chuỗi tiếng Việt rải rác trong component.
- **Token kỹ thuật giữ tiếng Anh**: giá trị enum, mã requirement (`VM-RULE-001`, `BR-011`), tên
  field/biến/hàm.
- Ngày giờ: dùng `formatDate`/`formatDateTime`/`formatTime`/`formatRelative` trong
  `shared/lib/datetime.ts` (định dạng `dd/MM/yyyy`). Tiền: `formatVnd` trong `shared/lib/money.ts`.
- Comment/JSDoc bằng tiếng Việt khi giải thích lý do (WHY); không viết comment mô tả lại điều tên
  biến/hàm đã nói rõ.

## 2. Enum & kiểu

- **KHÔNG dùng `enum` của TypeScript.** Luôn `as const` array/object + union type suy ra
  (`typeof X[number]`) — xem `src/shared/domain/enums.ts`. Lý do: giá trị phải là literal string
  khớp **từng ký tự** với tài liệu (`AVAILABLE`, `FIXED_MONTHLY`…), và TS 6 (`erasableSyntaxOnly`)
  đã chặn cú pháp `enum` ở cấp compiler.
- Mỗi khối enum trong `enums.ts` có comment 1 dòng trỏ về module/mã tài liệu nguồn. Thêm giá trị
  mới → nối vào cuối mảng, không chèn giữa, kèm mã CR nếu có.
- Type nghiệp vụ dùng chung đặt ở `shared/domain/*`. Type riêng của một feature đặt ở
  `features/<feature>/model.ts`.

## 3. Cấu trúc feature (Feature First — lát cắt dọc)

Mỗi `src/features/<feature>/` gồm:

| File | Vai trò |
| --- | --- |
| `model.ts` | type + zod schema + hàm thuần (tính toán, validate) |
| `api.ts` | hàm dạng REST (`list`, `getById`, `create`, `update`, `remove`, thao tác đặc thù) — xem §4 |
| `hooks.ts` | `useQuery`/`useMutation` (TanStack Query) bọc `api.ts` cho UI dùng |
| `components/` | component nhỏ dùng lại trong feature (không phải màn hình đầy đủ) |
| `screens/` | component màn hình đầy đủ (không phải route) |
| `seed.ts` | seed data thật của feature, gọi `registerSeedStep()` (xem §4) |
| `index.ts` | **barrel** — điểm import duy nhất mà feature khác/route được dùng |

- **Không import sâu vào nội bộ feature khác** (`features/x/screens/Y`) — chỉ qua
  `@/features/<x>` (barrel `index.ts`).
- `src/app/**` chỉ chứa route: khai path ở `app/paths.ts`, khai `<Route>` ở `app/routes.tsx` mount
  thẳng `<XxxScreen>` từ `@/features/<x>`. Không đặt business logic ở `app/`.
- Route/menu cấp điều hướng khai thêm ở `shared/layout/nav.tsx` (kèm `resource`/`action` để
  `Sidebar` tự lọc theo quyền — xem §7).

## 4. Lớp dữ liệu "fake API" — bắt buộc, không có ngoại lệ

Không gọi `localStorage` trực tiếp trong component/hook và không nhét mock data tĩnh vào component:

1. Đọc/ghi qua `shared/lib/storage.ts` (`readJson`/`writeJson`, namespace `tbc_admin:*`).
2. Mọi hàm `api.ts` bọc qua `fakeRequest()` (`shared/lib/fakeNetwork.ts`) — giữ chữ ký bất đồng bộ
   giống API thật để sau này thay bằng `fetch` mà không sửa `hooks.ts`/UI.
3. Mọi `create`/`update`/`remove` gọi `appendAudit()` (`shared/lib/audit.ts`) trước khi trả kết
   quả — đây là nguồn dữ liệu **duy nhất** của màn Nhật ký thao tác.
4. Seed data: viết trong `features/<feature>/seed.ts`, đăng ký qua `registerSeedStep()`
   (`shared/fixtures/seedAll.ts`), import theo đúng **thứ tự phụ thuộc dữ liệu** trong
   `shared/fixtures/registerSeeds.ts` (danh mục nền trước — xem `docs/IMPLEMENTATION-PLAN.md` để
   biết thứ tự đã chốt cho từng Phase). Đổi cấu trúc entity đã seed → tăng `SEED_VERSION` trong
   `seedAll.ts`.
5. Không được để `seed.ts` rỗng/giả — dữ liệu mẫu phải đủ để demo luồng chính (xem gợi ý số lượng
   trong `docs/IMPLEMENTATION-PLAN.md` từng Phase).

## 5. State management

- **TanStack Query** cho **mọi dữ liệu nghiệp vụ** (đọc qua `hooks.ts` → `api.ts`). Sau mutation,
  `invalidateQueries` đúng query key liên quan — không tự ý giữ một bản sao dữ liệu nghiệp vụ trong
  Zustand ("mock DB" kiểu app nhân viên KHÔNG áp dụng ở web admin, vì `localStorage` qua
  `storage.ts` đã là nguồn sự thật).
- **Zustand** chỉ cho state phiên/UI: session đăng nhập (`features/auth/store.ts`), tuỳ chọn hiển
  thị (chế độ xem lịch đã chọn, sidebar mở/đóng…). Dùng `persist` khi cần giữ qua reload.

## 6. Phân quyền

- Luôn qua `usePermission()` (`features/auth`) + ma trận `shared/domain/permissions.ts`. **Không
  bao giờ** viết `if (role === 'MANAGER')` rải rác trong component.
- Thiếu entry cho một `resource`/`action` cần dùng → thêm vào `permissions.ts` theo đúng format
  hiện có (field `source` trích `WebappQuanTri.md §...`; nếu tài liệu không có dòng rõ ràng, ghi
  `"BA đề xuất — <lý do>"` thay vì bịa mà không chú thích).
- Ô `TBD` trong tài liệu → giữ nguyên giá trị `'TBD'` trong `permissions.ts` (không tự chốt
  `true`/`false`). `can()` coi `TBD` như chưa được cấp — hành vi này không được đổi mà không hỏi.

## 7. Form & validate

- `react-hook-form` + `zod`, schema đặt trong `model.ts` của feature.
- Thông báo lỗi tiếng Việt; trích mã business rule khi hữu ích (`"Vượt quá Allowed KM (BR-016)"`).

## 8. UI & styling

- Chỉ dùng component trong `shared/ui/*` (shadcn/Radix) — không cài thêm thư viện UI khác song
  song. Thiếu component nào thì thêm theo đúng pattern shadcn hiện có trong `shared/ui/`.
- Màu/khoảng cách/bo góc lấy từ theme token (`index.css` `@theme`, class Tailwind như
  `bg-primary`, `text-status-pending`…) — không hardcode mã hex ngoài `index.css`.
- Dùng `cn()` (`shared/lib/cn.ts`) khi ghép className có điều kiện, không nối chuỗi thủ công.
- Responsive bắt buộc: layout không vỡ ở ~375px (điện thoại) và ~768px (tablet). Chỉ bảng dữ liệu
  được cuộn ngang riêng (`overflow-x-auto`), không để cả trang cuộn ngang. Xem gotcha Topbar ở
  `docs/ARCHITECTURE.md` §6 (flex item cần `min-w-0` mới `truncate` đúng).
- Trang/route mới luôn có `PageHeader` (tiêu đề + mô tả + action) và trạng thái rỗng hợp lý (không
  để trắng trơn khi chưa có dữ liệu).

## 9. Lint & typecheck — cổng bắt buộc

- `npx tsc -b` và `npx oxlint` phải sạch (không thêm warning/error mới) trước khi báo một task là
  xong.
- Chưa có test runner. Khi thêm (giai đoạn sau): ưu tiên unit test cho hàm thuần trong `model.ts`
  (tính giá, tính phụ phí, kiểm tra trùng lịch…) vì đó là nơi dễ lệch khỏi tài liệu nghiệp vụ nhất.

## 10. Trích dẫn tài liệu trong code

- Hằng số/logic bám một business rule cụ thể → comment 1 dòng trỏ mã: `// BR-016 — Price Per KM
  theo Vehicle Class`.
- Khi UI/logic phụ thuộc một Open Question chưa chốt → `// TODO(OQ: <mục/mã>) — <mô tả>`, không tự
  suy diễn hành vi cuối cùng (xem `CLAUDE.md` §2).

## 11. Một lỗi cú pháp đã gặp — tránh lặp lại

**Không để chuỗi `*/` xuất hiện bên trong một block comment `/** ... */`** (kể cả trong ví dụ
đường dẫn kiểu `features/*/api.ts`) — TypeScript đóng comment ngay tại đó, gây lỗi "Unterminated
template literal" ở một dòng hoàn toàn khác, rất khó dò. Luôn viết `features/<feature>/api.ts`
thay vì dùng `*` làm wildcard trong comment. Kiểm nhanh sau khi viết comment dài:
`grep -rn '\*/[a-zA-Z]' src/`.

## 12. Commit (khi repo đã init git)

- Conventional Commits, tiếng Việt được phép trong phần mô tả. Kèm mã requirement/Phase khi liên
  quan, ví dụ: `feat(vehicles): dựng Vehicle Detail nhiều tab (Phase 1, VM §12)`.
- Không commit trừ khi được yêu cầu rõ ràng (xem ranh giới của từng agent trong
  `.claude/agents/`).
