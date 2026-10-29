# GĐ6 — Wizard Nhận xe (VR) · Mô tả UI/UX flow

> designer · 29/10/2026 · Màn: S-070 … S-088 (`screens/`), ảnh `screenshots/<tên>.light|dark.png`, CSS bổ sung `tokens/components-gd6.css` (tiền tố `vr-`).
> Nguồn: `VR §8–§19, §23`, `VR-BR-02…29`, `UC-VR-01…20`, `DI §9/§17`, CR-2026-003/009/010/011/023/024/047/052/054/055/057/058/062; giả định A-01, A-04, A-06, A-07, A-08, A-11, A-14, A-18, A-21, A-23, A-24, A-25.
> Chuẩn chung: wizard ẩn tab bar; header = nút X (thoát/tạm dừng, nhãn "Thoát hoặc tạm dừng") + tiêu đề "Nhận xe · biển số" + "Bước n/10 · tên bước" + trợ giúp; stepper 10 đoạn (xong = xanh lá, hiện tại = xanh dương, chưa = xám; kèm chữ "Bước n/10"); dải **Lúc giao** (xanh nhạt, chạm mở rộng) luôn hiện ở R2–R9 (giờ giao · odo · vạch); CTA đáy cố định (Quay lại + Tiếp tục), khi khoá luôn có dòng giải thích lý do (`cta-hint`). Vùng chạm ≥ 48dp, chữ bắt buộc ≥ 13–14px, trạng thái = màu + icon + chữ. Light + Dark đã chụp. Phase 1 online-only: **O** = banner đen "Mất kết nối mạng" + thao tác cần máy chủ khoá + Thử lại; không có hàng đợi đồng bộ.

## 0. Sơ đồ luồng

```text
Chi tiết việc (S-022) ──"Bắt đầu / Tiếp tục nhận xe"──▶ R1 S-070 Kiểm tra điều kiện & nạp Handover
   ├─ NOT_ELIGIBLE: chưa giao / đã có phiên nhận ─▶ Xem lại S-088 / sai người ─▶ S-095 / sai trạng thái ─▶ Gọi điều phối
   └─ ELIGIBLE (hoặc "Tiếp tục phiên dở")
        ▼
   ┌─ Tổng quan S-071 (chạm X/stepper; nhảy bước tự do, A-04) ──────────────────────────────┐
   │ R2 S-072 Số liệu (giờ·odo·vạch) ──odo<giao──▶ CHẶN CỨNG + báo Manager (S-094)         │
   │ R3 S-073 Bộ ảnh (ảnh giao làm tham chiếu) ◀─ camera S-030/031, lỗi tải S-099           │
   │ R4 S-074 Đối chiếu trước/sau (+ panel Lịch sử S-037) ──khác biệt mới──▶ ghi sự cố      │
   │ R5 S-075 Sự cố ─ nặng/an toàn ▶ S-076 ; nhẹ ▶ S-077 gửi Manager duyệt (không chặn)    │
   │ R6 S-078 Return Checklist (Thiếu/Hỏng ▶ khoản dự kiến)                                  │
   │ R7 S-079 VETC ⇄ S-080 Phạt nguội (tab)                                                  │
   │ R8 S-081 Bảng ước tính ─ sheet S-082 (nhiên liệu / tận nơi) ─ tuỳ chọn S-083 thu QR    │
   │ R9 S-084 Khách xác nhận (S-042 đưa máy cho khách) ─ sửa dữ liệu ▶ huỷ xác nhận cũ      │
   │ R10 S-085 Rà soát & hoàn tất (all-or-nothing)                                           │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
        ▼
   S-086 Hoàn tất ──▶ Chia sẻ cho khách S-046 (kèm ảnh so sánh) ──▶ Hôm nay
   Cọc MOTORBIKE: S-087 đối chiếu & trả xe máy (khoá tới khi khách thanh toán xong)
   Sau này: Việc đã xong ─▶ S-088 Xem lại (chỉ đọc)
```

Khác biệt cần BA/dev lưu ý: **R-số = số bước** (R2 = bước 2/10). Gate R1 tính là bước 1 để mã R khớp stepper.

---

