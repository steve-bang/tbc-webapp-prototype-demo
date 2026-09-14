import { OWNERSHIP_TYPES, VEHICLE_CLASSES, VEHICLE_STATUSES } from '@/shared/domain/enums'
import type { OwnershipType, VehicleClass, VehicleStatus } from '@/shared/domain/enums'
import { OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, VEHICLE_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface VehicleFilterValue {
  status?: VehicleStatus
  brand?: string
  vehicleClass?: VehicleClass
  ownershipType?: OwnershipType
}

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** BRD §2 — 4 bộ lọc: Trạng thái / Hãng / Vehicle Class / Ownership Type. */
export function VehicleFilters({
  value,
  onChange,
  brands,
  className,
}: {
  value: VehicleFilterValue
  onChange: (value: VehicleFilterValue) => void
  brands: string[]
  className?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={value.status ?? ALL}
        onValueChange={(v) => onChange({ ...value, status: v === ALL ? undefined : (v as VehicleStatus) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.vehicles.filterStatus} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.vehicles.filterAllStatuses}</SelectItem>
          {VEHICLE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {VEHICLE_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.brand ?? ALL}
        onValueChange={(v) => onChange({ ...value, brand: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.vehicles.filterBrand} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.vehicles.filterAllBrands}</SelectItem>
          {brands.map((brand) => (
            <SelectItem key={brand} value={brand}>
              {brand}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.vehicleClass ?? ALL}
        onValueChange={(v) => onChange({ ...value, vehicleClass: v === ALL ? undefined : (v as VehicleClass) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.vehicles.filterClass} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.vehicles.filterAllClasses}</SelectItem>
          {VEHICLE_CLASSES.map((vehicleClass) => (
            <SelectItem key={vehicleClass} value={vehicleClass}>
              {VEHICLE_CLASS_LABELS[vehicleClass]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.ownershipType ?? ALL}
        onValueChange={(v) => onChange({ ...value, ownershipType: v === ALL ? undefined : (v as OwnershipType) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.vehicles.filterOwnership} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.vehicles.filterAllOwnership}</SelectItem>
          {OWNERSHIP_TYPES.map((ownershipType) => (
            <SelectItem key={ownershipType} value={ownershipType}>
              {OWNERSHIP_TYPE_LABELS[ownershipType]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
