# Flow UI/UX — Giai đoạn 2 (Đăng nhập & tài khoản) + Giai đoạn 3 (Công việc trong ngày & thông báo)

> Designer · 29/10/2026 · Nguồn thiết kế: `screens/S-124…S-026` (Light + Dark) · Token: `tokens/tokens.css`, `components.css`, `components-gd2-3.css` (bổ sung riêng), icon bổ sung `icons-gd2-3.js`.
> Phase 1 **online-only** (CR-2026-058): không vẽ hàng đợi offline; mất mạng = dải cảnh báo + khoá thao tác ghi. Không OTP/2FA (CR-2026-034). Logo/tên app là placeholder (A-20).

## 1. Sơ đồ luồng

```text
Mở app
  └─ S-124 Khởi động (kiểm tra token)
       ├─ không mạng ................ S-124(O) ── Thử lại ──┐
       ├─ server lỗi ................ S-124(R) ── Thử lại ──┤
       ├─ không có/hết phiên ........ S-010 Đăng nhập        │
       └─ phiên còn hạn ............. (kiểm tra vai trò) ◄────┘
S-010 Đăng nhập ── Quên mật khẩu? ──► S-012 ──(Admin đặt MK tạm)──► quay lại S-010
   ├─ sai MK (còn n lần) ........ ở lại S-010 (R)
   ├─ LOCKED / DISABLED / nhân viên INACTIVE|SUSPENDED ► S-014 ► (gọi điều phối | về S-010)
   ├─ đăng nhập OK, vai trò DISPATCHER/SALES/ACCOUNTANT ► S-015 ► Đăng xuất
   ├─ đăng nhập OK, cờ "bắt buộc đổi MK" ► S-011 ► (lưu OK) ► TAB BAR
   └─ đăng nhập OK ► TAB BAR (Hôm nay)
Bất kỳ lúc nào token hết hạn ► S-013 (dialog) ► Đăng nhập lại ► quay đúng màn/bước đang làm (A-08)

TAB BAR (4 tab, badge số chưa đọc ở Thông báo — A-09)
 ├─ Hôm nay  S-020 ──chạm thẻ──► S-022 Chi tiết ──► [Bắt đầu/Tiếp tục] ► wizard Giao S-050 / Nhận S-070
 │                                  ├─ Xem lại (DONE) ► S-061 / S-088
 │                                  └─ Báo không nhận việc ► S-023 (sheet) ► quay S-022 (banner "đã báo")
 ├─ Sắp tới  S-021 [Sắp tới | Đã xong]  ── đoạn "Đã xong" = S-026 ► Xem lại ► S-061 / S-088
 ├─ Thông báo S-024 ──chạm──► S-025 ──Mở việc──► S-022
 └─ Tài khoản (GĐ 8)
```

## 2. Quyết định thiết kế chung
- Khung 390×844, kiểm tra co 360×800 (S-010, S-020, S-015). Tab bar 4 mục, nhãn luôn hiện; wizard ẩn tab bar (GĐ 5/6).
- Trạng thái luôn = màu + icon + chữ (badge/banner/field error). Nút chính (đầy) tối đa 1/màn; hành động phá/tách (Báo không nhận, Đăng xuất) dạng viền đỏ hoặc ghost, đặt xa CTA.
- Mất mạng: dải `.banner.offline` ngay dưới status bar; màn danh sách hiện dữ liệu lần tải cuối (chỉ đọc, có "Cập nhật lúc hh:mm") và khoá mọi nút ghi + giải thích bằng `cta-hint` (**đề xuất thiết kế**, xem Q-GĐ3-1).
- Không hiển thị giá/cọc/công nợ ở bất kỳ màn nào (EA-BR-17).
- Dữ liệu mẫu: biển số VN (51K-123.45…), khách (Nguyễn Văn An…), giờ 24h, ngày DD/MM/YYYY, SĐT, địa điểm TP.HCM.

## 3. Giai đoạn 2 — Đăng nhập & tài khoản vào app

### S-124 · Khởi động & kiểm tra phiên
File: `screens/S-124-khoi-dong.html` · Ảnh: ![S-124-khoi-dong Light](../screenshots/S-124-khoi-dong.light.png) ![S-124-khoi-dong Dark](../screenshots/S-124-khoi-dong.dark.png)

