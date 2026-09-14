import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
// `customers`/`vehicles` chưa export `useCustomers`/`useVehicles` qua barrel
// `index.ts` nên import thẳng từ `hooks.ts` của feature đó — cùng tinh thần
// `maintenance/hooks.ts` import thẳng `vehicles/hooks.ts`.
import { useCustomers } from '@/features/customers/hooks'
import { useVehicles } from '@/features/vehicles/hooks'
import { SECURITY_DEPOSIT_TYPES } from '@/shared/domain/enums'
import { SECURITY_DEPOSIT_TYPE_LABELS, VEHICLE_CLASS_LABELS, VEHICLE_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Textarea } from '@/shared/ui/textarea'
import type { RentalFormInput } from '../api'
import { useCreateRental, useRentals } from '../hooks'
import {
  CASH_DEPOSIT_AMOUNT,
  PRICE_PER_KM_BY_CLASS,
  calcAllowedKm,
  calcBaseAmount,
  calcDeliveryFee,
  calcEstimatedTotal,
  calcPrepaymentAmount,
  hasConflict,
  rentalDurationDays,
  rentalFormSchema,
  type RentalFormValues,
} from '../model'

function defaultFormValues(): RentalFormValues {
  return {
    customerId: '',
    vehicleId: '',
    pickupDateTime: '',
    expectedReturnDateTime: '',
    pickupLocation: '',
    returnLocation: '',
    deliveryDistanceKm: '',
    rentalRate: '',
    discountAmount: '0',
    discountNote: '',
    additionalChargesAmount: '0',
    additionalChargesNote: '',
    securityDepositType: 'CASH_20M', // RM-BR-17 — mặc định tiền mặt
    securityDepositAssetNote: '',
    note: '',
  }
}

/**
 * `UC-RM-01` §5.5 — tạo lượt thuê (Round 1 không có Edit). 6 khối theo đúng
 * thứ tự kế hoạch: Khách hàng & Xe / Thời gian thuê / Địa điểm giao-nhận /
 * Giá & phụ phí / Đặt cọc / Ghi chú. Toàn bộ field tính toán hiển thị
 * real-time (readonly) qua `useWatch` + hàm thuần `model.ts`.
 */
