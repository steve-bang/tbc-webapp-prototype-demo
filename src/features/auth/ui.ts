// Điểm nhập UI của feature (màn hình + component) — TECH-HARDENING-PLAN.md §3.2 (E2). Code không phải UI không import file này.
export { LoginScreen } from './screens/LoginScreen'
export { SystemConfigScreen, PermissionMatrixScreen } from './screens/lazyScreens'
export { RequirePermission } from './components/RequirePermission'
