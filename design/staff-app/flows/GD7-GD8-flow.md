# GĐ7 + GĐ8 — Ngoại lệ hiện trường & Hồ sơ/Cài đặt/Hệ thống

> Designer · 29/10/2026. Mockup: `screens/S-090…S-099`, `S-110…S-116`, `S-120`, `S-123`; style riêng `tokens/components-gd7-8.css`. Mọi màn có Light + Dark (ảnh `*.light.png` / `*.dark.png`). Phase 1 online-only (CR-2026-058).

## 1. Nguyên tắc chung GĐ7–GĐ8
- **Cảnh báo ≠ chặn**: vàng + icon cảnh báo, cho đi tiếp có điều kiện (ảnh/lý do); chặn cứng = đỏ + icon cấm + giải thích + lối ra (gọi điều phối), CTA khoá.
- **Điểm vào chung**: nút ⋯ trên header wizard → sheet “Báo tình huống” (S-090 menu): khách không đến, không trả tiền, xe không đạt, thiếu ảnh, gọi điều phối.
- **Không ghi nợ, không huỷ tại app**: nhân viên chỉ ghi nhận + báo; hoãn/huỷ/đổi xe/duyệt là Manager/điều phối ở Webapp (A-11).
- **Dữ liệu đã nhập luôn được giữ** (server autosave — A-08); không có hàng đợi offline.
- **Không lộ dữ liệu ẩn** (khách/tiền/Liability) ở S-095, S-097, S-113/114 (`EA-BR-17`, `DI-BR-22`).
- Hành động nguy hiểm: dạng viền đỏ, tách xa; dialog đặt nút an toàn ở trên.

## 2. Sơ đồ luồng
```text
Wizard (Giao/Nhận) ── ⋯ ─► Báo tình huống
   ├─ Khách không đến/trễ ─► S-090 ─► điều phối (dời/huỷ/chờ) ─► S-024
   ├─ Không trả mốc giao ──► S-091 ─► tạm dừng ─► điều phối hoãn/huỷ ─► S-096
   ├─ Xe không đạt ───────► S-092 ─► Manager: đổi xe(S-097)/hoãn/vẫn giao
   ├─ Thiếu ảnh ──────────► S-093 ─► Manager duyệt/từ chối ─► lưới S-034
   ├─ ODO/nhiên liệu lạ ──► S-094 (cảnh báo Giao | chặn cứng Nhận)
   ├─ Tải ảnh lỗi ────────► S-099 ─► đủ ─► Tiếp tục
   ├─ Mất mạng ───────────► S-098 ─► có mạng ─► tiếp tục
   └─ Việc đổi/huỷ/chuyển ► S-096 ─► Hôm nay
Mở việc không phân công ──► S-095
Tab Tài khoản S-110 ─► S-111 Giao diện · S-112 Đổi MK · S-113→S-114 Nhật ký · S-115 Hỗ trợ · S-116 Đăng xuất
Khởi động/toàn cục ─────► S-120 không mạng · S-121 lỗi máy chủ · S-122 bảo trì/cập nhật
```

## 3. Mô tả từng màn

### S-090 · Khách không đến / trễ hẹn  (ưu tiên S)
- **Mockup**: `screens/S-090-khach-khong-den.html` · Ảnh: [Light](../screenshots/S-090-khach-khong-den.light.png) · [Dark](../screenshots/S-090-khach-khong-den.dark.png)
- **Mục đích**: Ghi nhận khách trễ hoặc no-show tại điểm giao, báo điều phối; KHÔNG hoàn tất Handover.
- **Bố cục & thành phần**: Appbar có back + phụ đề xe; thẻ ngữ cảnh việc (giờ hẹn, khách, địa điểm, nút Gọi khách); radio “Khách đến trễ / Khách không đến”; dòng giờ ghi nhận tự động + chênh phút; ghi chú tuỳ chọn; banner giải thích; CTA đáy “Gửi báo cáo cho điều phối”. Điểm vào: nút ⋯ trên header wizard → bottom sheet “Báo tình huống” (dùng chung S-090…S-093).
- **Tương tác**: Chọn tình huống → Gửi → loading → màn “Đã báo” (timeline 3 bước + Gọi điều phối).
- **Điều hướng**: Từ ⋯ wizard hoặc Chi tiết việc → S-090 → về Chi tiết việc / gọi điều phối. Kết quả (dời lịch/huỷ/chờ) về S-024 Thông báo.
- **State**: Default · Loading (nút spinner) · Error (banner đỏ, dữ liệu giữ) · Đã báo (phiên vẫn IN_PROGRESS).
- **Edge case**: Mất mạng khi gửi → Error; khách đến sau khi đã báo → vẫn tiếp tục phiên (không cần thao tác đảo); chênh phút tính từ Planned Window.
- **Quyền**: Nhân viên được phân công; Manager/Admin dùng như nhau. Duyệt/quyết định ở Webapp (A-11).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `VH EX-01`, `UC-VH-08`, `EA §12`, A-08, A-11

