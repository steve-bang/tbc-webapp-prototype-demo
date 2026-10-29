# REPORT — Thiết kế UI/UX App nhân viên giao/nhận (Thiên Bảo Car)

> Giai đoạn 9 (tổng hợp & bàn giao) · agent `designer` · 29/10/2026 · Phiên bản 1.0 · Trạng thái: **bản thiết kế hoàn chỉnh chờ BA/khách duyệt**.
> Đường dẫn ảnh/HTML trong báo cáo là **tương đối** so với thư mục `design/staff-app/`. Xem trực quan: mở [`index.html`](index.html) (thư viện) và [`prototype.html`](prototype.html) (prototype bấm được). Cách xem/chụp lại: [`README.md`](README.md).

## Mục lục
(a) Tổng quan & phạm vi · (b) Kiến trúc thông tin & điều hướng · (c) Design system · (d) Các màn theo giai đoạn 1–8 · (e) Ma trận màn × luồng · (f) A11y & contrast · (g) Giả định BA & điểm cần khách xác nhận · (h) Handoff cho dev React Native/Expo · (i) Tài liệu liên quan

---

## (a) Tổng quan & phạm vi

**Mục tiêu.** Bộ thiết kế mobile end-to-end cho **App nhân viên giao/nhận Phase 1** (vai trò `OPERATION_STAFF`; `MANAGER`/`SYSTEM_ADMIN` dùng cùng giao diện) của Thiên Bảo Car Management System: mockup HTML tĩnh theo token (mỗi màn đủ trạng thái, Light + Dark), screenshot, mô tả UI/UX flow, trang Design System; đủ để dev React Native/Expo dựng và BA/khách duyệt.

**Con số.** 91 trang mockup (`S-xxx`, gồm biến thể `S-020b`, `S-022b`; `S-120` gom 3 màn hệ thống S-120/121/122) · khoảng 456 state đã vẽ · 182 ảnh (light + dark) · 5 tài liệu flow · 25 giả định BA (`A-01…A-25`) · 24 mục mở (`OI-01…OI-24`).

**Trong phạm vi (Phase 1, online-only):** đăng nhập / đổi mật khẩu · công việc trong ngày · chi tiết việc + báo không nhận việc · wizard Giao xe (`VH`) · wizard Nhận xe (`VR`) · ghi nhận hư hỏng / sự cố · chụp ảnh / video · khách xác nhận (M1, M2 tuỳ chọn, M3 mức Could) · thu tiền theo mốc (QR SePay + baseline xác nhận tay) · panel Lịch sử hiện trạng xe rút gọn (CR-2026-052) · chia sẻ qua share sheet · thông báo in-app · hồ sơ / cài đặt (Light/Dark/System) · nhật ký thao tác · mất mạng / lỗi / rỗng.

**Ngoài phạm vi (không vẽ, ghi "Phase 2"):** offline + hàng đợi đồng bộ (CR-2026-058) · push mobile · đăng ký nghỉ & xác nhận nhận việc (CR-2026-053) · GPS · VETC / phạt nguội tự động · chữ ký điện tử · tra cứu xe/khách độc lập · App khách hàng · màn Webapp.

**Nguyên tắc áp dụng mọi màn:** token-only (không hardcode màu/spacing/radius) · Light + Dark · vùng chạm ≥ 48dp · chữ thông tin ≥ 14 · trạng thái luôn có icon + nhãn (không chỉ màu) · CTA chính cố định đáy, hành động nguy hiểm tách xa · khung chuẩn 390×844 và co về 360×800 · trích mã nguồn (`VH-BR-xx`, `VR-BR-xx`, `EA-BR-xx`, `CR-2026-xxx`, `A-nn`) trong từng màn · không rò trường ẩn (Liability, tiền, danh tính khách) theo `EA-BR-17`, `DI-BR-22`, CR-2026-052.

**Nguồn chuẩn nghiệp vụ:** CR đã `APPLIED` > module BRD/UseCase > `AppStaff.md` (còn nội dung cũ — xem [`notes/DOMAIN-SUMMARY.md`](notes/DOMAIN-SUMMARY.md) §9). Kế hoạch gốc: [`PLAN.md`](PLAN.md).

---

## (b) Kiến trúc thông tin & sơ đồ điều hướng


```text
S-124 Khởi động → S-010 Đăng nhập → (S-011 Đổi MK lần đầu) → TAB BAR
 ├─ Hôm nay (S-020)  → S-022 Chi tiết → S-023 Báo không nhận | S-050 Giao xe wizard | S-070 Nhận xe wizard
 ├─ Sắp tới (S-021)  → S-026 Việc đã xong → S-061/S-088 Xem lại
 ├─ Thông báo (S-024)→ S-025 → S-022
 └─ Tài khoản (S-110)→ S-111 Giao diện · S-112 Đổi MK · S-113 Nhật ký · S-115 Hỗ trợ · S-116 Đăng xuất
Toàn cục: dải mất mạng (S-098/S-120) · lỗi server (S-121) · phiên hết hạn (S-013)
```
Tab bar 4 mục: **Hôm nay · Sắp tới · Thông báo · Tài khoản** (badge số chưa đọc ở Thông báo). Wizard là luồng toàn màn hình (ẩn tab bar), thoát có hộp thoại (S-062).

---

Tab bar 4 mục: **Hôm nay · Sắp tới · Thông báo · Tài khoản** (badge số chưa đọc ở Thông báo). Wizard là luồng toàn màn hình (ẩn tab bar); thoát bằng sheet S-062.

**Luồng chính (đường vàng) — cũng là kịch bản của [`prototype.html`](prototype.html):**

```text
Khởi động (S-124) → Đăng nhập (S-010) → Hôm nay (S-020) → Chi tiết việc (S-022)
   ├─ GIAO XE:  S-050 tiền điều kiện → S-051 tổng quan → S-052 số liệu → S-053 bộ ảnh → S-054 baseline
   │            → S-056 checklist → S-057 thu tiền → S-058 khách xác nhận → S-059 rà soát → S-060 hoàn tất → (S-046 chia sẻ)
   └─ NHẬN XE:  S-070 tiền điều kiện → S-071 tổng quan → S-072 số liệu → S-073 bộ ảnh → S-074 đối chiếu → S-075 sự cố
                → S-078 checklist → S-081 ước tính → S-084 khách xác nhận → S-085 rà soát → S-086 hoàn tất → (S-046 chia sẻ)
Nhánh dùng chung: S-030…S-034 chụp/lưới ảnh · S-035/036 hư hỏng · S-037/038 lịch sử xe · S-039…041 thu tiền · S-042…045 khách xác nhận
Nhánh ngoại lệ:   S-090…S-099 (khách không đến, không trả tiền, xe không đạt, thiếu ảnh, ODO bất thường, không phân công, đổi/huỷ, mất mạng, upload lỗi)
```

Mô tả chi tiết đường chính / đường phụ / lỗi của từng luồng: [`flows/GD2-GD3-flow.md`](flows/GD2-GD3-flow.md) · [`flows/GD4-flow.md`](flows/GD4-flow.md) · [`flows/GD5-giao-xe-flow.md`](flows/GD5-giao-xe-flow.md) · [`flows/GD6-nhan-xe-flow.md`](flows/GD6-nhan-xe-flow.md) · [`flows/GD7-GD8-flow.md`](flows/GD7-GD8-flow.md).

---

## (c) Design system (tóm tắt)

Chi tiết: [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md); xem trực quan `S-001…S-007`.

- **Hướng hình ảnh:** "Modern Enterprise Blue" — xanh `action-primary` `#2563EB` (Light) trên nền canvas sáng; Dark nền slate. Logo placeholder "TBC", tên tạm "Thiên Bảo Car — Nhân viên" (A-20).
- **3 lớp token** (`tokens/tokens.css`): primitive (`--blue-600`…, chỉ nằm trong tokens) → semantic (`--text-primary`, `--action-primary`, `--status-danger-bg`, `--space-*`, `--radius-*`, `--elevation-*`) → biến cục bộ của component. Light mặc định, Dark qua `data-theme="dark"`.
- **Component** (`tokens/components*.css`): device frame · app bar · tab bar · button (primary/secondary/ghost/danger/danger secondary) · field · check/radio/switch · segmented / stepper số / chip · card / list · badge · banner · empty/error · skeleton · overlay (scrim, sheet, dialog, toast) · wizard (header, steps, progress, ring, CTA bar) · thành phần nghiệp vụ I (task card, plate, money, info row) · II (photo slot, photo grid, fuel bar, odo, cond item, timeline, compare, sign pad, QR card) · avatar.
- **Icon:** Lucide-style inline SVG (`tokens/icons.js`): giao = `truck`, nhận = `key`, thông báo = `bell`, mất mạng = `wifi-off`, chụp = `camera`, QR = `qr-code`, tiền = `banknote`.
- **Quy tắc:** vùng chạm ≥ 48dp, khoảng cách giữa hai vùng chạm ≥ 8dp; tiền/số tabular-nums (`1.250.000 ₫`, `12.345 km`); một màn một hành động chính; mỗi màn có đủ state D/L/E/R/O/V.

---

## (d) Các màn theo giai đoạn

Ký hiệu state: D mặc định · L loading (skeleton) · E rỗng · R lỗi · O mất mạng · V biến thể nghiệp vụ. Bấm ảnh để xem bản đầy đủ (mỗi ảnh là một trang gom nhiều state, độ phân giải 2x).

