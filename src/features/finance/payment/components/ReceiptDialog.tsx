import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useIssueReceipt } from '../hooks'
import type { Transaction } from '../../core/types'

/**
 * BRD §18/AC-PM-014 — Biên lai dạng dialog, không có route riêng. Giao dịch
 * `CONFIRMED` chưa có biên lai → nút Xuất biên lai; đã có → chỉ xem.
 * Không xuất PDF/link chia sẻ (ngoài phạm vi — `docs/PAYMENT-PLAN.md` §1.4).
 */
export function ReceiptDialog({
  transaction,
  customerName,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  customerName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  const issue = useIssueReceipt()

  async function handleIssue() {
    if (!transaction) return
    try {
      await issue.mutateAsync(transaction.id)
      toast.success(vi.finance.payment.issueReceiptSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.issueReceiptError)
    }
  }

  const receipt = transaction?.receipt

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.receiptDialogTitle}</DialogTitle>
        </DialogHeader>
        {transaction && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-center text-base font-semibold">{vi.finance.payment.receiptCompanyPlaceholder}</p>
            {receipt ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.payment.receiptNo}</span>
                  <span className="font-mono font-medium">
                    {receipt.receiptNo}
                    {/* PM-BR-19 — nhãn vô hiệu cạnh số biên lai, không chỉ dựa vào badge dưới (tech-lead review Phase 4.2 R1 Blocker a). */}
                    {receipt.voided && <span className="text-destructive ml-2 font-sans text-xs font-normal">({vi.finance.payment.receiptVoidedBadge})</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.payment.receiptIssuedAt}</span>
                  <span>{formatDateTime(receipt.issuedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.payment.receiptIssuedBy}</span>
                  <span>{receipt.issuedByName}</span>
                </div>
                {receipt.voided && <Badge variant="destructive">{vi.finance.payment.receiptVoidedBadge}</Badge>}
              </>
            ) : (
              <p className="text-muted-foreground">{vi.finance.payment.detailNoReceipt}</p>
            )}
            <div className="border-border flex flex-col gap-1.5 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {transaction.type === 'OWNER_PAYOUT' ? vi.finance.ownerPayout.partyOwner : vi.finance.payment.receiptCustomer}
                </span>
                <span>{customerName ?? transaction.customerId ?? transaction.vehicleOwnerId ?? '—'}</span>
              </div>
              {transaction.payoutRecipient && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.ownerPayout.detailRecipient}</span>
                  <span>{transaction.payoutRecipient}</span>
                </div>
              )}
              {transaction.rentalId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.payment.receiptRental}</span>
                  <span className="font-mono">{transaction.rentalId}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.receiptType}</span>
                <span>{TRANSACTION_TYPE_LABELS[transaction.type]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.receiptAmount}</span>
                <span className="font-medium">{formatVnd(transaction.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.receiptMethod}</span>
                <span>{PAYMENT_METHOD_LABELS[transaction.method]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.receiptPerformedBy}</span>
                <span>{transaction.performedByName}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-center text-xs">{vi.finance.payment.receiptPreviewNote}</p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.close}
          </Button>
          {transaction && !receipt && can('PAYMENT', 'EXPORT') && transaction.status === 'CONFIRMED' && (
            <Button type="button" disabled={issue.isPending} onClick={handleIssue}>
              {vi.finance.payment.actionIssueReceipt}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
