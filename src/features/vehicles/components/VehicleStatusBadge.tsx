import type { VariantProps } from 'class-variance-authority'
import type { VehicleStatus } from '@/shared/domain/enums'
import { VEHICLE_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

const STATUS_VARIANT: Record<VehicleStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  AVAILABLE: 'success',
  RENTED: 'info',
  MAINTENANCE: 'warning',
  INACTIVE: 'destructive',
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{VEHICLE_STATUS_LABELS[status]}</Badge>
}
