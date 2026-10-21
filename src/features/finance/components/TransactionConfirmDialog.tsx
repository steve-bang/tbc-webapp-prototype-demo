import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useConfirmTransaction } from '../hooks'
import { transactionConfirmFormSchema, type Transaction } from '../model'

/** UC-PM-06 (A1), BRD §15.2, EX-03 — xác nhận giao dịch CK/ví `PENDING`, cho sửa số theo thực nhận. */
export function TransactionConfirmDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const confirm = useConfirmTransaction()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && transaction) {
      setAmount(String(transaction.amount))
      setNote('')
      setError(null)
    }
  }

  async function handleConfirm() {
    if (!transaction) return
    const result = transactionConfirmFormSchema.safeParse({ amount, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await confirm.mutateAsync({ id: transaction.id, input: { amount: Number(result.data.amount), note: result.data.note } })
      toast.success(vi.finance.payment.confirmSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.confirmError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.confirmDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-confirm-amount">{vi.finance.payment.confirmAmountLabel} *</Label>
            <Input
              id="txn-confirm-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-confirm-note">{vi.finance.payment.confirmNoteLabel}</Label>
            <Textarea id="txn-confirm-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={confirm.isPending} onClick={handleConfirm}>
            {vi.finance.payment.actionConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
