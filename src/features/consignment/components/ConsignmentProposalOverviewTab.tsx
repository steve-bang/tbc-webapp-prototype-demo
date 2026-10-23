import { vi } from '@/shared/i18n/vi'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatNumber, formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { CONSIGNMENT_PROPOSAL_STATUS_LABELS } from '@/shared/i18n/vi'
import { PROPOSAL_CHECKLIST_LABELS, PROPOSAL_DOCUMENT_LABELS, type ConsignmentProposal } from '../proposalModel'
import { ConsignmentField } from './ConsignmentField'

/** Tab "Đề nghị & thẩm định": xe khai báo, kết quả thẩm định, quyết định và lịch sử trạng thái (BRD mục 7.1, 8). */
export function ConsignmentProposalOverviewTab({ proposal }: { proposal: ConsignmentProposal }) {
  const t = vi.consignment.proposals
  const vehicle = proposal.declaredVehicle
  const appraisal = proposal.appraisal

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.sectionDeclared}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ConsignmentField label={t.fieldPlate}>{vehicle.plate}</ConsignmentField>
          <ConsignmentField label={t.fieldBrand}>{vehicle.brand}</ConsignmentField>
          <ConsignmentField label={t.fieldModel}>{vehicle.model}</ConsignmentField>
          <ConsignmentField label={t.fieldYear}>{vehicle.manufacturingYear}</ConsignmentField>
          <ConsignmentField label={t.fieldColor}>{vehicle.color}</ConsignmentField>
          <ConsignmentField label={t.fieldExpectedAmount}>{formatVnd(proposal.expectedMonthlyAmount)}</ConsignmentField>
          <div className="sm:col-span-3">
            <ConsignmentField label={t.fieldCondition}>{proposal.declaredCondition}</ConsignmentField>
          </div>
          {proposal.note && (
            <div className="sm:col-span-3">
              <ConsignmentField label={t.fieldNote}>{proposal.note}</ConsignmentField>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.sectionAppraisal}</h3>
        {appraisal ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ConsignmentField label={t.fieldOwnershipCheck}>
                <Badge variant={appraisal.ownershipCheck === 'INVALID' ? 'destructive' : 'success'}>
                  {t.ownershipCheck[appraisal.ownershipCheck]}
                </Badge>
              </ConsignmentField>
              <ConsignmentField label={t.fieldOdo}>{formatNumber(appraisal.odoKm)} km</ConsignmentField>
              <ConsignmentField label={t.fieldAppraisedValue}>{formatVnd(appraisal.appraisedValue)}</ConsignmentField>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {appraisal.documents.map((d) => (
                <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {PROPOSAL_DOCUMENT_LABELS[d.key]}
                    {d.note ? <span className="text-muted-foreground"> — {d.note}</span> : null}
                  </span>
                  <Badge variant={d.ok ? 'success' : 'warning'}>{d.ok ? t.itemOk : t.itemNotOk}</Badge>
                </li>
              ))}
              {appraisal.checklist.map((c) => (
                <li key={c.item} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {PROPOSAL_CHECKLIST_LABELS[c.item as keyof typeof PROPOSAL_CHECKLIST_LABELS] ?? c.item}
                    {c.note ? <span className="text-muted-foreground"> — {c.note}</span> : null}
                  </span>
                  <Badge variant={c.ok ? 'success' : 'warning'}>{c.ok ? t.itemOk : t.itemNotOk}</Badge>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ConsignmentField label={t.fieldConditionNote}>{appraisal.conditionNote}</ConsignmentField>
              </div>
              <ConsignmentField label={t.fieldAccessories}>
                {appraisal.accessories.length > 0 ? appraisal.accessories.join(', ') : undefined}
              </ConsignmentField>
              <ConsignmentField label={t.fieldMediaNote}>{appraisal.mediaNote}</ConsignmentField>
              <div className="sm:col-span-2">
                <ConsignmentField label={t.fieldPendingDocuments}>{appraisal.pendingDocumentsNote}</ConsignmentField>
              </div>
              <ConsignmentField label={t.appraisedBy}>{appraisal.appraisedByName}</ConsignmentField>
              <ConsignmentField label={t.appraisedAt}>{formatDateTime(appraisal.appraisedAt)}</ConsignmentField>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t.appraisalEmpty}</p>
        )}
      </section>

      {proposal.decidedAt && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{t.sectionDecision}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ConsignmentField label={t.decidedBy}>{proposal.decidedByName}</ConsignmentField>
            <ConsignmentField label={t.decidedAt}>{formatDateTime(proposal.decidedAt)}</ConsignmentField>
            {proposal.rejectReason && <ConsignmentField label={t.rejectReasonLabel}>{proposal.rejectReason}</ConsignmentField>}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionStatusHistory}</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{vi.consignment.historyColumnAt}</TableHead>
                <TableHead>{vi.consignment.historyColumnChange}</TableHead>
                <TableHead>{vi.consignment.historyColumnBy}</TableHead>
                <TableHead>{vi.consignment.historyColumnReason}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...proposal.statusHistory]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((h) => (
                  <TableRow key={`${h.at}-${h.to}`}>
                    <TableCell>{formatDateTime(h.at)}</TableCell>
                    <TableCell>
                      {h.from ? `${CONSIGNMENT_PROPOSAL_STATUS_LABELS[h.from]} → ` : ''}
                      {CONSIGNMENT_PROPOSAL_STATUS_LABELS[h.to]}
                    </TableCell>
                    <TableCell>{h.byName}</TableCell>
                    <TableCell className="whitespace-normal">{h.reason ?? vi.consignment.noValue}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
