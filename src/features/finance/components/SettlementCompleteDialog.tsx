import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useCompleteSettlement, usePaymentRequests, useTransactions } from '../hooks'
import { calcSettlementCollectOutstanding, getCompletionBlockers, type Settlement, type SettlementBlockerCode } from '../model'

/** UC-RS-13, BRD §16, RS-BR-06/12/20, AC-RS-009/010 — liệt kê điều kiện chưa thoả (AC-RS-009). */
// Chỉ lấy khoá `vi.finance` có giá trị là chuỗi (bỏ các object lồng `payment`/`receivables`/`revenueCost`/`reports`…) — thêm namespace mới không phải sửa lại.
type FinanceStringKey = { [K in keyof typeof vi.finance]: (typeof vi.finance)[K] extends string ? K : never }[keyof typeof vi.finance]
const BLOCKER_LABELS: Record<SettlementBlockerCode, FinanceStringKey> = {
  DRAFT_LINES: 'blockerDraftLines',
  DISPUTED_LINES: 'blockerDisputedLines',
  DEPOSIT_NOT_RECONCILED: 'blockerDepositNotReconciled',
  DEPOSIT_OUTDATED: 'blockerDepositOutdated',
  STATUS_NOT_CONFIRMED: 'blockerStatusNotConfirmed',
  CUSTOMER_ACK_MISSING: 'blockerCustomerAckMissing',
  WAIVER_PENDING: 'blockerWaiverPending',
  BALANCE_DUE_NO_COLLECT_REQUEST: 'blockerBalanceDueNoCollectRequest',
  REFUNDABLE_NO_REFUND_REQUEST: 'blockerRefundableNoRefundRequest',
  OVERPAYMENT_NO_REFUND_REQUEST: 'blockerOverpaymentNoRefundRequest',
} as const

export function SettlementCompleteDialog({
  settlement,
  open,
  onOpenChange,
}: {
  settlement: Settlement | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const completeSettlement = useCompleteSettlement()
  // Hook gọi TRƯỚC `return null`. Khi đang tải coi như chưa thu đồng nào (cảnh báo thận trọng).
  const paymentRequests = usePaymentRequests({ rentalId: settlement?.rentalId })
  const transactions = useTransactions({ rentalId: settlement?.rentalId })
  if (!settlement) return null
  const blockers = getCompletionBlockers(settlement)
  // RentalSettlement-BRD.md §15 / EX-02 — cùng hàm với `completeSettlement()` ở api: còn phải thu trên yêu cầu thu = đóng kèm công nợ.
  const outstanding = calcSettlementCollectOutstanding(settlement, paymentRequests.data ?? [], transactions.data ?? [])

  async function handleConfirm() {
    try {
      await completeSettlement.mutateAsync(settlement!.id)
      toast.success(vi.finance.completeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.completeError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.completeDialogTitle}</DialogTitle>
        </DialogHeader>
        {blockers.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{vi.finance.completeBlockersTitle}</p>
            <ul className="list-inside list-disc text-sm">
              {blockers.map((code) => (
                <li key={code}>{vi.finance[BLOCKER_LABELS[code]]}</li>
              ))}
            </ul>
          </div>
        ) : (
          outstanding > 0 && <p className="text-status-pending text-sm">{vi.finance.completeWithDebtWarning}</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={blockers.length > 0 || completeSettlement.isPending} onClick={handleConfirm}>
            {vi.finance.completeButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
