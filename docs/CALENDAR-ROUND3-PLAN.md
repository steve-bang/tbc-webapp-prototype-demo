# Kế hoạch — Lịch Round 3: xem Ngày · Agenda · Dời lịch / đổi xe (kéo–thả) (Phase 2 Round 3)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** **`APPROVED`** (25/10/2026 — người dùng duyệt cả 5 điểm §12 theo đề xuất; các Round chạy liên tục
A → B1 → B2) · **Round A — `DONE`** (25/10/2026, brief §13, review đạt vòng 1, không Blocker — §13.9) · **B1 — `DONE`** (25/10/2026, brief §14, review đạt vòng 1, không Blocker — §14.9) · B2 — chờ · Round C — plan riêng, chưa làm.

Hạng mục **Phase 2 Round 3** của `features/calendar` — tạm hoãn từ 15/09/2026 (`docs/CALENDAR-MANAGEMENT-PLAN.md` §8.1), nay người dùng chọn làm tiếp sau
Phase 6.1. Plan này **thay** phác thảo §8.1 cũ (đọc lại tài liệu nghiệp vụ tại thời điểm lập plan, đúng lời dặn ở §8.1).

**Nguồn nghiệp vụ:**

- `../thien-bao-car-docs/modules/RentalCalendar-BRD.md` (v1.3): §8 (chế độ xem), §13 (tương tác), §15 (kéo–thả, `RC-BR-01…05`), §16 (availability),
  §17 (xung đột), §18 (bảo trì/`INACTIVE`), §19 (Turnaround Buffer), §24 (cập nhật/đồng thời), §25 (múi giờ, khung giờ làm việc), §28 (quyền), §29 (hiệu
  năng — optimistic + tự hoàn tác), §30 (`RC-BR-01…16`), §31 (`AC-RC-004…007`), §32 (EX-01…04), §35 (Q8, Q9, Q10, Q18).
- `RentalCalendar-UseCase.md`: UC-RC-06 (§10), UC-RC-07 (§11), UC-RC-08, UC-RC-18, UC-RC-19.
- `RentalManagement-BRD.md` (v1.7): §12 (Turnaround Buffer), §51 (khung 21:00, cửa sổ nhận đóng sau 23:00), §54 (đổi xe giữa kỳ — CR-2026-012/063),
  §55 (xe hỏng trước giao — CR-2026-013), §57 (Vehicle Block). `RentalManagement-UseCase.md` UC-RM-07 (Edit), UC-RM-10 (Rental Period), UC-RM-22 (đổi xe
  giữa kỳ), §30 Q12.
- `EmployeeAssignment-BRD.md`: `EA-BR-10`, `EA-BR-14`, `EA-BR-19`.
- `WebappQuanTri.md` §5.2, §8.2–§8.4.

**Nguồn kỹ thuật:** `CONVENTIONS.md` · `docs/ARCHITECTURE.md` §5, §6a, §7 · `docs/CALENDAR-MANAGEMENT-PLAN.md` (Round 1–2) ·
`docs/TECH-HARDENING-PLAN.md` (§3 — 2 điểm nhập; §11 — route guard; §4/§13/§14 — múi giờ; §12.9 L1 — đo tải đầu).

**Script đo** (ngoài repo): `/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad/cal3/` (`peek.mjs` — ứng viên test trên seed) +
dùng lại `scratchpad/hardening/` (`initial-load.mjs`, `run-harness.sh`, `dump-seed.mjs`, `diff-seed.mjs`, `guard-r1.mjs`).

---

## 0. Hiện trạng (HEAD `6e863cf`, harness `FIXED_NOW` 22/10/2026 10:00 +07)

| Hạng mục | Hiện trạng |
| --- | --- |
| Màn lịch | `/calendar` có **Week** (mặc định — xe × 7 ngày, trục giờ dọc trong mỗi ô) và **Month** (xe × ngày), tạo nhanh từ ô trống, Vehicle Block (Month). **Chưa có** Day, Agenda, kéo–thả. Chế độ xem là `useState` (không nhớ giữa các lần mở). |
| Hàm lịch | `features/calendar/model.ts`: `weekDayKeys`, `monthGridKeys`, `shiftAnchor`, `dispatchRowsForDay`, `rentalsByVehicleInRange`, `isVehicleBlockedForPeriod`, `findRentalsAffectedByBlock`. Ngày giờ qua `shared/lib/datetime.ts` (UTC+7). |
| API ghi lượt thuê | `rentals/api.ts` chỉ có `create`, `confirm`, `cancel` + các hàm chuyển trạng thái. **Không có** hàm sửa thời gian / đổi xe — Round này phải thêm. `hasConflict()` coi vùng đệm 90' là **xung đột cứng**. |
| Snapshot giá | `Rental` lưu sẵn `rentalDurationDays`, `baseAmount`, `allowedKm`, `vehicleClass`, `pricePerKm`, `estimatedTotal`, `prepaymentAmount` (tính lúc tạo). Xe **không có** bảng giá (`rentalRate` nhập tay mỗi lượt). Không có màn sửa giá. |
| Quyền | `RENTAL.EDIT` đã có (`permissions.ts` dòng 167 — nguồn `WebappQuanTri.md` §8.4 "Tạo/dời/hủy lượt, đổi xe từ lịch"): `SYSTEM_ADMIN`/`MANAGER`/`DISPATCHER`/`SALES` = ✓, `OPERATION_STAFF`/`ACCOUNTANT` = ✗. **Không cần entry mới.** |
| Thư viện kéo–thả | `@dnd-kit/core` 6.3.1 (+ `sortable`, `utilities`) **đã có trong `package.json`, chưa file nào dùng** — chưa vào bundle. |
| Tải đầu `/dashboard` | **1.854.198 B** (trần D11 1.870.000, dư 15.802 B). `CalendarScreen` đang import **tĩnh** → nằm trong tải đầu. |
| Seed (ứng viên test — `cal3/peek.mjs`) | 15 lượt ở 4 trạng thái kéo được (5 `DRAFT`, 6 `CONFIRMED`, 2 `CONTRACT_CREATED`, 2 `READY_FOR_HANDOVER`). Có sẵn: `rt_004` (`DRAFT`) trên `veh_007` `MAINTENANCE`; `rt_005` (`DRAFT`) trên `veh_013` `INACTIVE`; `rt_010` (`CONFIRMED`) nằm trong khoá `vblk_001` (`veh_014` 26–30/10); `rt_008`→`rt_009` trên `veh_012` chỉ cách nhau **30'** (< đệm 90'). Đây là **xung đột có sẵn trong dữ liệu** (RC §17) — dùng làm ca test, không sửa seed. |

---

## 1. Phạm vi

### 1.1. Trong phạm vi

