import {
  Bell,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
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
      { label: 'Danh sách xe', path: paths.vehicles, icon: Truck, resource: 'VEHICLE', action: 'VIEW' },
      { label: 'Bảo dưỡng & phụ tùng', path: paths.maintenance, icon: Wrench, resource: 'MAINTENANCE', action: 'VIEW' },
    ],
  },
  { label: vi.nav.customers, path: paths.customers, icon: Users, resource: 'CUSTOMER', action: 'VIEW' },
  {
    label: vi.nav.schedule,
    icon: ClipboardList,
    items: [
      { label: 'Lịch cho thuê', path: paths.calendar, icon: CalendarDays, resource: 'CALENDAR', action: 'VIEW' },
      {
        label: 'Bảng điều phối trong ngày',
        path: paths.dispatchBoard,
        icon: ClipboardList,
        resource: 'ASSIGNMENT',
        action: 'VIEW',
      },
      { label: 'Hồ sơ nhân viên', path: paths.employees, icon: Users, resource: 'EMPLOYEE', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.rentals,
    icon: FileText,
    items: [
      { label: 'Danh sách lượt thuê', path: paths.rentals, icon: FileText, resource: 'RENTAL', action: 'VIEW' },
      { label: 'Hợp đồng', path: paths.contracts, icon: ScrollText, resource: 'CONTRACT', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.handoverReturn,
    icon: History,
    items: [
      {
        label: 'Theo dõi giao / nhận',
        path: paths.handoverReturnTracking,
        icon: History,
        resource: 'HANDOVER_RETURN',
        action: 'VIEW',
      },
      { label: 'Hồ sơ sự cố', path: paths.incidents, icon: ShieldCheck, resource: 'INCIDENT', action: 'VIEW' },
    ],
  },
  {
    label: vi.nav.finance,
    icon: Wallet,
    items: [
      {
        label: 'Quyết toán',
        path: paths.financeSettlement,
        icon: Wallet,
        resource: 'SETTLEMENT',
        action: 'VIEW',
      },
      { label: 'Sổ giao dịch', path: paths.financeTransactions, icon: FileText, resource: 'PAYMENT', action: 'VIEW' },
      { label: 'Quỹ tiền mặt', path: paths.financeCashDrawer, icon: Wallet, resource: 'PAYMENT', action: 'VIEW' },
      {
        label: 'Công nợ khách hàng',
        path: paths.financeReceivables,
        icon: Users,
        resource: 'PAYMENT',
        action: 'VIEW',
      },
      {
        label: 'Báo cáo tài chính',
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
      { label: 'Hồ sơ chủ xe', path: paths.consignmentOwners, icon: Building2, resource: 'CONSIGNMENT', action: 'VIEW' },
      {
        label: 'Hợp đồng ký gửi',
        path: paths.consignmentContracts,
        icon: ScrollText,
        resource: 'CONSIGNMENT',
        action: 'VIEW',
      },
      {
        label: 'Lịch chi trả hàng tháng',
        path: paths.consignmentPayouts,
        icon: Wallet,
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
