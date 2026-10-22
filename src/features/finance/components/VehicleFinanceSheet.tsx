import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
// `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { PeriodSelection } from '../model'
import { VehicleCostTab } from './VehicleCostTab'
import { VehicleProfitTab } from './VehicleProfitTab'
import { VehicleRevenueTab } from './VehicleRevenueTab'

/**
 * Drill-down theo xe từ Báo cáo tài chính (CR-2026-018) — tái dùng 3 tab của Vehicle Detail với kỳ đang chọn ở báo cáo.
 * Gate `VEHICLE.EXPORT` ("xem tài chính xe", CR-2026-036) — cùng gate 3 tab ở Vehicle Detail. `key` theo xe + kỳ để tab con khởi tạo lại kỳ.
 */
export function VehicleFinanceSheet({
  vehicle,
  selection,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null
  selection: PeriodSelection
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  if (!vehicle || !can('VEHICLE', 'EXPORT')) return null
  const sheetKey = `${vehicle.id}:${selection.period.from}:${selection.period.to}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-3xl">
        <SheetHeader className="p-0">
          <SheetTitle>
            {vehicle.plate} · {vehicle.brand} {vehicle.model}
          </SheetTitle>
          <SheetDescription>{vi.finance.reports.sheetDescription}</SheetDescription>
          <Link to={paths.vehicleDetail(vehicle.id)} className="text-primary text-sm underline-offset-2 hover:underline">
            {vi.finance.reports.sheetOpenVehicle}
          </Link>
        </SheetHeader>
        <Tabs key={sheetKey} defaultValue="profit" className="min-w-0">
          <TabsList className="max-w-full">
            <TabsTrigger value="revenue">{vi.finance.reports.sheetTabRevenue}</TabsTrigger>
            <TabsTrigger value="costs">{vi.finance.reports.sheetTabCosts}</TabsTrigger>
            <TabsTrigger value="profit">{vi.finance.reports.sheetTabProfit}</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue">
            <VehicleRevenueTab vehicle={vehicle} initialSelection={selection} />
          </TabsContent>
          <TabsContent value="costs">
            <VehicleCostTab vehicle={vehicle} initialSelection={selection} />
          </TabsContent>
          <TabsContent value="profit">
            <VehicleProfitTab vehicle={vehicle} initialSelection={selection} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
