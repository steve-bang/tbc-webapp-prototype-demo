import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { PAYMENT_METHOD_LABELS, REFUND_APPROVAL_STATUS_LABELS, TRANSACTION_DIRECTION_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { ReceiptDialog } from './ReceiptDialog'
import { RefundApprovalDialog } from './RefundApprovalDialog'
import { TransactionConfirmDialog } from './TransactionConfirmDialog'
import { TransactionReasonDialog, type TransactionReasonMode } from './TransactionReasonDialog'
import { TransactionStatusBadge } from './TransactionStatusBadge'
import type { Transaction } from '../../core/types'

/** `docs/PAYMENT-PLAN.md` §7.1/§7.6/§10.9 — chi tiết giao dịch + mọi hành động hợp lệ theo trạng thái × quyền. */
export function TransactionDetailSheet({
  transaction,
  allTransactions,
  customerName,
  partyName,
  outsideFilter,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  allTransactions: Transaction[]
  customerName?: string
  /** Tên đối tượng của giao dịch (khách hàng hoặc chủ xe); mặc định rơi về `customerName`. */
  partyName?: string
  /** §10.9 góp ý R1-#1 — giao dịch đang mở không còn khớp bộ lọc hiện tại (chỉ ghi chú, không đổi cơ chế resolve). */
  outsideFilter?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reasonMode, setReasonMode] = useState<TransactionReasonMode | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [refundDecision, setRefundDecision] = useState<'APPROVED' | 'REJECTED' | null>(null)

  if (!transaction) return null

  const isOwnerPayout = transaction.type === 'OWNER_PAYOUT'
  const party = partyName ?? customerName

  const reversalPair = transaction.reversedById ? allTransactions.find((t) => t.id === transaction.reversedById) : undefined
  const reversalOf = transaction.reversalOfId ? allTransactions.find((t) => t.id === transaction.reversalOfId) : undefined

  // Round 2 (§10.9) — Xác nhận/Thất bại mở rộng cho GD `OUT` (hoàn tiền), không chỉ CK/ví;
  // không cho xác nhận khi còn vướng duyệt (`approval` tồn tại và chưa `APPROVED`).
  const approvalBlocksConfirm = !!transaction.approval && transaction.approval.status !== 'APPROVED'
  const canConfirmFail =
    transaction.status === 'PENDING' &&
    (transaction.method === 'BANK_TRANSFER' || transaction.method === 'E_WALLET' || transaction.direction === 'OUT') &&
    !approvalBlocksConfirm &&
    can('PAYMENT', 'CONFIRM')
  const canVoid = transaction.status === 'PENDING' && can('PAYMENT', 'VOID')
  const canReverse = transaction.status === 'CONFIRMED' && !transaction.reversalOfId && !transaction.reversedById && transaction.method !== 'OFFSET' && can('PAYMENT', 'REVERSE')
  const canDecideRefund = transaction.status === 'PENDING' && transaction.approval?.status === 'PENDING_APPROVAL' && can('PAYMENT', 'APPROVE')
  // PM-BR-19 — xem lại biên lai hợp lệ bất kể trạng thái giao dịch hiện tại
  // (kể cả `REVERSED`, biên lai cũ vẫn phải xem được, chỉ đổi dấu "Đã vô hiệu");
  // xuất biên lai MỚI chỉ khi giao dịch đang `CONFIRMED` và chưa có biên lai
  // (`docs/PAYMENT-PLAN.md` §7.6, tech-lead review Phase 4.2 R1 Blocker a).
  const canViewReceipt = can('PAYMENT', 'EXPORT') && !!transaction.receipt
  const canIssueNewReceipt = can('PAYMENT', 'EXPORT') && transaction.status === 'CONFIRMED' && !transaction.receipt
  const canOpenReceiptDialog = canViewReceipt || canIssueNewReceipt

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {vi.finance.payment.detailTitle} — {transaction.code}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-4 text-sm">
            {outsideFilter && <p className="text-muted-foreground text-xs italic">{vi.finance.payment.ledgerOutsideFilterNote}</p>}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.common.status}</span>
              <TransactionStatusBadge status={transaction.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnType}</span>
              <span>{TRANSACTION_TYPE_LABELS[transaction.type]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnDirection}</span>
              <span>{TRANSACTION_DIRECTION_LABELS[transaction.direction]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnAmount}</span>
              <span className="font-medium">{formatVnd(transaction.amount)}</span>
            </div>
            {transaction.originalAmount !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailOriginalAmount}</span>
                <span>{formatVnd(transaction.originalAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnMethod}</span>
              <span>{PAYMENT_METHOD_LABELS[transaction.method]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{isOwnerPayout ? vi.finance.ownerPayout.partyOwner : vi.finance.payment.ledgerColumnCustomer}</span>
              {isOwnerPayout && transaction.vehicleOwnerId ? (
                <Link to={paths.consignmentOwnerDetail(transaction.vehicleOwnerId)} className="text-primary min-w-0 truncate underline underline-offset-2">
                  {party ?? transaction.vehicleOwnerId}
                </Link>
              ) : (
                <span className="min-w-0 truncate">{party ?? transaction.customerId ?? '—'}</span>
              )}
            </div>
            {isOwnerPayout && transaction.payoutRecipient && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.ownerPayout.detailRecipient}</span>
                <span>{transaction.payoutRecipient}</span>
              </div>
            )}
            {isOwnerPayout && transaction.ownerPayoutRecordId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.ownerPayout.detailRecord}</span>
                <Link to={`${paths.consignmentPayouts}?record=${transaction.ownerPayoutRecordId}`} className="text-primary font-mono text-xs underline underline-offset-2">
                  {transaction.ownerPayoutRecordId}
                </Link>
              </div>
            )}
            {transaction.rentalId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnRental}</span>
                <Link to={`${paths.rentalDetail(transaction.rentalId)}?tab=payment`} className="text-primary font-mono underline underline-offset-2">
                  {transaction.rentalId}
                </Link>
              </div>
            )}
            {transaction.paymentRequestId && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailPaymentRequest}</span>
                <span className="font-mono text-xs">{transaction.paymentRequestId}</span>
              </div>
            )}
            {transaction.reference && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailReference}</span>
                <span>{transaction.reference}</span>
              </div>
            )}
            {transaction.refundRecipient && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.payment.detailRefundRecipient}</span>
                <span>{transaction.refundRecipient}</span>
              </div>
            )}
            {transaction.approval && (
              <div className="border-border flex flex-col gap-1 rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{vi.finance.payment.detailApprovalStatus}</span>
                  <span>{REFUND_APPROVAL_STATUS_LABELS[transaction.approval.status]}</span>
                </div>
                {transaction.approval.decidedByName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{vi.finance.payment.detailApprovalDecidedBy}</span>
                    <span>
                      {transaction.approval.decidedByName}
                      {transaction.approval.decidedAt && ` — ${formatDateTime(transaction.approval.decidedAt)}`}
                    </span>
                  </div>
                )}
                {transaction.approval.note && <span className="text-muted-foreground text-xs">{transaction.approval.note}</span>}
              </div>
            )}
            {transaction.evidenceNote && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.payment.detailEvidence}</span>
                <span>{transaction.evidenceNote}</span>
              </div>
            )}
            {transaction.reason && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.payment.detailReason}</span>
                <span>{transaction.reason}</span>
              </div>
            )}
            {transaction.method === 'OFFSET' && (
              <div className="border-border bg-muted/30 flex flex-col gap-1 rounded-md border p-2 text-xs">
                <span>{vi.finance.payment.offsetNote}</span>
                {transaction.rentalId && (
                  <Link to={`${paths.rentalDetail(transaction.rentalId)}?tab=settlement`} className="text-primary underline underline-offset-2">
                    {vi.finance.payment.offsetViewSettlementLink}
                  </Link>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.detailPerformedBy}</span>
              <span>
                {transaction.performedByName} — {formatDateTime(transaction.performedAt)}
              </span>
            </div>
            {transaction.confirmedByName && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailConfirmedBy}</span>
                <span>
                  {transaction.confirmedByName} — {transaction.confirmedAt && formatDateTime(transaction.confirmedAt)}
                </span>
              </div>
            )}
            {transaction.failReason && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.payment.failDialogTitle}</span>
                <span>{transaction.failReason}</span>
              </div>
            )}
            {transaction.voidReason && (
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{vi.finance.payment.voidDialogTitle}</span>
                <span>
                  {transaction.voidReason} — {transaction.voidedByName}
                </span>
              </div>
            )}
            {reversalOf && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailReversalOf}</span>
                <span className="font-mono">{reversalOf.code}</span>
              </div>
            )}
            {reversalPair && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{vi.finance.payment.detailReversedBy}</span>
                <span className="font-mono">{reversalPair.code}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnReceipt}</span>
              <span>{transaction.receipt ? transaction.receipt.receiptNo : vi.finance.payment.detailNoReceipt}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {canDecideRefund && (
              <Button size="sm" onClick={() => setRefundDecision('APPROVED')}>
                {vi.finance.payment.actionApprove}
              </Button>
            )}
            {canDecideRefund && (
              <Button size="sm" variant="destructive" onClick={() => setRefundDecision('REJECTED')}>
                {vi.finance.payment.actionReject}
              </Button>
            )}
            {canConfirmFail && (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                {transaction.direction === 'OUT' ? vi.finance.payment.actionConfirmPaid : vi.finance.payment.actionConfirm}
              </Button>
            )}
            {canConfirmFail && (
              <Button size="sm" variant="outline" onClick={() => setReasonMode('fail')}>
                {vi.finance.payment.actionFail}
              </Button>
            )}
            {canVoid && (
              <Button size="sm" variant="outline" onClick={() => setReasonMode('void')}>
                {vi.finance.payment.actionVoid}
              </Button>
            )}
            {canReverse && (
              <Button size="sm" variant="destructive" onClick={() => setReasonMode('reverse')}>
                {vi.finance.payment.actionReverse}
              </Button>
            )}
            {canOpenReceiptDialog && (
              <Button size="sm" variant="outline" onClick={() => setReceiptOpen(true)}>
                {transaction.receipt ? vi.finance.payment.actionViewReceipt : vi.finance.payment.actionIssueReceipt}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <TransactionConfirmDialog transaction={confirmOpen ? transaction : null} open={confirmOpen} onOpenChange={setConfirmOpen} />
      <TransactionReasonDialog transaction={reasonMode ? transaction : null} mode={reasonMode ?? 'fail'} open={!!reasonMode} onOpenChange={(o) => !o && setReasonMode(null)} />
      <ReceiptDialog transaction={receiptOpen ? transaction : null} customerName={party} open={receiptOpen} onOpenChange={setReceiptOpen} />
      <RefundApprovalDialog
        transaction={refundDecision ? transaction : null}
        decision={refundDecision ?? 'APPROVED'}
        open={!!refundDecision}
        onOpenChange={(o) => !o && setRefundDecision(null)}
      />
    </>
  )
}
