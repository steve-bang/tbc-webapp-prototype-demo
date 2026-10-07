import { Truck, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import { AssignmentCreateDialog } from '@/features/employees/components/AssignmentCreateDialog'
import { AssignmentReassignDialog } from '@/features/employees/components/AssignmentReassignDialog'
// `employees` export `useAssignments`/`Assignment` qua barrel (§9.3 kế hoạch),
// `useEmployees` thì chưa — deep-import thẳng `hooks.ts`, cùng tiền lệ
// `RentalAssignmentTab`/`RentalDetailScreen`.
import { useAssignments, type Assignment } from '@/features/employees'
import { useEmployees } from '@/features/employees/hooks'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel —
// deep-import, cùng tinh thần `CalendarScreen`.
import { useCustomers } from '@/features/customers/hooks'
import { useRentals, type Rental } from '@/features/rentals'
import { useVehicles } from '@/features/vehicles/hooks'
import type { AssignmentRole, RentalStatus } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
// Cùng feature — import trực tiếp `../model`, không phải cross-feature deep-import.
import { isOccupyingLikeStatus } from '../model'

interface DispatchRow {
  key: string
  rental: Rental
  role: AssignmentRole
  time: string
}

/** Rental chưa tới lúc giao xe — dùng cho danh sách "sắp giao"/hàng Giao xe hôm nay. */
const PRE_HANDOVER_STATUSES: RentalStatus[] = ['CONFIRMED', 'CONTRACT_CREATED', 'READY_FOR_HANDOVER']

const WINDOW_MINUTES = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Snapshot Planned Window — mirror `RentalAssignmentTab.plannedWindowOf()` (không export ở đó nên định nghĩa lại đây). */
function plannedWindowOf(rental: Rental, role: AssignmentRole): { start: string; end: string } {
  const start = role === 'DELIVERY' ? rental.pickupDateTime : rental.expectedReturnDateTime
  const end = new Date(new Date(start).getTime() + WINDOW_MINUTES * 60_000).toISOString()
  return { start, end }
}

/**
 * `DispatchBoardScreen` (`features/calendar`, route `/schedule/dispatch`) —
 * `docs/EMPLOYEE-ASSIGNMENT-DISPATCH-PLAN.md` §5.1. Danh sách giao/nhận hôm
 * nay (sort theo giờ) + 3 widget Sắp giao/Sắp nhận (24h tới, `TODO(OQ: §0.5 —
 * RentalCalendar-BRD.md §21 chưa chốt ngưỡng)`)/Quá hạn trả + nút phân công/
 * đổi người ngay trên mỗi dòng.
 */
export function DispatchBoardScreen() {
  const { can } = usePermission()
  const canAssign = can('ASSIGNMENT', 'ASSIGN')

  const { data: rentals = [], isLoading } = useRentals()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()
  const { data: assignments = [] } = useAssignments()
  const { data: employees = [] } = useEmployees()

  const [assignTarget, setAssignTarget] = useState<{ rental: Rental; role: AssignmentRole } | null>(null)
  const [reassignTarget, setReassignTarget] = useState<Assignment | null>(null)

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  /** EA-BR-07 — chỉ Assignment khác `CANCELLED` được coi là đang hiệu lực/hiển thị. */
  const activeAssignmentByKey = useMemo(() => {
    const map = new Map<string, Assignment>()
    for (const a of assignments) {
      if (a.status === 'CANCELLED') continue
      const key = `${a.rentalId}:${a.role}`
      if (!map.has(key)) map.set(key, a)
    }
    return map
  }, [assignments])

  const todayRows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const rows: DispatchRow[] = []
    for (const r of rentals) {
      if (r.status === 'CANCELLED' || r.status === 'NO_SHOW') continue
      if (r.pickupDateTime.slice(0, 10) === todayStr) {
        rows.push({ key: `${r.id}-DELIVERY`, rental: r, role: 'DELIVERY', time: r.pickupDateTime })
      }
      if (r.expectedReturnDateTime.slice(0, 10) === todayStr) {
        rows.push({ key: `${r.id}-RECEIVING`, rental: r, role: 'RECEIVING', time: r.expectedReturnDateTime })
      }
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time))
  }, [rentals])

  const widgets = useMemo(() => {
    const now = new Date().getTime()
    const in24h = now + DAY_MS
    const upcomingDelivery = rentals.filter((r) => {
      if (!PRE_HANDOVER_STATUSES.includes(r.status)) return false
      const t = new Date(r.pickupDateTime).getTime()
      return t >= now && t <= in24h
    })
    const upcomingReceiving = rentals.filter((r) => {
      if (!isOccupyingLikeStatus(r.status)) return false
      const t = new Date(r.expectedReturnDateTime).getTime()
      return t >= now && t <= in24h
    })
    const overdueReturn = rentals.filter((r) => {
      if (!isOccupyingLikeStatus(r.status)) return false
      return new Date(r.expectedReturnDateTime).getTime() < now
    })
    return { upcomingDelivery, upcomingReceiving, overdueReturn }
  }, [rentals])

  function openAssign(rental: Rental, role: AssignmentRole) {
    setAssignTarget({ rental, role })
  }

  return (
    <div>
      <PageHeader title={vi.dispatch.title} description={vi.dispatch.description} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{vi.dispatch.widgetUpcomingDelivery}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{widgets.upcomingDelivery.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{vi.dispatch.widgetUpcomingReceiving}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{widgets.upcomingReceiving.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{vi.dispatch.widgetOverdueReturn}</CardTitle>
          </CardHeader>
          <CardContent className="text-status-error text-2xl font-semibold">{widgets.overdueReturn.length}</CardContent>
        </Card>
      </div>

      <h3 className="mb-3 text-sm font-semibold">{vi.dispatch.todayListTitle}</h3>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : todayRows.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{vi.dispatch.emptyToday}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.dispatch.columnTime}</TableHead>
                <TableHead>{vi.dispatch.columnType}</TableHead>
                <TableHead>{vi.dispatch.columnCustomer}</TableHead>
                <TableHead>{vi.dispatch.columnVehicle}</TableHead>
                <TableHead>{vi.dispatch.columnLocation}</TableHead>
                <TableHead>{vi.dispatch.columnAssignee}</TableHead>
                {canAssign && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayRows.map((row) => {
                const customer = customerById.get(row.rental.customerId)
                const vehicle = vehicleById.get(row.rental.vehicleId)
                const assignment = activeAssignmentByKey.get(`${row.rental.id}:${row.role}`)
                const assignee = assignment ? employeeById.get(assignment.assigneeEmployeeId) : undefined

                return (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{formatTime(row.time)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {row.role === 'DELIVERY' ? <Truck className="size-4" /> : <Undo2 className="size-4" />}
                        {row.role === 'DELIVERY' ? vi.dispatch.typeDelivery : vi.dispatch.typeReceiving}
                      </span>
                    </TableCell>
                    <TableCell>{customer?.fullName ?? row.rental.customerId}</TableCell>
                    <TableCell>{vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : row.rental.vehicleId}</TableCell>
                    <TableCell>{row.role === 'DELIVERY' ? row.rental.pickupLocation : row.rental.returnLocation}</TableCell>
                    <TableCell>
                      {assignee ? (
                        assignee.fullName
                      ) : (
                        <span className="text-status-pending font-medium">{vi.employees.assignmentUnassignedBadge}</span>
                      )}
                    </TableCell>
                    {canAssign && (
                      <TableCell className="text-right">
                        {assignment ? (
                          <Button size="sm" variant="outline" onClick={() => setReassignTarget(assignment)}>
                            {vi.employees.assignmentReassignButton}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openAssign(row.rental, row.role)}>
                            {vi.employees.assignmentAssignButton}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {canAssign && assignTarget && (
        <AssignmentCreateDialog
          rentalId={assignTarget.rental.id}
          role={assignTarget.role}
          plannedWindowStart={plannedWindowOf(assignTarget.rental, assignTarget.role).start}
          plannedWindowEnd={plannedWindowOf(assignTarget.rental, assignTarget.role).end}
          open={!!assignTarget}
          onOpenChange={(open) => !open && setAssignTarget(null)}
        />
      )}
      {canAssign && (
        <AssignmentReassignDialog
          assignment={reassignTarget}
          open={!!reassignTarget}
          onOpenChange={(open) => !open && setReassignTarget(null)}
        />
      )}
    </div>
  )
}
