# Kế hoạch triển khai — Hồ sơ sự cố (Damage Incident)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `PENDING_APPROVAL` (07/10/2026) — Round 1 (data core
+ vòng đời sự cố mainline + Hồ sơ sự cố + nối Rental Detail/Vehicle Condition Timeline) đã lên kế
hoạch chi tiết, **chưa giao `dev`**.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/DamageIncident-BRD.md` (v1.6, toàn bộ — đặc biệt
§6-§13, §20, §27) + `-UseCase.md` (v1.1, đối chiếu mâu thuẫn §0.1) + `../thien-bao-car-docs/
WebappQuanTri.md` §10.2/§10.4 + `../thien-bao-car-docs/CHANGE-REQUESTS.md` (CR-2026-010/011/015/
029/035/048/052/058).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/HANDOVER-RETURN-MANAGEMENT-
PLAN.md` (mẫu format mới nhất + ranh giới không đụng feature đã `DONE`). Đối chiếu mã hiện có:
`src/shared/domain/enums.ts` (`INCIDENT_STATUSES`/`LIABILITIES` đã scaffold nhưng **lệch BRD** — xem
§0.1), `src/shared/domain/permissions.ts` (`INCIDENT.VIEW/CREATE/ASSESS/APPROVE/EDIT/CLOSE/CONFIG`
đã có sẵn, dùng nguyên), `src/features/handover-return/model.ts` (`ReturnIncidentItem` — chỉ đọc).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. `enums.ts` hiện tại lệch BRD — sửa đúng theo BRD, không phải quyết định nghiệp vụ mới

`INCIDENT_STATUSES` hiện chỉ có 7 giá trị (`OPEN/ASSESSING/APPROVED/IN_REPAIR/REPAIRED/CLOSED/
CANCELLED`) — đây là bản tóm tắt cũ theo `WebappQuanTri.md` §10.2 khi `features/incidents` chưa
tồn tại. `DamageIncident-BRD.md` §8 (bản chuẩn, v1.6) định nghĩa đầy đủ **11 giá trị**: thêm
`WAITING_APPROVAL`, `DISPUTED`, `WRITTEN_OFF`, `CLOSED_NO_ACTION`. Tương tự `LIABILITIES` hiện chỉ 4
giá trị, BRD §12 có **6 giá trị** (thêm `SHARED`, `UNDETERMINED` — `UNDETERMINED` quan trọng vì
`DI-BR-05` dùng làm điều kiện chặn `APPROVED`). Theo đúng `CLAUDE.md` mục 2.4 ("giá trị enum phải
khớp từng ký tự với tài liệu"), **sửa đủ theo BRD** — không phải tự thêm tính năng, là sửa đúng dữ
liệu nguồn đã scaffold sai từ trước khi module này tồn tại.

### 0.2. Mâu thuẫn tài liệu — BRD là bản chuẩn, UseCase chưa đồng bộ CR mới

`DamageIncident-UseCase.md` (v1.1) dùng `DI-BR-18→20` cho nội dung khác hẳn so với BRD (v1.6, đã bump
qua CR-2026-010/011/048/052) và hoàn toàn thiếu `DI-BR-21/22`. Dùng **BRD §20 làm nguồn duy nhất**
cho bảng mã `DI-BR-xx` ở §4 — UseCase chỉ dùng để lấy luồng bước `UC-DI-xx` (tên/actor/ý nghĩa
nghiệp vụ), không dùng để đối chiếu nội dung rule.

### 0.3. Ranh giới với `features/handover-return` (đã `DONE`) — chỉ đọc, không sửa

`ReturnIncidentItem` nhúng trong `ReturnRecord.incidentItems` (status cố định `OPEN`, không
Liability/Actual Cost/claim) — comment code đã xác nhận đây là dữ liệu tạm chờ round này. Round 1
**chỉ đọc** (deep-import `@/features/handover-return/hooks`) để tiền điền form tạo `Incident` mới
từ 1 `ReturnIncidentItem` cụ thể — **không** sửa/xoá gì trong `ReturnRecord.incidentItems`, không
đồng bộ 2 chiều. `handover-return/model.ts`/`api.ts`/`hooks.ts` **không bị đụng**.

### 0.4. KHÔNG mở rộng `vehicles/model.ts`/`api.ts` — giới hạn có chủ đích (tiếp nối §0.4 Handover/
Return)

