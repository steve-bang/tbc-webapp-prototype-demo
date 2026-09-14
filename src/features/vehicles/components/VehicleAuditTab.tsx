import { vi } from '@/shared/i18n/vi'
import { listAuditRecords } from '@/shared/lib/audit'
import { formatDateTime } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/**
 * Tab "Nhật ký thao tác" — chỉ đọc `listAuditRecords()` lọc theo xe đang xem,
 * sắp `at` giảm dần (`docs/VEHICLE-MANAGEMENT-PLAN.md` §8.3 dòng 12) — không
 * ghi thêm bản ghi nào. Gọi trực tiếp trong render (không qua TanStack Query,
 * đây không phải dữ liệu nghiệp vụ riêng của `vehicles`) để luôn phản ánh
 * đúng dữ liệu mới nhất mỗi khi màn Detail re-render sau một mutation.
 */
export function VehicleAuditTab({ vehicleId }: { vehicleId: string }) {
  const records = listAuditRecords()
    .filter((r) => r.entity === 'Vehicle' && r.entityId === vehicleId)
    .sort((a, b) => b.at.localeCompare(a.at))

  if (records.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.vehicles.auditEmpty}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.vehicles.auditColumnAt}</TableHead>
            <TableHead>{vi.vehicles.auditColumnAction}</TableHead>
            <TableHead>{vi.vehicles.auditColumnActor}</TableHead>
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