### S-091 · Khách không trả mốc giao xe  (ưu tiên M)
- **Mockup**: `screens/S-091-khach-khong-tra-tien.html` · Ảnh: [Light](../screenshots/S-091-khach-khong-tra-tien.light.png) · [Dark](../screenshots/S-091-khach-khong-tra-tien.dark.png)
- **Mục đích**: Khách không thể thanh toán 70% Base Rental + Security Deposit → không giao xe, báo điều phối hoãn/huỷ, KHÔNG ghi nợ.
- **Bố cục & thành phần**: Điểm vào ở S-057 bước 6: nút “Khách không thanh toán được” (danger secondary, tách khỏi CTA, sau divider). Form: banner đỏ giải thích hậu quả; thẻ “Khoản cần thu” (70% = 3.150.000 ₫, Security Deposit = 20.000.000 ₫, badge Chưa thu); radio lý do bắt buộc; ghi chú; CTA “Gửi điều phối quyết định”. Dialog xác nhận (nút an toàn “Quay lại thu tiền” đặt trên). Màn “Đã tạm dừng giao xe”.
- **Tương tác**: Chọn lý do → Gửi → dialog xác nhận → loading → màn tạm dừng (timeline, Gọi điều phối).
- **Điều hướng**: S-057 → S-091 → (xác nhận) → Chi tiết việc; quyết định của điều phối về S-024 và có thể dẫn S-096.
- **State**: Default · Dialog xác nhận · Loading · Error · Đã báo/tạm dừng.
- **Edge case**: Khách chuyển khoản nhưng chưa về → chọn lý do tương ứng, vẫn không giao; nếu tiền về sau → quay lại S-040 thu bình thường; Handover không bị DISCARDED.
- **Quyền**: Nhân viên giao xe; không có quyền ghi nợ hay huỷ (Manager/điều phối).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14; dialog: nút phá huỷ không là mặc định
- **Mã nghiệp vụ**: `CR-2026-056`, `VH-BR-17`, `CR-2026-060`, `CR-2026-047`, A-05

### S-092 · Xe không đạt để giao  (ưu tiên S)
- **Mockup**: `screens/S-092-xe-khong-dat.html` · Ảnh: [Light](../screenshots/S-092-xe-khong-dat.light.png) · [Dark](../screenshots/S-092-xe-khong-dat.dark.png)
- **Mục đích**: Báo Manager xe không đạt (hư hỏng nặng/bẩn/thiếu phụ kiện/đèn báo lỗi) và hiển thị quyết định.
- **Bố cục & thành phần**: Thẻ xe; nhóm opt-card checkbox “Vấn đề phát hiện” (nhiều lựa chọn); lưới ảnh minh chứng (≥ 1); mô tả; CTA “Báo Manager”. Trạng thái sau: timeline chờ; thẻ kết quả đổi xe / ghi chú vẫn giao.
- **Tương tác**: Chọn vấn đề + chụp ảnh → CTA mở → gửi; nhận kết quả in-app.
- **Điều hướng**: Menu ⋯ → S-092 → (đổi xe) S-097 / (vẫn giao) quay lại wizard bước Baseline.
- **State**: Default · Thiếu dữ liệu (CTA khoá + field-error) · Chờ quyết định · Đã quyết: đổi xe · Đã quyết: vẫn giao.
- **Edge case**: Manager trả lời “hoãn”: dùng thẻ chờ + Gọi điều phối; ảnh upload lỗi → S-099.
- **Quyền**: Nhân viên báo; quyết định chỉ Manager (Webapp).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `VH EX-02`, `CR-2026-013`, A-11, A-17