`DI-BR-07` yêu cầu Severity=`CRITICAL`/Safety Impact=true → Vehicle chuyển `MAINTENANCE`. Giống
chính xác tình huống đã gặp ở Handover/Return (VH-BR-10/VR-BR-11/VR-BR-20) — **không tự động ghi**
vào `vehicles/model.ts`/`api.ts`. Chỉ lưu field `safetyImpact`/`severity` trên `Incident`; Manager tự
chuyển trạng thái xe qua `VehicleStatusDialog` đã có sẵn ở Vehicle Detail. `DI-BR-21` (tai nạn → Sales
khoá lịch xe) cũng **không tự động gọi** `VehicleBlock` — cơ chế đó đã có sẵn (`features/calendar`,
thủ công), Incident không tự tạo Block.

### 0.5. Danh sách Open Question chạm tới — không tự chốt

| Open Q | Ảnh hưởng | Xử lý Round 1 |
| --- | --- | --- |
| Ngưỡng duyệt cụ thể (Ngưỡng 1/2, §27) | `OPEN/ASSESSING → APPROVED` hay `WAITING_APPROVAL` | Hằng số tạm `APPROVAL_THRESHOLD = 2.000.000đ` trong `model.ts`, `TODO(OQ)` |
| Công thức khi Liability ≠ khách 100% (CR-2026-010, §27 Q25-28) | Chi phí sự cố nặng | Chỉ tính đúng công thức BRD khi `Liability=CUSTOMER`; các Liability khác chỉ lưu field thủ công, không tự suy công thức, `TODO(OQ)` |
| Danh mục loại sự cố/sơ đồ xe chi tiết (§27) | `location` | Dùng `string` tự do (vị trí mô tả tay), không có sơ đồ xe tương tác |
| Ai quyết Liability/ngưỡng Admin (§27) | Gate quyền | Dùng đúng `permissions.ts` hiện có (`ASSESS`/`APPROVE`), không tự thêm vai trò mới |
| `WRITTEN_OFF`/`CLOSED_NO_ACTION`/`DISPUTED` — điều kiện chính xác | Nhánh phụ state machine | Chỉ seed, không build action UI Round 1 (xem §1.2) |

---

## 1. Phạm vi Round 1

### 1.1. Trong phạm vi

1. Data core `features/incidents`: `model.ts`/`api.ts`/`hooks.ts`/`seed.ts`/`index.ts`, entity
   `Incident` (§2).
2. **Tạo Incident thủ công** (`source` = `STANDALONE`/`INSPECTION`/`ACCIDENT`): form đầy đủ field
   bắt buộc (Vehicle/Type/Severity/Safety Impact/Location/Description, Rental optional), gate
   `INCIDENT.CREATE`.
3. **Tạo Incident từ Return** (`source` = `RETURN`): nút "Tạo sự cố từ Return" ở tab "Sự cố" của
   Rental Detail hoặc ở danh sách `ReturnIncidentItem` hiển thị trong tab "Giao-nhận" — tiền điền
   type/position/description/estimatedCost/baselineComparison từ 1 `ReturnIncidentItem` đã chọn
   (§0.3), nhân viên bổ sung Severity/Safety Impact/Media rồi lưu thành `Incident` `OPEN` mới.
4. **Đánh giá** (`OPEN→ASSESSING`, UC-DI-03/04): bổ sung/sửa Type/Severity/Safety Impact/Location/
   Baseline Reference (nếu `source=RETURN`).
5. **Xác định trách nhiệm & chi phí** (UC-DI-05, gate `INCIDENT.ASSESS`): dialog set `Liability` +
   `customerCharge`/`companyCost`/`insuranceCovered`, validate tổng = `actualCost` (nếu đã có) hoặc
   `estimatedCost` (nếu chưa sửa) — DI-BR-06. Đây là bước chuyển `ASSESSING→APPROVED` (nếu
   `estimatedCost ≤ APPROVAL_THRESHOLD`) hoặc `ASSESSING→WAITING_APPROVAL` (nếu vượt, cần thêm 1 action
   "Duyệt" riêng, gate `INCIDENT.APPROVE`, chặn nếu `Liability=UNDETERMINED` — DI-BR-05).