## 1. S-070 · R1 Kiểm tra tiền điều kiện & nạp Handover
Ảnh: `../screenshots/S-070-nhan-xe-tien-dieu-kien.light.png` · `.dark.png`
- **Mục đích:** chặn sớm việc không hợp lệ, nạp dữ liệu Handover làm mốc đối chiếu. Mã: `VR §8`, `VR-BR-02/06/19`, CR-2026-055.
- **Bố cục:** app bar có back; thẻ tóm tắt việc (Nhận xe 21:00, xe, biển số, khách + SĐT bấm gọi, địa điểm); danh sách 4 điều kiện (Rental đang cho thuê · có Handover COMPLETED · chưa có Return hoàn tất · được phân công); khối "Đã nạp dữ liệu lúc giao" (giờ, odo, vạch, số ảnh, hiện trạng có sẵn, phụ kiện); CTA đáy.
- **State vẽ:** L (kiểm tra tuần tự, spinner từng dòng) · ELIGIBLE · mở lại phiên dở (banner + "Tiếp tục từ bước n", "Huỷ nháp và làm lại" viền đỏ tách xa, A-08) · NOT_ELIGIBLE ×4 (chưa giao; đã có phiên nhận → "Xem lại"; không được phân công = chặn cứng, **ẩn tên/SĐT khách**; Rental sai trạng thái) · R lỗi máy chủ (mã lỗi để báo) · O.
- **Tương tác/điều hướng:** kiểm tra chạy tự động khi vào; ELIGIBLE → "Bắt đầu nhận xe" → S-072; lối ra bắt buộc có ở mọi lỗi (Gọi điều phối, Về việc hôm nay). Chặn = đỏ + icon `ban` + chữ.
- **Quyền:** OPERATION_STAFF được phân công; MANAGER/SYSTEM_ADMIN ghi đè phân công. **A11y:** danh sách `role=list`, banner lỗi `role=alert`, spinner có chữ "Đang kiểm tra…".
- **Edge:** phiên dở do máy khác → vẫn tiếp tục (dữ liệu ở server), cảnh báo "một thiết bị một lúc" (A-08).

## 2. S-071 · Khung wizard & Tổng quan phiên
Ảnh: `../screenshots/S-071-nhan-xe-tong-quan.light.png`
- **Mục đích:** biết đang ở đâu, thiếu gì, nhảy bước (A-04). **Bố cục:** thẻ tiến độ chứng cứ (ảnh x/20, checklist x/7), 10 hàng bước (✓ Xong / ! Cần xử lý / Thiếu / Chưa làm + chevron), thẻ Handover tham chiếu (Giao → Nhận); CTA "Tiếp tục bước n" / "Làm bước thiếu đầu tiên" / "Rà soát và hoàn tất".
- **State:** đang làm · có bước thiếu (hàng đỏ nêu rõ thiếu gì) · sẵn sàng hoàn tất · O.
- **Validation:** Rà soát (bước 10) khoá tới khi đủ bước bắt buộc, hint liệt kê bước còn thiếu.
- **Edge:** sửa dữ liệu ở bước trước sau khi khách xác nhận → bước 9 quay về "Chưa làm" (xem S-084).

## 3. S-072 · R2 Số liệu nhận
Ảnh: `../screenshots/S-072-nhan-xe-so-lieu.light.png`
- **Mục đích:** ghi giờ trả, odo, vạch nhiên liệu + ảnh đồng hồ; tính sơ bộ. `VR §10`, `VR-BR-03/04/05`, CR-2026-023/054.
- **Bố cục:** giờ trả (mặc định hiện tại, nút "Bây giờ") · odo cỡ lớn (64dp, tabular-nums) + 2 ô ảnh (odo, nhiên liệu) · nhiên liệu: thanh vạch 1–8 + stepper −/+ (≥48dp) · khối "Tính sơ bộ": đã chạy, cho phép (350 km × số ngày), vượt km (hiển thị 202, tính phí 210 do làm tròn), thiếu vạch, trễ giờ.
- **Validation:** giờ không trước giờ giao, không tương lai (lỗi inline); **odo < odo giao = CHẶN CỨNG**: banner đỏ + lỗi ô + nút "Báo Manager" + CTA khoá (VR-BR-03, A-21); ngưỡng lệch lớn (A-25) → hộp thoại S-094.
- **State:** mặc định (trễ ngoài ân hạn) · trễ trong ân hạn 15' (xanh, không phí) · odo thấp · giờ tương lai · đang lưu (skeleton) · O (giữ giá trị, ghi chú "chưa lưu").
- **Edge:** vạch nhận > vạch giao → không phí; thang vạch tối đa theo hồ sơ xe (mặc định 8); xe điện chưa hỗ trợ (A-18).

