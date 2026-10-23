import { CONSIGNMENT_HANDOVER_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'
import { useConsignmentHandoverRecords } from '../hooks'
import type { ConsignmentHandoverRecord } from '../model'
import { ConsignmentField } from './ConsignmentField'

const CHECKLIST_LABEL: Record<string, string> = {
  EXTERIOR: vi.consignment.checklistExterior,
  INTERIOR: vi.consignment.checklistInterior,
  MECHANICAL: vi.consignment.checklistMechanical,
}

function RecordCard({ record }: { record: ConsignmentHandoverRecord }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{record.code}</h3>
          <Badge variant={record.type === 'INTAKE' ? 'info' : 'neutral'}>{CONSIGNMENT_HANDOVER_TYPE_LABELS[record.type]}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <ConsignmentField label={vi.consignment.handoverAtLabel}>{formatDateTime(record.handoverAt)}</ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverOdo}>{formatNumber(record.odoKm)} km</ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverFuel}>{record.fuelLevel}%</ConsignmentField>
          {record.type === 'INTAKE' && (
            <ConsignmentField label={vi.consignment.handoverAppraised}>
              {record.appraisedValue ? formatVnd(record.appraisedValue) : undefined}
            </ConsignmentField>
          )}
        </div>
        <ConsignmentField label={vi.consignment.handoverBaseline}>{record.baselineCondition}</ConsignmentField>
        <ConsignmentField label={vi.consignment.handoverChecklist}>
          <span className="flex flex-col gap-0.5">
            {record.checklist.map((c) => (
              <span key={c.item}>
                {CHECKLIST_LABEL[c.item] ?? c.item}: {c.ok ? vi.consignment.intakeChecklistOk : vi.consignment.no}
                {c.note ? ` — ${c.note}` : ''}
              </span>
            ))}
          </span>
        </ConsignmentField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ConsignmentField label={vi.consignment.handoverAccessories}>
            {record.accessories.length > 0 ? record.accessories.join(', ') : undefined}
          </ConsignmentField>
          <ConsignmentField label={record.type === 'RETURN' ? vi.consignment.handoverDocumentsReturned : vi.consignment.handoverDocuments}>
            {record.documentsReceived.length > 0
              ? record.documentsReceived
                  .map((d) => `${d.name} (${d.kind === 'ORIGINAL' ? vi.consignment.docKindOriginal : vi.consignment.docKindCopy})`)
                  .join(', ')
              : undefined}
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverMissing}>{record.missingDocumentsNote}</ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverMedia}>{record.mediaNote}</ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverCompanyRep}>{record.companyRepName}</ConsignmentField>
          <ConsignmentField label={vi.consignment.handoverConfirmed}>
            {record.ownerConfirmed && record.companyConfirmed ? vi.consignment.handoverConfirmedYes : vi.consignment.no}
          </ConsignmentField>
        </div>
      </CardContent>
    </Card>
  )
}

/** Tab "Biên bản nhận / trả xe" của một hợp đồng. Biên bản append-only — không có sửa/xoá. */
export function ConsignmentHandoverRecordsTab({ contractId }: { contractId: string }) {
  const { data: records, isLoading } = useConsignmentHandoverRecords({ contractId })

  if (isLoading) return <p className="text-muted-foreground text-sm">{vi.common.loading}</p>
  if (!records || records.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">{vi.consignment.handoverEmpty}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {records.map((r) => (
        <RecordCard key={r.id} record={r} />
      ))}
    </div>
  )
}