### S-093 · Xin ngoại lệ thiếu ảnh  (ưu tiên S)
- **Mockup**: `screens/S-093-ngoai-le-thieu-anh.html` · Ảnh: [Light](../screenshots/S-093-ngoai-le-thieu-anh.light.png) · [Dark](../screenshots/S-093-ngoai-le-thieu-anh.dark.png)
- **Mục đích**: Ghi lý do không chụp được một góc ảnh bắt buộc và xin Manager/Admin duyệt.
- **Bố cục & thành phần**: Form: banner cảnh báo dùng đúng lúc; radio lý do; mô tả; ảnh thay thế tuỳ chọn; CTA gửi. Lưới S-034 thu nhỏ hiển thị ô ngoại lệ (viền liền, icon cấm + badge Chờ duyệt / Được duyệt / Bị từ chối).
- **Tương tác**: Gửi → quay lại lưới; từ chối → nút “Chụp lại ô …”.
- **Điều hướng**: Từ ô ảnh (S-034) hoặc menu ⋯ → S-093 → lưới ảnh.
- **State**: Default · Error mất mạng · Chờ duyệt · Được duyệt · Bị từ chối.
- **Edge case**: Hoàn tất bị chặn khi còn ô chưa chụp/chưa duyệt (`VH-BR-05`); CTA Tiếp tục khoá + hint số ô còn lại.
- **Quyền**: Nhân viên xin; Manager/Admin duyệt ở Webapp (theo cấu hình).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `VH EX-03`, `UC-VH-04`, `VH-BR-05`, A-02, A-11

### S-094 · Cảnh báo / chặn ODO – nhiên liệu bất thường  (ưu tiên M)
- **Mockup**: `screens/S-094-canh-bao-odo-nhien-lieu.html` · Ảnh: [Light](../screenshots/S-094-canh-bao-odo-nhien-lieu.light.png) · [Dark](../screenshots/S-094-canh-bao-odo-nhien-lieu.dark.png)
- **Mục đích**: Phân biệt rõ CẢNH BÁO (Giao: vàng, không chặn) và CHẶN CỨNG (Nhận: đỏ).
- **Bố cục & thành phần**: Giao: dialog vàng so sánh “Bạn nhập 12.340 / Hồ sơ xe 12.480 (−140)”, 2 hành động (Chụp lại ảnh ODO · Giữ số liệu & ghi lý do); sheet ghi lý do + ảnh ODO; banner vàng gom 3 cảnh báo lệch lớn (giờ >30′, ODO >500 km, nhiên liệu ≥3 vạch). Nhận: banner đỏ, ô ODO viền đỏ, so sánh ODO giao 13.050 vs nhập 12.980, nút Sửa số ODO / Chụp ảnh & báo Manager / Gọi điều phối, CTA Tiếp tục khoá.
- **Tương tác**: Cảnh báo cho phép đi tiếp sau khi có ảnh + lý do; chặn cứng không có nút bỏ qua.
- **Điều hướng**: Trong S-052 (Giao) / S-072 (Nhận); lối ra S-023-kiểu gọi điều phối.
- **State**: Cảnh báo ODO thấp · Ghi lý do · Lệch lớn · Chặn cứng · Chặn đã báo Manager.
- **Edge case**: Sau khi báo Manager, vẫn chặn tới khi ODO hợp lệ (chưa rõ Manager có ghi đè được không).
- **Quyền**: Mọi nhân viên; Manager nhận báo ở Webapp.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14; lỗi nêu cách sửa
- **Mã nghiệp vụ**: `VH EX-06`, `VH-BR-07`, `VR-BR-03`, `CR-2026-023`, A-21, A-25  
- **Điểm cần BA xác nhận**: Sau khi báo Manager, nhân viên có được tiếp tục khi Manager ghi đè không? Ngưỡng lệch lớn thực tế?

### S-095 · Không được phân công  (ưu tiên M)
- **Mockup**: `screens/S-095-khong-duoc-phan-cong.html` · Ảnh: [Light](../screenshots/S-095-khong-duoc-phan-cong.light.png) · [Dark](../screenshots/S-095-khong-duoc-phan-cong.dark.png)
- **Mục đích**: Chặn cứng khi người dùng không phải người được phân công (và không phải Manager/Admin).
- **Bố cục & thành phần**: Hero đỏ icon cấm + tiêu đề; thẻ tóm tắt việc (loại, giờ, xe — KHÔNG hiện khách/tiền); CTA “Gọi điều phối” + “Về Hôm nay”.
- **Tương tác**: Không có đường tiếp tục; gọi điều phối (tel:).
- **Điều hướng**: Vào từ deep link/thông báo/việc cũ → S-095 → Hôm nay.
- **State**: Default · Loading kiểm tra · Offline (vẫn chặn).
- **Edge case**: Việc vừa chuyển người: dẫn tới S-096; chưa phân công → cùng thông điệp.
- **Quyền**: Manager/Admin không bị chặn (ghi đè).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `CR-2026-055`, `VH-BR-14`, `VR-BR-19`, `EA-BR-17`

