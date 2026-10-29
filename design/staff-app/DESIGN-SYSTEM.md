# DESIGN-SYSTEM — App nhân viên giao/nhận (Thiên Bảo Car)

> Giai đoạn 1 · designer · 29/10/2026. Nguồn: `tokens/tokens.css` (Modern Enterprise Blue), skill `mobile-saas-ui-ux`, PLAN §0/§1. Xem trực quan: `screens/S-001…S-007` + `screenshots/`.

## 1. File & cách dùng
| File | Vai trò |
| --- | --- |
| `tokens/tokens.css` | Token primitive + semantic (Light mặc định, Dark qua `data-theme="dark"`; cũng áp dụng cho container con `[data-theme]`). **Không sửa tuỳ tiện** — thay đổi token phải báo `designer`/BA. |
| `tokens/components.css` | Mọi component (class). Chỉ dùng token semantic. |
| `tokens/icons.js` | Icon Lucide-style inline SVG. |
| `screens/_template.html` | Mẫu để copy. Đặt tên `screens/S-xxx-ten-ngan.html` (1 màn hoặc 1 trang gom nhiều state). |
| `tools/screenshot.mjs` | Chụp ảnh. |

## 2. Quy tắc bắt buộc
1. **3 lớp token**: primitive (`--blue-600`) chỉ nằm trong `tokens.css`; mockup/component chỉ dùng **semantic** (`--text-primary`, `--action-primary`, `--status-danger-bg`, `--space-*`, `--radius-*`, `--elevation-*`); lớp component = biến cục bộ (`--_bg`) trỏ về semantic. **Không hardcode** hex/px màu. Ngoại lệ đã chấp nhận: nền trắng/chữ đen của khung QR (`.qr-box`, để quét được ở Dark).
2. **Light + Dark** cho mọi màn: kiểm tra bằng `?theme=dark` (screenshot tự chụp cả hai).
3. **Vùng chạm ≥ 48×48dp** (nút, tab 56, hàng danh sách ≥ 56, check/radio/switch hàng ≥ 48, chip ≥ 48); khoảng cách giữa 2 vùng chạm ≥ 8dp. Ngoại lệ chỉ cho phần tử không bấm (`.chip.sm`, badge).
4. **Chữ**: thông tin bắt buộc ≥ 14px; `caption` 12px chỉ cho nhãn phụ. Tiền/số dùng `.money`/`.num` (tabular-nums), định dạng `1.250.000 ₫`, `12.345 km`.
5. **Không chỉ dùng màu**: trạng thái = màu + icon + chữ (badge, banner, field error đều kèm icon). Đã chọn = màu + dấu ✓/chấm.
6. **Contrast** (đo trong S-001): text ≥ 4.5:1, UI/icon ≥ 3:1. Xem §6 các ngoại lệ đã biết.
7. **Mỗi màn có đủ state**: default, loading (skeleton), empty, error, offline, no-permission, success; wizard có thêm state validate/disabled CTA.
8. **Một màn một hành động chính** (1 primary button), CTA cố định đáy (`.cta-bar`), hành động nguy hiểm tách xa và dạng viền (`danger secondary`). Không FAB ở Phase 1.
9. **Trích mã nguồn** (`VH-BR-xx`, `EA-BR-xx`, `CR-2026-xxx`, `A-nn`) ở header trang (`<p>` dưới `<h1>`); Phase 1 **online-only** (CR-2026-058): không vẽ hàng đợi offline.
10. Chỉ ghi trong `design/staff-app/`.

## 3. Icon
`icons.js` cung cấp `icon(name,size)` và tự thay `<i data-icon="bell" data-size="20"></i>` thành `<svg class="icon">` (khi DOMContentLoaded). Icon `aria-hidden`; icon-only button phải có `aria-label` trên `<button>`. Kế thừa `currentColor`. Danh sách: `window.iconNames`. Cần icon mới: thêm vào bảng `P` trong `icons.js` (24×24, stroke 2, chép từ Lucide), rồi báo trong báo cáo. Icon đã dùng chuẩn: giao xe = `truck`, nhận xe = `key`, thông báo = `bell`, lỗi mạng = `wifi-off`, chụp = `camera`, QR = `qr-code`, tiền = `banknote`.
Nếu ghi `innerHTML` động sau khi tải: gọi `hydrateIcons(root)`.

## 4. Danh mục component & contract
Tất cả ở `components.css`; state tĩnh dùng class `.is-pressed/.is-focus/.is-disabled/.is-error/.is-on/.is-loading` để chụp ảnh.

