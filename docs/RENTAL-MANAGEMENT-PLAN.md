# Kế hoạch triển khai — Trang Lượt thuê (Rental Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** **Round 1 `DONE`** (14/09/2026) — data core + Rental
List + Create/Confirm/Cancel đã lên kế hoạch chi tiết đầy đủ ở §1-§7/§9-§13, `dev` implement xong,
qua 2 vòng review `tech-lead` (vòng 1: 1 Blocker — `rentalDurationDays()` làm tròn sai công thức
§3.1, đã sửa; vòng 2: hết Blocker). **Round 2 (`RentalDetailScreen`) `DONE`** (15/09/2026) — kế hoạch
chi tiết đầy đủ ở §15, `dev` implement xong, qua 1 vòng review `tech-lead`: không Blocker. §8 là
**lộ trình** cho phần còn lại của Phase 2 (Calendar+Dispatch/Employee Assignment/Contracts/nối
Rental History) — mức mục tiêu/phạm vi/rule chính, **chưa chi tiết hoá field-level**, sẽ viết plan
riêng khi tới lượt (đúng tiền lệ Vehicle Round 2 ở Phase 1).

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/RentalManagement-BRD.md` (v1.7, đặc biệt §8-§27,
§38, §46, §51-§57) + `RentalManagement-UseCase.md` (v1.2, đặc biệt §5.5 UC-RM-01, §24a UC-RM-06/21) +
`../thien-bao-car-docs/WebappQuanTri.md` §9 (Nhóm 4 — Lượt thuê & hợp đồng) +
`../thien-bao-car-docs/CHANGE-REQUESTS.md` (CR-2026-003/004/005/006/008/009/043/060/062) +
`../thien-bao-car-docs/BusinessRequirementDocument.md` §51 (Open Questions Q48-Q57 — **nguồn Open
Question chuẩn duy nhất dùng trong tài liệu này**, không dùng đánh số Q của `RM-BRD.md` §46 để tránh
nhầm giữa 2 hệ đánh số khác nhau).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION-PLAN.md` (Phase
2), `docs/PAGE-IMPLEMENTATION-PRIORITY.md` (P2.1-P2.4 — xem §0 về thứ tự build đã điều chỉnh). Đối
chiếu mã hiện có: `src/shared/domain/enums.ts` (`RENTAL_STATUSES` — 12 trạng thái đã scaffold sẵn
khớp BRD, `SECURITY_DEPOSIT_TYPES`, `VEHICLE_CLASSES`, `AUDIT_ACTIONS` — chưa có action Rental nào),
`src/shared/domain/permissions.ts` (`RENTAL.VIEW/CREATE/CONFIRM`, `CALENDAR.VIEW` đã có sẵn, dùng
nguyên — xem §9), `src/features/vehicles/model.ts` (xác nhận **không có field giá thuê** — xem §0).

---

## 0. Cảnh báo quan trọng — 2 điểm cần lưu ý trước khi code

### 0.1. Không có "Bảng giá"/"Rate Card" — `Rental Rate` là field nhập tay của chính `Rental`

Toàn bộ 21 module trong `thien-bao-car-docs/CLAUDE.md` **không có module nào sở hữu bảng giá xe**.
`RentalManagement-BRD.md` §16-§17 xác nhận `Rental Rate` là một field của **chính entity `Rental`**,
nhập tay khi tạo (nhân viên tra bảng giá nội bộ chưa số hoá + thoả thuận với khách), không suy ra từ
`Vehicle`:

```text
Base Amount = Rental Rate × Rental Duration
```

Đã đọc lại `src/features/vehicles/model.ts` (Round 1 `VM`, DONE) — xác nhận **không có** field giá
nào trên `Vehicle` (`plate/brand/model/vehicleClass/ownershipType/bankFinanced/currentKm/fuelLevel/
status/note/documents` — hết). **Không được tự thêm field giá vào `Vehicle`** để "suy ra giá" — đó là
tự bịa kiến trúc dữ liệu không có trong tài liệu. `Rental Rate` là input thủ công ở form tạo Rental.

### 0.2. `RentalCalendar-UseCase.md` §24 (RC-BR-01) chưa cập nhật đủ — chỉ liên quan §8 (lộ trình)

`RentalCalendar-BRD.md` §30 (v1.3, mới hơn) liệt kê **8 trạng thái khoá thao tác kéo-thả**
(`HANDED_OVER, IN_RENTAL, RETURNED, SETTLEMENT, COMPLETED, CANCELLED, NO_SHOW, DISPUTED`) trong khi
`RentalCalendar-UseCase.md` §24 (v1.2) chỉ liệt kê 5 trạng thái (thiếu `HANDED_OVER`/`NO_SHOW`/
`DISPUTED`). Không ảnh hưởng Round 1 (chưa có Calendar) — ghi chú lại để khi lên plan Calendar chi
tiết, dùng bản BRD §30 làm chuẩn, không dùng bản UseCase cũ hơn.

---

## 1. Phạm vi Round 1

### 1.1. Trong phạm vi

- Data core `features/rentals`: `model.ts`/`api.ts`/`hooks.ts`/`seed.ts`/`index.ts`.
- Màn **Rental List** (`/rentals`): tìm kiếm + lọc trạng thái/khách/xe/khoảng ngày, danh sách đầy đủ
  12 trạng thái (badge màu).
- **Tạo lượt thuê** (`RentalFormSheet`): chọn Customer → chọn Vehicle → kiểm tra khả dụng (cảnh báo
  trùng lịch — RM-BR-04/RM-BR-23) → nhập Rental Period/địa điểm/giá/cọc/ghi chú → tính giá real-time
  → Save → status khởi tạo `DRAFT` (CR-2026-043).
- **Xác nhận lượt thuê** (action riêng, `DRAFT → CONFIRMED`): re-validate RM-BR-04/05/06/07 + hiển
  thị lỗi rõ ràng nếu không đủ điều kiện (không cho confirm — chặn cứng, không phải cảnh báo).
