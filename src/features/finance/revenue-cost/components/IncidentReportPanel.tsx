import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '@/app/paths'
// `import type` — cấm import giá trị runtime từ barrel `vehicles` (vòng barrel).
import type { Vehicle } from '@/features/vehicles'
import type { Incident } from '@/features/incidents'
import { INCIDENT_STATUS_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { formatVnd } from '@/shared/lib/money'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { buildIncidentReport, type CsvSection } from '../reportModel'
import type { FinancePeriod } from '../model'
import { ReportExportButton } from './ReportExportButton'

/** Ô tiền có thể thiếu: `null` → "—". */
function money(value: number | null): string {
  return value === null ? vi.finance.reports.compareNone : formatVnd(value)
}

/**
 * Report 04 (sự cố) — kỳ theo ngày báo; mọi trạng thái đều hiện, nhưng chỉ sự cố đã chốt phần công ty chịu mới "Tính vào chi phí".
 * CSV dựng từ chính `rows`/`totals` bên dưới.
 * TODO(OQ: RevenueCost-UseCase.md UC-RV-02 bước 2 — Cost Date = ngày chốt hay ngày phát sinh; demo dùng reportedAt)
 */
export function IncidentReportPanel({ incidents, vehicles, period }: { incidents: Incident[]; vehicles: Vehicle[]; period: FinancePeriod }) {
  const t = vi.finance.reports
  const { rows, totals } = useMemo(() => buildIncidentReport(incidents, period), [incidents, period])
  const plateById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.plate])), [vehicles])
  const plateOf = (id: string) => plateById.get(id) ?? id

  function getSections(): CsvSection[] {
    return [
      {
        title: t.incidentTitle,
        headers: [
          t.incidentColumnDate,
          t.incidentColumnCode,
          t.incidentColumnVehicle,
          t.incidentColumnRental,
          t.incidentColumnActual,
          t.incidentColumnCustomer,
          t.incidentColumnCompany,
          t.incidentColumnInsurance,
          t.incidentColumnStatus,
          t.incidentColumnCounted,
        ],
        rows: rows.map((r) => [
          formatDate(r.reportedAt),
          r.incidentCode,
          plateOf(r.vehicleId),
          r.rentalId ?? '',
          r.actualCost,
          r.customerCharge,
          r.companyCost,
          r.insuranceCovered,
          INCIDENT_STATUS_LABELS[r.status],
          r.countedAsCost ? t.incidentCountedYes : t.incidentCountedNo,
        ]),
        totalRow: [t.incidentTotalRow, '', '', '', totals.actualCost, totals.customerCharge, totals.companyCost, totals.insuranceCovered, '', ''],
      },
      { title: t.incidentCountedTotal, headers: [t.reconColumnAmount], rows: [], totalRow: [totals.countedCompanyCost] },
    ]
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">{t.incidentNote}</p>
        <ReportExportButton reportKey="INCIDENT" period={period} filterLabels={[]} getSections={getSections} />
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.incidentEmpty}</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.incidentColumnDate}</TableHead>
                  <TableHead>{t.incidentColumnCode}</TableHead>
                  <TableHead>{t.incidentColumnVehicle}</TableHead>
                  <TableHead>{t.incidentColumnRental}</TableHead>
                  <TableHead className="text-right">{t.incidentColumnActual}</TableHead>
                  <TableHead className="text-right">{t.incidentColumnCustomer}</TableHead>
                  <TableHead className="text-right">{t.incidentColumnCompany}</TableHead>
                  <TableHead className="text-right">{t.incidentColumnInsurance}</TableHead>
                  <TableHead>{t.incidentColumnStatus}</TableHead>
                  <TableHead>{t.incidentColumnCounted}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.incidentId}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.reportedAt)}</TableCell>
                    <TableCell>
                      <Link to={paths.incidentDetail(r.incidentId)} className="text-primary font-mono text-xs hover:underline">
                        {r.incidentCode}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{plateOf(r.vehicleId)}</TableCell>
                    <TableCell>
                      {r.rentalId ? (
                        <Link to={paths.rentalDetail(r.rentalId)} className="text-primary font-mono text-xs hover:underline">
                          {r.rentalId}
                        </Link>
                      ) : (
                        t.compareNone
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(r.actualCost)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(r.customerCharge)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(r.companyCost)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(r.insuranceCovered)}</TableCell>
                    <TableCell className="whitespace-nowrap">{INCIDENT_STATUS_LABELS[r.status]}</TableCell>
                    <TableCell>{r.countedAsCost ? t.incidentCountedYes : t.incidentCountedNo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{t.incidentTotalRow}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.actualCost)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.customerCharge)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.companyCost)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{formatVnd(totals.insuranceCovered)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="flex flex-col gap-2 sm:hidden">
            {rows.map((r) => (
              <div key={r.incidentId} className="border-border flex min-w-0 flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link to={paths.incidentDetail(r.incidentId)} className="text-primary font-mono text-xs hover:underline">
                    {r.incidentCode}
                  </Link>
                  <span className="text-muted-foreground text-xs">{formatDate(r.reportedAt)}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {plateOf(r.vehicleId)} · {INCIDENT_STATUS_LABELS[r.status]}
                </p>
                <dl className="text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt>{t.incidentColumnActual}</dt>
                  <dd className="text-foreground text-right">{money(r.actualCost)}</dd>
                  <dt>{t.incidentColumnCustomer}</dt>
                  <dd className="text-foreground text-right">{money(r.customerCharge)}</dd>
                  <dt>{t.incidentColumnCompany}</dt>
                  <dd className="text-foreground text-right">{money(r.companyCost)}</dd>
                  <dt>{t.incidentColumnInsurance}</dt>
                  <dd className="text-foreground text-right">{money(r.insuranceCovered)}</dd>
                  <dt>{t.incidentColumnCounted}</dt>
                  <dd className="text-foreground text-right">{r.countedAsCost ? t.incidentCountedYes : t.incidentCountedNo}</dd>
                </dl>
              </div>
            ))}
            <div className="bg-muted/50 flex items-center justify-between gap-2 rounded-md p-3 text-sm font-medium">
              <span>{t.incidentTotalRow}</span>
              <span>{formatVnd(totals.companyCost)}</span>
            </div>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">{t.incidentCountedTotal}: </span>
            <span className="font-medium">{formatVnd(totals.countedCompanyCost)}</span>
          </p>
        </>
      )}
    </div>
  )
}
