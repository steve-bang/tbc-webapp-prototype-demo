# Kế hoạch triển khai — Trang Hợp đồng (Contract Management)

**Vai trò soạn:** `tech-lead` · **Trạng thái:** `PENDING_APPROVAL` (15/09/2026) — Round 1 (data core +
Sinh/Ký/Huỷ hợp đồng + List/Detail) đã lên kế hoạch chi tiết đầy đủ ở §1-§9/§11-§13, chờ phê duyệt
trước khi giao `dev`.

**Nguồn nghiệp vụ:** `../thien-bao-car-docs/modules/ContractManagement-BRD.md` (v1.5, toàn bộ, đặc
biệt §6-§19, §26) + `-UseCase.md` (v1.1, đối chiếu mâu thuẫn §0.1) + `../thien-bao-car-docs/
WebappQuanTri.md` §9.2-§9.4 + `../thien-bao-car-docs/CHANGE-REQUESTS.md` (CR-2026-012/013/035/063) +
`../thien-bao-car-docs/RentalManagement-BRD.md` §8-9/§54-55 (liên kết Rental↔Contract).

**Nguồn kỹ thuật:** `CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/RENTAL-MANAGEMENT-PLAN.md` §8.5/
§15 (mẫu format Round). Đối chiếu mã hiện có: `src/shared/domain/enums.ts` (`CONTRACT_STATUSES`,
`CONTRACT_ADDENDUM_TYPES` **đã scaffold sẵn**, dùng nguyên), `src/shared/domain/permissions.ts`
(`CONTRACT.VIEW/CREATE/EXPORT/VOID` **đã có sẵn**, dùng nguyên), `src/features/rentals/model.ts`
(`ROUND1_TRANSITIONS` — điểm sẽ mở rộng, xem §0.2).

---

## 0. Cảnh báo quan trọng — đọc trước khi code

### 0.1. Mâu thuẫn tài liệu — `CT-BR-17`/`CT-BR-18` khác nội dung giữa BRD và UseCase

`ContractManagement-BRD.md` §19 (v1.5, 09/09/2026 — mới hơn, đã cập nhật theo CR-2026-063):
- `CT-BR-17` = đổi xe giữa kỳ (HĐ đã ký) → phụ lục `ADDENDUM_VEHICLE_SWAP`, ghi chênh lệch giá.
- `CT-BR-18` = đổi xe trước khi giao (HĐ chưa ký) → tái tạo hợp đồng.

`ContractManagement-UseCase.md` §23 (v1.1, 01/09/2026 — cũ hơn, **chưa** cập nhật theo CR-063):
- `CT-BR-17` = quy tắc tái tạo giữ 1 phiên bản hiệu lực (nội dung khác hẳn).
- `CT-BR-18` = bản ký phải gắn đúng phiên bản hợp đồng đang hiệu lực (nội dung khác hẳn).

**Dùng BRD §19 làm nguồn duy nhất cho mã `CT-BR-xx`** trong code/comment — UseCase v1.1 lỗi thời ở
đúng 2 mã này. Không ảnh hưởng Round 1 (không build Addendum UI/tái tạo — xem §1.2).

### 0.2. `rentals/model.ts` — Round 1 Contract ĐƯỢC PHÉP và CẦN mở rộng (khác mọi Round trước)

Mọi Round trước (Calendar, Vehicle Detail, Customer Detail) đều **cấm tuyệt đối** đụng
`rentals/model.ts`/`api.ts` — chỉ tiêu thụ read-only qua barrel. **Round 1 của `contracts` là ngoại
lệ có chủ đích**: `rentals/model.ts` hiện có comment tường minh tại `ROUND1_TRANSITIONS`:

> "CHỈ định nghĩa transition mà Round 1 tự thực hiện qua UI... mở rộng map này khi Round tương ứng
> (Contract/Handover/Return/Settlement) build tới."

