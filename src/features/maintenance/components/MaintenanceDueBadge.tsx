import type { VariantProps } from 'class-variance-authority'
import { MAINTENANCE_DUE_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'
import type { MaintenanceDueStatus } from '../model'

const STATUS_VARIANT: Record<MaintenanceDueStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'destructive',
}

export function MaintenanceDueBadge({ status }: { status: MaintenanceDueStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{MAINTENANCE_DUE_STATUS_LABELS[status]}</Badge>
}
