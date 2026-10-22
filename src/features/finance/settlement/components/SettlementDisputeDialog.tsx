import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useDisputeSettlementLine } from '../hooks'
import { settlementDisputeFormSchema } from '../model'
import type { SettlementLine } from '../../core/types'

/** AC-RS-007, RS-BR-17 — đánh dấu dòng tranh chấp, bắt buộc ghi chú. */
export function SettlementDisputeDialog({
  settlementId,
  line,
  open,
  onOpenChange,
}: {
  settlementId: string
  line: SettlementLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const disputeLine = useDisputeSettlementLine()
  const [disputeNote, setDisputeNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDisputeNote('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = settlementDisputeFormSchema.safeParse({ disputeNote })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    if (!line) return
    try {
      await disputeLine.mutateAsync({ id: settlementId, lineId: line.id, disputeNote: result.data.disputeNote })
      toast.success(vi.finance.disputeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.disputeError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.disputeDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sd-note">{vi.finance.disputeNoteLabel} *</Label>
          <Textarea
            id="sd-note"
            rows={3}
            value={disputeNote}
            onChange={(e) => {
              setDisputeNote(e.target.value)
              if (error) setError(null)
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={disputeLine.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
