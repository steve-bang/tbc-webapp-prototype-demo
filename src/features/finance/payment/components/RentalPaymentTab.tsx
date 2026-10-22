import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
// `customers` chưa export `useCustomers` qua barrel — deep-import thẳng
// `hooks.ts`, cùng tiền lệ `TransactionLedgerScreen`/`CashDrawerScreen` (§10.9 — góp ý R1-#2).
import { useCustomers } from '@/features/customers/hooks'
import { useHandoverRecords } from '@/features/handover-return'
import { useIncidents } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import { PAYMENT_METHOD_LABELS, PAYMENT_MILESTONE_LABELS, SETTLEMENT_PAYMENT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { PaymentRequestStatusBadge } from './PaymentRequestStatusBadge'
import { PaymentScheduleCreateDialog } from './PaymentScheduleCreateDialog'
import { RefundCreateDialog } from './RefundCreateDialog'
import { TransactionDetailSheet } from './TransactionDetailSheet'
import { TransactionRecordDialog } from './TransactionRecordDialog'
import { TransactionStatusBadge } from './TransactionStatusBadge'
import { usePaymentRequests, useTransactions } from '../hooks'
import { usePostSettlementCharges, useSettlementByRental } from '../../core/hooks'
import {
  buildPaymentSchedule,
  calcRequestProgress,
  canScheduleRental,
  deriveRentalPaymentSummary,
  isRequestActionable,
  summarizePscPayments,
} from '../model'
import { isPscOnHold } from '../../core/model'
import type { PaymentRequest } from '../../core/types'

/**
 * Tab "Thanh toán" (Rental Detail) — `docs/PAYMENT-PLAN.md` §7.2/§10.9. Tóm tắt
 * + lịch 3 mốc (mốc `RETURN` lấy yêu cầu `source = SETTLEMENT`, Round 2) +
 * khối "Phát sinh sau quyết toán" + đối chiếu biên bản giao xe (chỉ cảnh báo,
 * không chặn) + danh sách giao dịch của lượt thuê.
 */
export function RentalPaymentTab({ rental }: { rental: Rental }) {
  const { can } = usePermission()
  const { data: requests = [] } = usePaymentRequests({ rentalId: rental.id })
  const { data: txns = [] } = useTransactions({ rentalId: rental.id })
  const { data: settlement } = useSettlementByRental(rental.id)
  const { data: handovers = [] } = useHandoverRecords({ rentalId: rental.id })
  const { data: incidents = [] } = useIncidents({ rentalId: rental.id })
  const { data: pscs = [] } = usePostSettlementCharges({ rentalId: rental.id })
  const { data: customers = [] } = useCustomers()
  const customerName = customers.find((c) => c.id === rental.customerId)?.fullName

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [recordRequest, setRecordRequest] = useState<PaymentRequest | null>(null)
  const [refundRequest, setRefundRequest] = useState<PaymentRequest | null>(null)
  // Lưu id, không lưu object `Transaction` — resolve lại từ `txns` (đã tự cập
  // nhật qua invalidate sau mutation) để sheet không hiện trạng thái cũ sau
  // Xác nhận/Đảo/Huỷ (tech-lead review Phase 4.2 R1 Blocker b).
  const [detailTxnId, setDetailTxnId] = useState<string | null>(null)
  const detailTxn = detailTxnId ? txns.find((t) => t.id === detailTxnId) ?? null : null

  const summary = deriveRentalPaymentSummary(rental, requests, txns, settlement)
  const schedule = buildPaymentSchedule(rental, requests, txns)
  const hasSchedule = requests.some((r) => r.source === 'BOOKING' || r.source === 'HANDOVER')
  const canCreate = can('PAYMENT', 'CREATE')
  const pscPayments = summarizePscPayments(pscs, requests, txns)

  const handover = handovers.find((h) => h.status === 'COMPLETED')
  const bookingDone = schedule.find((m) => m.milestone === 'BOOKING')?.state === 'DONE'
  const handoverDone = schedule.find((m) => m.milestone === 'HANDOVER')?.state === 'DONE'
  // PM-BR-21 — chặn giao xe theo mốc thuộc VH/App nhân viên; Webapp chỉ cảnh báo lệch.
  const reconcileMismatch = !!handover && ((handover.prepaymentConfirmed && !bookingDone) || (handover.fullPaymentConfirmed && !handoverDone))

  function ctxFor(request: PaymentRequest) {
    if (request.source !== 'POST_SETTLEMENT_CHARGE') return { settlementStatus: settlement?.status }
    const psc = pscs.find((p) => p.id === request.postSettlementChargeId)
    return { psc, pscOnHold: psc ? isPscOnHold(psc, incidents) : false }
  }

  function requestLabel(request: PaymentRequest): string {
    switch (request.transactionType) {
      case 'DEPOSIT':
        return vi.finance.payment.milestoneRequestDeposit
      case 'ADDITIONAL_CHARGE':
        return vi.finance.payment.milestoneRequestCollect
      case 'DEPOSIT_REFUND':
        return vi.finance.payment.milestoneRequestDepositRefund
      case 'OVERPAYMENT_REFUND':
        return vi.finance.payment.milestoneRequestOverpaymentRefund
      case 'POST_SETTLEMENT_COLLECT':
        return vi.finance.payment.milestoneRequestPscReceivable
      case 'GOODWILL_REFUND':
        return vi.finance.payment.milestoneRequestPscRefund
      default:
        return vi.finance.payment.milestoneRequestRental
    }
  }

  function renderRequestActions(request: PaymentRequest) {
    const actionable = isRequestActionable(request, rental, ctxFor(request))
    if (!actionable || !canCreate) return null
    if (request.purpose === 'REFUND') {
      return (
        <Button size="sm" variant="outline" onClick={() => setRefundRequest(request)}>
          {vi.finance.payment.recordRefundButton}
        </Button>
      )
    }
    return (
      <Button size="sm" variant="outline" onClick={() => setRecordRequest(request)}>
        {vi.finance.payment.recordButton}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <h3 className="text-sm font-semibold">{vi.finance.payment.summaryTitle}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryItem
              label={vi.finance.payment.totalPayable}
              value={formatVnd(summary.totalPayable)}
              note={summary.totalPayableIsEstimate ? vi.finance.payment.totalPayableEstimatedNote : undefined}
            />
            <SummaryItem label={vi.finance.payment.paidToDate} value={formatVnd(summary.paidToDate)} />
            <SummaryItem label={vi.finance.payment.balanceDue} value={formatVnd(summary.balanceDue)} />
            <SummaryItem label={vi.finance.payment.depositHeld} value={formatVnd(summary.depositHeld)} />
            <SummaryItem label={vi.finance.payment.refunded} value={formatVnd(summary.refunded)} />
            {summary.pendingRefund > 0 && <SummaryItem label={vi.finance.payment.pendingRefundLabel} value={formatVnd(summary.pendingRefund)} />}
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{vi.finance.payment.paymentStatusLabel}</span>
              <Badge variant="outline">{SETTLEMENT_PAYMENT_STATUS_LABELS[summary.paymentStatus]}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {reconcileMismatch && (
        <div className="border-status-pending bg-status-pending/10 rounded-md border p-3 text-sm">
          {vi.finance.payment.reconcileBannerTitle}
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <h3 className="text-sm font-semibold">{vi.finance.payment.scheduleTitle}</h3>
          {!hasSchedule && !canScheduleRental(rental) && (
            <p className="text-muted-foreground text-sm">{vi.finance.payment.scheduleDraftNote}</p>
          )}
          {!hasSchedule && canScheduleRental(rental) && (
            <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-sm">{vi.finance.payment.scheduleEmptyNote}</p>
              {canCreate && (
                <Button size="sm" onClick={() => setScheduleOpen(true)}>
                  {vi.finance.payment.scheduleButton}
                </Button>
              )}
            </div>
          )}
          {hasSchedule &&
            schedule.map((milestone) => (
              <div key={milestone.milestone} className="border-border flex flex-col gap-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{PAYMENT_MILESTONE_LABELS[milestone.milestone]}</span>
                  {milestone.state === 'BY_SETTLEMENT' ? (
                    <Link to={`${paths.rentalDetail(rental.id)}?tab=settlement`} className="text-primary text-xs underline underline-offset-2">
                      {vi.finance.payment.milestoneReturnNote} — {vi.finance.payment.milestoneReturnLink}
                    </Link>
                  ) : milestone.milestone !== 'RETURN' ? (
                    <span className="text-muted-foreground text-xs">
                      {vi.finance.payment.milestoneExpected}: {formatVnd(milestone.expectedTotal)} · {vi.finance.payment.milestoneCollected}: {formatVnd(milestone.collectedTotal)}
                      {milestone.pendingTotal > 0 && ` · ${vi.finance.payment.milestonePending}: ${formatVnd(milestone.pendingTotal)}`}
                    </span>
                  ) : null}
                </div>
                {milestone.motorbikeCollateral && <p className="text-muted-foreground text-xs">{vi.finance.payment.motorbikeCollateralNote}</p>}
                {milestone.requests.map((request) => {
                  const progress = milestone.milestone === 'RETURN' ? calcRequestProgress(request, txns) : undefined
                  return (
                    <div key={request.id} className="flex flex-col gap-1 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={request.status === 'CANCELLED' ? 'text-muted-foreground line-through' : undefined}>
                          {requestLabel(request)} — {formatVnd(request.expectedAmount)}
                        </span>
                        <div className="flex items-center gap-2">
                          <PaymentRequestStatusBadge status={request.status} />
                          {renderRequestActions(request)}
                        </div>
                      </div>
                      {progress && (
                        <span className="text-muted-foreground text-xs">
                          {vi.finance.payment.milestoneCollected}: {formatVnd(progress.collected)}
                          {progress.pending > 0 && ` · ${vi.finance.payment.milestonePending}: ${formatVnd(progress.pending)}`}
                          {' · '}
                          {vi.finance.payment.milestoneRemaining}: {formatVnd(progress.remaining)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
        </CardContent>
      </Card>

      {pscs.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <h3 className="text-sm font-semibold">{vi.finance.payment.pscSectionTitle}</h3>
            {pscPayments.items.map(({ psc, request, done }) => {
              const onHold = isPscOnHold(psc, incidents)
              const reversedWarning = psc.status === 'CLOSED' && request && request.status !== 'FULFILLED'
              return (
                <div key={psc.id} className="border-border flex flex-col gap-1 rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {TRANSACTION_TYPE_LABELS[request?.transactionType ?? (psc.type === 'RECEIVABLE' ? 'POST_SETTLEMENT_COLLECT' : 'GOODWILL_REFUND')]} —{' '}
                      {formatVnd(psc.amount)}
                    </span>
                    <div className="flex items-center gap-2">
                      {request && <PaymentRequestStatusBadge status={request.status} />}
                      {onHold && <Badge variant="destructive">{vi.finance.pscOnHoldBadge}</Badge>}
                      {request && renderRequestActions(request)}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {vi.finance.payment.milestoneCollected}: {formatVnd(done)}
                  </span>
                  {reversedWarning && <span className="text-status-error text-xs">{vi.finance.payment.pscReversedWarning}</span>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <h3 className="text-sm font-semibold">{vi.finance.payment.transactionsTitle}</h3>
          {txns.length === 0 ? (
            <p className="text-muted-foreground text-sm">{vi.finance.payment.transactionsEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.finance.payment.ledgerColumnCode}</TableHead>
                    <TableHead>{vi.finance.payment.ledgerColumnPerformedAt}</TableHead>
                    <TableHead>{vi.finance.payment.ledgerColumnAmount}</TableHead>
                    <TableHead>{vi.finance.payment.ledgerColumnMethod}</TableHead>
                    <TableHead>{vi.finance.payment.ledgerColumnStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetailTxnId(t.id)}>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell>{formatDateTime(t.performedAt)}</TableCell>
                      <TableCell>{formatVnd(t.amount)}</TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[t.method]}</TableCell>
                      <TableCell>
                        <TransactionStatusBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentScheduleCreateDialog rental={rental} open={scheduleOpen} onOpenChange={setScheduleOpen} />
      <TransactionRecordDialog rental={rental} request={recordRequest ?? undefined} open={!!recordRequest} onOpenChange={(o) => !o && setRecordRequest(null)} />
      <RefundCreateDialog request={refundRequest} open={!!refundRequest} onOpenChange={(o) => !o && setRefundRequest(null)} />
      <TransactionDetailSheet transaction={detailTxn} allTransactions={txns} customerName={customerName} open={!!detailTxnId} onOpenChange={(o) => !o && setDetailTxnId(null)} />
    </div>
  )
}

function SummaryItem({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium">
        {value}
        {note && <span className="text-muted-foreground ml-1 text-xs">{note}</span>}
      </span>
    </div>
  )
}
