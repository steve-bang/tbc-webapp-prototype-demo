import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback, useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { usePermission } from '@/features/auth'
import { canRescheduleRental, type Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { toDateKey, todayKey } from '@/shared/lib/datetime'
import { cellDropId, ghostCoversDay, rentalDragId, type DndGhost } from '../dndModel'
import { monthGridKeys, rentalsByVehicleInRange, type VehicleBlock } from '../model'

/** Block `ACTIVE` đang phủ `dateStr` (so sánh chuỗi ngày) cho 1 xe — `undefined` nếu không bị khoá. */
function activeBlockForDate(blocks: VehicleBlock[], vehicleId: string, dateStr: string): VehicleBlock | undefined {
  return blocks.find(
    (b) => b.vehicleId === vehicleId && b.status === 'ACTIVE' && dateStr >= b.startDate && dateStr <= (b.endDate ?? '9999-12-31'),
  )
}

const GHOST_CELL = 'outline-primary outline-2 -outline-offset-2 outline-dashed'
const OVER_CELL = 'bg-primary/20 ring-primary ring-1 ring-inset'

interface MonthCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'id'> {
  vehicleId: string
  dateStr: string
  ghostHere: boolean
  children?: ReactNode
}

/** Ô ngày × xe là vùng thả (`useDroppable`, Round B2) — kể cả ô khoá / ô trống: thả vào đó để hộp thoại B1 hiện lỗi (EX-01). */
function DropCell({ vehicleId, dateStr, ghostHere, className, children, ...rest }: MonthCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: cellDropId(vehicleId, dateStr) })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(className, ghostHere && GHOST_CELL, isOver && OVER_CELL)}
      title={ghostHere ? calendarLabels.dragGhostCaption : undefined}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * Ô có ĐÚNG MỘT lượt kéo được: cả ô vừa là vùng thả vừa là tay kéo của lượt đó (ô ~26 px, không vẽ khối riêng).
 * Ô nhiều lượt không kéo từ lưới Tháng được (không biết kéo lượt nào) — dùng Tuần / Ngày hoặc nút "Dời lịch" ở popover.
 */
function DragDropCell({ rental, vehicleId, dateStr, ghostHere, className, children, ...rest }: MonthCellProps & { rental: Rental }) {
  const drop = useDroppable({ id: cellDropId(vehicleId, dateStr) })
  const drag = useDraggable({
    id: rentalDragId(rental.id, dateStr),
    attributes: { roleDescription: calendarLabels.dragRoleDescription },
  })
  const { setNodeRef: setDropRef } = drop
  const { setNodeRef: setDragRef } = drag
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      setDropRef(node)
      setDragRef(node)
    },
    [setDropRef, setDragRef],
  )
  return (
    <button
      ref={setRef}
      type="button"
      className={cn(
        className,
        'cursor-grab touch-manipulation',
        ghostHere && GHOST_CELL,
        drop.isOver && OVER_CELL,
        drag.isDragging && 'opacity-40',
      )}
      title={ghostHere ? calendarLabels.dragGhostCaption : undefined}
      {...rest}
      {...drag.attributes}
      {...drag.listeners}
    >
      {children}
    </button>
  )
}

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.3 — mỗi xe 1 dòng, mỗi ngày trong
 * tháng 1 cột (CR-2026-017/044). Ô rút gọn (chấm/số lượt, không vẽ chi tiết
 * như Week). Vehicle Block phủ lên ô ngày bị khoá — khác màu/kiểu Rental
 * Block (§18 BRD).
 */
