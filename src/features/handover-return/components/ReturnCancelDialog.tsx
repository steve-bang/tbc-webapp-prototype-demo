import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCancelReturn } from '../hooks'
import { returnCancelReasonSchema, type ReturnRecord } from '../model'

/**
 * UC-VR-19 — Huỷ biên bản trả xe `COMPLETED`, 2 bước (lý do → xác nhận tác
 * động) — mirror `HandoverCancelDialog`.
 */
export function ReturnCancelDialog({
  returnRecord,
  open,
  onOpenChange,
}: {
  returnRecord: ReturnRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cancelReturn = useCancelReturn()
  const [step, setStep] = useState<'reason' | 'confirm'>('reason')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
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
    const result = returnCancelReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.handoverReturn.cancelReasonLabel)
      return
    }
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!returnRecord) return
    try {
      await cancelReturn.mutateAsync({ id: returnRecord.id, reason })
      toast.success(vi.handoverReturn.cancelReturnSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.handoverReturn.cancelReturnError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'reason' ? vi.handoverReturn.cancelReturnDialogTitle : vi.handoverReturn.cancelStep2Title}</DialogTitle>
          {returnRecord && <DialogDescription>{returnRecord.rentalId}</DialogDescription>}
        </DialogHeader>

        {step === 'reason' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return-cancel-reason">{vi.handoverReturn.cancelReasonLabel} *</Label>
            <Textarea
              id="return-cancel-reason"
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
              <Button type="button" variant="destructive" disabled={cancelReturn.isPending} onClick={handleConfirm}>
                {vi.handoverReturn.confirmCancelAction}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
