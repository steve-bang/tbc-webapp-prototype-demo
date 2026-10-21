import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useResolveSettlementDispute } from '../hooks'
import { WAIVER_APPROVAL_THRESHOLD, settlementResolveDisputeFormSchema, waiverNeedsApproval, type SettlementLine } from '../model'

/**
 * UC-RS-17 — Giữ nguyên / Điều chỉnh số / Miễn (3/4 nhánh Round 1, xem §1.2 kế
 * hoạch). Nợ 3 (N3, `docs/RENTAL-SETTLEMENT-PLAN.md` §10.7, RS-BR-07/08) —
 * nhánh Miễn cũng phải qua ngưỡng duyệt: hiện ghi chú khi vượt ngưỡng.
 */
export function SettlementResolveDisputeDialog({
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
  const resolveDispute = useResolveSettlementDispute()
  const [resolution, setResolution] = useState<'KEEP' | 'ADJUST' | 'WAIVE'>('KEEP')
  const [actualAmount, setActualAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && line) {
      setResolution('KEEP')
      setActualAmount(String(line.actualAmount ?? line.estimatedAmount ?? 0))
      setReason('')
      setError(null)
    }
  }

  const waiveAmount = line?.actualAmount ?? line?.estimatedAmount ?? 0
  const waiveNeedsApproval = resolution === 'WAIVE' && waiverNeedsApproval(waiveAmount)

  async function handleConfirm() {
    const result = settlementResolveDisputeFormSchema.safeParse({ resolution, actualAmount, reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    if (!line) return
    try {
      await resolveDispute.mutateAsync({
        id: settlementId,
        lineId: line.id,
        input: { resolution: result.data.resolution, actualAmount: result.data.actualAmount ? Number(result.data.actualAmount) : undefined, reason: result.data.reason },
      })
      toast.success(vi.finance.resolveDisputeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.resolveDisputeError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.resolveDisputeDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Select value={resolution} onValueChange={(v) => setResolution(v as 'KEEP' | 'ADJUST' | 'WAIVE')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KEEP">{vi.finance.resolveDisputeKeep}</SelectItem>
                <SelectItem value="ADJUST">{vi.finance.resolveDisputeAdjust}</SelectItem>
                <SelectItem value="WAIVE">{vi.finance.resolveDisputeWaive}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {resolution === 'ADJUST' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="srd-amount">{vi.finance.actualAmountLabel} *</Label>
              <Input
                id="srd-amount"
                inputMode="numeric"
                value={actualAmount}
                onChange={(e) => {
                  setActualAmount(e.target.value)
                  if (error) setError(null)
                }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="srd-reason">{vi.finance.resolveDisputeReasonLabel} *</Label>
            <Textarea id="srd-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {waiveNeedsApproval && (
            <p className="text-status-pending text-sm">
              {vi.finance.resolveDisputeWaiveNeedsApprovalNotice} ({'>'} {WAIVER_APPROVAL_THRESHOLD.toLocaleString('vi-VN')}đ)
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={resolveDispute.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
