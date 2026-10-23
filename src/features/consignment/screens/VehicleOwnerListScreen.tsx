import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { OWNER_TYPES, type OwnerType } from '@/shared/domain/enums'
import { OWNER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ConsignmentNoPermission } from '../components/ConsignmentNoPermission'
import { VehicleOwnerCard } from '../components/VehicleOwnerCard'
import { VehicleOwnerFormSheet } from '../components/VehicleOwnerFormSheet'
import { getEffectiveTerm } from '../addendumModel'
import { useConsignmentContracts, useVehicleOwners } from '../hooks'
import { maskAccountNumber, toLocalDateKey } from '../model'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/** Danh sách hồ sơ chủ xe (`/consignment/owners`) — plan mục 8.1. Gate trang: `CONSIGNMENT.VIEW` (nav). */
export function VehicleOwnerListScreen() {
  const { can } = usePermission()
  if (!can('CONSIGNMENT', 'VIEW')) return <ConsignmentNoPermission title={vi.consignment.ownersTitle} />
  return <VehicleOwnerListScreenContent />
}

function VehicleOwnerListScreenContent() {
  const navigate = useNavigate()
  const { can } = usePermission()
  const canCreate = can('CONSIGNMENT', 'CREATE')

  const [search, setSearch] = useState('')
  const [ownerType, setOwnerType] = useState<OwnerType | undefined>(undefined)
  const [formOpen, setFormOpen] = useState(false)

  const { data: allOwners, isLoading } = useVehicleOwners()
  const { data: contracts } = useConsignmentContracts()

  // Số xe đang ký gửi + tổng chi trả cố định/tháng: chỉ tính hợp đồng ACTIVE/SUSPENDED (SUSPENDED mặc định vẫn trả đủ).
  const statsByOwner = useMemo(() => {
    const todayKey = toLocalDateKey(new Date())
    const map = new Map<string, { count: number; total: number }>()
    for (const c of contracts ?? []) {
      if (c.status !== 'ACTIVE' && c.status !== 'SUSPENDED') continue
      const prev = map.get(c.ownerId) ?? { count: 0, total: 0 }
      // VC-BR-05 — mức đang áp dụng hôm nay (đã tính phụ lục), không phải điều khoản gốc.
      map.set(c.ownerId, { count: prev.count + 1, total: prev.total + getEffectiveTerm(c, todayKey).term.fixedMonthlyAmount })
    }
    return map
  }, [contracts])

  const owners = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allOwners ?? [])
      .filter((o) => !ownerType || o.ownerType === ownerType)
      .filter((o) => {
        if (!q) return true
        return [o.fullName, o.phone, o.idNumber ?? '', o.taxCode ?? '', o.code].join(' ').toLowerCase().includes(q)
      })
  }, [allOwners, search, ownerType])

  const hasAny = (allOwners?.length ?? 0) > 0
  const hasFilter = !!(search.trim() || ownerType)

  function openDetail(id: string) {
    navigate(paths.consignmentOwnerDetail(id))
  }

  return (
    <div>
      <PageHeader
        title={vi.consignment.ownersTitle}
        description={vi.consignment.ownersDescription}
        actions={
          canCreate && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              {vi.consignment.ownerAddButton}
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={vi.consignment.ownerSearchPlaceholder}
          className="max-w-sm flex-1"
        />
        <Select value={ownerType ?? ALL} onValueChange={(v) => setOwnerType(v === ALL ? undefined : (v as OwnerType))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.consignment.ownerFilterType} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.consignment.ownerFilterAllTypes}</SelectItem>
            {OWNER_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {OWNER_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : owners.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.consignment.ownerColumnCode}</TableHead>
                    <TableHead>{vi.consignment.ownerColumnName}</TableHead>
                    <TableHead>{vi.consignment.ownerColumnType}</TableHead>
                    <TableHead>{vi.consignment.ownerColumnPhone}</TableHead>
                    <TableHead className="text-right">{vi.consignment.ownerColumnVehicleCount}</TableHead>
                    <TableHead className="text-right">{vi.consignment.ownerColumnMonthlyTotal}</TableHead>
                    <TableHead>{vi.consignment.ownerColumnBank}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owners.map((owner) => {
                    const stats = statsByOwner.get(owner.id) ?? { count: 0, total: 0 }
                    return (
                      <TableRow key={owner.id} className="cursor-pointer" onClick={() => openDetail(owner.id)}>
                        <TableCell className="font-medium">{owner.code}</TableCell>
                        <TableCell>{owner.fullName}</TableCell>
                        <TableCell>{OWNER_TYPE_LABELS[owner.ownerType]}</TableCell>
                        <TableCell>{owner.phone}</TableCell>
                        <TableCell className="text-right">{stats.count}</TableCell>
                        <TableCell className="text-right">{formatVnd(stats.total)}</TableCell>
                        <TableCell>
                          {owner.bankAccount ? (
                            <span className="font-mono text-sm">{maskAccountNumber(owner.bankAccount.accountNumber)}</span>
                          ) : (
                            <Badge variant="warning">{vi.consignment.ownerNoBank}</Badge>
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
            {owners.map((owner) => {
              const stats = statsByOwner.get(owner.id) ?? { count: 0, total: 0 }
              return (
                <VehicleOwnerCard
                  key={owner.id}
                  owner={owner}
                  vehicleCount={stats.count}
                  monthlyTotal={stats.total}
                  onOpen={() => openDetail(owner.id)}
                />
              )
            })}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAny && hasFilter ? vi.consignment.ownerEmptyFiltered : vi.consignment.ownerEmptyAll}</p>
        </div>
      )}

      {canCreate && <VehicleOwnerFormSheet open={formOpen} onOpenChange={setFormOpen} />}
    </div>
  )
}
