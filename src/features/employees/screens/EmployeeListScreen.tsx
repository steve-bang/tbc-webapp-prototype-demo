import { Plus, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
import { PageHeader } from '@/shared/layout/PageHeader'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { EmployeeCard } from '../components/EmployeeCard'
import { EmployeeFilters, type EmployeeFilterValue } from '../components/EmployeeFilters'
import { EmployeeFormSheet } from '../components/EmployeeFormSheet'
import { EmployeeStatusBadge } from '../components/EmployeeStatusBadge'
import { EmployeeStatusDialog } from '../components/EmployeeStatusDialog'
import { useEmployees } from '../hooks'
import type { Employee } from '../model'

/** `UC-EA-01`/`UC-EA-02` — danh sách + tìm kiếm/lọc hồ sơ nhân viên. */
export function EmployeeListScreen() {
  const { can } = usePermission()
  const canEdit = can('EMPLOYEE', 'EDIT')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<EmployeeFilterValue>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [statusEmployee, setStatusEmployee] = useState<Employee | null>(null)

  const { data: allEmployees } = useEmployees()
  const { data: employees, isLoading } = useEmployees({ ...filter, search: search.trim() || undefined })

  const areas = useMemo(() => {
    const set = new Set<string>()
    for (const e of allEmployees ?? []) {
      if (e.assignedArea) set.add(e.assignedArea)
    }
    return Array.from(set).sort()
  }, [allEmployees])

  const hasAnyEmployee = (allEmployees?.length ?? 0) > 0
  const hasActiveFilter = !!(search.trim() || filter.role || filter.status || filter.area)

  function openCreate() {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  function openEdit(employee: Employee) {
    setEditingEmployee(employee)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={vi.employees.title}
        description={vi.employees.description}
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">{vi.employees.addButton}</span>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={vi.employees.searchPlaceholder}
            className="flex-1"
          />
          <Button variant="outline" className="shrink-0 md:hidden" onClick={() => setFilterSheetOpen(true)}>
            <SlidersHorizontal className="size-4" />
            {vi.common.filter}
          </Button>
        </div>
        <EmployeeFilters
          value={filter}
          onChange={setFilter}
          areas={areas}
          className="hidden flex-wrap gap-2 overflow-x-auto md:flex"
        />
      </div>

      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>{vi.common.filter}</SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-5">
            <EmployeeFilters value={filter} onChange={setFilter} areas={areas} className="flex-col gap-3" />
          </div>
        </SheetContent>
      </Sheet>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : employees && employees.length > 0 ? (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.employees.employeeCode}</TableHead>
                  <TableHead>{vi.employees.fullName}</TableHead>
                  <TableHead>{vi.employees.phone}</TableHead>
                  <TableHead>{vi.employees.role}</TableHead>
                  <TableHead>{vi.common.status}</TableHead>
                  <TableHead>{vi.employees.account}</TableHead>
                  <TableHead>{vi.employees.area}</TableHead>
                  {canEdit && <TableHead className="text-right">{vi.common.actions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.employeeCode}</TableCell>
                    <TableCell>{employee.fullName}</TableCell>
                    <TableCell>{employee.phone}</TableCell>
                    <TableCell>{ROLE_LABELS[employee.role]}</TableCell>
                    <TableCell>
                      <EmployeeStatusBadge status={employee.status} />
                    </TableCell>
                    <TableCell>{employee.account?.username ?? vi.employees.noAccount}</TableCell>
                    <TableCell>{employee.assignedArea ?? vi.employees.noArea}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(employee)}>
                            {vi.common.edit}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setStatusEmployee(employee)}>
                            {vi.employees.changeStatus}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {employees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                canEdit={canEdit}
                onEdit={() => openEdit(employee)}
                onChangeStatus={() => setStatusEmployee(employee)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAnyEmployee && hasActiveFilter ? vi.employees.emptyFiltered : vi.employees.emptyAll}</p>
          {canEdit && !hasAnyEmployee && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              {vi.employees.addButton}
            </Button>
          )}
        </div>
      )}

      {canEdit && <EmployeeFormSheet employee={editingEmployee} open={formOpen} onOpenChange={setFormOpen} />}
      {canEdit && (
        <EmployeeStatusDialog
          employee={statusEmployee}
          open={!!statusEmployee}
          onOpenChange={(open) => !open && setStatusEmployee(null)}
        />
      )}
    </div>
  )
}