| # | Nội dung | Nguồn |
| --- | --- | --- |
| P1 | **Xem Ngày (Day)**: một ngày, mỗi xe một hàng, trục giờ **ngang** 00:00–24:00 (+07), tô nổi khung giờ làm việc 07:00–20:00, vạch mốc **21:00** (khung giao/nhận chuẩn), vùng đệm 90' sau mỗi lượt, khối Vehicle Block | RC §8, §19, §25, `RC-BR-12/13/16`, CR-2026-005 |
| P2 | **Agenda/List**: danh sách lượt theo thời gian trong khoảng đang xem (nhóm theo ngày), tìm kiếm + bộ lọc dùng chung với các chế độ khác | RC §8, §12 |
| P3 | Chuyển chế độ không mất bộ lọc; nút **Hôm nay**; **nhớ chế độ xem + bộ lọc** giữa các lần mở (Zustand `persist` — UI state, CONVENTIONS §5) | RC §8 "Yêu cầu chung" |
| P4 | **Dời lịch** (đổi `pickupDateTime`/`expectedReturnDateTime`, kể cả đổi thời lượng) — UC-RC-06 | `RC-BR-01/02/03/05/06/13` |
| P5 | **Đổi xe trước giao** (đổi `vehicleId` của lượt chưa giao) — UC-RC-07 | `RC-BR-01/02/03/04/05/06` |
| P6 | Một **đường xử lý duy nhất** cho P4/P5: hàm thuần kiểm tra → hộp thoại xác nhận (cũ → mới, cảnh báo) → API `rentals` → audit; mở được **bằng kéo–thả** hoặc **bằng menu "Dời lịch / Đổi xe"** trên block (dùng được mọi thiết bị, kể cả không kéo được) | RC §13 (menu ngữ cảnh), §15, §29 |
| P7 | **Kéo–thả** trên Week, Month (dời theo ngày + đổi hàng xe) và Day (dời theo 30' + kéo cạnh để đổi thời lượng), hoàn tác tự động khi bị từ chối/huỷ | RC §13, §15, EX-01, `AC-RC-004…007` |
| P8 | Cập nhật `Planned Window` của phân công khi dời lịch (`EA-BR-14`) + cảnh báo trùng lịch nhân viên (`EA-BR-10`, không chặn) | EA |
| P9 | Chống ghi đè khi dữ liệu đã đổi (EX-03 / UC-RC-18) | RC §24 |
| P10 | Màn Chi tiết lượt thuê: dòng **thông báo** khi thời lượng hiện tại khác số ngày đã snapshot (giá không tự đổi — `RC-BR-06`) | UC-RC-06 bước 5 |

### 1.2. Ngoài phạm vi (lý do)

| Nội dung | Lý do |
| --- | --- |
| **Đổi xe giữa kỳ** (lượt `IN_RENTAL` — UC-RM-22, CR-2026-012/063, phụ lục `ADDENDUM_VEHICLE_SWAP`, chênh lệch giá) | `RC-BR-01` **cấm** dời/đổi xe trên lịch khi lượt `HANDED_OVER`/`IN_RENTAL`. Đổi xe giữa kỳ là quy trình của `RM`+`CT`+`PM`+`VH`/`VR` (giao xe thay thế + nhận xe gốc ở hiện trường, phụ lục, thu chênh lệch, xe gốc → `MAINTENANCE`), đổi cấu trúc `Rental` (lịch sử xe theo đoạn — `RC-BR-14`). Đề xuất **plan riêng** (§10 — Round C), cần người dùng quyết (§12 câu 2). |
| Khu "Chưa xếp xe" (`RC-BR-07`, EX-02) | `vehicleId` là bắt buộc khi tạo lượt (`RM-BR-02`) — không tồn tại lượt chưa gán xe (giống Round 2). |
| Bộ đếm / lọc "chỉ lượt đang xung đột" (RC §17, UC-RC-09) | Hạng mục hiển thị riêng; Round này chỉ **chặn** xung đột mới. Ghi nhận 2 xung đột có sẵn trên seed (§0) cho backlog. |
| Xuất/in lịch PDF/Excel (UC-RC-15) | Định dạng chưa chốt (RC Q20). |
| Sửa giá / tính lại tiền sau dời lịch / đổi xe | `RC-BR-05/06`: không tự đổi giá; xử lý chênh lệch "trong Rental Management" nhưng app chưa có màn sửa giá (OQ C2). |
| Huỷ / tạo hợp đồng lại khi lượt đã có hợp đồng | UC-RC-07 A3: chỉ **cảnh báo**; người dùng tự xử lý ở Contract Management (đã có Huỷ/Tạo). |
| Đổi giờ giao/nhận **thực tế** | RC §15 ghi chú + Q10: khuyến nghị không làm trên lịch. |
| Đẩy thời gian thực giữa nhiều trình duyệt | Demo một trình duyệt; dùng làm mới qua TanStack Query + kiểm `updatedAt` (P9). |
| Kéo–thả trên Bảng điều phối, App nhân viên | Không có trong tài liệu (RC §26 — nhân viên không dời lịch). |
| Sửa `hasConflict()` của luồng **tạo** lượt (đang coi vùng đệm là cứng) | Ngoài phạm vi; Round này dùng hàm kiểm tra mới chỉ cho dời/đổi xe (§3.2). Ghi nợ. |

---

## 2. Lựa chọn kéo–thả & tác động bundle

### 2.1. So sánh

| Tiêu chí | `@dnd-kit/core` (đã có trong `package.json`) | Tự viết bằng Pointer Events |
| --- | --- | --- |
| Kích thước | **39.793 B** min (13.328 B gzip) — đo `rolldown --minify` gói `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`/`TouchSensor`/`KeyboardSensor`, `useSensor(s)`; không cần `@dnd-kit/sortable` | ~3–6 kB ước tính |
| Cảm ứng | `TouchSensor` có sẵn ngưỡng nhấn giữ (delay/tolerance) — phân biệt **cuộn lưới** với **kéo block** | Tự xử lý `pointercancel`, `touch-action`, nhấn giữ, cuộn tự động ở mép |
| Bàn phím / hỗ trợ tiếp cận | `KeyboardSensor` + thông báo cho trình đọc màn hình có sẵn | Phải tự làm (hoặc bỏ) |
| Thả lên hàng xe / ô ngày | `useDroppable` + phát hiện va chạm có sẵn | Tự tính `elementFromPoint` |
| Thêm phụ thuộc | Không (đã khai báo, đã cài) | Không |
| Rủi ro | Thấp — thư viện phổ biến, đúng kế hoạch cũ §8.1 | Cao hơn ở cảm ứng/cuộn — đúng phần khó nhất của Round |

### 2.2. Đề xuất — `@dnd-kit/core` + **tải lười màn Lịch**

- `CalendarScreen` chuyển sang **tải lười** theo mẫu D11 (`features/calendar/screens/lazyScreens.ts`, `calendar/ui.ts` export bản lazy, `routes.tsx` bọc
  `<Suspense>` bên trong `RequirePermission`). Đo thử (worktree HEAD `6e863cf`): tải đầu `/dashboard` **1.854.198 → 1.831.763 B (−22.435 B)**; chunk
  `CalendarScreen` 24.930 B.
- `@dnd-kit/core` + Day/Agenda + hộp thoại dời/đổi chỉ nằm trong chunk lười của Lịch → **không** chạm tải đầu. Ngân sách: tải đầu sau Round A ≤ **1.835.000 B**;
  Round B **không tăng** tải đầu quá +2.000 B (phần `rentals`/`employees` API mới nằm ở chunk chính vì barrel dữ liệu tải tĩnh).
- `DispatchBoardScreen` giữ nguyên tĩnh (không đổi ngoài phạm vi).
- `TouchSensor`: nhấn giữ **300 ms**, dung sai 8 px (vuốt bình thường vẫn cuộn lưới); `PointerSensor` (chuột): bắt đầu kéo sau khi di 5 px (nhấp vẫn mở popover như cũ);
  `KeyboardSensor` bật. Không dùng `@dnd-kit/sortable`.

---

## 3. Thiết kế

### 3.1. Luồng chung (dời lịch / đổi xe)

```text
Kéo–thả (Week/Month/Day)  ──┐                       ┌── Menu "Dời lịch / Đổi xe" trên block (mọi thiết bị)
                            ↓                       ↓
          Đề xuất thay đổi { rentalId, vehicleId mới?, pickup mới?, return mới?, expectedUpdatedAt }
                            ↓
          evaluateScheduleChange(...)  — hàm thuần (rentals/model.ts), chạy NGAY khi thả
                            ↓
   ┌─────────────── lỗi chặn (errors) ────────────────┐      ┌──── hợp lệ (có thể kèm cảnh báo) ────┐
   │ hoàn block về vị trí cũ + toast lý do            │      │ Hộp thoại xác nhận: cũ → mới,         │
   │ + mở nhanh lượt / khoá gây xung đột (EX-01)      │      │ danh sách cảnh báo; buffer → bắt buộc  │
   └──────────────────────────────────────────────────┘      │ nhập lý do ghi đè (RC-BR-13)           │
                                                              └───────────────┬───────────────────────┘
                                         Huỷ → hoàn block (A3)                ↓ Xác nhận
                                                     rentals/api: rescheduleRental() / changeRentalVehicle()
                                                     (kiểm tra LẠI toàn bộ ở API + updatedAt — EX-03)
                                                              ↓
                                     ghi Rental → appendAudit → dời Planned Window phân công (EA-BR-14) → audit
                                                              ↓
                                     invalidate ['rentals'], ['assignments'], ['notifications'] → vẽ lại
```

- Hiển thị lạc quan (RC §29): block được vẽ ở vị trí mới trong lúc hộp thoại mở; huỷ / API từ chối → về vị trí cũ.
- Mọi lượt ở 4 trạng thái kéo được đều qua **hộp thoại xác nhận** (UC-RC-06/07 bước "System yêu cầu user xác nhận" không phân biệt trạng thái; `RC-BR-03` bắt
  buộc với `CONFIRMED`+).

### 3.2. Hàm thuần kiểm tra — `rentals/model.ts`

```text
evaluateScheduleChange(input: {
  rental, proposed: { vehicleId, pickupDateTime, expectedReturnDateTime },
  rentals (toàn bộ), targetVehicle, vehicleBlocks, now
}) → { errors: ScheduleIssue[], warnings: ScheduleIssue[] }
```

| Mã | Loại | Điều kiện | Nguồn |
| --- | --- | --- | --- |
| `STATUS_LOCKED` | lỗi | `rental.status ∉ {DRAFT, CONFIRMED, CONTRACT_CREATED, READY_FOR_HANDOVER}` | `RC-BR-01`, UC-RC-06/07 §tiên quyết |
| `INVALID_PERIOD` | lỗi | `expectedReturn ≤ pickup` | `RM-BR-03`, UC-RM-10 |
| `PICKUP_IN_PAST` | lỗi | `pickup < now` (giả định G1) | — |
| `VEHICLE_UNAVAILABLE` | lỗi | xe đích `MAINTENANCE`/`INACTIVE` (cả dời lịch trên cùng xe lẫn đổi xe) | `RC-BR-04`, UC-RC-08 |
| `VEHICLE_BLOCKED` | lỗi | khoảng mới chồng Vehicle Block `ACTIVE` của xe đích | RM §57, `RC-BR-15` |
| `OVERLAP` | lỗi | chồng thời gian với lượt khác **đang chiếm xe** cùng xe (bỏ qua chính lượt đang sửa); trả danh sách lượt gây xung đột | `RC-BR-02/05`, `BR-001` |
| `BUFFER_VIOLATION` | cảnh báo **cần lý do** | không chồng, nhưng cách lượt liền kề < 90' | `RC-BR-13`, RM §12 |
| `OUTSIDE_RECEIVING_WINDOW` | cảnh báo | giờ trả dự kiến sau 23:00 hoặc trước 08:00 (+07) | RM §51 (giả định G3) |
| `DURATION_CHANGED` | cảnh báo | `rentalDurationDays(mới) ≠ rental.rentalDurationDays` (snapshot) — giá không tự đổi | `RC-BR-06`, UC-RC-06 bước 5 |
| `VEHICLE_CLASS_DIFFERS` | cảnh báo | đổi xe sang hạng khác `rental.vehicleClass` (snapshot) — giá/km không tự đổi | `RC-BR-06`, UC-RC-07 bước 4 |
| `CONTRACT_EXISTS` | cảnh báo | trạng thái `CONTRACT_CREATED`/`READY_FOR_HANDOVER` (hợp đồng đã sinh theo xe/thời gian cũ) | UC-RC-07 A2/A3 |
| `NO_CHANGE` | lỗi | không đổi gì | — |

Kèm: `classifyConflicts(rentals, vehicleId, start, end, excludeId)` → `{ overlaps, bufferViolations }` — tách "chồng" và "vi phạm đệm" (`hasConflict()` hiện gộp cả hai).
`canRescheduleRental(rental)` / `RESCHEDULABLE_STATUSES` cho UI ẩn tay kéo.

**Vehicle Block ở đâu (tránh vòng import):** `rentals` không được import `calendar` (đã có `calendar → rentals`). Tách **file lá**
`features/calendar/blockRules.ts` (chỉ chứa type `VehicleBlock`, `VEHICLE_BLOCKS_STORAGE_KEY`, `isVehicleBlockedForPeriod`, `blockEndBound`; **không** import `rentals`);
`calendar/model.ts` re-export để không đổi chỗ dùng cũ; `rentals/api.ts` import sâu `@/features/calendar/blockRules` (**ngoại lệ C1**, tiền lệ
`incidents/storageKeys.ts`). Hàm thuần `evaluateScheduleChange` nhận `vehicleBlocks` làm tham số (không tự đọc storage).

### 3.3. API — `rentals/api.ts` (bọc `fakeRequest`, đọc qua `storage.ts`)

```text
rescheduleRental(id, { pickupDateTime, expectedReturnDateTime, expectedUpdatedAt, overrideReason? }, actor)
changeRentalVehicle(id, { vehicleId, pickupDateTime?, expectedReturnDateTime?, expectedUpdatedAt, overrideReason? }, actor)
```

- Kiểm `can(actor.role, 'RENTAL', 'EDIT')` → lỗi nếu không có quyền.
- `rental.updatedAt !== expectedUpdatedAt` → lỗi "Dữ liệu lượt thuê đã thay đổi, vui lòng tải lại" (EX-03).
- Đọc lại xe đích (`vehicles/api`), toàn bộ lượt (`readAll`), khoá xe (`blockRules`) → `evaluateScheduleChange`; còn `errors` → ném lỗi (thông điệp `vi`);
  `BUFFER_VIOLATION` mà thiếu `overrideReason` (sau `trim`) → ném lỗi.
- Ghi: chỉ đổi `pickupDateTime`/`expectedReturnDateTime`/`vehicleId` + `updatedAt`. **Không** đổi bất kỳ trường snapshot nào (`rentalDurationDays`, `baseAmount`,
  `allowedKm`, `vehicleClass`, `pricePerKm`, `estimatedTotal`, `prepaymentAmount`…) — `RC-BR-06`.
- `appendAudit`: `RESCHEDULE_RENTAL` / `CHANGE_RENTAL_VEHICLE` (nối **cuối** `AUDIT_ACTIONS`), `before`/`after` = các trường đổi; `after` thêm `overrideReason`,
  `warnings` (mã). Cùng `correlationId` với audit phân công (dưới).
- Dời lịch (đổi thời gian) → gọi `shiftAssignmentWindowsForRental(rentalId, { pickupDeltaMs, returnDeltaMs }, actor, correlationId)` của `employees`:
  phân công `ASSIGNED` vai trò `DELIVERY` dời theo độ lệch giờ giao, `RECEIVING` theo độ lệch giờ trả (giả định G5); trạng thái khác không đổi; mỗi phân công
  đổi → audit `UPDATE_ASSIGNMENT_WINDOW`; trả về danh sách trùng lịch nhân viên (cảnh báo `EA-BR-10`, không chặn). Đổi xe **không** đổi phân công.
  `rentals/api → @/features/employees` (barrel dữ liệu) là **cạnh ghi chéo feature mới (ngoại lệ C2)** — `employees` không import runtime `rentals` (chỉ `import type`)
  nên không tạo vòng; `import/no-cycle` sẽ chặn nếu sai.
- Hooks: `useRescheduleRental`, `useChangeRentalVehicle` (invalidate `['rentals']`, `['assignments']`, `['notifications']`). Export qua `rentals/index.ts`
  cùng `evaluateScheduleChange`, `classifyConflicts`, `canRescheduleRental`.

### 3.4. Giao diện

- **`CalendarDayGrid`** (mới): hàng xe × trục giờ ngang 24h; cuộn ngang trên màn hẹp; khung 07–20 tô nhạt; vạch 21:00; block lượt + vùng đệm + Vehicle Block.
  Bố cục tính bằng hàm thuần mới ở `calendar/model.ts`: `dayTimelineLayout(dateKey, rentals, blocks)` → `{ vehicleId, items: { rentalId, leftPct, widthPct, clippedStart, clippedEnd } }`.
- **`CalendarAgendaList`** (mới): nhóm theo ngày (`agendaGroups(rentals, fromKey, toKey)` — hàm thuần), mỗi dòng: giờ giao → trả, biển số, khách, trạng thái, nhấp →
  popover/chi tiết như block. Phân trang 25 dòng/nhóm (`shared/lib/pagination.ts`) nếu dài.
- **Kéo–thả** (`features/calendar/components/CalendarDndProvider.tsx` + `useDraggable`/`useDroppable` trong 3 lưới): chỉ hiện tay kéo khi
  `can('RENTAL','EDIT') && canRescheduleRental(r)`. Quy đổi vị trí thả → đề xuất bằng hàm thuần (`calendar/model.ts`):
  - `proposalFromDayShift(rental, dayDelta, targetVehicleId)` — Week/Month: dời **nguyên ngày**, giữ giờ:phút (+07), đổi hàng = đổi xe.
  - `proposalFromTimeShift(rental, minuteDelta, targetVehicleId, edge?)` — Day: bước **30'**; `edge = 'start' | 'end'` khi kéo cạnh (đổi thời lượng).
  - Lượt nhiều ngày ở Week/Month vẽ thành nhiều mảnh: kéo **mảnh bất kỳ** = dời cả lượt theo độ lệch ngày của mảnh đó.
- **`RentalScheduleChangeDialog`** (mới): form `react-hook-form` + `zod` (schema ở `rentals/model.ts` hoặc `calendar/model.ts`), ô `datetime-local` qua
  `isoToDateTimeInput`/`dateTimeInputToIso`, chọn xe; hiển thị cũ → mới, danh sách cảnh báo (nhãn `vi`), ô lý do khi `BUFFER_VIOLATION`; lỗi xung đột kèm nút mở
  lượt / khoá gây xung đột. Dùng cho cả kéo–thả (điền sẵn) và menu.
- **Menu**: `RentalBlockPopover` thêm 2 nút "Dời lịch", "Đổi xe" (gate như tay kéo).
- **`RentalPricingTab`** (rentals): dòng thông báo khi `rentalDurationDays(kỳ hiện tại) ≠ snapshot` hoặc hạng xe hiện tại ≠ `vehicleClass` snapshot — chỉ hiển thị,
  `TODO(OQ: RentalCalendar-BRD.md §35 Q9)`.
- **Ghi nhớ chế độ xem + bộ lọc**: `features/calendar/store.ts` (Zustand `persist`, key trong namespace `tbc_admin:*` qua `storage.ts`-compatible adapter như
  `auth/store.ts`).
- Responsive (CONVENTIONS §8): 375 px — lưới cuộn ngang trong khung riêng, block đủ cao để nhấn giữ; hộp thoại toàn màn hình trên điện thoại (`Dialog` sẵn có).

### 3.5. Quyền & audit

- Quyền duy nhất cho dời/đổi: `RENTAL.EDIT` (không đổi `permissions.ts`). Xem lịch vẫn `CALENDAR.VIEW` (route guard sẵn có). `DISPATCHER` kéo được nhưng
  **không** mở được Chi tiết lượt thuê (Q20 / OQ-G1 của Phase 6.1) → hộp thoại phải đủ thông tin; nút "mở lượt gây xung đột" chỉ hiện khi `can('RENTAL','VIEW')`.
- 3 audit action mới, nối **cuối** `AUDIT_ACTIONS` + nhãn ở `shared/i18n/auditLabels.ts`: `RESCHEDULE_RENTAL`, `CHANGE_RENTAL_VEHICLE` (entity `Rental`),
  `UPDATE_ASSIGNMENT_WINDOW` (entity `Assignment`). Hiện ở tab Nhật ký của lượt thuê và màn Nhật ký thao tác (module suy từ entity — sẵn có).

---

## 4. Ngoại lệ kiến trúc cần duyệt

| # | Ngoại lệ | Lý do / phương án khác |
| --- | --- | --- |
| C1 | `rentals/api.ts` import sâu `@/features/calendar/blockRules` (file lá mới tách từ `calendar/model.ts`) | Kiểm khoá xe phải nằm ở API (UC-RC-08), mà `calendar` đã import `rentals` → qua barrel `calendar` sẽ tạo vòng. Tiền lệ: `incidents/storageKeys.ts`. Phương án khác: chuyển entity Vehicle Block sang `vehicles` (đúng chủ sở hữu theo RM §57 "thuộc VehicleManagement") — sửa nhiều hơn, không đề xuất trong Round này. |
| C2 | `rentals/api.ts` ghi sang `employees` (dời `Planned Window` — `EA-BR-14`) qua barrel dữ liệu `@/features/employees` | Quy tắc thuộc Rental (bất kể dời từ đâu). Phương án khác: điều phối ở `calendar` (gọi 2 API lần lượt) — logic nghiệp vụ nằm ở UI hook, bỏ sót khi sau này dời lịch từ màn khác. |
| C3 | `CalendarScreen` chuyển tải lười (D11) | Giữ tải đầu dưới trần khi thêm `@dnd-kit` (§2.2). Có tiền lệ, không phải ngoại lệ mới — ghi để người dùng biết lần mở Lịch đầu tiên tải thêm ~65–75 kB (chunk Lịch ~25 kB + `@dnd-kit` ~40 kB + màn mới). |

---

## 5. Open Question — giả định tạm (đặt `TODO(OQ: …)` tại code, không tự chốt)

| # | Câu hỏi | Giả định tạm | Nguồn / cần ai |
| --- | --- | --- | --- |
| Q1 | Có cho dời/đổi xe lượt `CONFIRMED`/`CONTRACT_CREATED`/`READY_FOR_HANDOVER`, hay chỉ `DRAFT`? | Cho cả 4 trạng thái theo **tiên quyết UC-RC-06/07** + hộp thoại xác nhận + cảnh báo hợp đồng | RC §35 **Q8** (còn treo) — BA/khách |
| Q2 | Dời lịch làm đổi số ngày → giá xử lý thế nào? Màn sửa giá ở đâu? | Giữ nguyên snapshot (giá, km cho phép, hạng xe); cảnh báo trong hộp thoại + thông báo ở tab Giá lượt thuê. Không có màn sửa giá (ngoài phạm vi) | RC **Q9**, `RC-BR-06` — BA/khách |
| Q3 | Đổi sang xe khác hạng trước giao: áp `Price Per KM`/`Allowed KM` theo hạng xe mới hay giữ snapshot? | Giữ snapshot + cảnh báo `VEHICLE_CLASS_DIFFERS` | `RC-BR-06`, CR-2026-008 — BA |
| Q4 | Lượt đã có hợp đồng (`CONTRACT_CREATED`/`READY_FOR_HANDOVER`): tự huỷ/tạo lại hợp đồng hay để người dùng? | Chỉ cảnh báo + liên kết sang hợp đồng (UC-RC-07 A3) | `CT` §12, UC-RC-07 A3 — BA |
| Q5 | Lượt `READY_FOR_HANDOVER` đã có nhân viên chuẩn bị giao: dời có cần thêm bước gì (báo nhân viên)? | Không thêm; phân công dời `Planned Window` (`EA-BR-14`) | EA — BA |
| G1 | Có cho dời giờ giao về **quá khứ**? | Không (lỗi `PICKUP_IN_PAST`) | Giả định kỹ thuật — BA xác nhận |
| G2 | Xe đích `MAINTENANCE`/`INACTIVE` khi **dời lịch trên cùng xe** (không đổi xe) có bị chặn? | Có — UC-RC-08 kiểm "Vehicle Status" cho mọi thao tác tạo/dời/đổi | `RC-BR-04` diễn giải — BA |
| G3 | Giờ trả dự kiến sau 23:00 / trước 08:00: chặn hay cảnh báo? | Cảnh báo (RM §51 mô tả phụ thu, không cấm) | RM §51, §46 — BA |
| G4 | Ghi đè vùng đệm 90': ai được ghi đè? Có giới hạn tối thiểu? | Mọi vai trò có `RENTAL.EDIT`, bắt buộc lý do, audit; không giới hạn | `RC-BR-13` ("điều phối viên có thể ghi đè kèm lý do") — BA |
| G5 | Dời lịch: `Planned Window` phân công dời theo quy tắc nào? | `DELIVERY` dời theo độ lệch giờ giao, `RECEIVING` theo độ lệch giờ trả; chỉ phân công `ASSIGNED` | `EA-BR-14` (không nêu cách dời) — BA |
| G6 | Thông báo (Trung tâm thông báo) có cần sự kiện riêng "lượt bị dời"? | Không — tín hiệu tính động sẽ tự cập nhật theo giờ mới | NT — BA |
| G7 | Chế độ Ngày: khung giờ làm việc tô nổi 07:00–20:00 có cấu hình không? | Cố định 07:00–20:00 (ví dụ của RC §25), hằng trong `calendar/model.ts` | RC §25 — BA |

---

## 6. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Kéo–thả cảm ứng xung đột với cuộn lưới | `TouchSensor` nhấn giữ 300 ms; **menu "Dời lịch / Đổi xe"** luôn có — chức năng không phụ thuộc kéo được hay không. |
| Logic kiểm tra lệch giữa UI và API | Một hàm thuần `evaluateScheduleChange` dùng ở cả hai; API kiểm lại. Harness gọi thẳng API. |
| Ghi nửa vời (Rental đổi nhưng phân công chưa đổi) | Kiểm toàn bộ trước mọi ghi (bài học N4); thứ tự ghi Rental → phân công; lỗi phân công không được xảy ra sau khi đã kiểm. |
| Vòng import mới (`rentals ↔ calendar/employees`) | File lá `blockRules.ts`; `import/no-cycle` + `sccfiles.mjs` là cổng DoD. |
| Tải đầu vượt trần | Lịch tải lười; đo `initial-load.mjs` mỗi Round. |
| Lưới Week/Month vẽ lượt nhiều ngày thành nhiều mảnh → khó kéo | Kéo mảnh nào cũng dời cả lượt theo độ lệch ngày; hộp thoại hiển thị lại toàn bộ khoảng để người dùng kiểm. |
| Dữ liệu seed có xung đột sẵn (`rt_010`/`vblk_001`, `rt_008`/`rt_009`) | Dùng làm ca test; dời các lượt này phải báo đúng lỗi/cảnh báo. Không sửa seed. |
| Đổi xe sau khi đã ký hợp đồng làm hợp đồng lệch thực tế | Cảnh báo bắt buộc trong hộp thoại (Q4). |

---

## 7. Chia Round

| Round | Nội dung | Rủi ro | Ước lượng file |
| --- | --- | --- | --- |
| **A — Xem Ngày + Agenda + tải lười Lịch + nhớ chế độ xem** | P1, P2, P3, C3. Chỉ đọc. | Thấp | ~9: `calendar/screens/{lazyScreens.ts (mới), CalendarScreen.tsx}`, `calendar/ui.ts`, `calendar/components/{CalendarDayGrid, CalendarAgendaList}.tsx` (mới), `calendar/model.ts` (`dayTimelineLayout`, `agendaGroups`), `calendar/store.ts` (mới), `app/routes.tsx` (`<Suspense>`), `shared/i18n/vi.ts` |
| **B1 — Dời lịch / đổi xe qua hộp thoại (chưa kéo)** | P4, P5, P6 (đường menu), P8, P9, P10, C1, C2. Toàn bộ nghiệp vụ + API + audit. | Vừa — đây là phần nghiệp vụ | ~16: `rentals/{model,api,hooks,index}.ts`, `rentals/components/RentalPricingTab.tsx`, `calendar/blockRules.ts` (mới), `calendar/model.ts` (re-export), `calendar/components/{RentalScheduleChangeDialog (mới), RentalBlockPopover}.tsx`, `employees/{api,model,index}.ts`, `shared/domain/enums.ts`, `shared/i18n/{vi,auditLabels}.ts` |
| **B2 — Kéo–thả** | P7: `@dnd-kit/core` trên Week/Month/Day, quy đổi vị trí thả → đề xuất → **dùng lại hộp thoại B1**. | Vừa (tương tác) — nghiệp vụ đã khoá ở B1 | ~7: `calendar/components/{CalendarDndProvider (mới), CalendarWeekGrid, CalendarMonthGrid, CalendarDayGrid}.tsx`, `calendar/model.ts` (`proposalFromDayShift`, `proposalFromTimeShift`), `calendar/screens/CalendarScreen.tsx`, `vi.ts` |
| *(C — đề xuất plan riêng)* | Đổi xe giữa kỳ UC-RM-22 + `RC-BR-14` + phụ lục `ADDENDUM_VEHICLE_SWAP` + chênh lệch giá CR-2026-063 | Cao — đổi cấu trúc `Rental`, `SEED_VERSION`, chạm `RM`/`CT`/`PM`/`VH`/`VR` | Ước lượng sau khi có OQ §10 |

Thứ tự **A → B1 → B2**: A giảm tải đầu trước khi thêm thư viện; B1 khoá nghiệp vụ và kiểm được hoàn toàn bằng harness (không cần kéo); B2 chỉ còn là cử chỉ
gọi lại đường B1. Các Round chạy liên tục nếu người dùng duyệt cả gói.

---

## 8. Definition of Done (đo được)

### 8.1. Chung mọi Round

1. `npx tsc -b` · `npx oxlint` (có `import/no-cycle`) · `npm run build` sạch; `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. `node $SP/consignment-r3/sccfiles.mjs $REPO` **rỗng** (SCC = 0); `evalorder` OK cho `/src/app/routes.tsx` và mọi `index.ts`/`ui.ts` bị sửa.
3. `node $SP/hardening/initial-load.mjs $REPO` ≤ **1.870.000** và ≤ ngân sách Round. Ban đầu (§2.2): A ≤ 1.835.000; B1 ≤ A + 2.000; B2 ≤ B1 + 500.
   **Đặt lại sau Round A (§13.9, thực tế A = 1.834.102):** B1 ≤ **1.844.000** (API + hàm kiểm tra + chuỗi `vi` + thông báo tab Giá nằm ở chunk chính); B2 ≤ **B1 + 1.000**
   (`@dnd-kit` trong chunk Lịch lười).
4. Seed **không đổi**: `dump-seed.mjs` HCM → `diff-seed` so `$SP/hardening/base-r3a-hcm.json` = 0 (`SEED_VERSION` giữ 27).
5. `run-harness.sh` dưới `Asia/Ho_Chi_Minh`, `UTC`, `America/New_York` so `$SP/hardening/baseline-r3a` (đối số 5 = `Asia/Ho_Chi_Minh`) → 24/24 `diff=0`
   (Round B1 thêm 3 audit action: nếu harness cũ đếm audit theo danh sách cố định thì báo, không sửa harness).
6. `guard-r1.mjs` ALL PASS (không route mới; `/calendar` vẫn 1 nhóm guard).
7. `tz-scan.mjs`: 5 nhóm cấm = 0 ngoài `datetime.ts` (quy tắc múi giờ áp cho file mới).
8. Chuỗi UI mới ở `vi.ts`; enum/audit nối cuối; mọi ghi qua `fakeRequest` + `appendAudit`; không `localStorage` trực tiếp; không `role ===`.

### 8.2. Round A

- Harness `$SP/cal3/cal-r3a.mjs` (3 TZ, output giống hệt): `dayTimelineLayout('2026-10-22', …)` — `rt_019` (giao 06:00 +07) bắt đầu ở 25% trục; lượt nhiều ngày bị cắt
  đúng mép ngày; `agendaGroups` tuần 19–25/10 đếm đúng số lượt mỗi ngày (in bảng, khớp `rentalsByVehicleInRange`).
- Tải đầu ≤ 1.835.000 B; có chunk `CalendarScreen-*.js` riêng.

### 8.3. Round B1 — harness `$SP/cal3/cal-r3b1.mjs` (gọi thẳng `rentals/api.ts`, actor `MANAGER` trừ ca quyền; khôi phục store trước mỗi ca)

| Ca | Thao tác | Kỳ vọng |
| --- | --- | --- |
| T1 | dời `rt_011` (`CONFIRMED`, `veh_016`) +1 ngày | thành công; audit `RESCHEDULE_RENTAL`; **mọi trường snapshot giữ nguyên**; cảnh báo không có `DURATION_CHANGED` |
| T2 | đổi xe `rt_011` → `veh_012` | lỗi `OVERLAP`, kèm `rt_009`; không ghi gì |
| T3 / T4 | đổi xe `rt_011` → `veh_007` (`MAINTENANCE`) / `veh_013` (`INACTIVE`) | lỗi `VEHICLE_UNAVAILABLE` |
| T5 | đổi xe `rt_011` → `veh_014` | lỗi `VEHICLE_BLOCKED` (`vblk_001`) |
| T6 | dời `rt_016` (`HANDED_OVER`) | lỗi `STATUS_LOCKED` |
| T7 | dời `rt_009` +30' (vẫn < 90' sau `rt_008`) không lý do / có lý do | lỗi thiếu lý do / thành công, audit có `overrideReason` |
| T8 | dời với `expectedUpdatedAt` cũ | lỗi dữ liệu đã thay đổi; không ghi gì |
| T9 | dời `rt_006` (`CONFIRMED`, `asg_001` `DELIVERY` `ASSIGNED`) +1 ngày | `asg_001` dời đúng +1 ngày; audit `UPDATE_ASSIGNMENT_WINDOW` cùng `correlationId` |
| T10 | dời `rt_006` về hôm qua | lỗi `PICKUP_IN_PAST` |
| T11 | giờ trả 23:30 | thành công + cảnh báo `OUTSIDE_RECEIVING_WINDOW` |
| T12 | đổi xe `rt_013` (`CONTRACT_CREATED`, `asg_004` `RECEIVING`) sang xe trống | thành công + cảnh báo `CONTRACT_EXISTS`; `asg_004` **không** đổi |
| T13 | đổi xe `rt_011` (`TWO_SEATER`) sang xe `STANDARD` trống | cảnh báo `VEHICLE_CLASS_DIFFERS`; snapshot giữ nguyên |
| T14 | kéo dài `rt_011` thêm 1 ngày | cảnh báo `DURATION_CHANGED`; `rentalDurationDays` snapshot giữ nguyên |
| T15 | actor `ACCOUNTANT` / `OPERATION_STAFF` | lỗi quyền |
| T16 | dời `rt_010` (đang nằm trong `vblk_001`) | lỗi `VEHICLE_BLOCKED` (xung đột có sẵn không được "lách") |
| T17 | gọi `evaluateScheduleChange` với cùng đầu vào T1–T16 | trùng kết quả API (UI và API dùng chung một hàm) |

Mỗi ca lỗi: so JSON `rentals`/`assignments`/`audit` trước–sau **y hệt**. `dev` xác nhận "xe trống" ở T12/T13 bằng `peek.mjs` và ghi id đã chọn.

### 8.4. Round B2

- Harness `$SP/cal3/cal-r3b2.mjs` (3 TZ, output giống hệt): `proposalFromDayShift` (±1, ±3 ngày, đổi hàng; giữ giờ:phút +07 kể cả lượt giao 06:00), `proposalFromTimeShift`
  (bước 30', kéo cạnh đầu/cuối, không cho cạnh đầu vượt cạnh cuối) → đưa vào `evaluateScheduleChange` → kết quả khớp các ca B1 tương ứng.
- Rà tĩnh: tay kéo chỉ render khi `can('RENTAL','EDIT') && canRescheduleRental`; thả đều đi qua `RentalScheduleChangeDialog` (grep: không có lời gọi API ghi nào trong
  file lưới).
- Bảng rà cảm ứng/responsive trong báo cáo (đọc code): sensor, `touch-action`, 375/768 px.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026). Người dùng tự kiểm kéo–thả bằng chuột và cảm ứng sau bàn giao.

---

## 9. File dự kiến tạo / sửa (tổng hợp)

| Round | Tạo | Sửa |
| --- | --- | --- |
| A | `calendar/screens/lazyScreens.ts`, `calendar/components/CalendarDayGrid.tsx`, `calendar/components/CalendarAgendaList.tsx`, `calendar/store.ts` | `calendar/ui.ts`, `calendar/screens/CalendarScreen.tsx`, `calendar/model.ts`, `app/routes.tsx`, `shared/i18n/vi.ts` |
| B1 | `calendar/blockRules.ts`, `calendar/components/RentalScheduleChangeDialog.tsx` | `rentals/{model,api,hooks,index}.ts`, `rentals/components/RentalPricingTab.tsx`, `calendar/model.ts`, `calendar/components/RentalBlockPopover.tsx`, `employees/{api,model,index}.ts`, `shared/domain/enums.ts`, `shared/i18n/{vi,auditLabels}.ts` |
| B2 | `calendar/components/CalendarDndProvider.tsx` | `calendar/components/{CalendarWeekGrid,CalendarMonthGrid,CalendarDayGrid}.tsx`, `calendar/model.ts`, `calendar/screens/CalendarScreen.tsx`, `shared/i18n/vi.ts` |
| Docs (`tech-lead` khi bàn giao) | — | `docs/CALENDAR-MANAGEMENT-PLAN.md` (trỏ sang file này), `docs/ARCHITECTURE.md` §7 (Lịch tải lười), `docs/IMPLEMENTATION-PLAN.md`, `CHANGELOG.md`, file này |

---

## 10. Round C (đề xuất tách plan riêng) — Đổi xe giữa kỳ (UC-RM-22, CR-2026-012/063)

Chỉ phác thảo để người dùng quyết có làm không (§12 câu 2):

- **Kích hoạt:** nút "Đổi xe giữa kỳ" ở Chi tiết lượt thuê `IN_RENTAL` (và menu block trên lịch) — **không** qua kéo–thả (`RC-BR-01`).
- **Dữ liệu:** `Rental` thêm lịch sử xe theo đoạn (`vehicleSegments: { vehicleId, from, to }[]`) để lịch vẽ block ở hàng xe cũ tới mốc đổi và hàng xe mới từ mốc đổi
  (`RC-BR-14`) → **bump `SEED_VERSION`**; xe gốc → `MAINTENANCE` (+ `Incident` nếu có); xe mới → `RENTED`.
- **Hợp đồng:** sinh `ContractAddendum` `ADDENDUM_VEHICLE_SWAP` (xe mới, mốc thời gian, chênh lệch giá) — `contracts` hiện chỉ đọc phụ lục, cần API tạo.
- **Tiền (CR-2026-063):** xe mới giá cao hơn → khách trả chênh lệch (Payment Request thu thêm); thấp hơn → giữ giá hợp đồng. **Xe không có bảng giá** (`rentalRate` nhập
  tay mỗi lượt) → giá xe mới phải **nhập tay** trong hộp thoại.
- **OQ phải chốt trước:** cách tính chênh lệch (× số ngày còn lại tính từ mốc đổi? làm tròn ngày?); thu ngay hay gộp quyết toán; `Allowed KM`/`Price Per KM` sau đổi
  (theo hạng xe nào, cộng dồn odo 2 xe ra sao — VR §15); giao/nhận ở hiện trường là việc App nhân viên (Webapp chỉ ghi nhận?); phí huỷ giữa kỳ + xử lý cọc vẫn treo
  (RM §46 Q39); đề xuất xe thay thế "cùng hạng / giá ngày ≥ xe gốc" khi xe không có giá ngày.

---

## 11. Quyết định kỹ thuật (`tech-lead`)

| # | Quyết định | Lý do |
| --- | --- | --- |
| K1 | Một đường xử lý (hàm thuần → hộp thoại → API) cho cả kéo–thả và menu | Kiểm được bằng harness không cần trình duyệt; cảm ứng/không kéo được vẫn dùng được; bắt buộc xác nhận theo UC. |
| K2 | `@dnd-kit/core` + Lịch tải lười | §2. |
| K3 | API kiểm lại toàn bộ + so `updatedAt` | UC-RC-08 chạy lại khi lưu; EX-03. |
| K4 | Không động vào snapshot giá trong mọi trường hợp | `RC-BR-05/06`. |
| K5 | Tách "chồng" và "vi phạm đệm" ở hàm mới, không sửa `hasConflict()` | Tránh đổi hành vi tạo lượt ngoài phạm vi. |
| K6 | Thứ tự Round A → B1 → B2 | §7. |

---

## 12. Điểm người dùng cần quyết trước khi giao `dev` — **đã chốt 25/10/2026**

> **Quyết định của người dùng (25/10/2026, qua điều phối viên):** chấp nhận **cả 5 điểm theo đề xuất** — (1) thứ tự A → B1 → B2, chạy liên tục; (2) đổi xe giữa kỳ tách
> plan riêng (Round C), chưa làm; (3) Q1–Q5, G1–G7 là giả định demo, BA chốt sau; (4) duyệt ngoại lệ **C1**, **C2**, **C3**; (5) dùng `@dnd-kit/core`.


1. **Phạm vi & thứ tự Round:** A (Ngày + Agenda + tải lười) → B1 (dời/đổi xe qua hộp thoại) → B2 (kéo–thả), chạy liên tục. *Đề xuất: duyệt.*
2. **Đổi xe giữa kỳ (UC-RM-22, phụ lục, chênh lệch giá):** ngoài phạm vi Round 3 vì `RC-BR-01` cấm trên lịch; đề xuất **plan riêng (Round C, §10)** sau khi BA chốt OQ ở §10.
   *Đề xuất: tách, chưa làm.*
3. **Giả định nghiệp vụ tạm** Q1–Q5, G1–G7 (§5) — đặc biệt Q1 (cho dời cả lượt đã xác nhận/có hợp đồng), Q2/Q3 (giữ nguyên giá, chỉ cảnh báo), G4 (ghi đè vùng đệm
   có lý do). *Đề xuất: duyệt làm giả định demo, BA chốt sau.*
4. **Ngoại lệ kiến trúc C1, C2** (§4) + tải lười Lịch (C3). *Đề xuất: duyệt.*
5. **Thư viện:** `@dnd-kit/core` (đã có, +39,8 kB trong chunk Lịch lười, tải đầu giảm ~22 kB nhờ C3). *Đề xuất: duyệt.*

---

## 13. Round A — brief giao việc cho `dev` (`APPROVED` 25/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 13.1. Bối cảnh

Lịch (`/calendar`) hiện có 2 chế độ xem: **Week** (mặc định) và **Month**, cùng tạo nhanh lượt thuê và khoá xe. Tài liệu yêu cầu thêm 2 chế độ **Day** và **Agenda**
(`RentalCalendar-BRD.md` §8, `RC-BR-16`, `WebappQuanTri.md` §8.2), và yêu cầu nhớ chế độ xem + bộ lọc giữa các lần mở (RC §8 "Yêu cầu chung").

Round A **chỉ đọc**: không có thao tác ghi mới, không có kéo–thả. Kéo–thả và dời lịch thuộc B1/B2.

Round A cũng chuyển `CalendarScreen` sang **tải lười** (ngoại lệ C3 đã duyệt). Mục đích: giải phóng tải đầu `/dashboard` trước khi B2 thêm `@dnd-kit/core`.
Đo thử: tải đầu 1.854.198 → 1.831.763 B.

Quyết định người dùng 25/10/2026 (§12): duyệt cả 5 điểm. Giả định G7 (khung giờ làm việc cố định 07:00–20:00) áp ở Round này.

### 13.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §13.5)

1. **Tải lười `CalendarScreen`** (C3, mẫu D11 — `docs/ARCHITECTURE.md` §7):
   - Tạo `src/features/calendar/screens/lazyScreens.ts` export bản `React.lazy`.
   - `src/features/calendar/ui.ts` export bản lazy, giữ tên `CalendarScreen`.
   - `src/app/routes.tsx` bọc `<Suspense fallback=…>` **bên trong** khối `RequirePermission` của `calendar`, giống các màn lười khác.
   - `DispatchBoardScreen` giữ import tĩnh.
2. **Kiểu chế độ xem:** `CalendarView` (`calendar/model.ts`) mở rộng thành `'day' | 'week' | 'month' | 'agenda'`.
   - `shiftAnchor`: `day` = ±1 ngày; `agenda` = ±7 ngày (cùng phạm vi tuần với Week); `week`/`month` giữ nguyên.
   - Thêm `viewRange(anchorKey, view)` → `{ fromKey, toKey }` (hàm thuần). Phạm vi: `day` = 1 ngày; `week`/`agenda` = `weekDayKeys`; `month` = cả tháng.
3. **Hàm thuần mới ở `calendar/model.ts`** (chỉ dùng helper `shared/lib/datetime.ts`):
   - `WORKING_HOURS = { start: 7, end: 20 }`. Comment: `// TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 G7) — RC §25 ví dụ 07:00–20:00, chưa cấu hình`.
     Cùng chỗ khai `STANDARD_HANDOVER_HOUR = 21` (CR-2026-005, RM §51).
   - `dayTimelineLayout(dateKey, rentals, blocks, vehicles)` → mỗi xe:
     - lượt thuê: `{ rentalId, leftPct, widthPct, continuesBefore, continuesAfter }` — cắt theo 00:00–24:00 (+07) của ngày;
     - vùng đệm 90' sau giờ trả dự kiến: `{ leftPct, widthPct }` (RC-BR-13);
     - Vehicle Block `ACTIVE` phủ ngày: `{ blockId }` (cả ngày).
   - `agendaGroups(rentals, fromKey, toKey)` → `[{ dateKey, rentals[] }]`:
     - mỗi lượt xếp vào **ngày giao** (`toDateKey(pickupDateTime)`) nếu ngày đó nằm trong phạm vi;
     - lượt bắt đầu **trước** phạm vi nhưng còn chạy trong phạm vi: xếp vào ngày đầu phạm vi, đánh dấu `continuing: true`;
     - sắp theo giờ giao.
   - `timeFromDayPosition(dateKey, pct)` → ISO, làm tròn **30'** (+07). Dùng cho tạo nhanh khi nhấp ô trống ở chế độ Day (RC §13).
4. **`src/features/calendar/components/CalendarDayGrid.tsx`** (mới):
   - Mỗi xe một hàng, trục giờ **ngang** 24h, cột tiêu đề giờ 00…23.
   - Khung làm việc tô nhạt bằng token theme. Vạch dọc **21:00**. Vạch "bây giờ" nếu ngày đang xem là hôm nay.
   - Block lượt theo màu trạng thái hiện có. Vùng đệm và Vehicle Block vẽ giống Week.
   - Nhấp block → `RentalBlockPopover` hiện có. Nhấp chỗ trống → tạo nhanh (cùng luồng `onEmptyCellClick` + `RentalQuickCreateGate` của Week), giờ lấy theo
     `timeFromDayPosition`.
   - Ẩn xe `INACTIVE` theo bộ lọc hiện có. Cuộn ngang trong khung riêng (`overflow-x-auto`), không cuộn cả trang.
5. **`src/features/calendar/components/CalendarAgendaList.tsx`** (mới):
   - Nhóm theo ngày (`agendaGroups`). Mỗi dòng: giờ giao → giờ trả (`formatDateTime`/`formatTime`), biển số, khách, `RentalStatusBadge`, nhãn "Đang tiếp diễn" nếu
     `continuing`.
   - Nhấp dòng → `RentalBlockPopover`. Dòng khớp tìm kiếm được làm nổi giống block.
   - Nhóm trống → không vẽ. Cả phạm vi trống → trạng thái rỗng.
   - Phân trang 25 dòng (`shared/lib/pagination.ts` + `shared/ui/pagination.tsx`) **trên toàn danh sách phẳng** nếu > 25 dòng.
   - Trên điện thoại hiển thị dạng thẻ (`md:` bảng).
6. **`src/features/calendar/store.ts`** (mới — Zustand `persist`, CONVENTIONS §5, mẫu `features/auth/store.ts`):
   - Key `tbc_admin:calendarPrefs`.
   - Chỉ lưu: `view`, `vehicleFilter`, `showCancelled`, `showNoShow`, `showInactiveVehicles`.
   - **Không** lưu `anchorKey` — mở lại luôn về hôm nay. **Không** lưu `search`.
   - Mặc định `view: 'week'` (RC-BR-16).
   - `CalendarScreen` thay các `useState` tương ứng bằng store.
7. **`CalendarScreen.tsx`:**
   - Tabs 4 chế độ, thứ tự **Ngày · Tuần · Tháng · Danh sách** (nhãn `vi`).
   - Đổi chế độ giữ nguyên bộ lọc. Nút "Hôm nay" + tiến/lùi theo chế độ (`shiftAnchor`). Tiêu đề khoảng thời gian theo chế độ.
   - Tìm kiếm → nhảy tới (logic hiện có) phải đúng cho cả `day` và `agenda`: ra ngoài `viewRange` thì đặt `anchorKey` = ngày khớp.
   - Nút "Khoá lịch xe" giữ như cũ (chỉ ở Month).
   - Bỏ dòng doc comment "KHÔNG có Day/Agenda view".
8. **`src/shared/i18n/vi.ts`:**
   - nhãn 2 tab mới;
   - tiêu đề khoảng ngày cho Day;
   - nhãn "Giờ làm việc", "21:00 — khung giao/nhận chuẩn", "Đang tiếp diễn";
   - trạng thái rỗng Agenda.

### 13.3. Ngoài phạm vi Round A (không làm dù "tiện tay")

- Mọi thao tác ghi mới: dời lịch, đổi xe, kéo–thả, `@dnd-kit` (B1/B2).
- Sửa `rentals/*`, `employees/*`, `permissions.ts`, `routeAccess.ts`.
- Thêm route mới — Day/Agenda là chế độ của `/calendar`, không phải route.
- Lưu chế độ xem lên URL.
- Bộ đếm / lọc xung đột (RC §17). Xuất/in.
- Đổi giao diện Week/Month ngoài phần chia sẻ bộ lọc qua store.
- Đổi seed (`SEED_VERSION` giữ 27). Sửa `docs/`. Chạy trình duyệt.

### 13.4. Quy tắc bắt buộc

- `CONVENTIONS.md` §1 (chuỗi `vi`; ngày giờ chỉ qua `datetime.ts` — `tz-scan` nhóm cấm = 0), §3 (2 điểm nhập; route trong `RequirePermission`), §5 (Zustand chỉ cho UI state),
  §8 (theme token, `cn()`, responsive 375/768, `min-w-0` cho chữ dài), §10, §11.
- Hàm bố cục/nhóm là **hàm thuần** ở `model.ts` — component chỉ vẽ. Không đọc `localStorage` trực tiếp (persist qua Zustand như `auth/store.ts`).
- Quyền: tạo nhanh ở Day dùng đúng gate `can('RENTAL','CREATE')` + `RentalQuickCreateGate` như Week. Không thêm entry quyền.
- Mọi file mới dùng 2 điểm nhập: không import sâu feature khác ngoài các deep-import **đã có** trong `CalendarScreen`/`CalendarWeekGrid` (dùng lại đúng các import đó).
- Gặp quyết định nghiệp vụ mới → dừng, báo `tech-lead`.

### 13.5. Thứ tự làm

1. Mục 1 (tải lười) → build → DoD 2 (đo tải đầu **ngay**, ghi số).
2. Mục 2–3 (model + hàm thuần) → `tsc` → DoD 7 (harness).
3. Mục 4–5 (2 component) → mục 6 (store) → mục 7–8.
4. Chạy toàn bộ DoD 1–9.

### 13.6. Definition of Done Round A — chạy đủ và dán kết quả vào báo cáo

Baseline: HEAD `6e863cf` — tải đầu **1.854.198 B** · seed `$SP/hardening/base-r3a-hcm.json` · harness `$SP/hardening/baseline-r3a/` (HCM/UTC/New_York).

1. `npx tsc -b` · `npx oxlint` (có `import/no-cycle`) · `npm run build` sạch (2 cảnh báo cũ). `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. **Tải đầu:** `node $SP/hardening/initial-load.mjs $REPO`.
   - Báo số **sau mục 1** (dự kiến ≈ 1.831.763) và số **cuối Round**.
   - Cả hai ≤ **1.835.000**.
   - Có chunk `dist/assets/CalendarScreen-*.js` riêng; báo kích thước.
3. `node $SP/consignment-r3/sccfiles.mjs $REPO` **rỗng**. `evalorder` OK cho `/src/app/routes.tsx`, `/src/features/calendar/ui.ts`, `/src/features/calendar/index.ts`.
4. **Seed giống hệt:** `TZ=Asia/Ho_Chi_Minh node $SP/hardening/dump-seed.mjs $REPO $SP/cal3/a-hcm.json && node $SP/hardening/diff-seed.mjs $SP/hardening/base-r3a-hcm.json $SP/cal3/a-hcm.json`
   → `TOTAL diff records 0`.
5. **Harness 3 múi giờ:**
   - Lệnh: `bash $SP/hardening/run-harness.sh $REPO <Z> $SP/cal3/a-<Z> $SP/hardening/baseline-r3a Asia/Ho_Chi_Minh`, với `Z` ∈ {`Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`}.
   - Kết quả: **24/24 `diff=0`**.
   - `TZ=Asia/Ho_Chi_Minh node $SP/hardening/guard-r1.mjs $REPO` ALL PASS (route `/calendar` vẫn 1 nhóm guard).
6. `node $SP/hardening/tz-scan.mjs $REPO -v`: 5 nhóm cấm (`LOCAL_GETSET`, `DATEFNS_CAL`, `FORMAT_FNS`, `UTC_SLICE`, `LOCAL_CTOR`) **0 dòng ngoài `shared/lib/datetime.ts`**.
7. **Harness Round A** `$SP/cal3/cal-r3a.mjs` (`dev` viết; `boot()` của `$SP/demo-data/lib.mjs`; gọi thẳng `calendar/model.ts`). Chạy dưới 3 TZ → **output giống hệt nhau**.
   Lưu output HCM vào `$SP/cal3/cal-r3a-expected.txt`. In và kiểm:
   - `viewRange` cho 4 chế độ với anchor `2026-10-22`: day `22/10`, week/agenda `19–25/10`, month `01–31/10`. `shiftAnchor` day ±1, agenda ±7.
   - `dayTimelineLayout('2026-10-22', …)`:
     - `rt_019` (giao 22/10 06:00 +07) có `leftPct` = **25**;
     - một lượt bắt đầu trước 22/10 có `continuesBefore = true`, `leftPct = 0`;
     - vùng đệm ngay sau giờ trả dự kiến, rộng 90' = **6,25%**;
     - xe có Vehicle Block `ACTIVE` phủ ngày được đánh dấu (in id).
   - `agendaGroups(rentals, '2026-10-19', '2026-10-25')`:
     - in số lượt mỗi ngày + số `continuing`;
     - tổng lượt (đếm duy nhất) **bằng** số lượt có trong `rentalsByVehicleInRange` cùng tuần (cùng bộ lọc mặc định ẩn `CANCELLED`/`NO_SHOW`).
   - `timeFromDayPosition('2026-10-22', 0.5)` = `2026-10-22T05:00:00.000Z` (12:00 +07); `0.51` làm tròn 30' đúng.
8. **Rà tĩnh** trong báo cáo:
   - `CalendarScreen` không còn import tĩnh ở `routes.tsx` (grep);
   - `calendar/store.ts` chỉ lưu 5 trường của mục 6;
   - bảng responsive Day/Agenda ở 375/768/desktop (đọc code: lớp cuộn, `min-w-0`, thẻ/bảng).
9. `git status`: liệt kê, có số đếm. Dự kiến khoảng 9 file:
   - mới: `lazyScreens.ts`, `CalendarDayGrid.tsx`, `CalendarAgendaList.tsx`, `store.ts`;
   - sửa: `ui.ts`, `model.ts`, `CalendarScreen.tsx`, `routes.tsx`, `vi.ts`.

   Không file `docs/`.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026). Người dùng tự kiểm 4 chế độ xem.

### 13.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §0, §1, §2.2, §3.4 (2 gạch đầu dòng `CalendarDayGrid`, `CalendarAgendaList`), §5 (G7), §8.1, §8.2, §12, §13.
2. `CONVENTIONS.md` §1, §3, §5, §8, §10, §11 · `docs/ARCHITECTURE.md` §5, §6a, §7.
3. Nghiệp vụ (chỉ các mục): `../thien-bao-car-docs/modules/RentalCalendar-BRD.md` §8, §13, §18, §19, §25, §30 (`RC-BR-08/12/13/16`) · `../thien-bao-car-docs/WebappQuanTri.md` §8.2.
4. Code:
   - `src/features/calendar/{model.ts,ui.ts,index.ts}`;
   - `src/features/calendar/screens/CalendarScreen.tsx`;
   - `src/features/calendar/components/{CalendarWeekGrid,CalendarMonthGrid,RentalBlockPopover,RentalQuickCreateGate,DayDetailDialog}.tsx`;
   - `src/features/{auth,employees,finance/revenue-cost}/screens/lazyScreens.ts` (mẫu tải lười);
   - `src/app/routes.tsx` (khối `calendar` + một khối màn lười);
   - `src/features/auth/store.ts` (mẫu `persist`);
   - `src/shared/lib/{datetime.ts,pagination.ts}`, `src/shared/ui/pagination.tsx`;
   - `src/shared/i18n/vi.ts` (khối `calendar`).
5. Harness: `$SP/demo-data/lib.mjs` · `$SP/hardening/{initial-load.mjs,run-harness.sh,dump-seed.mjs,diff-seed.mjs,tz-scan.mjs,guard-r1.mjs}` · `$SP/cal3/peek.mjs`.

### 13.8. Báo cáo bàn giao `dev` phải có

- Danh sách file đổi (khớp `git status`, có số đếm).
- Output rút gọn DoD 1–7:
  - tải đầu sau mục 1 và cuối Round, kích thước chunk `CalendarScreen`;
  - SCC, `evalorder`;
  - `diff-seed`;
  - bảng `run-harness` 3 TZ;
  - `guard-r1`;
  - `tz-scan`;
  - `cal-r3a` (có bảng `agendaGroups`).
- Rà tĩnh DoD 8.
- Các khoá `vi` mới.
- Mọi chỗ lệch plan + lý do.
### 13.9. Kết quả review & phán quyết (25/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: 3 cổng sạch (2 cảnh báo cũ) · tải đầu **1.834.102 B** (sau mục 1: 1.831.890 do `dev` đo; ≤ 1.835.000) · chunk `CalendarScreen-*.js` 34.287 B ·
SCC rỗng · `CalendarScreen` chỉ còn import qua `calendar/ui` (bản lazy) bọc `<Suspense>` trong khối guard · `run-harness` UTC so baseline HCM 8/8 `diff=0` ·
`cal-r3a.mjs` dưới New_York trùng `cal-r3a-expected.txt` (ALL PASS: `rt_019` 25%, đệm 6,25%, `agendaGroups` 13 lượt = `rentalsByVehicleInRange`). Đọc code: `store.ts`
chỉ `partialize` 5 trường; hàm bố cục là hàm thuần ở `model.ts`.

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | Block Day/Agenda một màu như Week; trạng thái hiện bằng nhãn + `RentalStatusBadge` | **Chấp nhận** — nhất quán Week/Month hiện có; bảng màu theo trạng thái là RC Q5 (UI/UX, chưa chốt). |
| L2 | `vehicleFilter` đã lưu trỏ xe không còn → coi như "Tất cả xe" | **Chấp nhận** — cần thiết khi Reset dữ liệu demo. |
| L3 | Nhấp vùng khoá xe ở Day đi qua cổng tạo nhanh (bị chặn như Week), không mở chi tiết khoá; Enter/Space trên hàng xe tạo nhanh lúc 09:00 | **Chấp nhận** — chi tiết khoá vẫn mở được ở Month (RC-BR-15 "trên chế độ Month"). Nợ nhỏ A-N1: mở chi tiết khoá từ Day. |
| L4 | Độ rộng block tối thiểu 1%; `dayTimelineLayout` nhận `{ id }[]`; vạch "bây giờ" dùng `Date.parse(todayIso())` (qua `react(purity)`) | **Chấp nhận.** |

**Tải đầu:** phần tăng sau mục 1 (+2.212 B) nằm ở chunk chính (chuỗi `vi` + hàm mới ở `calendar/model.ts` — `calendar/index` được `finance` import tĩnh). Ngân sách B1/B2
đặt lại ở §8.1 mục 3 (brief B1). Baseline B1: HEAD commit Round A, tải đầu 1.834.102 B; seed/harness giữ `hardening/base-r3a-hcm.json` + `hardening/baseline-r3a/` (Round A không
đổi dữ liệu).

## 14. Round B1 — brief giao việc cho `dev` (`APPROVED` 25/10/2026)

`SP=/tmp/claude-0/-home-user/f80ff31e-7a52-5fb1-8095-bb034c4d84d9/scratchpad`, `REPO=/home/user/tbc-webapp-prototype-demo`.

### 14.1. Bối cảnh

Round A đã `DONE` (commit `3660a62`): Lịch có 4 chế độ xem và đã tải lười. Round B1 dựng **toàn bộ nghiệp vụ dời lịch / đổi xe trước giao** (UC-RC-06, UC-RC-07).
Thao tác mở **qua hộp thoại** từ menu trên block, **chưa có kéo–thả** (kéo–thả là B2 — chỉ là cử chỉ gọi lại hộp thoại này).

Thiết kế đã duyệt ở §3.1–§3.5, §4 (ngoại lệ **C1**, **C2**), §5 (giả định Q1–Q5, G1–G6 — người dùng duyệt làm giả định demo 25/10/2026).

Hiện `rentals/api.ts` **chưa có** hàm sửa thời gian hay đổi xe. `hasConflict()` coi vùng đệm 90' là xung đột cứng — **giữ nguyên** hàm này (K5); B1 viết hàm kiểm tra mới.

### 14.2. Trong phạm vi (đúng danh sách — làm theo thứ tự §14.5)

1. **File lá `src/features/calendar/blockRules.ts`** (C1):
   - Chuyển từ `calendar/model.ts` sang: `interface VehicleBlock`, `blockEndBound`, `isVehicleBlockedForPeriod`.
   - Chuyển từ `calendar/api.ts` sang: `VEHICLE_BLOCKS_STORAGE_KEY`.
   - Thêm `findBlockingBlocks(blocks, vehicleId, startIso, endIso)` → danh sách khoá `ACTIVE` chồng khoảng, tính theo date key +07.
   - File này **chỉ** import `shared/*` — không import `rentals` hay bất kỳ feature nào.
   - `calendar/model.ts` và `calendar/api.ts` **re-export** đúng tên cũ, nên mọi nơi đang dùng không phải sửa.
   - Comment đầu file: lý do C1 — tránh vòng `rentals ↔ calendar` (tiền lệ `incidents/storageKeys.ts`).
2. **Hàm thuần ở `src/features/rentals/model.ts`** (§3.2 — bảng mã lỗi/cảnh báo là **nguồn chuẩn**):
   - `RESCHEDULABLE_STATUSES = ['DRAFT','CONFIRMED','CONTRACT_CREATED','READY_FOR_HANDOVER'] as const` — comment `RC-BR-01`, `TODO(OQ: CALENDAR-ROUND3-PLAN.md §5 Q1 / RentalCalendar-BRD.md §35 Q8)`.
   - `canRescheduleRental(rental)`.
   - `classifyConflicts(rentals, vehicleId, startIso, endIso, excludeRentalId)` → `{ overlaps: Rental[]; bufferViolations: Rental[] }`.
     - Chỉ tính lượt **đang chiếm xe**, dùng cùng danh sách trạng thái với `hasConflict`.
     - Đệm = `TURNAROUND_BUFFER_MINUTES`.
     - Mốc tính bằng `dateTimeToMs`.
   - `SCHEDULE_ISSUE_CODES` (`as const`, đúng 12 mã ở §3.2) và `type ScheduleIssue = { code; rentalIds?: string[]; blockIds?: string[] }`.
   - `evaluateScheduleChange({ rental, proposed: { vehicleId, pickupDateTime, expectedReturnDateTime }, rentals, targetVehicle, vehicleBlocks, now })` → `{ errors, warnings }`:
     - đúng điều kiện từng mã ở §3.2;
     - `TODO(OQ)` tại mã theo giả định: G1 `PICKUP_IN_PAST`, G2 `VEHICLE_UNAVAILABLE` khi dời trên cùng xe, G3 `OUTSIDE_RECEIVING_WINDOW`, Q2 `DURATION_CHANGED`,
       Q3 `VEHICLE_CLASS_DIFFERS`, Q4 `CONTRACT_EXISTS`;
     - giờ và ngày qua `shared/lib/datetime.ts` (`zonedParts` cho giờ +07);
     - `BUFFER_VIOLATION` là **cảnh báo** cần lý do (G4).
   - `rentalScheduleChangeSchema` (zod — cho hộp thoại):
     - `pickupDateTime`, `expectedReturnDateTime` (chuỗi `datetime-local`), `vehicleId`, `overrideReason?`;
     - lỗi tiếng Việt (CONVENTIONS §7).
3. **API ở `src/features/rentals/api.ts`** (§3.3), bọc `fakeRequest`, đọc/ghi qua `storage.ts`:
   - `rescheduleRental(id, { pickupDateTime, expectedReturnDateTime, expectedUpdatedAt, overrideReason? }, actor)`.
   - `changeRentalVehicle(id, { vehicleId, pickupDateTime?, expectedReturnDateTime?, expectedUpdatedAt, overrideReason? }, actor)`.
   - **Thứ tự bắt buộc — mọi kiểm tra trước mọi ghi:**
     1. Quyền: `can(actor.role,'RENTAL','EDIT')` (import `can` từ `@/shared/domain/permissions`).
     2. Lượt tồn tại.
     3. `updatedAt === expectedUpdatedAt` (EX-03).
     4. Đọc xe đích: `getById` của `@/features/vehicles/api` (đã import sẵn).
     5. Đọc khoá xe: `readJson(VEHICLE_BLOCKS_STORAGE_KEY)` từ `@/features/calendar/blockRules` (C1).
     6. `evaluateScheduleChange` → còn `errors` thì ném lỗi; `BUFFER_VIOLATION` mà `overrideReason` rỗng sau `trim` thì ném lỗi.
   - Ghi: **chỉ** `pickupDateTime`, `expectedReturnDateTime`, `vehicleId`, `updatedAt`. Không trường snapshot nào đổi (K4, `RC-BR-06`).
   - Thông điệp lỗi lấy từ `vi` (khoá theo mã).
   - Audit:
     - `appendAudit` với `RESCHEDULE_RENTAL` (đổi thời gian, không đổi xe) hoặc `CHANGE_RENTAL_VEHICLE` (đổi xe, có thể kèm thời gian).
     - `before`/`after` = các trường đổi; `after` thêm `overrideReason` (nếu có) và `warnings` (mảng mã).
     - `correlationId = generateId('corr')`.
   - Khi **thời gian** đổi, sau khi ghi Rental gọi `shiftAssignmentWindowsForRental` (mục 4) với cùng `correlationId`.
   - Trả `{ rental, warnings, assignmentConflicts }`.
4. **`src/features/employees`** (C2, `EA-BR-14`, `EA-BR-10`):
   - `model.ts`: hàm thuần `shiftedAssignmentWindow(assignment, { pickupDeltaMs, returnDeltaMs })`.
     - Chỉ áp cho `status === 'ASSIGNED'`. `DELIVERY` dời theo `pickupDeltaMs`, `RECEIVING` theo `returnDeltaMs` (G5, `TODO(OQ)`).
     - Delta = 0 hoặc phân công trạng thái khác → `null`.
   - `api.ts`: `shiftAssignmentWindowsForRental(rentalId, deltas, actor, correlationId)`.
     - Bọc `fakeRequest`. Ghi các phân công đổi, mỗi cái một audit `UPDATE_ASSIGNMENT_WINDOW` (`before`/`after` = 2 mốc, cùng `correlationId`).
     - Trả `{ updated, conflicts: { assignmentId, employeeId }[] }` — dùng `hasAssignmentConflict` sẵn có, chỉ **cảnh báo**.
   - `index.ts`: export thêm 2 hàm trên, comment `CALENDAR-ROUND3-PLAN.md §14.2 (C2)`.
   - `rentals/api.ts` import từ **barrel** `@/features/employees` (không import sâu).
5. **Hooks + barrel `rentals`:**
   - `hooks.ts`: `useRescheduleRental`, `useChangeRentalVehicle`; `onSuccess` invalidate `['rentals']`, `['assignments']`, `['notifications']`.
   - `index.ts`: export `RESCHEDULABLE_STATUSES`, `canRescheduleRental`, `classifyConflicts`, `evaluateScheduleChange`, `rentalScheduleChangeSchema`, type
     `ScheduleIssue`, 2 hook; comment `CALENDAR-ROUND3-PLAN.md §14.2`.
6. **Audit action:**
   - `src/shared/domain/enums.ts`: nối **cuối** `AUDIT_ACTIONS` 3 mã `RESCHEDULE_RENTAL`, `CHANGE_RENTAL_VEHICLE`, `UPDATE_ASSIGNMENT_WINDOW` + comment 1 dòng
     (`CALENDAR-ROUND3-PLAN.md §3.5 — UC-RC-06/07/19, EA-BR-14`).
   - `src/shared/i18n/auditLabels.ts`: thêm 3 nhãn.
7. **`src/features/calendar/components/RentalScheduleChangeDialog.tsx`** (mới, nằm trong chunk Lịch lười):
   - Props: `rental`, `mode: 'reschedule' | 'changeVehicle'`, `initial?` (B2 sẽ truyền đề xuất từ vị trí thả), `onClose`, `onResult(ok)`.
   - Form `react-hook-form` + `zodResolver(rentalScheduleChangeSchema)`.
   - 2 ô `datetime-local`: hiển thị qua `isoToDateTimeInput`, đọc lại qua `dateTimeInputToIso`. `Select` xe (chỉ ở `changeVehicle`; danh sách `useVehicles` qua barrel).
   - Mỗi lần giá trị đổi → chạy `evaluateScheduleChange` (dữ liệu từ `useRentals`, `useVehicles`, `useVehicleBlocks`; `now = new Date()`) và hiển thị:
     - bảng **cũ → mới** (xe, giờ giao, giờ trả, số ngày);
     - danh sách **lỗi** — nút "Xác nhận" bị khoá;
     - danh sách **cảnh báo** (nhãn `vi`);
     - ô **Lý do ghi đè** bắt buộc khi có `BUFFER_VIOLATION`.
   - Lỗi `OVERLAP` / `VEHICLE_BLOCKED` liệt kê mã lượt / khoá gây xung đột. Liên kết sang Chi tiết lượt thuê **chỉ khi** `can('RENTAL','VIEW')` (Q20 / OQ-G1).
   - Xác nhận → gọi hook. Thành công → toast; nếu có `assignmentConflicts` → toast cảnh báo trùng lịch nhân viên. Lỗi API → toast `error.message`, giữ hộp thoại mở.
   - Hiển thị `expectedUpdatedAt` = `rental.updatedAt` lúc mở.
   - Điện thoại: hộp thoại toàn chiều rộng, cuộn dọc bên trong.
8. **`RentalBlockPopover.tsx`:** thêm 2 nút "Dời lịch", "Đổi xe" — chỉ hiện khi `can('RENTAL','EDIT') && canRescheduleRental(rental)`. Mở `RentalScheduleChangeDialog`. Ba chế độ
   Week/Month/Day và Agenda (dùng chung popover) tự có nút.
9. **`src/features/rentals/components/RentalPricingTab.tsx`** (P10, Q2/Q3 — chỉ hiển thị):
   - `rentalDurationDays(pickup, expectedReturn)` hiện tại ≠ `rental.rentalDurationDays` → dòng thông báo "Thời gian thuê đã đổi (X → Y ngày); giá vẫn theo số ngày đã
     chốt — xử lý chênh lệch thủ công".
   - Hạng xe hiện tại của `vehicleId` ≠ `rental.vehicleClass` → dòng thông báo tương tự.
   - `TODO(OQ: RentalCalendar-BRD.md §35 Q9)`.
10. **`src/shared/i18n/vi.ts`:** nhãn 2 nút, tiêu đề/nhãn hộp thoại, nhãn 12 mã lỗi/cảnh báo, thông báo P10, toast.
    - Nếu DoD 2 vượt ngân sách: được chuyển **chuỗi chỉ hộp thoại dùng** sang `src/shared/i18n/calendarLabels.ts` (mẫu `auditLabels.ts`/`platformLabels.ts` — D12),
      chỉ chunk Lịch lười import. Chuỗi lỗi mà API dùng vẫn ở `vi.ts`.

### 14.3. Ngoài phạm vi B1 (không làm dù "tiện tay")

- Kéo–thả, `@dnd-kit` (B2).
- Đổi `hasConflict()` / luồng tạo lượt.
- Đổi xe giữa kỳ (Round C).
- Sửa giá / tính lại tiền; tự huỷ hoặc tạo lại hợp đồng.
- Sự kiện thông báo mới (G6).
- Bộ đếm xung đột RC §17.
- Sửa `permissions.ts`, `routeAccess.ts`.
- Đổi seed (`SEED_VERSION` giữ 27) hoặc sửa dữ liệu xung đột có sẵn.
- Sửa harness `phase6/*`, `demo-data/*`, `hardening/*`.
- Sửa `docs/`. Chạy trình duyệt.

### 14.4. Quy tắc bắt buộc

- `CONVENTIONS.md` toàn bộ; đặc biệt:
  - §1: chuỗi `vi`; ngày giờ chỉ qua `datetime.ts`.
  - §3: 2 điểm nhập; import sâu chéo feature **chỉ** C1 (`@/features/calendar/blockRules` từ `rentals/api.ts`) + các import sâu đã có sẵn.
  - §4: `fakeRequest`, `appendAudit`, `storage.ts`.
  - §6: `can()`; không `role ===`.
  - §7: form + zod.
  - §10: `TODO(OQ)`.
  - §11.
- **Một hàm kiểm tra** cho UI và API. Hộp thoại không tự viết điều kiện riêng.
- Kiểm tra trước mọi ghi. Lỗi ở bất kỳ bước kiểm tra nào → **không** thay đổi gì trong storage (bài học N4).
- `import/no-cycle` phải sạch — nếu báo vòng do C1/C2, dừng và báo `tech-lead`, không tự tìm đường vòng khác.
- Gặp quyết định nghiệp vụ mới → dừng, báo `tech-lead`.

### 14.5. Thứ tự làm

1. Mục 1 (`blockRules.ts` + re-export) → `tsc` + DoD 3 (SCC rỗng, `evalorder`).
2. Mục 2 (hàm thuần) → harness DoD 7 phần T17 (gọi hàm thuần).
3. Mục 4 (employees), rồi mục 3 + 5–6 (API, hooks, audit) → DoD 7 đủ T1–T16.
4. Mục 7–10 (UI) → build → DoD 2.
5. Chạy toàn bộ DoD 1–9.

### 14.6. Definition of Done B1 — chạy đủ và dán kết quả vào báo cáo

Baseline: commit Round A `3660a62` — tải đầu **1.834.102 B** · seed `$SP/hardening/base-r3a-hcm.json` · harness `$SP/hardening/baseline-r3a/` (Round A không đổi dữ liệu).

1. `npx tsc -b` · `npx oxlint` (có `import/no-cycle`) · `npm run build` sạch (2 cảnh báo cũ). `grep -rn '\*/[a-zA-Z]' src/` rỗng.
2. **Tải đầu:** `node $SP/hardening/initial-load.mjs $REPO` ≤ **1.844.000** (ngân sách B1: +~10 kB, vì API, hàm kiểm tra, chuỗi `vi`, thông báo ở tab Giá nằm ở chunk chính).
   - Báo chênh lệch so với 1.834.102 và kích thước chunk `CalendarScreen-*.js`.
   - Vượt 1.844.000 → áp đòn bẩy `calendarLabels.ts` (mục 10). Vẫn vượt → dừng, báo `tech-lead`.
   - Trần cứng toàn dự án 1.870.000.
3. `node $SP/consignment-r3/sccfiles.mjs $REPO` **rỗng**. `evalorder` OK cho:
   - `/src/app/routes.tsx`;
   - `/src/features/{rentals,employees,calendar}/index.ts`;
   - `/src/features/calendar/ui.ts`;
   - `/src/features/calendar/blockRules.ts`.
4. **Seed giống hệt:** `dump-seed.mjs` HCM → `diff-seed` so `$SP/hardening/base-r3a-hcm.json` = 0.
5. **Harness 3 múi giờ:**
   - `run-harness.sh` dưới `Asia/Ho_Chi_Minh`/`UTC`/`America/New_York` so `$SP/hardening/baseline-r3a` (đối số 5 `Asia/Ho_Chi_Minh`) → **24/24 `diff=0`**.
   - Nếu harness cũ lệch chỉ vì `AUDIT_ACTIONS` dài thêm 3 mã → báo nguyên văn dòng lệch, không sửa harness.
   - `guard-r1.mjs`, `n4-r1.mjs`, `$SP/cal3/cal-r3a.mjs` (so `cal-r3a-expected.txt`) ALL PASS.
6. `tz-scan.mjs`: 5 nhóm cấm = 0 ngoài `datetime.ts`.
7. **Harness B1** `$SP/cal3/cal-r3b1.mjs` (`dev` viết):
   - Dùng `boot()` một lần, chụp `new Map(store)`, **khôi phục trước mỗi ca**.
   - Gọi thẳng `load('/src/features/rentals/api.ts')`. Actor `MANAGER` (`usr_manager`), trừ T15. `expectedUpdatedAt` = `updatedAt` hiện tại, trừ T8.
   - Đủ **17 ca T1–T17 ở §8.3**, in `PASS`/`FAIL` từng ca + `ALL PASS`.
   - Mỗi ca: in mã lỗi/cảnh báo và số audit thêm vào (kèm `action`).
   - Mỗi **ca lỗi**: so chuỗi JSON `rentals`, `assignments`, `audit` trước/sau → **y hệt**.
   - Mỗi **ca thành công**: so mọi trường snapshot (`rentalDurationDays`, `baseAmount`, `allowedKm`, `vehicleClass`, `pricePerKm`, `estimatedTotal`, `prepaymentAmount`,
     `deliveryFee`, `discountAmount`) trước/sau → **y hệt**.
   - Chạy dưới **3 TZ** → output giống hệt. Lưu output HCM vào `$SP/cal3/cal-r3b1-expected.txt`.
   - Ghi chú cách đọc một số ca:
     - T5 kỳ vọng `errors` **chứa** `VEHICLE_BLOCKED` (có thể kèm `OVERLAP` vì `veh_014` còn `rt_010`).
     - T7: `rt_009` dời +30' (từ 30' lên 60' sau giờ trả `rt_008`).
     - T12/T13: `dev` chọn xe trống bằng `$SP/cal3/peek.mjs` và ghi id.
     - T9: nếu `veh_004` không trống ngày 23–24/10 thì chọn lượt `CONFIRMED` khác có phân công `ASSIGNED` và ghi lý do.
8. **Rà tĩnh** trong báo cáo:
   - `grep -n "role ===" src/features/{rentals,employees,calendar}` → rỗng.
   - Hộp thoại không có điều kiện kiểm tra riêng ngoài `evaluateScheduleChange` (trích đoạn).
   - Nút "Dời lịch"/"Đổi xe" chỉ hiện theo `can('RENTAL','EDIT') && canRescheduleRental`.
   - Liên kết lượt gây xung đột gate `can('RENTAL','VIEW')`.
   - Bảng responsive hộp thoại 375/768.
9. `git status`: liệt kê, có số đếm. Dự kiến khoảng 17 file theo §9 dòng B1 (+ `calendarLabels.ts` nếu dùng). Không file `docs/`.

**Không yêu cầu** kiểm bằng trình duyệt (quyết định 14/09/2026).

### 14.7. File `dev` đọc trước (đúng danh sách — không scan rộng)

1. File này: §0, §1, §3.1–§3.5, §4 (C1, C2), §5, §6, §8.1, §8.3, §11, §12, §13.9, §14.
2. `CONVENTIONS.md` §1, §3, §4, §6, §7, §10, §11 · `docs/ARCHITECTURE.md` §3, §5, §6a.
3. Nghiệp vụ (chỉ các mục):
   - `../thien-bao-car-docs/modules/RentalCalendar-BRD.md` §13, §15, §16, §19, §30;
   - `../thien-bao-car-docs/modules/RentalCalendar-UseCase.md` §10 (UC-RC-06), §11 (UC-RC-07);
   - `../thien-bao-car-docs/modules/RentalManagement-BRD.md` §51, §57;
   - `../thien-bao-car-docs/modules/EmployeeAssignment-BRD.md` dòng 484–493 (`EA-BR-10/14/19`).
4. Code:
   - `src/features/rentals/{model,api,hooks,index}.ts`;
   - `src/features/rentals/components/RentalPricingTab.tsx`;
   - `src/features/employees/{model.ts (dòng 140–230),api.ts (dòng 360–500),index.ts}`;
   - `src/features/calendar/{model.ts (dòng 1–100),api.ts,index.ts}`;
   - `src/features/calendar/components/RentalBlockPopover.tsx`;
   - `src/features/handover-return/components/HandoverEditDialog.tsx` (mẫu form + `datetime-local` + lý do);
   - `src/shared/lib/{datetime.ts,audit.ts,id.ts}`;
   - `src/shared/domain/permissions.ts` (dòng 18–62, 166–171, 597–611);
   - `src/shared/domain/enums.ts` (khối `AUDIT_ACTIONS`);
   - `src/shared/i18n/{auditLabels.ts (dòng 1–40),vi.ts (khối rentals, calendar)}`.
5. Harness: `$SP/demo-data/lib.mjs` · `$SP/cal3/{peek.mjs,cal-r3a.mjs}` · `$SP/hardening/{n4-r1.mjs (mẫu khôi phục store + so JSON),run-harness.sh,dump-seed.mjs,diff-seed.mjs,initial-load.mjs,tz-scan.mjs,guard-r1.mjs}`.

### 14.8. Báo cáo bàn giao `dev` phải có

- Danh sách file đổi (khớp `git status`, có số đếm).
- Output rút gọn DoD 1–7:
  - tải đầu + chênh lệch + chunk `CalendarScreen`;
  - SCC, `evalorder`;
  - `diff-seed`;
  - bảng `run-harness` 3 TZ;
  - `guard-r1`, `n4-r1`, `cal-r3a`;
  - `tz-scan`;
  - `cal-r3b1` T1–T17 kèm mã + audit từng ca.
- Rà tĩnh DoD 8.
- Id xe đã chọn cho T9/T12/T13.
- Các khoá `vi` mới (và `calendarLabels.ts` nếu dùng).
- Mọi chỗ lệch plan + lý do.
### 14.9. Kết quả review & phán quyết (25/10/2026 — đạt vòng 1, không Blocker)

`tech-lead` chạy lại: 3 cổng sạch · tải đầu **1.843.864 B** (≤ 1.844.000; lần đo đầu của `dev` 1.845.523 → áp đòn bẩy `calendarLabels.ts`) · chunk `CalendarScreen` 44.034 B ·
SCC rỗng · `cal-r3b1.mjs` dưới New_York trùng `cal-r3b1-expected.txt` (ALL PASS) · `run-harness` UTC so baseline HCM 8/8 `diff=0`. Đọc diff `rentals/api.ts`: quyền → lượt →
`updatedAt` → xe đích → khoá xe → `evaluateScheduleChange` → lý do ghi đè, **tất cả trước** `writeAll`; chỉ ghi 4 trường; audit có `before`/`after` chỉ trường đổi + `correlationId`.
`grep "role ==="` trong `rentals`/`employees`/`calendar`: các dòng khớp là `AssignmentRole` (`'DELIVERY'`/`'RECEIVING'`) — **trừ** `rentals/components/RentalHandoverReturnTab.tsx:52`
(`role === 'MANAGER' || role === 'SYSTEM_ADMIN'`) **có từ trước, không nằm trong diff B1** → ghi nợ B1-N3, không xét ở review này.

| # | Lệch | Phán quyết |
| --- | --- | --- |
| L1 | C1 mở rộng: `rentals/model.ts` cũng import `calendar/blockRules` (type + `blockEndBound`) | **Chấp nhận** — cùng file lá đã duyệt, không tạo vòng (SCC rỗng, `no-cycle` sạch). |
| L2 | Export thêm `needsOverrideReason`, `rentalDurationDays`, type `RentalScheduleChangeValues`; `blockEndBound` từ `blockRules.ts` | **Chấp nhận.** |
| L3 | Dùng đòn bẩy `calendarLabels.ts` | **Chấp nhận** — đúng §14.2 mục 10. |
| L4 | `evaluateScheduleChange` thoát sớm ở `STATUS_LOCKED`/`NO_CHANGE`/`INVALID_PERIOD`; `VEHICLE_CLASS_DIFFERS` chỉ khi đổi sang xe khác hạng | **Chấp nhận** — các lỗi này làm mọi kiểm tra sau vô nghĩa; cảnh báo hạng chỉ có nghĩa khi đổi xe. |
| L5 | Kiểm 2 lần (sớm + trong `fakeRequest`); dời phân công **sau** khi ghi lượt, ở `fakeRequest` riêng | **Chấp nhận, ghi nợ B1-N1.** Mọi kiểm tra nghiệp vụ xong trước ghi; `shiftAssignmentWindowsForRental` **không** có nhánh `throw` nghiệp vụ (chỉ đọc → tính → `writeJson`), `fakeRequest` mặc định `failRate = 0`. Lệch trạng thái chỉ xảy ra nếu `localStorage` ghi thất bại giữa 2 lần ghi — cùng mức rủi ro đã chấp nhận ở N4 (huỷ giao/nhận ghi 3 key nối tiếp). Cách sửa khi cần: tính danh sách phân công đổi bằng hàm thuần và ghi cả 2 key trong cùng một `fakeRequest`. |
| L6 | Audit `reason = overrideReason`; `before`/`after` chỉ trường đổi | **Chấp nhận.** |
| L7 | Hộp thoại chế độ đổi xe vẫn cho sửa giờ | **Chấp nhận** — đúng `changeRentalVehicle` (§3.3 cho phép kèm thời gian). |
| L8 | `div.contents` chặn `click`/`keydown` nổi bọt qua portal lên ô lưới | **Chấp nhận** (đọc code). React đưa sự kiện của hộp thoại (portal) đi theo cây React lên ô lưới → ô lưới mở tạo nhanh nhầm; chặn ở lớp bọc là đúng. Không mất thao tác hợp lệ: Radix đóng bằng Esc qua listener `keydown` **capture** trên `document` (`react-dismissable-layer` dòng 105) và đóng khi bấm ngoài bằng `pointerdown` (không bị chặn); bẫy focus/Tab nằm trong hộp thoại. |
| L9 | Tách T7, T15 thành a/b | **Chấp nhận.** |

**Nợ ghi nhận (không chặn):** **B1-N1** — L5. **B1-N2** — xe đích đọc trước `fakeRequest` (trạng thái xe có thể đổi trong ~300 ms độ trễ giả lập); đưa vào trong `fakeRequest` khi sửa B1-N1.
**B1-N3** — `RentalHandoverReturnTab.tsx:52` kiểm vai trò bằng `role ===` (có từ Phase 3, trái CONVENTIONS §6) — cần entry quyền hoặc dùng `can()` sẵn có; việc riêng.

**Tải đầu:** còn dư 136 B dưới ngân sách B1. B2 đặt ngân sách theo **tập module tải đầu không đổi** (§15.6).

---

## 15. Lịch sử

| Ngày | Nội dung |
| --- | --- |
| 25/10/2026 | **B1 `DONE`** — review vòng 1 đạt, không Blocker; chấp nhận L1–L9; nợ B1-N1…N3 (§14.9). Tải đầu 1.843.864 B. |
| 25/10/2026 | Brief B1 (§14) — **giao `dev`**; ngân sách tải đầu B1 ≤ 1.844.000 B (đòn bẩy `calendarLabels.ts`), B2 ≤ B1 + 1.000. |
| 25/10/2026 | **Round A `DONE`** — review vòng 1 đạt, không Blocker; chấp nhận L1–L4, nợ A-N1 (§13.9). Tải đầu 1.834.102 B. |
| 25/10/2026 | **`APPROVED`** — người dùng duyệt cả 5 điểm §12. Viết brief Round A (§13), **giao `dev`**. Baseline: HEAD `6e863cf`, `hardening/baseline-r3a/`, `base-r3a-hcm.json`, tải đầu 1.854.198 B. |
| 25/10/2026 | Tạo kế hoạch (`DRAFT — CHỜ NGƯỜI DÙNG DUYỆT`). Đo HEAD `6e863cf`: `@dnd-kit/core` 39.793 B min; Lịch tải lười → tải đầu 1.831.763 B (−22.435); 15 lượt kéo được trên seed, 2 xung đột có sẵn. Dựng `scratchpad/cal3/peek.mjs`. |
