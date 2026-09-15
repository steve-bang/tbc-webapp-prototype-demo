# Kế hoạch triển khai — Giao xe & Nhận xe (Vehicle Handover / Vehicle Return)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `APPROVED` (15/09/2026, chủ dự án phê duyệt) — Round 1
(data core + Theo dõi giao/nhận + Biên bản đọc-chi tiết + Chỉnh sửa/Huỷ có kiểm soát + Vehicle
Condition Timeline bản đầy đủ) đã lên kế hoạch chi tiết, đã giao `dev` implement.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/VehicleHandover-BRD.md` (v1.5, toàn bộ — đặc
biệt §6, §9-§10, §12-§16, §22, §29) + `-UseCase.md` (v1.3, đối chiếu §0.1) +
`../thien-bao-car-docs/modules/VehicleReturn-BRD.md` (v1.6, toàn bộ — đặc biệt §6, §13-§15, §25,
§32) + `-UseCase.md` (v1.3) + `../thien-bao-car-docs/WebappQuanTri.md` §10 (toàn bộ, đặc biệt §10.2)
+ `../thien-bao-car-docs/CHANGE-REQUESTS.md` (CR-2026-003/004/005/006/007/009/010/011/012/013/015/
023/024/043/045/052/054/055/056/057/058/060/062/063).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/CONTRACT-MANAGEMENT-PLAN.md`
§0.2 (mẫu framing ngoại lệ kiến trúc), `docs/RENTAL-MANAGEMENT-PLAN.md` (mẫu format Round). Đối
chiếu mã hiện có: `src/shared/domain/enums.ts` (`CONDITION_EVENT_TYPES` đã scaffold, chưa có enum
Handover/Return — xem §11), `src/shared/domain/permissions.ts` (`HANDOVER_RETURN.VIEW/EXECUTE` đã
có sẵn, dùng nguyên), `src/features/rentals/model.ts` (`ROUND1_TRANSITIONS` — điểm sẽ mở rộng, xem
§0.2), `src/features/vehicles/model.ts` (`VehicleDocument.fileMeta` — mẫu media placeholder).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. Mâu thuẫn tài liệu — BRD là bản chuẩn, UseCase thiếu một số mã BR

`VehicleHandover-UseCase.md` §21 liệt kê `VH-BR-01…18` + `VH-BR-23` nhưng **thiếu** `VH-BR-19/20/
21/22` (có trong BRD §22). Tương tự `VehicleReturn-UseCase.md` §26 liệt kê `VR-BR-01…21` + `VR-BR-29`
nhưng **thiếu** `VR-BR-22…28` (có trong BRD §25). Dùng **BRD làm nguồn duy nhất** cho bảng mã BR ở
§4 — UseCase chỉ dùng để lấy luồng bước Use Case (§4.2 dưới), không dùng để đối chiếu số lượng BR.

`WebappQuanTri.md` §10.7 liệt kê "trễ giờ >3h" và "đơn giá phí tận nơi" như Open Question còn treo,
nhưng thực tế đã **chốt** bởi CR-2026-054 (ân hạn 15 phút + giữ xe qua đêm) và CR-2026-062
(15.000đ/km) — §10.7 chưa cập nhật đồng bộ. Dùng CR log trực tiếp, không dùng §10.7 làm nguồn cho 2
mục này.

### 0.2. Ranh giới Webapp vs App nhân viên — quyết định cốt lõi của round này

`CLAUDE.md` §3 và `WebappQuanTri.md` §10.1-§10.2 nói **giống hệt nhau**: việc **thực hiện** giao/nhận
xe tại hiện trường (chụp ảnh/video, ghi odo/fuel thật) thuộc **App nhân viên** (repo
`thien-bao-car-app-prototype-demo`, không thuộc phạm vi phiên làm việc này); Webapp chỉ **giám sát +
cấu hình + xử lý tiếp**. `permissions.ts` đã encode đúng: `HANDOVER_RETURN.EXECUTE` có
`SALES: false`.

**Hệ quả kiến trúc:**

- Round 1 **không build wizard tạo/thực hiện** (không có form nhập odo/fuel/chụp ảnh từng bước kiểu
  UC-VH-01→09/UC-VR-01→14). `HandoverRecord`/`ReturnRecord` đạt `COMPLETED` **chỉ qua seed data**
  (§7) — đúng tiền lệ Contract Round 1 seed thẳng các state xa chưa có UI thao tác.
- Webapp Round 1 chỉ có **1 nhóm thao tác ghi thật**: Chỉnh sửa có kiểm soát (UC-VH-13/UC-VR-18) và
  Huỷ có kiểm soát (UC-VH-14/UC-VR-19) cho bản ghi `COMPLETED`, gate `MANAGER`/`SYSTEM_ADMIN`.
- Media (ảnh/video) = **metadata placeholder** (category/thời điểm chụp/người chụp/ghi chú — không
  có file thật), mirror `VehicleDocument.fileMeta` — đúng chữ "placeholder ảnh" đã ghi sẵn trong
  `IMPLEMENTATION-PLAN.md` Phase 3.

### 0.3. `rentals/model.ts` — Round 1 handover-return ĐƯỢC PHÉP mở rộng thêm (tiếp nối Contract)

Đây là feature **thứ 2** (sau `contracts`) được phép mở rộng `rentals/model.ts`/`api.ts`/`hooks.ts`
theo đúng lời mời trong comment `ROUND1_TRANSITIONS`. Phạm vi mở rộng ở round này **chỉ giới hạn ở
chiều Huỷ có kiểm soát** (revert), **không** build transition thuận qua UI (xem §0.4) — 4 hàm mới:
`canCancelHandover()`, `revertHandoverCancelled()`, `canCancelReturn()`, `revertReturnCancelled()`
(chi tiết §3.2/§9.2). Không đổi field `Rental`, không đổi `canConfirm`/`canCancel`/`hasConflict`/công
thức giá đã có.

### 0.4. KHÔNG mở rộng `vehicles/model.ts`/`api.ts` — giới hạn có chủ đích

VH-BR-10/VR-BR-11 yêu cầu Vehicle chuyển `RENTED`/`AVAILABLE` + cập nhật `currentKm` khi Handover/
Return hoàn tất, và UC-VH-14/UC-VR-19 yêu cầu hoàn tác các field này khi Huỷ. **Round 1 không làm
phần Vehicle này** — lý do: (a) hoàn tất chỉ qua seed (§0.2), Vehicle status/km seed trực tiếp cho
nhất quán, không cần code; (b) hoàn tác khi Huỷ đòi hỏi biết chắc Vehicle chưa bị thao tác nào khác
xen giữa (rủi ro sai lệch dữ liệu nếu tự động ghi đè) — đây là ngoại lệ kiến trúc **thứ 2** trong
cùng 1 round (mở `vehicles/model.ts`), vượt quá phạm vi đã duyệt. Dialog Huỷ hiển thị **cảnh báo rõ
ràng**: "Vui lòng tự kiểm tra và cập nhật trạng thái/Odometer của xe (nếu cần) tại trang Chi tiết
xe — hệ thống chưa tự động hoàn tác." `TODO(OQ)` ghi rõ trong code, để lại roadmap (§8).

