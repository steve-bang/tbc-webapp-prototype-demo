import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { usePermission, useSessionStore } from '@/features/auth'
import { ROLES } from '@/shared/domain/enums'
import { permissionValue } from '@/shared/domain/permissions'
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useCreateEmployee, useGrantAccount, useLockAccount, useUnlockAccount, useUpdateEmployee } from '../hooks'
import { employeeFormSchema, type Employee, type EmployeeFormValues } from '../model'
import type { EmployeeFormInput } from '../api'
import { EmployeeReasonDialog } from './EmployeeReasonDialog'

/** Hành động đang chờ nhập lý do trong `EmployeeReasonDialog` (mục 3/4 review). */
type PendingAction =
  | { type: 'role'; values: EmployeeFormValues; fromLabel: string; toLabel: string }
  | { type: 'lock' }

function toFormValues(employee?: Employee | null): EmployeeFormValues {
  return {
    fullName: employee?.fullName ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    role: employee?.role ?? 'OPERATION_STAFF',
    hireDate: employee?.hireDate ?? '',
    assignedArea: employee?.assignedArea ?? '',
    note: employee?.note ?? '',
    createAccount: false,
    username: '',
  }
}

/**
 * `UC-EA-01` (tạo/sửa) + `UC-EA-03` (gắn tài khoản & chọn vai trò).
 * Khối "Tài khoản đăng nhập" gate `EMPLOYEE.CONFIG` qua `can()` — hiển thị
 * disabled + tooltip riêng khi giá trị ma trận là `'TBD'` (WebappQuanTri.md
 * §8.4) thay vì ẩn hẳn, để BA/khách thấy đây là Open Question còn treo.
 */
