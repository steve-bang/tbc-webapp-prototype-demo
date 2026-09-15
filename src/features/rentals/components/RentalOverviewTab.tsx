import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
import { VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import type { Rental } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.rentals.noValue}</span>
    </div>
  )
}

/**
 * Tab "Tổng quan" (mặc định) — `docs/RENTAL-MANAGEMENT-PLAN.md` §15.2 dòng 1.
 * `customer`/`vehicle` đã join sẵn ở `RentalDetailScreen` (`useCustomers`/
 * `useVehicles`, cùng pattern deep-import đã dùng ở `RentalListScreen`/
 * `RentalCard`) — component này chỉ hiển thị. `vehicleClass` lấy từ snapshot
 * trên `Rental` (RM-BR-25), không phải `vehicle.vehicleClass` sống.
 */
export function RentalOverviewTab({
  rental,
  customer,
  vehicle,
}: {
  rental: Rental
  customer?: Customer
  vehicle?: Vehicle
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.rentals.sectionCustomerVehicle}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.customers.fullName} value={customer?.fullName ?? rental.customerId} />
          <Field label={vi.customers.phone} value={customer?.phone} />
          <Field label={vi.vehicles.plate} value={vehicle?.plate ?? rental.vehicleId} />
          <Field label={vi.vehicles.brand} value={vehicle?.brand} />
          <Field label={vi.vehicles.model} value={vehicle?.model} />
          <Field label={vi.vehicles.vehicleClass} value={VEHICLE_CLASS_LABELS[rental.vehicleClass]} />
        </div>

        <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.rentals.sectionPeriod}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.rentals.pickupDateTime} value={formatDateTime(rental.pickupDateTime)} />
          <Field label={vi.rentals.expectedReturnDateTime} value={formatDateTime(rental.expectedReturnDateTime)} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.rentals.sectionLocation}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.rentals.pickupLocation} value={rental.pickupLocation} />
          <Field label={vi.rentals.returnLocation} value={rental.returnLocation} />
        </div>

        {rental.note && (
          <>
            <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.rentals.sectionNote}</h3>
            <Field label={vi.rentals.note} value={rental.note} />
          </>
        )}
      </div>
    </div>
  )
}
