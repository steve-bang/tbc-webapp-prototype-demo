import { DownloadIcon } from 'lucide-react'
import { toast } from 'sonner'
import { usePermission, useSessionStore } from '@/features/auth'
import { ROLE_LABELS, vi } from '@/shared/i18n/vi'
import { downloadCsv, toCsv } from '@/shared/lib/csv'
import { formatDate, formatDateTime } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { useRecordReportExport } from '../hooks'
import { buildReportCsvRows, countCsvDataRows, type CsvSection, type FinancePeriod, type FinanceReportKey, type ReportExportFilters } from '../model'

/**
 * UC-RV-13 — nút "Xuất CSV" của từng tab báo cáo. Ẩn hẳn khi thiếu `FINANCE_REPORT.EXPORT`.
 * Luồng: dựng `sections` từ chính dữ liệu đang hiển thị (`getSections`) → ghi 1 audit `REPORT_EXPORT` → CHỈ khi audit thành công mới tải file.
 * TODO(OQ: RevenueCost-BRD.md §28 Q14 — định dạng xuất PDF/Excel chưa chốt; demo xuất CSV mở bằng Excel)
 */
export function ReportExportButton({
  reportKey,
  period,
  filters,
  filterLabels,
  getSections,
}: {
  reportKey: FinanceReportKey
  period: FinancePeriod
  filters?: ReportExportFilters
  /** Nhãn bộ lọc đang áp dụng (tiếng Việt) — ghi ở khối đầu file; rỗng → "Không". */
  filterLabels: string[]
  getSections: () => CsvSection[]
}) {
  const t = vi.finance.reports
  const { can } = usePermission()
  const user = useSessionStore((s) => s.user)
  const recordExport = useRecordReportExport()
  if (!can('FINANCE_REPORT', 'EXPORT')) return null

  async function handleExport() {
    const sections = getSections()
    const rowCount = countCsvDataRows(sections)
    try {
      await recordExport.mutateAsync({ reportKey, from: period.from, to: period.to, rowCount, filters: filters ?? {} })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.exportError)
      return
    }
    const exportedBy = user ? `${user.fullName} (${ROLE_LABELS[user.role]})` : ''
    const metaLines: [string, string][] = [
      [t.exportMetaReport, t.exportNames[reportKey]],
      [t.exportMetaPeriod, `${formatDate(period.from)} – ${formatDate(period.to)}`],
      [t.exportMetaFilters, filterLabels.length > 0 ? filterLabels.join('; ') : t.exportMetaFiltersNone],
      [t.exportMetaRecognition, t.exportMetaRecognitionValue],
      [t.exportMetaStatus, t.exportMetaStatusValue],
      [t.exportMetaExportedAt, formatDateTime(new Date().toISOString())],
      [t.exportMetaExportedBy, exportedBy],
    ]
    const fileName = `bao-cao-${t.exportSlugs[reportKey]}_${period.from}_${period.to}.csv`
    downloadCsv(fileName, toCsv(buildReportCsvRows({ metaLines }, sections)))
    toast.success(t.exportSuccess.replace('{file}', fileName))
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={recordExport.isPending} onClick={() => void handleExport()}>
      <DownloadIcon />
      {recordExport.isPending ? t.exporting : t.exportButton}
    </Button>
  )
}
