import { useState } from 'react'
import { SETTLEMENT_LINE_CATEGORY_LABELS, SETTLEMENT_LINE_STATUS_LABELS, SETTLEMENT_WAIVER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { SettlementReversal } from '../model'

/**
 * Lịch sử đảo quyết toán — UC-RS-16, RS-BR-14 ("giữ toàn bộ lịch sử phiên bản
 * trước"). Mỗi lần đảo một dòng + dialog chỉ-đọc xem lại bản trước.
 */
export function SettlementReversalHistory({ reversals }: { reversals: SettlementReversal[] }) {
  const [viewing, setViewing] = useState<SettlementReversal | null>(null)
  const sorted = [...reversals].sort((a, b) => b.reversedAt.localeCompare(a.reversedAt))

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <h3 className="text-sm font-semibold">{vi.finance.reversalHistoryTitle}</h3>
        <div className="flex flex-col gap-2">
          {sorted.map((r) => (
            <div key={r.id} className="border-border flex flex-col gap-1 rounded-md border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{formatDateTime(r.reversedAt)}</span>
                <Button size="sm" variant="outline" onClick={() => setViewing(r)}>
                  {vi.finance.reversalHistoryViewPrevious}
                </Button>
              </div>
              <span className="text-muted-foreground text-xs">
                {r.reversedByName} — {r.reason}
              </span>
              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  {vi.finance.reversalColumnFinalAmount}: {formatVnd(r.snapshot.completedTotals?.finalAmount ?? 0)}
                </span>
                <span>
                  {vi.finance.reversalColumnBalanceDue}: {formatVnd(r.snapshot.completedTotals?.balanceDue ?? 0)}
                </span>
                <span>
                  {vi.finance.reversalColumnCancelledRequests}: {r.cancelledPaymentRequestIds.length}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{vi.finance.reversalSnapshotDialogTitle}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{vi.finance.columnCategory}</TableHead>
                      <TableHead>{vi.finance.columnActual}</TableHead>
                      <TableHead>{vi.finance.columnLineStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewing.snapshot.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{SETTLEMENT_LINE_CATEGORY_LABELS[l.category]}</TableCell>
                        <TableCell>{l.actualAmount !== undefined ? formatVnd(l.direction === 'DISCOUNT' ? -l.actualAmount : l.actualAmount) : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{SETTLEMENT_LINE_STATUS_LABELS[l.status]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {viewing.snapshot.waivers.length > 0 && (
                <div className="flex flex-col gap-2">
                  {viewing.snapshot.waivers.map((w) => (
                    <div key={w.id} className="border-border rounded-md border p-2 text-sm">
                      {SETTLEMENT_WAIVER_TYPE_LABELS[w.type]} — {formatVnd(w.amount)}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">
                  {vi.finance.finalAmount}: {formatVnd(viewing.snapshot.completedTotals?.finalAmount ?? 0)}
                </span>
                <span>
                  {vi.finance.balanceDue}: {formatVnd(viewing.snapshot.completedTotals?.balanceDue ?? 0)}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