6. **Theo dõi sửa chữa** (`APPROVED→IN_REPAIR→REPAIRED`, gate `INCIDENT.EDIT`): nhập
   `repairVendorName`/`repairStartDate`/`repairEndDate` khi vào `IN_REPAIR`; nhập `actualCostParts`/
   `actualCostLabor`/`actualCostOther`/`repairInvoiceMeta` (placeholder) khi chuyển `REPAIRED` — chặn
   nếu thiếu (DI-BR-09).
7. **Đóng sự cố** (`REPAIRED→CLOSED`, gate `INCIDENT.CLOSE`): chặn nếu `Liability=UNDETERMINED`
   (DI-BR-05).
8. **Huỷ** (`OPEN/ASSESSING/APPROVED→CANCELLED`, lý do bắt buộc).
9. `IncidentListScreen` (`/incidents`): lọc theo status/severity/source/vehicle, tìm theo mã sự cố.
10. `IncidentDetailScreen` (`/incidents/:id`): "Hồ sơ sự cố" — header stepper trạng thái (11 giá trị,
    nhánh phụ hiển thị badge riêng nếu seed có) + 4 tab: **Tổng quan** (type/severity/safetyImpact/
    location/description/media placeholder/baseline/source+rental link) · **Trách nhiệm & chi phí**
    (Liability + 3 mốc chi phí, **ẩn hoàn toàn với `OPERATION_STAFF`** — DI-BR-22) · **Sửa chữa**
    (vendor/ngày/hoá đơn placeholder, cũng ẩn với `OPERATION_STAFF`) · **Nhật ký thao tác**.
11. Tab "Sự cố" ở `RentalDetailScreen` (thay placeholder): danh sách Incident của Rental + nút "Tạo
    sự cố từ Return" (nếu có `ReturnIncidentItem` chưa chuyển thành Incident) + nút "Báo sự cố mới".
12. Nối mốc `INCIDENT` trên `VehicleConditionTimelineTab` (Vehicle Detail) — thay ghi chú "chờ DI"
    hiện tại bằng dữ liệu `Incident` thật, đầy đủ Liability/Cost (bản Webapp đầy đủ, CR-2026-045,
    field-scoping DI-BR-22 vẫn áp dụng nếu người xem là `OPERATION_STAFF` — dù hiếm khi role này mở
    Webapp, vẫn tôn trọng rule).
13. Route `/incidents`, `/incidents/:id` thay `ComingSoon`.

### 1.2. Ngoài phạm vi Round 1 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| `DISPUTED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION` qua UI | Điều kiện kích hoạt + luồng giải quyết tranh chấp còn nhiều Open Question (§27); chỉ seed để test badge, giống cách mọi Round trước xử lý nhánh phụ state machine |
| Quản lý claim bảo hiểm đầy đủ (UC-DI-13) | Chỉ 3 field phẳng tối giản (`insuranceClaimCode`/`Status`/`Amount`), không có vòng đời claim riêng |
| Cấu hình ngưỡng/loại sự cố/đơn vị sửa (UC-DI-18) | Dùng hằng số cố định trong `model.ts` (§0.5), không có màn cấu hình |
| Khoản phải thu bổ sung sau Rental `COMPLETED` (UC-DI-11, DI-BR-16) | Cần `RentalSettlement`/Post-Settlement Charge (Phase 4) chưa build |
| Công bố Customer Charge cho Settlement (UC-DI-10) | Cần `RentalSettlement` (Phase 4) chưa build — Customer Charge chỉ lưu trên `Incident`, chưa đẩy đi đâu |
| Tự động chuyển Vehicle `MAINTENANCE`/tự tạo Vehicle Block | Ngoại lệ kiến trúc không mở (§0.4) |
| Báo cáo sự cố (UC-DI-17), bảng khối lượng | Để roadmap Phase 6 (polish/báo cáo) |
| Đồng bộ 2 chiều với `ReturnIncidentItem` | Chỉ đọc 1 chiều để tiền điền (§0.3) |

---

## 2. Data model

