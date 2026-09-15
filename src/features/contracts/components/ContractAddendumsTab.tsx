import { CONTRACT_ADDENDUM_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useContractAddendums } from '../hooks'

/**
 * Tab "Phụ lục" — đọc-only (`docs/CONTRACT-MANAGEMENT-PLAN.md` §1.2, không có
 * form tạo Round 1). Rỗng ở đây nghĩa là "chưa phát sinh phụ lục" (hợp lệ),
 * khác ngữ nghĩa "chờ Phase" của `RentalDetailPlaceholder`.
 */
export function ContractAddendumsTab({ contractId }: { contractId: string }) {
  const { data: addendums = [], isLoading } = useContractAddendums({ contractId })

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  }

  if (addendums.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.contracts.addendumEmpty}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.contracts.addendumColumnType}</TableHead>
            <TableHead>{vi.contracts.addendumColumnEffectiveDate}</TableHead>
            <TableHead>{vi.contracts.addendumColumnDescription}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addendums.map((addendum) => (
            <TableRow key={addendum.id}>
              <TableCell className="font-medium">{CONTRACT_ADDENDUM_TYPE_LABELS[addendum.type]}</TableCell>
              <TableCell>{formatDate(addendum.effectiveDate)}</TableCell>
              <TableCell>{addendum.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
