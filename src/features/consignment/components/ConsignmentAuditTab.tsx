import { useMemo } from 'react'
import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useConsignmentAudit, useConsignmentHandoverRecords, useOwnerPayoutRecords } from '../hooks'

/**
 * Tab "Nhật ký thao tác" của chủ xe, hợp đồng hoặc đề nghị ký gửi. Với hợp đồng, gộp thêm nhật ký biên bản nhận/trả xe và
 * nhật ký khoản chi trả thuộc hợp đồng đó (kèm các lần sinh lịch theo hợp đồng `contract:<id>`). Nhật ký sinh lịch theo lô
 * (`batch:<kỳ>`) không gắn với hợp đồng nào nên không gộp. Mirror `ContractAuditTab`/`VehicleAuditTab`.
 */
export function ConsignmentAuditTab({ ownerId, contractId, proposalId }: { ownerId?: string; contractId?: string; proposalId?: string }) {
  const { data: records } = useConsignmentHandoverRecords(contractId ? { contractId } : undefined, { enabled: !!contractId })
  const handoverIds = useMemo(() => (contractId ? (records ?? []).map((r) => r.id) : []), [contractId, records])
  const { data: payoutRecords } = useOwnerPayoutRecords(contractId ? { contractId } : undefined, { enabled: !!contractId })
  const payoutIds = useMemo(() => (contractId ? (payoutRecords ?? []).map((r) => r.id) : []), [contractId, payoutRecords])

  const entities = useMemo(() => {
    const list: Array<{ entity: string; entityIds: string[] }> = []
    if (ownerId) list.push({ entity: 'VehicleOwner', entityIds: [ownerId] })
    if (proposalId) list.push({ entity: 'ConsignmentProposal', entityIds: [proposalId] })
    if (contractId) {
      list.push({ entity: 'ConsignmentContract', entityIds: [contractId] })
      list.push({ entity: 'ConsignmentHandoverRecord', entityIds: handoverIds })
      list.push({ entity: 'OwnerPayoutRecord', entityIds: [...payoutIds, `contract:${contractId}`] })
    }
    return list
  }, [ownerId, contractId, proposalId, handoverIds, payoutIds])

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