### 0.5. Danh sách Open Question chạm tới — không tự chốt

| Open Q | Ảnh hưởng | Xử lý Round 1 |
| --- | --- | --- |
| Thang đo "số vạch" nhiên liệu cụ thể (0-N) — CR-2026-023 không nêu N | `fuelLevelHandover`/`fuelLevelReturn` kiểu | Dùng `number` tự do (không ràng buộc min/max cứng), `TODO(OQ)` |
| Số ảnh/góc bắt buộc mỗi mục (VH §29 Q5-8, VR §32 Q4-6) | Không build validate "đủ ảnh" | `mediaMeta` là mảng tự do, không đếm tối thiểu |
| Mức xác nhận khách M0-M4 (VH §29 Q12-14, VR §32 Q23) | Không build luồng ký/OTP | Field `customerAcknowledged: boolean` + `note` tối giản |
| VETC/phạt nguội nhập ở Return hay Settlement (VR §32 Q21-22) | Không build nhập tay | Loại `VETC`/`TRAFFIC_FINE` có trong enum `ADDITIONAL_CHARGE_TYPES` (đủ cấu trúc dữ liệu) nhưng không có form nhập ở Round 1 |
| Ảnh hưởng an toàn → `MAINTENANCE` (VR §32 Q17, ngưỡng nào) | Không tự động đổi Vehicle status | Field `affectsSafety: boolean` trên Incident Item (nhân viên tự đánh dấu khi seed), không có hành động tự động (§0.4) |
| Ai chỉnh sửa được gì sau hoàn tất (VH §29 Q25, VR §32 Q28) | Phạm vi field cho phép sửa | Round 1 cho sửa toàn bộ field non-derived (trừ `rentalId`/`status`/`id`), gate `MANAGER`/`SYSTEM_ADMIN`, bắt buộc lý do — bảo thủ hơn thì chặn hết, nhưng UC-VH-13/VR-18 xác nhận có luồng sửa nên vẫn build, chỉ không giới hạn field cụ thể theo Open Q |
| `RETURNED → SETTLEMENT` tự động hay chờ Accountant mở (VR UseCase §31 Q26) | N/A Round 1 | Không có Settlement — không liên quan |

---

## 1. Phạm vi Round 1

### 1.1. Trong phạm vi

1. Data core `features/handover-return`: `model.ts`/`api.ts`/`hooks.ts`/`seed.ts`/`index.ts`, 2
   entity `HandoverRecord` + `ReturnRecord` (§2), Incident Item **nhúng** trong `ReturnRecord` (không
   phải entity `Incident` độc lập — đó là phạm vi `features/incidents` (DI) round sau).
2. **Màn Theo dõi giao/nhận** (`HandoverReturnListScreen`, `/handover-return`): danh sách theo Rental
   — cột Rental/Khách/Xe, trạng thái Handover, trạng thái Return, ngày thực hiện. Lọc theo trạng
   thái/khoảng ngày.
3. **Tab "Giao-nhận" ở `RentalDetailScreen`** (thay `RentalDetailPlaceholder` hiện tại): hiển thị
   Biên bản Handover (baseline đầy đủ) + Biên bản Return (đối chiếu before/after + khoản phát sinh
   ước tính) của đúng Rental đang xem.
4. **Tab "Giao/nhận" ở `VehicleDetailScreen`** (thay placeholder hiện tại): lịch sử Handover/Return
   của xe theo tất cả Rental (đọc-only, mirror `VehicleRentalHistoryTab`).
5. **Tab "Hiện trạng xe" ở `VehicleDetailScreen`** (thay placeholder hiện tại) — Vehicle Condition
   Timeline **bản đầy đủ** (CR-2026-045): tổng hợp mốc `HANDOVER_BASELINE`/`RETURN` từ dữ liệu
   round này + mốc `INCIDENT` (rút gọn, ghi chú chờ `features/incidents`), hiển thị đầy đủ số liệu
   (khác bản rút gọn App nhân viên theo CR-2026-052 — Webapp không ẩn gì).
