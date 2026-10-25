import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useMemo, type ReactNode } from 'react'
import { usePermission } from '@/features/auth'
import type { Customer } from '@/features/customers'
import { canRescheduleRental, type Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { RENTAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDate, formatTime, formatWeekdayShort, startOfDayIso, todayKey } from '@/shared/lib/datetime'
import { RentalBlockPopover } from './RentalBlockPopover'
import { cellDropId, rentalDragId, type DndGhost } from '../dndModel'
import { isOccupyingLikeStatus, rentalsByVehicleInRange, turnaroundBufferWindow, weekDayKeys } from '../model'

/** Trục thời gian trong ngày cho mỗi ô — 24h đầy đủ (00:00 → 24:00 hôm sau). */
function dayBoundsMs(dateStr: string): { start: number; end: number } {
  const start = Date.parse(startOfDayIso(dateStr)) // N8 — 00:00 +07 của ngày (trước đây 00:00 giờ trình duyệt)
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

/** Ô ngày × xe — vùng thả (`useDroppable`, Round B2); nhấp ô trống vẫn tạo nhanh như cũ. */
function WeekCell({
  vehicleId,
  dateStr,
  label,
  onActivate,
  children,
}: {
  vehicleId: string
  dateStr: string
  label: string
  onActivate: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellDropId(vehicleId, dateStr) })
  return (
    // Không dùng thẻ `<button>` ở đây — bên trong còn có
    // `RentalBlockPopover` (trigger cũng là phần tử tương
    // tác), lồng interactive-trong-interactive không hợp lệ
    // (HTML content model của `<button>`).
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      className={cn('hover:bg-accent/40 relative h-24 border-l text-left', isOver && 'bg-primary/15 ring-primary ring-1 ring-inset')}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onActivate()
      }}
      aria-label={label}
    >
      {children}
    </div>
  )
}

/**
 * Mảnh khối lượt thuê trong 1 ô ngày. Kéo MẢNH BẤT KỲ của lượt nhiều ngày = dời cả lượt theo độ lệch ngày (Round B2).
 * `canDrag` = `can('RENTAL','EDIT') && canRescheduleRental(rental)` — lượt không kéo được giữ nguyên hành vi cũ (chỉ mở popover).
 */
function WeekBlock({
  rental,
  dayKey,
  topPct,
  heightPct,
  canDrag,
  highlighted,
  customer,
  vehicle,
}: {
  rental: Rental
  dayKey: string
  topPct: number
  heightPct: number
  canDrag: boolean
  highlighted: boolean
  customer?: Customer
  vehicle?: Vehicle
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: rentalDragId(rental.id, dayKey),
    disabled: !canDrag,
    attributes: { roleDescription: calendarLabels.dragRoleDescription },
  })
  const customerName = customer?.fullName ?? rental.customerId
  return (
    <RentalBlockPopover rental={rental} customer={customer} vehicle={vehicle}>
      <div
        ref={setNodeRef}
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        role="button"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={
          canDrag
            ? (e) => {
                listeners?.onKeyDown?.(e)
                // Space/Enter nhấc khối bằng bàn phím — không để nổi bọt lên ô (sẽ mở tạo nhanh).
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
              }
            : undefined
        }
        className={cn(
          'bg-primary/15 border-primary/40 absolute inset-x-0.5 overflow-hidden rounded-sm border px-1 py-0.5 text-[10px] leading-tight',
          canDrag && 'cursor-grab touch-manipulation',
          isDragging && 'opacity-40',
          highlighted && 'ring-primary ring-2',
        )}
        style={{ top: `${topPct}%`, height: `${heightPct}%` }}
        title={`${customerName} — ${formatTime(rental.pickupDateTime)}-${formatTime(rental.expectedReturnDateTime)} — ${RENTAL_STATUS_LABELS[rental.status]}`}
      >
        <p className="truncate font-medium">{customerName}</p>
        <p className="truncate">{RENTAL_STATUS_LABELS[rental.status]}</p>
      </div>
    </RentalBlockPopover>
  )
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
  anchorKey,
  vehicles,
  rentals,
  showInactiveVehicles,
  highlightRentalIds,
  customerById,
  ghost,
  onEmptyCellClick,
}: {
  /** Date key (+07) bất kỳ trong tuần cần hiển thị. */
  anchorKey: string
  vehicles: Vehicle[]
  rentals: Rental[]
  showInactiveVehicles: boolean
  highlightRentalIds: Set<string>
  customerById: Map<string, Customer>
  /** Bóng mờ viền nét đứt ở vị trí đề xuất trong lúc hộp thoại dời lịch / đổi xe mở (Round B2). */
  ghost?: DndGhost
  onEmptyCellClick: (vehicleId: string, pickupDateTime: string) => void
}) {
  const { can } = usePermission()
  const canEdit = can('RENTAL', 'EDIT')
  const dayStrs = useMemo(() => weekDayKeys(anchorKey), [anchorKey])
  const today = todayKey()

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
          {dayStrs.map((d) => (
            <div
              key={d}
              className={cn('border-l p-2 text-center text-xs font-medium', d === today && 'bg-primary/5 text-primary')}
            >
              {formatWeekdayShort(d)} {formatDate(d).slice(0, 5)}
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

                  const ghostPos = ghost && ghost.vehicleId === vehicle.id
                    ? positionInDay(Date.parse(ghost.pickupDateTime), Date.parse(ghost.expectedReturnDateTime), dateStr)
                    : null

                  return (
                    <WeekCell
                      key={dateStr}
                      vehicleId={vehicle.id}
                      dateStr={dateStr}
                      label={`${vehicle.plate} — ${dateStr}`}
                      onActivate={() => onEmptyCellClick(vehicle.id, `${dateStr}T09:00`)}
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
                        <WeekBlock
                          key={rental.id}
                          rental={rental}
                          dayKey={dateStr}
                          topPct={topPct}
                          heightPct={heightPct}
                          canDrag={canEdit && canRescheduleRental(rental)}
                          highlighted={highlightRentalIds.has(rental.id)}
                          customer={customerById.get(rental.customerId)}
                          vehicle={vehicleById.get(rental.vehicleId)}
                        />
                      ))}
                      {ghostPos && (
                        <div
                          className="border-primary bg-primary/10 pointer-events-none absolute inset-x-0.5 z-10 rounded-sm border-2 border-dashed"
                          style={{ top: `${ghostPos.topPct}%`, height: `${ghostPos.heightPct}%` }}
                          title={calendarLabels.dragGhostCaption}
                          aria-hidden
                        />
                      )}
                    </WeekCell>
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