### S-096 · Việc đã đổi / huỷ khi đang làm  (ưu tiên S)
- **Mockup**: `screens/S-096-viec-doi-huy-khi-dang-lam.html` · Ảnh: [Light](../screenshots/S-096-viec-doi-huy-khi-dang-lam.light.png) · [Dark](../screenshots/S-096-viec-doi-huy-khi-dang-lam.dark.png)
- **Mục đích**: Xử lý khi Rental bị huỷ / đổi giờ / đổi người trong lúc nhân viên đang ở phiên.
- **Bố cục & thành phần**: Dialog chặn (huỷ, đổi người) trên nền wizard mờ: icon + tiêu đề + banner “Dữ liệu đã nhập được giữ” + Về Hôm nay / Gọi điều phối. Đổi giờ: banner thông tin không chặn với nút “Đã hiểu” + thẻ ưu tiên. Thẻ xám ở Hôm nay (đã huỷ / đã chuyển người, giờ gạch ngang, không CTA).
- **Tương tác**: Phát hiện khi chuyển bước, mở lại app, kéo làm mới; hành động duy nhất: thoát hoặc gọi.
- **Điều hướng**: Wizard → dialog → Hôm nay.
- **State**: Huỷ · Đổi giờ · Đổi người · Thẻ sau đó.
- **Edge case**: Đang gửi Hoàn tất đúng lúc bị huỷ → server từ chối, hiện dialog huỷ; người cũ không thấy thêm khách/SĐT (`EA-BR-17`).
- **Quyền**: Nhân viên đang thực hiện.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14; dialog nhận focus ở tiêu đề
- **Mã nghiệp vụ**: `EA §12`, `EA-BR-15`, `EA-BR-19`, `VH-BR-14`, A-08, A-22

### S-097 · Việc thay thế / gián đoạn lượt thuê  (ưu tiên C)
- **Mockup**: `screens/S-097-viec-thay-the-gian-doan.html` · Ảnh: [Light](../screenshots/S-097-viec-thay-the-gian-doan.light.png) · [Dark](../screenshots/S-097-viec-thay-the-gian-doan.dark.png)
- **Mục đích**: Hiển thị liên kết “Giao xe thay thế” ↔ “Nhận xe cũ”, xe hỏng trước giao, kết thúc sớm.
- **Bố cục & thành phần**: Chi tiết việc có `link-stack` 2 thẻ nối “liên kết”; thẻ ưu tiên (cờ + giờ dời); nhãn “Nhận xe · Kết thúc sớm”. Không hiện phụ lục, chênh giá, lựa chọn của khách.
- **Tương tác**: Bắt đầu từng việc độc lập như wizard thường.
- **Điều hướng**: Hôm nay → Chi tiết → wizard Giao/Nhận.
- **State**: 3 biến thể.
- **Edge case**: Handover xe thay thế là Handover mới cùng Rental (`VH-BR-21`).
- **Quyền**: Nhân viên được phân công.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `CR-2026-012/013/063`, `VH-BR-21`, `EA-BR-19`, `EA-BR-17`, A-17

### S-098 · Mất mạng giữa phiên  (ưu tiên M)
- **Mockup**: `screens/S-098-mat-mang-giua-phien.html` · Ảnh: [Light](../screenshots/S-098-mat-mang-giua-phien.light.png) · [Dark](../screenshots/S-098-mat-mang-giua-phien.dark.png)
- **Mục đích**: Phase 1 online-only: cảnh báo + tạm dừng + giữ dữ liệu + Thử lại; KHÔNG có hàng đợi.
- **Bố cục & thành phần**: Dải đen `banner.offline` ngay dưới status bar; CTA khoá + lý do; ảnh đang tải hiện “chờ mạng”; dialog “Chưa hoàn tất được” (Thử lại / Để sau); toast “Đã kết nối lại”.
- **Tương tác**: Tự thử lại khi có mạng; Thử lại thủ công.
- **Điều hướng**: Không rời màn; thoát qua dialog như bình thường.
- **State**: Đang tải ảnh · Đang nhập · Lúc Hoàn tất · Có lại mạng.
- **Edge case**: Mất mạng giữa lúc nhập: dữ liệu trên màn không mất, không lưu offline.
- **Quyền**: Mọi vai trò.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14; banner dùng role=status
- **Mã nghiệp vụ**: `CR-2026-058`, `AppStaff §4.2/§4.6`, `UC-VH A3`, A-08