Đây chính là round đó. `dev` **được phép** sửa `rentals/model.ts` (thêm 1 transition +1 hàm guard),
`rentals/api.ts` (+1 hàm), `rentals/hooks.ts` (+1 hook), `rentals/index.ts` (+2 export) — theo đúng
§9.3 dưới đây, **không được sửa gì khác** trong 3 file này (không đổi field `Rental`, không đổi
`canConfirm`/`canCancel`/công thức giá).

### 0.3. Không có "Bảng giá"/Company Info entity — dùng hằng số đơn giản

Tương tự Rental Round 1 (§0.1 `RENTAL-MANAGEMENT-PLAN.md`: không có module "Bảng giá"), ở đây
**không có module `SystemAdministration`/cấu hình công ty** nào build (chỉ có `features/auth`).
`Company Info` trong Snapshot Data (BRD §6) dùng **hằng số cố định** trong `contracts/model.ts`
(tên công ty — dữ kiện thực tế, không phải quyết định nghiệp vụ cần BA chốt, không cần `TODO(OQ)`).

### 0.4. Danh sách Open Question chặn — không tự chốt, giữ hành vi bảo thủ

| Open Q | Ảnh hưởng | Xử lý Round 1 |
| --- | --- | --- |
| Mẫu hợp đồng chuẩn thật (§26 Q1) | Chặn hoàn toàn PDF/merge-field thật | "Xuất PDF" = giả lập (§1.1 mục 5) |
| Tự sinh khi Confirm hay thủ công (Q5) | Trigger code | Chọn **thủ công** (an toàn hơn khi chưa có câu trả lời), `TODO(OQ)` |
| Quy tắc đánh số Contract Code (Q15) | Format mã | Dùng tạm `HD-0001` tăng dần, `TODO(OQ)` |
| Giới hạn số lần tái tạo/phụ lục (Q11) | N/A Round 1 | Không build tái tạo/Addendum UI |
| Mẫu phụ lục chuẩn (Q17) | N/A Round 1 | Chỉ seed field tối thiểu theo §13.1 BRD, không có form tạo |
| Phí huỷ giữa kỳ (Q18/Master Q57) | N/A Round 1 | Không build luồng kết thúc sớm |
| VAT (Master Q40) | Không có field VAT | Không thêm field, không tự đặt % |
| Chữ ký điện tử (Q12) | N/A Phase 1 | Chỉ ký tay giả lập (§1.1 mục 6) |
| Handover cần `GENERATED` hay `SIGNED` (Q6) | N/A | `VehicleHandover` chưa build |

---

## 1. Phạm vi Round 1

### 1.1. Trong phạm vi

1. Data core `features/contracts`: `model.ts`/`api.ts`/`hooks.ts`/`seed.ts`/`index.ts`, 2 entity
   `Contract` + `ContractAddendum` (§2).
2. **Sinh hợp đồng** (thủ công): nút "Sinh hợp đồng" ở tab "Hợp đồng" của `RentalDetailScreen` (thay
   `RentalDetailPlaceholder` hiện tại), gate `can('CONTRACT','CREATE')`, chỉ hiện khi
   `rental.status === 'CONFIRMED'` và Rental chưa có Contract nào. Snapshot toàn bộ dữ liệu từ
   `Rental`+`Customer`+`Vehicle` tại thời điểm bấm, tạo `Contract` status `GENERATED`, đồng thời gọi
   `markContractCreated()` (rentals, §0.2) chuyển `Rental` sang `CONTRACT_CREATED`.
3. **Xem trước & "Xuất PDF" (giả lập)**: dialog hiển thị Snapshot Data theo bố cục đơn giản (không
   phải PDF thật — §0.4), nút xuất chỉ hiện toast xác nhận.
4. **"Tải lên bản ký" (giả lập)**: form nhập tên file + ngày ký + người ký 2 bên (không upload file
   thật) → `GENERATED → SIGNED`.
5. **"Huỷ hợp đồng"** (`VOID`, gate `can('CONTRACT','VOID')` — chỉ `SYSTEM_ADMIN` theo permissions
   hiện có): áp dụng cho `GENERATED`/`SIGNED` (CT-BR-05 + UC-CT-13), bắt buộc lý do.