6. **Chỉnh sửa có kiểm soát** Handover/Return `COMPLETED` (`HandoverEditDialog`/`ReturnEditDialog`,
   gate `MANAGER`/`SYSTEM_ADMIN` qua permission có sẵn — xem §9.3, bắt buộc lý do, audit before/after.
7. **Huỷ có kiểm soát** Handover/Return `COMPLETED` (`HandoverCancelDialog`/`ReturnCancelDialog`) —
   bắt buộc lý do, xác nhận 2 bước (mirror `RentalCancelDialog` nhưng thêm bước confirm phụ vì tác
   động rộng hơn — đảo cả trạng thái Rental), hoàn tác Rental qua ngoại lệ §0.3, hiển thị cảnh báo
   Vehicle theo §0.4.
8. Route `/handover-return` thay `ComingSoon`.

### 1.2. Ngoài phạm vi Round 1 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| Wizard tạo/thực hiện Handover/Return (UC-VH-01→09, UC-VR-01→14) | Thuộc App nhân viên, ngoài phạm vi repo này (§0.2) |
| Chụp ảnh/video thật, đếm đủ số ảnh bắt buộc | Media = metadata placeholder (§0.2), số ảnh tối thiểu là Open Question (§0.5) |
| Nhập tay VETC/phạt nguội (UC-VR-09/10/11) | Open Question "nhập ở Return hay Settlement" chưa chốt (§0.5); cấu trúc dữ liệu (`ADDITIONAL_CHARGE_TYPES` có `VETC`/`TRAFFIC_FINE`) đã sẵn sàng cho round sau |
| Màn cấu hình (UC-VH-16/UC-VR-21: bộ ảnh chuẩn, checklist mẫu, ngưỡng duyệt, tham số phí) | Phần lớn là Open Question (số ảnh/góc — §0.5); checklist/condition type dùng danh mục tĩnh trong `model.ts`, không qua màn cấu hình |
| Hoàn tác Vehicle.status/currentKm khi Huỷ | Ngoại lệ kiến trúc thứ 2 vượt phạm vi đã duyệt — xem §0.4 |
| Chuyển Vehicle sang `MAINTENANCE` tự động khi Incident `affectsSafety` (VR-BR-20) | Cùng lý do §0.4 — chỉ lưu field, không có hành động ghi |
| `features/incidents` (DI) đầy đủ vòng đời (`OPEN→...→CLOSED`, Liability, Actual Cost, claim) | Người dùng chỉ yêu cầu Handover/Return round này; Incident Item ở Return chỉ là dữ liệu nhúng tối giản trạng thái `OPEN` cố định |
| Transition thuận qua UI (`CONFIRMED/CONTRACT_CREATED/READY_FOR_HANDOVER → HANDED_OVER → IN_RENTAL → RETURNED → SETTLEMENT`) | Không có kịch bản thật (không có wizard tạo — §0.2); các state này tiếp tục đạt qua seed, giống Rental Round 1 đã làm với `CONTRACT_CREATED` |
| Chỉnh sửa Contract `SIGNED→ACTIVE` khi Handover hoàn tất | Thuộc `ContractManagement`, tài liệu VH/VR không tự định nghĩa lại (Context) — không đụng `contracts/model.ts` |
| Phí thiếu nhiên liệu tự tính (VR-BR-28 nói rõ: nhân viên nhập tay, hệ thống không tự tính) | Chỉ có field nhập, không có công thức — đúng tài liệu, không phải thiếu sót |

---

## 2. Data model

### 2.1. `HandoverRecord` (1 storage key `handoverRecords`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `rentalId` | `string` | có | VH-BR-01/03 — tối đa 1 Handover hợp lệ (`COMPLETED`)/Rental |
| `status` | `HandoverReturnStatus` | có | `NOT_STARTED\|IN_PROGRESS\|COMPLETED\|CANCELLED\|DISCARDED` (UseCase §4) — Phase 1, không có `PENDING_SYNC` (VH-BR-16 = Phase 2) |
| `deliveryStaffEmployeeId` | `string?` | — | VH-BR-14 — nhân viên thực hiện (chặn cứng ở App nhân viên; Webapp Round 1 chỉ hiển thị) |
| `actualPickupDateTime` | `string?` | bắt buộc khi `COMPLETED` | VH-BR-06/19 — đầu vào tính `Expected Return DateTime` (owned bởi Rental, không tính lại ở round này — §1.2) |
| `odometerHandover` | `number?` | bắt buộc khi `COMPLETED` | VH-BR-06/07 |
| `fuelLevelHandover` | `number?` | bắt buộc khi `COMPLETED` | VH-BR-06/22 — số vạch, `TODO(OQ: §0.5 thang đo)` |
| `preExistingConditionItems` | `HandoverConditionItem[]` | — (mặc định `[]`) | §12 BRD — baseline hư hỏng có sẵn |
| `checklist` | `HandoverChecklistItem[]` | — (mặc định `[]`) | §13 BRD |
| `mediaMeta` | `MediaMeta[]` | — (mặc định `[]`) | §14.1 — placeholder, không có file thật (§0.2) |
| `note` | `string?` | — | |
| `customerAcknowledged` | `boolean` | — (mặc định `false`) | §16, tối giản — `TODO(OQ: §0.5 mức M0-M4)` |
| `customerAcknowledgedNote` | `string?` | — | |
| `motorbikeCollateral` | `MotorbikeCollateral?` | bắt buộc khi `COMPLETED` và `rental.securityDepositType==='MOTORBIKE'` | VH-BR-18 |
| `prepaymentConfirmed` | `boolean` | — (mặc định `false`) | VH-BR-17 điều kiện bắt đầu — flag thủ công, `Payment` (PM) chưa build nên không tự kiểm tra được (Context) |
| `fullPaymentConfirmed` | `boolean` | — (mặc định `false`) | VH-BR-17 điều kiện hoàn tất (70%+Deposit) — flag thủ công, cùng lý do |
| `cancelReason` | `string?` | — | Bắt buộc khi `CANCELLED` |
| `cancelledAt` / `cancelledByUserId` / `cancelledByName` / `cancelledByRole` | `string?` | — | |
| `createdAt` / `updatedAt` | `string` | có | |

`HandoverConditionItem`: `{ id, type: ConditionItemType, position?: string, description: string,
severity?: 'MINOR'|'MODERATE'|'SEVERE', mediaMeta: MediaMeta[] }` (§12 — ảnh bắt buộc theo tài liệu,
Round 1 không validate cứng vì `TODO(OQ)` số ảnh; `severity` optional — BRD nói "tuỳ cấu hình").

`HandoverChecklistItem`: `{ id, itemName: string, status: 'DELIVERED'|'NOT_DELIVERED'|
'NOT_APPLICABLE', note?: string }` — `itemName` là chuỗi tự do lấy từ danh mục tĩnh gợi ý trong
`model.ts` (§2.3), không phải enum cứng (chưa có màn cấu hình — §1.2).

`MotorbikeCollateral`: `{ mediaMeta: MediaMeta[], odometer: number, fuelLevel: number,
cavetMediaMeta: MediaMeta[] }` (VH §12.1).

`MediaMeta`: `{ id, category: string, capturedAt: string, employeeId?: string, note?: string }` —
placeholder, không có `fileUrl` (§0.2).

### 2.2. `ReturnRecord` (1 storage key `returnRecords`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `rentalId` | `string` | có | VR-BR-01/06 |
| `handoverRecordId` | `string` | có | VR-BR-02 — phải trỏ tới 1 `HandoverRecord` `COMPLETED` |
| `status` | `HandoverReturnStatus` | có | Cùng enum §2.1 |
| `receivingStaffEmployeeId` | `string?` | — | VR-BR-19 |
| `actualReturnDateTime` | `string?` | bắt buộc khi `COMPLETED` | VR-BR-05 — không tương lai, không trước `actualPickupDateTime` của Handover |
| `odometerReturn` | `number?` | bắt buộc khi `COMPLETED` | VR-BR-03 — **chặn cứng** nếu `< odometerHandover` |
| `fuelLevelReturn` | `number?` | bắt buộc khi `COMPLETED` | VR-BR-04 |
| `incidentItems` | `ReturnIncidentItem[]` | — (mặc định `[]`) | §13 BRD — nhúng, không phải entity `Incident` riêng (§1.2) |
| `checklistComparison` | `ReturnChecklistItem[]` | — (mặc định `[]`) | Đối chiếu với `HandoverRecord.checklist` các mục `DELIVERED` |
| `additionalCharges` | `AdditionalChargeItem[]` | — (mặc định `[]`) | §15 BRD — trạng thái luôn ước tính (VR-BR-12) |
| `note` | `string?` | — | |
| `customerAcknowledged` | `boolean` | — (mặc định `false`) | Tối giản, `TODO(OQ: §0.5)` |
| `customerAcknowledgedNote` | `string?` | — | |
| `cancelReason` / `cancelledAt` / `cancelledByUserId` / `cancelledByName` / `cancelledByRole` | `string?` | — | |
| `createdAt` / `updatedAt` | `string` | có | |

`ReturnIncidentItem`: `{ id, type: IncidentItemType, position?: string, description: string,
baselineComparison: 'NEW'|'WORSENED', estimatedCost: number, affectsSafety: boolean,
chargeApprovalStatus: 'ESTIMATED'|'PENDING_MANAGER_APPROVAL'|'PENDING_GARAGE_BILL', mediaMeta:
MediaMeta[], status: 'OPEN' }` — `status` **cố định `'OPEN'`**, không có lifecycle tiếp (§1.2, thuộc
DI). `chargeApprovalStatus` phản ánh VR-BR-23 (hư hỏng nhẹ cần Manager duyệt)/VR-BR-24 (sự cố nặng
chờ bill garage) — chỉ lưu trạng thái, không có hành động Duyệt/Nhập bill ở Round 1 (đó là DI).

`ReturnChecklistItem`: `{ id, handoverChecklistItemId, itemName: string, status: 'OK'|'MISSING'|
'DAMAGED'|'NOT_APPLICABLE', note?: string }`.

`AdditionalChargeItem`: `{ id, type: AdditionalChargeType, amount: number, note?: string }` —
`type` dùng enum `ADDITIONAL_CHARGE_TYPES` (§2.3).

### 2.3. Hằng số/danh mục tĩnh trong `handover-return/model.ts` (không đưa lên `shared/domain/
enums.ts` — đây là danh mục nghiệp vụ chưa có màn cấu hình, §1.2)

```ts
// VH §13 — danh mục checklist gợi ý (nhân viên có thể gõ tự do ngoài danh mục này).
export const SUGGESTED_CHECKLIST_ITEMS = [
  'Chìa khoá chính', 'Chìa khoá phụ', 'Giấy đăng ký xe (bản photo)', 'Bảo hiểm (bản photo)',
  'Sạc/phụ kiện theo xe', 'Lốp dự phòng', 'Bộ dụng cụ sửa xe', 'Tam giác cảnh báo',
]
```

---

## 3. Hàm thuần (`handover-return/model.ts`)

### 3.1. Guard trạng thái bản ghi

```ts
// UC-VH/VR §4 — cả 2 entity dùng chung 1 tập trạng thái.
canCompleteHandover(record: HandoverRecord): boolean // status === 'IN_PROGRESS' | 'NOT_STARTED'
canCancelHandoverRecord(record: HandoverRecord): boolean // status === 'COMPLETED'
canEditHandoverRecord(record: HandoverRecord): boolean // status === 'COMPLETED'

canCancelReturnRecord(record: ReturnRecord): boolean // status === 'COMPLETED'
canEditReturnRecord(record: ReturnRecord): boolean // status === 'COMPLETED'
```

### 3.2. Tính khoản phát sinh ước tính (VR-BR-21/22/24/25) — công thức đã có đủ trong BRD

```ts
/** VR-BR-21/CR-2026-057 — vượt km làm tròn LÊN bội số 10km trước khi nhân đơn giá. */
export function calcExtraKmFee(
  odometerHandover: number,
  odometerReturn: number,
  allowedKm: number,
  pricePerKm: number,
): number {
  const actualKm = Math.max(0, odometerReturn - odometerHandover)
  const extraKm = Math.max(0, actualKm - allowedKm)
  const roundedExtraKm = Math.ceil(extraKm / 10) * 10
  return roundedExtraKm * pricePerKm
}

/**
 * VR-BR-22/CR-2026-005/007/054 — ân hạn 15 phút; bậc thang 10/30/50% đơn giá
 * 1 ngày cho trễ tới 1h/2h/3h (không cộng dồn); > 3h → giữ ở 50%, khách giữ xe
 * qua đêm (cửa đóng 23:00): trả trước 08:00 → phụ thu ½ ngày; sau 08:00 → 1
 * ngày (loại trừ với phí trễ giờ theo giờ — chỉ tính 1 trong 2).
 */
export function calcOvertimeFee(
  expectedReturnDateTime: string,
  actualReturnDateTime: string,
  dailyRate: number,
  graceMinutes = 15,
): number {
  const lateMs = new Date(actualReturnDateTime).getTime() - new Date(expectedReturnDateTime).getTime()
  const lateMinutes = lateMs / 60000
  if (lateMinutes <= graceMinutes) return 0
  const actualReturn = new Date(actualReturnDateTime)
  const closedAfter23h = actualReturn.getHours() >= 23
  if (!closedAfter23h && lateMinutes <= 180) {
    if (lateMinutes <= 60) return dailyRate * 0.1
    if (lateMinutes <= 120) return dailyRate * 0.3
    return dailyRate * 0.5
  }
  // > 3h hoặc sau giờ đóng cửa 23:00 — khách giữ xe qua đêm.
  return actualReturn.getHours() < 8 ? dailyRate * 0.5 : dailyRate * 1
}

/** VR-BR-25/CR-2026-062 — copy nguyên `rental.deliveryFee` đã snapshot lúc tạo Rental, không tính lại. */
export function buildDeliveryFeeCharge(deliveryFee: number): AdditionalChargeItem | undefined {
  return deliveryFee > 0 ? { id: generateId('chg'), type: 'DELIVERY_FEE', amount: deliveryFee } : undefined
}

/**
 * Gộp Extra KM + Overtime + Delivery Fee thành baseline Additional Charge Items
 * khi Return hoàn tất. Damage/Fuel Deficit/Missing Accessory là nhập tay
 * (VR-BR-28 nói rõ Fuel Deficit KHÔNG tự tính) — không có trong hàm này.
 */
export function buildBaselineAdditionalCharges(input: {
  odometerHandover: number
  odometerReturn: number
  allowedKm: number
  pricePerKm: number
  expectedReturnDateTime: string
  actualReturnDateTime: string
  rentalRate: number
  rentalDurationDays: number
  deliveryFee: number
}): AdditionalChargeItem[]
```

### 3.3. Đối chiếu checklist (VR §14)

```ts
/** Sinh `ReturnChecklistItem[]` từ các mục `DELIVERED` của Handover Checklist. */
export function buildChecklistComparisonDraft(handoverChecklist: HandoverChecklistItem[]): ReturnChecklistItem[]

/** VR-BR §14 — mục MISSING/DAMAGED tự gợi ý thêm 1 `AdditionalChargeItem` loại MISSING_ACCESSORY (amount=0, nhân viên tự điền). */
export function suggestMissingAccessoryCharges(checklist: ReturnChecklistItem[]): AdditionalChargeItem[]
```

### 3.4. Mở rộng `rentals/model.ts` (ngoại lệ được phép — §0.3)

```ts
// Thêm 2 dòng vào ROUND1_TRANSITIONS (giữ nguyên các dòng khác đã có từ Contract Round 1):
const ROUND1_TRANSITIONS: Partial<Record<RentalStatus, RentalStatus[]>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'CONTRACT_CREATED'],
  HANDED_OVER: ['READY_FOR_HANDOVER'], // revert khi Huỷ Handover
  IN_RENTAL: ['READY_FOR_HANDOVER'], // revert khi Huỷ Handover (nếu đã tự tiến từ HANDED_OVER)
  RETURNED: ['IN_RENTAL'], // revert khi Huỷ Return
  SETTLEMENT: ['IN_RENTAL'], // revert khi Huỷ Return (nếu đã tự tiến từ RETURNED)
}

