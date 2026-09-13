# Kế hoạch ưu tiên implement theo từng page

> Tài liệu bổ trợ cho [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) — **không thay thế**. Backlog
> gốc theo phase vẫn là nguồn thẩm quyền cao nhất (xem `CLAUDE.md` §1). File này diễn giải backlog đó
> thành danh sách ưu tiên theo **từng page cụ thể**, vì backlog gốc viết theo nhóm feature. Khi hai tài
> liệu lệch nhau (vd. sau khi một phase được thực hiện xong), cập nhật lại file này theo
> `IMPLEMENTATION-PLAN.md`, không theo chiều ngược lại.

## Bối cảnh

Phase 0 (scaffold) đã DONE: layout, fake-API layer, ma trận phân quyền, i18n khung, toàn bộ ~27 route
đã khai báo ở `src/app/routes.tsx` nhưng đều đang render `<ComingSoon>` (trừ màn Login). Chưa có feature
nghiệp vụ nào được implement. Mục tiêu file này: cho biết **page nào làm trước, page nào làm sau, và vì
sao**, ở mức chi tiết đủ để bắt tay vào việc mà không đoán phạm vi.

**Quy ước độ chi tiết**: Phase 1 (việc ngay tiếp theo) được tách chi tiết tới từng page + checklist.
Phase 2–6 chỉ liệt kê ở mức page + lý do thứ tự — sẽ chi tiết hoá khi tới lượt làm (đọc lại BRD tương
ứng lúc đó, đừng dùng lại checklist cũ nếu tài liệu đã đổi).

---

## Bảng ưu tiên tổng thể (toàn bộ page)

| Ưu tiên | Phase | Page | Route |
| --- | --- | --- | --- |
| **P1.1** | 1 | Hồ sơ nhân viên (list) | `/employees` |
| **P1.2** | 1 | Danh sách khách hàng | `/customers` |
| **P1.3** | 1 | Chi tiết khách hàng | `/customers/:id` |
| **P1.4** | 1 | Danh sách xe | `/vehicles` |
| **P1.5** | 1 | Bảo dưỡng & phụ tùng | `/maintenance` |
| **P1.6** | 1 | Chi tiết xe (nhiều tab) | `/vehicles/:id` |
| P2.1 | 2 | Lịch cho thuê (Day/Week/Month/Agenda) | `/calendar` |
| P2.2 | 2 | Bảng điều phối trong ngày | `/schedule/dispatch` |
| P2.3 | 2 | Danh sách lượt thuê | `/rentals` |
| P2.4 | 2 | Chi tiết lượt thuê | `/rentals/:id` |
| P2.5 | 2 | Hợp đồng (list) | `/contracts` |
| P2.6 | 2 | Chi tiết hợp đồng | `/contracts/:id` |
| P3.1 | 3 | Theo dõi giao/nhận xe | `/handover-return` |
| P3.2 | 3 | Hồ sơ sự cố (list) | `/incidents` |
| P3.3 | 3 | Chi tiết sự cố | `/incidents/:id` |
| P4.1 | 4 | Quyết toán (Settlement) | `/finance/settlement` |
| P4.2 | 4 | Sổ giao dịch | `/finance/transactions` |
| P4.3 | 4 | Quỹ tiền mặt | `/finance/cash-drawer` |
| P4.4 | 4 | Công nợ khách hàng | `/finance/receivables` |
| P4.5 | 4 | Báo cáo tài chính | `/finance/reports` |
| P5.1 | 5 | Hồ sơ chủ xe | `/consignment/owners` |
| P5.2 | 5 | Hợp đồng ký gửi | `/consignment/contracts` |
| P5.3 | 5 | Lịch chi trả hàng tháng | `/consignment/payouts` |
| P6.1 | 6 | Dashboard (KPI + cảnh báo thật) | `/dashboard` |
| P6.2 | 6 | Cấu hình hệ thống | `/platform/system-config` |
| P6.3 | 6 | Vai trò & quyền | `/platform/permissions` |
| P6.4 | 6 | Nhật ký thao tác | `/platform/audit` |
| P6.5 | 6 | Trung tâm thông báo | `/platform/notifications` |

Lý do thứ tự phase (đã chốt sẵn trong `IMPLEMENTATION-PLAN.md`, không đổi ở đây): danh mục nền (1) →
lõi vận hành lịch/lượt thuê (2) → giao nhận/sự cố phát sinh từ lượt thuê (3) → tài chính cần dữ liệu
lượt thuê+sự cố để tính (4) → ký gửi nối vào tài chính (5) → dashboard/nền tảng cần MỌI feature đã có
dữ liệu để tổng hợp KPI thật, không phải số tĩnh (6).

