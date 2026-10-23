import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicleBlocks } from '@/features/calendar'
import { useCustomers } from '@/features/customers/hooks'
import { useIncidents } from '@/features/incidents'
import { useRentals } from '@/features/rentals'
// Deep-import `hooks.ts` theo tiền lệ `FinanceReportScreen` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import { useVehicles } from '@/features/vehicles/hooks'
import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { usePostSettlementCharges, useSettlements } from '../../core/hooks'
import { isPscOnHold } from '../../core/model'
import { usePaymentRequests, useTransactions } from '../../payment/hooks'
import { deriveCustomerBalances } from '../../payment/model'
import { useCostEntries, useRevenueLines } from '../hooks'
import { buildDashboardFinanceSummary, formatChangeText, type DashboardPeriodPair, type VehiclePerformanceRow } from '../model'
import { calcChangeRatio } from '../reportModel'

type WidgetPeriod = 'DAY' | 'MONTH'

/**
 * KPI tài chính cho Dashboard (`RevenueCost-BRD.md` §17: module RV sở hữu phần KPI tài chính). Mọi số do
 * `buildDashboardFinanceSummary` tính; component chỉ hiển thị. Tự gate `FINANCE_REPORT.VIEW` (AC-RV-012) — thiếu quyền trả `null`.
 * Biểu đồ 30 ngày vẽ bằng thanh CSS, KHÔNG dùng `recharts` (giữ thư viện đó ở chunk lười — DASHBOARD-PLATFORM-PLAN.md D9).
 */
export function DashboardFinanceWidget() {
  const { can } = usePermission()
  if (!can('FINANCE_REPORT', 'VIEW')) return null
  return <DashboardFinanceContent />
}

