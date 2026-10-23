import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { RENTAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Badge } from '@/shared/ui/badge'
import { useVehicleRentalsForConsignment } from '../hooks'
import { listBlockingRentals, listDraftRentals } from '../payoutModel'

/**
 * Lượt thuê của xe ảnh hưởng tới việc trả xe về chủ (VC-BR-14): lượt đã xác nhận / đang chạy CHẶN, lượt nháp chỉ cảnh báo.
 * Chỉ đọc — xử lý lượt thuê làm ở màn Lượt thuê. Dùng trong dialog thông báo chấm dứt và dialog trả xe.
 */
export function VehicleRentalImpactList({ vehicleId }: { vehicleId: string }) {
  const { data: rentals, isLoading } = useVehicleRentalsForConsignment(vehicleId)
  const t = vi.consignment.termination
  if (isLoading) return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  const blocking = listBlockingRentals(rentals ?? [], vehicleId)
  const drafts = listDraftRentals(rentals ?? [], vehicleId)

  if (blocking.length === 0 && drafts.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.impactNone}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {blocking.length > 0 && (
        <div className="border-destructive/40 bg-destructive/10 flex flex-col gap-2 rounded-md border p-3">
          <p className="text-destructive text-sm font-medium">{t.impactBlocking(blocking.length)}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {blocking.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Link className="text-primary font-mono text-xs underline-offset-4 hover:underline" to={paths.rentalDetail(r.id)}>
                  {r.id}
                </Link>
                <Badge variant="warning">{RENTAL_STATUS_LABELS[r.status]}</Badge>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(r.pickupDateTime)} – {formatDateTime(r.expectedReturnDateTime)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {drafts.length > 0 && (
        <div className="border-status-pending/40 bg-status-pending/10 flex flex-col gap-2 rounded-md border p-3">
          <p className="text-status-pending text-sm font-medium">{t.impactDraft(drafts.length)}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {drafts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Link className="text-primary font-mono text-xs underline-offset-4 hover:underline" to={paths.rentalDetail(r.id)}>
                  {r.id}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {formatDateTime(r.pickupDateTime)} – {formatDateTime(r.expectedReturnDateTime)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
