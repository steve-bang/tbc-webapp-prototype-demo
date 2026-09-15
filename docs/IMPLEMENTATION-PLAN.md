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

## Phase 1 — Danh mục nền: Xe, Bảo dưỡng, Khách hàng, Nhân viên — `[x]`

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
- [x] `features/vehicles`: **hoàn thành cả 2 round**, kế hoạch đầy đủ ở
      [`docs/VEHICLE-MANAGEMENT-PLAN.md`](VEHICLE-MANAGEMENT-PLAN.md) (`DONE`). **Round 1 (List,
      xong 14/09/2026)**: model `Vehicle`/`VehicleDocument` đúng §2, hàm dùng chung
      `documentExpiryStatus()` tách ra `shared/lib/documentStatus.ts` (refactor
      `features/customers/model.ts` theo, hành vi không đổi), api/hooks đầy đủ audit (5 action mới
      `CREATE_VEHICLE`/`UPDATE_VEHICLE`/`CHANGE_VEHICLE_STATUS`/`ADD_VEHICLE_DOCUMENT`/
      `UPDATE_VEHICLE_DOCUMENT`, không có `remove()`/xoá document — `VM-RULE-005` + BRD §16.1), seed
      18 xe (16 `CONSIGNED`/2 `OWNED`, đủ 3 `Vehicle Class`), `VehicleListScreen` (tìm kiếm/4 bộ
      lọc/tạo-sửa qua Sheet/đổi trạng thái qua `VehicleStatusDialog` riêng — §5.2/`AC-VM-006` —
      /`VehicleDocumentsDialog` CRUD giấy tờ), responsive 375/768/desktop. **Round 2 (Detail,
      `/vehicles/:id`, xong 14/09/2026)**: `VehicleDetailScreen` mirror 1:1 `CustomerDetailScreen`
      (`TabsList` thêm `max-w-full` cục bộ để cuộn ngang 12 tab, không đổi `shared/ui/tabs.tsx`), 12
      tab tối đa đúng §8.3 (tab "Chủ xe & Ký gửi" chỉ khi `ownershipType=CONSIGNED`;
      `VehicleOverviewTab`/`VehicleMaintenanceTab` mới nối dữ liệu thật qua barrel
      `@/features/maintenance`; `VehicleDocumentsList` tách khỏi `VehicleDocumentsDialog` cũ, hành vi
      List không đổi; `VehicleAuditTab` lọc `listAuditRecords()` theo `entity==='Vehicle'`; 3 tab
      Doanh thu/Chi phí/Lợi nhuận tách riêng — `CR-2026-036` — ẩn hẳn khi thiếu `VEHICLE.EXPORT`; còn
      lại `VehicleDetailPlaceholder` chờ module nguồn `RM`/`VH`/`VR`/`TF`/`RV`/`VC`), thêm điều
      hướng List→Detail (mirror `CustomerListScreen`/`CustomerCard`). Không cần Vehicle
      API/hooks/permissions/enum mới ở Round 2. Qua review `tech-lead` đạt ngay vòng 1 cả 2 round,
      **không Blocker lần nào**.
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
      `/customers/:id`, `/vehicles`, `/vehicles/:id`, `/maintenance` đều đã mount screen thật. Còn
      lại `ComingSoon` hợp lệ: `/employees/:id` và mọi route Phase 2+.

## Phase 2 — Lịch & lượt thuê (lõi nghiệp vụ) — `[~]`

**Thứ tự build đã điều chỉnh so với `docs/PAGE-IMPLEMENTATION-PRIORITY.md` (quyết định kỹ thuật của
`tech-lead`, không đổi nội dung nghiệp vụ)**: `features/rentals` (data core + List + Create/Confirm/
Cancel) **trước** `features/calendar`, vì Calendar chỉ là lớp hiển thị trên dữ liệu Rental
(`RentalCalendar-BRD.md` §1.2/§7 — RC không sở hữu dữ liệu riêng) và "tạo nhanh từ ô trống" trên lịch
về bản chất gọi thẳng API tạo Rental — cần dữ liệu lõi tồn tại trước. Chi tiết lý do ở
`docs/RENTAL-MANAGEMENT-PLAN.md` Context.

