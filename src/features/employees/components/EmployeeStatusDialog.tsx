import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { EMPLOYEE_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useChangeEmployeeStatus } from '../hooks'
import { availableTransitions, statusChangeSchema, type Employee, type StatusChangeValues } from '../model'

/** `UC-EA-04` — đổi trạng thái làm việc, dialog riêng ngoài form sửa. */
export function EmployeeStatusDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const changeStatus = useChangeEmployeeStatus()
  const options = employee ? availableTransitions(employee.status) : []

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StatusChangeValues>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { status: options[0] ?? 'ACTIVE', reason: '' },
  })

  useEffect(() => {
    if (open && employee) {
      const next = availableTransitions(employee.status)
      reset({ status: next[0] ?? employee.status, reason: '' })
    }
  }, [employee, open, reset])

  if (!employee) return null

  async function onSubmit(values: StatusChangeValues) {
    if (!employee) return
    try {
      await changeStatus.mutateAsync({ id: employee.id, status: values.status, reason: values.reason })
      toast.success(vi.employees.statusChangeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.statusChangeError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.employees.changeStatusTitle}</DialogTitle>
          <DialogDescription>
            {employee.fullName} ({employee.employeeCode}) — {vi.employees.currentStatus}:{' '}
            {EMPLOYEE_STATUS_LABELS[employee.status]}
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.employees.noTransition}</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-1.5">
              <Label>{vi.employees.newStatus}</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((status) => (
                        <SelectItem key={status} value={status}>
                          {EMPLOYEE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">{vi.employees.reason} *</Label>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => <Textarea id="reason" rows={3} {...field} />}
              />
              {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="submit" disabled={changeStatus.isPending}>
                {vi.common.confirm}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
