import { useMemo } from 'react'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
// `rentals/index.ts` không export `RentalStatusBadge` (chỉ 5 mục theo
// `docs/CALENDAR-MANAGEMENT-PLAN.md` §9) — import thẳng, cùng tinh thần
// `RentalBlockPopover.tsx`.
import { RentalStatusBadge } from '@/features/rentals/components/RentalStatusBadge'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { formatDate, formatTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

/** `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.3 — click ô ngày (1 xe, 1 ngày) trên `CalendarMonthGrid` (CR-2026-044). */
export function DayDetailDialog({
  vehicle,
  dateIso,
  rentals,
  customers,
  open,
  onOpenChange,
}: {
  vehicle?: Vehicle
  dateIso: string | null
  rentals: Rental[]
  customers: Customer[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const sortedRentals = useMemo(() => [...rentals].sort((a, b) => a.pickupDateTime.localeCompare(b.pickupDateTime)), [rentals])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {vi.calendar.dayDetailTitle}
            {vehicle ? ` — ${vehicle.plate}` : ''}
            {dateIso ? ` (${formatDate(dateIso)})` : ''}
          </DialogTitle>
        </DialogHeader>

        {sortedRentals.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.calendar.dayDetailEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedRentals.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{customerById.get(r.customerId)?.fullName ?? r.customerId}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatTime(r.pickupDateTime)} → {formatTime(r.expectedReturnDateTime)}
                  </p>
                </div>
                <RentalStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
