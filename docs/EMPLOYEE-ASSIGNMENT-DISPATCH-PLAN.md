# Kế hoạch triển khai — Phân công (Assignment) & Bảng điều phối (Dispatch board)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `PENDING_APPROVAL` (07/10/2026) — Round 1 (entity
`Assignment` + Phân công/Đổi người/Huỷ + Dispatch board + tab "Phân công" ở Rental Detail) đã lên kế
hoạch chi tiết, **chưa giao `dev`**.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/EmployeeAssignment-BRD.md` (v1.4, toàn bộ — đặc
biệt §9-§18, §26) + `-UseCase.md` (v1.4) + `../thien-bao-car-docs/modules/RentalCalendar-BRD.md`
§19-§23 (Dispatch board, mockup) + `../thien-bao-car-docs/WebappQuanTri.md` §8 (toàn bộ) +
`../thien-bao-car-docs/CHANGE-REQUESTS.md` CR-2026-006/035/053.

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/HANDOVER-RETURN-MANAGEMENT-
PLAN.md` (mẫu format), `docs/CALENDAR-MANAGEMENT-PLAN.md` §8.2-8.3 + `docs/RENTAL-MANAGEMENT-
PLAN.md` §8.4 (roadmap stub cũ — **không** dùng làm đặc tả cuối, xem §0.1). Đối chiếu mã hiện có:
`src/features/employees/model.ts` (Employee Round 1), `src/shared/domain/enums.ts`
(`ASSIGNMENT_STATUSES`/`ASSIGNMENT_ROLES` đã scaffold), `src/shared/domain/permissions.ts`
(`ASSIGNMENT.VIEW/ASSIGN/EXPORT` đã có sẵn), `src/features/calendar/model.ts` (mẫu
`VehicleBlock` — entity riêng đọc `Rental` qua barrel, không sửa `rentals`).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. Roadmap stub cũ (2 field trên Rental) KHÔNG dùng làm đặc tả — build entity `Assignment` riêng

`docs/RENTAL-MANAGEMENT-PLAN.md` §8.4 và `docs/CALENDAR-MANAGEMENT-PLAN.md` §8.3 mô tả sơ bộ
Assignment = 2 field `assignedDeliveryStaffId`/`assignedReceivingStaffId` thêm trực tiếp vào
`Rental`. Cả 2 file **tự ghi chú** đây chỉ là "roadmap sơ bộ, chưa chi tiết hoá field-level, đọc lại
BRD tại thời điểm build, không dùng nội dung phác thảo làm đặc tả cuối" — đúng quy ước dự án.
`EmployeeAssignment-BRD.md` v1.4 (bản chuẩn, mới hơn, chi tiết hơn) định nghĩa `Assignment` là
**entity độc lập** với Planned Window, Status lifecycle riêng (6 giá trị), Reassignment History,
Assigned By/At, Actual Start/End (§9-§10, sơ đồ khái niệm liệt `Rental` như một field **của**
`Assignment` — không phải ngược lại). `EmployeeAssignment-UseCase.md` §32 ("Khuyến nghị của BA",
**sửa lại nguồn trích — bản rà soát trước ghi nhầm là BRD**) nói rõ thêm nguyên tắc: *"Assignment là
'cái bóng' của Rental... không để trở thành nguồn dữ liệu độc lập lệch với Rental"* — tức
**Assignment giữ `rentalId`** (như `Contract`/`HandoverRecord`/`ReturnRecord` đã làm), không phải
field ngược trên `Rental`. **Quyết định: build entity `Assignment` riêng theo BRD — KHÔNG thêm field
vào `rentals/model.ts`, không cần ngoại lệ kiến trúc đụng `rentals`.**

### 0.2. `RentalCalendar-BRD.md` §22/`AC-RC-009` viết như field trên Rental — cách diễn đạt màn hình,
không phải nguồn dữ liệu

`RentalCalendar-BRD.md` §22 viết *"Rental ├── Delivery Staff ├── Receiving Staff"* như thể đây là
field của Rental. `WebappQuanTri.md` §8.5 dung hoà: *"RC không sở hữu dữ liệu riêng — đọc Rental
Block từ RM, nhân viên từ EA"* — nghĩa là cách viết ở RC-BRD chỉ là **mô tả màn hình hiển thị**
(Dispatch board hiển thị "Delivery Staff" như một cột, nguồn dữ liệu thật vẫn là `Assignment` của
`EA`). Không mâu thuẫn với §0.1 khi hiểu đúng theo cách này.