export function EmployeeFormSheet({
  employee,
  open,
  onOpenChange,
}: {
  employee?: Employee | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { role: sessionRole, can } = usePermission()
  const sessionUser = useSessionStore((s) => s.user)
  const configAllowed = can('EMPLOYEE', 'CONFIG')
  const configTbd = sessionRole ? permissionValue(sessionRole, 'EMPLOYEE', 'CONFIG') === 'TBD' : false
  const isEditing = !!employee
  const isSelfAccount = !!(employee?.account && sessionUser && employee.account.userId === sessionUser.userId)

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const grantAccount = useGrantAccount()
  const lockAccount = useLockAccount()
  const unlockAccount = useUnlockAccount()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: toFormValues(employee),
  })

  useEffect(() => {
    if (open) reset(toFormValues(employee))
  }, [employee, open, reset])

  const createAccount = useWatch({ control, name: 'createAccount' })
  const isBusy = createEmployee.isPending || updateEmployee.isPending || grantAccount.isPending || isSubmitting
  const isReasonDialogBusy = updateEmployee.isPending || grantAccount.isPending || lockAccount.isPending

  function toInput(values: EmployeeFormValues): EmployeeFormInput {
    return {
      fullName: values.fullName,
      phone: values.phone,
      email: values.email || undefined,
      role: values.role,
      hireDate: values.hireDate || undefined,
      assignedArea: values.assignedArea || undefined,
      note: values.note || undefined,
    }
  }

  /** Cập nhật hồ sơ + (nếu cần) cấp tài khoản — dùng chung cho luồng đổi vai trò và không đổi vai trò. */
  async function performUpdate(values: EmployeeFormValues, roleChangeReason?: string) {
    if (!employee) return
    await updateEmployee.mutateAsync({ id: employee.id, input: toInput(values), roleChangeReason })
    if (!employee.account && configAllowed && values.createAccount && values.username) {
      await grantAccount.mutateAsync({ id: employee.id, username: values.username })
    }
    toast.success(vi.employees.updateSuccess)
    onOpenChange(false)
  }

  async function onSubmit(values: EmployeeFormValues) {
    try {
      if (isEditing && employee) {
        if (values.role !== employee.role) {
          // UC-EA-20 §24.3 — CHANGE_ROLE cần Reason bắt buộc, thu thập qua EmployeeReasonDialog.
          setPendingAction({
            type: 'role',
            values,
            fromLabel: ROLE_LABELS[employee.role],
            toLabel: ROLE_LABELS[values.role],
          })
          return
        }
        await performUpdate(values)
      } else {
        const created = await createEmployee.mutateAsync(toInput(values))
        if (configAllowed && values.createAccount && values.username) {
          await grantAccount.mutateAsync({ id: created.id, username: values.username })
        }
        toast.success(vi.employees.createSuccess)
        onOpenChange(false)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.saveError)
    }
  }

  function handleLock() {
    if (!employee) return
    setPendingAction({ type: 'lock' })
  }

  async function handleReasonConfirm(reason: string) {
    if (!pendingAction) return
    try {
      if (pendingAction.type === 'role') {
        await performUpdate(pendingAction.values, reason)
      } else if (pendingAction.type === 'lock' && employee) {
        await lockAccount.mutateAsync({ id: employee.id, reason })
        toast.success(vi.employees.lockSuccess)
      }
      setPendingAction(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.saveError)
    }
  }

  function handleUnlock() {
    if (!employee) return
    unlockAccount.mutate(
      { id: employee.id },
      {
        onSuccess: () => toast.success(vi.employees.unlockSuccess),
        onError: (err) => toast.error(err instanceof Error ? err.message : vi.employees.saveError),
      },
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[480px] lg:max-w-none"
        >
          <SheetHeader className="border-b">
            <SheetTitle>{isEditing ? vi.employees.editTitle : vi.employees.createTitle}</SheetTitle>
            {isEditing && employee && (
              <SheetDescription>
                {vi.employees.employeeCodeLabel}: {employee.employeeCode}
              </SheetDescription>
            )}
          </SheetHeader>

          <form
            id="employee-form"
            className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">{vi.employees.fullName} *</Label>
              <Input id="fullName" {...register('fullName')} />
              {errors.fullName && <p className="text-destructive text-sm">{errors.fullName.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{vi.employees.phone} *</Label>
              <Input id="phone" {...register('phone')} />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{vi.employees.email}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{vi.employees.role} *</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hireDate">{vi.employees.hireDate}</Label>
              <Input id="hireDate" type="date" {...register('hireDate')} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assignedArea">{vi.employees.area}</Label>
              <Input id="assignedArea" {...register('assignedArea')} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">{vi.employees.note}</Label>
              <Textarea id="note" rows={3} {...register('note')} />
            </div>

            <div className="mt-2 border-t pt-4">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{vi.employees.accountSection}</h3>
                {configTbd && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground cursor-help text-xs underline decoration-dotted">
                        {vi.employees.configTbdBadge}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{vi.employees.configTbdTooltip}</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <fieldset disabled={!configAllowed} className="flex flex-col gap-3 disabled:opacity-50">
                {employee?.account ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm">
                      {vi.employees.username}: <span className="font-medium">{employee.account.username}</span>
                    </p>
                    <p className="text-sm">
                      {vi.common.status}: {ACCOUNT_STATUS_LABELS[employee.account.accountStatus]}
                    </p>
                    <div className="flex gap-2">
                      {employee.account.accountStatus === 'ACTIVE' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!configAllowed || isSelfAccount}
                          onClick={handleLock}
                        >
                          {vi.employees.lockAccount}
                        </Button>
                      )}
                      {employee.account.accountStatus === 'LOCKED' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!configAllowed || employee.status !== 'ACTIVE'}
                          onClick={handleUnlock}
                        >
                          {vi.employees.unlockAccount}
                        </Button>
                      )}
                    </div>
                    {isSelfAccount && <p className="text-muted-foreground text-xs">{vi.employees.cannotLockSelf}</p>}
                    {employee.account.accountStatus === 'LOCKED' && employee.status !== 'ACTIVE' && (
                      // EA-BR-02 — nhân viên SUSPENDED/INACTIVE phải giữ tài khoản khoá.
                      <p className="text-muted-foreground text-xs">{vi.employees.unlockBlockedBySuspended}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="createAccount">{vi.employees.createAccountSwitch}</Label>
                      <Controller
                        control={control}
                        name="createAccount"
                        render={({ field }) => (
                          <Switch id="createAccount" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                      />
                    </div>
                    {createAccount && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="username">{vi.employees.username} *</Label>
                        <Input id="username" {...register('username')} />
                        {errors.username && <p className="text-destructive text-sm">{errors.username.message}</p>}
                      </div>
                    )}
                  </>
                )}
              </fieldset>
            </div>
          </form>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {vi.common.cancel}
            </Button>
            <Button type="submit" form="employee-form" disabled={isBusy}>
              {vi.common.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EmployeeReasonDialog
        open={!!pendingAction}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingAction(null)
        }}
        title={pendingAction?.type === 'role' ? vi.employees.changeRoleTitle : vi.employees.lockAccountTitle}
        description={
          pendingAction?.type === 'role'
            ? vi.employees.confirmRoleChange(pendingAction.fromLabel, pendingAction.toLabel)
            : employee
              ? `${employee.fullName} (${employee.employeeCode})`
              : undefined
        }
        confirmLabel={pendingAction?.type === 'lock' ? vi.employees.lockAccount : vi.common.confirm}
        busy={isReasonDialogBusy}
        onConfirm={handleReasonConfirm}
      />
    </>
  )
}
