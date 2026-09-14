import { eachDayOfInterval, endOfMonth, format, isToday, startOfMonth } from 'date-fns'
import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { rentalsByVehicleInRange, type VehicleBlock } from '../model'

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** Block `ACTIVE` đang phủ `dateStr` (so sánh chuỗi ngày) cho 1 xe — `undefined` nếu không bị khoá. */
function activeBlockForDate(blocks: VehicleBlock[], vehicleId: string, dateStr: string): VehicleBlock | undefined {
  return blocks.find(
    (b) => b.vehicleId === vehicleId && b.status === 'ACTIVE' && dateStr >= b.startDate && dateStr <= (b.endDate ?? '9999-12-31'),
  )
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.3 — mỗi xe 1 dòng, mỗi ngày trong
 * tháng 1 cột (CR-2026-017/044). Ô rút gọn (chấm/số lượt, không vẽ chi tiết
 * như Week). Vehicle Block phủ lên ô ngày bị khoá — khác màu/kiểu Rental
 * Block (§18 BRD).
 */
export function CalendarMonthGrid({
  monthDate,
  vehicles,
  rentals,
  blocks,
  showInactiveVehicles,
  highlightRentalIds,
  onEmptyCellClick,
  onBlockedCellClick,
  onDayCellClick,
}: {
  monthDate: Date
  vehicles: Vehicle[]
  rentals: Rental[]
  blocks: VehicleBlock[]
  showInactiveVehicles: boolean
  highlightRentalIds: Set<string>
  onEmptyCellClick: (vehicleId: string, pickupDateTime: string) => void
  onBlockedCellClick: (block: VehicleBlock) => void
  onDayCellClick: (vehicle: Vehicle, dateStr: string, rentalsForCell: Rental[]) => void
}) {
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) }), [monthDate])
  const dayStrs = useMemo(() => days.map(toDateStr), [days])

  const visibleVehicles = useMemo(
    () => (showInactiveVehicles ? vehicles : vehicles.filter((v) => v.status !== 'INACTIVE')),
    [vehicles, showInactiveVehicles],
  )

  const rentalsByVehicle = useMemo(
    () => rentalsByVehicleInRange(rentals, dayStrs[0] ?? '', dayStrs[dayStrs.length - 1] ?? ''),
    [rentals, dayStrs],
  )

  const gridTemplateColumns = `160px repeat(${days.length}, minmax(26px, 1fr))`

  return (
    <div className="overflow-x-auto rounded-md border">
      <div style={{ minWidth: `${160 + days.length * 26}px` }}>
        <div className="grid border-b" style={{ gridTemplateColumns }}>
          <div className="p-2 text-xs font-medium" />
          {days.map((d, i) => (
            <div
              key={dayStrs[i]}
              className={cn('border-l p-1 text-center text-[10px] font-medium', isToday(d) && 'bg-primary/5 text-primary')}
            >
              {format(d, 'd')}
            </div>
          ))}
        </div>

        {visibleVehicles.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{vi.vehicles.emptyAll}</p>
        ) : (
          visibleVehicles.map((vehicle) => {
            const vehicleRentals = rentalsByVehicle.get(vehicle.id) ?? []
            return (
              <div key={vehicle.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns }}>
                <div className="flex flex-col justify-center gap-0.5 border-r p-2">
                  <p className="truncate text-sm font-medium">{vehicle.plate}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {vehicle.brand} {vehicle.model}
                  </p>
                </div>

                {dayStrs.map((dateStr) => {
                  const block = activeBlockForDate(blocks, vehicle.id, dateStr)
                  const rentalsForCell = vehicleRentals.filter((r) => {
                    const rentalStart = r.pickupDateTime.slice(0, 10)
                    const rentalEnd = r.expectedReturnDateTime.slice(0, 10)
                    return rentalStart <= dateStr && dateStr <= rentalEnd
                  })
                  const highlighted = rentalsForCell.some((r) => highlightRentalIds.has(r.id))

                  if (block) {
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        className="border-destructive/30 bg-destructive/10 hover:bg-destructive/20 flex h-9 items-center justify-center border-l"
                        onClick={() => onBlockedCellClick(block)}
                        title={block.reason}
                        aria-label={`${vehicle.plate} — ${dateStr} — ${vi.calendar.blockDetailTitle}`}
                      >
                        <Lock className="text-destructive size-3" />
                      </button>
                    )
                  }

                  if (rentalsForCell.length > 0) {
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        className={cn(
                          'hover:bg-accent/50 flex h-9 items-center justify-center border-l',
                          highlighted && 'ring-primary ring-2 ring-inset',
                        )}
                        onClick={() => onDayCellClick(vehicle, dateStr, rentalsForCell)}
                        aria-label={`${vehicle.plate} — ${dateStr} — ${rentalsForCell.length} lượt`}
                      >
                        {rentalsForCell.length === 1 ? (
                          <span className="bg-primary size-2 rounded-full" />
                        ) : (
                          <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[9px] font-medium">
                            {rentalsForCell.length}
                          </span>
                        )}
                      </button>
                    )
                  }

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      className="hover:bg-accent/40 h-9 border-l"
                      onClick={() => onEmptyCellClick(vehicle.id, `${dateStr}T09:00`)}
                      aria-label={`${vehicle.plate} — ${dateStr}`}
                    />
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
