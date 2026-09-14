import { CUSTOMER_STATUSES } from '@/shared/domain/enums'
import type { CustomerStatus } from '@/shared/domain/enums'
import { CUSTOMER_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

export interface CustomerFilterValue {
  status?: CustomerStatus
}

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** `UC-CM-01`/`UC-CM-02` — lọc theo Trạng thái. */
export function CustomerFilters({
  value,
  onChange,
  className,
}: {
  value: CustomerFilterValue
  onChange: (value: CustomerFilterValue) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={value.status ?? ALL}
        onValueChange={(v) => onChange({ ...value, status: v === ALL ? undefined : (v as CustomerStatus) })}
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={vi.customers.filterStatus} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{vi.customers.filterAllStatuses}</SelectItem>
          {CUSTOMER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {CUSTOMER_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
