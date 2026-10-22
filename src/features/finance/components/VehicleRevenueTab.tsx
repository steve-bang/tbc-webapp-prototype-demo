import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import type { Vehicle } from '@/features/vehicles'
import { REVENUE_CATEGORY_LABELS, REVENUE_LINE_NATURE_LABELS, REVENUE_RECOGNITION_POLICY_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useRevenueLines, useSettlements } from '../hooks'
import { REVENUE_RECOGNITION_POLICY, countCompletedSettlements, initialPeriodSelection, isDateInPeriod, summarizePeriod, type PeriodSelection, type RevenueLine } from '../model'
import { FinancePeriodPicker } from './FinancePeriodPicker'

const NATURE_VARIANT: Record<RevenueLine['nature'], 'success' | 'warning' | 'neutral'> = {
  CHARGE: 'success',
  REDUCTION: 'warning',
  REVERSAL: 'neutral',
}

/**
 * Tab "Doanh thu" của Vehicle Detail — `docs/REVENUE-COST-PLAN.md` §11.2. Chỉ đọc. Doanh thu ghi nhận theo
 * `Recognition Date` (RV-BR-03), chính sách `ON_SETTLEMENT` (CR-2026-048). Gate quyền `VEHICLE.EXPORT` do màn cha đảm nhiệm.
 */
export function VehicleRevenueTab({ vehicle, initialSelection }: { vehicle: Vehicle; initialSelection?: PeriodSelection }) {
  // `initialSelection` (drill-down từ Báo cáo tài chính) — mặc định giữ 12 tháng gần nhất như ở Vehicle Detail.
  const [selection, setSelection] = useState<PeriodSelection>(() => initialSelection ?? initialPeriodSelection('LAST_12_MONTHS'))
  const { data: lines = [], isLoading } = useRevenueLines({ vehicleId: vehicle.id })
  const { data: settlements = [] } = useSettlements()

  const periodLines = useMemo(
    () => lines.filter((l) => isDateInPeriod(l.recognitionDate, selection.period)).sort((a, b) => b.recognitionDate.localeCompare(a.recognitionDate)),
    [lines, selection.period],
  )
  const summary = useMemo(() => summarizePeriod(lines, [], selection.period), [lines, selection.period])
  const completedCount = useMemo(
    () => countCompletedSettlements(settlements.filter((s) => s.vehicleId === vehicle.id), selection.period),
    [settlements, vehicle.id, selection.period],
  )

  function sourceLabel(line: RevenueLine): string {
    return line.sourceType === 'SETTLEMENT' ? vi.finance.revenueCost.revenueSourceSettlement : vi.finance.revenueCost.revenueSourcePsc
  }

  return (
    <div className="flex flex-col gap-4">
      <FinancePeriodPicker value={selection} onChange={setSelection} />
      <p className="text-muted-foreground text-xs">
        {vi.finance.revenueCost.recognitionNote} ({REVENUE_RECOGNITION_POLICY_LABELS[REVENUE_RECOGNITION_POLICY]})
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.revenueCard}</p>
          <p className="font-medium">{formatVnd(summary.revenue)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.completedCountCard}</p>
          <p className="font-medium">{completedCount}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.revenueCost.reductionsCard}</p>
          <p className="text-status-pending font-medium">{formatVnd(summary.reductions)}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : periodLines.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.finance.revenueCost.revenueEmpty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.finance.revenueCost.revenueColumnDate}</TableHead>
                  <TableHead>{vi.finance.revenueCost.revenueColumnRental}</TableHead>
                  <TableHead>{vi.finance.revenueCost.revenueColumnCategory}</TableHead>
                  <TableHead>{vi.finance.revenueCost.revenueColumnNature}</TableHead>
                  <TableHead className="text-right">{vi.finance.revenueCost.revenueColumnAmount}</TableHead>
                  <TableHead>{vi.finance.revenueCost.revenueColumnSource}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(line.recognitionDate)}</TableCell>
                    <TableCell>
                      <Link to={paths.rentalDetail(line.rentalId)} className="text-primary font-mono text-xs hover:underline">
                        {line.rentalId}
                      </Link>
                    </TableCell>
                    <TableCell>{REVENUE_CATEGORY_LABELS[line.category]}</TableCell>
                    <TableCell>
                      <Badge variant={NATURE_VARIANT[line.nature]}>{REVENUE_LINE_NATURE_LABELS[line.nature]}</Badge>
                    </TableCell>
                    <TableCell className={cn('text-right whitespace-nowrap', line.amount < 0 && 'text-status-pending')}>{formatVnd(line.amount)}</TableCell>
                    <TableCell>{sourceLabel(line)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 sm:hidden">
            {periodLines.map((line) => (
              <div key={line.id} className="border-border flex flex-col gap-2 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{REVENUE_CATEGORY_LABELS[line.category]}</span>
                  <span className={cn('font-medium', line.amount < 0 && 'text-status-pending')}>{formatVnd(line.amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={NATURE_VARIANT[line.nature]}>{REVENUE_LINE_NATURE_LABELS[line.nature]}</Badge>
                  <span className="text-muted-foreground text-xs">{formatDate(line.recognitionDate)}</span>
                </div>
                <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
                  <Link to={paths.rentalDetail(line.rentalId)} className="text-primary font-mono hover:underline">
                    {line.rentalId}
                  </Link>
                  <span>· {sourceLabel(line)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
