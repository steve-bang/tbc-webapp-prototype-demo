import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useReverseSettlement } from '../hooks'
import { settlementReverseReasonFormSchema, type Settlement } from '../model'

/**
 * Đảo quyết toán — UC-RS-16, BRD §18.2, RS-BR-14, AC-RS-013, EX-09. Xác nhận
 * 2 bước: (1) lý do bắt buộc + cảnh báo hệ quả, (2) gõ lại đúng mã lượt thuê.
 * Chỉ `SYSTEM_ADMIN` thấy nút mở dialog này (gắn ở `SettlementWorksheet`).
 */
export function SettlementReverseDialog({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: Settlement
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const reverse = useReverseSettlement()
  const [step, setStep] = useState<1 | 2>(1)
  const [reason, setReason] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep(1)
      setReason('')
      setConfirmValue('')
      setError(null)
    }
  }

  function handleContinue() {
    const result = settlementReverseReasonFormSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    setError(null)
    setStep(2)
  }

  const matches = confirmValue.trim() === settlement.rentalId

  async function handleConfirm() {
    if (!matches) {
      setError(vi.finance.reverseConfirmMismatch)
      return
    }
    try {
      await reverse.mutateAsync({ settlementId: settlement.id, input: { reason: reason.trim(), confirmRentalId: confirmValue.trim() } })
      toast.success(vi.finance.reverseSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.reverseError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.reverseDialogTitle}</DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <p className="text-destructive text-sm">{vi.finance.reverseStep1Warning}</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rev-reason">{vi.finance.reverseReasonLabel}</Label>
              <Textarea
                id="rev-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError(null)
                }}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="button" variant="destructive" onClick={handleContinue}>
                {vi.finance.reverseContinueButton}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rev-confirm">
                {vi.finance.reverseConfirmLabel} (<span className="font-mono">{settlement.rentalId}</span>)
              </Label>
              <Input
                id="rev-confirm"
                value={confirmValue}
                placeholder={vi.finance.reverseConfirmPlaceholder}
                onChange={(e) => {
                  setConfirmValue(e.target.value)
                  if (error) setError(null)
                }}
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="button" variant="destructive" disabled={!matches || reverse.isPending} onClick={handleConfirm}>
                {vi.finance.reverseConfirmButton}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
