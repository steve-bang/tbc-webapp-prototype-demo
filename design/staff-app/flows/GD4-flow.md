# GĐ4 — Khối hiện trường dùng chung: mô tả UI/UX flow

> Designer · 29/10/2026 · Màn `S-030` … `S-046` (file `screens/S-0xx-*.html`; ảnh `screenshots/<tên>.light.png|.dark.png`, đường dẫn `../screenshots/...`).
> Style riêng của GĐ4: `tokens/components-gd4.css` (nạp sau `components.css`; chỉ dùng token semantic). Icon thiếu: `mail` vẽ SVG inline (S-046).
> Nguồn: `VH §9–§20`, `VR §15–§18`, `DI §9–§10`, CR-2026-004/047/052/056/058/060, `notes/ASSUMPTIONS.md` (A-nn). Phase 1 **online-only** (CR-2026-058): không có hàng đợi đồng bộ. Mọi mốc tiền/khách: xem ràng buộc "ẩn" ở từng màn.
> Quy ước state: **D** mặc định · **L** loading · **E** rỗng · **R** lỗi · **O** mất mạng · **V** biến thể.

## 0. Bản đồ "dùng ở bước nào" (GĐ5/GĐ6 tái sử dụng — wizard chỉ tham chiếu)

| Khối (file) | Class/hàm chính | Giao xe (GĐ5) | Nhận xe (GĐ6) |
| --- | --- | --- | --- |
| S-030 Camera (`S-030-camera.html`) | `.cam-body .cam-view .cam-guide .cam-ref .shutter` | S-052 (ảnh odo/nhiên liệu), S-053 (lưới), S-055 (xe máy), S-056 (ảnh checklist tuỳ chọn), S-054 (ảnh hư hỏng) | S-072/S-073 (ảnh, **có ảnh Giao tham chiếu** `cam-ref`), S-076 (ảnh sự cố), S-082 (biên nhận) |
| S-031 Xem trước ảnh | viewer dark + `.meta-box` + `.compare`/`.pair-img` | mở từ S-034/S-030 | thêm **so sánh cặp** giao/nhận (S-074) |
| S-032 Video | `.rec-badge .rec-limit` | S-053 nhóm Video (tuỳ chọn) | S-073 nhóm Video |
| S-033 Quyền thiết bị | `.empty` + thẻ 3 bước | khi mở camera lần đầu bị từ chối | như Giao |
| S-034 Lưới ô ảnh | `.photo-slot.has-name`, `.prog-card .ring`, `.grp-head` | S-053 | S-073 (biến thể G: chỉ báo ảnh Giao ở mỗi ô) |
| S-035 Sơ đồ xe | `.car-svg .zone`, `.zone-row`, hàm `car(sel)` | ô "Vị trí" trong S-036 ← S-054 | S-076 |
| S-036 Form hư hỏng | `.sev-opt .baseline-cmp .photo-strip` | S-054 (biến thể A: baseline, **không** chi phí/đối chiếu) | S-076 (biến thể B/D: đối chiếu + chi phí dự kiến + cờ an toàn) |
| S-037 Panel Lịch sử | `.hist-panel .hist-item` | S-054 (phía **trên** form — `VH-BR-23`) | S-075 Đối chiếu (bổ sung, không thay baseline — `VR-BR-29`) |
| S-038 Chi tiết mốc | `.hero-photo .filtered-note` | từ S-037 | từ S-037 |
| S-039/040/041 Thu tiền | `.pay-item .pay-total .qr-card .result-center .diff-table` | **S-057** (B6) | S-083 (Could, sau cờ cấu hình, A-06) |
| S-042 → S-043/044/045 Khách xác nhận | `.cust-bar .handoff .choice-card .sign-big .otp-cell` | **S-058** (B7) | **S-084** (+ bảng phát sinh ước tính) |
| S-046 Chia sẻ | `.share-grid .link-box .share-log` | **S-060** (sau hoàn tất), S-061 (lịch sử) | **S-087**, S-088 |

Nguyên tắc chung GĐ4: nền camera/viewer **luôn tối** (bọc `data-theme="dark"` — Light và Dark giống nhau, dùng được ngoài trời); mọi trạng thái = màu + icon + chữ; vùng chạm ≥ 48dp (ô ảnh ≥ 96dp, nút chụp 76dp); chữ thông tin ≥ 13–14; lỗi theo mẫu "gì + cách sửa"; mọi nút icon có `aria-label`; overlay (dialog/sheet) có `role` + nút an toàn đặt trên, nút phá huỷ viền đỏ.