### Giai đoạn 1 — Design System & khung ứng dụng

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). 7 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-001**<br>Design System · Tokens<br>[html](screens/S-001-tokens.html) | Trang tham chiếu token: màu Light/Dark, chữ, khoảng cách, bo góc, đổ bóng và bảng đo contrast. | [<img src="screenshots/S-001-tokens.light.png" width="150">](screenshots/S-001-tokens.light.png) | [<img src="screenshots/S-001-tokens.dark.png" width="150">](screenshots/S-001-tokens.dark.png) |
| **S-002**<br>Design System · Nhập liệu & nút<br>[html](screens/S-002-input-button.html) _(3 state)_ | Ô nhập, nút, check/radio/switch, segmented, stepper, chip với đủ state (default/focus/lỗi/disabled/loading). | [<img src="screenshots/S-002-input-button.light.png" width="150">](screenshots/S-002-input-button.light.png) | [<img src="screenshots/S-002-input-button.dark.png" width="150">](screenshots/S-002-input-button.dark.png) |
| **S-003**<br>Design System · Phản hồi & lớp phủ<br>[html](screens/S-003-feedback.html) _(7 state)_ | Badge, banner, empty/error, skeleton, toast, dialog, bottom sheet. | [<img src="screenshots/S-003-feedback.light.png" width="150">](screenshots/S-003-feedback.light.png) | [<img src="screenshots/S-003-feedback.dark.png" width="150">](screenshots/S-003-feedback.dark.png) |
| **S-004**<br>Design System · Thành phần nghiệp vụ I<br>[html](screens/S-004-business-1.html) _(4 state)_ | Thành phần nghiệp vụ I: thẻ việc Giao/Nhận, biển số, tiền, hàng thông tin, 6 trạng thái assignment. | [<img src="screenshots/S-004-business-1.light.png" width="150">](screenshots/S-004-business-1.light.png) | [<img src="screenshots/S-004-business-1.dark.png" width="150">](screenshots/S-004-business-1.dark.png) |
| **S-005**<br>Design System · Thành phần nghiệp vụ II<br>[html](screens/S-005-business-2.html) _(4 state)_ | Thành phần nghiệp vụ II: ô ảnh, lưới ảnh, thang nhiên liệu, ODO, mục hiện trạng, timeline, đối chiếu, ô ký, thẻ QR. | [<img src="screenshots/S-005-business-2.light.png" width="150">](screenshots/S-005-business-2.light.png) | [<img src="screenshots/S-005-business-2.dark.png" width="150">](screenshots/S-005-business-2.dark.png) |
| **S-006**<br>Design System · Trạng thái chuẩn & trợ năng<br>[html](screens/S-006-states-a11y.html) _(6 state)_ | Trạng thái chuẩn (loading/empty/error/offline/no-permission/success) và checklist trợ năng. | [<img src="screenshots/S-006-states-a11y.light.png" width="150">](screenshots/S-006-states-a11y.light.png) | [<img src="screenshots/S-006-states-a11y.dark.png" width="150">](screenshots/S-006-states-a11y.dark.png) |
| **S-007**<br>Khung ứng dụng (App shell)<br>[html](screens/S-007-app-shell.html) _(6 state)_ | Khung ứng dụng: status bar, app bar, tab bar 4 mục, wizard header, CTA bar; khung 390×844 và 360×800. | [<img src="screenshots/S-007-app-shell.light.png" width="150">](screenshots/S-007-app-shell.light.png) | [<img src="screenshots/S-007-app-shell.dark.png" width="150">](screenshots/S-007-app-shell.dark.png) |

### Giai đoạn 2 — Đăng nhập & tài khoản vào app

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD2-GD3-flow.md](flows/GD2-GD3-flow.md). 7 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-010**<br>Đăng nhập<br>[html](screens/S-010-dang-nhap.html) _(7 state)_ | Đăng nhập bằng tên đăng nhập (SĐT/email/username) + mật khẩu do Admin cấp. | [<img src="screenshots/S-010-dang-nhap.light.png" width="150">](screenshots/S-010-dang-nhap.light.png) | [<img src="screenshots/S-010-dang-nhap.dark.png" width="150">](screenshots/S-010-dang-nhap.dark.png) |
| **S-011**<br>Đổi mật khẩu bắt buộc lần đầu<br>[html](screens/S-011-doi-mat-khau-lan-dau.html) _(6 state)_ | Admin đặt cờ bắt buộc đổi: nhân viên phải đặt mật khẩu mới trước khi vào app. | [<img src="screenshots/S-011-doi-mat-khau-lan-dau.light.png" width="150">](screenshots/S-011-doi-mat-khau-lan-dau.light.png) | [<img src="screenshots/S-011-doi-mat-khau-lan-dau.dark.png" width="150">](screenshots/S-011-doi-mat-khau-lan-dau.dark.png) |
| **S-012**<br>Quên mật khẩu<br>[html](screens/S-012-quen-mat-khau.html) _(6 state)_ | Gửi yêu cầu đặt lại tới quản trị viên; luôn có đường gọi điều phối. | [<img src="screenshots/S-012-quen-mat-khau.light.png" width="150">](screenshots/S-012-quen-mat-khau.light.png) | [<img src="screenshots/S-012-quen-mat-khau.dark.png" width="150">](screenshots/S-012-quen-mat-khau.dark.png) |
| **S-013**<br>Phiên hết hạn<br>[html](screens/S-013-phien-het-han.html) _(3 state)_ | Báo hết phiên, đưa về đăng nhập lại mà không mất việc đang làm. | [<img src="screenshots/S-013-phien-het-han.light.png" width="150">](screenshots/S-013-phien-het-han.light.png) | [<img src="screenshots/S-013-phien-het-han.dark.png" width="150">](screenshots/S-013-phien-het-han.dark.png) |
| **S-014**<br>Tài khoản không đăng nhập được<br>[html](screens/S-014-tai-khoan-khong-dang-nhap-duoc.html) _(4 state)_ | Thông điệp riêng cho 4 trường hợp, luôn chỉ lối ra (gọi điều phối). | [<img src="screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.light.png" width="150">](screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.light.png) | [<img src="screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.dark.png" width="150">](screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.dark.png) |
| **S-015**<br>Vai trò không dùng app<br>[html](screens/S-015-vai-tro-khong-dung-app.html) _(3 state)_ | Chặn DISPATCHER/SALES/ACCOUNTANT sau khi đăng nhập thành công, thay vì cho vào màn rỗng. | [<img src="screenshots/S-015-vai-tro-khong-dung-app.light.png" width="150">](screenshots/S-015-vai-tro-khong-dung-app.light.png) | [<img src="screenshots/S-015-vai-tro-khong-dung-app.dark.png" width="150">](screenshots/S-015-vai-tro-khong-dung-app.dark.png) |
| **S-124**<br>Khởi động & kiểm tra phiên<br>[html](screens/S-124-khoi-dong.html) _(4 state)_ | Splash kiểm tra token để quyết định vào Đăng nhập hay vào thẳng Hôm nay. | [<img src="screenshots/S-124-khoi-dong.light.png" width="150">](screenshots/S-124-khoi-dong.light.png) | [<img src="screenshots/S-124-khoi-dong.dark.png" width="150">](screenshots/S-124-khoi-dong.dark.png) |

### Giai đoạn 3 — Công việc trong ngày & thông báo

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD2-GD3-flow.md](flows/GD2-GD3-flow.md). 9 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-020**<br>Hôm nay (tab 1)<br>[html](screens/S-020-hom-nay.html) _(6 state)_ | Danh sách việc của tôi hôm nay theo giờ; phân biệt Giao/Nhận; vào Chi tiết hoặc Bắt đầu/Tiếp tục/Xem lại. | [<img src="screenshots/S-020-hom-nay.light.png" width="150">](screenshots/S-020-hom-nay.light.png) | [<img src="screenshots/S-020-hom-nay.dark.png" width="150">](screenshots/S-020-hom-nay.dark.png) |
| **S-020b**<br>Hôm nay — biến thể thẻ việc<br>[html](screens/S-020b-hom-nay-bien-the-the-viec.html) _(5 state)_ | Biến thể thẻ việc ở tab Hôm nay: ưu tiên/dời giờ, Trễ, IN_PROGRESS/DONE, MISSED, CANCELLED/REASSIGNED. | [<img src="screenshots/S-020b-hom-nay-bien-the-the-viec.light.png" width="150">](screenshots/S-020b-hom-nay-bien-the-the-viec.light.png) | [<img src="screenshots/S-020b-hom-nay-bien-the-the-viec.dark.png" width="150">](screenshots/S-020b-hom-nay-bien-the-the-viec.dark.png) |
| **S-021**<br>Sắp tới (tab 2)<br>[html](screens/S-021-sap-toi.html) _(5 state)_ | Xem lịch các ngày kế tiếp (chỉ đọc), nhóm theo ngày. | [<img src="screenshots/S-021-sap-toi.light.png" width="150">](screenshots/S-021-sap-toi.light.png) | [<img src="screenshots/S-021-sap-toi.dark.png" width="150">](screenshots/S-021-sap-toi.dark.png) |
| **S-022**<br>Chi tiết công việc<br>[html](screens/S-022-chi-tiet-cong-viec.html) _(6 state)_ | Mọi thông tin cần để đi làm + cổng vào wizard. | [<img src="screenshots/S-022-chi-tiet-cong-viec.light.png" width="150">](screenshots/S-022-chi-tiet-cong-viec.light.png) | [<img src="screenshots/S-022-chi-tiet-cong-viec.dark.png" width="150">](screenshots/S-022-chi-tiet-cong-viec.dark.png) |
| **S-022b**<br>Chi tiết công việc — biến thể trạng thái & chặn<br>[html](screens/S-022b-chi-tiet-bien-the.html) _(6 state)_ | Biến thể Chi tiết việc: DONE, MISSED, CANCELLED, REASSIGNED và hai trạng thái chặn (không phân công, Rental sai trạng thái). | [<img src="screenshots/S-022b-chi-tiet-bien-the.light.png" width="150">](screenshots/S-022b-chi-tiet-bien-the.light.png) | [<img src="screenshots/S-022b-chi-tiet-bien-the.dark.png" width="150">](screenshots/S-022b-chi-tiet-bien-the.dark.png) |
| **S-023**<br>Báo không nhận việc<br>[html](screens/S-023-bao-khong-nhan-viec.html) _(7 state)_ | Gửi lý do cho điều phối; hành động độc lập, không chặn. | [<img src="screenshots/S-023-bao-khong-nhan-viec.light.png" width="150">](screenshots/S-023-bao-khong-nhan-viec.light.png) | [<img src="screenshots/S-023-bao-khong-nhan-viec.dark.png" width="150">](screenshots/S-023-bao-khong-nhan-viec.dark.png) |
| **S-024**<br>Hộp thông báo (tab 3)<br>[html](screens/S-024-hop-thong-bao.html) _(6 state)_ | Thông báo in-app: việc mới, đổi giờ/ưu tiên, sắp đến giờ, MISSED, đổi người, huỷ. | [<img src="screenshots/S-024-hop-thong-bao.light.png" width="150">](screenshots/S-024-hop-thong-bao.light.png) | [<img src="screenshots/S-024-hop-thong-bao.dark.png" width="150">](screenshots/S-024-hop-thong-bao.dark.png) |
| **S-025**<br>Chi tiết thông báo<br>[html](screens/S-025-chi-tiet-thong-bao.html) _(4 state)_ | Cho thấy chính xác cái gì đổi (giờ cũ→mới, người cũ→mới) và đường mở việc. | [<img src="screenshots/S-025-chi-tiet-thong-bao.light.png" width="150">](screenshots/S-025-chi-tiet-thong-bao.light.png) | [<img src="screenshots/S-025-chi-tiet-thong-bao.dark.png" width="150">](screenshots/S-025-chi-tiet-thong-bao.dark.png) |
| **S-026**<br>Việc đã hoàn tất<br>[html](screens/S-026-viec-da-hoan-tat.html) _(5 state)_ | Tra lại các phiên mình đã hoàn tất để xem lại (chỉ đọc). | [<img src="screenshots/S-026-viec-da-hoan-tat.light.png" width="150">](screenshots/S-026-viec-da-hoan-tat.light.png) | [<img src="screenshots/S-026-viec-da-hoan-tat.dark.png" width="150">](screenshots/S-026-viec-da-hoan-tat.dark.png) |

