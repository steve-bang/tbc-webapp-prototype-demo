import { lazy } from 'react'

/**
 * Trung tâm thông báo tải lười (DASHBOARD-PLATFORM-PLAN.md D11) — để chunk chính không phải gánh màn `/platform/*` ít dùng.
 * `notifications/index.ts` export bản này thay cho export tĩnh nên `routes.tsx` giữ nguyên tên import; bọc `<Suspense>` ở route.
 * `NotificationBell` (Topbar) vẫn import tĩnh.
 */
export const NotificationCenterScreen = lazy(() =>
  import('./NotificationCenterScreen').then((m) => ({ default: m.NotificationCenterScreen })),
)
