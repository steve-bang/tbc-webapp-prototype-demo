# PLAN — Thiết kế UI/UX App nhân viên giao/nhận (Thiên Bảo Car)

> Người soạn: agent `designer` · Giai đoạn 0 · 29/10/2026 · Trạng thái: **Draft — chờ BA/chủ dự án duyệt trước khi vẽ**
> Đọc kèm: `notes/DOMAIN-SUMMARY.md` (nghiệp vụ đã học), `notes/QUESTIONS.md` (điều chưa rõ), `notes/ASSUMPTIONS.md` (BA trả lời), `tokens/tokens.css` (design token — Modern Enterprise Blue, Light + Dark).
> Nguồn chuẩn: CR đã APPLIED > module BRD/UseCase > `AppStaff.md` (còn sót nội dung cũ — xem DOMAIN-SUMMARY §9).

---

## 0. Mục tiêu, phạm vi, nguyên tắc

**Mục tiêu:** bộ thiết kế mobile **end-to-end hoàn chỉnh** cho App nhân viên Phase 1: mockup HTML tĩnh theo token (mỗi màn có đủ trạng thái), screenshot, mô tả UI/UX flow, trang Design System; đủ để dev React Native/Expo dựng và BA/khách duyệt.

**Trong phạm vi (Phase 1):** đăng nhập/đổi mật khẩu · công việc trong ngày · chi tiết việc + báo không nhận việc · wizard Giao xe · wizard Nhận xe · ghi nhận hư hỏng/sự cố · chụp ảnh/video · khách xác nhận · thu tiền theo mốc (QR/SePay) · panel Lịch sử hiện trạng xe rút gọn (CR-2026-052) · chia sẻ Zalo/share sheet · thông báo in-app · hồ sơ/cài đặt (Light/Dark/System) · nhật ký thao tác · trạng thái mất mạng/lỗi/rỗng.

**Ngoài phạm vi (không vẽ, ghi chú "Phase 2"):** offline + hàng đợi đồng bộ + `PENDING_SYNC` (CR-2026-058) · push mobile · đăng ký nghỉ & xác nhận nhận việc (CR-2026-053) · GPS · VETC/phạt nguội tự động · chữ ký điện tử M4 · tra cứu xe/khách độc lập · App khách hàng · màn Webapp.

**Nguyên tắc thiết kế (áp dụng mọi màn):**
1. Token-only (không hardcode màu/spacing/radius); Light + Dark; vùng chạm ≥ 48dp; chữ ≥ 14 cho thông tin bắt buộc; trạng thái luôn có **icon + nhãn** (không chỉ màu).
2. Mobile một tay: CTA chính cố định đáy, nhóm thao tác nguy hiểm tách xa; khung chuẩn **390×844** (iPhone 14) + kiểm tra co về **360×800** (Android nhỏ).
3. Mỗi màn trích mã nguồn (`VH-BR-xx`, `VR-BR-xx`, `EA-BR-xx`, `CR-2026-xxx`) trong ghi chú.
4. Điều chưa rõ → `notes/QUESTIONS.md`; màn chịu ảnh hưởng đánh dấu `⚑Q-nn` và vẽ theo **phương án đề xuất** (có thể thay).
5. Phase 1 online-only: không vẽ hàng đợi đồng bộ; "O" = mất mạng (banner + tạm dừng + thử lại).

**Ký hiệu trạng thái cần vẽ:** `D` default · `L` loading (skeleton) · `E` empty · `R` error · `O` mất mạng · `V` biến thể nghiệp vụ (liệt kê). **Ưu tiên:** `M` must (luồng chính) · `S` should · `C` could.

**Sản phẩm bàn giao (cấu trúc thư mục):**
```text
design/staff-app/
  PLAN.md · tokens/tokens.css (+ components.css do designer bổ sung ở GĐ1)
  mockups/        # 1 file HTML / nhóm màn, có chuyển Light/Dark
  screenshots/    # PNG light+dark mỗi màn/trạng thái
  flows/          # mô tả UI/UX flow (md) + sơ đồ luồng
  notes/          # DOMAIN-SUMMARY, QUESTIONS, ASSUMPTIONS
```

---

## 1. Kiến trúc thông tin & điều hướng

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

## 2. Các giai đoạn