export function RentalFormSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createRental = useCreateRental()
  const { data: customers = [] } = useCustomers()
  const { data: vehicles = [] } = useVehicles()
  const { data: existingRentals = [] } = useRentals()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RentalFormValues>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: defaultFormValues(),
  })

  useEffect(() => {
    if (open) reset(defaultFormValues())
  }, [open, reset])

  const isBusy = createRental.isPending || isSubmitting

  const activeCustomers = customers.filter((c) => c.status === 'ACTIVE')

  const watchedVehicleId = useWatch({ control, name: 'vehicleId' })
  const watchedPickup = useWatch({ control, name: 'pickupDateTime' })
  const watchedReturn = useWatch({ control, name: 'expectedReturnDateTime' })
  const watchedRate = useWatch({ control, name: 'rentalRate' })
  const watchedDiscount = useWatch({ control, name: 'discountAmount' })
  const watchedAdditional = useWatch({ control, name: 'additionalChargesAmount' })
  const watchedDeliveryKm = useWatch({ control, name: 'deliveryDistanceKm' })
  const watchedDepositType = useWatch({ control, name: 'securityDepositType' })

  const selectedVehicle = vehicles.find((v) => v.id === watchedVehicleId)
  const vehicleClass = selectedVehicle?.vehicleClass
  const pricePerKm = vehicleClass ? PRICE_PER_KM_BY_CLASS[vehicleClass] : 0
  const durationDays = watchedPickup && watchedReturn ? rentalDurationDays(watchedPickup, watchedReturn) : 0
  const allowedKm = calcAllowedKm(durationDays)
  const rate = Number(watchedRate) || 0
  const baseAmount = calcBaseAmount(rate, durationDays)
  const deliveryFee = calcDeliveryFee(watchedDeliveryKm ? Number(watchedDeliveryKm) : undefined)
  const discountAmount = Number(watchedDiscount) || 0
  const additionalChargesAmount = Number(watchedAdditional) || 0
  const estimatedTotal = calcEstimatedTotal(baseAmount, discountAmount, additionalChargesAmount, deliveryFee)
  const prepaymentAmount = calcPrepaymentAmount(baseAmount)

  // RM-BR-04/RM-BR-23 — cảnh báo mềm ở bước tạo (không chặn Save ở DRAFT), chặn cứng ở Confirm.
  const showConflictWarning =
    !!watchedVehicleId &&
    !!watchedPickup &&
    !!watchedReturn &&
    hasConflict(existingRentals, watchedVehicleId, watchedPickup, watchedReturn)

  function handlePickupChange(value: string) {
    setValue('pickupDateTime', value)
    // RM-BR-20 — 21:00 chỉ là gợi ý mặc định cho Return Time, không phải rule chặn cứng.
    if (value && !watchedReturn) {
      const datePart = value.slice(0, 10)
      setValue('expectedReturnDateTime', `${datePart}T21:00`)
    }
  }

  function toInput(values: RentalFormValues): RentalFormInput | null {
    if (!selectedVehicle) return null
    return {
      customerId: values.customerId,
      vehicleId: values.vehicleId,
      vehicleClass: selectedVehicle.vehicleClass,
      pickupDateTime: values.pickupDateTime,
      expectedReturnDateTime: values.expectedReturnDateTime,
      pickupLocation: values.pickupLocation,
      returnLocation: values.returnLocation,
      deliveryDistanceKm: values.deliveryDistanceKm ? Number(values.deliveryDistanceKm) : undefined,
      rentalRate: Number(values.rentalRate),
      discountAmount: values.discountAmount ? Number(values.discountAmount) : undefined,
      discountNote: values.discountNote || undefined,
      additionalChargesAmount: values.additionalChargesAmount ? Number(values.additionalChargesAmount) : undefined,
      additionalChargesNote: values.additionalChargesNote || undefined,
      securityDepositType: values.securityDepositType,
      securityDepositAssetNote: values.securityDepositAssetNote || undefined,
      note: values.note || undefined,
    }
  }

  async function onSubmit(values: RentalFormValues) {
    const input = toInput(values)
    if (!input) return
    try {
      await createRental.mutateAsync(input)
      toast.success(vi.rentals.createSuccess)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.rentals.saveError)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-none flex-col gap-0 p-0 sm:max-w-none md:w-[90vw] md:max-w-none lg:w-[560px] lg:max-w-none"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{vi.rentals.createTitle}</SheetTitle>
        </SheetHeader>

        <form
          id="rental-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <h3 className="text-sm font-semibold">{vi.rentals.sectionCustomerVehicle}</h3>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.rentals.customer} *</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.rentals.customerPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} — {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.customerId && <p className="text-destructive text-sm">{errors.customerId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.rentals.vehicle} *</Label>
            <Controller
              control={control}
              name="vehicleId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vi.rentals.vehiclePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} — {v.brand} {v.model} ({VEHICLE_CLASS_LABELS[v.vehicleClass]})
                        {v.status !== 'AVAILABLE' ? ` · ${VEHICLE_STATUS_LABELS[v.status]}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.vehicleId && <p className="text-destructive text-sm">{errors.vehicleId.message}</p>}
            {selectedVehicle && selectedVehicle.status !== 'AVAILABLE' && (
              <p className="text-status-pending text-xs">{vi.rentals.vehicleNotAvailableWarning}</p>
            )}
          </div>

          <Separator />
          <h3 className="text-sm font-semibold">{vi.rentals.sectionPeriod}</h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pickupDateTime">{vi.rentals.pickupDateTime} *</Label>
              <Input
                id="pickupDateTime"
                type="datetime-local"
                {...register('pickupDateTime')}
                onChange={(e) => handlePickupChange(e.target.value)}
              />
              {errors.pickupDateTime && <p className="text-destructive text-sm">{errors.pickupDateTime.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expectedReturnDateTime">{vi.rentals.expectedReturnDateTime} *</Label>
              <Input id="expectedReturnDateTime" type="datetime-local" {...register('expectedReturnDateTime')} />
              {errors.expectedReturnDateTime && (
                <p className="text-destructive text-sm">{errors.expectedReturnDateTime.message}</p>
              )}
            </div>
          </div>
          {showConflictWarning && <p className="text-status-pending text-xs">{vi.rentals.conflictWarning}</p>}

          <Separator />
          <h3 className="text-sm font-semibold">{vi.rentals.sectionLocation}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pickupLocation">{vi.rentals.pickupLocation} *</Label>
            <Input id="pickupLocation" {...register('pickupLocation')} />
            {errors.pickupLocation && <p className="text-destructive text-sm">{errors.pickupLocation.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="returnLocation">{vi.rentals.returnLocation} *</Label>
            <Input id="returnLocation" {...register('returnLocation')} />
            {errors.returnLocation && <p className="text-destructive text-sm">{errors.returnLocation.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deliveryDistanceKm">{vi.rentals.deliveryDistanceKm}</Label>
            <Input id="deliveryDistanceKm" type="number" min={0} {...register('deliveryDistanceKm')} />
            <p className="text-muted-foreground text-xs">{vi.rentals.deliveryDistanceKmHint}</p>
            {errors.deliveryDistanceKm && (
              <p className="text-destructive text-sm">{errors.deliveryDistanceKm.message}</p>
            )}
          </div>

          <Separator />
          <h3 className="text-sm font-semibold">{vi.rentals.sectionPricing}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rentalRate">{vi.rentals.rentalRate} *</Label>
            <Input id="rentalRate" type="number" min={0} {...register('rentalRate')} />
            {errors.rentalRate && <p className="text-destructive text-sm">{errors.rentalRate.message}</p>}
          </div>

          <div className="bg-muted/50 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md p-3 text-sm">
            <span className="text-muted-foreground">{vi.rentals.rentalDurationDays}</span>
            <span className="text-right font-medium">{durationDays} ngày</span>
            <span className="text-muted-foreground">{vi.rentals.pricePerKm}</span>
            <span className="text-right font-medium">{formatVnd(pricePerKm)}/km</span>
            <span className="text-muted-foreground">{vi.rentals.allowedKm}</span>
            <span className="text-right font-medium">{allowedKm.toLocaleString('vi-VN')} km</span>
            <span className="text-muted-foreground">{vi.rentals.baseAmount}</span>
            <span className="text-right font-medium">{formatVnd(baseAmount)}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discountAmount">{vi.rentals.discountAmount}</Label>
              <Input id="discountAmount" type="number" min={0} {...register('discountAmount')} />
              {errors.discountAmount && <p className="text-destructive text-sm">{errors.discountAmount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discountNote">{vi.rentals.discountNote}</Label>
              <Input id="discountNote" {...register('discountNote')} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="additionalChargesAmount">{vi.rentals.additionalChargesAmount}</Label>
              <Input id="additionalChargesAmount" type="number" min={0} {...register('additionalChargesAmount')} />
              {errors.additionalChargesAmount && (
                <p className="text-destructive text-sm">{errors.additionalChargesAmount.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="additionalChargesNote">{vi.rentals.additionalChargesNote}</Label>
              <Input id="additionalChargesNote" {...register('additionalChargesNote')} />
            </div>
          </div>

          <div className="bg-muted/50 flex flex-col gap-1 rounded-md p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{vi.rentals.deliveryFee}</span>
              <span className="font-medium">{formatVnd(deliveryFee)}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="font-semibold">{vi.rentals.estimatedTotal}</span>
              <span className="font-semibold">{formatVnd(estimatedTotal)}</span>
            </div>
          </div>

          <Separator />
          <h3 className="text-sm font-semibold">{vi.rentals.sectionDeposit}</h3>

          <div className="flex flex-col gap-1.5">
            <Label>{vi.rentals.securityDepositType} *</Label>
            <Controller
              control={control}
              name="securityDepositType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SECURITY_DEPOSIT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SECURITY_DEPOSIT_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {watchedDepositType === 'CASH_20M' ? (
            <div className="flex flex-col gap-1.5">
              <Label>{vi.rentals.securityDepositAmount}</Label>
              <Input value={formatVnd(CASH_DEPOSIT_AMOUNT)} readOnly disabled />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="securityDepositAssetNote">{vi.rentals.securityDepositAssetNote} *</Label>
              <Textarea id="securityDepositAssetNote" rows={2} {...register('securityDepositAssetNote')} />
              {errors.securityDepositAssetNote && (
                <p className="text-destructive text-sm">{errors.securityDepositAssetNote.message}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{vi.rentals.prepaymentAmount}</Label>
            <Input value={formatVnd(prepaymentAmount)} readOnly disabled />
          </div>

          <Separator />
          <h3 className="text-sm font-semibold">{vi.rentals.sectionNote}</h3>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{vi.rentals.note}</Label>
            <Textarea id="note" rows={3} {...register('note')} />
          </div>
        </form>

        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="submit" form="rental-form" disabled={isBusy}>
            {vi.common.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