- **Mục đích:** Splash kiểm tra token để quyết định vào Đăng nhập hay vào thẳng Hôm nay.
- **Bố cục / thành phần:** Logo TBC placeholder + tên "Thiên Bảo Car — Nhân viên" + dòng trạng thái có spinner; chân trang phiên bản. Màn lỗi dùng khối `gate` (icon tròn, tiêu đề, mô tả, nút).
- **Hành vi / tương tác:** Tự chạy ≤ ~2 giây; không có thao tác. Lỗi → nút Thử lại (chính) + Gọi điều phối (viền). Offline tự thử lại khi có mạng.
- **Điều hướng vào → ra:** Vào: mở app / quay lại app. Ra: S-010 (không có phiên) · tab Hôm nay (phiên còn hạn, đúng vai trò) · S-015 (vai trò không dùng app).
- **State đã vẽ:** Loading · Phiên còn hạn · Lỗi server/timeout (R) · Không có Internet (O).
- **Edge case:** Token hết hạn lúc mở app → thẳng S-010 (không dialog S-013). Máy chủ chậm → hiện R sau timeout. Phiên còn hạn nhưng tài khoản đã bị LOCKED/DISABLED → S-014.
- **Quyền:** Mọi tài khoản nội bộ.
- **A11y:** Spinner có nhãn chữ; thông báo lỗi dùng `role=status` (offline banner).
- **Mã nghiệp vụ / giả định:** `SA` phiên/token; CR-2026-034; CR-2026-058; A-08, A-20.

### S-010 · Đăng nhập
File: `screens/S-010-dang-nhap.html` · Ảnh: ![S-010-dang-nhap Light](../screenshots/S-010-dang-nhap.light.png) ![S-010-dang-nhap Dark](../screenshots/S-010-dang-nhap.dark.png)

- **Mục đích:** Đăng nhập bằng tên đăng nhập (SĐT/email/username) + mật khẩu do Admin cấp.
- **Bố cục / thành phần:** Đầu trang: logo + tiêu đề + 1 câu hướng dẫn. Form: ô Tên đăng nhập, ô Mật khẩu (có nút mắt 44dp), checkbox "Ghi nhớ tên đăng nhập", nút Đăng nhập (full width), ghost "Quên mật khẩu?", chân trang "Cần kết nối Internet".
- **Hành vi / tương tác:** Mắt hiện/ẩn mật khẩu. "Ghi nhớ" chỉ lưu tên đăng nhập (không lưu mật khẩu). Validate tại chỗ (không khoảng trắng, không rỗng) trước khi gọi server; lỗi xác thực hiện banner **trung tính** "Sai tên đăng nhập hoặc mật khẩu" + số lần còn lại (không lộ trường nào sai, không lộ tài khoản có tồn tại). Đang đăng nhập: khoá form, nút giữ nhãn + spinner (`aria-busy`). Enter trên bàn phím = gửi.
- **Điều hướng vào → ra:** Vào: S-124, S-013(re-login), S-012, đăng xuất. Ra: tab Hôm nay | S-011 | S-014 | S-015 | S-012.
- **State đã vẽ:** Default · Đã nhập · Loading · Sai MK còn n lần (R) · Sai định dạng (R) · Offline · 360×800.
- **Edge case:** Sai quá N lần → S-014 (LOCKED) thay vì banner. Dán khoảng trắng đầu/cuối: tự cắt. Bàn phím che nút: form nằm trong vùng cuộn. Đăng nhập thành công ở máy mới khi phiên cũ còn → server quyết định (xem Q-GĐ2-4).
- **Quyền:** Công khai trước xác thực.
- **A11y:** Label luôn hiện; lỗi gắn field kèm icon + câu "gì + cách sửa"; banner `role=alert`; vùng chạm ≥ 48dp.
- **Mã nghiệp vụ / giả định:** CR-2026-034; SA-BR-01/07/08; A-10, A-20. N lần tối đa: giá trị minh hoạ "2 lần còn lại", ngưỡng thật do SA cấu hình.

### S-011 · Đổi mật khẩu bắt buộc lần đầu
File: `screens/S-011-doi-mat-khau-lan-dau.html` · Ảnh: ![S-011-doi-mat-khau-lan-dau Light](../screenshots/S-011-doi-mat-khau-lan-dau.light.png) ![S-011-doi-mat-khau-lan-dau Dark](../screenshots/S-011-doi-mat-khau-lan-dau.dark.png)

