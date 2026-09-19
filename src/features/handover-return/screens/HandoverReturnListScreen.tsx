import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
// `rentals`/`customers`/`vehicles` — deep-import `hooks.ts` của feature khác
// (không qua barrel `index.ts`) đúng tiền lệ `RentalListScreen`/
// `VehicleRentalHistoryTab` (`CONVENTIONS.md` §3, ngoại lệ cho lớp `hooks.ts`).
import { useCustomers } from '@/features/customers/hooks'
import { useRentals } from '@/features/rentals'
import { useVehicles } from '@/features/vehicles/hooks'
import { HANDOVER_RETURN_STATUSES, type HandoverReturnStatus } from '@/shared/domain/enums'
import { HANDOVER_RETURN_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { HandoverReturnStatusBadge } from '../components/HandoverReturnStatusBadge'
import { useHandoverRecords, useReturnRecords } from '../hooks'

/** Radix Select không cho phép value rỗng — dùng sentinel cho tuỳ chọn "Tất cả". */
const ALL = '__ALL__'

interface FilterValue {
  handoverStatus?: HandoverReturnStatus
  returnStatus?: HandoverReturnStatus
  dateFrom?: string
  dateTo?: string
}

/**
 * `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §5.1 — màn "Theo dõi giao/nhận",
 * danh sách theo Rental (1 hàng/Rental có ít nhất 1 `HandoverRecord`). Không
 * có route detail riêng — click hàng mở thẳng tab "Giao-nhận" ở Rental Detail
 * (§5.2, `RentalHandoverReturnTab`).
 */
export function HandoverReturnListScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>({})

  const { data: handovers, isLoading } = useHandoverRecords()
  const { data: returns } = useReturnRecords()
  const { data: rentals = [] } = useRentals()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const rentalById = useMemo(() => new Map(rentals.map((r) => [r.id, r])), [rentals])
  const returnByRentalId = useMemo(() => new Map((returns ?? []).map((r) => [r.rentalId, r])), [returns])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (handovers ?? [])
      .map((handover) => {
        const rental = rentalById.get(handover.rentalId)
        const customer = rental ? customerById.get(rental.customerId) : undefined
        const vehicle = rental ? vehicleById.get(rental.vehicleId) : undefined
        const returnRecord = returnByRentalId.get(handover.rentalId)
        return { handover, rental, customer, vehicle, returnRecord }
      })
      .filter(({ rental, customer, vehicle, handover, returnRecord }) => {
        if (filter.handoverStatus && handover.status !== filter.handoverStatus) return false
        if (filter.returnStatus && returnRecord?.status !== filter.returnStatus) return false
        if (filter.dateFrom && (!handover.actualPickupDateTime || handover.actualPickupDateTime.slice(0, 10) < filter.dateFrom))
          return false
        if (filter.dateTo && (!handover.actualPickupDateTime || handover.actualPickupDateTime.slice(0, 10) > filter.dateTo))
          return false
        if (q.length > 0) {
          const haystack = [customer?.fullName, customer?.phone, vehicle?.plate].filter(Boolean).join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return !!rental
      })
      .sort((a, b) => (b.handover.actualPickupDateTime ?? '').localeCompare(a.handover.actualPickupDateTime ?? ''))
  }, [handovers, rentalById, customerById, vehicleById, returnByRentalId, filter, search])

  const hasAnyRow = (handovers?.length ?? 0) > 0
  const hasActiveFilter = !!(search.trim() || filter.handoverStatus || filter.returnStatus || filter.dateFrom || filter.dateTo)

  function openDetail(rentalId: string) {
    navigate(paths.rentalDetail(rentalId))
  }

  return (
    <div>
      <PageHeader title={vi.handoverReturn.title} description={vi.handoverReturn.description} />

      <div className="mb-4 flex flex-col gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={vi.handoverReturn.searchPlaceholder}
        />
        <div className="flex flex-wrap gap-2">
          <Select
            value={filter.handoverStatus ?? ALL}
            onValueChange={(v) => setFilter((f) => ({ ...f, handoverStatus: v === ALL ? undefined : (v as HandoverReturnStatus) }))}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={vi.handoverReturn.filterHandoverStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.handoverReturn.filterAllStatuses}</SelectItem>
              {HANDOVER_RETURN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {HANDOVER_RETURN_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filter.returnStatus ?? ALL}
            onValueChange={(v) => setFilter((f) => ({ ...f, returnStatus: v === ALL ? undefined : (v as HandoverReturnStatus) }))}
          >
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder={vi.handoverReturn.filterReturnStatus} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{vi.handoverReturn.filterAllStatuses}</SelectItem>
              {HANDOVER_RETURN_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {HANDOVER_RETURN_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hr-filter-date-from" className="text-muted-foreground text-xs font-normal">
              {vi.handoverReturn.filterDateFrom}
            </Label>
            <Input
              id="hr-filter-date-from"
              type="date"
              className="w-full sm:w-40"
              value={filter.dateFrom ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hr-filter-date-to" className="text-muted-foreground text-xs font-normal">
              {vi.handoverReturn.filterDateTo}
            </Label>
            <Input
              id="hr-filter-date-to"
              type="date"
              className="w-full sm:w-40"
              value={filter.dateTo ?? ''}
              onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.handoverReturn.columnCustomer}</TableHead>
                <TableHead>{vi.handoverReturn.columnVehicle}</TableHead>
                <TableHead>{vi.handoverReturn.columnPickup}</TableHead>
                <TableHead>{vi.handoverReturn.columnHandoverStatus}</TableHead>
                <TableHead>{vi.handoverReturn.columnReturn}</TableHead>
                <TableHead>{vi.handoverReturn.columnReturnStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ handover, rental, customer, vehicle, returnRecord }) => (
                <TableRow key={handover.id} className="cursor-pointer" onClick={() => rental && openDetail(rental.id)}>
                  <TableCell className="font-medium">{customer?.fullName ?? rental?.customerId}</TableCell>
                  <TableCell>{vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental?.vehicleId}</TableCell>
                  <TableCell>{handover.actualPickupDateTime ? formatDateTime(handover.actualPickupDateTime) : vi.handoverReturn.noValue}</TableCell>
                  <TableCell>
                    <HandoverReturnStatusBadge status={handover.status} />
                  </TableCell>
                  <TableCell>
                    {returnRecord?.actualReturnDateTime ? formatDateTime(returnRecord.actualReturnDateTime) : vi.handoverReturn.noReturnValue}
                  </TableCell>
                  <TableCell>
                    {returnRecord ? <HandoverReturnStatusBadge status={returnRecord.status} /> : vi.handoverReturn.noReturnValue}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">
            {hasAnyRow && hasActiveFilter ? vi.handoverReturn.emptyFiltered : vi.handoverReturn.emptyAll}
          </p>
        </div>
      )}
    </div>
  )
}
