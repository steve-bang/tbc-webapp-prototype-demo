import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicle } from '@/features/vehicles/hooks'
import { CONSIGNMENT_PRORATION_RULE_LABELS, OWNER_PAYOUT_ADJUSTMENT_STATUS_LABELS, PAYOUT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { toLocalDateKey } from '../model'
import {
  useConsignmentContract,
  useDecideOwnerPayoutAdjustment,
  useHoldOwnerPayoutRecord,
  useOwnerPayoutRecord,
  useReleaseOwnerPayoutRecord,
  useVehicleOwner,
} from '../hooks'
import {
  canAdjust,
  canDecideAdjustment,
  canHold,
  canRelease,
  formatPeriod,
  getOwnerPayoutBlocker,
  hasPendingAdjustment,
  isPayoutDueSoon,
  isPayoutOverdue,
  sumApprovedAdjustments,
  type OwnerPayoutAdjustment,
  type OwnerPayoutRecord,
} from '../payoutModel'
import { ConsignmentField } from './ConsignmentField'
import { ConsignmentReasonDialog } from './ConsignmentReasonDialog'
import { OwnerPayoutAdjustmentDialog } from './OwnerPayoutAdjustmentDialog'
import { OwnerPayoutStatusBadge } from './OwnerPayoutStatusBadge'

type ReasonKind = 'hold' | 'release' | 'reject'

/** Tham chiếu tới một khoản chi trả khác (bản thay thế / bản bị thay) — hiện mã, bấm để mở bản đó. */
function RecordRef({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  const { data } = useOwnerPayoutRecord(id)
  return (
    <button type="button" className="text-primary font-mono text-xs underline-offset-4 hover:underline" onClick={() => onOpen?.(id)}>
      {data?.code ?? id}
    </button>
  )
}

/** Công thức: `9.000.000 × 11/30 = 3.300.000`, hoặc trả tròn tháng. */
function formulaText(record: OwnerPayoutRecord): string {
  if (record.prorationRule === 'FULL_MONTH') {
    return `${formatVnd(record.fixedMonthlyAmount)} (${CONSIGNMENT_PRORATION_RULE_LABELS.FULL_MONTH}) = ${formatVnd(record.baseAmount)}`
  }
  return `${formatVnd(record.fixedMonthlyAmount)} × ${record.daysCovered}/${record.daysInMonth} = ${formatVnd(record.baseAmount)}`
}

/**
 * Chi tiết một khoản chi trả chủ xe (BRD mục 6.6, 13): diễn giải công thức, điều chỉnh, lịch sử trạng thái và nhật ký lệnh chi.
 * Hành động theo trạng thái × quyền: tạm giữ / bỏ tạm giữ / điều chỉnh (`EDIT`), duyệt điều chỉnh (`EDIT` + `APPROVE`), đi tới chi
 * trả (`CONFIRM`). Luôn đọc bản mới nhất theo id nên sheet tự cập nhật sau mỗi thao tác.
 */
export function OwnerPayoutRecordSheet({
  recordId,
  open,
  onOpenChange,
  onOpenRecord,
}: {
  recordId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenRecord?: (id: string) => void
}) {
  const t = vi.consignment.payouts
  const { can } = usePermission()
  const canEdit = can('CONSIGNMENT', 'EDIT')
  const canDecide = canEdit && can('CONSIGNMENT', 'APPROVE')
  const canConfirm = can('CONSIGNMENT', 'CONFIRM')

  const { data: record } = useOwnerPayoutRecord(recordId)
  const { data: owner } = useVehicleOwner(record?.ownerId)
  const { data: contract } = useConsignmentContract(record?.contractId)
  const { data: vehicle } = useVehicle(record?.vehicleId)
  const hold = useHoldOwnerPayoutRecord()
  const release = useReleaseOwnerPayoutRecord()
  const decide = useDecideOwnerPayoutAdjustment()

  const [reasonKind, setReasonKind] = useState<ReasonKind | undefined>(undefined)
  const [rejectTarget, setRejectTarget] = useState<OwnerPayoutAdjustment | undefined>(undefined)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const todayKey = toLocalDateKey(new Date())

  async function handleApprove(adjustment: OwnerPayoutAdjustment) {
    if (!record) return
    try {
      await decide.mutateAsync({ id: record.id, adjustmentId: adjustment.id, input: { decision: 'APPROVED' } })
      toast.success(t.approveSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  const reasonConfig =
    record && reasonKind
      ? {
          hold: {
            title: t.holdDialogTitle,
            successMessage: t.holdSuccess,
            run: (reason: string) => hold.mutateAsync({ id: record.id, reason }),
          },
          release: {
            title: t.releaseDialogTitle,
            successMessage: t.releaseSuccess,
            run: (reason: string) => release.mutateAsync({ id: record.id, reason }),
          },
          reject: {
            title: t.rejectDialogTitle,
            successMessage: t.rejectSuccess,
            run: (reason: string) =>
              rejectTarget
                ? decide.mutateAsync({ id: record.id, adjustmentId: rejectTarget.id, input: { decision: 'REJECTED', note: reason } })
                : Promise.reject(new Error(t.adjustNotFound)),
          },
        }[reasonKind]
      : undefined

  const blocker = record ? getOwnerPayoutBlocker(record, owner) : undefined
  const overdue = record ? isPayoutOverdue(record, todayKey) : false
  const dueSoon = record ? isPayoutDueSoon(record, todayKey) : false

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{record ? `${t.sheetTitle} — ${record.code}` : t.sheetTitle}</SheetTitle>
            <SheetDescription>{record ? t.periodLabel(formatPeriod(record.period)) : ''}</SheetDescription>
          </SheetHeader>
          {!record ? (
            <p className="text-muted-foreground px-4 text-sm">{vi.common.loading}</p>
          ) : (
            <div className="flex flex-col gap-4 px-4 pb-6 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <OwnerPayoutStatusBadge status={record.status} />
                {overdue && <Badge variant="destructive">{t.overdueBadge}</Badge>}
                {!overdue && dueSoon && <Badge variant="warning">{t.dueSoonBadge}</Badge>}
                {record.payout && record.status !== 'PAID' && <Badge variant="info">{t.linkedBadge(record.payout.transactionCode)}</Badge>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ConsignmentField label={vi.consignment.contractLinkOwner}>
                  <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(record.ownerId)}>
                    {owner?.fullName ?? record.ownerId}
                  </Link>
                </ConsignmentField>
                <ConsignmentField label={vi.consignment.contractColumnVehicle}>
                  <Link className="text-primary underline-offset-4 hover:underline" to={paths.vehicleDetail(record.vehicleId)}>
                    {vehicle?.plate ?? record.vehicleId}
                  </Link>
                </ConsignmentField>
                <ConsignmentField label={vi.consignment.contractColumnNo}>
                  <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(record.contractId)}>
                    {contract?.contractNo ?? record.contractId}
                  </Link>
                </ConsignmentField>
                <ConsignmentField label={t.coverageLabel}>
                  {formatDate(record.coverageFrom)} – {formatDate(record.coverageTo)} ({record.daysCovered}/{record.daysInMonth})
                </ConsignmentField>
                <ConsignmentField label={t.termVersionLabel}>{t.termVersionValue(record.termVersionNo)}</ConsignmentField>
                <ConsignmentField label={t.dueDateLabel}>{formatDate(record.dueDate)}</ConsignmentField>
              </div>

              <section className="border-border flex flex-col gap-2 rounded-md border p-3">
                <h3 className="font-semibold">{t.calcTitle}</h3>
                <p className="font-mono text-xs">{formulaText(record)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t.approvedAdjustments}</span>
                  <span>{formatVnd(sumApprovedAdjustments(record))}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold">
                  <span>{t.amountPayableLabel}</span>
                  <span>{formatVnd(record.amountPayable)}</span>
                </div>
              </section>

              {record.holdReason && record.status === 'ON_HOLD' && (
                <div className="border-status-pending/40 bg-status-pending/10 text-status-pending rounded-md border p-3">
                  <p className="font-medium">{t.holdReasonLabel}</p>
                  <p>{record.holdReason}</p>
                </div>
              )}
              {record.cancelReason && (
                <div className="border-border bg-muted/40 rounded-md border p-3">
                  <p className="font-medium">{t.cancelReasonLabel}</p>
                  <p>{record.cancelReason}</p>
                </div>
              )}
              {(record.replacesRecordId || record.replacedByRecordId) && (
                <div className="flex flex-col gap-1">
                  {record.replacesRecordId && (
                    <p>
                      <span className="text-muted-foreground">{t.replacesLabel}: </span>
                      <RecordRef id={record.replacesRecordId} onOpen={onOpenRecord} />
                    </p>
                  )}
                  {record.replacedByRecordId && (
                    <p>
                      <span className="text-muted-foreground">{t.replacedByLabel}: </span>
                      <RecordRef id={record.replacedByRecordId} onOpen={onOpenRecord} />
                    </p>
                  )}
                </div>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="font-semibold">{t.adjustmentsTitle}</h3>
                {record.adjustments.length === 0 ? (
                  <p className="text-muted-foreground">{t.adjustmentsEmpty}</p>
                ) : (
                  record.adjustments.map((a) => (
                    <div key={a.id} className="border-border flex flex-col gap-1 rounded-md border p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{formatVnd(a.amount)}</span>
                        <Badge variant={a.status === 'APPROVED' ? 'success' : a.status === 'REJECTED' ? 'neutral' : 'warning'}>
                          {OWNER_PAYOUT_ADJUSTMENT_STATUS_LABELS[a.status]}
                        </Badge>
                      </div>
                      <p>{a.note}</p>
                      <p className="text-muted-foreground text-xs">
                        {t.adjustmentRequestedBy(a.requestedByName, formatDateTime(a.requestedAt))}
                        {a.decidedByName && a.decidedAt && ` · ${t.adjustmentDecidedBy(a.decidedByName, formatDateTime(a.decidedAt))}`}
                        {a.decisionNote && ` · ${a.decisionNote}`}
                      </p>
                      {canDecide && canDecideAdjustment(record, a) && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" disabled={decide.isPending} onClick={() => handleApprove(a)}>
                            {t.actionApproveAdjustment}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget(a)
                              setReasonKind('reject')
                            }}
                          >
                            {t.actionRejectAdjustment}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </section>

              <div className="flex flex-wrap gap-2">
                {canEdit && canHold(record) && (
                  <Button size="sm" variant="outline" onClick={() => setReasonKind('hold')}>
                    {t.actionHold}
                  </Button>
                )}
                {canEdit && canRelease(record) && (
                  <Button size="sm" variant="outline" onClick={() => setReasonKind('release')}>
                    {t.actionRelease}
                  </Button>
                )}
                {canEdit && canAdjust(record) && !hasPendingAdjustment(record) && (
                  <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
                    {t.actionAdjust}
                  </Button>
                )}
              </div>

              {canConfirm && record.status !== 'PAID' && record.status !== 'CANCELLED' && (
                <div className="border-border flex flex-col gap-1 rounded-md border p-3">
                  {blocker ? (
                    <p className="text-muted-foreground text-xs">{blocker}</p>
                  ) : (
                    <Link
                      className="text-primary font-medium underline-offset-4 hover:underline"
                      to={`${paths.consignmentOwnerPayouts}?record=${record.id}`}
                    >
                      {t.goToPayout}
                    </Link>
                  )}
                </div>
              )}

              <section className="flex flex-col gap-2">
                <h3 className="font-semibold">{t.statusHistoryTitle}</h3>
                <ul className="flex flex-col gap-1">
                  {record.statusHistory.map((h, index) => (
                    <li key={`${h.at}-${index}`} className="text-xs">
                      <span className="text-muted-foreground">{formatDateTime(h.at)} · </span>
                      {h.from ? `${PAYOUT_STATUS_LABELS[h.from]} → ` : ''}
                      {PAYOUT_STATUS_LABELS[h.to]} · {h.byName}
                      {h.reason ? ` — ${h.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </section>

              {record.payoutLog.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="font-semibold">{t.payoutLogTitle}</h3>
                  <ul className="flex flex-col gap-1">
                    {record.payoutLog.map((l, index) => (
                      <li key={`${l.at}-${index}`} className="text-xs">
                        <span className="text-muted-foreground">{formatDateTime(l.at)} · </span>
                        {t.payoutLogEvent[l.event]} {l.transactionCode} · {l.byName}
                        {l.note ? ` — ${l.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {record && canEdit && <OwnerPayoutAdjustmentDialog record={record} open={adjustOpen} onOpenChange={setAdjustOpen} />}
      {reasonConfig && (
        <ConsignmentReasonDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setReasonKind(undefined)
              setRejectTarget(undefined)
            }
          }}
          title={reasonConfig.title}
          successMessage={reasonConfig.successMessage}
          onConfirm={reasonConfig.run}
        />
      )}
    </>
  )
}
