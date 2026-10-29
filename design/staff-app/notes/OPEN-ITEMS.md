# Open Items — câu hỏi mở của designer (OI-nn)

> Giai đoạn 9 · designer · 29/10/2026. Gộp các mục "câu hỏi mở / điểm cần BA-dev lưu ý" cuối `flows/GD2-GD3-flow.md`, `GD4-flow.md`, `GD5-giao-xe-flow.md`, `GD6-nhan-xe-flow.md`, `GD7-GD8-flow.md` và `DESIGN-SYSTEM.md` §6.
> **Không lặp** các điểm đã có câu trả lời `A-01…A-25` trong [`ASSUMPTIONS.md`](ASSUMPTIONS.md) (kể cả các điểm BA đã ghi là "cần khách xác nhận": mức xác nhận M1/M2/M3 — A-01, khoảng thu tiền khi SePay chưa sẵn sàng/mô hình phí SePay — A-05, phí hư hỏng nhẹ — A-07, số điện thoại điều phối thật — A-10, xe điện — A-18…). Mục dưới đây là phần **mới / chi tiết hoá** mà A-nn chưa phủ.
> Ưu tiên: **Cao** = đổi cấu trúc luồng/màn hoặc ảnh hưởng an toàn/trợ năng · **Trung** = đổi nội dung/ràng buộc một màn · **Thấp** = tinh chỉnh/ghi nhận. Mọi màn đã vẽ theo **phương án đề xuất** ở cột cuối; khi BA/khách trả lời thì cập nhật mockup tương ứng.

