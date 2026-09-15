import { useMemo } from 'react'
// `customers` chưa export `useCustomers` qua barrel `index.ts` nên import thẳng
// từ `hooks.ts` của feature đó — cùng tinh thần `calendar/screens/CalendarScreen.tsx`.
import { useCustomers } from '@/features/customers/hooks'
import { RentalStatusBadge } from '@/features/rentals/components/RentalStatusBadge'
import { useRentals } from '@/features/rentals'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Vehicle } from '../model'

/**
 * Tab "Lịch sử thuê" của Vehicle Detail — nối `RentalManagement` (Phase 2,
 * `DONE`) thay placeholder cũ. Chỉ hiển thị (read-only), không có action —
 * mirror cấu trúc bảng của `VehicleMaintenanceTab.tsx`. Mới nhất trước
 * (`pickupDateTime` giảm dần).
 */
export function VehicleRentalHistoryTab({ vehicle }: { vehicle: Vehicle }) {
  const { data: rentals = [] } = useRentals({ vehicleId: vehicle.id })
  const { data: customers = [] } = useCustomers()

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const sortedRentals = useMemo(
    () => [...rentals].sort((a, b) => b.pickupDateTime.localeCompare(a.pickupDateTime)),
    [rentals],
  )

  if (sortedRentals.length === 0) {
    return <p className="text-muted-foreground text-sm">{vi.vehicles.rentalHistoryEmpty}</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.rentals.columnCustomer}</TableHead>
            <TableHead>{vi.rentals.columnPeriod}</TableHead>
            <TableHead>{vi.common.status}</TableHead>
            <TableHead>{vi.rentals.columnTotal}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRentals.map((rental) => (
            <TableRow key={rental.id}>
              <TableCell className="font-medium">
                {customerById.get(rental.customerId)?.fullName ?? rental.customerId}
              </TableCell>
              <TableCell>
                {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
              </TableCell>
              <TableCell>
                <RentalStatusBadge status={rental.status} />
              </TableCell>
              <TableCell>{formatVnd(rental.estimatedTotal)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