---

## S-030 · Camera chụp ảnh — `screens/S-030-camera.html`
- **Mục đích:** chụp một ô ảnh theo danh mục (`VH §14`); khi Nhận xe hiện ảnh lúc giao để chụp cùng góc (`VR-BR-10`). A-02, A-03 (không xin quyền vị trí; ảnh nén tự động; upload ngay — A-08).
- **Bố cục:** thanh trên (X · chip "Ô 3/19 · Trước xe" + nhóm · flash) · viewfinder + khung đứt nét + chú thích hướng dẫn · thanh dưới (thumbnail ảnh đã chụp có số · nút chụp 76dp · đổi camera).
- **Tương tác:** chạm nút chụp → chuyển S-031 (xem trước); chạm thumbnail → S-034; flash bật/tắt (mặc định tắt, `aria-label` nêu trạng thái); chạm PIP "Ảnh lúc giao" → phóng to (Nhận xe); X → quay về lưới (ảnh đã chụp giữ nguyên).
- **State:** [A] Giao ô 3/19 · [B] Nhận có `cam-ref` (V; có thể bật "mờ chồng" `is-ghost`) · [C] Lỗi chụp (R): nút chụp khoá, banner đỏ nêu "bộ nhớ < 100 MB" + cách xử lý · [D] Ánh sáng yếu (V): khung vàng + banner gợi ý flash.
- **Điều hướng:** vào từ ô trống (S-034), nút "Chụp lại" (S-031); quyền bị từ chối → S-033. Thiếu mạng không chặn chụp nhưng upload cần mạng (hiển thị ở lưới).
- **Edge:** xoay ngang (giữ khung); chụp liên tiếp tự nhảy ô kế (đề xuất); app nền bị thu hồi camera → quay lại lưới, không mất ảnh.
- **Quyền:** Delivery/Receiving Staff được phân công (`VH-BR-14`/`VR-BR-19`). **A11y:** shutter `aria-label="Chụp ảnh"`; hướng dẫn có chữ (không chỉ khung); tên ô đọc được bằng screen reader.
- **Mã:** `VH §14`, `VH-BR-09`, `VR-BR-10`, A-02/03/08. **Ảnh:** [`light`](../screenshots/S-030-camera.light.png) · [`dark`](../screenshots/S-030-camera.dark.png)

## S-031 · Xem trước & phóng to ảnh — `S-031-photo-preview.html`
- **Mục đích:** duyệt ảnh vừa chụp / ảnh trong lưới; chụp lại, xoá, xem metadata, cảnh báo mờ (`VH-BR-09`, `UC-VH-04`).
- **Bố cục:** app bar (tên ô + trạng thái · xoá) · ảnh lớn (chụm phóng to) · khối metadata (giờ chụp, ô, người chụp, phiên — chỉ đọc) · CTA hai nút: "Chụp lại" | "Dùng ảnh này".
- **State:** [A] D · [B] Ảnh mờ (V): banner vàng, nút chính đổi thành "Chụp lại", phụ "Vẫn giữ ảnh này" (phải cố ý) · [C] So sánh cặp Giao/Nhận (V, chỉ Nhận xe): 2 ảnh cạnh nhau + nhãn nguồn + thanh chồng ảnh · [D] Xác nhận xoá: dialog "Giữ ảnh" (an toàn, trên) / "Xoá ảnh" (đỏ viền).
- **Điều hướng:** Dùng ảnh → quay lưới (ô "Đã chụp"); Chụp lại → S-030 cùng ô; Xoá → ô trống, ghi audit.
- **Edge:** ảnh đang tải lên khi bấm xoá (huỷ upload); sau khi phiên COMPLETED chỉ xem (nhân viên không sửa — `VH-BR-12`). **A11y:** zoom có nút +/- thay cử chỉ (dev bổ sung); metadata là danh sách nhãn–giá trị.
- **Mã:** `VH-BR-09`, `UC-VH-04`, `VR-BR-10`. **Ảnh:** [light](../screenshots/S-031-photo-preview.light.png) · [dark](../screenshots/S-031-photo-preview.dark.png)