- **Mục đích:** Admin đặt cờ bắt buộc đổi: nhân viên phải đặt mật khẩu mới trước khi vào app.
- **Bố cục / thành phần:** App bar không có nút back; banner thông tin; 3 ô (MK hiện tại = MK tạm, MK mới, nhập lại); danh sách yêu cầu có icon ✓/✗ (màu + icon + chữ); CTA đáy "Lưu mật khẩu và vào app" + ghost Đăng xuất.
- **Hành vi / tương tác:** Checklist cập nhật theo thời gian thực khi gõ; CTA khoá tới khi mọi yêu cầu ✓ (kèm hint lý do). Lưu thành công → tự vào tab Hôm nay. Đăng xuất là lối ra duy nhất (không bỏ qua được).
- **Điều hướng vào → ra:** Vào: S-010 (cờ bắt buộc) hoặc sau khi Admin đặt MK tạm từ S-012. Ra: tab Hôm nay | S-010 (Đăng xuất).
- **State đã vẽ:** Default (CTA khoá) · Hợp lệ · Yếu/không khớp (R) · Trùng MK cũ (R) · Loading · Offline.
- **Edge case:** Thiết bị mất mạng giữa chừng: giữ nội dung đã nhập, CTA khoá. Phiên hết hạn khi đang ở màn này → S-013 rồi quay lại S-011. Server từ chối vì chính sách khác → hiện lỗi server dưới ô tương ứng.
- **Quyền:** Mọi tài khoản bị đánh dấu.
- **A11y:** Mỗi quy tắc có icon + chữ; lỗi `role=alert`.
- **Mã nghiệp vụ / giả định:** AppStaff.md §6.2; UC-SA-05; SA-BR-01; A-10. **Chính sách mật khẩu (độ dài, ký tự) chỉ minh hoạ** — Q-GĐ2-1.

### S-012 · Quên mật khẩu
File: `screens/S-012-quen-mat-khau.html` · Ảnh: ![S-012-quen-mat-khau Light](../screenshots/S-012-quen-mat-khau.light.png) ![S-012-quen-mat-khau Dark](../screenshots/S-012-quen-mat-khau.dark.png)

- **Mục đích:** Gửi yêu cầu đặt lại tới quản trị viên; luôn có đường gọi điều phối.
- **Bố cục / thành phần:** App bar có back; đoạn hướng dẫn; ô Tên đăng nhập; nút "Gửi yêu cầu đặt lại"; đường phân cách "hoặc"; thẻ "Liên hệ điều phối/Admin" với nút Gọi (số là placeholder).
- **Hành vi / tương tác:** Gửi → màn Đã gửi với thông điệp **trung tính** (không tiết lộ tài khoản có tồn tại), nút Về Đăng nhập. Nút Gọi mở trình quay số. Sau khi Admin đặt MK tạm, đăng nhập bằng MK tạm sẽ vào S-011.
- **Điều hướng vào → ra:** Vào: S-010. Ra: S-010.
- **State đã vẽ:** Default · Loading · Chưa nhập (R) · Gửi thất bại (R) · Đã gửi (V) · Offline.
- **Edge case:** Gửi nhiều lần: giới hạn tần suất do server (chưa vẽ, Q-GĐ2-3). Tài khoản LOCKED yêu cầu đặt lại: vẫn trung tính, Admin xử lý. Không có email → đường gọi điện là dự phòng chính.
- **Quyền:** Công khai.
- **A11y:** Thông điệp thành công `aria-live`; nút Gọi 48dp.
- **Mã nghiệp vụ / giả định:** UC-SA-05 §9.4 + EX-01; SA-BR-07; A-10 (⚑ kênh gửi link chưa chốt).

### S-013 · Phiên hết hạn
File: `screens/S-013-phien-het-han.html` · Ảnh: ![S-013-phien-het-han Light](../screenshots/S-013-phien-het-han.light.png) ![S-013-phien-het-han Dark](../screenshots/S-013-phien-het-han.dark.png)

- **Mục đích:** Báo hết phiên, đưa về đăng nhập lại mà không mất việc đang làm.
- **Bố cục / thành phần:** Dialog chặn (không đóng bằng chạm nền) phủ lên màn đang làm; màn Đăng nhập lại: tên đăng nhập khoá sẵn (icon khoá), banner nêu rõ việc/bước sẽ quay lại, mật khẩu, nút "Đăng nhập và tiếp tục", ghost "Dùng tài khoản khác".
- **Hành vi / tương tác:** Chỉ 1 nút "Đăng nhập lại". Sau đăng nhập đúng tài khoản → trở về **đúng bước** của wizard (dữ liệu autosave server — A-08). "Dùng tài khoản khác" → S-010; phiên dở vẫn nằm trên server, tài khoản khác không thấy (EA-BR-17).
- **Điều hướng vào → ra:** Vào: bất kỳ màn khi API trả 401. Ra: màn trước đó/bước trước đó | S-010.
- **State đã vẽ:** Giữa wizard · Ở tab thường · Màn đăng nhập lại.
- **Edge case:** Hết hạn đúng lúc đang chụp/upload: ảnh đã upload giữ, ảnh đang gửi dở có thể phải chụp lại (Q-GĐ2-5). Đổi sang tài khoản khác → cảnh báo bỏ phiên dở khỏi máy này.
- **Quyền:** Mọi phiên đăng nhập.
- **A11y:** Dialog `role=alertdialog` có tiêu đề; focus vào nút.
- **Mã nghiệp vụ / giả định:** AppStaff.md §6.2; CR-2026-058; A-08 (⚑ Q-08).