6. `ContractListScreen` (`/contracts`): danh sách, lọc trạng thái/khách/xe (dùng luôn field snapshot
   trên `Contract`, không cần join), tìm kiếm mã hợp đồng/tên khách/biển số.
7. `ContractDetailScreen` (`/contracts/:id`): mirror `RentalDetailScreen`, tab Tổng quan (Snapshot
   Data) + Bản ký + Phụ lục (đọc-only) + Nhật ký thao tác.
8. Điều hướng: click hàng ở `ContractListScreen` → Detail; từ tab "Hợp đồng" ở Rental Detail, nếu đã
   có Contract → hiện tóm tắt + link `/contracts/:id`.

### 1.2. Ngoài phạm vi Round 1 — lý do hoãn

| Nhóm | Lý do hoãn |
| --- | --- |
| Tạo Phụ lục (`ADDENDUM_VEHICLE_SWAP`/`TERMINATION_AGREEMENT`) qua UI | Gắn RM-BR-27/28 (đổi xe giữa kỳ/kết thúc sớm khi `IN_RENTAL`) — Rental Round 1 chưa có UI đưa Rental tới `IN_RENTAL`, không có kịch bản thật để test. Chỉ seed để hiển thị (§7) |
| Tái tạo hợp đồng (Superseded) | Cần Rental đổi field sau khi Contract đã `GENERATED` — Rental Round 1 không có Edit, không có kịch bản thật |
| Cascade Cancel Rental → Void Contract chưa ký (CT-BR-03) | Cần `rentals`↔`contracts` phụ thuộc CHÉO (rentals gọi vào contracts) — rủi ro kiến trúc, để Round sau khi có giải pháp rõ ràng hơn (event/callback). Hệ quả: Round 1 **không cho Cancel** một Rental đã có Contract (§0.2 chỉ thêm 1 chiều transition) |
| `ACTIVE`/`CLOSED`/`SUPERSEDED` qua UI | Cần `VehicleHandover`/`VehicleReturn`/`RentalSettlement` (Phase 3/4) chưa build — chỉ seed trực tiếp để test badge/List |
| Quản lý mẫu hợp đồng (Template) | Không có mẫu thật (Open Question §26 Q1 chặn hoàn toàn) |
| Kiểm tra CCCD/GPLX đầy đủ trước khi sinh (CT-BR-06 đầy đủ) | Chỉ kiểm tra Rental/Customer/Vehicle tồn tại — không đào sâu `CustomerDocument` đã có GPLX chưa (đơn giản hoá, ghi rõ trong DoD) |
| Tự động sinh khi Confirm | Q5 chưa chốt — chọn thủ công (§0.4) |
| Chữ ký điện tử | Phase sau (Q12) |

---

## 2. Data model

