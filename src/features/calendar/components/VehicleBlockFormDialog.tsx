import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateVehicleBlock } from '../hooks'
import { findRentalsAffectedByBlock, vehicleBlockFormSchema, type VehicleBlock, type VehicleBlockFormValues } from '../model'

function defaultValues(preselectedVehicleId?: string): VehicleBlockFormValues {
  return { vehicleId: preselectedVehicleId ?? '', startDate: '', endDate: '', reason: '' }
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.5 — tạo Vehicle Block (RC-BR-15,
 * CR-2026-015). Chỉ cảnh báo Rental `CONFIRMED` trở lên bị ảnh hưởng qua
 * `findRentalsAffectedByBlock()` — KHÔNG tự xử lý (đổi xe/huỷ ngoài phạm vi
 * Round 2, thuộc RM-BR-27/28 chưa build).
 */
export function VehicleBlockFormDialog({
  vehicles,
  blocks,
  rentals,
  customers,
  preselectedVehicleId,
  open,
  onOpenChange,
}: {
  vehicles: Vehicle[]
  blocks: VehicleBlock[]
  rentals: Rental[]
  customers: Customer[]
  preselectedVehicleId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createBlock = useCreateVehicleBlock()

  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VehicleBlockFormValues>({
    resolver: zodResolver(vehicleBlockFormSchema),
    defaultValues: defaultValues(preselectedVehicleId),
  })

  useEffect(() => {
    if (open) reset(defaultValues(preselectedVehicleId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  // RC-BR-15 §5.5 — chỉ hiển thị xe chưa có Vehicle Block đang ACTIVE.
  const availableVehicles = useMemo(
    () => vehicles.filter((v) => !blocks.some((b) => b.vehicleId === v.id && b.status === 'ACTIVE')),
    [vehicles, blocks],
  )
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const watchedVehicleId = useWatch({ control, name: 'vehicleId' })
  const watchedStartDate = useWatch({ control, name: 'startDate' })
  const watchedEndDate = useWatch({ control, name: 'endDate' })

  const affectedRentals = useMemo(() => {
    if (!watchedVehicleId || !watchedStartDate) return []
    return findRentalsAffectedByBlock(rentals, watchedVehicleId, watchedStartDate, watchedEndDate || '')
  }, [rentals, watchedVehicleId, watchedStartDate, watchedEndDate])

  async function onSubmit(values: VehicleBlockFormValues) {
    try {
      await createBlock.mutateAsync({
        vehicleId: values.vehicleId,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        reason: values.reason,
      })
      toast.success(vi.calendar.blockFormSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.calendar.blockFormError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.calendar.blockFormTitle}</DialogTitle>
        </DialogHeader>

        <form id="vehicle-block-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.calendar.blockFormVehicle} *</Label>
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.calendar.blockFormVehiclePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} — {v.brand} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vblk-startDate">{vi.calendar.blockFormStartDate} *</Label>
              <Input id="vblk-startDate" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-destructive text-sm">{errors.startDate.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vblk-endDate">{vi.calendar.blockFormEndDate}</Label>
              <Input id="vblk-endDate" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-destructive text-sm">{errors.endDate.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vblk-reason">{vi.calendar.blockFormReason} *</Label>
            <Textarea id="vblk-reason" rows={2} placeholder={vi.calendar.blockFormReasonPlaceholder} {...register('reason')} />
            {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
          </div>

          {affectedRentals.length > 0 && (
            <div className="border-status-pending bg-status-pending/10 flex flex-col gap-2 rounded-md border p-3">
              <p className="text-status-pending text-sm font-medium">{vi.calendar.blockFormAffectedWarning}</p>
              <ul className="flex flex-col gap-1 text-xs">
                {affectedRentals.map((r) => (
                  <li key={r.id}>
                    {customerById.get(r.customerId)?.fullName ?? r.customerId} —{' '}
                    {formatDateTime(r.pickupDateTime)} → {formatDateTime(r.expectedReturnDateTime)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="vehicle-block-form" disabled={isSubmitting || createBlock.isPending}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
