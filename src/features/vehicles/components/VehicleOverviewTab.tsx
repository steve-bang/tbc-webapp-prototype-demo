import type { VariantProps } from 'class-variance-authority'
import { useMemo } from 'react'
import {
  applicableRule,
  latestOdometerForCategory,
  maintenanceDueStatus,
  nextDueKm,
  useMaintenanceRecords,
  useMaintenanceRules,
  type MaintenanceDueStatus,
} from '@/features/maintenance'
import { MAINTENANCE_DUE_STATUS_LABELS, OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { documentExpiryStatus } from '@/shared/lib/documentStatus'
import { Badge, type badgeVariants } from '@/shared/ui/badge'
import type { Vehicle } from '../model'
import { VehicleStatusBadge } from './VehicleStatusBadge'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.vehicles.noValue}</span>
    </div>
  )
}

const DUE_STATUS_VARIANT: Record<MaintenanceDueStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'destructive',
}

interface NearestDue {
  category: string
  nextDue: number
  status: MaintenanceDueStatus
}

const STATUS_ORDER: Record<MaintenanceDueStatus, number> = { OVERDUE: 0, DUE_SOON: 1, OK: 2 }

/**
 * Tab "Tổng quan" (mặc định) — `docs/VEHICLE-MANAGEMENT-PLAN.md` §8.3 dòng 1.
 * Basic info + tóm tắt giấy tờ (`documentExpiryStatus()`, đếm `EXPIRING_SOON`/
 * `EXPIRED`) + tóm tắt bảo dưỡng (category gần đến hạn nhất — tái dùng
 * `applicableRule()`/`nextDueKm()`/`maintenanceDueStatus()` từ
 * `@/features/maintenance`, §8.4 mục 3) + placeholder "—" cho lượt thuê/doanh
 * thu/chi phí/lợi nhuận vì chưa có module nguồn (`CR-2026-036`).
 */
export function VehicleOverviewTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: rules = [] } = useMaintenanceRules()
  const { data: records = [] } = useMaintenanceRecords({ vehicleId: vehicle.id })

  const expiringSoonCount = vehicle.documents.filter(
    (d) => documentExpiryStatus(d.expiryDate, d.warningLeadDays) === 'EXPIRING_SOON',
  ).length
  const expiredCount = vehicle.documents.filter(
    (d) => documentExpiryStatus(d.expiryDate, d.warningLeadDays) === 'EXPIRED',
  ).length

  const nearestDue = useMemo<NearestDue | undefined>(() => {
    const activeRules = rules.filter((r) => r.active)
    const categories = new Set(
      activeRules
        .filter(
          (r) =>
            (r.appliesTo === 'SPECIFIC_VEHICLE' && r.vehicleId === vehicle.id) ||
            (r.appliesTo === 'VEHICLE_MODEL' && r.vehicleModel === vehicle.model),
        )
        .map((r) => r.category),
    )
    let best: NearestDue | undefined
    for (const category of categories) {
      const rule = applicableRule(rules, vehicle, category)
      if (!rule) continue
      const latestOdometer = latestOdometerForCategory(records, vehicle.id, category)
      const nextDue = nextDueKm(rule, latestOdometer)
      const status = maintenanceDueStatus(nextDue, vehicle.currentKm)
      if (
        !best ||
        STATUS_ORDER[status] < STATUS_ORDER[best.status] ||
        (STATUS_ORDER[status] === STATUS_ORDER[best.status] && nextDue < best.nextDue)
      ) {
        best = { category, nextDue, status }
      }
    }
    return best
  }, [rules, records, vehicle])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.vehicles.sectionBasic}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.vehicles.plate} value={vehicle.plate} />
          <Field label={vi.vehicles.brand} value={vehicle.brand} />
          <Field label={vi.vehicles.model} value={vehicle.model} />
          <Field
            label={vi.vehicles.manufacturingYear}
            value={vehicle.manufacturingYear !== undefined ? String(vehicle.manufacturingYear) : undefined}
          />
          <Field label={vi.vehicles.color} value={vehicle.color} />
          <Field label={vi.vehicles.vehicleClass} value={VEHICLE_CLASS_LABELS[vehicle.vehicleClass]} />
          <Field label={vi.vehicles.currentKm} value={`${vehicle.currentKm.toLocaleString('vi-VN')} km`} />
          <Field
            label={vi.vehicles.fuelLevel}
            value={vehicle.fuelLevel !== undefined ? `${vehicle.fuelLevel}%` : undefined}
          />
        </div>

        <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.vehicles.sectionOwnership}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{vi.common.status}</span>
            <VehicleStatusBadge status={vehicle.status} />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">{vi.vehicles.ownershipType}</span>
            <Badge variant="outline">{OWNERSHIP_TYPE_LABELS[vehicle.ownershipType]}</Badge>
          </div>
          <Field
            label={vi.vehicles.bankFinanced}
            value={vehicle.bankFinanced ? vi.vehicles.bankFinancedYes : vi.vehicles.bankFinancedNo}
          />
        </div>
        {vehicle.note && <Field label={vi.vehicles.note} value={vehicle.note} />}
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.vehicles.overviewDocumentsTitle}</h3>
        {expiringSoonCount === 0 && expiredCount === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.vehicles.overviewDocumentsAllValid}</p>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            {expiredCount > 0 && (
              <span className="text-destructive">
                {vi.vehicles.overviewDocumentsExpired}: {expiredCount}
              </span>
            )}
            {expiringSoonCount > 0 && (
              <span className="text-status-pending">
                {vi.vehicles.overviewDocumentsExpiringSoon}: {expiringSoonCount}
              </span>
            )}
          </div>
        )}

        <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.vehicles.overviewMaintenanceTitle}</h3>
        {!nearestDue ? (
          <p className="text-muted-foreground text-sm">{vi.vehicles.overviewMaintenanceEmpty}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{nearestDue.category}</span>
            <span className="text-muted-foreground">
              {vi.vehicles.overviewMaintenanceNextDue} {nearestDue.nextDue.toLocaleString('vi-VN')} km
            </span>
            <Badge variant={DUE_STATUS_VARIANT[nearestDue.status]}>
              {MAINTENANCE_DUE_STATUS_LABELS[nearestDue.status]}
            </Badge>
          </div>
        )}

        <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.vehicles.overviewOtherTitle}</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label={vi.vehicles.overviewRentalCount} value="—" />
          <Field label={vi.vehicles.overviewRevenue} value="—" />
          <Field label={vi.vehicles.overviewCost} value="—" />
          <Field label={vi.vehicles.overviewProfit} value="—" />
        </div>
        <p className="text-muted-foreground text-xs">{vi.vehicles.overviewNoSource}</p>
      </div>
    </div>
  )
}
