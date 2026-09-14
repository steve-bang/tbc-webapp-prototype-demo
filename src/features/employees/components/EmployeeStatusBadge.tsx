import type { VariantProps } from 'class-variance-authority'
import type { EmployeeStatus } from '@/shared/domain/enums'
import { EMPLOYEE_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

const STATUS_VARIANT: Record<EmployeeStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  SUSPENDED: 'warning',
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{EMPLOYEE_STATUS_LABELS[status]}</Badge>
}