export function CalendarMonthGrid({
  monthKey,
  vehicles,
  rentals,
  blocks,
  showInactiveVehicles,
  highlightRentalIds,
  ghost,
  onEmptyCellClick,
  onBlockedCellClick,
  onDayCellClick,
}: {
  /** Month key (`YYYY-MM`, +07). */
  monthKey: string
  vehicles: Vehicle[]
  rentals: Rental[]
  blocks: VehicleBlock[]
  showInactiveVehicles: boolean
  highlightRentalIds: Set<string>
  /** Bóng mờ viền nét đứt ở vị trí đề xuất trong lúc hộp thoại dời lịch / đổi xe mở (Round B2). */
  ghost?: DndGhost
  onEmptyCellClick: (vehicleId: string, pickupDateTime: string) => void
  onBlockedCellClick: (block: VehicleBlock) => void
  onDayCellClick: (vehicle: Vehicle, dateStr: string, rentalsForCell: Rental[]) => void
}) {
  const { can } = usePermission()
  const canEdit = can('RENTAL', 'EDIT')
  const dayStrs = useMemo(() => monthGridKeys(monthKey), [monthKey])
  const today = todayKey()

  const visibleVehicles = useMemo(
    () => (showInactiveVehicles ? vehicles : vehicles.filter((v) => v.status !== 'INACTIVE')),
    [vehicles, showInactiveVehicles],
  )

  const rentalsByVehicle = useMemo(
    () => rentalsByVehicleInRange(rentals, dayStrs[0] ?? '', dayStrs[dayStrs.length - 1] ?? ''),
    [rentals, dayStrs],
  )

  const gridTemplateColumns = `160px repeat(${dayStrs.length}, minmax(26px, 1fr))`

  return (
    <div className="overflow-x-auto rounded-md border">
      <div style={{ minWidth: `${160 + dayStrs.length * 26}px` }}>
        <div className="grid border-b" style={{ gridTemplateColumns }}>
          <div className="p-2 text-xs font-medium" />
          {dayStrs.map((d) => (
            <div
              key={d}
              className={cn('border-l p-1 text-center text-[10px] font-medium', d === today && 'bg-primary/5 text-primary')}
            >
              {Number(d.slice(8, 10))}
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
                    // N8 — ngày +07 (trước đây cắt chuỗi UTC)
                    const rentalStart = toDateKey(r.pickupDateTime)
                    const rentalEnd = toDateKey(r.expectedReturnDateTime)
                    return rentalStart <= dateStr && dateStr <= rentalEnd
                  })
                  const highlighted = rentalsForCell.some((r) => highlightRentalIds.has(r.id))
                  const ghostHere = ghostCoversDay(ghost, vehicle.id, dateStr)
                  const dragRental = rentalsForCell.length === 1 ? rentalsForCell[0] : undefined

                  if (block) {
                    return (
                      <DropCell
                        key={dateStr}
                        vehicleId={vehicle.id}
                        dateStr={dateStr}
                        ghostHere={ghostHere}
                        title={block.reason}
                        className="border-destructive/30 bg-destructive/10 hover:bg-destructive/20 flex h-9 items-center justify-center border-l"
                        onClick={() => onBlockedCellClick(block)}
                        aria-label={`${vehicle.plate} — ${dateStr} — ${vi.calendar.blockDetailTitle}`}
                      >
                        <Lock className="text-destructive size-3" />
                      </DropCell>
                    )
                  }

                  if (rentalsForCell.length > 0) {
                    const cellProps = {
                      vehicleId: vehicle.id,
                      dateStr,
                      ghostHere,
                      className: cn(
                        'hover:bg-accent/50 flex h-9 items-center justify-center border-l',
                        highlighted && 'ring-primary ring-2 ring-inset',
                      ),
                      onClick: () => onDayCellClick(vehicle, dateStr, rentalsForCell),
                      'aria-label': `${vehicle.plate} — ${dateStr} — ${vi.calendar.rentalCount(rentalsForCell.length)}`,
                    }
                    const dots =
                      rentalsForCell.length === 1 ? (
                        <span className="bg-primary size-2 rounded-full" />
                      ) : (
                        <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full text-[9px] font-medium">
                          {rentalsForCell.length}
                        </span>
                      )
                    // Gate: can('RENTAL','EDIT') && canRescheduleRental(rental) — lượt không kéo được giữ ô như cũ (chỉ thả được vào).
                    return dragRental && canEdit && canRescheduleRental(dragRental) ? (
                      <DragDropCell key={dateStr} rental={dragRental} {...cellProps}>
                        {dots}
                      </DragDropCell>
                    ) : (
                      <DropCell key={dateStr} {...cellProps}>
                        {dots}
                      </DropCell>
                    )
                  }

                  return (
                    <DropCell
                      key={dateStr}
                      vehicleId={vehicle.id}
                      dateStr={dateStr}
                      ghostHere={ghostHere}
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
