import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/shared/layout/PageHeader'
import {
  NOTIFICATION_EVENT_TYPE_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_SOURCE_MODULE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_SOURCE_MODULES,
  type NotificationEventType,
  type NotificationPriority,
  type NotificationSourceModule,
} from '@/shared/domain/enums'
import { useSessionStore } from '@/features/auth'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { NotificationCard } from '../components/NotificationCard'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications, useUnreadNotificationCount } from '../hooks'
import type { NotificationEvent, NotificationFilter } from '../model'

const ALL = '__ALL__'

/** Trung tâm thông báo — `/platform/notifications` (Notification-BRD.md §10, UC-NT-05/06). Chưa phân trang ở R2 (~30 sự kiện). */
export function NotificationCenterScreen() {
  const t = vi.notifications
  const userId = useSessionStore((s) => s.user?.userId) ?? ''
  const [tab, setTab] = useState<NotificationFilter['tab']>('ACTIVE')
  const [eventType, setEventType] = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [readState, setReadState] = useState(ALL)
  const [sourceModule, setSourceModule] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filter: NotificationFilter = {
    tab,
    eventType: eventType === ALL ? undefined : (eventType as NotificationEventType),
    priority: priority === ALL ? undefined : (priority as NotificationPriority),
    readState: readState === ALL ? undefined : (readState as 'UNREAD' | 'READ'),
    sourceModule: sourceModule === ALL ? undefined : (sourceModule as NotificationSourceModule),
    from: from || undefined,
    to: to || undefined,
  }
  const hasFilter = Object.entries(filter).some(([k, v]) => k !== 'tab' && v !== undefined)

  const { data: events = [], isLoading, isError } = useMyNotifications(filter)
  const { data: unreadCount = 0 } = useUnreadNotificationCount()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  async function handleOpen(event: NotificationEvent) {
    if (event.deliveryStatus === 'SENT' && !event.readBy[userId]) await markRead.mutateAsync(event.id)
  }

  async function handleMarkAll() {
    const count = await markAll.mutateAsync()
    toast.success(t.markAllReadDone.replace('{{count}}', String(count)))
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" disabled={unreadCount === 0 || markAll.isPending} onClick={handleMarkAll}>
            {t.markAllRead}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as NotificationFilter['tab'])}>
        <TabsList>
          <TabsTrigger value="ACTIVE">{t.tabActive}</TabsTrigger>
          <TabsTrigger value="CANCELLED">{t.tabCancelled}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-full" aria-label={t.filterEventType}>
            <SelectValue placeholder={t.filterEventType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.filterEventType}: ${t.filterAll}`}</SelectItem>
            {NOTIFICATION_EVENT_TYPES.map((v) => (
              <SelectItem key={v} value={v}>
                {NOTIFICATION_EVENT_TYPE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full" aria-label={t.filterPriority}>
            <SelectValue placeholder={t.filterPriority} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.filterPriority}: ${t.filterAll}`}</SelectItem>
            {NOTIFICATION_PRIORITIES.map((v) => (
              <SelectItem key={v} value={v}>
                {NOTIFICATION_PRIORITY_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={readState} onValueChange={setReadState}>
          <SelectTrigger className="w-full" aria-label={t.filterReadState}>
            <SelectValue placeholder={t.filterReadState} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.filterReadState}: ${t.filterAll}`}</SelectItem>
            <SelectItem value="UNREAD">{t.readStateUnread}</SelectItem>
            <SelectItem value="READ">{t.readStateRead}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceModule} onValueChange={setSourceModule}>
          <SelectTrigger className="w-full" aria-label={t.filterSourceModule}>
            <SelectValue placeholder={t.filterSourceModule} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{`${t.filterSourceModule}: ${t.filterAll}`}</SelectItem>
            {NOTIFICATION_SOURCE_MODULES.map((v) => (
              <SelectItem key={v} value={v}>
                {NOTIFICATION_SOURCE_MODULE_LABELS[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex min-w-0 items-center gap-2">
          <Input type="date" aria-label={t.filterFrom} title={t.filterFrom} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label={t.filterTo} title={t.filterTo} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
        ) : isError ? (
          <p className="text-destructive text-sm">{t.loadError}</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
            {hasFilter ? t.emptyFiltered : tab === 'ACTIVE' ? t.emptyActive : t.emptyCancelled}
          </p>
        ) : (
          events.map((event) => (
            <NotificationCard
              key={event.id}
              event={event}
              unread={event.deliveryStatus === 'SENT' && !event.readBy[userId]}
              onOpen={handleOpen}
            />
          ))
        )}
      </div>
    </div>
  )
}
