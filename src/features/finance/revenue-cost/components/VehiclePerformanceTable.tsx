import { OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
// `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import type { Vehicle } from '@/features/vehicles'
import { sumVehicleRows } from '../reportModel'
import { formatPercentText, type VehiclePerformanceRow } from '../model'

/**
 * Report 02 (hiệu quả xe). `compact` (Tổng quan): Biển số · Doanh thu · Chi phí TT · Lợi nhuận · Tỉ lệ khai thác;
 * `full` (tab Hiệu quả xe): đủ cột + dòng tổng. Dưới `sm` hiện thẻ thay bảng. `onSelect` không truyền → hàng không bấm được (thiếu quyền).
 * RV-BR-09: lợi nhuận là "ước tính quản trị"; AC-RV-009: chi phí gián tiếp không nằm trong bảng này.
 */
export function VehiclePerformanceTable({
  rows,
  vehicleById,
  variant,
  onSelect,
}: {
  rows: VehiclePerformanceRow[]
  vehicleById: Map<string, Vehicle>
  variant: 'compact' | 'full'
  onSelect?: (vehicleId: string) => void
}) {
  const t = vi.finance.reports
  const total = sumVehicleRows(rows)
  const full = variant === 'full'
  const plateOf = (id: string) => vehicleById.get(id)?.plate ?? id

  function rowProps(vehicleId: string) {
    if (!onSelect) return {}
    return {
      onClick: () => onSelect(vehicleId),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(vehicleId)
        }
      },
      tabIndex: 0,
      className: 'cursor-pointer',
    }
  }

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.vehicleColumnPlate}</TableHead>
              {full && <TableHead>{t.vehicleColumnClass}</TableHead>}
              {full && <TableHead>{t.vehicleColumnOwnership}</TableHead>}
              {full && <TableHead className="text-right">{t.vehicleColumnRentalCount}</TableHead>}
              {full && <TableHead className="text-right">{t.vehicleColumnRentalDays}</TableHead>}
              {full && <TableHead className="text-right">{t.vehicleColumnAvailableDays}</TableHead>}
              <TableHead className="text-right">{t.vehicleColumnUtilization}</TableHead>
              <TableHead className="text-right">{t.vehicleColumnRevenue}</TableHead>
              <TableHead className="text-right">{t.vehicleColumnDirectCost}</TableHead>
              <TableHead className="text-right">{t.vehicleColumnProfit}</TableHead>
              {full && <TableHead className="text-right">{t.vehicleColumnIncidents}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const vehicle = vehicleById.get(row.vehicleId)
              return (
                <TableRow key={row.vehicleId} {...rowProps(row.vehicleId)}>
                  <TableCell className="font-medium whitespace-nowrap">{plateOf(row.vehicleId)}</TableCell>
                  {full && <TableCell>{vehicle ? VEHICLE_CLASS_LABELS[vehicle.vehicleClass] : ''}</TableCell>}
                  {full && <TableCell>{vehicle ? OWNERSHIP_TYPE_LABELS[vehicle.ownershipType] : ''}</TableCell>}
                  {full && <TableCell className="text-right">{formatNumber(row.rentalCount)}</TableCell>}
                  {full && <TableCell className="text-right">{formatNumber(row.rentalDays)}</TableCell>}
                  {full && <TableCell className="text-right">{formatNumber(row.availableDays)}</TableCell>}
                  <TableCell className="text-right whitespace-nowrap">{formatPercentText(row.utilization, vi.finance.revenueCost.profitNotAvailable)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(row.revenue)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(row.directCost)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap', row.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(row.estimatedProfit)}</TableCell>
                  {full && <TableCell className="text-right">{formatNumber(row.incidentCount)}</TableCell>}
                </TableRow>
              )
            })}
          </TableBody>
          {full && (
            <TableFooter>
              <TableRow>
                <TableCell>{t.vehicleTotalRow}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right">{formatNumber(total.rentalCount)}</TableCell>
                <TableCell className="text-right">{formatNumber(total.rentalDays)}</TableCell>
                <TableCell className="text-right">{formatNumber(total.availableDays)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatPercentText(total.utilization, vi.finance.revenueCost.profitNotAvailable)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(total.revenue)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(total.directCost)}</TableCell>
                <TableCell className={cn('text-right whitespace-nowrap', total.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(total.estimatedProfit)}</TableCell>
                <TableCell className="text-right">{formatNumber(total.incidentCount)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((row) => {
          const vehicle = vehicleById.get(row.vehicleId)
          const interactive = onSelect
            ? { role: 'button' as const, tabIndex: 0, onClick: () => onSelect(row.vehicleId), onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && onSelect(row.vehicleId) }
            : {}
          return (
            <div key={row.vehicleId} className={cn('border-border flex min-w-0 flex-col gap-1 rounded-md border p-3 text-sm', onSelect && 'cursor-pointer')} {...interactive}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{plateOf(row.vehicleId)}</span>
                <span className={cn('font-medium', row.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(row.estimatedProfit)}</span>
              </div>
              {full && vehicle && (
                <p className="text-muted-foreground text-xs">
                  {VEHICLE_CLASS_LABELS[vehicle.vehicleClass]} · {OWNERSHIP_TYPE_LABELS[vehicle.ownershipType]}
                </p>
              )}
              <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt>{t.vehicleColumnRevenue}</dt>
                <dd className="text-foreground text-right">{formatVnd(row.revenue)}</dd>
                <dt>{t.vehicleColumnDirectCost}</dt>
                <dd className="text-foreground text-right">{formatVnd(row.directCost)}</dd>
                <dt>{t.vehicleColumnUtilization}</dt>
                <dd className="text-foreground text-right">{formatPercentText(row.utilization, vi.finance.revenueCost.profitNotAvailable)}</dd>
                {full && (
                  <>
                    <dt>{t.vehicleColumnRentalCount}</dt>
                    <dd className="text-foreground text-right">{formatNumber(row.rentalCount)}</dd>
                    <dt>{t.vehicleColumnRentalDays}</dt>
                    <dd className="text-foreground text-right">{formatNumber(row.rentalDays)}</dd>
                    <dt>{t.vehicleColumnAvailableDays}</dt>
                    <dd className="text-foreground text-right">{formatNumber(row.availableDays)}</dd>
                    <dt>{t.vehicleColumnIncidents}</dt>
                    <dd className="text-foreground text-right">{formatNumber(row.incidentCount)}</dd>
                  </>
                )}
              </dl>
            </div>
          )
        })}
        {full && rows.length > 0 && (
          <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-md p-3 text-sm font-medium">
            <span>{t.vehicleTotalRow}</span>
            <span className={cn(total.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(total.estimatedProfit)}</span>
          </div>
        )}
      </div>
    </>
  )
}
