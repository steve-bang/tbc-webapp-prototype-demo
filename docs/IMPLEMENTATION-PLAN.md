# Kế hoạch thực hiện (backlog sống)

Nguồn kế hoạch gốc: session lập kế hoạch ban đầu (xem lịch sử trò chuyện) — bám sát
`../thien-bao-car-docs/WebappQuanTri.md` §5.4 (7 nhóm nghiệp vụ + nền tảng). File này là
**backlog sống**: agent `tech-lead` cập nhật khi giao/nhận task, agent `dev` đánh dấu khi
hoàn thành một mục. Không xoá mục đã "DONE" — chỉ tick, để giữ lịch sử tiến độ.

Quy ước trạng thái: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong (đã qua `tsc -b` + `oxlint` +
kiểm tra trình duyệt).

---

## Phase 0 — Scaffold nền tảng — `[x]` DONE

- [x] Vite + React 18 + TypeScript strict, Tailwind v4 + shadcn/ui (Radix), path alias `@/*`.
- [x] Theme tokens (brand green `#0B6B3A`, status colors) — light/dark qua CSS variables.
- [x] `shared/lib`: `storage.ts`, `fakeNetwork.ts`, `id.ts`, `money.ts`, `datetime.ts`, `audit.ts`.
- [x] `shared/domain`: `enums.ts` (toàn bộ enum nghiệp vụ), `permissions.ts` (ma trận Role×Resource×Action).
- [x] `shared/i18n/vi.ts` khung (common, nav, auth, label map theo enum) — sẽ mở rộng dần theo feature.
- [x] `shared/ui/*`: button, input, label, card, badge, separator, avatar, dropdown-menu, tabs, table,
      dialog, sheet, select, textarea, switch, scroll-area, tooltip, popover, checkbox, sonner.
- [x] `shared/layout`: `AppShell`, `Sidebar` (lọc theo quyền), `Topbar` (đổi vai trò nhanh + reset demo
      data), `PageHeader`, `ComingSoon`.
- [x] `features/auth`: tài khoản demo theo vai trò, session store (Zustand + persist), `usePermission()`.
- [x] `app/paths.ts`, `app/routes.tsx` — toàn bộ route cấp điều hướng đã khai báo (đang là `ComingSoon`).
- [x] `shared/fixtures`: `seedAll.ts` (registry + version), `resetDemoData.ts`, `registerSeeds.ts` (rỗng,
      chờ Phase 1+ điền theo đúng thứ tự phụ thuộc).
