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
 * `incidents` chạy trước `finance` — `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §7
 * đọc trực tiếp `ReturnRecord` đã seed (qua `RETURN_RECORDS_STORAGE_KEY` của
 * `handover-return/api.ts`) để lấy ĐÚNG id một `ReturnIncidentItem` có thật
 * (không bịa id) khi tạo 1-2 `Incident` nguồn `RETURN` — buộc phải chạy sau
 * `handover-return/seed`.
 *
 * `finance` chạy cuối cùng — `docs/RENTAL-SETTLEMENT-PLAN.md` §7 đọc trực tiếp
 * `Rental`/`ReturnRecord`/`HandoverRecord`/`Incident` đã seed (qua storage key
 * export từ barrel `@/features/rentals`/`@/features/handover-return`/
 * `@/features/incidents`) để dựng `Settlement` bằng chính hàm thuần
 * `buildSourceLines`/`calcSettlementTotals`/`calcDepositReconciliation` — buộc
 * phải chạy sau cả 3 feature nguồn.
 *
 * `consignment` chạy NGAY TRƯỚC `finance` — `docs/CONSIGNMENT-PLAN.md` mục 10: đọc xe thật từ
 * `vehicles` (qua `VEHICLES_STORAGE_KEY`) để dựng snapshot điều khoản; vòng sau `finance` sẽ đọc
 * lịch chi trả của ký gửi để sinh chi phí `CONSIGNMENT_PAYOUT`, nên ký gửi phải có dữ liệu trước.
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
import '@/features/consignment/seed'
import '@/features/finance/seed'
// docs/DASHBOARD-PLATFORM-PLAN.md §9.2 — sau finance: chỉ đặt key `notifications` về rỗng (không phụ thuộc dữ liệu).
import '@/features/notifications/seed'
