import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCancelIncident } from '../hooks'
import { incidentCancelReasonSchema, type Incident } from '../model'

/** `OPEN`/`ASSESSING`/`APPROVED -> CANCELLED`, bắt buộc lý do — mirror `RentalCancelDialog`. */
export function IncidentCancelDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cancelIncident = useCancelIncident()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = incidentCancelReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.customers.reasonRequired)
      return
    }
    if (!incident) return
    try {
      await cancelIncident.mutateAsync({ id: incident.id, reason: result.data.reason })
      toast.success(vi.incidents.cancelSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.cancelError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.incidents.cancelDialogTitle}</DialogTitle>
          {incident && <DialogDescription>{incident.incidentCode}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="incident-cancel-reason">{vi.incidents.cancelReasonLabel} *</Label>
          <Textarea
            id="incident-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={cancelIncident.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
