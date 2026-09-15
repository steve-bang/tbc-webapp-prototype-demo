import { useMemo } from 'react'
import { RentalStatusBadge } from '@/features/rentals/components/RentalStatusBadge'
import { useRentals } from '@/features/rentals'
// `vehicles` chưa export `useVehicles` qua barrel `index.ts` nên import thẳng
// từ `hooks.ts` của feature đó — cùng tinh thần `calendar/screens/CalendarScreen.tsx`.
import { useVehicles } from '@/features/vehicles/hooks'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Customer } from '../model'

/**
 * Tab "Thuê xe" của Customer Detail — nối `RentalManagement` (Phase 2,
 * `DONE`) thay placeholder cũ. Chỉ hiển thị (read-only), không có action —
 * mirror cấu trúc bảng của `VehicleRentalHistoryTab.tsx`. Mới nhất trước
 * (`pickupDateTime` giảm dần).
 */
export function CustomerRentalHistoryTab({ customer }: { customer: Customer }) {
  const { data: rentals = [] } = useRentals({ customerId: customer.id })
  const { data: vehicles = [] } = useVehicles()

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  const sortedRentals = useMemo(
    () => [...rentals].sort((a, b) => b.pickupDateTime.localeCompare(a.pickupDateTime)),
    [rentals],
  )

  if (sortedRentals.length === 0) {
    return <p className="text-muted-foreground text-sm">{vi.customers.rentalHistoryEmpty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.rentals.columnVehicle}</TableHead>
            <TableHead>{vi.rentals.columnPeriod}</TableHead>
            <TableHead>{vi.common.status}</TableHead>
            <TableHead>{vi.rentals.columnTotal}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRentals.map((rental) => {
            const vehicle = vehicleById.get(rental.vehicleId)
            return (
              <TableRow key={rental.id}>
                <TableCell className="font-medium">
                  {vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId}
                </TableCell>
                <TableCell>
                  {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
                </TableCell>
                <TableCell>
                  <RentalStatusBadge status={rental.status} />
                </TableCell>
                <TableCell>{formatVnd(rental.estimatedTotal)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
