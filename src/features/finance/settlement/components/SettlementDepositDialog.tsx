import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useReconcileSettlementDeposit } from '../hooks'
import { calcDepositReconciliation } from '../model'
import { calcSettlementTotals } from '../../core/model'
import type { Settlement } from '../../core/types'

/**
 * UC-RS-06, RS-BR-09/22, AC-RS-004/005 — xem công thức đề xuất rồi bấm chốt.
 * TODO(OQ: RentalSettlement-BRD.md §28 Q1 — đối trừ tự động hay cần khách
 * đồng ý; demo: hệ thống đề xuất, Accountant bấm chốt, khách xác nhận cả gói
 * ở bước `PENDING_CUSTOMER`.)
 */
export function SettlementDepositDialog({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: Settlement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const reconcileDeposit = useReconcileSettlementDeposit()
  if (!settlement) return null

  const totals = calcSettlementTotals(settlement.lines, settlement.waivers)
  const paidToDate = settlement.paidToDate.prepayment + settlement.paidToDate.handoverPayment
  const preview = calcDepositReconciliation(totals.finalAmount, paidToDate, settlement.depositHeld)

  async function handleConfirm() {
    try {
      await reconcileDeposit.mutateAsync(settlement!.id)
      toast.success(vi.finance.reconcileDepositSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.reconcileDepositError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.reconcileDepositDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <Row label={vi.finance.finalAmount} value={formatVnd(preview.finalAmount)} />
          <Row label={vi.finance.paidToDate} value={formatVnd(preview.paidToDate)} />
          <Row label={vi.finance.depositHeld} value={formatVnd(preview.depositHeld)} />
          <Row label={vi.finance.depositApplied} value={formatVnd(preview.depositApplied)} />
          <Row label={vi.finance.balanceDue} value={formatVnd(preview.balanceDue)} />
          <Row label={vi.finance.depositRefundable} value={formatVnd(preview.depositRefundable)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={reconcileDeposit.isPending} onClick={handleConfirm}>
            {vi.finance.reconcileDepositButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
