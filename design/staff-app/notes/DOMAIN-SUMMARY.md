# Tóm tắt nghiệp vụ — App nhân viên giao/nhận (Staff App)

> Người soạn: agent `designer` · Giai đoạn 0 (học domain) · Ngày: 29/10/2026
> Nguồn đã đọc: `AppStaff.md` v1.3, `modules/EmployeeAssignment|VehicleHandover|VehicleReturn|DamageIncident` (BRD v1.4 / v1.5 / v1.6 / v1.6),
> `SystemAdministration-BRD`, `Notification-BRD` v1.5, `CHANGE-REQUESTS.md` (CR-2026-001, 003–015, 023–024, 034, 043, 047, 052–058, 060, 062–064).
> **Quy tắc ưu tiên nguồn:** CR đã `APPLIED` > module BRD/UseCase (bản mới) > `AppStaff.md` (còn sót nội dung cũ, xem §9).
> Tài liệu này là bản tóm tắt phục vụ thiết kế — **không thay thế** BRD/UseCase; mọi điều chưa rõ nằm ở `QUESTIONS.md`.

---

## 1. App này là gì

- App **mobile native iOS + Android** (React Native/Expo) cho **nhân viên hiện trường** giao/nhận xe tự lái. Dùng ngoài trời, một tay, thường đứng cạnh xe với khách.
- **Phase 1 giả định có mạng ổn định** (CR-2026-058): bắt đầu/hoàn tất phiên cần server; mất mạng → cảnh báo + tạm dừng + thử lại. **Offline / hàng đợi đồng bộ / `PENDING_SYNC` = Phase 2** → chỉ thiết kế trạng thái "mất mạng", không thiết kế hàng đợi đồng bộ.
- App **không** là nơi tạo lượt thuê, phân công, quyết toán, cấu hình (đó là Webapp). App **thực hiện** giao/nhận, ghi bằng chứng, thu tiền mốc giao xe, ước tính phát sinh khi nhận xe, nhận thông báo.
- Không thuộc App Phase 1: lịch lưới xe × ngày, tài chính/báo cáo, hồ sơ khách/xe đầy đủ, đăng ký nghỉ, GPS, VETC/phạt nguội tự động, push mobile, offline.
- Ngôn ngữ UI: tiếng Việt. Múi giờ UTC+7 (`SA-BR-14`). Ngày `DD/MM/YYYY`. Tiền VND.

## 2. Vai trò & quyền trên App

| Vai trò | Dùng App? | Ghi chú thiết kế |
| --- | --- | --- |
| `OPERATION_STAFF` | Người dùng chính | Chỉ thấy việc **của mình** (`EA-BR-17`); không thấy giá thuê, công nợ, báo cáo |
| `MANAGER` / `SYSTEM_ADMIN` | Khi tự thực hiện giao/nhận (`VH-BR-14`, `VR-BR-19`) | Ghi đè phân công; duyệt ngoại lệ ở Webapp. **Chưa rõ có UI riêng trên App** → Q-11 |
| `DISPATCHER`, `SALES`, `ACCOUNTANT` | Không | `SALES` không nhận assignment (`EA-BR-20`). Hành vi nếu họ đăng nhập App → Q-11 |

Quyền nhân viên: xem việc của mình · **Báo không nhận việc** (CR-2026-053) · thực hiện giao/nhận **chỉ khi được phân công — chặn cứng** (CR-2026-055) · ghi sự cố + bổ sung media · chia sẻ biên bản/ảnh · xem lại phiên đã hoàn tất của mình · xem nhật ký thao tác của mình · đổi mật khẩu của mình.
Nhân viên **không**: chỉnh sửa sau khi hoàn tất, duyệt phí hư hỏng nhẹ, huỷ có kiểm soát, đánh dấu nghỉ, tự đăng ký nghỉ, tạo/huỷ assignment.

## 3. Bản đồ ứng dụng (điều hướng đề xuất)