---

## Phase 1 — chi tiết thứ tự & checklist từng page (việc làm ngay)

**Thứ tự build**: Employee list → Customer list → Customer Detail → Vehicle list → Maintenance list →
Vehicle Detail. Lý do: đúng thứ tự seed bắt buộc (employees→customers→vehicles+maintenance) trong
`IMPLEMENTATION-PLAN.md`; Maintenance làm trước Vehicle Detail để tab Maintenance+SpareParts được nối
dữ liệu thật ngay thay vì phải sửa lại; Vehicle Detail để cuối vì effort cao nhất và cần mọi feature kia
có sẵn để không phải stub quá nhiều tab.

1. **Employee list** (`/employees`) — `features/employees`: model `Employee{fullName, phone, role,
   status: EMPLOYEE_STATUSES, linkedUserId}`, seed 6–8 nhân viên đủ vai trò. **Lưu ý quan trọng**: 6 tài
   khoản demo đã có sẵn ở `src/features/auth/model.ts` (`DEMO_ACCOUNTS`, mỗi role 1 tài khoản) — seed
   Employee nên **liên kết `linkedUserId` với các `DEMO_ACCOUNTS` này** thay vì tạo role rời rạc, tránh
   lệch dữ liệu giữa hai nơi. List + tìm kiếm tên/SĐT + lọc trạng thái + tạo/sửa qua Sheet. **Không** làm
   Employee Detail (`/employees/:id`) ở Phase 1 — backlog chỉ yêu cầu list; giữ route này `ComingSoon`
   cho tới khi có yêu cầu rõ ràng (ghi `TODO(OQ)` nếu cần).
2. **Customer list** (`/customers`) — `features/customers`: model `Customer{fullName, phone, idNumber,
   address, status: CUSTOMER_STATUSES}`, seed 8–10 khách, ≥1 `BLOCKED`. Tìm kiếm tên/SĐT/CCCD, lọc trạng
   thái, tạo/sửa qua Sheet, hành động **Khoá khách** (đổi status + `appendAudit()`).
3. **Customer Detail** (`/customers/:id`): tab giấy tờ (thật, chỉ metadata — không lưu file), tab lịch sử
   thuê/thanh toán-công nợ/sự cố = **placeholder** (chờ Phase 2/4/3). Tab "tín nhiệm" — **open question,
   cần BA/tài liệu xác nhận công thức** trước khi build, đừng tự bịa.
4. **Vehicle list** (`/vehicles`) — `features/vehicles`: model `Vehicle{plate, brand, vehicleClass,
   ownershipType, status, currentKm, registrationExpiry, insuranceExpiry}` + `VehicleDocument`, seed
   15–20 xe (~90% `CONSIGNED`), ≥1 xe sắp hết hạn đăng kiểm để demo cảnh báo Dashboard ở Phase 6. Tìm
   kiếm biển số/hãng, lọc trạng thái/hãng/Vehicle Class/Ownership. Form tạo/sửa xe + form tạo/sửa giấy
   tờ xe riêng. **Viết hàm thuần tính trạng thái hạn giấy tờ (`VALID/EXPIRING_SOON/EXPIRED`, CR-2026-046)
   trong `vehicles/model.ts`** — Dashboard (Phase 6) sẽ tái dùng hàm này, không viết lại.
5. **Maintenance list** (`/maintenance`) — `features/maintenance`: model `MaintenanceRule/Record/
   SparePartRecord`. Danh sách toàn đội xe, lọc theo xe, "đến hạn" = so `Next Due KM` với
   `Vehicle.currentKm` (field này phải đã có sẵn từ bước 4).
6. **Vehicle Detail** (`/vehicles/:id`) — nhiều tab, page nặng nhất Phase 1:
   - **Nối dữ liệu thật**: Overview, Documents, Maintenance+SpareParts, Activity History (đọc
     `listAuditRecords()` lọc theo entity xe).
   - **Thật nhưng có thể rỗng**: Vehicle Condition (chờ `ConditionEvent` từ Phase 3, hiển thị rỗng hợp lệ
     là đủ, không giả dữ liệu).
   - **Giữ nguyên placeholder** (đúng theo backlog, chưa tới lượt): Traffic Fines, Rental History
     (Phase 2), Delivery/Pickup (Phase 2/3), Revenue/Cost/Profit ×3 (Phase 4). Tab Owner/Consignment chỉ
     hiện khung "chờ Phase 5" khi `ownershipType = CONSIGNED`.
   - Lưu ý: **Traffic Fines chưa có phase sở hữu rõ trong backlog 7-phase** — khi build tới đây, gắn cờ
     hỏi lại BA thay vì tự quyết định thuộc phase nào.

