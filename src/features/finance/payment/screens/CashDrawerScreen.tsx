import { useMemo, useState } from 'react'
import { usePermission, useSessionStore } from '@/features/auth'
// `customers` chưa export `useCustomers` qua barrel — deep-import thẳng
// `hooks.ts`, cùng tiền lệ `SettlementListScreen`.
import { useCustomers } from '@/features/customers/hooks'
import { PAYMENT_METHOD_LABELS, TRANSACTION_DIRECTION_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { CashDrawerSubmitDialog } from '../components/CashDrawerSubmitDialog'
import { TransactionConfirmDialog } from '../components/TransactionConfirmDialog'
import { TransactionReasonDialog } from '../components/TransactionReasonDialog'
import { useCashDrawerSubmissions, useReceiveCashDrawerSubmission, useTransactions } from '../hooks'
import { calcCashDrawerBalance, cashDrawerIdOf } from '../model'
import type { Transaction } from '../../core/types'

/**
 * Quỹ tiền mặt (`/finance/cash-drawer`) — `docs/PAYMENT-PLAN.md` §7.3.
 * TODO(OQ: Payment-BRD.md §27 Q10-Q12 — quỹ theo ca/ngày/điểm, thủ quỹ, xử lý
 * chênh lệch chưa chốt; demo: quỹ theo người thu, nộp theo ngày, mọi người có
 * `PAYMENT.RECONCILE` nhận phiếu.)
 */
export function CashDrawerScreen() {
  const { can } = usePermission()
  const user = useSessionStore((s) => s.user)
  const { data: customers = [] } = useCustomers()
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const { data: txns = [] } = useTransactions()
  const { data: submissions = [] } = useCashDrawerSubmissions()

  const canExecute = can('PAYMENT', 'EXECUTE')
  const canReconcile = can('PAYMENT', 'RECONCILE')
  const canConfirm = can('PAYMENT', 'CONFIRM')

  const [submitOpen, setSubmitOpen] = useState(false)
  const [confirmTxn, setConfirmTxn] = useState<Transaction | null>(null)
  const [failTxn, setFailTxn] = useState<Transaction | null>(null)
  const receive = useReceiveCashDrawerSubmission()

  const myDrawerId = user ? cashDrawerIdOf(user.userId) : ''
  const myBalance = calcCashDrawerBalance(myDrawerId, txns, submissions)
  const mySubmissions = submissions.filter((s) => s.cashDrawerId === myDrawerId)

  const drawerIds: string[] = []
  for (const t of txns) {
    if (t.method === 'CASH' && t.cashDrawerId && !drawerIds.includes(t.cashDrawerId)) drawerIds.push(t.cashDrawerId)
  }
  const allDrawers = drawerIds.map((id) => {
    const { balance } = calcCashDrawerBalance(id, txns, submissions)
    const ownerName = txns.find((t) => t.cashDrawerId === id)?.cashDrawerOwnerName ?? id
    return { id, ownerName, balance }
  })
  const pendingSubmissions = submissions.filter((s) => s.status === 'SUBMITTED')

  const reconcileList = txns.filter((t) => (t.method === 'BANK_TRANSFER' || t.method === 'E_WALLET') && t.status === 'PENDING')

  async function handleReceive(id: string) {
    await receive.mutateAsync(id)
  }

  const availableTabs = [canExecute && 'mine', canReconcile && 'all', canConfirm && 'reconcile'].filter(Boolean) as string[]

  return (
    <div>
      <PageHeader title={vi.finance.payment.cashDrawerTitle} description={vi.finance.payment.cashDrawerDescription} />
      {availableTabs.length === 0 ? (
        <p className="text-muted-foreground text-sm">{vi.finance.payment.cashDrawerNoAccess}</p>
      ) : (
        <Tabs defaultValue={availableTabs[0]}>
          <TabsList>
            {canExecute && <TabsTrigger value="mine">{vi.finance.payment.cashDrawerTabMine}</TabsTrigger>}
            {canReconcile && <TabsTrigger value="all">{vi.finance.payment.cashDrawerTabAll}</TabsTrigger>}
            {canConfirm && <TabsTrigger value="reconcile">{vi.finance.payment.cashDrawerTabReconcile}</TabsTrigger>}
          </TabsList>

          {canExecute && (
            <TabsContent value="mine">
              <Card>
                <CardContent className="flex flex-col gap-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-muted-foreground text-xs">{vi.finance.payment.cashDrawerBalance}</p>
                      <p className="text-lg font-semibold">{formatVnd(myBalance.balance)}</p>
                    </div>
                    {myBalance.transactions.length > 0 && <Button size="sm" onClick={() => setSubmitOpen(true)}>{vi.finance.payment.cashDrawerSubmitButton}</Button>}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">{vi.finance.payment.cashDrawerUnsubmittedTitle}</h4>
                    {myBalance.transactions.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{vi.finance.payment.cashDrawerEmpty}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {myBalance.transactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-sm">
                            <span className="min-w-0 truncate">
                              {t.code} — {customerById.get(t.customerId)?.fullName ?? t.customerId}
                            </span>
                            <span>{formatVnd(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">{vi.finance.payment.cashDrawerHistoryTitle}</h4>
                    {mySubmissions.length === 0 ? (
                      <p className="text-muted-foreground text-sm">{vi.finance.payment.cashDrawerNoSubmissions}</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {mySubmissions.map((s) => (
                          <div key={s.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                            <span>{formatDateTime(s.submittedAt)}</span>
                            <span>{formatVnd(s.countedAmount)}</span>
                            <Badge variant={s.status === 'RECEIVED' ? 'success' : 'warning'}>{s.status === 'RECEIVED' ? vi.finance.payment.cashDrawerColumnReceivedBy : vi.finance.payment.cashDrawerTabMine}</Badge>
                            {s.variance !== 0 && <span className="text-status-error">{formatVnd(s.variance)}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canReconcile && (
            <TabsContent value="all">
              <Card>
                <CardContent className="flex flex-col gap-4 py-4">
                  <h4 className="text-sm font-semibold">{vi.finance.payment.cashDrawerAllTitle}</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{vi.finance.payment.cashDrawerColumnOwner}</TableHead>
                          <TableHead>{vi.finance.payment.cashDrawerColumnBalance}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allDrawers.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.ownerName}</TableCell>
                            <TableCell>{formatVnd(d.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <h4 className="text-sm font-semibold">{vi.finance.payment.cashDrawerSubmissionsTitle}</h4>
                  {pendingSubmissions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{vi.finance.payment.cashDrawerNoSubmissions}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {pendingSubmissions.map((s) => (
                        <div key={s.id} className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                          <span className="min-w-0 truncate">{s.ownerName}</span>
                          <span>{formatDateTime(s.submittedAt)}</span>
                          <span>{formatVnd(s.countedAmount)}</span>
                          {s.variance !== 0 && <span className="text-status-error">{formatVnd(s.variance)}</span>}
                          <Button size="sm" variant="outline" disabled={receive.isPending} onClick={() => handleReceive(s.id)}>
                            {vi.finance.payment.cashDrawerReceiveButton}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canConfirm && (
            <TabsContent value="reconcile">
              <Card>
                <CardContent className="flex flex-col gap-3 py-4">
                  {reconcileList.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{vi.finance.payment.cashDrawerReconcileEmpty}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{vi.finance.payment.ledgerColumnCode}</TableHead>
                            <TableHead>{vi.finance.payment.ledgerColumnPerformedAt}</TableHead>
                            <TableHead>{vi.finance.payment.ledgerColumnDirection}</TableHead>
                            <TableHead>{vi.finance.payment.ledgerColumnAmount}</TableHead>
                            <TableHead>{vi.finance.payment.ledgerColumnMethod}</TableHead>
                            <TableHead>{vi.common.actions}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reconcileList.map((t) => {
                            // Round 2 (§10.9) — ẩn nút Xác nhận inline khi giao dịch hoàn đang `PENDING_APPROVAL`.
                            const awaitingApproval = t.approval?.status === 'PENDING_APPROVAL'
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                                <TableCell>{formatDateTime(t.performedAt)}</TableCell>
                                <TableCell>
                                  <Badge variant={t.direction === 'IN' ? 'success' : 'warning'}>{TRANSACTION_DIRECTION_LABELS[t.direction]}</Badge>
                                </TableCell>
                                <TableCell>{formatVnd(t.amount)}</TableCell>
                                <TableCell>{PAYMENT_METHOD_LABELS[t.method]}</TableCell>
                                <TableCell>
                                  {awaitingApproval ? (
                                    <Badge variant="warning">{vi.finance.payment.cashDrawerPendingApprovalBadge}</Badge>
                                  ) : (
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => setConfirmTxn(t)}>
                                        {t.direction === 'OUT' ? vi.finance.payment.actionConfirmPaid : vi.finance.payment.actionConfirm}
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setFailTxn(t)}>
                                        {vi.finance.payment.actionFail}
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}

      <CashDrawerSubmitDialog systemAmount={myBalance.balance} open={submitOpen} onOpenChange={setSubmitOpen} />
      <TransactionConfirmDialog transaction={confirmTxn} open={!!confirmTxn} onOpenChange={(o) => !o && setConfirmTxn(null)} />
      <TransactionReasonDialog transaction={failTxn} mode="fail" open={!!failTxn} onOpenChange={(o) => !o && setFailTxn(null)} />
    </div>
  )
}
