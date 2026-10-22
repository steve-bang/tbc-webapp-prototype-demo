import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/datetime'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { calcChangeRatio } from '../reportModel'
import { formatChangeText, type FinancePeriod } from '../model'

/** Bộ chỉ số của một kỳ — do màn báo cáo tính bằng hàm thuần (`summarizePeriod`, `sumRevenueCash`, `countCompletedSettlements`). */
export interface FinanceKpiValues {
  revenue: number
  cash: number
  directCost: number
  operatingProfit: number
  indirectCost: number
  afterIndirect: number
  completedCount: number
}

/**
 * Tổng quan — 7 thẻ KPI kèm so kỳ trước (BRD §14). Màu phần so sánh trung tính (không tô xanh/đỏ — chiều tốt/xấu phụ thuộc chỉ số).
 * RV-BR-09: Lợi nhuận vận hành là "ước tính quản trị". AC-RV-009: chi phí gián tiếp hiển thị riêng.
 */
export function FinanceKpiCards({ current, previous, comparison }: { current: FinanceKpiValues; previous: FinanceKpiValues; comparison: FinancePeriod }) {
  const comparisonTooltip = vi.finance.reports.comparePeriodTooltip.replace('{from}', formatDate(comparison.from)).replace('{to}', formatDate(comparison.to))
  const cards: { key: keyof FinanceKpiValues; label: string; kind: 'vnd' | 'count'; badge?: string; hint?: string }[] = [
    { key: 'revenue', label: vi.finance.reports.kpiRevenue, kind: 'vnd' },
    { key: 'cash', label: vi.finance.reports.kpiCash, kind: 'vnd', hint: vi.finance.reports.kpiCashHint },
    { key: 'directCost', label: vi.finance.reports.kpiDirectCost, kind: 'vnd' },
    { key: 'operatingProfit', label: vi.finance.reports.kpiOperatingProfit, kind: 'vnd', badge: vi.finance.revenueCost.estimateBadge },
    { key: 'indirectCost', label: vi.finance.reports.kpiIndirectCost, kind: 'vnd' },
    { key: 'afterIndirect', label: vi.finance.reports.kpiAfterIndirect, kind: 'vnd' },
    { key: 'completedCount', label: vi.finance.reports.kpiCompletedCount, kind: 'count' },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const value = current[card.key]
        return (
          <div key={card.key} title={comparisonTooltip} className={'border-border min-w-0 rounded-md border p-3 text-sm'}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-muted-foreground text-xs">{card.label}</p>
              {card.badge && <Badge variant="info">{card.badge}</Badge>}
            </div>
            <p className={cn('text-lg font-semibold', card.kind === 'vnd' && value < 0 && 'text-destructive')}>{card.kind === 'vnd' ? formatVnd(value) : formatNumber(value)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {vi.finance.reports.compareVersus}: {formatChangeText(calcChangeRatio(value, previous[card.key]), vi.finance.reports.compareNone)}
            </p>
            {card.hint && <p className="text-muted-foreground mt-1 text-xs">{card.hint}</p>}
          </div>
        )
      })}
    </div>
  )
}
