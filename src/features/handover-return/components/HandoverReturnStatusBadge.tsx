import type { VariantProps } from 'class-variance-authority'
import type { HandoverReturnStatus } from '@/shared/domain/enums'
import { HANDOVER_RETURN_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** Dùng chung cho cả `HandoverRecord`/`ReturnRecord` (cùng enum) — mirror `ContractStatusBadge`. */
const STATUS_VARIANT: Record<HandoverReturnStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  DISCARDED: 'warning',
}

export function HandoverReturnStatusBadge({ status }: { status: HandoverReturnStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{HANDOVER_RETURN_STATUS_LABELS[status]}</Badge>
}
