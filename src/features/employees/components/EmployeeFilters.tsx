import { EMPLOYEE_STATUSES, ROLES } from '@/shared/domain/enums'
import type { EmployeeStatus, Role } from '@/shared/domain/enums'
import { EMPLOYEE_STATUS_LABELS, ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface EmployeeFilterValue {
  role?: Role
  status?: EmployeeStatus
  area?: string
}

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** UC-EA-02 — 3 bộ lọc: Vai trò / Trạng thái làm việc / Khu vực phụ trách. */
export function EmployeeFilters({
  value,
  onChange,
  areas,
  className,
}: {
  value: EmployeeFilterValue
  onChange: (value: EmployeeFilterValue) => void
  areas: string[]
  className?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={value.role ?? ALL}
        onValueChange={(v) => onChange({ ...value, role: v === ALL ? undefined : (v as Role) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.employees.filterRole} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.employees.filterAllRoles}</SelectItem>
          {ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.status ?? ALL}
        onValueChange={(v) => onChange({ ...value, status: v === ALL ? undefined : (v as EmployeeStatus) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.employees.filterStatus} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.employees.filterAllStatuses}</SelectItem>
          {EMPLOYEE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {EMPLOYEE_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.area ?? ALL} onValueChange={(v) => onChange({ ...value, area: v === ALL ? undefined : v })}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.employees.filterArea} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.employees.filterAllAreas}</SelectItem>
          {areas.map((area) => (
            <SelectItem key={area} value={area}>
              {area}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