- **Huỷ lượt thuê** (action riêng, `DRAFT`/`CONFIRMED → CANCELLED`, bắt buộc lý do — mẫu
  `ReasonDialog` như `CustomerReasonDialog`/`EmployeeReasonDialog`).
- Snapshot giá + cọc + `Allowed KM`/`Price Per KM` theo `Vehicle Class` tại thời điểm tạo/xác nhận.
- Route `/rentals` thay `ComingSoon`.

### 1.2. Ngoài phạm vi Round 1 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| Rental Detail (`/rentals/:id`, nhiều tab) | Round riêng sau — xem §8.2 |
| Sửa (Update) một Rental đã tạo | BRD không mô tả luồng sửa tách biệt khỏi Confirm/Cancel ở §46 UC hiện có; RM-BR-10/12 nói COMPLETED không sửa được và giá phải snapshot — cần plan riêng nếu có yêu cầu Edit trước Confirm |
| Assigned Delivery/Receiving Staff | Thuộc Employee Assignment (`EA`) — round riêng, xem §8.4 |
| Contract sinh tự động khi Confirm (`CONTRACT_CREATED`) | `features/contracts` (`CT`) chưa build — Round 1 dừng ở `CONFIRMED`, không tự động tiến state tiếp |
| Handover/Return/Settlement (states `READY_FOR_HANDOVER→...→COMPLETED`) | Thuộc `VH`/`VR`/`RS` — Phase 3/4, chưa build |
| Thu tiền thực tế (Prepayment/Security Deposit "đã thu") | Thuộc `Payment` (`PM`) — Phase 4; Round 1 chỉ lưu **số liệu snapshot**, không có trạng thái "đã thanh toán" |
| Phí trễ giờ (RM-BR-22), phụ thu qua đêm (RM-BR-21) | Phát sinh ở `VehicleReturn` (Phase 3) — không áp dụng lúc tạo/xác nhận |
| Vehicle Block, kéo–thả trên lịch | Thuộc `RentalCalendar` — round riêng, xem §8.1 |
| Đổi xe giữa kỳ / kết thúc sớm / xe hỏng trước giao (RM-BR-27/28/29) | Chỉ áp dụng cho Rental đã `IN_RENTAL`/`CONFIRMED` sắp giao — chưa có luồng Handover để kích hoạt |
| Discount theo loại cụ thể | BRD §17: "Các loại discount: còn chờ Business xác nhận" — Round 1 chỉ 1 field số tiền giảm giá tự do + ghi chú, không có enum loại discount |

---

## 2. Data model

### 2.1. `Rental` (single entity, không nhúng — 1 storage key `rentals`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `status` | `RentalStatus` | có | `RENTAL_STATUSES` đã scaffold (12 giá trị) — khởi tạo `DRAFT` (CR-2026-043) |
| `customerId` | `string` | có | RM-BR-01 |
| `vehicleId` | `string` | có | RM-BR-02 |
| `pickupDateTime` | `string` (ISO datetime) | có | §13 Rental Period — Start DateTime |
| `expectedReturnDateTime` | `string` (ISO datetime) | có | §13/§15 — End DateTime nhập tay khi tạo; RM-BR-03 `> pickupDateTime`. **Lưu ý**: RM-BR-20 (khung 21:00) chính thức áp dụng khi `VehicleHandover` tính lại theo `Actual Pickup DateTime` (Phase 3) — Round 1 chỉ dùng 21:00 làm **giá trị gợi ý mặc định** cho `Return Time` trong form, nhân viên có thể sửa tay, không phải rule chặn cứng ở bước tạo |
| `pickupLocation` | `string` | có | §14 |
| `returnLocation` | `string` | có | §15 |
| `actualPickupDateTime` | `string?` | — | §14 — **chỉ đọc, Round 1 không ghi**, để sẵn cho `VehicleHandover` (Phase 3) ghi vào |
| `actualReturnDateTime` | `string?` | — | §15 — tương tự, để sẵn cho `VehicleReturn` (Phase 3) |
| `vehicleClass` | `VehicleClass` | có | **Snapshot** từ `Vehicle.vehicleClass` tại thời điểm tạo (RM-BR-25) — copy giá trị, không tham chiếu sống |
| `pricePerKm` | `number` | có | Snapshot từ `PRICE_PER_KM_BY_CLASS[vehicleClass]` (CR-2026-008) tại thời điểm tạo |
| `allowedKm` | `number` | có | Snapshot = `350 × rentalDurationDays` (RM-BR-24, công thức ngày — xem §3.2 về giới hạn tháng còn treo) |
| `rentalRate` | `number` | có | Input tay — VNĐ/ngày (§0.1) |
| `rentalDurationDays` | `number` | có | Tính từ `pickupDateTime`/`expectedReturnDateTime` (§3.1), lưu snapshot cùng lúc với giá |
| `baseAmount` | `number` | có | Snapshot = `rentalRate × rentalDurationDays` (§17) |
| `discountAmount` | `number` | — (mặc định 0) | §17 — số tiền giảm tự do, không có enum loại (§1.2) |
| `discountNote` | `string?` | — | Ghi chú lý do giảm giá (nhân viên nhập tay) |
| `additionalChargesAmount` | `number` | — (mặc định 0) | §19 — **tổng 1 field**, không breakdown theo loại (Overtime/Extra mileage/... đều thuộc module chưa build — §1.2) |
| `additionalChargesNote` | `string?` | — | Ghi chú diễn giải khoản phát sinh nếu có, nhập tay |
| `deliveryDistanceKm` | `number?` | — | Số km **ngoài** bán kính 10km (RM-BR-26/CR-2026-062) — nhân viên tự đo Google Maps + nhập tay (Phase 1 baseline, chưa tích hợp API) |
| `deliveryFee` | `number` | — (mặc định 0) | Snapshot = `deliveryDistanceKm > 0 ? deliveryDistanceKm × 15000 : 0` (§3.1) |
| `estimatedTotal` | `number` | có | Snapshot = `baseAmount - discountAmount + additionalChargesAmount + deliveryFee` (§17, mở rộng thêm `deliveryFee` — §19 liệt kê Delivery fee là 1 loại Additional Charge, nhưng tách field riêng vì có công thức tính riêng theo km, cộng vào tổng cùng công thức) |
| `prepaymentAmount` | `number` | có | Snapshot = `30% × baseAmount` (RM-BR-18) — **quy tắc làm tròn chưa chốt** (BRD §51 Q37 phần rounding), Round 1 giữ nguyên số thập phân VNĐ tính được, không tự làm tròn — `TODO(OQ: BusinessRequirementDocument.md §51 Q37 — quy tắc làm tròn Prepayment 30%)` |
| `securityDepositType` | `SecurityDepositType` | có | `CASH_20M` \| `MOTORBIKE` (RM-BR-17) — nhân viên chọn theo khách nói (ai quyết định chính sách vẫn treo — Q37 phần "ai chọn", không chặn việc nhập liệu) |
| `securityDepositAmount` | `number?` | — | Bắt buộc = 20.000.000 nếu `CASH_20M`; bỏ trống nếu `MOTORBIKE` |
| `securityDepositAssetNote` | `string?` | — | Bắt buộc nếu `MOTORBIKE` — mô tả xe máy (đời xe, biển số) + cà vẹt, giá trị ước tính ≥ 15.000.000đ (RM-BR-17) |
| `note` | `string?` | — | §10 |
| `createdAt` / `updatedAt` | `string` (ISO) | có | |

