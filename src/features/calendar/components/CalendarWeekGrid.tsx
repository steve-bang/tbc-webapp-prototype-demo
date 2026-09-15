import { addDays, format, isToday } from 'date-fns'
import { vi as viLocale } from 'date-fns/locale'
import { useMemo } from 'react'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { RENTAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatTime } from '@/shared/lib/datetime'
import { RentalBlockPopover } from './RentalBlockPopover'
import { isOccupyingLikeStatus, rentalsByVehicleInRange, turnaroundBufferWindow } from '../model'

/** Trục thời gian trong ngày cho mỗi ô — 24h đầy đủ (00:00 → 24:00 hôm sau). */
function dayBoundsMs(dateStr: string): { start: number; end: number } {
  const start = new Date(`${dateStr}T00:00:00`).getTime()
  const end = start + 24 * 60 * 60 * 1000
  return { start, end }
}

/** % vị trí top/height của 1 khoảng [startMs, endMs] bên trong 1 ngày — null nếu không chồng lấp. */
function positionInDay(startMs: number, endMs: number, dateStr: string): { topPct: number; heightPct: number } | null {
  const { start, end } = dayBoundsMs(dateStr)
  if (endMs <= start || startMs >= end) return null
  const clampedStart = Math.max(startMs, start)
  const clampedEnd = Math.min(endMs, end)
  const topPct = ((clampedStart - start) / (end - start)) * 100
  const heightPct = Math.max(((clampedEnd - clampedStart) / (end - start)) * 100, 4)
  return { topPct, heightPct }
}

function toDateStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.2 — trục theo xe (mỗi xe 1 hàng), 7
 * cột ngày, Rental Block vẽ theo giờ thật trong ngày (RC-BR-12 lượt nhiều
 * ngày hiển thị liền mạch — mỗi ô ngày chỉ vẽ phần chồng lấp của lượt thuê
 * trong đúng 24h ngày đó, không bo góc ở cạnh tiếp diễn). RC-BR-13 vẽ thêm
 * vùng Turnaround Buffer ngay sau khi lượt kết thúc. Lưới xe × ngày hiển thị
 * ở MỌI kích thước màn hình (chỉ cuộn ngang khi hẹp) — đồng bộ với
 * `CalendarMonthGrid.tsx`, không có layout mobile riêng.
 */
export function CalendarWeekGrid({
  weekStart,
  vehicles,
  rentals,
  showInactiveVehicles,
  highlightRentalIds,
  customerById,
  onEmptyCellClick,
}: {
  weekStart: Date
  vehicles: Vehicle[]
  rentals: Rental[]
  showInactiveVehicles: boolean
  highlightRentalIds: Set<string>
  customerById: Map<string, Customer>
  onEmptyCellClick: (vehicleId: string, pickupDateTime: string) => void
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const dayStrs = useMemo(() => days.map(toDateStr), [days])

  const visibleVehicles = useMemo(
    () => (showInactiveVehicles ? vehicles : vehicles.filter((v) => v.status !== 'INACTIVE')),
    [vehicles, showInactiveVehicles],
  )

  const rentalsByVehicle = useMemo(
    () => rentalsByVehicleInRange(rentals, dayStrs[0] ?? '', dayStrs[6] ?? ''),
    [rentals, dayStrs],
  )

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b">
          <div className="p-2 text-xs font-medium" />
          {days.map((d, i) => (
            <div
              key={dayStrs[i]}
              className={cn('border-l p-2 text-center text-xs font-medium', isToday(d) && 'bg-primary/5 text-primary')}
            >
              {format(d, 'EEEEEE dd/MM', { locale: viLocale })}
            </div>
          ))}
        </div>

        {visibleVehicles.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">{vi.vehicles.emptyAll}</p>
        ) : (
          visibleVehicles.map((vehicle) => {
            const vehicleRentals = rentalsByVehicle.get(vehicle.id) ?? []
            const occupying = vehicleRentals
              .filter((r) => isOccupyingLikeStatus(r.status))
              .sort((a, b) => a.pickupDateTime.localeCompare(b.pickupDateTime))

            return (
              <div key={vehicle.id} className="grid grid-cols-[160px_repeat(7,1fr)] border-b last:border-b-0">
                <div className="flex flex-col justify-center gap-0.5 border-r p-2">
                  <p className="truncate text-sm font-medium">{vehicle.plate}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {vehicle.brand} {vehicle.model}
                  </p>
                </div>

                {dayStrs.map((dateStr) => {
                  const blocksInDay = vehicleRentals
                    .map((r) => {
                      const startMs = new Date(r.pickupDateTime).getTime()
                      const endMs = new Date(r.expectedReturnDateTime).getTime()
                      const pos = positionInDay(startMs, endMs, dateStr)
                      return pos ? { rental: r, ...pos } : null
                    })
                    .filter((x): x is { rental: Rental; topPct: number; heightPct: number } => x !== null)

                  const bufferSegments = occupying
                    .map((r) => {
                      const win = turnaroundBufferWindow(r.expectedReturnDateTime)
                      const startMs = new Date(win.start).getTime()
                      const endMs = new Date(win.end).getTime()
                      const pos = positionInDay(startMs, endMs, dateStr)
                      return pos ? { rentalId: r.id, ...pos } : null
                    })
                    .filter((x): x is { rentalId: string; topPct: number; heightPct: number } => x !== null)

                  return (
                    // Không dùng thẻ `<button>` ở đây — bên trong còn có
                    // `RentalBlockPopover` (trigger cũng là phần tử tương
                    // tác), lồng interactive-trong-interactive không hợp lệ
                    // (HTML content model của `<button>`).
                    <div
                      key={dateStr}
                      role="button"
                      tabIndex={0}
                      className="hover:bg-accent/40 relative h-24 border-l text-left"
                      onClick={() => onEmptyCellClick(vehicle.id, `${dateStr}T09:00`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onEmptyCellClick(vehicle.id, `${dateStr}T09:00`)
                      }}
                      aria-label={`${vehicle.plate} — ${dateStr}`}
                    >
                      {bufferSegments.map((seg) => (
                        <div
                          key={`buf-${seg.rentalId}`}
                          className="border-status-neutral/40 bg-status-neutral/10 absolute inset-x-0.5 rounded-sm border border-dashed"
                          style={{ top: `${seg.topPct}%`, height: `${seg.heightPct}%` }}
                          title={vi.calendar.turnaroundBufferLabel}
                        />
                      ))}
                      {blocksInDay.map(({ rental, topPct, heightPct }) => (
                        <RentalBlockPopover
                          key={rental.id}
                          rental={rental}
                          customer={customerById.get(rental.customerId)}
                          vehicle={vehicleById.get(rental.vehicleId)}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'bg-primary/15 border-primary/40 absolute inset-x-0.5 overflow-hidden rounded-sm border px-1 py-0.5 text-[10px] leading-tight',
                              highlightRentalIds.has(rental.id) && 'ring-primary ring-2',
                            )}
                            style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                            title={`${customerById.get(rental.customerId)?.fullName ?? rental.customerId} — ${formatTime(rental.pickupDateTime)}-${formatTime(rental.expectedReturnDateTime)} — ${RENTAL_STATUS_LABELS[rental.status]}`}
                          >
                            <p className="truncate font-medium">{customerById.get(rental.customerId)?.fullName ?? rental.customerId}</p>
                            <p className="truncate">{RENTAL_STATUS_LABELS[rental.status]}</p>
                          </div>
                        </RentalBlockPopover>
                      ))}
                    </div>
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