| Mã | Ưu tiên | Câu hỏi / điểm mở | Màn ảnh hưởng | Nguồn | Phương án đang vẽ |
| --- | :-: | --- | --- | --- | --- |
| OI-01 | Trung | Chính sách mật khẩu thực tế (độ dài tối thiểu, ký tự, lịch sử) do `SA` chốt. | S-011, S-112 | GD2-3 Q-GĐ2-1; GD7-8 #2 | "≥ 8 ký tự, có chữ và số, khác MK cũ" (minh hoạ). |
| OI-02 | Trung | Có phân biệt thông điệp tài khoản DISABLED/INACTIVE **trước** khi xác thực đúng mật khẩu không (rủi ro dò tài khoản)? | S-010, S-014 | GD2-3 Q-GĐ2-2 | Chỉ hiện thông điệp riêng sau khi xác thực đúng. |
| OI-03 | Thấp | Giới hạn tần suất "Gửi yêu cầu đặt lại"; số điện thoại điều phối hiển thị (hiện là placeholder `028 3822 1234`, cấu hình được). | S-012, S-050, S-098, S-115 | GD2-3 Q-GĐ2-3; GD5 #3 | Placeholder + cờ cấu hình. |
| OI-04 | Cao | Đăng nhập ở máy thứ hai khi phiên cũ còn hạn: cho song song hay đăng xuất máy cũ? Khi đổi mật khẩu có thu hồi phiên khác mặc định không (`UC-SA-05` bước 3 "tuỳ cấu hình")? Liên quan A-08 ("một thiết bị một phiên"). | S-010, S-013, S-051, S-112 | GD2-3 Q-GĐ2-4; GD7-8 #2 | Server quyết định; wizard có cảnh báo "một thiết bị một lúc". |
| OI-05 | Cao | Hết phiên đăng nhập khi ảnh đang upload dở: giữ hàng chờ tạm trên máy hay bắt chụp lại (Phase 1 không có hàng đợi offline)? | S-013, S-099 | GD2-3 Q-GĐ2-5 | Ảnh upload ngay (A-08); ảnh dở hiện ở danh sách lỗi S-099 để thử lại/chụp lại. |
| OI-06 | Trung | Người dùng có nhiều vai trò (vừa Operation vừa Dispatcher…): vào app theo quy tắc nào? | S-010, S-015 | GD2-3 Q-GĐ2-6 | Có `OPERATION_STAFF` thì cho vào; chỉ vai trò không dùng app mới bị chặn. |
| OI-07 | Trung | Danh sách khi mất mạng: cho **xem dữ liệu lần tải cuối (chỉ đọc)** hay chỉ hiện màn chặn? | S-020, S-021, S-120 | GD2-3 Q-GĐ3-1 | Xem chỉ đọc + khoá nút Bắt đầu. |
| OI-08 | Trung | Việc ngày mai ở tab Sắp tới có Bắt đầu được không? `EA-BR-23` ("bất kỳ lúc nào") mâu thuẫn `UC-EA-15` (lịch ngày tới chỉ đọc). | S-021, S-022 | GD2-3 Q-GĐ3-2 | Chỉ đọc. |
| OI-09 | Trung | Báo không nhận việc lần 2 / thu hồi báo cáo; danh mục lý do chính thức. | S-023 | GD2-3 Q-GĐ3-3 | Một lần, danh mục lý do minh hoạ, không thu hồi. |
| OI-10 | Thấp | Hiển thị khi phiên đã hoàn tất bị Manager chỉnh/đóng lại. | S-026, S-061, S-088 | GD2-3 Q-GĐ3-4 | Giữ chế độ chỉ đọc, banner "đã được quản lý chỉnh". |
| OI-11 | Trung | Số ô ảnh ngoại thất bắt buộc: A-02 ghi "12 ô" nhưng liệt kê 13 mục. Cần chốt con số (và 7 ô nội thất). | S-034, S-053, S-073 | GD4 #1; GD5 #1; GD6 #2 | Vẽ 13 ngoại thất + 7 nội thất; lưới co giãn theo cấu hình N ô. |
| OI-12 | Cao | Hành vi khi khách "không đồng ý": Giao = **chặn** hoàn tất tới khi xử lý, Nhận = **vẫn hoàn tất** và ghi "khách chưa xác nhận" (bảo lưu → tranh chấp). Có thống nhất hai wizard không? (chi tiết hoá A-01) | S-043, S-044, S-045, S-058, S-084 | GD4 #2 | Giao chặn, Nhận cho hoàn tất + đánh dấu. |
| OI-13 | Thấp | Sơ đồ xe chỉ top-view, không có 4 ảnh mặt bên như PLAN. Khách có muốn minh hoạ chi tiết hơn (mặt bên, nóc, gầm)? | S-035, S-036 | GD4 #4 | Top-view + chọn vùng. |
| OI-14 | Thấp | Hai đề xuất UX của designer không phải yêu cầu nghiệp vụ: "Nhận lại thiết bị" phải giữ 2 giây (S-042); ngưỡng chữ ký quá ngắn (S-044). Cần BA/khách đồng ý hoặc bỏ. | S-042, S-044 | GD4 #5 | Giữ 2 giây; cảnh báo khi chữ ký quá ngắn. |
| OI-15 | Thấp | Thông báo đẩy (màn xin quyền thông báo) mới vẽ sẵn cho Phase 2, chưa dùng ở Phase 1. | S-033, S-024 | GD4 #6 | Chỉ vẽ biến thể, ẩn ở Phase 1. |
| OI-16 | Cao | **Trợ năng:** token `border-strong` Light `#94A3B8` trên canvas chỉ đạt 2.45:1 (< 3:1 WCAG 1.4.11) mà viền ô nhập, checkbox, ô ảnh đang dùng. Đề xuất đổi sang ≈ `#64748B` (4.76:1). Cần chủ dự án/BA duyệt rồi sửa 1 chỗ trong `tokens.css`. | Mọi màn có ô nhập/ô ảnh (S-002, S-010, S-034…) | DESIGN-SYSTEM §6; GD4 #7 | Chưa sửa token; dùng như hiện tại. |
| OI-17 | Trung | Bảng ước tính khi nhận xe: `VR §15.8` có dòng "Base Rental (tham khảo)" nhưng `EA-BR-17` cấm nhân viên thấy tiền thuê/cọc. Có hiển thị không? | S-081 | GD6 #3 | Không hiển thị Base Rental/cọc. |
| OI-18 | Trung | Phí giao/nhận tận nơi: cách đo km hai lượt (nhập một ô "tổng km 2 lượt" hay hai ô)? | S-082 | GD6 #4 | Một ô tổng km + nút mở Google Maps (A-14). |
| OI-19 | Thấp | Phí trễ giờ dùng đơn giá ngày ẩn trong công thức; nhân viên chỉ thấy kết quả — xác nhận có cần hiện công thức. | S-072, S-081 | GD6 #5 | Hiện kết quả + công thức tóm tắt, không lộ đơn giá. |
| OI-20 | Trung | Sự cố nặng: các trường bảo hiểm/bên thứ ba là đề xuất của designer; nhân viên có phải nhập không hay chỉ báo Manager? | S-076 | GD6 #6 | Nhập tuỳ chọn; không nhập trách nhiệm/bồi thường (DI-BR-22). |
| OI-21 | Trung | Sau khi báo Manager vì ODO nhận < ODO giao (chặn cứng), nếu Manager ghi đè thì nhân viên có tiếp tục được không? Ngưỡng "lệch lớn" thực tế (A-25 chỉ là minh hoạ). | S-094, S-072 | GD7-8 #1 | Chặn tới khi Manager xử lý; ngưỡng cấu hình. |
| OI-22 | Thấp | Lưu lựa chọn giao diện Light/Dark/System **cục bộ** (AsyncStorage), không đồng bộ server — có chấp nhận không? | S-111 | GD7-8 #4 | Lưu cục bộ. |
| OI-23 | Thấp | Nhãn tiếng Việt cho hành động trong nhật ký thao tác do designer đặt; mã hành động theo `UC-VH-15`. BA rà lại nhãn. | S-113, S-114, S-090, S-091 | GD7-8 #5 | Nhãn designer đặt. |
| OI-24 | Thấp | Icon còn thiếu (monitor, user-x, pause…) đang thay bằng icon sẵn có hoặc SVG inline; dev bổ sung vào bộ icon RN. | S-111, S-014, S-062 | GD5 #5; GD7-8 #6 | smartphone / ban / SVG inline. |
