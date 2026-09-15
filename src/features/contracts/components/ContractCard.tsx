import { formatDateTime } from '@/shared/lib/datetime'
import { Card, CardContent } from '@/shared/ui/card'
import type { Contract } from '../model'
import { ContractStatusBadge } from './ContractStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — mirror `RentalCard`/`EmployeeCard` (`CONVENTIONS.md` §8). */
export function ContractCard({ contract, onOpen }: { contract: Contract; onOpen: () => void }) {
  return (
    <Card role="button" tabIndex={0} onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{contract.contractCode}</p>
            <p className="text-muted-foreground truncate text-xs">{contract.snapshotCustomerName}</p>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>
        <p className="text-muted-foreground text-sm">{contract.snapshotVehiclePlate}</p>
        <p className="text-muted-foreground text-xs">{formatDateTime(contract.createdAt)}</p>
      </CardContent>
    </Card>
  )
}
