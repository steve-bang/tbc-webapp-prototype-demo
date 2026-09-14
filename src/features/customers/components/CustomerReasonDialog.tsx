import { useState } from 'react'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { blockReasonSchema } from '../model'

/**
 * Dialog nhập lý do dùng chung cho Khoá/Mở khoá khách hàng — `UC-CM-06`/
 * `AC-CM-006` bắt buộc `Reason`. Cùng pattern `EmployeeReasonDialog`
 * (`features/employees`), viết riêng bản này trong `customers` để giữ ranh
 * giới feature (không import chéo giữa 2 feature).
 */
export function CustomerReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Reset form khi dialog vừa mở lại — pattern "adjusting state during
  // render" (không dùng useEffect) để tránh cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setError(null)
    }
  }

  function handleConfirm() {
    const result = blockReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.customers.reasonRequired)
      return
    }
    onConfirm(result.data.reason)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="customer-reason-dialog-reason">{vi.customers.reason} *</Label>
          <Textarea
            id="customer-reason-dialog-reason"
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
          <Button type="button" disabled={busy} onClick={handleConfirm}>
            {confirmLabel ?? vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