### S-014 · Tài khoản không đăng nhập được
File: `screens/S-014-tai-khoan-khong-dang-nhap-duoc.html` · Ảnh: ![S-014-tai-khoan-khong-dang-nhap-duoc Light](../screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.light.png) ![S-014-tai-khoan-khong-dang-nhap-duoc Dark](../screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.dark.png)

- **Mục đích:** Thông điệp riêng cho 4 trường hợp, luôn chỉ lối ra (gọi điều phối).
- **Bố cục / thành phần:** Khối `gate`: icon tròn (cảnh báo/lỗi) + tiêu đề + mô tả + badge mã trạng thái + 2 nút (Gọi điều phối chính, Về Đăng nhập viền).
- **Hành vi / tương tác:** 4 biến thể: LOCKED (sai quá N lần, chỉ Admin mở), DISABLED (tài khoản bị vô hiệu), nhân viên SUSPENDED (tạm ngưng), nhân viên INACTIVE (ngừng hoạt động). Không có tự mở khoá.
- **Điều hướng vào → ra:** Vào: S-010 / S-124. Ra: cuộc gọi | S-010.
- **State đã vẽ:** LOCKED · DISABLED · SUSPENDED · INACTIVE.
- **Edge case:** Rò thông tin: thông điệp phân biệt DISABLED/INACTIVE chỉ nên hiện **sau khi xác thực đúng mật khẩu**, còn sai mật khẩu vẫn dùng thông điệp trung tính (Q-GĐ2-2). Nhân viên `ON_LEAVE` vẫn đăng nhập được (không vẽ chặn).
- **Quyền:** Công khai/sau xác thực.
- **A11y:** Màu + icon + chữ + badge; nút 48dp.
- **Mã nghiệp vụ / giả định:** SA-BR-07; EA-BR-02; SA-BR-08 (audit mỗi lần bị chặn).

### S-015 · Vai trò không dùng app
File: `screens/S-015-vai-tro-khong-dung-app.html` · Ảnh: ![S-015-vai-tro-khong-dung-app Light](../screenshots/S-015-vai-tro-khong-dung-app.light.png) ![S-015-vai-tro-khong-dung-app Dark](../screenshots/S-015-vai-tro-khong-dung-app.dark.png)

- **Mục đích:** Chặn DISPATCHER/SALES/ACCOUNTANT sau khi đăng nhập thành công, thay vì cho vào màn rỗng.
- **Bố cục / thành phần:** Khối `gate` + thẻ danh tính (tên, vai trò, liên hệ) + nút Đăng xuất.
- **Hành vi / tương tác:** Chỉ có Đăng xuất. Mô tả nêu vai trò làm việc trên Webapp quản trị.
- **Điều hướng vào → ra:** Vào: S-010 / S-124. Ra: S-010.
- **State đã vẽ:** Điều phối viên · Kế toán · Kinh doanh (360×800).
- **Edge case:** Người dùng đa vai trò (vừa Manager vừa Dispatcher): theo vai trò cao nhất hợp lệ (Q-GĐ2-6). MANAGER/SYSTEM_ADMIN **không** bị chặn.
- **Quyền:** DISPATCHER, SALES, ACCOUNTANT.
- **A11y:** Tiêu đề rõ, 1 hành động.
- **Mã nghiệp vụ / giả định:** AppStaff.md §3.1; EA-BR-20; A-11(b) (⚑ Q-11, BA tự đề xuất).

## 4. Giai đoạn 3 — Công việc trong ngày & thông báo

### S-020 · Hôm nay (tab 1)
File: `screens/S-020-hom-nay.html` · Ảnh: ![S-020-hom-nay Light](../screenshots/S-020-hom-nay.light.png) ![S-020-hom-nay Dark](../screenshots/S-020-hom-nay.dark.png)