### Giai đoạn 4 — Khối hiện trường dùng chung

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD4-flow.md](flows/GD4-flow.md). 17 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-030**<br>Camera chụp ảnh<br>[html](screens/S-030-camera.html) _(4 state)_ | chụp một ô ảnh theo danh mục (VH §14); khi Nhận xe hiện ảnh lúc giao để chụp cùng góc (VR-BR-10). A-02, A-03 (không xin quyền vị trí; ảnh nén tự động; | [<img src="screenshots/S-030-camera.light.png" width="150">](screenshots/S-030-camera.light.png) | [<img src="screenshots/S-030-camera.dark.png" width="150">](screenshots/S-030-camera.dark.png) |
| **S-031**<br>Xem trước & phóng to ảnh<br>[html](screens/S-031-photo-preview.html) _(4 state)_ | duyệt ảnh vừa chụp / ảnh trong lưới; chụp lại, xoá, xem metadata, cảnh báo mờ (VH-BR-09, UC-VH-04). | [<img src="screenshots/S-031-photo-preview.light.png" width="150">](screenshots/S-031-photo-preview.light.png) | [<img src="screenshots/S-031-photo-preview.dark.png" width="150">](screenshots/S-031-photo-preview.dark.png) |
| **S-032**<br>Quay video<br>[html](screens/S-032-video.html) _(6 state)_ | video tổng quan quanh xe, tuỳ chọn (A-02), ≤ 60 s, cảnh báo > 100 MB (A-03, cấu hình; ⚑Q-02/03). | [<img src="screenshots/S-032-video.light.png" width="150">](screenshots/S-032-video.light.png) | [<img src="screenshots/S-032-video.dark.png" width="150">](screenshots/S-032-video.dark.png) |
| **S-033**<br>Quyền thiết bị bị từ chối<br>[html](screens/S-033-permissions.html) _(3 state)_ | hướng dẫn mở Cài đặt. [A] Camera (chặn — không hoàn tất phiên thiếu ảnh) · [B] Thư viện ảnh (không chặn; | [<img src="screenshots/S-033-permissions.light.png" width="150">](screenshots/S-033-permissions.light.png) | [<img src="screenshots/S-033-permissions.dark.png" width="150">](screenshots/S-033-permissions.dark.png) |
| **S-034**<br>Lưới ô ảnh bắt buộc<br>[html](screens/S-034-photo-grid.html) _(7 state)_ | nơi nhân viên thấy tiến độ ảnh và chọn ô cần chụp (VH-BR-05, VR-BR-07). Lưới co giãn theo cấu hình N ô (A-02). | [<img src="screenshots/S-034-photo-grid.light.png" width="150">](screenshots/S-034-photo-grid.light.png) | [<img src="screenshots/S-034-photo-grid.dark.png" width="150">](screenshots/S-034-photo-grid.dark.png) |
| **S-035**<br>Sơ đồ xe — chọn vị trí<br>[html](screens/S-035-car-diagram.html) _(4 state)_ | đánh dấu một/nhiều vị trí hư hỏng (DI §10, VH §12). | [<img src="screenshots/S-035-car-diagram.light.png" width="150">](screenshots/S-035-car-diagram.light.png) | [<img src="screenshots/S-035-car-diagram.dark.png" width="150">](screenshots/S-035-car-diagram.dark.png) |
| **S-036**<br>Form mục hiện trạng / hư hỏng<br>[html](screens/S-036-damage-form.html) _(4 state)_ | nhập một mục hư hỏng. Giao xe = baseline (VH-BR-08): loại · vị trí · mô tả · mức độ · ảnh (≥ 1, bắt buộc). | [<img src="screenshots/S-036-damage-form.light.png" width="150">](screenshots/S-036-damage-form.light.png) | [<img src="screenshots/S-036-damage-form.dark.png" width="150">](screenshots/S-036-damage-form.dark.png) |
| **S-037**<br>Panel Lịch sử hiện trạng xe (rút gọn)<br>[html](screens/S-037-condition-history-panel.html) _(6 state)_ | cho nhân viên biết xe từng hỏng/sửa ở đâu để không ghi nhầm (CR-2026-052, VH-BR-23, VR-BR-29). | [<img src="screenshots/S-037-condition-history-panel.light.png" width="150">](screenshots/S-037-condition-history-panel.light.png) | [<img src="screenshots/S-037-condition-history-panel.dark.png" width="150">](screenshots/S-037-condition-history-panel.dark.png) |
| **S-038**<br>Chi tiết mốc lịch sử (rút gọn)<br>[html](screens/S-038-history-detail.html) _(4 state)_ | Chi tiết một mốc lịch sử ở chế độ rút gọn: ảnh lớn, thông tin mốc, đã ẩn trách nhiệm/chi phí/bồi thường/khách. | [<img src="screenshots/S-038-history-detail.light.png" width="150">](screenshots/S-038-history-detail.light.png) | [<img src="screenshots/S-038-history-detail.dark.png" width="150">](screenshots/S-038-history-detail.dark.png) |
| **S-039**<br>Thu tiền theo mốc (QR SePay)<br>[html](screens/S-039-collect-payment.html) _(7 state)_ | hiển thị khoản cần thu ở mốc giao xe: 70% Base Rental còn lại + Security Deposit (mốc đặt xe chỉ 30% đã thu — CR-2026-060); mỗi khoản một QR VietQR động (SePay) (A-05d). | [<img src="screenshots/S-039-collect-payment.light.png" width="150">](screenshots/S-039-collect-payment.light.png) | [<img src="screenshots/S-039-collect-payment.dark.png" width="150">](screenshots/S-039-collect-payment.dark.png) |
| **S-040**<br>Chờ & kết quả thanh toán<br>[html](screens/S-040-payment-result.html) _(7 state)_ | Chờ webhook SePay (tự làm mới, đồng hồ hết hạn QR), đã nhận, QR hết hạn, thu thiếu. | [<img src="screenshots/S-040-payment-result.light.png" width="150">](screenshots/S-040-payment-result.light.png) | [<img src="screenshots/S-040-payment-result.dark.png" width="150">](screenshots/S-040-payment-result.dark.png) |
| **S-041**<br>Xác nhận thu thủ công (baseline)<br>[html](screens/S-041-manual-confirm.html) _(4 state)_ | Baseline khi SePay chưa sẵn sàng: nhập số tiền + ảnh biên nhận, giao dịch PENDING chờ kế toán xác nhận (A-05c, rủi ro cao). | [<img src="screenshots/S-041-manual-confirm.light.png" width="150">](screenshots/S-041-manual-confirm.light.png) | [<img src="screenshots/S-041-manual-confirm.dark.png" width="150">](screenshots/S-041-manual-confirm.dark.png) |
| **S-042**<br>Chuyển thiết bị cho khách<br>[html](screens/S-042-handoff-device.html) _(3 state)_ | Bàn giao thiết bị cho khách: màn nhân viên giải thích, màn khách có dải Chế độ khách hàng, ẩn mọi dữ liệu nội bộ. | [<img src="screenshots/S-042-handoff-device.light.png" width="150">](screenshots/S-042-handoff-device.light.png) | [<img src="screenshots/S-042-handoff-device.dark.png" width="150">](screenshots/S-042-handoff-device.dark.png) |
| **S-043**<br>Khách xác nhận — M1 (tổng thể)<br>[html](screens/S-043-customer-ack-m1.html) _(5 state)_ | Khách xác nhận mức M1 tổng thể (Tôi đã kiểm tra và đồng ý / không đồng ý) cho Giao và Nhận. | [<img src="screenshots/S-043-customer-ack-m1.light.png" width="150">](screenshots/S-043-customer-ack-m1.light.png) | [<img src="screenshots/S-043-customer-ack-m1.dark.png" width="150">](screenshots/S-043-customer-ack-m1.dark.png) |
| **S-044**<br>Khách xác nhận — M2 (ký màn hình)<br>[html](screens/S-044-customer-ack-m2.html) _(4 state)_ | Khách xác nhận mức M2: ký trên màn hình (tuỳ chọn cấu hình), Ký lại luôn có. | [<img src="screenshots/S-044-customer-ack-m2.light.png" width="150">](screenshots/S-044-customer-ack-m2.light.png) | [<img src="screenshots/S-044-customer-ack-m2.dark.png" width="150">](screenshots/S-044-customer-ack-m2.dark.png) |
| **S-045**<br>Khách xác nhận — M3 (OTP)<br>[html](screens/S-045-customer-ack-m3.html) _(6 state)_ | Khách xác nhận mức M3 bằng OTP — mức Could, không vào luồng chính Phase 1. | [<img src="screenshots/S-045-customer-ack-m3.light.png" width="150">](screenshots/S-045-customer-ack-m3.light.png) | [<img src="screenshots/S-045-customer-ack-m3.dark.png" width="150">](screenshots/S-045-customer-ack-m3.dark.png) |
| **S-046**<br>Chia sẻ cho khách<br>[html](screens/S-046-share-to-customer.html) _(7 state)_ | Chia sẻ ảnh và biên bản cho khách qua share sheet hệ điều hành, link 7 ngày, có lịch sử chia sẻ. | [<img src="screenshots/S-046-share-to-customer.light.png" width="150">](screenshots/S-046-share-to-customer.light.png) | [<img src="screenshots/S-046-share-to-customer.dark.png" width="150">](screenshots/S-046-share-to-customer.dark.png) |

### Giai đoạn 5 — Wizard Giao xe (VH)

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD5-giao-xe-flow.md](flows/GD5-giao-xe-flow.md). 13 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-050**<br>Giao xe · Kiểm tra tiền điều kiện (B1)<br>[html](screens/S-050-giao-kiem-tra-dieu-kien.html) _(9 state)_ | chạy tuần tự các điều kiện trước khi mở phiên; ELIGIBLE → bắt đầu, NOT_ELIGIBLE → nêu mọi lý do + cách xử lý. Mã: VH §9, VH-BR-02/03/13/14/17/20, CR-2026-055/056/060. | [<img src="screenshots/S-050-giao-kiem-tra-dieu-kien.light.png" width="150">](screenshots/S-050-giao-kiem-tra-dieu-kien.light.png) | [<img src="screenshots/S-050-giao-kiem-tra-dieu-kien.dark.png" width="150">](screenshots/S-050-giao-kiem-tra-dieu-kien.dark.png) |
| **S-051**<br>Giao xe · Khung wizard & tổng quan phiên<br>[html](screens/S-051-giao-khung-wizard.html) _(7 state)_ | chuẩn hoá khung cho B2…B8, tiến độ, nhảy bước, lưu tự động. Mã: VH §20, A-04, A-08. | [<img src="screenshots/S-051-giao-khung-wizard.light.png" width="150">](screenshots/S-051-giao-khung-wizard.light.png) | [<img src="screenshots/S-051-giao-khung-wizard.dark.png" width="150">](screenshots/S-051-giao-khung-wizard.dark.png) |
| **S-052**<br>Giao xe · B2 Số liệu giao<br>[html](screens/S-052-giao-so-lieu.html) _(7 state)_ | ghi giờ giao thực tế, ODO, nhiên liệu (số vạch) + 2 ảnh đồng hồ. Mã: VH §10, VH-BR-06/07/19/22, CR-2026-005/023. | [<img src="screenshots/S-052-giao-so-lieu.light.png" width="150">](screenshots/S-052-giao-so-lieu.light.png) | [<img src="screenshots/S-052-giao-so-lieu.dark.png" width="150">](screenshots/S-052-giao-so-lieu.dark.png) |
| **S-053**<br>Giao xe · B3 Bộ ảnh chuẩn giao<br>[html](screens/S-053-giao-bo-anh.html) _(6 state)_ | chụp đủ ảnh bắt buộc (+ video tuỳ chọn). Mã: VH §11/§14, VH-BR-05/09, A-02/A-03. | [<img src="screenshots/S-053-giao-bo-anh.light.png" width="150">](screenshots/S-053-giao-bo-anh.light.png) | [<img src="screenshots/S-053-giao-bo-anh.dark.png" width="150">](screenshots/S-053-giao-bo-anh.dark.png) |
| **S-054**<br>Giao xe · B4 Baseline hiện trạng có sẵn<br>[html](screens/S-054-giao-baseline-hien-trang.html) _(7 state)_ | ghi hư hỏng có sẵn trước khi giao, tham chiếu lịch sử xe. Mã: VH §12, VH-BR-08/23, DI-BR-22, CR-2026-052. | [<img src="screenshots/S-054-giao-baseline-hien-trang.light.png" width="150">](screenshots/S-054-giao-baseline-hien-trang.light.png) | [<img src="screenshots/S-054-giao-baseline-hien-trang.dark.png" width="150">](screenshots/S-054-giao-baseline-hien-trang.dark.png) |
| **S-055**<br>Giao xe · B4b Baseline xe máy cọc<br>[html](screens/S-055-giao-baseline-xe-may-coc.html) _(4 state)_ | Baseline xe máy thế chân (chỉ MOTORBIKE): ảnh nhiều góc, ODO, nhiên liệu, ảnh cà vẹt 2 mặt; bắt buộc trước khi giao. | [<img src="screenshots/S-055-giao-baseline-xe-may-coc.light.png" width="150">](screenshots/S-055-giao-baseline-xe-may-coc.light.png) | [<img src="screenshots/S-055-giao-baseline-xe-may-coc.dark.png" width="150">](screenshots/S-055-giao-baseline-xe-may-coc.dark.png) |
| **S-056**<br>Giao xe · B5 Checklist bàn giao<br>[html](screens/S-056-giao-checklist-ban-giao.html) _(5 state)_ | Checklist bàn giao: mỗi mục Đã giao / Không giao / Không áp dụng + ghi chú; CTA khoá tới khi xử lý hết mục bắt buộc. | [<img src="screenshots/S-056-giao-checklist-ban-giao.light.png" width="150">](screenshots/S-056-giao-checklist-ban-giao.light.png) | [<img src="screenshots/S-056-giao-checklist-ban-giao.dark.png" width="150">](screenshots/S-056-giao-checklist-ban-giao.dark.png) |
| **S-057**<br>Giao xe · B6 Thu mốc giao xe<br>[html](screens/S-057-giao-thu-tien-moc-giao.html) _(10 state)_ | thu 70% Base Rental + Security Deposit trước khi hoàn tất. Mã: VH-BR-17, CR-2026-004/047/056/060, A-05. | [<img src="screenshots/S-057-giao-thu-tien-moc-giao.light.png" width="150">](screenshots/S-057-giao-thu-tien-moc-giao.light.png) | [<img src="screenshots/S-057-giao-thu-tien-moc-giao.dark.png" width="150">](screenshots/S-057-giao-thu-tien-moc-giao.dark.png) |
| **S-058**<br>Giao xe · B7 Khách xác nhận (hub)<br>[html](screens/S-058-giao-khach-xac-nhan.html) _(7 state)_ | nhân viên rà nội dung rồi chuyển máy cho khách (S-042). Mã: VH §16, A-01 (M1 tổng thể; M2 tuỳ chọn; M3 chưa vẽ). | [<img src="screenshots/S-058-giao-khach-xac-nhan.light.png" width="150">](screenshots/S-058-giao-khach-xac-nhan.light.png) | [<img src="screenshots/S-058-giao-khach-xac-nhan.dark.png" width="150">](screenshots/S-058-giao-khach-xac-nhan.dark.png) |
| **S-059**<br>Giao xe · B8 Rà soát & hoàn tất<br>[html](screens/S-059-giao-ra-soat-hoan-tat.html) _(6 state)_ | Rà soát 6 mục trước khi hoàn tất (all-or-nothing), checkbox đã ký hợp đồng giấy, hộp thoại xác nhận. | [<img src="screenshots/S-059-giao-ra-soat-hoan-tat.light.png" width="150">](screenshots/S-059-giao-ra-soat-hoan-tat.light.png) | [<img src="screenshots/S-059-giao-ra-soat-hoan-tat.dark.png" width="150">](screenshots/S-059-giao-ra-soat-hoan-tat.dark.png) |
| **S-060**<br>Hoàn tất giao xe<br>[html](screens/S-060-giao-hoan-tat.html) _(5 state)_ | Màn thành công giao xe: trạng thái mới, hạn trả dự kiến theo khung 21:00, CTA Chia sẻ cho khách / Về Hôm nay. | [<img src="screenshots/S-060-giao-hoan-tat.light.png" width="150">](screenshots/S-060-giao-hoan-tat.light.png) | [<img src="screenshots/S-060-giao-hoan-tat.dark.png" width="150">](screenshots/S-060-giao-hoan-tat.dark.png) |
| **S-061**<br>Xem lại Giao xe (chỉ đọc)<br>[html](screens/S-061-giao-xem-lai.html) _(4 state)_ | Xem lại phiên Giao xe ở chế độ chỉ đọc (số liệu, ảnh, checklist, thu tiền, xác nhận, nhật ký, lịch sử chia sẻ). | [<img src="screenshots/S-061-giao-xem-lai.light.png" width="150">](screenshots/S-061-giao-xem-lai.light.png) | [<img src="screenshots/S-061-giao-xem-lai.dark.png" width="150">](screenshots/S-061-giao-xem-lai.dark.png) |
| **S-062**<br>Giao xe · Thoát · Tạm dừng · Huỷ nháp<br>[html](screens/S-062-giao-thoat-tam-dung.html) _(6 state)_ | Sheet thoát wizard: Tiếp tục làm / Tạm dừng / Huỷ nháp (viền đỏ, lý do bắt buộc). | [<img src="screenshots/S-062-giao-thoat-tam-dung.light.png" width="150">](screenshots/S-062-giao-thoat-tam-dung.light.png) | [<img src="screenshots/S-062-giao-thoat-tam-dung.dark.png" width="150">](screenshots/S-062-giao-thoat-tam-dung.dark.png) |

### Giai đoạn 6 — Wizard Nhận xe (VR)

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD6-nhan-xe-flow.md](flows/GD6-nhan-xe-flow.md). 19 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-070**<br>Nhận xe · Kiểm tra tiền điều kiện & nạp Handover<br>[html](screens/S-070-nhan-xe-tien-dieu-kien.html) _(9 state)_ | chặn sớm việc không hợp lệ, nạp dữ liệu Handover làm mốc đối chiếu. Mã: VR §8, VR-BR-02/06/19, CR-2026-055. | [<img src="screenshots/S-070-nhan-xe-tien-dieu-kien.light.png" width="150">](screenshots/S-070-nhan-xe-tien-dieu-kien.light.png) | [<img src="screenshots/S-070-nhan-xe-tien-dieu-kien.dark.png" width="150">](screenshots/S-070-nhan-xe-tien-dieu-kien.dark.png) |
| **S-071**<br>Nhận xe · Khung wizard & Tổng quan phiên<br>[html](screens/S-071-nhan-xe-tong-quan.html) _(4 state)_ | biết đang ở đâu, thiếu gì, nhảy bước (A-04). Bố cục: thẻ tiến độ chứng cứ (ảnh x/20, checklist x/7), 10 hàng bước (✓ Xong / ! Cần xử lý / Thiếu / Chưa làm + chevron),… | [<img src="screenshots/S-071-nhan-xe-tong-quan.light.png" width="150">](screenshots/S-071-nhan-xe-tong-quan.light.png) | [<img src="screenshots/S-071-nhan-xe-tong-quan.dark.png" width="150">](screenshots/S-071-nhan-xe-tong-quan.dark.png) |
| **S-072**<br>Nhận xe · R2 Số liệu nhận (giờ · odo · nhiên liệu)<br>[html](screens/S-072-nhan-xe-so-lieu.html) _(6 state)_ | ghi giờ trả, odo, vạch nhiên liệu + ảnh đồng hồ; tính sơ bộ. VR §10, VR-BR-03/04/05, CR-2026-023/054. | [<img src="screenshots/S-072-nhan-xe-so-lieu.light.png" width="150">](screenshots/S-072-nhan-xe-so-lieu.light.png) | [<img src="screenshots/S-072-nhan-xe-so-lieu.dark.png" width="150">](screenshots/S-072-nhan-xe-so-lieu.dark.png) |
| **S-073**<br>Nhận xe · R3 Bộ ảnh nhận (có ảnh Handover làm tham chiếu)<br>[html](screens/S-073-nhan-xe-bo-anh.html) _(5 state)_ | Bộ ảnh nhận xe: lưới ô có ảnh lúc giao cùng góc làm tham chiếu, nhiều trạng thái ô, video tuỳ chọn. | [<img src="screenshots/S-073-nhan-xe-bo-anh.light.png" width="150">](screenshots/S-073-nhan-xe-bo-anh.light.png) | [<img src="screenshots/S-073-nhan-xe-bo-anh.dark.png" width="150">](screenshots/S-073-nhan-xe-bo-anh.dark.png) |
| **S-074**<br>Nhận xe · R4 Đối chiếu trước/sau<br>[html](screens/S-074-nhan-xe-doi-chieu.html) _(7 state)_ | Đối chiếu trước/sau: bảng Giao → Nhận, cặp ảnh từng khác biệt, phân loại Đã có sẵn / Phát sinh mới. | [<img src="screenshots/S-074-nhan-xe-doi-chieu.light.png" width="150">](screenshots/S-074-nhan-xe-doi-chieu.light.png) | [<img src="screenshots/S-074-nhan-xe-doi-chieu.dark.png" width="150">](screenshots/S-074-nhan-xe-doi-chieu.dark.png) |
| **S-075**<br>Nhận xe · R5 Sự cố phát sinh<br>[html](screens/S-075-nhan-xe-su-co.html) _(4 state)_ | Danh sách sự cố phát sinh khi nhận xe, thêm/sửa/xoá, chi phí dự kiến, cảnh báo xe chuyển Bảo dưỡng. | [<img src="screenshots/S-075-nhan-xe-su-co.light.png" width="150">](screenshots/S-075-nhan-xe-su-co.light.png) | [<img src="screenshots/S-075-nhan-xe-su-co.dark.png" width="150">](screenshots/S-075-nhan-xe-su-co.dark.png) |
| **S-076**<br>Nhận xe · R5b Sự cố nặng / tai nạn / ảnh hưởng an toàn<br>[html](screens/S-076-nhan-xe-su-co-nang.html) _(3 state)_ | Sự cố nặng / tai nạn: diễn biến, bên thứ ba, biên bản, bảo hiểm; nhân viên không nhập trách nhiệm/bồi thường. | [<img src="screenshots/S-076-nhan-xe-su-co-nang.light.png" width="150">](screenshots/S-076-nhan-xe-su-co-nang.light.png) | [<img src="screenshots/S-076-nhan-xe-su-co-nang.dark.png" width="150">](screenshots/S-076-nhan-xe-su-co-nang.dark.png) |
| **S-077**<br>Nhận xe · R5c Yêu cầu Manager duyệt phí hư hỏng nhẹ<br>[html](screens/S-077-nhan-xe-duyet-phi-nhe.html) _(6 state)_ | Gửi Manager duyệt phí hư hỏng nhẹ với chip Chờ duyệt / Đã duyệt / Từ chối; không chặn hoàn tất. | [<img src="screenshots/S-077-nhan-xe-duyet-phi-nhe.light.png" width="150">](screenshots/S-077-nhan-xe-duyet-phi-nhe.light.png) | [<img src="screenshots/S-077-nhan-xe-duyet-phi-nhe.dark.png" width="150">](screenshots/S-077-nhan-xe-duyet-phi-nhe.dark.png) |
| **S-078**<br>Nhận xe · R6 Return Checklist<br>[html](screens/S-078-nhan-xe-checklist.html) _(4 state)_ | Return Checklist: Đủ / Thiếu / Hỏng / Không áp dụng cho từng mục sinh từ Handover; Thiếu/Hỏng yêu cầu chi phí. | [<img src="screenshots/S-078-nhan-xe-checklist.light.png" width="150">](screenshots/S-078-nhan-xe-checklist.light.png) | [<img src="screenshots/S-078-nhan-xe-checklist.dark.png" width="150">](screenshots/S-078-nhan-xe-checklist.dark.png) |
| **S-079**<br>Nhận xe · R7a VETC nhập tay<br>[html](screens/S-079-nhan-xe-vetc.html) _(4 state)_ | Nhập tay khoản VETC (số tiền, thời gian, trạm, ảnh); cảnh báo khi ngoài khoảng thuê và bắt buộc lý do. | [<img src="screenshots/S-079-nhan-xe-vetc.light.png" width="150">](screenshots/S-079-nhan-xe-vetc.light.png) | [<img src="screenshots/S-079-nhan-xe-vetc.dark.png" width="150">](screenshots/S-079-nhan-xe-vetc.dark.png) |
| **S-080**<br>Nhận xe · R7b Phạt nguội nhập tay<br>[html](screens/S-080-nhan-xe-phat-nguoi.html) _(4 state)_ | Nhập tay phạt nguội (biển, thời gian, địa điểm, nội dung, tiền); gợi ý liên kết Rental trong khoảng thuê. | [<img src="screenshots/S-080-nhan-xe-phat-nguoi.light.png" width="150">](screenshots/S-080-nhan-xe-phat-nguoi.light.png) | [<img src="screenshots/S-080-nhan-xe-phat-nguoi.dark.png" width="150">](screenshots/S-080-nhan-xe-phat-nguoi.dark.png) |
| **S-081**<br>Nhận xe · R8 Bảng ước tính phát sinh<br>[html](screens/S-081-nhan-xe-uoc-tinh.html) _(6 state)_ | Bảng ước tính phát sinh (nhãn Ước tính — quản lý chốt ở quyết toán); không hiển thị tiền thuê/cọc. | [<img src="screenshots/S-081-nhan-xe-uoc-tinh.light.png" width="150">](screenshots/S-081-nhan-xe-uoc-tinh.light.png) | [<img src="screenshots/S-081-nhan-xe-uoc-tinh.dark.png" width="150">](screenshots/S-081-nhan-xe-uoc-tinh.dark.png) |
| **S-082**<br>Nhận xe · R8b Nhập phí nhiên liệu & phí giao/nhận tận nơi<br>[html](screens/S-082-nhan-xe-nhien-lieu-tan-noi.html) _(6 state)_ | Bottom sheet nhập phí nhiên liệu (số vạch thiếu tự tính) và phí giao/nhận tận nơi (tổng km nhập tay). | [<img src="screenshots/S-082-nhan-xe-nhien-lieu-tan-noi.light.png" width="150">](screenshots/S-082-nhan-xe-nhien-lieu-tan-noi.light.png) | [<img src="screenshots/S-082-nhan-xe-nhien-lieu-tan-noi.dark.png" width="150">](screenshots/S-082-nhan-xe-nhien-lieu-tan-noi.dark.png) |
| **S-083**<br>Nhận xe · R8c Thu khoản phát sinh tại chỗ (tuỳ chọn)<br>[html](screens/S-083-nhan-xe-thu-phat-sinh.html) _(4 state)_ | Thu khoản phát sinh tại chỗ bằng QR — mức Could, sau cờ cấu hình. | [<img src="screenshots/S-083-nhan-xe-thu-phat-sinh.light.png" width="150">](screenshots/S-083-nhan-xe-thu-phat-sinh.light.png) | [<img src="screenshots/S-083-nhan-xe-thu-phat-sinh.dark.png" width="150">](screenshots/S-083-nhan-xe-thu-phat-sinh.dark.png) |
| **S-084**<br>Nhận xe · R9 Khách xác nhận (đồng ý / bảo lưu / từ chối)<br>[html](screens/S-084-nhan-xe-khach-xac-nhan.html) _(6 state)_ | Màn cho khách xác nhận khi nhận xe: đồng ý / đồng ý + ký / bảo lưu / từ chối; dữ liệu đổi thì xác nhận cũ bị huỷ. | [<img src="screenshots/S-084-nhan-xe-khach-xac-nhan.light.png" width="150">](screenshots/S-084-nhan-xe-khach-xac-nhan.light.png) | [<img src="screenshots/S-084-nhan-xe-khach-xac-nhan.dark.png" width="150">](screenshots/S-084-nhan-xe-khach-xac-nhan.dark.png) |
| **S-085**<br>Nhận xe · R10 Rà soát & hoàn tất<br>[html](screens/S-085-nhan-xe-ra-soat.html) _(6 state)_ | Rà soát 8 mục, hộp thoại xác nhận, nhắc không sửa được sau hoàn tất. | [<img src="screenshots/S-085-nhan-xe-ra-soat.light.png" width="150">](screenshots/S-085-nhan-xe-ra-soat.light.png) | [<img src="screenshots/S-085-nhan-xe-ra-soat.dark.png" width="150">](screenshots/S-085-nhan-xe-ra-soat.dark.png) |
| **S-086**<br>Nhận xe · Hoàn tất<br>[html](screens/S-086-nhan-xe-hoan-tat.html) _(4 state)_ | Màn thành công nhận xe với copy trung tính về quyết toán, trạng thái xe, CTA Chia sẻ (kèm ảnh so sánh). | [<img src="screenshots/S-086-nhan-xe-hoan-tat.light.png" width="150">](screenshots/S-086-nhan-xe-hoan-tat.light.png) | [<img src="screenshots/S-086-nhan-xe-hoan-tat.dark.png" width="150">](screenshots/S-086-nhan-xe-hoan-tat.dark.png) |
| **S-087**<br>Nhận xe · Đối chiếu & trả xe máy cọc<br>[html](screens/S-087-nhan-xe-xe-may-coc.html) _(5 state)_ | Đối chiếu và trả xe máy thế chân; nút trả khoá tới khi khách thanh toán xong phát sinh. | [<img src="screenshots/S-087-nhan-xe-xe-may-coc.light.png" width="150">](screenshots/S-087-nhan-xe-xe-may-coc.light.png) | [<img src="screenshots/S-087-nhan-xe-xe-may-coc.dark.png" width="150">](screenshots/S-087-nhan-xe-xe-may-coc.dark.png) |
| **S-088**<br>Nhận xe · Xem lại (chỉ đọc)<br>[html](screens/S-088-nhan-xe-xem-lai.html) _(5 state)_ | Xem lại phiên Nhận xe ở chế độ chỉ đọc, 8 nhóm thông tin, Chia sẻ lại cho khách. | [<img src="screenshots/S-088-nhan-xe-xem-lai.light.png" width="150">](screenshots/S-088-nhan-xe-xem-lai.light.png) | [<img src="screenshots/S-088-nhan-xe-xem-lai.dark.png" width="150">](screenshots/S-088-nhan-xe-xem-lai.dark.png) |

