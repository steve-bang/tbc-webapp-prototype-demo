export type { OperationalSignal } from '@/shared/domain/alerts'
// resolveLink: TECH-HARDENING-PLAN.md §11.2
export { groupSignalsForDashboard, renderTemplate, resolveLink } from './model'
export type { DashboardAlertGroupView, NotificationEvent } from './model'
export { useOperationalSignals } from './hooks'
export { NotificationBell } from './components/NotificationBell'
export { NotificationCenterScreen } from './screens/lazyScreens'
