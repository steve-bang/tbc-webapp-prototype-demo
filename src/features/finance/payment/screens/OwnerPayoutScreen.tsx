import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import {
  OwnerPayoutStatusBadge,
  getOwnerPayoutBlocker,
  isPayoutOverdue,
  summarizeOwnerPayables,
  useConsignmentContracts,
  useOwnerPayoutRecords,
  useVehicleOwners,
  type OwnerPayoutRecord,
} from '@/features/consignment'
import { useVehicles } from '@/features/vehicles/hooks'
import { TRANSACTION_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { OwnerPayoutCreateDialog } from '../components/OwnerPayoutCreateDialog'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import { useTransactions } from '../hooks'
import { isEffectiveTransaction } from '../model'

function localTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Chi trả chủ xe (`/consignment/owner-payouts`) — kế hoạch mục 19.7.2, `Payment-BRD.md` mục 14. Thiếu quyền xem Xe ký gửi chỉ
 * thấy thông điệp, không tải dữ liệu. Ba khối: công nợ chủ xe · khoản chờ chi (tạo lệnh chi) · đã chi gần đây.
 */
export function OwnerPayoutScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) {
    return (
      <div>
        <PageHeader title={vi.finance.ownerPayout.title} />
        <p className="text-muted-foreground text-sm">{vi.finance.ownerPayout.noPermission}</p>
      </div>
    )
  }
  return <OwnerPayoutContent />
}