### 2.1. `Incident` (1 storage key `incidents`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `incidentCode` | `string` | có | Tạm `SC-0001` tăng dần, mirror `generateContractCode`-style — `TODO(OQ)` quy tắc chính thức |
| `vehicleId` | `string` | có | DI-BR-01 |
| `rentalId` | `string?` | — | DI-BR-02 — có thể không gắn Rental (STANDALONE do công ty/INSPECTION) |
| `source` | `IncidentSource` | có | `RETURN`/`STANDALONE`/`INSPECTION`/`ACCIDENT` |
| `reportedByUserId`/`reportedByName`/`reportedByRole` | `string` | có | Tự động = actor hiện tại lúc tạo |
| `reportedAt` | `string` | có | Tự động = `now` lúc tạo |
| `type` | `IncidentType` | có | 7 giá trị BRD §9.1 |
| `severity` | `IncidentSeverity` | có | `MINOR/MODERATE/MAJOR/CRITICAL` |
| `safetyImpact` | `boolean` | có | DI-BR-07 |
| `location` | `string?` | — | Mô tả vị trí tự do (§0.5 — không sơ đồ xe) |
| `description` | `string` | có | |
| `mediaMeta` | `MediaMeta[]` | — (mặc định `[]`) | Placeholder, mirror type đã dùng ở `handover-return` (deep-import type, không import giá trị runtime) |
| `baselineReference` | `IncidentBaselineReference?` | bắt buộc nếu `source==='RETURN'` | `NEW/WORSENED/PRE_EXISTING` |
| `liability` | `Liability` | có | Mặc định `UNDETERMINED` (DI-BR-05) — không optional |
| `liabilityNote` | `string?` | — | Bắt buộc khi `liability==='SHARED'` (mô tả tỉ lệ) |
| `estimatedCost` | `number` | có | Nhập lúc tạo |
| `actualCostParts`/`actualCostLabor`/`actualCostOther` | `number?` | — | Nhập khi `REPAIRED` |
| `customerCharge`/`companyCost`/`insuranceCovered` | `number?` | — | Nhập ở bước Xác định trách nhiệm |
| `repairVendorName`/`repairStartDate`/`repairEndDate` | `string?` | — | Nhập khi `IN_REPAIR` |
| `repairInvoiceMeta` | `MediaMeta?` | — | Placeholder hoá đơn |
| `insuranceClaimCode`/`insuranceClaimStatus`/`insuranceClaimAmount` | `string?`/`string?`/`number?` | — | Tối giản, không vòng đời riêng |
| `disputeNote` | `string?` | — | Chỉ hiển thị khi seed ở `DISPUTED` (§1.2) |
| `status` | `IncidentStatus` | có | 11 giá trị, khởi tạo `OPEN` |
| `cancelReason`/`writeOffReason`/`closedNoActionReason` | `string?` | — | Theo trạng thái tương ứng |
| `closedAt` | `string?` | — | |
| `createdAt`/`updatedAt` | `string` | có | |

**Field KHÔNG lưu (lý do):** `Quotes[]` nhiều báo giá (chỉ 1 `estimatedCost`, không có mảng — §1.2
đơn giản hoá), repair before/after media tách riêng (dùng chung `mediaMeta` + `repairInvoiceMeta`,
không thêm field riêng).

### 2.2. Enum mới trong `shared/domain/enums.ts` (§11 chi tiết)

`INCIDENT_SOURCES` (4), `INCIDENT_TYPES` (7, **khác** `INCIDENT_ITEM_TYPES` đã có cho
`ReturnIncidentItem` — giữ nguyên cái cũ, không gộp), `INCIDENT_SEVERITIES` (4),
`INCIDENT_BASELINE_REFERENCES` (3). Sửa `INCIDENT_STATUSES` (7→11), `LIABILITIES` (4→6) đúng §0.1.

---

## 3. Hàm thuần (`incidents/model.ts`)

