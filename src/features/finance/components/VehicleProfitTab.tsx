import { useMemo, useState } from 'react'
import type { Vehicle } from '@/features/vehicles'
import { useVehicleBlocks } from '@/features/calendar'
import { useIncidents } from '@/features/incidents'
import { useRentals } from '@/features/rentals'
import { REVENUE_RECOGNITION_POLICY_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useCostEntries, useRevenueLines, useSettlements } from '../hooks'
import { REVENUE_RECOGNITION_POLICY, buildMonthlyVehicleSeries, buildVehiclePerformance, initialPeriodSelection, type PeriodSelection } from '../model'
import { FinancePeriodPicker } from './FinancePeriodPicker'
import { FinanceTrendChartLazy } from './FinanceTrendChartLazy'

/** Tỉ lệ 0..1 → "80%" / "73,3%" (1 chữ số thập phân, AC-RV-014). */
function formatUtilization(value: number | null): string {
  if (value === null) return vi.finance.revenueCost.profitNotAvailable
  return `${(Math.round(value * 1000) / 10).toLocaleString('vi-VN')}%`
}

function formatMonth(key: string): string {
  return `${key.slice(5)}/${key.slice(0, 4)}`
}

/**
 * Tab "Lợi nhuận" của Vehicle Detail — `docs/REVENUE-COST-PLAN.md` §11.2 (một dòng Report 02 cho một xe + bảng theo tháng).
 * Lợi nhuận = Doanh thu − Chi phí trực tiếp (CR-2026-048); chi phí gián tiếp không trừ vào xe (AC-RV-009).
 */
export function VehicleProfitTab({ vehicle, initialSelection }: { vehicle: Vehicle; initialSelection?: PeriodSelection }) {
  // `initialSelection` (drill-down từ Báo cáo tài chính) — mặc định giữ 12 tháng gần nhất như ở Vehicle Detail.
  const [selection, setSelection] = useState<PeriodSelection>(() => initialSelection ?? initialPeriodSelection('LAST_12_MONTHS'))
  const { data: revenueLines = [] } = useRevenueLines({ vehicleId: vehicle.id })
  const { data: costEntries = [] } = useCostEntries({ vehicleId: vehicle.id })
  const { data: settlements = [] } = useSettlements()
  const { data: rentals = [] } = useRentals({ vehicleId: vehicle.id })
  const { data: incidents = [] } = useIncidents()
  const { data: blocks = [] } = useVehicleBlocks({ vehicleId: vehicle.id })

  const row = useMemo(
    () =>
      buildVehiclePerformance({
        vehicles: [vehicle],
        rentals,
        settlements,
        revenueLines,
        costEntries,
        incidents,
        blocks,
        period: selection.period,
        today: new Date(),
      })[0],
    [vehicle, rentals, settlements, revenueLines, costEntries, incidents, blocks, selection.period],
  )
  const monthly = useMemo(() => buildMonthlyVehicleSeries({ vehicleId: vehicle.id, revenueLines, costEntries, period: selection.period }), [vehicle.id, revenueLines, costEntries, selection.period])

  const metrics: { label: string; value: string; tone?: string }[] = [
    { label: vi.finance.revenueCost.profitRevenue, value: formatVnd(row.revenue) },
    { label: vi.finance.revenueCost.profitDirectCost, value: formatVnd(row.directCost) },
    { label: vi.finance.revenueCost.profitRentalCount, value: formatNumber(row.rentalCount) },
    { label: vi.finance.revenueCost.profitRentalDays, value: formatNumber(row.rentalDays) },
    { label: vi.finance.revenueCost.profitAvailableDays, value: formatNumber(row.availableDays) },
    { label: vi.finance.revenueCost.profitUtilization, value: formatUtilization(row.utilization) },
    { label: vi.finance.revenueCost.profitIncidentCount, value: formatNumber(row.incidentCount) },
  ]

  return (
    <div className="flex flex-col gap-4">
      <FinancePeriodPicker value={selection} onChange={setSelection} />
      <p className="text-muted-foreground text-xs">
        {vi.finance.revenueCost.recognitionNote} ({REVENUE_RECOGNITION_POLICY_LABELS[REVENUE_RECOGNITION_POLICY]}) {vi.finance.revenueCost.estimateNote}
      </p>
      {/* TODO(Phase 5): gộp CONSIGNMENT_PAYOUT khi có features/consignment.
          TODO(OQ: RevenueCost-BRD.md §28 Q18 — xe ký gửi 1 hay 2 góc nhìn; 4.3 chỉ nhắc chưa gồm chi trả chủ xe) */}
      {vehicle.ownershipType === 'CONSIGNED' && (
        <p className="border-status-info/40 bg-status-info/10 text-status-info rounded-md border p-3 text-sm">{vi.finance.revenueCost.profitConsignmentBanner}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border rounded-md border p-3 text-sm sm:col-span-2 lg:col-span-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.profitEstimated}</p>
            <Badge variant="info">{vi.finance.revenueCost.estimateBadge}</Badge>
          </div>
          <p className={cn('text-lg font-semibold', row.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(row.estimatedProfit)}</p>
        </div>
        {metrics.map((m) => (
          <div key={m.label} className="border-border min-w-0 rounded-md border p-3 text-sm">
            <p className="text-muted-foreground text-xs">{m.label}</p>
            <p className="font-medium">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{vi.finance.revenueCost.profitMonthlyTitle}</h3>
        <FinanceTrendChartLazy data={monthly.map((m) => ({ bucket: m.month, revenue: m.revenue, directCost: m.directCost, profit: m.profit }))} granularity="MONTH" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.finance.revenueCost.profitColumnMonth}</TableHead>
                <TableHead className="text-right">{vi.finance.revenueCost.profitColumnRevenue}</TableHead>
                <TableHead className="text-right">{vi.finance.revenueCost.profitColumnCost}</TableHead>
                <TableHead className="text-right">{vi.finance.revenueCost.profitColumnProfit}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{formatMonth(m.month)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(m.revenue)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(m.directCost)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap', m.profit < 0 && 'text-destructive')}>{formatVnd(m.profit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
