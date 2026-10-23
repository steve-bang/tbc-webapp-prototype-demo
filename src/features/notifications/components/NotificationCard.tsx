import { useNavigate } from 'react-router-dom'
import { NOTIFICATION_PRIORITY_LABELS, NOTIFICATION_EVENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { cn } from '@/shared/lib/cn'
import { formatDateTime, formatRelative } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import type { NotificationEvent } from '../model'

// Cùng bảng màu ưu tiên với AlertPanel của Dashboard (notifications không import dashboard nên lặp lại 4 dòng).
const PRIORITY_VARIANT = {
  URGENT: 'destructive',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'neutral',
} as const

/** Bấm thẻ → đánh dấu đã đọc (chỉ event đang hiệu lực, chưa đọc) rồi mở đối tượng nguồn. Event CANCELLED chỉ mở, mờ, không chấm. */
export function NotificationCard({
  event,
  unread,
  onOpen,
}: {
  event: NotificationEvent
  unread: boolean
  onOpen: (event: NotificationEvent) => Promise<void> | void
}) {
  const navigate = useNavigate()
  const cancelled = event.deliveryStatus === 'CANCELLED'

  async function handleClick() {
    // Lỗi đánh dấu đọc không được chặn việc điều hướng.
    try {
      await onOpen(event)
    } catch {
      // bỏ qua
    }
    navigate(event.link)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'hover:bg-muted/50 focus-visible:ring-ring/50 flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2',
        cancelled && 'opacity-60',
      )}
    >
      <span className="mt-1.5 flex size-2 shrink-0">
        {unread && <span className="bg-primary size-2 rounded-full" title={vi.notifications.unreadDot} aria-label={vi.notifications.unreadDot} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className={cn('min-w-0 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{event.title}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {cancelled && <Badge variant="neutral">{vi.notifications.cancelledNote}</Badge>}
            <Badge variant={PRIORITY_VARIANT[event.priority]}>{NOTIFICATION_PRIORITY_LABELS[event.priority]}</Badge>
          </div>
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm break-words">{event.body}</p>
        <div className="text-muted-foreground mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="min-w-0 truncate">{event.entityLabel}</span>
          <span>{NOTIFICATION_EVENT_TYPE_LABELS[event.eventType]}</span>
          <span title={formatDateTime(event.triggerAt)}>{formatRelative(event.triggerAt)}</span>
        </div>
      </div>
    </button>
  )
}
