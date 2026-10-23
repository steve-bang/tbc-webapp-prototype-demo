// Nguồn duy nhất của bảng guard route: cùng resource/action với menu `shared/layout/nav.tsx` + TECH-HARDENING-PLAN.md §1.1.
import type { Action, Resource } from '@/shared/domain/permissions'
import { paths } from './paths'

export type RouteAccess = { resource: Resource; action: Action; paths: readonly string[] }

export const ROUTE_ACCESS = {
  calendar: { resource: 'CALENDAR', action: 'VIEW', paths: [paths.calendar] },
  vehicles: { resource: 'VEHICLE', action: 'VIEW', paths: [paths.vehicles, '/vehicles/:id'] },
  maintenance: { resource: 'MAINTENANCE', action: 'VIEW', paths: [paths.maintenance] },
  customers: { resource: 'CUSTOMER', action: 'VIEW', paths: [paths.customers, '/customers/:id'] },
  dispatchBoard: { resource: 'ASSIGNMENT', action: 'VIEW', paths: [paths.dispatchBoard] },
  employees: { resource: 'EMPLOYEE', action: 'VIEW', paths: [paths.employees, '/employees/:id'] },
  rentals: { resource: 'RENTAL', action: 'VIEW', paths: [paths.rentals, '/rentals/:id'] },
  contracts: { resource: 'CONTRACT', action: 'VIEW', paths: [paths.contracts, '/contracts/:id'] },
  handoverReturn: { resource: 'HANDOVER_RETURN', action: 'VIEW', paths: [paths.handoverReturnTracking] },
  incidents: { resource: 'INCIDENT', action: 'VIEW', paths: [paths.incidents, '/incidents/:id'] },
  settlement: { resource: 'SETTLEMENT', action: 'VIEW', paths: [paths.financeSettlement] },
  payment: {
    resource: 'PAYMENT',
    action: 'VIEW',
    paths: [paths.financeTransactions, paths.financeCashDrawer, paths.financeReceivables],
  },
  financeReport: { resource: 'FINANCE_REPORT', action: 'VIEW', paths: [paths.financeCosts, paths.financeReports] },
  consignment: {
    resource: 'CONSIGNMENT',
    action: 'VIEW',
    paths: [
      paths.consignmentOwners,
      '/consignment/owners/:id',
      paths.consignmentContracts,
      '/consignment/contracts/:id',
      paths.consignmentPayouts,
      paths.consignmentOwnerPayouts,
    ],
  },
  consignmentProposals: {
    resource: 'CONSIGNMENT',
    action: 'ASSESS',
    paths: [paths.consignmentProposals, '/consignment/proposals/:id'],
  },
  systemAdmin: {
    resource: 'SYSTEM_ADMIN',
    action: 'VIEW',
    paths: [paths.platformSystemConfig, paths.platformPermissions],
  },
  audit: { resource: 'AUDIT', action: 'VIEW', paths: [paths.platformAudit] },
  notifications: { resource: 'NOTIFICATION', action: 'VIEW', paths: [paths.platformNotifications] },
} as const satisfies Record<string, RouteAccess>

function pathMatches(pattern: string, segments: string[]): boolean {
  const parts = pattern.split('/').filter(Boolean)
  if (parts.length !== segments.length) return false
  return parts.every((part, i) => (part.startsWith(':') ? segments[i] !== '' : part === segments[i]))
}

/** Tìm nhóm guard của một đường dẫn (bỏ query/hash). `undefined` = không guard (vd. Dashboard). */
export function routeAccessForPath(pathname: string): RouteAccess | undefined {
  const clean = pathname.split('#')[0].split('?')[0]
  const segments = clean.split('/').filter(Boolean)
  return Object.values(ROUTE_ACCESS).find((group: RouteAccess) => group.paths.some((p) => pathMatches(p, segments)))
}

/** `true` nếu đường dẫn không thuộc nhóm guard nào; ngược lại tuỳ `check(resource, action)`. */
export function canAccessPath(pathname: string, check: (resource: Resource, action: Action) => boolean): boolean {
  const access = routeAccessForPath(pathname)
  return access ? check(access.resource, access.action) : true
}