### S-099 · Tải ảnh / video thất bại  (ưu tiên M)
- **Mockup**: `screens/S-099-tai-anh-that-bai.html` · Ảnh: [Light](../screenshots/S-099-tai-anh-that-bai.light.png) · [Dark](../screenshots/S-099-tai-anh-that-bai.dark.png)
- **Mục đích**: Danh sách tệp lỗi, thử lại từng tệp/tất cả; chặn hoàn tất tới khi đủ.
- **Bố cục & thành phần**: Banner tóm tắt; `file-row` (thumb icon, tên ô, dung lượng, badge lỗi, nút Thử lại sm); CTA “Thử lại tất cả (n)”; video quá lớn → “Quay lại”.
- **Tương tác**: Thử lại → progress từng tệp → xong mở khoá Tiếp tục.
- **Điều hướng**: S-034/S-053 → S-099 → quay lại lưới.
- **State**: Default · Loading · Một phần (lỗi vĩnh viễn) · Thành công.
- **Edge case**: Video > 100 MB hoặc > 60 s → phải quay lại; bộ nhớ đầy → thông điệp riêng.
- **Quyền**: Nhân viên.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `VH-BR-05`, `VH §14.2`, `VH EX-04`, A-03

### S-110 · Tài khoản (tab 4)  (ưu tiên M)
- **Mockup**: `screens/S-110-tai-khoan.html` · Ảnh: [Light](../screenshots/S-110-tai-khoan.light.png) · [Dark](../screenshots/S-110-tai-khoan.dark.png)
- **Mục đích**: Hồ sơ cá nhân + lối vào cài đặt. KHÔNG có đăng ký nghỉ.
- **Bố cục & thành phần**: Appbar lớn; thẻ hồ sơ (avatar, tên, mã NV, badge vai trò, SĐT, email, tên đăng nhập); list Giao diện (giá trị hiện tại), Đổi mật khẩu, Nhật ký thao tác, Giới thiệu & hỗ trợ; phiên bản; Đăng xuất (danger secondary tách cuối); tab bar.
- **Tương tác**: Chạm hàng → màn con; Đăng xuất → S-116.
- **Điều hướng**: Tab 4 → S-111/S-112/S-113/S-115/S-116.
- **State**: Default · Loading · Error · Offline (Đổi MK khoá, Giao diện vẫn dùng) · Biến thể Manager/Admin.
- **Edge case**: Hồ sơ lỗi vẫn cho Đăng xuất.
- **Quyền**: Mọi vai trò dùng app; không sửa hồ sơ trên app (Admin).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `AppStaff §6.2`, `CR-2026-053`, `EA-BR-22`, A-11, A-20

### S-111 · Giao diện (Light / Dark / Theo hệ thống)  (ưu tiên M)
- **Mockup**: `screens/S-111-giao-dien.html` · Ảnh: [Light](../screenshots/S-111-giao-dien.light.png) · [Dark](../screenshots/S-111-giao-dien.dark.png)
- **Mục đích**: Chọn chế độ hiển thị; xem trước ngay.
- **Bố cục & thành phần**: 3 `theme-opt` radio card có ô xem trước (Theo hệ thống = nửa sáng nửa tối); khối “Xem trước” (thẻ việc mẫu) hiển thị theo chế độ chọn; ghi chú “Áp dụng ngay, lưu trên máy”.
- **Tương tác**: Chạm = áp dụng ngay, không cần nút Lưu.
- **Điều hướng**: S-110 → S-111 → back.
- **State**: 3 lựa chọn (cột 1 theo hệ thống, cột 2 ép Light, cột 3 ép Dark).
- **Edge case**: Mặc định Theo hệ thống; đổi cài đặt OS khi app đang mở → tự đổi nếu chọn System.
- **Quyền**: Mọi vai trò; lưu cục bộ.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14; radiogroup + aria-checked; đã chọn = vòng + chấm + viền
- **Mã nghiệp vụ**: Yêu cầu chủ dự án; tokens.css

