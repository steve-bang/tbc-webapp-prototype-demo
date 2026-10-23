import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { vi } from '@/shared/i18n/vi'
import { useUnreadNotificationCount } from '../hooks'

/**
 * Chuông thông báo ở Topbar: icon + badge số chưa đọc (ẩn khi 0, `99+` khi > 99) → Trung tâm thông báo.
 * Ghép vào layout duy nhất ở `app/routes.tsx` qua `topbarSlot` (shared không import features).
 * TODO(OQ: Notification-BRD.md §20 Q5) — có badge số chưa đọc toàn Webapp hay không chưa chốt; giả định tạm: có.
 */
export function NotificationBell() {
  const { data: unread = 0 } = useUnreadNotificationCount()
  const label =
    unread > 0 ? vi.notifications.bellLabelWithCount.replace('{{count}}', String(unread)) : vi.notifications.bellLabel
  return (
    <Link
      to={paths.platformNotifications}
      aria-label={label}
      title={label}
      className="hover:bg-accent text-foreground focus-visible:ring-ring/50 relative inline-flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2"
    >
      <Bell className="size-4" />
      {unread > 0 && (
        <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