### Giai đoạn 7 — Ngoại lệ, chặn nghiệp vụ & tình huống hiện trường

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD7-GD8-flow.md](flows/GD7-GD8-flow.md). 10 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-090**<br>Khách không đến / trễ hẹn<br>[html](screens/S-090-khach-khong-den.html) _(5 state)_ | Ghi nhận khách trễ hoặc no-show tại điểm giao, báo điều phối; KHÔNG hoàn tất Handover. | [<img src="screenshots/S-090-khach-khong-den.light.png" width="150">](screenshots/S-090-khach-khong-den.light.png) | [<img src="screenshots/S-090-khach-khong-den.dark.png" width="150">](screenshots/S-090-khach-khong-den.dark.png) |
| **S-091**<br>Khách không trả mốc giao xe<br>[html](screens/S-091-khach-khong-tra-tien.html) _(6 state)_ | Khách không thể thanh toán 70% Base Rental + Security Deposit → không giao xe, báo điều phối hoãn/huỷ, KHÔNG ghi nợ. | [<img src="screenshots/S-091-khach-khong-tra-tien.light.png" width="150">](screenshots/S-091-khach-khong-tra-tien.light.png) | [<img src="screenshots/S-091-khach-khong-tra-tien.dark.png" width="150">](screenshots/S-091-khach-khong-tra-tien.dark.png) |
| **S-092**<br>Xe không đạt để giao<br>[html](screens/S-092-xe-khong-dat.html) _(5 state)_ | Báo Manager xe không đạt (hư hỏng nặng/bẩn/thiếu phụ kiện/đèn báo lỗi) và hiển thị quyết định. | [<img src="screenshots/S-092-xe-khong-dat.light.png" width="150">](screenshots/S-092-xe-khong-dat.light.png) | [<img src="screenshots/S-092-xe-khong-dat.dark.png" width="150">](screenshots/S-092-xe-khong-dat.dark.png) |
| **S-093**<br>Xin ngoại lệ thiếu ảnh<br>[html](screens/S-093-ngoai-le-thieu-anh.html) _(5 state)_ | Ghi lý do không chụp được một góc ảnh bắt buộc và xin Manager/Admin duyệt. | [<img src="screenshots/S-093-ngoai-le-thieu-anh.light.png" width="150">](screenshots/S-093-ngoai-le-thieu-anh.light.png) | [<img src="screenshots/S-093-ngoai-le-thieu-anh.dark.png" width="150">](screenshots/S-093-ngoai-le-thieu-anh.dark.png) |
| **S-094**<br>Cảnh báo / chặn ODO – nhiên liệu bất thường<br>[html](screens/S-094-canh-bao-odo-nhien-lieu.html) _(5 state)_ | Phân biệt rõ CẢNH BÁO (Giao: vàng, không chặn) và CHẶN CỨNG (Nhận: đỏ). | [<img src="screenshots/S-094-canh-bao-odo-nhien-lieu.light.png" width="150">](screenshots/S-094-canh-bao-odo-nhien-lieu.light.png) | [<img src="screenshots/S-094-canh-bao-odo-nhien-lieu.dark.png" width="150">](screenshots/S-094-canh-bao-odo-nhien-lieu.dark.png) |
| **S-095**<br>Không được phân công<br>[html](screens/S-095-khong-duoc-phan-cong.html) _(3 state)_ | Chặn cứng khi người dùng không phải người được phân công (và không phải Manager/Admin). | [<img src="screenshots/S-095-khong-duoc-phan-cong.light.png" width="150">](screenshots/S-095-khong-duoc-phan-cong.light.png) | [<img src="screenshots/S-095-khong-duoc-phan-cong.dark.png" width="150">](screenshots/S-095-khong-duoc-phan-cong.dark.png) |
| **S-096**<br>Việc đã đổi / huỷ khi đang làm<br>[html](screens/S-096-viec-doi-huy-khi-dang-lam.html) _(4 state)_ | Xử lý khi Rental bị huỷ / đổi giờ / đổi người trong lúc nhân viên đang ở phiên. | [<img src="screenshots/S-096-viec-doi-huy-khi-dang-lam.light.png" width="150">](screenshots/S-096-viec-doi-huy-khi-dang-lam.light.png) | [<img src="screenshots/S-096-viec-doi-huy-khi-dang-lam.dark.png" width="150">](screenshots/S-096-viec-doi-huy-khi-dang-lam.dark.png) |
| **S-097**<br>Việc thay thế / gián đoạn lượt thuê<br>[html](screens/S-097-viec-thay-the-gian-doan.html) _(3 state)_ | Hiển thị liên kết “Giao xe thay thế” ↔ “Nhận xe cũ”, xe hỏng trước giao, kết thúc sớm. | [<img src="screenshots/S-097-viec-thay-the-gian-doan.light.png" width="150">](screenshots/S-097-viec-thay-the-gian-doan.light.png) | [<img src="screenshots/S-097-viec-thay-the-gian-doan.dark.png" width="150">](screenshots/S-097-viec-thay-the-gian-doan.dark.png) |
| **S-098**<br>Mất mạng giữa phiên<br>[html](screens/S-098-mat-mang-giua-phien.html) _(4 state)_ | Phase 1 online-only: cảnh báo + tạm dừng + giữ dữ liệu + Thử lại; KHÔNG có hàng đợi. | [<img src="screenshots/S-098-mat-mang-giua-phien.light.png" width="150">](screenshots/S-098-mat-mang-giua-phien.light.png) | [<img src="screenshots/S-098-mat-mang-giua-phien.dark.png" width="150">](screenshots/S-098-mat-mang-giua-phien.dark.png) |
| **S-099**<br>Tải ảnh / video thất bại<br>[html](screens/S-099-tai-anh-that-bai.html) _(4 state)_ | Danh sách tệp lỗi, thử lại từng tệp/tất cả; chặn hoàn tất tới khi đủ. | [<img src="screenshots/S-099-tai-anh-that-bai.light.png" width="150">](screenshots/S-099-tai-anh-that-bai.light.png) | [<img src="screenshots/S-099-tai-anh-that-bai.dark.png" width="150">](screenshots/S-099-tai-anh-that-bai.dark.png) |

