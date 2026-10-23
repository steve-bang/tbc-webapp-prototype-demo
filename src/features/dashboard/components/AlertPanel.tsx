import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { renderTemplate, type DashboardAlertGroupView, type OperationalSignal } from '@/features/notifications'
import { DASHBOARD_ALERT_GROUP_LABELS, NOTIFICATION_PRIORITY_LABELS, vi } from '@/shared/i18n/vi'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

const MAX_ROWS_PER_GROUP = 5

const PRIORITY_VARIANT = {
  URGENT: 'destructive',
  HIGH: 'warning',
  NORMAL: 'info',
  LOW: 'neutral',
} as const

function AlertRow({ signal }: { signal: OperationalSignal }) {
  const { body } = renderTemplate(signal.eventType, signal.payload)
  return (
    <li>
      <Link to={signal.link} className="hover:bg-muted/50 block min-w-0 rounded-md px-2 py-1.5 text-sm transition-colors">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 truncate font-medium">{signal.entityLabel}</span>
          <Badge variant={PRIORITY_VARIANT[signal.priority]}>{NOTIFICATION_PRIORITY_LABELS[signal.priority]}</Badge>
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">{body}</p>
      </Link>
    </li>
  )
}

/**
 * Bảng cảnh báo Dashboard (WebappQuanTri.md §5.3): mỗi nhóm `DASHBOARD_ALERT_GROUPS` một thẻ — số lượng + tối đa 5 dòng.
 * Dữ liệu là danh sách tín hiệu của `features/notifications` (một định nghĩa duy nhất cho Dashboard và Trung tâm thông báo).
 * "Xem tất cả" → Trung tâm thông báo (Round 2), hiện ở mọi nhóm có ≥ 1 tín hiệu.
 */
export function AlertPanel({ groups }: { groups: DashboardAlertGroupView[] }) {
  const t = vi.dashboard
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map(({ group, signals }) => (
        <Card key={group} className="gap-3">
          <CardHeader className="pb-0">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <CardTitle className="min-w-0 truncate text-base">{DASHBOARD_ALERT_GROUP_LABELS[group]}</CardTitle>
              {group !== 'VEHICLE_OVERUSE' && <Badge variant={signals.length > 0 ? 'warning' : 'neutral'}>{signals.length}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            {group === 'VEHICLE_OVERUSE' ? (
              // TODO(OQ: Notification-BRD.md §20 Q7) — ngưỡng cảnh báo xe chạy vượt chưa chốt, chưa phát tín hiệu.
              <p className="text-muted-foreground px-2 text-sm">{t.overusePending}</p>
            ) : signals.length === 0 ? (
              <p className="text-muted-foreground px-2 text-sm">{t.alertGroupEmpty}</p>
            ) : (
              <>
                <ul className="space-y-0.5">
                  {signals.slice(0, MAX_ROWS_PER_GROUP).map((signal) => (
                    <AlertRow key={signal.dedupeKey} signal={signal} />
                  ))}
                </ul>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2 px-2">
                  <p className="text-muted-foreground min-w-0 truncate text-xs">
                    {signals.length > MAX_ROWS_PER_GROUP &&
                      t.alertMore.replace('{{count}}', String(signals.length - MAX_ROWS_PER_GROUP))}
                  </p>
                  <Link to={paths.platformNotifications} className="text-primary shrink-0 text-xs font-medium hover:underline">
                    {t.alertViewAll}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