### 2.1. `Contract` (1 storage key `contracts`)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `contractCode` | `string` | có | Tạm `HD-0001` tăng dần — `TODO(OQ: ContractManagement-BRD.md §26 Q15)` |
| `version` | `number` | có | Luôn `1` ở Round 1 (không có tái tạo — §1.2) |
| `rentalId` | `string` | có | CT-BR-01 — tối đa 1 Contract hiệu lực/Rental (Round 1: kiểm tra không có Contract nào khác cho cùng `rentalId` trước khi tạo) |
| `status` | `ContractStatus` | có | `CONTRACT_STATUSES` đã scaffold — khởi tạo `GENERATED` |
| `snapshotCompanyName` | `string` | có | Hằng số (§0.3) |
| `snapshotCustomerName` | `string` | có | Snapshot từ `Customer.fullName` lúc sinh |
| `snapshotCustomerIdNumber` | `string` | có | Snapshot từ `Customer.idNumber` |
| `snapshotCustomerPhone` | `string` | có | Snapshot từ `Customer.phone` |
| `snapshotCustomerAddress` | `string?` | — | Snapshot từ `Customer.address` (optional trên Customer) |
| `snapshotVehiclePlate` | `string` | có | Snapshot từ `Vehicle.plate` |
| `snapshotVehicleBrand` | `string` | có | Snapshot từ `Vehicle.brand` |
| `snapshotVehicleModel` | `string` | có | Snapshot từ `Vehicle.model` |
| `snapshotPickupDateTime` / `snapshotExpectedReturnDateTime` | `string` | có | Snapshot từ `Rental` |
| `snapshotPickupLocation` / `snapshotReturnLocation` | `string` | có | Snapshot từ `Rental` |
| `snapshotRentalRate` / `snapshotRentalDurationDays` / `snapshotBaseAmount` / `snapshotDiscountAmount` / `snapshotEstimatedTotal` / `snapshotPrepaymentAmount` / `snapshotAllowedKm` / `snapshotPricePerKm` | `number` | có | Snapshot từ `Rental` (đã snapshot sẵn ở Rental Round 1 — copy nguyên, không tính lại) |
| `snapshotSecurityDepositType` | `SecurityDepositType` | có | Snapshot từ `Rental` |
| `snapshotSecurityDepositAmount` | `number?` | — | Snapshot từ `Rental` |
| `signedCopyFileName` | `string?` | — | Giả lập upload (§1.1 mục 4) |
| `signedDate` | `string?` | — | |
| `signedByCompany` / `signedByCustomer` | `string?` | — | Tên người ký 2 bên, nhập tay |
| `voidReason` | `string?` | — | Bắt buộc khi `VOID` |
| `voidedAt` / `voidedByUserId` / `voidedByName` / `voidedByRole` | `string?` | — | |
| `createdAt` / `updatedAt` | `string` | có | |

**Field KHÔNG lưu (và lý do):** `templateVersion` (không có mẫu thật — §0.4), `pdfFileUrl` thật (giả
lập — §1.1 mục 3), liên kết `Supersedes`/`SupersededBy` (không có tái tạo Round 1 — §1.2).

### 2.2. `ContractAddendum` (1 storage key `contractAddendums`, chỉ seed + đọc — không có form tạo)

| Field | Kiểu | Bắt buộc | Nguồn/ghi chú |
| --- | --- | --- | --- |
| `id` | `string` | có | |
| `contractId` | `string` | có | |
| `type` | `ContractAddendumType` | có | `CONTRACT_ADDENDUM_TYPES` đã scaffold (`ADDENDUM_VEHICLE_SWAP`/`TERMINATION_AGREEMENT`) |
| `effectiveDate` | `string` | có | CT §13.1 |
| `description` | `string` | có | Nội dung thay đổi (tự do — mẫu phụ lục chuẩn chưa chốt, `TODO(OQ: §26 Q17)`) |
| `createdAt` | `string` | có | |

---

## 3. Hàm thuần (`contracts/model.ts`)

```ts
// Tạo mã hợp đồng tạm — TODO(OQ: §26 Q15, quy tắc đánh số chính thức chưa chốt).
generateContractCode(existingCount: number): string // = `HD-${String(existingCount + 1).padStart(4, '0')}`

// CT-BR-05/UC-CT-13 — VOID áp dụng cho GENERATED/SIGNED.
canVoid(contract: Contract): boolean

// GENERATED -> SIGNED.
canMarkSigned(contract: Contract): boolean
```

### 3.1. Mở rộng `rentals/model.ts` (ngoại lệ được phép — §0.2)

```ts
// Thêm 1 dòng vào ROUND1_TRANSITIONS (giữ nguyên các dòng khác):
const ROUND1_TRANSITIONS: Partial<Record<RentalStatus, RentalStatus[]>> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CANCELLED', 'CONTRACT_CREATED'], // + CONTRACT_CREATED
}

// Hàm mới, mirror canCancel():
export function canMarkContractCreated(rental: Rental): boolean {
  return ROUND1_TRANSITIONS[rental.status]?.includes('CONTRACT_CREATED') ?? false
}
```
**Không thêm** `CONTRACT_CREATED: [...]` nào (không có Cancel sau khi đã có Contract — §1.2 lý do
cascade). Không đổi field `Rental`, không đổi `canConfirm`/`canCancel`/hàm tính giá.

