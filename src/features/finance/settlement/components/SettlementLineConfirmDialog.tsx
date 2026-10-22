import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useConfirmSettlementLine } from '../hooks'
import { settlementConfirmLineFormSchema } from '../model'
import type { SettlementLine } from '../../core/types'

/** UC-RS-03, RS-BR-05/27, AC-RS-002/003/015 — dòng `INCIDENT` khoá số (chỉ xem, không sửa được). */
export function SettlementLineConfirmDialog({
  settlementId,
  line,
  open,
  onOpenChange,
}: {
  settlementId: string
  line: SettlementLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const confirmLine = useConfirmSettlementLine()
  const isLocked = line?.source === 'INCIDENT'
  const [actualAmount, setActualAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && line) {
      setActualAmount(String(line.actualAmount ?? line.estimatedAmount ?? 0))
      setNote(line.note ?? '')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = settlementConfirmLineFormSchema.safeParse({ actualAmount, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    if (!line) return
    try {
      await confirmLine.mutateAsync({
        id: settlementId,
        lineId: line.id,
        input: { actualAmount: Number(result.data.actualAmount), note: result.data.note || undefined },
      })
      toast.success(vi.finance.confirmLineSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.confirmLineError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.confirmLineDialogTitle}</DialogTitle>
          {line?.estimatedAmount !== undefined && <DialogDescription>Ước tính: {formatVnd(line.estimatedAmount)}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sl-actualAmount">{vi.finance.actualAmountLabel} *</Label>
            <Input
              id="sl-actualAmount"
              inputMode="numeric"
              disabled={isLocked}
              value={actualAmount}
              onChange={(e) => {
                setActualAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sl-note">{vi.finance.noteLabel}</Label>
            <Textarea id="sl-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={confirmLine.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