## S-032 · Quay video — `S-032-video.html`
- **Mục đích:** video tổng quan quanh xe, **tuỳ chọn** (A-02), ≤ 60 s, cảnh báo > 100 MB (A-03, cấu hình; ⚑Q-02/03).
- **State:** [A] Sẵn sàng · [B] Đang quay: `rec-badge` "REC 00:23" (chữ + chấm), thanh tiến độ tới 60 s, nút dừng · [C] Đạt giới hạn (V): tự dừng + banner · [D] Xem lại video · [E] Dung lượng lớn (V): cảnh báo, "Vẫn tải lên"/"Quay lại ngắn hơn" · [F] Lỗi tải (R): "Thử lại" tại chỗ (không hàng đợi nền).
- **Điều hướng:** từ thẻ "Quay video" của S-034 (nhóm Video) → dùng video → về lưới. **A11y:** `role="timer"` cho đếm giờ; nút quay/dừng đổi `aria-label`.
- **Edge:** thiếu bộ nhớ khi đang quay → tự dừng giữ phần đã quay; mic bị từ chối (không bắt buộc). **Mã:** `VH §11, §14.2`, A-02/03, CR-2026-058. **Ảnh:** [light](../screenshots/S-032-video.light.png) · [dark](../screenshots/S-032-video.dark.png)

## S-033 · Quyền thiết bị bị từ chối — `S-033-permissions.html`
- **Mục đích:** hướng dẫn mở Cài đặt. [A] Camera (chặn — không hoàn tất phiên thiếu ảnh) · [B] Thư viện ảnh (không chặn; ảnh thư viện vẫn ghi Capture Timestamp, A-03) · [C] Thông báo đẩy — **Phase 2** (Phase 1 chỉ in-app, CR-2026-053; vẽ sẵn, không hiển thị ở Phase 1).
- **Thành phần:** biểu tượng + tiêu đề + 1 câu giải thích hậu quả + thẻ "Cách bật lại" 3 bước + "Mở Cài đặt" (chính) + lối ra ("Để sau" / "Tiếp tục không dùng thư viện").
- **Edge:** quay lại app sau khi bật → tự kiểm tra lại quyền và đóng màn; **không xin quyền vị trí** (A-03). **Mã:** hạ tầng mobile, `VH §14`. **Ảnh:** [light](../screenshots/S-033-permissions.light.png) · [dark](../screenshots/S-033-permissions.dark.png)

## S-034 · Lưới ô ảnh bắt buộc — `S-034-photo-grid.html`
- **Mục đích:** nơi nhân viên thấy tiến độ ảnh và chọn ô cần chụp (`VH-BR-05`, `VR-BR-07`). Lưới **co giãn theo cấu hình N ô** (A-02).
- **Bố cục:** wiz-head · thẻ tiến độ (vòng + "x/y" + "Còn n ảnh bắt buộc" + chi tiết theo nhóm) · nhóm Ngoại thất (12 bắt buộc + "Nóc" tuỳ chọn theo loại xe) · Nội thất (6 bắt buộc + "Vùng khiếm khuyết" chỉ bắt buộc khi có hư hỏng) · Video (tuỳ chọn) · CTA "Tiếp tục" (khoá + hint nêu lý do).
- **Ô ảnh (6 trạng thái, icon + chữ):** trống (nét đứt, "Chạm để chụp") · đã chụp · đang tải % (`role="progressbar"`) · lỗi tải ("Thử lại") · mờ ("Chụp lại") · ngoại lệ chờ Manager duyệt.
- **State:** [A] D đang chụp dở · [B] L skeleton đúng hình ô · [C] R: banner nêu ô lỗi/mờ, CTA khoá · [D] O: dải offline, ô chưa chụp vô hiệu "Cần mạng" · [E] V Ngoại lệ: sheet lý do (chip + mô tả) → "Gửi Manager duyệt" (`VH EX-03`; duyệt ở Webapp) · [F] V Đủ ảnh: vòng 100%, CTA bật · [G] V Nhận xe: mỗi ô có chỉ báo ảnh Giao (`VR-BR-10`).
- **Điều hướng:** ô trống → S-030; ô đã chụp → S-031; "Quay video" → S-032; Tiếp tục → bước kế.
- **Lưu ý nguồn:** `ASSUMPTIONS A-02` ghi "12 ô ngoại thất" nhưng liệt kê 13 mục (có nóc "nếu áp dụng") → designer hiểu: 12 bắt buộc + nóc tuỳ chọn; **cần BA xác nhận con số**. ODO/nhiên liệu chụp ở S-052 và tự điền vào ô tương ứng (đề xuất).
- **A11y:** mỗi ô là `button` có `aria-label` "<tên ô> — <trạng thái>"; dấu `*` bắt buộc có `aria-label`. **Mã:** `VH-BR-05/09`, `VR-BR-07`, `VH EX-03`, A-02/08. **Ảnh:** [light](../screenshots/S-034-photo-grid.light.png) · [dark](../screenshots/S-034-photo-grid.dark.png)