---

## 4. Business rule cần trích dẫn (`CT-BR-01 → CT-BR-18`, nguồn: BRD §19 — xem §0.1 về mâu thuẫn UseCase)

| Mã | Nội dung | Round 1 |
| --- | --- | --- |
| CT-BR-01 | Tối đa 1 Contract hiệu lực/Rental | Enforce (kiểm tra trước khi tạo) |
| CT-BR-02 | `SIGNED`/`ACTIVE` không tái tạo | N/A — không có tái tạo (§1.2) |
| CT-BR-03 | Rental `CANCELLED` → Contract chưa ký → `VOID` | N/A — cascade chéo, hoãn (§1.2) |
| CT-BR-04 | `CLOSED` khi Rental `COMPLETED` | N/A — chưa có Settlement |
| CT-BR-05 | Void `SIGNED`/`ACTIVE` chỉ Admin, có lý do, audit | Enforce (permission `VOID` đã chỉ `SYSTEM_ADMIN`) |
| CT-BR-06 | Không sinh khi thiếu field bắt buộc | Enforce mức đơn giản — chỉ kiểm tra Rental/Customer/Vehicle tồn tại (§1.2) |
| CT-BR-07 | Snapshot chốt lúc `GENERATED`, nguồn đổi sau không ảnh hưởng | Enforce (copy giá trị, không tham chiếu sống) |
| CT-BR-08 | Ghi nhận version mẫu | N/A — không có mẫu thật |
| CT-BR-09 | Contract Code duy nhất, không tái dùng | Enforce (tăng dần, không tái sử dụng khi Void) |
| CT-BR-10 | Bản ký không xoá, thay phải có lý do+audit | N/A Round 1 — chưa có luồng "thay bản ký" (chỉ upload 1 lần) |
| CT-BR-11 | PDF khớp Snapshot Data, không sửa trực tiếp | N/A — PDF giả lập |
| CT-BR-12 | Settlement đối chiếu HĐ gốc+phụ lục | N/A — chưa có Settlement |
| CT-BR-13 | Handover chặn theo mức Contract | N/A — chưa có Handover |
| CT-BR-14 | Giữ đầy đủ chuỗi phiên bản/phụ lục, không xoá | Enforce một phần (Addendum seed không có remove) |
| CT-BR-15 | Mọi thao tác tạo/ký/hủy/phụ lục được audit | Enforce (3 audit action mới) |
| CT-BR-16 | Chỉ quản trị sửa mẫu | N/A — không có màn quản lý mẫu |
| CT-BR-17 | Đổi xe giữa kỳ (đã ký) → phụ lục `ADDENDUM_VEHICLE_SWAP` | N/A — không có UI tạo Addendum (§1.2) |
| CT-BR-18 | Đổi xe trước giao (chưa ký) → tái tạo | N/A — không có tái tạo (§1.2) |

---

## 5. Màn hình (Round 1)

### 5.1. Tích hợp tab "Hợp đồng" ở `RentalDetailScreen`

Thay `<RentalDetailPlaceholder note={vi.rentals.contractPlaceholder} />` (tab `contract`) bằng
component mới `RentalContractTab.tsx` (`features/rentals/components/` — vì đây là điểm entry từ phía
Rental, không phải Contract — mirror cách `VehicleMaintenanceTab` đặt trong `vehicles`):
- Nếu Rental chưa có Contract (`useContracts({rentalId})` rỗng — deep-import từ `@/features/
  contracts/hooks`, chưa qua barrel) và `rental.status === 'CONFIRMED'` → nút "Sinh hợp đồng" (gate
  `CONTRACT.CREATE`).
- Nếu Rental status khác `CONFIRMED`/`CONTRACT_CREATED`+ → thông báo "Chỉ sinh được hợp đồng khi
  lượt thuê đã Xác nhận".
- Nếu đã có Contract → card tóm tắt (mã HĐ, trạng thái, ngày sinh) + link `paths.contractDetail(id)`.

