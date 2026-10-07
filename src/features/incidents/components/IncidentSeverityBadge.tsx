import type { VariantProps } from 'class-variance-authority'
import type { IncidentSeverity } from '@/shared/domain/enums'
import { INCIDENT_SEVERITY_LABELS } from '@/shared/i18n/vi'
import { Badge, type badgeVariants } from '@/shared/ui/badge'

/** Mức độ nghiêm trọng (`DamageIncident-BRD.md` §9.2) — mirror `IncidentStatusBadge`. */
const SEVERITY_VARIANT: Record<IncidentSeverity, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  MINOR: 'neutral',
  MODERATE: 'info',
  MAJOR: 'warning',
  CRITICAL: 'destructive',
}

export function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }) {
  return <Badge variant={SEVERITY_VARIANT[severity]}>{INCIDENT_SEVERITY_LABELS[severity]}</Badge>
}
