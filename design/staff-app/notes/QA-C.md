# QA-C — Rà soát bằng mắt thật S-056…S-093 (bù phần QA-B chưa xem được ảnh)

Phương pháp: chụp lại bằng `tools/screenshot.mjs`, thu nhỏ 50% rồi cắt đoạn ≤2100px để xem. Đã xem **Light** toàn bộ các màn dưới đây; **Dark** xem bằng mắt cho S-056, S-073, S-087 (các màn còn lại Dark dùng cùng token, chưa xem từng ảnh).

| Màn | Lỗi | Trạng thái |
| --- | --- | --- |
| S-056 | Không thấy lỗi | Đạt (Light + Dark) |
| S-057 | Tiêu đề "Ký quỹ (chuyển khoản)" xuống dòng ở state chờ kế toán | Tồn (nhẹ, chấp nhận) |
| S-058, S-059, S-060, S-061 | Không thấy lỗi | Đạt |
| S-062 | State R "Huỷ nháp thiếu lý do": chip "Bắt đầu nhầm xe" đang chọn nhưng vẫn báo thiếu lý do | Đã sửa (bỏ chọn chip) |
| S-070 | State 3 ghi "bước 4/9", "Tiếp tục từ bước 4" lệch wizard 10 bước (Sự cố = bước 5) | Đã sửa (5/10, bước 5) |
| S-071 | Hàng 6 Return Checklist "7/7 mục · 1 thiếu" tự mâu thuẫn | Đã sửa ("7/7 mục"); stepper warn bước 4 & 8 hiển thị đúng |
| S-072 | Hàng "Giờ trả" state V: nhãn bị xuống dòng, câu quá dài | Đã sửa (rút "Trễ 10 phút · trong ân hạn") |
| S-073 | Ô lỗi/mờ có 2 dòng nhãn: icon + chữ đè lên nhãn ô; state mất mạng ghi "Đang tải 55%" | Đã sửa (padding-top cho `.is-error/.is-blur` trong components-gd6.css; đổi thành "Tạm dừng 55%"); đã xem lại Light + Dark |
| S-074, S-075, S-076, S-077, S-078 | Không thấy lỗi | Đạt |
| S-079 | Bottom sheet hiển thị đủ tiêu đề + form (xác nhận sửa của QA-B) | Đạt |
| S-080 | Sheet state 3, 4 bị cắt mất tiêu đề + các trường đầu (device is-auto thấp) | Đã sửa (device cao 1040px); đã xem lại |
| S-081 | Tổng 2.862.000 / 1.170.000 / 1.500.000 / 600.000 cộng đúng | Đạt |
| S-082 | State "không thiếu nhiên liệu" (6/8 → 6/8) vẫn ghi "Số vạch thiếu 2 vạch" | Đã sửa (0 vạch) |
| S-083, S-084 | Không thấy lỗi (tổng 2.862.000 khớp) | Đạt |
| S-085 | Dòng ghi chú "Xe chuyển sang Bảo dưỡng" ổn (xác nhận sửa) | Đạt |
| S-086 | Không thấy lỗi | Đạt |
| S-087 | Biển số xe máy 59X3-188.20 lệch S-060 (59X2-345.67); Dark ổn | Đã sửa (đồng nhất 59X2-345.67) |
| S-088 | Tổng 1.680.000 / "Thanh toán" gọn, không tràn (xác nhận sửa) | Đạt |
| S-090, S-091, S-092, S-093 | Không lỗi hiển thị. Lệch dữ liệu: nhãn wizard Giao xe "Bước x/9" (S-090/091/093/094/096/098/099) trong khi S-056…S-062 dùng 7 bước (7/7 hoặc 8/8 xe máy) | Tồn — cần lead chốt số bước Giao xe rồi đồng bộ (không sửa vì nằm ngoài phạm vi file được giao / ảnh hưởng S-094…S-099 đã duyệt) |

Chưa xem bằng mắt ở Dark: S-057…S-062, S-070…S-072, S-074…S-086, S-088…S-093 (chỉ Light).
