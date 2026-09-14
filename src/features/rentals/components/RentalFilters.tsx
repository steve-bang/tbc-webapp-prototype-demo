import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
import { RENTAL_STATUSES, type RentalStatus } from '@/shared/domain/enums'
import { RENTAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface RentalFilterValue {
  status?: RentalStatus
  customerId?: string
  vehicleId?: string
  dateFrom?: string
  dateTo?: string
}

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** §5.1 kế hoạch — 4 bộ lọc: Trạng thái / Khách hàng / Xe / Khoảng ngày (theo `pickupDateTime`). */
export function RentalFilters({
  value,
  onChange,
  customers,
  vehicles,
  className,
}: {
  value: RentalFilterValue
  onChange: (value: RentalFilterValue) => void
  customers: Customer[]
  vehicles: Vehicle[]
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Select
        value={value.status ?? ALL}
        onValueChange={(v) => onChange({ ...value, status: v === ALL ? undefined : (v as RentalStatus) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.rentals.filterStatus} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.rentals.filterAllStatuses}</SelectItem>
          {RENTAL_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {RENTAL_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.customerId ?? ALL}
        onValueChange={(v) => onChange({ ...value, customerId: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-52">
          <SelectValue placeholder={vi.rentals.filterCustomer} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.rentals.filterAllCustomers}</SelectItem>
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.fullName} — {c.phone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.vehicleId ?? ALL}
        onValueChange={(v) => onChange({ ...value, vehicleId: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder={vi.rentals.filterVehicle} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.rentals.filterAllVehicles}</SelectItem>
          {vehicles.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.plate} — {v.brand} {v.model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rental-filter-date-from" className="text-muted-foreground text-xs font-normal">
          {vi.rentals.filterDateFrom}
        </Label>
        <Input
          id="rental-filter-date-from"
          type="date"
          className="w-full sm:w-40"
          value={value.dateFrom ?? ''}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value || undefined })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rental-filter-date-to" className="text-muted-foreground text-xs font-normal">
          {vi.rentals.filterDateTo}
        </Label>
        <Input
          id="rental-filter-date-to"
          type="date"
          className="w-full sm:w-40"
          value={value.dateTo ?? ''}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value || undefined })}
        />
      </div>
    </div>
  )
}
