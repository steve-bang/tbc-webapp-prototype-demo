import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useEmployees, useReassignAssignment } from '../hooks'
import { assignmentReassignSchema, isAssignableEmployee, type Assignment, type AssignmentReassignValues } from '../model'

/** `AssignmentReassignDialog` — §5.3 kế hoạch, EA-BR-11/12 (chỉ `ASSIGNED`, lý do bắt buộc + lưu `reassignmentHistory`). */
export function AssignmentReassignDialog({
  assignment,
  open,
  onOpenChange,
}: {
  assignment: Assignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const reassignAssignment = useReassignAssignment()
  const { data: employees = [] } = useEmployees()

  const eligibleEmployees = useMemo(
    () => employees.filter((e) => isAssignableEmployee(e) && e.id !== assignment?.assigneeEmployeeId),
    [employees, assignment],
  )

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignmentReassignValues>({
    resolver: zodResolver(assignmentReassignSchema),
    defaultValues: { employeeId: '', reason: '' },
  })

  useEffect(() => {
    if (open) reset({ employeeId: '', reason: '' })
  }, [open, reset])

  if (!assignment) return null

  async function onSubmit(values: AssignmentReassignValues) {
    if (!assignment) return
    try {
      await reassignAssignment.mutateAsync({ id: assignment.id, employeeId: values.employeeId, reason: values.reason })
      toast.success(vi.employees.assignmentReassignSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.assignmentReassignError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.employees.assignmentReassignDialogTitle}</DialogTitle>
          <DialogDescription>
            {assignment.role === 'DELIVERY' ? vi.employees.assignmentRoleDelivery : vi.employees.assignmentRoleReceiving}
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asg-reassign-reason">{vi.employees.assignmentReassignReasonLabel} *</Label>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => <Textarea id="asg-reassign-reason" rows={3} {...field} />}
              />
              {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="submit" disabled={reassignAssignment.isPending}>
                {vi.common.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