Sau khi xong từng feature: cập nhật `shared/fixtures/registerSeeds.ts` (hiện đang rỗng — import
`seed.ts` theo đúng thứ tự trên) và xoá `<ComingSoon>` tương ứng trong `src/app/routes.tsx`.

---

## Phase 2–6 — tóm tắt page & lý do thứ tự (chưa build ngay, tham khảo khi tới lượt)

- **Phase 2 (Lịch & lượt thuê)**: Calendar (RC, Week là view mặc định, tạo nhanh lượt thuê từ ô trống +
  Vehicle Block) → Dispatch board (cần Calendar/Rental có dữ liệu hôm nay) → Rentals list/detail (hub
  trung tâm, 12-state lifecycle, chặn trùng lịch BR-001) → Contracts list/detail (phát sinh từ Rental đã
  ký). Sau đó nối Rental History thật vào Vehicle/Customer Detail đã build ở Phase 1.
- **Phase 3 (Giao/nhận & sự cố)**: Handover/Return tracking → Incidents list/detail (lifecycle
  OPEN→CLOSED). Cả hai phát sinh từ Rental (Phase 2) nên phải làm sau. Nối Vehicle Condition Timeline
  thật vào Vehicle Detail.
- **Phase 4 (Tài chính)**: Settlement (worksheet đóng lượt) → Transactions ledger → Cash Drawer →
  Receivables → Reports (recharts). Cần Rental (giá/cọc) + Incident (chi phí sự cố) làm nguồn số liệu nên
  phải sau Phase 2–3. Nối 3 tab Revenue/Cost/Profit ở Vehicle Detail.
- **Phase 5 (Ký gửi)**: Owners → Consignment Contracts (`FIXED_MONTHLY`) → Payout schedule. Khoản chi trả
  phải phản ánh vào Finance như Cost Record `CONSIGNMENT_PAYOUT` (CR-2026-050, không chia % lợi nhuận) —
  nên bắt buộc sau Phase 4. Nối tab Owner/Consignment ở Vehicle Detail.
- **Phase 6 (Hoàn thiện nền)**: Dashboard thật (KPI + cảnh báo tính từ dữ liệu mọi feature đã seed, tái
  dùng hàm tính hạn giấy tờ từ Phase 1) → System Config → Permissions matrix viewer (hiện cả ô `TBD`) →
  Audit Log viewer → Notification Center (sinh từ cảnh báo Dashboard). Đây là lý do Dashboard/Platform
  luôn ở cuối: cần toàn bộ feature khác có dữ liệu thật để tổng hợp, không phải số tĩnh giả.

---

## Pattern implement mỗi page (bắt buộc theo `CONVENTIONS.md`)

Mỗi feature mới (`src/features/<feature>/`) gồm: `model.ts` (type + zod + hàm thuần), `api.ts`
(CRUD bọc `fakeRequest()`), `hooks.ts` (TanStack Query, `invalidateQueries` sau mutation), `components/`,
`screens/`, `seed.ts` (gọi `registerSeedStep()`), `index.ts` (barrel — điểm import duy nhất). Không
`localStorage` trực tiếp, không mock tĩnh trong component. Mọi create/update/remove gọi `appendAudit()`.
Phân quyền luôn qua `usePermission()` + `shared/domain/permissions.ts` (không `if (role === ...)` rải
rác). Mỗi page mới có `PageHeader` + trạng thái rỗng hợp lý, responsive ở ~375px/~768px.

## Kiểm thử khi xong mỗi page

1. `npx tsc -b` và `npx oxlint` sạch, không thêm warning/error mới.
2. Chạy `npm run dev`, thao tác thật trên trình duyệt: tạo/sửa/lọc/tìm kiếm, kiểm tra trạng thái rỗng.
3. Dùng dropdown đổi vai trò ở Topbar để xác nhận sidebar/nút hành động ẩn hiện đúng theo
   `permissions.ts` cho từng role liên quan đến page đó.
4. Xoá `ComingSoon` cho route tương ứng trong `src/app/routes.tsx`, cập nhật `registerSeeds.ts`, tick
   `[x]` mục tương ứng trong `IMPLEMENTATION-PLAN.md` (không xoá lịch sử `[x]` cũ).
