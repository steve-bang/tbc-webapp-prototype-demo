import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Textarea } from '@/shared/ui/textarea'
import { useCreateCustomer, useUpdateCustomer } from '../hooks'
import { customerFormSchema, type Customer, type CustomerFormValues } from '../model'
import type { CustomerFormInput } from '../api'

/** Giá trị đại diện "chưa chọn" cho các Select optional — Radix Select không cho phép value rỗng ở `SelectItem`. */
const UNSET = '__UNSET__'

function toFormValues(customer?: Customer | null): CustomerFormValues {
  return {
    fullName: customer?.fullName ?? '',
    dob: customer?.dob ?? '',
    gender: customer?.gender,
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    note: customer?.note ?? '',
    idType: customer?.idType,
    idNumber: customer?.idNumber ?? '',
    idIssueDate: customer?.idIssueDate ?? '',
    idIssuePlace: customer?.idIssuePlace ?? '',
    idExpiryDate: customer?.idExpiryDate ?? '',
    licenseNumber: customer?.licenseNumber ?? '',
    licenseClass: customer?.licenseClass ?? '',
    licenseIssueDate: customer?.licenseIssueDate ?? '',
    licenseExpiryDate: customer?.licenseExpiryDate ?? '',
  }
}

/** `UC-CM-03` — tạo/sửa hồ sơ khách hàng (Round 1: không có tab Giấy tờ, xem `docs/CUSTOMER-MANAGEMENT-PLAN.md` §6.2). */
export function CustomerFormSheet({
  customer,
  open,
  onOpenChange,
}: {
  customer?: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isEditing = !!customer
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: toFormValues(customer),
  })

  useEffect(() => {
    if (open) reset(toFormValues(customer))
  }, [customer, open, reset])

  const isBusy = createCustomer.isPending || updateCustomer.isPending || isSubmitting

  function toInput(values: CustomerFormValues): CustomerFormInput {
    return {
      fullName: values.fullName,
      dob: values.dob || undefined,
      gender: values.gender,
      phone: values.phone,
      email: values.email || undefined,
      address: values.address || undefined,
      note: values.note || undefined,
      idType: values.idType,
      idNumber: values.idNumber,
      idIssueDate: values.idIssueDate || undefined,
      idIssuePlace: values.idIssuePlace || undefined,
      idExpiryDate: values.idExpiryDate || undefined,
      licenseNumber: values.licenseNumber || undefined,
      licenseClass: values.licenseClass || undefined,
      licenseIssueDate: values.licenseIssueDate || undefined,
      licenseExpiryDate: values.licenseExpiryDate || undefined,
    }
  }

  async function onSubmit(values: CustomerFormValues) {
    try {
      if (isEditing && customer) {
        await updateCustomer.mutateAsync({ id: customer.id, input: toInput(values) })
        toast.success(vi.customers.updateSuccess)
      } else {
        await createCustomer.mutateAsync(toInput(values))
        toast.success(vi.customers.createSuccess)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.customers.saveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[480px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{isEditing ? vi.customers.editTitle : vi.customers.createTitle}</SheetTitle>
          {isEditing && customer && (
            <SheetDescription>
              {vi.customers.phone}: {customer.phone}
            </SheetDescription>
          )}
        </SheetHeader>

        <form
          id="customer-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <h3 className="text-sm font-semibold">{vi.customers.sectionPersonal}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">{vi.customers.fullName} *</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-destructive text-sm">{errors.fullName.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dob">{vi.customers.dob}</Label>
            <Input id="dob" type="date" {...register('dob')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.customers.gender}</Label>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select
                  value={field.value ?? UNSET}
                  onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.customers.genderPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>{vi.customers.genderPlaceholder}</SelectItem>
                    <SelectItem value="MALE">{vi.customers.genderMale}</SelectItem>
                    <SelectItem value="FEMALE">{vi.customers.genderFemale}</SelectItem>
                    <SelectItem value="OTHER">{vi.customers.genderOther}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">{vi.customers.phone} *</Label>
            <Input id="phone" {...register('phone')} />
            {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{vi.customers.email}</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">{vi.customers.address}</Label>
            <Input id="address" {...register('address')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.customers.note}</Label>
            <Textarea id="note" rows={3} {...register('note')} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.customers.sectionIdentity}</h3>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.customers.idType}</Label>
            <Controller
              control={control}
              name="idType"
              render={({ field }) => (
                <Select
                  value={field.value ?? UNSET}
                  onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.customers.idTypePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSET}>{vi.customers.idTypePlaceholder}</SelectItem>
                    <SelectItem value="ID_CARD">{vi.customers.idTypeIdCard}</SelectItem>
                    <SelectItem value="PASSPORT">{vi.customers.idTypePassport}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {/* TODO(OQ: CM-BRD §31 Q1/Q2 — có cho phép khách không CCCD? Phase 1 bắt buộc để giữ đơn giản.) */}
            <Label htmlFor="idNumber">{vi.customers.idNumber} *</Label>
            <Input id="idNumber" {...register('idNumber')} />
            {errors.idNumber && <p className="text-destructive text-sm">{errors.idNumber.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idIssueDate">{vi.customers.idIssueDate}</Label>
            <Input id="idIssueDate" type="date" {...register('idIssueDate')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idIssuePlace">{vi.customers.idIssuePlace}</Label>
            <Input id="idIssuePlace" {...register('idIssuePlace')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idExpiryDate">{vi.customers.idExpiryDate}</Label>
            <Input id="idExpiryDate" type="date" {...register('idExpiryDate')} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.customers.sectionLicense}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseNumber">{vi.customers.licenseNumber}</Label>
            <Input id="licenseNumber" {...register('licenseNumber')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseClass">{vi.customers.licenseClass}</Label>
            <Input id="licenseClass" {...register('licenseClass')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseIssueDate">{vi.customers.licenseIssueDate}</Label>
            <Input id="licenseIssueDate" type="date" {...register('licenseIssueDate')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="licenseExpiryDate">{vi.customers.licenseExpiryDate}</Label>
            <Input id="licenseExpiryDate" type="date" {...register('licenseExpiryDate')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="customer-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
