import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { useRentals, type Rental } from '@/features/rentals'
import type { PaymentMethod } from '@/shared/domain/enums'
import { PAYMENT_METHOD_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { usePaymentRequests, useRecordTransaction, useTransactions } from '../hooks'
import { calcRequestProgress, isRequestActionable, transactionRecordFormSchema, type PaymentRequest } from '../model'

const RECORDABLE_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'E_WALLET']

/**
 * UC-PM-01/02/03, PM-BR-09/10/15/20 — Ghi nhận thu theo yêu cầu thanh toán
 * mốc `BOOKING`/`HANDOVER`. Nếu không truyền sẵn `rental`/`request`, người
 * dùng chọn Lượt thuê rồi chọn Yêu cầu (dùng từ `TransactionLedgerScreen`).
 * Dialog chỉ liệt kê phương thức người dùng có quyền (§5 kế hoạch).
 */
export function TransactionRecordDialog({
  rental,
  request,
  open,
  onOpenChange,
}: {
  rental?: Rental
  request?: PaymentRequest
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  const record = useRecordTransaction()
  const { data: rentals = [] } = useRentals()
  const allowedMethods = RECORDABLE_METHODS.filter((m) => (m === 'CASH' ? can('PAYMENT', 'RECORD_CASH') : can('PAYMENT', 'CREATE')))

  const [selectedRentalId, setSelectedRentalId] = useState('')
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(allowedMethods[0] ?? 'CASH')
  const [reference, setReference] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelectedRentalId(rental?.id ?? '')
      setSelectedRequestId(request?.id ?? '')
      setAmount('')
      setMethod(allowedMethods[0] ?? 'CASH')
      setReference('')
      setEvidenceNote('')
      setError(null)
    }
  }

  const effectiveRentalId = rental?.id ?? selectedRentalId
  const { data: candidateRequests = [] } = usePaymentRequests(effectiveRentalId ? { rentalId: effectiveRentalId } : undefined)
  const { data: rentalTxns = [] } = useTransactions(effectiveRentalId ? { rentalId: effectiveRentalId } : undefined)
  const actionableRequests = useMemo(
    () => (rental ? candidateRequests.filter((r) => isRequestActionable(r, rental)) : candidateRequests.filter((r) => r.status === 'OPEN' || r.status === 'PARTIALLY_FULFILLED')),
    [candidateRequests, rental],
  )
  const effectiveRequest = request ?? actionableRequests.find((r) => r.id === selectedRequestId)

  async function handleConfirm() {
    if (!effectiveRequest) {
      setError('Chọn yêu cầu thanh toán')
      return
    }
    const result = transactionRecordFormSchema.safeParse({
      paymentRequestId: effectiveRequest.id,
      amount,
      method,
      reference,
      evidenceNote,
    })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await record.mutateAsync({
        paymentRequestId: result.data.paymentRequestId,
        amount: Number(result.data.amount),
        method: result.data.method,
        reference: result.data.reference,
        evidenceNote: result.data.evidenceNote,
      })
      toast.success(vi.finance.payment.recordSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.recordError)
    }
  }

  const remaining = effectiveRequest ? calcRequestProgress(effectiveRequest, rentalTxns).remaining : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.recordDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {!rental && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.payment.recordRentalLabel}</Label>
              <Select
                value={selectedRentalId}
                onValueChange={(v) => {
                  setSelectedRentalId(v)
                  setSelectedRequestId('')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rentals.map((r: Rental) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!request && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.payment.recordRequestLabel}</Label>
              {actionableRequests.length === 0 ? (
                <p className="text-muted-foreground text-sm">{vi.finance.payment.scheduleEmptyNote}</p>
              ) : (
                <Select value={selectedRequestId} onValueChange={setSelectedRequestId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionableRequests.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.source} — {r.transactionType} — {formatVnd(r.expectedAmount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
          {effectiveRequest && remaining !== undefined && (
            <p className="text-muted-foreground text-sm">{vi.finance.payment.recordRemainingNote.replace('{amount}', formatVnd(remaining))}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-amount">{vi.finance.payment.recordAmountLabel} *</Label>
            <Input
              id="txn-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
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
          {(method === 'BANK_TRANSFER' || method === 'E_WALLET') && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn-reference">{vi.finance.payment.recordReferenceLabel} *</Label>
              <Input
                id="txn-reference"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value)
                  if (error) setError(null)
                }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-evidence">{vi.finance.payment.recordEvidenceLabel}</Label>
            <Textarea id="txn-evidence" rows={2} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={record.isPending} onClick={handleConfirm}>
            {vi.finance.payment.recordButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