```text
Đăng nhập (SĐT / email / username + mật khẩu do Admin cấp; KHÔNG OTP — CR-2026-034)
  └─(lần đầu, nếu Admin bắt buộc) Đổi mật khẩu
  └─ TAB BAR
      ├─ Hôm nay        → Danh sách việc hôm nay → Chi tiết việc → [Bắt đầu giao xe | Bắt đầu nhận xe] → Wizard
      ├─ Sắp tới        → Việc các ngày tới (chỉ đọc) + việc đã hoàn tất (xem lại)
      ├─ Thông báo      → Hộp thông báo in-app (IN_APP_STAFF, cần mạng — CR-2026-053)
      └─ Tài khoản      → Hồ sơ · Giao diện Light/Dark/System · Đổi mật khẩu · Nhật ký thao tác · Đăng xuất
```
Không có: màn xác nhận nhận việc (`ACCEPTED` đã bỏ), màn đăng ký nghỉ, màn tra cứu xe/khách độc lập, màn đồng bộ.

## 4. Luồng nghiệp vụ end-to-end của nhân viên

```text
Admin/Dispatcher phân công (Webapp) → thông báo "Được giao việc mới" (in-app)
   ↓
Mở app → Hôm nay → chọn việc → Chi tiết việc (khách, SĐT, xe, địa điểm, giờ hẹn, trạng thái)
   ├─ "Báo không nhận việc" (kèm lý do) → báo điều phối đổi người (UC-EA-16 mới, không chặn)
   └─ "Bắt đầu" (mở BẤT KỲ LÚC NÀO — CR-2026-053; gate = trạng thái Rental + đúng người phân công — CR-2026-055)
        ↓
   GIAO XE (VH) — Assignment ASSIGNED → IN_PROGRESS → DONE (tự động)
     1 Kiểm tra tiền điều kiện → 2 Giờ giao·ODO·nhiên liệu(vạch) → 3 Bộ ảnh/video chuẩn
     → 4 Baseline hiện trạng (+ panel Lịch sử hiện trạng xe; + nhánh xe máy cọc) → 5 Checklist bàn giao
     → 6 Thu mốc giao xe (70% Base Rental + Security Deposit) → 7 Khách xác nhận (M0–M4)
     → 8 Xác nhận & hoàn tất → 9 Chia sẻ cho khách (Zalo/share sheet) → (11 Xem lại)
        ↓ Rental → HANDED_OVER/IN_RENTAL, Vehicle → RENTED
   NHẬN XE (VR)
     1 Kiểm tra tiền điều kiện (nạp dữ liệu Handover) → 2 Giờ trả·ODO·nhiên liệu → 3 Bộ ảnh (có ảnh Handover làm tham chiếu)
     → 4 Đối chiếu trước/sau (+ panel Lịch sử) → 5 Ghi sự cố phát sinh → 6 Return Checklist
     → 7 VETC / phạt nguội nhập tay → 8 Bảng ước tính phát sinh → 9 Khách xác nhận (đồng ý/bảo lưu/từ chối)
     → 10 Hoàn tất → 11 Chia sẻ (kèm ảnh so sánh) → (13 Xem lại)
        ↓ Rental → RETURNED → SETTLEMENT (Webapp quyết toán), Vehicle → AVAILABLE hoặc MAINTENANCE
```
Lưu ý thứ tự bước 6/7 và bước nhận xe 7–8: tài liệu liệt kê theo nhóm chức năng, **không cấm đổi thứ tự**; thứ tự cuối cùng là đề xuất của designer (Q-04).

## 5. Thực thể & dữ liệu hiển thị trên App

