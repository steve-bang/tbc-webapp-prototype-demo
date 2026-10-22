import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import type { Customer } from '@/features/customers'
// `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import type { Vehicle } from '@/features/vehicles'
import { REVENUE_CATEGORY_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/datetime'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import {
  bucketDisplayLabel,
  buildRevenueByCategory,
  buildTimeSeries,
  countCompletedSettlements,
  findRevenueReconciliationIssues,
  isDateInPeriod,
  summarizePeriod,
  type FinancePeriod,
  type ReportGranularity,
  type RevenueLine,
  type Settlement,
} from '../model'
import { FinanceTrendChart } from './FinanceTrendChart'

const ALL = '__ALL__'

/** Phần trăm 1 chữ số thập phân; `null` (tổng bằng 0) → "—". */
function formatShare(share: number | null): string {
  if (share === null) return vi.finance.reports.compareNone
  return `${(Math.round(share * 1000) / 10).toLocaleString('vi-VN')}%`
}

/**
 * Report 01 (Revenue theo thời gian) — lọc Xe + Khách, biểu đồ + bảng Mốc/Doanh thu/Số lượt/TB-lượt, cơ cấu theo danh mục,
 * danh sách dòng giảm trừ (RV-BR-06), cảnh báo lệch nguồn quyết toán ↔ doanh thu (EX-07). AC-RV-006: ghi nhận theo Recognition Date.
 */
export function RevenueReportPanel({
  revenueLines,
  settlements,
  vehicles,
  customers,
  period,
  granularity,
}: {
  revenueLines: RevenueLine[]
  settlements: Settlement[]
  vehicles: Vehicle[]
  customers: Customer[]
  period: FinancePeriod
  granularity: ReportGranularity
}) {
  const t = vi.finance.reports
  const [vehicleId, setVehicleId] = useState<string>(ALL)
  const [customerId, setCustomerId] = useState<string>(ALL)

  const lines = useMemo(
    () => revenueLines.filter((l) => (vehicleId === ALL || l.vehicleId === vehicleId) && (customerId === ALL || l.customerId === customerId)),
    [revenueLines, vehicleId, customerId],
  )
  const filteredSettlements = useMemo(
    () => settlements.filter((s) => (vehicleId === ALL || s.vehicleId === vehicleId) && (customerId === ALL || s.customerId === customerId)),
    [settlements, vehicleId, customerId],
  )

  const series = useMemo(
    () => buildTimeSeries({ revenueLines: lines, costEntries: [], cashEntries: [], settlements: filteredSettlements, period, granularity }),
    [lines, filteredSettlements, period, granularity],
  )
  const total = useMemo(() => {
    const revenue = summarizePeriod(lines, [], period).revenue
    const rentalCount = countCompletedSettlements(filteredSettlements, period)
    return { revenue, rentalCount, average: rentalCount > 0 ? Math.round(revenue / rentalCount) : null }
  }, [lines, filteredSettlements, period])
  const categories = useMemo(() => buildRevenueByCategory(lines, period), [lines, period])
  const reductions = useMemo(
    () => lines.filter((l) => l.nature === 'REDUCTION' && isDateInPeriod(l.recognitionDate, period)).sort((a, b) => b.recognitionDate.localeCompare(a.recognitionDate)),
    [lines, period],
  )
  const issues = useMemo(() => findRevenueReconciliationIssues(filteredSettlements, lines, period), [filteredSettlements, lines, period])

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="w-full sm:w-52" aria-label={t.filterVehicle}>
            <SelectValue placeholder={t.filterVehicle} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t.filterVehicle}: {t.filterAll}
            </SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.plate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger className="w-full sm:w-60" aria-label={t.filterCustomer}>
            <SelectValue placeholder={t.filterCustomer} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t.filterCustomer}: {t.filterAll}
            </SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {issues.length > 0 && (
        <div className="border-status-pending/40 bg-status-pending/10 text-status-pending rounded-md border p-3 text-sm">
          <p className="font-medium">{t.reconciliationTitle}</p>
          <ul className="mt-1 list-inside list-disc">
            {issues.map((issue) => (
              <li key={issue.settlementId}>
                {t.reconciliationLine
                  .replace('{rental}', issue.rentalId)
                  .replace('{expected}', formatVnd(issue.expected))
                  .replace('{recognized}', formatVnd(issue.recognized))
                  .replace('{diff}', formatVnd(issue.diff))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.chartTitleRevenue}</h3>
        <FinanceTrendChart data={series.map((p) => ({ bucket: p.bucket, revenue: p.revenue, directCost: 0, profit: 0 }))} granularity={granularity} series={['revenue']} />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.revenueColumnBucket}</TableHead>
                <TableHead className="text-right">{t.revenueColumnRevenue}</TableHead>
                <TableHead className="text-right">{t.revenueColumnCount}</TableHead>
                <TableHead className="text-right">{t.revenueColumnAverage}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((p) => (
                <TableRow key={p.bucket}>
                  <TableCell>{bucketDisplayLabel(p.bucket, granularity, t.weekPrefix)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(p.revenue)}</TableCell>
                  <TableCell className="text-right">{formatNumber(p.rentalCount)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{p.avgRevenuePerRental === null ? t.compareNone : formatVnd(p.avgRevenuePerRental)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t.revenueTotalRow}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(total.revenue)}</TableCell>
                <TableCell className="text-right">{formatNumber(total.rentalCount)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{total.average === null ? t.compareNone : formatVnd(total.average)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.categoryTitle}</h3>
        {categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.categoryEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.categoryColumnName}</TableHead>
                  <TableHead className="text-right">{t.categoryColumnCharge}</TableHead>
                  <TableHead className="text-right">{t.categoryColumnReduction}</TableHead>
                  <TableHead className="text-right">{t.categoryColumnReversal}</TableHead>
                  <TableHead className="text-right">{t.categoryColumnNet}</TableHead>
                  <TableHead className="text-right">{t.categoryColumnShare}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{REVENUE_CATEGORY_LABELS[row.category]}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(row.charge)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(row.reduction)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(row.reversal)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatVnd(row.net)}</TableCell>
                    <TableCell className="text-right">{formatShare(row.share)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reductionsTitle}</h3>
        {reductions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.reductionsEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.reductionColumnDate}</TableHead>
                  <TableHead>{t.reductionColumnRental}</TableHead>
                  <TableHead>{t.reductionColumnCategory}</TableHead>
                  <TableHead className="text-right">{t.reductionColumnAmount}</TableHead>
                  <TableHead>{t.reductionColumnNote}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reductions.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(line.recognitionDate)}</TableCell>
                    <TableCell>
                      <Link to={paths.rentalDetail(line.rentalId)} className="text-primary font-mono text-xs hover:underline">
                        {line.rentalId}
                      </Link>
                    </TableCell>
                    <TableCell>{REVENUE_CATEGORY_LABELS[line.category]}</TableCell>
                    <TableCell className={cn('text-right whitespace-nowrap', line.amount < 0 && 'text-status-pending')}>{formatVnd(line.amount)}</TableCell>
                    <TableCell className="text-muted-foreground min-w-40 text-xs">{line.note}</TableCell>
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
