import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateSparePartRecord } from '../hooks'
import { sparePartRecordFormSchema, type SparePartRecordFormValues } from '../model'

function defaultValues(vehicleId?: string): SparePartRecordFormValues {
  return {
    vehicleId: vehicleId ?? '',
    partName: '',
    quantity: '1',
    date: new Date().toISOString().slice(0, 10),
    odometerAtReplacement: '',
    cost: '',
    provider: '',
    note: '',
  }
}

/** `MT-BR-07` — ghi nhận thay thế phụ tùng mới, độc lập hoàn toàn với Rule/Record bảo dưỡng. */
export function SparePartRecordFormDialog({
  vehicles,
  preselectedVehicleId,
  open,
  onOpenChange,
}: {
  vehicles: Vehicle[]
  preselectedVehicleId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createSparePart = useCreateSparePartRecord()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SparePartRecordFormValues>({
    resolver: zodResolver(sparePartRecordFormSchema),
    defaultValues: defaultValues(preselectedVehicleId),
  })

  const isBusy = createSparePart.isPending || isSubmitting

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues(preselectedVehicleId))
    onOpenChange(next)
  }

  async function onSubmit(values: SparePartRecordFormValues) {
    try {
      await createSparePart.mutateAsync({
        vehicleId: values.vehicleId,
        partName: values.partName,
        quantity: Number(values.quantity),
        date: values.date,
        odometerAtReplacement: Number(values.odometerAtReplacement),
        cost: Number(values.cost),
        provider: values.provider || undefined,
        note: values.note || undefined,
      })
      toast.success(vi.maintenance.createSparePartSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.maintenance.saveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.maintenance.createSparePartTitle}</DialogTitle>
        </DialogHeader>

        <form id="spare-part-record-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.maintenance.vehicle} *</Label>
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.maintenance.vehicle} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} — {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partName">{vi.maintenance.sparePartName} *</Label>
              <Input id="partName" {...register('partName')} />
              {errors.partName && <p className="text-destructive text-sm">{errors.partName.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">{vi.maintenance.sparePartQuantity} *</Label>
              <Input id="quantity" type="number" {...register('quantity')} />
              {errors.quantity && <p className="text-destructive text-sm">{errors.quantity.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">{vi.maintenance.sparePartDate} *</Label>
              <Input id="date" type="date" {...register('date')} />
              {errors.date && <p className="text-destructive text-sm">{errors.date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="odometerAtReplacement">{vi.maintenance.sparePartOdometer} *</Label>
              <Input id="odometerAtReplacement" type="number" {...register('odometerAtReplacement')} />
              {errors.odometerAtReplacement && (
                <p className="text-destructive text-sm">{errors.odometerAtReplacement.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">{vi.maintenance.sparePartCost} *</Label>
              <Input id="cost" type="number" {...register('cost')} />
              {errors.cost && <p className="text-destructive text-sm">{errors.cost.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider">{vi.maintenance.sparePartProvider}</Label>
              <Input id="provider" {...register('provider')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.maintenance.sparePartNote}</Label>
            <Textarea id="note" rows={2} {...register('note')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="spare-part-record-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
