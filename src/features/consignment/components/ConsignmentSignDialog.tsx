import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useSignConsignmentContract } from '../hooks'
import { consignmentSignFormSchema, type ConsignmentContract, type ConsignmentSignFormValues } from '../model'

/**
 * "Duyệt & xác nhận đã ký": `PENDING_APPROVAL → SIGNED`, chốt điều khoản (VC-BR-05). Bản scan là upload giả lập
 * (chỉ nhập tên file) — mirror `ContractSignDialog`.
 */
export function ConsignmentSignDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: ConsignmentContract
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const sign = useSignConsignmentContract()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentSignFormValues>({
    resolver: zodResolver(consignmentSignFormSchema),
    defaultValues: { signedFileName: '' },
  })

  useEffect(() => {
    if (open) reset({ signedFileName: '' })
  }, [open, reset])

  async function onSubmit(values: ConsignmentSignFormValues) {
    try {
      await sign.mutateAsync({ id: contract.id, signedFileName: values.signedFileName })
      toast.success(vi.consignment.signSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.consignment.signDialogTitle}</DialogTitle>
          <DialogDescription>{vi.consignment.signDialogDescription}</DialogDescription>
        </DialogHeader>
        <form id="consignment-sign-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signedFileName">{vi.consignment.signFileName} *</Label>
            <Input id="signedFileName" {...register('signedFileName')} />
            {errors.signedFileName && <p className="text-destructive text-sm">{errors.signedFileName.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-sign-form" disabled={sign.isPending || isSubmitting}>
            {vi.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
