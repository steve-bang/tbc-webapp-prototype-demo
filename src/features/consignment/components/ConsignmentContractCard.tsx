import { vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Card, CardContent } from '@/shared/ui/card'
import type { ConsignmentContract, ConsignmentPaymentTerm } from '../model'
import { ConsignmentContractStatusBadge } from './ConsignmentContractStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — mirror `ContractCard`. */
export function ConsignmentContractCard({
  contract,
  plate,
  ownerName,
  expiringSoon,
  term,
  onOpen,
}: {
  contract: ConsignmentContract
  plate: string
  ownerName: string
  expiringSoon: boolean
  /** Điều khoản chi trả đang áp dụng (đã tính phụ lục) — không phải điều khoản gốc. */
  term: ConsignmentPaymentTerm
  onOpen: () => void
}) {
  return (
    <Card role="button" tabIndex={0} onClick={onOpen} className="cursor-pointer">
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{contract.contractNo}</p>
            <p className="text-muted-foreground truncate text-xs">
              {plate} · {ownerName}
            </p>
          </div>
          <ConsignmentContractStatusBadge status={contract.status} expiringSoon={expiringSoon} />
        </div>
        <p className="text-muted-foreground text-sm">
          {formatDate(contract.effectiveFrom)} – {formatDate(contract.effectiveTo)}
        </p>
        <p className="text-muted-foreground text-xs">
          {formatVnd(term.fixedMonthlyAmount)} · {vi.consignment.paymentDayValue(term.paymentDay)}
        </p>
      </CardContent>
    </Card>
  )
}
