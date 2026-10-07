/**
 * Nạp toàn bộ seed step của các feature theo đúng thứ tự phụ thuộc dữ liệu
 * (danh mục nền trước — xe/khách/nhân viên — rồi mới tới lượt thuê/hợp đồng/
 * giao-nhận/sự cố/tài chính/ký gửi). Mỗi file `features/<x>/seed.ts` tự gọi
 * `registerSeedStep()` khi được import ở đây.
 *
 * Thứ tự seed bắt buộc (`docs/IMPLEMENTATION-PLAN.md` Phase 1/2): `employees` →
 * `customers` → `vehicles` → `maintenance` → `rentals` — Vehicle Detail sẽ
 * tham chiếu chủ xe/nhân viên ở các tab sau này; `maintenance` tham chiếu id
 * xe đã seed; `rentals` (`docs/RENTAL-MANAGEMENT-PLAN.md` §7) tham chiếu
 * `customerId`/`vehicleId` thật nên phải chạy sau `customers`/`vehicles`.
 *
 * File này chỉ import (side-effect) — không export gì để dùng trực tiếp.
 *
 * `calendar` (Vehicle Block) chạy sau `rentals` —
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §11: không phụ thuộc chéo thật sự (chỉ
 * cần `vehicles` đã seed), nhưng giữ đúng thứ tự nhóm nghiệp vụ 3 sau nhóm 4,
 * và seed của `calendar` tham chiếu 1 Rental `CONFIRMED` cụ thể từ `rentals/seed.ts`.
 *
 * `contracts` chạy trước `handover-return` — `docs/CONTRACT-MANAGEMENT-PLAN.md`
 * §7 tham chiếu `rentalId`/`customerId`/`vehicleId` thật từ `rentals`/
 * `customers`/`vehicles` đã seed (chỉ chọn Rental status `CONTRACT_CREATED`
 * trở lên).
 *
 * `handover-return` chạy trước `incidents` — `docs/HANDOVER-RETURN-
 * MANAGEMENT-PLAN.md` §7/§9 tham chiếu `rentalId` thật từ `rentals/seed.ts`
 * (các Rental đã ở trạng thái `HANDED_OVER`/`IN_RENTAL`/`RETURNED`/
 * `SETTLEMENT`/`COMPLETED`/`CANCELLED`) — không phụ thuộc `contracts`, nhưng
 * giữ đúng thứ tự nhóm nghiệp vụ 4 (Lượt thuê & hợp đồng) trước nhóm 5
 * (Giao/nhận & sự cố).
 *
 * `incidents` chạy cuối cùng — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §7
 * đọc trực tiếp `ReturnRecord` đã seed (qua `RETURN_RECORDS_STORAGE_KEY` của
 * `handover-return/api.ts`) để lấy ĐÚNG id một `ReturnIncidentItem` có thật
 * (không bịa id) khi tạo 1-2 `Incident` nguồn `RETURN` — buộc phải chạy sau
 * `handover-return/seed`.
 */

import '@/features/employees/seed'
import '@/features/customers/seed'
import '@/features/vehicles/seed'
import '@/features/maintenance/seed'
import '@/features/rentals/seed'
import '@/features/calendar/seed'
import '@/features/contracts/seed'
import '@/features/handover-return/seed'
import '@/features/incidents/seed'
