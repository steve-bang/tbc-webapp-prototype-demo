import type { VariantProps } from 'class-variance-authority'
import type { CustomerStatus } from '@/shared/domain/enums'
import { CUSTOMER_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

const STATUS_VARIANT: Record<CustomerStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  ACTIVE: 'success',
  BLOCKED: 'destructive',
}

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CUSTOMER_STATUS_LABELS[status]}</Badge>
}
