import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import type { Vehicle } from '@/features/vehicles'
import { ALLOCATION_TYPE_LABELS, COST_CATEGORY_LABELS, COST_SOURCE_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { CostEntry, CostRecord } from '../model'

interface CostRow {
  key: string
  costDate: string
  entry?: CostEntry
  reversed?: CostRecord
}

export interface CostEntryTableProps {
  entries: CostEntry[]
  /** Bản nhập tay đã huỷ (chỉ truyền khi người dùng bật "Hiện bản đã huỷ"). */
  reversedRecords?: CostRecord[]
  recordById: Map<string, CostRecord>
  /** Có giá trị → hiện cột Xe (biển số); bỏ trống ở tab Chi phí của một xe. */
  vehicleById?: Map<string, Vehicle>
  onEdit: (record: CostRecord) => void
  onReverse: (record: CostRecord) => void
}

/**
 * Bảng chi phí dùng chung (màn Chi phí vận hành + tab Chi phí của xe) — `docs/REVENUE-COST-PLAN.md` §11.1.
 * Dòng `INCIDENT`/`SYSTEM` chỉ đọc (RV-BR-11 — sửa ở module nguồn). Sửa/Huỷ chỉ với bản nhập tay còn hiệu lực
 * và đủ quyền; nút thiếu quyền ẩn hẳn. Dưới `sm` hiển thị dạng card.
 */
export function CostEntryTable({ entries, reversedRecords = [], recordById, vehicleById, onEdit, onReverse }: CostEntryTableProps) {
  const { can } = usePermission()
  const canEdit = can('FINANCE_REPORT', 'EDIT')
  const canDelete = can('FINANCE_REPORT', 'DELETE')
  const showVehicle = !!vehicleById

  const rows: CostRow[] = [
    ...entries.map((entry): CostRow => ({ key: entry.id, costDate: entry.costDate, entry })),
    ...reversedRecords.map((reversed): CostRow => ({ key: `rev:${reversed.id}`, costDate: reversed.costDate, reversed })),
  ].sort((a, b) => b.costDate.localeCompare(a.costDate))

  function sourceCell(row: CostRow) {
    if (row.reversed) return <span className="font-mono text-xs">{row.reversed.code}</span>
    const entry = row.entry
    if (!entry) return null
    const label = COST_SOURCE_LABELS[entry.source]
    let code: React.ReactNode = <span className="font-mono text-xs">{entry.sourceLabel}</span>
    if (entry.sourceRef.incidentId) {
      code = (
        <Link to={paths.incidentDetail(entry.sourceRef.incidentId)} className="text-primary font-mono text-xs hover:underline">
          {entry.sourceLabel}
        </Link>
      )
    } else if (entry.sourceRef.consignmentContractId) {
      // Chi trả chủ xe ký gửi — dẫn tới hợp đồng ký gửi nguồn (RV-BR-19).
      code = (
        <Link to={paths.consignmentContractDetail(entry.sourceRef.consignmentContractId)} className="text-primary font-mono text-xs hover:underline">
          {entry.sourceLabel}
        </Link>
      )
    } else if (entry.source === 'SYSTEM') {
      code = (
        <Link to={paths.maintenance} className="text-primary text-xs hover:underline">
          {entry.sourceLabel}
        </Link>
      )
    }
    return (
      <div className="flex min-w-0 flex-col">
        {code}
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
    )
  }

  function tags(row: CostRow) {
    const slice = row.entry?.slice
    const unusual = row.entry?.isUnusual ?? row.reversed?.isUnusual
    return (
      <div className="flex flex-wrap gap-1">
        {slice && <Badge variant="info">{vi.finance.revenueCost.sliceLabel.replace('{index}', String(slice.index)).replace('{total}', String(slice.total))}</Badge>}
        {unusual && <Badge variant="warning">{vi.finance.revenueCost.unusualBadge}</Badge>}
        {row.reversed && <Badge variant="neutral">{vi.finance.revenueCost.reversedBadge}</Badge>}
      </div>
    )
  }

  function actions(row: CostRow) {
    if (row.reversed) {
      return <span className="text-muted-foreground text-xs">{vi.finance.revenueCost.reverseReasonLine.replace('{reason}', row.reversed.reverseReason ?? '')}</span>
    }
    const entry = row.entry
    if (!entry) return null
    if (entry.source !== 'MANUAL') return <span className="text-muted-foreground text-xs">{vi.finance.revenueCost.sourceReadOnlyNote}</span>
    const record = entry.sourceRef.costRecordId ? recordById.get(entry.sourceRef.costRecordId) : undefined
    if (!record || record.status !== 'ACTIVE') return null
    return (
      <div className="flex gap-1.5">
        {canEdit && (
          <Button type="button" size="sm" variant="outline" onClick={() => onEdit(record)}>
            {vi.finance.revenueCost.edit}
          </Button>
        )}
        {canDelete && (
          <Button type="button" size="sm" variant="outline" onClick={() => onReverse(record)}>
            {vi.finance.revenueCost.reverse}
          </Button>
        )}
      </div>
    )
  }

  function rowInfo(row: CostRow) {
    const category = row.entry?.category ?? row.reversed?.category
    const allocation = row.entry?.allocationType ?? row.reversed?.allocationType
    const vehicleId = row.entry?.vehicleId ?? row.reversed?.vehicleId
    const rentalId = row.entry?.rentalId ?? row.reversed?.rentalId
    const amount = row.entry?.amount ?? row.reversed?.amount ?? 0
    return {
      category: category ? COST_CATEGORY_LABELS[category] : '—',
      allocation: allocation ? ALLOCATION_TYPE_LABELS[allocation] : '—',
      plate: vehicleId ? (vehicleById?.get(vehicleId)?.plate ?? vehicleId) : '—',
      rentalId,
      amount,
    }
  }

  function rentalLink(rentalId?: string) {
    if (!rentalId) return '—'
    return (
      <Link to={paths.rentalDetail(rentalId)} className="text-primary font-mono text-xs hover:underline">
        {rentalId}
      </Link>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{vi.finance.revenueCost.columnDate}</TableHead>
              <TableHead>{vi.finance.revenueCost.columnSource}</TableHead>
              <TableHead>{vi.finance.revenueCost.columnCategory}</TableHead>
              <TableHead>{vi.finance.revenueCost.columnAllocation}</TableHead>
              {showVehicle && <TableHead>{vi.finance.revenueCost.columnVehicle}</TableHead>}
              <TableHead>{vi.finance.revenueCost.columnRental}</TableHead>
              <TableHead className="text-right">{vi.finance.revenueCost.columnAmount}</TableHead>
              <TableHead />
              <TableHead>{vi.finance.revenueCost.columnActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const info = rowInfo(row)
              return (
                <TableRow key={row.key} className={cn(row.reversed && 'text-muted-foreground')}>
                  <TableCell className="whitespace-nowrap">{formatDate(row.costDate)}</TableCell>
                  <TableCell>{sourceCell(row)}</TableCell>
                  <TableCell>{info.category}</TableCell>
                  <TableCell>{info.allocation}</TableCell>
                  {showVehicle && <TableCell className="whitespace-nowrap">{info.plate}</TableCell>}
                  <TableCell>{rentalLink(info.rentalId)}</TableCell>
                  <TableCell className={cn('text-right whitespace-nowrap', row.reversed && 'line-through')}>{formatVnd(info.amount)}</TableCell>
                  <TableCell>{tags(row)}</TableCell>
                  <TableCell>{actions(row)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => {
          const info = rowInfo(row)
          return (
            <div key={row.key} className={cn('border-border flex flex-col gap-2 rounded-md border p-3 text-sm', row.reversed && 'text-muted-foreground')}>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">{sourceCell(row)}</span>
                <span className={cn('font-medium', row.reversed && 'line-through')}>{formatVnd(info.amount)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{info.category}</span>
                <span className="text-muted-foreground text-xs">{formatDate(row.costDate)}</span>
              </div>
              <div className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
                <span>{info.allocation}</span>
                {showVehicle && <span>· {info.plate}</span>}
                {info.rentalId && <span>· {rentalLink(info.rentalId)}</span>}
              </div>
              {tags(row)}
              {actions(row)}
            </div>
          )
        })}
      </div>
    </>
  )
}
