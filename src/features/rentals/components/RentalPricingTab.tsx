import { SECURITY_DEPOSIT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatVnd } from '@/shared/lib/money'
import type { Rental } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.rentals.noValue}</span>
    </div>
  )
}

/**
 * Tab "Giá, cọc & phát sinh" — `docs/RENTAL-MANAGEMENT-PLAN.md` §15.2 dòng 2.
 * Toàn bộ field đã snapshot sẵn trên `Rental` (§2.1) lúc tạo/xác nhận — CHỈ
 * hiển thị, không tính lại (khác `RentalFormSheet`, nơi các field này còn
 * đang tính real-time bằng hàm thuần `model.ts`).
 */
export function RentalPricingTab({ rental }: { rental: Rental }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.rentals.sectionPricing}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.rentals.rentalRate} value={formatVnd(rental.rentalRate)} />
          <Field label={vi.rentals.rentalDurationDays} value={`${rental.rentalDurationDays} ngày`} />
          <Field label={vi.rentals.baseAmount} value={formatVnd(rental.baseAmount)} />
          <Field label={vi.rentals.discountAmount} value={formatVnd(rental.discountAmount)} />
          <Field label={vi.rentals.discountNote} value={rental.discountNote} />
          <Field
            label={vi.rentals.deliveryDistanceKm}
            value={rental.deliveryDistanceKm !== undefined ? `${rental.deliveryDistanceKm} km` : undefined}
          />
          <Field label={vi.rentals.deliveryFee} value={formatVnd(rental.deliveryFee)} />
          <Field label={vi.rentals.additionalChargesAmount} value={formatVnd(rental.additionalChargesAmount)} />
          <Field label={vi.rentals.additionalChargesNote} value={rental.additionalChargesNote} />
        </div>

        <div className="bg-muted/50 flex items-center justify-between rounded-md p-3">
          <span className="text-sm font-semibold">{vi.rentals.estimatedTotal}</span>
          <span className="text-base font-semibold">{formatVnd(rental.estimatedTotal)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold">{vi.rentals.sectionDeposit}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={vi.rentals.prepaymentAmount} value={formatVnd(rental.prepaymentAmount)} />
          <Field
            label={vi.rentals.securityDepositType}
            value={SECURITY_DEPOSIT_TYPE_LABELS[rental.securityDepositType]}
          />
          {rental.securityDepositType === 'CASH_20M' ? (
            <Field
              label={vi.rentals.securityDepositAmount}
              value={rental.securityDepositAmount !== undefined ? formatVnd(rental.securityDepositAmount) : undefined}
            />
          ) : (
            <Field label={vi.rentals.securityDepositAssetNote} value={rental.securityDepositAssetNote} />
          )}
        </div>
      </div>
    </div>
  )
}
