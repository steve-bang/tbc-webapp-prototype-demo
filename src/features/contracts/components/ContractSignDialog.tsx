import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useMarkContractSigned } from '../hooks'
import { contractSignFormSchema, type Contract, type ContractSignFormValues } from '../model'

function defaultValues(): ContractSignFormValues {
  return {
    signedCopyFileName: '',
    signedDate: new Date().toISOString().slice(0, 10),
    signedByCompany: '',
    signedByCustomer: '',
  }
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §1.1 mục 4/§5.4 — "Tải lên bản ký" GIẢ
 * LẬP: chỉ nhập tên file + ngày ký + người ký 2 bên, không upload file thật.
 * `GENERATED -> SIGNED` (`canMarkSigned()`).
 */
export function ContractSignDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const markSigned = useMarkContractSigned()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContractSignFormValues>({
    resolver: zodResolver(contractSignFormSchema),
    defaultValues: defaultValues(),
  })

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues())
    onOpenChange(next)
  }

  async function onSubmit(values: ContractSignFormValues) {
    if (!contract) return
    try {
      await markSigned.mutateAsync({ id: contract.id, input: values })
      toast.success(vi.contracts.signSuccess)
      handleOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.contracts.signError)
    }
  }

  const isBusy = markSigned.isPending || isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vi.contracts.signDialogTitle}</DialogTitle>
        </DialogHeader>

        <form id="contract-sign-form" className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signedCopyFileName">{vi.contracts.signedCopyFileName} *</Label>
            <Input id="signedCopyFileName" {...register('signedCopyFileName')} />
            {errors.signedCopyFileName && (
              <p className="text-destructive text-sm">{errors.signedCopyFileName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signedDate">{vi.contracts.signedDate} *</Label>
            <Input id="signedDate" type="date" {...register('signedDate')} />
            {errors.signedDate && <p className="text-destructive text-sm">{errors.signedDate.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signedByCompany">{vi.contracts.signedByCompany} *</Label>
            <Input id="signedByCompany" {...register('signedByCompany')} />
            {errors.signedByCompany && <p className="text-destructive text-sm">{errors.signedByCompany.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signedByCustomer">{vi.contracts.signedByCustomer} *</Label>
            <Input id="signedByCustomer" {...register('signedByCustomer')} />
            {errors.signedByCustomer && <p className="text-destructive text-sm">{errors.signedByCustomer.message}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="contract-sign-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
