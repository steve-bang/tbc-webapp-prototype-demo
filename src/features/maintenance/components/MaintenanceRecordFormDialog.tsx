import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateMaintenanceRecord, useMaintenanceRecords, useMaintenanceRules } from '../hooks'
import { isOdometerRegression, maintenanceRecordFormSchema, type MaintenanceRecordFormValues } from '../model'

function defaultValues(vehicleId?: string): MaintenanceRecordFormValues {
  return {
    vehicleId: vehicleId ?? '',
    date: new Date().toISOString().slice(0, 10),
    odometerAtService: '',
    category: '',
    cost: '',
    provider: '',
    note: '',
  }
}

const CATEGORY_DATALIST_ID = 'maintenance-record-category-suggestions'

/** `MT-BR-03`/`UC-MT-02` — ghi nhận bản ghi bảo dưỡng mới (không có sửa/xoá — `MT-BR-11`). */
export function MaintenanceRecordFormDialog({
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
  const createRecord = useCreateMaintenanceRecord()
  const { data: rules } = useMaintenanceRules()
  const { data: allRecords } = useMaintenanceRecords()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceRecordFormValues>({
    resolver: zodResolver(maintenanceRecordFormSchema),
    defaultValues: defaultValues(preselectedVehicleId),
  })

  const vehicleId = useWatch({ control, name: 'vehicleId' })
  const isBusy = createRecord.isPending || isSubmitting

  const categorySuggestions = useMemo(() => {
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    if (!vehicle || !rules) return []
    const applicable = rules.filter(
      (r) =>
        r.active &&
        ((r.appliesTo === 'SPECIFIC_VEHICLE' && r.vehicleId === vehicle.id) ||
          (r.appliesTo === 'VEHICLE_MODEL' && r.vehicleModel === vehicle.model)),
    )
    return Array.from(new Set(applicable.map((r) => r.category)))
  }, [vehicles, rules, vehicleId])

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues(preselectedVehicleId))
    onOpenChange(next)
  }

  async function onSubmit(values: MaintenanceRecordFormValues) {
    const newOdometer = Number(values.odometerAtService)
    if (allRecords && isOdometerRegression(allRecords, values.vehicleId, newOdometer)) {
      setError('odometerAtService', { message: vi.maintenance.odometerRegressionError })
      return
    }
    try {
      await createRecord.mutateAsync({
        vehicleId: values.vehicleId,
        date: values.date,
        odometerAtService: newOdometer,
        category: values.category,
        cost: Number(values.cost),
        provider: values.provider || undefined,
        note: values.note || undefined,
      })
      toast.success(vi.maintenance.createRecordSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.maintenance.saveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.maintenance.createRecordTitle}</DialogTitle>
        </DialogHeader>

        <form id="maintenance-record-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
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
              <Label htmlFor="date">{vi.maintenance.recordDate} *</Label>
              <Input id="date" type="date" {...register('date')} />
              {errors.date && <p className="text-destructive text-sm">{errors.date.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="odometerAtService">{vi.maintenance.recordOdometer} *</Label>
              <Input id="odometerAtService" type="number" {...register('odometerAtService')} />
              {errors.odometerAtService && (
                <p className="text-destructive text-sm">{errors.odometerAtService.message}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">{vi.maintenance.recordCategory} *</Label>
            <Input id="category" list={CATEGORY_DATALIST_ID} {...register('category')} />
            <datalist id={CATEGORY_DATALIST_ID}>
              {categorySuggestions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">{vi.maintenance.recordCategoryHint}</p>
            {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost">{vi.maintenance.recordCost} *</Label>
              <Input id="cost" type="number" {...register('cost')} />
              {errors.cost && <p className="text-destructive text-sm">{errors.cost.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="provider">{vi.maintenance.recordProvider}</Label>
              <Input id="provider" {...register('provider')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.maintenance.recordNote}</Label>
            <Textarea id="note" rows={2} {...register('note')} />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="maintenance-record-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