| Thực thể | Trường nhân viên cần thấy / nhập | Ẩn với nhân viên |
| --- | --- | --- |
| **Assignment** (`EA`) | Loại (DELIVERY/RETURN), Planned Window, địa điểm, khách (tên + SĐT), xe (biển số), trạng thái, ghi chú, cờ **ưu tiên** (dời giờ — `EA-BR-19`) | Giá thuê, cọc, công nợ |
| **Rental** (tham chiếu) | Mã lượt, trạng thái, khung thuê, Expected Return, loại Security Deposit (`CASH_20M`/`MOTORBIKE`), số ngày → Allowed KM | Giá/hợp đồng tài chính |
| **Vehicle** (tham chiếu) | Biển số, dòng/Class (`VIP_LUXURY`/`STANDARD`/`TWO_SEATER`), Current Odometer, trạng thái | Hồ sơ xe đầy đủ, Vehicle Block chi tiết |
| **Handover** | Actual Pickup DateTime, Odometer, Fuel (vạch), media, Pre-existing Conditions, Checklist, Customer Acknowledgement, thu tiền mốc giao | — |
| **Return** | Actual Return DateTime, Odometer, Fuel, media, Incident Items, Return Checklist, VETC, phạt nguội, bảng ước tính, Customer Acknowledgement (phạm vi đồng ý/bảo lưu) | Số quyết toán thực tế |
| **Media** | Ô góc chụp, ảnh/video, preview; metadata tự gắn (Handover/Return, Rental, Vehicle, Customer, Employee, Capture Timestamp, Type, Category) | — |
| **Condition item / Incident Item** | Loại, vị trí (sơ đồ xe), mô tả, mức độ, ảnh (bắt buộc), đối chiếu baseline, **chi phí dự kiến** (nhập), cờ ảnh hưởng an toàn | `Liability`, chi phí thực tế, claim, tranh chấp (`DI-BR-22`) |
| **Condition Timeline (rút gọn)** | Ngày, loại mốc (Giao xe/Trả xe/Sự cố/Bảo dưỡng), tóm tắt, vị trí, trạng thái sửa rút gọn, ảnh đại diện | `Liability`, mọi số tiền, claim, tranh chấp, **tên/SĐT khách** (CR-2026-052) |
| **Payment (mốc giao xe)** | Số tiền 70% Base Rental, Security Deposit, QR VietQR động (SePay), trạng thái thu | Sổ giao dịch, hoàn tiền |
| **Notification** | Loại sự kiện, khách, xe, giờ, địa điểm/mô tả thay đổi, đã đọc | — |
| **Audit** | Nhật ký thao tác của mình (`Source = HANDOVER_APP`/`RETURN_APP`) | Nhật ký người khác |

## 6. Trạng thái (vocabulary cho UI)

| Đối tượng | Giá trị (Phase 1) | Ghi chú UI |
| --- | --- | --- |
| **Assignment** | `ASSIGNED → IN_PROGRESS → DONE`; ngoại lệ `REASSIGNED`, `CANCELLED`, `MISSED` | **Không có `ACCEPTED`** (CR-2026-053). Nhãn "Trễ" (hiển thị) ≠ `MISSED` (trạng thái) — ngưỡng chưa chốt (Q-12) |
| **Handover / Return session** | `NOT_STARTED → IN_PROGRESS → COMPLETED`; `DISCARDED` (huỷ nháp), `CANCELLED` (Manager huỷ có kiểm soát) | `PENDING_SYNC` = Phase 2. Chỉ `COMPLETED` Handover mới cho Return (`VH-BR-04`) |
| **Rental** (enum chuẩn CR-2026-043) | `DRAFT → CONFIRMED → CONTRACT_CREATED → READY_FOR_HANDOVER → HANDED_OVER → IN_RENTAL → RETURNED → SETTLEMENT → COMPLETED`; `CANCELLED`, `NO_SHOW`, `DISPUTED` | Giao xe được khi `CONFIRMED`/`READY_FOR_HANDOVER`; nhận xe khi `IN_RENTAL`/`HANDED_OVER` |
| **Vehicle** | `AVAILABLE`, `RENTED`, `MAINTENANCE`, `INACTIVE` | Không giao xe `MAINTENANCE`/`INACTIVE`/có Vehicle Block |
| **Incident** (`DI`) | `OPEN → ASSESSING → WAITING_APPROVAL → APPROVED → IN_REPAIR → REPAIRED → CLOSED`; `DISPUTED`, `CANCELLED`, `WRITTEN_OFF`, `CLOSED_NO_ACTION` | Nhân viên tạo ở `OPEN`; panel chỉ hiện rút gọn: **Chưa sửa / Đang sửa / Đã sửa / Đã đóng** (`DI-BR-22`) |
| **Severity** | `MINOR`, `MODERATE`, `MAJOR`, `CRITICAL` | `CRITICAL` hoặc Safety Impact → Vehicle `MAINTENANCE` |
| **Security Deposit** | `CASH_20M` (20tr, chuyển khoản, đối trừ được), `MOTORBIKE` (xe máy ≥ 15tr + cà vẹt, không đối trừ) | Nhánh baseline xe máy (`VH-BR-18`) |
| **Xác nhận khách** | `M0`…`M4` | Phase 1 chưa chốt (Q-01); M4 = Phase sau |
| **Tài khoản** | `ACTIVE`, `LOCKED`, `DISABLED`; nhân viên `INACTIVE`/`SUSPENDED` → không mở được app; `ON_LEAVE` vẫn đăng nhập | |
| **Thông báo (Delivery)** | `PENDING/SENT/FAILED/RETRY/CANCELLED`; kênh `IN_APP_STAFF` | UI chỉ cần đã đọc/chưa đọc |

