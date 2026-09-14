import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { canCancel, type Rental } from '../model'
import { RentalStatusBadge } from './RentalStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — `CONVENTIONS.md` §8, mirror `VehicleCard`. */
export function RentalCard({
  rental,
  customer,
  vehicle,
  canConfirmAction,
  onOpen,
  onConfirm,
  onCancel,
}: {
  rental: Rental
  customer?: Customer
  vehicle?: Vehicle
  canConfirmAction: boolean
  onOpen: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Card role="button" tabIndex={0} onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{customer?.fullName ?? rental.customerId}</p>
            <p className="text-muted-foreground text-xs">
              {vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId}
            </p>
          </div>
          <RentalStatusBadge status={rental.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
        </p>
        <p className="text-sm font-medium">{formatVnd(rental.estimatedTotal)}</p>
        {canConfirmAction && (rental.status === 'DRAFT' || canCancel(rental)) && (
          // stopPropagation — thẻ toàn bộ card đã gắn onOpen, nút hành động không được kích hoạt kèm.
          <div className="mt-1 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
            {rental.status === 'DRAFT' && (
              <Button size="sm" variant="outline" onClick={onConfirm}>
                {vi.rentals.confirmAction}
              </Button>
            )}
            {canCancel(rental) && (
              <Button size="sm" variant="outline" onClick={onCancel}>
                {vi.rentals.cancelAction}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
