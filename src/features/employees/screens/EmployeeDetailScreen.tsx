import { Pencil, RefreshCcw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { ACCOUNT_STATUS_LABELS, ASSIGNMENT_ROLE_LABELS, ASSIGNMENT_STATUS_LABELS, ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { listAuditRecords } from '@/shared/lib/audit'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { AssignmentStatusBadge } from '../components/AssignmentStatusBadge'
import { EmployeeFormSheet } from '../components/EmployeeFormSheet'
import { EmployeeStatusBadge } from '../components/EmployeeStatusBadge'
import { EmployeeStatusDialog } from '../components/EmployeeStatusDialog'
import { useAssignments, useEmployee } from '../hooks'
import { listEmployeeAssignments, summarizeEmployeeAssignments, type Employee } from '../model'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  )
}

function ProfileTab({ employee }: { employee: Employee }) {
  const t = vi.employees
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">{t.detailProfileSection}</h2>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t.employeeCode}>{employee.employeeCode}</Field>
            <Field label={t.fullName}>{employee.fullName}</Field>
            <Field label={t.phone}>{employee.phone}</Field>
            <Field label={t.email}>{employee.email || '—'}</Field>
            <Field label={t.role}>{ROLE_LABELS[employee.role]}</Field>
            <Field label={vi.common.status}>
              <EmployeeStatusBadge status={employee.status} />
            </Field>
            <Field label={t.hireDate}>{employee.hireDate ? formatDate(employee.hireDate) : '—'}</Field>
            <Field label={t.area}>{employee.assignedArea ?? t.noArea}</Field>
            <Field label={t.note}>{employee.note || '—'}</Field>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-3 text-sm font-semibold">{t.detailAccountSection}</h2>
          {employee.account ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label={t.detailAccountUsername}>{employee.account.username}</Field>
              <Field label={t.detailAccountStatus}>
                <Badge variant={employee.account.accountStatus === 'ACTIVE' ? 'success' : 'warning'}>
                  {ACCOUNT_STATUS_LABELS[employee.account.accountStatus]}
                </Badge>
              </Field>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">{t.detailAccountNone}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AssignmentsTab({ employeeId }: { employeeId: string }) {
  const { can } = usePermission()
  const t = vi.employees
  const { data: assignments, isLoading } = useAssignments()
  if (isLoading) return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  const all = assignments ?? []
  const summary = summarizeEmployeeAssignments(all, employeeId)
  const mine = listEmployeeAssignments(all, employeeId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {t.detailAssignmentsTotal}: {summary.total}
        </Badge>
        {(Object.keys(summary.byStatus) as (keyof typeof summary.byStatus)[])
          .filter((s) => summary.byStatus[s] > 0)
          .map((s) => (
            <Badge key={s} variant="secondary">
              {ASSIGNMENT_STATUS_LABELS[s]}: {summary.byStatus[s]}
            </Badge>
          ))}
        <Badge variant="neutral" title={t.detailAssignmentsReassignedAwayHint}>
          {t.detailAssignmentsReassignedAway}: {summary.reassignedAway}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{t.detailAssignmentsReadOnlyNote}</p>
      {mine.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{t.detailAssignmentsEmpty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.detailAssignmentColRole}</TableHead>
                <TableHead>{t.detailAssignmentColRental}</TableHead>
                <TableHead>{t.detailAssignmentColWindow}</TableHead>
                <TableHead>{t.detailAssignmentColStatus}</TableHead>
                <TableHead>{t.detailAssignmentColAssignedBy}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{ASSIGNMENT_ROLE_LABELS[a.role]}</TableCell>
                  <TableCell>
                    {can('RENTAL', 'VIEW') ? (
                      <Link to={`${paths.rentalDetail(a.rentalId)}?tab=assignment`} className="font-medium hover:underline">
                        {a.rentalId}
                      </Link>
                    ) : (
                      <span className="font-medium">{a.rentalId}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(a.plannedWindowStart)} – {formatDateTime(a.plannedWindowEnd)}
                  </TableCell>
                  <TableCell>
                    <AssignmentStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>{a.assignedByName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/** Nhật ký của hồ sơ: bản ghi `Employee` của nhân viên + bản ghi `UserAccount` của tài khoản liên kết (AL §8). */
function EmployeeAuditTab({ employee }: { employee: Employee }) {
  const t = vi.employees
  const accountId = employee.account?.userId
  const records = listAuditRecords()
    .filter(
      (r) =>
        (r.entity === 'Employee' && r.entityId === employee.id) ||
        (accountId !== undefined && r.entity === 'UserAccount' && r.entityId === accountId),
    )
    .sort((a, b) => b.at.localeCompare(a.at))

  if (records.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{t.detailAuditEmpty}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.detailAuditColAt}</TableHead>
            <TableHead>{t.detailAuditColAction}</TableHead>
            <TableHead>{t.detailAuditColActor}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.at)}</TableCell>
              <TableCell>{r.summary}</TableCell>
              <TableCell>{r.actorName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Chi tiết nhân viên — `/employees/:id` (WebappQuanTri.md §8.2; EA §6.1/§7/§8/§17; UC-EA-01/03/04).
 * Sửa hồ sơ / đổi trạng thái dùng lại nguyên `EmployeeFormSheet` / `EmployeeStatusDialog`.
 * Tab Nhật ký gate `EMPLOYEE.EDIT` — BA đề xuất. TODO(OQ: AuditLog-BRD.md §16 — quyền xem nhật ký theo đối tượng).
 */
export function EmployeeDetailScreen() {
  const t = vi.employees
  const { id } = useParams<{ id: string }>()
  const { can } = usePermission()
  const canView = can('EMPLOYEE', 'VIEW')
  const canEdit = can('EMPLOYEE', 'EDIT')
  const { data: employee, isLoading } = useEmployee(canView ? id : undefined)
  const [formOpen, setFormOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  if (!canView) {
    return (
      <div>
        <PageHeader title={t.detailTitle} />
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">{t.detailNoPermission}</p>
      </div>
    )
  }
  if (isLoading) {
    return (
      <div>
        <PageHeader title={t.detailTitle} />
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      </div>
    )
  }
  if (!employee) {
    return (
      <div>
        <PageHeader title={t.detailTitle} />
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{t.detailNotFound}</p>
          <Button asChild size="sm" variant="outline">
            <Link to={paths.employees}>{t.detailBackToList}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold">{employee.fullName}</h1>
            <span className="text-muted-foreground text-sm">{employee.employeeCode}</span>
            <EmployeeStatusBadge status={employee.status} />
            <Badge variant="secondary">{ROLE_LABELS[employee.role]}</Badge>
          </div>
          <Link to={paths.employees} className="text-muted-foreground text-xs hover:underline">
            {t.detailBackToList}
          </Link>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
              <RefreshCcw className="size-3.5" />
              {t.changeStatus}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="max-w-full">
          <TabsTrigger value="profile">{t.detailTabProfile}</TabsTrigger>
          <TabsTrigger value="assignments">{t.detailTabAssignments}</TabsTrigger>
          {canEdit && <TabsTrigger value="audit">{t.detailTabAudit}</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab employee={employee} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab employeeId={employee.id} />
        </TabsContent>
        {canEdit && (
          <TabsContent value="audit">
            <EmployeeAuditTab employee={employee} />
          </TabsContent>
        )}
      </Tabs>

      {canEdit && <EmployeeFormSheet employee={employee} open={formOpen} onOpenChange={setFormOpen} />}
      {canEdit && <EmployeeStatusDialog employee={employee} open={statusOpen} onOpenChange={setStatusOpen} />}
    </div>
  )
}
