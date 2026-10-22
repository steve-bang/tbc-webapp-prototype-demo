import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { bucketDisplayLabel } from '../reportModel'
import type { ReportGranularity } from '../model'

export interface FinanceTrendDatum {
  /** Khoá mốc của `bucketKeyOf`: `yyyy-MM-dd` (ngày/tuần) hoặc `yyyy-MM` (tháng). */
  bucket: string
  revenue: number
  directCost: number
  profit: number
}

/** Rút gọn số tiền trên trục Y (1,2 tr · 3 tỷ…). */
const compactFormatter = new Intl.NumberFormat('vi-VN', { notation: 'compact' })

/**
 * Biểu đồ Doanh thu (cột) + Chi phí trực tiếp (cột) + Lợi nhuận vận hành (đường) theo mốc — dùng chung cho Báo cáo tài chính
 * và tab Lợi nhuận của Vehicle Detail. Màu CHỈ lấy từ biến theme (không hex). Dữ liệu rỗng (mọi giá trị 0) → trạng thái rỗng.
 */
export function FinanceTrendChart({
  data,
  granularity,
  series = ['revenue', 'directCost', 'profit'],
}: {
  data: FinanceTrendDatum[]
  granularity: ReportGranularity
  /** Chuỗi cần vẽ — mặc định cả 3; tab Doanh thu chỉ vẽ `revenue`. */
  series?: ('revenue' | 'directCost' | 'profit')[]
}) {
  const isEmpty = data.every((d) => series.every((key) => d[key] === 0))
  if (isEmpty) {
    return (
      <div className="border-border text-muted-foreground flex h-[260px] items-center justify-center rounded-md border border-dashed p-6 text-center text-sm">
        {vi.finance.reports.chartEmpty}
      </div>
    )
  }
  const rows = data.map((d) => ({ ...d, label: bucketDisplayLabel(d.bucket, granularity, vi.finance.reports.weekPrefix) }))
  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} interval="preserveStartEnd" />
          <YAxis fontSize={12} tickLine={false} axisLine={false} width={56} tickFormatter={(value: number) => compactFormatter.format(value)} />
          <Tooltip formatter={(value) => formatVnd(Number(value ?? 0))} />
          <Legend />
          {series.includes('revenue') && <Bar dataKey="revenue" name={vi.finance.reports.chartRevenue} fill="var(--color-primary)" radius={[3, 3, 0, 0]} />}
          {series.includes('directCost') && <Bar dataKey="directCost" name={vi.finance.reports.chartDirectCost} fill="var(--color-status-pending)" radius={[3, 3, 0, 0]} />}
          {series.includes('profit') && <Line dataKey="profit" name={vi.finance.reports.chartProfit} type="monotone" stroke="var(--color-status-done)" strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
