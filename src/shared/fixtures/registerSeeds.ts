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
 */

import '@/features/employees/seed'
import '@/features/customers/seed'
import '@/features/vehicles/seed'
import '@/features/maintenance/seed'
import '@/features/rentals/seed'
import '@/features/calendar/seed'
