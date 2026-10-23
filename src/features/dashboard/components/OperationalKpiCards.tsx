import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { vi } from '@/shared/i18n/vi'
import { formatNumber } from '@/shared/lib/money'
import type { OperationalKpis } from '../model'

interface KpiItem {
  key: keyof OperationalKpis
  label: string
  to: string
}

/**
 * KPI vận hành (WebappQuanTri.md §5.3) — thẻ số, bấm mở danh sách tương ứng. Chỉ hiển thị: số do `buildOperationalKpis` tính.
 * Nhóm xe gate `VEHICLE.VIEW`, nhóm lượt gate `RENTAL.VIEW` (do `DashboardScreen` truyền cờ).
 */
export function OperationalKpiCards({ kpis, canViewVehicles, canViewRentals }: { kpis: OperationalKpis; canViewVehicles: boolean; canViewRentals: boolean }) {
  const t = vi.dashboard
  const vehicleItems: KpiItem[] = [
    { key: 'totalVehicles', label: t.kpiTotalVehicles, to: paths.vehicles },
    { key: 'available', label: t.kpiAvailable, to: paths.vehicles },
    { key: 'rented', label: t.kpiRented, to: paths.vehicles },
    { key: 'maintenance', label: t.kpiMaintenance, to: paths.vehicles },
    { key: 'inactive', label: t.kpiInactive, to: paths.vehicles },
  ]
  const rentalItems: KpiItem[] = [
    { key: 'deliveriesToday', label: t.kpiDeliveriesToday, to: paths.rentals },
    { key: 'returnsToday', label: t.kpiReturnsToday, to: paths.rentals },
    { key: 'activeRentals', label: t.kpiActiveRentals, to: paths.rentals },
  ]
  const items = [...(canViewVehicles ? vehicleItems : []), ...(canViewRentals ? rentalItems : [])]
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className="border-border bg-card hover:bg-muted/50 focus-visible:ring-ring/50 min-w-0 rounded-md border p-3 text-sm outline-none transition-colors focus-visible:ring-2"
        >
          <p className="text-muted-foreground truncate text-xs">{item.label}</p>
          <p className="text-2xl font-semibold">{formatNumber(kpis[item.key])}</p>
        </Link>
      ))}
    </div>
  )
}