### Giai đoạn 8 — Hồ sơ, cài đặt, nhật ký & trạng thái hệ thống

Chi tiết từng màn (mục đích, bố cục, tương tác, state, edge case, quyền, a11y, mã nghiệp vụ): [flows/GD7-GD8-flow.md](flows/GD7-GD8-flow.md). 9 trang mockup.

| Màn | Mô tả UI/UX | Light | Dark |
| --- | --- | --- | --- |
| **S-110**<br>Tài khoản (tab 4)<br>[html](screens/S-110-tai-khoan.html) _(5 state)_ | Hồ sơ cá nhân + lối vào cài đặt. KHÔNG có đăng ký nghỉ. | [<img src="screenshots/S-110-tai-khoan.light.png" width="150">](screenshots/S-110-tai-khoan.light.png) | [<img src="screenshots/S-110-tai-khoan.dark.png" width="150">](screenshots/S-110-tai-khoan.dark.png) |
| **S-111**<br>Giao diện (Light / Dark / Theo hệ thống)<br>[html](screens/S-111-giao-dien.html) _(3 state)_ | Chọn chế độ hiển thị; xem trước ngay. | [<img src="screenshots/S-111-giao-dien.light.png" width="150">](screenshots/S-111-giao-dien.light.png) | [<img src="screenshots/S-111-giao-dien.dark.png" width="150">](screenshots/S-111-giao-dien.dark.png) |
| **S-112**<br>Đổi mật khẩu<br>[html](screens/S-112-doi-mat-khau.html) _(7 state)_ | Người dùng đổi mật khẩu của mình. | [<img src="screenshots/S-112-doi-mat-khau.light.png" width="150">](screenshots/S-112-doi-mat-khau.light.png) | [<img src="screenshots/S-112-doi-mat-khau.dark.png" width="150">](screenshots/S-112-doi-mat-khau.dark.png) |
| **S-113**<br>Nhật ký thao tác của tôi<br>[html](screens/S-113-nhat-ky-thao-tac.html) _(6 state)_ | Xem thao tác giao/nhận của chính mình. | [<img src="screenshots/S-113-nhat-ky-thao-tac.light.png" width="150">](screenshots/S-113-nhat-ky-thao-tac.light.png) | [<img src="screenshots/S-113-nhat-ky-thao-tac.dark.png" width="150">](screenshots/S-113-nhat-ky-thao-tac.dark.png) |
| **S-114**<br>Chi tiết bản ghi nhật ký<br>[html](screens/S-114-chi-tiet-nhat-ky.html) _(3 state)_ | Xem một bản ghi: hành động, thời gian, nguồn, giá trị cũ/mới, lý do. | [<img src="screenshots/S-114-chi-tiet-nhat-ky.light.png" width="150">](screenshots/S-114-chi-tiet-nhat-ky.light.png) | [<img src="screenshots/S-114-chi-tiet-nhat-ky.dark.png" width="150">](screenshots/S-114-chi-tiet-nhat-ky.dark.png) |
| **S-115**<br>Giới thiệu & hỗ trợ<br>[html](screens/S-115-gioi-thieu-ho-tro.html) _(1 state)_ | Phiên bản, liên hệ điều phối, điều khoản/riêng tư, sao chép thông tin báo lỗi. | [<img src="screenshots/S-115-gioi-thieu-ho-tro.light.png" width="150">](screenshots/S-115-gioi-thieu-ho-tro.light.png) | [<img src="screenshots/S-115-gioi-thieu-ho-tro.dark.png" width="150">](screenshots/S-115-gioi-thieu-ho-tro.dark.png) |
| **S-116**<br>Đăng xuất<br>[html](screens/S-116-dang-xuat.html) _(3 state)_ | Xác nhận đăng xuất; cảnh báo khi còn phiên dở. | [<img src="screenshots/S-116-dang-xuat.light.png" width="150">](screenshots/S-116-dang-xuat.light.png) | [<img src="screenshots/S-116-dang-xuat.dark.png" width="150">](screenshots/S-116-dang-xuat.dark.png) |
| **S-120**<br>Trạng thái hệ thống<br>[html](screens/S-120-trang-thai-he-thong.html) _(5 state)_ | Ba màn toàn trang cấp hệ thống: S-120 không mạng khi mở app, S-121 lỗi máy chủ/timeout, S-122 bảo trì / bắt buộc cập nhật. | [<img src="screenshots/S-120-trang-thai-he-thong.light.png" width="150">](screenshots/S-120-trang-thai-he-thong.light.png) | [<img src="screenshots/S-120-trang-thai-he-thong.dark.png" width="150">](screenshots/S-120-trang-thai-he-thong.dark.png) |
| **S-123**<br>Danh mục Empty state<br>[html](screens/S-123-empty-states.html) | Danh mục empty state thống nhất minh hoạ và copy cho các màn rỗng. | [<img src="screenshots/S-123-empty-states.light.png" width="150">](screenshots/S-123-empty-states.light.png) | [<img src="screenshots/S-123-empty-states.dark.png" width="150">](screenshots/S-123-empty-states.dark.png) |


