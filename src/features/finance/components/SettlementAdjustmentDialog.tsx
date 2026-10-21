import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useAdjustSettlement } from '../hooks'
import { settlementAdjustmentFormSchema } from '../model'

/**
 * Điều chỉnh sau khi đóng lượt — UC-RS-15, BRD §18.2, AC-RS-012.
 * TODO(OQ: RentalSettlement-BRD.md §28 Q16 — Accountant = `TBD`, xem `permissions.ts`).
 */
export function SettlementAdjustmentDialog({
  settlementId,
  open,
  onOpenChange,
}: {
  settlementId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const adjust = useAdjustSettlement()
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDirection('INCREASE')
      setAmount('')
      setReason('')
      setEvidenceNote('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = settlementAdjustmentFormSchema.safeParse({ direction, amount, reason, evidenceNote: evidenceNote || undefined })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await adjust.mutateAsync({
        settlementId,
        input: { direction: result.data.direction, amount: Number(result.data.amount), reason: result.data.reason, evidenceNote: result.data.evidenceNote },
      })
      toast.success(vi.finance.adjustSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.adjustError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.adjustDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-status-pending text-sm">{vi.finance.adjustWarning}</p>
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.adjustDirectionLabel}</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as 'INCREASE' | 'DECREASE')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCREASE">{vi.finance.adjustDirectionIncrease}</SelectItem>
                <SelectItem value="DECREASE">{vi.finance.adjustDirectionDecrease}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-amount">{vi.finance.adjustAmountLabel} *</Label>
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
            <Label htmlFor="adj-reason">{vi.finance.adjustReasonLabel}</Label>
            <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adj-evidence">{vi.finance.adjustEvidenceLabel}</Label>
            <Textarea id="adj-evidence" rows={2} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={adjust.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
