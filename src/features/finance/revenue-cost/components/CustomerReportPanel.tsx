import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import type { Customer } from '@/features/customers'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import { CUSTOMER_STATUSES, type CustomerStatus } from '@/shared/domain/enums'
import { CUSTOMER_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { buildCustomerReport, sortCustomerRows, sumCustomerRows, type CsvSection, type CustomerReportSortKey } from '../reportModel'
import type { CashEntry, FinancePeriod, ReportExportFilters, RevenueLine } from '../model'
import type { CustomerBalance } from '../../payment/model'
import type { Settlement } from '../../core/types'
import { ReportExportButton } from './ReportExportButton'

const ALL = '__ALL__'
const SORT_KEYS: CustomerReportSortKey[] = ['REVENUE', 'OUTSTANDING']

/**
 * Report 03 (khách hàng) — UC-RV-09: Doanh thu · Số lượt · Tổng chi tiêu · Thực thu trong kỳ · Còn phải thu (số dư HIỆN TẠI) · Số sự cố.
 * Lọc trạng thái khách làm TRƯỚC khi sắp xếp và cộng tổng, nên dòng tổng = Σ các dòng đang hiển thị. CSV dựng từ chính `rows`/`totals` bên dưới.
 * TODO(OQ: AuditLog-BRD.md §22 Q4 / CustomerManagement-BRD.md §31 Q17 — trường nhạy cảm & quy tắc che chưa chốt; báo cáo/CSV chỉ mã + họ tên + trạng thái khách)
 */
export function CustomerReportPanel({
  revenueLines,
  settlements,
  cashEntries,
  incidents,
  rentals,
  balances,
  customers,
  period,
}: {
  revenueLines: RevenueLine[]
  settlements: Settlement[]
  cashEntries: CashEntry[]
  incidents: Incident[]
  rentals: Rental[]
  balances: CustomerBalance[]
  customers: Customer[]
  period: FinancePeriod
}) {
  const t = vi.finance.reports
  const [statusFilter, setStatusFilter] = useState<string>(ALL)
  const [sortKey, setSortKey] = useState<CustomerReportSortKey>('REVENUE')

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const report = useMemo(
    () => buildCustomerReport({ revenueLines, settlements, cashEntries, incidents, rentals, balances, period }),
    [revenueLines, settlements, cashEntries, incidents, rentals, balances, period],
  )
  const rows = useMemo(() => {
    const filtered = statusFilter === ALL ? report.rows : report.rows.filter((r) => customerById.get(r.customerId)?.status === statusFilter)
    return sortCustomerRows(filtered, sortKey)
  }, [report.rows, statusFilter, sortKey, customerById])
  const totals = useMemo(() => sumCustomerRows(rows), [rows])

  const sortLabels: Record<CustomerReportSortKey, string> = { REVENUE: t.customerSortRevenue, OUTSTANDING: t.customerSortOutstanding }
  const nameOf = (id: string) => customerById.get(id)?.fullName ?? t.compareNone
  const statusOf = (id: string) => {
    const status = customerById.get(id)?.status
    return status ? CUSTOMER_STATUS_LABELS[status] : t.compareNone
  }

  const exportFilters: ReportExportFilters = { sortKey, ...(statusFilter === ALL ? {} : { customerStatus: statusFilter as CustomerStatus }) }
  const filterLabels = [
    ...(statusFilter === ALL ? [] : [t.exportFilterCustomerStatus.replace('{value}', CUSTOMER_STATUS_LABELS[statusFilter as CustomerStatus])]),
    t.exportFilterSort.replace('{value}', sortLabels[sortKey]),
  ]

  function getSections(): CsvSection[] {
    return [
      {
        title: t.customerTitle,
        headers: [
          t.customerColumnCode,
          t.customerColumnName,
          t.customerColumnStatus,
          t.customerColumnRentalCount,
          t.customerColumnRevenue,
          t.customerColumnSpending,
          t.customerColumnCollected,
          t.customerColumnOutstanding,
          t.customerColumnIncidents,
        ],
        rows: rows.map((r) => [r.customerId, nameOf(r.customerId), statusOf(r.customerId), r.rentalCount, r.revenue, r.totalSpending, r.collected, r.outstandingNow, r.incidentCount]),
        totalRow: [t.customerTotalRow, '', '', totals.rentalCount, totals.revenue, totals.totalSpending, totals.collected, totals.outstandingNow, totals.incidentCount],
      },
    ]
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{t.customerFilterStatus}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.filterAll}</SelectItem>
                {CUSTOMER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CUSTOMER_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>{t.customerSortLabel}</Label>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as CustomerReportSortKey)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {sortLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ReportExportButton reportKey="CUSTOMER" period={period} filters={exportFilters} filterLabels={filterLabels} getSections={getSections} />
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <p>{t.customerNote}</p>
        <Link to={paths.financeReceivables} className="text-primary underline-offset-2 hover:underline">
          {t.customerReceivablesLink}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.customerEmpty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.customerColumnCode}</TableHead>
                  <TableHead>{t.customerColumnName}</TableHead>
                  <TableHead>{t.customerColumnStatus}</TableHead>
                  <TableHead className="text-right">{t.customerColumnRentalCount}</TableHead>
                  <TableHead className="text-right">{t.customerColumnRevenue}</TableHead>
                  <TableHead className="text-right">{t.customerColumnSpending}</TableHead>
                  <TableHead className="text-right">{t.customerColumnCollected}</TableHead>
                  <TableHead className="text-right">{t.customerColumnOutstanding}</TableHead>
                  <TableHead className="text-right">{t.customerColumnIncidents}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.customerId}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">{r.customerId}</TableCell>
                    <TableCell>
                      {customerById.has(r.customerId) ? (
                        <Link to={paths.customerDetail(r.customerId)} className="text-primary hover:underline">
                          {nameOf(r.customerId)}
                        </Link>
                      ) : (
                        nameOf(r.customerId)
                      )}
                    </TableCell>
                    <TableCell>{statusOf(r.customerId)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.rentalCount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(r.revenue)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(r.totalSpending)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(r.collected)}</TableCell>
                    <TableCell className={cn('text-right whitespace-nowrap', r.outstandingNow > 0 && 'text-status-pending')}>{formatVnd(r.outstandingNow)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.incidentCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t.customerTotalRow}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right">{formatNumber(totals.rentalCount)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.revenue)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.totalSpending)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.collected)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.outstandingNow)}</TableCell>
                  <TableCell className="text-right">{formatNumber(totals.incidentCount)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="flex flex-col gap-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.customerId} className="border-border flex min-w-0 flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{nameOf(r.customerId)}</span>
                  <span className="text-muted-foreground text-xs">{statusOf(r.customerId)}</span>
                </div>
                <p className="text-muted-foreground font-mono text-xs">{r.customerId}</p>
                <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt>{t.customerColumnRentalCount}</dt>
                  <dd className="text-foreground text-right">{formatNumber(r.rentalCount)}</dd>
                  <dt>{t.customerColumnRevenue}</dt>
                  <dd className="text-foreground text-right">{formatVnd(r.revenue)}</dd>
                  <dt>{t.customerColumnSpending}</dt>
                  <dd className="text-foreground text-right">{formatVnd(r.totalSpending)}</dd>
                  <dt>{t.customerColumnCollected}</dt>
                  <dd className="text-foreground text-right">{formatVnd(r.collected)}</dd>
                  <dt>{t.customerColumnOutstanding}</dt>
                  <dd className="text-foreground text-right">{formatVnd(r.outstandingNow)}</dd>
                  <dt>{t.customerColumnIncidents}</dt>
                  <dd className="text-foreground text-right">{formatNumber(r.incidentCount)}</dd>
                </dl>
              </div>
            ))}
            <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-md p-3 text-sm font-medium">
              <span>{t.customerTotalRow}</span>
              <span>{formatVnd(totals.revenue)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