```ts
// Tạo mã sự cố tạm — TODO(OQ: quy tắc đánh số chính thức chưa chốt).
generateIncidentCode(existingCount: number): string // = `SC-${String(existingCount + 1).padStart(4, '0')}`

// DI-BR-06 — Customer Charge + Company Cost + Insurance Covered phải = Actual Cost (hoặc Estimated
// Cost nếu chưa có Actual Cost) — sai lệch > 1đ coi là không khớp (tránh lỗi float).
validateCostAllocation(incident: Pick<Incident, 'actualCostParts'|'actualCostLabor'|'actualCostOther'|'estimatedCost'|'customerCharge'|'companyCost'|'insuranceCovered'>): boolean

// Guard trạng thái — mirror pattern `canCancel()`/`canVoid()` các feature trước.
canStartAssessing(incident: Incident): boolean       // OPEN -> ASSESSING
canApprove(incident: Incident): boolean               // ASSESSING/WAITING_APPROVAL -> APPROVED, chặn nếu liability === 'UNDETERMINED' (DI-BR-05)
needsWaitingApproval(estimatedCost: number): boolean  // estimatedCost > APPROVAL_THRESHOLD
canStartRepair(incident: Incident): boolean           // APPROVED -> IN_REPAIR
canMarkRepaired(incident: Incident): boolean          // IN_REPAIR -> REPAIRED, chặn nếu thiếu actualCost*/repairInvoiceMeta (DI-BR-09)
canClose(incident: Incident): boolean                 // REPAIRED -> CLOSED, chặn nếu liability === 'UNDETERMINED' (DI-BR-05/10)
canCancelIncident(incident: Incident): boolean         // OPEN/ASSESSING/APPROVED -> CANCELLED

// Hằng số tạm — TODO(OQ: DamageIncident-BRD.md §27 Q — ngưỡng chính thức chưa chốt).
export const APPROVAL_THRESHOLD = 2_000_000
```

Không build hàm cho `DISPUTED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION` (§1.2 — chỉ seed).

---

## 4. Business rule cần trích dẫn (`DI-BR-01 → DI-BR-22`, nguồn: BRD §20 — xem §0.2 về mâu thuẫn UseCase)

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| DI-BR-01 | Mỗi Incident thuộc đúng 1 Vehicle | Enforce |
| DI-BR-02 | Incident có thể có/không có Rental | Enforce (`rentalId?`) |
| DI-BR-03 | Tối thiểu 1 ảnh + 1 vị trí | Enforce cấu trúc (`mediaMeta`/`location`), không validate cứng số ảnh (giống mọi round trước — chưa có media thật) |
| DI-BR-04 | Chỉ `NEW`/`WORSENED` mới phát sinh Customer Charge | Enforce ở form (gợi ý, không chặn cứng — vẫn là quyết định của Manager) |
| DI-BR-05 | `Liability=UNDETERMINED` không được `APPROVED`/`CLOSED` | Enforce (`canApprove`/`canClose`) |
| DI-BR-06 | Customer+Company+Insurance = Actual/Estimated Cost | Enforce (`validateCostAllocation`) |
| DI-BR-07 | Safety Impact/CRITICAL → Vehicle MAINTENANCE | N/A tự động (§0.4) — chỉ lưu field |
| DI-BR-08 | Vượt ngưỡng → `WAITING_APPROVAL` | Enforce (`needsWaitingApproval`) |
| DI-BR-09 | Không `REPAIRED` nếu thiếu hoá đơn/actual cost | Enforce (`canMarkRepaired`) |
| DI-BR-10 | Chỉ `CLOSED` khi đã có trách nhiệm + chi phí + (nếu cần) `REPAIRED` | Enforce (`canClose` + chỉ gọi được từ `REPAIRED`) |
| DI-BR-11 | Customer Charge>0 không CLOSED trước khi vào Settlement | N/A — chưa có Settlement (Phase 4), không chặn được thật, `TODO(OQ)` |
| DI-BR-12 | DISPUTED phải có kết luận trước CLOSED | N/A — không build UI DISPUTED (§1.2) |
| DI-BR-13 | Đổi Liability/chi phí sau APPROVED phải lý do+audit | Enforce một phần: mọi sửa đều audit; chưa có dialog "sửa sau Approved" riêng — dùng chung dialog Xác định trách nhiệm, ghi audit before/after |
| DI-BR-14 | Incident từ Return kế thừa dữ liệu, không nhập lại | Enforce (tiền điền từ `ReturnIncidentItem`, §0.3) |
| DI-BR-15 | `CLOSED` không xoá vật lý | Enforce (không có `remove()`) |
| DI-BR-16 | Rental COMPLETED + charge mới → Khoản phải thu bổ sung | N/A — chưa có Settlement |
| DI-BR-17 | Mọi thay đổi audit | Enforce (`appendAudit()` mọi mutation) |
| DI-BR-18 | Company Cost+Insurance→chi phí xe; Customer Charge→doanh thu gross | N/A — chưa có RevenueCost (Phase 4), chỉ lưu field |
| DI-BR-19 | Sự cố nặng: công thức Bill+Loss-of-use+10% | Enforce CHỈ khi `Liability=CUSTOMER` (§0.5), các Liability khác không tự suy |
| DI-BR-20 | Hư hỏng nhẹ cần Manager xác nhận trước Settlement | N/A — chưa có Settlement; thay bằng: bước "Xác định trách nhiệm" luôn gate `INCIDENT.ASSESS` (Manager/SALES) |
| DI-BR-21 | Tai nạn → Sales khoá lịch xe | N/A tự động (§0.4) — cơ chế Vehicle Block có sẵn, thủ công |
| DI-BR-22 | Field-scoping ẩn Liability/Cost/Claim/Dispute/Repair cho `OPERATION_STAFF` | Enforce ở tầng UI (component điều kiện role, không sửa `permissions.ts`) |

