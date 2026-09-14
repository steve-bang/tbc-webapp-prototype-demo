import { useMemo } from 'react'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import type { Customer } from '@/features/customers'
import type { Rental } from '@/features/rentals'
import type { Vehicle } from '@/features/vehicles'
import { vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useReleaseVehicleBlock } from '../hooks'
import { findRentalsAffectedByBlock, type VehicleBlock } from '../model'

/**
 * `docs/CALENDAR-MANAGEMENT-PLAN.md` §5.3 — click ô đã khoá trên
 * `CalendarMonthGrid` → xem chi tiết Vehicle Block + nút "Gỡ khoá" (gate
 * `VEHICLE.BLOCK`, CR-2026-015: giữ khoá đến khi SYSTEM_ADMIN/MANAGER gỡ tay).
 * Gỡ khoá KHÔNG tự đổi `Vehicle.status` (độc lập — §2.1 kế hoạch).
 */
export function VehicleBlockDetailDialog({
  block,
  vehicle,
  rentals,
  customers,
  open,
  onOpenChange,
}: {
  block: VehicleBlock | null
  vehicle?: Vehicle
  rentals: Rental[]
  customers: Customer[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { can } = usePermission()
  const releaseBlock = useReleaseVehicleBlock()
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const affectedRentals = useMemo(
    () => (block ? findRentalsAffectedByBlock(rentals, block.vehicleId, block.startDate, block.endDate ?? '') : []),
    [block, rentals],
  )

  async function handleRelease() {
    if (!block) return
    try {
      await releaseBlock.mutateAsync(block.id)
      toast.success(vi.calendar.releaseSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.calendar.releaseError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.calendar.blockDetailTitle}</DialogTitle>
        </DialogHeader>

        {block && (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium">{vehicle ? `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}` : block.vehicleId}</p>

            <div>
              <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailPeriod}</p>
              <p>
                {formatDate(block.startDate)} →{' '}
                {block.endDate ? formatDate(block.endDate) : vi.calendar.blockDetailIndefinite}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailReason}</p>
              <p>{block.reason}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailCreatedBy}</p>
              <p>
                {block.createdByName} ({block.createdByRole}) — {formatDateTime(block.createdAt)}
              </p>
            </div>

            {block.status === 'RELEASED' && (
              <div>
                <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailReleasedBy}</p>
                <p>
                  {block.releasedByName} ({block.releasedByRole})
                  {block.releasedAt ? ` — ${formatDateTime(block.releasedAt)}` : ''}
                </p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailAffectedRentals}</p>
              {affectedRentals.length === 0 ? (
                <p className="text-muted-foreground text-xs">{vi.calendar.blockDetailNoAffectedRentals}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-xs">
                  {affectedRentals.map((r) => (
                    <li key={r.id}>
                      {customerById.get(r.customerId)?.fullName ?? r.customerId} —{' '}
                      {formatDateTime(r.pickupDateTime)} → {formatDateTime(r.expectedReturnDateTime)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.close}
          </Button>
          {block?.status === 'ACTIVE' && can('VEHICLE', 'BLOCK') && (
            <Button type="button" variant="destructive" disabled={releaseBlock.isPending} onClick={handleRelease}>
              {vi.calendar.releaseButton}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
