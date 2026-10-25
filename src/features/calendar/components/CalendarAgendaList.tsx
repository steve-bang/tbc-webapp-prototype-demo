import { Fragment, useMemo, useState } from 'react'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import { RentalStatusBadge } from '@/features/rentals/components/RentalStatusBadge'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatDateTime, formatTime, formatWeekdayShort, toDateKey } from '@/shared/lib/datetime'
import { DEFAULT_PAGE_SIZE, paginate } from '@/shared/lib/pagination'
import { Badge } from '@/shared/ui/badge'
import { Pagination } from '@/shared/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { RentalBlockPopover } from './RentalBlockPopover'
import { agendaGroups } from '../model'

interface AgendaRow {
  dateKey: string
  rental: Rental
  continuing: boolean
}

/** "HH:mm → HH:mm"; nếu giờ trả khác ngày thì kèm ngày, lượt tiếp diễn thì giờ giao kèm ngày. */
function periodLabel(rental: Rental, continuing: boolean): string {
  const pickup = continuing ? formatDateTime(rental.pickupDateTime) : formatTime(rental.pickupDateTime)
  const sameDay = toDateKey(rental.pickupDateTime) === toDateKey(rental.expectedReturnDateTime)
  const ret = sameDay ? formatTime(rental.expectedReturnDateTime) : formatDateTime(rental.expectedReturnDateTime)
  return `${pickup} → ${ret}`
}

/**
 * `docs/CALENDAR-ROUND3-PLAN.md` §13.2 mục 5 — chế độ Danh sách/Agenda (`RC` §8): lượt thuê trong phạm vi tuần, nhóm theo NGÀY GIAO
 * (`agendaGroups`, hàm thuần). Phân trang 25 dòng trên toàn danh sách phẳng. Điện thoại: thẻ; từ `md:`: bảng.
 */
export function CalendarAgendaList({
  rentals,
  fromKey,
  toKey,
  vehicleById,
  customerById,
  highlightRentalIds,
}: {
  rentals: Rental[]
  fromKey: string
  toKey: string
  vehicleById: Map<string, Vehicle>
  customerById: Map<string, Customer>
  highlightRentalIds: Set<string>
}) {
  const rangeKey = `${fromKey}|${toKey}`
  // Đổi phạm vi (tuần khác) → về trang 1, không cần effect.
  const [pageState, setPageState] = useState({ rangeKey, page: 1 })
  const page = pageState.rangeKey === rangeKey ? pageState.page : 1

  const flat = useMemo<AgendaRow[]>(
    () => agendaGroups(rentals, fromKey, toKey).flatMap((g) => g.rentals.map((x) => ({ dateKey: g.dateKey, ...x }))),
    [rentals, fromKey, toKey],
  )

  if (flat.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.calendar.agendaEmpty}</p>
      </div>
    )
  }

  const pageResult = paginate(flat, page, DEFAULT_PAGE_SIZE)
  // Nhóm lại trong trang hiện tại theo ngày (các dòng đã sắp theo ngày nên liên tiếp).
  const pageGroups: { dateKey: string; rows: AgendaRow[] }[] = []
  for (const row of pageResult.items) {
    const last = pageGroups[pageGroups.length - 1]
    if (last && last.dateKey === row.dateKey) last.rows.push(row)
    else pageGroups.push({ dateKey: row.dateKey, rows: [row] })
  }

  function renderRow(row: AgendaRow, variant: 'table' | 'card') {
    const { rental, continuing } = row
    const customer = customerById.get(rental.customerId)
    const vehicle = vehicleById.get(rental.vehicleId)
    const customerName = customer?.fullName ?? rental.customerId
    const vehicleLabel = vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId
    const highlighted = highlightRentalIds.has(rental.id)

    if (variant === 'card') {
      return (
        <RentalBlockPopover key={rental.id} rental={rental} customer={customer} vehicle={vehicle}>
          <div
            role="button"
            tabIndex={0}
            className={cn('bg-card flex min-w-0 flex-col gap-1 rounded-lg border p-3 text-sm', highlighted && 'ring-primary ring-2')}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{customerName}</p>
              <RentalStatusBadge status={rental.status} />
            </div>
            <p className="text-muted-foreground min-w-0 truncate text-xs">{vehicleLabel}</p>
            <p className="text-xs">{periodLabel(rental, continuing)}</p>
            {continuing && (
              <div>
                <Badge variant="neutral">{vi.calendar.continuingLabel}</Badge>
              </div>
            )}
          </div>
        </RentalBlockPopover>
      )
    }

    return (
      <RentalBlockPopover key={rental.id} rental={rental} customer={customer} vehicle={vehicle}>
        <TableRow role="button" tabIndex={0} className={cn('cursor-pointer', highlighted && 'ring-primary ring-2 ring-inset')}>
          <TableCell className="whitespace-nowrap">
            {periodLabel(rental, continuing)}
            {continuing && (
              <Badge variant="neutral" className="ml-2">
                {vi.calendar.continuingLabel}
              </Badge>
            )}
          </TableCell>
          <TableCell className="min-w-0">{vehicleLabel}</TableCell>
          <TableCell className="min-w-0 font-medium">{customerName}</TableCell>
          <TableCell>
            <RentalStatusBadge status={rental.status} />
          </TableCell>
        </TableRow>
      </RentalBlockPopover>
    )
  }

  const dateHeading = (dateKey: string) => `${formatWeekdayShort(dateKey)}, ${formatDate(dateKey)}`

  return (
    <div>
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.calendar.agendaColumnPeriod}</TableHead>
                <TableHead>{vi.calendar.agendaColumnVehicle}</TableHead>
                <TableHead>{vi.calendar.agendaColumnCustomer}</TableHead>
                <TableHead>{vi.calendar.agendaColumnStatus}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageGroups.map((group) => (
                <Fragment key={group.dateKey}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={4} className="text-sm font-semibold">
                      {dateHeading(group.dateKey)}
                    </TableCell>
                  </TableRow>
                  {group.rows.map((row) => renderRow(row, 'table'))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {pageGroups.map((group) => (
          <section key={group.dateKey} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{dateHeading(group.dateKey)}</h3>
            {group.rows.map((row) => renderRow(row, 'card'))}
          </section>
        ))}
      </div>

      <Pagination
        className="mt-4"
        page={pageResult.page}
        pageSize={DEFAULT_PAGE_SIZE}
        total={flat.length}
        onPageChange={(p) => setPageState({ rangeKey, page: p })}
      />
    </div>
  )
}