### 0.3. KHÔNG mở lại `rentals/model.ts`/`api.ts`/`handover-return/model.ts`/`api.ts` — nối dây tự
động để roadmap

`EA-BR-13` (Assignment `IN_PROGRESS`/`DONE` tự động theo Handover/Return) và `EA-BR-15` (Rental
`CANCELLED` → Assignment `CANCELLED`) đòi hỏi 2 ngoại lệ kiến trúc mới đụng vào feature đã `DONE`+
reviewed (`handover-return` và `rentals`). Round này **không mở** — viết **hàm thuần**
`deriveAssignmentStatusFromRecord()` chuẩn bị sẵn (không trigger), và action thủ công "Huỷ phân
công" thay cho cascade tự động. Đúng tinh thần "hàm thuần trước, UI sau" đã áp dụng nhất quán.

### 0.4. Tên field giữ theo code đã scaffold, không đổi theo BRD

BRD gọi `Assignment Type = DELIVERY/RETURN`; code đã scaffold `ASSIGNMENT_ROLES =
['DELIVERY','RECEIVING']` (khác tên gọi, không khác nghĩa — `RECEIVING` ứng với "nhận xe" =
`RETURN` trong BRD). **Giữ nguyên `ASSIGNMENT_ROLES` đã có**, không đổi enum đã dùng ở nơi khác (dù
hiện chưa dùng ở đâu, tránh phải sửa lại nếu enum này đã được tham chiếu ngầm).

### 0.5. Danh sách Open Question chạm tới — không tự chốt

| Open Q | Ảnh hưởng | Xử lý Round 1 |
| --- | --- | --- |
| Buffer di chuyển tính trùng lịch nhân viên cụ thể (§26 Q10/11) | `hasAssignmentConflict()` | Chỉ so overlap giờ làm việc thô (planned window), không cộng buffer di chuyển, `TODO(OQ)` |
| `OPERATION_STAFF` xem lịch của mình hay toàn bộ (`CALENDAR.VIEW` đang `TBD`) | Gate Dispatch board | Dùng đúng giá trị `TBD`→`false` hiện có trong `permissions.ts`, không tự chốt `true` |
| `MANAGER` có gán tài khoản/vai trò (`EMPLOYEE.CONFIG` đang `TBD`) | N/A round này | Không liên quan Assignment, không đụng |
| Ngưỡng `MISSED` (không nhận việc trong bao lâu) | Trạng thái `MISSED` | Chỉ seed, không có action UI tự động đánh dấu (§1.2) |

---

## 1. Phạm vi Round 1

### 1.1. Trong phạm vi

1. Data core: entity `Assignment` mới trong `src/features/employees/model.ts` (mở rộng file, KHÔNG
   sửa `Employee`/`UserAccount` đã có) + `api.ts`/`hooks.ts`/`seed.ts` tương ứng (§2).
2. **Phân công** (`ASSIGNED`, gate `ASSIGNMENT.ASSIGN`): chọn 1 Rental cần giao/nhận (lọc Rental có
   `pickupDateTime`/`expectedReturnDateTime` tương ứng role `DELIVERY`/`RECEIVING` và CHƯA có
   Assignment hiệu lực cùng loại — EA-BR-07) + chọn 1 Employee `ACTIVE` có vai trò phù hợp
   (`OPERATION_STAFF`/`MANAGER`/`SYSTEM_ADMIN` — EA-BR-08/09) → cảnh báo (không chặn) nếu trùng lịch
   (`hasAssignmentConflict`, EA-BR-10/RC-BR-11).
3. **Đổi người phụ trách** (chỉ khi `ASSIGNED`, EA-BR-11, bắt buộc lý do, ghi `reassignmentHistory`
   — EA-BR-12).
4. **Huỷ phân công** (thủ công, lý do) — thay cho cascade tự động (§0.3).
5. **Dispatch board** (`features/calendar`, route mới `/dispatch`): danh sách giao/nhận hôm nay
   (giờ/khách/xe/địa điểm/nhân viên hoặc "Chưa phân công" nổi bật) sort theo giờ + 3 widget **Sắp
   giao**/**Sắp nhận**/**Quá hạn trả** (khoảng "sắp đến hạn" = 24h tới, cố định, `TODO(OQ)` theo BRD
   §21 chưa chốt) + nút phân công/đổi người ngay trên mỗi dòng (mở dialog từ `employees`, deep-import
   `@/features/employees/hooks`).