- **Mục đích:** Danh sách việc của tôi hôm nay theo giờ; phân biệt Giao/Nhận; vào Chi tiết hoặc Bắt đầu/Tiếp tục/Xem lại.
- **Bố cục / thành phần:** App bar "Hôm nay" + ngày + chuông có chấm đỏ; dải tóm tắt (5 việc · 1 xong · 1 đang làm); thẻ việc (`task-card`): loại (icon+nhãn), giờ lớn, badge trạng thái, tag Ưu tiên/Trễ, xe + biển số, khách, địa điểm, nút. Tab bar.
- **Hành vi / tương tác:** Chạm thẻ → S-022; nút trong thẻ đi thẳng vào wizard (Bắt đầu/Tiếp tục) hoặc Xem lại. Nút chính (đầy) chỉ ở việc đang làm hoặc việc gần nhất; còn lại viền. Kéo xuống để tải lại. Giao và Nhận luôn là 2 thẻ riêng (A-13).
- **Điều hướng vào → ra:** Vào: sau đăng nhập, tab bar, thông báo. Ra: S-022, wizard S-050/S-070, S-061/S-088, tab khác.
- **State đã vẽ:** Default · Loading · Empty · Error · Offline · 360×800; trang riêng S-020b: Ưu tiên/dời giờ, Trễ, IN_PROGRESS/DONE, MISSED, CANCELLED/REASSIGNED.
- **Edge case:** "Trễ" khi quá giờ hẹn > 15 phút chưa bắt đầu (A-12, cấu hình). MISSED do hệ thống đặt, vẫn Bắt đầu được nhưng nhãn "Vẫn bắt đầu…" (A-22). CANCELLED/REASSIGNED xám, không CTA, REASSIGNED ẩn khách/địa điểm; giữ tới hết ngày. Giờ dời hiện giờ cũ gạch + giờ mới. Việc cùng giờ: thứ tự theo loại rồi biển số.
- **Quyền:** OPERATION_STAFF (chính); MANAGER/SYSTEM_ADMIN thấy việc gán cho mình (A-11a).
- **A11y:** Badge luôn icon+chữ; thẻ là 1 vùng chạm + nút riêng ≥ 48dp; thứ tự đọc: loại → giờ → trạng thái → xe → khách.
- **Mã nghiệp vụ / giả định:** EA §15; UC-EA-15; EA-BR-17/19/23; CR-2026-053; A-12/13/22 (⚑ Q-12, Q-13).

### S-021 · Sắp tới (tab 2)
File: `screens/S-021-sap-toi.html` · Ảnh: ![S-021-sap-toi Light](../screenshots/S-021-sap-toi.light.png) ![S-021-sap-toi Dark](../screenshots/S-021-sap-toi.dark.png)

- **Mục đích:** Xem lịch các ngày kế tiếp (chỉ đọc), nhóm theo ngày.
- **Bố cục / thành phần:** App bar "Lịch việc"; segmented **Sắp tới | Đã xong**; tiêu đề ngày + số việc; hàng việc gọn (icon loại, giờ, xe+biển, khách·địa điểm, chevron).
- **Hành vi / tương tác:** Chạm hàng → S-022 ở chế độ xem (không CTA Bắt đầu — Q-GĐ3-2). Chuyển segmented sang "Đã xong" = S-026.
- **Điều hướng vào → ra:** Vào: tab 2. Ra: S-022, S-026.
- **State đã vẽ:** Default · Loading · Empty · Error · Offline.
- **Edge case:** Khoảng ngày (minh hoạ 7 ngày) cấu hình. Việc dời sang ngày khác biến mất khỏi ngày cũ, xuất hiện ngày mới + thông báo.
- **Quyền:** OPERATION_STAFF (+Manager/Admin: việc của mình).
- **A11y:** Segmented `role=tablist`, trạng thái chọn = màu + nền + chữ.
- **Mã nghiệp vụ / giả định:** UC-EA-15 bước 4; EA-BR-17; CR-2026-053. Quyết định "segmented trong tab 2" là đề xuất thiết kế.

### S-022 · Chi tiết công việc
File: `screens/S-022-chi-tiet-cong-viec.html` · Ảnh: ![S-022-chi-tiet-cong-viec Light](../screenshots/S-022-chi-tiet-cong-viec.light.png) ![S-022-chi-tiet-cong-viec Dark](../screenshots/S-022-chi-tiet-cong-viec.dark.png)

- **Mục đích:** Mọi thông tin cần để đi làm + cổng vào wizard.
- **Bố cục / thành phần:** App bar (back, tiêu đề Giao/Nhận xe, mã lượt thuê); thẻ giờ hẹn + badge + tag ưu tiên + banner ghi chú hệ thống; thẻ Khách (tên, SĐT, nút Gọi); thẻ Xe; thẻ Địa điểm (nút Mở bản đồ); Ghi chú điều phối; Việc liên quan của bạn (cùng lượt thuê); nút "Báo không nhận việc" (viền đỏ, tách xa); CTA đáy.
- **Hành vi / tương tác:** Gọi = `tel:`; Mở bản đồ = deep link Google/Apple Maps (không nhúng bản đồ — A-14). CTA theo trạng thái: ASSIGNED "Bắt đầu giao/nhận xe" · IN_PROGRESS "Tiếp tục…" · DONE "Xem lại" · MISSED "Vẫn bắt đầu…". Bắt đầu mở bất kỳ lúc nào (EA-BR-23) nhưng server kiểm tra phân công + trạng thái Rental (chặn cứng — CR-2026-055).
- **Điều hướng vào → ra:** Vào: S-020/021/024/025. Ra: wizard, S-061/088, S-023, tab trước.
- **State đã vẽ:** S-022: Giao ASSIGNED · Nhận IN_PROGRESS · toàn bộ nội dung (cuộn) · Loading · Error · Offline. S-022b: DONE · MISSED · CANCELLED · REASSIGNED · chặn không phân công · chặn Rental sai trạng thái.
- **Edge case:** REASSIGNED: ẩn khách/SĐT/địa điểm/ghi chú (EA-BR-17). CANCELLED: không CTA, không Báo không nhận. Chặn: nút khoá + banner lý do + hint (không chỉ màu). Khách không có SĐT: ẩn nút Gọi. Địa điểm trống: ẩn Mở bản đồ. Bắt đầu trong lúc server đã đổi người → server trả chặn, UI hiện banner.
- **Quyền:** "Báo không nhận việc" chỉ OPERATION_STAFF (A-11a). Không hiển thị giá/cọc/công nợ.
- **A11y:** Nhãn nút có icon + chữ; banner `role=alert` cho chặn; nút Gọi có `aria-label`.
- **Mã nghiệp vụ / giả định:** EA §9, §15; EA-BR-13/15/17/21/23; CR-2026-053/055; A-11/13/14/22 (⚑ Q-14, Q-15, Q-22). Giấy tờ khách (Q-15) không nằm trong màn này.