### 5.2. `ContractListScreen` (`/contracts`)

Bảng/card (mirror `RentalListScreen`) — cột: Mã hợp đồng, Khách hàng (`snapshotCustomerName`), Xe
(`snapshotVehiclePlate`), Ngày sinh, Trạng thái (`ContractStatusBadge`). Lọc: trạng thái, tìm kiếm mã/
tên khách/biển số (không cần join Customer/Vehicle vì đã có sẵn trên snapshot — đơn giản hơn Rental
List).

### 5.3. `ContractDetailScreen` (`/contracts/:id`)

Mirror `RentalDetailScreen`. Header: mã HĐ + `ContractStatusBadge` + nút "Xem trước/Xuất PDF" (mọi
trạng thái) + "Tải lên bản ký" (chỉ `GENERATED`, gate `CONTRACT.EXPORT`... **xác nhận lại**: hành
động này gần với `CREATE`/quản lý hơn — dùng `CONTRACT.CREATE` cho "Tải lên bản ký" vì đây là bước
tiếp nối luồng tạo, không phải xuất file) + "Huỷ" (`GENERATED`/`SIGNED`, gate `CONTRACT.VOID`). 4 tab:

1. **Tổng quan** — toàn bộ Snapshot Data (khách/xe/thời gian/địa điểm/giá/cọc/km), link ngược về
   `paths.rentalDetail(rentalId)`.
2. **Bản ký** — `signedCopyFileName`/`signedDate`/`signedByCompany`/`signedByCustomer` nếu có, hoặc
   placeholder "Chưa có bản ký".
3. **Phụ lục** — danh sách `ContractAddendum` (đọc-only, `useContractAddendums({contractId})`),
   `ContractDetailPlaceholder` biến thể nếu rỗng (không phải "chờ Phase" mà "chưa phát sinh phụ lục"
   — khác ngữ nghĩa, mirror cách Vehicle Detail phân biệt tab "Hiện trạng xe" rỗng hợp lệ vs chờ Phase).
4. **Nhật ký thao tác** — mirror `RentalAuditTab`/`VehicleAuditTab`, `entity==='Contract'`.

### 5.4. Dialog

- `ContractPreviewDialog` — xem trước giả lập (§1.1 mục 3), layout đơn giản liệt kê Snapshot Data
  theo nhóm (Công ty/Khách hàng/Xe/Thời gian/Giá/Cọc), nút "Xuất PDF" → toast.
- `ContractSignDialog` — form `signedCopyFileName`(text)/`signedDate`/`signedByCompany`/
  `signedByCustomer` → `GENERATED → SIGNED`.
- `ContractVoidDialog` — mirror `RentalCancelDialog`, bắt buộc lý do.

---

## 6. Responsive

Bám khung đã dùng — List bảng/card, Detail tab cuộn ngang nếu cần (chỉ 4 tab, rủi ro tràn thấp).

---

## 7. Seed data (`features/contracts/seed.ts`)

- **6-8 `Contract`**: tham chiếu `rentalId` thật từ `rentals/seed.ts` — chỉ chọn Rental có status
  `CONTRACT_CREATED` trở lên (đã seed sẵn ở Rental Round 1 §7: 2 `CONTRACT_CREATED`, 2
  `READY_FOR_HANDOVER`, 2 `HANDED_OVER`, 2 `IN_RENTAL`, 2 `RETURNED`, 2 `SETTLEMENT`, 3 `COMPLETED`).
  Phân bổ status Contract tương ứng ý nghĩa Rental status đó (vd Rental `HANDED_OVER`+ → Contract
  `ACTIVE`; Rental `COMPLETED` → Contract `CLOSED`) — **chỉ seed trực tiếp**, không qua action UI
  (giống cách Rental Round 1 đã làm với 12 state). Vài `GENERATED` chưa ký, vài `SIGNED`, 1 `VOID`
  (kèm `voidReason`).
