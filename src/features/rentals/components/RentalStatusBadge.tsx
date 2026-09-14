import type { VariantProps } from 'class-variance-authority'
import type { RentalStatus } from '@/shared/domain/enums'
import { RENTAL_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/**
 * Vòng đời lượt thuê (12 trạng thái, CR-2026-043) — mirror `VehicleStatusBadge`.
 * Nhóm màu theo ý nghĩa: `neutral` (nháp) → `info` (đã xác nhận/đã lập hợp
 * đồng/đã nhận xe) → `warning` (đang chờ xử lý tiếp) → `success` (đang/đã
 * hoàn tất tốt) → `destructive` (ngoài luồng chính: huỷ/không đến/tranh chấp).
 */
const STATUS_VARIANT: Record<RentalStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  CONTRACT_CREATED: 'info',
  READY_FOR_HANDOVER: 'warning',
  HANDED_OVER: 'warning',
  IN_RENTAL: 'success',
  RETURNED: 'info',
  SETTLEMENT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
  DISPUTED: 'destructive',
}

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{RENTAL_STATUS_LABELS[status]}</Badge>
}
