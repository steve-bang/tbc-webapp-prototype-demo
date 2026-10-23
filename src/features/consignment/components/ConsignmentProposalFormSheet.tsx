import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { useVehicles } from '@/features/vehicles/hooks'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Textarea } from '@/shared/ui/textarea'
import type { ConsignmentProposalInput } from '../proposalApi'
import {
  useConsignmentContracts,
  useConsignmentProposals,
  useCreateConsignmentProposal,
  useUpdateConsignmentProposal,
  useVehicleOwners,
} from '../hooks'
import {
  consignmentProposalFormSchema,
  getProposalCreateBlocker,
  type ConsignmentProposal,
  type ConsignmentProposalFormValues,
} from '../proposalModel'

function toFormValues(proposal?: ConsignmentProposal | null, initialOwnerId?: string): ConsignmentProposalFormValues {
  return {
    ownerId: proposal?.ownerId ?? initialOwnerId ?? '',
    plate: proposal?.declaredVehicle.plate ?? '',
    brand: proposal?.declaredVehicle.brand ?? '',
    model: proposal?.declaredVehicle.model ?? '',
    manufacturingYear: proposal?.declaredVehicle.manufacturingYear ? String(proposal.declaredVehicle.manufacturingYear) : '',
    color: proposal?.declaredVehicle.color ?? '',
    declaredCondition: proposal?.declaredCondition ?? '',
    expectedMonthlyAmount: proposal ? String(proposal.expectedMonthlyAmount) : '',
    note: proposal?.note ?? '',
  }
}

function toInput(values: ConsignmentProposalFormValues): ConsignmentProposalInput {
  return {
    ownerId: values.ownerId,
    declaredVehicle: {
      plate: values.plate,
      brand: values.brand,
      model: values.model,
      manufacturingYear: values.manufacturingYear ? Number(values.manufacturingYear) : undefined,
      color: values.color || undefined,
    },
    declaredCondition: values.declaredCondition,
    expectedMonthlyAmount: Number(values.expectedMonthlyAmount),
    note: values.note || undefined,
  }
}

/**
 * Ghi nhận / sửa đề nghị ký gửi (chỉ khi `SUBMITTED`). Chủ xe phải có hồ sơ trước — chưa có thì gợi ý thêm ở Hồ sơ chủ xe.
 * Cảnh báo ngay khi biển số trùng xe đang có hợp đồng mở hoặc đề nghị đang xử lý (API vẫn chặn).
 */
export function ConsignmentProposalFormSheet({
  proposal,
  initialOwnerId,
  open,
  onOpenChange,
  onCreated,
}: {
  proposal?: ConsignmentProposal | null
  initialOwnerId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (created: ConsignmentProposal) => void
}) {
  const t = vi.consignment.proposals
  const isEditing = !!proposal
  const createProposal = useCreateConsignmentProposal()
  const updateProposal = useUpdateConsignmentProposal()
  const { data: owners } = useVehicleOwners()
  const { data: vehicles } = useVehicles()
  const { data: contracts } = useConsignmentContracts()
  const { data: proposals } = useConsignmentProposals()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentProposalFormValues>({
    resolver: zodResolver(consignmentProposalFormSchema),
    defaultValues: toFormValues(proposal, initialOwnerId),
  })

  useEffect(() => {
    if (open) reset(toFormValues(proposal, initialOwnerId))
  }, [proposal, initialOwnerId, open, reset])

  const plate = useWatch({ control, name: 'plate' })
  const plateBlocker =
    plate.trim() && vehicles && contracts && proposals
      ? getProposalCreateBlocker({ plate, excludeProposalId: proposal?.id }, { vehicles, contracts, proposals })
      : undefined

  const isBusy = createProposal.isPending || updateProposal.isPending || isSubmitting

  async function onSubmit(values: ConsignmentProposalFormValues) {
    try {
      if (isEditing && proposal) {
        await updateProposal.mutateAsync({ id: proposal.id, input: toInput(values) })
        toast.success(t.updateSuccess)
      } else {
        const created = await createProposal.mutateAsync(toInput(values))
        toast.success(t.createSuccess)
        onCreated?.(created)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[520px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{isEditing ? t.editTitle : t.createTitle}</SheetTitle>
          <SheetDescription>{isEditing && proposal ? proposal.code : t.createDescription}</SheetDescription>
        </SheetHeader>

        <form id="consignment-proposal-form" className="flex flex-1 flex-col gap-4 overflow-y-auto p-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <Label>{t.fieldOwner} *</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t.fieldOwnerPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {(owners ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.code} — {o.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.ownerId && <p className="text-destructive text-sm">{errors.ownerId.message}</p>}
            <p className="text-muted-foreground text-xs">
              {t.ownerMissingHint}{' '}
              <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwners}>
                {t.ownerMissingLink}
              </Link>
            </p>
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{t.sectionVehicle}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cgp-plate">{t.fieldPlate} *</Label>
            <Input id="cgp-plate" {...register('plate')} />
            {errors.plate && <p className="text-destructive text-sm">{errors.plate.message}</p>}
            {plateBlocker && <p className="text-destructive text-sm">{plateBlocker}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cgp-brand">{t.fieldBrand} *</Label>
              <Input id="cgp-brand" {...register('brand')} />
              {errors.brand && <p className="text-destructive text-sm">{errors.brand.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cgp-model">{t.fieldModel} *</Label>
              <Input id="cgp-model" {...register('model')} />
              {errors.model && <p className="text-destructive text-sm">{errors.model.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cgp-year">{t.fieldYear}</Label>
              <Input id="cgp-year" inputMode="numeric" {...register('manufacturingYear')} />
              {errors.manufacturingYear && <p className="text-destructive text-sm">{errors.manufacturingYear.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cgp-color">{t.fieldColor}</Label>
              <Input id="cgp-color" {...register('color')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cgp-condition">{t.fieldCondition} *</Label>
            <Textarea id="cgp-condition" rows={3} {...register('declaredCondition')} />
            {errors.declaredCondition && <p className="text-destructive text-sm">{errors.declaredCondition.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cgp-amount">{t.fieldExpectedAmount} *</Label>
            <Input id="cgp-amount" inputMode="numeric" {...register('expectedMonthlyAmount')} />
            {errors.expectedMonthlyAmount && <p className="text-destructive text-sm">{errors.expectedMonthlyAmount.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cgp-note">{t.fieldNote}</Label>
            <Textarea id="cgp-note" rows={2} {...register('note')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-proposal-form" disabled={isBusy || !!plateBlocker}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
