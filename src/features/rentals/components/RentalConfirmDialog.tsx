import type { Customer } from '@/features/customers'
import type { Vehicle } from '@/features/vehicles'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useConfirmRental } from '../hooks'
import { canConfirm, type Rental } from '../model'

/**
 * `UC-RM-01` §5.3 — Xác nhận lượt thuê. Hiển thị kết quả `canConfirm()` ngay
 * trên dữ liệu đang tải (đã đủ `customer`/`vehicle`/`existingRentals` từ
 * `RentalListScreen`) để disable nút + hiện lý do — chặn cứng, không phải
 * cảnh báo có thể bỏ qua (RM-BR-04/05/06/07). `api.confirm()` vẫn re-validate
 * lại lần nữa với dữ liệu mới nhất khi submit (defense in depth).
 */
export function RentalConfirmDialog({
  rental,
  customer,
  vehicle,
  existingRentals,
  open,
  onOpenChange,
}: {
  rental: Rental | null
  customer?: Customer
  vehicle?: Vehicle
  existingRentals: Rental[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const confirmRental = useConfirmRental()

  const result = rental && customer && vehicle ? canConfirm(rental, customer, vehicle, existingRentals) : undefined

  async function handleConfirm() {
    if (!rental) return
    try {
      await confirmRental.mutateAsync(rental.id)
      toast.success(vi.rentals.confirmSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.rentals.confirmError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.rentals.confirmDialogTitle}</DialogTitle>
          <DialogDescription>{vi.rentals.confirmDialogDescription}</DialogDescription>
        </DialogHeader>
        {rental && (
          <div className="text-sm">
            <p>
              {customer?.fullName ?? rental.customerId} — {vehicle ? `${vehicle.plate} (${vehicle.brand} ${vehicle.model})` : rental.vehicleId}
            </p>
            <p className="text-muted-foreground">
              {formatDateTime(rental.pickupDateTime)} → {formatDateTime(rental.expectedReturnDateTime)}
            </p>
          </div>
        )}
        {result && !result.ok && (
          <p className="text-destructive text-sm font-medium">
            {vi.rentals.confirmBlockedReason}: {result.reason}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={!result?.ok || confirmRental.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