### Giai đoạn 1 — Design System & khung ứng dụng
Mục tiêu: chốt nền hình ảnh + component để mọi giai đoạn sau chỉ lắp ghép. Sản phẩm: `mockups/00-design-system.html`, `tokens/components.css`.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-001 | DS · Tokens | Màu (primitive→semantic), chữ, spacing, radius, elevation; so sánh Light/Dark; bảng tương phản | D (Light, Dark) | `tokens.css`; skill mobile-saas-ui-ux | M |
| S-002 | DS · Nhập liệu & nút | Button (primary/secondary/destructive/ghost, pressed/disabled/loading), text field (focus/error/filled), password field, select, checkbox/radio/switch, stepper số, chip | D, V(focus/error/disabled/loading) | skill §components; WCAG | M |
| S-003 | DS · Phản hồi & lớp phủ | Toast, banner (info/warn/danger/offline), dialog xác nhận, bottom sheet, progress (linear/ring), skeleton, snackbar có "Thử lại" | D, V | `AppStaff.md` §4.6 (dải mất mạng) | M |
| S-004 | DS · Thành phần nghiệp vụ I | Task card (giao/nhận), Status badge (Assignment/Session/Incident/Payment), Wizard header + stepper, Sticky CTA bar, Money row, Info row (nhãn–giá trị) | D, V(trạng thái) | `EA §15`; `VH §20` | M |
| S-005 | DS · Thành phần nghiệp vụ II | Photo slot (trống/đã chụp/đang tải/lỗi/mờ/ngoại lệ), Fuel stepper (vạch), Odometer input, Condition item, Timeline item rút gọn, Compare pair (trước/sau), Signature pad, QR card | D, V | `VH §10–14`; CR-2026-023/052 | M |
| S-006 | DS · Trạng thái chuẩn & trợ năng | Pattern loading/empty/error/offline; từ vựng trạng thái → màu+icon+nhãn; checklist a11y (tương phản, 48dp, cỡ chữ lớn, thứ tự focus) | D | Skill checklist | M |
| S-007 | Khung ứng dụng | App shell: status bar, top app bar, tab bar 4 mục + badge, safe area, dải mất mạng, vị trí FAB/CTA | D, O, V(Light/Dark) | `AppStaff.md` §5.1 | M |

### Giai đoạn 2 — Đăng nhập & tài khoản vào app
Nguồn: CR-2026-034, `SA-BR-01/07/08`, `EA-BR-02/03`, `UC-SA-04/05`.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-124 | Khởi động & kiểm tra phiên | Splash/logo ⚑Q-20, kiểm tra token, điều hướng vào Đăng nhập hoặc Hôm nay | D, L, R(không kết nối), O | `SA` phiên/token | S |
| S-010 | Đăng nhập | Nhập tên đăng nhập (SĐT/email/username) + mật khẩu; hiện/ẩn MK; ghi nhớ tên | D, L(đang đăng nhập), R(sai MK còn n lần), R(sai định dạng), O, V(Light/Dark) | CR-2026-034; `SA-BR-01/07` | M |
| S-011 | Đổi mật khẩu bắt buộc lần đầu | Admin đánh dấu bắt buộc: đặt MK mới trước khi vào; hiển thị yêu cầu MK | D, L, R(MK yếu/không khớp/trùng MK cũ), O | `AppStaff.md` §6.2; `SA` | M |
| S-012 | Quên mật khẩu | Hướng dẫn nhận MK mới (liên hệ Admin/điều phối hoặc gửi yêu cầu) ⚑Q-10 | D, L, R, V(đã gửi) | `UC-SA-05`; `SA EX-01` | S |
| S-013 | Phiên hết hạn | Báo phiên hết hạn, đăng nhập lại, giữ nháp phiên đang làm ⚑Q-08 | D | `AppStaff.md` §6.2 | M |
| S-014 | Tài khoản không đăng nhập được | Thông điệp riêng: `LOCKED` (sai quá N lần), `DISABLED`, nhân viên `INACTIVE/SUSPENDED`; lối ra: liên hệ Admin | V(3 trường hợp) | `SA-BR-07`; `EA-BR-02` | M |
| S-015 | Vai trò không dùng app | Đăng nhập thành công nhưng vai trò (DISPATCHER/SALES/ACCOUNTANT) không dùng App ⚑Q-11 | D | `EA-BR-20`; `AppStaff.md` §3.1 | C |

