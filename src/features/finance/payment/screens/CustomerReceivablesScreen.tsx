import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
// `customers` chưa export `useCustomers` qua barrel — deep-import thẳng
// `hooks.ts`, cùng tiền lệ `TransactionLedgerScreen`/`CashDrawerScreen`.
import { useCustomers } from '@/features/customers/hooks'
import { useIncidents } from '@/features/incidents'
import { useRentals } from '@/features/rentals'
import { vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatVnd } from '@/shared/lib/money'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { CustomerBalanceSheet } from '../components/CustomerBalanceSheet'
import { usePaymentRequests, useTransactions } from '../hooks'
import { usePostSettlementCharges, useSettlements } from '../../core/hooks'
import { deriveCustomerBalances, type CustomerBalance } from '../model'
import { isPscOnHold } from '../../core/model'

type FilterKey = 'OUTSTANDING' | 'CREDIT' | 'DEPOSIT_HELD' | 'ALL'

/**
 * Công nợ khách hàng (`/finance/receivables`) — `docs/PAYMENT-PLAN.md` §10.8.
 * Chỉ xem, không thay đổi dữ liệu (UC-PM-18 §22.5). Tính theo TỪNG khoản riêng
 * (Rental đã quyết toán / từng PSC), KHÔNG bù trừ chéo (§0.4 điểm 5 kế hoạch).
 */
export function CustomerReceivablesScreen() {
  const { data: customers = [] } = useCustomers()
  const { data: rentals = [] } = useRentals()
  const { data: settlements = [] } = useSettlements()
  const { data: pscs = [] } = usePostSettlementCharges()
  const { data: requests = [] } = usePaymentRequests()
  const { data: txns = [] } = useTransactions()
  const { data: incidents = [] } = useIncidents()

  const [filter, setFilter] = useState<FilterKey>('OUTSTANDING')
  const [search, setSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const onHoldPscIds = useMemo(() => new Set(pscs.filter((p) => isPscOnHold(p, incidents)).map((p) => p.id)), [pscs, incidents])

  const balances = useMemo(
    () => deriveCustomerBalances({ customers, rentals, settlements, pscs, requests, txns, onHoldPscIds }),
    [customers, rentals, settlements, pscs, requests, txns, onHoldPscIds],
  )

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return balances.filter((b) => {
      if (filter === 'OUTSTANDING' && b.outstanding <= 0) return false
      if (filter === 'CREDIT' && b.credit <= 0) return false
      if (filter === 'DEPOSIT_HELD' && b.depositHeld <= 0) return false
      if (q.length > 0) {
        const customer = customerById.get(b.customerId)
        const haystack = `${customer?.fullName ?? ''} ${customer?.phone ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [balances, filter, search, customerById])

  const totals = useMemo(() => {
    const outstandingCustomers = balances.filter((b) => b.outstanding > 0)
    return {
      outstandingCount: outstandingCustomers.length,
      outstandingSum: outstandingCustomers.reduce((sum, b) => sum + b.outstanding, 0),
      creditSum: balances.reduce((sum, b) => sum + b.credit, 0),
      depositHeldSum: balances.reduce((sum, b) => sum + b.depositHeld, 0),
    }
  }, [balances])

  const selectedBalance: CustomerBalance | null = selectedCustomerId ? balances.find((b) => b.customerId === selectedCustomerId) ?? null : null
  const selectedRecentTxns = selectedCustomerId ? txns.filter((t) => t.customerId === selectedCustomerId).slice(0, 10) : []

  return (
    <div>
      <PageHeader title={vi.finance.receivables.title} description={vi.finance.receivables.description} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.receivables.cardOutstandingTitle}</p>
          <p className="text-status-error font-medium">
            {totals.outstandingCount} · {formatVnd(totals.outstandingSum)}
          </p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.receivables.cardCreditTitle}</p>
          <p className="text-status-info font-medium">{formatVnd(totals.creditSum)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.receivables.cardDepositHeldTitle}</p>
          <p className="font-medium">{formatVnd(totals.depositHeldSum)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={vi.finance.receivables.searchPlaceholder} className="max-w-sm flex-1" />
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OUTSTANDING">{vi.finance.receivables.filterOutstanding}</SelectItem>
            <SelectItem value="CREDIT">{vi.finance.receivables.filterCredit}</SelectItem>
            <SelectItem value="DEPOSIT_HELD">{vi.finance.receivables.filterDepositHeld}</SelectItem>
            <SelectItem value="ALL">{vi.finance.receivables.filterAll}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{vi.finance.receivables.empty}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.finance.receivables.columnCustomer}</TableHead>
                  <TableHead>{vi.finance.receivables.columnTotalCharged}</TableHead>
                  <TableHead>{vi.finance.receivables.columnTotalCollected}</TableHead>
                  <TableHead>{vi.finance.receivables.columnOutstanding}</TableHead>
                  <TableHead>{vi.finance.receivables.columnCredit}</TableHead>
                  <TableHead>{vi.finance.receivables.columnDepositHeld}</TableHead>
                  <TableHead>{vi.finance.receivables.columnUnsettled}</TableHead>
                  <TableHead>{vi.finance.receivables.columnOnHold}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => (
                  <TableRow key={b.customerId} className="cursor-pointer" onClick={() => setSelectedCustomerId(b.customerId)}>
                    <TableCell>
                      <Link to={paths.customerDetail(b.customerId)} className="text-primary underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                        {customerById.get(b.customerId)?.fullName ?? b.customerId}
                      </Link>
                    </TableCell>
                    <TableCell>{formatVnd(b.totalCharged)}</TableCell>
                    <TableCell>{formatVnd(b.totalCollected)}</TableCell>
                    <TableCell className={b.outstanding > 0 ? 'text-status-error' : undefined}>{formatVnd(b.outstanding)}</TableCell>
                    <TableCell>{formatVnd(b.credit)}</TableCell>
                    <TableCell>{formatVnd(b.depositHeld)}</TableCell>
                    <TableCell>{formatVnd(b.unsettledPaidToDate)}</TableCell>
                    <TableCell>{formatVnd(b.onHoldAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((b) => (
              <div key={b.customerId} className="border-border flex flex-col gap-2 rounded-md border p-3 text-sm" onClick={() => setSelectedCustomerId(b.customerId)}>
                <Link to={paths.customerDetail(b.customerId)} className="text-primary underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                  {customerById.get(b.customerId)?.fullName ?? b.customerId}
                </Link>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{vi.finance.receivables.columnOutstanding}</span>
                  <span className={b.outstanding > 0 ? 'text-status-error font-medium' : 'font-medium'}>{formatVnd(b.outstanding)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{vi.finance.receivables.columnCredit}</span>
                  <span>{formatVnd(b.credit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">{vi.finance.receivables.columnDepositHeld}</span>
                  <span>{formatVnd(b.depositHeld)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <CustomerBalanceSheet
        balance={selectedBalance}
        customerName={selectedBalance ? customerById.get(selectedBalance.customerId)?.fullName : undefined}
        recentTxns={selectedRecentTxns}
        open={!!selectedBalance}
        onOpenChange={(o) => !o && setSelectedCustomerId(null)}
      />
    </div>
  )
}
