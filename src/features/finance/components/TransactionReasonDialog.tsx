import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useFailTransaction, useReverseTransaction, useVoidTransaction } from '../hooks'
import { transactionReasonFormSchema, type Transaction } from '../model'

export type TransactionReasonMode = 'fail' | 'void' | 'reverse'

const TITLE_KEY: Record<TransactionReasonMode, 'failDialogTitle' | 'voidDialogTitle' | 'reverseDialogTitle'> = {
  fail: 'failDialogTitle',
  void: 'voidDialogTitle',
  reverse: 'reverseDialogTitle',
}

/**
 * Dùng chung cho Thất bại (`EX-03`) / Huỷ (`PM-BR-02`) / Đảo (`UC-PM-12`,
 * `PM-BR-03/19`, `AC-PM-008/013/015`) — lý do bắt buộc. Đảo hiện thêm cảnh báo
 * sinh giao dịch đối ứng + vô hiệu biên lai gốc.
 */
export function TransactionReasonDialog({
  transaction,
  mode,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  mode: TransactionReasonMode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fail = useFailTransaction()
  const voidTxn = useVoidTransaction()
  const reverse = useReverseTransaction()
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

  const mutation = mode === 'fail' ? fail : mode === 'void' ? voidTxn : reverse
  const successMessage = mode === 'fail' ? vi.finance.payment.failSuccess : mode === 'void' ? vi.finance.payment.voidSuccess : vi.finance.payment.reverseSuccess
  const errorMessage = mode === 'fail' ? vi.finance.payment.failError : mode === 'void' ? vi.finance.payment.voidError : vi.finance.payment.reverseError

  async function handleConfirm() {
    if (!transaction) return
    const result = transactionReasonFormSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await mutation.mutateAsync({ id: transaction.id, reason: result.data.reason })
      toast.success(successMessage)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorMessage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment[TITLE_KEY[mode]]}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {mode === 'reverse' && <p className="text-destructive text-sm">{vi.finance.payment.reverseWarning}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-reason">{vi.finance.payment.reasonLabel}</Label>
            <Textarea
              id="txn-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
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
          <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
