export type { MaintenanceDueStatus, MaintenanceRecord, MaintenanceRule, SparePartRecord } from './model'
// VEHICLE-MANAGEMENT-PLAN.md §8.4 mục 3 — export thêm hàm thuần + hook để
// `features/vehicles` (VehicleOverviewTab/VehicleMaintenanceTab) tái dùng đúng
// qua barrel, không import sâu vào `./model`/`./hooks`.
export { applicableRule, latestOdometerForCategory, maintenanceDueStatus, nextDueKm } from './model'
export { useMaintenanceRecords, useMaintenanceRules, useSparePartRecords } from './hooks'
export { MaintenanceScreen } from './screens/MaintenanceScreen'