6. Tab "Phân công" ở `RentalDetailScreen` (thay placeholder): Assignment `DELIVERY` + `RECEIVING`
   của Rental đang xem (nếu có) + nút Phân công/Đổi người/Huỷ ngay trong tab.
7. Hiển thị tên nhân viên đã phân công trên `HandoverReturnListScreen`/tab "Giao-nhận" (đọc Assignment
   qua barrel `employees`, CHỈ hiển thị — không ghi đè `deliveryStaffEmployeeId`/
   `receivingStaffEmployeeId` đã có sẵn trên `HandoverRecord`/`ReturnRecord`, 2 nguồn này độc lập
   theo đúng ghi nhận ở §0.3, không đồng bộ 2 chiều Round này).
8. Route `/dispatch` thay `ComingSoon`.

### 1.2. Ngoài phạm vi Round 1 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| `IN_PROGRESS`/`DONE` tự động theo Handover/Return (EA-BR-13) | Đụng lại `handover-return` đã `DONE` — ngoại lệ không mở (§0.3); chỉ seed trực tiếp |
| `CANCELLED` tự động khi Rental Cancelled (EA-BR-15) | Đụng lại `rentals/api.ts` — cùng lý do (§0.3) |
| `MISSED` tự động theo ngưỡng (UC-EA-13) | Chỉ seed, không có cron/trigger trong demo |
| Đổi người hàng loạt (UC-EA-09) | Chỉ cần 1-1 ở Round 1, hàng loạt để roadmap |
| Bảng khối lượng công việc + Báo cáo hiệu suất (UC-EA-14/18) | Để roadmap Phase 6 (polish/báo cáo) |
| Cấu hình quy tắc phân công (UC-EA-19: buffer di chuyển, giới hạn việc/ngày, ngưỡng MISSED) | Dùng hằng số cố định, không có màn cấu hình |
| `ON_LEAVE` cho `Employee`/`EMPLOYEE_STATUSES` | Không bắt buộc cho Assignment hoạt động ở Round 1 — giữ `TODO(OQ)` đã có trong code, không mở rộng Employee gốc |
| Đồng bộ 2 chiều Assignment ↔ `HandoverRecord.deliveryStaffEmployeeId`/`ReturnRecord.
  receivingStaffEmployeeId` | 2 nguồn độc lập Round này (§1.1 mục 7) — hợp nhất là quyết định kiến trúc lớn hơn, để round sau khi có nhu cầu rõ ràng |
| Dashboard/thông báo/báo-không-nhận-việc App nhân viên (UC-EA-15/16/17) | Thuộc App nhân viên, ngoài phạm vi repo |

---

## 2. Data model

### 2.1. `Assignment` (1 storage key `assignments`, trong `features/employees`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `rentalId` | `string` | có | EA-BR-07 — tối đa 1 Assignment hiệu lực/`role`/Rental |
| `role` | `AssignmentRole` | có | `DELIVERY`/`RECEIVING` (giữ nguyên code đã scaffold, §0.4) |
| `assigneeEmployeeId` | `string` | có | EA-BR-08/09 — phải `ACTIVE` + vai trò phù hợp |
| `plannedWindowStart`/`plannedWindowEnd` | `string` | có | Snapshot từ `Rental.pickupDateTime`/`expectedReturnDateTime` lúc phân công (không tham chiếu sống — mirror snapshot pattern `Contract`) |
| `status` | `AssignmentStatus` | có | 6 giá trị (mở rộng — xem §11), khởi tạo `ASSIGNED` |
| `assignedByUserId`/`assignedByName`/`assignedByRole` | `string` | có | Actor lúc tạo |
| `assignedAt` | `string` | có | |
| `reassignmentHistory` | `AssignmentReassignment[]` | — (mặc định `[]`) | EA-BR-12 |
| `cancelReason` | `string?` | — | Bắt buộc khi `CANCELLED` |
| `note` | `string?` | — | |
| `createdAt`/`updatedAt` | `string` | có | |

`AssignmentReassignment`: `{ id, fromEmployeeId, toEmployeeId, reason, byUserId, byName, byRole,
at }`.

