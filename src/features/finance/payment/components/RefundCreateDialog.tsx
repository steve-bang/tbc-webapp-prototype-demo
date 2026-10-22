import { useState } from 'react'
import { toast } from 'sonner'
import type { PaymentMethod } from '@/shared/domain/enums'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateRefundTransaction, useTransactions } from '../hooks'
import { calcRequestProgress, refundCreateFormSchema, refundNeedsApproval } from '../model'
import type { PaymentRequest } from '../../core/types'

const REFUNDABLE_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'E_WALLET']

/**
 * `docs/PAYMENT-PLAN.md` §10.9 — tạo giao dịch hoàn cho một `PaymentRequest`
 * `purpose = REFUND` (yêu cầu `SETTLEMENT`/`POST_SETTLEMENT_CHARGE`).
 */
export function RefundCreateDialog({
  request,
  open,
  onOpenChange,
}: {
  request: PaymentRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateRefundTransaction()
  const { data: txns = [] } = useTransactions(request ? { rentalId: request.rentalId } : undefined)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  const [refundRecipient, setRefundRecipient] = useState('')
  const [reference, setReference] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && request) {
      const { remaining, pending } = calcRequestProgress(request, txns)
      setAmount(String(Math.max(0, remaining - pending)))
      setMethod('BANK_TRANSFER')
      setRefundRecipient('')
      setReference('')
      setEvidenceNote('')
      setError(null)
    }
  }

  if (!request) return null

  const { collected, remaining, pending } = calcRequestProgress(request, txns)
  const available = Math.max(0, remaining - pending)
  const needsApproval = refundNeedsApproval(Number(amount) || 0)
  // TODO(OQ: Payment-BRD.md — chưa có quy tắc giới hạn phương thức hoàn theo
  // `securityDepositType`; giữ đủ các phương thức hoàn hợp lệ, không tự đặt luật.
  const allowedMethods = REFUNDABLE_METHODS

  async function handleConfirm() {
    if (!request) return
    const result = refundCreateFormSchema.safeParse({ amount, method, refundRecipient, reference, evidenceNote })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await create.mutateAsync({
        requestId: request.id,
        input: {
          amount: Number(result.data.amount),
          method: result.data.method,
          refundRecipient: result.data.refundRecipient,
          reference: result.data.reference,
          evidenceNote: result.data.evidenceNote,
        },
      })
      toast.success(vi.finance.payment.refundCreateSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.refundCreateError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.refundCreateDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="text-muted-foreground flex flex-col gap-1 text-sm">
            <p>{vi.finance.payment.refundRequestTypeLabel}: {TRANSACTION_TYPE_LABELS[request.transactionType]}</p>
            <p className="font-mono text-xs">{vi.finance.payment.refundRequestIdLabel}: {request.id}</p>
            <p>{vi.finance.payment.refundAlreadyRefundedLabel}: {formatVnd(collected)}</p>
            <p>{vi.finance.payment.refundPendingLabel}: {formatVnd(pending)}</p>
            <p>{vi.finance.payment.refundRemainingLabel}: {formatVnd(available)}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-amount">{vi.finance.payment.recordAmountLabel} *</Label>
            <Input
              id="refund-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          {needsApproval && <p className="text-status-pending text-sm">{vi.finance.payment.refundApprovalNotice}</p>}
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.payment.recordMethodLabel}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedMethods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-recipient">{vi.finance.payment.refundRecipientLabel}</Label>
            <Input
              id="refund-recipient"
              placeholder={vi.finance.payment.refundRecipientPlaceholder}
              value={refundRecipient}
              onChange={(e) => {
                setRefundRecipient(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          {(method === 'BANK_TRANSFER' || method === 'E_WALLET') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refund-reference">{vi.finance.payment.recordReferenceLabel} *</Label>
              <Input
                id="refund-reference"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value)
                  if (error) setError(null)
                }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-evidence">{vi.finance.payment.recordEvidenceLabel}</Label>
            <Textarea id="refund-evidence" rows={2} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={create.isPending} onClick={handleConfirm}>
            {vi.finance.payment.recordRefundButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
