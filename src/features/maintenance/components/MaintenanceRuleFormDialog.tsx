import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import type { Vehicle } from '@/features/vehicles'
import { MAINTENANCE_RULE_APPLIES_TO } from '@/shared/domain/enums'
import { MAINTENANCE_RULE_APPLIES_TO_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useCreateMaintenanceRule } from '../hooks'
import { maintenanceRuleFormSchema, type MaintenanceRuleFormValues } from '../model'

const DEFAULT_VALUES: MaintenanceRuleFormValues = {
  category: '',
  thresholdKm: '',
  appliesTo: 'VEHICLE_MODEL',
  vehicleId: undefined,
  vehicleModel: undefined,
}

/** `MT-BR-01/02` — thêm quy tắc bảo dưỡng mới (không có sửa, chỉ tạo + vô hiệu hoá — `MT-BR-11`). */
export function MaintenanceRuleFormDialog({
  vehicles,
  open,
  onOpenChange,
}: {
  vehicles: Vehicle[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createRule = useCreateMaintenanceRule()
  const models = useMemo(() => Array.from(new Set(vehicles.map((v) => v.model))).sort(), [vehicles])

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaintenanceRuleFormValues>({
    resolver: zodResolver(maintenanceRuleFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  const appliesTo = useWatch({ control, name: 'appliesTo' })
  const isBusy = createRule.isPending || isSubmitting

  function handleOpenChange(next: boolean) {
    if (next) reset(DEFAULT_VALUES)
    onOpenChange(next)
  }

  async function onSubmit(values: MaintenanceRuleFormValues) {
    try {
      await createRule.mutateAsync({
        category: values.category,
        thresholdKm: Number(values.thresholdKm),
        appliesTo: values.appliesTo,
        vehicleId: values.appliesTo === 'SPECIFIC_VEHICLE' ? values.vehicleId : undefined,
        vehicleModel: values.appliesTo === 'VEHICLE_MODEL' ? values.vehicleModel : undefined,
      })
      toast.success(vi.maintenance.createRuleSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.maintenance.saveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.maintenance.createRuleTitle}</DialogTitle>
        </DialogHeader>

        <form id="maintenance-rule-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">{vi.maintenance.ruleCategory} *</Label>
            <Input id="category" {...register('category')} />
            {errors.category && <p className="text-destructive text-sm">{errors.category.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="thresholdKm">{vi.maintenance.ruleThresholdKm} *</Label>
            <Input id="thresholdKm" type="number" {...register('thresholdKm')} />
            {errors.thresholdKm && <p className="text-destructive text-sm">{errors.thresholdKm.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.maintenance.ruleAppliesTo} *</Label>
            <Controller
              control={control}
              name="appliesTo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_RULE_APPLIES_TO.map((option) => (
                      <SelectItem key={option} value={option}>
                        {MAINTENANCE_RULE_APPLIES_TO_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {appliesTo === 'SPECIFIC_VEHICLE' && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.maintenance.ruleAppliesToVehicle} *</Label>
              <Controller
                control={control}
                name="vehicleId"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={vi.maintenance.ruleAppliesToVehicle} />
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
          )}

          {appliesTo === 'VEHICLE_MODEL' && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.maintenance.ruleAppliesToModel} *</Label>
              <Controller
                control={control}
                name="vehicleModel"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={vi.maintenance.ruleAppliesToModel} />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.vehicleModel && <p className="text-destructive text-sm">{errors.vehicleModel.message}</p>}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="maintenance-rule-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
