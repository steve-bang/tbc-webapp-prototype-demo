import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { paths } from '@/app/paths'
// `customers`/`rentals`/`handover-return` — deep-import `hooks.ts` của feature
// khác (không qua barrel `index.ts`) đúng tiền lệ `VehicleRentalHistoryTab`.
import { useCustomers } from '@/features/customers/hooks'
import { HandoverReturnStatusBadge } from '@/features/handover-return/components/HandoverReturnStatusBadge'
import { useHandoverRecords, useReturnRecords } from '@/features/handover-return/hooks'
import { useRentals } from '@/features/rentals'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Vehicle } from '../model'

/**
 * Tab "Giao/nhận" ở Vehicle Detail — `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md`
 * §5.3, mirror `VehicleRentalHistoryTab`. Đọc-only: lịch sử Handover/Return
 * của xe theo tất cả Rental, mỗi dòng link tới tab "Giao-nhận" ở Rental Detail.
 */
export function VehicleHandoverReturnTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: rentals = [] } = useRentals({ vehicleId: vehicle.id })
  const { data: customers = [] } = useCustomers()
  const { data: handovers = [] } = useHandoverRecords()
  const { data: returns = [] } = useReturnRecords()

  const rentalIds = useMemo(() => new Set(rentals.map((r) => r.id)), [rentals])
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const rentalById = useMemo(() => new Map(rentals.map((r) => [r.id, r])), [rentals])
  const returnByRentalId = useMemo(() => new Map(returns.map((r) => [r.rentalId, r])), [returns])

  const rows = useMemo(
    () =>
      handovers
        .filter((h) => rentalIds.has(h.rentalId))
        .sort((a, b) => (b.actualPickupDateTime ?? b.createdAt).localeCompare(a.actualPickupDateTime ?? a.createdAt)),
    [handovers, rentalIds],
  )

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{vi.vehicles.handoverReturnEmpty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.handoverReturn.columnCustomer}</TableHead>
            <TableHead>{vi.handoverReturn.columnPickup}</TableHead>
            <TableHead>{vi.handoverReturn.columnHandoverStatus}</TableHead>
            <TableHead>{vi.handoverReturn.columnReturn}</TableHead>
            <TableHead>{vi.handoverReturn.columnReturnStatus}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((handover) => {
            const rental = rentalById.get(handover.rentalId)
            const customer = rental ? customerById.get(rental.customerId) : undefined
            const returnRecord = returnByRentalId.get(handover.rentalId)
            return (
              <TableRow key={handover.id}>
                <TableCell className="font-medium">
                  {rental ? (
                    <Link to={paths.rentalDetail(rental.id)} className="text-primary underline underline-offset-2">
                      {customer?.fullName ?? rental.customerId}
                    </Link>
                  ) : (
                    (customer?.fullName ?? handover.rentalId)
                  )}
                </TableCell>
                <TableCell>{handover.actualPickupDateTime ? formatDateTime(handover.actualPickupDateTime) : vi.handoverReturn.noValue}</TableCell>
                <TableCell>
                  <HandoverReturnStatusBadge status={handover.status} />
                </TableCell>
                <TableCell>{returnRecord?.actualReturnDateTime ? formatDateTime(returnRecord.actualReturnDateTime) : vi.handoverReturn.noReturnValue}</TableCell>
                <TableCell>{returnRecord ? <HandoverReturnStatusBadge status={returnRecord.status} /> : vi.handoverReturn.noReturnValue}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
