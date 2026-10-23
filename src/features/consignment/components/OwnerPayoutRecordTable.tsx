import { useMemo, useState } from 'react'
import { useVehicles } from '@/features/vehicles/hooks'
import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate, toDateKey } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useConsignmentContracts, useOwnerPayoutRecords, useVehicleOwners } from '../hooks'

import {
  formatPeriod,
  isPayoutDueSoon,
  isPayoutOverdue,
  sumApprovedAdjustments,
  hasPendingAdjustment,
  type OwnerPayoutRecord,
} from '../payoutModel'
import { OwnerPayoutRecordSheet } from './OwnerPayoutRecordSheet'
import { OwnerPayoutStatusBadge } from './OwnerPayoutStatusBadge'

export type PayoutColumn = 'owner' | 'vehicle' | 'contract'

interface TableProps {
  records: OwnerPayoutRecord[]
  ownerNameOf: (ownerId: string) => string
  plateOf: (vehicleId: string) => string
  contractNoOf: (contractId: string) => string
  /** Cột tuỳ chọn cần ẩn khi ngữ cảnh đã biết (vd tab của một hợp đồng ẩn cả ba). */
  hideColumns?: PayoutColumn[]
  onSelect: (record: OwnerPayoutRecord) => void
}

function AdjustmentCell({ record }: { record: OwnerPayoutRecord }) {
  const approved = sumApprovedAdjustments(record)
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn(approved < 0 && 'text-destructive')}>{approved === 0 ? '—' : formatVnd(approved)}</span>
      {hasPendingAdjustment(record) && <Badge variant="warning">{vi.consignment.payouts.pendingAdjustmentBadge}</Badge>}
    </div>
  )
}

function DueCell({ record, todayKey }: { record: OwnerPayoutRecord; todayKey: string }) {
  const t = vi.consignment.payouts
  const overdue = isPayoutOverdue(record, todayKey)
  const dueSoon = isPayoutDueSoon(record, todayKey)
  return (
    <div className="flex flex-col gap-0.5">
      <span>{formatDate(record.dueDate)}</span>
      {overdue && <Badge variant="destructive">{t.overdueBadge}</Badge>}
      {!overdue && dueSoon && <Badge variant="warning">{t.dueSoonBadge}</Badge>}
    </div>
  )
}

function StatusCell({ record }: { record: OwnerPayoutRecord }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <OwnerPayoutStatusBadge status={record.status} />
      {record.payout && record.status !== 'PAID' && (
        <span className="text-muted-foreground text-xs">{vi.consignment.payouts.linkedBadge(record.payout.transactionCode)}</span>
      )}
    </div>
  )
}

/** Bảng khoản chi trả (desktop) + dạng card (dưới `md`). Khoản `CANCELLED` hiển thị mờ. */
export function OwnerPayoutRecordTable({ records, ownerNameOf, plateOf, contractNoOf, hideColumns = [], onSelect }: TableProps) {
  const t = vi.consignment.payouts
  const todayKey = toDateKey(new Date())
  const show = (c: PayoutColumn) => !hideColumns.includes(c)

  if (records.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{t.empty}</p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columnCode}</TableHead>
              <TableHead>{t.columnPeriod}</TableHead>
              {show('owner') && <TableHead>{vi.consignment.contractColumnOwner}</TableHead>}
              {show('vehicle') && <TableHead>{vi.consignment.contractColumnVehicle}</TableHead>}
              {show('contract') && <TableHead>{vi.consignment.contractColumnNo}</TableHead>}
              <TableHead>{t.columnRatio}</TableHead>
              <TableHead className="text-right">{t.columnMonthly}</TableHead>
              <TableHead className="text-right">{t.columnAdjustment}</TableHead>
              <TableHead className="text-right">{t.columnPayable}</TableHead>
              <TableHead>{t.columnDueDate}</TableHead>
              <TableHead>{vi.common.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id} className={cn('cursor-pointer', r.status === 'CANCELLED' && 'opacity-60')} onClick={() => onSelect(r)}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{formatPeriod(r.period)}</TableCell>
                {show('owner') && <TableCell className="max-w-48 truncate">{ownerNameOf(r.ownerId)}</TableCell>}
                {show('vehicle') && <TableCell>{plateOf(r.vehicleId)}</TableCell>}
                {show('contract') && <TableCell className="font-mono text-xs">{contractNoOf(r.contractId)}</TableCell>}
                <TableCell>
                  {r.daysCovered}/{r.daysInMonth}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{formatVnd(r.fixedMonthlyAmount)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <AdjustmentCell record={r} />
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">{formatVnd(r.amountPayable)}</TableCell>
                <TableCell>
                  <DueCell record={r} todayKey={todayKey} />
                </TableCell>
                <TableCell>
                  <StatusCell record={r} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {records.map((r) => (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            className={cn('border-border flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-sm', r.status === 'CANCELLED' && 'opacity-60')}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(r)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {r.code} · {formatPeriod(r.period)}
              </span>
              <StatusCell record={r} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {show('owner') ? ownerNameOf(r.ownerId) : plateOf(r.vehicleId)}
                {show('owner') && show('vehicle') ? ` · ${plateOf(r.vehicleId)}` : ''}
              </span>
              <span className="font-medium">{formatVnd(r.amountPayable)}</span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span>
                {r.daysCovered}/{r.daysInMonth} · {formatVnd(r.fixedMonthlyAmount)}
              </span>
              <DueCell record={r} todayKey={todayKey} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/**
 * Bảng khoản chi trả của một hợp đồng / chủ xe / xe + Sheet chi tiết — dùng cho các tab "Lịch chi trả". Tự tải dữ liệu theo
 * bộ lọc; mở Sheet bằng state cục bộ.
 */
export function OwnerPayoutRecordsPanel({
  filter,
  hideColumns,
  limit,
}: {
  filter: { contractId?: string; ownerId?: string; vehicleId?: string }
  hideColumns?: PayoutColumn[]
  /** Chỉ hiện N khoản mới nhất (không tính khoản đã huỷ). */
  limit?: number
}) {
  const { data: records, isLoading } = useOwnerPayoutRecords(filter)
  const { data: owners } = useVehicleOwners()
  const { data: contracts } = useConsignmentContracts()
  const { data: vehicles } = useVehicles()
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  const ownerNames = useMemo(() => new Map((owners ?? []).map((o) => [o.id, o.fullName])), [owners])
  const contractNos = useMemo(() => new Map((contracts ?? []).map((c) => [c.id, c.contractNo])), [contracts])
  const plates = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v.plate])), [vehicles])

  if (isLoading) return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  const shown = limit ? (records ?? []).filter((r) => r.status !== 'CANCELLED').slice(0, limit) : (records ?? [])

  return (
    <>
      <OwnerPayoutRecordTable
        records={shown}
        ownerNameOf={(id) => ownerNames.get(id) ?? id}
        plateOf={(id) => plates.get(id) ?? id}
        contractNoOf={(id) => contractNos.get(id) ?? id}
        hideColumns={hideColumns}
        onSelect={(r) => setSelectedId(r.id)}
      />
      <OwnerPayoutRecordSheet
        recordId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(undefined)}
        onOpenRecord={setSelectedId}
      />
    </>
  )
}
