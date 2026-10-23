import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { usePermission } from '@/features/auth'
import { useVehicles } from '@/features/vehicles/hooks'
import { CONSIGNMENT_PRORATION_RULES } from '@/shared/domain/enums'
import { CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import {
  useConsignmentContracts,
  useCreateConsignmentContract,
  useUpdateConsignmentContract,
  useVehicleOwners,
} from '../hooks'
import type { ConsignmentContractInput } from '../api'
import {
  consignmentContractFormSchema,
  OPEN_CONTRACT_STATUSES,
  type ConsignmentContract,
  type ConsignmentContractFormValues,
} from '../model'

function toFormValues(contract?: ConsignmentContract | null): ConsignmentContractFormValues {
  return {
    ownerId: contract?.ownerId ?? '',
    vehicleId: contract?.vehicleId ?? '',
    effectiveFrom: contract?.effectiveFrom ?? '',
    effectiveTo: contract?.effectiveTo ?? '',
    noticePeriodDays: contract ? String(contract.noticePeriodDays) : '',
    autoRenew: contract?.autoRenew ?? false,
    fixedMonthlyAmount: contract ? String(contract.paymentTerm.fixedMonthlyAmount) : '',
    paymentDay: contract ? String(contract.paymentTerm.paymentDay) : '',
    prorationRule: contract?.paymentTerm.prorationRule ?? 'PRORATE_BY_DAY',
    thirdPartyPlatformAllowed: contract?.exploitationRights.thirdPartyPlatformAllowed ?? false,
    advertisingImageAllowed: contract?.exploitationRights.advertisingImageAllowed ?? false,
    usageScopeNote: contract?.exploitationRights.usageScopeNote ?? '',
    note: contract?.note ?? '',
  }
}

function toInput(values: ConsignmentContractFormValues): ConsignmentContractInput {
  return {
    effectiveFrom: values.effectiveFrom,
    effectiveTo: values.effectiveTo,
    noticePeriodDays: Number(values.noticePeriodDays),
    autoRenew: values.autoRenew,
    paymentTerm: {
      fixedMonthlyAmount: Number(values.fixedMonthlyAmount),
      paymentDay: Number(values.paymentDay),
      prorationRule: values.prorationRule,
    },
    exploitationRights: {
      thirdPartyPlatformAllowed: values.thirdPartyPlatformAllowed,
      advertisingImageAllowed: values.advertisingImageAllowed,
      usageScopeNote: values.usageScopeNote || undefined,
    },
    note: values.note || undefined,
  }
}

/**
 * Tạo hợp đồng / sửa hợp đồng `DRAFT`. Chế độ tạo chỉ liệt kê xe ký gửi chưa có hợp đồng đang mở (UI lọc; API vẫn chặn).
 * Nhóm "Mức chi trả hàng tháng" bị khoá khi thiếu quyền `CONSIGNMENT.CONFIG`.
 */
export function ConsignmentContractFormSheet({
  contract,
  open,
  onOpenChange,
  onCreated,
}: {
  contract?: ConsignmentContract | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (created: ConsignmentContract) => void
}) {
  const isEditing = !!contract
  const { can } = usePermission()
  const canConfig = can('CONSIGNMENT', 'CONFIG')

  const createContract = useCreateConsignmentContract()
  const updateContract = useUpdateConsignmentContract()
  const { data: owners } = useVehicleOwners()
  const { data: vehicles } = useVehicles()
  const { data: contracts } = useConsignmentContracts()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsignmentContractFormValues>({
    resolver: zodResolver(consignmentContractFormSchema),
    defaultValues: toFormValues(contract),
  })

  useEffect(() => {
    if (open) reset(toFormValues(contract))
  }, [contract, open, reset])

  // Xe ký gửi chưa có hợp đồng mở (kế hoạch mục 0.3 điểm 3).
  const availableVehicles = useMemo(() => {
    const busy = new Set((contracts ?? []).filter((c) => OPEN_CONTRACT_STATUSES.includes(c.status)).map((c) => c.vehicleId))
    return (vehicles ?? []).filter((v) => v.ownershipType === 'CONSIGNED' && !busy.has(v.id))
  }, [vehicles, contracts])

  const isBusy = createContract.isPending || updateContract.isPending || isSubmitting
  const editingOwner = owners?.find((o) => o.id === contract?.ownerId)
  const editingVehicle = vehicles?.find((v) => v.id === contract?.vehicleId)

  async function onSubmit(values: ConsignmentContractFormValues) {
    try {
      if (isEditing && contract) {
        await updateContract.mutateAsync({ id: contract.id, input: toInput(values) })
        toast.success(vi.consignment.contractUpdateSuccess)
      } else {
        const created = await createContract.mutateAsync({
          ownerId: values.ownerId,
          vehicleId: values.vehicleId,
          ...toInput(values),
        })
        toast.success(vi.consignment.contractCreateSuccess)
        onCreated?.(created)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.contractSaveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[520px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{isEditing ? vi.consignment.contractEditTitle : vi.consignment.contractCreateTitle}</SheetTitle>
          {isEditing && contract && <SheetDescription>{contract.contractNo}</SheetDescription>}
        </SheetHeader>

        <form
          id="consignment-contract-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <h3 className="text-sm font-semibold">{vi.consignment.contractSectionParties}</h3>

          {isEditing ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">{vi.consignment.contractOwner}</span>
                <span className="text-sm">{editingOwner ? `${editingOwner.code} — ${editingOwner.fullName}` : '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">{vi.consignment.contractVehicle}</span>
                <span className="text-sm">{editingVehicle?.plate ?? '—'}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{vi.consignment.contractOwner} *</Label>
                <Controller
                  control={control}
                  name="ownerId"
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={vi.consignment.contractOwnerPlaceholder} />
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{vi.consignment.contractVehicle} *</Label>
                {availableVehicles.length === 0 ? (
                  <p className="border-border text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    {vi.consignment.contractVehicleEmptyGuide}
                  </p>
                ) : (
                  <Controller
                    control={control}
                    name="vehicleId"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={vi.consignment.contractVehiclePlaceholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableVehicles.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plate} — {v.brand} {v.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId.message}</p>}
              </div>
            </>
          )}

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.consignment.contractSectionTerm}</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cg-from">{vi.consignment.contractEffectiveFrom} *</Label>
              <Input id="cg-from" type="date" {...register('effectiveFrom')} />
              {errors.effectiveFrom && <p className="text-destructive text-sm">{errors.effectiveFrom.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cg-to">{vi.consignment.contractEffectiveTo} *</Label>
              <Input id="cg-to" type="date" {...register('effectiveTo')} />
              {errors.effectiveTo && <p className="text-destructive text-sm">{errors.effectiveTo.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cg-notice">{vi.consignment.contractNoticePeriod} *</Label>
            <Input id="cg-notice" inputMode="numeric" {...register('noticePeriodDays')} />
            {errors.noticePeriodDays && <p className="text-destructive text-sm">{errors.noticePeriodDays.message}</p>}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cg-autorenew">{vi.consignment.contractAutoRenew}</Label>
            <Controller
              control={control}
              name="autoRenew"
              render={({ field }) => <Switch id="cg-autorenew" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.consignment.contractSectionPayment}</h3>

          <fieldset disabled={!canConfig} className="flex flex-col gap-4 disabled:opacity-70">
            {!canConfig && <p className="text-muted-foreground text-xs">{vi.consignment.contractPaymentTermLocked}</p>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cg-amount">{vi.consignment.contractFixedMonthlyAmount} *</Label>
              <Input id="cg-amount" inputMode="numeric" {...register('fixedMonthlyAmount')} />
              {errors.fixedMonthlyAmount && <p className="text-destructive text-sm">{errors.fixedMonthlyAmount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cg-payday">{vi.consignment.contractPaymentDay} *</Label>
              <Input id="cg-payday" inputMode="numeric" {...register('paymentDay')} />
              {errors.paymentDay && <p className="text-destructive text-sm">{errors.paymentDay.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{vi.consignment.contractProrationRule}</Label>
              <Controller
                control={control}
                name="prorationRule"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!canConfig}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSIGNMENT_PRORATION_RULES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {CONSIGNMENT_PRORATION_RULE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </fieldset>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.consignment.contractSectionRights}</h3>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cg-third">{vi.consignment.contractThirdPartyPlatform}</Label>
            <Controller
              control={control}
              name="thirdPartyPlatformAllowed"
              render={({ field }) => <Switch id="cg-third" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="cg-ads">{vi.consignment.contractAdvertisingImage}</Label>
            <Controller
              control={control}
              name="advertisingImageAllowed"
              render={({ field }) => <Switch id="cg-ads" checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cg-scope">{vi.consignment.contractUsageScopeNote}</Label>
            <Input id="cg-scope" {...register('usageScopeNote')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cg-note">{vi.consignment.contractNote}</Label>
            <Textarea id="cg-note" rows={3} {...register('note')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="consignment-contract-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
