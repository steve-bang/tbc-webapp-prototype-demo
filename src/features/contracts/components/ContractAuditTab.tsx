import { vi } from '@/shared/i18n/vi'
import { listAuditRecords } from '@/shared/lib/audit'
import { formatDateTime } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/** Tab "Nhật ký thao tác" — chỉ đọc `listAuditRecords()` lọc theo hợp đồng đang xem. Mirror `RentalAuditTab`/`VehicleAuditTab`. */
export function ContractAuditTab({ contractId }: { contractId: string }) {
  const records = listAuditRecords()
    .filter((r) => r.entity === 'Contract' && r.entityId === contractId)
    .sort((a, b) => b.at.localeCompare(a.at))

  if (records.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.contracts.auditEmpty}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.contracts.auditColumnAt}</TableHead>
            <TableHead>{vi.contracts.auditColumnAction}</TableHead>
            <TableHead>{vi.contracts.auditColumnActor}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id}>
              <TableCell>{formatDateTime(record.at)}</TableCell>
              <TableCell>{record.summary}</TableCell>
              <TableCell>{record.actorName}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
