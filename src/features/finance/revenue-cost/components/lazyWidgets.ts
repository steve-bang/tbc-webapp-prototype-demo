import { lazy } from 'react'

/**
 * Widget KPI tài chính của Dashboard tải lười: widget dùng hook của nhiều feature (đang nằm trong vòng import của các barrel),
 * nên import tĩnh sẽ kéo thêm file `finance` mới vào vòng đó (DASHBOARD-PLATFORM-PLAN.md §2.1 bất biến SCC) và làm nặng chunk chính.
 * Cùng tiền lệ `screens/lazyScreens.ts`; nơi dùng bọc `<Suspense>`.
 */
export const DashboardFinanceWidget = lazy(() =>
  import('./DashboardFinanceWidget').then((m) => ({ default: m.DashboardFinanceWidget })),
)
