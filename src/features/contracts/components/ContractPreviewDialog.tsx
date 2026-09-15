import { toast } from 'sonner'
import { SECURITY_DEPOSIT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import type { Contract } from '../model'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value || vi.contracts.noValue}</span>
    </div>
  )
}

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §1.1 mục 3/§5.4 — xem trước GIẢ LẬP,
 * liệt kê nguyên `Snapshot Data` theo nhóm (không phải PDF thật — Open
 * Question §26 Q1 chặn mẫu hợp đồng thật). Nút "Xuất PDF" chỉ hiện toast.
 */
export function ContractPreviewDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  function handleExport() {
    toast.success(vi.contracts.exportPdfSuccess)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vi.contracts.previewDialogTitle}
            {contract && ` — ${contract.contractCode}`}
          </DialogTitle>
          <DialogDescription>{vi.contracts.previewDialogNote}</DialogDescription>
        </DialogHeader>

        {contract && (
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{vi.contracts.sectionCompany}</h3>
              <Field label={vi.contracts.companyName} value={contract.snapshotCompanyName} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <h3 className="col-span-full text-sm font-semibold">{vi.contracts.sectionCustomer}</h3>
              <Field label={vi.contracts.customerName} value={contract.snapshotCustomerName} />
              <Field label={vi.contracts.customerPhone} value={contract.snapshotCustomerPhone} />
              <Field label={vi.contracts.customerIdNumber} value={contract.snapshotCustomerIdNumber} />
              <Field label={vi.contracts.customerAddress} value={contract.snapshotCustomerAddress ?? ''} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <h3 className="col-span-full text-sm font-semibold">{vi.contracts.sectionVehicle}</h3>
              <Field label={vi.contracts.vehiclePlate} value={contract.snapshotVehiclePlate} />
              <Field label={vi.contracts.vehicleBrand} value={contract.snapshotVehicleBrand} />
              <Field label={vi.contracts.vehicleModel} value={contract.snapshotVehicleModel} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <h3 className="col-span-full text-sm font-semibold">{vi.contracts.sectionPeriod}</h3>
              <Field label={vi.contracts.pickupDateTime} value={formatDateTime(contract.snapshotPickupDateTime)} />
              <Field
                label={vi.contracts.expectedReturnDateTime}
                value={formatDateTime(contract.snapshotExpectedReturnDateTime)}
              />
              <Field label={vi.contracts.pickupLocation} value={contract.snapshotPickupLocation} />
              <Field label={vi.contracts.returnLocation} value={contract.snapshotReturnLocation} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <h3 className="col-span-full text-sm font-semibold">{vi.contracts.sectionPricing}</h3>
              <Field label={vi.contracts.rentalRate} value={formatVnd(contract.snapshotRentalRate)} />
              <Field label={vi.contracts.rentalDurationDays} value={`${contract.snapshotRentalDurationDays}`} />
              <Field label={vi.contracts.baseAmount} value={formatVnd(contract.snapshotBaseAmount)} />
              <Field label={vi.contracts.discountAmount} value={formatVnd(contract.snapshotDiscountAmount)} />
              <Field label={vi.contracts.estimatedTotal} value={formatVnd(contract.snapshotEstimatedTotal)} />
              <Field label={vi.contracts.prepaymentAmount} value={formatVnd(contract.snapshotPrepaymentAmount)} />
              <Field label={vi.contracts.allowedKm} value={`${contract.snapshotAllowedKm.toLocaleString('vi-VN')} km`} />
              <Field label={vi.contracts.pricePerKm} value={formatVnd(contract.snapshotPricePerKm)} />
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <h3 className="col-span-full text-sm font-semibold">{vi.contracts.sectionDeposit}</h3>
              <Field
                label={vi.contracts.securityDepositType}
                value={SECURITY_DEPOSIT_TYPE_LABELS[contract.snapshotSecurityDepositType]}
              />
              {contract.snapshotSecurityDepositAmount != null && (
                <Field label={vi.contracts.securityDepositAmount} value={formatVnd(contract.snapshotSecurityDepositAmount)} />
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {vi.common.cancel}
          </Button>
          <Button type="button" onClick={handleExport}>
            {vi.contracts.exportPdfButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
