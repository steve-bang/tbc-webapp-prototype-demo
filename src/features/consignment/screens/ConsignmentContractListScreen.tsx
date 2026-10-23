import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { useVehicles } from '@/features/vehicles/hooks'
import { CONSIGNMENT_CONTRACT_STATUSES, type ConsignmentContractStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { ConsignmentContractCard } from '../components/ConsignmentContractCard'
import { ConsignmentContractFormSheet } from '../components/ConsignmentContractFormSheet'
import { ConsignmentContractStatusBadge } from '../components/ConsignmentContractStatusBadge'
import { getEffectiveTerm } from '../addendumModel'
import { useConsignmentContracts, useVehicleOwners } from '../hooks'
import { isExpiringSoon, summarizeContracts, toLocalDateKey } from '../model'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  )
}

/** Danh sách hợp đồng ký gửi (`/consignment/contracts`) — plan mục 8.3. */
export function ConsignmentContractListScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) return <ConsignmentNoPermission title={vi.consignment.contractsTitle} />
  return <ConsignmentContractListScreenContent />
}

function ConsignmentContractListScreenContent() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('CONSIGNMENT', 'CREATE')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ConsignmentContractStatus | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)

  const { data: allContracts, isLoading } = useConsignmentContracts()
  const { data: owners } = useVehicleOwners()
  const { data: vehicles } = useVehicles()

  const todayKey = toLocalDateKey(new Date())
  const ownerName = useMemo(() => new Map((owners ?? []).map((o) => [o.id, o.fullName])), [owners])
  const plateOf = useMemo(() => new Map((vehicles ?? []).map((v) => [v.id, v.plate])), [vehicles])
  const summary = useMemo(() => summarizeContracts(allContracts ?? [], todayKey), [allContracts, todayKey])

  const contracts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allContracts ?? [])
      .filter((c) => !status || c.status === status)
      .filter((c) => {
        if (!q) return true
        return [c.contractNo, plateOf.get(c.vehicleId) ?? '', ownerName.get(c.ownerId) ?? ''].join(' ').toLowerCase().includes(q)
      })
  }, [allContracts, search, status, plateOf, ownerName])

  const hasAny = (allContracts?.length ?? 0) > 0
  const hasFilter = !!(search.trim() || status)

  function openDetail(id: string) {
    navigate(paths.consignmentContractDetail(id))
  }

  return (
    <div>
      <PageHeader
        title={vi.consignment.contractsTitle}
        description={vi.consignment.contractsDescription}
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {vi.consignment.contractAddButton}
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label={vi.consignment.kpiEffectiveCount} value={String(summary.effectiveCount)} />
        <Kpi label={vi.consignment.kpiMonthlyTotal} value={formatVnd(summary.monthlyTotal)} />
        <Kpi label={vi.consignment.kpiExpiringSoon} value={String(summary.expiringSoonCount)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={vi.consignment.contractSearchPlaceholder}
          className="max-w-sm flex-1"
        />
        <Select value={status ?? ALL} onValueChange={(v) => setStatus(v === ALL ? undefined : (v as ConsignmentContractStatus))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.consignment.contractFilterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.consignment.contractFilterAllStatuses}</SelectItem>
            {CONSIGNMENT_CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CONSIGNMENT_CONTRACT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : contracts.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.consignment.contractColumnNo}</TableHead>
                    <TableHead>{vi.consignment.contractColumnVehicle}</TableHead>
                    <TableHead>{vi.consignment.contractColumnOwner}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                    <TableHead>{vi.consignment.contractColumnEffective}</TableHead>
                    <TableHead className="text-right">{vi.consignment.contractColumnAmount}</TableHead>
                    <TableHead>{vi.consignment.contractColumnPaymentDay}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((c) => {
                    const term = getEffectiveTerm(c, todayKey).term
                    return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c.id)}>
                      <TableCell className="font-medium">{c.contractNo}</TableCell>
                      <TableCell>{plateOf.get(c.vehicleId) ?? c.vehicleId}</TableCell>
                      <TableCell>{ownerName.get(c.ownerId) ?? c.ownerId}</TableCell>
                      <TableCell>
                        <ConsignmentContractStatusBadge status={c.status} expiringSoon={isExpiringSoon(c, todayKey)} />
                      </TableCell>
                      <TableCell>
                        {formatDate(c.effectiveFrom)} – {formatDate(c.effectiveTo)}
                      </TableCell>
                      <TableCell className="text-right">{formatVnd(term.fixedMonthlyAmount)}</TableCell>
                      <TableCell>{vi.consignment.paymentDayValue(term.paymentDay)}</TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {contracts.map((c) => (
              <ConsignmentContractCard
                key={c.id}
                contract={c}
                plate={plateOf.get(c.vehicleId) ?? c.vehicleId}
                ownerName={ownerName.get(c.ownerId) ?? c.ownerId}
                expiringSoon={isExpiringSoon(c, todayKey)}
                term={getEffectiveTerm(c, todayKey).term}
                onOpen={() => openDetail(c.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAny && hasFilter ? vi.consignment.contractEmptyFiltered : vi.consignment.contractEmptyAll}</p>
        </div>
      )}

      {canCreate && (
        <ConsignmentContractFormSheet open={formOpen} onOpenChange={setFormOpen} onCreated={(c) => openDetail(c.id)} />
      )}
    </div>
  )
}
