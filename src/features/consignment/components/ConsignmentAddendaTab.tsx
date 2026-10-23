import { useState } from 'react'
import { CONSIGNMENT_PRORATION_RULE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { listTermVersionStates, type ConsignmentAddendum } from '../addendumModel'
import type { ConsignmentContract, SnapshotVehicleInfo, VehicleOwner } from '../model'
import { ConsignmentAddendumPreviewDialog } from './ConsignmentAddendumPreviewDialog'

/** Tóm tắt thay đổi của một phụ lục: gia hạn và/hoặc điều khoản chi trả cũ → mới (kèm ngày hiệu lực). */
function ChangeSummary({ addendum }: { addendum: ConsignmentAddendum }) {
  const t = vi.consignment.addenda
  return (
    <div className="flex flex-col gap-0.5 whitespace-normal">
      {addendum.extension && (
        <span>
          {t.changeExtension}: {formatDate(addendum.extension.fromEffectiveTo)} → {formatDate(addendum.extension.toEffectiveTo)}
        </span>
      )}
      {addendum.termChange && (
        <span>
          {t.changeTerm}: {formatVnd(addendum.termChange.from.fixedMonthlyAmount)} → {formatVnd(addendum.termChange.to.fixedMonthlyAmount)}
          {addendum.termChange.from.paymentDay !== addendum.termChange.to.paymentDay
            ? `; ${vi.consignment.paymentDayValue(addendum.termChange.from.paymentDay)} → ${vi.consignment.paymentDayValue(addendum.termChange.to.paymentDay)}`
            : ''}
          {' '}
          ({t.changeFrom(formatDate(addendum.termChange.effectiveFrom))})
        </span>
      )}
    </div>
  )
}

/**
 * Tab "Phụ lục & phiên bản": bảng phiên bản điều khoản chi trả (đang áp dụng / sắp hiệu lực / đã qua) và danh sách phụ lục đã
 * lập (append-only). Điều khoản gốc lúc ký không đổi — mọi thay đổi chỉ qua phụ lục có ngày hiệu lực (VC-BR-05, AC-VC-012).
 */
export function ConsignmentAddendaTab({
  contract,
  todayKey,
  owner,
  vehicle,
}: {
  contract: ConsignmentContract
  todayKey: string
  owner?: VehicleOwner
  vehicle?: SnapshotVehicleInfo
}) {
  const t = vi.consignment.addenda
  const versions = listTermVersionStates(contract, todayKey)
  const [viewing, setViewing] = useState<ConsignmentAddendum | undefined>(undefined)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.versionsTitle}</h3>
        {versions.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.versionsEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnVersion}</TableHead>
                  <TableHead>{t.columnEffectiveFrom}</TableHead>
                  <TableHead className="text-right">{vi.consignment.contractColumnAmount}</TableHead>
                  <TableHead>{vi.consignment.contractColumnPaymentDay}</TableHead>
                  <TableHead>{vi.consignment.termFieldProration}</TableHead>
                  <TableHead>{t.columnSource}</TableHead>
                  <TableHead>{vi.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map(({ version, state, addendumNo }) => (
                  <TableRow key={version.versionNo}>
                    <TableCell className="font-medium">{vi.consignment.payouts.termVersionValue(version.versionNo)}</TableCell>
                    <TableCell>{formatDate(version.effectiveFrom)}</TableCell>
                    <TableCell className="text-right">{formatVnd(version.paymentTerm.fixedMonthlyAmount)}</TableCell>
                    <TableCell>{vi.consignment.paymentDayValue(version.paymentTerm.paymentDay)}</TableCell>
                    <TableCell>{CONSIGNMENT_PRORATION_RULE_LABELS[version.paymentTerm.prorationRule]}</TableCell>
                    <TableCell>{version.source === 'ADDENDUM' ? (addendumNo ?? t.sourceAddendum) : t.sourceOriginal}</TableCell>
                    <TableCell>
                      <Badge variant={state === 'CURRENT' ? 'success' : state === 'UPCOMING' ? 'info' : 'neutral'}>{t.versionState[state]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t.listTitle}</h3>
        {contract.addenda.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.listEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columnNo}</TableHead>
                  <TableHead>{t.columnOrigin}</TableHead>
                  <TableHead>{t.columnSignedDate}</TableHead>
                  <TableHead>{t.columnContent}</TableHead>
                  <TableHead>{t.columnChange}</TableHead>
                  <TableHead>{t.columnSignedCopy}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...contract.addenda]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.addendumNo}</TableCell>
                      <TableCell>{t.origin[a.origin]}</TableCell>
                      <TableCell>{formatDate(a.signedDate)}</TableCell>
                      <TableCell className="whitespace-normal">{a.content}</TableCell>
                      <TableCell>
                        <ChangeSummary addendum={a} />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {a.signedCopy.fileName}
                        <span className="text-muted-foreground block text-xs">
                          {a.signedCopy.uploadedByName} · {formatDateTime(a.signedCopy.uploadedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setViewing(a)}>
                          {t.viewButton}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {viewing && (
        <ConsignmentAddendumPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewing(undefined)
          }}
          contract={contract}
          addendum={viewing}
          owner={owner}
          vehicle={vehicle}
        />
      )}
    </div>
  )
}
