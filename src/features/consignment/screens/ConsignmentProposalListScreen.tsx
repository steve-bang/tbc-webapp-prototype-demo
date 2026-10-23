import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { CONSIGNMENT_PROPOSAL_STATUSES, type ConsignmentProposalStatus } from '@/shared/domain/enums'
import { CONSIGNMENT_PROPOSAL_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { ConsignmentProposalCard } from '../components/ConsignmentProposalCard'
import { ConsignmentProposalFormSheet } from '../components/ConsignmentProposalFormSheet'
import { ConsignmentProposalStatusBadge } from '../components/ConsignmentProposalStatusBadge'
import { useConsignmentContracts, useConsignmentProposals, useVehicleOwners } from '../hooks'
import { listProposalContracts } from '../proposalModel'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/**
 * Danh sách đề nghị ký gửi (`/consignment/proposals`) — gate `CONSIGNMENT.ASSESS`.
 * Mọi vai trò có ít nhất một thao tác trên đề nghị (ghi nhận `CREATE`, thẩm định `ASSESS`, duyệt `APPROVE`) đều có `ASSESS`;
 * dòng "Xem" của ma trận chỉ nói tới hợp đồng / lịch chi trả. Tên chủ xe và số hợp đồng chỉ là link khi người xem có `VIEW`.
 * TODO(OQ: VehicleConsignment-BRD.md mục 18 — Operation Staff chỉ "phần hiện trạng"; ma trận chưa tách quyền theo phần)
 */
export function ConsignmentProposalListScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'ASSESS')) return <ConsignmentNoPermission title={vi.consignment.proposals.title} />
  return <ConsignmentProposalListScreenContent />
}

function ConsignmentProposalListScreenContent() {
  const t = vi.consignment.proposals
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('CONSIGNMENT', 'CREATE')
  const canView = can('CONSIGNMENT', 'VIEW')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ConsignmentProposalStatus | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)

  const { data: allProposals, isLoading } = useConsignmentProposals()
  const { data: owners } = useVehicleOwners()
  const { data: contracts } = useConsignmentContracts()

  const ownerName = useMemo(() => new Map((owners ?? []).map((o) => [o.id, o.fullName])), [owners])
  // Hợp đồng đang gắn với đề nghị: bỏ bản đã bị thay (SUPERSEDED), lấy bản mới nhất.
  const contractOf = useMemo(() => {
    const map = new Map<string, { id: string; contractNo: string }>()
    for (const p of allProposals ?? []) {
      const current = listProposalContracts(p, contracts ?? []).filter((c) => c.status !== 'SUPERSEDED').pop()
      if (current) map.set(p.id, { id: current.id, contractNo: current.contractNo })
    }
    return map
  }, [allProposals, contracts])

  const proposals = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allProposals ?? [])
      .filter((p) => !status || p.status === status)
      .filter((p) => {
        if (!q) return true
        return [p.code, p.declaredVehicle.plate, ownerName.get(p.ownerId) ?? ''].join(' ').toLowerCase().includes(q)
      })
  }, [allProposals, search, status, ownerName])

  const hasAny = (allProposals?.length ?? 0) > 0
  const hasFilter = !!(search.trim() || status)

  function openDetail(id: string) {
    navigate(paths.consignmentProposalDetail(id))
  }

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {t.addButton}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="max-w-sm flex-1"
        />
        <Select value={status ?? ALL} onValueChange={(v) => setStatus(v === ALL ? undefined : (v as ConsignmentProposalStatus))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t.filterAllStatuses}</SelectItem>
            {CONSIGNMENT_PROPOSAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CONSIGNMENT_PROPOSAL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : proposals.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.columnCode}</TableHead>
                    <TableHead>{t.columnOwner}</TableHead>
                    <TableHead>{t.columnPlate}</TableHead>
                    <TableHead>{t.columnVehicle}</TableHead>
                    <TableHead className="text-right">{t.columnExpected}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                    <TableHead>{t.columnCreatedAt}</TableHead>
                    <TableHead>{t.columnContract}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((p) => {
                    const contract = contractOf.get(p.id)
                    const owner = ownerName.get(p.ownerId) ?? p.ownerId
                    return (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => openDetail(p.id)}>
                        <TableCell className="font-medium">{p.code}</TableCell>
                        <TableCell>
                          {canView ? (
                            <Link
                              className="text-primary underline-offset-4 hover:underline"
                              to={paths.consignmentOwnerDetail(p.ownerId)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {owner}
                            </Link>
                          ) : (
                            owner
                          )}
                        </TableCell>
                        <TableCell>{p.declaredVehicle.plate}</TableCell>
                        <TableCell>
                          {p.declaredVehicle.brand} {p.declaredVehicle.model}
                          {p.declaredVehicle.manufacturingYear ? ` ${p.declaredVehicle.manufacturingYear}` : ''}
                        </TableCell>
                        <TableCell className="text-right">{formatVnd(p.expectedMonthlyAmount)}</TableCell>
                        <TableCell>
                          <ConsignmentProposalStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell>{formatDate(p.createdAt)}</TableCell>
                        <TableCell>
                          {contract ? (
                            canView ? (
                              <Link
                                className="text-primary underline-offset-4 hover:underline"
                                to={paths.consignmentContractDetail(contract.id)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {contract.contractNo}
                              </Link>
                            ) : (
                              contract.contractNo
                            )
                          ) : (
                            vi.consignment.noValue
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {proposals.map((p) => (
              <ConsignmentProposalCard
                key={p.id}
                proposal={p}
                ownerName={ownerName.get(p.ownerId) ?? p.ownerId}
                contractNo={contractOf.get(p.id)?.contractNo}
                onOpen={() => openDetail(p.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAny && hasFilter ? t.emptyFiltered : t.emptyAll}</p>
        </div>
      )}

      {canCreate && (
        <ConsignmentProposalFormSheet open={formOpen} onOpenChange={setFormOpen} onCreated={(created) => openDetail(created.id)} />
      )}
    </div>
  )
}
