import type { VariantProps } from 'class-variance-authority'
import type { ConsignmentProposalStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_PROPOSAL_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** Trạng thái đề nghị ký gửi (BRD mục 7.1) — mirror `ConsignmentContractStatusBadge`. */
const STATUS_VARIANT: Record<ConsignmentProposalStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  SUBMITTED: 'neutral',
  APPRAISING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
}

export function ConsignmentProposalStatusBadge({ status }: { status: ConsignmentProposalStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CONSIGNMENT_PROPOSAL_STATUS_LABELS[status]}</Badge>
}
