import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { paths } from '@/app/paths'
import { CONTRACT_STATUSES, type ContractStatus } from '@/shared/domain/enums'
import { CONTRACT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { PageHeader } from '@/shared/layout/PageHeader'
import { formatDateTime } from '@/shared/lib/datetime'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ContractCard } from '../components/ContractCard'
import { ContractStatusBadge } from '../components/ContractStatusBadge'
import { useContracts } from '../hooks'

/** Giá trị đại diện "Tất cả" trong Select — Radix Select không cho phép value rỗng. */
const ALL = '__ALL__'

/**
 * `docs/CONTRACT-MANAGEMENT-PLAN.md` §5.2 — danh sách + lọc trạng thái + tìm
 * kiếm mã/tên khách/biển số. Dùng thẳng field snapshot trên `Contract`, KHÔNG
 * cần join `Customer`/`Vehicle` (đơn giản hơn `RentalListScreen`). Không có
 * nút "Tạo" ở đây — hợp đồng chỉ sinh được từ tab "Hợp đồng" của Rental Detail
 * (`RentalContractTab`, §5.1).
 */
export function ContractListScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ContractStatus | undefined>(undefined)

  const { data: allContracts, isLoading } = useContracts()

  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (allContracts ?? [])
      .filter((c) => !status || c.status === status)
      .filter((c) => {
        if (q.length === 0) return true
        const haystack = [c.contractCode, c.snapshotCustomerName, c.snapshotVehiclePlate].join(' ').toLowerCase()
        return haystack.includes(q)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [allContracts, search, status])

  const hasAnyContract = (allContracts?.length ?? 0) > 0
  const hasActiveFilter = !!(search.trim() || status)

  function openDetail(contractId: string) {
    navigate(paths.contractDetail(contractId))
  }

  return (
    <div>
      <PageHeader title={vi.contracts.title} description={vi.contracts.description} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={vi.contracts.searchPlaceholder}
          className="max-w-sm flex-1"
        />
        <Select
          value={status ?? ALL}
          onValueChange={(v) => setStatus(v === ALL ? undefined : (v as ContractStatus))}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={vi.contracts.filterStatus} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{vi.contracts.filterAllStatuses}</SelectItem>
            {CONTRACT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {CONTRACT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
      ) : filteredContracts.length > 0 ? (
        <>
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{vi.contracts.columnCode}</TableHead>
                    <TableHead>{vi.contracts.columnCustomer}</TableHead>
                    <TableHead>{vi.contracts.columnVehicle}</TableHead>
                    <TableHead>{vi.contracts.columnCreatedAt}</TableHead>
                    <TableHead>{vi.common.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id} className="cursor-pointer" onClick={() => openDetail(contract.id)}>
                      <TableCell className="font-medium">{contract.contractCode}</TableCell>
                      <TableCell>{contract.snapshotCustomerName}</TableCell>
                      <TableCell>{contract.snapshotVehiclePlate}</TableCell>
                      <TableCell>{formatDateTime(contract.createdAt)}</TableCell>
                      <TableCell>
                        <ContractStatusBadge status={contract.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filteredContracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} onOpen={() => openDetail(contract.id)} />
            ))}
          </div>
        </>
      ) : (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{hasAnyContract && hasActiveFilter ? vi.contracts.emptyFiltered : vi.contracts.emptyAll}</p>
        </div>
      )}
    </div>
  )
}