## S-035 · Sơ đồ xe — chọn vị trí — `S-035-car-diagram.html`
- **Mục đích:** đánh dấu một/nhiều vị trí hư hỏng (`DI §10`, `VH §12`).
- **Bố cục:** segmented Bên ngoài | Nội thất · sơ đồ nhìn từ trên xuống (đầu xe ▲/đuôi ▼; vùng: cản trước, capô, nóc/kính, cốp, cản sau, hông trái/phải, 4 bánh) · danh sách "Đã chọn (n)" có số ghim · CTA "Xác nhận n vị trí".
- **Tương tác:** chạm vùng bật/tắt; vùng chọn = **tô đỏ + viền liền + ghim đánh số** (không chỉ màu); Nội thất dùng chip chọn nhiều (≥ 48dp).
- **State:** [A] chưa chọn (CTA khoá "Chọn ít nhất 1 vị trí") · [B] chọn nhiều · [C] Nội thất · [D] **Dạng danh sách** — thay thế sơ đồ cho chữ lớn/VoiceOver (hàng ≥ 48dp, thứ tự đầu → đuôi).
- **A11y:** mỗi vùng `role="button"` + `aria-label` + trạng thái đã chọn; vùng SVG nhỏ (hông ≈ 50dp) nên luôn có chế độ danh sách. **Ghi chú:** 4 mặt/nóc/nội thất của PLAN được thể hiện bằng sơ đồ top-view + tab nội thất (đơn giản hoá, báo BA nếu cần ảnh mặt bên).
- **Mã:** `DI §10`, `VH §12`, `VR-BR-09`. **Ảnh:** [light](../screenshots/S-035-car-diagram.light.png) · [dark](../screenshots/S-035-car-diagram.dark.png)

## S-036 · Form mục hiện trạng / hư hỏng — `S-036-damage-form.html`
- **Mục đích:** nhập một mục hư hỏng. **Giao xe = baseline** (`VH-BR-08`): loại · vị trí · mô tả · mức độ · ảnh (≥ 1, bắt buộc). **Nhận xe = sự cố** (`VR-BR-09`): thêm đối chiếu baseline (Đã có sẵn / Mới phát sinh / Nặng thêm — "đã có sẵn" **không tính phí**, `VR-BR-08`), chi phí dự kiến (nhập tay, nhãn "Ước tính"), cờ ảnh hưởng an toàn.
- **Thành phần:** chip loại (Trầy xước, Móp, Nứt/vỡ, Bong sơn, Nội thất, Tai nạn, Khác) · ô Vị trí → S-035 · mô tả · 4 mức (Nhẹ/Vừa/Nặng/Nghiêm trọng) · dải ảnh + "Thêm ảnh" → S-030 · (Nhận) đối chiếu, chi phí, switch an toàn.
- **State:** [A] Giao baseline (V) · [B] Nhận sự cố nhẹ (V): banner "Cần Manager xác nhận phí" — **không chặn** hoàn tất (`VR-BR-23`, A-07) · [C] Thiếu thông tin (R): lỗi từng trường + nút vẫn bấm được để cuộn tới lỗi đầu · [D] Nặng/tai nạn (V): khối tai nạn (bên thứ ba, biên bản, bảo hiểm), cờ an toàn bật → cảnh báo Vehicle `MAINTENANCE` (`VR-BR-20`); Manager xử lý tiếp ở Webapp.
- **Ẩn với nhân viên:** Liability, chi phí thực tế, claim, tranh chấp (`DI-BR-22`). **Edge:** nháp tự lưu khi thoát (A-08); xoá mục = dialog xác nhận; "Xe không có hư hỏng" xác nhận ở S-054, không ở đây.
- **A11y:** radio-group có `role="radiogroup"`; lỗi có icon + câu hướng dẫn. **Mã:** `VH-BR-08`, `VR-BR-08/09/20/23`, `DI §9`, A-07/18. **Ảnh:** [light](../screenshots/S-036-damage-form.light.png) · [dark](../screenshots/S-036-damage-form.dark.png)

