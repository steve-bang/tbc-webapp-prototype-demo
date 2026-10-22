import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import type { Customer } from '@/features/customers'
import { PAYMENT_METHOD_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import {
  bucketDisplayLabel,
  buildCashflow,
  buildReconciliation,
  type CashEntry,
  type CostEntry,
  type CsvSection,
  type FinancePeriod,
  type ReportExportFilters,
  type ReportGranularity,
  type RevenueLine,
} from '../model'
import { ReportExportButton } from './ReportExportButton'

/** Nhãn chênh lệch doanh thu theo AC-RV-008: > 0 công nợ phải thu · < 0 thu trước · 0 khớp. */
function diffLabel(diff: number): string {
  const t = vi.finance.reports
  if (diff > 0) return t.reconDiffReceivable
  if (diff < 0) return t.reconDiffPrepaid
  return t.reconDiffMatched
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="border-border min-w-0 rounded-md border p-3 text-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn('text-lg font-semibold', tone)}>{value}</p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  )
}

/**
 * Đối chiếu ghi nhận ↔ thực thu/thực chi (BRD §15, UC-RV-11, AC-RV-008) + Report 06 (dòng tiền vận hành).
 * Công cụ quản trị, không phải báo cáo lưu chuyển tiền tệ. CSV dựng từ chính `recon`/`cashflow` bên dưới.
 * `costEntries` đã được màn cha áp công tắc "Loại chi phí bất thường".
 * `onHoldByRental`: số tiền PSC đang "Tạm giữ" theo lượt thuê — chỉ để hiển thị ghi chú, không đổi số chênh lệch.
 * // TODO(OQ: RevenueCost-BRD.md RV-BR-07 / RentalSettlement-UseCase.md UC-RS-14 A1 / RentalSettlement-BRD.md §28 Q13 — PSC "Tạm giữ" (sự cố DISPUTED) có hoãn ghi nhận doanh thu không; demo ghi tại psc.createdAt — REVENUE-COST-PLAN.md §0.4 điểm 18)
 */
export function ReconciliationPanel({
  revenueLines,
  cashEntries,
  costEntries,
  customers,
  period,
  granularity,
  excludeUnusual,
  onHoldByRental,
}: {
  revenueLines: RevenueLine[]
  cashEntries: CashEntry[]
  costEntries: CostEntry[]
  customers: Customer[]
  period: FinancePeriod
  granularity: ReportGranularity
  excludeUnusual: boolean
  onHoldByRental: Map<string, number>
}) {
  const t = vi.finance.reports
  const recon = useMemo(() => buildReconciliation({ revenueLines, cashEntries, costEntries, period }), [revenueLines, cashEntries, costEntries, period])
  const cashflow = useMemo(() => buildCashflow({ cashEntries, period, granularity }), [cashEntries, period, granularity])
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const customerNameOf = (id?: string) => (id ? (customerById.get(id)?.fullName ?? t.compareNone) : t.compareNone)
  const rentalDiffTotal = recon.rentalRows.reduce((sum, r) => sum + r.diff, 0)
  const rentalAccrualTotal = recon.rentalRows.reduce((sum, r) => sum + r.accrual, 0)
  const rentalCashTotal = recon.rentalRows.reduce((sum, r) => sum + r.cash, 0)
  const bucketLabel = (bucket: string) => bucketDisplayLabel(bucket, granularity, t.weekPrefix)

  const exportFilters: ReportExportFilters = { granularity, excludeUnusual }
  const filterLabels = [t.exportFilterGranularity.replace('{value}', t.granularity[granularity]), ...(excludeUnusual ? [t.exportFilterExcludeUnusual] : [])]

  function getSections(): CsvSection[] {
    return [
      {
        title: t.reconSection,
        headers: [t.reconColumnMetric, t.reconColumnAmount],
        rows: [
          [t.reconRevenueAccrual, recon.revenueAccrual],
          [t.reconRevenueCash, recon.revenueCash],
          [`${t.reconRevenueDiff} (${diffLabel(recon.revenueDiff)})`, recon.revenueDiff],
          [t.reconCostRecognized, recon.costRecognized],
          [t.reconCostPaid, recon.costPaid],
          [t.reconCostDiff, recon.costDiff],
        ],
      },
      {
        title: t.reconRentalTitle,
        headers: [t.reconRentalColumnRental, t.reconRentalColumnCustomer, t.reconRentalColumnAccrual, t.reconRentalColumnCash, t.reconRentalColumnDiff],
        rows: recon.rentalRows.map((r) => [r.rentalId ?? t.reconRentalNone, customerNameOf(r.customerId), r.accrual, r.cash, r.diff]),
        totalRow: [t.reconRentalTotalRow, '', rentalAccrualTotal, rentalCashTotal, rentalDiffTotal],
      },
      {
        title: t.reconCashflowTitle,
        headers: [t.reconCashflowColumnBucket, t.reconCashflowColumnIn, t.reconCashflowColumnOut, t.reconCashflowColumnNet],
        rows: cashflow.points.map((p) => [bucketLabel(p.bucket), p.cashIn, p.cashOut, p.net]),
        totalRow: [t.reconCashflowTotalRow, cashflow.totals.cashIn, cashflow.totals.cashOut, cashflow.totals.net],
      },
      {
        title: t.reconMethodTitle,
        headers: [t.reconMethodColumnMethod, t.reconCashflowColumnIn, t.reconCashflowColumnOut, t.reconCashflowColumnNet],
        rows: cashflow.byMethod.map((m) => [PAYMENT_METHOD_LABELS[m.method], m.cashIn, m.cashOut, m.net]),
        totalRow: [t.reconCashflowTotalRow, cashflow.totals.cashIn, cashflow.totals.cashOut, cashflow.totals.net],
      },
      {
        title: t.reconBridgeTitle,
        headers: [t.reconColumnMetric, t.reconColumnAmount],
        rows: [
          [t.reconBridgeRevenueCash, cashflow.bridge.revenueCash],
          [t.reconBridgeOffset, 0 - cashflow.bridge.offsetRevenue],
          [t.reconBridgeNonRevenue, cashflow.bridge.nonRevenueNet],
          [t.reconBridgeNet, cashflow.totals.net],
        ],
      },
    ]
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{t.reconNote}</p>
        <ReportExportButton reportKey="RECONCILIATION" period={period} filters={exportFilters} filterLabels={filterLabels} getSections={getSections} />
      </div>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reconRevenueTitle}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={t.reconRevenueAccrual} value={formatVnd(recon.revenueAccrual)} />
          <Stat label={t.reconRevenueCash} value={formatVnd(recon.revenueCash)} />
          <Stat label={`${t.reconRevenueDiff} — ${diffLabel(recon.revenueDiff)}`} value={formatVnd(recon.revenueDiff)} tone={recon.revenueDiff > 0 ? 'text-status-pending' : undefined} />
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reconCostTitle}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={t.reconCostRecognized} value={formatVnd(recon.costRecognized)} />
          <Stat label={t.reconCostPaid} value={formatVnd(recon.costPaid)} />
          <Stat label={t.reconCostDiff} value={formatVnd(recon.costDiff)} />
        </div>
        <p className="text-muted-foreground text-xs">{t.reconCostNote}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t.reconRentalTitle}</h3>
          <Link to={paths.financeReceivables} className="text-primary text-sm underline-offset-2 hover:underline">
            {t.reconReceivablesLink}
          </Link>
        </div>
        {recon.rentalRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.reconRentalEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.reconRentalColumnRental}</TableHead>
                  <TableHead>{t.reconRentalColumnCustomer}</TableHead>
                  <TableHead className="text-right">{t.reconRentalColumnAccrual}</TableHead>
                  <TableHead className="text-right">{t.reconRentalColumnCash}</TableHead>
                  <TableHead className="text-right">{t.reconRentalColumnDiff}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recon.rentalRows.map((r) => (
                  <TableRow key={r.rentalId ?? 'none'}>
                    <TableCell>
                      {r.rentalId ? (
                        <Link to={paths.rentalDetail(r.rentalId)} className="text-primary font-mono text-xs hover:underline">
                          {r.rentalId}
                        </Link>
                      ) : (
                        t.reconRentalNone
                      )}
                    </TableCell>
                    <TableCell>{customerNameOf(r.customerId)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(r.accrual)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(r.cash)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {formatVnd(r.diff)}
                      {r.rentalId && (onHoldByRental.get(r.rentalId) ?? 0) > 0 && (
                        <span className="text-muted-foreground block text-xs font-normal">
                          {t.reconRentalOnHoldHint.replace('{amount}', formatVnd(onHoldByRental.get(r.rentalId) ?? 0))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t.reconRentalTotalRow}</TableCell>
                  <TableCell />
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(rentalAccrualTotal)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(rentalCashTotal)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(rentalDiffTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
        <p className="text-muted-foreground text-xs">{t.reconRentalNote}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reconCashflowTitle}</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.reconCashflowColumnBucket}</TableHead>
                <TableHead className="text-right">{t.reconCashflowColumnIn}</TableHead>
                <TableHead className="text-right">{t.reconCashflowColumnOut}</TableHead>
                <TableHead className="text-right">{t.reconCashflowColumnNet}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashflow.points.map((p) => (
                <TableRow key={p.bucket}>
                  <TableCell>{bucketLabel(p.bucket)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(p.cashIn)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(p.cashOut)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(p.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{t.reconCashflowTotalRow}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.cashIn)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.cashOut)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.net)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reconMethodTitle}</h3>
        {cashflow.byMethod.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.reconMethodEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.reconMethodColumnMethod}</TableHead>
                  <TableHead className="text-right">{t.reconCashflowColumnIn}</TableHead>
                  <TableHead className="text-right">{t.reconCashflowColumnOut}</TableHead>
                  <TableHead className="text-right">{t.reconCashflowColumnNet}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashflow.byMethod.map((m) => (
                  <TableRow key={m.method}>
                    <TableCell>{PAYMENT_METHOD_LABELS[m.method]}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(m.cashIn)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(m.cashOut)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(m.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t.reconCashflowTotalRow}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.cashIn)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.cashOut)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(cashflow.totals.net)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-sm font-semibold">{t.reconBridgeTitle}</h3>
        <dl className="border-border grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md border p-3 text-sm">
          <dt>{t.reconBridgeRevenueCash}</dt>
          <dd className="text-right whitespace-nowrap">{formatVnd(cashflow.bridge.revenueCash)}</dd>
          <dt>{t.reconBridgeOffset}</dt>
          <dd className="text-right whitespace-nowrap">{formatVnd(0 - cashflow.bridge.offsetRevenue)}</dd>
          <dt>{t.reconBridgeNonRevenue}</dt>
          <dd className="text-right whitespace-nowrap">{formatVnd(cashflow.bridge.nonRevenueNet)}</dd>
          <dt className="font-medium">{t.reconBridgeNet}</dt>
          <dd className="text-right font-medium whitespace-nowrap">{formatVnd(cashflow.totals.net)}</dd>
        </dl>
      </section>
    </div>
  )
}
