import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useClosePostSettlementCharge } from '../hooks'
import type { PostSettlementCharge } from '../model'

/** BRD §17 bước cuối, UC-RS-14 bước 6 — đánh dấu PSC đã tất toán thủ công (thay cho Payment, §0.3 kế hoạch). */
export function PostSettlementChargeCloseDialog({
  psc,
  open,
  onOpenChange,
}: {
  psc: PostSettlementCharge | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = useClosePostSettlementCharge()
  const [closeNote, setCloseNote] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setCloseNote('')
  }

  async function handleConfirm() {
    if (!psc) return
    try {
      await close.mutateAsync({ pscId: psc.id, closeNote: closeNote.trim() || undefined })
      toast.success(vi.finance.pscCloseSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.pscCloseError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.pscCloseDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="psc-close-note">{vi.finance.pscCloseNoteLabel}</Label>
          <Textarea id="psc-close-note" rows={2} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={close.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
