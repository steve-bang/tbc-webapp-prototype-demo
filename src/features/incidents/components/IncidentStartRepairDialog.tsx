import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useStartIncidentRepair } from '../hooks'
import { incidentStartRepairFormSchema, type Incident, type IncidentStartRepairFormValues } from '../model'

/** `APPROVED -> IN_REPAIR`. */
export function IncidentStartRepairDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const startRepair = useStartIncidentRepair()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentStartRepairFormValues>({
    resolver: zodResolver(incidentStartRepairFormSchema),
    defaultValues: { repairVendorName: '', repairStartDate: new Date().toISOString().slice(0, 10) },
  })

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) reset({ repairVendorName: '', repairStartDate: new Date().toISOString().slice(0, 10) })
  }

  async function onSubmit(values: IncidentStartRepairFormValues) {
    if (!incident) return
    try {
      await startRepair.mutateAsync({ id: incident.id, input: values })
      toast.success(vi.incidents.startRepairSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.startRepairError)
    }
  }

  const isBusy = startRepair.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.incidents.startRepairDialogTitle}</DialogTitle>
        </DialogHeader>
        <form id="incident-start-repair-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="isr-vendor">{vi.incidents.fieldRepairVendor} *</Label>
            <Input id="isr-vendor" {...register('repairVendorName')} />
            {errors.repairVendorName && <p className="text-destructive text-sm">{errors.repairVendorName.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="isr-start">{vi.incidents.fieldRepairStartDate} *</Label>
            <Input id="isr-start" type="date" {...register('repairStartDate')} />
            {errors.repairStartDate && <p className="text-destructive text-sm">{errors.repairStartDate.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="incident-start-repair-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
