import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
// `contracts` chưa export `useContracts`/`useCreateContract` qua barrel
// `index.ts` (chỉ export type + 2 Screen) nên import thẳng từ `hooks.ts` của
// feature đó — cùng tinh thần `rentals/api.ts` import thẳng `customers/api.ts`/
// `vehicles/api.ts` (`docs/CONTRACT-MANAGEMENT-PLAN.md` §5.1).
import { useContracts, useCreateContract } from '@/features/contracts/hooks'
import { usePermission } from '@/features/auth'
import { CONTRACT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import type { Rental } from '../model'

/**
 * Tab "Hợp đồng" ở `RentalDetailScreen` — entry-point sinh hợp đồng từ phía
 * Rental (`docs/CONTRACT-MANAGEMENT-PLAN.md` §5.1, mirror cách
 * `VehicleMaintenanceTab` đặt trong `vehicles` dù đọc dữ liệu của module khác).
 */
export function RentalContractTab({ rental }: { rental: Rental }) {
  const { can } = usePermission()
  const canCreate = can('CONTRACT', 'CREATE')
  const { data: contracts, isLoading } = useContracts({ rentalId: rental.id })
  const createContract = useCreateContract()

  const contract = contracts?.[0]

  async function handleCreate() {
    try {
      await createContract.mutateAsync({ rentalId: rental.id })
      toast.success(vi.rentals.contractCreateSuccess)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.rentals.contractCreateError)
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }

  if (contract) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">
                {vi.rentals.contractTabCode}: {contract.contractCode}
              </p>
              <p className="text-muted-foreground text-sm">
                {vi.common.status}: {CONTRACT_STATUS_LABELS[contract.status]}
              </p>
              <p className="text-muted-foreground text-sm">
                {vi.rentals.contractTabGeneratedAt}: {formatDateTime(contract.createdAt)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={paths.contractDetail(contract.id)}>{vi.rentals.contractTabViewDetail}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (rental.status !== 'CONFIRMED') {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="max-w-md text-sm">{vi.rentals.contractTabNotConfirmedNotice}</p>
      </div>
    )
  }

  return (
    <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <p className="max-w-md text-sm">{vi.rentals.contractTabEmptyNotice}</p>
      {canCreate && (
        <Button size="sm" onClick={handleCreate} disabled={createContract.isPending}>
          {vi.rentals.contractTabCreateButton}
        </Button>
      )}
    </div>
  )
}