**Field KHÔNG lưu trên model Round 1 (và lý do):**
- `Assigned Delivery/Receiving Staff` — thuộc `EA`, round riêng (§8.4), tránh field rỗng vô dụng.
- `Payment Status` (`UNPAID/PARTIALLY_PAID/PAID/...`, §27 BRD) — thuộc `Payment` (Phase 4); Round 1
  không có khái niệm "đã thu", chỉ có số liệu dự tính.
- `Odometer`/`Fuel Level` lúc giao/nhận (§20/§21) — ghi nhận ở `VehicleHandover`/`VehicleReturn`
  (Phase 3), không phải Rental.
- Enum loại Discount — chưa chốt (§1.2).

### 2.2. Hằng số dùng chung trong `rentals/model.ts` (không đưa lên `shared/domain/enums.ts` vì đây là
   **giá trị số**, không phải danh mục enum)

```ts
// CR-2026-008 — Price Per KM theo Vehicle Class
export const PRICE_PER_KM_BY_CLASS: Record<VehicleClass, number> = {
  VIP_LUXURY: 10000,
  STANDARD: 5000,
  TWO_SEATER: 2000,
}

// CR-2026-008 — Allowed KM/ngày (cộng dồn). Allowed KM/tháng (3.500) chưa dùng ở Round 1
// vì ngưỡng số ngày để tính "thuê tháng" chưa chốt — TODO(OQ: BRD §51 Q53).
export const ALLOWED_KM_PER_DAY = 350

// CR-2026-006 — Turnaround Buffer tối thiểu giữa 2 lượt thuê liền kề cùng 1 xe.
export const TURNAROUND_BUFFER_MINUTES = 90

// CR-2026-060 — tỉ lệ Prepayment trên Base Rental Amount.
export const PREPAYMENT_RATE = 0.3

// CR-2026-003 — Security Deposit cố định cho hình thức CASH_20M.
export const CASH_DEPOSIT_AMOUNT = 20_000_000

// RM-BR-26 / CR-2026-062 — đơn giá phí ngoài bán kính miễn phí.
export const DELIVERY_FEE_PER_KM = 15000
export const FREE_DELIVERY_RADIUS_KM = 10
```

---

## 3. Hàm thuần (`rentals/model.ts`)

### 3.1. Tính giá & snapshot

```ts
rentalDurationDays(pickupDateTime: string, expectedReturnDateTime: string): number
// = Math.max(1, daysBetween(...)) dùng shared/lib/datetime.ts — làm tròn lên khi có phần ngày lẻ
// (phép tính hiển nhiên, không phải quyết định nghiệp vụ cần BA chốt).

calcAllowedKm(rentalDurationDays: number): number
// = rentalDurationDays × ALLOWED_KM_PER_DAY — TODO(OQ) cho nhánh "thuê tháng" (§51 Q53), Round 1
// LUÔN dùng công thức theo ngày bất kể thời lượng, không tự đặt ngưỡng chuyển sang tháng.

calcDeliveryFee(distanceKm: number | undefined): number
// = !distanceKm || distanceKm <= 0 ? 0 : distanceKm × DELIVERY_FEE_PER_KM (RM-BR-26/CR-2026-062).

calcBaseAmount(rentalRate: number, rentalDurationDays: number): number
calcEstimatedTotal(baseAmount, discountAmount, additionalChargesAmount, deliveryFee): number
// theo đúng chuỗi công thức §17 (mở rộng deliveryFee — xem giải thích ở bảng field).

calcPrepaymentAmount(baseAmount: number): number
// = baseAmount × PREPAYMENT_RATE, KHÔNG làm tròn (TODO(OQ) — xem field prepaymentAmount).
```

### 3.2. Chống trùng lịch + Turnaround Buffer (RM-BR-04, RM-BR-23/RC-BR-13)

