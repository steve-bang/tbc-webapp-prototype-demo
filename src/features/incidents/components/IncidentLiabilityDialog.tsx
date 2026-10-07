import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { LIABILITIES, type Liability } from '@/shared/domain/enums'
import { LIABILITY_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useSetIncidentLiability } from '../hooks'
import { incidentLiabilityFormSchema, validateCostAllocation, type Incident, type IncidentLiabilityFormValues } from '../model'

function defaultValues(incident: Incident): IncidentLiabilityFormValues {
  return {
    liability: incident.liability === 'UNDETERMINED' ? '' : incident.liability,
    liabilityNote: incident.liabilityNote ?? '',
    customerCharge: incident.customerCharge !== undefined ? String(incident.customerCharge) : '0',
    companyCost: incident.companyCost !== undefined ? String(incident.companyCost) : '0',
    insuranceCovered: incident.insuranceCovered !== undefined ? String(incident.insuranceCovered) : '0',
  }
}

/**
 * UC-DI-05 — Xác định trách nhiệm & phân bổ chi phí. Hiển thị cơ sở chi phí
 * (Actual nếu đã có đủ 3 phần `actualCost*`, else Estimated — DI-BR-06) +
 * cảnh báo lệch tổng thời gian thực, chặn Lưu nếu chưa khớp.
 */
export function IncidentLiabilityDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setLiability = useSetIncidentLiability()
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentLiabilityFormValues>({
    resolver: zodResolver(incidentLiabilityFormSchema),
    defaultValues: incident ? defaultValues(incident) : undefined,
  })

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && incident) reset(defaultValues(incident))
  }

  const liability = useWatch({ control, name: 'liability' })
  const customerCharge = useWatch({ control, name: 'customerCharge' })
  const companyCost = useWatch({ control, name: 'companyCost' })
  const insuranceCovered = useWatch({ control, name: 'insuranceCovered' })

  const hasActualCost =
    incident?.actualCostParts !== undefined || incident?.actualCostLabor !== undefined || incident?.actualCostOther !== undefined
  const basis = hasActualCost
    ? (incident?.actualCostParts ?? 0) + (incident?.actualCostLabor ?? 0) + (incident?.actualCostOther ?? 0)
    : incident?.estimatedCost ?? 0
  const allocated = (Number(customerCharge) || 0) + (Number(companyCost) || 0) + (Number(insuranceCovered) || 0)
  const isAllocationValid = incident
    ? validateCostAllocation({
        actualCostParts: incident.actualCostParts,
        actualCostLabor: incident.actualCostLabor,
        actualCostOther: incident.actualCostOther,
        estimatedCost: incident.estimatedCost,
        customerCharge: Number(customerCharge) || 0,
        companyCost: Number(companyCost) || 0,
        insuranceCovered: Number(insuranceCovered) || 0,
      })
    : true

  async function onSubmit(values: IncidentLiabilityFormValues) {
    if (!incident) return
    try {
      await setLiability.mutateAsync({
        id: incident.id,
        input: {
          liability: values.liability as Liability,
          liabilityNote: values.liabilityNote || undefined,
          customerCharge: Number(values.customerCharge) || 0,
          companyCost: Number(values.companyCost) || 0,
          insuranceCovered: Number(values.insuranceCovered) || 0,
        },
      })
      toast.success(vi.incidents.liabilitySuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.liabilityError)
    }
  }

  const isBusy = setLiability.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vi.incidents.liabilityDialogTitle}</DialogTitle>
        </DialogHeader>

        <form id="incident-liability-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.incidents.liabilityLabel} *</Label>
            <Controller
              control={control}
              name="liability"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.incidents.liabilitySelectPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {LIABILITIES.filter((l) => l !== 'UNDETERMINED').map((l) => (
                      <SelectItem key={l} value={l}>
                        {LIABILITY_LABELS[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.liability && <p className="text-destructive text-sm">{errors.liability.message}</p>}
          </div>

          {liability === 'SHARED' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="il-liabilityNote">{vi.incidents.liabilityNoteLabel} *</Label>
              <Textarea id="il-liabilityNote" rows={2} {...register('liabilityNote')} />
              {errors.liabilityNote && <p className="text-destructive text-sm">{errors.liabilityNote.message}</p>}
            </div>
          )}

          <div className="bg-muted/50 flex items-center justify-between rounded-md p-3 text-sm">
            <span className="text-muted-foreground">{vi.incidents.costBasisLabel}</span>
            <span className="font-medium">{formatVnd(basis)}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="il-customerCharge">{vi.incidents.fieldCustomerCharge}</Label>
              <Input id="il-customerCharge" inputMode="numeric" {...register('customerCharge')} />
              {errors.customerCharge && <p className="text-destructive text-sm">{errors.customerCharge.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="il-companyCost">{vi.incidents.fieldCompanyCost}</Label>
              <Input id="il-companyCost" inputMode="numeric" {...register('companyCost')} />
              {errors.companyCost && <p className="text-destructive text-sm">{errors.companyCost.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="il-insuranceCovered">{vi.incidents.fieldInsuranceCovered}</Label>
              <Input id="il-insuranceCovered" inputMode="numeric" {...register('insuranceCovered')} />
              {errors.insuranceCovered && <p className="text-destructive text-sm">{errors.insuranceCovered.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{vi.incidents.costAllocatedLabel}</span>
            <span className="font-medium">{formatVnd(allocated)}</span>
          </div>
          {!isAllocationValid && <p className="text-destructive text-sm">{vi.incidents.costAllocationWarning}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="incident-liability-form" disabled={isBusy || !isAllocationValid}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
