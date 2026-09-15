import { useState } from 'react'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useVoidContract } from '../hooks'
import { contractVoidReasonSchema, type Contract } from '../model'

/** CT-BR-05/UC-CT-13 — Huỷ hợp đồng, bắt buộc nhập lý do. Mirror `RentalCancelDialog`. */
export function ContractVoidDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const voidContract = useVoidContract()
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
    const result = contractVoidReasonSchema.safeParse({ reason })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? vi.contracts.voidReasonLabel)
      return
    }
    if (!contract) return
    try {
      await voidContract.mutateAsync({ id: contract.id, reason: result.data.reason })
      toast.success(vi.contracts.voidSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.contracts.voidError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.contracts.voidDialogTitle}</DialogTitle>
          {contract && <DialogDescription>{contract.contractCode}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract-void-reason">{vi.contracts.voidReasonLabel} *</Label>
          <Textarea
            id="contract-void-reason"
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
          <Button type="button" disabled={voidContract.isPending} onClick={handleConfirm}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
