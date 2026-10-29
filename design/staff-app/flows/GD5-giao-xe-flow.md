# GĐ5 — Wizard Giao xe (VH): mô tả UI/UX flow

> Designer · 29/10/2026 · Màn: `S-050` … `S-062` (file `screens/S-0xx-giao-*.html`, ảnh `screenshots/*.light.png|.dark.png`).
> Nguồn: `VehicleHandover` BRD/UC (`VH §9–§20`, `VH-BR-xx`), CR-2026-003/004/005/023/047/052/055/056/058/060, `notes/ASSUMPTIONS.md` (A-nn). Khối dùng chung do GĐ4 vẽ (S-030…S-046) chỉ được **tham chiếu / tái hiện rút gọn** ở đây.
> Vai trò: Delivery Staff (`OPERATION_STAFF`) được phân công; `MANAGER`/`SYSTEM_ADMIN` ghi đè (`VH-BR-14`). Phase 1 online-only (CR-2026-058).

## 0. Nguyên tắc chung của wizard

- **Toàn màn hình, ẩn tab bar**; vào từ Chi tiết việc (S-022) nút “Bắt đầu / Tiếp tục giao xe”.
- **Khung chuẩn** (S-051): X (thoát/tạm dừng) · “Giao xe” + “Bước x/y · tên” · chip lưu tự động · nút “Các bước” · dải ngữ cảnh xe–biển số–khách · stepper (xanh lá ✓ / xanh dương đang làm / vàng thiếu / xám chưa) · nội dung cuộn · **CTA đáy cố định** (Quay lại + Tiếp tục). Một hành động chính mỗi màn; hành động nguy hiểm (Huỷ nháp, Khách không thể thanh toán) tách xa, viền đỏ.
- **7 bước** (cọc `CASH_20M`) hoặc **8 bước** (cọc `MOTORBIKE`, chèn “Xe máy cọc” sau Hiện trạng — `VH-BR-18`):
  `1 Số liệu → 2 Ảnh → 3 Hiện trạng → [4 Xe máy cọc] → Checklist → Thu tiền → Khách xác nhận → Rà soát & hoàn tất`.
  Mã nghiệp vụ cũ B2…B8 ánh xạ: B2=Số liệu, B3=Ảnh, B4=Hiện trạng, B4b=Xe máy, B5=Checklist, B6=Thu tiền, B7=Khách xác nhận, B8=Rà soát. Bước **B1 Kiểm tra điều kiện (S-050)** nằm *trước* wizard, không đếm vào “x/y”.
- **Nhảy bước tự do** (A-04) qua sheet “Các bước”; chỉ bước cuối bị khoá tới khi mọi bước ✓. Sửa dữ liệu sau khi khách đã xác nhận → huỷ xác nhận, bắt xác nhận lại.
- **Lưu tự động trên máy chủ** (A-08): lưu khi bấm Tiếp tục/rời ô; ảnh upload ngay khi chụp; tiếp tục được từ Chi tiết việc, kể cả đổi máy.
- **Mất mạng** (O): dải đen trên cùng + chip “Lưu lỗi” + CTA khoá có lý do; dữ liệu đang nhập giữ trên màn; không có hàng đợi đồng bộ (Phase 2).
- **A11y chung**: vùng chạm ≥ 48dp; chữ thông tin ≥ 13–14; trạng thái = icon + chữ + màu; mỗi nút icon có `aria-label` (X “Thoát hoặc tạm dừng”, list-checks “Xem các bước”); stepper có `aria-label` “Bước n trên N”; thứ tự focus: header → nội dung → CTA; CTA disabled luôn có `cta-hint` giải thích; spinner tôn trọng reduce-motion; Light/Dark đều đã chụp.
- **Quyền**: Staff chỉ thao tác phiên của việc được giao; không thấy giá thuê chi tiết ngoài số cần thu ở S-050/S-057; Manager/Admin dùng cùng giao diện; không có UI duyệt trong app (duyệt ngoại lệ ở Webapp).

## 1. Sơ đồ luồng

