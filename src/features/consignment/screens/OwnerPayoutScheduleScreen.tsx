import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicles } from '@/features/vehicles/hooks'
import { PAYOUT_STATUSES, type PayoutStatus } from '@/shared/domain/enums'
import { PAYOUT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatVnd } from '@/shared/lib/money'
import { DEFAULT_PAGE_SIZE, paginate } from '@/shared/lib/pagination'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { OwnerPayoutRecordSheet } from '../components/OwnerPayoutRecordSheet'
import { OwnerPayoutRecordTable } from '../components/OwnerPayoutRecordTable'
import { useConsignmentContracts, useGenerateOwnerPayoutRecords, useOwnerPayoutRecords, useVehicleOwners } from '../hooks'
import { toLocalDateKey } from '../model'
import { formatPeriod, isPayoutDueSoon, isPayoutOverdue, periodOf, periodRange } from '../payoutModel'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho value rỗng. */
const ALL = '__ALL__'

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-xl font-semibold">{value}</span>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </CardContent>
    </Card>
  )
}

/** Lịch chi trả hàng tháng (`/consignment/payouts`) — kế hoạch mục 19.6. Thiếu quyền xem chỉ thấy thông điệp, không tải dữ liệu. */
export function OwnerPayoutScheduleScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) return <ConsignmentNoPermission title={vi.consignment.payouts.title} />
  return <OwnerPayoutScheduleContent />
}