| Component | Class chính | Variants / states | A11y |
| --- | --- | --- | --- |
| Device frame | `.device` (+`.is-small` 360×800) `.statusbar` `.device-body` `.homebar` | Light/Dark | — |
| App bar | `.appbar` (`.has-back`, `.is-large`) `.appbar-title` `.icon-btn` | có/không back, có chấm chưa đọc | nút icon 48dp, `aria-label` |
| Tab bar | `.tabbar` `.tab` (`.is-active`) `.tab-badge` | 4 tab: Hôm nay · Sắp tới · Thông báo · Tài khoản | `aria-selected`, nhãn luôn hiện |
| Button | `.btn` + `secondary/ghost/danger/danger secondary`, `.block`, `.sm` | default/pressed/focus/disabled/loading; cao 48 | `:disabled`; loading giữ nhãn + spinner |
| Field | `.field` `.field-label` `.input` `.field-help` `.field-error` | default/focus/filled/error/disabled/readonly; text, password, select (span giả), textarea, odo | label luôn hiện (không chỉ placeholder); lỗi: icon + câu "gì + cách sửa" |
| Check/Radio/Switch | `.check` (`.radio`), `.switch` | on/off/error/disabled | hàng ≥ 48, `role="switch"` |
| Segmented / Stepper số / Chip | `.segmented .seg`, `.num-stepper`, `.chip` | on/off/disabled | chọn = màu + ✓ |
| Card / List | `.card`, `.list .list-item`, `.info-row`, `.divider` | pressed, unread | — |
| Badge | `.badge` + `success/warning/danger/info/neutral`, `.count-badge` | luôn icon + chữ | — |
| Banner | `.banner` + `warning/danger/success/offline`, `.act` | info/warn/danger/success/offline | nút hành động ≥ 48 |
| Empty/Error | `.empty` (`.is-error/.is-warn`) | lần đầu, lỗi, no-permission | tiêu đề + 1 nút |
| Skeleton | `.skeleton` (`.line-lg/.block/.circle/.w-*`) | — | shimmer tắt khi reduce-motion |
| Overlay | `.scrim`, `.sheet-bottom`, `.dialog-wrap .dialog`, `.toast` (`.toast-pos`, `.above-tab`) | — | dialog: nút an toàn ở trên, phá huỷ viền đỏ |
| Wizard | `.wiz-head`, `.steps .s(.done/.now)`, `.progress`, `.ring`, `.cta-bar` (`.two`), `.cta-hint` | n/N | nút ← / × có nhãn |
| Nghiệp vụ I | `.task-card` (`.kind-return`, `.is-done`), `.plate`, `.money`, `.info-row` | 6 trạng thái assignment | giao/nhận phân biệt bằng icon+nhãn |
| Nghiệp vụ II | `.photo-slot` (trống/`is-filled`/`is-uploading`/`is-error`/`is-blur`/`is-exception`), `.photo-grid`, `.fuel-bar .seg`, `.odo`, `.cond-item`, `.timeline .tl-item`, `.compare`, `.sign-pad`, `.qr-card .qr-box` | xem S-005 | slot ≥ 96dp cao |
| Avatar | `.avatar` (`.sm/.lg`) | — | — |

Layout trình chiếu (không phải thành phần app): `.stage` (flex-wrap), `.stage-col` (390px) + `.stage-cap` (tiêu đề state), `.page-title`, `.sheet`.

## 5. Tạo màn mới (cho agent khác)
1. Copy `screens/_template.html` → `screens/S-xxx-ten-ngan.html`; sửa `<title>`, `<h1>`, dòng nguồn (BR/CR/A-nn).
2. Một `.stage-col` = một state: `.stage-cap` (tên state + ghi chú) + `.device` gồm `.statusbar`, `.device-body` (`.appbar`/`.wiz-head`, `.scroll`, `.cta-bar`, `.tabbar` hoặc không), `.homebar`. Tab chính có tab bar; wizard thì không.
3. Overlay (dialog/sheet/toast) đặt **trong** `.device-body` (position:absolute theo thiết bị).
4. Cần pattern mới → thêm class vào `components.css` (chỉ semantic token, đặt cuối file, chú thích nguồn); không viết style hardcode trong trang. CSS riêng của trang (nếu thật sự cần) đặt trong `<style>` và vẫn chỉ dùng token.
5. Chụp: `node design/staff-app/tools/screenshot.mjs design/staff-app/screens/S-0xx-*.html` → `screenshots/<tên>.light.png|.dark.png`. **Đọc lại ảnh** (cả Dark) trước khi báo xong.
6. Checklist trước khi báo: đủ state · Light+Dark · 48dp · icon+chữ cho trạng thái · không hardcode · mã nguồn · không rò dữ liệu ẩn (Liability/tiền/khách trong lịch sử rút gọn — CR-2026-052).

Chạy chụp ảnh: `node design/staff-app/tools/screenshot.mjs [file|glob ...] [--width=1440] [--theme=light|dark] [--out=dir]` (playwright có sẵn qua `require`; không tham số = mọi `screens/S-*.html`).

## 6. Kiểm tra contrast (đo trên S-001)
- **Dark**: `text-tertiary #94A3B8` trên `bg-canvas` 7.30:1, `surface-default` 6.23:1, `surface-raised` 5.63:1, `bg-subtle` 6.66:1 → đạt AA mọi nền.
- **Light**: `text-tertiary #64748B` đạt trên canvas 4.55 / surface 4.76, **KHÔNG đạt trên `bg-subtle` (4.34:1)** → quy tắc: không đặt `text-tertiary` trên `bg-subtle` ở Light (dùng `text-secondary`).
- **Light `border-strong #94A3B8` trên canvas = 2.45:1 < 3:1** (WCAG 1.4.11 viền ô nhập/checkbox). Component hiện dùng token này — **đề xuất chủ dự án/BA duyệt đổi Light `border-strong` sang ≈ `#64748B` (4.76:1)**; chưa tự sửa token. Khi khách chốt, đổi 1 chỗ trong `tokens.css`.
- Disabled (`action-disabled-text` 3.86 Light / 4.04 Dark) miễn trừ theo WCAG nhưng không dùng để truyền thông tin duy nhất (luôn có `cta-hint` giải thích lý do khoá).
- Mọi cặp status (text/bg) ≥ 4.5:1 ở cả hai theme; `text-inverse` trên `status-danger` ≥ 6.4.

## 7. Giả định áp dụng
A-20: logo placeholder "TBC", tên tạm "Thiên Bảo Car — Nhân viên"; A-08: autosave server + upload ngay; A-09: badge chưa đọc trên tab; A-19: màn hệ thống tối giản; CR-2026-058: online-only.