### S-023 · Báo không nhận việc
File: `screens/S-023-bao-khong-nhan-viec.html` · Ảnh: ![S-023-bao-khong-nhan-viec Light](../screenshots/S-023-bao-khong-nhan-viec.light.png) ![S-023-bao-khong-nhan-viec Dark](../screenshots/S-023-bao-khong-nhan-viec.dark.png)

- **Mục đích:** Gửi lý do cho điều phối; hành động độc lập, không chặn.
- **Bố cục / thành phần:** Bottom sheet trên S-022 mờ: grab bar, tiêu đề, giải thích "việc vẫn là của bạn tới khi điều phối đổi người", 4 radio lý do, ô ghi chú (tuỳ chọn; bắt buộc nếu "Lý do khác"), nút Gửi báo cáo, ghost Huỷ.
- **Hành vi / tương tác:** Gửi khoá tới khi chọn lý do. Gửi thành công: sheet đóng, toast "Đã gửi báo cáo cho điều phối", S-022 hiện banner "Đã báo… chờ điều phối" nhưng **vẫn Bắt đầu được**. Đang gửi không đóng được.
- **Điều hướng vào → ra:** Vào: S-022. Ra: S-022.
- **State đã vẽ:** Chưa chọn · Chọn lý do · "Khác" thiếu ghi chú (R) · Loading · Gửi thất bại (R) · Offline · Đã báo (V).
- **Edge case:** Báo lần 2 cho cùng việc: ẩn nút, hiện trạng thái đã báo (Q-GĐ3-3). Việc đã bắt đầu (IN_PROGRESS) không hiện nút này.
- **Quyền:** OPERATION_STAFF.
- **A11y:** Sheet `role=dialog` có tiêu đề; radio hàng ≥ 48dp.
- **Mã nghiệp vụ / giả định:** EA-BR-21/22; UC-EA-16; CR-2026-053; A-11a. Danh mục lý do là minh hoạ.

### S-024 · Hộp thông báo (tab 3)
File: `screens/S-024-hop-thong-bao.html` · Ảnh: ![S-024-hop-thong-bao Light](../screenshots/S-024-hop-thong-bao.light.png) ![S-024-hop-thong-bao Dark](../screenshots/S-024-hop-thong-bao.dark.png)

- **Mục đích:** Thông báo in-app: việc mới, đổi giờ/ưu tiên, sắp đến giờ, MISSED, đổi người, huỷ.
- **Bố cục / thành phần:** App bar lớn; dòng "n chưa đọc" + nút "Đánh dấu tất cả đã đọc"; nhóm Hôm nay / Trước đó; hàng thông báo (icon loại tô màu, tiêu đề, mô tả, thời điểm, chevron); chân trang nêu giữ 30 ngày + chỉ hiện khi mở app.
- **Hành vi / tương tác:** Chạm → S-025 (tự đánh dấu đã đọc khi mở). Chưa đọc = chấm + nền nhạt + chữ ẩn "Chưa đọc". Badge tab giảm tương ứng. Không xoá thủ công (A-09).
- **Điều hướng vào → ra:** Vào: tab 3, chuông. Ra: S-025.
- **State đã vẽ:** Default (đủ loại sự kiện) · Tất cả đã đọc · Loading · Empty · Error · Offline.
- **Edge case:** Không có push (CR-2026-053): người dùng chỉ thấy khi mở app — rủi ro đã chấp nhận, điều phối gọi khi gấp. Danh sách dài: phân trang cuộn vô hạn (chưa vẽ). Thông báo của việc đã bị xoá → S-025 lỗi.
- **Quyền:** Người dùng của chính mình.
- **A11y:** Hàng ≥ 56dp; trạng thái chưa đọc không chỉ bằng màu.
- **Mã nghiệp vụ / giả định:** NT-BR-07; EA §16/§21; EA-BR-19; CR-2026-053; A-09 (⚑ Q-09).