---

## 5. Màn hình (Round 1)

### 5.1. `IncidentListScreen` (`/incidents`)

Bảng/card — cột: Mã sự cố, Xe (biển số), Rental (nếu có, link), Loại, Mức độ (badge màu theo
severity), Trạng thái (badge 11 giá trị), Liability, ngày báo cáo. Lọc: status/severity/source/xe.
Nút "Báo sự cố mới" (gate `INCIDENT.CREATE`).

### 5.2. `IncidentDetailScreen` (`/incidents/:id`)

Header: mã sự cố + `IncidentStatusBadge` + stepper 7 mốc chính (Open→Assessing→(Waiting)→Approved→
In Repair→Repaired→Closed, có thể hiện badge rời cho Cancelled/Disputed/Written Off/Closed No
Action nếu đang ở trạng thái đó) + nút hành động theo trạng thái hiện tại (gate đúng theo §1.1).

4 tab:
1. **Tổng quan** — Type/Severity/SafetyImpact/Location/Description/`mediaMeta` (chip placeholder)/
   Source+Rental link/Baseline Reference (nếu có).
2. **Trách nhiệm & chi phí** — Liability + 3 mốc chi phí + `validateCostAllocation` hiển thị cảnh
   báo lệch tổng. **Ẩn hoàn toàn tab này khỏi `TabsList` khi role hiện tại là `OPERATION_STAFF`**
   (DI-BR-22, mirror cách `VehicleDetailScreen` ẩn hẳn tab Revenue/Cost/Profit theo quyền).
3. **Sửa chữa** — vendor/ngày/hoá đơn placeholder/claim bảo hiểm tối giản. Cùng ẩn với
   `OPERATION_STAFF`.
4. **Nhật ký thao tác** — mirror `VehicleAuditTab`/`RentalAuditTab`, `entity==='Incident'`.

### 5.3. Tab "Sự cố" ở `RentalDetailScreen` — component mới `RentalIncidentsTab.tsx`

Danh sách `Incident` của Rental (đọc-only trừ nút tạo mới) + nếu Rental có `ReturnRecord` với
`incidentItems` chưa tạo `Incident` tương ứng → hiện card riêng "Sự cố phát hiện khi trả xe (chưa
tạo hồ sơ)" với nút "Tạo hồ sơ sự cố" cho mỗi item (§0.3).

### 5.4. Nối mốc `INCIDENT` ở `VehicleConditionTimelineTab`

Thay đoạn ghi chú "chờ `features/incidents`" bằng dữ liệu `Incident` thật của xe (join qua
`vehicleId`), hiển thị đầy đủ (field-scoping DI-BR-22 vẫn áp dụng theo role người xem). **Lưu ý khi
sửa (tránh trùng dòng):** code hiện tại sinh event `INCIDENT` bằng cách lặp `r.incidentItems` của
từng `ReturnRecord` (`VehicleConditionTimelineTab.tsx` dòng ~73-81) — xoá hẳn nhánh lặp này khi nối
dữ liệu thật, thay bằng danh sách `Incident` lọc theo `vehicleId` (qua `useIncidents`). Nếu chỉ
"thêm" mà không xoá nhánh cũ, 1-2 Incident `source='RETURN'` ở seed (§7, tạo từ 1
`ReturnIncidentItem` cụ thể) sẽ hiện **trùng 2 lần** trên timeline (một từ `ReturnRecord.
incidentItems` cũ, một từ `Incident` mới) — các `ReturnIncidentItem` chưa được "tạo hồ sơ sự cố"
(chưa có `Incident` tương ứng) thì không còn hiển thị ở mốc này nữa (vẫn còn hiển thị như card nhắc
"chưa tạo hồ sơ" ở tab "Sự cố" của Rental Detail, §5.3 — không mất thông tin).

