import { registerSeedStep } from '@/shared/fixtures/seedAll'
import { writeJson } from '@/shared/lib/storage'
import {
  MAINTENANCE_RECORDS_STORAGE_KEY,
  MAINTENANCE_RULES_STORAGE_KEY,
  SPARE_PART_RECORDS_STORAGE_KEY,
} from './api'
import type { MaintenanceRecord, MaintenanceRule, SparePartRecord } from './model'

/** `YYYY-MM-DD` tính từ hôm nay ± số ngày — cùng pattern `features/vehicles/seed.ts`. */
function isoDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const SEEDED_BY = 'Hoàng Văn Nhân Viên' // OPERATION_STAFF demo — features/employees/seed.ts

/**
 * `docs/MAINTENANCE-MANAGEMENT-PLAN.md` §7 — id xe tham chiếu đúng
 * `features/vehicles/seed.ts` (18 xe, chạy trước — `registerSeeds.ts`):
 * `veh_001`/`veh_017` = Toyota Camry (18.500/6.200 km), `veh_007` = Toyota
 * Vios (51.200 km, đang `MAINTENANCE`), `veh_015` = Toyota Innova (56.000
 * km). Không import trực tiếp từ `features/vehicles` ở đây — dữ liệu xe cố
 * định, tham chiếu bằng id/model/currentKm đã biết (giống cách `vehicles`
 * seed cũng khai hoàn toàn literal).
 */
