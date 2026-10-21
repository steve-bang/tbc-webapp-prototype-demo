import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
// `handover-return`/`incidents`/`rentals` — CHỈ qua barrel (RENTAL-SETTLEMENT-PLAN.md §0.2).
import { useHandoverRecords, useReturnRecords } from '@/features/handover-return'
import { useIncidents } from '@/features/incidents'
import { canOpenSettlement, useRental } from '@/features/rentals'
import type { SettlementRequestType } from '@/shared/domain/enums'
import {
  SETTLEMENT_LINE_CATEGORY_LABELS,
  SETTLEMENT_LINE_SOURCE_LABELS,
  SETTLEMENT_LINE_STATUS_LABELS,
  SETTLEMENT_PAYMENT_STATUS_LABELS,
  SETTLEMENT_REQUEST_TYPE_LABELS,
  SETTLEMENT_WAIVER_STATUS_LABELS,
  SETTLEMENT_WAIVER_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { listAuditRecords } from '@/shared/lib/audit'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { usePostSettlementCharges, useRemoveSettlementManualLine, useResyncSettlementSources, useSettlementByRental, useSubmitSettlementForCustomer } from '../hooks'
import { calcSettlementTotals, canReverseSettlement, countPendingReturnIncidentItems, isWorksheetEditable, type SettlementLine } from '../model'
import { SettlementApprovalDialog } from './SettlementApprovalDialog'
import { SettlementCompleteDialog } from './SettlementCompleteDialog'
import { SettlementCustomerAckDialog } from './SettlementCustomerAckDialog'
import { SettlementDepositDialog } from './SettlementDepositDialog'
import { SettlementDisputeDialog } from './SettlementDisputeDialog'
import { SettlementLineConfirmDialog } from './SettlementLineConfirmDialog'
import { SettlementManualLineDialog } from './SettlementManualLineDialog'
import { SettlementOpenDialog } from './SettlementOpenDialog'
import { SettlementPaymentRequestDialog } from './SettlementPaymentRequestDialog'
import { PostSettlementChargeSection } from './PostSettlementChargeSection'
import { SettlementResolveDisputeDialog } from './SettlementResolveDisputeDialog'
import { SettlementReverseDialog } from './SettlementReverseDialog'
import { SettlementReversalHistory } from './SettlementReversalHistory'
import { SettlementStatusBadge } from './SettlementStatusBadge'
import { SettlementWaiverDialog } from './SettlementWaiverDialog'

/**
 * Bảng quyết toán (Settlement Worksheet) — `docs/RENTAL-SETTLEMENT-PLAN.md`
 * §5.2, 8 khối: mở quyết toán · header (stepper/banner) · bảng dòng khoản mục ·
 * miễn giảm/thiện chí · tổng hợp · yêu cầu thanh toán · thanh hành động · lịch
 * sử thao tác. Khi `COMPLETED`: toàn bộ chỉ-đọc, số liệu lấy từ `completedTotals`
 * (RS-BR-12).
 */
export function SettlementWorksheet({ rentalId }: { rentalId: string }) {
  const { can } = usePermission()
  const canConfirmAction = can('SETTLEMENT', 'CONFIRM')
  const canApproveAction = can('SETTLEMENT', 'APPROVE')
  const canReverseAction = can('SETTLEMENT', 'REVERSE')

  const { data: rental, isLoading: loadingRental } = useRental(rentalId)
  const { data: settlement, isLoading: loadingSettlement } = useSettlementByRental(rentalId)
  const { data: returns = [] } = useReturnRecords({ rentalId })
  const { data: handovers = [] } = useHandoverRecords({ rentalId })
  const { data: incidents = [] } = useIncidents({ rentalId })
  const { data: pscs = [] } = usePostSettlementCharges({ settlementId: settlement?.id })

  const resync = useResyncSettlementSources()
  const submitForCustomer = useSubmitSettlementForCustomer()
  const removeManualLine = useRemoveSettlementManualLine()

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [confirmLineTarget, setConfirmLineTarget] = useState<SettlementLine | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<SettlementLine | null>(null)
  const [resolveDisputeTarget, setResolveDisputeTarget] = useState<SettlementLine | null>(null)
  const [manualLineOpen, setManualLineOpen] = useState(false)
  const [waiverOpen, setWaiverOpen] = useState(false)
  const [depositDialogOpen, setDepositDialogOpen] = useState(false)
  const [ackDialogOpen, setAckDialogOpen] = useState(false)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false)
  const [paymentRequestTarget, setPaymentRequestTarget] = useState<{ type: SettlementRequestType; amount: number } | null>(null)

  if (loadingRental || loadingSettlement) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }
  if (!rental) {
    return <p className="text-muted-foreground text-sm">{vi.rentals.notFound}</p>
  }

  if (!settlement) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        {!canOpenSettlement(rental) && <p className="max-w-md text-sm">{vi.finance.notReturnedYet}</p>}
        {canOpenSettlement(rental) && canConfirmAction && (
          <>
            <Button size="sm" onClick={() => setOpenDialogOpen(true)}>
              {vi.finance.openButton}
            </Button>
            <SettlementOpenDialog rentalId={rentalId} open={openDialogOpen} onOpenChange={setOpenDialogOpen} />
          </>
        )}
      </div>
    )
  }

  const settlementId = settlement.id
  const isEditable = isWorksheetEditable(settlement, rental)
  const returnRecord = returns.find((r) => r.status === 'COMPLETED')
  const hasHandoverCompleted = handovers.some((h) => h.status === 'COMPLETED')
  const sourceNotReady = settlement.lines.some((l) => !l.sourceReady)
  const sourceChanged = settlement.lines.some((l) => l.sourceChanged)
  const pendingIncidentItems = countPendingReturnIncidentItems(returnRecord, incidents)
  const returnCancelled = settlement.status !== 'COMPLETED' && rental.status !== 'SETTLEMENT'

  const totals = settlement.completedTotals ?? calcSettlementTotals(settlement.lines, settlement.waivers)
  const reconciliation = settlement.completedTotals ?? settlement.depositReconciliation
  const paidToDate = settlement.paidToDate.prepayment + settlement.paidToDate.handoverPayment

  // Nên sửa 8 (tech-lead review Phase 4.1 R1) — ẩn nút tạo yêu cầu khi đã có
  // yêu cầu cùng loại đang `REQUESTED` (khớp guard chặn trùng ở `api.ts`).
  const paymentRequests = settlement.paymentRequests
  function hasRequest(type: SettlementRequestType): boolean {
    return paymentRequests.some((r) => r.type === type && r.status === 'REQUESTED')
  }

  const auditRecords = listAuditRecords()
    .filter((r) => r.entity === 'Settlement' && r.entityId === settlement.id)
    .sort((a, b) => b.at.localeCompare(a.at))

  async function handleResync() {
    try {
      await resync.mutateAsync(settlementId)
      toast.success(vi.finance.syncSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.syncError)
    }
  }

  async function handleSubmitForCustomer() {
    try {
      await submitForCustomer.mutateAsync(settlementId)
      toast.success(vi.finance.submitForCustomerSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.submitForCustomerError)
    }
  }

  async function handleRemoveManualLine(lineId: string) {
    try {
      await removeManualLine.mutateAsync({ id: settlementId, lineId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.removeManualLineError)
    }
  }

  function evidenceLink(line: SettlementLine) {
    if (line.source === 'RETURN') {
      return (
        <Link to={`${paths.rentalDetail(rentalId)}?tab=handoverReturn`} className="text-primary text-xs underline underline-offset-2">
          {vi.finance.viewEvidence}
        </Link>
      )
    }
    if (line.source === 'INCIDENT' && line.sourceRef?.incidentId) {
      return (
        <Link to={paths.incidentDetail(line.sourceRef.incidentId)} className="text-primary text-xs underline underline-offset-2">
          {vi.finance.viewEvidence}
        </Link>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header — stepper/trạng thái + banner */}
      <div className="flex flex-wrap items-center gap-2">
        <SettlementStatusBadge status={settlement.status} />
        {settlement.paymentStatus && <Badge variant="outline">{SETTLEMENT_PAYMENT_STATUS_LABELS[settlement.paymentStatus]}</Badge>}
        {settlement.completedWithDebt && <Badge variant="warning">{vi.finance.completedWithDebtBadge}</Badge>}
      </div>
      <div className="flex flex-col gap-2">
        {sourceNotReady && settlement.status !== 'COMPLETED' && <Banner text={vi.finance.bannerSourceNotReady} />}
        {sourceChanged && <Banner text={vi.finance.bannerSourceChanged} />}
        {pendingIncidentItems > 0 && <Banner text={vi.finance.bannerPendingIncidentItems} />}
        {!hasHandoverCompleted && <Banner text={vi.finance.bannerNoHandover} />}
        {returnCancelled && <Banner text={vi.finance.bannerReturnCancelled} />}
        {rental.securityDepositType === 'MOTORBIKE' && <Banner text={vi.finance.bannerMotorbikeDeposit} />}
        {settlement.status === 'DRAFT' && settlement.reversals && settlement.reversals.length > 0 && (
          <Banner
            text={vi.finance.reversedBanner
              .replace('{at}', formatDateTime(settlement.reversals[settlement.reversals.length - 1].reversedAt))
              .replace('{reason}', settlement.reversals[settlement.reversals.length - 1].reason)}
          />
        )}
      </div>

      {settlement.reversals && settlement.reversals.length > 0 && <SettlementReversalHistory reversals={settlement.reversals} />}

      {/* Bảng dòng khoản mục */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{vi.finance.linesTitle}</h3>
            {isEditable && canConfirmAction && (
              <Button size="sm" variant="outline" onClick={handleResync} disabled={resync.isPending}>
                {vi.finance.syncButton}
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.finance.columnCategory}</TableHead>
                  <TableHead>{vi.finance.columnSource}</TableHead>
                  <TableHead>{vi.finance.columnEstimated}</TableHead>
                  <TableHead>{vi.finance.columnActual}</TableHead>
                  <TableHead>{vi.finance.columnLineStatus}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlement.lines.map((line) => (
                  <TableRow key={line.id} className={line.status === 'DRAFT' || line.status === 'DISPUTED' ? 'bg-status-pending/5' : undefined}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {SETTLEMENT_LINE_CATEGORY_LABELS[line.category]}
                          {line.direction === 'DISCOUNT' ? ` (${vi.finance.manualLineDirectionDiscount})` : ''}
                        </span>
                        {line.note && <span className="text-muted-foreground text-xs">{line.note}</span>}
                        {/* TODO(OQ: RentalSettlement-BRD.md §8 — DAMAGE ở Return vs Customer Charge ở Incident, có thể tính trùng.) */}
                        {line.sourceWarning === 'POSSIBLE_DUPLICATE_DAMAGE' && (
                          <span className="text-status-pending text-xs">{vi.finance.lineSourceWarningDuplicateDamage}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span>{SETTLEMENT_LINE_SOURCE_LABELS[line.source]}</span>
                        {evidenceLink(line)}
                      </div>
                    </TableCell>
                    <TableCell>{line.estimatedAmount !== undefined ? formatVnd(line.direction === 'DISCOUNT' ? -line.estimatedAmount : line.estimatedAmount) : '—'}</TableCell>
                    <TableCell>{line.actualAmount !== undefined ? formatVnd(line.direction === 'DISCOUNT' ? -line.actualAmount : line.actualAmount) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={line.status === 'CONFIRMED' || line.status === 'WAIVED' ? 'success' : line.status === 'DISPUTED' ? 'destructive' : 'warning'}>
                        {SETTLEMENT_LINE_STATUS_LABELS[line.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {isEditable && canConfirmAction && line.status === 'DRAFT' && line.sourceReady && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmLineTarget(line)}>
                            {vi.finance.confirmLineButton}
                          </Button>
                        )}
                        {isEditable && canConfirmAction && line.status === 'CONFIRMED' && line.source !== 'RENTAL' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setConfirmLineTarget(line)}>
                              {vi.common.edit}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setDisputeTarget(line)}>
                              {vi.finance.disputeButton}
                            </Button>
                          </>
                        )}
                        {isEditable && canConfirmAction && line.source === 'MANUAL' && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveManualLine(line.id)}>
                            {vi.finance.removeManualLineButton}
                          </Button>
                        )}
                        {isEditable && canApproveAction && line.status === 'DISPUTED' && (
                          <Button size="sm" variant="outline" onClick={() => setResolveDisputeTarget(line)}>
                            {vi.finance.resolveDisputeButton}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {isEditable && canConfirmAction && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => setManualLineOpen(true)}>
              {vi.finance.addManualLineButton}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Miễn giảm / thiện chí */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{vi.finance.waiversTitle}</h3>
            {isEditable && canConfirmAction && (
              <Button size="sm" variant="outline" onClick={() => setWaiverOpen(true)}>
                {vi.finance.addWaiverButton}
              </Button>
            )}
          </div>
          {settlement.waivers.length === 0 ? (
            <p className="text-muted-foreground text-sm">{vi.finance.waiversEmpty}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {settlement.waivers.map((w) => (
                <div key={w.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {SETTLEMENT_WAIVER_TYPE_LABELS[w.type]} — {formatVnd(w.amount)}
                    </span>
                    <span className="text-muted-foreground text-xs">{w.reason}</span>
                    <span className="text-muted-foreground text-xs">
                      {vi.finance.columnWaiverRequestedBy}: {w.requestedByName}
                    </span>
                  </div>
                  <Badge variant={w.status === 'APPROVED' ? 'success' : w.status === 'REJECTED' ? 'destructive' : 'warning'}>
                    {SETTLEMENT_WAIVER_STATUS_LABELS[w.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tổng hợp */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-2 py-4 text-sm sm:grid-cols-2 lg:grid-cols-2">
          <SummaryRow label={vi.finance.gross} value={formatVnd(totals.gross)} />
          <SummaryRow label={vi.finance.totalDiscount} value={formatVnd(totals.totalDiscount)} />
          <SummaryRow label={vi.finance.tax} value={vi.finance.taxNotApplied} />
          <SummaryRow label={vi.finance.rounding} value={vi.finance.roundingNotApplied} />
          <SummaryRow label={vi.finance.finalAmount} value={formatVnd(totals.finalAmount)} bold />
          <SummaryRow label={vi.finance.paidToDate} value={formatVnd(paidToDate)} />
          <SummaryRow label={vi.finance.depositHeld} value={formatVnd(settlement.depositHeld)} />
          {reconciliation ? (
            <>
              <SummaryRow label={vi.finance.depositApplied} value={formatVnd(reconciliation.depositApplied)} />
              <SummaryRow label={vi.finance.balanceDue} value={formatVnd(reconciliation.balanceDue)} bold />
              <SummaryRow label={vi.finance.depositRefundable} value={formatVnd(reconciliation.depositRefundable)} />
            </>
          ) : (
            <SummaryRow label={vi.finance.balanceDue} value={vi.finance.balanceDueNotReconciled} />
          )}
          {isEditable && canConfirmAction && (
            <div className="col-span-full">
              <Button size="sm" variant="outline" onClick={() => setDepositDialogOpen(true)}>
                {vi.finance.reconcileDepositButton}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yêu cầu thanh toán */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <h3 className="text-sm font-semibold">{vi.finance.paymentRequestsTitle}</h3>
          {settlement.paymentRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">{vi.finance.paymentRequestsEmpty}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {settlement.paymentRequests.map((r) => (
                <div
                  key={r.id}
                  className={`border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm ${r.status === 'CANCELLED' ? 'opacity-50' : ''}`}
                >
                  <span className={r.status === 'CANCELLED' ? 'line-through' : ''}>{SETTLEMENT_REQUEST_TYPE_LABELS[r.type]}</span>
                  <span className={`font-medium ${r.status === 'CANCELLED' ? 'line-through' : ''}`}>{formatVnd(r.amount)}</span>
                  {r.status === 'CANCELLED' && <Badge variant="destructive">{vi.finance.cancelledRequestLabel}</Badge>}
                </div>
              ))}
            </div>
          )}
          <p className="text-muted-foreground text-xs">{vi.finance.paymentRequestsNote}</p>
          {!returnCancelled && settlement.status === 'CONFIRMED' && canConfirmAction && reconciliation && (
            <div className="flex flex-wrap gap-2">
              {reconciliation.balanceDue > 0 && !hasRequest('COLLECT') && (
                <Button size="sm" variant="outline" onClick={() => setPaymentRequestTarget({ type: 'COLLECT', amount: reconciliation.balanceDue })}>
                  {vi.finance.createCollectRequestButton}
                </Button>
              )}
              {reconciliation.depositRefundable > 0 && !hasRequest('DEPOSIT_REFUND') && (
                <Button size="sm" variant="outline" onClick={() => setPaymentRequestTarget({ type: 'DEPOSIT_REFUND', amount: reconciliation.depositRefundable })}>
                  {vi.finance.createDepositRefundRequestButton}
                </Button>
              )}
              {reconciliation.balanceDue < 0 && !hasRequest('OVERPAYMENT_REFUND') && (
                <Button size="sm" variant="outline" onClick={() => setPaymentRequestTarget({ type: 'OVERPAYMENT_REFUND', amount: -reconciliation.balanceDue })}>
                  {vi.finance.createOverpaymentRefundRequestButton}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thanh hành động — Blocker 3 (tech-lead review Phase 4.1 R1): ẩn toàn bộ
          khi biên bản trả xe đã bị huỷ (Rental không còn ở SETTLEMENT). */}
      {!returnCancelled && (
        <div className="flex flex-wrap gap-2">
          {settlement.status === 'DRAFT' && canConfirmAction && (
            <Button size="sm" onClick={handleSubmitForCustomer} disabled={submitForCustomer.isPending}>
              {vi.finance.submitForCustomerButton}
            </Button>
          )}
          {settlement.status === 'PENDING_CUSTOMER' && canConfirmAction && (
            <Button size="sm" onClick={() => setAckDialogOpen(true)}>
              {vi.finance.customerAckButton}
            </Button>
          )}
          {settlement.status === 'WAITING_APPROVAL' && canApproveAction && (
            <Button size="sm" onClick={() => setApprovalDialogOpen(true)}>
              {vi.finance.approvalDialogTitle}
            </Button>
          )}
          {settlement.status === 'CONFIRMED' && canConfirmAction && (
            <Button size="sm" onClick={() => setCompleteDialogOpen(true)}>
              {vi.finance.completeButton}
            </Button>
          )}
          {settlement.status === 'COMPLETED' && canReverseAction && canReverseSettlement(settlement, rental) && (
            <Button size="sm" variant="destructive" onClick={() => setReverseDialogOpen(true)}>
              {vi.finance.reverseButton}
            </Button>
          )}
        </div>
      )}

      {/* Round 2 — Post-Settlement Charge (RS-BR-13) */}
      {(settlement.status === 'COMPLETED' || pscs.length > 0) && (
        <PostSettlementChargeSection settlement={settlement} rental={rental} incidents={incidents} pscs={pscs} />
      )}

      {/* Lịch sử thao tác */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          <h3 className="text-sm font-semibold">{vi.finance.auditTitle}</h3>
          {auditRecords.length === 0 ? (
            <p className="text-muted-foreground text-sm">{vi.finance.auditEmpty}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  {auditRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDateTime(r.at)}</TableCell>
                      <TableCell>{r.summary}</TableCell>
                      <TableCell>{r.actorName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <SettlementLineConfirmDialog settlementId={settlement.id} line={confirmLineTarget} open={!!confirmLineTarget} onOpenChange={(o) => !o && setConfirmLineTarget(null)} />
      <SettlementDisputeDialog settlementId={settlement.id} line={disputeTarget} open={!!disputeTarget} onOpenChange={(o) => !o && setDisputeTarget(null)} />
      <SettlementResolveDisputeDialog settlementId={settlement.id} line={resolveDisputeTarget} open={!!resolveDisputeTarget} onOpenChange={(o) => !o && setResolveDisputeTarget(null)} />
      <SettlementManualLineDialog settlementId={settlement.id} open={manualLineOpen} onOpenChange={setManualLineOpen} />
      <SettlementWaiverDialog settlementId={settlement.id} lines={settlement.lines} waivers={settlement.waivers} open={waiverOpen} onOpenChange={setWaiverOpen} />
      <SettlementDepositDialog settlement={settlement} open={depositDialogOpen} onOpenChange={setDepositDialogOpen} />
      <SettlementCustomerAckDialog settlementId={settlement.id} lines={settlement.lines} open={ackDialogOpen} onOpenChange={setAckDialogOpen} />
      <SettlementApprovalDialog settlementId={settlement.id} open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen} />
      <SettlementPaymentRequestDialog
        settlementId={settlement.id}
        type={paymentRequestTarget?.type ?? null}
        amount={paymentRequestTarget?.amount ?? 0}
        open={!!paymentRequestTarget}
        onOpenChange={(o) => !o && setPaymentRequestTarget(null)}
      />
      <SettlementCompleteDialog settlement={settlement} open={completeDialogOpen} onOpenChange={setCompleteDialogOpen} />
      <SettlementReverseDialog settlement={settlement} open={reverseDialogOpen} onOpenChange={setReverseDialogOpen} />
    </div>
  )
}

function Banner({ text }: { text: string }) {
  return <div className="border-status-pending bg-status-pending/10 text-status-pending rounded-md border p-3 text-sm">{text}</div>
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
