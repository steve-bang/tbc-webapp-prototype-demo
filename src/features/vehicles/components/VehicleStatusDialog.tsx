import { useState } from 'react'
import { toast } from 'sonner'
import { VEHICLE_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useChangeVehicleStatus } from '../hooks'
import { availableStatusTransitions, type Vehicle } from '../model'
import type { VehicleStatus } from '@/shared/domain/enums'

/**
 * `VM-RULE-003/004`/`AC-VM-006` — đổi trạng thái xe. Khác `EmployeeStatusDialog`:
 * BRD không yêu cầu `Reason` cho hành động này (VEHICLE-MANAGEMENT-PLAN.md §5.2)
 * nên dialog chỉ xác nhận đơn giản, vẫn ghi audit đầy đủ ở `api.changeStatus`.
 */
export function VehicleStatusDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: Vehicle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const changeStatus = useChangeVehicleStatus()
  const options = vehicle ? availableStatusTransitions(vehicle.status) : []
  const [nextStatus, setNextStatus] = useState<VehicleStatus | undefined>(options[0])
  // Reset lựa chọn khi dialog vừa mở lại — pattern "adjusting state during
  // render" (không dùng useEffect, tránh cascading render), cùng
  // `CustomerReasonDialog`.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && vehicle) setNextStatus(availableStatusTransitions(vehicle.status)[0])
  }

  if (!vehicle) return null

  async function handleConfirm() {
    if (!vehicle || !nextStatus) return
    try {
      await changeStatus.mutateAsync({ id: vehicle.id, status: nextStatus })
      toast.success(vi.vehicles.statusChangeSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.vehicles.statusChangeError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.vehicles.changeStatusTitle}</DialogTitle>
          <DialogDescription>
            {vehicle.plate} — {vi.vehicles.currentStatus}: {VEHICLE_STATUS_LABELS[vehicle.status]}
          </DialogDescription>
        </DialogHeader>

        {options.length === 0 ? (
          <p className="text-muted-foreground text-sm">{vi.vehicles.noTransition}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>{vi.vehicles.newStatus}</Label>
            <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as VehicleStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {VEHICLE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          {options.length > 0 && (
            <Button type="button" disabled={changeStatus.isPending} onClick={handleConfirm}>
              {vi.common.confirm}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