## 7. Quy tắc nghiệp vụ quan trọng (đã đối chiếu CR mới nhất)

### 7.1. Đăng nhập & phiên
- Tên đăng nhập = SĐT / email / username (mỗi giá trị duy nhất) + mật khẩu do Admin cấp; **không OTP, không 2FA** (CR-2026-034, `SA-BR-01`). Sai quá N lần → `LOCKED`, Admin mở (`SA-BR-07`). Phiên có hạn → hết hạn về màn đăng nhập. Nhân viên `INACTIVE`/`SUSPENDED` không vào được (`EA-BR-02`). Mọi sự kiện auth vào Audit (`SA-BR-08`).

### 7.2. Công việc trong ngày
- Chỉ thấy việc của mình, sắp theo giờ, phân biệt giao/nhận (`EA-BR-17`). Hiển thị: loại, giờ hẹn, khách + SĐT, biển số, địa điểm, trạng thái, ghi chú. **Không** hiển thị giá/cọc/công nợ.
- Nút "Bắt đầu" mở **bất kỳ lúc nào** (`EA-BR-23`); `IN_PROGRESS` → "Tiếp tục"; `DONE` → "Xem lại" (chỉ đọc). Xem lịch các ngày tới (chỉ đọc).
- `IN_PROGRESS`/`DONE` đặt tự động từ Handover/Return (`EA-BR-13`). Dời giờ do Turnaround Buffer 90' / xe hỏng trước giao → Planned Window cập nhật + **cờ ưu tiên** (`EA-BR-19`, CR-2026-006/013).
- "Báo không nhận việc": hành động độc lập, kèm lý do, không chặn (`EA-BR-21`). Không có đăng ký nghỉ (`EA-BR-22`).
- Thông báo (Phase 1 = in-app, cần mạng): việc mới · reassign · sắp đến giờ · `MISSED` · đổi lịch (đổi Planned Window).

### 7.3. Giao xe (`VH`)
- **Chặn cứng** nếu không phải người được phân công (hoặc Manager/Admin) — `VH-BR-14`, CR-2026-055.
- Tiền điều kiện bắt đầu: Rental `CONFIRMED`/`READY_FOR_HANDOVER` · chưa có Handover `COMPLETED` · xe không `MAINTENANCE`/`INACTIVE`/Vehicle Block (`VH-BR-20`) · hợp đồng đã tạo (cấu hình) · **đã thu mốc đặt xe = chỉ Prepayment 30% Base Rental** (CR-2026-060; **không gồm** Security Deposit).
- Số liệu: `Actual Pickup` mặc định = hiện tại, chỉnh được, **không ở tương lai**; lệch lớn so Planned → cảnh báo. `Odometer` < Current Odometer → cảnh báo/chặn theo cấu hình + bắt ảnh odo (`VH-BR-07`). **Nhiên liệu = số vạch** (CR-2026-023, `VH-BR-22`).
- Bộ ảnh bắt buộc theo cấu hình (ngoại thất: trước/sau/2 hông/4 góc chéo/nóc/lốp/biển số/odo/nhiên liệu; nội thất: táp-lô/vô lăng/ghế trước/ghế sau/cốp/trần/vùng khiếm khuyết; video tuỳ cấu hình); **chặn hoàn tất nếu thiếu** (`VH-BR-05`); thiếu do bất khả kháng → ghi lý do + Manager duyệt ngoại lệ (EX-03).
- Baseline hư hỏng có sẵn: **ảnh bắt buộc** mỗi mục (`VH-BR-08`); "xe không có hư hỏng" phải xác nhận có chủ đích. Panel **Lịch sử hiện trạng xe** đặt phía trên form (CR-2026-052, `VH-BR-23`).
- Cọc xe máy `MOTORBIKE`: baseline xe máy (ảnh nhiều góc, odo, nhiên liệu, ảnh cà vẹt) **bắt buộc trước khi giao ô tô** (`VH-BR-18`).
- Checklist bàn giao: mục = đã giao / không giao / không áp dụng + ghi chú + ảnh tuỳ chọn; xử lý hết mục bắt buộc.
- **Thu mốc giao xe**: 70% Base Rental còn lại + Security Deposit; **không hoàn tất nếu chưa thu đủ**; khách không trả → **hoãn giao hoặc huỷ lượt, không ghi nợ** (CR-2026-056, `VH-BR-17`). Cổng = SePay (VietQR động + webhook, phí công ty chịu — CR-2026-047); baseline "QR + xác nhận tay".
- Khách xác nhận M0–M4 (Q-01); khách không đồng ý một mục → ghi chú, **không cho hoàn tất** tới khi xử lý.
- Hoàn tất: all-or-nothing; Rental → `HANDED_OVER`/`IN_RENTAL`, Vehicle → `RENTED`, Assignment DELIVERY → `DONE`; `Actual Pickup` → tính `Expected Return` theo khung 21:00 (CR-2026-005).
- Sau hoàn tất: **nhân viên không sửa** (chỉ Manager + lý do + audit, `VH-BR-12`).

