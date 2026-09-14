import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginScreen } from '@/features/auth'
import { CalendarScreen } from '@/features/calendar'
import { CustomerDetailScreen, CustomerListScreen } from '@/features/customers'
import { EmployeeListScreen } from '@/features/employees'
import { MaintenanceScreen } from '@/features/maintenance'
import { RentalListScreen } from '@/features/rentals'
import { VehicleDetailScreen, VehicleListScreen } from '@/features/vehicles'
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

        <Route path={paths.dispatchBoard} element={<ComingSoon title="Bảng điều phối trong ngày" />} />
        <Route path={paths.employees} element={<EmployeeListScreen />} />
        <Route path="/employees/:id" element={<ComingSoon title="Chi tiết nhân viên" />} />

        <Route path={paths.rentals} element={<RentalListScreen />} />
        <Route path="/rentals/:id" element={<ComingSoon title="Chi tiết lượt thuê" />} />
        <Route path={paths.contracts} element={<ComingSoon title="Hợp đồng" />} />
        <Route path="/contracts/:id" element={<ComingSoon title="Chi tiết hợp đồng" />} />

        <Route path={paths.handoverReturnTracking} element={<ComingSoon title="Theo dõi giao / nhận xe" />} />
        <Route path={paths.incidents} element={<ComingSoon title="Hồ sơ sự cố" />} />
        <Route path="/incidents/:id" element={<ComingSoon title="Chi tiết sự cố" />} />

        <Route path={paths.financeSettlement} element={<ComingSoon title="Quyết toán" />} />
        <Route path={paths.financeTransactions} element={<ComingSoon title="Sổ giao dịch" />} />
        <Route path={paths.financeCashDrawer} element={<ComingSoon title="Quỹ tiền mặt" />} />
        <Route path={paths.financeReceivables} element={<ComingSoon title="Công nợ khách hàng" />} />
        <Route path={paths.financeReports} element={<ComingSoon title="Báo cáo tài chính" />} />

        <Route path={paths.consignmentOwners} element={<ComingSoon title="Hồ sơ chủ xe" />} />
        <Route path={paths.consignmentContracts} element={<ComingSoon title="Hợp đồng ký gửi" />} />
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
