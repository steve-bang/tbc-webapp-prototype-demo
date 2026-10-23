import type { AuditSeverity } from '@/shared/domain/enums'

/** Biến thể `Badge` theo mức độ (AuditLog-BRD.md §6 Severity). */
export const SEVERITY_BADGE: Record<AuditSeverity, 'neutral' | 'info' | 'warning' | 'destructive'> = {
  INFO: 'neutral',
  NOTICE: 'info',
  SENSITIVE: 'warning',
  SECURITY: 'destructive',
}
