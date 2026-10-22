import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useReverseCostRecord } from '../hooks'
import { costRecordReverseFormSchema, type CostRecord } from '../model'

/**
 * RV-BR-10, BRD §25.4 — "xoá" chi phí nhập tay là huỷ mềm (không xoá vật lý), lý do bắt buộc.
 * Validate qua `costRecordReverseFormSchema.safeParse()`.
 */
export function CostRecordReverseDialog({ record, open, onOpenChange }: { record: CostRecord | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const reverse = useReverseCostRecord()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    if (!record) return
    const result = costRecordReverseFormSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    try {
      await reverse.mutateAsync({ id: record.id, reason: result.data.reason })
      toast.success(vi.finance.revenueCost.reverseSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.revenueCost.reverseError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.revenueCost.reverseTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {record && (
            <p className="text-sm font-medium">
              {record.code} — {formatVnd(record.amount)}
            </p>
          )}
          <p className="text-destructive text-sm">{vi.finance.revenueCost.reverseWarning}</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost-reverse-reason">{vi.finance.revenueCost.reverseReasonLabel} *</Label>
            <Textarea
              id="cost-reverse-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
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
          <Button type="button" variant="destructive" disabled={reverse.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
