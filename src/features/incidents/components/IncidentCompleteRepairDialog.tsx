import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { formatVnd } from '@/shared/lib/money'
import { generateId } from '@/shared/lib/id'
import { useMarkIncidentRepaired } from '../hooks'
import { incidentCompleteRepairFormSchema, type Incident, type IncidentCompleteRepairFormValues } from '../model'

/** `IN_REPAIR -> REPAIRED` — chặn thiếu actual cost/hoá đơn (DI-BR-09). */
export function IncidentCompleteRepairDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const markRepaired = useMarkIncidentRepaired()
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentCompleteRepairFormValues>({
    resolver: zodResolver(incidentCompleteRepairFormSchema),
    defaultValues: { actualCostParts: '0', actualCostLabor: '0', actualCostOther: '0', repairEndDate: new Date().toISOString().slice(0, 10), invoiceNote: '' },
  })

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      reset({ actualCostParts: '0', actualCostLabor: '0', actualCostOther: '0', repairEndDate: new Date().toISOString().slice(0, 10), invoiceNote: '' })
    }
  }

  const parts = useWatch({ control, name: 'actualCostParts' })
  const labor = useWatch({ control, name: 'actualCostLabor' })
  const other = useWatch({ control, name: 'actualCostOther' })
  const total = (Number(parts) || 0) + (Number(labor) || 0) + (Number(other) || 0)

  async function onSubmit(values: IncidentCompleteRepairFormValues) {
    if (!incident) return
    try {
      await markRepaired.mutateAsync({
        id: incident.id,
        input: {
          actualCostParts: Number(values.actualCostParts),
          actualCostLabor: Number(values.actualCostLabor),
          actualCostOther: Number(values.actualCostOther),
          repairEndDate: values.repairEndDate,
          repairInvoiceMeta: {
            id: generateId('med'),
            category: 'REPAIR_INVOICE',
            capturedAt: new Date().toISOString(),
            note: values.invoiceNote,
          },
        },
      })
      toast.success(vi.incidents.completeRepairSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.completeRepairError)
    }
  }

  const isBusy = markRepaired.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vi.incidents.completeRepairDialogTitle}</DialogTitle>
        </DialogHeader>
        <form id="incident-complete-repair-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="icr-parts">{vi.incidents.fieldActualCostParts} *</Label>
              <Input id="icr-parts" inputMode="numeric" {...register('actualCostParts')} />
              {errors.actualCostParts && <p className="text-destructive text-sm">{errors.actualCostParts.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="icr-labor">{vi.incidents.fieldActualCostLabor} *</Label>
              <Input id="icr-labor" inputMode="numeric" {...register('actualCostLabor')} />
              {errors.actualCostLabor && <p className="text-destructive text-sm">{errors.actualCostLabor.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="icr-other">{vi.incidents.fieldActualCostOther} *</Label>
              <Input id="icr-other" inputMode="numeric" {...register('actualCostOther')} />
              {errors.actualCostOther && <p className="text-destructive text-sm">{errors.actualCostOther.message}</p>}
            </div>
          </div>
          <div className="bg-muted/50 flex items-center justify-between rounded-md p-3 text-sm">
            <span className="text-muted-foreground">{vi.incidents.totalActualCostLabel}</span>
            <span className="font-medium">{formatVnd(total)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="icr-end">{vi.incidents.fieldRepairEndDate} *</Label>
            <Input id="icr-end" type="date" {...register('repairEndDate')} />
            {errors.repairEndDate && <p className="text-destructive text-sm">{errors.repairEndDate.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="icr-invoice">{vi.incidents.invoiceNoteLabel} *</Label>
            <Input id="icr-invoice" {...register('invoiceNote')} />
            {errors.invoiceNote && <p className="text-destructive text-sm">{errors.invoiceNote.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="incident-complete-repair-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
