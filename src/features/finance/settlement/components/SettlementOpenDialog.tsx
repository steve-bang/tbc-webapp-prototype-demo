import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useOpenSettlement } from '../hooks'

/** UC-RS-01 — mở quyết toán thủ công (Round 1 không tự mở khi Return `COMPLETED`, xem §1.2 kế hoạch). */
export function SettlementOpenDialog({
  rentalId,
  open,
  onOpenChange,
}: {
  rentalId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const openSettlement = useOpenSettlement()

  async function handleConfirm() {
    try {
      await openSettlement.mutateAsync(rentalId)
      toast.success(vi.finance.openSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.openError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.openDialogTitle}</DialogTitle>
          <DialogDescription>{vi.finance.openDialogDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={openSettlement.isPending} onClick={handleConfirm}>
            {vi.finance.openButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
