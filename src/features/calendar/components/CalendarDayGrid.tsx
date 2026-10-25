import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useMemo, type KeyboardEventHandler, type MouseEventHandler, type ReactNode } from 'react'
import { usePermission } from '@/features/auth'
import type { Customer } from '@/features/customers'
import { canRescheduleRental, type Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { RENTAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatTime, isoToDateTimeInput, startOfDayIso, todayIso, todayKey } from '@/shared/lib/datetime'
import { RentalBlockPopover } from './RentalBlockPopover'
import { edgeDragId, rentalDragId, rowDropId, spanPctInDay, type DndGhost, type DragEdge } from '../dndModel'
import {
  dayTimelineLayout,
  STANDARD_HANDOVER_HOUR,
  timeFromDayPosition,
  WORKING_HOURS,
  type VehicleBlock,
} from '../model'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const HOUR_PCT = 100 / 24
const ROW_GRID = 'grid grid-cols-[160px_1fr]'

/** Hàng xe (trục giờ 24h) là vùng thả (`useDroppable`, Round B2); nhấp chỗ trống vẫn tạo nhanh như cũ. */
function DayRow({
  vehicleId,
  label,
  onClick,
  onKeyDown,
  children,
}: {
  vehicleId: string
  label: string
  onClick: MouseEventHandler<HTMLDivElement>
  onKeyDown: KeyboardEventHandler<HTMLDivElement>
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: rowDropId(vehicleId) })
  return (
    // Không dùng thẻ `<button>` — bên trong có `RentalBlockPopover` (trigger cũng tương tác).
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={cn(
        'hover:bg-accent/20 relative h-16 cursor-pointer bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px)] bg-[length:4.1667%_100%]',
        isOver && 'bg-primary/10 ring-primary ring-1 ring-inset',
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

/** Tay kéo cạnh trái (giờ giao) / phải (giờ trả) của khối — vùng chạm rộng 12 px (`w-3`), con trỏ `ew-resize` (§15.2 mục 3). */
function DayEdgeHandle({ rentalId, edge }: { rentalId: string; edge: DragEdge }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: edgeDragId(edge, rentalId),
    attributes: { roleDescription: calendarLabels.dragRoleDescription },
  })
  const label = edge === 'start' ? calendarLabels.dragEdgeStartLabel : calendarLabels.dragEdgeEndLabel
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'absolute inset-y-0 z-10 flex w-3 cursor-ew-resize touch-manipulation items-center justify-center',
        edge === 'start' ? 'left-0' : 'right-0',
        isDragging && 'opacity-40',
      )}
    >
      <span className="bg-primary/70 h-4 w-0.5 rounded-full" aria-hidden />
    </span>
  )
}

/** Khối lượt thuê trong hàng xe: kéo cả khối (dời theo 30') hoặc kéo 1 trong 2 cạnh (đổi giờ giao / giờ trả). */
function DayBlock({
  rental,
  dayKey,
  leftPct,
  widthPct,
  continuesBefore,
  continuesAfter,
  canDrag,
  highlighted,
  customer,
  vehicle,
}: {
  rental: Rental
  dayKey: string
  leftPct: number
  widthPct: number
  continuesBefore: boolean
  continuesAfter: boolean
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
                // Space/Enter nhấc khối bằng bàn phím — không để nổi bọt lên hàng (sẽ mở tạo nhanh).
                if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
              }
            : undefined
        }
        className={cn(
          'bg-primary/15 border-primary/40 absolute inset-y-1 z-[5] min-w-0 overflow-hidden rounded-sm border px-1 py-0.5 text-[10px] leading-tight',
          continuesBefore && 'rounded-l-none border-l-0',
          continuesAfter && 'rounded-r-none border-r-0',
          canDrag && 'cursor-grab touch-manipulation',
          isDragging && 'opacity-40',
          highlighted && 'ring-primary ring-2',
        )}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        title={`${customerName} — ${formatTime(rental.pickupDateTime)}-${formatTime(rental.expectedReturnDateTime)} — ${RENTAL_STATUS_LABELS[rental.status]}`}
      >
        {canDrag && !continuesBefore && <DayEdgeHandle rentalId={rental.id} edge="start" />}
        <p className="truncate font-medium">{customerName}</p>
        <p className="truncate">{RENTAL_STATUS_LABELS[rental.status]}</p>
        {canDrag && !continuesAfter && <DayEdgeHandle rentalId={rental.id} edge="end" />}
      </div>
    </RentalBlockPopover>
  )
}

