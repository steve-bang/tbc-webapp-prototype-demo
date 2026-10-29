# Thiết kế UI/UX — App nhân viên giao/nhận (Thiên Bảo Car)

Bộ thiết kế mobile Phase 1 (online-only) cho `OPERATION_STAFF`: 91 trang mockup HTML (Light + Dark), ảnh chụp, mô tả flow, design system, prototype bấm được. **Báo cáo chính: [`REPORT.md`](REPORT.md)** (dán vào PR).

## Cách xem

| Muốn | Mở |
| --- | --- |
| Duyệt toàn bộ màn (thumbnail Light/Dark, tìm theo mã/tên) | [`index.html`](index.html) |
| Bấm thử luồng Đăng nhập → Hôm nay → Chi tiết → Giao xe / Nhận xe → Hoàn tất | [`prototype.html`](prototype.html) |
| Đọc báo cáo tổng hợp | [`REPORT.md`](REPORT.md) |
| Một màn cụ thể | `screens/S-xxx-*.html` (thêm `?theme=dark` cho Dark) |

Mở trực tiếp bằng `file://` là đủ cho `index.html` và các mockup. **`prototype.html` cần HTTP để bấm trong khung điện thoại** (trình duyệt chặn điều khiển iframe trên `file://`; khi đó vẫn dùng được nút Trước/Tiếp nhưng chỉ thấy nguyên trang nhiều state):

```bash
cd design/staff-app
python3 -m http.server 8000
# mở http://localhost:8000/index.html  và  http://localhost:8000/prototype.html
```

## Cấu trúc thư mục

```text
design/staff-app/
  README.md · REPORT.md · PLAN.md · DESIGN-SYSTEM.md
  index.html          # thư viện màn hình
  prototype.html      # prototype bấm được
  tokens/             # tokens.css (token), components*.css (component), icons*.js
  screens/            # S-xxx-*.html — mỗi trang gom nhiều state; _template.html để copy
  screenshots/        # S-xxx-*.light.png / .dark.png (full page, DPR 2)
  flows/              # mô tả UI/UX flow theo giai đoạn (GD2-GD3, GD4, GD5, GD6, GD7-GD8)
  notes/              # DOMAIN-SUMMARY · QUESTIONS · ASSUMPTIONS (A-nn) · OPEN-ITEMS (OI-nn)
  tools/screenshot.mjs
```

## Chụp lại screenshot

Cần Node + `playwright` (đã có trong môi trường dự án). Từ thư mục gốc repo:

```bash
# một hoặc nhiều màn (cả Light và Dark)
node design/staff-app/tools/screenshot.mjs design/staff-app/screens/S-020-hom-nay.html
# theo mẫu
node design/staff-app/tools/screenshot.mjs "design/staff-app/screens/S-05*.html"
# mọi màn
node design/staff-app/tools/screenshot.mjs
# tuỳ chọn: --theme=light|dark  --width=1440  --out=<thư mục>
```

Kết quả: `screenshots/<tên>.light.png` và `.dark.png`. **Đọc lại ảnh (cả Dark) trước khi bàn giao.**

## Kiểm tra link ảnh

```bash
cd design/staff-app
grep -ohE '\((screenshots/[^)]+)\)|src="(screenshots/[^"]+)"|screens/S-[^")]+\.html' REPORT.md | \
  sed -E 's/^\(|\)$|^src="|"$//g' | sort -u | while read f; do [ -e "$f" ] || echo "THIẾU: $f"; done
```

## Quy ước

- Chỉ dùng token semantic (`tokens.css`), không hardcode màu/spacing; chi tiết trong [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md).
- Thêm màn mới: copy `screens/_template.html` → `screens/S-xxx-ten-ngan.html`, chụp ảnh, thêm vào `flows/` và cập nhật `REPORT.md`, `index.html`, `prototype.html`.
- Câu hỏi nghiệp vụ → `notes/QUESTIONS.md`; BA trả lời → `notes/ASSUMPTIONS.md`; điểm mở của designer → `notes/OPEN-ITEMS.md`.
