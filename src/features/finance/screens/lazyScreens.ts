import { lazy } from 'react'

/**
 * Màn Báo cáo tài chính tải lười (`recharts` + 7 tab báo cáo) — để chunk chính không phải gánh. `finance/index.ts` export bản này
 * thay cho export tĩnh nên `routes.tsx` giữ nguyên tên import; bọc `<Suspense>` ở route.
 */
export const FinanceReportScreen = lazy(() => import('./FinanceReportScreen').then((m) => ({ default: m.FinanceReportScreen })))
