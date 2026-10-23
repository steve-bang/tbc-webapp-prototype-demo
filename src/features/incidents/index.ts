export type { Incident } from './model'
export { IncidentListScreen } from './screens/IncidentListScreen'
export { IncidentDetailScreen } from './screens/IncidentDetailScreen'
// RENTAL-SETTLEMENT-PLAN.md §0.2/§3.5 — re-export read-only cho features/finance.
export { INCIDENTS_STORAGE_KEY, list as listIncidents } from './api'
export { useIncidents } from './hooks'
// DASHBOARD-PLATFORM-PLAN.md §5.3
export { collectIncidentSignals } from './model'