function seedMaintenance(): void {
  const rules: MaintenanceRule[] = [
    {
      id: 'mtrule_001',
      category: 'Thay dầu máy',
      thresholdKm: 5000,
      appliesTo: 'VEHICLE_MODEL',
      vehicleModel: 'Camry',
      active: true,
      createdAt: '2024-01-10T02:00:00.000Z',
      updatedAt: '2024-01-10T02:00:00.000Z',
    },
    {
      id: 'mtrule_002',
      category: 'Thay lốp',
      thresholdKm: 40000,
      appliesTo: 'VEHICLE_MODEL',
      vehicleModel: 'Vios',
      active: true,
      createdAt: '2024-01-10T02:00:00.000Z',
      updatedAt: '2024-01-10T02:00:00.000Z',
    },
    {
      id: 'mtrule_003',
      category: 'Bảo dưỡng định kỳ',
      thresholdKm: 10000,
      appliesTo: 'VEHICLE_MODEL',
      vehicleModel: 'Innova',
      active: true,
      createdAt: '2024-01-10T02:00:00.000Z',
      updatedAt: '2024-01-10T02:00:00.000Z',
    },
    {
      // MT-BR-02 — override riêng cho veh_017 (cũng Camry), ưu tiên hơn mtrule_001 khi tính Next Due KM.
      id: 'mtrule_004',
      category: 'Thay dầu máy',
      thresholdKm: 5000,
      appliesTo: 'SPECIFIC_VEHICLE',
      vehicleId: 'veh_017',
      active: true,
      createdAt: '2024-06-05T02:00:00.000Z',
      updatedAt: '2024-06-05T02:00:00.000Z',
    },
    {
      // MT-BR-11 — demo vô hiệu hoá: không xuất hiện trong danh sách "Đến hạn".
      id: 'mtrule_005',
      category: 'Thay lốp',
      thresholdKm: 40000,
      appliesTo: 'VEHICLE_MODEL',
      vehicleModel: 'Fortuner',
      active: false,
      createdAt: '2024-04-05T02:00:00.000Z',
      updatedAt: '2025-01-05T02:00:00.000Z',
    },
  ]

  const records: MaintenanceRecord[] = [
    {
      // veh_001 Camry, currentKm 18.500 → Next Due 22.000 (5.000 dư) → OK.
      id: 'mtrec_001',
      vehicleId: 'veh_001',
      date: isoDateOffset(-60),
      odometerAtService: 17000,
      category: 'Thay dầu máy',
      cost: 850000,
      provider: 'Gara Thiên Bảo',
      createdAt: isoDateOffset(-60),
      createdBy: SEEDED_BY,
    },
    {
      // veh_017 Camry (override mtrule_004), currentKm 6.200 → Next Due 6.300 (dư 100 < 500) → DUE_SOON.
      id: 'mtrec_002',
      vehicleId: 'veh_017',
      date: isoDateOffset(-20),
      odometerAtService: 1300,
      category: 'Thay dầu máy',
      cost: 900000,
      provider: 'Gara Thiên Bảo',
      createdAt: isoDateOffset(-20),
      createdBy: SEEDED_BY,
    },
    {
      // veh_007 Vios, currentKm 51.200 → Next Due 45.000 → OVERDUE (khớp status MAINTENANCE đã seed).
      id: 'mtrec_003',
      vehicleId: 'veh_007',
      date: isoDateOffset(-15),
      odometerAtService: 5000,
      category: 'Thay lốp',
      cost: 8000000,
      provider: 'Lốp Tốt Sài Gòn',
      note: 'Xe vào bảo trì do đến hạn thay lốp — MT-BR-05 (chưa gửi Notification, Phase 6).',
      createdAt: isoDateOffset(-15),
      createdBy: SEEDED_BY,
    },
    {
      // veh_002 CR-V — lịch sử thuần, không có Rule model CR-V áp dụng.
      id: 'mtrec_004',
      vehicleId: 'veh_002',
      date: isoDateOffset(-90),
      odometerAtService: 30000,
      category: 'Thay dầu máy',
      cost: 780000,
      provider: 'Gara Thiên Bảo',
      createdAt: isoDateOffset(-90),
      createdBy: SEEDED_BY,
    },
    {
      // veh_012 Xpander — lịch sử thuần, không có Rule model Xpander áp dụng.
      id: 'mtrec_005',
      vehicleId: 'veh_012',
      date: isoDateOffset(-45),
      odometerAtService: 28000,
      category: 'Bảo dưỡng định kỳ',
      cost: 1200000,
      provider: 'Trung tâm dịch vụ Mitsubishi',
      createdAt: isoDateOffset(-45),
      createdBy: SEEDED_BY,
    },
    // veh_015 Innova (currentKm 56.000) CỐ Ý không có Record nào cho "Bảo
    // dưỡng định kỳ" — demo baseline = 0 (Next Due KM = threshold = 10.000)
    // → OVERDUE ngay cả khi chưa từng ghi nhận (xem model.ts nextDueKm()).
  ]

  const spareParts: SparePartRecord[] = [
    {
      id: 'sprec_001',
      vehicleId: 'veh_003',
      partName: 'Ắc quy',
      quantity: 1,
      date: isoDateOffset(-40),
      odometerAtReplacement: 44000,
      cost: 1500000,
      provider: 'Phụ tùng Ánh Sáng',
      createdAt: isoDateOffset(-40),
      createdBy: SEEDED_BY,
    },
    {
      id: 'sprec_002',
      vehicleId: 'veh_009',
      partName: 'Lọc gió động cơ',
      quantity: 1,
      date: isoDateOffset(-25),
      odometerAtReplacement: 60000,
      cost: 250000,
      provider: 'Phụ tùng Ánh Sáng',
      createdAt: isoDateOffset(-25),
      createdBy: SEEDED_BY,
    },
    {
      id: 'sprec_003',
      vehicleId: 'veh_007',
      partName: 'Má phanh trước',
      quantity: 2,
      date: isoDateOffset(-15),
      odometerAtReplacement: 50000,
      cost: 900000,
      provider: 'Gara Thiên Bảo',
      createdAt: isoDateOffset(-15),
      createdBy: SEEDED_BY,
    },
    {
      id: 'sprec_004',
      vehicleId: 'veh_014',
      partName: 'Dây curoa',
      quantity: 1,
      date: isoDateOffset(-50),
      odometerAtReplacement: 40000,
      cost: 650000,
      provider: 'Phụ tùng Ánh Sáng',
      createdAt: isoDateOffset(-50),
      createdBy: SEEDED_BY,
    },
    {
      id: 'sprec_005',
      vehicleId: 'veh_016',
      partName: 'Bugi',
      quantity: 4,
      date: isoDateOffset(-10),
      odometerAtReplacement: 47000,
      cost: 480000,
      provider: 'Gara Thiên Bảo',
      createdAt: isoDateOffset(-10),
      createdBy: SEEDED_BY,
    },
  ]

  writeJson(MAINTENANCE_RULES_STORAGE_KEY, rules)
  writeJson(MAINTENANCE_RECORDS_STORAGE_KEY, records)
  writeJson(SPARE_PART_RECORDS_STORAGE_KEY, spareParts)
}

registerSeedStep(seedMaintenance)
