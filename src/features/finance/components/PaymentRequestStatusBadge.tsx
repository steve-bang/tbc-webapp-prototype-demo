import type { VariantProps } from 'class-variance-authority'
import type { PaymentRequestStatus } from '@/shared/domain/enums'
import { PAYMENT_REQUEST_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** `Payment-UseCase.md` §4.2 — mirror `TransactionStatusBadge`. */
const STATUS_VARIANT: Record<PaymentRequestStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  OPEN: 'neutral',
  PARTIALLY_FULFILLED: 'warning',
  FULFILLED: 'success',
  CANCELLED: 'destructive',
}

export function PaymentRequestStatusBadge({ status }: { status: PaymentRequestStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PAYMENT_REQUEST_STATUS_LABELS[status]}</Badge>
}
