import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { AssignmentRole } from '@/shared/domain/enums'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useAssignments, useCreateAssignment, useEmployees } from '../hooks'
import { assignmentAssignSchema, hasAssignmentConflict, isAssignableEmployee, type AssignmentAssignValues } from '../model'

/**
 * `AssignmentCreateDialog` — §5.3 kế hoạch. Dùng chung cho Dispatch board +
 * tab "Phân công" ở Rental Detail; `rentalId`/`role`/Planned Window cố định
 * theo context mở dialog (truyền từ nơi gọi), form chỉ hỏi nhân viên phụ
 * trách — EA-BR-08/09 lọc sẵn danh sách chọn, EA-BR-10 cảnh báo mềm nếu trùng
 * lịch (không chặn submit).
 */
export function AssignmentCreateDialog({
  rentalId,
  role,
  plannedWindowStart,
  plannedWindowEnd,
  open,
  onOpenChange,
}: {
  rentalId: string
  role: AssignmentRole
  plannedWindowStart: string
  plannedWindowEnd: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createAssignment = useCreateAssignment()
  const { data: employees = [] } = useEmployees()
  const { data: assignments = [] } = useAssignments()

  const eligibleEmployees = useMemo(() => employees.filter(isAssignableEmployee), [employees])

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignmentAssignValues>({
    resolver: zodResolver(assignmentAssignSchema),
    defaultValues: { employeeId: '', note: '' },
  })

  useEffect(() => {
    if (open) reset({ employeeId: '', note: '' })
  }, [open, reset])

  // Mirror tiền lệ `useWatch` (`RentalFormSheet`/`VehicleBlockFormDialog`…) —
  // `watch()` của `useForm` gây warning `react(incompatible-library)`.
  const selectedEmployeeId = useWatch({ control, name: 'employeeId' })
  const hasConflict =
    !!selectedEmployeeId && hasAssignmentConflict(assignments, selectedEmployeeId, plannedWindowStart, plannedWindowEnd)

  async function onSubmit(values: AssignmentAssignValues) {
    try {
      await createAssignment.mutateAsync({
        rentalId,
        role,
        assigneeEmployeeId: values.employeeId,
        plannedWindowStart,
        plannedWindowEnd,
        note: values.note,
      })
      toast.success(vi.employees.assignmentCreateSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.assignmentCreateError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.employees.assignmentCreateDialogTitle}</DialogTitle>
          <DialogDescription>
            {role === 'DELIVERY' ? vi.employees.assignmentRoleDelivery : vi.employees.assignmentRoleReceiving}
          </DialogDescription>
        </DialogHeader>

        {eligibleEmployees.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.employees.assignmentNoEligibleEmployee}</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-1.5">
              <Label>{vi.employees.assignmentEmployeeLabel} *</Label>
              <Controller
                control={control}
                name="employeeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={vi.employees.assignmentEmployeePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.employeeCode} — {e.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employeeId && <p className="text-destructive text-sm">{errors.employeeId.message}</p>}
              {hasConflict && <p className="text-status-pending text-sm">{vi.employees.assignmentConflictWarning}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asg-note">{vi.employees.assignmentNote}</Label>
              <Controller control={control} name="note" render={({ field }) => <Textarea id="asg-note" rows={2} {...field} />} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="submit" disabled={createAssignment.isPending}>
                {vi.common.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
