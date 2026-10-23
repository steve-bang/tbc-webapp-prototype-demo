import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Card, CardContent } from '@/shared/ui/card'
import type { ConsignmentProposal } from '../proposalModel'
import { ConsignmentProposalStatusBadge } from './ConsignmentProposalStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — mirror `ConsignmentContractCard`. */
export function ConsignmentProposalCard({
  proposal,
  ownerName,
  contractNo,
  onOpen,
}: {
  proposal: ConsignmentProposal
  ownerName: string
  contractNo?: string
  onOpen: () => void
}) {
  const vehicle = proposal.declaredVehicle
  return (
    <Card role="button" tabIndex={0} onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {proposal.code} · {vehicle.plate}
            </p>
            <p className="text-muted-foreground truncate text-xs">{ownerName}</p>
          </div>
          <ConsignmentProposalStatusBadge status={proposal.status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {vehicle.brand} {vehicle.model}
          {vehicle.manufacturingYear ? ` ${vehicle.manufacturingYear}` : ''}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatVnd(proposal.expectedMonthlyAmount)} · {formatDate(proposal.createdAt)}
          {contractNo ? ` · ${contractNo}` : ''}
        </p>
      </CardContent>
    </Card>
  )
}
