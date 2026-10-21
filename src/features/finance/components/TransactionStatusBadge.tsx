import type { VariantProps } from 'class-variance-authority'
import type { TransactionStatus } from '@/shared/domain/enums'
import { TRANSACTION_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** `Payment-BRD.md` §6.1 — mirror `SettlementStatusBadge`. */
const STATUS_VARIANT: Record<TransactionStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  FAILED: 'destructive',
  VOIDED: 'neutral',
  REVERSED: 'info',
}

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{TRANSACTION_STATUS_LABELS[status]}</Badge>
}
