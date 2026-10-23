import type { VariantProps } from 'class-variance-authority'
import type { ConsignmentContractStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** Vòng đời hợp đồng ký gửi (8 trạng thái) — mirror `ContractStatusBadge`. */
const STATUS_VARIANT: Record<ConsignmentContractStatus, BadgeVariant> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  SIGNED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  TERMINATED: 'destructive',
  CLOSED: 'neutral',
  SUPERSEDED: 'neutral',
}

export function ConsignmentContractStatusBadge({
  status,
  expiringSoon = false,
}: {
  status: ConsignmentContractStatus
  /** VC-BR-19 — thêm badge "Sắp hết hạn" bên cạnh trạng thái. */
  expiringSoon?: boolean
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant={STATUS_VARIANT[status]}>{CONSIGNMENT_CONTRACT_STATUS_LABELS[status]}</Badge>
      {expiringSoon && <Badge variant="warning">{vi.consignment.expiringSoonBadge}</Badge>}
    </span>
  )
}
