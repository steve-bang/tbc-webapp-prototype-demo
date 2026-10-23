import type { VariantProps } from 'class-variance-authority'
import type { PayoutStatus } from '@/shared/domain/enums'
import { PAYOUT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** Trạng thái khoản chi trả chủ xe (BRD mục 7.3) — mirror `TransactionStatusBadge`. */
const STATUS_VARIANT: Record<PayoutStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  SCHEDULED: 'info',
  ON_HOLD: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
}

export function OwnerPayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PAYOUT_STATUS_LABELS[status]}</Badge>
}
