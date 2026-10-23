import { lazy } from 'react'

/**
 * Chi tiết nhân viên tải lười (DASHBOARD-PLATFORM-PLAN.md D11 · §21.2 mục 12) — để `employees/index` không kéo tĩnh màn mới vào chunk chính.
 * `routes.tsx` bọc `<Suspense>`.
 */
export const EmployeeDetailScreen = lazy(() => import('./EmployeeDetailScreen').then((m) => ({ default: m.EmployeeDetailScreen })))
