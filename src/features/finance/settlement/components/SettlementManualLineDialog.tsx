import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useAddSettlementManualLine } from '../hooks'
import { settlementManualLineFormSchema } from '../model'

/** UC-RS-04, BRD §18.1, RS-BR-19 — thêm dòng `MANUAL` (khoản khác), lý do bắt buộc. */
export function SettlementManualLineDialog({
  settlementId,
  open,
  onOpenChange,
}: {
  settlementId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const addManualLine = useAddSettlementManualLine()
  const [direction, setDirection] = useState<'CHARGE' | 'DISCOUNT'>('CHARGE')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDirection('CHARGE')
      setAmount('')
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = settlementManualLineFormSchema.safeParse({ direction, amount, reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await addManualLine.mutateAsync({
        id: settlementId,
        input: { direction: result.data.direction, amount: Number(result.data.amount), reason: result.data.reason },
      })
      toast.success(vi.finance.addManualLineSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.addManualLineError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.manualLineDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.manualLineDirectionLabel}</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as 'CHARGE' | 'DISCOUNT')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CHARGE">{vi.finance.manualLineDirectionCharge}</SelectItem>
                <SelectItem value="DISCOUNT">{vi.finance.manualLineDirectionDiscount}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sml-amount">{vi.finance.manualLineAmountLabel} *</Label>
            <Input
              id="sml-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sml-reason">{vi.finance.manualLineReasonLabel}</Label>
            <Textarea id="sml-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={addManualLine.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
