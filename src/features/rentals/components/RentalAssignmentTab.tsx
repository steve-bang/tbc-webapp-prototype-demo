import { useState } from 'react'
import { useAssignments, type Assignment, canCancelAssignment, canReassign } from '@/features/employees'
import { AssignmentCancelDialog } from '@/features/employees/components/AssignmentCancelDialog'
import { AssignmentCreateDialog } from '@/features/employees/components/AssignmentCreateDialog'
import { AssignmentReassignDialog } from '@/features/employees/components/AssignmentReassignDialog'
import { AssignmentStatusBadge } from '@/features/employees/components/AssignmentStatusBadge'
// `employees` chưa export `useEmployees` qua barrel `index.ts` — deep-import
// thẳng `hooks.ts`, cùng tiền lệ `RentalDetailScreen` (`useCustomers`/`useVehicles`).
import { useEmployees } from '@/features/employees/hooks'
import { usePermission } from '@/features/auth'
import type { AssignmentRole } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import type { Rental } from '../model'

const ROLES: AssignmentRole[] = ['DELIVERY', 'RECEIVING']
const WINDOW_MINUTES = 30

function plannedWindowOf(rental: Rental, role: AssignmentRole): { start: string; end: string } {
  const start = role === 'DELIVERY' ? rental.pickupDateTime : rental.expectedReturnDateTime
  const end = new Date(new Date(start).getTime() + WINDOW_MINUTES * 60_000).toISOString()
  return { start, end }
}

/** EA-BR-07 — chỉ Assignment khác `CANCELLED` được coi là đang hiệu lực/hiển thị. */
function activeAssignmentOf(assignments: Assignment[], role: AssignmentRole): Assignment | undefined {
  return assignments.find((a) => a.role === role && a.status !== 'CANCELLED')
}

/**
 * Tab "Phân công" ở `RentalDetailScreen` (thay placeholder) —
 * `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §5.2. 2 card (Giao xe/Nhận xe):
 * chưa có Assignment → nút "Phân công"; đã có → tên nhân viên + trạng thái +
 * nút "Đổi người"/"Huỷ phân công" (disable theo `canReassign`/`canCancelAssignment`).
 */
export function RentalAssignmentTab({ rental }: { rental: Rental }) {
  const { can } = usePermission()
  const canAssign = can('ASSIGNMENT', 'ASSIGN')

  const { data: assignments = [], isLoading } = useAssignments({ rentalId: rental.id })
  const { data: employees = [] } = useEmployees()

  const [assignRole, setAssignRole] = useState<AssignmentRole | null>(null)
  const [reassignTarget, setReassignTarget] = useState<Assignment | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Assignment | null>(null)

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ROLES.map((role) => {
        const assignment = activeAssignmentOf(assignments, role)
        const assignee = assignment ? employees.find((e) => e.id === assignment.assigneeEmployeeId) : undefined
        const roleLabel = role === 'DELIVERY' ? vi.employees.assignmentRoleDelivery : vi.employees.assignmentRoleReceiving

        return (
          <Card key={role}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{roleLabel}</h3>
                {assignment && <AssignmentStatusBadge status={assignment.status} />}
              </div>

              {assignment ? (
                <>
                  <div className="flex flex-col gap-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">{vi.employees.assignmentEmployeeLabel}: </span>
                      {assignee?.fullName ?? assignment.assigneeEmployeeId}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{vi.employees.assignmentPlannedWindow}: </span>
                      {formatDateTime(assignment.plannedWindowStart)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">{vi.employees.assignmentAssignedBy}: </span>
                      {assignment.assignedByName}
                    </p>
                    {assignment.cancelReason && (
                      <p>
                        <span className="text-muted-foreground">{vi.employees.assignmentCancelReasonValue}: </span>
                        {assignment.cancelReason}
                      </p>
                    )}
                  </div>

                  {assignment.reassignmentHistory.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-muted-foreground text-xs font-medium">{vi.employees.assignmentHistoryTitle}</p>
                      {assignment.reassignmentHistory.map((h) => (
                        <p key={h.id} className="text-muted-foreground text-xs">
                          {h.reason} ({h.byName}, {formatDateTime(h.at)})
                        </p>
                      ))}
                    </div>
                  )}

                  {canAssign && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" disabled={!canReassign(assignment)} onClick={() => setReassignTarget(assignment)}>
                        {vi.employees.assignmentReassignButton}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!canCancelAssignment(assignment)} onClick={() => setCancelTarget(assignment)}>
                        {vi.employees.assignmentCancelButton}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-status-pending text-sm font-medium">{vi.employees.assignmentUnassignedBadge}</p>
                  {canAssign && (
                    <Button size="sm" variant="outline" onClick={() => setAssignRole(role)}>
                      {vi.employees.assignmentAssignButton}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      {canAssign && assignRole && (
        <AssignmentCreateDialog
          rentalId={rental.id}
          role={assignRole}
          plannedWindowStart={plannedWindowOf(rental, assignRole).start}
          plannedWindowEnd={plannedWindowOf(rental, assignRole).end}
          open={!!assignRole}
          onOpenChange={(open) => !open && setAssignRole(null)}
        />
      )}
      {canAssign && (
        <AssignmentReassignDialog
          assignment={reassignTarget}
          open={!!reassignTarget}
          onOpenChange={(open) => !open && setReassignTarget(null)}
        />
      )}
      {canAssign && (
        <AssignmentCancelDialog
          assignment={cancelTarget}
          open={!!cancelTarget}
          onOpenChange={(open) => !open && setCancelTarget(null)}
        />
      )}
    </div>
  )
}
