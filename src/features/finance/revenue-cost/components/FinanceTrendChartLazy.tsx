import { lazy, Suspense, type ComponentProps } from 'react'
import { vi } from '@/shared/i18n/vi'
import type { FinanceTrendChart } from './FinanceTrendChart'

const FinanceTrendChartImpl = lazy(() => import('./FinanceTrendChart').then((m) => ({ default: m.FinanceTrendChart })))

/**
 * Bản lazy của `FinanceTrendChart` — dùng ở `VehicleProfitTab` (nằm trong bundle chính qua Vehicle Detail) để `recharts` không kéo vào
 * chunk chính. Khung chờ cùng chiều cao với biểu đồ (260px) để trang không nhảy. Các panel của Báo cáo tài chính giữ import tĩnh
 * (đã nằm trong chunk lazy của màn báo cáo).
 */
export function FinanceTrendChartLazy(props: ComponentProps<typeof FinanceTrendChart>) {
  return (
    <Suspense fallback={<div className="border-border text-muted-foreground flex h-65 items-center justify-center rounded-md border border-dashed p-6 text-center text-sm">{vi.common.loading}</div>}>
      <FinanceTrendChartImpl {...props} />
    </Suspense>
  )
}