### S-025 · Chi tiết thông báo
File: `screens/S-025-chi-tiet-thong-bao.html` · Ảnh: ![S-025-chi-tiet-thong-bao Light](../screenshots/S-025-chi-tiet-thong-bao.light.png) ![S-025-chi-tiet-thong-bao Dark](../screenshots/S-025-chi-tiet-thong-bao.dark.png)

- **Mục đích:** Cho thấy chính xác cái gì đổi (giờ cũ→mới, người cũ→mới) và đường mở việc.
- **Bố cục / thành phần:** App bar back; thẻ nội dung: icon + tiêu đề + thời điểm; khối so sánh (giờ gạch → giờ mới; Bạn → Nhân viên khác); thông tin việc tối thiểu; CTA "Mở việc".
- **Hành vi / tương tác:** Mở việc → S-022. Với việc không còn của mình: CTA đổi thành "Đóng", không hiện khách/SĐT/địa điểm (EA-BR-17).
- **Điều hướng vào → ra:** Vào: S-024. Ra: S-022 | S-024.
- **State đã vẽ:** Đổi giờ · Giao việc mới · Đổi người · Lỗi (việc không còn).
- **Edge case:** Việc đã DONE/CANCELLED sau thông báo: Mở việc vẫn tới S-022 ở trạng thái hiện tại.
- **Quyền:** Người dùng của chính mình.
- **A11y:** Thứ tự đọc: tiêu đề → thay đổi → thông tin.
- **Mã nghiệp vụ / giả định:** EA §16; EA-BR-17/19; A-09 (⚑ Q-09).

### S-026 · Việc đã hoàn tất
File: `screens/S-026-viec-da-hoan-tat.html` · Ảnh: ![S-026-viec-da-hoan-tat Light](../screenshots/S-026-viec-da-hoan-tat.light.png) ![S-026-viec-da-hoan-tat Dark](../screenshots/S-026-viec-da-hoan-tat.dark.png)

- **Mục đích:** Tra lại các phiên mình đã hoàn tất để xem lại (chỉ đọc).
- **Bố cục / thành phần:** Đoạn "Đã xong" của tab 2; nhóm theo ngày; hàng có icon xanh, xe+biển, khách·giờ hẹn, badge "Hoàn tất hh:mm", nhãn Xem lại + chevron.
- **Hành vi / tương tác:** Chạm hàng → Xem lại (S-061 Giao / S-088 Nhận). Khoảng 30 ngày minh hoạ.
- **Điều hướng vào → ra:** Vào: S-021 → Đã xong. Ra: S-061/S-088.
- **State đã vẽ:** Default · Loading · Empty · Error · Offline (Xem lại cần mạng).
- **Edge case:** Phiên bị Manager chỉnh sau hoàn tất: hiện nhãn "đã cập nhật" (chưa vẽ, Q-GĐ3-4).
- **Quyền:** Phiên của chính mình; Manager/Admin xem phiên người khác ở Webapp (A-11).
- **A11y:** Badge icon + chữ.
- **Mã nghiệp vụ / giả định:** UC-VH-12; UC-VR-17; EA-BR-13/17.

## 5. Câu hỏi mở gửi BA (chưa ghi vào QUESTIONS.md để tránh xung đột — điều phối viên gộp)
- **Q-GĐ2-1** Chính sách mật khẩu (độ dài tối thiểu, ký tự, lịch sử) do SA chốt — hiện minh hoạ "≥ 8 ký tự, có chữ và số, khác MK cũ".
- **Q-GĐ2-2** Có phân biệt thông điệp DISABLED/INACTIVE trước khi xác thực đúng mật khẩu không (rủi ro dò tài khoản)? Đề xuất: chỉ hiện sau xác thực đúng.
- **Q-GĐ2-3** Giới hạn tần suất "Gửi yêu cầu đặt lại" và số điện thoại điều phối hiển thị (hiện placeholder).
- **Q-GĐ2-4** Đăng nhập ở máy thứ hai khi phiên cũ còn hạn: cho phép song song hay đăng xuất máy cũ? (liên quan A-08 "một thiết bị thao tác một phiên").
- **Q-GĐ2-5** Hết phiên khi ảnh đang upload dở: giữ hàng chờ tạm trên máy hay yêu cầu chụp lại (Phase 1 không có hàng đợi offline)?
- **Q-GĐ2-6** Người dùng có nhiều vai trò (vừa Operation vừa Dispatcher…): quyết định vào app theo quy tắc nào?
- **Q-GĐ3-1** Offline ở danh sách: xác nhận cho phép **xem dữ liệu lần tải cuối (chỉ đọc)** hay chỉ hiện màn chặn? (đang vẽ phương án xem chỉ đọc).
- **Q-GĐ3-2** Từ tab Sắp tới, việc ngày mai có Bắt đầu được không? EA-BR-23 nói "bất kỳ lúc nào" nhưng UC-EA-15 nói lịch ngày tới "chỉ đọc" — đang vẽ chỉ đọc.
- **Q-GĐ3-3** Báo không nhận việc lần 2 / thu hồi báo cáo; danh mục lý do chính thức.
- **Q-GĐ3-4** Hiển thị khi phiên đã hoàn tất bị Manager chỉnh/đóng lại.

