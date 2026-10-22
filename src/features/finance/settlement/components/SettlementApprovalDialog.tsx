import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useApproveSettlement, useRejectSettlement } from '../hooks'
import { settlementApprovalFormSchema } from '../model'

/** BRD §14, UC-RS-09, EX-06 — Duyệt / Trả lại (ghi chú bắt buộc khi trả lại). */
export function SettlementApprovalDialog({
  settlementId,
  open,
  onOpenChange,
}: {
  settlementId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const approve = useApproveSettlement()
  const reject = useRejectSettlement()
  const [decision, setDecision] = useState<'APPROVED' | 'RETURNED'>('APPROVED')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDecision('APPROVED')
      setNote('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = settlementApprovalFormSchema.safeParse({ decision, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      if (result.data.decision === 'APPROVED') {
        await approve.mutateAsync({ id: settlementId, note: result.data.note || undefined })
        toast.success(vi.finance.approveSuccess)
      } else {
        await reject.mutateAsync({ id: settlementId, note: result.data.note as string })
        toast.success(vi.finance.rejectSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : decision === 'APPROVED' ? vi.finance.approveError : vi.finance.rejectError)
    }
  }

  const isBusy = approve.isPending || reject.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.approvalDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={decision === 'APPROVED' ? 'default' : 'outline'} onClick={() => setDecision('APPROVED')}>
              {vi.finance.approveButton}
            </Button>
            <Button type="button" size="sm" variant={decision === 'RETURNED' ? 'default' : 'outline'} onClick={() => setDecision('RETURNED')}>
              {vi.finance.rejectButton}
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sa-note">{decision === 'RETURNED' ? vi.finance.rejectNoteRequiredLabel : vi.finance.approvalNoteLabel}</Label>
            <Textarea
              id="sa-note"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={isBusy} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