- [x] `features/rentals` (RM — hub trung tâm): **Round 1 (data core + Rental List +
      Tạo/Xác nhận/Huỷ lượt thuê) hoàn thành**, kế hoạch chi tiết ở
      [`docs/RENTAL-MANAGEMENT-PLAN.md`](RENTAL-MANAGEMENT-PLAN.md) (nay `DONE`). Phát hiện quan
      trọng: **không có module "Bảng giá"** trong toàn bộ 21 module — `Rental Rate` là field nhập tay
      của chính `Rental`, không suy ra từ `Vehicle` (đã xác nhận `vehicles/model.ts` không có field
      giá). Model đầy đủ 12-state lifecycle (`RENTAL_STATUSES` đã scaffold từ Phase 0) nhưng Round 1
      chỉ tự thao tác `DRAFT⇄CONFIRMED⇄CANCELLED` qua UI — các state còn lại (`CONTRACT_CREATED` →
      `COMPLETED`, `NO_SHOW`, `DISPUTED`) chờ module sở hữu (`CT`/`VH`/`VR`/`RS`, Round/Phase sau) nên
      chỉ seed trực tiếp để List hiển thị đủ badge. Chống trùng lịch (`RM-BR-04`) + Turnaround Buffer
      90 phút (`RM-BR-23`/CR-2026-006), snapshot giá/cọc/Allowed KM/Price Per KM theo Vehicle Class
      (CR-2026-008), phí giao/nhận ngoài 10km = 15.000đ/km (CR-2026-062) — đều enforce Round 1. Qua 2
      vòng review `tech-lead`: vòng 1 phát hiện 1 Blocker (`rentalDurationDays()` dùng `Math.round`
      qua `daysBetween()` dùng chung thay vì `Math.ceil` riêng theo §3.1 — tính thiếu 1 ngày tiền thuê
      cho lượt có giờ lẻ), `dev` sửa bằng hàm tính trực tiếp trong `model.ts` (không đụng
      `shared/lib/datetime.ts` dùng chung cho chỗ khác), vòng 2 xác nhận hết Blocker. **Rental Detail**
      (`/rentals/:id`) **cố ý chưa lên kế hoạch chi tiết** — xem `docs/RENTAL-MANAGEMENT-PLAN.md` §8,
      sẽ chi tiết hoá khi tới lượt.
- [x] `features/calendar` (RC): **Round 2 (Week mặc định + Month lưới xe×ngày + Vehicle Block +
      tạo nhanh) hoàn thành**, kế hoạch chi tiết ở
      [`docs/CALENDAR-MANAGEMENT-PLAN.md`](CALENDAR-MANAGEMENT-PLAN.md) (nay `DONE`). Phát hiện quan
      trọng: khu "Chưa xếp xe" mô tả trong `RentalCalendar-BRD.md` **không dựng được** — xung đột
      với `RM-BR-02` (Round 1 đã bắt buộc `vehicleId` lúc tạo Rental), ghi `TODO(OQ)` trong
      `calendar/model.ts` thay vì tự sửa lại Round 1. Qua 1 vòng review `tech-lead`: **không có
      Blocker** (3 cổng `tsc -b`/`oxlint`/`build` sạch, không đụng `rentals/model.ts`/`api.ts`, không
      có khu "Chưa xếp xe"/kéo-thả/dispatch board lọt vào, seed + audit + phân quyền đúng). 4 điểm
      "Nên sửa" ghi nhận cho theo dõi (không chặn, để Round sau hoặc patch nhỏ): (1) màu Rental Block
      trên lưới Week chưa tái dùng `STATUS_VARIANT` như §5.2 dự kiến — chỉ 1 màu cố định + text trạng
      thái; (2) RC-BR-04 ở tạo nhanh dựa vào cảnh báo/chặn cứng có sẵn của `RentalFormSheet` Round 1
      tại bước Xác nhận, không chặn ngay lúc mở form như §5.4 dự kiến — chuỗi i18n
      `vehicleInactiveNotice` hiện chưa được dùng tới; (3) `RentalBlockPopover` trigger (`div
      role="button"`) có `tabIndex` nhưng thiếu `onKeyDown` Enter/Space nên chưa mở được bằng bàn
      phím; (4) `RentalQuickCreateGate.tsx` là hàm thuần (không phải component React) nên cân nhắc
      dời sang `model.ts` cho khớp bảng cấu trúc `CONVENTIONS.md` §3. Đã verify: deep-import
      `RentalStatusBadge` đúng tiền lệ có sẵn (`maintenance/hooks.ts`, `RentalFormSheet.tsx` đều
      deep-import `useVehicles`/`useCustomers` qua `hooks.ts` chứ không qua barrel); route-level
      permission guard (`/calendar` gõ thẳng URL vẫn vào được dù sidebar ẩn link) là lỗ hổng kiến
      trúc **toàn app có từ trước** (không riêng Round 2, không sửa ở review này — cần một mục
      backlog riêng nếu muốn khắc phục). **Round 3 (Day/Agenda view + kéo-thả dời lịch/đổi xe
      UC-RC-06/07)** cố ý chưa lên kế hoạch chi tiết — tách riêng vì rủi ro cao nhất (rollback-on-
      conflict + audit + xác nhận), để không dồn hết vào lần code lưới lịch đầu tiên của dự án.
      **Tạm hoãn theo yêu cầu chủ dự án (15/09/2026)** — chưa có lịch làm lại, xem
      `docs/CALENDAR-MANAGEMENT-PLAN.md` §8.1 khi quay lại.
      **Fix theo phản hồi khách (15/09/2026):** Week view có layout mobile riêng (danh sách theo
      ngày) khiến thiếu lưới xe×ngày ở mobile trong khi Month đã always-on lưới — bỏ hẳn nhánh
      mobile trong `CalendarWeekGrid.tsx`, chỉ còn 1 lưới xe×ngày bọc `overflow-x-auto`, đồng bộ
      Month. Qua 1 vòng review `tech-lead`: không Blocker.
