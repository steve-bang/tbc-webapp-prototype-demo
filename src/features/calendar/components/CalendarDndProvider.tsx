import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type PointerSensorOptions,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { calendarLabels } from '@/shared/i18n/calendarLabels'
import { dayDiff, formatDate } from '@/shared/lib/datetime'
import {
  isNoopProposal,
  minuteDeltaFromPixels,
  parseDragId,
  parseDropId,
  proposalFromDayShift,
  proposalFromTimeShift,
  scheduleModeFor,
  type DndProposal,
  type DragSource,
} from '../dndModel'
import type { ScheduleChangeMode } from './RentalScheduleChangeDialog'

/** Đề xuất sau khi thả — `CalendarScreen` nhận và mở `RentalScheduleChangeDialog` (provider KHÔNG ghi gì, §15.4). */
export interface DndPendingProposal {
  rental: Rental
  proposal: DndProposal
  mode: ScheduleChangeMode
}

/**
 * `PointerSensor` (chuột / bút) bỏ qua con trỏ cảm ứng: trên màn hình cảm ứng, `TouchSensor` (nhấn giữ 300 ms) lo việc kéo,
 * còn vuốt thường phải cuộn được lưới (§15.2 mục 2) — `PointerSensor` nguyên bản sẽ giành cử chỉ vuốt sau 5 px.
 */
class MousePenSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return false
        onActivation?.({ event })
        return true
      },
    },
  ]
}

/** Chuột / bút: va chạm theo con trỏ. Bàn phím (không có con trỏ) và tay kéo cạnh: gần tâm nhất. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 0) return hits
  const isEdge = parseDragId(args.active.id)?.kind === 'edge'
  return !args.pointerCoordinates || isEdge ? closestCenter(args) : []
}

/**
 * `docs/CALENDAR-ROUND3-PLAN.md` §15.2 mục 2 — bao `DndContext` (`@dnd-kit/core`) cho Week / Month / Day. Chỉ QUY ĐỔI vị trí thả thành
 * đề xuất (hàm thuần ở `../dndModel`) rồi gọi `onProposal`; KHÔNG gọi API ghi — mọi ghi đi qua hộp thoại B1 (§15.4).
 * Sensor: chuột/bút kéo sau 5 px (nhấp thường vẫn mở popover); cảm ứng nhấn giữ 300 ms / dung sai 8 px (vuốt vẫn cuộn); bàn phím.
 */
export function CalendarDndProvider({
  rentals,
  vehicleById,
  customerById,
  onProposal,
  children,
}: {
  rentals: Rental[]
  vehicleById: Map<string, Vehicle>
  customerById: Map<string, Customer>
  onProposal: (pending: DndPendingProposal) => void
  children: ReactNode
}) {
  const [active, setActive] = useState<DragSource | null>(null)
  const rentalById = useMemo(() => new Map(rentals.map((r) => [r.id, r])), [rentals])

  const sensors = useSensors(
    useSensor(MousePenSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const rentalLabel = (rentalId: string): string => {
    const r = rentalById.get(rentalId)
    if (!r) return rentalId
    const plate = vehicleById.get(r.vehicleId)?.plate ?? r.vehicleId
    return `${plate} — ${customerById.get(r.customerId)?.fullName ?? r.customerId}`
  }

  const whatOf = (id: UniqueIdentifier): string => {
    const src = parseDragId(id)
    if (!src) return String(id)
    const label = rentalLabel(src.rentalId)
    if (src.kind === 'edge') return src.edge === 'start' ? calendarLabels.dragWhatEdgeStart(label) : calendarLabels.dragWhatEdgeEnd(label)
    return calendarLabels.dragWhatRental(label)
  }

  const placeOf = (id: UniqueIdentifier | undefined): string | null => {
    const dst = parseDropId(id)
    if (!dst) return null
    const plate = vehicleById.get(dst.vehicleId)?.plate ?? dst.vehicleId
    return dst.kind === 'cell' ? calendarLabels.dragPlaceCell(plate, formatDate(dst.dayKey)) : calendarLabels.dragPlaceRow(plate)
  }

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => calendarLabels.dragAnnounceStart(whatOf(a.id)),
    onDragOver: ({ active: a, over }) => {
      const place = placeOf(over?.id)
      return place ? calendarLabels.dragAnnounceOver(whatOf(a.id), place) : calendarLabels.dragAnnounceOverNone(whatOf(a.id))
    },
    onDragEnd: ({ active: a, over }) => {
      const place = placeOf(over?.id)
      return place ? calendarLabels.dragAnnounceDrop(whatOf(a.id), place) : calendarLabels.dragAnnounceDropNone(whatOf(a.id))
    },
    onDragCancel: ({ active: a }) => calendarLabels.dragAnnounceCancel(whatOf(a.id)),
  }

  function handleDragEnd(event: DragEndEvent) {
    setActive(null)
    const src = parseDragId(event.active.id)
    const dst = parseDropId(event.over?.id)
    if (!src || !dst || !event.over) return
    const rental = rentalById.get(src.rentalId)
    if (!rental) return

    let proposal: DndProposal | null = null
    if (src.kind === 'rental' && dst.kind === 'cell') {
      // Week / Month: độ lệch NGÀY giữa ô nguồn (mảnh đang kéo) và ô đích; đổi hàng = đổi xe.
      proposal = proposalFromDayShift(rental, dayDiff(src.dayKey, dst.dayKey), dst.vehicleId)
    } else if (dst.kind === 'row') {
      // Day: độ lệch ngang (px) → phút (24h = bề rộng hàng). Kéo cạnh không đổi xe.
      const minutes = minuteDeltaFromPixels(event.delta.x, event.over.rect.width)
      proposal =
        src.kind === 'edge'
          ? proposalFromTimeShift(rental, minutes, rental.vehicleId, src.edge)
          : proposalFromTimeShift(rental, minutes, dst.vehicleId)
    }
    if (!proposal || isNoopProposal(rental, proposal)) return // thả lại chỗ cũ → không làm gì (§15.2)
    onProposal({ rental, proposal, mode: scheduleModeFor(rental, proposal) })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      autoScroll
      accessibility={{ announcements, screenReaderInstructions: { draggable: calendarLabels.dragInstructions } }}
      onDragStart={(e) => setActive(parseDragId(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active?.kind === 'rental' ? (
          <div className="bg-primary/30 border-primary text-foreground w-max max-w-56 min-w-full cursor-grabbing truncate rounded-sm border px-1 py-0.5 text-[10px] leading-tight font-medium shadow-md">
            {rentalLabel(active.rentalId)}
          </div>
        ) : active?.kind === 'edge' ? (
          <div className="bg-primary/70 size-full cursor-ew-resize rounded-sm" />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