export function canCancelHandover(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('READY_FOR_HANDOVER') ?? false
}
export function canCancelReturn(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('IN_RENTAL') ?? false
}

// Hàm thuần chuẩn bị sẵn cho round sau (App nhân viên/quick-record) — CHƯA có UI gọi ở Round 1.
export function canMarkHandedOver(rental: Rental): boolean {
  return ['CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER'].includes(rental.status) // VH-BR-02
}
export function canMarkReturned(rental: Rental): boolean {
  return rental.status === 'IN_RENTAL' // VR-BR-02
}
```

**Không đổi** field `Rental`, không đổi `canConfirm`/`canCancel`/`canMarkContractCreated`/công thức
giá đã có. `canMarkHandedOver`/`canMarkReturned` chỉ là hàm thuần tài liệu hoá, không có action/nút
gọi tới ở Round 1 (đúng quyết định §1.2 — không build transition thuận qua UI).

---

## 4. Business rule cần trích dẫn (nguồn: BRD — xem §0.1 về mâu thuẫn UseCase)

### 4.1. `VH-BR-01 → VH-BR-23`

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| VH-BR-01 | Handover thuộc 1 Rental | Enforce |
| VH-BR-02 | Chỉ thực hiện khi Rental `CONFIRMED`/`READY_FOR_HANDOVER` | N/A thực thi (không có wizard — §1.2); dùng ở `canMarkHandedOver()` chuẩn bị sẵn |
| VH-BR-03 | Tối đa 1 Handover hợp lệ/Rental | Enforce (kiểm tra khi seed) |
| VH-BR-04 | Return chỉ sau khi Handover `COMPLETED` | Enforce (`ReturnRecord.handoverRecordId` phải trỏ Handover `COMPLETED`) |
| VH-BR-05/06 | Không hoàn tất nếu thiếu ảnh/field bắt buộc | N/A Round 1 — không có luồng hoàn tất qua UI (§1.2), chỉ enforce field bắt buộc khi seed |
| VH-BR-07 | Odometer(handover) ≥ Current Odometer Vehicle | N/A thực thi qua UI — ghi chú khi seed |
| VH-BR-08 | Hư hỏng có sẵn phải có ảnh | Cấu trúc field có `mediaMeta`, không validate cứng (§0.5) |
| VH-BR-09 | Media đủ metadata | Enforce cấu trúc `MediaMeta` |
| VH-BR-10 | Hoàn tất → Rental `HANDED_OVER`, Vehicle `RENTED` | N/A qua UI (seed trực tiếp); phần Vehicle ngoài phạm vi (§0.4) |
| VH-BR-11 | `COMPLETED` không xoá vật lý | Enforce (không có `remove()`) |
| VH-BR-12 | Sửa sau hoàn tất phải lý do + audit | Enforce (`HandoverEditDialog`, §1.1 mục 6) |
| VH-BR-13 | Vehicle `MAINTENANCE`/`INACTIVE` không được giao | N/A — không có luồng thực hiện qua UI |
| VH-BR-14 | Người thực hiện đúng phân công — chặn cứng | N/A Webapp — thuộc App nhân viên |
| VH-BR-15 | Media kiểm soát truy cập theo role | N/A Round 1 — chưa có file thật để kiểm soát |
| VH-BR-16 | Offline/`PENDING_SYNC` | N/A — Phase 2 |
| VH-BR-17 | Điều kiện thanh toán 2 mốc | Enforce ở mức flag thủ công (`prepaymentConfirmed`/`fullPaymentConfirmed` — Context) |
| VH-BR-18 | `MOTORBIKE` → baseline xe máy bắt buộc | Enforce (field `motorbikeCollateral` bắt buộc khi `COMPLETED`+`MOTORBIKE`) |
| VH-BR-19 | `Actual Pickup` là đầu vào tính `Expected Return` | N/A — thuộc `Rental`, không tính lại ở round này (Context) |
| VH-BR-20 | Không giao xe đang Vehicle Block | N/A — không có luồng thực hiện qua UI |
| VH-BR-21 | Đổi xe giữa kỳ/xe hỏng trước giao → Handover mới | N/A — chưa có kịch bản `IN_RENTAL` đổi xe (Contract Round 1 §1.2) |
| VH-BR-22 | Fuel Level theo số vạch | Enforce field, thang đo `TODO(OQ)` |
| VH-BR-23 | Panel "Lịch sử hiện trạng xe" ở App | N/A Webapp — đây là bản App rút gọn, Webapp có bản đầy đủ riêng (§1.1 mục 5) |

### 4.2. `VR-BR-01 → VR-BR-29`

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| VR-BR-01 | Return thuộc 1 Rental | Enforce |
| VR-BR-02 | Chỉ sau khi Handover `COMPLETED`, Rental `IN_RENTAL` | N/A thực thi (`canMarkReturned()` chuẩn bị sẵn) |
| VR-BR-03 | Odometer(return) ≥ Odometer(handover) — CHẶN | Enforce khi Edit (`HandoverEditDialog`/`ReturnEditDialog` re-validate); ghi chú khi seed |
| VR-BR-04 | Fuel Level cùng thang Handover | Enforce field |
| VR-BR-05 | `Actual Return` không tương lai, không trước `Actual Pickup` | Enforce khi Edit |
| VR-BR-06 | Tối đa 1 Return hợp lệ/Rental | Enforce khi seed |
| VR-BR-07 | Không hoàn tất nếu thiếu ảnh | N/A — không có luồng hoàn tất qua UI |
| VR-BR-08 | Chỉ hư hỏng KHÔNG có baseline mới tính phát sinh | Enforce cấu trúc (`baselineComparison: 'NEW'|'WORSENED'`) |
| VR-BR-09 | Incident Item phải có ảnh + chi phí dự kiến | Enforce field (`estimatedCost` bắt buộc), ảnh không validate cứng |
| VR-BR-10 | Metadata đầy đủ | Enforce cấu trúc |
| VR-BR-11 | Hoàn tất → Rental `RETURNED`→`SETTLEMENT` | N/A qua UI (seed trực tiếp) |
| VR-BR-12 | Additional Charge = ước tính, Settlement chốt thật | Enforce (không có khái niệm "đã chốt" ở Round 1) |
| VR-BR-13/14 | VETC/phạt nguội liên kết Rental, Post-Settlement Charge | N/A — không build nhập tay (§1.2) |
| VR-BR-15 | `COMPLETED` không xoá vật lý | Enforce |
| VR-BR-16 | Sửa sau hoàn tất phải lý do + audit + đồng bộ Settlement | Enforce phần lý do+audit; "đồng bộ Settlement" N/A (chưa có Settlement) |
| VR-BR-17 | Offline/`PENDING_SYNC` | N/A — Phase 2 |
| VR-BR-18 | Huỷ Return hoàn tác Rental/Vehicle/charges | Enforce phần Rental+charges; phần Vehicle N/A (§0.4) |
| VR-BR-19 | Người thực hiện đúng phân công | N/A Webapp |
| VR-BR-20 | Hư hỏng ảnh hưởng an toàn → `MAINTENANCE` | Chỉ lưu field `affectsSafety`, không tự động đổi Vehicle status (§0.4) |
| VR-BR-21 | Vượt km, làm tròn lên bội 10km | Enforce (`calcExtraKmFee`) |
| VR-BR-22 | Trễ giờ bậc thang + giữ xe qua đêm | Enforce (`calcOvertimeFee`) |
| VR-BR-23 | Hư hỏng nhẹ cần Manager duyệt trước khi chốt | Chỉ lưu trạng thái `chargeApprovalStatus`, không có hành động Duyệt (thuộc DI — §1.2) |
| VR-BR-24 | Sự cố nặng chờ bill garage | Chỉ lưu trạng thái, không có hành động Nhập bill (thuộc DI) |
| VR-BR-25 | Phí giao/nhận tận nơi, thu khi nhận xe | Enforce (`buildDeliveryFeeCharge`, copy từ `rental.deliveryFee`) |
| VR-BR-26 | `MOTORBIKE` đối chiếu baseline, phát sinh trả QR | N/A hành động (không build luồng thu tiền — Payment chưa có) |
| VR-BR-27 | Trả sớm giữ giá, không hoàn | Thoả tự nhiên (`baseAmount` không đổi — Rental snapshot) |
| VR-BR-28 | Phí thiếu nhiên liệu — nhân viên nhập tay, hệ thống KHÔNG tự tính | Enforce đúng nghĩa (field `AdditionalChargeItem` loại `FUEL_DEFICIT` chỉ nhập tay, không có hàm tính) |
| VR-BR-29 | Panel "Lịch sử hiện trạng xe" ở App | N/A Webapp — cùng lý do VH-BR-23 |

---

## 5. Màn hình (Round 1)

### 5.1. `HandoverReturnListScreen` (`/handover-return`) — "Theo dõi giao/nhận"

Bảng (mirror `RentalListScreen`) — cột: Rental (link `/rentals/:id`), Khách hàng, Xe, Trạng thái
Handover (badge), Trạng thái Return (badge), `actualPickupDateTime`/`actualReturnDateTime` nếu có.
Lọc: trạng thái Handover, trạng thái Return, khoảng ngày. Nguồn dữ liệu: join `useRentals()` +
`useHandoverRecords()` + `useReturnRecords()` theo `rentalId` (deep-import `@/features/rentals/hooks`,
đúng tiền lệ).

### 5.2. Tab "Giao-nhận" ở `RentalDetailScreen` — component mới `RentalHandoverReturnTab.tsx`
(`features/rentals/components/` — cùng lý do đặt `RentalContractTab` ở `rentals`, không phải
`handover-return`, vì đây là entry point từ phía Rental)

- Nếu chưa có `HandoverRecord` cho Rental này → `RentalDetailPlaceholder` biến thể: "Chưa có dữ liệu
  giao xe — thực hiện trên App nhân viên."
- Nếu có `HandoverRecord` → card "Biên bản giao xe": `actualPickupDateTime`, odo/fuel, danh sách
  Pre-existing Condition Items (ảnh placeholder icon + mô tả), Checklist, `mediaMeta` (danh sách chip
  category+thời điểm, không có ảnh thật), Motorbike Collateral nếu có, 2 flag thanh toán
  (`prepaymentConfirmed`/`fullPaymentConfirmed`), nút "Sửa" (gate `MANAGER`/`SYSTEM_ADMIN`) + "Huỷ"
  (cùng gate, chỉ khi `COMPLETED`).
- Nếu có `ReturnRecord` → card "Biên bản trả xe" ngay dưới: before/after (2 cột: Handover vs Return —
  odo/fuel/thời gian), Incident Items (loại/vị trí/mô tả/đối chiếu baseline/chi phí dự kiến/trạng thái
  duyệt), Checklist đối chiếu, Bảng Additional Charge Items (tổng cộng nổi bật), nút Sửa/Huỷ tương tự.
- Nếu có Handover nhưng chưa có Return → chỉ hiện card Handover + ghi chú "Chưa có dữ liệu trả xe."

### 5.3. Tab "Giao/nhận" ở `VehicleDetailScreen` — component mới `VehicleHandoverReturnTab.tsx`
(`features/vehicles/components/`, mirror `VehicleRentalHistoryTab`)

Danh sách tất cả `HandoverRecord`/`ReturnRecord` của xe (join qua `rentalId` → `useRentals({
vehicleId })`), đọc-only, mỗi dòng link tới `/rentals/:rentalId` (tab Giao-nhận).

### 5.4. Tab "Hiện trạng xe" ở `VehicleDetailScreen` — component mới `VehicleConditionTimelineTab.tsx`

Danh sách mốc `ConditionEvent` (kiểu dựng runtime, không lưu storage riêng — tổng hợp từ
`HandoverRecord`(`HANDOVER_BASELINE`) + `ReturnRecord`(`RETURN`) + `ReturnRecord.incidentItems`
(`INCIDENT`) của xe, sort theo ngày giảm dần), dùng `CONDITION_EVENT_TYPES` đã scaffold. Mỗi mốc:
ngày, loại, link bản ghi nguồn, tóm tắt (odo/fuel/số hư hỏng), **hiển thị đầy đủ** (không ẩn field
nào — CR-2026-045, khác bản App rút gọn). Mốc `INCIDENT` ghi chú "Chi tiết đầy đủ (Liability/chi phí
thực tế/claim) chờ `features/incidents`". Bộ lọc theo khoảng ngày + loại mốc. Nếu chưa có mốc nào →
giữ nguyên `VehicleDetailPlaceholder` hiện tại (`vi.vehicles.conditionEmpty`).

### 5.5. Dialog

- `HandoverEditDialog`/`ReturnEditDialog` — form sửa field non-derived (odo/fuel/note/checklist/
  condition items/charges), bắt buộc `reason`, re-validate VR-BR-03/05 nếu sửa odo/thời gian.
- `HandoverCancelDialog`/`ReturnCancelDialog` — mirror `RentalCancelDialog` + bước xác nhận phụ
  ("Bạn có chắc? Thao tác này sẽ đổi trạng thái Rental."), bắt buộc `reason`, hiển thị cảnh báo Vehicle
  theo §0.4.

---

## 6. Responsive

Bám khung đã dùng — List bảng/card, Detail tab/card cuộn dọc (nội dung Biên bản khá dài — dùng
`Separator` + heading nhóm rõ ràng, mirror cách `RentalFormSheet` chia khối).

---

## 7. Seed data (`features/handover-return/seed.ts`)

- Chỉ tạo `HandoverRecord`/`ReturnRecord` cho các Rental đã seed sẵn ở trạng thái phù hợp
  (`rentals/seed.ts` §7 Rental Round 1: 2 `HANDED_OVER`, 2 `IN_RENTAL`, 2 `RETURNED`, 2 `SETTLEMENT`,
  3 `COMPLETED`):
  - 2 `HandoverRecord` `COMPLETED` cho 2 Rental `HANDED_OVER` (chưa có Return).
  - 2 `HandoverRecord` `COMPLETED` cho 2 Rental `IN_RENTAL` (chưa có Return).
  - 2 `HandoverRecord` + 2 `ReturnRecord` `COMPLETED` cho 2 Rental `RETURNED`.
  - 2 `HandoverRecord` + 2 `ReturnRecord` `COMPLETED` cho 2 Rental `SETTLEMENT` (kèm vài Additional
    Charge Items + 1 Incident Item mẫu).
  - 3 `HandoverRecord` + 3 `ReturnRecord` `COMPLETED` cho 3 Rental `COMPLETED`.
  - 1 `HandoverRecord` `CANCELLED` (kèm `cancelReason`) gắn 1 Rental `CANCELLED` có sẵn — minh hoạ
    badge Huỷ ở List.
- Mọi bản ghi field snapshot hợp lệ (odo tăng dần đúng logic, fuel hợp lý, `additionalCharges` dùng
  đúng `calcExtraKmFee`/`calcOvertimeFee` khi seed, không để số giả tuỳ tiện).
- Ngày tính động (`isoDateOffset`, mẫu `maintenance/seed.ts`).

---

## 8. Lộ trình còn lại (roadmap — không chi tiết hoá field-level)

Wizard thực hiện thật (App nhân viên, repo khác) · nhập tay VETC/phạt nguội · màn cấu hình bộ ảnh/
checklist/ngưỡng · `features/incidents` (DI) đầy đủ vòng đời + hoàn tác Vehicle.status/currentKm khi
Huỷ (ngoại lệ kiến trúc §0.4, cần thiết kế riêng) · transition thuận qua UI khi có App nhân viên tích
hợp thật hoặc quyết định xây "quick record" thay thế cho demo.

---

## 9. API / hooks / audit

### 9.1. `handover-return/api.ts` (2 namespace trong cùng file, storage riêng)

- `listHandovers(filter?: {rentalId?, status?})`, `getHandoverById(id)`
- `listReturns(filter?: {rentalId?, status?})`, `getReturnById(id)`
- `updateHandover(id, patch, reason, actor)` — re-validate field liên quan (VR-BR-03 nếu Return đã
  tồn tại và sửa `odometerHandover`), audit before/after
- `cancelHandover(id, reason, actor)` — guard `canCancelHandoverRecord()`, đổi status `CANCELLED`,
  gọi `revertHandoverCancelled(rentalId, actor)` từ `@/features/rentals` (barrel, §9.2)
- `updateReturn(id, patch, reason, actor)`
- `cancelReturn(id, reason, actor)` — guard `canCancelReturnRecord()`, gọi
  `revertReturnCancelled(rentalId, actor)`

Audit action mới nối cuối `AUDIT_ACTIONS`: `EDIT_HANDOVER`, `CANCEL_HANDOVER`, `EDIT_RETURN`,
`CANCEL_RETURN` (entity `'HandoverRecord'`/`'ReturnRecord'`).

### 9.2. Mở rộng `rentals/api.ts`/`hooks.ts`/`index.ts` (§0.3/§3.4)

`rentals/api.ts` — 2 hàm mới, mirror `markContractCreated()`:
```ts
export async function revertHandoverCancelled(id: string, actor: ActorInfo): Promise<Rental> {
  // canCancelHandover() guard, đổi status 'READY_FOR_HANDOVER', xoá actualPickupDateTime, appendAudit
  // action: 'REVERT_HANDOVER_CANCELLED', entity: 'Rental'
}
export async function revertReturnCancelled(id: string, actor: ActorInfo): Promise<Rental> {
  // canCancelReturn() guard, đổi status 'IN_RENTAL', xoá actualReturnDateTime, appendAudit
  // action: 'REVERT_RETURN_CANCELLED', entity: 'Rental'
}
```
`rentals/hooks.ts` — `useRevertHandoverCancelled()`/`useRevertReturnCancelled()` — **không** export
qua hook vì `handover-return/api.ts` gọi trực tiếp hàm async (mirror cách `contracts/api.ts`'s
`create()` gọi thẳng `markContractCreated()` — xem `docs/CONTRACT-MANAGEMENT-PLAN.md` ghi chú review).
`rentals/index.ts` — thêm:
```ts
export { canCancelHandover, canCancelReturn, canMarkHandedOver, canMarkReturned } from './model'
export { revertHandoverCancelled, revertReturnCancelled } from './api'
```
Audit action mới nối cuối `AUDIT_ACTIONS`: `REVERT_HANDOVER_CANCELLED`, `REVERT_RETURN_CANCELLED`
(entity `'Rental'`).

### 9.3. `handover-return/hooks.ts`

`useHandoverRecords(filter?)`, `useHandoverRecord(id?)`, `useReturnRecords(filter?)`,
`useReturnRecord(id?)`, `useUpdateHandover`, `useCancelHandover`, `useUpdateReturn`,
`useCancelReturn`. Gate UI dùng permission có sẵn: Sửa/Huỷ hiển thị khi
`can('HANDOVER_RETURN','EXECUTE')` **và** role thuộc `MANAGER`/`SYSTEM_ADMIN` — lưu ý
`HANDOVER_RETURN.EXECUTE` hiện có giá trị `true` cho cả `OPERATION_STAFF` (đúng ý nghĩa "thực hiện
giao/nhận" ở App nhân viên); Round 1 Webapp **thêm điều kiện role** trong code UI (không sửa
`permissions.ts`) để giới hạn Sửa/Huỷ chỉ `MANAGER`/`SYSTEM_ADMIN` theo đúng UC-VH-13/14/UC-VR-18/19
— ghi rõ comment tại chỗ dùng, không coi đây là thay đổi ma trận quyền chung.

### 9.4. `handover-return/index.ts`

`export type { HandoverRecord, ReturnRecord } from './model'` + `export { HandoverReturnListScreen }
from './screens/HandoverReturnListScreen'`. Không export hooks/api (feature khác deep-import
`@/features/handover-return/hooks`, đúng tiền lệ).

---

## 10. i18n

Thêm `vi.handoverReturn.*` (mẫu `vi.contracts.*`) + `HANDOVER_RETURN_STATUS_LABELS` (5 nhãn) +
`CONDITION_ITEM_TYPE_LABELS`/`INCIDENT_ITEM_TYPE_LABELS`/`ADDITIONAL_CHARGE_TYPE_LABELS`. Xoá
`vi.vehicles.handoverReturnPlaceholder`/`vi.rentals.handoverReturnPlaceholder`/
`vi.vehicles.conditionEmpty` khỏi danh sách dùng (grep xác nhận trước khi xoá — có thể vẫn cần cho
trường hợp "chưa có dữ liệu" rỗng hợp lệ, xem §5.2/§5.4, không phải luôn xoá hẳn).

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: thêm enum mới —
  ```ts
  export const HANDOVER_RETURN_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISCARDED'] as const
  export const CONDITION_ITEM_TYPES = ['SCRATCH', 'DENT', 'CRACK', 'MISSING_ACCESSORY', 'INTERIOR_DAMAGE', 'STAIN', 'OTHER'] as const
  export const INCIDENT_ITEM_TYPES = ['SCRATCH', 'DENT', 'CRACK', 'FUNCTIONAL_DAMAGE', 'MISSING_ACCESSORY', 'INTERIOR_DAMAGE', 'STAIN', 'ACCIDENT', 'OTHER'] as const
  export const ADDITIONAL_CHARGE_TYPES = ['EXTRA_KM', 'FUEL_DEFICIT', 'OVERTIME', 'DAMAGE', 'VETC', 'TRAFFIC_FINE', 'MISSING_ACCESSORY', 'DELIVERY_FEE', 'OTHER', 'DISCOUNT'] as const
  ```
  và nối 6 audit action mới vào `AUDIT_ACTIONS` (§9.1/§9.2).
- `shared/i18n/vi.ts`: thêm `vi.handoverReturn.*` + label map (§10).
- `permissions.ts`: **không sửa** — `HANDOVER_RETURN.VIEW/EXECUTE` đã đúng (giới hạn role Sửa/Huỷ xử
  lý ở tầng UI, §9.3).
- `rentals/model.ts`/`api.ts`/`hooks.ts`/`index.ts`: mở rộng có kiểm soát (§0.3/§3.4/§9.2).
- `vehicles/screens/VehicleDetailScreen.tsx`: 2 tab `handoverReturn`/`condition` thay placeholder.
- `rentals/screens/RentalDetailScreen.tsx`: tab `handoverReturn` thay placeholder.
- `shared/fixtures/registerSeeds.ts`: import `handover-return/seed` sau `contracts`.
- `app/routes.tsx`: bỏ `ComingSoon` cho `/handover-return`.
- `docs/IMPLEMENTATION-PLAN.md`: tick dòng `features/handover-return` (Phase 3) khi xong — **không**
  tick dòng `features/incidents`/"Nối Vehicle Condition Timeline" hoàn toàn (chỉ phần
  `HANDOVER_BASELINE`/`RETURN` xong, `INCIDENT` vẫn rút gọn chờ DI).

---

## 12. Mã requirement cần trích trong code

`VH-BR-01, 03, 04, 09, 11, 12, 17, 18, 22` · `VR-BR-01, 02, 03, 04, 05, 06, 08, 09, 10, 11, 12, 15,
16, 18, 21, 22, 23, 24, 25, 27, 28` · `CR-2026-003, 005, 006, 023, 045, 052, 054, 057, 058, 060, 062`
· Open Questions: `§0.5` (thang đo fuel, số ảnh, mức xác nhận khách, VETC/phạt nguội, ngưỡng an toàn,
phạm vi sửa).

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Xác nhận `rentals/model.ts`/`api.ts`/`hooks.ts` chỉ có đúng phần mở rộng đã mô tả ở §3.4/§9.2 —
   không đổi field `Rental`, không đổi `canConfirm`/`canCancel`/`canMarkContractCreated`/công thức giá.
4. Xác nhận `vehicles/model.ts`/`api.ts`/`hooks.ts` **không bị đụng tới** (§0.4).
5. Không có wizard tạo/thực hiện Handover/Return, không có upload ảnh thật, không có form nhập tay
   VETC/phạt nguội.
6. *(Chủ dự án tự test)*: `/handover-return` liệt kê đúng, lọc hoạt động; mở 1 Rental đã có Handover+
   Return → tab "Giao-nhận" hiển thị đủ 2 Biên bản, before/after đúng dữ liệu; Sửa Handover (vai trò
   `MANAGER`) → bắt buộc lý do, cập nhật đúng, ghi audit; Huỷ Return (vai trò `SYSTEM_ADMIN`) → Rental
   quay về `IN_RENTAL`, cảnh báo Vehicle hiển thị; đổi vai trò `SALES`/`OPERATION_STAFF` → không thấy
   nút Sửa/Huỷ; tab "Giao/nhận" và "Hiện trạng xe" ở Vehicle Detail hiển thị đúng lịch sử; mốc
   `INCIDENT` trên Condition Timeline hiện đúng ghi chú chờ DI.
7. `docs/IMPLEMENTATION-PLAN.md` tick dòng `features/handover-return`, xoá `ComingSoon`
   `/handover-return`.

---

## 14. Việc tiếp theo sau khi phê duyệt Round 1

Sau khi qua review `tech-lead` đạt, Phase 3 còn `features/incidents` (DI, vòng đời đầy đủ) và phần
"Nối Vehicle Condition Timeline" hoàn chỉnh (mốc `INCIDENT` đầy đủ). Việc tiếp theo tuỳ chủ dự án
chọn: `features/incidents`, hoặc quay lại Phase 2 còn dở (Employee Assignment + Dispatch board), hoặc
Phase 4 (Tài chính) để mở khoá điều kiện thanh toán thật ở VH-BR-17.