### 5.5. Dialog

- `IncidentCreateDialog` (hoặc Sheet, mirror `RentalFormSheet` độ phức tạp) — form đầy đủ field bắt
  buộc, 2 biến thể: tạo mới hoàn toàn / tạo từ `ReturnIncidentItem` (props tiền điền).
- `IncidentAssessDialog` — nhập Type/Severity/SafetyImpact/Location/BaselineReference,
  `OPEN→ASSESSING`.
- `IncidentLiabilityDialog` — Liability + 3 mốc chi phí, validate tổng, chuyển `APPROVED`/
  `WAITING_APPROVAL`.
- `IncidentApproveDialog` — chỉ hiện khi `WAITING_APPROVAL`, gate `INCIDENT.APPROVE`.
- `IncidentRepairDialog` — 2 bước (bắt đầu sửa / hoàn tất sửa, có thể tách 2 dialog riêng
  `IncidentStartRepairDialog`/`IncidentCompleteRepairDialog`).
- `IncidentCancelDialog` — mirror `RentalCancelDialog`, bắt buộc lý do.

---

## 6. Responsive

Bám khung đã dùng — List bảng/card, Detail nhiều tab cuộn ngang (`max-w-full`, mirror
`VehicleDetailScreen`/`RentalDetailScreen`).

---

## 7. Seed data (`features/incidents/seed.ts`)

- **8-10 `Incident`**: tham chiếu `vehicleId` thật, vài gắn `rentalId` thật (từ Rental đã
  `RETURNED`/`SETTLEMENT`/`COMPLETED`), vài không gắn Rental (`STANDALONE`/`INSPECTION`).
- Phân bổ đủ trạng thái để List/badge test: 1-2 `OPEN`, 1-2 `ASSESSING`, 1 `WAITING_APPROVAL`, 1-2
  `APPROVED`, 1 `IN_REPAIR`, 1 `REPAIRED`, 2 `CLOSED` (đủ field Liability/chi phí hợp lệ qua
  `validateCostAllocation`), 1 `CANCELLED` (`cancelReason`), **1 `DISPUTED`** + **1 `WRITTEN_OFF`** +
  **1 `CLOSED_NO_ACTION`** (seed trực tiếp, không qua action UI — đúng §1.2).
- 1-2 Incident tạo từ `source='RETURN'`, liên kết đúng 1 `ReturnIncidentItem` có thật trong seed
  `handover-return` (không bịa id).
- Ngày tính động (`isoDateOffset`).

---

## 8. Lộ trình còn lại (roadmap)

`DISPUTED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION` qua UI thật, quản lý claim bảo hiểm đầy đủ, cấu hình
ngưỡng/loại sự cố, Khoản phải thu bổ sung/công bố Settlement (chờ Phase 4), tự động Vehicle
MAINTENANCE/Vehicle Block (ngoại lệ kiến trúc cần thiết kế riêng nếu BA/khách yêu cầu), báo cáo sự cố.

---

## 9. API / hooks / audit

### 9.1. `incidents/api.ts`

`list(filter?: {status?, severity?, source?, vehicleId?, rentalId?})`, `getById(id)`,
`create(input, actor)` (gate CREATE, source bất kỳ), `createFromReturnIncidentItem(returnRecordId,
itemId, input, actor)` (đọc `@/features/handover-return` qua barrel, không sửa), `startAssessing(id,
input, actor)`, `setLiabilityAndCost(id, input, actor)` (tự quyết `APPROVED`/`WAITING_APPROVAL` theo
`needsWaitingApproval`), `approve(id, actor)`, `startRepair(id, input, actor)`,
`markRepaired(id, input, actor)`, `close(id, actor)`, `cancel(id, reason, actor)`.

Audit action mới nối cuối `AUDIT_ACTIONS`: `CREATE_INCIDENT`, `ASSESS_INCIDENT`,
`SET_INCIDENT_LIABILITY`, `APPROVE_INCIDENT`, `START_INCIDENT_REPAIR`, `MARK_INCIDENT_REPAIRED`,
`CLOSE_INCIDENT`, `CANCEL_INCIDENT` (entity `'Incident'`).

