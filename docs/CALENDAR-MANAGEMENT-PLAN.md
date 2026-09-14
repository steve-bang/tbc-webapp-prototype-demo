# Kế hoạch triển khai — Trang Lịch cho thuê (Rental Calendar)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `DONE` (14/09/2026) — kế hoạch **tự duyệt theo uỷ
quyền của chủ dự án** (tin nhắn 14/09/2026: "tôi cho phép bạn tự lên kế hoạch, tự accept plan...
không cần tôi accept plan"). Round 2 (Week + Month + Vehicle Block + tạo nhanh) đã implement xong,
qua 1 vòng review `tech-lead` không có Blocker (chi tiết ở `docs/IMPLEMENTATION-PLAN.md` mục
`features/calendar`). Round 3 (Day/Agenda + kéo-thả, §8.1) chưa bắt đầu.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/RentalCalendar-BRD.md` (v1.3, toàn bộ §1-§35) +
`RentalCalendar-UseCase.md` (v1.2, UC-RC-05/08/13/18) + `../thien-bao-car-docs/modules/
RentalManagement-BRD.md` §57 (Vehicle Block, CR-2026-015) + `../thien-bao-car-docs/WebappQuanTri.md`
§8 (Nhóm 3 — Lịch & điều phối) + `../thien-bao-car-docs/CHANGE-REQUESTS.md` (CR-2026-015/017/032/044).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase
2), `docs/RENTAL-MANAGEMENT-PLAN.md` (§8.1 roadmap gốc + §2/§3 field/hàm thuần của `Rental` đã DONE).
Đối chiếu mã hiện có: `src/features/rentals/model.ts`/`hooks.ts`/`index.ts` (barrel hiện chỉ export
`Rental` + `RentalListScreen` — sẽ mở rộng), `src/shared/domain/permissions.ts` (`CALENDAR.VIEW`,
`VEHICLE.BLOCK` đã scaffold sẵn), `package.json` (`@dnd-kit/*` có sẵn nhưng Round 2 chưa dùng).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. Mâu thuẫn tài liệu — dùng bản nào làm chuẩn

- `RentalCalendar-UseCase.md` §24 có bảng Business Rule rút gọn (chỉ tới `RC-BR-14`), và 2 mã
  (`RC-BR-13`, `RC-BR-14`) có **nội dung khác** với `RentalCalendar-BRD.md` §30 (đầy đủ `RC-BR-01→16`,
  v1.3 — mới hơn). **Dùng BRD §30 làm nguồn duy nhất cho mã `RC-BR-xx`** trong code/comment.
- `RentalCalendar-BRD.md` §4.2 (Out of Scope) còn ghi "Lịch cho xe ký gửi — Phase 2" — đã **lỗi thời**
  so với CR-2026-038 (`VehicleConsignment` chuyển Phase 1). Dùng `WebappQuanTri.md`/`CLAUDE.md` (mới
  hơn): **xe ký gửi hiển thị trên lịch bình thường như xe công ty**, không loại trừ.

### 0.2. Xung đột kiến trúc — khu vực "Chưa xếp xe" KHÔNG dựng được ở Round 2

`RentalCalendar-BRD.md` §6/§9/`RC-BR-07` mô tả khu "Chưa xếp xe" (Unscheduled) cho Rental `DRAFT`
chưa gán `Vehicle`. Nhưng `RentalManagement-BRD.md` `RM-BR-02` ("Rental phải thuộc 1 Vehicle") đã
được **Round 1 hiện thực hoá thành field `vehicleId` bắt buộc ngay lúc tạo** (đã `DONE`, đã review,
đang chạy — xem `src/features/rentals/model.ts` dòng 21). Dưới data model hiện tại, **không thể tồn
tại Rental nào chưa gán xe** → khu "Chưa xếp xe" không có dữ liệu để hiển thị.

**Quyết định: KHÔNG build khu "Chưa xếp xe" ở Round 2.** Đây là mâu thuẫn thật giữa 2 module tài
liệu, không phải lỗi implementation — `TODO(OQ: RentalCalendar-BRD.md §6/§9 vs RM-BR-02 — cần CR nếu
BA/khách muốn tách luồng "đặt trước, chọn xe sau")` đặt trong `calendar/model.ts`, không tự sửa lại
`rentals/model.ts` đã DONE.

### 0.3. Phạm vi Round 2 đã slice — không phải toàn bộ `RentalCalendar-BRD.md`

Tech-lead chủ động cắt Round 2 thành phần rủi ro thấp nhất (đây là lưới lịch đầu tiên của cả dự án,
chưa có tiền lệ code nào để tham chiếu). **Trong Round 2**: Week (mặc định) + Month (lưới xe×ngày) +
Vehicle Block CRUD + tạo nhanh từ ô trống. **Ngoài Round 2** (đẩy sang Round 3+, xem §8): Day/Agenda
view, kéo-thả dời lịch/đổi xe (UC-RC-06/07 — rủi ro cao nhất: rollback-on-conflict + audit + bước xác
nhận), Dispatch board (đã là dòng backlog riêng, cần `Assignment` từ `EA` chưa build), real-time/
optimistic locking UC-RC-18 (bỏ qua có chủ đích — demo 1 trình duyệt không có kịch bản nhiều người
sửa đồng thời; đây là giản lược phạm vi demo, không phải bỏ qua business rule an toàn dữ liệu).

---

## 1. Phạm vi Round 2

### 1.1. Trong phạm vi

- Data core `features/calendar`: entity mới `VehicleBlock` (`model.ts`/`api.ts`/`hooks.ts`/`seed.ts`).
- `CalendarScreen` (`/calendar`) với 2 chế độ xem: **Week (mặc định — CR-2026-032)** và **Month (lưới
  xe×ngày — CR-2026-017/044)**. Chuyển đổi qua tab/toggle, KHÔNG có Day/Agenda (§0.3).
- Trục theo xe (resource-timeline): mỗi xe 1 hàng, Rental Block hiển thị **chỉ đọc** (không kéo-thả).
- Click Rental Block → popover/dialog xem nhanh (không phải Rental Detail đầy đủ — `/rentals/:id`
  chưa build, xem `docs/RENTAL-MANAGEMENT-PLAN.md` §8.2).
- Click ô ngày ở Month → Day Detail Dialog (danh sách lượt trong ngày đó — CR-2026-044).
- Tạo nhanh lượt thuê từ ô trống (UC-RC-05): mở `RentalFormSheet` (tái dùng nguyên từ Round 1) với
  `vehicleId`/ngày điền sẵn.
- Vehicle Block: tạo/gỡ trực tiếp trên Month view (RC-BR-15/16, CR-2026-015/017) — cảnh báo (không tự
  xử lý) khi khoá đè lên lượt `CONFIRMED`.
- Bộ lọc (xe, trạng thái — mặc định ẩn `CANCELLED` theo RC-BR-08, và ẩn `NO_SHOW` theo quy ước hiển
  thị §11 — cả hai có nút bật lại), tìm kiếm (tên khách/SĐT/biển số → nhảy tới + highlight).
- Turnaround Buffer hiển thị trực quan giữa 2 block liền kề cùng xe (RC-BR-13, chỉ đọc — không có
  logic ghi đè vì chưa có kéo-thả).
- Route `/calendar` thay `ComingSoon`.

### 1.2. Ngoài phạm vi Round 2 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| Day view, Agenda view | Round 3 — giá trị gia tăng thấp hơn khi đã có Week+Month, tái dùng component hiển thị Rental Block đã xây |
| Kéo-thả dời lịch/đổi xe (UC-RC-06/07, `RC-BR-01→06`) | Round 3 — rủi ro cao nhất (rollback + audit + xác nhận), tách riêng để không dồn hết rủi ro vào lần code lưới lịch đầu tiên |
| Khu "Chưa xếp xe" | Xung đột kiến trúc với Round 1 đã DONE — xem §0.2 |
| Dispatch board (§20-23 BRD) | Đã là dòng backlog riêng trong `IMPLEMENTATION-PLAN.md`, cần entity `Assignment` (`EA`) chưa build |
| Real-time / optimistic locking (UC-RC-18) | Giản lược phạm vi demo (1 trình duyệt, không có concurrent edit thật) — xem §0.3 |
| Xuất PDF/Excel (§27) | Chưa có nhu cầu demo cấp thiết, để Round sau nếu cần |
| Lịch cá nhân trên App nhân viên (§26) | Ngoài phạm vi Webapp — thuộc `thien-bao-car-app-prototype-demo` |
| Cảnh báo trùng lịch nhân viên (RC-BR-11, EA §11) | Cần entity `Assignment`/nhân viên phân công — chưa build |

---

## 2. Data model

### 2.1. `VehicleBlock` (entity mới, độc lập — 1 storage key `vehicleBlocks`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `vehicleId` | `string` | có | RM-BR-30/RC-BR-15 |
| `startDate` | `string` (ISO date, không giờ) | có | CR-2026-015: "khoá lịch xe theo khoảng ngày, độc lập `Vehicle.status`" |
| `endDate` | `string` (ISO date) | — (optional) | CR-2026-015 câu 2 "khoá vô thời hạn hay nhập ngày dự kiến xong" **còn treo** — Round 2 cho phép để trống = khoá vô thời hạn tới khi gỡ tay, có nhập được nếu biết trước; `TODO(OQ: CHANGE-REQUESTS.md CR-2026-015 câu 2)` |
| `reason` | `string` | có | "tai nạn"/"hư nặng" — nhân viên tự mô tả, không phải enum cố định (BRD không liệt kê danh mục lý do đóng) |
| `status` | `'ACTIVE' \| 'RELEASED'` | có | `ACTIVE` = đang khoá, `RELEASED` = đã gỡ (không xoá — giữ lịch sử, đúng nguyên tắc chung `AL`) |
| `createdByUserId` / `createdByName` / `createdByRole` | `string` | có | Ai tạo khoá — CR-2026-015: `SALES` (tai nạn) hoặc `SYSTEM_ADMIN` (hư nặng), nhưng Round 2 gate theo permission `VEHICLE.BLOCK` chung (đã scaffold `likeManager` — `SYSTEM_ADMIN`/`MANAGER` `true`, `SALES` cũng `true` vì Phase 1 `SALES` ≈ `MANAGER` theo CR-2026-035 — không phân biệt lý do tai nạn/hư nặng để chọn ai được tạo, vì permission hiện có không tách theo `reason`) |
| `releasedByUserId` / `releasedByName` / `releasedByRole` | `string?` | — | Ai gỡ khoá — CR-2026-015: "giữ khoá đến khi `SYSTEM_ADMIN`/`MANAGER` cập nhật lại trạng thái xe" |
| `releasedAt` | `string?` | — | |
| `createdAt` / `updatedAt` | `string` (ISO) | có | |

**Field KHÔNG lưu (và lý do):** không tự động đổi `Vehicle.status` khi tạo Block — CR-2026-015 nguyên
văn: "độc lập với `Vehicle Status`" (VM §10a), Vehicle Block là khoá lịch riêng, không phải trạng thái
xe. Không có field liên kết trực tiếp tới các Rental `CONFIRMED` bị ảnh hưởng — Round 2 chỉ **tính
động** danh sách này khi tạo Block (không lưu quan hệ cứng), vì việc "điều phối/Sales xử lý theo §54/
§55" (đổi xe/huỷ) là hành động thủ công ngoài hệ thống ở Round 2 (chưa có luồng đổi xe giữa kỳ — RM
Round 1 §1.2 đã loại RM-BR-27/28 khỏi phạm vi).

### 2.2. Không có entity `CalendarEvent`/`CalendarBlock` riêng

`RentalCalendar-BRD.md` §7/§8.5 (`WebappQuanTri.md`): "`RC` không sở hữu dữ liệu riêng — đọc Rental
Block từ `RM`, hàng xe từ `VM`". Round 2 **không tạo bảng dữ liệu trung gian** cho Rental Block —
tính toán/hiển thị trực tiếp từ `Rental[]` (qua `useRentals()` import từ barrel `rentals`) +
`Vehicle[]` (qua `useVehicles()` từ barrel `vehicles`) + `VehicleBlock[]` (feature này) tại thời điểm
render, đúng tinh thần "chỉ hiển thị/tổng hợp, không tự dựng logic module khác" (đã áp dụng nhất quán
từ `VehicleMaintenanceTab`/`VehicleOverviewTab` ở Phase 1).

---

## 3. Hàm thuần (`calendar/model.ts`)

```ts
// RM-BR-30/RC-BR-15 — true nếu vehicleId bị khoá (status ACTIVE) trong khoảng [start, end).
isVehicleBlockedForPeriod(
  blocks: VehicleBlock[],
  vehicleId: string,
  startDate: string,
  endDate: string,
): boolean
// Chỉ tính block status === 'ACTIVE'. Nếu block.endDate rỗng (khoá vô thời hạn) → coi như luôn
// overlap với mọi khoảng từ block.startDate trở đi.

// RM-BR-30 §57 — liệt kê Rental CONFIRMED (trở lên, theo OCCUPYING_STATUSES của `rentals`) bị ảnh
// hưởng khi tạo 1 Vehicle Block mới — CHỈ để hiển thị cảnh báo, không tự xử lý (đổi xe/huỷ ngoài
// phạm vi Round 2, thuộc RM-BR-27/28 chưa build).
findRentalsAffectedByBlock(
  rentals: Rental[],        // import type từ '@/features/rentals' (barrel)
  vehicleId: string,
  startDate: string,
  endDate: string,
): Rental[]

// RC-BR-13 — vùng buffer hiển thị giữa 2 Rental Block liền kề cùng xe, dùng TURNAROUND_BUFFER_MINUTES
// import từ '@/features/rentals' (barrel, xem §9) — chỉ tính hiển thị, không validate/chặn (chưa có
// kéo-thả ở Round 2).
turnaroundBufferWindow(previousExpectedReturnDateTime: string): { start: string; end: string }
// = [previousExpectedReturnDateTime, previousExpectedReturnDateTime + TURNAROUND_BUFFER_MINUTES phút]

// Gom Rental theo vehicleId cho 1 khoảng ngày (dùng chung cho Week/Month) — thuần sắp xếp, KHÔNG
// tính lại business logic của `rentals` (không đụng conflict/pricing).
rentalsByVehicleInRange(rentals: Rental[], startDate: string, endDate: string): Map<string, Rental[]>
```

Không đưa `isVehicleBlockedForPeriod`/`findRentalsAffectedByBlock` lên `shared/lib/` — đặc thù riêng
`calendar` sở hữu entity `VehicleBlock`, chưa có feature khác cần dùng lại (đúng nguyên tắc "không
trừu tượng hoá sớm" áp dụng nhất quán từ Phase 1).

---

## 4. Business rule cần trích dẫn (`RC-BR-01 → RC-BR-16`, nguồn: `RentalCalendar-BRD.md` §30)

| Mã | Nội dung | Round 2 |
| --- | --- | --- |
| RC-BR-01 | Không dời lịch/đổi xe khi rental ở 8 trạng thái không cho phép | N/A — chưa có kéo-thả (Round 3) |
| RC-BR-02 | Kiểm tra lại availability sau dời/đổi xe | N/A — chưa có kéo-thả |
| RC-BR-03 | Xác nhận + audit khi sửa rental `CONFIRMED` từ lịch | N/A — chưa có kéo-thả |
| RC-BR-04 | Không xếp lượt vào xe `MAINTENANCE`/`INACTIVE` | Enforce ở tạo nhanh (kiểm tra `vehicle.status` trước khi mở form/submit) |
| RC-BR-05 | Không cho 2 rental overlap cùng xe | Enforce ở tạo nhanh (tái dùng `hasConflict()` từ `rentals` qua barrel) |
| RC-BR-06 | Dời/đổi xe không tự đổi giá snapshot | N/A — chưa có kéo-thả |
| RC-BR-07 | Rental chưa gán xe → "Chưa xếp xe" | N/A — xem §0.2, không dựng được |
| RC-BR-08 | `CANCELLED` ẩn mặc định, có tuỳ chọn hiện | Enforce (bộ lọc mặc định) |
| RC-BR-09 | Calendar chỉ hiển thị dữ liệu trong phạm vi quyền | Enforce một phần — `can('CALENDAR','VIEW')` gate cả trang; phạm vi chi tiết theo role (vd Operation Staff chỉ xem lượt của mình) là Open Question chưa chốt (§35 Q6) — `permissions.ts` đã có sẵn `OPERATION_STAFF: 'TBD'` nên `can()` trả `false`, Operation Staff không vào được trang — an toàn, không tự mở rộng |
| RC-BR-10 | Phân công/đổi NV từ calendar phải audit | N/A — chưa có Assignment (Round sau) |
| RC-BR-11 | Cảnh báo (không chặn) khi NV trùng lịch | N/A — chưa có Assignment |
| RC-BR-12 | Lượt nhiều ngày hiển thị liền mạch | Enforce (Week/Month vẽ block trải dài đúng số ngày) |
| RC-BR-13 | Vùng Turnaround Buffer hiển thị | Enforce (chỉ hiển thị, không validate — §3) |
| RC-BR-14 | Đổi xe giữa kỳ — chuyển block, giữ lịch sử | N/A — chưa có kéo-thả/đổi xe giữa kỳ |
| RC-BR-15 | Tạo/gỡ Vehicle Block trực tiếp trên lịch | Enforce (Month view, gate `can('VEHICLE','BLOCK')`) |
| RC-BR-16 | Mặc định Dashboard, RC mặc định Week, khung giờ 21:00 | Enforce phần "RC mặc định Week" (Dashboard đã đúng từ Phase 0); khung 21:00 kế thừa từ `RentalFormSheet` có sẵn (Round 1), không làm lại |

---

## 5. Màn hình (Round 2)

### 5.1. `CalendarScreen` (`/calendar`)

- Header: toggle Week/Month, điều hướng khoảng thời gian (tuần trước/sau, hoặc chọn tháng cụ thể ở
  Month — CR-2026-044 "điều hướng bằng cách chọn tháng cụ thể, không hỗ trợ nhiều tháng"), tìm kiếm,
  bộ lọc (xe/trạng thái, mặc định ẩn `CANCELLED`/`NO_SHOW` + toggle hiện).
- Nút "Khoá lịch xe" (gate `can('VEHICLE','BLOCK')`) — chỉ hiện ở Month view (RC-BR-15 nói rõ "trên
  chế độ Month").

### 5.2. `CalendarWeekGrid`

- Trục theo xe: mỗi xe 1 hàng (ẩn `INACTIVE` mặc định — §9 BRD, có toggle hiện), 7 cột ngày trong
  tuần hiện tại.
- Rental Block vẽ theo vị trí giờ trong ngày (dùng `pickupDateTime`/`expectedReturnDateTime`), màu
  theo `RentalStatusBadge` variant đã có (tái dùng `STATUS_VARIANT` — không định nghĩa màu mới, xem
  §9). Nội dung block theo thứ tự ưu tiên §10 BRD: tên khách, khung giờ, trạng thái; hover → tooltip
  chi tiết hơn (biển số, địa điểm, NV — NV luôn "Chưa phân công" ở Round 2 vì chưa có Assignment).
- Click ô trống (giờ trong ngày, hàng xe) → tạo nhanh (§5.4).
- Click block → popover xem nhanh (không điều hướng, vì `/rentals/:id` chưa có).
- Vùng Turnaround Buffer vẽ giữa 2 block liền kề cùng hàng xe (viền chấm/màu nhạt khác biệt).

### 5.3. `CalendarMonthGrid`

- Mỗi xe 1 dòng, mỗi ngày trong tháng 1 cột (CR-2026-017) — ô rút gọn (chỉ chấm màu/badge nhỏ theo số
  lượt trong ngày đó cho xe đó, không vẽ chi tiết như Week).
- Click ô ngày (1 xe, 1 ngày) → Day Detail Dialog: danh sách lượt trong ngày đó cho xe đó + trạng
  thái + giờ giao/nhận (CR-2026-044).
- Vehicle Block hiển thị phủ lên các ô ngày bị khoá (màu/kiểu riêng biệt Rental Block — §18 BRD "khác
  màu, khác kiểu"), click ô đã khoá → dialog xem chi tiết Block + nút "Gỡ khoá" (gate quyền).
- Nút "Khoá lịch xe" ở header (5.1) → `VehicleBlockFormDialog`: chọn xe, khoảng ngày, lý do → nếu
  phát hiện Rental `CONFIRMED`+ trong khoảng đó (`findRentalsAffectedByBlock`) → hiển thị **cảnh báo
  danh sách lượt bị ảnh hưởng**, không tự xử lý — nhân viên tự quyết định tiếp tục khoá hay không.

### 5.4. Tạo nhanh lượt thuê (UC-RC-05)

Click ô trống → mở `RentalFormSheet` (tái dùng nguyên component Round 1, KHÔNG viết lại) với
`vehicleId`/`pickupDateTime` điền sẵn theo ô đã click. Trước khi mở form: kiểm tra
`isVehicleBlockedForPeriod()` — nếu xe đang bị khoá, chặn không cho mở form, hiện thông báo lý do
khoá (RC-BR-15 "xe bị khoá không nhận lượt thuê mới"). `RentalFormSheet` tự chạy lại `hasConflict()`
khi submit (logic đã có sẵn từ Round 1, không cần code thêm).

### 5.5. `VehicleBlockFormDialog` — tạo/gỡ

- Tạo: chọn xe (chỉ xe chưa bị khoá `ACTIVE`), `startDate`, `endDate` (optional), `reason` (bắt
  buộc). Submit → cảnh báo Rental bị ảnh hưởng nếu có (§5.3) → xác nhận → tạo `VehicleBlock` status
  `ACTIVE`.
- Gỡ: từ ô đã khoá trên Month, nút "Gỡ khoá" → xác nhận → status → `RELEASED`, ghi `releasedBy*`.
  **Không** tự động đổi `Vehicle.status` (§2.1 — độc lập).

---

## 6. Responsive

Lưới lịch (Week/Month) là UI phức tạp nhất từ trước tới nay — ở mobile (~375px), **không cố nhồi lưới
nhiều cột** (không đúng tinh thần responsive của dự án): Week view ở mobile chuyển thành danh sách
theo ngày cuộn dọc (mỗi ngày 1 khối, liệt kê Rental Block dạng card, mirror `VehicleCard` pattern);
Month view ở mobile giữ lưới nhưng chỉ hiện chấm màu rất nhỏ + cho phép cuộn ngang trong khung có viền
(giống cách `RentalDetailScreen`/`VehicleDetailScreen` xử lý `TabsList` nhiều tab). Ở ≥768px hiển thị
đúng lưới xe×ngày/giờ như thiết kế chính.

---

## 7. Seed data (`features/calendar/seed.ts`)

- **4-6 bản ghi `VehicleBlock`**, ngày tính động (`isoDateOffset`, mẫu `maintenance/seed.ts`), tham
  chiếu `vehicleId` thật từ `vehicles/seed.ts`:
  - 2-3 `ACTIVE` (đang khoá) — ít nhất 1 cái **không** trùng lượt `CONFIRMED` nào (trường hợp đơn
    giản) và ít nhất 1 cái **có** trùng 1-2 Rental `CONFIRMED` đã seed ở `rentals/seed.ts` (để test
    hiển thị cảnh báo "lượt bị ảnh hưởng" khi mở dialog xem block đó).
  - 1-2 `RELEASED` (đã gỡ, giữ lịch sử) — có `releasedByName`/`releasedAt`.
  - 1 block `endDate` để trống (khoá vô thời hạn) — test hiển thị đúng "chưa có ngày kết thúc".
- Không seed thêm `Rental` nào mới — Round 2 dùng nguyên 29 bản ghi đã có từ Round 1 (đủ đa dạng
  trạng thái/ngày để test Week/Month).

---

## 8. Lộ trình Phase 2 còn lại (roadmap — KHÔNG chi tiết hoá field-level ở đây)

### 8.1. Round 3 — Day view + Agenda view + Kéo-thả (UC-RC-06/07)

Tái dùng `CalendarWeekGrid`/`CalendarMonthGrid` đã xây cho phần hiển thị; thêm Day (chi tiết theo
giờ, 1 ngày) + Agenda (danh sách). Kéo-thả dùng `@dnd-kit` đã có sẵn trong `package.json` — dời lịch/
đổi xe theo đúng `RC-BR-01→06`, UC-RC-06/07 (bước xác nhận + audit + rollback khi conflict — đọc lại
`RentalCalendar-BRD.md`/`-UseCase.md` tại thời điểm đó, đừng dùng lại phác thảo này nếu tài liệu đổi).

### 8.2. Dispatch board (`/schedule/dispatch`)

§20-23 BRD: danh sách giao/nhận hôm nay, upcoming pickup/return/overdue, phân công NV. Cần
`Assignment` entity (`EA`) — làm sau khi có Employee Assignment (§8.3 dưới) hoặc song song nếu tài
liệu cho phép tách rời phần "danh sách hôm nay" (không cần Assignment) khỏi phần "phân công" (cần).

### 8.3. `features/employees` — mở rộng Assignment

`ASSIGNED → IN_PROGRESS → DONE`, field `assignedDeliveryStaffId`/`assignedReceivingStaffId` thêm vào
`Rental` ở round này (không thêm sớm — theo `docs/RENTAL-MANAGEMENT-PLAN.md` §1.2).

### 8.4. `features/contracts` (CT), nối Rental History

Không đổi — xem `docs/RENTAL-MANAGEMENT-PLAN.md` §8.5/§8.3.

---

## 9. API / hooks / audit (Round 2)

`calendar/api.ts` (namespace storage `vehicleBlocks`, bọc `fakeRequest()`):
- `list(filter?: { vehicleId?, status? })`, `create(input)`, `release(id)`.

Audit action mới nối cuối `AUDIT_ACTIONS`: `CREATE_VEHICLE_BLOCK`, `RELEASE_VEHICLE_BLOCK`.

`calendar/hooks.ts`: `useVehicleBlocks(filter?)`, `useCreateVehicleBlock`, `useReleaseVehicleBlock`.

**Mở rộng `rentals/index.ts`** (đúng pattern `maintenance/index.ts` đã dùng — export qua barrel,
không import sâu):
```ts
export type { Rental } from './model'
export { RentalListScreen } from './screens/RentalListScreen'
// CALENDAR-MANAGEMENT-PLAN.md §9 — export thêm để `features/calendar` tái dùng qua barrel.
export { TURNAROUND_BUFFER_MINUTES, hasConflict } from './model'
export { useRentals } from './hooks'
export type { RentalFilter } from './api'
```
Chỉ export đúng 5 mục trên — đủ cho nhu cầu Round 2 (`hasConflict`/`TURNAROUND_BUFFER_MINUTES` cho
§3, `useRentals`/`RentalFilter` cho màn hình đọc dữ liệu). Không export thừa "phòng khi cần sau".

`calendar/index.ts`: export `type VehicleBlock` + `CalendarScreen`.

---

## 10. i18n

Thêm namespace `vi.calendar.*` (mẫu `vi.rentals.*`) — nhãn field Vehicle Block, nhãn action, thông
báo cảnh báo (xe bị khoá, lượt bị ảnh hưởng). `RENTAL_STATUS_LABELS` đã có sẵn từ Phase 0, dùng
nguyên cho hiển thị block. Thêm `VEHICLE_BLOCK_STATUS_LABELS: Record<'ACTIVE'|'RELEASED', string>`.

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: thêm `VEHICLE_BLOCK_STATUSES = ['ACTIVE', 'RELEASED'] as const` (enum
  mới — chưa tồn tại, xác nhận qua Explore); nối 2 audit action mới vào cuối `AUDIT_ACTIONS`.
- `shared/i18n/vi.ts`: thêm `vi.calendar.*` + `VEHICLE_BLOCK_STATUS_LABELS` (§10).
- `permissions.ts`: **không sửa** — `CALENDAR.VIEW`, `VEHICLE.BLOCK` đã đúng, dùng nguyên.
- `features/rentals/index.ts`: mở rộng export (§9) — **không đổi logic** bên trong `model.ts`/`api.ts`.
- `shared/fixtures/registerSeeds.ts`: import `calendar/seed` sau `rentals` (không phụ thuộc chéo,
  nhưng theo đúng thứ tự nhóm nghiệp vụ 3 sau nhóm 4 vì Vehicle Block chỉ cần `vehicles` đã seed).
- `app/routes.tsx`: bỏ `ComingSoon` cho `/calendar`, giữ nguyên `/schedule/dispatch` (Round sau).
- `docs/IMPLEMENTATION-PLAN.md`: tick phần Calendar Round 2 khi xong, tách rõ Round 3 (Day/Agenda/
  kéo-thả) vẫn `[ ]`.

---

## 12. Mã requirement cần trích trong code

`RC-BR-04, 05, 08, 09, 12, 13, 15, 16` · `RM-BR-30` · `CR-2026-006, 015, 017, 032, 044` · Open
Questions: `RentalCalendar-BRD.md §35 Q6` (phạm vi xem Operation Staff), `CR-2026-015` câu 2 (thời hạn
khoá), mâu thuẫn `RM-BR-02` vs `RC-BR-07` (§0.2).

---

## 13. Definition of Done (Round 2)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch (không cần Playwright).
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Không đụng `src/features/rentals/model.ts`/`api.ts` (chỉ mở rộng `index.ts` export) — xác nhận
   bằng diff, hành vi Round 1 (`/rentals`) không đổi.
4. Không có logic kéo-thả/rollback nào lọt vào (ngoài phạm vi Round 2 — §0.3/§1.2).
5. Không có khu "Chưa xếp xe" nào được dựng (§0.2) — chỉ `TODO(OQ)`.
6. *(Chủ dự án tự test thủ công sau bàn giao)*: mở `/calendar` → mặc định Week hiện đúng tuần hiện
   tại; chuyển Month → đúng lưới xe×ngày; click ô trống → mở form tạo nhanh đúng xe/ngày; tạo lượt
   trùng lịch xe khác → bị chặn đúng thông báo Round 1 đã có; khoá 1 xe có lượt `CONFIRMED` trong
   khoảng → hiện cảnh báo danh sách lượt bị ảnh hưởng; gỡ khoá → ô Month hết hiển thị khoá; bộ lọc ẩn/
   hiện `CANCELLED`/`NO_SHOW` hoạt động đúng; đổi vai trò Topbar → `OPERATION_STAFF` không vào được
   `/calendar` (do `TBD`); ở 375px Week chuyển danh sách theo ngày, Month cuộn ngang được.
7. `docs/IMPLEMENTATION-PLAN.md` tick phần Calendar Round 2, xoá `ComingSoon` route `/calendar`.

---

## 14. Việc tiếp theo sau khi Round 2 xong

Round 2 trở thành task brief đầy đủ giao cho agent `dev`. Sau khi qua review `tech-lead` đạt (4 bước
chuẩn), việc tiếp theo là Round 3 (§8.1 — Day/Agenda/kéo-thả) hoặc Dispatch board (§8.2), tuỳ độ ưu
tiên chủ dự án chọn khi tới lúc.
