import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { PAYMENT_METHOD_LABELS, TRANSACTION_DIRECTION_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { ReceiptDialog } from './ReceiptDialog'
import { TransactionConfirmDialog } from './TransactionConfirmDialog'
import { TransactionReasonDialog, type TransactionReasonMode } from './TransactionReasonDialog'
import { TransactionStatusBadge } from './TransactionStatusBadge'
import type { Transaction } from '../model'

/** `docs/PAYMENT-PLAN.md` §7.1/§7.6 — chi tiết giao dịch + mọi hành động hợp lệ theo trạng thái × quyền. */
export function TransactionDetailSheet({
  transaction,
  allTransactions,
  customerName,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null
  allTransactions: Transaction[]
  customerName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reasonMode, setReasonMode] = useState<TransactionReasonMode | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  if (!transaction) return null

  const reversalPair = transaction.reversedById ? allTransactions.find((t) => t.id === transaction.reversedById) : undefined
  const reversalOf = transaction.reversalOfId ? allTransactions.find((t) => t.id === transaction.reversalOfId) : undefined

  const canConfirmFail = transaction.status === 'PENDING' && (transaction.method === 'BANK_TRANSFER' || transaction.method === 'E_WALLET') && can('PAYMENT', 'CONFIRM')
  const canVoid = transaction.status === 'PENDING' && can('PAYMENT', 'VOID')
  const canReverse = transaction.status === 'CONFIRMED' && !transaction.reversalOfId && !transaction.reversedById && transaction.method !== 'OFFSET' && can('PAYMENT', 'REVERSE')
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
              <span className="text-muted-foreground">{vi.finance.payment.ledgerColumnCustomer}</span>
              <span className="min-w-0 truncate">{customerName ?? transaction.customerId}</span>
            </div>
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
            {canConfirmFail && (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                {vi.finance.payment.actionConfirm}
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
      <ReceiptDialog transaction={receiptOpen ? transaction : null} customerName={customerName} open={receiptOpen} onOpenChange={setReceiptOpen} />
    </>
  )
}
