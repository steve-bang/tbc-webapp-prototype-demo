# QA-B — Rà soát thiết kế nửa sau (S-056 → S-124, 46 file)

Lưu ý phương pháp: ảnh S-056 → S-094 bị hệ thống gỡ khi đọc (request limit), nên phần này kiểm bằng HTML + ảnh chụp lại, độ tin cậy thấp hơn. S-095 → S-124 đã xem trực tiếp cả light và dark.

| Màn | Lỗi tìm thấy | Trạng thái |
| --- | --- | --- |
| S-071 | Nhãn "6/10 bước xong" lệch với stepper; stepper không phản ánh bước lỗi/cần xử lý | Đã sửa (5/10, đoạn `warn` cho bước 4 và 8) |
| S-079, S-080 | Bottom sheet có nguy cơ bị cắt nội dung form | Đã sửa (bỏ giới hạn chiều cao, cho sheet giãn), cần mắt người xác nhận lại |
| S-085 | Dòng ghi chú "Xe chuyển sang Bảo dưỡng" có text node + `<b>` trong flex, dễ vỡ dòng | Đã sửa (bọc span) |
| S-087 | Nhãn "Trạng thái thanh toán" dài, dễ xuống dòng cạnh badge | Đã sửa (rút thành "Thanh toán") |
| S-088 | Số tổng ước tính "1.680.000 ₫" có thể xuống dòng | Đã sửa (nowrap, 22px) |
| S-094 | Dữ liệu mẫu vô lý ("+95 phút") | Đã sửa (+11 phút) |
| S-095 → S-124 (S-095..099, 110..116, 120, 123, 124) | Không thấy lỗi: không chữ cắt, icon đủ, trạng thái có icon + chữ, Dark ổn | Đạt |
| S-056..S-070, S-072..S-078, S-081..S-084, S-086, S-090..S-093 | Chưa xác minh bằng mắt (ảnh không hiển thị) | Tồn: cần rà lại |
