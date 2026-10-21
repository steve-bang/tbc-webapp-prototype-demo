import { useState } from 'react'
import { toast } from 'sonner'
// `customers` chưa export `useCustomers` qua barrel `index.ts` — deep-import
// thẳng `hooks.ts`, ngoại lệ đã chấp nhận (`RENTAL-SETTLEMENT-PLAN.md` §0.2).
import { useCustomers } from '@/features/customers/hooks'
import { useRentals } from '@/features/rentals'
import type { PaymentMethod, TransactionDirection } from '@/shared/domain/enums'
import { PAYMENT_METHOD_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateAdjustment } from '../hooks'
import { adjustmentFormSchema } from '../model'

const METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'E_WALLET']

/** UC-PM-13, PM-BR-18 — giao dịch thủ công IN/OUT, gắn Customer (+ Rental tuỳ chọn), lý do bắt buộc. */
export function PaymentAdjustmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateAdjustment()
  const { data: customers = [] } = useCustomers()
  const { data: rentals = [] } = useRentals()

  const [direction, setDirection] = useState<TransactionDirection>('IN')
  const [customerId, setCustomerId] = useState('')
  const [rentalId, setRentalId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDirection('IN')
      setCustomerId('')
      setRentalId('')
      setAmount('')
      setMethod('CASH')
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = adjustmentFormSchema.safeParse({ direction, amount, customerId, rentalId: rentalId || undefined, method, reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await create.mutateAsync({
        direction: result.data.direction,
        amount: Number(result.data.amount),
        customerId: result.data.customerId,
        rentalId: result.data.rentalId,
        method: result.data.method,
        reason: result.data.reason,
      })
      toast.success(vi.finance.payment.adjustmentSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.adjustmentError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.adjustmentDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.payment.adjustmentDirectionLabel}</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as TransactionDirection)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">{vi.finance.payment.adjustmentDirectionIn}</SelectItem>
                <SelectItem value="OUT">{vi.finance.payment.adjustmentDirectionOut}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.payment.adjustmentCustomerLabel} *</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.payment.adjustmentRentalLabel}</Label>
            <Select value={rentalId} onValueChange={setRentalId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {rentals.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-amount">{vi.finance.payment.adjustmentAmountLabel} *</Label>
            <Input
              id="adj-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.payment.adjustmentMethodLabel}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-reason">{vi.finance.payment.adjustmentReasonLabel}</Label>
            <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={create.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
