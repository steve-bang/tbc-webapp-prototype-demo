import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { PAYMENT_METHOD_LABELS, POST_SETTLEMENT_CHARGE_SOURCE_LABELS, SETTLEMENT_PAYMENT_STATUS_LABELS, TRANSACTION_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import type { CustomerBalance } from '../model'
import type { Transaction } from '../../core/types'

/** UC-PM-18, AC-PM-011 — chi tiết công nợ một khách: lượt thuê · PSC chưa tất toán · giao dịch gần đây. */
export function CustomerBalanceSheet({
  balance,
  customerName,
  recentTxns,
  open,
  onOpenChange,
}: {
  balance: CustomerBalance | null
  customerName?: string
  recentTxns: Transaction[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!balance) return null
  const openPscItems = balance.pscItems.filter((p) => p.onHold || p.balance !== 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {vi.finance.receivables.sheetTitle} — {customerName ?? balance.customerId}
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-4 text-sm">
          <div>
            <h4 className="mb-2 text-sm font-semibold">{vi.finance.receivables.sheetRentalsTitle}</h4>
            {balance.rentalItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <div className="flex flex-col gap-2">
                {balance.rentalItems.map((r) => (
                  <div key={r.rentalId} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <Link to={`${paths.rentalDetail(r.rentalId)}?tab=payment`} className="text-primary font-mono underline underline-offset-2">
                      {r.rentalId}
                    </Link>
                    <Badge variant="outline">{SETTLEMENT_PAYMENT_STATUS_LABELS[r.paymentStatus]}</Badge>
                    <span>
                      {formatVnd(r.charged)} · {vi.finance.payment.milestoneCollected}: {formatVnd(r.collected)}
                    </span>
                    <span className={r.balance > 0 ? 'text-status-error font-medium' : r.balance < 0 ? 'text-status-info font-medium' : ''}>
                      {formatVnd(r.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {openPscItems.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">{vi.finance.receivables.sheetPscTitle}</h4>
              <div className="flex flex-col gap-2">
                {openPscItems.map(({ psc, balance: pscBalance, onHold }) => (
                  <div key={psc.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <Badge variant="outline">{POST_SETTLEMENT_CHARGE_SOURCE_LABELS[psc.source]}</Badge>
                    <span>{formatVnd(psc.amount)}</span>
                    {onHold ? (
                      <Badge variant="destructive">{vi.finance.receivables.onHoldBadge}</Badge>
                    ) : (
                      <span className={pscBalance > 0 ? 'text-status-error' : 'text-status-info'}>{formatVnd(pscBalance)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold">{vi.finance.receivables.sheetRecentTxnsTitle}</h4>
            {recentTxns.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <div className="flex flex-col gap-2">
                {recentTxns.slice(0, 10).map((t) => (
                  <div key={t.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-xs">
                    <span className="font-mono">{t.code}</span>
                    <span>{TRANSACTION_TYPE_LABELS[t.type]}</span>
                    <span>{formatVnd(t.amount)}</span>
                    <span>{PAYMENT_METHOD_LABELS[t.method]}</span>
                    <span className="text-muted-foreground">{formatDateTime(t.performedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