- [x] `CLAUDE.md`, `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, file này.

## Phase 1 — Danh mục nền: Xe, Bảo dưỡng, Khách hàng, Nhân viên — `[ ]`

**Thứ tự seed bắt buộc**: `employees` → `customers` → `vehicles` (+ `maintenance`) — vì Vehicle
Detail tham chiếu chủ xe/nhân viên ở các tab sau này; nếu chưa làm Consignment (Phase 5) thì tab
Owner/Consignment tạm ẩn.

- [x] `features/employees`: model (Employee, UserAccount liên kết) · api/hooks/seed (8 nhân viên,
      đủ vai trò `WebappQuanTri.md` §3) · màn **Hồ sơ nhân viên** (list + tạo/sửa qua Sheet, trạng thái
      `ACTIVE/INACTIVE/SUSPENDED`). Kế hoạch chi tiết ở
      [`docs/EMPLOYEE-MANAGEMENT-PLAN.md`](EMPLOYEE-MANAGEMENT-PLAN.md) (`APPROVED` 14/09/2026).
      **Xong 14/09/2026** — review vòng 2 đạt: 2 blocker đã sửa (bỏ 6 khoá `--spacing-<tên>` trong
      `src/index.css` để `max-w-*` trả về thang `--container-*`, xem `docs/ARCHITECTURE.md` §6;
      `unlockAccount()` chặn nhân viên không `ACTIVE` theo `EA-BR-02`), `CHANGE_ROLE`/`LOCK_ACCOUNT`
      thu `reason` bắt buộc qua `EmployeeReasonDialog` (`UC-EA-20` §24.3), `EA-BR-04` guard trong
      `api.update`. Nợ nhỏ chuyển task sau: bỏ khoá i18n chết `vi.employees.lockReasonPrompt`;
      khi dựng `features/audit` phải bổ sung nhãn cho 7 audit action mới trong `enums.ts`.
- [x] `features/customers`: kế hoạch chi tiết đầy đủ (tách 2 round: List rồi Detail; data model,
      business rule, responsive, seed, Definition of Done riêng từng round) ở
      [`docs/CUSTOMER-MANAGEMENT-PLAN.md`](CUSTOMER-MANAGEMENT-PLAN.md). **Round 1 (List) xong
      14/09/2026** — model/api/hooks/seed (9 khách) + `CustomerListScreen` đúng §2-§9. **Round 2
      (Detail) xong 14/09/2026** — review đạt ngay vòng 1: `CustomerDetailScreen` (`/customers/:id`,
      6 tab đúng §6.2, tab Tín nhiệm không số liệu giả) + `CustomerDocument` CRUD (`addDocument`/
      `updateDocument`/`removeDocument`, 3 audit action nối cuối `AUDIT_ACTIONS`) +
      `documentExpiryStatus()` (ngưỡng 30 ngày, seed dùng offset ngày động — không hardcode ngày hết
      hạn cứng); cả 3 nợ nhỏ Round 1 đã xử lý (`blockReasonSchema` dùng trong `CustomerReasonDialog`,
      comment `CM-R03`/`AC-CM-007`/`RM §41 Case 2` tại `canBlock`, thống nhất nhãn `noValue`).
      `tsc -b`/`oxlint`/`build` sạch cả 2 round.
- [~] `features/vehicles`: kế hoạch chi tiết đầy đủ cho **Round 1 (Vehicle List)** ở
      [`docs/VEHICLE-MANAGEMENT-PLAN.md`](VEHICLE-MANAGEMENT-PLAN.md). **Round 1 xong 14/09/2026** —
      review `tech-lead` đạt ngay vòng 1 (không Blocker): model `Vehicle`/`VehicleDocument` đúng §2,
      hàm dùng chung `documentExpiryStatus()` tách ra `shared/lib/documentStatus.ts` (refactor
      `features/customers/model.ts` theo, giữ nguyên chữ ký public, hành vi không đổi), api/hooks đầy
      đủ audit (5 action mới `CREATE_VEHICLE`/`UPDATE_VEHICLE`/`CHANGE_VEHICLE_STATUS`/
      `ADD_VEHICLE_DOCUMENT`/`UPDATE_VEHICLE_DOCUMENT`, không có `remove()`/xoá document — `VM-RULE-005`
      + BRD §16.1), seed 18 xe (16 `CONSIGNED`/2 `OWNED`, đủ 3 `Vehicle Class`, 2 `bankFinanced` có
      `MORTGAGE_RECEIPT` hợp lệ, hạn giấy tờ `EXPIRING_SOON`/`EXPIRED` tính động theo ngày),
      `VehicleListScreen` (tìm kiếm/4 bộ lọc/tạo-sửa qua Sheet/đổi trạng thái qua Dialog riêng —
      đúng §5.2/`AC-VM-006` — /`VehicleDocumentsDialog` CRUD giấy tờ tái dùng được cho Round 2),
      responsive 375/768/desktop. **Round 2 (Vehicle Detail 12 tab) đã lên kế hoạch chi tiết đầy đủ ở
      §8 cùng file, trạng thái `APPROVED`** (14/09/2026, chủ dự án duyệt, đã giao `dev`) — sau
      `features/maintenance` đã xong
      đúng thứ tự `docs/PAGE-IMPLEMENTATION-PRIORITY.md`. Cấu trúc: `CustomerDetailScreen.tsx` làm
      mẫu bắt buộc; 12 tab (Tổng quan/Chủ xe & Ký gửi (điều kiện `ownershipType=CONSIGNED`)/Giấy
      tờ/Hiện trạng xe/Bảo dưỡng/Phạt nguội/Lịch sử thuê/Giao-nhận/Doanh thu/Chi phí/Lợi nhuận/Nhật
      ký thao tác) — gộp 2 tab "Chủ xe" + "Hợp đồng ký gửi" của BRD thành 1 (module `VehicleConsignment`
      chưa build). Hầu hết tab còn lại (Lịch sử thuê, Giao-nhận, Phạt nguội, Doanh thu/Chi phí/Lợi
      nhuận) dùng `VehicleDetailPlaceholder` vì module nguồn (`RM`/`VH`/`VR`/`TF`/`RV`) chưa tới lượt
      Phase 1. **Không cần Vehicle API/hooks/permissions/audit-action mới** — `useVehicle(id)` đã có
      sẵn từ Round 1. Việc code chính: tách `VehicleDocumentsList` khỏi `VehicleDocumentsDialog` (tái
      dùng ở tab Giấy tờ), `VehicleMaintenanceTab` mới (cross-import hooks có sẵn của
      `features/maintenance`), `VehicleDetailScreen` mới, mount route `/vehicles/:id`. Đã giao `dev`
      implement.
- [x] `features/maintenance`: hoàn thành 14/09/2026 — kế hoạch chi tiết ở
      [`docs/MAINTENANCE-MANAGEMENT-PLAN.md`](MAINTENANCE-MANAGEMENT-PLAN.md) (`DONE`). Đúng phạm
      vi: 3 entity độc lập `MaintenanceRule`/`MaintenanceRecord`/`SparePartRecord`, **không dựng
      logic Deduction/khấu trừ** (`MT-BR-09`/BRD §11 đã bị CR-2026-050 bãi bỏ), 4 audit action mới,
      Rule vô hiệu hoá thay vì xoá, Record/SparePart append-only, seed đủ 3 trạng thái
      `OK`/`DUE_SOON`/`OVERDUE` tính động. Qua review `tech-lead` đạt ngay vòng 1, không Blocker.
      Chi tiết đầy đủ ở `CHANGELOG.md` 2026-09-14.
- [x] Cập nhật `shared/fixtures/registerSeeds.ts` theo đúng thứ tự trên — mỗi feature tự thêm
      import khi implement, đã đúng thứ tự `employees → customers → vehicles → maintenance`.
- [x] Xoá `ComingSoon` cho các route đã xong trong `app/routes.tsx` — `/employees`, `/customers`,
      `/customers/:id`, `/vehicles`, `/maintenance` đều đã mount screen thật. Còn lại `ComingSoon`
      hợp lệ: `/employees/:id` + `/vehicles/:id` (Detail, chưa tới lượt) và mọi route Phase 2+.

## Phase 2 — Lịch & lượt thuê (lõi nghiệp vụ) — `[ ]`

- [ ] `features/calendar` (RC): Day / **Week (mặc định)** / Month (lưới xe × ngày, màu theo trạng thái
      lượt thuê) / Agenda; tạo nhanh lượt thuê từ ô trống; **Vehicle Block** tạo/gỡ trực tiếp trên Month.
- [ ] Bảng điều phối trong ngày (dispatch board, trong `calendar` hoặc feature riêng nếu tách rõ hơn):
      danh sách giao/nhận hôm nay, lượt sắp đến hạn, quá hạn trả; phân công nhân viên ngay trên bảng.
- [ ] `features/rentals` (RM — hub trung tâm): model (Rental — 12-state lifecycle) · api/hooks/seed
      (lượt thuê trải đủ vòng đời, có lượt hôm nay để Dashboard/dispatch board có dữ liệu) · **Danh sách
      lượt thuê** (lọc trạng thái/khách/xe/khoảng ngày) · **Tạo lượt thuê** (chọn khách→xe→thời gian→kiểm
      tra khả dụng, chặn trùng lịch theo `BR-001`) · **Rental Detail** (giá snapshot, cọc, phát sinh,
      trạng thái thanh toán placeholder, assignment, hợp đồng liên kết, lịch sử trạng thái).
- [ ] `features/employees`: bổ sung **Assignment** (`ASSIGNED→IN_PROGRESS→DONE`), gán Delivery/Receiving
      Staff, phát hiện trùng lịch nhân viên.
- [ ] `features/contracts` (CT): model (Contract, ContractAddendum) · api/hooks/seed · **Danh sách hợp
      đồng** + **Contract Detail** (preview placeholder, nút "Xuất PDF" giả lập, phụ lục).
- [ ] Nối `Rental History` ở Vehicle Detail và Customer Detail vào dữ liệu thật.
- [ ] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng.

## Phase 3 — Giao/nhận xe & sự cố — `[ ]`

- [ ] `features/handover-return` (VH/VR): model (HandoverRecord, ReturnRecord — placeholder ảnh) ·
      màn **Theo dõi giao/nhận** (trạng thái từng lượt) + **Biên bản** (đối chiếu trước/sau, odo/fuel/
      checklist).
- [ ] `features/incidents` (DI): model (Incident — lifecycle `OPEN→...→CLOSED`) · api/hooks/seed (vài sự
      cố đủ mức độ) · **Hồ sơ sự cố** (lifecycle stepper, `Liability`, chi phí ước tính/thực tế/khách chịu).
- [ ] Nối Vehicle Condition Timeline (tab Vehicle Detail) vào dữ liệu Handover/Return/Incident thật.
- [ ] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng.

## Phase 4 — Tài chính — `[ ]`

- [ ] `features/finance` (RS/PM/RV): model (Settlement, Transaction, CostRecord, RevenueLine) ·
      **Quyết toán** (worksheet: tổng hợp khoản, đối trừ cọc, `Final Amount`, đóng lượt) · **Sổ giao dịch**
      (danh sách, thêm giao dịch thủ công) · **Quỹ tiền mặt** (tổng nộp/đối soát đơn giản) · **Công nợ
      khách hàng** · **Báo cáo tài chính** (tổng quan theo kỳ + drill-down theo xe, biểu đồ `recharts`).
- [ ] Nối 3 tab Revenue/Cost/Profit ở Vehicle Detail vào dữ liệu thật.
- [ ] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng.

## Phase 5 — Xe ký gửi — `[ ]`

- [ ] `features/consignment` (VC): model (VehicleOwner, ConsignmentContract `FIXED_MONTHLY`,
      OwnerPayoutRecord) · **Hồ sơ chủ xe** · **Hợp đồng ký gửi** · **Lịch chi trả hàng tháng** (đánh dấu
      `SCHEDULED`/`PAID`).
- [ ] Nối tab Owner/Consignment ở Vehicle Detail vào dữ liệu thật.
- [ ] Khoản chi trả chủ xe phản ánh đúng vào `finance` (Cost Record `CONSIGNMENT_PAYOUT`, không tính lợi
      nhuận công ty — CR-2026-050).
- [ ] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng.

## Phase 6 — Hoàn thiện nền tảng & polish — `[ ]`

- [ ] **Dashboard** thật: KPI vận hành + tài chính, cảnh báo (đăng kiểm/bảo hiểm sắp hết hạn, lượt sắp
      giao/nhận, quá hạn trả, payment quá hạn, sự cố chưa xử lý, bảo dưỡng đến hạn, ký gửi sắp đến hạn) —
      tính từ dữ liệu các feature đã seed, không phải số tĩnh.
- [ ] **Cấu hình hệ thống**: thông tin công ty (placeholder), nút Reset dữ liệu demo (đã có ở Topbar,
      thêm bản sao ở đây cho rõ ràng theo `WebappQuanTri.md` §5.4).
- [ ] **Vai trò & quyền**: hiển thị bảng từ `listPermissionMatrix()` — bao gồm cả ô `TBD` với chú thích
      nguồn, để BA/khách thấy rõ đâu là quyết định đã chốt, đâu là Open Question.
- [ ] **Nhật ký thao tác**: đọc `listAuditRecords()`, lọc theo entity/action/người thực hiện.
- [ ] **Trung tâm thông báo**: sinh `NotificationEvent` từ các cảnh báo ở Dashboard (không cần kênh gửi
      thật — Phase 1 tài liệu cũng chỉ yêu cầu `IN_APP_WEBAPP`).
- [ ] Rà responsive toàn bộ màn hình chính ở ~375px và ~768px.
- [ ] Rà lại `shared/i18n/vi.ts` — không còn chuỗi tiếng Việt hardcode rải rác trong component.
- [ ] Viết lại `README.md` (hiện vẫn là README mặc định của Vite) — cách chạy, cách reset dữ liệu demo,
      cách thêm một feature mới theo pattern.
