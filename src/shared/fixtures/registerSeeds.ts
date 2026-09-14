/**
 * Nạp toàn bộ seed step của các feature theo đúng thứ tự phụ thuộc dữ liệu
 * (danh mục nền trước — xe/khách/nhân viên — rồi mới tới lượt thuê/hợp đồng/
 * giao-nhận/sự cố/tài chính/ký gửi). Mỗi file `features/<x>/seed.ts` tự gọi
 * `registerSeedStep()` khi được import ở đây.
 *
 * Thứ tự seed bắt buộc (`docs/IMPLEMENTATION-PLAN.md` Phase 1): `employees` →
 * `customers` → `vehicles` (+ `maintenance`) — Vehicle Detail sẽ tham chiếu
 * chủ xe/nhân viên ở các tab sau này.
 *
 * File này chỉ import (side-effect) — không export gì để dùng trực tiếp.
 */

import '@/features/employees/seed'
import '@/features/customers/seed'