- **2-3 `ContractAddendum`**: gắn vào 1-2 Contract đã `ACTIVE`/`CLOSED` (mirror ý nghĩa RM-BR-27/28
  đã xảy ra trong quá khứ), 1 `ADDENDUM_VEHICLE_SWAP` + 1 `TERMINATION_AGREEMENT`.
- Ngày tính động (`isoDateOffset`, mẫu `maintenance/seed.ts`).

---

## 8. Lộ trình còn lại (roadmap — không chi tiết hoá field-level)

Tạo Phụ lục qua UI + tái tạo hợp đồng + cascade Cancel↔Void — chờ khi `VehicleHandover`/
`VehicleReturn` build (Rental có UI tới `IN_RENTAL`) mới có kịch bản thật để thiết kế. Quản lý mẫu
hợp đồng thật — chờ khách cung cấp mẫu (Open Q1).

---

## 9. API / hooks / audit

### 9.1. `contracts/api.ts` (namespace `contracts`)

- `list(filter?: {status?, rentalId?})`, `getById(id)`
- `create(input: {rentalId}, actor)` — tuần tự: (1) `getById` Rental+Customer+Vehicle, (2) kiểm tra
  `canMarkContractCreated(rental)` **trước khi ghi** (tránh tạo Contract mồ côi nếu Rental không hợp
  lệ), (3) kiểm tra CT-BR-01 (chưa có Contract nào khác cho `rentalId`), (4) tạo `Contract`
  `GENERATED` với `contractCode` từ `generateContractCode()`, (5) gọi `markContractCreated(rentalId,
  actor)` từ `@/features/rentals` (barrel, xem §9.3) để chuyển Rental — nếu bước 5 lỗi, đã có Contract
  ghi rồi (chấp nhận được ở demo fake-API, không có transaction thật — ghi rõ giới hạn này trong
  code comment).
- `markSigned(id, input: {signedCopyFileName, signedDate, signedByCompany, signedByCustomer}, actor)`
- `voidContract(id, reason, actor)`

`contractAddendums`: chỉ `list(filter?: {contractId?})` — không có `create` (§1.2, chỉ seed).

Audit action mới nối cuối `AUDIT_ACTIONS`: `CREATE_CONTRACT`, `SET_CONTRACT_SIGNED`, `VOID_CONTRACT`
(entity `'Contract'`).

### 9.2. `contracts/hooks.ts`

`useContracts(filter?)`, `useContract(id?)`, `useContractAddendums(filter?)`, `useCreateContract`,
`useMarkContractSigned`, `useVoidContract`.

### 9.3. Mở rộng `rentals/api.ts`/`hooks.ts`/`index.ts` (§0.2/§3.1)

`rentals/api.ts` — hàm mới, mirror `confirm()`/`cancel()`:
```ts
export async function markContractCreated(id: string, actor: ActorInfo): Promise<Rental> {
  // canMarkContractCreated() guard, đổi status 'CONTRACT_CREATED', appendAudit
  // action: 'MARK_CONTRACT_CREATED', entity: 'Rental'
}
```
`rentals/hooks.ts` — `useMarkContractCreated()` mirror `useConfirmRental()`.
`rentals/index.ts` — thêm:
```ts
export { canMarkContractCreated } from './model'
export { useMarkContractCreated } from './hooks'
```
Audit action mới nối cuối `AUDIT_ACTIONS`: `MARK_CONTRACT_CREATED` (entity `'Rental'`).

### 9.4. `contracts/index.ts`

`export type { Contract, ContractAddendum } from './model'` + `export { ContractListScreen } from
'./screens/ContractListScreen'` + `export { ContractDetailScreen } from
'./screens/ContractDetailScreen'`. Không export hooks/api (feature khác — `rentals` — deep-import
`@/features/contracts/hooks` cho `useContracts`, đúng tiền lệ).

---

## 10. i18n

Thêm `vi.contracts.*` (mẫu `vi.rentals.*`) + `CONTRACT_STATUS_LABELS` (6 nhãn) +
`CONTRACT_ADDENDUM_TYPE_LABELS` (2 nhãn). Cập nhật `vi.rentals.contractPlaceholder` → không còn dùng
(xoá, mirror cách `rentalHistoryPlaceholder` bị xoá ở fix trước — grep xác nhận trước khi xoá).

