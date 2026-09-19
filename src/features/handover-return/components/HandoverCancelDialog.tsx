import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCancelHandover } from '../hooks'
import { handoverCancelReasonSchema, type HandoverRecord } from '../model'

/**
 * UC-VH-14 — Huỷ biên bản giao xe `COMPLETED`, 2 bước (lý do → xác nhận tác
 * động) — `docs/HANDOVER-RETURN-MANAGEMENT-PLAN.md` §5.5/§9.3. Bước 2 hiển thị
 * cảnh báo Vehicle theo §0.4 kế hoạch (hệ thống chưa tự động hoàn tác
 * Vehicle.status/currentKm).
 */
export function HandoverCancelDialog({
  handover,
  open,
  onOpenChange,
}: {
  handover: HandoverRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cancelHandover = useCancelHandover()
  const [step, setStep] = useState<'reason' | 'confirm'>('reason')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Reset form khi dialog vừa mở lại — "adjusting state during render", tránh cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep('reason')
      setReason('')
      setError(null)
    }
  }

  function handleContinue() {
    const result = handoverCancelReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.handoverReturn.cancelReasonLabel)
      return
    }
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!handover) return
    try {
      await cancelHandover.mutateAsync({ id: handover.id, reason })
      toast.success(vi.handoverReturn.cancelHandoverSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.handoverReturn.cancelHandoverError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'reason' ? vi.handoverReturn.cancelHandoverDialogTitle : vi.handoverReturn.cancelStep2Title}</DialogTitle>
          {handover && <DialogDescription>{handover.rentalId}</DialogDescription>}
        </DialogHeader>

        {step === 'reason' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handover-cancel-reason">{vi.handoverReturn.cancelReasonLabel} *</Label>
            <Textarea
              id="handover-cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{vi.handoverReturn.cancelStep2Warning}</p>
            <p className="border-status-pending/30 bg-status-pending/10 text-status-pending rounded-md border p-3 text-sm">
              {vi.handoverReturn.cancelStep2VehicleNotice}
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'reason' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {vi.common.cancel}
              </Button>
              <Button type="button" onClick={handleContinue}>
                {vi.handoverReturn.continueAction}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('reason')}>
                {vi.common.back}
              </Button>
              <Button type="button" variant="destructive" disabled={cancelHandover.isPending} onClick={handleConfirm}>
                {vi.handoverReturn.confirmCancelAction}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
