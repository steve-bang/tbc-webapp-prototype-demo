import type { VariantProps } from 'class-variance-authority'
import { useMemo } from 'react'
import {
  applicableRule,
  latestOdometerForCategory,
  maintenanceDueStatus,
  nextDueKm,
  useMaintenanceRecords,
  useMaintenanceRules,
  useSparePartRecords,
  type MaintenanceDueStatus,
} from '@/features/maintenance'
import { MAINTENANCE_DUE_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge, type badgeVariants } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Vehicle } from '../model'

interface DueRow {
  category: string
  nextDue: number
  status: MaintenanceDueStatus
}

const STATUS_VARIANT: Record<MaintenanceDueStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'destructive',
}

const STATUS_ORDER: Record<MaintenanceDueStatus, number> = { OVERDUE: 0, DUE_SOON: 1, OK: 2 }

/**
 * Tab "Bảo dưỡng" của Vehicle Detail — `MT §6.3`, `docs/VEHICLE-MANAGEMENT-PLAN.md`
 * §8.3 dòng 5. 2 khối trong cùng 1 tab: (1) due status theo category áp dụng
 * cho riêng xe này + lịch sử `MaintenanceRecord`, (2) lịch sử `SparePartRecord`
 * — khác trang `/maintenance` toàn đội xe có 2 tab riêng biệt. Import xuyên
 * feature từ `@/features/maintenance` (barrel) là hợp lệ — tab chỉ hiển thị
 * dữ liệu do `MT` sở hữu, không tự tính lại logic (VEHICLE-MANAGEMENT-PLAN.md
 * §8.4 mục 3).
 */
export function VehicleMaintenanceTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: rules = [] } = useMaintenanceRules()
  const { data: records = [] } = useMaintenanceRecords({ vehicleId: vehicle.id })
  const { data: spareParts = [] } = useSparePartRecords({ vehicleId: vehicle.id })

  const dueRows = useMemo<DueRow[]>(() => {
    const activeRules = rules.filter((r) => r.active)
    const categories = new Set(
      activeRules
        .filter(
          (r) =>
            (r.appliesTo === 'SPECIFIC_VEHICLE' && r.vehicleId === vehicle.id) ||
            (r.appliesTo === 'VEHICLE_MODEL' && r.vehicleModel === vehicle.model),
        )
        .map((r) => r.category),
    )
    const rows: DueRow[] = []
    for (const category of categories) {
      const rule = applicableRule(rules, vehicle, category)
      if (!rule) continue
      const latestOdometer = latestOdometerForCategory(records, vehicle.id, category)
      const nextDue = nextDueKm(rule, latestOdometer)
      rows.push({ category, nextDue, status: maintenanceDueStatus(nextDue, vehicle.currentKm) })
    }
    return rows.sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.category.localeCompare(b.category),
    )
  }, [rules, records, vehicle])

  const sortedRecords = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records])
  const sortedSpareParts = useMemo(() => [...spareParts].sort((a, b) => b.date.localeCompare(a.date)), [spareParts])

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.maintenance.tabMaintenance}</h3>

        {dueRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.maintenance.dueEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.maintenance.dueColumnCategory}</TableHead>
                  <TableHead>{vi.maintenance.dueColumnNextDueKm}</TableHead>
                  <TableHead>{vi.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dueRows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell>{row.nextDue.toLocaleString('vi-VN')} km</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]}>{MAINTENANCE_DUE_STATUS_LABELS[row.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <h4 className="text-sm font-medium">{vi.maintenance.historySectionTitle}</h4>
        {sortedRecords.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.maintenance.historyEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.maintenance.recordDate}</TableHead>
                  <TableHead>{vi.maintenance.recordCategory}</TableHead>
                  <TableHead>{vi.maintenance.recordOdometer}</TableHead>
                  <TableHead>{vi.maintenance.recordCost}</TableHead>
                  <TableHead>{vi.maintenance.recordProvider}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell className="font-medium">{record.category}</TableCell>
                    <TableCell>{record.odometerAtService.toLocaleString('vi-VN')} km</TableCell>
                    <TableCell>{formatVnd(record.cost)}</TableCell>
                    <TableCell>{record.provider ?? vi.vehicles.noValue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.maintenance.tabSpareParts}</h3>
        {sortedSpareParts.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.maintenance.sparePartHistoryEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.maintenance.sparePartName}</TableHead>
                  <TableHead>{vi.maintenance.sparePartQuantity}</TableHead>
                  <TableHead>{vi.maintenance.sparePartDate}</TableHead>
                  <TableHead>{vi.maintenance.sparePartOdometer}</TableHead>
                  <TableHead>{vi.maintenance.sparePartCost}</TableHead>
                  <TableHead>{vi.maintenance.sparePartProvider}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSpareParts.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.partName}</TableCell>
                    <TableCell>{record.quantity}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell>{record.odometerAtReplacement.toLocaleString('vi-VN')} km</TableCell>
                    <TableCell>{formatVnd(record.cost)}</TableCell>
                    <TableCell>{record.provider ?? vi.vehicles.noValue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
