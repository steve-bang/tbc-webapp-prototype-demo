import type { VariantProps } from 'class-variance-authority'
import type { IncidentStatus } from '@/shared/domain/enums'
import { INCIDENT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/**
 * Vòng đời sự cố (11 trạng thái, `DamageIncident-BRD.md` §8/§20) — mirror
 * `RentalStatusBadge`. Nhóm màu: `neutral` (mới ghi nhận/đóng không tính
 * phí) → `info` (đang đánh giá/đã duyệt) → `warning` (chờ duyệt/đang sửa) →
 * `success` (đã sửa/đã đóng) → `destructive` (ngoài luồng chính: tranh
 * chấp/huỷ/ghi giảm giá trị).
 */
const STATUS_VARIANT: Record<IncidentStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  OPEN: 'neutral',
  ASSESSING: 'info',
  WAITING_APPROVAL: 'warning',
  APPROVED: 'info',
  IN_REPAIR: 'warning',
  REPAIRED: 'success',
  CLOSED: 'success',
  DISPUTED: 'destructive',
  CANCELLED: 'destructive',
  WRITTEN_OFF: 'destructive',
  CLOSED_NO_ACTION: 'neutral',
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{INCIDENT_STATUS_LABELS[status]}</Badge>
}