### 7.4. Nhận xe (`VR`)
- Chỉ khi có Handover `COMPLETED` (`VR-BR-02`); chặn cứng người không được phân công (`VR-BR-19`, CR-2026-055).
- `Actual Return` không trước `Actual Pickup` và không ở tương lai (`VR-BR-05`). `Odometer(return) < Odometer(handover)` → **CHẶN CỨNG** + bắt ảnh + báo Manager (`VR-BR-03`). Nhiên liệu cùng thang vạch (`VR-BR-04`).
- Ảnh nhận **cùng góc** với ảnh Handover, hiển thị ảnh Handover làm tham chiếu (`VR-BR-10`); chặn hoàn tất nếu thiếu (`VR-BR-07`).
- Đối chiếu trước/sau là bằng chứng chính tranh chấp; khác biệt **trùng baseline → "đã có sẵn", không tính phí** (`VR-BR-08`). Panel Lịch sử hiện trạng xe bổ sung, không thay baseline lượt hiện tại (`VR-BR-29`).
- Incident Item: loại, **vị trí**, **mô tả**, đối chiếu baseline (mới/nặng thêm), **ảnh bắt buộc** (`VR-BR-09`), chi phí dự kiến, người ghi (tự động), `OPEN`. Ảnh hưởng an toàn/`CRITICAL` → Vehicle `MAINTENANCE` (`VR-BR-20`). Tai nạn → mô tả bổ sung (bên thứ ba, biên bản, bảo hiểm) + Manager xử lý.
- **Phí hư hỏng nhẹ/trầy xước** do nhân viên nhập: **cần Manager xác nhận** trước khi tính chính thức (`VR-BR-23`, `DI-BR-20`, CR-2026-011); Phase 1 Manager duyệt trực tiếp (nhánh offline "đã tham khảo ý kiến" là Phase 2 — CR-2026-058).
- **Phí thiếu nhiên liệu**: nhân viên tự nhập số vạch thiếu × giá xăng thực tế; **không Manager duyệt, không ngưỡng**; app không tự tính (`VR-BR-28`, CR-2026-023/024).
- Return Checklist sinh từ các mục "đã giao" ở Handover: Đủ / Thiếu / Hỏng / Không áp dụng; Thiếu/Hỏng → khoản `MISSING_ACCESSORY` + chi phí dự kiến.
- VETC / phạt nguội: **nhập tay** (baseline Phase 1); VETC ngoài khoảng `[Actual Pickup → Actual Return]` → cảnh báo, cho liên kết kèm lý do; phạt thuộc Rental đã `COMPLETED` → Post-Settlement Charge (không mở lại Settlement).
- Bảng ước tính (chỉ **ước tính**, Settlement chốt — `VR-BR-12`): xem §8.
- Khách xác nhận: đồng ý / **có bảo lưu** (đánh dấu có tranh chấp) / từ chối hoàn toàn (**vẫn cho hoàn tất**, đánh dấu "khách chưa xác nhận", báo Manager). M2/M3 + có phát sinh → khách phải xác nhận bảng phát sinh (`AC-VR-015`).
- Hoàn tất: Rental `RETURNED → SETTLEMENT` (tự động hay chờ Accountant: theo cấu hình RM — Q-23), Vehicle `AVAILABLE`/`MAINTENANCE`, Assignment RETURN `DONE`.
- Cọc xe máy: đối chiếu hiện trạng xe máy với baseline; **trả lại xe máy sau khi khách hoàn tất mọi nghĩa vụ thanh toán**; phát sinh trả bằng **chuyển khoản QR**, không đối trừ xe máy (`VR-BR-26`).

