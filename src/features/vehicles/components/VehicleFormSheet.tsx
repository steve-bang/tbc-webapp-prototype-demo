import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { OWNERSHIP_TYPES, VEHICLE_CLASSES } from '@/shared/domain/enums'
import { OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import type { VehicleFormInput } from '../api'
import { useCreateVehicle, useUpdateVehicle } from '../hooks'
import { vehicleFormSchema, type Vehicle, type VehicleFormValues } from '../model'

function toFormValues(vehicle?: Vehicle | null): VehicleFormValues {
  return {
    plate: vehicle?.plate ?? '',
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    manufacturingYear: vehicle?.manufacturingYear !== undefined ? String(vehicle.manufacturingYear) : '',
    color: vehicle?.color ?? '',
    vehicleClass: vehicle?.vehicleClass ?? 'STANDARD', // VM-RULE-011 — mặc định STANDARD
    ownershipType: vehicle?.ownershipType ?? 'OWNED', // VM-RULE-015 — mặc định OWNED
    bankFinanced: vehicle?.bankFinanced ?? false,
    currentKm: vehicle ? String(vehicle.currentKm) : '0',
    fuelLevel: vehicle?.fuelLevel !== undefined ? String(vehicle.fuelLevel) : '',
    note: vehicle?.note ?? '',
  }
}

/** `UC-VM` — tạo/sửa hồ sơ xe (Round 1: không có tab Giấy tờ, xem `VehicleDocumentsDialog`). */
export function VehicleFormSheet({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle?: Vehicle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!vehicle
  const createVehicle = useCreateVehicle()
  const updateVehicle = useUpdateVehicle()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: toFormValues(vehicle),
  })

  useEffect(() => {
    if (open) reset(toFormValues(vehicle))
  }, [vehicle, open, reset])

  const isBusy = createVehicle.isPending || updateVehicle.isPending || isSubmitting

  function toInput(values: VehicleFormValues): VehicleFormInput {
    return {
      plate: values.plate,
      brand: values.brand,
      model: values.model,
      manufacturingYear: values.manufacturingYear ? Number(values.manufacturingYear) : undefined,
      color: values.color || undefined,
      vehicleClass: values.vehicleClass,
      ownershipType: values.ownershipType,
      bankFinanced: values.bankFinanced,
      currentKm: Number(values.currentKm),
      fuelLevel: values.fuelLevel ? Number(values.fuelLevel) : undefined,
      note: values.note || undefined,
    }
  }

  async function onSubmit(values: VehicleFormValues) {
    try {
      if (isEditing && vehicle) {
        await updateVehicle.mutateAsync({ id: vehicle.id, input: toInput(values) })
        toast.success(vi.vehicles.updateSuccess)
      } else {
        await createVehicle.mutateAsync(toInput(values))
        toast.success(vi.vehicles.createSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.vehicles.saveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[480px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{isEditing ? vi.vehicles.editTitle : vi.vehicles.createTitle}</SheetTitle>
          {isEditing && vehicle && (
            <SheetDescription>
              {vi.vehicles.plate}: {vehicle.plate}
            </SheetDescription>
          )}
        </SheetHeader>

        <form
          id="vehicle-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <h3 className="text-sm font-semibold">{vi.vehicles.sectionBasic}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plate">{vi.vehicles.plate} *</Label>
            <Input id="plate" {...register('plate')} />
            {errors.plate && <p className="text-destructive text-sm">{errors.plate.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand">{vi.vehicles.brand} *</Label>
              <Input id="brand" {...register('brand')} />
              {errors.brand && <p className="text-destructive text-sm">{errors.brand.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">{vi.vehicles.model} *</Label>
              <Input id="model" {...register('model')} />
              {errors.model && <p className="text-destructive text-sm">{errors.model.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturingYear">{vi.vehicles.manufacturingYear}</Label>
              <Input id="manufacturingYear" type="number" {...register('manufacturingYear')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="color">{vi.vehicles.color}</Label>
              <Input id="color" {...register('color')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.vehicles.vehicleClass} *</Label>
            <Controller
              control={control}
              name="vehicleClass"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {VEHICLE_CLASS_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentKm">{vi.vehicles.currentKm} *</Label>
              <Input id="currentKm" type="number" {...register('currentKm')} />
              {errors.currentKm && <p className="text-destructive text-sm">{errors.currentKm.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fuelLevel">{vi.vehicles.fuelLevel}</Label>
              <Input id="fuelLevel" type="number" {...register('fuelLevel')} />
            </div>
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.vehicles.sectionOwnership}</h3>

          <div className="flex flex-col gap-1.5">
            {/* TODO(OQ: VM-RULE-015 — field này sẽ chuyển thành read-only tại đây khi VehicleConsignment (Phase 5) build, lúc đó chỉ sửa được qua module VC.) */}
            <Label>{vi.vehicles.ownershipType} *</Label>
            <Controller
              control={control}
              name="ownershipType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNERSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {OWNERSHIP_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="bankFinanced">{vi.vehicles.bankFinanced}</Label>
            <Controller
              control={control}
              name="bankFinanced"
              render={({ field }) => (
                <Switch id="bankFinanced" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.vehicles.note}</Label>
            <Textarea id="note" rows={3} {...register('note')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="vehicle-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