- [ ] Bảng điều phối trong ngày (dispatch board, trong `calendar` — theo `CLAUDE.md` bản đồ module):
      danh sách giao/nhận hôm nay, lượt sắp đến hạn, quá hạn trả; phân công nhân viên ngay trên bảng.
      Roadmap sơ bộ ở `docs/CALENDAR-MANAGEMENT-PLAN.md` §8.2 — cần `Assignment` (`EA`) chưa build.
- [~] `RentalDetailScreen` (`/rentals/:id`): kế hoạch chi tiết đầy đủ ở
      [`docs/RENTAL-MANAGEMENT-PLAN.md`](RENTAL-MANAGEMENT-PLAN.md) §15, trạng thái `PENDING_APPROVAL`
      (15/09/2026) — chờ phê duyệt trước khi giao `dev`. 8 tab: Tổng quan/Giá-cọc-phát sinh (thật,
      không cần API mới — chỉ mở rộng barrel `useRental`/`useConfirmRental`/`useCancelRental`)/Thanh
      toán/Hợp đồng/Giao-nhận/Sự cố/Phân công (placeholder, chờ Phase sau)/Nhật ký thao tác (thật,
      mirror `VehicleAuditTab.tsx`).
- [ ] `features/employees`: bổ sung **Assignment** (`ASSIGNED→IN_PROGRESS→DONE`), gán Delivery/Receiving
      Staff, phát hiện trùng lịch nhân viên — roadmap ở `docs/RENTAL-MANAGEMENT-PLAN.md` §8.4.
- [ ] `features/contracts` (CT): model (Contract, ContractAddendum) · api/hooks/seed · **Danh sách hợp
      đồng** + **Contract Detail** (preview placeholder, nút "Xuất PDF" giả lập, phụ lục) — roadmap ở
      `docs/RENTAL-MANAGEMENT-PLAN.md` §8.5.
- [x] Nối `Rental History` ở Vehicle Detail (tab "Lịch sử thuê") và Customer Detail (tab "Thuê xe")
      vào dữ liệu thật — roadmap ở `docs/RENTAL-MANAGEMENT-PLAN.md` §8.3. **Fix theo phản hồi khách
      (15/09/2026)** — hai tab vẫn placeholder dù `features/rentals` đã `DONE`: thêm
      `VehicleRentalHistoryTab`/`CustomerRentalHistoryTab` (read-only, mirror
      `VehicleMaintenanceTab.tsx`, `useRentals` qua barrel `@/features/rentals`, không đụng
      `rentals/model.ts`/`api.ts`/`hooks.ts`/`index.ts`). Qua 1 vòng review `tech-lead`: không Blocker.
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