### Giai đoạn 3 — Công việc trong ngày & thông báo
Nguồn: `UC-EA-15/16/17/10`, `EA-BR-13/17/19/21/23`, CR-2026-053.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-020 | Hôm nay (tab 1) | Danh sách việc của tôi hôm nay theo giờ; phân biệt giao/nhận; trạng thái; CTA Bắt đầu/Tiếp tục/Xem lại | D, L, E("Hôm nay bạn không có lịch giao/nhận"), R, O, V(việc ưu tiên/dời giờ, trễ, đang làm, xong, MISSED, CANCELLED, REASSIGNED) | `EA §15`; `EA-BR-17/19`; ⚑Q-12, Q-13 | M |
| S-021 | Sắp tới (tab 2) | Việc các ngày kế tiếp (chỉ đọc), nhóm theo ngày | D, L, E, R, O | `UC-EA-15` bước 4 | M |
| S-022 | Chi tiết công việc | Tên khách, SĐT (gọi), xe, biển số, địa điểm (mở bản đồ), giờ hẹn, trạng thái, ghi chú; CTA Bắt đầu giao/nhận; liên kết việc liên quan ⚑Q-14 | D, L, R, O, V(DELIVERY/RETURN × ASSIGNED/IN_PROGRESS/DONE/MISSED/CANCELLED; nút Bắt đầu bị chặn: không phân công, Rental sai trạng thái) | `EA §9, §15`; CR-2026-053/055; ⚑Q-15, Q-22 | M |
| S-023 | Báo không nhận việc | Bottom sheet: chọn/nhập lý do → gửi điều phối; xác nhận đã gửi | D, L, R, O, V(đã báo) | `EA-BR-21`; `UC-EA-16`; CR-2026-053 | M |
| S-024 | Hộp thông báo (tab 3) | Danh sách thông báo `IN_APP_STAFF`: việc mới, reassign, sắp đến giờ, MISSED, đổi lịch; chưa đọc/đã đọc | D, L, E, R, O, V(từng loại sự kiện) | `NT-BR-07`; `EA §16`; CR-2026-053 | M |
| S-025 | Chi tiết thông báo | Nội dung thay đổi (giờ cũ→mới, người cũ→mới), nút "Mở việc" ⚑Q-09 | D, R | `EA §16`; `EA-BR-19` | S |
| S-026 | Việc đã hoàn tất | Danh sách việc DONE của tôi → mở Xem lại | D, L, E, R, O | `UC-VH-12`; `UC-VR-17` | S |

### Giai đoạn 4 — Khối hiện trường dùng chung (media · hiện trạng · thu tiền · xác nhận · chia sẻ)
Các khối được dùng lại trong cả hai wizard. Vẽ **một lần, chuẩn**, wizard chỉ tham chiếu.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-030 | Camera chụp ảnh | Viewfinder + khung hướng dẫn theo ô góc; đèn flash; chụp; (Nhận xe) ảnh Handover tham chiếu mờ/picture-in-picture | D, V(ô nào), R(chụp lỗi), V(Light/Dark ngoài trời) | `VH §14`; `VR-BR-10` | M |
| S-031 | Xem trước & phóng to ảnh | Preview, pinch-zoom, Chụp lại, Xoá, thông tin metadata (giờ chụp, ô, người chụp), cảnh báo ảnh mờ | D, V(ảnh mờ), V(so sánh cặp) | `VH-BR-09`; `UC-VH-04` | M |
| S-032 | Quay video | Quay tổng quan quanh xe; giới hạn thời lượng; xem lại; cảnh báo dung lượng ⚑Q-02/Q-03 | D, V(đang quay, vượt giới hạn), R | `VH §11, §14.2` | S |
| S-033 | Quyền thiết bị bị từ chối | Camera/thư viện/thông báo bị từ chối → hướng dẫn mở Cài đặt | V(3 quyền) | Hạ tầng mobile | M |
| S-034 | Lưới ô ảnh bắt buộc | Lưới ô theo nhóm (Ngoại thất / Nội thất / Video) + tiến độ x/y; trạng thái từng ô | D, L, R, O, V(trống, đã chụp, đang tải, lỗi tải, mờ, ngoại lệ chờ duyệt) | `VH-BR-05`; `VR-BR-07`; `VH-BR-09` | M |
| S-035 | Sơ đồ xe — chọn vị trí | Sơ đồ 4 mặt + nóc + nội thất; chạm đánh dấu một/nhiều vị trí | D, V(chọn nhiều) | `DI §10`; `VH §12` | M |
| S-036 | Form mục hiện trạng / hư hỏng | Loại · vị trí · mô tả · mức độ · ảnh (bắt buộc) · (Nhận xe) đối chiếu baseline mới/nặng thêm · chi phí dự kiến · cờ ảnh hưởng an toàn | D, R(thiếu ảnh/vị trí/mô tả), V(Giao: baseline; Nhận: sự cố; nhẹ vs nặng/tai nạn) | `VH-BR-08`; `VR-BR-09/20/23`; `DI §9` | M |
| S-037 | Panel Lịch sử hiện trạng xe | Panel thu gọn/mở rộng, N mốc gần nhất (mặc định 10 / 12 tháng), "Xem thêm"; chỉ ngày/loại mốc/tóm tắt/vị trí/trạng thái sửa rút gọn/ảnh | D(thu gọn, mở rộng), L, E(xe chưa có dữ liệu → ẩn panel), R, O(dữ liệu tới lần tải gần nhất), V(mốc Giao/Trả/Sự cố 4 trạng thái sửa) | CR-2026-052; `VH-BR-23`; `VR-BR-29`; `DI-BR-22` | M |
| S-038 | Chi tiết mốc lịch sử (rút gọn) | Mở bản ghi nguồn ở chế độ xem rút gọn; ảnh lớn; **ẩn** Liability/tiền/claim/tranh chấp/tên-SĐT khách | D, L, R | `VH-BR-23`; `DI-BR-22` | S |
| S-039 | Thu tiền theo mốc | Hiển thị khoản cần thu (nhãn rõ: 70% Base Rental, Security Deposit, khoản khác), chọn phương thức, sinh **QR VietQR động (SePay)** | D, L, R(không tạo được QR), O, V(CASH_20M / MOTORBIKE / khoản khác) ⚑Q-05 | CR-2026-004/047/060; `VH-BR-17` | M |
| S-040 | Chờ & kết quả thanh toán | Chờ webhook SePay; đã nhận; hết hạn QR; số tiền lệch; lỗi | D(chờ), V(đã nhận, hết hạn, lệch tiền, lỗi), O | CR-2026-047; `PM` | M |
| S-041 | Xác nhận thu thủ công (baseline) | Khi cổng chưa sẵn sàng: nhân viên xác nhận "đã nhận" + ghi chú/ảnh biên nhận, chờ kế toán xác nhận ⚑Q-05 | D, V(chờ kế toán) | CR-2026-004/047 baseline | S |
| S-042 | Chuyển thiết bị cho khách | Màn trung gian "Đưa điện thoại cho khách" + chặn nhìn vào dữ liệu nội bộ; nút "Nhận lại thiết bị" | D | `VH §16` UX | S |
| S-043 | Khách xác nhận — M1 | Tóm tắt cho khách (odo, nhiên liệu, hư hỏng có sẵn, phụ kiện / khoản phát sinh) + nút "Tôi đã kiểm tra và đồng ý" ⚑Q-01 | D, V(Giao/Nhận) | `VH §16`; `VR §18` | M |
| S-044 | Khách xác nhận — M2 (ký) | Bảng ký tay trên màn hình, xoá/ký lại, xem lại chữ ký ⚑Q-01 | D, V(đã ký, rỗng) | `VH §16` | S |
| S-045 | Khách xác nhận — M3 (OTP) | Gửi OTP tới SĐT khách, nhập mã, gửi lại, sai/hết hạn ⚑Q-01 | D, L, R, V(đã xác nhận) | `VH §16` | C |
| S-046 | Chia sẻ cho khách | Share sheet OS (Zalo/Messenger/email) hoặc link có thời hạn; lịch sử chia sẻ; fallback SMS/gọi; (Nhận xe) kèm ảnh so sánh ⚑Q-24 | D, L, R, O, V(Giao/Nhận) | `UC-VH-10`; `UC-VR-15`; `ZL` T0 | M |

