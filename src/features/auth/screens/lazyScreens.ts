import { lazy } from 'react'

/**
 * 2 màn nền tảng tải lười (DASHBOARD-PLATFORM-PLAN.md D11 · §21.2 mục 8) cùng `shared/i18n/platformLabels.ts` (D12).
 * Barrel `auth` được `shared/layout` import tĩnh nên TUYỆT ĐỐI không export tĩnh 2 màn này; `routes.tsx` bọc `<Suspense>`.
 */
export const SystemConfigScreen = lazy(() => import('./SystemConfigScreen').then((m) => ({ default: m.SystemConfigScreen })))
export const PermissionMatrixScreen = lazy(() => import('./PermissionMatrixScreen').then((m) => ({ default: m.PermissionMatrixScreen })))
