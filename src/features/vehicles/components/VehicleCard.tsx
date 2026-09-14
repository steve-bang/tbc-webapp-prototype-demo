import { FileWarning, Pencil } from 'lucide-react'
import { OWNERSHIP_TYPE_LABELS, VEHICLE_CLASS_LABELS, vi } from '@/shared/i18n/vi'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { countDocumentsNeedingAttention, type Vehicle } from '../model'
import { VehicleStatusBadge } from './VehicleStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — `CONVENTIONS.md` §8. */
export function VehicleCard({
  vehicle,
  canEdit,
  onEdit,
  onDocuments,
}: {
  vehicle: Vehicle
  canEdit: boolean
  onEdit: () => void
  onDocuments: () => void
}) {
  const attentionCount = countDocumentsNeedingAttention(vehicle)
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{vehicle.plate}</p>
            <p className="text-muted-foreground text-xs">
              {vehicle.brand} {vehicle.model}
            </p>
          </div>
          <VehicleStatusBadge status={vehicle.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Badge variant="outline">{VEHICLE_CLASS_LABELS[vehicle.vehicleClass]}</Badge>
          <Badge variant="outline">{OWNERSHIP_TYPE_LABELS[vehicle.ownershipType]}</Badge>
          <span className="text-muted-foreground">{vehicle.currentKm.toLocaleString('vi-VN')} km</span>
        </div>
        {attentionCount > 0 && (
          <p className="text-status-pending flex items-center gap-1 text-xs">
            <FileWarning className="size-3.5" />
            {attentionCount} {vi.vehicles.documentsWarningBadge}
          </p>
        )}
        {canEdit && (
          <div className="mt-1 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="size-3.5" />
              {vi.common.edit}
            </Button>
            <Button size="sm" variant="outline" onClick={onDocuments}>
              <FileWarning className="size-3.5" />
              {vi.vehicles.documentsButton}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
