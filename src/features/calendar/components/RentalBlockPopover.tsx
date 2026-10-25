import { useState, type ReactNode } from 'react'
import { usePermission } from '@/features/auth'
import type { Customer } from '@/features/customers'
import { canRescheduleRental, type Rental } from '@/features/rentals'
// `rentals/index.ts` chỉ export đúng 5 mục theo `docs/CALENDAR-MANAGEMENT-PLAN.md`
// §9 (không có `RentalStatusBadge`) — import thẳng từ `components/` của feature
// đó, cùng tinh thần `maintenance/hooks.ts` import thẳng `vehicles/hooks.ts`.
import { RentalStatusBadge } from '@/features/rentals/components/RentalStatusBadge'
import type { Vehicle } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { RentalScheduleChangeDialog, type ScheduleChangeMode } from './RentalScheduleChangeDialog'

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.2 — click 1 Rental Block trên
 * `CalendarWeekGrid` → popover xem nhanh (không điều hướng, `/rentals/:id`
 * chưa build — `docs/RENTAL-MANAGEMENT-PLAN.md` §8.2). NV luôn "Chưa phân
 * công" ở Round 2 vì chưa có `Assignment` (`EA`, Round sau).
 * CALENDAR-ROUND3-PLAN.md §14.2 mục 8 — thêm nút "Dời lịch"/"Đổi xe" (UC-RC-06/07), chỉ khi `RENTAL.EDIT` và lượt chưa giao.
 */
export function RentalBlockPopover({
  rental,
  customer,
  vehicle,
  children,
}: {
  rental: Rental
  customer?: Customer
  vehicle?: Vehicle
  children: ReactNode
}) {
  const { can } = usePermission()
  const [open, setOpen] = useState(false)
  const [scheduleMode, setScheduleMode] = useState<ScheduleChangeMode | null>(null)
  const canChangeSchedule = can('RENTAL', 'EDIT') && canRescheduleRental(rental)

  function openSchedule(mode: ScheduleChangeMode) {
    setOpen(false)
    setScheduleMode(mode)
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-medium">{customer?.fullName ?? rental.customerId}</p>
              <RentalStatusBadge status={rental.status} />
            </div>
            {customer?.phone && <p className="text-muted-foreground text-xs">{customer.phone}</p>}
            <p className="text-muted-foreground text-xs">
              {vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : rental.vehicleId}
            </p>
            <div className="text-xs">
              <p className="text-muted-foreground">{vi.calendar.quickViewPeriod}</p>
              <p>
                {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
              </p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">{vi.calendar.quickViewPickupLocation}</p>
              <p>{rental.pickupLocation}</p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">{vi.calendar.quickViewReturnLocation}</p>
              <p>{rental.returnLocation}</p>
            </div>
            <div className="text-xs">
              <p className="text-muted-foreground">{vi.calendar.quickViewStaff}</p>
              <p>{vi.calendar.assignedStaffPlaceholder}</p>
            </div>
            {canChangeSchedule && (
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => openSchedule('reschedule')}>
                  {calendarLabels.rescheduleAction}
                </Button>
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => openSchedule('changeVehicle')}>
                  {calendarLabels.changeVehicleAction}
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {scheduleMode && (
        // Hộp thoại nằm trong portal nhưng sự kiện React vẫn nổi bọt lên ô lưới cha (click tạo nhanh / Enter-Space) — chặn tại đây;
        // `contents` để thẻ bọc không ảnh hưởng bố cục lưới.
        <div className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <RentalScheduleChangeDialog rental={rental} mode={scheduleMode} onClose={() => setScheduleMode(null)} />
        </div>
      )}
    </>
  )
}