**Field KHÔNG lưu (lý do):** `Actual Start`/`Actual End` (gắn với EA-BR-13 tự động, N/A §1.2 — nếu
cần hiển thị, đọc trực tiếp `actualPickupDateTime`/`actualReturnDateTime` của `Rental` qua barrel
khi hiển thị, không lưu trùng).

---

## 3. Hàm thuần (`employees/model.ts`, phần Assignment)

```ts
// EA-BR-07 — tối đa 1 Assignment hiệu lực (status khác CANCELLED) cùng rentalId+role.
hasActiveAssignment(assignments: Assignment[], rentalId: string, role: AssignmentRole): boolean

// EA-BR-10/RC-BR-11 — cảnh báo (không chặn), overlap plannedWindow cùng assigneeEmployeeId.
// TODO(OQ: §0.5 — chưa cộng buffer di chuyển).
export function hasAssignmentConflict(
  assignments: Assignment[],
  employeeId: string,
  windowStart: string,
  windowEnd: string,
  excludeAssignmentId?: string,
): boolean

// Guard trạng thái — mirror pattern mọi feature trước.
canReassign(assignment: Assignment): boolean   // chỉ khi ASSIGNED (EA-BR-11)
canCancelAssignment(assignment: Assignment): boolean  // ASSIGNED/IN_PROGRESS -> CANCELLED

// Chuẩn bị sẵn cho round sau (App nhân viên/handover-return tích hợp thật) — CHƯA có trigger gọi.
export function deriveAssignmentStatusFromRecord(
  handoverOrReturnStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISCARDED',
): AssignmentStatus | undefined
```

---

## 4. Business rule cần trích dẫn (`EA-BR-07 → EA-BR-22`, nguồn: BRD §17 — phần Assignment, phân
biệt với `EA-BR-01→06, 20` đã dùng ở Employee Round 1)

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| EA-BR-07 | Tối đa 1 Assignment hiệu lực/Rental/role | Enforce (`hasActiveAssignment`) |
| EA-BR-08 | Chỉ nhân viên `ACTIVE` được gán | Enforce ở form (lọc danh sách chọn) |
| EA-BR-09 | Chỉ vai trò phù hợp được gán | Enforce ở form |
| EA-BR-10 | Trùng lịch → cảnh báo, không chặn | Enforce (`hasAssignmentConflict`, cảnh báo mềm) |
| EA-BR-11 | Không đổi người khi `IN_PROGRESS`/`DONE` | Enforce (`canReassign`) |
| EA-BR-12 | Đổi người phải lý do + lưu history | Enforce |
| EA-BR-13 | `IN_PROGRESS`/`DONE` tự động theo Handover/Return | N/A — chỉ hàm thuần chuẩn bị sẵn (§0.3) |
| EA-BR-14 | Rental đổi lịch → Planned Window cập nhật + tái kiểm tra | N/A — Rental Round 1 không có Edit, không có kịch bản thật |
| EA-BR-15 | Rental `CANCELLED` → Assignment `CANCELLED` | N/A tự động (§0.3) — chỉ Huỷ thủ công |
| EA-BR-16 | Mọi thay đổi audit | Enforce (`appendAudit()` mọi mutation) |
| EA-BR-17 | Nhân viên chỉ xem assignment của mình | N/A — App nhân viên |
| EA-BR-18 | Đổi trạng thái nhân viên khi còn assignment chưa xong → cảnh báo | N/A Round 1 — không build cảnh báo chéo khi đổi Employee status (ghi `TODO(OQ)` roadmap) |
| EA-BR-19 | Turnaround Buffer/xe hỏng trước giao → Planned Window dời theo | N/A — chưa có kịch bản `IN_RENTAL` đổi xe thật (đồng nhất với Contract/Handover-Return §1.2 trước đó) |
| EA-BR-21 | Không có `ACCEPTED`, "Báo không nhận việc" độc lập | N/A — App nhân viên |
| EA-BR-22 | Chỉ Manager đánh dấu nhân viên không sẵn sàng | N/A — gắn `ON_LEAVE` chưa build (§1.2) |

---

## 5. Màn hình (Round 1)

### 5.1. `DispatchBoardScreen` (`features/calendar`, route `/dispatch`)