### 9.2. `incidents/hooks.ts`

`useIncidents(filter?)`, `useIncident(id?)`, mỗi action trên 1 hook mutation tương ứng.

### 9.3. `incidents/index.ts`

`export type { Incident } from './model'` + `export { IncidentListScreen } from
'./screens/IncidentListScreen'` + `export { IncidentDetailScreen } from
'./screens/IncidentDetailScreen'`. Không export hooks/api (feature khác deep-import).

---

## 10. i18n

Thêm `vi.incidents.*` + `INCIDENT_STATUS_LABELS` (11)/`LIABILITY_LABELS` (6, cập nhật)/
`INCIDENT_SOURCE_LABELS`/`INCIDENT_TYPE_LABELS`/`INCIDENT_SEVERITY_LABELS`/
`INCIDENT_BASELINE_REFERENCE_LABELS`.

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: sửa `INCIDENT_STATUSES` (7→11), `LIABILITIES` (4→6) theo §0.1; thêm 4
  enum mới §2.2; nối 8 audit action mới.
- `shared/i18n/vi.ts`: thêm `vi.incidents.*` + label map (§10).
- `permissions.ts`: **không sửa** — `INCIDENT.*` đã đúng.
- `rentals/screens/RentalDetailScreen.tsx`: tab `incidents` thay placeholder.
- `vehicles/components/VehicleConditionTimelineTab.tsx`: nối mốc `INCIDENT` thật.
- `shared/fixtures/registerSeeds.ts`: import `incidents/seed` sau `handover-return`.
- `app/routes.tsx`: bỏ `ComingSoon` cho `/incidents`, `/incidents/:id`.
- `docs/IMPLEMENTATION-PLAN.md`: tick dòng `features/incidents` + dòng "Nối Vehicle Condition
  Timeline ... Incident thật" khi xong.

---

## 12. Mã requirement cần trích trong code

`DI-BR-01, 02, 03, 04, 05, 06, 07(note), 08, 09, 10, 13, 14, 15, 17, 19(có điều kiện), 21(note), 22`
· `CR-2026-010, 011, 015, 048, 052` · Open Questions: §0.5 (ngưỡng duyệt, công thức Liability≠khách,
danh mục loại sự cố).

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Xác nhận `vehicles/model.ts`/`api.ts`/`hooks.ts`, `handover-return/model.ts`/`api.ts`/`hooks.ts`,
   `permissions.ts` **không bị đụng** (chỉ đọc qua barrel).
4. Không có action UI nào cho `DISPUTED`/`WRITTEN_OFF`/`CLOSED_NO_ACTION`, không tự động đổi Vehicle
   status/tạo Vehicle Block.
5. *(Chủ dự án tự test)*: tạo sự cố mới (STANDALONE) → `OPEN`; đánh giá → `ASSESSING`; xác định trách
   nhiệm với `estimatedCost` thấp → `APPROVED` ngay; với `estimatedCost` cao hơn ngưỡng →
   `WAITING_APPROVAL`, duyệt → `APPROVED`; bắt đầu sửa → `IN_REPAIR`; hoàn tất sửa (đủ actual cost) →
   `REPAIRED`; đóng → `CLOSED`; thử đóng khi `Liability=UNDETERMINED` → bị chặn; đổi vai trò
   `OPERATION_STAFF` → không thấy tab Trách nhiệm/Sửa chữa ở Detail; tab "Sự cố" ở Rental Detail hiện
   đúng danh sách + nút tạo từ Return; Vehicle Condition Timeline mốc `INCIDENT` hiện đủ số liệu.
6. `docs/IMPLEMENTATION-PLAN.md` tick đúng 2 dòng liên quan, xoá `ComingSoon` `/incidents`,
   `/incidents/:id`.

---

## 14. Việc tiếp theo sau khi phê duyệt Round 1

Phase 3 hoàn thiện (Handover/Return + Incidents + Vehicle Condition Timeline đầy đủ). Việc tiếp theo:
Employee Assignment + Dispatch board (đang lên kế hoạch song song — xem `docs/EMPLOYEE-ASSIGNMENT-
DISPATCH-PLAN.md`), hoặc Phase 4 (Tài chính) để mở khoá DI-BR-11/16/18 (Settlement/Revenue-Cost).
