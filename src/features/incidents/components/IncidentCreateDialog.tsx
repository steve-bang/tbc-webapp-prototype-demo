import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useRentals } from '@/features/rentals'
// `vehicles` chưa export `useVehicles` qua barrel `index.ts` — deep-import
// thẳng từ `hooks.ts`, cùng tiền lệ `RentalFormSheet`.
import { useVehicles } from '@/features/vehicles/hooks'
import { INCIDENT_SEVERITIES, INCIDENT_TYPES, type IncidentBaselineReference, type IncidentSeverity, type IncidentSource, type IncidentType } from '@/shared/domain/enums'
import {
  INCIDENT_BASELINE_REFERENCE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SOURCE_LABELS,
  INCIDENT_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateIncident, useCreateIncidentFromReturn } from '../hooks'
import { incidentCreateFormSchema, type IncidentCreateFormValues } from '../model'

/** `source` tự tạo được ở form thủ công — `RETURN` chỉ sinh qua biến thể `fromReturn`. */
const MANUAL_SOURCES: IncidentSource[] = ['STANDALONE', 'INSPECTION', 'ACCIDENT']
const NONE_RENTAL = '__NONE__'

/** §0.3/§5.5 kế hoạch — tiền điền từ 1 `ReturnIncidentItem` cụ thể, kế thừa (DI-BR-14), không nhập lại. */
export interface IncidentFromReturnPrefill {
  returnRecordId: string
  itemId: string
  vehicleId: string
  rentalId: string
  typeLabel: string
  location?: string
  description: string
  estimatedCost: number
  baselineReference: IncidentBaselineReference
  defaultSafetyImpact: boolean
}

/**
 * `fromReturn` tiền điền đủ để qua được `incidentCreateFormSchema` (vốn dùng
 * chung cho cả 2 biến thể) — `source: 'RETURN'` tắt validate bắt buộc
 * `location` (chỉ có ở biến thể thủ công), `description`/`estimatedCost` lấy
 * nguyên từ `ReturnIncidentItem` (DI-BR-14, không nhập lại).
 */
function defaultFormValues(fromReturn?: IncidentFromReturnPrefill): IncidentCreateFormValues {
  return {
    vehicleId: fromReturn?.vehicleId ?? '',
    rentalId: fromReturn?.rentalId ?? '',
    source: fromReturn ? 'RETURN' : 'STANDALONE',
    type: 'EXTERIOR',
    severity: 'MINOR',
    safetyImpact: fromReturn?.defaultSafetyImpact ?? false,
    location: fromReturn?.location ?? '',
    description: fromReturn?.description ?? '',
    estimatedCost: fromReturn ? String(fromReturn.estimatedCost) : '0',
  }
}

/**
 * `docs/DAMAGE-INCIDENT-MANAGEMENT-PLAN.md` §5.5 — 2 biến thể: tạo mới hoàn
 * toàn (`fromReturn` không truyền, `source` chọn `STANDALONE`/`INSPECTION`/
 * `ACCIDENT`) hoặc tạo từ `ReturnIncidentItem` (`fromReturn` truyền props tiền
 * điền, field kế thừa hiển thị read-only, chỉ hỏi thêm Severity/Safety Impact
 * — DI-BR-14).
 */