Mirror độ phức tạp `CalendarScreen` nhưng đơn giản hơn (không grid) — 2 khối:
- **Danh sách hôm nay**: mỗi dòng = 1 Rental có `pickupDateTime` hoặc `expectedReturnDateTime` rơi
  vào hôm nay, icon 🚗 Giao / 🅿️ Nhận, giờ, khách, xe, địa điểm, tên nhân viên đã phân công (đọc
  `Assignment` qua barrel `employees`) hoặc badge "Chưa phân công" nổi bật (màu cảnh báo) + nút
  Phân công/Đổi người ngay trên dòng.
- **3 widget**: Sắp giao / Sắp nhận (trong 24h tới) / Quá hạn trả (`expectedReturnDateTime` đã qua,
  Rental chưa `RETURNED`+).

### 5.2. Tab "Phân công" ở `RentalDetailScreen` — component mới `RentalAssignmentTab.tsx`

2 card (Delivery/Receiving): nếu chưa có Assignment → nút "Phân công" (gate `ASSIGNMENT.ASSIGN`);
nếu có → tên nhân viên + trạng thái + nút "Đổi người"/"Huỷ phân công" (gate cùng quyền, disable theo
`canReassign`/`canCancelAssignment`).

### 5.3. Dialog

- `AssignmentCreateDialog` — chọn Employee (lọc `ACTIVE` + vai trò phù hợp), hiển thị cảnh báo trùng
  lịch nếu có (không chặn submit).
- `AssignmentReassignDialog` — chọn Employee mới + lý do bắt buộc.
- `AssignmentCancelDialog` — mirror `RentalCancelDialog`, lý do bắt buộc.

---

## 6. Responsive

Dispatch board: danh sách dòng cuộn dọc + 3 widget xếp cột trên mobile (`grid-cols-1 sm:grid-cols-3`,
mirror pattern đã dùng ở các dashboard-card khác trong dự án).

---

## 7. Seed data

- **8-10 `Assignment`**: tham chiếu `rentalId` thật (ưu tiên Rental có pickup/return hôm nay hoặc gần
  đây để Dispatch board có dữ liệu demo thật), `assigneeEmployeeId` thật từ `employees/seed.ts`.
  Phân bổ: 3-4 `ASSIGNED`, 2 `IN_PROGRESS`/`DONE` (seed trực tiếp, khớp Rental đã `HANDED_OVER`+/
  `RETURNED`+ để nhất quán — không mâu thuẫn với Handover/Return đã seed), 1 `CANCELLED`
  (`cancelReason`), 1 `MISSED`, 1 `REASSIGNED` (có `reassignmentHistory` không rỗng).
- Cố ý để **2-3 Rental hôm nay/sắp tới chưa có Assignment** để Dispatch board demo đúng badge "Chưa
  phân công".

---

## 8. Lộ trình còn lại (roadmap)

Nối dây tự động EA-BR-13/14/15/19 (cần ngoại lệ kiến trúc đụng `handover-return`/`rentals` — làm
cùng lúc round nào đó cần mở lại 2 feature này vì lý do khác), đổi người hàng loạt, bảng khối lượng/
báo cáo hiệu suất, cấu hình quy tắc phân công, `ON_LEAVE` cho Employee, đồng bộ 2 chiều với
`deliveryStaffEmployeeId`/`receivingStaffEmployeeId`.

---

## 9. API / hooks / audit

### 9.1. `employees/api.ts` (mở rộng, phần Assignment)

`listAssignments(filter?: {rentalId?, employeeId?, role?, status?})`, `getAssignmentById(id)`,
`createAssignment(input, actor)` (guard `hasActiveAssignment`), `reassignAssignment(id, input,
actor)` (guard `canReassign`), `cancelAssignment(id, reason, actor)` (guard `canCancelAssignment`).

Audit action mới nối cuối `AUDIT_ACTIONS`: `CREATE_ASSIGNMENT`, `REASSIGN_ASSIGNMENT`,
`CANCEL_ASSIGNMENT` (entity `'Assignment'`).

### 9.2. `employees/hooks.ts`

`useAssignments(filter?)`, `useAssignment(id?)`, `useCreateAssignment`, `useReassignAssignment`,
`useCancelAssignment`.

### 9.3. `employees/index.ts`

Thêm: `export type { Assignment } from './model'` + `export { useAssignments, useAssignment,
useCreateAssignment, useReassignAssignment, useCancelAssignment } from './hooks'` + `export {
hasAssignmentConflict, canReassign, canCancelAssignment } from './model'`. (Khác tiền lệ
`handover-return`/`contracts` — feature này **export hooks qua barrel** vì `calendar` và `rentals`
đều cần tiêu thụ Assignment, hợp lý hoá việc deep-import lặp lại ở 2 nơi.)