### S-112 · Đổi mật khẩu  (ưu tiên M)
- **Mockup**: `screens/S-112-doi-mat-khau.html` · Ảnh: [Light](../screenshots/S-112-doi-mat-khau.light.png) · [Dark](../screenshots/S-112-doi-mat-khau.dark.png)
- **Mục đích**: Người dùng đổi mật khẩu của mình.
- **Bố cục & thành phần**: 3 ô mật khẩu (ẩn/hiện), thanh độ mạnh, thẻ “Yêu cầu mật khẩu” (✓ đạt / ✕ chưa), CTA khoá tới khi hợp lệ; thành công = hero + toast.
- **Tương tác**: Gõ → quy tắc cập nhật trực tiếp; submit → loading.
- **Điều hướng**: S-110 → S-112 → back/Xong.
- **State**: Default · Đang nhập · Sai MK cũ · Yếu/không khớp/trùng cũ · Loading · Offline · Thành công.
- **Edge case**: Sau thành công có thể thu hồi phiên khác (tuỳ cấu hình).
- **Quyền**: Mọi vai trò (chỉ của mình).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `UC-SA-05`, `SA-BR-08`, `CR-2026-034`  
- **Điểm cần BA xác nhận**: Quy tắc độ dài/độ mạnh cụ thể; có thu hồi phiên khác mặc định không?

### S-113 · Nhật ký thao tác của tôi  (ưu tiên S)
- **Mockup**: `screens/S-113-nhat-ky-thao-tac.html` · Ảnh: [Light](../screenshots/S-113-nhat-ky-thao-tac.light.png) · [Dark](../screenshots/S-113-nhat-ky-thao-tac.dark.png)
- **Mục đích**: Xem thao tác giao/nhận của chính mình.
- **Bố cục & thành phần**: Segmented Tất cả/Giao xe/Nhận xe; nhóm theo ngày; `log-item` (icon, nhãn tiếng Việt, mô tả, mã hành động, giờ).
- **Tương tác**: Lọc; chạm → S-114.
- **Điều hướng**: S-110 → S-113 → S-114.
- **State**: Default · Lọc · Loading · Empty · Error · Offline.
- **Edge case**: Chỉ hiển thị nhật ký của mình; không hiện số tiền.
- **Quyền**: Nhân viên; Manager xem toàn bộ ở Webapp.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `UC-VH-15`, `UC-VR-20`, `AL`

### S-114 · Chi tiết bản ghi nhật ký  (ưu tiên C)
- **Mockup**: `screens/S-114-chi-tiet-nhat-ky.html` · Ảnh: [Light](../screenshots/S-114-chi-tiet-nhat-ky.light.png) · [Dark](../screenshots/S-114-chi-tiet-nhat-ky.dark.png)
- **Mục đích**: Xem một bản ghi: hành động, thời gian, nguồn, giá trị cũ/mới, lý do.
- **Bố cục & thành phần**: Thẻ tiêu đề + mã; info-row; diff cũ/mới; banner “chỉ đọc”.
- **Tương tác**: Chỉ đọc.
- **Điều hướng**: S-113 → S-114 → back.
- **State**: 3 mẫu (UPDATE_METER, ADD_MEDIA, ADD_CONDITION).
- **Edge case**: Reason chỉ có với EDIT_COMPLETED/CANCEL do Manager.
- **Quyền**: Nhân viên (của mình).
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `UC-VH-15 §19.3`, `AL`

### S-115 · Giới thiệu & hỗ trợ  (ưu tiên C)
- **Mockup**: `screens/S-115-gioi-thieu-ho-tro.html` · Ảnh: [Light](../screenshots/S-115-gioi-thieu-ho-tro.light.png) · [Dark](../screenshots/S-115-gioi-thieu-ho-tro.dark.png)
- **Mục đích**: Phiên bản, liên hệ điều phối, điều khoản/riêng tư, sao chép thông tin báo lỗi.
- **Bố cục & thành phần**: Hero logo TBC placeholder; list liên hệ & pháp lý; thẻ thông tin thiết bị.
- **Tương tác**: Gọi / Zalo / sao chép.
- **Điều hướng**: S-110 → S-115.
- **State**: Default.
- **Edge case**: Số điều phối minh hoạ.
- **Quyền**: Mọi vai trò.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: A-10, A-20, `Nghị định 13/2023`  
- **Điểm cần BA xác nhận**: Số điện thoại điều phối thật; nội dung điều khoản.

