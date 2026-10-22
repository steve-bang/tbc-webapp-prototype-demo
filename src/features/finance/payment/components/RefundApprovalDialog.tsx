import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useDecideRefundApproval } from '../hooks'
import { refundDecisionFormSchema } from '../model'
import type { Transaction } from '../../core/types'

/** UC-PM-09 bước 4 — duyệt/từ chối một giao dịch hoàn đang `PENDING_APPROVAL`. */
export function RefundApprovalDialog({
  transaction,
  decision,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  decision: 'APPROVED' | 'REJECTED'
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const decide = useDecideRefundApproval()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setNote('')
      setError(null)
    }
  }

  if (!transaction) return null

  async function handleConfirm() {
    if (!transaction) return
    const result = refundDecisionFormSchema.safeParse({ decision, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await decide.mutateAsync({ transactionId: transaction.id, input: { decision: result.data.decision, note: result.data.note } })
      toast.success(decision === 'APPROVED' ? vi.finance.payment.refundApproveSuccess : vi.finance.payment.refundRejectSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.refundDecisionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === 'APPROVED' ? vi.finance.payment.refundApprovalDialogTitle : vi.finance.payment.refundRejectDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnAmount}</span>
            <span className="font-medium">{formatVnd(transaction.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{vi.finance.payment.refundApprovalRecipientLabel}</span>
            <span>{transaction.refundRecipient ?? '—'}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-decision-note">
              {decision === 'REJECTED' ? vi.finance.payment.refundRejectNoteRequiredLabel : vi.finance.payment.refundApprovalNoteLabel}
            </Label>
            <Textarea
              id="refund-decision-note"
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
          <Button type="button" variant={decision === 'REJECTED' ? 'destructive' : 'default'} disabled={decide.isPending} onClick={handleConfirm}>
            {decision === 'APPROVED' ? vi.finance.payment.refundApproveButton : vi.finance.payment.refundRejectButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