function OwnerPayoutScheduleContent() {
  const t = vi.consignment.payouts
  const { can } = usePermission()
  const canEdit = can('CONSIGNMENT', 'EDIT')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRecordId = searchParams.get('record') ?? undefined

  const todayKey = toLocalDateKey(new Date())
  const currentPeriod = periodOf(todayKey)
  const [period, setPeriod] = useState<string>(currentPeriod)
  const [status, setStatus] = useState<PayoutStatus | undefined>(undefined)
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: allRecords, isLoading } = useOwnerPayoutRecords()
  const { data: owners } = useVehicleOwners()
  const { data: contracts } = useConsignmentContracts()
  const { data: vehicles } = useVehicles()
  const generate = useGenerateOwnerPayoutRecords()

  const ownerNames = useMemo(() => new Map((owners ?? []).map((o) => [o.id, o.fullName])), [owners])
  const contractNos = useMemo(() => new Map((contracts ?? []).map((c) => [c.id, c.contractNo])), [contracts])
  const plates = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v.plate])), [vehicles])

  // Kỳ chọn được: mọi kỳ đang có Record (mới nhất trước) + kỳ hiện tại.
  const periodOptions = useMemo(() => {
    const periods = new Set((allRecords ?? []).map((r) => r.period))
    periods.add(currentPeriod)
    const sorted = [...periods].sort()
    return periodRange(sorted[0], sorted[sorted.length - 1]).filter((p) => periods.has(p)).reverse()
  }, [allRecords, currentPeriod])

  const kpis = useMemo(() => {
    const live = (allRecords ?? []).filter((r) => r.status !== 'CANCELLED')
    const inPeriod = period === ALL ? live : live.filter((r) => r.period === period)
    const overdue = live.filter((r) => isPayoutOverdue(r, todayKey))
    const onHold = live.filter((r) => r.status === 'ON_HOLD')
    const dueSoon = live.filter((r) => isPayoutDueSoon(r, todayKey))
    const sum = (items: typeof live) => items.reduce((total, r) => total + r.amountPayable, 0)
    return {
      periodTotal: sum(inPeriod),
      periodCount: inPeriod.length,
      overdueCount: overdue.length,
      overdueAmount: sum(overdue),
      holdCount: onHold.length,
      holdAmount: sum(onHold),
      dueSoonCount: dueSoon.length,
      dueSoonAmount: sum(dueSoon),
    }
  }, [allRecords, period, todayKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allRecords ?? [])
      .filter((r) => period === ALL || r.period === period)
      .filter((r) => !status || r.status === status)
      .filter((r) => !ownerId || r.ownerId === ownerId)
      .filter((r) => {
        if (!q) return true
        return [contractNos.get(r.contractId) ?? '', plates.get(r.vehicleId) ?? '', r.code].join(' ').toLowerCase().includes(q)
      })
  }, [allRecords, period, status, ownerId, search, contractNos, plates])

  const byOwner = useMemo(() => {
    const map = new Map<string, { ownerId: string; count: number; total: number; unpaid: number }>()
    for (const r of filtered) {
      if (r.status === 'CANCELLED') continue
      const row = map.get(r.ownerId) ?? { ownerId: r.ownerId, count: 0, total: 0, unpaid: 0 }
      row.count += 1
      row.total += r.amountPayable
      if (r.status !== 'PAID') row.unpaid += r.amountPayable
      map.set(r.ownerId, row)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filtered])

  const pageResult = paginate(filtered, page, DEFAULT_PAGE_SIZE)

  async function handleGenerate() {
    try {
      const result = await generate.mutateAsync()
      if (result.created === 0) toast.info(t.generateNothing)
      else toast.success(t.generateSuccess(result.created))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : vi.consignment.actionError)
    }
  }

  function openRecord(id: string) {
    setSearchParams({ record: id })
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link to={paths.consignmentOwnerPayouts}>{t.goToOwnerPayouts}</Link>
            </Button>
            {canEdit && (
              <Button size="sm" disabled={generate.isPending} onClick={handleGenerate}>
                {t.generateButton}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={period === ALL ? t.kpiPayableAll : t.kpiPayablePeriod(formatPeriod(period))}
          value={formatVnd(kpis.periodTotal)}
          hint={t.kpiCount(kpis.periodCount)}
        />
        <Kpi label={t.kpiOverdue} value={formatVnd(kpis.overdueAmount)} hint={t.kpiCount(kpis.overdueCount)} />
        <Kpi label={t.kpiOnHold} value={formatVnd(kpis.holdAmount)} hint={t.kpiCount(kpis.holdCount)} />
        <Kpi label={t.kpiDueSoon} value={formatVnd(kpis.dueSoonAmount)} hint={t.kpiCount(kpis.dueSoonCount)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input className="sm:w-72" placeholder={t.searchPlaceholder} value={search} onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }} />
        <Select value={period} onValueChange={(v) => {
            setPeriod(v)
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.filterAllPeriods}</SelectItem>
            {periodOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {formatPeriod(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status ?? ALL} onValueChange={(v) => {
            setStatus(v === ALL ? undefined : (v as PayoutStatus))
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.consignment.contractFilterAllStatuses}</SelectItem>
            {PAYOUT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {PAYOUT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerId ?? ALL} onValueChange={(v) => {
            setOwnerId(v === ALL ? undefined : v)
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.filterAllOwners}</SelectItem>
            {(owners ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {byOwner.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">{period === ALL ? t.byOwnerTitleAll : t.byOwnerTitle(formatPeriod(period))}</h2>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{vi.consignment.contractColumnOwner}</TableHead>
                      <TableHead className="text-right">{t.byOwnerCount}</TableHead>
                      <TableHead className="text-right">{t.byOwnerTotal}</TableHead>
                      <TableHead className="text-right">{t.byOwnerUnpaid}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byOwner.map((row) => (
                      <TableRow key={row.ownerId}>
                        <TableCell>
                          <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentOwnerDetail(row.ownerId)}>
                            {ownerNames.get(row.ownerId) ?? row.ownerId}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(row.total)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatVnd(row.unpaid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          <OwnerPayoutRecordTable
            records={pageResult.items}
            ownerNameOf={(id) => ownerNames.get(id) ?? id}
            plateOf={(id) => plates.get(id) ?? id}
            contractNoOf={(id) => contractNos.get(id) ?? id}
            onSelect={(r) => openRecord(r.id)}
          />
          <Pagination page={pageResult.page} pageSize={DEFAULT_PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </div>
      )}

      <OwnerPayoutRecordSheet
        recordId={selectedRecordId}
        open={!!selectedRecordId}
        onOpenChange={(open) => !open && setSearchParams({})}
        onOpenRecord={openRecord}
      />
    </div>
  )
}