function OwnerPayoutContent() {
  const t = vi.finance.ownerPayout
  const { can } = usePermission()
  const canCreatePayout = can('CONSIGNMENT', 'CONFIRM')
  const [searchParams, setSearchParams] = useSearchParams()
  const focusRecordId = searchParams.get('record') ?? undefined

  const { data: records = [], isLoading } = useOwnerPayoutRecords()
  const { data: owners = [] } = useVehicleOwners()
  const { data: contracts = [] } = useConsignmentContracts()
  const { data: vehicles = [] } = useVehicles()
  const { data: txns = [] } = useTransactions({ type: 'OWNER_PAYOUT' })

  const todayKey = localTodayKey()
  const ownerById = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners])
  const contractNoById = useMemo(() => new Map(contracts.map((c) => [c.id, c.contractNo])), [contracts])
  const plateById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.plate])), [vehicles])
  const txnByCode = useMemo(() => new Map(txns.map((x) => [x.code, x])), [txns])

  const [createRecordId, setCreateRecordId] = useState<string | null>(null)
  const [dismissedFocusId, setDismissedFocusId] = useState<string | undefined>(undefined)
  const [detailTxnId, setDetailTxnId] = useState<string | null>(null)
  const detailTxn = detailTxnId ? (txns.find((x) => x.id === detailTxnId) ?? null) : null

  // ---- (a) Công nợ chủ xe ----
  const paidByOwner = useMemo(() => {
    const map = new Map<string, number>()
    for (const x of txns) {
      if (!isEffectiveTransaction(x) || !x.vehicleOwnerId) continue
      map.set(x.vehicleOwnerId, (map.get(x.vehicleOwnerId) ?? 0) + x.amount)
    }
    return map
  }, [txns])
  const payables = useMemo(
    () =>
      summarizeOwnerPayables(records, todayKey)
        .map((p) => ({ ...p, owner: ownerById.get(p.ownerId), paidLedger: paidByOwner.get(p.ownerId) ?? 0 }))
        .sort((a, b) => b.overdueAmount - a.overdueAmount || b.dueUnpaid - a.dueUnpaid),
    [records, todayKey, ownerById, paidByOwner],
  )

  // ---- (b) Khoản chờ chi ----
  const pending = useMemo(
    () => records.filter((r) => r.status === 'SCHEDULED').sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.code.localeCompare(b.code)),
    [records],
  )

  // ---- (c) Đã chi gần đây ----
  const recentPaid = useMemo(
    () =>
      txns
        .filter((x) => (x.status === 'CONFIRMED' && !x.reversalOfId) || x.status === 'REVERSED')
        .sort((a, b) => (b.confirmedAt ?? b.performedAt).localeCompare(a.confirmedAt ?? a.performedAt))
        .slice(0, 30),
    [txns],
  )

  // `?record=<id>` — cuộn tới khoản chi trả và mở sẵn dialog tạo lệnh chi nếu tạo được (suy ra khi render, không setState trong effect).
  const focusRecord = focusRecordId ? records.find((r) => r.id === focusRecordId) : undefined
  const autoOpenId =
    focusRecord && focusRecord.id !== dismissedFocusId && canCreatePayout && !getOwnerPayoutBlocker(focusRecord, ownerById.get(focusRecord.ownerId))
      ? focusRecord.id
      : undefined
  const activeCreateId = createRecordId ?? autoOpenId
  const createRecord = activeCreateId ? (records.find((r) => r.id === activeCreateId) ?? null) : null
  useEffect(() => {
    if (focusRecordId && !isLoading) document.getElementById(`owner-payout-row-${focusRecordId}`)?.scrollIntoView({ block: 'center' })
  }, [focusRecordId, isLoading])

  function closeCreateDialog() {
    setCreateRecordId(null)
    if (focusRecordId) {
      setDismissedFocusId(focusRecordId)
      setSearchParams({}, { replace: true })
    }
  }

  function ownerName(id: string): string {
    return ownerById.get(id)?.fullName ?? id
  }

  function renderAction(record: OwnerPayoutRecord) {
    if (record.payout) {
      const txn = txnByCode.get(record.payout.transactionCode)
      return (
        <Button size="sm" variant="outline" disabled={!txn} onClick={() => txn && setDetailTxnId(txn.id)}>
          {t.viewPayoutTxn(record.payout.transactionCode)}
        </Button>
      )
    }
    if (!canCreatePayout) return <span className="text-muted-foreground text-xs">—</span>
    const blocker = getOwnerPayoutBlocker(record, ownerById.get(record.ownerId))
    return (
      <div className="flex flex-col items-start gap-1">
        <Button size="sm" disabled={!!blocker} onClick={() => setCreateRecordId(record.id)}>
          {t.createButton}
        </Button>
        {blocker && <span className="text-muted-foreground max-w-56 text-xs">{blocker}</span>}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to={paths.consignmentPayouts}>{t.goToSchedule}</Link>
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : (
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t.payablesTitle}</h2>
            {payables.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.payablesEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.partyOwnerLabel}</TableHead>
                      <TableHead className="text-right">{t.columnDueUnpaid}</TableHead>
                      <TableHead className="text-right">{t.columnOnHold}</TableHead>
                      <TableHead className="text-right">{t.columnOverdue}</TableHead>
                      <TableHead className="text-right">{t.columnPaid}</TableHead>
                      <TableHead>{t.columnNextDue}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payables.map((p) => (
                      <TableRow key={p.ownerId}>
                        <TableCell>
                          <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(p.ownerId)}>
                            {p.owner?.fullName ?? p.ownerId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(p.dueUnpaid)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(p.onHold)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <span className="flex flex-col items-end gap-0.5">
                            {formatVnd(p.overdueAmount)}
                            {p.overdueCount > 0 && <Badge variant="destructive">{t.overdueCount(p.overdueCount)}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(p.paidLedger)}</TableCell>
                        <TableCell>{p.nextDueDate ? formatDate(p.nextDueDate) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t.pendingTitle}</h2>
            {pending.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.pendingEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.columnRecord}</TableHead>
                      <TableHead>{t.partyOwnerLabel}</TableHead>
                      <TableHead>{t.columnVehicle}</TableHead>
                      <TableHead>{t.columnContract}</TableHead>
                      <TableHead className="text-right">{t.columnAmount}</TableHead>
                      <TableHead>{t.columnDueDate}</TableHead>
                      <TableHead>{t.columnAction}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((r) => (
                      <TableRow key={r.id} id={`owner-payout-row-${r.id}`} className={cn(focusRecordId === r.id && 'bg-muted/50')}>
                        <TableCell className="font-mono text-xs">
                          {r.code} · {r.period.slice(5)}/{r.period.slice(0, 4)}
                          {r.payout && (
                            <div className="mt-0.5">
                              <OwnerPayoutStatusBadge status={r.status} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{ownerName(r.ownerId)}</TableCell>
                        <TableCell>{plateById.get(r.vehicleId) ?? r.vehicleId}</TableCell>
                        <TableCell className="font-mono text-xs">{contractNoById.get(r.contractId) ?? r.contractId}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(r.amountPayable)}</TableCell>
                        <TableCell>
                          <span className="flex flex-col gap-0.5">
                            {formatDate(r.dueDate)}
                            {isPayoutOverdue(r, todayKey) && <Badge variant="destructive">{t.overdueBadge}</Badge>}
                          </span>
                        </TableCell>
                        <TableCell>{renderAction(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{t.paidTitle}</h2>
            {recentPaid.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.paidEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.columnTxn}</TableHead>
                      <TableHead>{t.columnConfirmedAt}</TableHead>
                      <TableHead>{t.partyOwnerLabel}</TableHead>
                      <TableHead className="text-right">{t.columnAmount}</TableHead>
                      <TableHead>{vi.common.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPaid.map((x) => (
                      <TableRow key={x.id} className="cursor-pointer" onClick={() => setDetailTxnId(x.id)}>
                        <TableCell className="font-mono text-xs">{x.code}</TableCell>
                        <TableCell>{formatDateTime(x.confirmedAt ?? x.performedAt)}</TableCell>
                        <TableCell className="max-w-48 truncate">{x.vehicleOwnerId ? ownerName(x.vehicleOwnerId) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(x.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={x.status === 'REVERSED' ? 'info' : 'success'}>{TRANSACTION_STATUS_LABELS[x.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="text-muted-foreground text-xs">{t.reverseNote}</p>
          </section>
        </div>
      )}

      <OwnerPayoutCreateDialog
        record={createRecord}
        owner={createRecord ? ownerById.get(createRecord.ownerId) : undefined}
        contractNo={createRecord ? contractNoById.get(createRecord.contractId) : undefined}
        open={!!activeCreateId}
        onOpenChange={(open) => !open && closeCreateDialog()}
      />
      <TransactionDetailSheet
        transaction={detailTxn}
        allTransactions={txns}
        partyName={detailTxn?.vehicleOwnerId ? ownerName(detailTxn.vehicleOwnerId) : undefined}
        open={!!detailTxn}
        onOpenChange={(open) => !open && setDetailTxnId(null)}
      />
    </div>
  )
}