```ts
// Các trạng thái được coi là "đang chiếm dụng xe" — suy trực tiếp từ ý nghĩa state ở BRD §9:
// xe bị giữ kể từ khi xác nhận tới khi trả xong (RETURNED trở đi coi như xe đã về, không còn chiếm).
const OCCUPYING_STATUSES: RentalStatus[] = [
  'CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER', 'HANDED_OVER', 'IN_RENTAL',
]

hasConflict(
  existingRentals: Rental[],
  vehicleId: string,
  pickupDateTime: string,
  expectedReturnDateTime: string,
  excludeRentalId?: string,
): boolean
// true nếu tồn tại rental khác cùng vehicleId, status thuộc OCCUPYING_STATUSES, và khoảng thời gian
// [pickup, expectedReturn) cách nhau < TURNAROUND_BUFFER_MINUTES so với rental đang xét — công thức
// chuẩn "khoảng cách tối thiểu": A.start < B.end + buffer && B.start < A.end + buffer.
// KHÔNG tính rental đang DRAFT của người khác là chiếm dụng (DRAFT = "chưa xác nhận" — CR-2026-043),
// chỉ cảnh báo mềm ở bước tạo, CHẶN CỨNG ở bước Confirm (RM-BR-04 nói rõ "không được XÁC NHẬN rental
// bị overlap", không nói "không được tạo").

suggestNextPickup(previousExpectedReturnDateTime: string): string
// = previousExpectedReturnDateTime + TURNAROUND_BUFFER_MINUTES phút — dùng làm gợi ý khi form Create
// phát hiện xe vừa có 1 rental khác kết thúc gần đó (CR-2026-006: "giờ giao lượt sau tự dời").
```

Không đưa 2 hàm này lên `shared/lib/` — chỉ `features/rentals` dùng ở Round 1 (Calendar round sau sẽ
import lại từ `rentals/model.ts` qua barrel, giống pattern `maintenance` import `useVehicles` từ
`vehicles/hooks.ts`).

### 3.3. Guard chuyển trạng thái (mirror pattern `vehicles/model.ts` `canChangeStatus`)

```ts
const ROUND1_TRANSITIONS: Partial<Record<RentalStatus, RentalStatus[]>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED'],
}
// CHỈ định nghĩa transition mà Round 1 tự thực hiện qua UI. Các state khác (CONTRACT_CREATED→...→
// COMPLETED, NO_SHOW, DISPUTED) do seed data gán trực tiếp (minh hoạ đủ badge màu cho List) — KHÔNG
// có action UI nào đưa Rental tới các state đó ở Round 1; sẽ mở rộng map này khi Round tương ứng
// (Contract/Handover/Return/Settlement) build tới.

canConfirm(rental, customer, vehicle, existingRentals): { ok: true } | { ok: false; reason: string }
// Kiểm tra RM-BR-04 (hasConflict), RM-BR-05 (vehicle.status !== 'MAINTENANCE'), RM-BR-06
// (vehicle.status !== 'INACTIVE'), RM-BR-07 (customer.status !== 'BLOCKED'). RM-BR-08 (Customer
// INACTIVE) — CustomerStatus hiện chỉ có ACTIVE/BLOCKED (quyết định Phase 1, không có INACTIVE) nên
// rule này không áp dụng được, không code riêng.

canCancel(rental: Rental): boolean
// = ROUND1_TRANSITIONS[rental.status]?.includes('CANCELLED') ?? false — dùng để ẩn/hiện nút Huỷ.
```

---

## 4. Business rule cần trích dẫn (RM-BR-01 → RM-BR-32)

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| RM-BR-01 | Rental thuộc 1 Customer | Enforce (field bắt buộc) |
| RM-BR-02 | Rental thuộc 1 Vehicle | Enforce |
| RM-BR-03 | End DateTime > Start DateTime | Enforce (zod refine) |
| RM-BR-04 | Không confirm nếu overlap | Enforce (`canConfirm`/`hasConflict`) |
| RM-BR-05 | Vehicle MAINTENANCE không được thuê | Enforce ở Confirm |
| RM-BR-06 | Vehicle INACTIVE không được thuê | Enforce ở Confirm |
| RM-BR-07 | Customer BLOCKED không được thuê | Enforce ở Confirm |
| RM-BR-08 | Customer INACTIVE không được thuê | N/A — `CustomerStatus` chưa có `INACTIVE` (Phase 1) |
| RM-BR-09 | IN_RENTAL không được cancel | Thoả tự nhiên (`ROUND1_TRANSITIONS` không có `IN_RENTAL`) |
| RM-BR-10 | COMPLETED không sửa trực tiếp | N/A — Round 1 không có Update Rental |
| RM-BR-11 | Thay đổi sau confirm phải audit | Enforce (mọi mutation gọi `appendAudit()`) |
| RM-BR-12 | Giá phải snapshot | Enforce (§2.1 — mọi field giá tính 1 lần lúc tạo) |
| RM-BR-13 | Actual pickup/return phải lưu | N/A Round 1 — field để sẵn, `VehicleHandover`/`VehicleReturn` (Phase 3) ghi |
| RM-BR-14 | Additional charges liên kết Rental | Enforce ở mức tổng field (§1.2 — không breakdown) |
| RM-BR-15 | History không xoá | Enforce (không có `remove()`, Cancel chỉ đổi status) |
| RM-BR-16 | Settlement trước khi COMPLETED | N/A Round 1 |
| RM-BR-17 | Cọc 2 phần | Enforce (field snapshot) |
| RM-BR-18 | Prepayment cấn tiền thuê, 30%+70%=100% | Enforce phần tính 30%; không có luồng thu tiền (Phase 4) |
| RM-BR-19 | Lịch thanh toán 3 mốc | N/A gate thu tiền (Phase 4); chỉ ghi số liệu |
| RM-BR-20 | Khung giờ 21:00 | Dùng làm gợi ý mặc định form (§2.1), KHÔNG phải rule chặn cứng ở Round 1 |
| RM-BR-21 | Cửa sổ nhận xe đóng 23:00 | N/A — thuộc `VehicleReturn` |
| RM-BR-22 | Phí trễ giờ bậc thang | N/A — thuộc `VehicleReturn` |
| RM-BR-23 | Turnaround Buffer 90 phút | Enforce (`hasConflict`) |
| RM-BR-24 | Allowed KM = 350×ngày / 3.500×tháng | Enforce công thức ngày; tháng = `TODO(OQ)` |
| RM-BR-25 | Price Per KM theo Vehicle Class | Enforce (snapshot từ hằng số §2.2) |
| RM-BR-26 | Phí giao/nhận ngoài 10km = 15.000đ/km | Enforce (`calcDeliveryFee`, nhập tay khoảng cách) |
| RM-BR-27 | Gián đoạn giữa kỳ (đổi xe/kết thúc sớm) | N/A — chưa có `IN_RENTAL` qua UI |
| RM-BR-28 | Xe hỏng trước giờ giao | N/A — chưa build |
| RM-BR-29 | Xác nhận giờ trả cuối kỳ | N/A — chưa build |
| RM-BR-30 | Vehicle Block | N/A — thuộc `RentalCalendar` round sau |
| RM-BR-31 | Trả sớm giữ giá | N/A — thuộc `VehicleReturn` |
| RM-BR-32 | Nhiên liệu theo số vạch | N/A — thuộc `VehicleHandover`/`VehicleReturn` |

