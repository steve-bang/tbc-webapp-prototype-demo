import type { VariantProps } from 'class-variance-authority'
import type { SettlementStatus } from '@/shared/domain/enums'
import { SETTLEMENT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** 5 trạng thái quyết toán (`RentalSettlement-UseCase.md` §4) — mirror `IncidentStatusBadge`. */
const STATUS_VARIANT: Record<SettlementStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  DRAFT: 'neutral',
  PENDING_CUSTOMER: 'info',
  WAITING_APPROVAL: 'warning',
  CONFIRMED: 'info',
  COMPLETED: 'success',
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{SETTLEMENT_STATUS_LABELS[status]}</Badge>
}
