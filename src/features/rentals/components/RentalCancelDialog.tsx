import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCancelRental } from '../hooks'
import { rentalCancelReasonSchema, type Rental } from '../model'

/**
 * `UC-RM-01` §5.3 — Huỷ lượt thuê, bắt buộc nhập lý do. Mirror
 * `CustomerReasonDialog` (viết riêng bản này trong `rentals` để giữ ranh giới
 * feature, không import chéo — `CONVENTIONS.md` §3).
 */
export function RentalCancelDialog({
  rental,
  open,
  onOpenChange,
}: {
  rental: Rental | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cancelRental = useCancelRental()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Reset form khi dialog vừa mở lại — "adjusting state during render", tránh cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = rentalCancelReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.customers.reasonRequired)
      return
    }
    if (!rental) return
    try {
      await cancelRental.mutateAsync({ id: rental.id, reason: result.data.reason })
      toast.success(vi.rentals.cancelSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.rentals.cancelError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.rentals.cancelDialogTitle}</DialogTitle>
          {rental && <DialogDescription>{`${vi.rentals.columnPeriod}: ${rental.pickupDateTime.slice(0, 10)}`}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rental-cancel-reason">{vi.rentals.cancelReasonLabel} *</Label>
          <Textarea
            id="rental-cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={cancelRental.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