---

## (e) Ma trận màn × luồng

Luồng: **F1** Đăng nhập/tài khoản · **F2** Việc trong ngày · **F3** Giao xe · **F4** Nhận xe · **F5** Hư hỏng/sự cố · **F6** Thu tiền theo mốc · **F7** Khách xác nhận & chia sẻ · **F8** Thông báo · **F9** Cài đặt/hệ thống. `●` chủ đạo · `○` dùng lại/đi qua.

| Màn | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| S-001…S-007 (Design System, khung) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ● |
| S-010, S-011, S-013, S-014, S-124 | ● | | | | | | | | ○ |
| S-012, S-015 | ● | | | | | | | | |
| S-020, S-021, S-022, S-026 | | ● | ○ | ○ | | | | ○ | |
| S-023 | | ● | | | | | | ○ | |
| S-024, S-025 | | ○ | | | | | | ● | |
| S-030, S-031, S-032, S-033, S-034 (media) | | | ● | ● | ○ | | | | ○ |
| S-035, S-036 (sơ đồ xe, form hư hỏng) | | | ○ | ○ | ● | | | | |
| S-037, S-038 (Lịch sử hiện trạng xe) | | | ● | ● | ○ | | | | |
| S-039, S-040, S-041 (thu tiền) | | | ● | ○ | | ● | | | |
| S-042, S-043, S-044, S-045 (khách xác nhận) | | | ● | ● | | | ● | | |
| S-046 (chia sẻ) | | | ● | ● | | | ● | | |
| S-050…S-062 (Giao xe) | | ○ | ● | | ○ | ● | ● | | |
| S-070…S-088 (Nhận xe) | | ○ | | ● | ● | ○ | ● | | |
| S-090…S-099 (ngoại lệ) | | ○ | ● | ● | ○ | ○ | | ○ | ● |
| S-110…S-116 | ● | | | | | | | | ● |
| S-120…S-123 (trạng thái hệ thống) | | ○ | ○ | ○ | | | | ○ | ● |