```text
Chi tiết việc (S-022) ── Bắt đầu / Tiếp tục ──► S-050 Kiểm tra điều kiện
   │                                              ├─ NOT_ELIGIBLE ──► lý do + (Gọi điều phối | Xem lại S-061 | Quay lại)   [S-095 nếu sai người]
   │                                              ├─ phiên dở ──► Tiếp tục (nhảy tới bước đang dở) | Huỷ nháp (S-062)
   │                                              └─ ELIGIBLE ── Bắt đầu ──┐
   ▼                                                                       ▼
 ┌────────────────────────── WIZARD (ẩn tab bar, X = S-062, ☰ = sheet Các bước S-051) ───────────────────────────┐
 │ 1 Số liệu (S-052) → 2 Ảnh (S-053; camera S-030/031/032/033/099) → 3 Hiện trạng (S-054; S-035/036/037/038)       │
 │   → [4 Xe máy cọc (S-055) nếu MOTORBIKE] → Checklist (S-056) → Thu tiền (S-057; S-039/040/041)                  │
 │   → Khách xác nhận (S-058; S-042/043/044/045) → Rà soát (S-059) ──Hoàn tất──► S-060 Thành công                   │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Ngoại lệ gọi ra: S-091 khách không trả mốc giao · S-093 xin ngoại lệ thiếu ảnh · S-094 cảnh báo ODO · S-096 việc đổi/huỷ · S-098 mất mạng
 S-060 ──► S-046 Chia sẻ cho khách | Về “Hôm nay” (S-020) · Việc DONE → S-061 Xem lại (chỉ đọc)
```

## 2. Mô tả từng màn

### S-050 · Kiểm tra tiền điều kiện (B1)
- **Mục đích**: chạy tuần tự các điều kiện trước khi mở phiên; `ELIGIBLE` → bắt đầu, `NOT_ELIGIBLE` → nêu **mọi** lý do + cách xử lý. Mã: `VH §9`, `VH-BR-02/03/13/14/17/20`, CR-2026-055/056/060.
- **Bố cục**: appbar có Quay lại + tiêu đề “Chuẩn bị giao xe”; thẻ việc (khách, SĐT, xe, địa điểm, thời hạn thuê); `chk-list` 6 dòng (đúng người · Rental cho giao · chưa có Handover · xe sẵn sàng · đã thu 30% · có hợp đồng); khối “Trước khi bắt đầu” (xem giấy tờ khách che số, xem hợp đồng PDF — A-15/A-16, mỗi lần xem ghi audit); khối “Sẽ thu khi giao” (70% + ký quỹ = 23.150.000 ₫); CTA “Bắt đầu giao xe”.
- **State** (ảnh `S-050-giao-kiem-tra-dieu-kien.*`): L đang kiểm tra (spinner từng dòng) · ELIGIBLE · mở lại phiên dở (tiến độ + Tiếp tục + Huỷ nháp viền đỏ) · NOT_ELIGIBLE: chưa thu 30% + chưa hợp đồng / sai người phân công / xe bảo dưỡng–khoá lịch / đã giao rồi–sai trạng thái · R lỗi máy chủ · O mất mạng.
- **Tương tác**: Bắt đầu → tạo phiên `IN_PROGRESS` (Assignment → IN_PROGRESS tự động, `EA-BR-13`) → vào bước 1. Không có nút “bỏ qua điều kiện”.
- **Edge**: Rental đã giao → lối ra “Xem lại phiên” (S-061); khách chưa chuyển khoản mốc đặt xe → hướng dẫn khách trả trước; phiên dở của người khác → chặn như sai người; Block theo CR-2026-015.
- **Vào/ra**: vào từ S-022; ra → bước 1 (S-052), S-061, S-062, S-095, gọi điều phối.
- Ảnh: `../screenshots/S-050-giao-kiem-tra-dieu-kien.light.png` · `.dark.png`.