/**
 * `docs/CALENDAR-ROUND3-PLAN.md` §13.2 mục 4 — chế độ Ngày (`RC` §8): mỗi xe một hàng, trục giờ NGANG 00:00–24:00 (+07).
 * Khung giờ làm việc tô nhạt, vạch 21:00 (khung giao/nhận chuẩn, CR-2026-005), vạch "bây giờ" khi xem hôm nay, vùng đệm 90'
 * sau giờ trả dự kiến (RC-BR-13), Vehicle Block phủ ngày. Bố cục tính ở hàm thuần `dayTimelineLayout` — component chỉ vẽ.
 * Tạo nhanh từ chỗ trống (cùng cổng `onEmptyCellClick` với Week) + kéo–thả (Round B2, §15): kéo khối = dời theo 30', kéo cạnh = đổi giờ giao / trả.
 */
export function CalendarDayGrid({
  dateKey,
  vehicles,
  rentals,
  blocks,
  showInactiveVehicles,
  highlightRentalIds,
  customerById,
  ghost,
  onEmptyCellClick,
}: {
  /** Ngày cần hiển thị (date key +07). */
  dateKey: string
  vehicles: Vehicle[]
  rentals: Rental[]
  blocks: VehicleBlock[]
  showInactiveVehicles: boolean
  highlightRentalIds: Set<string>
  customerById: Map<string, Customer>
  /** Bóng mờ viền nét đứt ở vị trí đề xuất trong lúc hộp thoại dời lịch / đổi xe mở (Round B2). */
  ghost?: DndGhost
  onEmptyCellClick: (vehicleId: string, pickupDateTime: string) => void
}) {
  const { can } = usePermission()
  const canEdit = can('RENTAL', 'EDIT')
  const visibleVehicles = useMemo(
    () => (showInactiveVehicles ? vehicles : vehicles.filter((v) => v.status !== 'INACTIVE')),
    [vehicles, showInactiveVehicles],
  )
  const rows = useMemo(() => dayTimelineLayout(dateKey, rentals, blocks, visibleVehicles), [dateKey, rentals, blocks, visibleVehicles])
  const rentalById = useMemo(() => new Map(rentals.map((r) => [r.id, r])), [rentals])
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks])

  const isToday = dateKey === todayKey()
  const nowPct = isToday ? ((Date.parse(todayIso()) - Date.parse(startOfDayIso(dateKey))) / 86_400_000) * 100 : null

  const workingLeft = WORKING_HOURS.start * HOUR_PCT
  const workingWidth = (WORKING_HOURS.end - WORKING_HOURS.start) * HOUR_PCT
  const handoverLeft = STANDARD_HANDOVER_HOUR * HOUR_PCT

  return (
    <div>
      <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-accent/60 inline-block h-3 w-5 rounded-sm border" />
          {vi.calendar.workingHoursLabel} ({String(WORKING_HOURS.start).padStart(2, '0')}:00–{String(WORKING_HOURS.end).padStart(2, '0')}:00)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-status-pending inline-block h-3 border-l-2 border-dashed" />
          {vi.calendar.standardHandoverLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-status-neutral/40 bg-status-neutral/10 inline-block h-3 w-5 rounded-sm border border-dashed" />
          {vi.calendar.turnaroundBufferLabel}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div className="min-w-[1360px]">
          <div className={cn(ROW_GRID, 'border-b')}>
            <div className="p-2 text-xs font-medium">{vi.calendar.dayGridVehicleColumn}</div>
            <div className="grid grid-cols-[repeat(24,minmax(0,1fr))]">
              {HOURS.map((h) => (
                <div key={h} className="border-l p-1 text-center text-[10px] font-medium">
                  {String(h).padStart(2, '0')}
                </div>
              ))}
            </div>
          </div>

          {visibleVehicles.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">{vi.vehicles.emptyAll}</p>
          ) : (
            rows.map((row) => {
              const vehicle = vehicleById.get(row.vehicleId)
              const activeBlock = row.blockId ? blockById.get(row.blockId) : undefined
              const ghostSpan =
                ghost && ghost.vehicleId === row.vehicleId
                  ? spanPctInDay(dateKey, ghost.pickupDateTime, ghost.expectedReturnDateTime)
                  : null
              return (
                <div key={row.vehicleId} className={cn(ROW_GRID, 'border-b last:border-b-0')}>
                  <div className="flex min-w-0 flex-col justify-center gap-0.5 border-r p-2">
                    <p className="truncate text-sm font-medium">{vehicle?.plate ?? row.vehicleId}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {vehicle?.brand} {vehicle?.model}
                    </p>
                  </div>

                  <DayRow
                    vehicleId={row.vehicleId}
                    label={`${vehicle?.plate ?? row.vehicleId} — ${dateKey}`}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const pct = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5
                      onEmptyCellClick(row.vehicleId, isoToDateTimeInput(timeFromDayPosition(dateKey, pct)))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onEmptyCellClick(row.vehicleId, isoToDateTimeInput(timeFromDayPosition(dateKey, 9 / 24)))
                      }
                    }}
                  >
                    <div
                      className="bg-accent/50 pointer-events-none absolute inset-y-0"
                      style={{ left: `${workingLeft}%`, width: `${workingWidth}%` }}
                      aria-hidden
                    />
                    <div
                      className="border-status-pending/70 pointer-events-none absolute inset-y-0 border-l-2 border-dashed"
                      style={{ left: `${handoverLeft}%` }}
                      aria-hidden
                    />
                    {nowPct !== null && nowPct >= 0 && nowPct <= 100 && (
                      <div
                        className="bg-destructive pointer-events-none absolute inset-y-0 z-10 w-0.5"
                        style={{ left: `${nowPct}%` }}
                        title={vi.calendar.nowLabel}
                        aria-hidden
                      />
                    )}

                    {activeBlock && (
                      <div
                        className="bg-status-error/10 text-status-error pointer-events-none absolute inset-0 flex items-center justify-center truncate px-2 text-xs"
                        title={`${vi.calendar.vehicleBlockedBar}: ${activeBlock.reason}`}
                      >
                        {vi.calendar.vehicleBlockedBar}: {activeBlock.reason}
                      </div>
                    )}

                    {row.buffers.map((buf) => (
                      <div
                        key={`buf-${buf.rentalId}`}
                        className="border-status-neutral/40 bg-status-neutral/10 pointer-events-none absolute inset-y-1 rounded-sm border border-dashed"
                        style={{ left: `${buf.leftPct}%`, width: `${buf.widthPct}%` }}
                        title={vi.calendar.turnaroundBufferLabel}
                      />
                    ))}

                    {row.rentals.map((item) => {
                      const rental = rentalById.get(item.rentalId)
                      if (!rental) return null
                      return (
                        <DayBlock
                          key={rental.id}
                          rental={rental}
                          dayKey={dateKey}
                          leftPct={item.leftPct}
                          widthPct={item.widthPct}
                          continuesBefore={item.continuesBefore}
                          continuesAfter={item.continuesAfter}
                          canDrag={canEdit && canRescheduleRental(rental)}
                          highlighted={highlightRentalIds.has(rental.id)}
                          customer={customerById.get(rental.customerId)}
                          vehicle={vehicle}
                        />
                      )
                    })}

                    {ghostSpan && (
                      <div
                        className="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-y-0.5 z-10 flex items-center overflow-hidden rounded-sm border-2 border-dashed px-1 text-[10px] font-medium"
                        style={{ left: `${ghostSpan.leftPct}%`, width: `${ghostSpan.widthPct}%` }}
                        title={calendarLabels.dragGhostCaption}
                      >
                        <span className="truncate">{calendarLabels.dragGhostCaption}</span>
                      </div>
                    )}
                  </DayRow>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