---

## 5. Màn hình (Round 1)

### 5.1. `RentalListScreen` (`/rentals`)

- Bảng (desktop) / card (mobile, mẫu `VehicleCard`) — cột: Khách hàng, Xe (biển số + hãng/dòng),
  Thời gian thuê (pickup→expectedReturn), `estimatedTotal`, trạng thái (badge màu theo 12 state).
- Tìm kiếm: tên khách/SĐT (join `customers`), biển số xe (join `vehicles`).
- Bộ lọc: trạng thái (multi-select hoặc dropdown đơn — theo mẫu `VehicleFilters`), khách hàng, xe,
  khoảng ngày (pickup trong khoảng).
- Nút "Tạo lượt thuê" (gate `can('RENTAL','CREATE')`) mở `RentalFormSheet`.
- Mỗi hàng: nút "Xác nhận" (hiện khi `status === 'DRAFT'`, gate `can('RENTAL','CONFIRM')`) và "Huỷ"
  (hiện khi `canCancel(rental)`, cùng permission `RENTAL.CONFIRM` — nguồn permission đã ghi rõ
  "Sửa/xác nhận/hủy lượt thuê" dùng chung 1 action).

### 5.2. `RentalFormSheet` (tạo mới — Round 1 không có Edit)

Các khối theo thứ tự (mirror UC-RM-01 §5.5, không phải wizard nhiều bước như App nhân viên — đây là
Webapp, dùng 1 Sheet cuộn dọc theo nhóm, giống độ phức tạp `VehicleFormSheet`/`EmployeeFormSheet`
nhưng nhiều field hơn):

1. **Khách hàng & Xe**: chọn Customer (combobox tìm theo tên/SĐT, chỉ `ACTIVE`), chọn Vehicle
   (combobox tìm theo biển số, chỉ `AVAILABLE` — cảnh báo mềm nếu chọn xe `MAINTENANCE`/`INACTIVE`,
   không chặn tại Create, chặn tại Confirm theo §3.3).
2. **Thời gian thuê**: Pickup Date/Time, Return Date/Time (mặc định gợi ý Return Time = 21:00 theo
   §2.1). Hiển thị cảnh báo trùng lịch real-time (`hasConflict`) nếu phát hiện — không chặn Save ở
   `DRAFT`, chỉ cảnh báo (đúng §3.2).
3. **Địa điểm giao/nhận**: Pickup Location, Return Location (text), `deliveryDistanceKm` (số, optional
   — có gợi ý text "để trống nếu trong bán kính 10km miễn phí").
4. **Giá & phụ phí**: `rentalRate` (input), hiển thị real-time: `rentalDurationDays` (tính tự động,
   readonly), `baseAmount`, `allowedKm`, `pricePerKm` (theo Vehicle Class đã chọn, readonly),
   `discountAmount` + `discountNote`, `additionalChargesAmount` + `additionalChargesNote`,
   `deliveryFee` (tính tự động từ `deliveryDistanceKm`, readonly), `estimatedTotal` (tổng, readonly,
   nổi bật).
5. **Đặt cọc**: chọn `securityDepositType` (`CASH_20M`/`MOTORBIKE`), hiển thị `prepaymentAmount`
   (tính tự động, readonly, kèm chú thích "30% Base Rental — CR-2026-060"), nếu `CASH_20M` hiện
   `securityDepositAmount` cố định 20.000.000 (readonly); nếu `MOTORBIKE` hiện field
   `securityDepositAssetNote` bắt buộc.
6. **Ghi chú**: `note` (textarea, optional).

### 5.3. Dialog "Xác nhận lượt thuê" / "Huỷ lượt thuê"

- Xác nhận: hiển thị kết quả `canConfirm()` — nếu `ok: false` disable nút xác nhận + hiện `reason`
  (không cho submit, không phải warning có thể bỏ qua — đúng RM-BR-04/05/06/07 là rule chặn cứng).
- Huỷ: mẫu `ReasonDialog` bắt buộc nhập lý do (mirror `CustomerReasonDialog`), không có logic phí huỷ
  (§1.2 — Open Question Q57 phần phí huỷ giữa kỳ chưa chốt, và trạng thái trước Handover vốn không
  có phí theo BRD).

---

## 6. Responsive

Bám khung đã dùng: List → bảng desktop / `RentalCard` mobile (≥768px chuyển bảng, mẫu `VehicleCard`).
`RentalFormSheet` nhiều field hơn Vehicle/Customer — dùng `ScrollArea` bên trong `SheetContent` (đã
có sẵn primitive `shared/ui/scroll-area`), test kỹ ở 375px vì đây là form dài nhất từ trước tới nay
trong dự án (6 khối, ~20 field) — chia rõ từng khối bằng `Separator` + heading nhỏ để không rối.

---

## 7. Seed data (`features/rentals/seed.ts`)

- **~20-24 bản ghi**, ngày tính động theo `isoDateOffset(days)` (mẫu `maintenance/seed.ts`, không
  hardcode ngày cứng), tham chiếu `customerId`/`vehicleId` **thật** lấy từ
  `src/features/customers/seed.ts`/`src/features/vehicles/seed.ts` (đọc file đó lấy id/plate/tên đã
  seed sẵn, không tự bịa id).