### 7.5. Chia sẻ, nhật ký, quyền riêng tư
- Chia sẻ T0 = share sheet OS (Zalo/Messenger/email) hoặc link media có thời hạn; Nhận xe kèm **ảnh so sánh**; ghi lịch sử chia sẻ (ai/khi nào/kênh). Tự đăng vào nhóm Zalo **không có API, không cam kết**. Luôn có fallback SMS/email/gọi điện. Điều kiện: phiên `COMPLETED`.
- Mọi thao tác `START/UPDATE_METER/ADD_MEDIA/ADD_CONDITION/UPDATE_CHECKLIST/CUSTOMER_ACK/COMPLETE/SHARE_MEDIA…` ghi audit với `Source = HANDOVER_APP`/`RETURN_APP`; `Reason` bắt buộc cho `EDIT_COMPLETED`/`CANCEL` (Manager).
- Ảnh CCCD/GPLX khách chỉ hiện **theo quyền**, audit mọi lần xem (Q-15). Nhân viên không thấy trường tài chính ngoài những gì cần để thu mốc giao xe.

## 8. Công thức & con số (nhân viên nhìn thấy trong bảng ước tính khi nhận xe)

| Khoản | Quy tắc (đã áp dụng CR mới nhất) | Nguồn |
| --- | --- | --- |
| Vượt km | `Total KM = ODO trả − ODO giao`; `Allowed KM = 350 × số ngày` (cộng dồn) hoặc `3.500` (thuê tháng); `Extra KM = max(0, Total − Allowed)` **làm tròn LÊN bội số 10 km**; × `Price Per KM` theo Class: 10k / 5k / 2k (từ snapshot giá Rental) | `VR-BR-21`; CR-2026-008, **057** |
| Thiếu nhiên liệu | Nhân viên nhập (số vạch thiếu = vạch giao − vạch trả; số tiền theo giá xăng thực tế) | `VR-BR-28`; CR-023/024 |
| Trễ giờ | **Ân hạn 15'** (cấu hình). Sau ân hạn: ≤1h→10%, ≤2h→30%, ≤3h→50% đơn giá 1 ngày, không cộng dồn. **> 3h: không leo thang quá 50%; khách giữ xe qua đêm** (công ty đóng cửa nhận xe sau 23:00): trả trước 08:00 → phụ thu ½ ngày, sau 08:00 → 1 ngày (loại trừ với phí trễ theo giờ) | `VR-BR-22`; CR-2026-005/007/**054** |
| Trả sớm thông thường | Giữ nguyên giá hợp đồng, không hoàn chênh | `VR-BR-27`; CR-2026-022 |
| Sự cố | Tổng chi phí dự kiến nhân viên nhập (hư hỏng nhẹ → chờ Manager xác nhận). Sự cố nặng vào garage: công thức khung `bill + 70% × đơn giá ngày × số ngày garage (+10% bill nếu >100tr)` — **chỉ ước tính, thường Post-Settlement** | `VR-BR-24`; CR-2026-010 |
| VETC & phạt nguội | Tổng khoản nhập tay | `VR-BR-13` |
| Phụ kiện thiếu/hỏng | Tổng chi phí dự kiến mục `MISSING_ACCESSORY` | `UC-VR-07` |
| Phí giao/nhận tận nơi | 0đ nếu tổng quãng đường 2 lượt ≤ 10 km từ bãi; vượt → **15.000đ/km** theo **quãng đường lái xe thực tế** (tham chiếu Google Maps; Phase 1 nhân viên **nhập tay** số km); thu khi nhận xe | `VR-BR-25`; CR-2026-009, **062** |
| Tổng | `Base Rental(tham khảo) + các khoản trên − Discount = Ước tính phát sinh phải thu thêm` (đối trừ cọc/quyết toán ở Webapp) | `VR §15.8` |

