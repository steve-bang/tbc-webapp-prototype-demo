import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

/** Giá trị đại diện "Tất cả xe" trong Select — Radix Select không cho phép value rỗng. */
export const ALL_VEHICLES = '__ALL__'

/** Bộ lọc theo xe dùng chung cho cả 2 tab — MT §5.1. */
export function VehicleFilterSelect({
  vehicles,
  value,
  onChange,
  className,
}: {
  vehicles: Vehicle[]
  value: string | undefined
  onChange: (vehicleId: string | undefined) => void
  className?: string
}) {
  return (
    <Select value={value ?? ALL_VEHICLES} onValueChange={(v) => onChange(v === ALL_VEHICLES ? undefined : v)}>
      <SelectTrigger className={className ?? 'w-full sm:w-64'}>
        <SelectValue placeholder={vi.maintenance.filterVehicle} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VEHICLES}>{vi.maintenance.filterAllVehicles}</SelectItem>
        {vehicles.map((vehicle) => (
          <SelectItem key={vehicle.id} value={vehicle.id}>
            {vehicle.plate} — {vehicle.brand} {vehicle.model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