- Phân bổ đủ 12 trạng thái để List/badge test được toàn bộ, dù Round 1 chỉ thao tác được
  `DRAFT`/`CONFIRMED`/`CANCELLED` qua UI — các trạng thái còn lại seed **trực tiếp** (ghi thẳng field
  `status`), không giả lập qua action:
  - 4-5 `DRAFT` (vài cái trong tương lai gần, để test Confirm)
  - 5-6 `CONFIRMED` (gồm ít nhất 1 cặp **cùng xe, cách nhau đúng < 90 phút** để test cảnh báo
    `hasConflict`/`RC-BR-13` khi implement Calendar sau; 1-2 pickup **hôm nay** để chuẩn bị dữ liệu
    cho Dispatch board round sau)
  - 2 `CONTRACT_CREATED`, 2 `READY_FOR_HANDOVER`, 2 `HANDED_OVER`, 2 `IN_RENTAL` (ít nhất 1 pickup
    hôm nay/đang diễn ra — chuẩn bị cho Calendar/Dispatch)
  - 2 `RETURNED`, 2 `SETTLEMENT`, 3 `COMPLETED` (quá khứ)
  - 1 `CANCELLED` (có `note` ghi lý do), 1 `NO_SHOW`, 1 `DISPUTED`
- Mọi bản ghi snapshot đủ field theo §2.1 (kể cả state không tới từ Round 1 UI — vẫn phải có
  `baseAmount`/`estimatedTotal`/... hợp lệ để List hiển thị đúng, không để trống/0 giả).

---

## 8. Lộ trình Phase 2 còn lại (roadmap — KHÔNG chi tiết hoá field-level ở đây)

> Mỗi mục dưới đây sẽ có plan doc riêng (hoặc bổ sung section riêng vào file này) khi tới lượt, đúng
> tiền lệ Vehicle Round 2 ở Phase 1: bám sát BRD tương ứng tại thời điểm đó, không tái dùng nội dung
> phác thảo dưới đây làm đặc tả cuối cùng nếu tài liệu đã đổi.

### 8.1. `features/calendar` (RC) + Vehicle Block

