import {
  Banknote,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { paths } from '@/app/paths'
import type { Action, Resource } from '@/shared/domain/permissions'
import { vi } from '@/shared/i18n/vi'

export interface NavLeaf {
  label: string
  path: string
  icon: ComponentType<{ className?: string }>
  resource?: Resource
  action?: Action
}

export interface NavGroup {
  label: string
  icon: ComponentType<{ className?: string }>
  items: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return 'items' in entry
}

export const NAV_ENTRIES: NavEntry[] = [
  { label: vi.nav.dashboard, path: paths.dashboard, icon: LayoutDashboard },
  { label: vi.nav.calendar, path: paths.calendar, icon: CalendarDays, resource: 'CALENDAR', action: 'VIEW' },
  {
    label: vi.nav.vehicles,
    icon: Truck,
    items: [
      { label: vi.nav.vehicleList, path: paths.vehicles, icon: Truck, resource: 'VEHICLE', action: 'VIEW' },
      { label: vi.nav.maintenance, path: paths.maintenance, icon: Wrench, resource: 'MAINTENANCE', action: 'VIEW' },
    ],
  },
  { label: vi.nav.customers, path: paths.customers, icon: Users, resource: 'CUSTOMER', action: 'VIEW' },
  {
    label: vi.nav.schedule,
    icon: ClipboardList,
    items: [
      { label: vi.nav.calendar, path: paths.calendar, icon: CalendarDays, resource: 'CALENDAR', action: 'VIEW' },
      {
        label: vi.nav.dispatchBoard,
        path: paths.dispatchBoard,
        icon: ClipboardList,
        resource: 'ASSIGNMENT',
        action: 'VIEW',
      },
      { label: vi.nav.employees, path: paths.employees, icon: Users, resource: 'EMPLOYEE', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.rentals,
    icon: FileText,
    items: [
      { label: vi.nav.rentalList, path: paths.rentals, icon: FileText, resource: 'RENTAL', action: 'VIEW' },
      { label: vi.nav.contracts, path: paths.contracts, icon: ScrollText, resource: 'CONTRACT', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.handoverReturn,
    icon: History,
    items: [
      {
        label: vi.nav.handoverTracking,
        path: paths.handoverReturnTracking,
        icon: History,
        resource: 'HANDOVER_RETURN',
        action: 'VIEW',
      },
      { label: vi.nav.incidents, path: paths.incidents, icon: ShieldCheck, resource: 'INCIDENT', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.finance,
    icon: Wallet,
    items: [
      {
        label: vi.nav.settlement,
        path: paths.financeSettlement,
        icon: Wallet,
        resource: 'SETTLEMENT',
        action: 'VIEW',
      },
      { label: vi.nav.transactions, path: paths.financeTransactions, icon: FileText, resource: 'PAYMENT', action: 'VIEW' },
      { label: vi.nav.cashDrawer, path: paths.financeCashDrawer, icon: Wallet, resource: 'PAYMENT', action: 'VIEW' },
      {
        label: vi.nav.receivables,
        path: paths.financeReceivables,
        icon: Users,
        resource: 'PAYMENT',
        action: 'VIEW',
      },
      {
        label: vi.finance.revenueCost.navCosts,
        path: paths.financeCosts,
        icon: Receipt,
        resource: 'FINANCE_REPORT',
        action: 'VIEW',
      },
      {
        label: vi.nav.financeReports,
        path: paths.financeReports,
        icon: Gauge,
        resource: 'FINANCE_REPORT',
        action: 'VIEW',
      },
    ],
  },
  {
    label: vi.nav.consignment,
    icon: Building2,
    items: [
      { label: vi.nav.consignmentOwners, path: paths.consignmentOwners, icon: Building2, resource: 'CONSIGNMENT', action: 'VIEW' },
      // Đề nghị ký gửi & thẩm định (WebappQuanTri.md §12.2) — gate ASSESS để Operation Staff vào được (plan CONSIGNMENT-PLAN.md §20.1 điểm 30).
      {
        label: vi.nav.consignmentProposals,
        path: paths.consignmentProposals,
        icon: ClipboardCheck,
        resource: 'CONSIGNMENT',
        action: 'ASSESS',
      },
      {
        label: vi.nav.consignmentContracts,
        path: paths.consignmentContracts,
        icon: ScrollText,
        resource: 'CONSIGNMENT',
        action: 'VIEW',
      },
      {
        label: vi.nav.consignmentPayouts,
        path: paths.consignmentPayouts,
        icon: Wallet,
        resource: 'CONSIGNMENT',
        action: 'VIEW',
      },
      // Màn của `finance/payment` (WebappQuanTri.md §5.4 — mục thứ 4 của nhóm Xe ký gửi).
      {
        label: vi.nav.consignmentOwnerPayouts,
        path: paths.consignmentOwnerPayouts,
        icon: Banknote,
        resource: 'CONSIGNMENT',
        action: 'VIEW',
      },
    ],
  },
  {
    label: vi.nav.platform,
    icon: Settings,
    items: [
      {
        label: vi.nav.systemConfig,
        path: paths.platformSystemConfig,
        icon: Settings,
        resource: 'SYSTEM_ADMIN',
        action: 'VIEW',
      },
      {
        label: vi.nav.permissions,
        path: paths.platformPermissions,
        icon: KeyRound,
        resource: 'SYSTEM_ADMIN',
        action: 'VIEW',
      },
      { label: vi.nav.audit, path: paths.platformAudit, icon: History, resource: 'AUDIT', action: 'VIEW' },
      {
        label: vi.nav.notifications,
        path: paths.platformNotifications,
        icon: Bell,
        resource: 'NOTIFICATION',
        action: 'VIEW',
      },
    ],
  },
]
