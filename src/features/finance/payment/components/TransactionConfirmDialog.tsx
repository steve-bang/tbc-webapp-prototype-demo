import { useState } from 'react'
import { toast } from 'sonner'
import { useSessionStore } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCashDrawerSubmissions, useConfirmTransaction, useTransactions } from '../hooks'
import { calcCashDrawerBalance, cashDrawerIdOf, transactionConfirmFormSchema } from '../model'
import type { Transaction } from '../../core/types'

/**
 * UC-PM-06 (A1), BRD §15.2, EX-03 — xác nhận giao dịch CK/ví `PENDING`, cho
 * sửa số theo thực nhận (chỉ GD `IN`). Round 2 (§10.2 điểm 6/PM-BR-11): GD
 * `OUT` (hoàn) chỉ hiện số tiền (không cho sửa) + hiện số dư quỹ hiện tại của
 * người đang xác nhận khi phương thức là `CASH`.
 */
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
  const user = useSessionStore((s) => s.user)
  const { data: txns = [] } = useTransactions()
  const { data: submissions = [] } = useCashDrawerSubmissions()
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

  if (!transaction) return null

  const isOut = transaction.direction === 'OUT'
  const myDrawerId = user ? cashDrawerIdOf(user.userId) : ''
  const myBalance = transaction.method === 'CASH' && isOut ? calcCashDrawerBalance(myDrawerId, txns, submissions).balance : undefined
  const insufficientBalance = myBalance !== undefined && myBalance < transaction.amount

  async function handleConfirm() {
    if (!transaction) return
    const result = transactionConfirmFormSchema.safeParse({ amount: isOut ? String(transaction.amount) : amount, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await confirm.mutateAsync({ id: transaction.id, input: { amount: isOut ? undefined : Number(result.data.amount), note: result.data.note } })
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
          {isOut ? (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.payment.confirmAmountLabel}</Label>
              <Input value={formatVnd(transaction.amount)} disabled />
              <p className="text-muted-foreground text-xs">{vi.finance.payment.confirmReadOnlyAmountNote}</p>
            </div>
          ) : (
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
          )}
          {myBalance !== undefined && (
            <div className="flex flex-col gap-0.5">
              <p className="text-muted-foreground text-sm">
                {vi.finance.payment.confirmCashBalanceLabel}: {formatVnd(myBalance)}
              </p>
              {insufficientBalance && <p className="text-destructive text-sm">{vi.finance.payment.confirmCashBalanceInsufficientWarning}</p>}
            </div>
          )}
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
            {isOut ? vi.finance.payment.actionConfirmPaid : vi.finance.payment.actionConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
