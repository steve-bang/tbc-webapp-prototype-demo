import type { VariantProps } from 'class-variance-authority'
import type { AssignmentStatus } from '@/shared/domain/enums'
import { ASSIGNMENT_STATUS_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/**
 * Vòng đời phân công (6 trạng thái, `EmployeeAssignment-BRD.md` §10) — mirror
 * `IncidentStatusBadge`/`EmployeeStatusBadge`. `REASSIGNED` chỉ-seed Round 1
 * (xem comment `ASSIGNMENT_STATUSES` ở `shared/domain/enums.ts`).
 */
const STATUS_VARIANT: Record<AssignmentStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  REASSIGNED: 'neutral',
  CANCELLED: 'destructive',
  MISSED: 'destructive',
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>
}