### Giai đoạn 5 — Wizard Giao xe (`VH`)
Khung wizard dùng chung (header bước x/y, thoát/tạm dừng, CTA đáy) = S-051. Thứ tự đề xuất ⚑Q-04.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-050 | Giao xe · Kiểm tra tiền điều kiện | Chạy kiểm tra tuần tự; `ELIGIBLE` → vào phiên; `NOT_ELIGIBLE` → liệt kê lý do kèm lối ra | L, V(ELIGIBLE; NOT_ELIGIBLE: sai người, Rental sai trạng thái, đã có Handover, xe MAINTENANCE/INACTIVE, Vehicle Block, chưa thu 30%, hợp đồng chưa tạo), R, O, V(mở lại phiên dở) | `VH §9`; `VH-BR-02/03/13/14/17/20`; CR-2026-055/060; ⚑Q-15, Q-16 | M |
| S-051 | Giao xe · Khung wizard & tổng quan phiên | Stepper (các bước + hoàn thành/thiếu), tiến độ ảnh x/y – checklist x/m, nhảy bước, lưu tự động ⚑Q-08 | D, V(mỗi bước ✓/!/chưa), O | `VH §20` | M |
| S-052 | B2 · Số liệu giao | Giờ giao thực tế (mặc định hiện tại, không tương lai), ODO, nhiên liệu (vạch) kèm ảnh odo/nhiên liệu; cảnh báo lệch | D, R(ODO < hiện tại: cảnh báo/chặn ⚑Q-21; giờ tương lai; lệch giờ lớn), O | `VH §10`; `VH-BR-06/07/22`; CR-2026-023; ⚑Q-18, Q-25 | M |
| S-053 | B3 · Bộ ảnh chuẩn giao | Lưới ô ảnh ngoại thất/nội thất/video (dùng S-034) | D, L, R, O, V(đủ/thiếu) | `VH §11`; `VH-BR-05/09` | M |
| S-054 | B4 · Baseline hiện trạng có sẵn | Panel Lịch sử (S-037) + danh sách hư hỏng có sẵn + Thêm (S-036) + "Xe không có hư hỏng ghi nhận" xác nhận có chủ đích | D, E(chưa có mục), R(mục thiếu ảnh), V(có/không panel) | `VH §12`; `VH-BR-08/23`; CR-2026-052 | M |
| S-055 | B4b · Baseline xe máy cọc | Ảnh nhiều góc xe máy, odo, nhiên liệu, ảnh cà vẹt — **bắt buộc trước khi giao ô tô** | D, R(thiếu), V(chỉ hiện khi `MOTORBIKE`) | `VH §12.1`; `VH-BR-18`; CR-2026-003 | M |
| S-056 | B5 · Checklist bàn giao | Giấy tờ & phụ kiện: đã giao/không giao/không áp dụng + ghi chú + ảnh tuỳ chọn; xử lý hết mục bắt buộc | D, R(thiếu mục bắt buộc), V(cuộn dài) | `VH §13` | M |
| S-057 | B6 · Thu mốc giao xe | Tổng hợp 70% Base Rental + Security Deposit; trạng thái từng khoản; vào S-039/S-040/S-041; chặn hoàn tất tới khi đủ | D, L, R, O, V(đã thu đủ/thiếu/MOTORBIKE: xe máy+cà vẹt thay chuyển khoản) | CR-2026-004/047/060; `VH-BR-17` | M |
| S-058 | B7 · Khách xác nhận (giao) | Hub bước xác nhận: tóm tắt + chọn mức theo cấu hình (S-042→S-043/S-044/S-045); ghi nhận khách không đồng ý | D, V(đồng ý, không đồng ý + ghi chú) | `VH §16`; `UC-VH-07` | M |
| S-059 | B8 · Rà soát & hoàn tất | Checklist validate toàn phiên (liệt kê mục thiếu có nút nhảy tới); nút Hoàn tất (all-or-nothing) | D, L, R(validate fail; lỗi server), O | `VH §15.1`; `VH-BR-05/06/08/17` | M |
| S-060 | Hoàn tất giao xe | Thành công: Rental/Vehicle/Assignment cập nhật; CTA Chia sẻ cho khách → S-046; về Hôm nay | D, R(hoàn tất lỗi giữa chừng — thử lại) | `VH §15.2`; `VH-BR-10` | M |
| S-061 | Xem lại Giao xe (chỉ đọc) | Số liệu, ảnh/video theo danh mục, hư hỏng có sẵn, checklist, xác nhận khách, lịch sử thao tác & chia sẻ | D, L, R, O | `UC-VH-12` | S |
| S-062 | Thoát · Tạm dừng · Huỷ nháp | Hộp thoại: Tiếp tục sau / Huỷ nháp (`DISCARDED`) kèm lý do | V(tạm dừng, huỷ nháp) | `VH` vòng đời; `UC-VH-08` | M |

