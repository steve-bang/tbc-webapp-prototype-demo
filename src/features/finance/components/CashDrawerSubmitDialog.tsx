import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useSubmitCashDrawer } from '../hooks'
import { makeCashDrawerSubmitSchema } from '../model'

/**
 * BRD §14-§15, UC-PM-14, AC-PM-009, EX-06. TODO(OQ: Payment-BRD.md §27
 * Q10-Q12 — quỹ theo ca/ngày/điểm, thủ quỹ, xử lý chênh lệch chưa chốt; demo:
 * quỹ theo người thu, nộp theo ngày, mọi người có `PAYMENT.RECONCILE` nhận phiếu.)
 */
export function CashDrawerSubmitDialog({
  systemAmount,
  open,
  onOpenChange,
}: {
  systemAmount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const submit = useSubmitCashDrawer()
  const [countedAmount, setCountedAmount] = useState('')
  const [varianceReason, setVarianceReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCountedAmount(String(systemAmount))
      setVarianceReason('')
      setError(null)
    }
  }

  const schema = makeCashDrawerSubmitSchema(systemAmount)
  const variance = countedAmount && /^\d+$/.test(countedAmount) ? Number(countedAmount) - systemAmount : undefined

  async function handleConfirm() {
    const result = schema.safeParse({ countedAmount, varianceReason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await submit.mutateAsync({ countedAmount: Number(result.data.countedAmount), varianceReason: result.data.varianceReason })
      toast.success(vi.finance.payment.cashDrawerSubmitSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.cashDrawerSubmitError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.cashDrawerSubmitDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="bg-muted/50 flex items-center justify-between rounded-md p-3 text-sm">
            <span className="text-muted-foreground">{vi.finance.payment.cashDrawerSystemAmount}</span>
            <span className="font-medium">{formatVnd(systemAmount)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cds-counted">{vi.finance.payment.cashDrawerCountedAmount} *</Label>
            <Input
              id="cds-counted"
              inputMode="numeric"
              value={countedAmount}
              onChange={(e) => {
                setCountedAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          {variance !== undefined && variance !== 0 && (
            <p className="text-status-error text-sm">
              {vi.finance.payment.cashDrawerVariance}: {formatVnd(variance)}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cds-variance-reason">{vi.finance.payment.cashDrawerVarianceReasonLabel}</Label>
            <Textarea
              id="cds-variance-reason"
              rows={2}
              value={varianceReason}
              onChange={(e) => {
                setVarianceReason(e.target.value)
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
          <Button type="button" disabled={submit.isPending} onClick={handleConfirm}>
            {vi.finance.payment.cashDrawerSubmitButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