## S-037 · Panel Lịch sử hiện trạng xe (rút gọn) — `S-037-condition-history-panel.html`
- **Mục đích:** cho nhân viên biết xe từng hỏng/sửa ở đâu để không ghi nhầm (CR-2026-052, `VH-BR-23`, `VR-BR-29`).
- **Thành phần:** đầu panel (icon lịch sử · "N mốc gần nhất · 12 tháng · chỉ đọc" · mũi tên) · thu gọn: 1 mốc gần nhất + badge "n sự cố đang sửa" + "Xem lịch sử" · mở rộng: timeline mốc **Giao xe / Trả xe / Sự cố**, mỗi mốc: ngày, tóm tắt, vị trí, ảnh thu nhỏ, trạng thái sửa rút gọn (**Chưa sửa / Đang sửa / Đã sửa / Đã đóng**), chân panel "Xem thêm 5 mốc | Thu gọn", ghi chú đã lọc.
- **Ẩn bắt buộc:** Liability, mọi số tiền, claim, tranh chấp, tên/SĐT khách. Không thay baseline lượt hiện tại.
- **State:** [A] thu gọn (mặc định) · [B] mở rộng (V đủ 4 trạng thái sửa) · [C] L skeleton · [D] E xe chưa có dữ liệu → **ẩn hẳn panel** · [E] R lỗi tải (không chặn luồng, "Thử lại") · [F] O dữ liệu tới lần tải gần nhất + mốc giờ.
- **Điều hướng:** chạm mốc → S-038. N/12 tháng cấu hình (mặc định 10/12). **A11y:** header là `button aria-expanded`; trạng thái sửa = icon + chữ.
- **Mã:** CR-2026-052, `VH-BR-23`, `VR-BR-29`, `DI-BR-22`, `VM-RULE-019`. **Ảnh:** [light](../screenshots/S-037-condition-history-panel.light.png) · [dark](../screenshots/S-037-condition-history-panel.dark.png)

## S-038 · Chi tiết mốc lịch sử — `S-038-history-detail.html`
- Bản ghi nguồn ở chế độ xem rút gọn: ảnh lớn + dải thumbnail, thẻ thông tin (loại mốc, ngày, vị trí, mô tả/tóm tắt, trạng thái sửa) + ghi chú "đã ẩn trách nhiệm, chi phí, bồi thường, tranh chấp, khách". Không có nút sửa/duyệt.
- State: [A] mốc Sự cố · [B] mốc Giao xe (không mã lượt/tên khách) · [C] L · [D] R "Không mở được bản ghi" (Thử lại / Quay lại lịch sử).
- **Mã:** CR-2026-052, `VH-BR-23`, `DI-BR-22`. **Ảnh:** [light](../screenshots/S-038-history-detail.light.png) · [dark](../screenshots/S-038-history-detail.dark.png)

## S-039 · Thu tiền theo mốc — `S-039-collect-payment.html`
- **Mục đích:** hiển thị khoản cần thu ở **mốc giao xe**: 70% Base Rental còn lại + Security Deposit (mốc đặt xe chỉ 30% đã thu — CR-2026-060); mỗi khoản một **QR VietQR động (SePay)** (A-05d). **Không có tiền mặt** trong luồng chính (A-05b). Khách không trả → "Hoãn giao / báo điều phối" (không ghi nợ — CR-2026-056).
- **Thành phần:** banner đã thu mốc đặt xe · `pay-item` mỗi khoản (nhãn rõ, số tiền, badge Chưa thu/Chờ chuyển/Đã thu, "Tạo mã QR") · tổng "Còn phải thu" · CTA "Tiếp tục" khoá tới khi đủ (`VH-BR-17`) · trang QR: mã nền sáng (đọc được cả Dark), số tiền lớn, ngân hàng/STK/nội dung CK, "Kiểm tra trạng thái", "Gửi mã QR cho khách".
- **State:** [A] CASH_20M (D, 2 khoản) · [B] QR (D) · [C] MOTORBIKE (V): thay Security Deposit bằng "Xe máy + cà vẹt" gắn baseline S-055 (`VH-BR-18`), chỉ 1 QR · [D] Khoản khác — Nhận xe (V, **Could**, sau cờ A-06; CASH_20M phát sinh đối trừ cọc, không thu) · [E] L tạo QR · [F] R không tạo được QR → Thử lại / S-041 · [G] O.
- **Ba con số tiền:** màn chỉ nói "cần thu hôm nay" — không trộn với ước tính phát sinh (Return) hay quyết toán.
- **A11y:** QR có text thay thế (số tiền + nội dung CK); số tiền `tabular-nums`. **Mã:** CR-2026-004/047/056/060, `VH-BR-17/18`, `VR-BR-26`, A-05/06. **Ảnh:** [light](../screenshots/S-039-collect-payment.light.png) · [dark](../screenshots/S-039-collect-payment.dark.png)

