import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { Suspense, useMemo } from 'react'
import { usePermission } from '@/features/auth'
import { DashboardFinanceWidget } from '@/features/finance'
import { groupSignalsForDashboard, useOperationalSignals } from '@/features/notifications'
import { useRentals } from '@/features/rentals'
import { useVehicles } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { AlertPanel } from '../components/AlertPanel'
import { OperationalKpiCards } from '../components/OperationalKpiCards'
import { buildOperationalKpis } from '../model'

/**
 * Dashboard (`/dashboard`) — trang mặc định sau đăng nhập (CR-2026-032, `WebappQuanTri.md` §5.3). Chỉ đọc: KPI vận hành,
 * widget KPI tài chính (do `finance` sở hữu — `RevenueCost-BRD.md` §17) và bảng cảnh báo (tín hiệu từ `features/notifications`).
 */
export function DashboardScreen() {
  const t = vi.dashboard
  const queryClient = useQueryClient()
  const { can } = usePermission()
  const canViewVehicles = can('VEHICLE', 'VIEW')
  const canViewRentals = can('RENTAL', 'VIEW')
  const canViewFinance = can('FINANCE_REPORT', 'VIEW')

  const vehicleQuery = useVehicles()
  const rentalQuery = useRentals()
  const signalQuery = useOperationalSignals()

  const kpis = useMemo(
    () => buildOperationalKpis({ vehicles: vehicleQuery.data ?? [], rentals: rentalQuery.data ?? [], now: new Date() }),
    [vehicleQuery.data, rentalQuery.data],
  )
  const alertGroups = useMemo(() => groupSignalsForDashboard(signalQuery.data ?? [], can), [signalQuery.data, can])

  const hasContent = canViewVehicles || canViewRentals || canViewFinance || alertGroups.length > 0
  const updatedAt = signalQuery.dataUpdatedAt ? formatTime(new Date(signalQuery.dataUpdatedAt).toISOString()) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            {updatedAt && (
              <span className="text-muted-foreground text-xs">
                {t.updatedAt} {updatedAt}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCw />
              {t.refresh}
            </Button>
          </>
        }
      />

      {!hasContent ? (
        <div className="border-border text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          <p className="text-foreground font-medium">{t.emptyAllTitle}</p>
          <p className="mt-1">{t.emptyAllDescription}</p>
        </div>
      ) : (
        <>
          {(canViewVehicles || canViewRentals) && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold">{t.opsSectionTitle}</h2>
              <OperationalKpiCards kpis={kpis} canViewVehicles={canViewVehicles} canViewRentals={canViewRentals} />
            </section>
          )}

          {canViewFinance && (
            <Suspense fallback={<p className="text-muted-foreground text-sm">{vi.common.loading}</p>}>
              <DashboardFinanceWidget />
            </Suspense>
          )}

          {alertGroups.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">{t.alertsTitle}</h2>
                <p className="text-muted-foreground text-sm">{t.alertsDescription}</p>
              </div>
              {signalQuery.isError ? (
                <p className="text-destructive text-sm">{t.loadError}</p>
              ) : signalQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
              ) : (
                <AlertPanel groups={alertGroups} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