## 4. S-073 · R3 Bộ ảnh nhận
Ảnh: `../screenshots/S-073-nhan-xe-bo-anh.light.png`
- **Bố cục:** thẻ tiến độ (x/20), tab Ngoại thất / Nội thất / Video, chú thích khung xanh = ảnh lúc giao; lưới ô 2 cột, mỗi ô có **tên góc** + **ô nhỏ ảnh Handover cùng góc** (chạm phóng to, VR-BR-10). Ô odo/nhiên liệu khoá "từ bước 2".
- **State ô:** trống · đã chụp · đang tải % · lỗi tải (chạm thử lại) · mờ (chụp lại) · ngoại lệ chờ Manager duyệt. Screen: hỗn hợp · nội thất đủ + video tuỳ chọn (≤ 60s) · L · R (banner "Thử lại tất cả" → S-099) · O.
- **Validation:** thiếu ảnh/ô lỗi/mờ → CTA khoá + hint số ô còn thiếu (VR-BR-07). Camera/preview dùng S-030/S-031. Ghi chú: BA liệt kê 13 ô ngoại thất dù ghi "12" — lưới co giãn theo cấu hình (A-02).

## 5. S-074 · R4 Đối chiếu trước/sau
Ảnh: `../screenshots/S-074-nhan-xe-doi-chieu.light.png`
- **Bố cục:** bảng Giao → Nhận (giờ, odo, vạch, Δ km, Δ vạch) · mỗi khác biệt 1 thẻ: cặp ảnh (vòng đỏ đánh dấu), nhãn "Khác biệt mới / Trùng baseline", phân loại **Đã có sẵn | Phát sinh mới** (VR-BR-08), nút "Ghi thành sự cố" · panel Lịch sử hiện trạng rút gọn (thu gọn/mở rộng; ẩn Liability, tiền, claim, khách — CR-2026-052, VR-BR-29).
- **State:** đầy đủ · chưa phân loại (CTA khoá) · chưa có ảnh đối chiếu (ghi chú, không quy kết) · panel mở rộng · L · R (không tải được ảnh giao) · O.
- **Edge:** trùng baseline → không tính phí; phân loại "Phát sinh mới" nhưng chưa có sự cố → nhắc tạo ở R5.

## 6. S-075 · R5 Sự cố phát sinh
Ảnh: `../screenshots/S-075-nhan-xe-su-co.light.png`
- Thẻ tổng (số mục, chi phí dự kiến nhân viên nhập) + thẻ mỗi mục: loại/vị trí, mức (Nhẹ/Nặng·an toàn), ảnh, đối chiếu baseline, chi phí, trạng thái ("Chờ Manager duyệt"/"Báo Manager xử lý"), Sửa/Xoá; "Thêm sự cố" → S-035/S-036.
- **State:** có 2 mục · E (xác nhận có chủ đích "không phát sinh sự cố") · R thiếu ảnh/chi phí (CTA khoá, VR-BR-09) · O. Mục nặng/an toàn hiện banner "xe sẽ chuyển Bảo dưỡng" (VR-BR-20).

## 7. S-076 · R5b Sự cố nặng / tai nạn
Ảnh: `../screenshots/S-076-nhan-xe-su-co-nang.light.png`
- Banner đỏ cảnh báo Bảo dưỡng; công tắc "Có tai nạn" mở: diễn biến (bắt buộc), bên thứ ba, biển số, ảnh biên bản, bảo hiểm. Nhân viên **không** nhập trách nhiệm/bồi thường — Manager xử lý ngoài Return (CR-2026-010, DI-BR-22). State: không tai nạn · có tai nạn · thiếu mô tả. ⚑ Danh sách trường là đề xuất, chờ BA.

## 8. S-077 · R5c Manager duyệt phí nhẹ
Ảnh: `../screenshots/S-077-nhan-xe-duyet-phi-nhe.light.png`
- Nút "Gửi Manager duyệt" → chip **Chờ duyệt / Đã duyệt / Từ chối** (+ người duyệt, giờ, lý do); **không chặn hoàn tất** (A-07); khoản chờ duyệt không cộng vào tổng; kết quả về Thông báo + toast. State: chưa gửi · chờ · duyệt · từ chối · lỗi gửi · O (Phase 1 không có nhánh "đã hỏi ý kiến" offline). Phí nhiên liệu không qua bước này (VR-BR-28). Nhân viên không có quyền duyệt.

