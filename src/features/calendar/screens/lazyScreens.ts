import { lazy } from 'react'

/**
 * Màn Lịch tải lười (CALENDAR-ROUND3-PLAN.md C3, mẫu D11) — giữ tải đầu `/dashboard` dưới trần khi thêm Day/Agenda và (Round B2) `@dnd-kit`.
 * `routes.tsx` bọc `<Suspense>` bên trong `RequirePermission`.
 */
export const CalendarScreen = lazy(() => import('./CalendarScreen').then((m) => ({ default: m.CalendarScreen })))