export function IncidentCreateDialog({
  open,
  onOpenChange,
  fromReturn,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromReturn?: IncidentFromReturnPrefill
}) {
  const createIncident = useCreateIncident()
  const createFromReturn = useCreateIncidentFromReturn()
  const { data: vehicles = [] } = useVehicles()
  const { data: rentals = [] } = useRentals()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentCreateFormValues>({
    resolver: zodResolver(incidentCreateFormSchema),
    defaultValues: defaultFormValues(fromReturn),
  })

  useEffect(() => {
    if (open) reset(defaultFormValues(fromReturn))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reset])

  const isBusy = createIncident.isPending || createFromReturn.isPending || isSubmitting

  async function onSubmit(values: IncidentCreateFormValues) {
    try {
      if (fromReturn) {
        await createFromReturn.mutateAsync({
          returnRecordId: fromReturn.returnRecordId,
          itemId: fromReturn.itemId,
          severity: values.severity as IncidentSeverity,
          safetyImpact: values.safetyImpact,
        })
      } else {
        await createIncident.mutateAsync({
          vehicleId: values.vehicleId,
          rentalId: values.rentalId || undefined,
          source: values.source as IncidentSource,
          type: values.type as IncidentType,
          severity: values.severity as IncidentSeverity,
          safetyImpact: values.safetyImpact,
          location: values.location,
          description: values.description,
          estimatedCost: Number(values.estimatedCost),
        })
      }
      toast.success(vi.incidents.createSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.createError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[560px] lg:max-w-none">
        <SheetHeader className="border-b">
          <SheetTitle>{fromReturn ? vi.incidents.createFromReturnDialogTitle : vi.incidents.createDialogTitle}</SheetTitle>
        </SheetHeader>

        <form id="incident-create-form" className="flex flex-1 flex-col gap-4 overflow-y-auto p-5" onSubmit={handleSubmit(onSubmit)}>
          {fromReturn ? (
            <div className="bg-muted/50 flex flex-col gap-2 rounded-md p-3 text-sm">
              <p className="text-muted-foreground text-xs">DI-BR-14 — kế thừa từ biên bản trả xe, không nhập lại:</p>
              <p>
                <span className="text-muted-foreground">{vi.incidents.typeLabel}: </span>
                {fromReturn.typeLabel}
              </p>
              <p>
                <span className="text-muted-foreground">{vi.incidents.locationLabel}: </span>
                {fromReturn.location || vi.incidents.noValue}
              </p>
              <p>
                <span className="text-muted-foreground">{vi.incidents.descriptionLabel}: </span>
                {fromReturn.description}
              </p>
              <p>
                <span className="text-muted-foreground">{vi.incidents.estimatedCostLabel}: </span>
                {fromReturn.estimatedCost.toLocaleString('vi-VN')}đ
              </p>
              <p>
                <span className="text-muted-foreground">{vi.incidents.baselineReferenceLabel}: </span>
                {INCIDENT_BASELINE_REFERENCE_LABELS[fromReturn.baselineReference]}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{vi.incidents.vehicleLabel} *</Label>
                <Controller
                  control={control}
                  name="vehicleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={vi.incidents.vehiclePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
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

              <div className="flex flex-col gap-1.5">
                <Label>{vi.incidents.rentalLabel}</Label>
                <Controller
                  control={control}
                  name="rentalId"
                  render={({ field }) => (
                    <Select value={field.value || NONE_RENTAL} onValueChange={(v) => field.onChange(v === NONE_RENTAL ? '' : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={vi.incidents.rentalPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_RENTAL}>{vi.incidents.rentalPlaceholder}</SelectItem>
                        {rentals.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.id} — {r.pickupDateTime.slice(0, 10)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{vi.incidents.sourceLabel} *</Label>
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {INCIDENT_SOURCE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{vi.incidents.typeLabel} *</Label>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INCIDENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {INCIDENT_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ic-location">{vi.incidents.locationLabel} *</Label>
                <Input id="ic-location" {...register('location')} />
                {errors.location && <p className="text-destructive text-sm">{errors.location.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ic-description">{vi.incidents.descriptionLabel} *</Label>
                <Textarea id="ic-description" rows={3} {...register('description')} />
                {errors.description && <p className="text-destructive text-sm">{errors.description.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ic-estimatedCost">{vi.incidents.estimatedCostLabel} *</Label>
                <Input id="ic-estimatedCost" inputMode="numeric" {...register('estimatedCost')} />
                {errors.estimatedCost && <p className="text-destructive text-sm">{errors.estimatedCost.message}</p>}
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{vi.incidents.severityLabel} *</Label>
            <Controller
              control={control}
              name="severity"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INCIDENT_SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {INCIDENT_SEVERITY_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="safetyImpact"
              render={({ field }) => (
                <Checkbox id="ic-safetyImpact" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
              )}
            />
            <Label htmlFor="ic-safetyImpact" className="font-normal">
              {vi.incidents.safetyImpactLabel}
            </Label>
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="incident-create-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
