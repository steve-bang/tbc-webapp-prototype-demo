import { OWNER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { maskAccountNumber, type VehicleOwner } from '../model'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — mirror `ContractCard`. */
export function VehicleOwnerCard({
  owner,
  vehicleCount,
  monthlyTotal,
  onOpen,
}: {
  owner: VehicleOwner
  vehicleCount: number
  monthlyTotal: number
  onOpen: () => void
}) {
  return (
    <Card role="button" tabIndex={0} onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{owner.fullName}</p>
            <p className="text-muted-foreground truncate text-xs">
              {owner.code} · {owner.phone}
            </p>
          </div>
          <Badge variant="neutral">{OWNER_TYPE_LABELS[owner.ownerType]}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {vi.consignment.ownerColumnVehicleCount}: {vehicleCount} · {formatVnd(monthlyTotal)}
        </p>
        <p className="text-muted-foreground text-xs">
          {owner.bankAccount ? maskAccountNumber(owner.bankAccount.accountNumber) : vi.consignment.ownerNoBank}
        </p>
      </CardContent>
    </Card>
  )
}
