import type { VariantProps } from 'class-variance-authority'
import type { ContractStatus } from '@/shared/domain/enums'
import { CONTRACT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** Vòng đời hợp đồng (6 trạng thái) — mirror `RentalStatusBadge`. */
const STATUS_VARIANT: Record<ContractStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  GENERATED: 'neutral',
  SIGNED: 'info',
  ACTIVE: 'success',
  CLOSED: 'info',
  VOID: 'destructive',
  SUPERSEDED: 'warning',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>
}
