import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginScreen } from '@/features/auth'
import { CalendarScreen, DispatchBoardScreen } from '@/features/calendar'
import {
  ConsignmentContractDetailScreen,
  ConsignmentContractListScreen,
  VehicleOwnerDetailScreen,
  VehicleOwnerListScreen,
} from '@/features/consignment'
import { ContractDetailScreen, ContractListScreen } from '@/features/contracts'
import { CustomerDetailScreen, CustomerListScreen } from '@/features/customers'
import { EmployeeListScreen } from '@/features/employees'
import { CashDrawerScreen, CostRecordsScreen, CustomerReceivablesScreen, FinanceReportScreen, SettlementListScreen, TransactionLedgerScreen } from '@/features/finance'
import { HandoverReturnListScreen } from '@/features/handover-return'
import { IncidentDetailScreen, IncidentListScreen } from '@/features/incidents'
import { MaintenanceScreen } from '@/features/maintenance'
import { RentalDetailScreen, RentalListScreen } from '@/features/rentals'
import { VehicleDetailScreen, VehicleListScreen } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { AppShell } from '@/shared/layout/AppShell'
import { ComingSoon } from '@/shared/layout/ComingSoon'
import { paths } from './paths'

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.login} element={<LoginScreen />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to={paths.dashboard} replace />} />
        <Route path={paths.dashboard} element={<ComingSoon title="Dashboard" />} />
        <Route path={paths.calendar} element={<CalendarScreen />} />

        <Route path={paths.vehicles} element={<VehicleListScreen />} />
        <Route path="/vehicles/:id" element={<VehicleDetailScreen />} />
        <Route path={paths.maintenance} element={<MaintenanceScreen />} />

        <Route path={paths.customers} element={<CustomerListScreen />} />
        <Route path="/customers/:id" element={<CustomerDetailScreen />} />

        <Route path={paths.dispatchBoard} element={<DispatchBoardScreen />} />
        <Route path={paths.employees} element={<EmployeeListScreen />} />
        <Route path="/employees/:id" element={<ComingSoon title="Chi tiết nhân viên" />} />

        <Route path={paths.rentals} element={<RentalListScreen />} />
        <Route path="/rentals/:id" element={<RentalDetailScreen />} />
        <Route path={paths.contracts} element={<ContractListScreen />} />
        <Route path="/contracts/:id" element={<ContractDetailScreen />} />

        <Route path={paths.handoverReturnTracking} element={<HandoverReturnListScreen />} />
        <Route path={paths.incidents} element={<IncidentListScreen />} />
        <Route path="/incidents/:id" element={<IncidentDetailScreen />} />

        <Route path={paths.financeSettlement} element={<SettlementListScreen />} />
        <Route path={paths.financeTransactions} element={<TransactionLedgerScreen />} />
        <Route path={paths.financeCashDrawer} element={<CashDrawerScreen />} />
        <Route path={paths.financeReceivables} element={<CustomerReceivablesScreen />} />
        <Route path={paths.financeCosts} element={<CostRecordsScreen />} />
        <Route path={paths.financeReports} element={
            // Màn báo cáo tải lười (`finance/screens/lazyScreens.ts`) — `recharts` nằm ngoài chunk chính.
            <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
              <FinanceReportScreen />
            </Suspense>
          }
        />

        <Route path={paths.consignmentOwners} element={<VehicleOwnerListScreen />} />
        <Route path="/consignment/owners/:id" element={<VehicleOwnerDetailScreen />} />
        <Route path={paths.consignmentContracts} element={<ConsignmentContractListScreen />} />
        <Route path="/consignment/contracts/:id" element={<ConsignmentContractDetailScreen />} />
        <Route path={paths.consignmentPayouts} element={<ComingSoon title="Lịch chi trả hàng tháng" />} />

        <Route path={paths.platformSystemConfig} element={<ComingSoon title="Cấu hình hệ thống" />} />
        <Route path={paths.platformPermissions} element={<ComingSoon title="Vai trò & quyền" />} />
        <Route path={paths.platformAudit} element={<ComingSoon title="Nhật ký thao tác" />} />
        <Route path={paths.platformNotifications} element={<ComingSoon title="Trung tâm thông báo" />} />
      </Route>

      <Route path="*" element={<Navigate to={paths.dashboard} replace />} />
    </Routes>
  )
}