## 6. Danh sách màn & ảnh
| Mã | File | Ảnh |
| --- | --- | --- |
| S-124 | `screens/S-124-khoi-dong.html` | [Light](../screenshots/S-124-khoi-dong.light.png) · [Dark](../screenshots/S-124-khoi-dong.dark.png) |
| S-010 | `screens/S-010-dang-nhap.html` | [Light](../screenshots/S-010-dang-nhap.light.png) · [Dark](../screenshots/S-010-dang-nhap.dark.png) |
| S-011 | `screens/S-011-doi-mat-khau-lan-dau.html` | [Light](../screenshots/S-011-doi-mat-khau-lan-dau.light.png) · [Dark](../screenshots/S-011-doi-mat-khau-lan-dau.dark.png) |
| S-012 | `screens/S-012-quen-mat-khau.html` | [Light](../screenshots/S-012-quen-mat-khau.light.png) · [Dark](../screenshots/S-012-quen-mat-khau.dark.png) |
| S-013 | `screens/S-013-phien-het-han.html` | [Light](../screenshots/S-013-phien-het-han.light.png) · [Dark](../screenshots/S-013-phien-het-han.dark.png) |
| S-014 | `screens/S-014-tai-khoan-khong-dang-nhap-duoc.html` | [Light](../screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.light.png) · [Dark](../screenshots/S-014-tai-khoan-khong-dang-nhap-duoc.dark.png) |
| S-015 | `screens/S-015-vai-tro-khong-dung-app.html` | [Light](../screenshots/S-015-vai-tro-khong-dung-app.light.png) · [Dark](../screenshots/S-015-vai-tro-khong-dung-app.dark.png) |
| S-020 | `screens/S-020-hom-nay.html` | [Light](../screenshots/S-020-hom-nay.light.png) · [Dark](../screenshots/S-020-hom-nay.dark.png) |
| S-020b | `screens/S-020b-hom-nay-bien-the-the-viec.html` | [Light](../screenshots/S-020b-hom-nay-bien-the-the-viec.light.png) · [Dark](../screenshots/S-020b-hom-nay-bien-the-the-viec.dark.png) |
| S-021 | `screens/S-021-sap-toi.html` | [Light](../screenshots/S-021-sap-toi.light.png) · [Dark](../screenshots/S-021-sap-toi.dark.png) |
| S-022 | `screens/S-022-chi-tiet-cong-viec.html` | [Light](../screenshots/S-022-chi-tiet-cong-viec.light.png) · [Dark](../screenshots/S-022-chi-tiet-cong-viec.dark.png) |
| S-022b | `screens/S-022b-chi-tiet-bien-the.html` | [Light](../screenshots/S-022b-chi-tiet-bien-the.light.png) · [Dark](../screenshots/S-022b-chi-tiet-bien-the.dark.png) |
| S-023 | `screens/S-023-bao-khong-nhan-viec.html` | [Light](../screenshots/S-023-bao-khong-nhan-viec.light.png) · [Dark](../screenshots/S-023-bao-khong-nhan-viec.dark.png) |
| S-024 | `screens/S-024-hop-thong-bao.html` | [Light](../screenshots/S-024-hop-thong-bao.light.png) · [Dark](../screenshots/S-024-hop-thong-bao.dark.png) |
| S-025 | `screens/S-025-chi-tiet-thong-bao.html` | [Light](../screenshots/S-025-chi-tiet-thong-bao.light.png) · [Dark](../screenshots/S-025-chi-tiet-thong-bao.dark.png) |
| S-026 | `screens/S-026-viec-da-hoan-tat.html` | [Light](../screenshots/S-026-viec-da-hoan-tat.light.png) · [Dark](../screenshots/S-026-viec-da-hoan-tat.dark.png) |

## 7. Tài nguyên bổ sung của giai đoạn này
- `tokens/components-gd2-3.css` (auth, gate, day-head, noti, diff-row…; chỉ dùng token semantic) · `tokens/icons-gd2-3.js` (user-x, check-check, bell-off, send, monitor, shield-alert, log-in, hourglass, user-check; dùng `<i data-xicon="…">`).
