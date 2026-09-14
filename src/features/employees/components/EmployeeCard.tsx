import { Pencil, RefreshCcw } from 'lucide-react'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import type { Employee } from '../model'
import { EmployeeStatusBadge } from './EmployeeStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — `CONVENTIONS.md` §8. */
export function EmployeeCard({
  employee,
  canEdit,
  onEdit,
  onChangeStatus,
}: {
  employee: Employee
  canEdit: boolean
  onEdit: () => void
  onChangeStatus: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{employee.fullName}</p>
            <p className="text-muted-foreground text-xs">{employee.employeeCode}</p>
          </div>
          <EmployeeStatusBadge status={employee.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{employee.phone}</span>
          <Badge variant="secondary">{ROLE_LABELS[employee.role]}</Badge>
        </div>
        <div className="text-muted-foreground text-sm">
          {vi.employees.area}: {employee.assignedArea ?? vi.employees.noArea}
        </div>
        <div className="text-muted-foreground text-sm">
          {vi.employees.account}: {employee.account?.username ?? vi.employees.noAccount}
        </div>
        {canEdit && (
          <div className="mt-1 flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
            <Button size="sm" variant="outline" onClick={onChangeStatus}>
              <RefreshCcw className="size-3.5" />
              {vi.employees.changeStatus}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
