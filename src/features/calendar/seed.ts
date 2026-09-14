import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { writeJson } from '@/shared/lib/storage'
import { VEHICLE_BLOCKS_STORAGE_KEY } from './api'
import type { VehicleBlock } from './model'

/** `YYYY-MM-DD` tính từ hôm nay ± số ngày — cùng pattern `features/maintenance/seed.ts`/`features/vehicles/seed.ts`. */
function isoDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** `YYYY-MM-DDT02:00:00.000Z` — giờ cố định cho `createdAt`/`updatedAt`/`releasedAt` tính từ ngày. */
function dtAt(dateIso: string): string {
  return `${dateIso}T02:00:00.000Z`
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §7 — 5 bản ghi `VehicleBlock` (trong dải
 * 4-6 gợi ý): 3 `ACTIVE` (1 trùng lượt `CONFIRMED` `rt_010` của `veh_014` để
 * demo cảnh báo "lượt bị ảnh hưởng", 1 không trùng lượt nào của `veh_009`, 1
 * khoá vô thời hạn của `veh_013`) + 2 `RELEASED` (giữ lịch sử). Id xe tham
 * chiếu đúng `features/vehicles/seed.ts` (18 xe), id lượt thuê tham chiếu
 * đúng `features/rentals/seed.ts` (`rt_010` CONFIRMED, `veh_014`, `dt(5,9,0)`
 * → `dt(7,21,0)`) — `registerSeeds.ts` chạy `calendar` sau `rentals`.
 */
function seedVehicleBlocks(): void {
  const blocks: VehicleBlock[] = [
    {
      // Trùng rt_010 (CONFIRMED, veh_014, dt(5,9,0) → dt(7,21,0)) — demo cảnh báo findRentalsAffectedByBlock().
      id: 'vblk_001',
      vehicleId: 'veh_014',
      startDate: isoDateOffset(4),
      endDate: isoDateOffset(8),
      reason: 'Xe bị tai nạn nhẹ, chờ giám định bảo hiểm trước khi giao khách tiếp theo.',
      status: 'ACTIVE',
      createdByUserId: 'usr_sales', // Phạm Thị Kinh Doanh (SALES) — features/employees/seed.ts
      createdByName: 'Phạm Thị Kinh Doanh',
      createdByRole: 'SALES',
      createdAt: dtAt(isoDateOffset(4)),
      updatedAt: dtAt(isoDateOffset(4)),
    },
    {
      // veh_009 chỉ có rt_003 (DRAFT) — không có Rental CONFIRMED+ nào bị ảnh hưởng.
      id: 'vblk_002',
      vehicleId: 'veh_009',
      startDate: isoDateOffset(15),
      endDate: isoDateOffset(20),
      reason: 'Đưa xe đi bảo dưỡng lớn ngoài lịch định kỳ.',
      status: 'ACTIVE',
      createdByUserId: 'usr_admin', // Nguyễn Văn Admin (SYSTEM_ADMIN)
      createdByName: 'Nguyễn Văn Admin',
      createdByRole: 'SYSTEM_ADMIN',
      createdAt: dtAt(isoDateOffset(15 - 3)),
      updatedAt: dtAt(isoDateOffset(15 - 3)),
    },
    {
      // Khoá vô thời hạn (endDate trống) — CR-2026-015 câu 2 còn Open Question, veh_013 đã INACTIVE
      // (Vehicle Block độc lập với Vehicle.status — CR-2026-015).
      id: 'vblk_003',
      vehicleId: 'veh_013',
      startDate: isoDateOffset(-5),
      reason: 'Xe hư nặng, chờ chủ xe quyết định thanh lý hợp đồng ký gửi — khoá vô thời hạn.',
      status: 'ACTIVE',
      createdByUserId: 'usr_admin',
      createdByName: 'Nguyễn Văn Admin',
      createdByRole: 'SYSTEM_ADMIN',
      createdAt: dtAt(isoDateOffset(-5)),
      updatedAt: dtAt(isoDateOffset(-5)),
    },
    {
      // Đã gỡ khoá — giữ lịch sử (không xoá).
      id: 'vblk_004',
      vehicleId: 'veh_006',
      startDate: isoDateOffset(-40),
      endDate: isoDateOffset(-35),
      reason: 'Tai nạn nhẹ khi giao xe, đã sửa xong.',
      status: 'RELEASED',
      createdByUserId: 'usr_sales',
      createdByName: 'Phạm Thị Kinh Doanh',
      createdByRole: 'SALES',
      releasedByUserId: 'usr_manager', // Trần Thị Quản Lý (MANAGER)
      releasedByName: 'Trần Thị Quản Lý',
      releasedByRole: 'MANAGER',
      releasedAt: dtAt(isoDateOffset(-34)),
      createdAt: dtAt(isoDateOffset(-40)),
      updatedAt: dtAt(isoDateOffset(-34)),
    },
    {
      id: 'vblk_005',
      vehicleId: 'veh_002',
      startDate: isoDateOffset(-20),
      endDate: isoDateOffset(-15),
      reason: 'Kiểm tra định kỳ theo yêu cầu chủ xe ký gửi.',
      status: 'RELEASED',
      createdByUserId: 'usr_admin',
      createdByName: 'Nguyễn Văn Admin',
      createdByRole: 'SYSTEM_ADMIN',
      releasedByUserId: 'usr_admin',
      releasedByName: 'Nguyễn Văn Admin',
      releasedByRole: 'SYSTEM_ADMIN',
      releasedAt: dtAt(isoDateOffset(-14)),
      createdAt: dtAt(isoDateOffset(-20)),
      updatedAt: dtAt(isoDateOffset(-14)),
    },
  ]

  writeJson(VEHICLE_BLOCKS_STORAGE_KEY, blocks)
}

registerSeedStep(seedVehicleBlocks)
