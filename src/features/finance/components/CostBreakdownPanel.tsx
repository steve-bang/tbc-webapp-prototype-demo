import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { paths } from '@/app/paths'
import { COST_CATEGORY_LABELS, vi } from '@/shared/i18n/vi'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { buildCostBreakdown, type CostEntry, type FinancePeriod } from '../model'

const compactFormatter = new Intl.NumberFormat('vi-VN', { notation: 'compact' })

/**
 * Report 05 (chi phí theo loại) — bảng Loại · Số bản ghi · Tổng · % · Trực tiếp · Gián tiếp + dòng tổng, biểu đồ cột ngang.
 * `costEntries` đã được màn cha áp công tắc "Loại chi phí bất thường" (một lần, EX-04). AC-RV-009: trực tiếp/gián tiếp tách riêng.
 */
export function CostBreakdownPanel({ costEntries, period }: { costEntries: CostEntry[]; period: FinancePeriod }) {
  const t = vi.finance.reports
  const breakdown = useMemo(() => buildCostBreakdown(costEntries, period), [costEntries, period])
  const chartData = useMemo(() => breakdown.rows.map((r) => ({ name: COST_CATEGORY_LABELS[r.category], total: r.total })), [breakdown.rows])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.chartTitleCosts}</h3>
        <Link to={paths.financeCosts} className="text-primary text-sm underline-offset-2 hover:underline">
          {t.costsDetailLink}
        </Link>
      </div>

      {breakdown.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.costsEmpty}</p>
      ) : (
        <>
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 36 + 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} tickLine={false} tickFormatter={(value: number) => compactFormatter.format(value)} />
                <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={130} />
                <Tooltip formatter={(value) => formatVnd(Number(value ?? 0))} />
                <Bar dataKey="total" name={t.costColumnTotal} fill="var(--color-status-pending)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.costColumnCategory}</TableHead>
                  <TableHead className="text-right">{t.costColumnCount}</TableHead>
                  <TableHead className="text-right">{t.costColumnTotal}</TableHead>
                  <TableHead className="text-right">{t.costColumnShare}</TableHead>
                  <TableHead className="text-right">{t.costColumnDirect}</TableHead>
                  <TableHead className="text-right">{t.costColumnIndirect}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.rows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{COST_CATEGORY_LABELS[row.category]}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">{formatVnd(row.total)}</TableCell>
                    <TableCell className="text-right">{row.share === null ? t.compareNone : `${(Math.round(row.share * 1000) / 10).toLocaleString('vi-VN')}%`}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(row.directTotal)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatVnd(row.indirectTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t.costTotalRow}</TableCell>
                  <TableCell className="text-right">{formatNumber(breakdown.count)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(breakdown.total)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(breakdown.directTotal)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(breakdown.indirectTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