## S-040 · Chờ & kết quả thanh toán — `S-040-payment-result.html`
- State: [A] Chờ webhook (tự làm mới + "Kiểm tra ngay", đồng hồ hết hạn QR) · [B] Đã nhận (CONFIRMED, mã GD, giờ) → khoản kế · [C] QR hết hạn (tạo mới; vẫn "Kiểm tra giao dịch" phòng khách đã chuyển) · [D] **Thiếu**: Cần thu / Đã nhận / Còn thiếu, chặn hoàn tất, "Tạo QR phần thiếu" (A-05e) · [E] **Dư**: không chặn, ghi sổ để hoàn/cấn trừ ở Settlement, nhân viên không xử lý · [F] Lỗi/không xác minh: chặn giao xe, lối thử lại / thu thủ công / gọi điều phối · [G] O: hiện trạng thái cũ + giờ cập nhật.
- **A11y:** kết quả đọc bằng `role="status"`; đếm ngược `role="timer"`. **Mã:** CR-2026-047/056, `PM`, `VH-BR-17`, A-05. **Ảnh:** [light](../screenshots/S-040-payment-result.light.png) · [dark](../screenshots/S-040-payment-result.dark.png)

## S-041 · Xác nhận thu thủ công (baseline) — `S-041-manual-confirm.html`
- Dùng khi SePay chưa sẵn sàng/lỗi (A-05c — **phần BA tự đề xuất, rủi ro cao**). Bắt buộc: số tiền, **ảnh biên nhận**, tick "đã xem tiền vào"; giao dịch `PENDING` → "Chờ kế toán xác nhận"; nhân viên được tiếp tục nhưng có cảnh báo không giao xe khi chưa chắc tiền về; audit + đối soát cuối ngày.
- State: [A] trống · [B] đủ · [C] R thiếu · [D] V đã gửi — chờ kế toán. **Mã:** CR-2026-004/047 baseline, `PM-BR-10`, A-05. **Ảnh:** [light](../screenshots/S-041-manual-confirm.light.png) · [dark](../screenshots/S-041-manual-confirm.dark.png)

## S-042 · Chuyển thiết bị cho khách — `S-042-handoff-device.html`
- [A] Nhân viên: giải thích điều gì sẽ ẩn/hiện + "Đưa máy cho khách" · [B] Màn cho khách: dải **"Chế độ khách hàng"** cố định, xưng "anh/chị", chữ lớn, "Bắt đầu xem"; "Nhận lại thiết bị" của nhân viên **giữ 2 giây** (đề xuất UX để khách không bấm nhầm) · [C] hộp thoại nhận lại sớm.
- Ẩn mọi dữ liệu nội bộ (giá, cọc, công nợ, lịch sử); chặn thoát sang màn khác. **Mã:** `VH §16`, A-01. **Ảnh:** [light](../screenshots/S-042-handoff-device.light.png) · [dark](../screenshots/S-042-handoff-device.dark.png)

## S-043 · Khách xác nhận — M1 — `S-043-customer-ack-m1.html`
- A-01: M1 tổng thể cho Giao và Nhận. **Giao:** tóm tắt tối thiểu (odo, nhiên liệu vạch, hư hỏng có sẵn, giấy tờ/phụ kiện) + nút lớn "Tôi đã kiểm tra và đồng ý" / "Tôi không đồng ý". **Nhận:** thêm đối chiếu, bảng **khoản phát sinh dự kiến (nhãn "Ước tính", khoản chờ Manager hiển thị riêng — A-07)**, 3 lựa chọn Đồng ý / Đồng ý có bảo lưu / Không đồng ý.
- State: [A] Giao · [B] Nhận · [C] Giao — không đồng ý (ghi lý do; **chặn hoàn tất** tới khi xử lý) · [D] Nhận — bảo lưu (đánh dấu tranh chấp, báo Manager; từ chối vẫn hoàn tất, ghi "khách chưa xác nhận" — `VR §18`) · [E] Đã xác nhận → trả máy.
- **Ẩn với khách:** nội bộ nhân viên; số liệu quyết toán chốt. **Mã:** `VH §16`, `VR §18`, `AC-VR-015`, `VR-BR-23`, A-01/07. **Ảnh:** [light](../screenshots/S-043-customer-ack-m1.light.png) · [dark](../screenshots/S-043-customer-ack-m1.dark.png)

