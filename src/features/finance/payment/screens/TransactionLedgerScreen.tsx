import { useMemo, useState } from 'react'
import { usePermission } from '@/features/auth'
// `customers` chưa export `useCustomers` qua barrel — deep-import thẳng
// `hooks.ts`, cùng tiền lệ `SettlementListScreen`.
import { useCustomers } from '@/features/customers/hooks'
import {
  PAYMENT_METHODS,
  TRANSACTION_DIRECTIONS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type PaymentMethod,
  type TransactionDirection,
  type TransactionStatus,
  type TransactionType,
} from '@/shared/domain/enums'
import {
  PAYMENT_METHOD_LABELS,
  TRANSACTION_DIRECTION_LABELS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  vi,
} from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { PaymentAdjustmentDialog } from '../components/PaymentAdjustmentDialog'
import { TransactionDetailSheet } from '../components/TransactionDetailSheet'
import { TransactionRecordDialog } from '../components/TransactionRecordDialog'
import { TransactionStatusBadge } from '../components/TransactionStatusBadge'
import { useTransactions } from '../hooks'
import { isEffectiveTransaction } from '../model'

const ALL = '__ALL__'

/** `WebappQuanTri.md` §11.2, `docs/PAYMENT-PLAN.md` §7.1 — Sổ giao dịch (`/finance/transactions`). */
export function TransactionLedgerScreen() {
  const { can } = usePermission()
  const canRecord = can('PAYMENT', 'RECORD_CASH') || can('PAYMENT', 'CREATE')
  const canAdjust = can('PAYMENT', 'EDIT')

  const { data: txns = [], isLoading } = useTransactions()
  const { data: customers = [] } = useCustomers()
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [type, setType] = useState<string>(ALL)
  const [method, setMethod] = useState<string>(ALL)
  const [direction, setDirection] = useState<string>(ALL)
  // Round 2 (§10.9) — bộ lọc "Chờ duyệt hoàn".
  const [approvalPendingOnly, setApprovalPendingOnly] = useState(false)

  const [recordOpen, setRecordOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  // Lưu id, không lưu object `Transaction` — resolve lại từ `txns` (đã tự cập
  // nhật qua invalidate sau mutation) để sheet không hiện trạng thái cũ sau
  // Xác nhận/Đảo/Huỷ (tech-lead review Phase 4.2 R1 Blocker b).
  const [detailTxnId, setDetailTxnId] = useState<string | null>(null)
  const detailTxn = detailTxnId ? txns.find((t) => t.id === detailTxnId) ?? null : null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return txns.filter((t) => {
      if (status !== ALL && t.status !== status) return false
      if (type !== ALL && t.type !== type) return false
      if (method !== ALL && t.method !== method) return false
      if (direction !== ALL && t.direction !== direction) return false
      if (approvalPendingOnly && t.approval?.status !== 'PENDING_APPROVAL') return false
      if (q.length > 0) {
        const haystack = `${t.code} ${t.reference ?? ''} ${t.rentalId ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [txns, search, status, type, method, direction, approvalPendingOnly])

  // §10.9 góp ý R1-#1 — giữ nguyên cách sheet resolve theo id; chỉ thêm chú thích khi giao dịch
  // đang mở không còn khớp bộ lọc hiện tại (không sửa lại cơ chế resolve).
  const outsideFilter = !!detailTxnId && !filtered.some((t) => t.id === detailTxnId)

  const totals = useMemo(() => {
    const effective = filtered.filter(isEffectiveTransaction)
    const totalIn = effective.filter((t) => t.direction === 'IN').reduce((sum, t) => sum + t.amount, 0)
    const totalOut = effective.filter((t) => t.direction === 'OUT').reduce((sum, t) => sum + t.amount, 0)
    const pending = filtered.filter((t) => t.status === 'PENDING')
    return { totalIn, totalOut, pendingCount: pending.length, pendingAmount: pending.reduce((sum, t) => sum + t.amount, 0) }
  }, [filtered])

  return (
    <div>
      <PageHeader
        title={vi.finance.payment.ledgerTitle}
        description={vi.finance.payment.ledgerDescription}
        actions={
          <>
            {canRecord && (
              <Button size="sm" onClick={() => setRecordOpen(true)}>
                {vi.finance.payment.ledgerRecordButton}
              </Button>
            )}
            {canAdjust && (
              <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>
                {vi.finance.payment.ledgerAdjustmentButton}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.payment.ledgerTotalIn}</p>
          <p className="text-status-done font-medium">{formatVnd(totals.totalIn)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.payment.ledgerTotalOut}</p>
          <p className="text-status-pending font-medium">{formatVnd(totals.totalOut)}</p>
        </div>
        <div className="border-border rounded-md border p-3 text-sm">
          <p className="text-muted-foreground text-xs">{vi.finance.payment.ledgerPendingCount}</p>
          <p className="font-medium">
            {totals.pendingCount} · {formatVnd(totals.pendingAmount)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={vi.finance.payment.ledgerSearchPlaceholder} className="max-w-sm flex-1" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={vi.finance.payment.ledgerFilterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.finance.payment.ledgerAllFilter}</SelectItem>
            {TRANSACTION_STATUSES.map((s: TransactionStatus) => (
              <SelectItem key={s} value={s}>
                {TRANSACTION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.finance.payment.ledgerFilterType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.finance.payment.ledgerAllFilter}</SelectItem>
            {TRANSACTION_TYPES.map((t: TransactionType) => (
              <SelectItem key={t} value={t}>
                {TRANSACTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={vi.finance.payment.ledgerFilterMethod} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.finance.payment.ledgerAllFilter}</SelectItem>
            {PAYMENT_METHODS.map((m: PaymentMethod) => (
              <SelectItem key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder={vi.finance.payment.ledgerFilterDirection} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.finance.payment.ledgerAllFilter}</SelectItem>
            {TRANSACTION_DIRECTIONS.map((d: TransactionDirection) => (
              <SelectItem key={d} value={d}>
                {TRANSACTION_DIRECTION_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant={approvalPendingOnly ? 'default' : 'outline'} onClick={() => setApprovalPendingOnly((v) => !v)}>
          {vi.finance.payment.ledgerFilterApprovalPending}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : filtered.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{vi.finance.payment.ledgerEmpty}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{vi.finance.payment.ledgerColumnCode}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnPerformedAt}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnType}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnDirection}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnAmount}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnMethod}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnStatus}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnRental}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnCustomer}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnPerformedBy}</TableHead>
                  <TableHead>{vi.finance.payment.ledgerColumnReceipt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => {
                  const reversalOf = t.reversalOfId ? txns.find((x) => x.id === t.reversalOfId) : undefined
                  return (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetailTxnId(t.id)}>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell>{formatDateTime(t.performedAt)}</TableCell>
                      <TableCell>{TRANSACTION_TYPE_LABELS[t.type]}</TableCell>
                      <TableCell>
                        <Badge variant={t.direction === 'IN' ? 'success' : 'warning'}>{TRANSACTION_DIRECTION_LABELS[t.direction]}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatVnd(t.amount)}
                        {reversalOf && <div className="text-muted-foreground text-xs">{vi.finance.payment.ledgerReversalOfNote.replace('{code}', reversalOf.code)}</div>}
                      </TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[t.method]}</TableCell>
                      <TableCell>
                        <TransactionStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="min-w-0 truncate font-mono text-xs">{t.rentalId ?? '—'}</TableCell>
                      <TableCell className="min-w-0 truncate">{customerById.get(t.customerId)?.fullName ?? t.customerId}</TableCell>
                      <TableCell className="min-w-0 truncate">{t.performedByName}</TableCell>
                      <TableCell>{t.receipt ? t.receipt.receiptNo : '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((t) => (
              <div key={t.id} className="border-border flex flex-col gap-2 rounded-md border p-3 text-sm cursor-pointer" onClick={() => setDetailTxnId(t.id)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{t.code}</span>
                  <TransactionStatusBadge status={t.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span>{TRANSACTION_TYPE_LABELS[t.type]}</span>
                  <span className="font-medium">{formatVnd(t.amount)}</span>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>{PAYMENT_METHOD_LABELS[t.method]}</span>
                  <span>{formatDateTime(t.performedAt)}</span>
                </div>
                <div className="text-muted-foreground min-w-0 truncate text-xs">
                  {customerById.get(t.customerId)?.fullName ?? t.customerId} · {t.rentalId ?? '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <TransactionRecordDialog open={recordOpen} onOpenChange={setRecordOpen} />
      <PaymentAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
      <TransactionDetailSheet
        transaction={detailTxn}
        allTransactions={txns}
        customerName={detailTxn ? customerById.get(detailTxn.customerId)?.fullName : undefined}
        outsideFilter={outsideFilter}
        open={!!detailTxn}
        onOpenChange={(o) => !o && setDetailTxnId(null)}
      />
    </div>
  )
}
