import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel
// `index.ts` — deep-import thẳng `hooks.ts`, cùng tiền lệ `RentalDetailScreen`.
import { useCustomers } from '@/features/customers/hooks'
import { useRentals, type Rental } from '@/features/rentals'
import { useVehicles } from '@/features/vehicles/hooks'
import { SETTLEMENT_STATUSES, type SettlementStatus } from '@/shared/domain/enums'
import { SETTLEMENT_PAYMENT_STATUS_LABELS, SETTLEMENT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { DEFAULT_PAGE_SIZE, paginate } from '@/shared/lib/pagination'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { SettlementStatusBadge } from '../components/SettlementStatusBadge'
import { usePostSettlementCharges, useSettlements } from '../../core/hooks'
import { calcSettlementTotals } from '../../core/model'
import { summarizePscs } from '../model'
import type { PostSettlementCharge, Settlement } from '../../core/types'

/** Giá trị đại diện "Tất cả"/"Chờ mở" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'
const PENDING_OPEN = '__PENDING_OPEN__'

interface Row {
  rentalId: string
  customerName: string
  vehiclePlate: string
  settlement?: Settlement
  openedAt?: string
}

/** `WebappQuanTri.md` §11.2 — danh sách quyết toán + Rental `RETURNED` chưa mở quyết toán ("Chờ mở"). */
export function SettlementListScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [page, setPage] = useState(1)

  const { data: settlements, isLoading: loadingSettlements } = useSettlements()
  const { data: rentals, isLoading: loadingRentals } = useRentals()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()
  const { data: pscs = [] } = usePostSettlementCharges()

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const pscsBySettlementId = useMemo(() => {
    const map = new Map<string, PostSettlementCharge[]>()
    for (const p of pscs) {
      const list = map.get(p.settlementId) ?? []
      list.push(p)
      map.set(p.settlementId, list)
    }
    return map
  }, [pscs])

  const rows: Row[] = useMemo(() => {
    const result: Row[] = []
    for (const settlement of settlements ?? []) {
      const customer = customerById.get(settlement.customerId)
      const vehicle = vehicleById.get(settlement.vehicleId)
      result.push({
        rentalId: settlement.rentalId,
        customerName: customer?.fullName ?? settlement.customerId,
        vehiclePlate: vehicle?.plate ?? settlement.vehicleId,
        settlement,
        openedAt: settlement.openedAt,
      })
    }
    const settledRentalIds = new Set(result.map((r) => r.rentalId))
    for (const rental of (rentals ?? []) as Rental[]) {
      if (rental.status !== 'RETURNED' || settledRentalIds.has(rental.id)) continue
      const customer = customerById.get(rental.customerId)
      const vehicle = vehicleById.get(rental.vehicleId)
      result.push({
        rentalId: rental.id,
        customerName: customer?.fullName ?? rental.customerId,
        vehiclePlate: vehicle?.plate ?? rental.vehicleId,
      })
    }
    return result
  }, [settlements, rentals, customerById, vehicleById])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        if (status === ALL) return true
        if (status === PENDING_OPEN) return !r.settlement
        return r.settlement?.status === status
      })
      .filter((r) => q.length === 0 || r.customerName.toLowerCase().includes(q) || r.vehiclePlate.toLowerCase().includes(q))
      .sort((a, b) => (b.openedAt ?? '').localeCompare(a.openedAt ?? ''))
  }, [rows, search, status])

  const pageResult = paginate(filteredRows, page, DEFAULT_PAGE_SIZE)

  const isLoading = loadingSettlements || loadingRentals

  function openWorksheet(rentalId: string) {
    navigate(`${paths.rentalDetail(rentalId)}?tab=settlement`)
  }

  return (
    <div>
      <PageHeader title={vi.finance.settlementTitle} description={vi.finance.settlementDescription} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }} placeholder={vi.finance.searchPlaceholder} className="max-w-sm flex-1" />
        <Select value={status} onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder={vi.finance.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.finance.filterAllStatuses}</SelectItem>
            <SelectItem value={PENDING_OPEN}>{vi.finance.filterPendingOpen}</SelectItem>
            {SETTLEMENT_STATUSES.map((s: SettlementStatus) => (
              <SelectItem key={s} value={s}>
                {SETTLEMENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : filteredRows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.finance.columnRental}</TableHead>
                  <TableHead>{vi.finance.columnCustomer}</TableHead>
                  <TableHead>{vi.finance.columnVehicle}</TableHead>
                  <TableHead>{vi.finance.columnStatus}</TableHead>
                  <TableHead>{vi.finance.columnFinalAmount}</TableHead>
                  <TableHead>{vi.finance.columnBalanceDue}</TableHead>
                  <TableHead>{vi.finance.columnPaymentStatus}</TableHead>
                  <TableHead>{vi.finance.columnOpenedAt}</TableHead>
                  <TableHead>{vi.finance.columnPostSettlement}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageResult.items.map((row) => {
                  const totals = row.settlement ? row.settlement.completedTotals ?? calcSettlementTotals(row.settlement.lines, row.settlement.waivers) : undefined
                  const reconciliation = row.settlement?.completedTotals ?? row.settlement?.depositReconciliation
                  const rowPscs = row.settlement ? pscsBySettlementId.get(row.settlement.id) ?? [] : []
                  const pscSummary = summarizePscs(rowPscs)
                  const pscNet = pscSummary.openReceivable - pscSummary.openRefund
                  return (
                    <TableRow key={row.rentalId} className="cursor-pointer" onClick={() => openWorksheet(row.rentalId)}>
                      <TableCell className="font-medium">{row.rentalId}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{row.vehiclePlate}</TableCell>
                      <TableCell>
                        {row.settlement ? <SettlementStatusBadge status={row.settlement.status} /> : <span className="text-muted-foreground text-xs">{vi.finance.pendingOpenBadge}</span>}
                      </TableCell>
                      <TableCell>{totals ? formatVnd(totals.finalAmount) : '—'}</TableCell>
                      <TableCell>{reconciliation ? formatVnd(reconciliation.balanceDue) : '—'}</TableCell>
                      <TableCell>{row.settlement?.paymentStatus ? SETTLEMENT_PAYMENT_STATUS_LABELS[row.settlement.paymentStatus] : '—'}</TableCell>
                      <TableCell>{row.settlement ? formatDateTime(row.settlement.openedAt) : '—'}</TableCell>
                      <TableCell>
                        {pscSummary.openCount > 0 ? (
                          <span className={pscNet > 0 ? 'text-status-pending' : pscNet < 0 ? 'text-status-info' : 'text-muted-foreground'}>
                            {pscSummary.openCount} {vi.finance.pscSummaryOpenLabel.toLowerCase()} · {formatVnd(pscNet)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pagination className="mt-4" page={pageResult.page} pageSize={DEFAULT_PAGE_SIZE} total={filteredRows.length} onPageChange={setPage} />
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{rows.length > 0 ? vi.finance.emptyFiltered : vi.finance.emptyAll}</p>
        </div>
      )}
    </div>
  )
}
