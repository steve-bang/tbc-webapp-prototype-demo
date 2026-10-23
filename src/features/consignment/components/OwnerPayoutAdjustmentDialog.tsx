import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { useRequestOwnerPayoutAdjustment } from '../hooks'
import { formatPeriod, ownerPayoutAdjustmentSchema, type OwnerPayoutAdjustmentFormValues, type OwnerPayoutRecord } from '../payoutModel'

/**
 * Nhập điều chỉnh thủ công khoản chi trả (số có dấu + ghi chú). Người có cả quyền sửa và duyệt có hiệu lực ngay; người chỉ
 * có quyền sửa thì điều chỉnh chờ duyệt — chỉ là gợi ý hiển thị, API tự quyết định theo cùng luật.
 */
export function OwnerPayoutAdjustmentDialog({
  record,
  open,
  onOpenChange,
}: {
  record: OwnerPayoutRecord
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = vi.consignment.payouts
  const { can } = usePermission()
  const selfApprove = can('CONSIGNMENT', 'EDIT') && can('CONSIGNMENT', 'APPROVE')
  const request = useRequestOwnerPayoutAdjustment()
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OwnerPayoutAdjustmentFormValues>({
    resolver: zodResolver(ownerPayoutAdjustmentSchema),
    defaultValues: { amount: '', note: '' },
  })

  useEffect(() => {
    if (open) reset({ amount: '', note: '' })
  }, [open, reset])

  const amountText = useWatch({ control, name: 'amount' })
  const amount = Number(amountText)
  const preview = Number.isInteger(amount) && amount !== 0 ? record.amountPayable + amount : undefined

  async function onSubmit(values: OwnerPayoutAdjustmentFormValues) {
    try {
      await request.mutateAsync({ id: record.id, input: { amount: Number(values.amount), note: values.note } })
      toast.success(selfApprove ? t.adjustSuccessApplied : t.adjustSuccessPending)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.adjustDialogTitle}</DialogTitle>
          <DialogDescription>
            {record.code} — {t.periodLabel(formatPeriod(record.period))}
          </DialogDescription>
        </DialogHeader>
        <form id="owner-payout-adjust-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <p className="text-sm">
            <span className="text-muted-foreground">{t.currentAmountPayable}: </span>
            <span className="font-medium">{formatVnd(record.amountPayable)}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-adjust-amount">{t.adjustAmountLabel} *</Label>
            <Input id="payout-adjust-amount" inputMode="numeric" placeholder={t.adjustAmountPlaceholder} {...register('amount')} />
            {errors.amount ? (
              <p className="text-destructive text-sm">{errors.amount.message}</p>
            ) : (
              preview !== undefined && (
                <p className={preview > 0 ? 'text-muted-foreground text-xs' : 'text-destructive text-xs'}>{t.adjustPreview(formatVnd(preview))}</p>
              )
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payout-adjust-note">{t.adjustNoteLabel} *</Label>
            <Textarea id="payout-adjust-note" rows={3} {...register('note')} />
            {errors.note && <p className="text-destructive text-sm">{errors.note.message}</p>}
          </div>
          <p className="text-muted-foreground text-xs">{selfApprove ? t.adjustHintApplied : t.adjustHintPending}</p>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="owner-payout-adjust-form" disabled={request.isPending || isSubmitting}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