### 9.4. `calendar/index.ts`

Thêm `export { DispatchBoardScreen } from './screens/DispatchBoardScreen'`.

---

## 10. i18n

Thêm `vi.employees.assignment*`/`vi.dispatch.*` + `ASSIGNMENT_STATUS_LABELS` (6 nhãn, cập nhật từ 3).

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: mở rộng `ASSIGNMENT_STATUSES` thêm 3 giá trị (`REASSIGNED`/`CANCELLED`/
  `MISSED`, theo BRD §10) — **giữ nguyên** `ASSIGNMENT_ROLES`. Nối 3 audit action mới.
- `shared/i18n/vi.ts`: thêm label map (§10).
- `permissions.ts`: **không sửa** — `ASSIGNMENT.VIEW/ASSIGN/EXPORT` đã đúng, dùng `ASSIGN` cho cả
  Phân công/Đổi người/Huỷ (đúng cách `WebappQuanTri.md` §8.4 gộp 1 dòng quyền, đã xác nhận ở Explore).
- `rentals/screens/RentalDetailScreen.tsx`: tab `assignment` thay placeholder.
- `rentals/model.ts`/`api.ts`/`hooks.ts`: **không đụng** (§0.1/§0.3).
- `handover-return/model.ts`/`api.ts`/`hooks.ts`: **không đụng** (§0.3).
- `shared/fixtures/registerSeeds.ts`: **không đổi vị trí import** `@/features/employees/seed` (vẫn
  chạy đầu tiên — đúng thứ tự `employees → customers → vehicles → maintenance → rentals` đã ghi ở
  đầu file). Seed Assignment nằm trong cùng file `employees/seed.ts` (hàm `seedAssignments` riêng,
  thêm 1 lệnh `registerSeedStep` thứ hai trong file) — **không cần đợi `rentals/seed.ts` chạy
  trước**: `rentalId` chỉ là chuỗi hardcode khớp đúng id đã biết trước trong `rentals/seed.ts`
  (không có `readJson()` runtime đọc chéo feature trong bất kỳ `seed.ts` nào ở repo — đã xác minh),
  đúng pattern `calendar/seed.ts` đang tham chiếu cứng `rt_010` dù về mặt thực thi `registerSeedStep`
  không có ràng buộc đọc-ghi thật giữa 2 feature.
- `app/routes.tsx`: bỏ `ComingSoon` cho `/dispatch`.
- `docs/IMPLEMENTATION-PLAN.md`: tick 2 dòng liên quan (Dispatch board + Assignment) ở Phase 2.

---

## 12. Mã requirement cần trích trong code

`EA-BR-07, 08, 09, 10, 11, 12, 16` · `RC-BR-11` · `CR-2026-006, 053` · Open Questions: §0.5 (buffer
di chuyển, phạm vi xem lịch `OPERATION_STAFF`, ngưỡng MISSED).

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Xác nhận `rentals/*`, `handover-return/*`, `vehicles/*`, `permissions.ts` **không bị đụng**.
4. Không có cascade tự động Rental→Assignment hay Handover/Return→Assignment.
5. *(Chủ dự án tự test)*: `/dispatch` hiển thị đúng danh sách hôm nay + 3 widget + badge "Chưa phân
   công"; phân công 1 Rental chưa có Assignment → thành công, ghi audit; đổi người khi `ASSIGNED` →
   bắt buộc lý do, cập nhật `reassignmentHistory`; thử đổi người khi `IN_PROGRESS`/`DONE` → bị chặn;
   huỷ phân công → bắt buộc lý do; tab "Phân công" ở Rental Detail hiển thị đúng 2 role; đổi vai trò
   `OPERATION_STAFF`/`ACCOUNTANT` → không thấy nút Phân công/Đổi người (gate `ASSIGNMENT.ASSIGN`).
6. `docs/IMPLEMENTATION-PLAN.md` tick đúng dòng, xoá `ComingSoon` `/dispatch`.

---

## 14. Việc tiếp theo sau khi phê duyệt Round 1

Phase 2 hoàn thiện (Rental/Calendar/Contracts/Assignment+Dispatch đều `DONE`). Việc tiếp theo tuỳ chủ
dự án chọn: `features/incidents` (đang lên kế hoạch song song), hoặc Phase 4 (Tài chính).
