import { useState } from 'react'
import { toast } from 'sonner'
import { SETTLEMENT_LINE_CATEGORY_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useRecordSettlementCustomerAck } from '../hooks'
import { settlementCustomerAckFormSchema, type SettlementLine } from '../model'

/** UC-RS-08, BRD §13 — khách đồng ý toàn bộ, hoặc chọn dòng không đồng ý + ghi chú. */
export function SettlementCustomerAckDialog({
  settlementId,
  lines,
  open,
  onOpenChange,
}: {
  settlementId: string
  lines: SettlementLine[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const recordAck = useRecordSettlementCustomerAck()
  const [outcome, setOutcome] = useState<'ALL_AGREE' | 'SOME_DISAGREE'>('ALL_AGREE')
  const [disagreeLineIds, setDisagreeLineIds] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setOutcome('ALL_AGREE')
      setDisagreeLineIds([])
      setNote('')
      setError(null)
    }
  }

  const confirmedLines = lines.filter((l) => l.status === 'CONFIRMED')

  function toggleLine(id: string, checked: boolean) {
    setDisagreeLineIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  async function handleConfirm() {
    const result = settlementCustomerAckFormSchema.safeParse({ outcome, disagreeLineIds, note })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await recordAck.mutateAsync({
        id: settlementId,
        input: { disputedLineIds: result.data.outcome === 'SOME_DISAGREE' ? result.data.disagreeLineIds ?? [] : [], note: result.data.note || undefined },
      })
      toast.success(vi.finance.customerAckSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.customerAckError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.customerAckDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={outcome === 'ALL_AGREE' ? 'default' : 'outline'} onClick={() => setOutcome('ALL_AGREE')}>
              {vi.finance.customerAckAllAgree}
            </Button>
            <Button type="button" size="sm" variant={outcome === 'SOME_DISAGREE' ? 'default' : 'outline'} onClick={() => setOutcome('SOME_DISAGREE')}>
              {vi.finance.customerAckSomeDisagree}
            </Button>
          </div>
          {outcome === 'SOME_DISAGREE' && (
            <div className="flex flex-col gap-2">
              {confirmedLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`ack-${line.id}`}
                    checked={disagreeLineIds.includes(line.id)}
                    onCheckedChange={(checked) => toggleLine(line.id, checked === true)}
                  />
                  <Label htmlFor={`ack-${line.id}`} className="font-normal">
                    {SETTLEMENT_LINE_CATEGORY_LABELS[line.category]}
                  </Label>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ack-note">{vi.finance.customerAckNoteLabel}</Label>
            <Textarea id="ack-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={recordAck.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
