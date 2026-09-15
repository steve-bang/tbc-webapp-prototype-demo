import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { SECURITY_DEPOSIT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import type { Contract } from '../model'

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.contracts.noValue}</span>
    </div>
  )
}

/** Tab "Tổng quan" (mặc định) — toàn bộ Snapshot Data (§5.3 kế hoạch), kèm link ngược về Rental gốc. */
export function ContractOverviewTab({ contract }: { contract: Contract }) {
  return (
    <div className="flex flex-col gap-6">
      <Link to={paths.rentalDetail(contract.rentalId)} className="text-primary w-fit text-sm underline underline-offset-2">
        {vi.contracts.linkToRental}
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">{vi.contracts.sectionCustomer}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={vi.contracts.customerName} value={contract.snapshotCustomerName} />
            <Field label={vi.contracts.customerPhone} value={contract.snapshotCustomerPhone} />
            <Field label={vi.contracts.customerIdNumber} value={contract.snapshotCustomerIdNumber} />
            <Field label={vi.contracts.customerAddress} value={contract.snapshotCustomerAddress} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.contracts.sectionVehicle}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={vi.contracts.vehiclePlate} value={contract.snapshotVehiclePlate} />
            <Field label={vi.contracts.vehicleBrand} value={contract.snapshotVehicleBrand} />
            <Field label={vi.contracts.vehicleModel} value={contract.snapshotVehicleModel} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.contracts.sectionPeriod}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={vi.contracts.pickupDateTime} value={formatDateTime(contract.snapshotPickupDateTime)} />
            <Field
              label={vi.contracts.expectedReturnDateTime}
              value={formatDateTime(contract.snapshotExpectedReturnDateTime)}
            />
            <Field label={vi.contracts.pickupLocation} value={contract.snapshotPickupLocation} />
            <Field label={vi.contracts.returnLocation} value={contract.snapshotReturnLocation} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold">{vi.contracts.sectionPricing}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={vi.contracts.rentalRate} value={formatVnd(contract.snapshotRentalRate)} />
            <Field label={vi.contracts.rentalDurationDays} value={`${contract.snapshotRentalDurationDays}`} />
            <Field label={vi.contracts.baseAmount} value={formatVnd(contract.snapshotBaseAmount)} />
            <Field label={vi.contracts.discountAmount} value={formatVnd(contract.snapshotDiscountAmount)} />
            <Field label={vi.contracts.estimatedTotal} value={formatVnd(contract.snapshotEstimatedTotal)} />
            <Field label={vi.contracts.prepaymentAmount} value={formatVnd(contract.snapshotPrepaymentAmount)} />
            <Field label={vi.contracts.allowedKm} value={`${contract.snapshotAllowedKm.toLocaleString('vi-VN')} km`} />
            <Field label={vi.contracts.pricePerKm} value={formatVnd(contract.snapshotPricePerKm)} />
          </div>

          <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.contracts.sectionDeposit}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={vi.contracts.securityDepositType}
              value={SECURITY_DEPOSIT_TYPE_LABELS[contract.snapshotSecurityDepositType]}
            />
            {contract.snapshotSecurityDepositAmount != null && (
              <Field label={vi.contracts.securityDepositAmount} value={formatVnd(contract.snapshotSecurityDepositAmount)} />
            )}
          </div>

          {contract.status === 'VOID' && contract.voidReason && (
            <>
              <h3 className="mt-2 border-t pt-4 text-sm font-semibold">{vi.contracts.voidDialogTitle}</h3>
              <Field label={vi.contracts.voidedInfo} value={contract.voidReason} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