function DashboardFinanceContent() {
  const t = vi.finance.dashboardWidget
  const [periodMode, setPeriodMode] = useState<WidgetPeriod>('MONTH')

  const revenueQuery = useRevenueLines()
  const costQuery = useCostEntries()
  const settlementQuery = useSettlements()
  const rentalQuery = useRentals()
  const incidentQuery = useIncidents()
  const blockQuery = useVehicleBlocks()
  const vehicleQuery = useVehicles()
  const customerQuery = useCustomers()
  const pscQuery = usePostSettlementCharges()
  const requestQuery = usePaymentRequests()
  const txnQuery = useTransactions()

  const queries = [revenueQuery, costQuery, settlementQuery, rentalQuery, incidentQuery, blockQuery, vehicleQuery, customerQuery, pscQuery, requestQuery, txnQuery]
  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)

  const revenueLines = useMemo(() => revenueQuery.data ?? [], [revenueQuery.data])
  const costEntries = useMemo(() => costQuery.data ?? [], [costQuery.data])
  const settlements = useMemo(() => settlementQuery.data ?? [], [settlementQuery.data])
  const rentals = useMemo(() => rentalQuery.data ?? [], [rentalQuery.data])
  const incidents = useMemo(() => incidentQuery.data ?? [], [incidentQuery.data])
  const blocks = useMemo(() => blockQuery.data ?? [], [blockQuery.data])
  const vehicles = useMemo(() => vehicleQuery.data ?? [], [vehicleQuery.data])
  const customers = useMemo(() => customerQuery.data ?? [], [customerQuery.data])
  const pscs = useMemo(() => pscQuery.data ?? [], [pscQuery.data])
  const requests = useMemo(() => requestQuery.data ?? [], [requestQuery.data])
  const txns = useMemo(() => txnQuery.data ?? [], [txnQuery.data])
  const [today] = useState(() => new Date()) // mốc "bây giờ"; model quy về ngày +07 qua toDateKey

  // Số dư khách tính y như màn Công nợ (cùng tham số) để "Công nợ phải thu" khớp thẻ "Đang nợ".
  const balances = useMemo(() => {
    const onHoldPscIds = new Set(pscs.filter((p) => isPscOnHold(p, incidents)).map((p) => p.id))
    return deriveCustomerBalances({ customers, rentals, settlements, pscs, requests, txns, onHoldPscIds })
  }, [customers, rentals, settlements, pscs, requests, txns, incidents])

  const summary = useMemo(
    () => buildDashboardFinanceSummary({ revenueLines, costEntries, vehicles, rentals, settlements, incidents, blocks, balances, today }),
    [revenueLines, costEntries, vehicles, rentals, settlements, incidents, blocks, balances, today],
  )

  const plateById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.plate])), [vehicles])
  const pair: DashboardPeriodPair = periodMode === 'DAY' ? summary.day : summary.month
  const compareLabel = periodMode === 'DAY' ? t.previousToday : t.previousMonth
  const maxDaily = Math.max(0, ...summary.dailyRevenue.map((d) => d.revenue))

  const cards: { key: string; label: string; value: number; previous?: number; badge?: string; hint?: string }[] = [
    { key: 'revenue', label: t.kpiRevenue, value: pair.current.revenue, previous: pair.previous.revenue },
    { key: 'directCost', label: t.kpiDirectCost, value: pair.current.directCost, previous: pair.previous.directCost },
    {
      key: 'profit',
      label: t.kpiOperatingProfit,
      value: pair.current.operatingProfit,
      previous: pair.previous.operatingProfit,
      badge: vi.finance.revenueCost.estimateBadge,
    },
    { key: 'receivables', label: t.kpiReceivables, value: summary.receivables, hint: t.kpiReceivablesHint },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{t.title}</CardTitle>
            <CardDescription className="mt-1.5">{t.description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant={periodMode === 'DAY' ? 'default' : 'outline'} onClick={() => setPeriodMode('DAY')}>
              {t.periodToday}
            </Button>
            <Button size="sm" variant={periodMode === 'MONTH' ? 'default' : 'outline'} onClick={() => setPeriodMode('MONTH')}>
              {t.periodMonth}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isError ? (
          <p className="text-destructive text-sm">{t.loadError}</p>
        ) : isLoading ? (
          <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
        ) : (
          <>
            <p className="text-muted-foreground text-xs">
              {formatDate(pair.period.from)}
              {pair.period.from !== pair.period.to ? ` – ${formatDate(pair.period.to)}` : ''}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
                <div key={card.key} className="border-border min-w-0 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-muted-foreground text-xs">{card.label}</p>
                    {card.badge && <Badge variant="info">{card.badge}</Badge>}
                  </div>
                  <p className={cn('truncate text-lg font-semibold', card.value < 0 && 'text-destructive')}>{formatVnd(card.value)}</p>
                  {card.previous !== undefined && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {compareLabel}: {formatChangeText(calcChangeRatio(card.value, card.previous), vi.finance.reports.compareNone)}
                    </p>
                  )}
                  {card.hint && <p className="text-muted-foreground mt-1 text-xs">{card.hint}</p>}
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t.chartTitle}</p>
              {maxDaily <= 0 ? (
                <p className="text-muted-foreground text-sm">{t.chartEmpty}</p>
              ) : (
                <div className="flex h-32 items-end gap-0.5">
                  {summary.dailyRevenue.map((d) => (
                    <div key={d.bucket} className="flex h-full min-w-0 flex-1 items-end" title={`${formatDate(d.bucket)}: ${formatVnd(d.revenue)}`}>
                      <div className="bg-primary w-full rounded-t-sm" style={{ height: `${Math.max(0, (d.revenue / maxDaily) * 100)}%` }} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <VehicleProfitTable title={t.topVehiclesTitle} rows={summary.topVehicles} plateById={plateById} />
              <VehicleProfitTable title={t.lowVehiclesTitle} rows={summary.lowVehicles} plateById={plateById} />
            </div>

            <div className="flex justify-end">
              <Button asChild variant="link" size="sm">
                <Link to={paths.financeReports}>{t.reportLink}</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function VehicleProfitTable({ title, rows, plateById }: { title: string; rows: VehiclePerformanceRow[]; plateById: Map<string, string> }) {
  const t = vi.finance.dashboardWidget
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.vehiclesEmpty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnPlate}</TableHead>
              <TableHead className="text-right">{t.columnRevenue}</TableHead>
              <TableHead className="text-right">{t.columnProfit}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.vehicleId}>
                <TableCell>{plateById.get(row.vehicleId) ?? row.vehicleId}</TableCell>
                <TableCell className="text-right">{formatVnd(row.revenue)}</TableCell>
                <TableCell className={cn('text-right', row.estimatedProfit < 0 && 'text-destructive')}>{formatVnd(row.estimatedProfit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