## 9. S-078 · R6 Return Checklist
Ảnh: `../screenshots/S-078-nhan-xe-checklist.light.png`
- Mục sinh từ Handover ("Lúc giao: Đã giao"); mỗi mục 4 lựa chọn **Đủ / Thiếu / Hỏng / Không áp dụng** (cao 48, chọn = màu + icon + chữ); Thiếu/Hỏng mở chi phí dự kiến (bắt buộc, MISSING_ACCESSORY), ghi chú, ảnh tuỳ chọn. Thẻ tiến độ x/7. State: đang xử lý · đủ (tổng khoản phụ kiện) · thiếu chi phí · E (Handover không ghi phụ kiện).

## 10. S-079 / S-080 · R7 VETC & Phạt nguội (nhập tay)
Ảnh: `../screenshots/S-079-nhan-xe-vetc.light.png`, `../screenshots/S-080-nhan-xe-phat-nguoi.light.png`
- Một bước, hai tab (đếm số khoản). Thẻ khoản + form bottom sheet (VETC: số tiền, thời gian, trạm, mã tham chiếu, ảnh, ghi chú; Phạt: biển, thời gian, địa điểm, nội dung, tiền, ảnh, nguồn).
- **VETC ngoài khoảng thuê** [Actual Pickup → Actual Return]: cảnh báo vàng + **lý do bắt buộc** mới liên kết (VR §16). **Phạt nguội**: gợi ý liên kết Rental khi thời điểm nằm trong khoảng thuê; thuộc Rental đã COMPLETED → nhãn Post-Settlement Charge, không mở lại quyết toán (VR-BR-14). E ở cả hai (không chặn). Tự động VETC/phạt = Phase 2.

