export type { MaintenanceDueStatus, MaintenanceRecord, MaintenanceRule, SparePartRecord } from './model'
// VEHICLE-MANAGEMENT-PLAN.md §8.4 mục 3 — export thêm hàm thuần + hook để
// `features/vehicles` (VehicleOverviewTab/VehicleMaintenanceTab) tái dùng đúng
// qua barrel, không import sâu vào `./model`/`./hooks`.
export { applicableRule, latestOdometerForCategory, maintenanceDueStatus, nextDueKm } from './model'
export { useMaintenanceRecords, useMaintenanceRules, useSparePartRecords } from './hooks'
// REVENUE-COST-PLAN.md §0.2 — re-export read-only cho features/finance (chi phí bảo dưỡng/phụ tùng suy ra).
export { MAINTENANCE_RECORDS_STORAGE_KEY, SPARE_PART_RECORDS_STORAGE_KEY } from './api'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { MAINTENANCE_RULES_STORAGE_KEY } from './api'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { collectMaintenanceDueSignals } from './model'