Mục tiêu: Day/Week (mặc định — CR-2026-032)/Month (CR-2026-017, lưới xe×ngày)/Agenda hiển thị dữ
liệu `Rental` từ Round 1 (RC không sở hữu dữ liệu riêng — `RentalCalendar-BRD.md` §7). Tạo nhanh từ ô
trống (gọi thẳng logic `RentalFormSheet` rút gọn). Kéo-thả dời lịch/đổi xe theo `RC-BR-01→16` (dùng
bản BRD §30, không dùng UseCase §24 cũ hơn — xem §0.2). Vehicle Block (CR-2026-015/017) là entity mới
(`VehicleBlock`), khoá lịch xe theo khoảng ngày, độc lập `Vehicle.status`. Dispatch board (giao/nhận
hôm nay, sắp đến hạn, quá hạn) nằm trong `calendar` theo `CLAUDE.md` bản đồ module ("+ dispatch board
trong `calendar`").

### 8.2. `RentalDetailScreen` (`/rentals/:id`) — kế hoạch chi tiết đầy đủ ở §15

### 8.3. Nối `Rental History` vào Vehicle Detail + Customer Detail

Thay `VehicleDetailPlaceholder`/`CustomerDetailPlaceholder` ở tab "Lịch sử thuê" bằng dữ liệu thật
(`useRentals({ vehicleId })`/`useRentals({ customerId })`) — chỉ cần barrel export hook, không sửa
business logic Rental.

### 8.4. `features/employees` — mở rộng Assignment

`ASSIGNED → IN_PROGRESS → DONE`, gán Delivery/Receiving Staff vào `Rental`, phát hiện trùng lịch nhân
viên (cảnh báo không chặn — `RC-BR-11`). Thêm field `assignedDeliveryStaffId`/
`assignedReceivingStaffId` vào `Rental` ở round này (không thêm sớm ở Round 1 — §1.2).

### 8.5. `features/contracts` (CT)

Model `Contract`/`ContractAddendum`, tự sinh từ Rental khi Confirm (đưa Rental sang `CONTRACT_CREATED`
— nối tiếp state machine mà Round 1 dừng ở `CONFIRMED`). Danh sách + Detail (preview placeholder, nút
"Xuất PDF" giả lập, phụ lục `ADDENDUM_VEHICLE_SWAP`/`TERMINATION_AGREEMENT` — CR-2026-012/013).

---

## 9. API / hooks / audit (Round 1)

`api.ts` (namespace storage `rentals`, mọi hàm bọc `fakeRequest()`):

- `list(filter?: { search?, status?, customerId?, vehicleId?, dateFrom?, dateTo? })`, `getById(id)`
- `create(input)` — tính toàn bộ field snapshot qua hàm thuần §3.1/§2.2, status khởi tạo `DRAFT`
- `confirm(id)` — chạy `canConfirm()`, ném lỗi rõ ràng nếu không đạt, đổi status `CONFIRMED`
- `cancel(id, reason)` — chạy `canCancel()`, đổi status `CANCELLED`, lưu `note` nối thêm lý do huỷ

Mọi mutation gọi `appendAudit()` — thêm **3 audit action mới** vào cuối `AUDIT_ACTIONS`:
`CREATE_RENTAL`, `CONFIRM_RENTAL`, `CANCEL_RENTAL`.

`hooks.ts`: `useRentals(filter?)`, `useRental(id?)`, `useCreateRental`, `useConfirmRental`,
`useCancelRental` — mỗi mutation `invalidateQueries(['rentals', ...])`. `useActor()` mirror pattern
`vehicles/hooks.ts`.

`index.ts`: export type `Rental` + `RentalListScreen`. **Không** export hooks (feature khác import
thẳng `@/features/rentals/hooks` khi cần, đúng tiền lệ `maintenance`→`vehicles`).

---

## 10. i18n

Thêm namespace `vi.rentals.*` (mẫu `vi.vehicles.*`) — nhãn field, nhãn action, thông báo lỗi
`canConfirm()`. Thêm `RENTAL_STATUS_LABELS: Record<RentalStatus, string>` (12 nhãn tiếng Việt) +
`SECURITY_DEPOSIT_TYPE_LABELS` (2 nhãn) vào `vi.ts` cạnh các map enum khác.

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: nối 3 action mới vào `AUDIT_ACTIONS` (không thêm enum mới — mọi enum
  Rental cần thiết `RENTAL_STATUSES`/`SECURITY_DEPOSIT_TYPES` đã scaffold sẵn từ Phase 0).
- `shared/i18n/vi.ts`: thêm `vi.rentals.*` + 2 label map (§10).
- `permissions.ts`: **không sửa** — `RENTAL.VIEW/CREATE/CONFIRM` đã đúng, dùng nguyên (đối chiếu
  `source` hiện có: "Tạo lượt thuê"/"Sửa/xác nhận/hủy lượt thuê" khớp đúng hành vi Round 1).
- `shared/fixtures/registerSeeds.ts`: import `seedRentals` sau `maintenance` (thứ tự phụ thuộc:
  employees→customers→vehicles→maintenance→**rentals**, vì seed Rental cần id khách/xe thật).
- `app/routes.tsx`: bỏ `ComingSoon` cho `/rentals` (giữ nguyên `/rentals/:id` — chưa tới lượt, xem
  §8.2).
- `docs/IMPLEMENTATION-PLAN.md`: tick phần `features/rentals` Round 1 khi xong.

---

## 12. Mã requirement cần trích trong code

`RM-BR-01, 02, 03, 04, 05, 06, 07, 09, 10, 11, 12, 14, 15, 17, 18, 20, 23, 24, 25, 26` ·
`CR-2026-003, 004, 005, 006, 008, 043, 060, 062` · Open Questions: `BusinessRequirementDocument.md
§51 Q53` (Allowed KM tháng), `Q37` (rounding Prepayment).

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch (không cần Playwright).
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Không có field/logic "giá theo xe" nào bị thêm vào `Vehicle` (đối chiếu §0.1) — kiểm tra diff
   `vehicles/model.ts` không đổi.
4. Không có logic tính phí trễ giờ (RM-BR-22)/phụ thu qua đêm (RM-BR-21)/khấu trừ nào lọt vào —
   những rule này thuộc Phase 3, ngoài phạm vi (§1.2).
5. *(Chủ dự án tự test thủ công sau bàn giao)*: tạo lượt thuê đủ 6 khối form → `DRAFT`; xác nhận
   lượt hợp lệ → `CONFIRMED`; thử xác nhận lượt trùng lịch (< 90 phút cùng xe) → bị chặn kèm lý do rõ
   ràng; huỷ lượt `DRAFT`/`CONFIRMED` → bắt buộc nhập lý do; lọc theo trạng thái/khách/xe/khoảng ngày;
   badge 12 trạng thái hiển thị đúng màu; đổi vai trò Topbar → `OPERATION_STAFF` xem list được (`TBD`
   trên `CREATE` → coi như không tạo được, đúng `can()` an toàn).
6. `docs/IMPLEMENTATION-PLAN.md` tick phần Rental Round 1, xoá `ComingSoon` route `/rentals`.

---

## 14. Việc tiếp theo sau khi phê duyệt Round 1 (lịch sử — Round 1 đã `DONE`)

Round 1 trở thành task brief đầy đủ giao cho agent `dev` (kèm Scope of Work + danh sách file cần đọc
trước theo format chuẩn). Sau khi qua review `tech-lead` đạt (4 bước chuẩn), việc tiếp theo là lên kế
hoạch chi tiết cho **`features/calendar`** (§8.1) — mảnh tiếp theo theo thứ tự đã điều chỉnh (xem
Context ở đầu tài liệu), đọc lại `RentalCalendar-BRD.md` §30 tại thời điểm đó (không dùng lại nội
dung phác thảo §8.1 làm đặc tả cuối). ✅ Đã xong (`calendar` Round 2 DONE, Round 3 tạm hoãn theo yêu
cầu chủ dự án 15/09/2026) — xem §15 cho `RentalDetailScreen`.

---

## 15. Round 2 — `RentalDetailScreen` (`/rentals/:id`)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `DONE` (15/09/2026) — `dev` implement xong, qua 1
vòng review `tech-lead`: không Blocker. 3 quyết định nhỏ của `dev` được xác nhận đúng khi review:
tách `RentalOverviewTab`/`RentalPricingTab` thành component riêng (đúng tiền lệ
`CustomerProfileTab.tsx`/`VehicleOverviewTab.tsx`); thêm field `rental.note` (điều kiện, chỉ hiện
khi có giá trị) vào tab Tổng quan dù không liệt kê tường minh ở §15.2 — chấp nhận được, field có
thật trên `Rental` và không có tab nào khác phù hợp hơn; `vehicleClass` ở tab Tổng quan lấy đúng từ
snapshot `rental.vehicleClass` (RM-BR-25), không lấy từ `vehicle.vehicleClass` sống.

### 15.1. Nguồn đối chiếu (không cần đọc lại toàn bộ BRD — mọi field/rule liên quan đã trích ở §2-§4)

Toàn bộ field hiển thị đã **có sẵn thật** trên `Rental` (model Round 1, §2.1 — không thêm field mới).
Chỉ cần đối chiếu thêm `RentalManagement-BRD.md` §36 (khung "Rental Detail" — liệt kê các khối thông
tin ở mức skeleton, không chi tiết field vì đây là BRD tổng quát cấp thấp — mỗi khối tương ứng đúng 1
tab dưới đây) và mẫu code `src/features/customers/screens/CustomerDetailScreen.tsx` +
`src/features/vehicles/components/VehicleAuditTab.tsx` (mẫu tab audit, copy gần như nguyên).

### 15.2. Phạm vi

**Trong phạm vi:** màn `RentalDetailScreen` (`/rentals/:id`), mirror cấu trúc `CustomerDetailScreen`
(header cố định + `Tabs`). Header: tên khách + biển số xe + `RentalStatusBadge`, 2 nút hành động tái
dùng nguyên từ List (`RentalConfirmDialog`/`RentalCancelDialog`, hiện/ẩn theo `canConfirm()`/
`canCancel()` đã có ở Round 1 — không viết lại). Thêm điều hướng click hàng ở `RentalListScreen` →
`/rentals/:id` (mirror `CustomerListScreen`/`CustomerCard` → `/customers/:id`, đúng tiền lệ Vehicle/
Customer).

**8 tab** (nhóm 14 khối BRD §36 thành các tab có ý nghĩa, tránh tab rời rạc chỉ 1-2 field — đúng tinh
thần đã áp dụng khi gộp tab "Chủ xe & Ký gửi" ở Vehicle Detail):

| # | Tab | Trạng thái | Nội dung |
| - | --- | --- | --- |
| 1 | **Tổng quan** (mặc định) | Thật | Customer/Vehicle/Rental Period/Pickup/Return — toàn bộ field đã có trên `Rental` + join tên khách (`useCustomers`)/biển số xe (`useVehicles`), đúng pattern deep-import đã dùng ở `RentalListScreen`/`RentalCard` |
| 2 | **Giá, cọc & phát sinh** | Thật | `rentalRate`/`rentalDurationDays`/`baseAmount`/`discountAmount`+`discountNote`/`deliveryDistanceKm`+`deliveryFee`/`estimatedTotal`/`prepaymentAmount`/`securityDepositType`+`securityDepositAmount`/`securityDepositAssetNote`/`additionalChargesAmount`+`additionalChargesNote` — mọi field đã snapshot sẵn trên `Rental` (§2.1), chỉ hiển thị, không tính lại |
| 3 | **Thanh toán** | Placeholder | `RentalDetailPlaceholder` — "Chờ triển khai Payment (Phase 4)" |
| 4 | **Hợp đồng** | Placeholder | "Chờ triển khai Contract Management (§8.5)" |
| 5 | **Giao/nhận** | Placeholder | "Chờ triển khai VehicleHandover/VehicleReturn (Phase 3)" — gộp 2 khối BRD (Handover + Return Inspection), cùng lý do gộp tab "Chủ xe & Ký gửi" ở Vehicle Detail: cả hai cùng phụ thuộc module chưa tồn tại |
| 6 | **Sự cố** | Placeholder | "Chờ triển khai DamageIncident (Phase 3)" |
| 7 | **Phân công** | Placeholder | "Chờ triển khai Employee Assignment (§8.4)" |
| 8 | **Nhật ký thao tác** | Thật | Mirror `VehicleAuditTab.tsx` gần như nguyên xi — `listAuditRecords().filter(r => r.entity==='Rental' && r.entityId===rental.id)`, sort `at` giảm dần |

**Ngoài phạm vi:** không có Edit Rental (Round 1 đã loại — §1.2 vẫn đúng), không tự tạo dữ liệu giả
cho 5 tab placeholder, không thêm audit action mới (tab 8 chỉ đọc), không sửa `permissions.ts`.

### 15.3. `RentalDetailPlaceholder.tsx` — component mới

Copy y hệt `CustomerDetailPlaceholder.tsx`/`VehicleDetailPlaceholder.tsx` (đổi feature path) — đã có
2 tiền lệ giống hệt, không cần thiết kế lại.

### 15.4. API / hooks — **không cần API mới**, chỉ mở rộng barrel

`useRental(id)`, `useConfirmRental`, `useCancelRental` **đã tồn tại** trong `rentals/hooks.ts` (dùng ở
`RentalListScreen`/dialogs) nhưng **chưa export qua barrel** `rentals/index.ts` (hiện chỉ có
`useRentals`). Thêm vào `rentals/index.ts`:
```ts
export { useRental, useConfirmRental, useCancelRental } from './hooks'
```
Không cần hàm thuần mới, không cần audit action mới, không đụng `model.ts`/`api.ts`.

### 15.5. Responsive

Bám khung `CustomerDetailScreen`/`VehicleDetailScreen` đã dùng — 8 tab `TabsList` cần `max-w-full` +
cuộn ngang ở mobile (đúng cách `VehicleDetailScreen` đã xử lý cho 12 tab, ít tab hơn nên rủi ro tràn
thấp hơn).

### 15.6. i18n

Thêm `vi.rentals.tab*` (8 nhãn tab) + nhãn field còn thiếu cho tab Tổng quan/Giá-cọc (đa số đã có sẵn
từ `RentalFormSheet`/`RentalCard` — tái dùng, không viết lại) + `rentalDetailPlaceholder*` (5 câu
placeholder khác nhau theo tab).

### 15.7. Mã requirement

Không có rule mới — chỉ hiển thị dữ liệu Round 1 đã enforce (`RM-BR-01→26` đã trích ở §12), cộng
tham chiếu BRD §36 (khung Rental Detail, mức skeleton).

### 15.8. Definition of Done (Round 2)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Không đụng `rentals/model.ts`/`api.ts` (chỉ `index.ts` +1 dòng export).
4. *(Chủ dự án tự test)*: click 1 hàng ở `/rentals` → mở đúng `/rentals/:id`; 8 tab đúng nội dung; tab
   Tổng quan/Giá-cọc/Nhật ký hiển thị dữ liệu thật đúng lượt đang xem (không lẫn lượt khác); nút Xác
   nhận/Huỷ hoạt động y hệt từ List; 5 tab placeholder hiển thị đúng câu chờ Phase tương ứng.
5. `docs/IMPLEMENTATION-PLAN.md` tick dòng `RentalDetailScreen`, xoá `ComingSoon` route `/rentals/:id`.

---

## 16. Việc tiếp theo sau khi phê duyệt Round 2

Sau khi qua review `tech-lead` đạt, `features/rentals` hoàn thiện cả List + Detail. Việc tiếp theo
theo backlog Phase 2 còn lại: `features/contracts` (§8.5) hoặc mở rộng Assignment ở `features/employees`
(§8.4) — tuỳ ưu tiên chủ dự án chọn, đọc lại BRD tương ứng tại thời điểm đó.