## 11. S-081 · R8 Bảng ước tính phát sinh
Ảnh: `../screenshots/S-081-nhan-xe-uoc-tinh.light.png`
- Nhãn đứt nét "**Ước tính — quản lý chốt ở bước quyết toán**" (VR-BR-12). Mỗi hàng: icon + tên khoản + công thức + số tiền; hàng sửa được có chevron (VETC/phạt → S-079/080, nhiên liệu & tận nơi → S-082). Khoản: vượt km (làm tròn lên 10 km × đơn giá Class, CR-2026-057) · thiếu nhiên liệu (nhập tay) · trễ giờ (ân hạn 15', ≤1h 10% …, CR-2026-054) · phụ kiện · VETC · phạt nguội · phí tận nơi (15.000 ₫/km, CR-2026-062) · sự cố chờ duyệt (nền vàng, **không** vào tổng) · sự cố nặng "Ngoài ước tính". Tổng + ghi chú "Chưa gồm khoản chờ duyệt".
- **Không hiển thị** tiền thuê, cọc, đối trừ (EA-BR-17; Settlement ≠ Cost Record ≠ Payment).
- **State:** có phát sinh · không phát sinh (0 ₫, banner xanh) · giữ xe qua đêm (½/1 ngày, loại trừ phí trễ theo giờ) · L · R thiếu đầu vào (hàng đỏ + CTA khoá) · O.
- Số liệu mẫu: tổng minh hoạ 2.862.000 ₫ = 1.050.000 + 330.000 + 120.000 + 180.000 + 72.000 + 900.000 + 210.000.

## 12. S-082 · R8b Nhập phí nhiên liệu & tận nơi
Ảnh: `../screenshots/S-082-nhan-xe-nhien-lieu-tan-noi.light.png`
- Bottom sheet. **Nhiên liệu:** vạch giao/nhận + số vạch thiếu (tự tính, chỉ đọc) + số tiền do nhân viên nhập (không tự tính, không Manager duyệt — VR-BR-28). **Tận nơi:** tổng km lái xe 2 lượt (nhập tay) + nút "Mở Google Maps để đo" (A-14) + khối tính: miễn phí 10 km, tính phí n km × 15.000 ₫. State: có phát sinh · không phát sinh · chưa nhập · tận nơi có phí · trong 10 km (0 ₫) · km sai.

## 13. S-083 · R8c Thu khoản phát sinh tại chỗ (Could)
Ảnh: `../screenshots/S-083-nhan-xe-thu-phat-sinh.light.png`
- Chỉ khi bật cấu hình (A-06): QR VietQR động (SePay, CR-2026-047) cho **phí tận nơi**; còn lại đối trừ cọc ở quyết toán. State: chờ · đã thu · hết hạn/chưa thu ("Để quyết toán xử lý", không ghi nợ) · O (không tạo được QR). ⚑Q-06.

## 14. S-084 · R9 Khách xác nhận (nhận)
Ảnh: `../screenshots/S-084-nhan-xe-khach-xac-nhan.light.png`
- Màn **dành cho khách** (sau S-042 "Đưa điện thoại cho khách"; nút "Nhận lại thiết bị (nhân viên)" ở đáy). Tóm tắt: xe, giờ, odo, vạch, hư hỏng mới (chờ quản lý xác nhận), phụ kiện, bảng phát sinh tạm tính + "Số tiền cuối cùng do công ty xác nhận khi quyết toán". 3 thẻ chọn: **Tôi đã kiểm tra và đồng ý (M1)** / **Đồng ý có bảo lưu** (ý kiến bắt buộc, đánh dấu tranh chấp) / **Không đồng ý – từ chối** (vẫn hoàn tất, "khách chưa xác nhận", báo Manager). M2 ký màn hình: tuỳ chọn cấu hình, bật khi có phát sinh (AC-VR-015). M3 OTP không làm (A-01). ⚑Q-01.
- State: chưa chọn (CTA khoá) · đồng ý · đồng ý + ký · bảo lưu · từ chối · (nhân viên) dữ liệu đổi sau khi khách xác nhận → xác nhận cũ bị huỷ, cần xác nhận lại. Không hiển thị Liability/claim.

## 15. S-085 · R10 Rà soát & hoàn tất
Ảnh: `../screenshots/S-085-nhan-xe-ra-soat.light.png`
- 8 hàng kiểm (✓/✗ + mô tả), hàng lỗi có nút "đi tới"; khối "Sau khi hoàn tất" (không sửa được, VR-BR-11; xe → Bảo dưỡng nếu sự cố an toàn). State: đạt · còn mục thiếu (CTA khoá) · hộp thoại xác nhận (nút an toàn ở trên) · đang hoàn tất · lỗi máy chủ (all-or-nothing, thử lại an toàn) · O.

## 16. S-086 · Hoàn tất nhận xe
Ảnh: `../screenshots/S-086-nhan-xe-hoan-tat.light.png`
- Icon thành công lớn; copy trung tính "Bước quyết toán do quản lý/kế toán thực hiện" (A-23); trạng thái xe (Sẵn sàng / Bảo dưỡng); CTA chính "Chia sẻ cho khách (kèm ảnh so sánh)" → S-046; "Về Hôm nay". State: xe sẵn sàng · Bảo dưỡng · khách chưa xác nhận · lỗi tạo link chia sẻ (nhận xe vẫn hoàn tất).

## 17. S-087 · Đối chiếu & trả xe máy cọc
Ảnh: `../screenshots/S-087-nhan-xe-xe-may-coc.light.png`
- Chỉ khi cọc MOTORBIKE. So sánh xe máy (odo, vạch, cà vẹt, ảnh) với baseline; **nút trả xe máy khoá tới khi khách thanh toán xong** (VR-BR-26, CR-2026-003; phát sinh trả bằng QR, không đối trừ xe máy). State: khoá · mở khoá · đã trả (chỉ đọc) · không tải được thanh toán (giữ khoá) · xe máy có hư hỏng mới.

## 18. S-088 · Xem lại Nhận xe (chỉ đọc)
Ảnh: `../screenshots/S-088-nhan-xe-xem-lai.light.png`
- Huy hiệu "Chỉ đọc", banner chỉnh sửa chỉ Manager; danh sách 8 nhóm (số liệu, ảnh/video + so sánh, đối chiếu, sự cố, checklist, VETC/phạt, bảng ước tính, nhật ký & chia sẻ); "Chia sẻ lại cho khách". State: tóm tắt · chi tiết mở rộng (nhật ký COMPLETE/CUSTOMER_ACK/SHARE_MEDIA, nguồn RETURN_APP) · L · R · O.

---

## Điểm cần BA/dev lưu ý
1. Stepper 10 bước (R1 = gate). 2. Danh sách ô ảnh ngoại thất 13 ô vs "12" trong A-02. 3. **Nhân viên không thấy Base Rental/cọc** trong bảng ước tính, chỉ các khoản phát sinh (EA-BR-17) — `VR §15.8` có "Base Rental (tham khảo)": cần BA xác nhận có hiển thị không. 4. Tận nơi: nhập "tổng km 2 lượt" một ô (đề xuất) — BA xác nhận cách đo lượt giao. 5. Ngưỡng phí trễ dùng đơn giá ngày ẩn trong công thức. 6. S-076 trường bảo hiểm/bên thứ ba là đề xuất. 7. ⚑Q-01, Q-06, Q-07 vẫn chờ khách.
