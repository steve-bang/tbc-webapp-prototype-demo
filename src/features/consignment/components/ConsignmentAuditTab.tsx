import { useMemo } from 'react'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useConsignmentAudit, useConsignmentHandoverRecords } from '../hooks'

/**
 * Tab "Nhật ký thao tác" của chủ xe hoặc hợp đồng. Với hợp đồng, gộp cả nhật ký biên bản nhận/trả xe thuộc hợp đồng đó.
 * Mirror `ContractAuditTab`/`VehicleAuditTab`.
 */
export function ConsignmentAuditTab({ ownerId, contractId }: { ownerId?: string; contractId?: string }) {
  const { data: records } = useConsignmentHandoverRecords(contractId ? { contractId } : undefined)
  const handoverIds = useMemo(() => (contractId ? (records ?? []).map((r) => r.id) : []), [contractId, records])

  const entities = useMemo(() => {
    const list: Array<{ entity: string; entityIds: string[] }> = []
    if (ownerId) list.push({ entity: 'VehicleOwner', entityIds: [ownerId] })
    if (contractId) {
      list.push({ entity: 'ConsignmentContract', entityIds: [contractId] })
      list.push({ entity: 'ConsignmentHandoverRecord', entityIds: handoverIds })
    }
    return list
  }, [ownerId, contractId, handoverIds])

  const { data: audit } = useConsignmentAudit(entities)

  if (!audit || audit.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.consignment.auditEmpty}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{vi.consignment.auditColumnAt}</TableHead>
            <TableHead>{vi.consignment.auditColumnAction}</TableHead>
            <TableHead>{vi.consignment.auditColumnActor}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.map((record) => (
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
