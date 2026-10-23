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

## Phase 2 — Lịch & lượt thuê (lõi nghiệp vụ) — `[x]`

> Ngoại lệ còn mở (không chặn Phase 2): `features/calendar` Round 3 (Day/Agenda + kéo-thả UC-RC-06/07)
> **tạm hoãn theo chủ dự án 15/09/2026** — xem dòng `features/calendar` bên dưới.

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
- [x] Bảng điều phối trong ngày (dispatch board, trong `calendar` — theo `CLAUDE.md` bản đồ module):
      kế hoạch chi tiết đầy đủ ở [`docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md`](EMPLOYEE-ASSIGNMENT-
      DISPATCH-PLAN.md), Round 1 `DONE` (07/10/2026). Route `/schedule/dispatch`
      (`DispatchBoardScreen`): danh sách giao/nhận hôm nay (sort theo giờ, badge "Chưa phân công") +
      3 widget (sắp giao/sắp nhận 24h tới/quá hạn trả) + nút Phân công/Đổi người ngay trên bảng (mở
      dialog từ `employees`).
- [x] `RentalDetailScreen` (`/rentals/:id`): kế hoạch chi tiết đầy đủ ở
      [`docs/RENTAL-MANAGEMENT-PLAN.md`](RENTAL-MANAGEMENT-PLAN.md) §15, `DONE` (15/09/2026). 8 tab:
      Tổng quan/Giá-cọc-phát sinh (thật, không cần API mới — chỉ mở rộng barrel
      `useRental`/`useConfirmRental`/`useCancelRental`)/Thanh toán/Hợp đồng/Giao-nhận/Sự cố/Phân công
      (thật từ 07/10/2026 — `RentalAssignmentTab`, xem dòng Assignment bên dưới)/Nhật ký thao tác
      (thật, mirror `VehicleAuditTab.tsx`). Điều hướng click hàng/card ở `RentalListScreen` → Detail
      (mirror `CustomerListScreen`/`CustomerCard`). Qua 1 vòng review `tech-lead`: không Blocker.
