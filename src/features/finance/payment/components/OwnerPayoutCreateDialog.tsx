import { useState } from 'react'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import type { OwnerPayoutRecord, VehicleOwner } from '@/features/consignment'
import { OwnerBankAccountField } from '@/features/consignment/ui'
import { vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateOwnerPayout } from '../hooks'
import { ownerPayoutCreateFormSchema } from '../model'

/**
 * Tạo lệnh chi cho một khoản chi trả chủ xe (UC-VC-09). Số tiền và người nhận do khoản chi trả quyết định (chỉ đọc, số tài
 * khoản đã che; "Hiện đầy đủ" có meta-audit); chỉ nhập mã tham chiếu và ghi chú tuỳ chọn. Phương thức: chuyển khoản.
 */
export function OwnerPayoutCreateDialog({
  record,
  owner,
  contractNo,
  open,
  onOpenChange,
}: {
  record: OwnerPayoutRecord | null
  owner?: VehicleOwner
  contractNo?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.finance.ownerPayout
  const { can } = usePermission()
  const canReveal = can('CONSIGNMENT', 'CREATE') || can('CONSIGNMENT', 'CONFIRM')
  const create = useCreateOwnerPayout()
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReference('')
      setNote('')
      setError(null)
    }
  }

  async function handleConfirm() {
    if (!record) return
    const parsed = ownerPayoutCreateFormSchema.safeParse({ reference, note })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '')
      return
    }
    try {
      const txn = await create.mutateAsync({ recordId: record.id, input: parsed.data })
      toast.success(t.createSuccess(txn.code))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.createError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.createDialogTitle}</DialogTitle>
          <DialogDescription>{t.createDialogDescription}</DialogDescription>
        </DialogHeader>
        {record && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.columnRecord}</span>
              <span className="font-mono text-xs">
                {record.code} · {record.period.slice(5)}/{record.period.slice(0, 4)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.columnContract}</span>
              <span className="font-mono text-xs">{contractNo ?? record.contractId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.partyOwnerLabel}</span>
              <span>{owner?.fullName ?? record.ownerId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.columnAmount}</span>
              <span className="text-base font-semibold">{formatVnd(record.amountPayable)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t.columnDueDate}</span>
              <span>{formatDate(record.dueDate)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">{t.recipientLabel}</span>
              {owner ? <OwnerBankAccountField owner={owner} canReveal={canReveal} /> : <span>{vi.common.emptyValue}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-payout-reference">{t.referenceLabel}</Label>
              <Input id="owner-payout-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-payout-note">{t.noteLabel}</Label>
              <Textarea id="owner-payout-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <p className="text-muted-foreground text-xs">{t.createNote}</p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" disabled={create.isPending || !record} onClick={handleConfirm}>
            {t.createConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
