import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { OWNER_TYPES } from '@/shared/domain/enums'
import { OWNER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateVehicleOwner, useUpdateVehicleOwner } from '../hooks'
import { maskAccountNumber, vehicleOwnerFormSchema, type VehicleOwner, type VehicleOwnerFormValues } from '../model'

/** Giá trị đại diện "chưa chọn" cho Select tuỳ chọn — Radix Select không cho `SelectItem` value rỗng. */
const UNSET = '__UNSET__'

/** Số tài khoản KHÔNG được điền sẵn khi sửa (BRD mục 21): ô trống = giữ nguyên số cũ. */
function toFormValues(owner?: VehicleOwner | null): VehicleOwnerFormValues {
  return {
    ownerType: owner?.ownerType ?? 'INDIVIDUAL',
    fullName: owner?.fullName ?? '',
    idNumber: owner?.idNumber ?? '',
    taxCode: owner?.taxCode ?? '',
    dateOfBirth: owner?.dateOfBirth ?? '',
    gender: owner?.gender,
    phone: owner?.phone ?? '',
    email: owner?.email ?? '',
    address: owner?.address ?? '',
    bankAccountNumber: '',
    bankName: owner?.bankAccount?.bankName ?? '',
    bankAccountHolder: owner?.bankAccount?.accountHolder ?? '',
    note: owner?.note ?? '',
  }
}

/** Tạo / sửa hồ sơ chủ xe (BRD mục 6.1, CR-2026-027/051). */
export function VehicleOwnerFormSheet({
  owner,
  open,
  onOpenChange,
}: {
  owner?: VehicleOwner | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!owner
  const createOwner = useCreateVehicleOwner()
  const updateOwner = useUpdateVehicleOwner()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleOwnerFormValues>({
    resolver: zodResolver(vehicleOwnerFormSchema),
    defaultValues: toFormValues(owner),
  })

  useEffect(() => {
    if (open) reset(toFormValues(owner))
  }, [owner, open, reset])

  const ownerType = useWatch({ control, name: 'ownerType' })
  const isIndividual = ownerType === 'INDIVIDUAL'
  const isBusy = createOwner.isPending || updateOwner.isPending || isSubmitting

  async function onSubmit(values: VehicleOwnerFormValues) {
    try {
      if (isEditing && owner) {
        await updateOwner.mutateAsync({ id: owner.id, input: values })
        toast.success(vi.consignment.ownerUpdateSuccess)
      } else {
        await createOwner.mutateAsync(values)
        toast.success(vi.consignment.ownerCreateSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.ownerSaveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[480px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{isEditing ? vi.consignment.ownerEditTitle : vi.consignment.ownerCreateTitle}</SheetTitle>
          {isEditing && owner && <SheetDescription>{owner.code}</SheetDescription>}
        </SheetHeader>

        <form id="vehicle-owner-form" className="flex flex-1 flex-col gap-4 overflow-y-auto p-5" onSubmit={handleSubmit(onSubmit)}>
          <h3 className="text-sm font-semibold">{vi.consignment.ownerSectionIdentity}</h3>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.consignment.ownerType} *</Label>
            <Controller
              control={control}
              name="ownerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {OWNER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-fullName">
              {isIndividual ? vi.consignment.ownerFullNameIndividual : vi.consignment.ownerFullNameOrganization} *
            </Label>
            <Input id="owner-fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-destructive text-sm">{errors.fullName.message}</p>}
          </div>

          {isIndividual ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="owner-idNumber">{vi.consignment.ownerIdNumber} *</Label>
                <Input id="owner-idNumber" {...register('idNumber')} />
                {errors.idNumber && <p className="text-destructive text-sm">{errors.idNumber.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="owner-dob">{vi.consignment.ownerDateOfBirth}</Label>
                <Input id="owner-dob" type="date" {...register('dateOfBirth')} />
                {errors.dateOfBirth && <p className="text-destructive text-sm">{errors.dateOfBirth.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{vi.consignment.ownerGender}</Label>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value ?? UNSET} onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={vi.consignment.ownerGenderUnset} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNSET}>{vi.consignment.ownerGenderUnset}</SelectItem>
                        <SelectItem value="MALE">{vi.consignment.ownerGenderMale}</SelectItem>
                        <SelectItem value="FEMALE">{vi.consignment.ownerGenderFemale}</SelectItem>
                        <SelectItem value="OTHER">{vi.consignment.ownerGenderOther}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner-taxCode">{vi.consignment.ownerTaxCode} *</Label>
              <Input id="owner-taxCode" {...register('taxCode')} />
              {errors.taxCode && <p className="text-destructive text-sm">{errors.taxCode.message}</p>}
            </div>
          )}

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.consignment.ownerSectionContact}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-phone">{vi.consignment.ownerPhone} *</Label>
            <Input id="owner-phone" {...register('phone')} />
            {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-email">{vi.consignment.ownerEmail}</Label>
            <Input id="owner-email" type="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-address">{vi.consignment.ownerAddress}</Label>
            <Input id="owner-address" {...register('address')} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.consignment.ownerSectionBank}</h3>
          <p className="text-muted-foreground -mt-2 text-xs">{vi.consignment.ownerBankHint}</p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-bankNumber">{vi.consignment.ownerBankAccountNumber}</Label>
            <Input
              id="owner-bankNumber"
              inputMode="numeric"
              autoComplete="off"
              placeholder={owner?.bankAccount ? maskAccountNumber(owner.bankAccount.accountNumber) : undefined}
              {...register('bankAccountNumber')}
            />
            {owner?.bankAccount && (
              <p className="text-muted-foreground text-xs">{vi.consignment.ownerBankAccountNumberKeepHint}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-bankName">{vi.consignment.ownerBankName}</Label>
            <Input id="owner-bankName" {...register('bankName')} />
            {errors.bankName && <p className="text-destructive text-sm">{errors.bankName.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="owner-bankHolder">{vi.consignment.ownerBankAccountHolder}</Label>
            <Input id="owner-bankHolder" {...register('bankAccountHolder')} />
            {errors.bankAccountHolder && <p className="text-destructive text-sm">{errors.bankAccountHolder.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5 border-t pt-4">
            <Label htmlFor="owner-note">{vi.consignment.ownerNote}</Label>
            <Textarea id="owner-note" rows={3} {...register('note')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="vehicle-owner-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