Phủ yêu cầu của dự án (kiểm tra): đăng nhập/đổi MK (S-010/011/112) · tab bar + việc trong ngày (S-007/020/021) · chi tiết việc (S-022) · wizard Giao (S-050…062) · wizard Nhận (S-070…088) · hư hỏng/sự cố (S-035/036/075/076) · chụp ảnh/video (S-030…034) · ký/xác nhận (S-042…045, S-058, S-084) · thu tiền/QR (S-039…041, S-057, S-083) · lịch sử hiện trạng rút gọn (S-037/038) · chia sẻ Zalo (S-046) · thông báo (S-024/025) · hồ sơ/cài đặt Light/Dark/System (S-110/111) · mất mạng (S-098/120) · empty/error (S-123 + cột trạng thái) · Design System (S-001…006).

---

## (f) A11y & contrast — tổng kết

Đo trên `S-001`, quy tắc trong [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) §6.

| Hạng mục | Kết quả |
| --- | --- |
| Text trên nền (Light & Dark, mọi cặp semantic) | Đạt AA ≥ 4.5:1. Dark `text-tertiary #94A3B8`: 7.30 (canvas) · 6.23 (surface) · 5.63 (raised) · 6.66 (bg-subtle). |
| `text-tertiary` Light `#64748B` | Canvas 4.55 · surface 4.76 — đạt; **trên `bg-subtle` chỉ 4.34:1 → không đặt `text-tertiary` trên `bg-subtle` ở Light** (dùng `text-secondary`). |
| Cặp status (text/bg) | Mọi cặp ≥ 4.5:1 ở cả hai theme; `text-inverse` trên `status-danger` ≥ 6.4. |
| **Viền `border-strong` Light** | `#94A3B8` trên canvas = **2.45:1 < 3:1** (WCAG 1.4.11) — viền ô nhập / checkbox / ô ảnh. **Chưa đạt**; đề xuất đổi ≈ `#64748B` (4.76:1) — xem [OI-16](notes/OPEN-ITEMS.md). |
| Disabled | `action-disabled-text` 3.86 (Light) / 4.04 (Dark): miễn trừ WCAG, nhưng không là kênh duy nhất — luôn có `cta-hint` giải thích lý do khoá. |
| Vùng chạm | ≥ 48×48dp (tab 56, hàng danh sách ≥ 56); ngoại lệ chỉ cho phần tử không bấm (`.chip.sm`, badge). Lưới ô ảnh ≥ 96dp cao. |
| Không chỉ dùng màu | Trạng thái = màu + icon + chữ (badge, banner, field error); đã chọn = màu + dấu ✓/chấm. |
| Chữ | Thông tin bắt buộc ≥ 14px; caption 12px chỉ cho nhãn phụ. |
| Screen reader | Icon-only button có `aria-label`; lỗi `role="alert"`, trạng thái `role="status"`, đếm ngược `role="timer"`, switch `role="switch"`; spinner có nhãn chữ; shimmer tắt khi reduce-motion. |
| Ngoại lệ đã chấp nhận | Khung QR nền trắng / chữ đen cả ở Dark (để quét được). |
| Rà soát chéo giai đoạn 9 | 91 trang đều có ảnh Light + Dark; kiểm tra tồn tại ảnh bằng script (xem `README.md`). Việc rà soát hiển thị (state, 48dp, rò dữ liệu ẩn) do 2 QA agent thực hiện song song — kết quả ghi ở báo cáo QA, không lặp ở đây. |

---

## (g) Giả định BA tự đề xuất & điểm cần khách xác nhận

Nguồn: [`notes/ASSUMPTIONS.md`](notes/ASSUMPTIONS.md) (BA trả lời 25 câu `Q-01…Q-25` của [`notes/QUESTIONS.md`](notes/QUESTIONS.md)). **Tổng kết:** 1 câu `TÀI LIỆU ĐÃ CHỐT` hoàn toàn (Q-17) · 2 câu hỗn hợp (Q-05, Q-11) · 22 câu `BA TỰ ĐỀ XUẤT` — chưa phải quyết định của khách. Khi khách xác nhận / đổi một mục, BA mở CR (`ANSWER_OQ`) và cập nhật `ASSUMPTIONS.md`, designer cập nhật mockup.

### Danh sách điểm cần khách xác nhận lại (sắp theo mức ảnh hưởng)

Sắp theo mức ảnh hưởng tới thiết kế. Mức: **Chặn** = đổi cấu trúc luồng/màn; **Vừa**; **Nhẹ**. Cột "OQ gốc" là Open Question đang treo trong kho tài liệu mà câu trả lời này phụ thuộc vào.

| # | Mã | Mức | Điều cần khách xác nhận | Phương án BA đang giả định | OQ gốc |
| - | -- | --- | ----------------------- | -------------------------- | ------ |
| 1 | A-01 | Chặn | Mức xác nhận của khách Phase 1 (M0/M1/M2/M3); xác nhận tổng thể hay từng mục; Giao và Nhận có cùng mức không | M1 tổng thể cho cả hai wizard; M2 là tuỳ chọn cấu hình; M3 không làm (chưa có kênh SMS) | `VH §29` Q12–Q14; `AppStaff.md` §17.2 #9 |
| 2 | A-02 | Chặn | Danh sách góc ảnh bắt buộc, số ảnh/góc, video bắt buộc hay không, có phân biệt theo `Vehicle Class` | Lưới 12 ngoại thất + 7 nội thất, 1 ảnh/góc, video tuỳ chọn, cấu hình từ Webapp | `VH §29` Q5–Q8; `VR §32` Q4–Q6 |
| 3 | A-05 | Chặn | Cách thu mốc giao xe trong app: có tiền mặt không; khi chưa có webhook SePay nhân viên có được hoàn tất giao xe hay phải chờ kế toán; QR gộp hay tách; xử lý lệch tiền | QR VietQR động; **2 khoản tách riêng** (70% / Security Deposit); không tiền mặt trong luồng chính; hoàn tất khi giao dịch `CONFIRMED` hoặc nhân viên xác nhận kèm ảnh biên nhận (chờ kế toán) | `PM` §27; CR-2026-047/056/060 (còn treo: mô hình phí + baseline xác nhận tay) |
| 4 | A-04 | Chặn | Thứ tự các bước wizard có bắt buộc tuần tự không; thu tiền trước hay sau khi khách xác nhận | Nhảy bước tự do, hoàn tất bị chặn tới khi đủ bước bắt buộc; thu tiền **trước** khách xác nhận | Không có OQ riêng (tài liệu không cấm đổi thứ tự) |
| 5 | A-08 | Chặn | Lưu nháp/tiếp tục phiên: dữ liệu phiên dở lưu ở server hay trên máy; đổi máy giữa chừng | Server autosave từng bước + upload ảnh ngay; tiếp tục được từ Chi tiết việc, kể cả đổi máy | Không có OQ riêng (`VH-BR` chỉ nói "tạm dừng/tiếp tục") |
| 6 | A-07 | Vừa | Quy trình xin Manager duyệt phí hư hỏng nhẹ trong app; có chặn hoàn tất Return khi chưa duyệt không | Nút "Gửi Manager duyệt" + trạng thái; **không chặn** hoàn tất Return | `VR §32` Q26 (Manager hay chủ DN, ngưỡng tiền) |
| 7 | A-06 | Vừa | Khi nhận xe nhân viên có thu tiền tại chỗ không (phí tận nơi, phát sinh cọc xe máy) | Chỉ ước tính; thu QR phát sinh = "Could" sau cờ cấu hình | `VR §32` (thu khi nhận xe, Phase 1 chưa chốt cách thu) |
| 8 | A-12, A-13, A-22 | Vừa | Ngưỡng nhãn "Trễ" và `MISSED`; một Rental luôn 2 việc không; `MISSED` có còn Bắt đầu được không | "Trễ" > 15'; luôn 2 thẻ riêng; `MISSED` vẫn Bắt đầu được | `EA §26` Q7, Q13, Q16 |
| 9 | A-18 | Vừa | Thang vạch nhiên liệu tối đa theo dòng xe; xe điện/hybrid ghi thế nào | Max từ hồ sơ xe (mặc định 8); **xe điện chưa hỗ trợ** | Mới — chưa có OQ; cần mở khi khách có xe điện |
| 10 | A-03 | Vừa | Giới hạn media, GPS gắn media, retention | Video ≤ 60s, cảnh báo > 100MB, không gắn GPS | `VH §29` Q15–Q18 |
| 11 | A-15, A-16 | Vừa/Nhẹ | Nhân viên xem giấy tờ khách (CCCD/GPLX) ở mức nào; xem/in hợp đồng PDF + xác nhận đã ký giấy | Xem read-only, che số mặc định, audit mỗi lần xem; PDF read-only + checkbox "đã ký giấy" theo cấu hình | `CM`; `UC-VH-02` #6 (hợp đồng bắt buộc hay không — `VH §29` Q1) |
| 12 | A-11 | Vừa | `MANAGER`/`SYSTEM_ADMIN` có cần xem việc của người khác trên app không; vai trò khác đăng nhập app xử lý thế nào | Chỉ thấy việc gán cho mình; vai trò không dùng app bị chặn có thông điệp | Không có OQ riêng |
| 13 | A-10 | Nhẹ | Quên mật khẩu trên app: form gửi yêu cầu (link đặt lại) hay chỉ hướng dẫn liên hệ Admin; kênh gửi link (email/SMS) | Form yêu cầu theo Login Identifier **nếu** tài khoản có email đã đăng ký; luôn có đường dự phòng "liên hệ điều phối/Admin" | `SA` UC-SA-05 §9.4 + EX-01 (kênh gửi chưa chốt) |
| 14 | A-21, A-25 | Nhẹ | ODO giao < Current Odometer chặn hay cảnh báo; ngưỡng "lệch lớn" | Cảnh báo + ảnh odo + lý do; giờ > 30', ODO > 500 km, nhiên liệu ≥ 3 vạch | `VH-BR-07`; `VH EX-06` |
| 15 | A-23 | Nhẹ | Sau Nhận xe: Rental sang `SETTLEMENT` ngay hay dừng `RETURNED` | Copy trung tính không nêu trạng thái | `VR` UseCase §31 Q26; master §51 |
| 16 | A-09, A-14, A-24 | Nhẹ | Hộp thông báo (giữ bao lâu, phút nhắc trước), liên hệ/dẫn đường, thời hạn link chia sẻ | Xem từng dòng | `EA §26` (phút nhắc); `VH §29` Q19–Q21 |
| 17 | A-19, A-20 | Nhẹ | Màn hệ thống (bảo trì/cập nhật bắt buộc/5xx); nhận diện thương hiệu | Tối giản 3 biến thể; token xanh + logo "TBC" placeholder | Ngoài tài liệu nghiệp vụ |

