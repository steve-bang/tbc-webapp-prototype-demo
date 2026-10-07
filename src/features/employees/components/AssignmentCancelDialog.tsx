import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCancelAssignment } from '../hooks'
import { assignmentCancelSchema, type Assignment } from '../model'

/** `AssignmentCancelDialog` — §5.3 kế hoạch, mirror `rentals/components/RentalCancelDialog`. */
export function AssignmentCancelDialog({
  assignment,
  open,
  onOpenChange,
}: {
  assignment: Assignment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const cancelAssignment = useCancelAssignment()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Reset form khi dialog vừa mở lại — tránh "adjusting state during render" ở effect riêng.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setError(null)
    }
  }

  async function handleConfirm() {
    const result = assignmentCancelSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.employees.reasonRequired)
      return
    }
    if (!assignment) return
    try {
      await cancelAssignment.mutateAsync({ id: assignment.id, reason: result.data.reason })
      toast.success(vi.employees.assignmentCancelSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.employees.assignmentCancelError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.employees.assignmentCancelDialogTitle}</DialogTitle>
          {assignment && (
            <DialogDescription>
              {assignment.role === 'DELIVERY' ? vi.employees.assignmentRoleDelivery : vi.employees.assignmentRoleReceiving}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asg-cancel-reason">{vi.employees.assignmentCancelReasonLabel} *</Label>
          <Textarea
            id="asg-cancel-reason"
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
          <Button type="button" disabled={cancelAssignment.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
