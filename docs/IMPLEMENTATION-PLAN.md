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
- [ ] Cập nhật `registerSeeds.ts`, xoá `ComingSoon` tương ứng.

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

## Phase 4 — Tài chính — `[ ]`

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
10. Ai được `REVERSED` giao dịch đã `CONFIRMED` — PM §27 Q15.
11. Ngưỡng duyệt hoàn tiền — PM §27 Q13.
12. Có cho tạo Rental mới cho khách đang nợ không, ngưỡng chặn — PM §27 Q7; chính sách xử lý số dư
    (Credit/Overpayment) — Q8.
13. Mô hình quỹ tiền mặt (theo ca/ngày/điểm giao dịch), ai là thủ quỹ — PM §27 Q10-11.
14. Mô hình phí SePay cụ thể (theo giao dịch hay theo tháng) — PM §4.2.

**Phase 4.3 — Phân tích tài chính (RevenueCost), ảnh hưởng phạm vi/UI, không chặn lõi:**
15. Có làm Period Close (chốt kỳ tháng) ở Phase 1 không, ai chốt/mở lại — RV §28 Q10-12.
16. Danh mục báo cáo cụ thể & KPI dashboard bắt buộc — RV §28 Q13-16.
17. Cách xác định "số ngày khả dụng" của xe để tính Utilization — RV §28 Q10.
18. Danh mục chi phí chuẩn cụ thể của Thiên Bảo Car — RV §28 Q4.

### Phase 4.1 — Quyết toán (RentalSettlement) — `[ ]`

- [ ] `features/finance` (RS, phần Settlement): model `Settlement`/`SettlementLine` — **sửa đúng
      `SETTLEMENT_STATUSES`** theo `RentalSettlement-UseCase.md` §4 (không giữ bản scaffold demo
      sai hiện tại, xem note ở trên) · **Settlement Worksheet** (đọc Additional Charge Item ước
      tính từ `handover-return` qua barrel, chốt số thực tế từng dòng, miễn giảm/thiện chí theo
      ngưỡng duyệt, đối trừ cọc, tính `Final Amount`) · **Post-Settlement Charge** (thu/hoàn sau khi
      Rental `COMPLETED`, không mở lại Settlement kỳ gốc) · đóng lượt thuê
      (`RETURNED → SETTLEMENT → COMPLETED` — state Rental đã có sẵn, chờ UI thật).
- [ ] Cập nhật `registerSeeds.ts` phần `Settlement`, xoá `ComingSoon` tương ứng màn Quyết toán.

### Phase 4.2 — Thanh toán (Payment) — `[ ]`

- [ ] `features/finance` (PM): model `Transaction`/`PaymentRequest`/`PaymentSchedule` · **Sổ giao
      dịch** (danh sách, thêm giao dịch thủ công, `OFFSET`/`REVERSED` — không xoá) · **Quỹ tiền
      mặt** (tổng nộp/đối soát đơn giản) · **Công nợ khách hàng** · **Biên lai**. Phụ thuộc Phase
      4.1 **chỉ cho phần** "thực thi yêu cầu thu/hoàn do Settlement điều phối" (mốc `RETURN` +
      Post-Settlement Charge) — 2 mốc đầu (`BOOKING`: Prepayment 30%; `HANDOVER`: 70% + Security
      Deposit) không phụ thuộc 4.1 (xem note ở trên). **Bám `Payment-BRD.md` §4.1, không bám
      `Payment-UseCase.md` UC-PM-02 cho mốc thu Security Deposit** (UseCase sai, đang ghi nhầm
      `BOOKING` thay vì `HANDOVER`).
- [ ] Cập nhật `registerSeeds.ts` phần `Transaction`/`PaymentRequest`, xoá `ComingSoon` tương ứng
      màn Sổ giao dịch/Quỹ tiền mặt/Công nợ khách hàng.

### Phase 4.3 — Phân tích tài chính (RevenueCost) — `[ ]`

- [ ] `features/finance` (RV): model `CostRecord`/`RevenueLine` · **Báo cáo tài chính** (tổng quan
      theo kỳ + drill-down theo xe, biểu đồ `recharts`; doanh thu ghi nhận `ON_SETTLEMENT` +
      góc nhìn "thực thu" — CR-2026-048) · **Nhập & điều chỉnh chi phí thủ công** (Category, Amount,
      Cost Date, Allocation Type `DIRECT`/`INDIRECT`).
- [ ] Nối 3 tab Revenue/Cost/Profit ở Vehicle Detail vào dữ liệu thật.
- [ ] Cập nhật `registerSeeds.ts` phần `CostRecord`/`RevenueLine`, xoá `ComingSoon` còn lại của
      Phase 4 (nếu còn).

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