### Giai đoạn 6 — Wizard Nhận xe (`VR`)
Dùng lại S-051-kiểu khung (biến thể Nhận xe), S-030…S-046.

| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-070 | Nhận xe · Kiểm tra tiền điều kiện & nạp Handover | Kiểm tra: Rental IN_RENTAL, Handover COMPLETED, chưa có Return, đúng người; nạp dữ liệu Handover để đối chiếu | L, V(ELIGIBLE; NOT_ELIGIBLE: chưa Handover, đã có Return, sai người, sai trạng thái), R, O, V(mở lại phiên dở) | `VR §8`; `VR-BR-02/06/19`; CR-2026-055 | M |
| S-071 | Nhận xe · Tổng quan phiên | Khung stepper Nhận xe, tiến độ, dữ liệu Handover tóm tắt (ODO/nhiên liệu/giờ giao) luôn tham chiếu được | D, V(✓/!/chưa), O | `VR §23` | M |
| S-072 | R2 · Số liệu nhận | Giờ trả (không trước giờ giao, không tương lai), ODO (chặn cứng < ODO giao + ảnh + báo Manager), nhiên liệu (vạch); tính sơ bộ Total KM, chênh vạch, chênh giờ | D, R(ODO < giao = CHẶN CỨNG; giờ sai), V(trễ trong ân hạn / trễ), O | `VR §10`; `VR-BR-03/04/05`; CR-2026-023/054; ⚑Q-25 | M |
| S-073 | R3 · Bộ ảnh nhận | Lưới ô ảnh; mỗi ô có ảnh Handover làm tham chiếu | D, L, R, O, V(đủ/thiếu) | `VR §11`; `VR-BR-07/10` | M |
| S-074 | R4 · Đối chiếu trước/sau | So sánh từng cặp ảnh (Handover ↔ Return), ODO/nhiên liệu giao→trả, baseline ↔ hiện tại, checklist; đánh dấu "đã có sẵn" / "phát sinh"; panel Lịch sử (S-037) | D, L, R, O, V(trùng baseline, khác biệt mới, chưa có ảnh đối chiếu) | `VR §12`; `VR-BR-08/29`; `UC-VR-05` | M |
| S-075 | R5 · Sự cố phát sinh | Danh sách Incident Item (loại, vị trí, ảnh, chi phí dự kiến, trạng thái "chờ QL duyệt"); Thêm (S-036) | D, E("Không có sự cố"), R(thiếu ảnh/chi phí), V(item nhẹ chờ duyệt, item nặng) | `VR §13`; `VR-BR-09/23`; `DI §9` | M |
| S-076 | R5b · Sự cố nặng / tai nạn / ảnh hưởng an toàn | Mô tả bổ sung (bên thứ ba, biên bản, bảo hiểm), cảnh báo xe sẽ chuyển MAINTENANCE, đánh dấu Manager xử lý ngoài Return | D, V(CRITICAL/Safety, tai nạn) | `VR-BR-20`; `DI §9.2, §17`; CR-2026-010 | S |
| S-077 | R5c · Yêu cầu Manager duyệt phí nhẹ | Trạng thái chờ duyệt/đã duyệt/từ chối cho khoản nhẹ nhân viên nhập (Phase 1: Manager duyệt trực tiếp) ⚑Q-07 | D, V(chờ, duyệt, từ chối), R, O | `VR-BR-23`; `DI-BR-20`; CR-2026-011/058 | S |
| S-078 | R6 · Return Checklist | Đối chiếu phụ kiện/giấy tờ từ Handover: Đủ/Thiếu/Hỏng/Không áp dụng + ghi chú + ảnh; Thiếu/Hỏng → khoản dự kiến | D, E(Handover không có mục đã giao), R, V(Thiếu→chi phí) | `VR §14`; `UC-VR-07` | M |
| S-079 | R7a · VETC nhập tay | Danh sách + form (số tiền, thời gian, trạm, mã tham chiếu, ảnh, ghi chú); cảnh báo ngoài khoảng thuê | D, E, R, V(trong/ngoài khoảng thuê) | `VR §16`; `UC-VR-09` | S |
| S-080 | R7b · Phạt nguội nhập tay | Danh sách + form (biển, thời gian, địa điểm, nội dung, tiền, ảnh, nguồn); gợi ý liên kết Rental; Post-Settlement | D, E, R, V(thuộc Rental đã COMPLETED) | `VR §17`; `UC-VR-10/11`; `VR-BR-14` | S |
| S-081 | R8 · Bảng ước tính phát sinh | Từng khoản: vượt km (làm tròn 10), thiếu nhiên liệu (nhập), trễ giờ (ân hạn 15', qua đêm), sự cố, VETC, phạt, phụ kiện, phí tận nơi (15k/km); tổng; nhãn "Ước tính — quản lý chốt" | D, L, R, O, V(không phát sinh; có phát sinh; khoản chờ duyệt) | `VR §15`; `VR-BR-12/21/22/24/25/28`; CR-2026-054/057/062 | M |
| S-082 | R8b · Nhập phí nhiên liệu & phí tận nơi | Sheet: số vạch thiếu (tự tính) × giá xăng → số tiền; nhập km tận nơi → phí; gợi ý mở Google Maps | D, R, V(có/không phát sinh) | `VR-BR-25/28`; CR-2026-009/024/062 | M |
| S-083 | R8c · Thu khoản phát sinh (nếu có) | QR thu khoản phát sinh tại chỗ (phí tận nơi thu khi nhận xe; phát sinh cọc xe máy trả bằng QR) ⚑Q-06 | D, V(đã thu/chưa), O | `VR §15.9–15.10`; CR-2026-003/009/047 | C |
| S-084 | R9 · Khách xác nhận (nhận) | Tóm tắt + bảng phát sinh; đồng ý / có bảo lưu (nhập ý kiến, đánh dấu tranh chấp) / từ chối hoàn toàn (vẫn hoàn tất, báo Manager) | D, V(đồng ý, bảo lưu, từ chối) | `VR §18`; `UC-VR-12`; `AC-VR-015` | M |
| S-085 | R10 · Rà soát & hoàn tất | Validate: số liệu, ODO ≥ giao, ảnh, Incident có ảnh+chi phí, checklist, bảng phát sinh đã tính, xác nhận khách | D, L, R(validate fail; lỗi server), O | `VR §19.1`; `VR-BR-03/07/09` | M |
| S-086 | Hoàn tất nhận xe | Thành công: Rental → SETTLEMENT (copy trung tính ⚑Q-23), Vehicle → AVAILABLE hoặc MAINTENANCE; CTA Chia sẻ (kèm ảnh so sánh) | D, V(xe AVAILABLE; xe MAINTENANCE), R | `VR §19.2`; `VR-BR-11/20` | M |
| S-087 | Đối chiếu & trả xe máy cọc | Đối chiếu hiện trạng xe máy với baseline; chỉ trả sau khi khách hoàn tất thanh toán; xác nhận đã trả | D, V(chưa thanh toán xong = khoá), R | `VR §15.10`; `VR-BR-26`; CR-2026-003 | S |
| S-088 | Xem lại Nhận xe (chỉ đọc) | Số liệu, ảnh/video, so sánh trước/sau, Incident Items, checklist, bảng phát sinh, VETC/phạt, xác nhận khách, audit, chia sẻ | D, L, R, O | `UC-VR-17` | S |

### Giai đoạn 7 — Ngoại lệ, chặn nghiệp vụ & tình huống hiện trường
| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-090 | Khách không đến / trễ hẹn | Ghi nhận no-show/trễ + thời điểm, không hoàn tất, báo điều phối | D, L, R, V(đã báo) | `VH EX-01` | S |
| S-091 | Khách không trả mốc giao xe | Ghi nhận tình huống, không hoàn tất Handover, báo điều phối hoãn/huỷ — **không ghi nợ** | D, L, R, V(đã báo) | CR-2026-056; `VH-BR-17` | M |
| S-092 | Xe không đạt để giao | Báo Manager: hư hỏng nặng/bẩn/thiếu phụ kiện; chờ quyết định (đổi xe/hoãn/vẫn giao) | D, V(đã báo/đã quyết) | `VH EX-02`; CR-2026-013 | S |
| S-093 | Xin ngoại lệ thiếu ảnh | Ghi lý do không chụp được 1 góc, chờ Manager/Admin duyệt | D, V(chờ/duyệt/từ chối), R | `VH EX-03`; `UC-VH-04` | S |
| S-094 | Cảnh báo/chặn ODO–nhiên liệu bất thường | Dialog cảnh báo (yêu cầu ảnh rõ) hoặc chặn cứng (Nhận xe ODO < giao + báo Manager) | V(cảnh báo, chặn cứng) | `VH EX-06`; `VR-BR-03` | M |
| S-095 | Không được phân công | Chặn cứng: "Bạn không được phân công việc này", gọi điều phối | D | CR-2026-055; `VH-BR-14`; `VR-BR-19` | M |
| S-096 | Việc đã đổi/huỷ khi đang làm | Rental/assignment bị huỷ, đổi giờ, đổi người trong lúc đang ở phiên → không hoàn tất, chuyển Manager | D, V(huỷ, đổi giờ, reassign) | `EA §12`; `VH`/`VR` UseCase xung đột | S |
| S-097 | Việc thay thế / gián đoạn lượt thuê | Hiển thị liên kết "Giao xe thay thế" + "Nhận xe cũ" (đổi xe, xe hỏng trước giao), nhãn ưu tiên; kết thúc sớm ⚑Q-17 | V(đổi xe giữa kỳ, xe hỏng trước giao, kết thúc sớm) | CR-2026-012/013/063; `EA-BR-19` | C |
| S-098 | Mất mạng giữa phiên | Dải cảnh báo + tạm dừng thao tác cần server + dữ liệu đang nhập được giữ trên màn + Thử lại (Phase 1, không offline) | D, V(đang nhập, đang tải ảnh) | CR-2026-058; `AppStaff.md` §4.2/§4.6 | M |
| S-099 | Tải ảnh/video thất bại | Danh sách file lỗi, thử lại từng file/tất cả, không cho hoàn tất tới khi đủ | D, L, R | `VH-BR-05`; `VH §14.2` | M |

### Giai đoạn 8 — Hồ sơ, cài đặt, nhật ký & trạng thái hệ thống
| Mã | Tên | Mục đích | Trạng thái cần vẽ | Nguồn | Ưu tiên |
| --- | --- | --- | --- | --- | --- |
| S-110 | Tài khoản (tab 4) | Họ tên, SĐT, vai trò, nhân viên; lối tới Giao diện, Đổi MK, Nhật ký, Hỗ trợ, Đăng xuất. Không có đăng ký nghỉ | D, L, R, O | `AppStaff.md` §6.2; CR-2026-053 | M |
| S-111 | Giao diện | Chọn Light / Dark / Theo hệ thống; xem trước | D, V(3 lựa chọn) | Yêu cầu của chủ dự án; skill | M |
| S-112 | Đổi mật khẩu | MK hiện tại + MK mới + xác nhận; quy tắc MK | D, L, R(sai MK cũ, yếu, không khớp), O, V(thành công) | `SA` UC-SA-05; `SA-BR-08` | M |
| S-113 | Nhật ký thao tác của tôi | Danh sách thao tác (START/ADD_MEDIA/COMPLETE/SHARE_MEDIA…), lọc theo Giao/Nhận | D, L, E, R, O | `UC-VH-15`; `UC-VR-20`; `AL` | S |
| S-114 | Chi tiết bản ghi nhật ký | Hành động, thời gian, nguồn (`HANDOVER_APP/RETURN_APP`), giá trị cũ/mới, lý do | D | `UC-VH-15` | C |
| S-115 | Giới thiệu & hỗ trợ | Phiên bản, liên hệ điều phối, điều khoản/quyền riêng tư | D | Hạ tầng | C |
| S-116 | Đăng xuất | Hộp thoại xác nhận; cảnh báo nếu còn phiên giao/nhận đang dở ⚑Q-08 | V(thường, có phiên dở) | `SA` | S |
| S-120 | Không có mạng (toàn màn) | Trạng thái khi mở app không mạng: thông điệp + Thử lại | D | CR-2026-058 | M |
| S-121 | Lỗi máy chủ | Lỗi 5xx/timeout + Thử lại + mã lỗi để báo | D | Hạ tầng | S |
| S-122 | Bảo trì / bắt buộc cập nhật | Thông báo bảo trì hoặc cần cập nhật phiên bản | V(bảo trì, cập nhật) | Hạ tầng (đề xuất, ⚑Q-19) | C |
| S-123 | Danh mục Empty state | Tổng hợp các màn rỗng (không việc, không thông báo, không nhật ký, không sự cố…) để nhất quán minh hoạ + copy | D | Skill | S |

### Giai đoạn 9 — Tổng hợp, QA và bàn giao
Không thêm màn. Sản phẩm: (1) `mockups/index.html` — bản đồ prototype bấm được: Tab bar → Hôm nay → Chi tiết → hai wizard → hoàn tất (điều hướng giữa các mockup); (2) `flows/` — mô tả UI/UX flow (đường chính, đường phụ, lỗi) cho từng luồng + sơ đồ; (3) rà soát chéo: mọi màn có đủ trạng thái, Light/Dark, 48dp, mã nguồn, không rò trường ẩn (Liability/tiền/khách trong lịch sử); (4) bảng truy vết màn ↔ UC/BR/CR + danh sách điểm cần dev lưu ý; (5) cập nhật theo `ASSUMPTIONS.md` khi BA trả lời `QUESTIONS.md`.

---

## 3. Ma trận màn hình × luồng

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

## 4. Thứ tự ưu tiên & lộ trình vẽ

1. **GĐ1 Design System** (chặn mọi giai đoạn khác) → ra `components.css` + trang DS.
2. **GĐ2 + GĐ3** (vào app, thấy việc, mở chi tiết): đủ để demo "đăng nhập → Hôm nay → Chi tiết".
3. **GĐ4 khối dùng chung** (media, form hư hỏng, panel lịch sử, thu tiền, xác nhận, chia sẻ) — làm trước wizard để tránh vẽ lại.
4. **GĐ5 Giao xe** → **GĐ6 Nhận xe** (ưu tiên `M` trước; `S`/`C` sau).
5. **GĐ7 Ngoại lệ** (ưu tiên S-091, S-094, S-095, S-098, S-099).
6. **GĐ8 Tài khoản & trạng thái hệ thống** (S-110/111/112/120 trước).
7. **GĐ9 Tổng hợp & bàn giao**.

Mốc duyệt đề xuất: sau GĐ1 (BA/khách duyệt hướng hình ảnh) · sau GĐ3 · sau GĐ5 · sau GĐ6 · bàn giao GĐ9. Điều kiện "đóng" mỗi giai đoạn: mọi màn `M` có đủ trạng thái trong cột, Light + Dark, a11y checklist đạt, screenshot đã chụp, mô tả flow đã viết.

**Màn chặn bởi câu hỏi (vẽ theo phương án đề xuất, cập nhật khi BA trả lời):** S-012/S-015 (Q-10/11) · S-032 (Q-02/03) · S-039…041/S-057/S-083 (Q-05/06) · S-043…045/S-058/S-084 (Q-01) · S-051 (Q-04/08) · S-077 (Q-07) · S-097 (Q-17) · S-052 (Q-21).

---

## 5. Thống kê

- **Giai đoạn:** 9 (8 giai đoạn vẽ + 1 giai đoạn tổng hợp/bàn giao).
- **Màn hình/tab được đánh mã:** 91 (M = 60, S = 24, C = 7) — đếm theo mã `S-xxx` trong các bảng giai đoạn.
- **Ưu tiên:** `M` = luồng chính phải có để demo end-to-end; `S` = nên có để hoàn chỉnh; `C` = có thể hoãn nếu hết thời gian.
