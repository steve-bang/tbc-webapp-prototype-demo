import { lazy } from 'react'

/**
 * Màn Nhật ký thao tác tải lười (DASHBOARD-PLATFORM-PLAN.md D11) cùng `shared/i18n/auditLabels.ts` (D12) — để chunk chính không phải gánh.
 * `audit/index.ts` export bản này; `routes.tsx` bọc `<Suspense>`.
 */
export const AuditLogScreen = lazy(() => import('./AuditLogScreen').then((m) => ({ default: m.AuditLogScreen })))
