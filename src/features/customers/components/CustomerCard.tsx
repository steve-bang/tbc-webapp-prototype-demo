import { Lock, LockOpen, Pencil } from 'lucide-react'
import { vi } from '@/shared/i18n/vi'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { canBlock, canUnblock, type Customer } from '../model'
import { CustomerStatusBadge } from './CustomerStatusBadge'

/** Card dùng thay bảng ở khổ điện thoại (<768px) — `CONVENTIONS.md` §8. */
export function CustomerCard({
  customer,
  canEdit,
  canBlockAction,
  onEdit,
  onBlock,
  onUnblock,
}: {
  customer: Customer
  canEdit: boolean
  canBlockAction: boolean
  onEdit: () => void
  onBlock: () => void
  onUnblock: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{customer.fullName}</p>
            <p className="text-muted-foreground text-xs">{customer.idNumber}</p>
          </div>
          <CustomerStatusBadge status={customer.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{customer.phone}</span>
          <span className="text-muted-foreground">{customer.email ?? vi.customers.noEmail}</span>
        </div>
        {customer.status === 'BLOCKED' && customer.blockReason && (
          <p className="text-muted-foreground text-xs">
            {vi.customers.blockReasonLabel}: {customer.blockReason}
          </p>
        )}
        {(canEdit || canBlockAction) && (
          <div className="mt-1 flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="size-3.5" />
                {vi.common.edit}
              </Button>
            )}
            {canBlockAction && canBlock(customer.status) && (
              <Button size="sm" variant="outline" onClick={onBlock}>
                <Lock className="size-3.5" />
                {vi.customers.block}
              </Button>
            )}
            {canBlockAction && canUnblock(customer.status) && (
              <Button size="sm" variant="outline" onClick={onUnblock}>
                <LockOpen className="size-3.5" />
                {vi.customers.unblock}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
