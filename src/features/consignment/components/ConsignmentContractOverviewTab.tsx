import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
import { usePermission } from '@/features/auth'
import { CONSIGNMENT_CONTRACT_STATUS_LABELS, CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { getEffectiveTerm } from '../addendumModel'
import { useConsignmentContract, useConsignmentProposal } from '../hooks'
import { RESPONSIBILITY_ITEM_KEYS, type ConsignmentContract } from '../model'
import { ConsignmentField } from './ConsignmentField'

function ContractLink({ id }: { id: string }) {
  const { data } = useConsignmentContract(id)
  return (
    <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentContractDetail(id)}>
      {data?.contractNo ?? id}
    </Link>
  )
}

/**
 * Tab "Tổng quan & điều khoản" (plan mục 8.4). Sau khi ký, các khối điều khoản gốc hiển thị TỪ `termsSnapshot` (VC-BR-05) chứ
 * không từ field sống của hợp đồng; khối "Điều khoản hiện hành" lấy phiên bản chi trả đang áp dụng hôm nay (đã tính phụ lục).
 */
export function ConsignmentContractOverviewTab({ contract, todayKey }: { contract: ConsignmentContract; todayKey: string }) {
  const t = vi.consignment.addenda
  const { can } = usePermission()
  const canAssess = can('CONSIGNMENT', 'ASSESS')
  const { data: proposal } = useConsignmentProposal(contract.proposalId)
  const snapshot = contract.termsSnapshot
  const effective = snapshot ? getEffectiveTerm(contract, todayKey) : undefined
  const extended = !!snapshot && contract.effectiveTo !== snapshot.effectiveTo
  const effectiveFrom = snapshot?.effectiveFrom ?? contract.effectiveFrom
  const effectiveTo = snapshot?.effectiveTo ?? contract.effectiveTo
  const noticePeriodDays = snapshot?.noticePeriodDays ?? contract.noticePeriodDays
  const autoRenew = snapshot?.autoRenew ?? contract.autoRenew
  const paymentTerm = snapshot?.paymentTerm ?? contract.paymentTerm
  const rights = snapshot?.exploitationRights ?? contract.exploitationRights
  const responsibility = snapshot?.responsibilityMatrix ?? [...RESPONSIBILITY_ITEM_KEYS]
  const yesNo = (v: boolean) => (v ? vi.consignment.yes : vi.consignment.no)

  return (
    <div className="flex flex-col gap-6">
      {snapshot && (
        <div className="border-border bg-muted/40 rounded-lg border p-3">
          <p className="text-sm font-medium">{vi.consignment.snapshotAt(formatDateTime(snapshot.snapshotAt))}</p>
          <p className="text-muted-foreground text-xs">{vi.consignment.snapshotNote}</p>
        </div>
      )}

      {proposal && (
        <p className="text-sm">
          <span className="text-muted-foreground">{vi.consignment.proposals.sourceProposal}: </span>
          {canAssess ? (
            <Link className="text-primary underline-offset-4 hover:underline" to={paths.consignmentProposalDetail(proposal.id)}>
              {proposal.code}
            </Link>
          ) : (
            proposal.code
          )}
        </p>
      )}

      {snapshot && effective && (
        <section className="border-border flex flex-col gap-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{t.effectiveTermTitle}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <ConsignmentField label={t.columnVersion}>{vi.consignment.payouts.termVersionValue(effective.version.versionNo)}</ConsignmentField>
            <ConsignmentField label={vi.consignment.termFieldAmount}>{formatVnd(effective.term.fixedMonthlyAmount)}</ConsignmentField>
            <ConsignmentField label={vi.consignment.termFieldPaymentDay}>
              {vi.consignment.paymentDayValue(effective.term.paymentDay)}
            </ConsignmentField>
            <ConsignmentField label={vi.consignment.termFieldProration}>
              {CONSIGNMENT_PRORATION_RULE_LABELS[effective.term.prorationRule]}
            </ConsignmentField>
          </div>
          <p className="text-sm">
            {t.effectiveUntil(formatDate(contract.effectiveTo))}
            {extended && <span className="text-muted-foreground"> — {t.extendedFrom(formatDate(snapshot.effectiveTo))}</span>}
          </p>
        </section>
      )}

      {snapshot && <h2 className="text-base font-semibold">{t.originalTermsTitle}</h2>}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionTerm}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ConsignmentField label={vi.consignment.termFieldEffective}>
            {formatDate(effectiveFrom)} – {formatDate(effectiveTo)}
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldNotice}>{vi.consignment.noticeDays(noticePeriodDays)}</ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldAutoRenew}>{yesNo(autoRenew)}</ConsignmentField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionPaymentTerm}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ConsignmentField label={vi.consignment.termFieldAmount}>{formatVnd(paymentTerm.fixedMonthlyAmount)}</ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldPaymentDay}>
            {vi.consignment.paymentDayValue(paymentTerm.paymentDay)}
          </ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldProration}>
            {CONSIGNMENT_PRORATION_RULE_LABELS[paymentTerm.prorationRule]}
          </ConsignmentField>
        </div>
        {/* TODO(OQ: VehicleConsignment-BRD.md mục 10 — "trừ khi Terms Snapshot ghi khác" chưa mô tả phương án khác; demo luôn trả đủ) */}
        <p className="text-muted-foreground text-xs">
          {vi.consignment.paymentModelFixedMonthly}. {vi.consignment.paymentSuspendedRule}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionRights}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ConsignmentField label={vi.consignment.termFieldThirdParty}>{yesNo(rights.thirdPartyPlatformAllowed)}</ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldAdvertising}>{yesNo(rights.advertisingImageAllowed)}</ConsignmentField>
          <ConsignmentField label={vi.consignment.termFieldUsageScope}>{rights.usageScopeNote}</ConsignmentField>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionResponsibility}</h3>
        <p className="text-muted-foreground text-xs">{vi.consignment.responsibilityNote}</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {responsibility.map((key) => (
            <li key={key} className="flex items-center justify-between gap-2 text-sm">
              <span>{vi.consignment.responsibility[key]}</span>
              <Badge variant="info">{vi.consignment.responsibilityCompany}</Badge>
            </li>
          ))}
        </ul>
      </section>

      {(contract.supersedesContractId || contract.supersededByContractId) && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{vi.consignment.sectionLinks}</h3>
          {contract.supersedesContractId && (
            <p className="text-sm">
              <span className="text-muted-foreground">{vi.consignment.supersedesLabel}: </span>
              <ContractLink id={contract.supersedesContractId} />
            </p>
          )}
          {contract.supersededByContractId && (
            <p className="text-sm">
              <span className="text-muted-foreground">{vi.consignment.supersededByLabel}: </span>
              <ContractLink id={contract.supersededByContractId} />
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{vi.consignment.sectionSignedCopy}</h3>
        {contract.signedCopy ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ConsignmentField label={vi.consignment.signedCopyFile}>{contract.signedCopy.fileName}</ConsignmentField>
            <ConsignmentField label={vi.consignment.signedCopyBy}>{contract.signedCopy.uploadedByName}</ConsignmentField>
            <ConsignmentField label={vi.consignment.signedCopyAt}>{formatDateTime(contract.signedCopy.uploadedAt)}</ConsignmentField>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{vi.consignment.signedCopyEmpty}</p>
        )}
      </section>

      {contract.note && (
        <section className="flex flex-col gap-2">
          <ConsignmentField label={vi.consignment.termFieldNote}>{contract.note}</ConsignmentField>
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
              {[...contract.statusHistory]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((h) => (
                  <TableRow key={`${h.at}-${h.to}`}>
                    <TableCell>{formatDateTime(h.at)}</TableCell>
                    <TableCell>
                      {h.from ? `${CONSIGNMENT_CONTRACT_STATUS_LABELS[h.from]} → ` : ''}
                      {CONSIGNMENT_CONTRACT_STATUS_LABELS[h.to]}
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
