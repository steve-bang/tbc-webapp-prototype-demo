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
- [~] `features/customers`: kế hoạch chi tiết đầy đủ (tách 2 round: List rồi Detail; data model,
      business rule, responsive, seed, Definition of Done riêng từng round) ở
      [`docs/CUSTOMER-MANAGEMENT-PLAN.md`](CUSTOMER-MANAGEMENT-PLAN.md), trạng thái `APPROVED`
      (14/09/2026) — **đang giao `dev` implement Round 1 (List)**.
- [ ] `features/vehicles`: model (Vehicle, VehicleDocument, ConditionEvent) · api/hooks/seed (15–20 xe,
      tỉ lệ `CONSIGNED` ~90%, đủ trạng thái, ít nhất 1 xe sắp hết hạn đăng kiểm để demo cảnh báo Dashboard
      ở Phase 6) · màn **Danh sách xe** (tìm kiếm biển số/hãng, lọc trạng thái/hãng/Vehicle Class/Ownership) ·
      **Tạo/sửa xe** + **Tạo/sửa giấy tờ xe** · **Vehicle Detail** nhiều tab: Overview, Documents, Vehicle
      Condition (đọc từ `ConditionEvent`, có thể rỗng ở phase này), Maintenance+SpareParts, Traffic Fines
      (placeholder), Rental History (placeholder — chờ Phase 2), Delivery/Pickup (placeholder), Revenue/
      Cost/Profit ×3 (placeholder — chờ Phase 4), Activity History (đọc từ Audit thật). Tab
      **Owner/Consignment** chỉ hiện khung rỗng "chờ Phase 5" khi `OwnershipType = CONSIGNED`.
- [ ] `features/maintenance`: model (MaintenanceRule, MaintenanceRecord, SparePartRecord) · api/hooks/seed ·
      màn **Bảo dưỡng & phụ tùng** (danh sách toàn đội xe, lọc theo xe, "đến hạn" dựa `Next Due KM` vs
      `Current KM`).
- [ ] Cập nhật `shared/fixtures/registerSeeds.ts` theo đúng thứ tự trên.
- [ ] Xoá `ComingSoon` cho các route đã xong trong `app/routes.tsx`.

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
