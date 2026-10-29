# QA-A — Rà soát UI nửa đầu danh sách (46 màn: S-001 … S-056)

Phạm vi: S-001..S-007, S-010..S-015, S-020..S-026, S-030..S-046, S-050..S-056 (light + dark). Không sửa tokens.css/components.css/icons.js.

| Màn | Lỗi tìm thấy | Trạng thái |
| --- | --- | --- |
| S-001 | Bảng tương phản tự liệt kê 3 hàng không đạt (text-tertiary/bg-subtle 4.34, border-strong/bg-canvas 2.45, disabled 3.86) — thuộc token dùng chung | Tồn (token dùng chung, cần chủ token quyết; đã ghi chú đúng là ngoại lệ disabled/viền) |
| S-002, S-005 | Không thấy lỗi | OK |
| S-003 | "Đã lưu bước 3/11" lệch wizard 7 bước | Đã sửa (3/7) |
| S-004 | "Bước 4/11 · Ghi odo & nhiên liệu" lệch wizard 7 bước | Đã sửa (Bước 1/7 · Số liệu giao); stepper mẫu vẫn 11 đoạn — Tồn nhỏ |
| S-006 | "Bước 5/11" | Đã sửa (5/7) |
| S-007 | Không thấy lỗi | OK |
| S-010, S-011, S-012, S-014, S-015 | Không thấy lỗi | OK |
| S-013 | "Bước 5/11 · Chụp ảnh ngoại thất" sai số bước | Đã sửa (2/7 · Ảnh chuẩn, 3 chỗ) |
| S-020, S-020b, S-021, S-023, S-024, S-025 | Không thấy lỗi | OK |
| S-022 | Tab Nhận xe: Mazda 3 30A-678.90 mang chung mã lượt #0187 với việc Giao VF8; ghi chú "sảnh toà nhà / 2 chìa khoá" không khớp sân bay | Đã sửa (#0184, ghi chú cổng ga đến) |
| S-022b | Mọi biến thể dùng chung #0187 / VF8 / Vinhomes cho trạng thái khác nhau; địa điểm | Đã sửa (mã lượt riêng, xe khác nhau, địa chỉ bãi xe) |
| S-026 | Nhãn "Xem lại" đè/chen trong vùng trailing, dễ tràn | Đã sửa (đưa vào thân hàng) |
| S-030, S-031, S-032, S-034, S-035, S-036, S-038, S-040, S-041, S-044, S-045, S-046 | Không thấy lỗi | OK |
| S-033 | Nghi sai dấu "thông báo đẩy" | Không phải lỗi (đúng chính tả) |
| S-037 | Dark: tiêu đề "Lịch sử hiện trạng xe" (button) chữ tối trên nền tối, gần như vô hình | Đã sửa (components-gd4.css .hist-head color) |
| S-039 | Dark: spinner "Đang tạo mã QR" đen trên nền tối, contrast kém | Đã sửa (components-gd4.css, màu action-primary) |
| S-043 | Xe "Toyota Vios 2023" gắn biển 51K-123.45 (biển của VF8 ở các màn khác) | Đã sửa (VinFast VF8 2023) |
| S-042 | Không thấy lỗi | OK |
| S-050 | Xe "Mazda CX-5" trong khi biển 51K-123.45 = VF8 toàn bộ luồng Giao; spinner dòng "Đang kiểm tra" bị xoay cả chữ (đảo ngược) | Đã sửa (VF8; class .chk-row.is-run, chỉ icon xoay) |
| S-051..S-056 | Cùng lỗi Mazda CX-5 / 51K-123.45 | Đã sửa (VinFast VF8, đồng bộ S-057..S-062) |
| S-052 | Ô "Ghi lý do" (biến thể V) bị cắt chữ 2 dòng | Đã sửa (ô cao tự động) |
| S-053 | Skeleton Dark hơi lem (nửa vòng) — hiệu ứng shimmer | Tồn nhẹ (cosmetic, do components.css dùng chung) |

Tổng: 46 màn kiểm; ~14 nhóm lỗi đã sửa; tồn: S-001 contrast token, S-004 stepper 11 đoạn, S-053 shimmer.
