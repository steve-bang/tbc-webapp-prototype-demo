import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useApproveIncident } from '../hooks'
import type { Incident } from '../model'

/** UC-DI-07 — chỉ hiện khi `WAITING_APPROVAL`, gate `INCIDENT.APPROVE`. Mirror `RentalConfirmDialog`. */
export function IncidentApproveDialog({
  incident,
  open,
  onOpenChange,
}: {
  incident: Incident | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const approveIncident = useApproveIncident()

  async function handleConfirm() {
    if (!incident) return
    try {
      await approveIncident.mutateAsync(incident.id)
      toast.success(vi.incidents.approveSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.incidents.approveError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.incidents.approveDialogTitle}</DialogTitle>
          <DialogDescription>{vi.incidents.approveDialogDescription}</DialogDescription>
        </DialogHeader>
        {incident && <p className="text-sm">{incident.incidentCode}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={approveIncident.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
