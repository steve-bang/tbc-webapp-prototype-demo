import { useState } from 'react'
import { toast } from 'sonner'
import { SETTLEMENT_WAIVER_TYPES, type SettlementWaiverType } from '@/shared/domain/enums'
import { SETTLEMENT_LINE_CATEGORY_LABELS, SETTLEMENT_WAIVER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { useApplySettlementWaiver } from '../hooks'
import { WAIVER_APPROVAL_THRESHOLD, getLineDiscountedAmount, settlementWaiverFormSchema, waiverNeedsApproval } from '../model'
import type { SettlementLine, SettlementWaiver } from '../../core/types'

/**
 * UC-RS-05, BRD §12, RS-BR-07/08 — vượt `WAIVER_APPROVAL_THRESHOLD` →
 * `PENDING_APPROVAL`. Nợ 2 (N2, `docs/RENTAL-SETTLEMENT-PLAN.md` §10.7) —
 * `PARTIAL_DISCOUNT` hiện "Còn được giảm tối đa" và chặn vượt tổng trước khi gửi.
 */
export function SettlementWaiverDialog({
  settlementId,
  lines,
  waivers,
  open,
  onOpenChange,
}: {
  settlementId: string
  lines: SettlementLine[]
  waivers: SettlementWaiver[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const applyWaiver = useApplySettlementWaiver()
  const [type, setType] = useState<SettlementWaiverType>('GOODWILL_CREDIT')
  const [lineId, setLineId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setType('GOODWILL_CREDIT')
      setLineId('')
      setAmount('')
      setReason('')
      setError(null)
    }
  }

  const chargeLines = lines.filter((l) => l.direction === 'CHARGE' && l.status === 'CONFIRMED')
  const selectedLine = chargeLines.find((l) => l.id === lineId)
  // Blocker 1 (tech-lead review Phase 4.1 R1) — `WAIVE_LINE` luôn miễn nguyên
  // `actualAmount` của dòng, không nhận số tự do: ô nhập bị khoá, giá trị suy
  // từ dòng đang chọn.
  const isWaiveLine = type === 'WAIVE_LINE'
  const effectiveAmount = isWaiveLine && selectedLine ? String(selectedLine.actualAmount ?? 0) : amount
  const needsApproval = waiverNeedsApproval(Number(effectiveAmount) || 0)
  const alreadyDiscounted = type === 'PARTIAL_DISCOUNT' && lineId ? getLineDiscountedAmount(lineId, waivers) : 0
  const remainingForPartialDiscount = selectedLine ? Math.max(0, (selectedLine.actualAmount ?? 0) - alreadyDiscounted) : 0

  function handleLineChange(nextLineId: string) {
    setLineId(nextLineId)
    if (error) setError(null)
  }

  async function handleConfirm() {
    const result = settlementWaiverFormSchema.safeParse({ type, lineId: lineId || undefined, amount: effectiveAmount, reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '')
      return
    }
    if (type === 'PARTIAL_DISCOUNT' && selectedLine && Number(result.data.amount) > (selectedLine.actualAmount ?? 0)) {
      setError('Số tiền giảm không được vượt số thực tế của dòng')
      return
    }
    if (type === 'PARTIAL_DISCOUNT' && Number(result.data.amount) > remainingForPartialDiscount) {
      setError(`Tổng giảm một phần vượt số thực tế của dòng (còn được giảm tối đa ${remainingForPartialDiscount.toLocaleString('vi-VN')}đ)`)
      return
    }
    try {
      await applyWaiver.mutateAsync({
        id: settlementId,
        input: { type: result.data.type, lineId: result.data.lineId, amount: Number(result.data.amount), reason: result.data.reason },
      })
      toast.success(vi.finance.addWaiverSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.addWaiverError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.waiverDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{vi.finance.waiverTypeLabel}</Label>
            <Select value={type} onValueChange={(v) => setType(v as SettlementWaiverType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SETTLEMENT_WAIVER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SETTLEMENT_WAIVER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(type === 'WAIVE_LINE' || type === 'PARTIAL_DISCOUNT') && (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.finance.waiverLineLabel} *</Label>
              <Select value={lineId} onValueChange={handleLineChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chargeLines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {SETTLEMENT_LINE_CATEGORY_LABELS[l.category]} — {formatVnd(l.actualAmount ?? 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sw-amount">{vi.finance.waiverAmountLabel} *</Label>
            <Input
              id="sw-amount"
              inputMode="numeric"
              value={effectiveAmount}
              disabled={isWaiveLine}
              onChange={(e) => {
                if (isWaiveLine) return
                setAmount(e.target.value)
                if (error) setError(null)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sw-reason">{vi.finance.waiverReasonLabel}</Label>
            <Textarea id="sw-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {type === 'PARTIAL_DISCOUNT' && selectedLine && (
            <p className="text-muted-foreground text-sm">{vi.finance.waiverRemainingPartialDiscountNote.replace('{amount}', remainingForPartialDiscount.toLocaleString('vi-VN'))}</p>
          )}
          {needsApproval && (
            <p className="text-status-pending text-sm">
              {vi.finance.waiverNeedsApprovalNotice} ({'>'} {WAIVER_APPROVAL_THRESHOLD.toLocaleString('vi-VN')}đ)
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={applyWaiver.isPending} onClick={handleConfirm}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