## S-044 · Khách xác nhận — M2 (ký) — `S-044-customer-ack-m2.html`
- Tuỳ chọn cấu hình (nên bật khi Nhận có phát sinh). Khung ký ≥ 240dp, "Ký lại" luôn có. State: [A] trống (xác nhận khoá) · [B] đang ký · [C] đã ký + xem lại · [D] R chữ ký quá ngắn. Lưu ảnh chữ ký gắn phiên. **Mã:** `VH §16`, A-01. **Ảnh:** [light](../screenshots/S-044-customer-ack-m2.light.png) · [dark](../screenshots/S-044-customer-ack-m2.dark.png)

## S-045 · Khách xác nhận — M3 (OTP) — `S-045-customer-ack-m3.html`
- **Mức Could, không vào luồng chính Phase 1** (A-01: chưa có kênh SMS/OTP cho khách). State: [A] nhập (6 ô + bàn phím số + đếm gửi lại) · [B] L · [C] R sai mã (còn 2 lần) · [D] R hết hạn → gửi lại · [E] R không gửi được → lối dùng M1 · [F] V đã xác nhận (che số). **Mã:** `VH §16`; CR-2026-034 chỉ bỏ OTP của nhân viên. **Ảnh:** [light](../screenshots/S-045-customer-ack-m3.light.png) · [dark](../screenshots/S-045-customer-ack-m3.dark.png)

## S-046 · Chia sẻ cho khách — `S-046-share-to-customer.html`
- **Điều kiện:** phiên `COMPLETED`. Gói chia sẻ (ảnh + biên bản tóm tắt; Nhận xe thêm **ảnh so sánh trước/sau**, biên bản **không có số quyết toán**), liên kết **7 ngày** không mật khẩu (A-24), kênh chính = share sheet hệ điều hành (Zalo T0 — không API, không cam kết đăng nhóm), fallback Nhắn SMS / Gọi khách, **luôn ghi lịch sử** (ai · khi nào · kênh).
- State: [A] Giao · [B] Nhận (V) · [C] share sheet OS (mock) · [D] L · [E] R lỗi tạo link (vẫn SMS/gọi) · [F] O · [G] lịch sử chia sẻ.
- **A11y:** nút chia sẻ có nhãn kênh; bảng OS là của hệ điều hành. **Mã:** `UC-VH-10`, `UC-VR-15`, `VH §17`, `ZL` T0, A-24. **Ảnh:** [light](../screenshots/S-046-share-to-customer.light.png) · [dark](../screenshots/S-046-share-to-customer.dark.png)

---

## Vấn đề tồn / câu hỏi cho BA
1. A-02 "12 ô ngoại thất" vs 13 mục liệt kê → xác nhận số ô bắt buộc (S-034).
2. Mức xác nhận M1/M2/M3 (A-01) và hành vi "không đồng ý" khi Giao (chặn) vs Nhận (cho hoàn tất) — chờ khách chốt (S-043…045).
3. A-05c: cho nhân viên hoàn tất giao xe khi giao dịch mới `PENDING` (S-041) — rủi ro gian lận, chờ khách; mô hình phí SePay còn treo (CR-2026-047).
4. Sơ đồ xe chỉ top-view (không có 4 ảnh mặt bên như PLAN) — báo BA/khách nếu muốn minh hoạ chi tiết hơn.
5. "Nhận lại thiết bị giữ 2 giây" (S-042) và ngưỡng chữ ký quá ngắn (S-044) là đề xuất UX của designer, không phải yêu cầu nghiệp vụ.
6. Thông báo đẩy (S-033C) chỉ vẽ sẵn cho Phase 2.
7. Token: `border-strong` Light chưa đạt 3:1 (đã nêu ở DESIGN-SYSTEM §6) — các viền ô ảnh/ô nhập của GĐ4 dùng token này.