- [x] `features/employees`: bổ sung **Assignment** (entity độc lập giữ `rentalId`, KHÔNG phải field
      trên `Rental` — xem `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §0.1 lý do lệch roadmap stub
      cũ), `ASSIGNED→IN_PROGRESS→DONE`+`REASSIGNED`/`CANCELLED`/`MISSED`, Phân công/Đổi người (bắt
      buộc lý do, lưu `reassignmentHistory`)/Huỷ phân công thủ công, phát hiện trùng lịch nhân viên
      (cảnh báo, không chặn — `hasAssignmentConflict`). Round 1 `DONE` (07/10/2026), cùng kế hoạch
      với Dispatch board ở trên. `IN_PROGRESS`/`DONE`/`CANCELLED` tự động theo Handover/Return/Rental
      (EA-BR-13/15) **không** nối dây Round này — chỉ hàm thuần `deriveAssignmentStatusFromRecord()`
      chuẩn bị sẵn (§0.3 kế hoạch).
- [x] `features/contracts` (CT): kế hoạch chi tiết đầy đủ Round 1 ở
      [`docs/CONTRACT-MANAGEMENT-PLAN.md`](CONTRACT-MANAGEMENT-PLAN.md), trạng thái `DONE`
      (15/09/2026) — qua 1 vòng review `tech-lead`, không Blocker. Model `Contract`/`ContractAddendum` (enum
      `CONTRACT_STATUSES`/`CONTRACT_ADDENDUM_TYPES` đã scaffold sẵn, dùng nguyên) · Sinh hợp đồng thủ
      công từ tab "Hợp đồng" ở Rental Detail (snapshot Customer+Vehicle+Rental, chuyển Rental sang
      `CONTRACT_CREATED`) · Tải lên bản ký (giả lập) → `SIGNED` · Huỷ hợp đồng (`SYSTEM_ADMIN`) ·
      **Danh sách hợp đồng** + **Contract Detail** (4 tab: Tổng quan/Bản ký/Phụ lục đọc-only/Nhật ký).
      **Điểm kiến trúc quan trọng**: đây là round DUY NHẤT được phép mở rộng có kiểm soát
      `rentals/model.ts`/`api.ts`/`hooks.ts`/`index.ts` (thêm transition `CONFIRMED→CONTRACT_CREATED`
      + hàm `markContractCreated()`) — đúng comment mời gọi sẵn có trong `ROUND1_TRANSITIONS`, không
      phải tiền lệ chung cho mọi feature khác. Không build: tạo Phụ lục qua UI, tái tạo hợp đồng,
      cascade Cancel Rental→Void Contract (cần phụ thuộc chéo rentals↔contracts, hoãn) — do chưa có
      `VehicleHandover`/`VehicleReturn` để tạo kịch bản thật. **Review note**: `dev` phát hiện kế
      hoạch §9.1 (bước 5, `contracts/api.ts`'s `create()` gọi `markContractCreated()`) mâu thuẫn thật
      với §9.3 (chỉ liệt kê 2 export) — `create()` là hàm async thuần, không thể gọi hook
      `useMarkContractCreated`. `tech-lead` xác nhận hợp lý, chấp nhận export thứ 3
      `markContractCreated` (hàm thuần từ `api.ts`, không phải hook) từ `rentals/index.ts`, đúng tiền
      lệ `rentals/api.ts` tự gọi thẳng `customers/api.ts`/`vehicles/api.ts`.
- [x] Nối `Rental History` ở Vehicle Detail (tab "Lịch sử thuê") và Customer Detail (tab "Thuê xe")
      vào dữ liệu thật — roadmap ở `docs/RENTAL-MANAGEMENT-PLAN.md` §8.3. **Fix theo phản hồi khách
      (15/09/2026)** — hai tab vẫn placeholder dù `features/rentals` đã `DONE`: thêm
      `VehicleRentalHistoryTab`/`CustomerRentalHistoryTab` (read-only, mirror
      `VehicleMaintenanceTab.tsx`, `useRentals` qua barrel `@/features/rentals`, không đụng
      `rentals/model.ts`/`api.ts`/`hooks.ts`/`index.ts`). Qua 1 vòng review `tech-lead`: không Blocker.
- [x] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng — xác nhận 23/10/2026: `registerSeeds.ts`
      đã import đủ `rentals` → `calendar` → `contracts` (Assignment seed nằm trong `employees/seed.ts`), mọi
      route Phase 2 (`/calendar`, `/schedule/dispatch`, `/rentals`, `/rentals/:id`, `/contracts`,
      `/contracts/:id`) đã mount screen thật, không còn code nào thuộc Phase 2. `ComingSoon` còn lại:
      `/dashboard` + 4 route `/platform/*` (Phase 6), 3 route `/consignment/*` (Phase 5), và
      `/employees/:id` — **chưa gán phase nào**: tài liệu không đặc tả màn chi tiết nhân viên riêng
      (`WebappQuanTri.md` §8.2 chỉ có "Hồ sơ nhân viên"), `PAGE-IMPLEMENTATION-PRIORITY.md` Phase 1 mục 1 giữ
      `ComingSoon` "cho tới khi có yêu cầu rõ ràng", nội dung dự kiến (lịch sử phân công + hiệu suất,
      UC-EA-14/18) đã dời Phase 6 theo `EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §1.2 — chờ người dùng quyết
      nếu muốn làm cùng bảng khối lượng/hiệu suất ở Phase 6.

## Phase 3 — Giao/nhận xe & sự cố — `[x]`

- [x] `features/handover-return` (VH/VR): kế hoạch chi tiết đầy đủ Round 1 ở
      [`docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md`](HANDOVER-RETURN-MANAGEMENT-PLAN.md), trạng thái
      `DONE` (19/09/2026). model (`HandoverRecord`/`ReturnRecord` — media placeholder, Incident Item
      nhúng tối giản, không phải entity `Incident` riêng) · màn **Theo dõi giao/nhận**
      (`/handover-return`) + tab **Biên bản** ở Rental Detail (đối chiếu trước/sau, odo/fuel/
      checklist, khoản phát sinh ước tính — công thức vượt km/CR-2026-057 + trễ giờ/CR-2026-054 đã
      implement đủ) + tab lịch sử ở Vehicle Detail + tab **Hiện trạng xe** (Vehicle Condition
      Timeline bản đầy đủ) + Sửa/Huỷ có kiểm soát (gate `MANAGER`/`SYSTEM_ADMIN`). **Quyết định cốt
      lõi**: Webapp KHÔNG build wizard thực hiện giao/nhận thật (thuộc App nhân viên, ngoài phạm vi
      repo — `CLAUDE.md` §3/`WebappQuanTri.md` §10.1-10.2) — bản ghi `COMPLETED` chỉ qua seed, Round
      1 chỉ có Theo dõi/Xem/Sửa/Huỷ có kiểm soát. Mở rộng có kiểm soát thêm `rentals/model.ts`/
      `api.ts`/`index.ts` (round thứ 2 sau `contracts` được phép, chỉ chiều revert khi Huỷ:
      `canCancelHandover`/`revertHandoverCancelled`/`canCancelReturn`/`revertReturnCancelled`) —
      **không** đụng `vehicles/model.ts`/`api.ts`/`hooks.ts`/`permissions.ts` (ngoại lệ kiến trúc thứ
      2 vượt phạm vi, để lại roadmap §8 của plan doc). Qua 1 vòng review `tech-lead` (đối chiếu
      `git diff` thật): **không Blocker** — xác nhận đúng mọi ranh giới trên, công thức phí khớp BRD,
      seed data (12 Handover + 7 Return, tham chiếu `rentalId` thật) nhất quán. Góp ý không chặn (để
      dọn round sau): 2 khoá i18n placeholder cũ nay mồ côi.
- [x] `features/incidents` (DI): kế hoạch chi tiết đầy đủ ở [`docs/DAMAGE-INCIDENT-MANAGEMENT-
      PLAN.md`](DAMAGE-INCIDENT-MANAGEMENT-PLAN.md), trạng thái `DONE` (07/10/2026). Sửa đúng enum
      theo BRD gốc (11 trạng thái/6 `Liability`, không phải 7/4 theo bản tóm tắt cũ
      `WebappQuanTri.md`). Model `Incident` đầy đủ (Source/Type/Severity/Liability/chi phí ước
      tính-thực tế-khách chịu/sửa chữa/claim tối giản) · màn `/incidents` + "Hồ sơ sự cố"
      (`/incidents/:id`, stepper 7 mốc mainline + action đúng gate, nhánh phụ `DISPUTED`/
      `WRITTEN_OFF`/`CLOSED_NO_ACTION` chỉ seed, không action UI) · tab "Sự cố" ở Rental Detail
      (`RentalIncidentsTab`, gồm nút "Tạo hồ sơ sự cố" từ `ReturnIncidentItem` chưa chuyển đổi) ·
      2 tab "Trách nhiệm & chi phí"/"Sửa chữa" ẩn hoàn toàn với `OPERATION_STAFF` (DI-BR-22). Chỉ
      đọc (không sửa) `ReturnIncidentItem` của `handover-return` để tiền điền; không đụng
      `vehicles/model.ts` (DI-BR-07 Vehicle MAINTENANCE tự động để roadmap, đúng ranh giới đã thiết
      lập ở Handover/Return). Qua 1 vòng review `tech-lead` (đối chiếu `git diff` thật): **không
      Blocker** — xác nhận đủ enum khớp BRD, 3 ranh giới `vehicles/*`/`handover-return/model.ts`+
      `api.ts`+`hooks.ts`/`permissions.ts` không bị đụng, field-scoping DI-BR-22 đúng cách
      (`TabsTrigger` điều kiện, không chỉ disable). Góp ý không chặn (để dọn round sau): gate
      "Đánh giá" nên đổi từ `INCIDENT.CREATE` sang `INCIDENT.ASSESS` (BRD §21 để `TBD` riêng cho
      Operation ở bước xác định Severity/Safety Impact) + thêm `TODO(OQ)`; seed `handover-return`
      chỉ còn 0 `ReturnIncidentItem` "chưa tạo hồ sơ" sau khi `inc_008` dùng hết — chấp nhận giới
      hạn demo, có thể bổ sung 1 item ở round sau; cột "Lượt thuê" ở `IncidentListScreen` hiện raw
      `rentalId`.
- [x] Nối Vehicle Condition Timeline (tab Vehicle Detail) vào dữ liệu Handover/Return/Incident thật
      — nhánh cũ sinh mốc `INCIDENT` từ `ReturnRecord.incidentItems` đã xoá hẳn, thay bằng `Incident`
      thật lọc theo `vehicleId` (không còn trùng dòng); field-scoping DI-BR-22 áp dụng theo role
      người xem.
- [x] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng (`/incidents`, `/incidents/:id`).

## Phase 4 — Tài chính — `[x]`

**Chia nhỏ 07/10/2026** theo rà soát của agent `ba` (3 module `RentalSettlement`/RS,
`Payment`/PM, `RevenueCost`/RV) — tái cấu trúc backlog thuần, **chưa phải implementation plan chi
tiết** (đó là bước sau, khi `tech-lead` giao từng Phase con). Lý do chia + phát hiện quan trọng cần
`tech-lead` tương lai biết trước khi lên plan chi tiết từng Phase con:

- **Ranh giới 3 module xác nhận đúng** `WebappQuanTri.md` §11 (mở đầu): **Settlement quyết định
  *bao nhiêu*** → **Payment ghi nhận *đã thu/chi thực tế*** → **Revenue & Cost *phân tích***. Chia
  Phase con đúng theo ranh giới này: 4.1 = RS, 4.2 = PM, 4.3 = RV.
- **UseCase tụt hậu so với BRD ở cả 3 module** (nội dung nghiệp vụ giữa 3 BRD vẫn nhất quán tốt với
  nhau — không phải lỗi nghiệp vụ, chỉ là tài liệu UseCase chưa theo kịp các CR đã APPLIED vào BRD).
  Nặng nhất ở `Payment`: **`UC-PM-02` (Thu tiền cọc) sai thật** — điều kiện tiên quyết ghi "Payment
  Request `Source = BOOKING`" cho Security Deposit, trong khi `Payment-BRD.md` §4.1 (theo
  CR-2026-060, đã APPLIED) chốt **Security Deposit thu ở mốc `HANDOVER`**, không phải `BOOKING`
  (`BOOKING` giờ chỉ còn Prepayment 30%). Khi lên plan chi tiết 4.2: **bám `Payment-BRD.md`, không
  bám `Payment-UseCase.md` cho điểm này** — không tự sửa UseCase (việc của BA).
- **Enum `SETTLEMENT_STATUSES` hiện tại sai so với BRD/UseCase thật** — scaffold ở
  `src/shared/domain/enums.ts` hiện là `['DRAFT', 'CONFIRMED', 'CLOSED', 'REVERSED']` nhưng
  `RentalSettlement-UseCase.md` §4 (State Model) định nghĩa đúng là 5 trạng thái theo thứ tự
  `DRAFT → PENDING_CUSTOMER → WAITING_APPROVAL → CONFIRMED → COMPLETED`, và đảo quyết toán
  (`UC-RS-16`, chỉ `SYSTEM_ADMIN`) đưa Settlement **quay lại `DRAFT`** (không có `REVERSED` như một
  state riêng — đó là tên hành động, không phải trạng thái đích). Sửa đúng enum này là việc đầu
  tiên của Phase 4.1 khi lên plan chi tiết, không phải quyết định nghiệp vụ mới — chỉ là sửa
  scaffold demo cho khớp tài liệu đã có.
- Return→Settlement (các dòng ước tính từ `handover-return` → chốt số thực tế) đã khớp tốt theo
  tài liệu, không có mâu thuẫn cần xử lý trước. `DI-BR-11/16/18` (chi phí sự cố — `Customer
  Charge`/`Company Cost`) đúng là thuộc phạm vi đọc của RS (dòng khoản mục `INCIDENT`) + RV (Cost
  Record), Rental Settlement không tự đánh giá sự cố. Consignment → Owner Payout (`VC`, Phase 5)
  nhất quán với Payment (`OWNER_PAYOUT`, Cost Record `CONSIGNMENT_PAYOUT`) nhưng **thiếu 1 UC cho
  Payment** phía thực thi chi trả — ghi nhận để không bất ngờ khi lên plan chi tiết 4.2/Phase 5.
- **Phát hiện thêm khi `tech-lead` tự xác nhận lại tài liệu** (không chỉ tin báo cáo `ba`): **2 mốc
  đầu của Payment Schedule (`BOOKING`: Prepayment 30%; `HANDOVER`: 70% + Security Deposit) KHÔNG
  phụ thuộc Phase 4.1** — Settlement chỉ được mở sau khi Rental `RETURNED` (`RentalSettlement-BRD.md`
  §7, `RS-BR-02`), nghĩa là 2 mốc này xảy ra trước khi Settlement tồn tại. Chỉ phần "Payment **thực
  thi** yêu cầu thu/hoàn do Settlement điều phối" (mốc `RETURN` + Post-Settlement Charge) mới thật
  sự phụ thuộc 4.1. Khi lên plan chi tiết 4.2, có thể cân nhắc slice nhỏ hơn theo điểm này (ví dụ
  làm 2 mốc đầu trước, không nhất thiết chờ 4.1 xong hẳn) — **không tự chốt cách slice ở đây**, để
  dành cho lúc lên plan chi tiết.
- Nhiều Open Question còn treo chặn công thức lõi (`RentalSettlement-BRD.md` §28): sự cố nặng khi
  `Liability` ≠ khách 100%, đối trừ cọc tự động hay cần khách đồng ý, ngưỡng duyệt miễn giảm, quy
  tắc làm tròn/VAT, giữ cọc chờ phạt nguội. **Không tự chốt** — chỉ `TODO(OQ)` khi tới lượt code.

#### Open Question đầy đủ (18 câu, nguồn: báo cáo rà soát agent `ba` 07/10/2026, đã tự verify trực
tiếp với BRD — không phải suy diễn), chia theo Phase con sẽ chạm tới:

**Phase 4.1 — Quyết toán (RentalSettlement), chặn công thức/logic lõi:**
1. Công thức sự cố nặng khi `Liability` ≠ khách chịu 100% — master BRD §51 Q54.
2. Đối trừ cọc tự động hay cần khách đồng ý trước — RS §28 Q1.
3. Ngưỡng miễn giảm: Accountant tự quyết tới đâu, Manager/Admin duyệt từ đâu — RS §14/§28 Q9.
4. Quy tắc làm tròn (1.000đ/10.000đ) + có VAT không + thứ tự discount/VAT/rounding — RS §19/§28 Q5-8.
5. Giữ lại một phần cọc chờ phạt nguội — số/tỉ lệ/thời hạn — RS §28 Q3.
6. Có cho đóng lượt khi còn công nợ không, hạn mức — RS §28 Q11; ai được đóng lượt — Q12.
7. Khoản tranh chấp giữ Settlement hay tách Post-Settlement; xử lý khi khách từ chối xác nhận hoàn
   toàn — RS §28 Q13.
8. Thời hạn truy thu phạt nguội/sự cố sau trả xe + ngưỡng bỏ qua truy thu — RS §28 Q14/15.
9. Mức xác nhận khách Phase 1 (M0-M4) — RS §28 Q17.

**Phase 4.2 — Thanh toán (Payment), chặn công thức/logic lõi:**
10. Ai được `REVERSED` giao dịch đã `CONFIRMED` — PM §27 **Q14** (sửa 21/10/2026, trước ghi nhầm Q15 —
    Q15 là chính sách hoàn khi huỷ lượt; BRD §21 đã chốt Admin/Manager ✓, chỉ còn treo cột Accountant).
11. Ngưỡng duyệt hoàn tiền — PM §27 Q13.
12. Có cho tạo Rental mới cho khách đang nợ không, ngưỡng chặn — PM §27 Q7; chính sách xử lý số dư
    (Credit/Overpayment) — Q8.
13. Mô hình quỹ tiền mặt (theo ca/ngày/điểm giao dịch), ai là thủ quỹ — PM §27 Q10-11.
14. Mô hình phí SePay cụ thể (theo giao dịch hay theo tháng) — PM §4.2.

**Phase 4.3 — Phân tích tài chính (RevenueCost), ảnh hưởng phạm vi/UI, không chặn lõi:**
(Sửa 22/10/2026 — trước ghi lẫn số câu của BRD §28 và UseCase §26, hai danh sách đánh số khác nhau từ câu 9;
nay thống nhất theo **`RevenueCost-BRD.md` §28**, xem `docs/REVENUE-COST-PLAN.md` §0.1 F9.)
15. Có làm Period Close (chốt kỳ tháng) ở Phase 1 không — RV §28 **Q11**; ai chốt/mở lại — **Q13**. (Q12 là
    chính sách nợ xấu — câu riêng.)
16. Danh mục báo cáo cụ thể & tần suất, KPI dashboard bắt buộc, ai được xem — RV §28 **Q14-Q16**.
17. Cách xác định "số ngày khả dụng" của xe để tính Utilization — RV §28 Q10.
18. Danh mục chi phí chuẩn cụ thể của Thiên Bảo Car — RV §28 Q4.

### Phase 4.1 — Quyết toán (RentalSettlement) — `[x]`

- [x] `features/finance` (RS, phần Settlement): kế hoạch chi tiết đầy đủ ở
      [`docs/RENTAL-SETTLEMENT-PLAN.md`](RENTAL-SETTLEMENT-PLAN.md) (`APPROVED` 21/10/2026; Round 1
      `DONE` 21/10/2026; Round 2 `DONE` 21/10/2026 — cả Phase 4.1 xong). Chia **2 round**: Round 1 = lõi Settlement Worksheet (mở thủ công từ Rental `RETURNED` →
      chốt dòng → MANUAL/miễn giảm → đối trừ cọc → khách xác nhận → duyệt → yêu cầu thu/hoàn → đóng
      lượt `RETURNED → SETTLEMENT → COMPLETED`) + màn `/finance/settlement` + tab "Quyết toán" ở Rental
      Detail; Round 2 = Post-Settlement Charge + Điều chỉnh sau `COMPLETED` + Đảo quyết toán. Mở rộng
      có kiểm soát lần thứ 3 `rentals/model.ts`/`api.ts`/`index.ts` (chỉ thêm transition);
      `handover-return`/`incidents` chỉ thêm dòng re-export read-only ở `index.ts`. `Paid To Date`/cọc
      suy tạm từ cờ `HandoverRecord` tới khi có Payment (4.2). 9 Open Question bên dưới xử lý bằng
      `TODO(OQ)` + giả định tạm (bảng §11 của plan); 5 điểm lệch tài liệu ghi lại cho BA (§0.4).
      Nội dung backlog gốc: model `Settlement`/`SettlementLine` — **sửa đúng
      `SETTLEMENT_STATUSES`** theo `RentalSettlement-UseCase.md` §4 (không giữ bản scaffold demo
      sai hiện tại, xem note ở trên) · **Settlement Worksheet** (đọc Additional Charge Item ước
      tính từ `handover-return` qua barrel, chốt số thực tế từng dòng, miễn giảm/thiện chí theo
      ngưỡng duyệt, đối trừ cọc, tính `Final Amount`) · **Post-Settlement Charge** (thu/hoàn sau khi
      Rental `COMPLETED`, không mở lại Settlement kỳ gốc) · đóng lượt thuê
      (`RETURNED → SETTLEMENT → COMPLETED` — state Rental đã có sẵn, chờ UI thật).
  - [x] **Round 1 — lõi Settlement Worksheet** `DONE` (21/10/2026): `features/finance` (model/api/
        hooks/seed/index + 13 component Worksheet/dialog/badge + `SettlementListScreen`), route `/finance/settlement`,
        tab "Quyết toán" ở Rental Detail, sửa `SETTLEMENT_STATUSES` đúng UseCase §4, 2 transition
        Rental `RETURNED → SETTLEMENT → COMPLETED`, `SEED_VERSION` 12 → 13. Qua **2 vòng review
        `tech-lead`**: vòng 1 có 3 Blocker — (1) `applyWaiver` `WAIVE_LINE` ghi đè `actualAmount`
        làm mất số gốc khỏi Final Amount, (2) `rejectSettlement` không trả dòng `WAIVED` về
        `CONFIRMED` khi waiver bị `REJECTED`, (3) đóng lượt/gửi khách không kiểm Rental còn
        `SETTLEMENT` (Return bị huỷ) — kèm 8 điểm "Nên sửa" (guard trạng thái `confirmLine`/
        `disputeLine`/`resolveDispute`, chặn trùng yêu cầu thu/hoàn, chuỗi i18n…), tất cả đã sửa;
        vòng 2 đạt. Nợ nhỏ để Round 2: `completeSettlement` đọc storage ngoài `fakeRequest` (snapshot
        cũ sau độ trễ); `PARTIAL_DISCOUNT` chưa chặn tổng nhiều lần vượt `actualAmount` của dòng;
        `resolveDispute` nhánh Miễn chưa đi qua ngưỡng duyệt miễn giảm (RS-BR-07/08); các thao tác
        `recordCustomerAck`/`approve`/`reject` chỉ chặn Return-huỷ ở UI, chưa chặn ở API.
  - [x] **Round 2** `DONE` (21/10/2026) — Post-Settlement Charge + Điều chỉnh sau `COMPLETED` + Đảo
        quyết toán + 4 nợ nhỏ Round 1, theo `RENTAL-SETTLEMENT-PLAN.md` §10. Entity riêng
        `PostSettlementCharge` (key `postSettlementCharges`, không ghi vào Settlement kỳ gốc — RS-BR-13/
        BRD §25.4) + 3 enum `POST_SETTLEMENT_CHARGE_TYPES/STATUSES/SOURCES`; tạo PSC (`SETTLEMENT.CREATE`)
        / Điều chỉnh (`SETTLEMENT.EDIT`) / Đánh dấu tất toán thủ công (thay Payment 4.2, chặn khi "Tạm giữ"
        — sự cố `DISPUTED`); luật chống tính trùng sự cố giữa Settlement và PSC (`getIncidentPscBlocker`,
        resync lọc sự cố đã có PSC); Đảo quyết toán (`SETTLEMENT.REVERSE`, chỉ `SYSTEM_ADMIN`, 2 bước,
        snapshot `reversals[]`, yêu cầu thu/hoàn `REQUESTED → CANCELLED`, giữ `lines`/`waivers`, Rental
        `COMPLETED → SETTLEMENT` qua `revertSettlementReversed`); 6 component mới, cột "Phát sinh sau QT"
        ở List; 5 audit action mới; seed 3 PSC, `SEED_VERSION` 13 → 14. Nợ N1-N4 đã trả (đọc storage trong
        `fakeRequest`, chặn cộng dồn `PARTIAL_DISCOUNT`, "Miễn" khi kết luận tranh chấp qua ngưỡng duyệt,
        `assertRentalInSettlement` ở 12 hàm API). Đạt ở **vòng review 1**, không Blocker. Nợ nhỏ (Nên sửa,
        để sau): `PostSettlementChargeDialog` tự validate inline thay vì dùng `postSettlementChargeFormSchema`
        (schema này + `postSettlementChargeCloseFormSchema` đang không dùng); thông điệp
        `assertRentalInSettlement` cố định đuôi "không thể gửi khách xác nhận" cho cả 12 hàm;
        `usePostSettlementCharges({ settlementId: undefined })` tải toàn bộ PSC khi Settlement chưa có.
        **→ 3 nợ này ĐÃ XỬ LÝ ở Phase 4.4 (B6, 22/10/2026).**
        Ngoài phạm vi (giữ `TODO(OQ)`): tách tranh chấp ra PSC (RS §28 Q13), thời hạn truy thu/bỏ qua khoản
        nhỏ (Q14/Q15). Ghi cho BA: trùng mã `RS-BR-21` giữa BRD §21 và UseCase §26 (§10.2).
- [x] Cập nhật `registerSeeds.ts` phần `Settlement` (`finance/seed` chạy cuối), xoá `ComingSoon` màn
      Quyết toán (Round 1, 21/10/2026).

### Phase 4.2 — Thanh toán (Payment) — `[x]`

- [x] `features/finance` (PM): kế hoạch chi tiết đầy đủ ở [`docs/PAYMENT-PLAN.md`](PAYMENT-PLAN.md)
      (`APPROVED` 21/10/2026; **Round 1 `DONE` 21/10/2026**; **Round 2 `DONE` 21/10/2026** — cả Phase
      4.2 xong). Người
      dùng duyệt nguyên trạng cách chia round, không chờ BA xác nhận các điểm diễn giải §0.4 trước khi
      code (vẫn ghi lại cho BA). Chia **2 round**: Round 1 = sổ
      giao dịch lõi (`PaymentRequest`/`Transaction` lưu trữ, `PaymentSchedule` là view suy ra) + lập
      lịch & thu 2 mốc `BOOKING`/`HANDOVER` + xác nhận/thất bại/huỷ/đảo/điều chỉnh + biên lai + quỹ
      tiền mặt & đối soát CK/ví + tab "Thanh toán" ở Rental Detail — **không phụ thuộc Settlement**;
      Round 2 = thực thi yêu cầu thu/hoàn của Settlement + Post-Settlement Charge, `OFFSET` khi
      Settlement `CONFIRMED`, hoàn tiền + duyệt hoàn, ghi ngược Payment Status, thay `Paid To Date`
      tạm suy (cờ `HandoverRecord`) bằng sổ giao dịch, màn **Công nợ khách hàng**. Không đụng
      `rentals/{model,api,hooks,index,seed}.ts` (chỉ `RentalDetailScreen.tsx`), `handover-return`,
      `incidents`, `vehicles`, `customers`. 7 permission mới, 10+5 audit action; 5 OQ chặn xử lý
      bằng `TODO(OQ)` (bảng §11 của plan); 7 điểm lệch tài liệu ghi cho BA (§0.4).
      Nội dung backlog gốc: model `Transaction`/`PaymentRequest`/`PaymentSchedule` · **Sổ giao
      dịch** (danh sách, thêm giao dịch thủ công, `OFFSET`/`REVERSED` — không xoá) · **Quỹ tiền
      mặt** (tổng nộp/đối soát đơn giản) · **Công nợ khách hàng** · **Biên lai**. Phụ thuộc Phase
      4.1 **chỉ cho phần** "thực thi yêu cầu thu/hoàn do Settlement điều phối" (mốc `RETURN` +
      Post-Settlement Charge) — 2 mốc đầu (`BOOKING`: Prepayment 30%; `HANDOVER`: 70% + Security
      Deposit) không phụ thuộc 4.1 (xem note ở trên). **Bám `Payment-BRD.md` §4.1, không bám
      `Payment-UseCase.md` UC-PM-02 cho mốc thu Security Deposit** (UseCase sai, đang ghi nhầm
      `BOOKING` thay vì `HANDOVER`).
  - [x] **Round 1 — sổ giao dịch lõi + 2 mốc `BOOKING`/`HANDOVER`** `DONE` (21/10/2026), theo
        `PAYMENT-PLAN.md` §1.2, §2-§9, §11, §12.1, §14.1, §15.1: 6 enum mới + label,
        7 permission, 10 audit action; `PaymentRequest`/`Transaction`/`CashDrawerSubmission`; lập lịch,
        ghi thu, xác nhận/thất bại/huỷ/đảo/điều chỉnh, biên lai dialog, quỹ tiền mặt + đối soát CK/ví;
        màn `/finance/transactions` + `/finance/cash-drawer` + tab "Thanh toán" ở Rental Detail;
        `SEED_VERSION` 14 → 15. Qua 2 vòng review `tech-lead`: 2 Blocker vòng 1 đã sửa (biên lai của
        giao dịch `REVERSED` không xem lại được + thiếu nhãn "Đã vô hiệu" — PM-BR-19; sheet chi tiết giữ
        object `Transaction` cũ nên không tự cập nhật sau khi thao tác → đổi sang lưu id) + 2 "Nên sửa"
        (i18n nhãn mốc, guard API chặn `OFFSET`/`ONLINE_GATEWAY` ở ghi thủ công). Lưu ý cho Round 2:
        `OFFSET` phải sinh qua hàm hệ thống riêng, **không** qua `recordTransaction`/`createAdjustment`
        (đã chặn có chủ đích).
  - [x] **Round 2 — thực thi điều phối Settlement/PSC, `OFFSET`, hoàn tiền + duyệt, Công nợ khách
        hàng** `DONE` (21/10/2026), theo `PAYMENT-PLAN.md` §10.1-§10.18. Phạm vi: `PaymentRequest` `SETTLEMENT`/
        `POST_SETTLEMENT_CHARGE` 1-1 với `SettlementPaymentRequest`/PSC; `OFFSET` tự động khi Settlement vào
        `CONFIRMED` qua hàm hệ thống riêng; hoàn tiền + duyệt vượt `REFUND_APPROVAL_THRESHOLD` (1tr, tạm —
        OQ PM §27 Q13); chặn CASH OUT vượt quỹ; helper `syncFinanceAfterPaymentChange` ghi ngược
        `paymentStatus` (kỳ gốc) + tự đóng PSC; đảo quyết toán huỷ yêu cầu + VOID GD chờ + đảo `OFFSET`;
        `calcPaidToDate`/`calcDepositHeld` đọc sổ giao dịch; bỏ đóng PSC thủ công; màn `/finance/receivables`;
        5 audit action; `SEED_VERSION` 15 → 17. Đối chiếu code R1 phát hiện 5 lỗi tiềm ẩn sửa kèm (§10.1
        F1-F5: tiến độ yêu cầu hoàn bị âm, chặn cứng Rental `COMPLETED`, giao dịch PSC làm đổi Settlement gốc,
        điều chỉnh CASH OUT không kiểm quỹ, invalidate thiếu key). 7 điểm diễn giải ghi cho BA (§10.13).
        Qua 3 vòng review `tech-lead`: Blocker vòng 2 đã sửa (seed `stl_024` xác nhận giao dịch hoàn
        trước khi được duyệt — trái PM-BR-12; tách mốc tạo → duyệt → xác nhận/biên lai) + 3 "Nên sửa"
        (`updatedAt` GD FAILED sau mốc duyệt; bỏ tham chiếu plan/mã UC khỏi chuỗi UI).
- [x] Cập nhật `registerSeeds.ts` phần `Transaction`/`PaymentRequest` (seed Payment chạy trong
      `finance/seed`, đã đăng ký), xoá `ComingSoon` màn Sổ giao dịch/Quỹ tiền mặt (R1)/Công nợ khách
      hàng (R2).

### Phase 4.3 — Phân tích tài chính (RevenueCost) — `[x]`

- [x] `features/finance` (RV): kế hoạch chi tiết ở [`docs/REVENUE-COST-PLAN.md`](REVENUE-COST-PLAN.md)
      (`APPROVED` 22/10/2026 — người dùng chấp nhận cả 5 đề xuất ở §13: seed lịch sử **phương án B**, giữ **3
      round**, tab Tổng quan Vehicle Detail **ngoài phạm vi**, giữ nối tiếp `features/finance` + refactor tách
      thư mục là task riêng Phase 4.4, ghi ngoại lệ form `finance` vào `CONVENTIONS.md` §7). **Round 1 `DONE`
      (22/10/2026)**; **Round 2 `DONE` (22/10/2026)**; **Round 3 `DONE` (22/10/2026 — §20)** — cả Phase 4.3 xong. Chia **3 round**: Round 1 = lõi
      dữ liệu (Revenue Line **suy ra** từ Settlement/PSC — đảo quyết toán xử lý bằng `reversals[]` có sẵn, không
      cần ghi thêm; Cost Record nhập tay lưu riêng + chi phí suy ra từ Sự cố/Bảo dưỡng; góc nhìn thực thu) + màn
      **Chi phí vận hành** `/finance/costs` + 3 tab Vehicle Detail; Round 2 = Báo cáo tài chính phần chính (Tổng
      quan theo kỳ + drill-down + Report 01/02/05, `recharts` đã có sẵn); Round 3 = Report 03/04/06 + đối chiếu ghi
      nhận ↔ thực thu + xuất CSV. Ngoại lệ kiến trúc có kiểm soát: sửa `vehicles/screens/VehicleDetailScreen.tsx`
      (chỉ thay 3 placeholder) + nối 10 Rental lịch sử `rt_030`…`rt_039` vào cuối `rentals/seed.ts` (chỉ thêm,
      không sửa bản cũ; các lượt này không có hợp đồng/biên bản giao-nhận). Sửa scaffold sai `COST_CATEGORIES`.
      Nội dung backlog gốc: model `CostRecord`/`RevenueLine` · **Báo cáo tài chính** (tổng quan
      theo kỳ + drill-down theo xe, biểu đồ `recharts`; doanh thu ghi nhận `ON_SETTLEMENT` +
      góc nhìn "thực thu" — CR-2026-048) · **Nhập & điều chỉnh chi phí thủ công** (Category, Amount,
      Cost Date, Allocation Type `DIRECT`/`INDIRECT`).
- [x] **Round 1** (22/10/2026): lõi dữ liệu RV (Revenue Line suy ra từ Settlement/PSC kể cả đảo quyết toán ·
      Cost Record nhập tay `costRecords` + chi phí suy ra từ Sự cố/Bảo dưỡng/Phụ tùng · góc nhìn thực thu) + màn
      **Chi phí vận hành** `/finance/costs` (thêm/sửa/huỷ mềm, audit `COST_MANUAL_*`) + 3 permission
      `FINANCE_REPORT.EDIT/DELETE/EXPORT` + seed 10 lượt lịch sử `rt_030`…`rt_039` (`stl_038` từng bị đảo) + 15
      Cost Record, `SEED_VERSION` 18. Review đạt vòng 1, không Blocker.
- [x] Nối 3 tab Revenue/Cost/Profit ở Vehicle Detail vào dữ liệu thật (Round 1).
- [x] **Round 2** (22/10/2026) — màn Báo cáo tài chính phần chính (`REVENUE-COST-PLAN.md` §1.3, §11.3, **chi tiết
      §19**; review đạt vòng 1, không Blocker): `/finance/reports` 4 tab Tổng quan (KPI + so kỳ trước + biểu đồ +
      bảng theo xe) / Doanh thu (Report 01) / Hiệu quả xe (Report 02) / Chi phí (Report 05), drill-down
      `VehicleFinanceSheet`, biểu đồ `recharts` (kể cả tab Lợi nhuận Vehicle Detail), switch loại chi phí bất thường.
      Gộp: invalidate `['finance','analytics']` trong `invalidatePayment`; **nợ (a)** sửa cờ `completedWithDebt` theo
      số còn phải thu thực tế lúc đóng (`calcSettlementCollectOutstanding` — suy từ RS BRD §15/EX-02, không quyết định
      nghiệp vụ mới), seed tính bằng hàm, `SEED_VERSION` 19; **nợ (c)** kiểu khoá i18n `FinanceStringKey`.
- [x] **Round 3** (22/10/2026) — Report 03/04/06 + đối chiếu ghi nhận ↔ thực thu + xuất CSV (`REVENUE-COST-PLAN.md`
      §1.4, §11.4, **chi tiết §20**). `/finance/reports` 7 tab (thêm Khách hàng / Sự cố / Đối chiếu & dòng tiền), nút
      Xuất CSV ở cả 7 tab (`shared/lib/csv.ts`, UTF-8 BOM, chống CSV-injection, audit `REPORT_EXPORT` đúng 1 lần/lượt xuất
      và chỉ tải file khi audit thành công, không dữ liệu cá nhân ngoài mã + họ tên khách). Qua **2 vòng review**: Blocker
      vòng 1 — chênh lệch theo lượt ở màn Đối chiếu (vd `rt_026` 975.000) khác số dư màn Công nợ vì PSC "Tạm giữ" (sự cố
      tranh chấp) vẫn ghi nhận doanh thu nhưng không cộng "Đang nợ" mà không có giải thích → thêm chú thích dưới bảng +
      gợi ý "Gồm … tạm giữ" theo lượt + `TODO(OQ)` (`REVENUE-COST-PLAN.md` §0.4 điểm 18); số liệu không đổi (kiểm lại
      bằng harness: `rt_026` chênh 975.000, tổng 12 tháng −45.760.000 = Σ các lượt). Không đổi seed (`SEED_VERSION` 19).
- [x] Nợ ghi nhận từ review Round 2 — **(d)(e)(f)(g) ĐÃ XỬ LÝ ở Round 3** (§20.4): (d) lazy-load màn báo cáo + biểu đồ
      tab Lợi nhuận — bundle chính 1.863,27 kB → **1.461,98 kB** (gzip 483,60 → 370,76 kB), `recharts` sang chunk riêng
      `FinanceTrendChart` 388 kB, màn báo cáo 54 kB; (e) chú thích chi phí phân bổ ngày sau hôm nay ở 3 chỗ; (f)
      `FinanceStringKey` khai báo một lần ở `model.ts`; (g) JSDoc `asOf` của `calcSettlementCollectOutstanding`.
- [ ] Nợ ghi nhận từ review Round 3 (nhỏ, không chặn) — **(h) ĐÃ XỬ LÝ ở Phase 4.4 (B6)**, (i) còn treo: (h) gom logic định dạng tỉ lệ % / % thay đổi — `formatPercentText`/
      `formatChangeText` (`model.ts`, dùng cho CSV) đang song song với cách định dạng % trong các component hiển thị → một
      helper chung để màn và CSV không lệch; (i) bundle chính vẫn 1,46 MB (> 500 kB, phần còn lại của app) — tách vendor
      chung (`manualChunks`/`codeSplitting`) là quyết định build riêng, cân nhắc ở Phase 6 hoặc khi nối backend thật.
- [ ] Nợ ghi nhận từ review Round 1 — **(a) và (c) ĐÃ XỬ LÝ ở Round 2** (`REVENUE-COST-PLAN.md` §19.2: cờ
      `completedWithDebt` tính bằng `calcSettlementCollectOutstanding`, chỉ `stl_026` còn cờ; kiểu `FinanceStringKey`);
      (b) còn treo (cần sửa bản ghi cũ `rentals/seed.ts` — ngoài ngoại lệ đã duyệt). Nội dung gốc: (a) `completedWithDebt` tính theo
      `depositReconciliation.balanceDue` lúc đối trừ, nên lượt đã thu đủ yêu cầu `COLLECT` trước khi đóng vẫn hiện
      "Đóng kèm công nợ" (hành vi app từ 4.1, seed `stl_034/037` phản ánh đúng) — cân nhắc tính theo số còn phải
      thu tại thời điểm đóng; (b) `rentals/seed.ts` `createdAt = pickup − 3 ngày` → lượt có pickup > +3 ngày bị
      `createdAt` (và giao dịch BOOKING `GD-000003/4/8/9`) ở tương lai; (c) kiểu `Exclude<keyof typeof vi.finance,
      …>` ở `PostSettlementChargeDialog`/`SettlementCompleteDialog` phải sửa mỗi khi thêm namespace con — đổi sang
      mapped type chỉ lấy khoá có giá trị `string`.
- [x] Cập nhật `registerSeeds.ts` phần `CostRecord`/`RevenueLine`, xoá `ComingSoon` còn lại của
      Phase 4 (nếu còn) — xác nhận 22/10/2026: không còn `ComingSoon` nào dưới `/finance/*`. (Ghi chú plan: `costRecords` seed trong `finance/seed.ts` — đã đăng ký sẵn qua
      `registerSeeds.ts`; `RevenueLine` là view suy ra, không seed; `ComingSoon` `/finance/reports` xoá ở Round 2.)

### Phase 4.4 — Refactor tách `features/finance` theo module (RS/PM/RV) — `[x]`

- [x] **DONE 22/10/2026** — kế hoạch [`docs/FINANCE-REFACTOR-PLAN.md`](FINANCE-REFACTOR-PLAN.md) (`DONE`). Tách
      `model/api/hooks/seed.ts` (~9.400 dòng) thành tầng một chiều `core ← payment ← settlement ← revenue-cost`, gốc chỉ
      `finance/{index,seed}.ts`; `git mv` 50 component + 7 screen. Refactor thuần: barrel 18 export, 6 storage key, query
      key, 43 `appendAudit`, `SEED_VERSION` 19, thứ tự 5 bước seed giữ nguyên; seed snapshot toàn bộ `localStorage` +
      số kiểm chứng (−45.760.000 / 975.000 / 7.050.000) giống hệt `14eb623` (harness tất định có đặt lại hạt giống
      trước `forceReseed()` — plan §6.1); không vòng import; chunk chính 1.461,98 → 1.453,40 kB. Gộp 4 nợ: (h) helper
      `formatPercentText`/`formatChangeText` dùng chung màn + CSV; `assertRentalInSettlement(actionText)` — 11 hàm đổi
      đuôi lỗi thành "không thể cập nhật quyết toán" (**đổi chuỗi có chủ đích**, `submitForCustomer` giữ "gửi khách xác
      nhận"); `usePostSettlementCharges(filter, { enabled })`; `PostSettlementChargeDialog` validate qua
      `postSettlementChargeFormSchema` (thứ tự + nội dung lỗi giữ nguyên, bỏ đuôi `— UC-RS-21`). Review `tech-lead` **đạt
      vòng 1**, không Blocker. Nợ nhỏ còn treo (không chặn): 60 import tương đối có đuôi `.ts` trong 18 file
      `finance/**` (khác quy ước cả repo — bỏ đuôi khi chạm file); `amount` trong dialog PSC nay được `trim` trước khi
      kiểm (trước đây " 100" bị từ chối) — chấp nhận; nợ (b) `rentals/seed.ts` + (i) bundle chính > 500 kB vẫn treo
      (Phase 6).
- [x] **Chỉ bắt đầu sau khi Phase 4.3 `DONE`** (quyết định người dùng 22/10/2026 — `REVENUE-COST-PLAN.md`
      §13 câu 4). `features/finance` gom 3 module (`api.ts` ~2.800, `model.ts` ~2.300 dòng sau 4.3) → tách
      thư mục con theo module (vd `finance/settlement`, `finance/payment`, `finance/revenue-cost`, mỗi nhánh đủ
      model/api/hooks/seed + barrel `finance/index.ts` giữ nguyên public API để `rentals`/`vehicles` không phải
      sửa import). **Thay đổi kiến trúc** → cần `tech-lead` lập plan riêng + người dùng duyệt + cập nhật
      `CONVENTIONS.md` §3 / `docs/ARCHITECTURE.md` trước khi giao `dev`. Thuần refactor — không đổi hành vi,
      không đổi storage key/`SEED_VERSION`. Có thể gộp dọn nợ treo: `postSettlementChargeFormSchema` chưa nối
      vào `PostSettlementChargeDialog` (`REVENUE-COST-PLAN.md` §10).

## Phase 5 — Xe ký gửi — `[~]`

Kế hoạch chi tiết: [`docs/CONSIGNMENT-PLAN.md`](CONSIGNMENT-PLAN.md) (`APPROVED` 23/10/2026 — `tech-lead` tự duyệt). Chia
**3 round**: R1 = hồ sơ chủ xe + hợp đồng ký gửi `FIXED_MONTHLY` (`DRAFT → PENDING_APPROVAL → SIGNED → ACTIVE`, tạm ngưng/
khôi phục, thay bản mới) + biên bản nhận xe `INTAKE` + tab Vehicle Detail — **không đụng `finance`**; R2 = lịch chi trả
(Owner Payout Record, prorate) + chấm dứt/đóng/mất xe + biên bản trả xe + nối `finance` (`OWNER_PAYOUT`, Cost
`CONSIGNMENT_PAYOUT`, màn "Chi trả chủ xe"); R3 = đề nghị ký gửi & thẩm định + phụ lục/gia hạn. Quyết định khung: chiều import
**`finance → consignment` một chiều** (`consignment` không import `finance`; màn "Chi trả chủ xe" là screen của
`finance/payment` mount ở `/consignment/owner-payouts` — plan §0.3 điểm 1). Phát hiện: khối `CONSIGNMENT` trong
`permissions.ts` khai trùng `EDIT` (entry sau ghi đè — Accountant sửa được hồ sơ chủ xe, Sales không) → viết lại theo
`VehicleConsignment-BRD.md` §18 ở R1 (plan §0.1 F1, §5); 14 điểm diễn giải/lệch tài liệu ghi cho BA (plan §0.4). Ngoài phạm
vi (roadmap plan §13): tự đặt/gỡ `Ownership Type` (VC-BR-03) và chặn lượt thuê mới (VC-BR-04) — cần ngoại lệ ghi vào
`vehicles`/`rentals`.

- [x] **Round 1** — xong 23/10/2026, review `tech-lead` đạt vòng 1 (plan §1.2, §2–§8, §10, §14–§17): `features/consignment`
      (model/api/hooks/seed/index), 4 màn (`/consignment/owners[/:id]`, `/consignment/contracts[/:id]`), tab "Chủ xe & Ký
      gửi" ở Vehicle Detail (ngoại lệ có kiểm soát `VehicleDetailScreen.tsx`), khối quyền Nhóm 7 viết lại theo BRD §18,
      seed 10 chủ xe · 19 hợp đồng · 18 biên bản, `SEED_VERSION` 20. Nợ "Nên sửa" mang sang R2: gate trang `VIEW` (hiện chỉ
      qua nav), chuyển sang bản mới sau "Thay bằng bản mới", chặn `handoverAt` tương lai (plan §18).
- [ ] **Round 2** — lịch chi trả + chấm dứt/đóng + nối `finance` (plan §1.3, §3.2, §4, §9, §15.2). Nội dung backlog gốc:
      **Lịch chi trả hàng tháng** (`SCHEDULED`/`PAID`) · khoản chi trả chủ xe phản ánh đúng vào `finance` (Cost Record
      `CONSIGNMENT_PAYOUT`, không tính lợi nhuận công ty — CR-2026-050).
- [ ] **Round 3** — đề nghị ký gửi & thẩm định + phụ lục/gia hạn (plan §1.4).
- [~] Nối tab Owner/Consignment ở Vehicle Detail vào dữ liệu thật — R1 (khối "chi trả gần nhất" ở R2).
- [~] Cập nhật `registerSeeds.ts` (R1: `consignment/seed` chạy ngay trước `finance/seed`), xoá `ComingSoon` — R1 xoá
      `/consignment/owners` + `/consignment/contracts`; `/consignment/payouts` xoá ở R2.

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