---

## 11. Thay đổi ở file dùng chung

- `shared/domain/enums.ts`: **không cần enum mới** (`CONTRACT_STATUSES`/`CONTRACT_ADDENDUM_TYPES` đã
  scaffold) — chỉ nối 4 audit action mới (`CREATE_CONTRACT`, `SET_CONTRACT_SIGNED`, `VOID_CONTRACT`,
  `MARK_CONTRACT_CREATED`).
- `shared/i18n/vi.ts`: thêm `vi.contracts.*` + 2 label map (§10), xoá `contractPlaceholder` chết.
- `permissions.ts`: **không sửa** — `CONTRACT.VIEW/CREATE/EXPORT/VOID` đã đúng.
- `rentals/model.ts`/`api.ts`/`hooks.ts`/`index.ts`: mở rộng có kiểm soát (§0.2/§3.1/§9.3) — **đây
  là feature duy nhất được phép làm việc này**, không phải tiền lệ chung cho mọi feature sau.
- `shared/fixtures/registerSeeds.ts`: import `contracts/seed` sau `calendar` (cuối danh sách).
- `app/routes.tsx`: bỏ `ComingSoon` cho `/contracts`, `/contracts/:id`.
- `docs/IMPLEMENTATION-PLAN.md`: tick dòng `features/contracts` khi xong.

---

## 12. Mã requirement cần trích trong code

`CT-BR-01, 05, 06, 07, 09, 14, 15` · `RM-BR` (tham chiếu, không sửa logic) · `CR-2026-012, 013, 035,
063` · Open Questions: `ContractManagement-BRD.md §26 Q1` (mẫu HĐ), `Q5` (trigger), `Q15` (đánh số),
`Q17` (mẫu phụ lục).

---

## 13. Definition of Done (Round 1)

1. `npx tsc -b`, `npx oxlint`, `npm run build` sạch.
2. `grep -rn '\*/[a-zA-Z]' src/` rỗng.
3. Xác nhận `rentals/model.ts`/`api.ts`/`hooks.ts` chỉ có đúng phần mở rộng đã mô tả ở §3.1/§9.3 —
   không đổi field `Rental`, không đổi `canConfirm`/`canCancel`/công thức giá/`hasConflict`.
4. Không có UI tạo Phụ lục, không có tái tạo hợp đồng, không có cascade Cancel→Void tự động.
5. *(Chủ dự án tự test)*: mở 1 Rental `CONFIRMED` → tab Hợp đồng → "Sinh hợp đồng" → Contract
   `GENERATED`, Rental chuyển `Đã lập hợp đồng`; xem trước → dialog hiển thị đúng Snapshot Data; tải
   lên bản ký → chuyển `SIGNED`; huỷ hợp đồng (vai trò `SYSTEM_ADMIN`) → bắt buộc lý do, chuyển
   `VOID`; đổi vai trò khác → không thấy nút Huỷ; `/contracts` liệt kê đúng, lọc/tìm kiếm hoạt động;
   `/contracts/:id` 4 tab đúng nội dung; Rental đã có Contract → không hiện nút Sinh hợp đồng nữa.
6. `docs/IMPLEMENTATION-PLAN.md` tick `features/contracts`, xoá `ComingSoon` `/contracts`,
   `/contracts/:id`.

---

## 14. Việc tiếp theo sau khi phê duyệt Round 1

Sau khi qua review `tech-lead` đạt, Phase 2 gần như hoàn thiện (còn Employee Assignment §8.4 +
Dispatch board — đang tạm hoãn theo yêu cầu chủ dự án cho phần Calendar Round 3). Việc tiếp theo tuỳ
chủ dự án chọn: mở rộng Assignment, hoặc bắt đầu Phase 3 (Handover/Return) để mở khoá các phần đã
hoãn ở Rental/Contract (đổi xe giữa kỳ, tái tạo hợp đồng, `IN_RENTAL` qua UI).