Khung giờ: giao ≤ 21:00 → giờ trả chuẩn 21:00; giao > 21:00 → giờ trả chuẩn = giờ giao (CR-2026-005). Hai lượt liền kề cùng xe cách nhau ≥ 90' (CR-2026-006).
Lịch thanh toán 3 mốc: **đặt xe = 30% Base Rental** (App khách / nhân viên thu khi khách chốt) → **giao xe = 70% Base Rental + Security Deposit** (nhân viên thu) → **nhận xe = phát sinh** (ước tính).

## 9. Điểm `AppStaff.md` (v1.3) còn LỆCH so với CR/BRD mới — designer bám CR

> Changelog của AppStaff.md ghi đã sửa, nhưng thân tài liệu còn sót nội dung cũ. Cần BA dọn (khuyến nghị gửi BA).

| # | `AppStaff.md` (dòng gần đúng) nói | Chuẩn áp dụng khi thiết kế | CR / nguồn |
| - | --- | --- | --- |
| 1 | §5.2 (l.211), §7.2 (l.317, 339–345), §7.4 (l.386), §7.7, §16 (l.1130), §17.2 #1–3: còn "Xác nhận nhận việc `ACCEPTED`", nút theo cấu hình | **Không** có bước/trạng thái/màn `ACCEPTED`; chỉ "Báo không nhận việc" | CR-2026-053; `EA-BR-21` |
| 2 | §6.2 (l.239), §7.2 (l.363 "Đăng ký nghỉ"), §16: App có đăng ký nghỉ | **Không** có tính năng này trên App | CR-2026-053; `EA-BR-22` |
| 3 | §7.2 (l.302 "mở khi tới giờ / theo cấu hình"), §17.2 #2 | Nút Bắt đầu mở **bất kỳ lúc nào** | CR-2026-053; `EA-BR-23` |
| 4 | §7.2 (l.361), §13.3 (l.1075): kênh Phase 1 "in-app / push" | Chỉ **in-app** (`IN_APP_STAFF`, cần mạng); push = Phase 2+ | CR-2026-053; `NT-BR-07` |
| 5 | §7.2 A2 (l.323), §8.1, §9.1, §8.2 B3/B8 (l.484, 576), §9.2 B8/B10 (l.750, 806), §10 (l.890–955), §12, §15.3 (l.1117), §17.1 (l.1167), §17.2 #11: "hoạt động offline", `PENDING_SYNC`, hàng đợi đồng bộ, "offline là ràng buộc Phase 1" | **Phase 1 cần mạng**; offline/`PENDING_SYNC`/hàng đợi = **Phase 2** | CR-2026-058 (đảo CR-2026-001 một phần) |
| 6 | §8.2 B1 mục 3 (l.450), §9.2 B1 (l.680), §8.7/§17.2 #7: "chặn cứng hay cảnh báo theo cấu hình" | **Chặn cứng** | CR-2026-055; `VH-BR-14`/`VR-BR-19` |
| 7 | §8.2 B1 mục 7 (l.454): mốc đặt xe = Prepayment 30% **+ Security Deposit** | Mốc đặt xe = **chỉ 30% Base Rental**; Security Deposit thu ở **mốc giao xe** | CR-2026-060 (sửa CR-003/004); `VH-BR-17` |
| 8 | §9.2 B8 (l.757): trễ > 3h "chờ khách chốt"; không nêu ân hạn | > 3h giữ xe qua đêm ½/1 ngày; ân hạn 15' | CR-2026-054; `VR-BR-22` |
| 9 | §9.2 B8 (l.762): đơn giá phí tận nơi "chốt sau" | 15.000đ/km, đo theo đường thực tế (nhập tay Phase 1) | CR-2026-062; `VR-BR-25` |
| 10 | §9.2 B8 (vượt km): không nêu làm tròn; §9.7 #2 "có làm tròn không" | Làm tròn lên bội số 10 km | CR-2026-057; `VR-BR-21` |
| 11 | §8.2 B3, §10: "Nén media + hàng đợi upload chạy nền (hoặc lưu offline)" | Upload online; lỗi mạng → thử lại tại chỗ (không lưu offline) | CR-2026-058 |
| 12 | §18 (phụ lục prototype): S-01..S-54, đăng nhập SĐT + OTP, nút "đã thu" mô phỏng, enum Rental cũ | Chỉ là hiện trạng prototype cũ; không dùng làm chuẩn thiết kế. Đăng nhập = mật khẩu; thu tiền = SePay/QR; Rental enum theo CR-2026-043 | CR-2026-034/043/047/052 |
| 13 | §7.2 "Xác nhận nhận việc"; kênh thông báo nêu `IN_APP_WEBAPP` ở §13.3 | App dùng `IN_APP_STAFF` | CR-2026-053 |
| 14 | §9.2 B5 (l.728): "Offline: nhân viên ghi 'đã tham khảo ý kiến [quản lý]'" | Phase 1: **Manager duyệt trực tiếp**; nhánh offline = Phase 2 | CR-2026-058; `DI-BR-20` |
| 15 | §9.2 B10: "theo cấu hình RM" (chuyển SETTLEMENT) | Còn treo (Q-23) — copy trung tính | `VR` UseCase §31 |

