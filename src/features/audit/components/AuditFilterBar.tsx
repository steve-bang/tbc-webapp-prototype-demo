import { DEMO_ACCOUNTS } from '@/features/auth'
import { AUDIT_ACTIONS, AUDIT_MODULES, AUDIT_SEVERITIES, type AuditActorType, type AuditModule, type AuditSeverity } from '@/shared/domain/enums'
import { AUDIT_ACTION_LABELS, AUDIT_MODULE_LABELS, AUDIT_SEVERITY_LABELS } from '@/shared/i18n/auditLabels'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { ENTITY_MODULE_MAP, type AuditFilter } from '../model'

const ALL = '__ALL__'
/** Giá trị đặc biệt của ô "Người thực hiện" cho tác nhân hệ thống → lọc theo `actorType`. */
const SYSTEM = '__SYSTEM__'
const ENTITY_TYPES = Object.keys(ENTITY_MODULE_MAP).sort()

interface AuditFilterBarProps {
  filter: AuditFilter
  onChange: (next: AuditFilter) => void
}

/** Bộ lọc nhật ký — AuditLog-BRD.md §9.1 (bỏ "Kết quả thành công/thất bại": bản demo chưa có `LOGIN_FAILED`). */
export function AuditFilterBar({ filter, onChange }: AuditFilterBarProps) {
  const t = vi.audit.filters
  const hasFilter = Object.values(filter).some((v) => v !== undefined && v !== '')
  const actorValue = filter.actorType === 'SYSTEM' ? SYSTEM : (filter.actorUserId ?? ALL)

  function set(patch: Partial<AuditFilter>) {
    onChange({ ...filter, ...patch })
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={filter.module ?? ALL} onValueChange={(v) => set({ module: v === ALL ? undefined : (v as AuditModule) })}>
          <SelectTrigger className="w-full" aria-label={t.module}>
            <SelectValue placeholder={t.module} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.module}: ${t.all}`}</SelectItem>
            {AUDIT_MODULES.map((v) => (
              <SelectItem key={v} value={v}>
                {AUDIT_MODULE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.action ?? ALL}
          onValueChange={(v) => set({ action: v === ALL ? undefined : (v as AuditFilter['action']) })}
        >
          <SelectTrigger className="w-full" aria-label={t.action}>
            <SelectValue placeholder={t.action} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.action}: ${t.all}`}</SelectItem>
            {AUDIT_ACTIONS.map((v) => (
              <SelectItem key={v} value={v}>
                {AUDIT_ACTION_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actorValue}
          onValueChange={(v) => {
            if (v === ALL) set({ actorUserId: undefined, actorType: undefined })
            else if (v === SYSTEM) set({ actorUserId: undefined, actorType: 'SYSTEM' as AuditActorType })
            else set({ actorUserId: v, actorType: undefined })
          }}
        >
          <SelectTrigger className="w-full" aria-label={t.actor}>
            <SelectValue placeholder={t.actor} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.actor}: ${t.all}`}</SelectItem>
            {DEMO_ACCOUNTS.map((a) => (
              <SelectItem key={a.userId} value={a.userId}>
                {`${a.fullName} (${a.role})`}
              </SelectItem>
            ))}
            <SelectItem value={SYSTEM}>{vi.audit.systemActor}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.severity ?? ALL} onValueChange={(v) => set({ severity: v === ALL ? undefined : (v as AuditSeverity) })}>
          <SelectTrigger className="w-full" aria-label={t.severity}>
            <SelectValue placeholder={t.severity} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.severity}: ${t.all}`}</SelectItem>
            {AUDIT_SEVERITIES.map((v) => (
              <SelectItem key={v} value={v}>
                {AUDIT_SEVERITY_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filter.entity ?? ALL} onValueChange={(v) => set({ entity: v === ALL ? undefined : v })}>
          <SelectTrigger className="w-full" aria-label={t.entityType}>
            <SelectValue placeholder={t.entityType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.entityType}: ${t.all}`}</SelectItem>
            {ENTITY_TYPES.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          aria-label={t.entityId}
          placeholder={t.entityId}
          value={filter.entityId ?? ''}
          onChange={(e) => set({ entityId: e.target.value.trim() || undefined })}
        />

        <Input
          aria-label={t.correlation}
          placeholder={t.correlation}
          value={filter.correlationId ?? ''}
          onChange={(e) => set({ correlationId: e.target.value.trim() || undefined })}
        />

        <div className="flex min-w-0 items-center gap-2">
          <Input
            type="date"
            aria-label={t.from}
            title={t.from}
            value={filter.from ?? ''}
            max={filter.to || undefined}
            onChange={(e) => set({ from: e.target.value || undefined })}
          />
          <Input
            type="date"
            aria-label={t.to}
            title={t.to}
            value={filter.to ?? ''}
            min={filter.from || undefined}
            onChange={(e) => set({ to: e.target.value || undefined })}
          />
        </div>
      </div>
      {hasFilter && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          {vi.audit.clearFilters}
        </Button>
      )}
    </div>
  )
}