### Mục mở bổ sung của designer

24 mục `OI-01…OI-24` (không trùng `A-nn`) — xem [`notes/OPEN-ITEMS.md`](notes/OPEN-ITEMS.md). Các mục ưu tiên **Cao**: OI-04 (đăng nhập hai máy / thu hồi phiên), OI-05 (hết phiên khi upload dở), OI-12 (khách không đồng ý: Giao chặn, Nhận cho hoàn tất), OI-16 (contrast `border-strong` Light).

---

## (h) Handoff cho dev React Native / Expo

### 1. Nguyên tắc
- HTML mockup là **tài liệu hình ảnh + hành vi**, không phải code tái sử dụng. Dựng lại bằng RN theo token và component dưới đây; kích thước tham chiếu 390×844 (iPhone 14) và 360×800 (Android nhỏ), đơn vị CSS px = dp.
- Online-only (CR-2026-058): không dựng hàng đợi đồng bộ; "mất mạng" = banner + tạm dừng + Thử lại (S-098/S-120). Dữ liệu phiên autosave server từng bước; ảnh upload ngay khi chụp (A-08).
- Mọi chuỗi trạng thái nghiệp vụ dùng đúng enum của tài liệu (`ASSIGNED`, `IN_PROGRESS`, `ELIGIBLE`/`NOT_ELIGIBLE`, `PENDING`/`CONFIRMED`…).

### 2. Map token → theme RN
Tạo `theme/tokens.ts` xuất hai object `light` và `dark` có cùng khoá; component chỉ đọc từ `useTheme()` (Context + `useColorScheme()` + lựa chọn người dùng S-111 lưu AsyncStorage: `system | light | dark`).

| Nhóm CSS token (`tokens/tokens.css`) | Khoá theme RN gợi ý | Ghi chú |
| --- | --- | --- |
| `--bg-canvas`, `--bg-subtle`, `--surface-default`, `--surface-raised` | `colors.bg.canvas/subtle`, `colors.surface.default/raised` | Nền màn / nhóm / thẻ / sheet. |
| `--text-primary/secondary/tertiary/disabled/inverse` | `colors.text.*` | Quy tắc contrast: xem (f). |
| `--border-default/strong/focus` | `colors.border.*` | `strong` Light cần chỉnh (OI-16). |
| `--action-primary`, `-text`, `-pressed`, `--action-disabled`, `-text` | `colors.action.*` | Nút chính / disabled. |
| `--status-success/warning/danger/info` và `-bg` | `colors.status.<tên>.fg/bg` | Badge, banner, field error; luôn kèm icon. |
| `--space-0…12` (0,4,8,12,16,20,24,32,40,48) | `space[0…12]` | Giữ thang; không số rời. |
| `--radius-sm/md/lg/xl/2xl/full` (6,10,14,20,24,9999) | `radius.*` | |
| `--elevation-card/dropdown/modal` | `elevation.*` | iOS `shadow*`, Android `elevation`. |
| `--font` | `fontFamily` | System (SF Pro / Roboto); số dùng `fontVariant: ['tabular-nums']`. |

Primitive (`--blue-600`…) **không** đưa vào component, chỉ nằm trong file tạo theme.

### 3. Danh sách component cần dựng (thứ tự đề xuất)

| Nhóm | Component RN | Dựa trên (mockup) |
| --- | --- | --- |
| Khung | `AppBar`, `TabBar` (4 tab + badge), `WizardHeader` (steps, progress), `CtaBar` (sticky đáy, `two`), `SafeScreen`, `OfflineBanner` | S-007, S-051 |
| Nhập liệu | `Button` (primary/secondary/ghost/danger/dangerSecondary, loading), `TextField` (+password, select, textarea), `OdoInput`, `NumStepper`, `Checkbox/Radio/Switch`, `Segmented`, `Chip` | S-002 |
| Phản hồi | `Badge` (luôn icon + chữ), `Banner`, `EmptyState`, `Skeleton`, `Toast`, `Dialog`, `BottomSheet`, `ProgressRing` | S-003, S-006, S-123 |
| Nghiệp vụ I | `TaskCard` (Giao/Nhận), `PlateTag`, `Money`, `InfoRow`, `StatusBadge` (Assignment, Session, Incident, Payment) | S-004, S-020, S-022 |
| Nghiệp vụ II | `PhotoSlot` (trống / đã chụp / đang tải / lỗi / mờ / ngoại lệ) + `PhotoGrid`, `FuelStepper`, `ConditionItem`, `TimelineItem`, `ComparePair`, `SignPad`, `QrCard` | S-005, S-034, S-054, S-057 |
| Thiết bị | `CameraScreen` (expo-camera), `PhotoPreview`, `VideoRecorder` (≤ 60 s), `PermissionGate` (S-033), `ShareSheet` (OS) | S-030…S-033, S-046 |
| Chế độ khách | `CustomerModeFrame` (dải "Chế độ khách hàng", chặn thoát, giữ 2 giây để nhận lại thiết bị) | S-042…S-045 |

Icon: chép cùng bộ Lucide (`lucide-react-native`); các icon mockup vẽ SVG inline thay thế xem OI-24.

### 4. Màn → route (gợi ý expo-router)
`(auth)/login, change-password, forgot, session-expired, blocked, wrong-role` · `(tabs)/today, upcoming, notifications, account` · `task/[id]` · `handover/[assignmentId]/(precheck|overview|odometer|photos|baseline|checklist|payment|ack|review|done|readonly)` · `return/[assignmentId]/(precheck|overview|odometer|photos|compare|incidents|checklist|tolls|estimate|ack|review|done|readonly)` · `camera/[slot]`, `photo/[id]`, `video`, `damage/new`, `history/[vehicleId]`, `share/[sessionId]` · `exceptions/*` · `account/(theme|password|audit|about|logout)` · `system/(offline|error|maintenance|update)`.

### 5. Lưu ý quyền & dữ liệu
- Nhân viên chỉ thấy việc gán cho mình; **không** thấy giá thuê, cọc, công nợ (ngoại trừ các khoản mốc giao xe cần thu ở S-039/S-057 và phát sinh ở bảng ước tính); lịch sử hiện trạng xe rút gọn **ẩn** `Liability`, mọi số tiền, `Insurance Claim`, `Dispute`, danh tính khách (CR-2026-052; `VH-BR-23`, `VR-BR-29`, `DI-BR-22`).
- Giấy tờ khách chỉ xem, mặc định che số, mỗi lần xem ghi audit (A-15). Hoàn tất giao / nhận **all-or-nothing** và không sửa được sau đó (`VH-BR-12`, `VR-BR-11`).
- Chế độ khách: ẩn mọi dữ liệu nội bộ, chặn điều hướng ra ngoài.
- Các giá trị minh hoạ cấu hình được (ngưỡng "Trễ" 15', lệch giờ 30', ODO 500 km, nhiên liệu 3 vạch, link chia sẻ 7 ngày, video ≤ 60 s / cảnh báo > 100 MB) lấy từ cấu hình server, không hardcode.

---

## (i) Tài liệu liên quan
[`PLAN.md`](PLAN.md) · [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) · [`flows/`](flows/) · [`notes/DOMAIN-SUMMARY.md`](notes/DOMAIN-SUMMARY.md) · [`notes/QUESTIONS.md`](notes/QUESTIONS.md) · [`notes/ASSUMPTIONS.md`](notes/ASSUMPTIONS.md) · [`notes/OPEN-ITEMS.md`](notes/OPEN-ITEMS.md) · [`index.html`](index.html) · [`prototype.html`](prototype.html) · [`README.md`](README.md).
