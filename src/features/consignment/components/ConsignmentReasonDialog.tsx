import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { consignmentReasonSchema, type ConsignmentReasonValues } from '../model'

/**
 * Dialog nhập lý do dùng chung: trả về nháp / tạm ngưng / khôi phục / thay bằng bản mới. Phần gọi API do nơi dùng truyền
 * vào `onConfirm` (ném lỗi nếu thất bại); dialog lo validate lý do (zod), toast và đóng.
 */
export function ConsignmentReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  successMessage,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  successMessage: string
  onConfirm: (reason: string) => Promise<unknown>
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentReasonValues>({
    resolver: zodResolver(consignmentReasonSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])

  async function onSubmit(values: ConsignmentReasonValues) {
    try {
      await onConfirm(values.reason)
      toast.success(successMessage)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form id="consignment-reason-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consignment-reason">{vi.consignment.reasonLabel} *</Label>
            <Textarea id="consignment-reason" rows={3} placeholder={vi.consignment.reasonPlaceholder} {...register('reason')} />
            {errors.reason && <p className="text-destructive text-sm">{errors.reason.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-reason-form" disabled={isSubmitting}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
