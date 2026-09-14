import type { VariantProps } from 'class-variance-authority'
import type { DocumentStatus } from '@/shared/domain/enums'
import { DOCUMENT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** `CM-R09`/`CM §23` — hiển thị hiệu lực giấy tờ (dựa trên `documentExpiryStatus()`). */
const STATUS_VARIANT: Record<DocumentStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  VALID: 'success',
  EXPIRING_SOON: 'warning',
  EXPIRED: 'destructive',
}

export function CustomerDocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{DOCUMENT_STATUS_LABELS[status]}</Badge>
}