### S-116 · Đăng xuất  (ưu tiên S)
- **Mockup**: `screens/S-116-dang-xuat.html` · Ảnh: [Light](../screenshots/S-116-dang-xuat.light.png) · [Dark](../screenshots/S-116-dang-xuat.dark.png)
- **Mục đích**: Xác nhận đăng xuất; cảnh báo khi còn phiên dở.
- **Bố cục & thành phần**: Dialog: nút an toàn (Huỷ / Ở lại) trên, “Vẫn đăng xuất” danger secondary dưới; biến thể cảnh báo nêu rõ xe/bước dở.
- **Tương tác**: Vẫn đăng xuất → loading → màn đăng nhập.
- **Điều hướng**: S-110 → S-116 → S-010.
- **State**: Thường · Có phiên dở · Đang đăng xuất.
- **Edge case**: Dữ liệu phiên dở giữ ở server; đăng nhập lại tiếp tục đúng bước.
- **Quyền**: Mọi vai trò.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `SA-BR-08`, A-08

### S-120 / S-121 / S-122 · Trạng thái hệ thống  (ưu tiên M / S / C)
- **Mockup**: `screens/S-120-trang-thai-he-thong.html` · Ảnh: [Light](../screenshots/S-120-trang-thai-he-thong.light.png) · [Dark](../screenshots/S-120-trang-thai-he-thong.dark.png)
- **Mục đích**: Màn toàn trang khi không mạng lúc mở app, lỗi máy chủ/timeout, bảo trì, bắt buộc cập nhật.
- **Bố cục & thành phần**: Hero icon + tiêu đề + 1 câu + (mã lỗi sao chép) + CTA Thử lại / Gọi điều phối / Cập nhật cửa hàng.
- **Tương tác**: Thử lại gọi lại kiểm tra phiên.
- **Điều hướng**: Khởi động (S-124) → S-120/121/122 → vào app khi hết lỗi.
- **State**: 6 cột: S-120 · S-121 5xx · S-121 timeout · S-122 bảo trì · S-122 cập nhật.
- **Edge case**: Cập nhật bắt buộc chặn mọi thao tác.
- **Quyền**: Mọi vai trò.
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: `CR-2026-058`, A-19, A-20  
- **Điểm cần BA xác nhận**: Xác nhận 3 màn hệ thống tối giản (A-19).

### S-123 · Danh mục Empty state  (ưu tiên S)
- **Mockup**: `screens/S-123-empty-states.html` · Ảnh: [Light](../screenshots/S-123-empty-states.light.png) · [Dark](../screenshots/S-123-empty-states.dark.png)
- **Mục đích**: Thống nhất minh hoạ + copy các màn rỗng.
- **Bố cục & thành phần**: Lưới 12 ô mẫu + bảng quy tắc copy.
- **Tương tác**: Tham chiếu cho dev.
- **Điều hướng**: —
- **State**: 12 mẫu (11 rỗng + 1 lỗi).
- **Edge case**: Panel lịch sử xe rỗng thì ẩn.
- **Quyền**: —
- **A11y**: vùng chạm ≥ 48dp; trạng thái = màu + icon + chữ; icon-only button có aria-label; chữ thông tin ≥ 14
- **Mã nghiệp vụ**: Skill mobile-saas-ui-ux, `CR-2026-052`

## 4. Điểm cần BA xác nhận / lưu ý dev
1. S-094: sau khi báo Manager (ODO nhận < ODO giao) nhân viên có tiếp tục được khi Manager ghi đè không; ngưỡng “lệch lớn” (A-25).
2. S-112: quy tắc độ mạnh mật khẩu thực tế; thu hồi phiên khác mặc định (UC-SA-05 bước 3 “tuỳ cấu hình”).
3. S-115: số điều phối thật (A-10); S-120–122: xác nhận 3 màn hệ thống (A-19).
4. S-111: lưu lựa chọn giao diện cục bộ (AsyncStorage), không đồng bộ server — đề xuất designer.
5. S-091/S-090: nhãn tiếng Việt cho hành động nhật ký (S-113) do designer đặt; mã hành động theo UC-VH-15.
6. Không dùng token mới; icon thiếu (monitor, user-x…) thay bằng icon sẵn có (smartphone, ban).