Không mâu thuẫn nhưng cần lưu ý: Rental enum chuẩn theo CR-2026-043 (không còn `PENDING_CONFIRMATION`); `AppStaff.md` §8/§9 sơ đồ "Wizard 11/13 bước" gồm cả bước "chia sẻ", "hàng đợi", "xem lại" — thiết kế coi đó là **màn kết thúc/phụ**, không phải bước nhập liệu.

## 10. Việc còn treo ảnh hưởng thiết kế (chi tiết → `QUESTIONS.md`)

Mức xác nhận khách M0–M4 · danh sách góc ảnh/video/giới hạn · lưu nháp & tiếp tục phiên · cách thu tiền trong app (QR/tiền mặt/xác nhận tay) và có thu mốc 3 không · quy trình xin Manager duyệt phí nhẹ trong app · ngưỡng "Trễ"/`MISSED` · UI cho MANAGER/ADMIN và vai trò khác · giấy tờ khách & hợp đồng trên app · luồng đổi xe/xe hỏng trước giao · thang vạch nhiên liệu (kể cả xe điện) · chặn hay cảnh báo ODO lệch.

## 11. Hệ quả cho thiết kế (rút ra)

1. **Một tay + ngoài trời**: CTA chính ở đáy (≥ 48dp), tương phản cao (Light & Dark), chữ ≥ 14 cho thông tin bắt buộc, không chỉ dựa màu để báo trạng thái.
2. **Wizard có tiến độ rõ** (bước x/y, ảnh x/y, checklist x/m), **tạm dừng & tiếp tục**, không mất dữ liệu khi thoát (cách lưu → Q-08).
3. **Tách rõ 3 loại số tiền** khi nhìn bảng nhận xe: *thu tại hiện trường (mốc giao)* ≠ *ước tính phát sinh (Return)* ≠ *quyết toán (Webapp, không hiện)*. Luôn gắn nhãn "Ước tính — quản lý chốt ở bước quyết toán".
4. **Chặn cứng vs cảnh báo** phải phân biệt thị giác rõ (đỏ chặn + giải thích + lối ra: gọi điều phối).
5. **Ẩn tài chính/Liability/danh tính khách** ở mọi nơi hiển thị lịch sử — thiết kế panel Lịch sử hiện trạng như component có biến thể "đã lọc".
6. **Phase 1 online-only**: dải cảnh báo mất mạng toàn cục + vô hiệu thao tác cần server + nút Thử lại; không có hàng đợi đồng bộ.
7. **Bằng chứng ảnh là trung tâm**: lưới ô ảnh, so sánh cặp trước/sau, phóng to, chụp lại, trạng thái upload/mờ/lỗi.