### S-051 · Khung wizard & tổng quan phiên
- **Mục đích**: chuẩn hoá khung cho B2…B8, tiến độ, nhảy bước, lưu tự động. Mã: `VH §20`, A-04, A-08.
- **Thành phần**: giải phẫu có 8 chú thích; sheet “Các bước” (mỗi hàng ≥ 56dp: số/✓, tên, mô tả tiến độ, nhãn “Đã xong/Thiếu/Đang làm/Chưa làm”; bước cuối khoá tới khi đủ); tiến độ ảnh x/20 · checklist x/7 · thu x/2.
- **State**: khung chuẩn · sheet đang làm dở · biến thể MOTORBIKE 8 bước · đủ điều kiện hoàn tất · chip lưu (Đã lưu/Đang lưu/Lưu lỗi) · O mất mạng giữa phiên (S-098) · co về 360×800.
- **Edge**: sheet cuộn khi 8 bước; hết phiên đăng nhập → quay lại đúng bước (S-013); một thiết bị thao tác một phiên.
- Ảnh: `../screenshots/S-051-giao-khung-wizard.light.png` · `.dark.png`.

### S-052 · B2 Số liệu giao (bước 1)
- **Mục đích**: ghi giờ giao thực tế, ODO, nhiên liệu (số vạch) + 2 ảnh đồng hồ. Mã: `VH §10`, `VH-BR-06/07/19/22`, CR-2026-005/023.
- **Bố cục**: thẻ Giờ (mặc định hiện tại, nút “Giờ hiện tại”) · thẻ ODO (`.odo` 28px tabular) · thẻ nhiên liệu (stepper −/+ 48dp, “n/8 vạch theo hồ sơ xe”, thanh minh hoạ) · thẻ ảnh đồng hồ (dùng chung ô ảnh bước 2).
- **Validation**: giờ không ở tương lai (đỏ, chặn); ODO < hồ sơ → **cảnh báo vàng + bắt ảnh + lý do, không chặn** (A-21; khác Nhận xe chặn cứng); lệch lớn (giờ > 30', ODO > 500 km, ≥ 3 vạch — A-25) → cảnh báo + lý do; thiếu ODO/nhiên liệu/ảnh → CTA khoá có hint.
- **State**: mới vào · hợp lệ · ODO thấp · giờ tương lai · lệch lớn · đang lưu · mất mạng. Edge: xe điện chưa hỗ trợ (A-18).
- Ảnh: `../screenshots/S-052-giao-so-lieu.light.png`.

### S-053 · B3 Bộ ảnh chuẩn giao (bước 2)
- **Mục đích**: chụp đủ ảnh bắt buộc (+ video tuỳ chọn). Mã: `VH §11/§14`, `VH-BR-05/09`, A-02/A-03.
- **Bố cục**: thẻ tiến độ “x/20 · Còn n”; tab 3 mục (Ngoại thất 13 · Nội thất 7 · Video) kèm đếm; lưới 2 cột `photo-slot` + tên góc (dấu * + “bắt buộc” cho đọc màn hình); CTA khoá tới khi đủ.
- **Tương tác**: chạm ô → camera S-030 → xem trước S-031; ô lỗi → chạm thử lại; ô mờ → chụp lại; ô không chụp được → S-093 (chờ duyệt ngoại lệ).
- **State**: đang chụp (6 trạng thái ô) · nội thất + ngoại lệ · video + đủ ảnh · L skeleton · R tải lỗi · O mất mạng. Lưu ý BA: A-02 ghi “12 ngoại thất” nhưng liệt kê 13 → lưới do cấu hình.
- Ảnh: `../screenshots/S-053-giao-bo-anh.light.png`.

### S-054 · B4 Baseline hiện trạng có sẵn (bước 3)
- **Mục đích**: ghi hư hỏng có sẵn trước khi giao, tham chiếu lịch sử xe. Mã: `VH §12`, `VH-BR-08/23`, `DI-BR-22`, CR-2026-052.
- **Bố cục**: panel Lịch sử hiện trạng xe (S-037) **đặt trên form**, thu gọn mặc định; danh sách mục (`cond-item` → S-036); “Thêm hư hỏng có sẵn” (→ S-035/036); khi trống: chọn “Xe không có hư hỏng ghi nhận” (hộp tick có chủ đích, ghi audit).
- **Quyền riêng tư**: panel chỉ ngày/loại mốc/tóm tắt/vị trí/trạng thái sửa rút gọn/ảnh; **không** Liability, tiền, claim, tranh chấp, tên–SĐT khách (đã kiểm tra trên mockup).
- **State**: thu gọn · mở rộng (+ “Xem thêm 6 mốc” → S-038) · rỗng & không có lịch sử (ẩn panel) · đã tick không hư hỏng · R mục thiếu ảnh · L · O (dữ liệu cũ kèm nhãn giờ tải).
- Ảnh: `../screenshots/S-054-giao-baseline-hien-trang.light.png`.

### S-055 · B4b Baseline xe máy cọc (chỉ MOTORBIKE)
- Bắt buộc trước khi giao ô tô (`VH-BR-18`, CR-2026-003): ảnh nhiều góc + ODO xe máy + nhiên liệu (thang ¼) + ảnh cà vẹt 2 mặt. State: đang nhập · R thiếu (chặn) · đủ · O. Dữ liệu là baseline cho S-087 khi nhận xe. Ảnh: `S-055-giao-baseline-xe-may-coc.*`.

### S-056 · B5 Checklist bàn giao
- Mỗi mục: **Đã giao / Không giao / Không áp dụng** (3 lựa chọn ≥ 48dp, chọn = màu + icon + chữ) + ghi chú + ảnh tuỳ chọn; mục bắt buộc đánh dấu *. CTA khoá tới khi xử lý hết mục bắt buộc. State: đang xử lý · R chưa chọn (viền đỏ + huy hiệu) · đủ (có “Không giao”) · L · O. Kết quả “Đã giao” → Return Checklist (S-078). Mã `VH §13`. Ảnh: `S-056-giao-checklist-ban-giao.*`.

### S-057 · B6 Thu mốc giao xe
- **Mục đích**: thu **70% Base Rental + Security Deposit** trước khi hoàn tất. Mã: `VH-BR-17`, CR-2026-004/047/056/060, A-05.
- **Bố cục**: tổng cần thu; 2 thẻ khoản (tên, mô tả, số tiền 24px, badge trạng thái, nút “Thu bằng mã QR”); `MOTORBIKE` thay thẻ ký quỹ bằng “Giữ xe máy”; nút “Khách không thể thanh toán” (danger secondary, tách xa) → S-091.
- **State**: chưa thu · sheet QR chờ (rút gọn S-039/040) · đã thu 70% · đã thu đủ · chờ kế toán xác nhận (baseline, ảnh biên nhận — A-05c, ⚑Q-05) · MOTORBIKE · thu thiếu 150.000 ₫ (chặn) · R không tạo được QR · O · L.
- **Quy tắc**: hai QR tách (A-05d); CTA chỉ bật khi mọi khoản “Đã thu” (hoặc “Chờ kế toán” theo baseline); không ghi nợ khi khách không trả (CR-2026-056).
- Ảnh: `S-057-giao-thu-tien-moc-giao.*`.

### S-058 · B7 Khách xác nhận (hub)
- **Mục đích**: nhân viên rà nội dung rồi chuyển máy cho khách (S-042). Mã: `VH §16`, A-01 (M1 tổng thể; M2 tuỳ chọn; M3 chưa vẽ).
- **State**: hub chưa xác nhận · màn khách M1 (chữ lớn, không nội dung nội bộ/tiền) · biến thể M2 ký tay · đã đồng ý · **không đồng ý** (ghi chú + mục bị phản đối, chặn hoàn tất, lối: sửa dữ liệu hỏi lại / báo điều phối) · dữ liệu đổi sau xác nhận (huỷ xác nhận) · O.
- Khác Nhận xe: Giao xe **không** cho hoàn tất khi khách không đồng ý.
- Ảnh: `S-058-giao-khach-xac-nhan.*`.

### S-059 · B8 Rà soát & hoàn tất
- Danh sách 6 mục ✓/! kèm “Đi tới”; checkbox “Khách đã ký hợp đồng giấy” + xem PDF (A-16, theo cấu hình); nhắc “không sửa được sau hoàn tất” (`VH-BR-12`). Hoàn tất **all-or-nothing** (`VH §15.1`).
- **State**: đủ điều kiện · R còn mục thiếu (CTA khoá, liệt kê mọi mục) · dialog xác nhận · L đang hoàn tất · R lỗi máy chủ (chưa thay đổi gì, Thử lại) · O.
- Ảnh: `S-059-giao-ra-soat-hoan-tat.*`.

### S-060 · Hoàn tất giao xe
- Thành công: Rental → Đang thuê, Vehicle → Đang cho thuê, Assignment → Hoàn tất, **hạn trả dự kiến** tính theo khung 21:00 (CR-2026-005); CTA “Chia sẻ cho khách” (S-046) + “Về Hôm nay”. Biến thể: nhắc giữ xe máy cọc + cà vẹt; có khoản chờ kế toán. Lỗi: **mất kết nối giữa chừng → “Kiểm tra trạng thái” trước khi thử lại (tránh trùng)**; máy chủ từ chối (409) → mã lỗi + gọi điều phối (S-096). Mã `VH §15.2`, `VH-BR-10/19`. Ảnh: `S-060-giao-hoan-tat.*`.

### S-061 · Xem lại Giao xe (chỉ đọc)
- Màn đẩy (không tab bar): số liệu, ảnh/video, hư hỏng có sẵn, checklist, thu tiền, xác nhận khách, nhật ký thao tác, lịch sử chia sẻ (A-24); nút “Chia sẻ lại”; không có nút sửa (sửa chỉ Manager + lý do — `VH-BR-12`). State: D · L · R · O. `UC-VH-12`. Ảnh: `S-061-giao-xem-lai.*`.

### S-062 · Thoát · Tạm dừng · Huỷ nháp
- Sheet từ nút X: **Tiếp tục làm** (an toàn, trên cùng) · **Tạm dừng** (lưu, mở lại từ Chi tiết việc) · **Huỷ nháp** (viền đỏ, tách xa). Huỷ nháp → xác nhận + **lý do bắt buộc** (`DISCARDED`, audit). State: sheet thoát · xác nhận huỷ · thiếu lý do · đang tải ảnh khi thoát · sau tạm dừng (toast + Chi tiết việc “Tiếp tục”) · O. Ảnh: `S-062-giao-thoat-tam-dung.*`.

## 3. Bảng truy vết nhanh

| Màn | Mã nghiệp vụ chính | Giả định/câu hỏi |
| --- | --- | --- |
| S-050 | VH §9, VH-BR-02/03/13/14/17/20, CR-055/056/060 | A-08, A-15, A-16 |
| S-051 | VH §20, VH-BR-17/18 | A-04, A-08 · Q-04/08 |
| S-052 | VH §10, VH-BR-06/07/19/22, CR-005/023 | A-18, A-21, A-25 · Q-18/21/25 |
| S-053 | VH §11/§14, VH-BR-05/09 | A-02, A-03 · Q-02/03 |
| S-054 | VH §12, VH-BR-08/23, DI-BR-22, CR-052 | — |
| S-055 | VH §12.1, VH-BR-18, CR-003 | — |
| S-056 | VH §13 | — |
| S-057 | VH-BR-17, CR-004/047/056/060 | A-05 · Q-05 |
| S-058 | VH §16 | A-01 · Q-01 |
| S-059 | VH §15.1, VH-BR-12 | A-16 |
| S-060 | VH §15.2, VH-BR-10/19 | A-05c |
| S-061 | UC-VH-12 | A-24 |
| S-062 | UC-VH-08, CR-058 | A-08 |

## 4. Điểm cần BA/dev lưu ý
1. Số ô ảnh: A-02 ghi 12 ngoại thất nhưng liệt kê 13 (thiết kế vẽ 13 + 7).
2. A-05c (hoàn tất khi chờ kế toán xác nhận) mâu thuẫn tinh thần “không giao khi chưa thu” — vẽ cả trạng thái chặn lẫn trạng thái baseline, chờ khách chốt.
3. Số điện thoại điều phối (028 3822 1234) chỉ là minh hoạ; cần cấu hình.
4. Màn khách (S-058) chỉ rút gọn; bản đầy đủ thuộc S-042…045 (GĐ4).
5. Bổ sung `components-gd5.css` (không sửa file dùng chung); icon “pause” vẽ inline SVG (chưa có trong `icons.js`).
