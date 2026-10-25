import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuditLogScreen } from '@/features/audit/ui'
import { LoginScreen, PermissionMatrixScreen, RequirePermission, SystemConfigScreen } from '@/features/auth/ui'
import { CalendarScreen, DispatchBoardScreen } from '@/features/calendar/ui'
import {
  ConsignmentContractDetailScreen,
  ConsignmentContractListScreen,
  ConsignmentProposalDetailScreen,
  ConsignmentProposalListScreen,
  OwnerPayoutScheduleScreen,
  VehicleOwnerDetailScreen,
  VehicleOwnerListScreen,
} from '@/features/consignment/ui'
import { ContractDetailScreen, ContractListScreen } from '@/features/contracts/ui'
import { CustomerDetailScreen, CustomerListScreen } from '@/features/customers/ui'
import { DashboardScreen } from '@/features/dashboard/ui'
import { EmployeeDetailScreen, EmployeeListScreen } from '@/features/employees/ui'
import { CashDrawerScreen, CostRecordsScreen, CustomerReceivablesScreen, FinanceReportScreen, OwnerPayoutScreen, SettlementListScreen, TransactionLedgerScreen } from '@/features/finance/ui'
import { HandoverReturnListScreen } from '@/features/handover-return/ui'
import { IncidentDetailScreen, IncidentListScreen } from '@/features/incidents/ui'
import { MaintenanceScreen } from '@/features/maintenance/ui'
import { NotificationBell, NotificationCenterScreen } from '@/features/notifications/ui'
import { RentalDetailScreen, RentalListScreen } from '@/features/rentals/ui'
import { VehicleDetailScreen, VehicleListScreen } from '@/features/vehicles/ui'
import { vi } from '@/shared/i18n/vi'
import { AppShell } from '@/shared/layout/AppShell'
import { paths } from './paths'
import { ROUTE_ACCESS } from './routeAccess'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginScreen />} />

      <Route element={<AppShell topbarSlot={<NotificationBell />} />}>
        <Route path="/" element={<Navigate to={paths.dashboard} replace />} />
        <Route path={paths.dashboard} element={<DashboardScreen />} />
        <Route element={<RequirePermission access={ROUTE_ACCESS.calendar} />}>
          {/* Màn Lịch tải lười (`calendar/screens/lazyScreens.ts`) — CALENDAR-ROUND3-PLAN.md C3. */}
          <Route
            path={paths.calendar}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <CalendarScreen />
              </Suspense>
            }
          />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.vehicles} />}>
          <Route path={paths.vehicles} element={<VehicleListScreen />} />
          <Route path="/vehicles/:id" element={<VehicleDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.maintenance} />}>
          <Route path={paths.maintenance} element={<MaintenanceScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.customers} />}>
          <Route path={paths.customers} element={<CustomerListScreen />} />
          <Route path="/customers/:id" element={<CustomerDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.dispatchBoard} />}>
          <Route path={paths.dispatchBoard} element={<DispatchBoardScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.employees} />}>
          <Route path={paths.employees} element={<EmployeeListScreen />} />
          <Route
            path="/employees/:id"
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <EmployeeDetailScreen />
              </Suspense>
            }
          />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.rentals} />}>
          <Route path={paths.rentals} element={<RentalListScreen />} />
          <Route path="/rentals/:id" element={<RentalDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.contracts} />}>
          <Route path={paths.contracts} element={<ContractListScreen />} />
          <Route path="/contracts/:id" element={<ContractDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.handoverReturn} />}>
          <Route path={paths.handoverReturnTracking} element={<HandoverReturnListScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.incidents} />}>
          <Route path={paths.incidents} element={<IncidentListScreen />} />
          <Route path="/incidents/:id" element={<IncidentDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.settlement} />}>
          <Route path={paths.financeSettlement} element={<SettlementListScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.payment} />}>
          <Route path={paths.financeTransactions} element={<TransactionLedgerScreen />} />
          <Route path={paths.financeCashDrawer} element={<CashDrawerScreen />} />
          <Route path={paths.financeReceivables} element={<CustomerReceivablesScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.financeReport} />}>
          <Route path={paths.financeCosts} element={<CostRecordsScreen />} />
          {/* Màn báo cáo tải lười (`finance/screens/lazyScreens.ts`) — `recharts` nằm ngoài chunk chính. */}
          <Route
            path={paths.financeReports}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <FinanceReportScreen />
              </Suspense>
            }
          />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.consignment} />}>
          <Route path={paths.consignmentOwners} element={<VehicleOwnerListScreen />} />
          <Route path="/consignment/owners/:id" element={<VehicleOwnerDetailScreen />} />
          <Route path={paths.consignmentContracts} element={<ConsignmentContractListScreen />} />
          <Route path="/consignment/contracts/:id" element={<ConsignmentContractDetailScreen />} />
          <Route path={paths.consignmentPayouts} element={<OwnerPayoutScheduleScreen />} />
          {/* Màn của `finance/payment` — mount ở nhóm Xe ký gửi (WebappQuanTri.md §5.4). */}
          <Route path={paths.consignmentOwnerPayouts} element={<OwnerPayoutScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.consignmentProposals} />}>
          <Route path={paths.consignmentProposals} element={<ConsignmentProposalListScreen />} />
          <Route path="/consignment/proposals/:id" element={<ConsignmentProposalDetailScreen />} />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.systemAdmin} />}>
          <Route
            path={paths.platformSystemConfig}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <SystemConfigScreen />
              </Suspense>
            }
          />
          <Route
            path={paths.platformPermissions}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <PermissionMatrixScreen />
              </Suspense>
            }
          />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.audit} />}>
          <Route
            path={paths.platformAudit}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <AuditLogScreen />
              </Suspense>
            }
          />
        </Route>

        <Route element={<RequirePermission access={ROUTE_ACCESS.notifications} />}>
          <Route
            path={paths.platformNotifications}
            element={
              <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
                <NotificationCenterScreen />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
    </Routes>
  )
}
