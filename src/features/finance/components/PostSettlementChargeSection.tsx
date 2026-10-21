import { useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import type { Incident } from '@/features/incidents'
import type { Rental } from '@/features/rentals'
import {
  POST_SETTLEMENT_CHARGE_SOURCE_LABELS,
  POST_SETTLEMENT_CHARGE_STATUS_LABELS,
  POST_SETTLEMENT_CHARGE_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { usePaymentRequests, useTransactions } from '../hooks'
import { canAdjustSettlement, canCreatePostSettlementCharge, isPscOnHold, summarizePscs, summarizePscPayments, type PostSettlementCharge, type Settlement } from '../model'
import { PaymentRequestStatusBadge } from './PaymentRequestStatusBadge'
import { PostSettlementChargeDialog } from './PostSettlementChargeDialog'
import { SettlementAdjustmentDialog } from './SettlementAdjustmentDialog'

/**
 * Khối "Phát sinh sau quyết toán" — `docs/RENTAL-SETTLEMENT-PLAN.md` §10.10
 * mục 1. Hiện khi Settlement `COMPLETED` hoặc đã có ≥ 1 PSC (sau đảo quyết
 * toán vẫn phải thấy). RS-BR-13 — không bao giờ ghi/đổi số liệu kỳ gốc.
 */
export function PostSettlementChargeSection({
  settlement,
  rental,
  incidents,
  pscs,
}: {
  settlement: Settlement
  rental: Rental
  incidents: Incident[]
  pscs: PostSettlementCharge[]
}) {
  const { can } = usePermission()
  const canCreate = can('SETTLEMENT', 'CREATE')
  const canEdit = can('SETTLEMENT', 'EDIT')

  const [createOpen, setCreateOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const summary = summarizePscs(pscs)
  const { data: requests = [] } = usePaymentRequests({ rentalId: rental.id })
  const { data: txns = [] } = useTransactions({ rentalId: rental.id })
  const pscPayments = summarizePscPayments(pscs, requests, txns)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{vi.finance.pscSectionTitle}</h3>
            <p className="text-muted-foreground text-xs">{vi.finance.pscSectionIntro}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreate && canCreatePostSettlementCharge(settlement, rental) && (
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                {vi.finance.pscCreateButton}
              </Button>
            )}
            {canEdit && canAdjustSettlement(settlement, rental) && (
              <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
                {vi.finance.pscAdjustButton}
              </Button>
            )}
          </div>
        </div>

        <div className="border-border bg-muted/30 flex flex-wrap gap-4 rounded-md border p-3 text-sm">
          <span className="font-medium">{vi.finance.pscSummaryOpenLabel}</span>
          <span>
            {vi.finance.pscSummaryReceivable}: <span className="text-status-pending font-medium">{formatVnd(summary.openReceivable)}</span>
          </span>
          <span>
            {vi.finance.pscSummaryRefund}: <span className="text-status-info font-medium">{formatVnd(summary.openRefund)}</span>
          </span>
        </div>

        {pscs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.finance.pscEmpty}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.finance.pscColumnSource}</TableHead>
                    <TableHead>{vi.finance.pscColumnType}</TableHead>
                    <TableHead>{vi.finance.pscColumnAmount}</TableHead>
                    <TableHead>{vi.finance.pscColumnIncident}</TableHead>
                    <TableHead>{vi.finance.pscColumnReason}</TableHead>
                    <TableHead>{vi.finance.pscColumnStatus}</TableHead>
                    <TableHead>{vi.finance.pscColumnCreatedBy}</TableHead>
                    <TableHead>{vi.finance.payment.pscPaymentColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pscs.map((psc) => {
                    const onHold = isPscOnHold(psc, incidents)
                    const item = pscPayments.items.find((i) => i.psc.id === psc.id)
                    const requestClosedButNotFulfilled = psc.status === 'CLOSED' && item?.request && item.request.status !== 'FULFILLED'
                    return (
                      <TableRow key={psc.id}>
                        <TableCell>
                          <Badge variant="outline">{POST_SETTLEMENT_CHARGE_SOURCE_LABELS[psc.source]}</Badge>
                        </TableCell>
                        <TableCell className={psc.type === 'RECEIVABLE' ? 'text-status-pending' : 'text-status-info'}>
                          {POST_SETTLEMENT_CHARGE_TYPE_LABELS[psc.type]}
                        </TableCell>
                        <TableCell>{formatVnd(psc.amount)}</TableCell>
                        <TableCell>
                          {psc.incidentId ? (
                            <Link to={paths.incidentDetail(psc.incidentId)} className="text-primary text-xs underline underline-offset-2">
                              {vi.finance.pscViewIncidentLink}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span>{psc.reason}</span>
                            {psc.evidenceNote && <span className="text-muted-foreground text-xs">{psc.evidenceNote}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={psc.status === 'CLOSED' ? 'success' : 'warning'}>{POST_SETTLEMENT_CHARGE_STATUS_LABELS[psc.status]}</Badge>
                            {onHold && <Badge variant="destructive">{vi.finance.pscOnHoldBadge}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span>{psc.createdByName}</span>
                            <span className="text-muted-foreground">{formatDateTime(psc.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            {item?.request ? (
                              <>
                                <PaymentRequestStatusBadge status={item.request.status} />
                                <span>
                                  {vi.finance.payment.milestoneCollected}: {formatVnd(item.done)}
                                </span>
                              </>
                            ) : (
                              '—'
                            )}
                            {requestClosedButNotFulfilled && <span className="text-status-error">{vi.finance.payment.pscReversedWarning}</span>}
                            <Link to={`${paths.rentalDetail(rental.id)}?tab=payment`} className="text-primary underline underline-offset-2">
                              {vi.finance.payment.pscPaymentLink}
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {pscs.map((psc) => {
                const onHold = isPscOnHold(psc, incidents)
                const item = pscPayments.items.find((i) => i.psc.id === psc.id)
                const requestClosedButNotFulfilled = psc.status === 'CLOSED' && item?.request && item.request.status !== 'FULFILLED'
                return (
                  <div key={psc.id} className="border-border flex flex-col gap-2 rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{POST_SETTLEMENT_CHARGE_SOURCE_LABELS[psc.source]}</Badge>
                      <Badge variant={psc.status === 'CLOSED' ? 'success' : 'warning'}>{POST_SETTLEMENT_CHARGE_STATUS_LABELS[psc.status]}</Badge>
                    </div>
                    <div className={`font-medium ${psc.type === 'RECEIVABLE' ? 'text-status-pending' : 'text-status-info'}`}>
                      {POST_SETTLEMENT_CHARGE_TYPE_LABELS[psc.type]} — {formatVnd(psc.amount)}
                    </div>
                    <p>{psc.reason}</p>
                    {psc.evidenceNote && <p className="text-muted-foreground text-xs">{psc.evidenceNote}</p>}
                    {psc.incidentId && (
                      <Link to={paths.incidentDetail(psc.incidentId)} className="text-primary text-xs underline underline-offset-2">
                        {vi.finance.pscViewIncidentLink}
                      </Link>
                    )}
                    {onHold && <Badge variant="destructive">{vi.finance.pscOnHoldBadge}</Badge>}
                    <span className="text-muted-foreground text-xs">
                      {psc.createdByName} · {formatDateTime(psc.createdAt)}
                    </span>
                    {item?.request && (
                      <div className="flex items-center gap-2 text-xs">
                        <PaymentRequestStatusBadge status={item.request.status} />
                        <span>
                          {vi.finance.payment.milestoneCollected}: {formatVnd(item.done)}
                        </span>
                      </div>
                    )}
                    {requestClosedButNotFulfilled && <span className="text-status-error text-xs">{vi.finance.payment.pscReversedWarning}</span>}
                    <Link to={`${paths.rentalDetail(rental.id)}?tab=payment`} className="text-primary self-start text-xs underline underline-offset-2">
                      {vi.finance.payment.pscPaymentLink}
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <p className="text-muted-foreground text-xs">{vi.finance.pscPaymentNote}</p>
      </CardContent>

      <PostSettlementChargeDialog settlement={settlement} rental={rental} incidents={incidents} existingPscs={pscs} open={createOpen} onOpenChange={setCreateOpen} />
      <SettlementAdjustmentDialog settlementId={settlement.id} open={adjustOpen} onOpenChange={setAdjustOpen} />
    </Card>
  )
}
