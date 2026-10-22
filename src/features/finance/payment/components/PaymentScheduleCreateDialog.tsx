import { toast } from 'sonner'
import type { Rental } from '@/features/rentals'
import { PAYMENT_MILESTONE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useCreatePaymentSchedule } from '../hooks'
import { buildScheduleRequests } from '../model'

/** PM-BR-21, CR-2026-003/004/060 — xác nhận lập lịch, liệt kê yêu cầu sẽ sinh (§0.3 điểm 9 kế hoạch — hành động tường minh). */
export function PaymentScheduleCreateDialog({
  rental,
  open,
  onOpenChange,
}: {
  rental: Rental
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreatePaymentSchedule()
  const preview = buildScheduleRequests(rental, '', '')

  async function handleConfirm() {
    try {
      await create.mutateAsync(rental.id)
      toast.success(vi.finance.payment.scheduleCreateSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.finance.payment.scheduleCreateError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.finance.payment.scheduleCreateDialogTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{vi.finance.payment.scheduleCreateDialogIntro}</p>
        <div className="flex flex-col gap-2">
          {preview.map((request) => (
            <div key={request.id} className="bg-muted/50 flex items-center justify-between rounded-md p-3 text-sm">
              <span className="text-muted-foreground">
                {PAYMENT_MILESTONE_LABELS[request.source === 'BOOKING' ? 'BOOKING' : 'HANDOVER']}
                {request.transactionType === 'DEPOSIT' ? ' — Cọc' : ' — Tiền thuê'}
              </span>
              <span className="font-medium">{formatVnd(request.expectedAmount)}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={create.isPending} onClick={handleConfirm}>
            {vi.finance.payment.scheduleButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
