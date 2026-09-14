import { useState } from 'react'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

/**
 * Dialog nhập lý do dùng chung cho các hành động có audit yêu cầu `Reason`
 * bắt buộc (`UC-EA-20` §24.3): đổi vai trò (`CHANGE_ROLE`) và khoá tài khoản
 * (`LOCK_ACCOUNT`). Thay cho `window.confirm`/`window.prompt` trước đây —
 * không phù hợp cho môi trường demo khách hàng. Cùng pattern Dialog với
 * `EmployeeStatusDialog`.
 */
export function EmployeeReasonDialog({
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
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError(vi.employees.reasonRequired)
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-reason-dialog-reason">{vi.employees.reason} *</Label>
          <Textarea
            id="employee-reason-dialog-reason"
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
